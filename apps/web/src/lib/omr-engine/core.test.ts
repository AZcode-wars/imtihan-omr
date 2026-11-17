import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "module";
import {
  classifyMcSlot,
  selectAndOrderFiducials,
  FiducialDetectionError,
  calculateBubbleFillRatio,
  warpToStandardCanvas,
  findFiducialMarkers,
  cropRectMm,
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
} from "./core";
import type { FiducialCandidate } from "./types";

const require = createRequire(import.meta.url);

// Dynamic import OpenCV.js for unit testing
let cv: any = null;

beforeAll(async () => {
  const cvPromise = require("@techstark/opencv-js");
  cv = await cvPromise;
});

describe("In-Browser OMR Core - classifyMcSlot", () => {
  it("harus mendeteksi EMPTY jika semua opsi bernilai rendah", () => {
    const ratios = { A: 0.05, B: 0.08, C: 0.04, D: 0.06 };
    const res = classifyMcSlot(ratios, 1);
    expect(res.status).toBe("EMPTY");
    expect(res.selectedOption).toBeNull();
  });

  it("harus mendeteksi EMPTY jika nilai merata (noise cetak/bayangan tipis)", () => {
    const ratios = { A: 0.22, B: 0.21, C: 0.20, D: 0.21 };
    const res = classifyMcSlot(ratios, 2);
    expect(res.status).toBe("EMPTY");
    expect(res.selectedOption).toBeNull();
  });

  it("harus mendeteksi VALID jika opsi teratas tebal dan kontras jelas", () => {
    const ratios = { A: 0.08, B: 0.72, C: 0.05, D: 0.07 };
    const res = classifyMcSlot(ratios, 3);
    expect(res.status).toBe("VALID");
    expect(res.selectedOption).toBe("B");
    expect(res.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("harus mendeteksi MULTIPLE jika ada dua arsiran tebal bersaing", () => {
    const ratios = { A: 0.65, B: 0.05, C: 0.62, D: 0.08 };
    const res = classifyMcSlot(ratios, 4);
    expect(res.status).toBe("MULTIPLE");
    expect(res.selectedOption).toBeNull();
    expect(res.rawCandidates).toContain("A");
    expect(res.rawCandidates).toContain("C");
  });

  it("harus mendeteksi LOW_CONFIDENCE jika arsiran tipis tapi dominan", () => {
    const ratios = { A: 0.35, B: 0.10, C: 0.08, D: 0.09 };
    const res = classifyMcSlot(ratios, 5);
    expect(res.status).toBe("LOW_CONFIDENCE");
    expect(res.selectedOption).toBe("A");
  });
});

describe("In-Browser OMR Core - selectAndOrderFiducials", () => {
  it("harus melempar FiducialDetectionError jika kandidat < 4", () => {
    const candidates: FiducialCandidate[] = [
      { centerX: 10, centerY: 10, width: 14, height: 14, area: 196, cornerBox: [] },
      { centerX: 190, centerY: 10, width: 10, height: 10, area: 100, cornerBox: [] },
    ];
    expect(() => selectAndOrderFiducials(candidates, 200, 300)).toThrow(
      FiducialDetectionError
    );
  });

  it("harus menentukan orientasi NORMAL ketika marker terbesar ada di TL", () => {
    const candidates: FiducialCandidate[] = [
      { centerX: 15, centerY: 15, width: 14, height: 14, area: 196, cornerBox: [] }, // TL
      { centerX: 185, centerY: 15, width: 10, height: 10, area: 100, cornerBox: [] }, // TR
      { centerX: 185, centerY: 285, width: 10, height: 10, area: 100, cornerBox: [] }, // BR
      { centerX: 15, centerY: 285, width: 10, height: 10, area: 100, cornerBox: [] }, // BL
    ];
    const res = selectAndOrderFiducials(candidates, 200, 300);
    expect(res.orientation).toBe("NORMAL");
    expect(res.orderedCenters[0]).toEqual([15, 15]); // TL
    expect(res.orderedCenters[1]).toEqual([185, 15]); // TR
    expect(res.orderedCenters[2]).toEqual([185, 285]); // BR
    expect(res.orderedCenters[3]).toEqual([15, 285]); // BL
  });
});

describe("In-Browser OMR Core - OpenCV.js Integration", () => {
  it("harus dapat menghitung circular bubble fill ratio dengan akurat", () => {
    expect(cv).toBeDefined();

    // Buat citra biner 100x100 dengan lingkaran putih terisi di (50, 50) radius 10
    const binMat = new cv.Mat.zeros(100, 100, cv.CV_8UC1);
    const center = new cv.Point(50, 50);
    cv.circle(binMat, center, 10, new cv.Scalar(255), -1);

    // Hitung rasio pada posisi yang tepat terisi
    const fillRatio = calculateBubbleFillRatio(cv, binMat, 50, 50, 10);
    expect(fillRatio).toBeGreaterThan(0.9);

    // Hitung rasio pada posisi kosong
    const emptyRatio = calculateBubbleFillRatio(cv, binMat, 10, 10, 10);
    expect(emptyRatio).toBe(0.0);

    binMat.delete();
  });

  it("harus dapat melakukan 4-point perspective warp dengan matriks 3x3", () => {
    expect(cv).toBeDefined();

    const srcImg = new cv.Mat.zeros(300, 200, cv.CV_8UC1);
    const orderedCenters: [number, number][] = [
      [15, 15],
      [185, 15],
      [185, 285],
      [15, 285],
    ];

    const warped = warpToStandardCanvas(cv, srcImg, orderedCenters, 840, 1188);
    expect(warped.cols).toBe(840);
    expect(warped.rows).toBe(1188);

    srcImg.delete();
    warped.delete();
  });

  it("harus dapat melakukan cropRectMm dengan format { x, y, w, h } standar schema", () => {
    expect(cv).toBeDefined();

    const warped = new cv.Mat.zeros(1188, 840, cv.CV_8UC1);
    // Format RectMm dari @openomr/schemas
    const nameRect = { x: 14, y: 30, w: 90, h: 20 };
    const cropped = cropRectMm(cv, warped, nameRect, 840, 1188);

    expect(cropped.cols).toBeGreaterThan(0);
    expect(cropped.rows).toBeGreaterThan(0);
    expect(Number.isNaN(cropped.cols)).toBe(false);
    expect(Number.isNaN(cropped.rows)).toBe(false);

    cropped.delete();
    warped.delete();
  });
});
