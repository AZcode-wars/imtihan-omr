/**
 * Core In-Browser OMR Engine (OpenCV.js WASM)
 *
 * Port 1:1 dari Python Engine (packages/omr-engine):
 * - imaging.py: find_fiducial_markers, select_and_order_fiducials, warp_to_standard_canvas, binarize_for_inspection
 * - grade.py: calculate_bubble_fill_ratio, classify_mc_slot, grade_sheet_image
 */

import type {
  DetectedMCAnswer,
  ExamTemplate,
  OMRScanResponse,
  OptionLabel,
  RectMm,
} from "@/types/omr";
import type {
  FiducialCandidate,
  OrderResult,
  SheetOrientation,
} from "./types";

export const PAGE_WIDTH_MM = 210.0;
export const PAGE_HEIGHT_MM = 297.0;
export const MARGIN_MM = 8.0;
export const FIDUCIAL_TL_MM = 14.0;
export const FIDUCIAL_OTHER_MM = 10.0;

export const EMPTY_THRESHOLD = 0.18;
export const LOW_CONF_THRESHOLD = 0.38;
export const FILLED_THRESHOLD = 0.45;

export class FiducialDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiducialDetectionError";
  }
}

/**
 * Cari kandidat kontur kotak fiducial marker solid hitam pada citra grayscale.
 */
export function findFiducialMarkers(
  cv: any,
  grayMat: any,
  minAreaRatio: number = 0.00005,
  maxAreaRatio: number = 0.02
): FiducialCandidate[] {
  const hImg = grayMat.rows;
  const wImg = grayMat.cols;
  const totalArea = hImg * wImg;
  const minArea = totalArea * minAreaRatio;
  const maxArea = totalArea * maxAreaRatio;

  // 1. Gaussian Blur (5,5)
  const blurred = new cv.Mat();
  const ksize = new cv.Size(5, 5);
  cv.GaussianBlur(grayMat, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

  // 2. Adaptive Thresholding (INV)
  const thresh = new cv.Mat();
  cv.adaptiveThreshold(
    blurred,
    thresh,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    25,
    10
  );
  blurred.delete();

  // 3. Find Contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  thresh.delete();
  hierarchy.delete();

  const candidates: FiducialCandidate[] = [];
  const approx = new cv.Mat();

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);

    if (area < minArea || area > maxArea) {
      cnt.delete();
      continue;
    }

    const peri = cv.arcLength(cnt, true);
    cv.approxPolyDP(cnt, approx, 0.04 * peri, true);

    // Harus segi empat konveks
    if (approx.rows === 4 && cv.isContourConvex(approx)) {
      const rect = cv.minAreaRect(cnt);
      const w = rect.size.width;
      const h = rect.size.height;

      if (w > 0 && h > 0) {
        const aspectRatio = Math.min(w, h) / Math.max(w, h);
        if (aspectRatio >= 0.7) {
          const boxArea = w * h;
          const solidity = boxArea > 0 ? area / boxArea : 0;
          if (solidity >= 0.75) {
            const boxPts = cv.RotatedRect.points(rect);
            candidates.push({
              centerX: rect.center.x,
              centerY: rect.center.y,
              width: w,
              height: h,
              area,
              cornerBox: boxPts.map((p: any) => ({ x: p.x, y: p.y })),
            });
          }
        }
      }
    }

    cnt.delete();
  }

  approx.delete();
  contours.delete();

  return candidates;
}

/**
 * Kelompokkan kandidat ke 4 kuadran sudut dan tentukan orientasi lembar.
 */
