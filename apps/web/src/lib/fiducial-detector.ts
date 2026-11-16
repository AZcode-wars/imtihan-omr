/**
 * Client-Side Fiducial & Corner Detector untuk Auto-Shutter Kamera.
 *
 * Menganalisis frame video kamera secara berkala pada kanvas beresolusi rendah (320x450 px).
 * Mendeteksi keberadaan 4 kotak fiducial hitam di 4 kuadran sudut lembar LJK A4
 * dan memeriksa ketajaman citra agar tidak memotret gambar buram / gelap.
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

// 4 Zona pencarian fiducial pada kanvas 320 x 450 px (sesuai rasio A4 1 : 1.414)
export const CORNER_ZONES: Record<keyof CornerFlags, ZoneConfig> = {
  tl: { xMin: 12, xMax: 110, yMin: 12, yMax: 130 },
  tr: { xMin: 210, xMax: 308, yMin: 12, yMax: 130 },
  bl: { xMin: 12, xMax: 110, yMin: 320, yMax: 438 },
  br: { xMin: 210, xMax: 308, yMin: 320, yMax: 438 },
};

/**
 * Hitung estimasi ketajaman (gradien varians) citra secara cepat.
 * Gambar buram/gelap seragam memiliki varians < 15.0.
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
 * Memeriksa apakah suatu zona sudut memiliki gumpalan kotak hitam pekat (fiducial marker)
 * di atas kertas putih yang cukup terang.
 */
export function checkCornerSquare(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  zone: ZoneConfig
): boolean {
  let totalLuminance = 0;
  let sampleCount = 0;

  // 1. Hitung estimasi kecerahan latar belakang zona
  const step = 2; // Subsampling 2px untuk kecepatan maksimal
  for (let y = zone.yMin; y < zone.yMax; y += step * 2) {
    for (let x = zone.xMin; x < zone.xMax; x += step * 2) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      totalLuminance += lum;
      sampleCount++;
    }
  }

  if (sampleCount === 0) return false;
  const avgLum = totalLuminance / sampleCount;

  // Kertas LJK harus cukup terang (kertas putih di ruangan bernutrisi cahaya, avgLum >= 110)
  if (avgLum < 110) {
    return false;
  }

  // Ambang batas gelap untuk marker kotak hitam
  const darkThreshold = Math.min(80, avgLum * 0.55);

  // 2. Cari blok hitam kompak berukuran kira-kira fiducial
  let maxConsecutiveDark = 0;
  let darkPixelCount = 0;
  let minDark = 255;

  for (let y = zone.yMin; y < zone.yMax; y += step) {
    let currentConsecutive = 0;
    for (let x = zone.xMin; x < zone.xMax; x += step) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];

      if (lum < darkThreshold) {
        darkPixelCount++;
        currentConsecutive++;
        if (lum < minDark) minDark = lum;
        if (currentConsecutive > maxConsecutiveDark) {
          maxConsecutiveDark = currentConsecutive;
        }
      } else {
        currentConsecutive = 0;
      }
    }
  }

  // Syarat fiducial:
  // - Kontras nyata antara kertas putih dan kotak hitam >= 55
  // - Memiliki kepadatan pixel gelap memadai (antara 15 dan 600 pixel tersampling)
  // - Memiliki bentangan horizontal kontinyu (persegi) minimal 3 sample (~6 px) dan maksimal 22 sample (~44 px)
  const hasGoodContrast = avgLum - minDark >= 55;
  const hasSquareWidth = maxConsecutiveDark >= 3 && maxConsecutiveDark <= 22;
  const hasSufficientArea = darkPixelCount >= 15 && darkPixelCount <= 600;

  return hasGoodContrast && hasSquareWidth && hasSufficientArea;
}

/**
 * Deteksi 4 sudut fiducial dari ImageData kanvas video.
 */
export function detectFiducialsFromImageData(
  imageData: ImageData
): FiducialDetectionResult {
  const { data, width, height } = imageData;

  const sharpness = calculateSharpness(data, width, height);
  const isSharp = sharpness >= 15.0;

  const tl = checkCornerSquare(data, width, height, CORNER_ZONES.tl);
  const tr = checkCornerSquare(data, width, height, CORNER_ZONES.tr);
  const bl = checkCornerSquare(data, width, height, CORNER_ZONES.bl);
  const br = checkCornerSquare(data, width, height, CORNER_ZONES.br);

  const cornerCount = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);
  // Auto-shutter hanya valid jika ke-4 sudut terdeteksi DAN citra tajam (tidak buram)
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
