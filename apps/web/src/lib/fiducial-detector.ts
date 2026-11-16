/**
 * Client-Side Fiducial & Corner Detector untuk Auto-Shutter Kamera.
 *
 * Menganalisis frame video kamera secara berkala pada kanvas beresolusi rendah (320x450 px).
 * Mendeteksi keberadaan 4 kotak fiducial hitam di 4 kuadran sudut lembar LJK A4
 * tanpa membebani CPU atau jaringan.
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
 * Memeriksa apakah suatu zona sudut memiliki gumpalan kotak hitam pekat (fiducial marker).
 */
export function checkCornerSquare(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  zone: ZoneConfig,
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

  // Ambang batas gelap: harus kontras signifikan dibanding kertas putih sekitarnya
  const darkThreshold = Math.min(100, avgLum * 0.58);

  // 2. Cari blok hitam kompak berukuran kira-kira fiducial (min 6x6 s/d maks 32x32 px)
  let maxConsecutiveDark = 0;
  let darkPixelCount = 0;

  for (let y = zone.yMin; y < zone.yMax; y += step) {
    let currentConsecutive = 0;
    for (let x = zone.xMin; x < zone.xMax; x += step) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];

      if (lum < darkThreshold) {
        darkPixelCount++;
        currentConsecutive++;
        if (currentConsecutive > maxConsecutiveDark) {
          maxConsecutiveDark = currentConsecutive;
        }
      } else {
        currentConsecutive = 0;
      }
    }
  }

  // Syarat fiducial:
  // - Memiliki kepadatan pixel gelap yang memadai (antara 25 dan 600 pixel tersampling)
  // - Memiliki bentangan horizontal kontinyu (persegi) minimal 4 sample (~8 px) dan maksimal 20 sample (~40 px)
  const hasSquareWidth = maxConsecutiveDark >= 3 && maxConsecutiveDark <= 22;
  const hasSufficientArea = darkPixelCount >= 20 && darkPixelCount <= 600;

  return hasSquareWidth && hasSufficientArea;
}

/**
 * Deteksi 4 sudut fiducial dari ImageData kanvas video.
 */
export function detectFiducialsFromImageData(
  imageData: ImageData,
): FiducialDetectionResult {
  const { data, width, height } = imageData;

  const tl = checkCornerSquare(data, width, height, CORNER_ZONES.tl);
  const tr = checkCornerSquare(data, width, height, CORNER_ZONES.tr);
  const bl = checkCornerSquare(data, width, height, CORNER_ZONES.bl);
  const br = checkCornerSquare(data, width, height, CORNER_ZONES.br);

  const cornerCount = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);
  const detected = cornerCount === 4;
  const confidence = cornerCount / 4;

  return {
    detected,
    cornerCount,
    corners: { tl, tr, bl, br },
    confidence,
  };
}
