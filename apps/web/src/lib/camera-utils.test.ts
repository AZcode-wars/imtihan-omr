import { describe, expect, it, vi } from "vitest";
import {
  OPTIMAL_CAMERA_CONSTRAINTS,
  FALLBACK_CAMERA_CONSTRAINTS,
  captureHighResFrame,
} from "./camera-utils";

describe("camera-utils", () => {
  it("memiliki constraint kamera Full HD / 4K yang terkonfigurasi dengan benar", () => {
    expect(OPTIMAL_CAMERA_CONSTRAINTS.audio).toBe(false);
    const videoConstraint = OPTIMAL_CAMERA_CONSTRAINTS.video as any;
    expect(videoConstraint.facingMode).toEqual({ ideal: "environment" });
    expect(videoConstraint.width.ideal).toBe(1920);
    expect(videoConstraint.height.ideal).toBe(1080);
  });

  it("memiliki constraint fallback 720p jika kamera lama menolak 1080p", () => {
    expect(FALLBACK_CAMERA_CONSTRAINTS.audio).toBe(false);
    const fallbackVideo = FALLBACK_CAMERA_CONSTRAINTS.video as any;
    expect(fallbackVideo.facingMode).toBe("environment");
    expect(fallbackVideo.width.ideal).toBe(1280);
    expect(fallbackVideo.height.ideal).toBe(720);
  });

  it("mengembalikan null jika video belum siap (videoWidth === 0)", async () => {
    const mockVideo = {
      readyState: 1,
      videoWidth: 0,
      videoHeight: 0,
    } as unknown as HTMLVideoElement;

    const result = await captureHighResFrame(mockVideo, null);
    expect(result).toBeNull();
  });
});
