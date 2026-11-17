/**
 * Web Worker untuk In-Browser OMR Engine (OpenCV.js WASM)
 *
 * Menjalankan seluruh komputasi citra di background thread
 * agar UI dan viewfinder kamera tetap responsif 60 FPS.
 */

/* global importScripts, cv, OffscreenCanvas, ImageData, createImageBitmap, btoa */

// 1. Load OpenCV.js WASM runtime
try {
  importScripts("/wasm/opencv.js");
} catch (e) {
  console.error("Gagal me-load /wasm/opencv.js di Worker:", e);
}

let cvReadyPromise = null;

function waitForCv() {
  if (cvReadyPromise) return cvReadyPromise;

  cvReadyPromise = new Promise((resolve, reject) => {
    if (typeof cv !== "undefined" && cv.Mat) {
      resolve(cv);
      return;
    }

    if (typeof cv !== "undefined" && typeof cv.then === "function") {
      cv.then((resolvedCv) => resolve(resolvedCv)).catch(reject);
      return;
    }

    // Polling fallback
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (typeof cv !== "undefined" && cv.Mat) {
        clearInterval(interval);
        resolve(cv);
      } else if (attempts > 50) {
        clearInterval(interval);
        reject(new Error("Timeout memuat runtime OpenCV.js"));
      }
    }, 100);
  });

  return cvReadyPromise;
}

// 2. Geometri & Threshold Standar LJK A4
const PAGE_WIDTH_MM = 210.0;
const PAGE_HEIGHT_MM = 297.0;
const MARGIN_MM = 8.0;
const FIDUCIAL_TL_MM = 14.0;
const FIDUCIAL_OTHER_MM = 10.0;

const EMPTY_THRESHOLD = 0.18;
const LOW_CONF_THRESHOLD = 0.38;
const FILLED_THRESHOLD = 0.45;

// 3. Encoder Citra Mat ke Base64 Data URL via OffscreenCanvas
async function encodeMatToDataUrl(cvInst, mat, quality = 0.85) {
  let rgba = mat;
  let tempMat = null;

  if (mat.channels() === 1) {
    tempMat = new cvInst.Mat();
    cvInst.cvtColor(mat, tempMat, cvInst.COLOR_GRAY2RGBA);
    rgba = tempMat;
  } else if (mat.channels() === 3) {
    tempMat = new cvInst.Mat();
    cvInst.cvtColor(mat, tempMat, cvInst.COLOR_RGB2RGBA);
    rgba = tempMat;
  }

  const canvas = new OffscreenCanvas(rgba.cols, rgba.rows);
  const ctx = canvas.getContext("2d");
  const imgData = new ImageData(
    new Uint8ClampedArray(rgba.data),
    rgba.cols,
    rgba.rows
  );
  ctx.putImageData(imgData, 0, 0);

  if (tempMat) tempMat.delete();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 16384;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength))
    );
  }
  return "data:image/jpeg;base64," + btoa(binary);
}

