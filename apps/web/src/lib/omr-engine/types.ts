/**
 * Tipe data untuk In-Browser OpenCV.js OMR Engine.
 */
import type { ExamTemplate, OMRScanResponse, OptionLabel } from "@/types/omr";

export interface FiducialCandidate {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  area: number;
  cornerBox: { x: number; y: number }[];
}

export type SheetOrientation =
  | "NORMAL"
  | "ROTATED_180"
  | "ROTATED_90_CW"
  | "ROTATED_90_CCW";

export interface OrderResult {
  orderedCenters: [number, number][]; // [TL, TR, BR, BL]
  orientation: SheetOrientation;
}

export interface OMRWorkerRequest {
  id: string;
  type: "SCAN" | "PING";
  imageDataUrl?: string;
  template?: ExamTemplate;
  sourceDevice?: string;
  targetWidthPx?: number;
  targetHeightPx?: number;
}

export interface OMRWorkerResponse {
  id: string;
  success: boolean;
  result?: OMRScanResponse;
  error?: string;
  durationMs?: number;
}