export function selectAndOrderFiducials(
  candidates: FiducialCandidate[],
  imgWidth: number,
  imgHeight: number
): OrderResult {
  if (candidates.length < 4) {
    throw new FiducialDetectionError(
      `Hanya ditemukan ${candidates.length} kandidat fiducial marker, dibutuhkan 4.`
    );
  }

  const cxImg = imgWidth / 2.0;
  const cyImg = imgHeight / 2.0;

  const quadrants: Record<"TL" | "TR" | "BR" | "BL", FiducialCandidate[]> = {
    TL: [],
    TR: [],
    BR: [],
    BL: [],
  };

  for (const c of candidates) {
    if (c.centerX < cxImg && c.centerY < cyImg) {
      quadrants.TL.push(c);
    } else if (c.centerX >= cxImg && c.centerY < cyImg) {
      quadrants.TR.push(c);
    } else if (c.centerX >= cxImg && c.centerY >= cyImg) {
      quadrants.BR.push(c);
    } else {
      quadrants.BL.push(c);
    }
  }

  const missing = (["TL", "TR", "BR", "BL"] as const).filter(
    (k) => quadrants[k].length === 0
  );
  if (missing.length > 0) {
    throw new FiducialDetectionError(
      `Fiducial marker tidak lengkap, kuadran kosong: ${missing.join(", ")}.`
    );
  }

  const cornerDist = (c: FiducialCandidate, cornerX: number, cornerY: number) => {
    return Math.hypot(c.centerX - cornerX, c.centerY - cornerY);
  };

  const cTl = quadrants.TL.reduce((min, c) =>
    cornerDist(c, 0, 0) < cornerDist(min, 0, 0) ? c : min
  );
  const cTr = quadrants.TR.reduce((min, c) =>
    cornerDist(c, imgWidth, 0) < cornerDist(min, imgWidth, 0) ? c : min
  );
  const cBr = quadrants.BR.reduce((min, c) =>
    cornerDist(c, imgWidth, imgHeight) < cornerDist(min, imgWidth, imgHeight) ? c : min
  );
  const cBl = quadrants.BL.reduce((min, c) =>
    cornerDist(c, 0, imgHeight) < cornerDist(min, 0, imgHeight) ? c : min
  );

  const chosen = [cTl, cTr, cBr, cBl];
  const areas = chosen.map((c) => c.area);
  let largestIdx = 0;
  let maxArea = areas[0];
  for (let i = 1; i < areas.length; i++) {
    if (areas[i] > maxArea) {
      maxArea = areas[i];
      largestIdx = i;
    }
  }

  let orientation: SheetOrientation = "NORMAL";
  let orderedPts: [number, number][];

  if (largestIdx === 0) {
    orientation = "NORMAL";
    orderedPts = [
      [cTl.centerX, cTl.centerY],
      [cTr.centerX, cTr.centerY],
      [cBr.centerX, cBr.centerY],
      [cBl.centerX, cBl.centerY],
    ];
  } else if (largestIdx === 2) {
    orientation = "ROTATED_180";
    orderedPts = [
      [cBr.centerX, cBr.centerY],
      [cBl.centerX, cBl.centerY],
      [cTl.centerX, cTl.centerY],
      [cTr.centerX, cTr.centerY],
    ];
  } else if (largestIdx === 1) {
    orientation = "ROTATED_90_CCW";
    orderedPts = [
      [cTr.centerX, cTr.centerY],
      [cBr.centerX, cBr.centerY],
      [cBl.centerX, cBl.centerY],
      [cTl.centerX, cTl.centerY],
    ];
  } else {
    orientation = "ROTATED_90_CW";
    orderedPts = [
      [cBl.centerX, cBl.centerY],
      [cTl.centerX, cTl.centerY],
      [cTr.centerX, cTr.centerY],
      [cBr.centerX, cBr.centerY],
    ];
  }

  return { orderedCenters: orderedPts, orientation };
}

/**
 * Lakukan 4-point perspective warp ke kanvas A4 standar (default 840x1188 px).
 */
