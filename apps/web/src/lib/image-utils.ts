/**
 * Helper untuk memproses, mengompresi, dan me-resize gambar LJK
 * di sisi browser sebelum masuk ke IndexedDB atau dikirim ke Engine OMR.
 * Mencegah Out-Of-Memory (OOM) pada perangkat HP.
 */

export interface ResizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 - 1.0
}

/**
 * Resize berkas gambar ke ukuran ramah memori (~1600-2000px panjang maksimum).
 * Mengembalikan Base64 Data URL.
 */
export async function resizeImageFile(
  file: File,
  options: ResizeImageOptions = {}
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { maxWidth = 1800, maxHeight = 2400, quality = 0.85 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas gambar"));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat elemen gambar"));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Hitung skala rasio agar tidak melebihi batas dimensi
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Gagal menginisialisasi canvas context"));
        }

        // Gambar ulang di canvas yang sudah di-resize
        ctx.drawImage(img, 0, 0, width, height);

        // Ekspor ke format JPEG dengan kompresi yang tajam namun hemat memori
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ dataUrl, width, height });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
