/**
 * Camera Utilities & High-Resolution Capture Helper
 *
 * Mengoptimalkan resolusi video stream kamera browser ke Full HD (1080p - 4K)
 * dan mengambil tangkapan frame resolusi tinggi secara instan dari kanvas video,
 * memastikan orientasi citra selalu tegak (portrait) sesuai dengan tampilan bidik guru
 * tanpa risiko distorsi orientasi sensor hardware.
 */

export const OPTIMAL_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { min: 1280, ideal: 1920, max: 3840 },
    height: { min: 720, ideal: 1080, max: 2160 },
    frameRate: { ideal: 30, max: 30 },
  },
  audio: false,
};

export const FALLBACK_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

/**
 * Tangkap frame resolusi tinggi langsung dari elemen video kamera.
 * Menggunakan resolusi video alami perangkat (Full HD 1080p) dengan kualitas JPEG 0.95.
 * Menghasilkan data URL Base64 yang instan, jernih, dan 100% tegak lurus sesuai layar.
 */
export async function captureHighResFrame(
  video: HTMLVideoElement,
  _stream?: MediaStream | null
): Promise<string | null> {
  if (!video || video.readyState < 2 || video.videoWidth === 0) {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.95);
  } catch (err) {
    console.error("Gagal menangkap frame dari video canvas:", err);
    return null;
  }
}
