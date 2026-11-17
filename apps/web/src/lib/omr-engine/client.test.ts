import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  scanSheetWithServerApi,
  testServerConnection,
  scanSheetWithClientEngine,
} from "./client";
import { DEFAULT_ENGINE_SETTINGS, getEngineSettings, saveEngineSettings } from "@/lib/db";
import type { ExamTemplate, OMREngineSettings } from "@/types/omr";

// Mock localStorage untuk environment Node.js test
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

Object.defineProperty(global, "localStorage", {
  value: storageMock,
  writable: true,
});

Object.defineProperty(global, "window", {
  value: { localStorage: storageMock },
  writable: true,
});

const mockTemplate: ExamTemplate = {
  id: "tpl-test",
  examId: "exam-test",
  pageWidthMm: 210,
  pageHeightMm: 297,
  columnCount: 3,
  bubbleDiameterMm: 4.5,
  bubblePitchMm: 6.0,
  fiducials: [
    { corner: "TOP_LEFT", xMm: 15, yMm: 15, sizeMm: 8 },
    { corner: "TOP_RIGHT", xMm: 195, yMm: 15, sizeMm: 8 },
    { corner: "BOTTOM_LEFT", xMm: 15, yMm: 282, sizeMm: 8 },
    { corner: "BOTTOM_RIGHT", xMm: 195, yMm: 282, sizeMm: 8 },
  ],
  nameCropRectMm: { x: 20, y: 30, w: 100, h: 20 },
  multipleChoiceSlots: [],
  essayAreaRectMm: null,
};

describe("OMR Engine Client - Engine Settings DB", () => {
  beforeEach(() => {
    storageMock.clear();
  });

  it("harus mengembalikan DEFAULT_ENGINE_SETTINGS jika belum ada di localStorage", () => {
    const settings = getEngineSettings();
    expect(settings).toEqual(DEFAULT_ENGINE_SETTINGS);
    expect(settings.mode).toBe("CLIENT_WASM");
    expect(settings.serverUrl).toBe("http://localhost:8000");
  });

  it("harus menyimpan dan memuat preferensi SERVER_API dengan aman", () => {
    const custom: OMREngineSettings = {
      mode: "SERVER_API",
      serverUrl: "https://omr.school.id/api/",
      apiKey: "secret-key-123",
    };
    saveEngineSettings(custom);

    const loaded = getEngineSettings();
    expect(loaded.mode).toBe("SERVER_API");
    // trailing slash dibersihkan
    expect(loaded.serverUrl).toBe("https://omr.school.id/api");
    expect(loaded.apiKey).toBe("secret-key-123");
  });
});

describe("OMR Engine Client - Server API & Connectivity", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("testServerConnection berhasil jika endpoint /health mengembalikan 200 ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", version: "0.1.0", engine: "openomr-engine" }),
    });

    const res = await testServerConnection("http://localhost:8000");
    expect(res.ok).toBe(true);
    expect(res.version).toBe("0.1.0");
    expect(res.engine).toBe("openomr-engine");
  });

  it("testServerConnection gagal jika respons server 500 atau jaringan terputus", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const res = await testServerConnection("http://localhost:8000");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("HTTP 500");
  });

  it("scanSheetWithServerApi mengirim payload JSON ke /v1/scan/json dengan header yang benar", async () => {
    const mockScanResult = {
      scanId: "scan-srv-1",
      sourceDevice: "MOBILE_CAMERA",
      timestamp: "2026-11-17T00:00:00Z",
      studentNameCropUrl: "",
      fullWarpedImageUrl: "",
      essayAreaCropUrl: "",
      mcAnswers: [],
    };

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      expect(url).toBe("http://localhost:8000/v1/scan/json");
      expect(init?.method).toBe("POST");
      expect(init?.headers?.["X-API-Key"]).toBe("test-api-token");

      const body = JSON.parse(init?.body as string);
      expect(body.imageDataUrl).toBe("data:image/jpeg;base64,mockdata");
      expect(body.sourceDevice).toBe("MOBILE_CAMERA");

      return {
        ok: true,
        json: async () => mockScanResult,
      };
    });

    const result = await scanSheetWithServerApi(
      {
        imageDataUrl: "data:image/jpeg;base64,mockdata",
        template: mockTemplate,
        sourceDevice: "MOBILE_CAMERA",
      },
      {
        mode: "SERVER_API",
        serverUrl: "http://localhost:8000",
        apiKey: "test-api-token",
      }
    );

    expect(result.scanId).toBe("scan-srv-1");
  });

  it("scanSheetWithClientEngine mendelegasikan ke Server API jika engineSettings diset SERVER_API", async () => {
    const mockScanResult = {
      scanId: "scan-routed-server",
      sourceDevice: "DESKTOP_SCANNER",
      timestamp: "2026-11-17T00:00:00Z",
      studentNameCropUrl: "",
      fullWarpedImageUrl: "",
      essayAreaCropUrl: "",
      mcAnswers: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockScanResult,
    });

    const result = await scanSheetWithClientEngine({
      imageDataUrl: "data:image/jpeg;base64,mock",
      template: mockTemplate,
      sourceDevice: "DESKTOP_SCANNER",
      engineSettings: {
        mode: "SERVER_API",
        serverUrl: "http://localhost:8000",
      },
    });

    expect(result.scanId).toBe("scan-routed-server");
  });
});
