/**
 * Client-Side Fiducial & Corner Detector untuk Auto-Shutter Kamera.
 *
 * Menganalisis frame video kamera secara berkala pada kanvas beresolusi rendah (320x450 px).
 * Mendeteksi keberadaan 4 kotak fiducial hitam di 4 kuadran sudut lembar LJK A4
 * dengan sensitivitas tinggi menggunakan Adaptive Contrast Thresholding dan
 * Multi-Scale Connected Component Analysis yang tahan terhadap berbagai variasi jarak,
 * bayangan tangan, dan pencahayaan ruangan kelas.
 */

export interface CornerFlags {
  tl: boolean;
  tr: boolean;
  bl: boolean;
  br: boolean;
}

export interface FiducialDetectionResult {
  detected: boolean;
  cornerCount: number;
  corners: CornerFlags;
  confidence: number;
  sharpness: number;
  isSharp: boolean;
}

export interface ZoneConfig {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

// 4 Kuadran sudut pencarian fiducial pada kanvas 320 x 450 px (rasio A4).
// Mencakup kuadran penuh dari tepi hingga mendekati tengah.
export const CORNER_ZONES: Record<keyof CornerFlags, ZoneConfig> = {
  tl: { xMin: 0, xMax: 160, yMin: 0, yMax: 220 },
  tr: { xMin: 160, xMax: 320, yMin: 0, yMax: 220 },
  bl: { xMin: 0, xMax: 160, yMin: 230, yMax: 450 },
  br: { xMin: 160, xMax: 320, yMin: 230, yMax: 450 },
};

/**
 * Hitung estimasi ketajaman (gradien varians) citra secara cepat.
 */
export function calculateSharpness(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  const step = 4;

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];

      const idxR = (y * width + (x + step)) * 4;
      const lumR = 0.299 * pixels[idxR] + 0.587 * pixels[idxR + 1] + 0.114 * pixels[idxR + 2];

      const idxD = ((y + step) * width + x) * 4;
      const lumD = 0.299 * pixels[idxD] + 0.587 * pixels[idxD + 1] + 0.114 * pixels[idxD + 2];

      const grad = Math.abs(lumR - lum) + Math.abs(lumD - lum);
      sum += grad;
      sumSq += grad * grad;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/**
 * Memeriksa apakah suatu zona kuadran memiliki kotak hitam pekat (fiducial marker)
 * dengan sensitivitas tinggi dan toleransi kontras dinamis.
 */
export function checkCornerSquare(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  zone: ZoneConfig
): boolean {
  const step = 2; // Subsampling 2px untuk kecepatan maksimal sub-milidetik

  // 1. Kumpulkan statistik luminansi kuadran
  let minLum = 255;
  let maxLum = 0;
  let totalLum = 0;
  let sampleCount = 0;

  for (let y = zone.yMin; y < zone.yMax; y += step * 2) {
    for (let x = zone.xMin; x < zone.xMax; x += step * 2) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
      totalLum += lum;
      sampleCount++;
    }
  }

  if (sampleCount === 0) return false;
  const avgLum = totalLum / sampleCount;

  // Ruangan terlalu gelap gulita total (kamera tertutup)
  if (avgLum < 15) return false;

  // Kontras lokal antara area terang dan gelap minimal 15 tingkat abu-abu (sangat sensitif)
  const contrast = maxLum - minLum;
  if (contrast < 15) return false;

  // Ambang batas dinamis untuk pixel gelap kotak fiducial (42% dari rentang kontras)
  const darkThreshold = minLum + contrast * 0.42;

  // 2. Buat grid biner untuk kuadran tersebut
  const gridW = Math.floor((zone.xMax - zone.xMin) / step);
  const gridH = Math.floor((zone.yMax - zone.yMin) / step);
  if (gridW <= 0 || gridH <= 0) return false;

  const binaryGrid = new Uint8Array(gridW * gridH);
  let darkCountTotal = 0;