// 4. Deteksi & Pengurutan 4 Sudut Fiducial
function findFiducialCandidates(cvInst, grayMat) {
  const hImg = grayMat.rows;
  const wImg = grayMat.cols;
  const totalArea = hImg * wImg;
  const minArea = totalArea * 0.00005;
  const maxArea = totalArea * 0.02;

  const blurred = new cvInst.Mat();
  const ksize = new cvInst.Size(5, 5);
  cvInst.GaussianBlur(grayMat, blurred, ksize, 0, 0, cvInst.BORDER_DEFAULT);

  const thresh = new cvInst.Mat();
  cvInst.adaptiveThreshold(
    blurred,
    thresh,
    255,
    cvInst.ADAPTIVE_THRESH_GAUSSIAN_C,
    cvInst.THRESH_BINARY_INV,
    25,
    10
  );
  blurred.delete();

  const contours = new cvInst.MatVector();
  const hierarchy = new cvInst.Mat();
  cvInst.findContours(
    thresh,
    contours,
    hierarchy,
    cvInst.RETR_EXTERNAL,
    cvInst.CHAIN_APPROX_SIMPLE
  );
  thresh.delete();
  hierarchy.delete();

  const candidates = [];
  const approx = new cvInst.Mat();

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cvInst.contourArea(cnt);

    if (area < minArea || area > maxArea) {
      cnt.delete();
      continue;
    }

    const peri = cvInst.arcLength(cnt, true);
    cvInst.approxPolyDP(cnt, approx, 0.04 * peri, true);

    if (approx.rows === 4 && cvInst.isContourConvex(approx)) {
      const rect = cvInst.minAreaRect(cnt);
      const w = rect.size.width;
      const h = rect.size.height;

      if (w > 0 && h > 0) {
        const aspectRatio = Math.min(w, h) / Math.max(w, h);
        if (aspectRatio >= 0.7) {
          const boxArea = w * h;
          const solidity = boxArea > 0 ? area / boxArea : 0;
          if (solidity >= 0.75) {
            candidates.push({
              centerX: rect.center.x,
              centerY: rect.center.y,
              width: w,
              height: h,
              area,
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

function selectAndOrder(candidates, imgWidth, imgHeight) {
  if (candidates.length < 4) {
    throw new Error(
      `Hanya ditemukan ${candidates.length} kandidat kotak sudut, dibutuhkan 4.`
    );
  }

  const cxImg = imgWidth / 2.0;
  const cyImg = imgHeight / 2.0;

  const quadrants = { TL: [], TR: [], BR: [], BL: [] };

  for (const c of candidates) {
    if (c.centerX < cxImg && c.centerY < cyImg) quadrants.TL.push(c);
    else if (c.centerX >= cxImg && c.centerY < cyImg) quadrants.TR.push(c);
    else if (c.centerX >= cxImg && c.centerY >= cyImg) quadrants.BR.push(c);
    else quadrants.BL.push(c);
  }

  const missing = Object.keys(quadrants).filter((k) => quadrants[k].length === 0);
  if (missing.length > 0) {
    throw new Error(
      `Sudut LJK belum lengkap di dalam bingkai, sudut kosong: ${missing.join(", ")}.`
    );
  }

  const dist = (c, x, y) => Math.hypot(c.centerX - x, c.centerY - y);
  const cTl = quadrants.TL.reduce((m, c) => (dist(c, 0, 0) < dist(m, 0, 0) ? c : m));
  const cTr = quadrants.TR.reduce((m, c) => (dist(c, imgWidth, 0) < dist(m, imgWidth, 0) ? c : m));
  const cBr = quadrants.BR.reduce((m, c) => (dist(c, imgWidth, imgHeight) < dist(m, imgWidth, imgHeight) ? c : m));
  const cBl = quadrants.BL.reduce((m, c) => (dist(c, 0, imgHeight) < dist(m, 0, imgHeight) ? c : m));

  const chosen = [cTl, cTr, cBr, cBl];
  let largestIdx = 0;
  let maxArea = chosen[0].area;
  for (let i = 1; i < chosen.length; i++) {
    if (chosen[i].area > maxArea) {
      maxArea = chosen[i].area;
      largestIdx = i;
    }
  }

  if (largestIdx === 0) {
    return [
      [cTl.centerX, cTl.centerY],
      [cTr.centerX, cTr.centerY],
      [cBr.centerX, cBr.centerY],
      [cBl.centerX, cBl.centerY],
    ];
  } else if (largestIdx === 2) {
    return [
      [cBr.centerX, cBr.centerY],
      [cBl.centerX, cBl.centerY],
      [cTl.centerX, cTl.centerY],
      [cTr.centerX, cTr.centerY],
    ];
  } else if (largestIdx === 1) {
    return [
      [cTr.centerX, cTr.centerY],
      [cBr.centerX, cBr.centerY],
      [cBl.centerX, cBl.centerY],
      [cTl.centerX, cTl.centerY],
    ];
  } else {
    return [
      [cBl.centerX, cBl.centerY],
      [cTl.centerX, cTl.centerY],
      [cTr.centerX, cTr.centerY],
      [cBr.centerX, cBr.centerY],
    ];
  }
}

// 5. Warp Perspektif
function warpPerspective(cvInst, srcMat, orderedCenters, targetW = 840, targetH = 1188) {
  const pxX = targetW / PAGE_WIDTH_MM;
  const pxY = targetH / PAGE_HEIGHT_MM;

  const tlX = (MARGIN_MM + FIDUCIAL_TL_MM / 2.0) * pxX;
  const tlY = (MARGIN_MM + FIDUCIAL_TL_MM / 2.0) * pxY;
  const trX = (PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0) * pxX;
  const trY = (MARGIN_MM + FIDUCIAL_OTHER_MM / 2.0) * pxY;
  const brX = (PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0) * pxX;
  const brY = (PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0) * pxY;
  const blX = (MARGIN_MM + FIDUCIAL_OTHER_MM / 2.0) * pxX;
  const blY = (PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0) * pxY;

  const srcPts = [
    orderedCenters[0][0], orderedCenters[0][1],
    orderedCenters[1][0], orderedCenters[1][1],
    orderedCenters[2][0], orderedCenters[2][1],
    orderedCenters[3][0], orderedCenters[3][1],
  ];
  const dstPts = [tlX, tlY, trX, trY, brX, brY, blX, blY];

  const sMat = cvInst.matFromArray(4, 1, cvInst.CV_32FC2, srcPts);
  const dMat = cvInst.matFromArray(4, 1, cvInst.CV_32FC2, dstPts);

  const m = cvInst.getPerspectiveTransform(sMat, dMat);
  const warped = new cvInst.Mat();
  const dsize = new cvInst.Size(targetW, targetH);

  cvInst.warpPerspective(
    srcMat,
    warped,
    m,
    dsize,
    cvInst.INTER_LINEAR,
    cvInst.BORDER_CONSTANT,
    new cvInst.Scalar()
  );

  sMat.delete();
  dMat.delete();
  m.delete();

  return warped;
}

// 6. Hitung Fill Ratio & Klasifikasi
function calcFill(cvInst, binaryMat, cx, cy, radius) {
  const h = binaryMat.rows;
  const w = binaryMat.cols;
  const x1 = Math.max(0, cx - radius);
  const y1 = Math.max(0, cy - radius);
  const x2 = Math.min(w, cx + radius + 1);
  const y2 = Math.min(h, cy + radius + 1);

  if (x2 <= x1 || y2 <= y1) return 0.0;

  const roiRect = new cvInst.Rect(x1, y1, x2 - x1, y2 - y1);
  const roi = binaryMat.roi(roiRect);
  const mask = new cvInst.Mat.zeros(roi.rows, roi.cols, cvInst.CV_8UC1);

  const innerR = Math.max(1, Math.round(radius * 0.9));
  cvInst.circle(mask, new cvInst.Point(cx - x1, cy - y1), innerR, new cvInst.Scalar(255), -1);

  const total = cvInst.countNonZero(mask);
  if (total === 0) {
    roi.delete();
    mask.delete();
    return 0.0;
  }

  const masked = new cvInst.Mat();
  cvInst.bitwise_and(roi, roi, masked, mask);
  const filled = cvInst.countNonZero(masked);

  roi.delete();
  mask.delete();
  masked.delete();

  return filled / total;
}

function classifySlot(optionFillRatios, qNum) {
  const entries = Object.entries(optionFillRatios);
  if (entries.length === 0) {
    return { questionNumber: qNum, selectedOption: null, status: "EMPTY", confidence: 1.0 };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [topOpt, topVal] = entries[0];
  const [runnerOpt, runnerVal] = entries[1] || [topOpt, 0.0];
  const minVal = entries[entries.length - 1][1];

  const margin = topVal - runnerVal;
  const spread = topVal - minVal;

  if (topVal < EMPTY_THRESHOLD || (spread < 0.12 && topVal < 0.38)) {
    const conf = Math.max(0.0, Math.min(1.0, 1.0 - topVal / 0.3));
    return { questionNumber: qNum, selectedOption: null, status: "EMPTY", confidence: Math.round(conf * 1000) / 1000 };
  }

  if (runnerVal >= 0.38 && margin < 0.12) {
    const conf = Math.round(Math.min(1.0, runnerVal / topVal) * 1000) / 1000;
    const sig = entries.filter(([_, v]) => v >= 0.38 || topVal - v < 0.12).map(([o]) => o);
    return { questionNumber: qNum, selectedOption: null, status: "MULTIPLE", confidence: conf, rawCandidates: sig };
  }

  if (topVal >= 0.48 && margin >= 0.15) {
    const conf = Math.round(Math.min(1.0, 0.7 + 0.3 * (margin / topVal)) * 1000) / 1000;
    return { questionNumber: qNum, selectedOption: topOpt, status: "VALID", confidence: conf, rawCandidates: [topOpt] };
  }

  const conf = Math.round(Math.max(0.3, Math.min(0.69, topVal / FILLED_THRESHOLD)) * 1000) / 1000;
  return { questionNumber: qNum, selectedOption: topOpt, status: "LOW_CONFIDENCE", confidence: conf, rawCandidates: [topOpt] };
}

function cropMm(cvInst, warpedMat, rectMm, targetW = 840, targetH = 1188) {
  const pxX = targetW / PAGE_WIDTH_MM;
  const pxY = targetH / PAGE_HEIGHT_MM;

  const x1 = Math.max(0, Math.min(warpedMat.cols - 1, Math.round(rectMm.xMm * pxX)));
  const y1 = Math.max(0, Math.min(warpedMat.rows - 1, Math.round(rectMm.yMm * pxY)));
  const w = Math.max(1, Math.min(warpedMat.cols - x1, Math.round(rectMm.widthMm * pxX)));
  const h = Math.max(1, Math.min(warpedMat.rows - y1, Math.round(rectMm.heightMm * pxY)));

  const rect = new cvInst.Rect(x1, y1, w, h);
  const cropped = warpedMat.roi(rect);
  const clone = cropped.clone();
  cropped.delete();
  return clone;
}

// 7. Event Handler Pesan Worker
self.onmessage = async (e) => {
  const { id, type, imageDataUrl, template, sourceDevice } = e.data || {};

  if (type === "PING") {
    try {
      await waitForCv();
      self.postMessage({ id, success: true, message: "PONG" });
    } catch (err) {
      self.postMessage({ id, success: false, error: err.message });
    }
    return;
  }

  if (type !== "SCAN") return;

  const startTime = Date.now();

  try {
    const cvInst = await waitForCv();

    if (!imageDataUrl) {
      throw new Error("Tidak ada citra lembar LJK untuk dipindai.");
    }
    if (!template || !template.multipleChoiceSlots) {
      throw new Error("Template blueprint LJK tidak valid.");
    }

    // Buat ImageBitmap dari dataUrl
    const resp = await fetch(imageDataUrl);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

    // Konversi ke cv.Mat
    const srcMat = new cvInst.Mat(imgData.height, imgData.width, cvInst.CV_8UC4);
    srcMat.data.set(imgData.data);

    // Konversi grayscale
    const grayMat = new cvInst.Mat();
    cvInst.cvtColor(srcMat, grayMat, cvInst.COLOR_RGBA2GRAY);

    // Deteksi & urutkan fiducial
    const candidates = findFiducialCandidates(cvInst, grayMat);
    const orderedCenters = selectAndOrder(candidates, srcMat.cols, srcMat.rows);
    grayMat.delete();

    // Warp kanvas A4 standar
    const targetW = 840;
    const targetH = 1188;
    const warped = warpPerspective(cvInst, srcMat, orderedCenters, targetW, targetH);
    srcMat.delete();

    // Binarisasi untuk inspeksi bubble
    const warpedGray = new cvInst.Mat();
    cvInst.cvtColor(warped, warpedGray, cvInst.COLOR_RGBA2GRAY);

    const blurred = new cvInst.Mat();
    cvInst.GaussianBlur(warpedGray, blurred, new cvInst.Size(5, 5), 0, 0, cvInst.BORDER_DEFAULT);
    warpedGray.delete();

    const binary = new cvInst.Mat();
    cvInst.adaptiveThreshold(
      blurred,
      binary,
      255,
      cvInst.ADAPTIVE_THRESH_GAUSSIAN_C,
      cvInst.THRESH_BINARY_INV,
      35,
      10
    );
    blurred.delete();

    // Evaluasi bubble PG
    const pxX = targetW / PAGE_WIDTH_MM;
    const pxY = targetH / PAGE_HEIGHT_MM;
    const radiusPx = Math.round((template.bubbleDiameterMm / 2.0) * pxX);

    const mcAnswers = [];
    for (const slot of template.multipleChoiceSlots) {
      const qNum = slot.questionNumber;
      const optRatios = {};
      for (const opt of slot.options) {
        const cx = Math.round(opt.xMm * pxX);
        const cy = Math.round(opt.yMm * pxY);
        optRatios[opt.label] = calcFill(cvInst, binary, cx, cy, radiusPx);
      }
      mcAnswers.push(classifySlot(optRatios, qNum));
    }
    binary.delete();

    // Crop nama & esai
    const nameCropMat = cropMm(cvInst, warped, template.nameCropRectMm, targetW, targetH);
    const studentNameCropUrl = await encodeMatToDataUrl(cvInst, nameCropMat, 0.9);
    nameCropMat.delete();

    let essayAreaCropUrl = undefined;
    if (template.essayAreaRectMm) {
      const essayMat = cropMm(cvInst, warped, template.essayAreaRectMm, targetW, targetH);
      essayAreaCropUrl = await encodeMatToDataUrl(cvInst, essayMat, 0.85);
      essayMat.delete();
    }

    const fullWarpedImageUrl = await encodeMatToDataUrl(cvInst, warped, 0.8);
    warped.delete();

    const durationMs = Date.now() - startTime;

    self.postMessage({
      id,
      success: true,
      durationMs,
      result: {
        scanId: `wasm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sourceDevice: sourceDevice || "CLIENT_WORKER",
        timestamp: new Date().toISOString(),
        studentNameCropUrl,
        fullWarpedImageUrl,
        mcAnswers,
        essayAreaCropUrl,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    self.postMessage({
      id,
      success: false,
      durationMs,
      error: err.message || "Gagal memproses citra LJK di Web Worker.",
    });
  }
};
