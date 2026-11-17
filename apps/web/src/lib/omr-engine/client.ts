/**
 * Client-Side OMR Engine Orchestrator (Dual-Engine Architecture)
 *
 * Mendukung dua mode pemindaian LJK:
 * 1. CLIENT_WASM (Default): Menjalankan seluruh komputasi pemindaian LJK 100% di browser klien
 *    menggunakan OpenCV.js (WebAssembly) di Web Worker. Berjalan offline tanpa server.
 * 2. SERVER_API: Mendelegasikan pemrosesan ke backend Python FastAPI / endpoint LMS Kelaskita.
 */

import type { ExamTemplate, OMRScanResponse, OMREngineSettings } from "@/types/omr";
import { getEngineSettings } from "@/lib/db";
import type { OMRWorkerRequest, OMRWorkerResponse } from "./types";

let workerInstance: Worker | null = null;
let workerInitFailed = false;

function getWorker(): Worker | null {
  if (workerInitFailed) return null;
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;

  if (!workerInstance) {
    try {
      workerInstance = new Worker("/wasm/omr.worker.js");
      workerInstance.onerror = (err) => {
        console.warn("OMR Web Worker runtime error:", err);
      };
    } catch (e) {
      console.error("Gagal membuat OMR Web Worker OpenCV.js:", e);
      workerInitFailed = true;
      return null;
    }
  }

  return workerInstance;
}

export interface ScanOptions {
  imageDataUrl: string;
  template: ExamTemplate;
  sourceDevice?: "MOBILE_CAMERA" | "DESKTOP_SCANNER";
  timeoutMs?: number;
  engineSettings?: OMREngineSettings;
}

/**
 * Tes konektivitas ke Server OMR eksternal (FastAPI / health check).
 */
export async function testServerConnection(
  serverUrl: string,
  apiKey?: string
): Promise<{ ok: boolean; version?: string; engine?: string; error?: string }> {
  const baseUrl = serverUrl.trim().replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return {
      ok: true,
      version: data.version || "ok",
      engine: data.engine || "openomr-engine",
    };
  } catch (err: any) {
    return {
      ok: false,
      error:
        err.name === "AbortError"
          ? "Timeout: server tidak merespons dalam 5 detik"
          : (err.message || "Koneksi ke server gagal"),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Kirim pemindaian ke Server API FastAPI eksternal.
 */
export async function scanSheetWithServerApi(
  options: ScanOptions,
  settings: OMREngineSettings
): Promise<OMRScanResponse> {
  const { imageDataUrl, template, sourceDevice = "MOBILE_CAMERA", timeoutMs = 20000 } =
    options;
  const baseUrl = settings.serverUrl.trim().replace(/\/+$/, "");
  const endpoint = `${baseUrl}/v1/scan/json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.apiKey) {
    headers["X-API-Key"] = settings.apiKey;
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        template,
        imageDataUrl,
        sourceDevice,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let errMsg = `Server API error (${res.status} ${res.statusText})`;
      try {
        const errorData = await res.json();
        if (errorData?.detail) {
          errMsg =
            typeof errorData.detail === "string"
              ? errorData.detail
              : JSON.stringify(errorData.detail);
        }
      } catch {
        // Fallback ke status text
      }
      throw new Error(errMsg);
    }

    const data: OMRScanResponse = await res.json();
    return data;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(
        `Timeout request ke Server OMR (${timeoutMs / 1000}s). Pastikan server berjalan di ${baseUrl}.`
      );
    }
    throw new Error(`Gagal memproses LJK via Server API (${baseUrl}): ${err.message || err}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pindai lembar LJK langsung di browser klien menggunakan OpenCV.js WASM di Web Worker.
 */
async function scanSheetWithWasmWorker(
  options: ScanOptions
): Promise<OMRScanResponse> {
  const { imageDataUrl, template, sourceDevice = "MOBILE_CAMERA", timeoutMs = 15000 } =
    options;

  const worker = getWorker();
  if (!worker) {
    throw new Error(
      "Web Worker OpenCV.js tidak dapat diinisialisasi pada peramban ini. Pastikan peramban mendukung Web Worker dan WebAssembly."
    );
  }

  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const workerPromise = new Promise<OMRScanResponse>((resolve, reject) => {
    const handler = (e: MessageEvent<OMRWorkerResponse>) => {
      if (e.data && e.data.id === requestId) {
        worker.removeEventListener("message", handler);
        if (e.data.success && e.data.result) {
          resolve(e.data.result);
        } else {
          reject(new Error(e.data.error || "Gagal memproses LJK via OpenCV.js"));
        }
      }
    };

    worker.addEventListener("message", handler);

    const requestPayload: OMRWorkerRequest = {
      id: requestId,
      type: "SCAN",
      imageDataUrl,
      template,
      sourceDevice,
    };

    worker.postMessage(requestPayload);
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Timeout pemrosesan OMR di browser (15 detik). Coba ulangi pemindaian."));
    }, timeoutMs);
  });

  return await Promise.race([workerPromise, timeoutPromise]);
}

/**
 * Pindai lembar LJK secara dinamis sesuai preferensi Engine pengguna (Dual-Engine Mode):
 * - Jika mode = "SERVER_API", request dikirim ke backend FastAPI.
 * - Jika mode = "CLIENT_WASM" (default), diproses 100% lokal di browser via OpenCV.js Web Worker.
 */
export async function scanSheetWithClientEngine(
  options: ScanOptions
): Promise<OMRScanResponse> {
  const settings = options.engineSettings || getEngineSettings();

  if (settings.mode === "SERVER_API") {
    return await scanSheetWithServerApi(options, settings);
  }

  return await scanSheetWithWasmWorker(options);
}
