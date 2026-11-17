/**
 * Client-Side In-Browser OMR Engine Orchestrator
 *
 * Menjalankan seluruh komputasi pemindaian LJK 100% di peramban klien
 * menggunakan OpenCV.js (WebAssembly) di Web Worker.
 *
 * Frontend sepenuhnya terputus (decoupled) dari API Python server:
 * - Tidak ada dependensi ke backend FastAPI (port 8000)
 * - Berjalan offline secara mandiri (zero-dependency server)
 */

import type { ExamTemplate, OMRScanResponse } from "@/types/omr";
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
  sourceDevice?: string;
  timeoutMs?: number;
}

/**
 * Pindai lembar LJK langsung di browser klien menggunakan OpenCV.js WASM di Web Worker.
 * Murni client-side tanpa mengirim request ke server API.
 */
export async function scanSheetWithClientEngine(
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