export function warpToStandardCanvas(
  cv: any,
  imageMat: any,
  orderedFiducialCenters: [number, number][],
  targetWidthPx: number = 840,
  targetHeightPx: number = 1188
): any {
  const pxPerMmX = targetWidthPx / PAGE_WIDTH_MM;
  const pxPerMmY = targetHeightPx / PAGE_HEIGHT_MM;

  const tlX = (MARGIN_MM + FIDUCIAL_TL_MM / 2.0) * pxPerMmX;
  const tlY = (MARGIN_MM + FIDUCIAL_TL_MM / 2.0) * pxPerMmY;
  const trX = (PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0) * pxPerMmX;
  const trY = (MARGIN_MM + FIDUCIAL_OTHER_MM / 2.0) * pxPerMmY;
  const brX = (PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0) * pxPerMmX;
  const brY = (PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0) * pxPerMmY;
  const blX = (MARGIN_MM + FIDUCIAL_OTHER_MM / 2.0) * pxPerMmX;
  const blY = (PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0) * pxPerMmY;

  const srcPts = [
    orderedFiducialCenters[0][0], orderedFiducialCenters[0][1],
    orderedFiducialCenters[1][0], orderedFiducialCenters[1][1],
    orderedFiducialCenters[2][0], orderedFiducialCenters[2][1],
    orderedFiducialCenters[3][0], orderedFiducialCenters[3][1],
  ];

  const dstPts = [tlX, tlY, trX, trY, brX, brY, blX, blY];

  const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcPts);
  const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstPts);

  const matrix = cv.getPerspectiveTransform(srcMat, dstMat);
  const warped = new cv.Mat();
  const dsize = new cv.Size(targetWidthPx, targetHeightPx);

  cv.warpPerspective(
    imageMat,
    warped,
    matrix,
    dsize,
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar()
  );

  srcMat.delete();
  dstMat.delete();
  matrix.delete();

  return warped;
}

/**
 * Adaptive Gaussian thresholding untuk mengeliminasi bayangan/pencahayaan miring.
 */
export function binarizeForInspection(cv: any, imageMat: any): any {
  let gray: any;
  let needsDeleteGray = false;

  if (imageMat.channels() === 3 || imageMat.channels() === 4) {
    gray = new cv.Mat();
    cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
    needsDeleteGray = true;
  } else {
    gray = imageMat;
  }

  const blurred = new cv.Mat();
  const ksize = new cv.Size(5, 5);
  cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

  const thresh = new cv.Mat();
  cv.adaptiveThreshold(
    blurred,
    thresh,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    35,
    10
  );

  blurred.delete();
  if (needsDeleteGray) gray.delete();

  return thresh;
}

/**
 * Hitung rasio piksel terisi dalam circular mask (inner 90% radius).
 */
export function calculateBubbleFillRatio(
  cv: any,
  binaryMat: any,
  cx: number,
  cy: number,
  radius: number
): number {
  const h = binaryMat.rows;
  const w = binaryMat.cols;
  const x1 = Math.max(0, cx - radius);
  const y1 = Math.max(0, cy - radius);
  const x2 = Math.min(w, cx + radius + 1);
  const y2 = Math.min(h, cy + radius + 1);

  if (x2 <= x1 || y2 <= y1) return 0.0;

  const roiRect = new cv.Rect(x1, y1, x2 - x1, y2 - y1);
  const roi = binaryMat.roi(roiRect);

  const mask = new cv.Mat.zeros(roi.rows, roi.cols, cv.CV_8UC1);
  const roiCx = cx - x1;
  const roiCy = cy - y1;
  const innerR = Math.max(1, Math.round(radius * 0.9));
  const center = new cv.Point(roiCx, roiCy);
  const color = new cv.Scalar(255);

  cv.circle(mask, center, innerR, color, -1);

  const totalMaskPixels = cv.countNonZero(mask);
  if (totalMaskPixels === 0) {
    roi.delete();
    mask.delete();
    return 0.0;
  }

  const maskedRoi = new cv.Mat();
  cv.bitwise_and(roi, roi, maskedRoi, mask);
  const filledPixels = cv.countNonZero(maskedRoi);

  roi.delete();
  mask.delete();
  maskedRoi.delete();

  return filledPixels / totalMaskPixels;
}

/**
 * Klasifikasi jawaban satu nomor PG berdasarkan fill ratio opsi A-D.
 */
