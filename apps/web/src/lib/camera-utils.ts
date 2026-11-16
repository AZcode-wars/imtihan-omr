/**
 * Camera Utilities & High-Resolution Capture Helper
 *
 * Mengoptimalkan resolusi video stream kamera browser dan memanfaatkan
 * W3C ImageCapture API (jika didukung peramban seperti Chrome/Edge di Android)
 * untuk memotret dengan resolusi sensor kamera asli (Multi-Megapixel),
 * dengan fallback tangkapan kanvas video Full HD pada browser lain (seperti Safari iOS).
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
 * Membaca Blob foto dan mengubahnya menjadi Data URL JPEG dengan batas dimensi maksimum
 * agar tidak terjadi Out-Of-Memory (OOM) pada ponsel beresolusi 48MP/108MP.
 */
async function blobToScaledDataUrl(
  blob: Blob,
  maxDimension = 2400,
  quality = 0.92
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Gunakan createImageBitmap jika tersedia untuk pemrosesan background thread
    if (typeof createImageBitmap === "function") {
      createImageBitmap(blob)
        .then((bitmap) => {
          let { width, height } = bitmap;
          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            bitmap.close();
            throw new Error("Gagal menginisialisasi canvas context");
          }

          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
          resolve(canvas.toDataURL("image/jpeg", quality));
        })
        .catch(() => {
          // Fallback ke FileReader konvensional jika createImageBitmap gagal
          fallbackFileReader(blob, resolve, reject);
        });
    } else {
      fallbackFileReader(blob, resolve, reject);
    }
  });
}

function fallbackFileReader(
  blob: Blob,
  resolve: (val: string) => void,
  reject: (err: any) => void
) {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(new Error("Gagal membaca blob foto kamera"));
  reader.readAsDataURL(blob);
}

/**
 * Tangkap frame resolusi tinggi dari kamera.
 * Memprioritaskan hardware ISP takePhoto() via ImageCapture API,
 * dan fallback ke canvas drawing dari elemen video.
 */
export async function captureHighResFrame(
  video: HTMLVideoElement,
  stream?: MediaStream | null
): Promise<string | null> {
  if (!video || video.readyState < 2 || video.videoWidth === 0) {
    return null;
  }

  // 1. Coba gunakan W3C ImageCapture API (Chrome, Edge, Samsung Internet di Android)
  const videoTrack = stream?.getVideoTracks?.()[0];
  const ImageCaptureCtor = (window as any).ImageCapture;

  if (videoTrack && typeof ImageCaptureCtor === "function") {
    try {
      const imageCapture = new ImageCaptureCtor(videoTrack);
      // Minta foto resolusi penuh dari sensor kamera
      const photoBlob: Blob = await imageCapture.takePhoto({
        imageWidth: 2400,
        imageHeight: 3200,
      });

      if (photoBlob && photoBlob.size > 0) {
        return await blobToScaledDataUrl(photoBlob, 2400, 0.92);
      }
    } catch (err) {
      console.warn("ImageCapture.takePhoto tidak tersedia atau gagal, menggunakan fallback canvas video:", err);
    }
  }

  // 2. Fallback: Tangkap frame langsung dari elemen video pada resolusi alaminya
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.94);
  } catch (err) {
    console.error("Gagal menangkap frame dari video canvas:", err);
    return null;
  }
}