  for (let gy = 0; gy < gridH; gy++) {
    const y = zone.yMin + gy * step;
    for (let gx = 0; gx < gridW; gx++) {
      const x = zone.xMin + gx * step;
      const idx = (y * width + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      if (lum < darkThreshold) {
        binaryGrid[gy * gridW + gx] = 1;
        darkCountTotal++;
      }
    }
  }

  // Jika tidak ada pixel gelap atau hampir seluruh kuadran hitam pekat (meja hitam tanpa kertas)
  if (darkCountTotal < 4 || darkCountTotal > (gridW * gridH * 0.85)) {
    return false;
  }

  // 3. Flood-fill / Connected Component Analysis untuk mencari blob kotak fiducial
  const visited = new Uint8Array(gridW * gridH);
  const queueX = new Int16Array(2048);
  const queueY = new Int16Array(2048);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const gIdx = gy * gridW + gx;
      if (binaryGrid[gIdx] === 0 || visited[gIdx] === 1) continue;

      let head = 0;
      let tail = 0;
      queueX[tail] = gx;
      queueY[tail] = gy;
      tail++;
      visited[gIdx] = 1;

      let blobMinX = gx;
      let blobMaxX = gx;
      let blobMinY = gy;
      let blobMaxY = gy;
      let blobArea = 0;

      while (head < tail && tail < 2000) {
        const curX = queueX[head];
        const curY = queueY[head];
        head++;
        blobArea++;

        if (curX < blobMinX) blobMinX = curX;
        if (curX > blobMaxX) blobMaxX = curX;
        if (curY < blobMinY) blobMinY = curY;
        if (curY > blobMaxY) blobMaxY = curY;

        const neighbors = [
          [curX + 1, curY],
          [curX - 1, curY],
          [curX, curY + 1],
          [curX, curY - 1],
        ];

        for (let i = 0; i < 4; i++) {
          const nx = neighbors[i][0];
          const ny = neighbors[i][1];
          if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
            const nIdx = ny * gridW + nx;
            if (binaryGrid[nIdx] === 1 && visited[nIdx] === 0 && tail < 2000) {
              visited[nIdx] = 1;
              queueX[tail] = nx;
              queueY[tail] = ny;
              tail++;
            }
          }
        }
      }

      // Ukuran bounding box blob dalam satuan piksel kanvas
      const blobWidthPx = (blobMaxX - blobMinX + 1) * step;
      const blobHeightPx = (blobMaxY - blobMinY + 1) * step;
      const boundingBoxArea = (blobMaxX - blobMinX + 1) * (blobMaxY - blobMinY + 1);
      const density = blobArea / Math.max(1, boundingBoxArea);
      const aspectRatio = blobWidthPx / Math.max(1, blobHeightPx);

      // Kriteria kotak fiducial OMR yang fleksibel & sensitif:
      // 1. Lebar & tinggi antara 5px dan 55px pada kanvas 320x450
      // 2. Berbentuk mendekati bujur sangkar (aspek rasio antara 0.4 s/d 2.5)
      // 3. Kerapatan kompak (density >= 0.30)
      // 4. Luas area tersampling minimal 4 cell (lebar ~5px)
      const isDimensionValid =
        blobWidthPx >= 5 &&
        blobWidthPx <= 55 &&
        blobHeightPx >= 5 &&
        blobHeightPx <= 55;
      const isSquareLike = aspectRatio >= 0.4 && aspectRatio <= 2.5;
      const isSolid = density >= 0.30 && blobArea >= 4;

      if (isDimensionValid && isSquareLike && isSolid) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Deteksi 4 sudut fiducial dari ImageData kanvas video.
 */
export function detectFiducialsFromImageData(
  imageData: ImageData
): FiducialDetectionResult {
  const { data, width, height } = imageData;

  const sharpness = calculateSharpness(data, width, height);
  // Ambang batas ketajaman sangat toleran (tidak menolak citra dalam ruangan biasa)
  const isSharp = sharpness >= 0.5;

  const tl = checkCornerSquare(data, width, height, CORNER_ZONES.tl);
  const tr = checkCornerSquare(data, width, height, CORNER_ZONES.tr);
  const bl = checkCornerSquare(data, width, height, CORNER_ZONES.bl);
  const br = checkCornerSquare(data, width, height, CORNER_ZONES.br);

  const cornerCount = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);
  // Auto-shutter valid jika ke-4 sudut terdeteksi
  const detected = cornerCount === 4 && isSharp;
  const confidence = cornerCount / 4;

  return {
    detected,
    cornerCount,
    corners: { tl, tr, bl, br },
    confidence,
    sharpness,
    isSharp,
  };
}