export function classifyMcSlot(
  optionFillRatios: Record<string, number>,
  questionNumber: number
): DetectedMCAnswer {
  const entries = Object.entries(optionFillRatios);
  if (entries.length === 0) {
    return {
      questionNumber,
      selectedOption: null,
      status: "EMPTY",
      confidence: 1.0,
      rawCandidates: undefined,
    };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [topOpt, topVal] = entries[0];
  const [runnerOpt, runnerVal] = entries[1] || [topOpt, 0.0];
  const minVal = entries[entries.length - 1][1];

  const margin = topVal - runnerVal;
  const spread = topVal - minVal;

  // Kasus 1: Baris Kosong (EMPTY)
  if (topVal < EMPTY_THRESHOLD || (spread < 0.12 && topVal < 0.38)) {
    const conf = Math.max(0.0, Math.min(1.0, 1.0 - topVal / 0.3));
    return {
      questionNumber,
      selectedOption: null,
      status: "EMPTY",
      confidence: Math.round(conf * 1000) / 1000,
      rawCandidates: undefined,
    };
  }

  // Kasus 2: Jawaban Ganda (MULTIPLE / DOUBLE_FILL)
  if (runnerVal >= 0.38 && margin < 0.12) {
    const conf = Math.round(Math.min(1.0, runnerVal / topVal) * 1000) / 1000;
    const significant = entries
      .filter(([_, v]) => v >= 0.38 || topVal - v < 0.12)
      .map(([opt]) => opt as OptionLabel);
    return {
      questionNumber,
      selectedOption: null,
      status: "MULTIPLE",
      confidence: conf,
      rawCandidates: significant,
    };
  }

  // Kasus 3: Jawaban Valid & Mantap (VALID)
  if (topVal >= 0.48 && margin >= 0.15) {
    const conf = Math.round(Math.min(1.0, 0.7 + 0.3 * (margin / topVal)) * 1000) / 1000;
    return {
      questionNumber,
      selectedOption: topOpt as OptionLabel,
      status: "VALID",
      confidence: conf,
      rawCandidates: [topOpt as OptionLabel],
    };
  }

  // Kasus 4: Arsiran Ragu / Tipis (LOW_CONFIDENCE)
  const conf = Math.round(Math.max(0.3, Math.min(0.69, topVal / FILLED_THRESHOLD)) * 1000) / 1000;
  return {
    questionNumber,
    selectedOption: topOpt as OptionLabel,
    status: "LOW_CONFIDENCE",
    confidence: conf,
    rawCandidates: [topOpt as OptionLabel],
  };
}

/**
 * Potong area persegi panjang dari citra hasil warp berdasarkan koordinat mm.
 */
export function cropRectMm(
  cv: any,
  warpedMat: any,
  rectMm:
    | RectMm
    | { x?: number; y?: number; w?: number; h?: number; xMm?: number; yMm?: number; widthMm?: number; heightMm?: number },
  targetW: number = 840,
  targetH: number = 1188
): any {
  const pxX = targetW / PAGE_WIDTH_MM;
  const pxY = targetH / PAGE_HEIGHT_MM;

  const xVal = "x" in rectMm && rectMm.x !== undefined ? rectMm.x : "xMm" in rectMm && rectMm.xMm !== undefined ? rectMm.xMm : 0;
  const yVal = "y" in rectMm && rectMm.y !== undefined ? rectMm.y : "yMm" in rectMm && rectMm.yMm !== undefined ? rectMm.yMm : 0;
  const wVal = "w" in rectMm && rectMm.w !== undefined ? rectMm.w : "widthMm" in rectMm && rectMm.widthMm !== undefined ? rectMm.widthMm : 10;
  const hVal = "h" in rectMm && rectMm.h !== undefined ? rectMm.h : "heightMm" in rectMm && rectMm.heightMm !== undefined ? rectMm.heightMm : 10;

  const x1 = Math.max(0, Math.min(warpedMat.cols - 1, Math.round(xVal * pxX)));
  const y1 = Math.max(0, Math.min(warpedMat.rows - 1, Math.round(yVal * pxY)));
  const w = Math.max(1, Math.min(warpedMat.cols - x1, Math.round(wVal * pxX)));
  const h = Math.max(1, Math.min(warpedMat.rows - y1, Math.round(hVal * pxY)));

  const rect = new cv.Rect(x1, y1, w, h);
  const cropped = warpedMat.roi(rect);
  const clone = cropped.clone();
  cropped.delete();
  return clone;
}

/**
 * Pipeline penuh OMR:
 * Deteksi fiducial -> Warp kanvas -> Binarisasi -> Evaluasi PG & Crop
 */
export async function gradeSheet(
  cv: any,
  srcMat: any,
  template: ExamTemplate,
  sourceDevice: "MOBILE_CAMERA" | "DESKTOP_SCANNER" = "MOBILE_CAMERA",
  encodeMatFn?: (mat: any) => Promise<string>
): Promise<OMRScanResponse> {
  const targetWidthPx = 840;
  const targetHeightPx = 1188;

  // Pastikan format grayscale untuk deteksi fiducial
  let grayMat: any;
  let needsDeleteGray = false;
  if (srcMat.channels() === 3 || srcMat.channels() === 4) {
    grayMat = new cv.Mat();
    cv.cvtColor(srcMat, grayMat, cv.COLOR_RGBA2GRAY);
    needsDeleteGray = true;
  } else {
    grayMat = srcMat;
  }

  // 1 & 2: Temukan fiducial & warp
  const candidates = findFiducialMarkers(cv, grayMat);
  const { orderedCenters } = selectAndOrderFiducials(candidates, srcMat.cols, srcMat.rows);
  if (needsDeleteGray) grayMat.delete();

  const warped = warpToStandardCanvas(cv, srcMat, orderedCenters, targetWidthPx, targetHeightPx);

  // 3: Binarisasi
  const binary = binarizeForInspection(cv, warped);

  // 4: Klasifikasi bubble PG
  const pxX = targetWidthPx / PAGE_WIDTH_MM;
  const pxY = targetHeightPx / PAGE_HEIGHT_MM;
  const radiusPx = Math.round((template.bubbleDiameterMm / 2.0) * pxX);

  const mcAnswers: DetectedMCAnswer[] = [];
  for (const slot of template.multipleChoiceSlots) {
    const qNum = slot.questionNumber;
    const optRatios: Record<string, number> = {};
    for (const opt of slot.options) {
      const cx = Math.round(opt.xMm * pxX);
      const cy = Math.round(opt.yMm * pxY);
      const ratio = calculateBubbleFillRatio(cv, binary, cx, cy, radiusPx);
      optRatios[opt.label] = ratio;
    }
    mcAnswers.push(classifyMcSlot(optRatios, qNum));
  }

  binary.delete();

  // 5: Crop Potongan Nama & Esai jika encoder tersedia
  let studentNameCropUrl = "";
  let fullWarpedImageUrl = "";
  let essayAreaCropUrl: string | null = null;

  if (encodeMatFn) {
    const nameCropMat = cropRectMm(cv, warped, template.nameCropRectMm, targetWidthPx, targetHeightPx);
    studentNameCropUrl = await encodeMatFn(nameCropMat);
    nameCropMat.delete();

    if (template.essayAreaRectMm) {
      const essayMat = cropRectMm(cv, warped, template.essayAreaRectMm, targetWidthPx, targetHeightPx);
      essayAreaCropUrl = await encodeMatFn(essayMat);
      essayMat.delete();
    }

    fullWarpedImageUrl = await encodeMatFn(warped);
  }

  warped.delete();

  return {
    scanId: `wasm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sourceDevice,
    timestamp: new Date().toISOString(),
    studentNameCropUrl,
    fullWarpedImageUrl,
    mcAnswers,
    essayAreaCropUrl,
  };
}
