/**
 * Generator Koordinat & Template LJK Standar A4.
 *
 * Sesuai keputusan produk:
 * 1. Lembar cetak LJK (PDF & Blueprint SVG) selalu berformat FIX STANDAR 30 SOAL PG (3 kolom @ 10 nomor)
 *    ditambah 1 zona esai di bawahnya (FR-1.2, FR-1.3, FR-1.5).
 * 2. Engine OMR saat pemindaian hanya mengevaluasi slot sejumlah soal yang diatur guru (1 s/d N),
 *    mengabaikan nomor di atas N pada lembar fisik agar tidak menimbulkan false-warning/empty.
 * 3. Koordinat konsisten 1:1 dengan engine Python (omr_engine/template.py).
 */

import { ExamConfig, ExamTemplate, MultipleChoiceSlot, RectMm } from "@/types/omr";

export const PAGE_WIDTH_MM = 210.0;
export const PAGE_HEIGHT_MM = 297.0;
export const MARGIN_MM = 8.0;

export const BUBBLE_DIAMETER_MM = 4.5;
export const BUBBLE_PITCH_MM = 8.5;

export const FIDUCIAL_TL_MM = 14.0;
export const FIDUCIAL_OTHER_MM = 10.0;

export const CONTENT_LEFT_MM = 14.0;
export const CONTENT_WIDTH_MM = 176.0;

export const COLUMN_COUNT = 3;
export const COLUMN_X_MM = [14.0, 78.5, 143.0] as const;

export const GROUP_SIZE = 5;
export const GROUP_GAP_MM = 3.5;

export const MC_START_Y_MM = 96.0;
export const ESSAY_TITLE_GAP_MM = 13.75;
export const ESSAY_AREA_GAP_MM = 8.0;
export const ESSAY_AREA_MIN_H_MM = 30.0;
export const CONTENT_BOTTOM_MM = PAGE_HEIGHT_MM - MARGIN_MM - 13.0; // 276.0 mm

export const OPTION_LABELS = ["A", "B", "C", "D"] as const;

export const STANDARD_TOTAL_PG = 30;
export const STANDARD_ROWS_PER_COLUMN = 10;

export interface GeneratedLayout {
  slots: MultipleChoiceSlot[];
  pgBottomY: number;
  essayAreaRect: RectMm | null;
}

/**
 * Menghitung koordinat tata letak grid standar A4 (30 butir PG, 3 kolom @ 10 nomor).
 */
export function computeStandardLayout(): GeneratedLayout {
  const slots: MultipleChoiceSlot[] = [];
  let pgBottomY = MC_START_Y_MM;

  let currentNum = 1;
  for (let colIdx = 0; colIdx < COLUMN_COUNT; colIdx++) {
    const colX = COLUMN_X_MM[colIdx];
    let y = MC_START_Y_MM;
    const endNum = currentNum + STANDARD_ROWS_PER_COLUMN - 1;

    for (let num = currentNum; num <= endNum; num++) {
      slots.push({
        questionNumber: num,
        xMm: colX,
        yMm: Number(y.toFixed(3)),
        options: [
          { label: "A", xMm: colX + 10.0, yMm: Number(y.toFixed(3)) },
          { label: "B", xMm: colX + 18.5, yMm: Number(y.toFixed(3)) },
          { label: "C", xMm: colX + 27.0, yMm: Number(y.toFixed(3)) },
          { label: "D", xMm: colX + 35.5, yMm: Number(y.toFixed(3)) },
        ],
      });

      const bubbleBottom = y + BUBBLE_DIAMETER_MM / 2;
      if (bubbleBottom > pgBottomY) {
        pgBottomY = bubbleBottom;
      }

      y += BUBBLE_PITCH_MM;
      if (num % GROUP_SIZE === 0 && num < endNum) {
        y += GROUP_GAP_MM;
      }
    }

    currentNum = endNum + 1;
  }

  const essayTitleY = pgBottomY + ESSAY_TITLE_GAP_MM;
  const areaTop = essayTitleY + ESSAY_AREA_GAP_MM;
  const areaHeight = Math.max(ESSAY_AREA_MIN_H_MM, CONTENT_BOTTOM_MM - areaTop);

  const essayAreaRect: RectMm = {
    x: CONTENT_LEFT_MM,
    y: Number(areaTop.toFixed(3)),
    w: CONTENT_WIDTH_MM,
    h: Number(areaHeight.toFixed(3)),
  };

  return {
    slots,
    pgBottomY: Number(pgBottomY.toFixed(3)),
    essayAreaRect,
  };
}

export const STANDARD_LAYOUT = computeStandardLayout();

/**
 * Menghasilkan objek ExamTemplate standar A4 fisik (30 soal PG + esai).
 * Ini adalah representasi lembar yang dicetak ke kertas fisik.
 */
export function getStandardA4Template(examId = "exam-standard"): ExamTemplate {
  return {
    id: "tpl-standard-a4-30pg",
    examId,
    pageWidthMm: PAGE_WIDTH_MM,
    pageHeightMm: PAGE_HEIGHT_MM,
    columnCount: COLUMN_COUNT,
    bubbleDiameterMm: BUBBLE_DIAMETER_MM,
    bubblePitchMm: BUBBLE_PITCH_MM,
    fiducials: [
      {
        corner: "TOP_LEFT",
        sizeMm: FIDUCIAL_TL_MM,
        xMm: MARGIN_MM,
        yMm: MARGIN_MM,
      },
      {
        corner: "TOP_RIGHT",
        sizeMm: FIDUCIAL_OTHER_MM,
        xMm: PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM,
        yMm: MARGIN_MM,
      },
      {
        corner: "BOTTOM_LEFT",
        sizeMm: FIDUCIAL_OTHER_MM,
        xMm: MARGIN_MM,
        yMm: PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM,
      },
      {
        corner: "BOTTOM_RIGHT",
        sizeMm: FIDUCIAL_OTHER_MM,
        xMm: PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM,
        yMm: PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM,
      },
    ],
    nameCropRectMm: { x: 14.0, y: 30.0, w: 90.0, h: 20.0 },
    multipleChoiceSlots: STANDARD_LAYOUT.slots,
    essayAreaRectMm: STANDARD_LAYOUT.essayAreaRect,
  };
}

/**
 * Membangun template pemindaian untuk Engine OMR berdasarkan konfigurasi ujian aktif.
 *
 * Menggunakan koordinat presisi lembar fisik standar 30 soal, tetapi hanya menyertakan
 * slot nomor 1 s/d N (sesuai jumlah soal yang disetting guru).
 * Dengan demikian:
 * - Engine hanya memindai nomor soal yang aktif di lembar fisik.
 * - Nomor di atas N di kertas fisik diabaikan sepenuhnya, tidak menimbulkan false-warning/empty.
 */
export function buildTemplateFromExam(config?: ExamConfig | null): ExamTemplate {
  const activePgCount = config?.multipleChoiceQuestions?.length ?? 30;
  const safePgCount = Math.min(STANDARD_TOTAL_PG, Math.max(1, activePgCount));
  const examId = config?.id || "exam-active";
  const hasEssay = (config?.essayQuestions?.length ?? 1) > 0;

  const standardTemplate = getStandardA4Template(examId);

  return {
    ...standardTemplate,
    id: `tpl-std30-${safePgCount}pg-active`,
    examId,
    // Hanya sertakan slot yang aktif disetting guru dari grid standar 30 soal
    multipleChoiceSlots: standardTemplate.multipleChoiceSlots.slice(0, safePgCount),
    essayAreaRectMm: hasEssay ? standardTemplate.essayAreaRectMm : null,
  };
}
