import { describe, expect, it } from "vitest";
import {
  checkCornerSquare,
  detectFiducialsFromImageData,
  CORNER_ZONES,
} from "./fiducial-detector";

describe("fiducial-detector", () => {
  const WIDTH = 320;
  const HEIGHT = 450;

  function createMockImageData(fillWhite = true): ImageData {
    const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    if (fillWhite) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 230;     // R
        data[i + 1] = 230; // G
        data[i + 2] = 230; // B
        data[i + 3] = 255; // A
      }
    }
    return { data, width: WIDTH, height: HEIGHT } as unknown as ImageData;
  }

  function drawBlackSquare(
    imageData: ImageData,
    startX: number,
    startY: number,
    size: number
  ) {
    const { data, width } = imageData;
    for (let y = startY; y < startY + size; y++) {
      for (let x = startX; x < startX + size; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 10;     // R
        data[idx + 1] = 10; // G
        data[idx + 2] = 10; // B
        data[idx + 3] = 255;
      }
    }
  }

  it("mendeteksi false ketika kanvas kosong putih tanpa marker", () => {
    const imgData = createMockImageData(true);
    const result = detectFiducialsFromImageData(imgData);
    expect(result.detected).toBe(false);
    expect(result.cornerCount).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("mendeteksi true ketika 4 sudut digambar kotak hitam fiducial", () => {
    const imgData = createMockImageData(true);

    // Gambar 4 kotak fiducial (ukuran ~16x16 px)
    drawBlackSquare(imgData, 30, 30, 16);   // TL
    drawBlackSquare(imgData, 250, 30, 16);  // TR
    drawBlackSquare(imgData, 30, 360, 16);  // BL
    drawBlackSquare(imgData, 250, 360, 16); // BR

    const result = detectFiducialsFromImageData(imgData);
    expect(result.corners.tl).toBe(true);
    expect(result.corners.tr).toBe(true);
    expect(result.corners.bl).toBe(true);
    expect(result.corners.br).toBe(true);
    expect(result.cornerCount).toBe(4);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it("mendeteksi sebagian sudut jika hanya 2 atau 3 sudut yang terlihat", () => {
    const imgData = createMockImageData(true);

    drawBlackSquare(imgData, 30, 30, 16);   // TL
    drawBlackSquare(imgData, 250, 30, 16);  // TR

    const result = detectFiducialsFromImageData(imgData);
    expect(result.corners.tl).toBe(true);
    expect(result.corners.tr).toBe(true);
    expect(result.corners.bl).toBe(false);
    expect(result.corners.br).toBe(false);
    expect(result.cornerCount).toBe(2);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0.5);
  });
});
