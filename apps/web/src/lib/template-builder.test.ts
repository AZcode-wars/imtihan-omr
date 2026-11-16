import { describe, expect, it } from "vitest";
import {
  computeStandardLayout,
  getStandardA4Template,
  buildTemplateFromExam,
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  COLUMN_COUNT,
  COLUMN_X_MM,
  STANDARD_TOTAL_PG,
} from "./template-builder";
import type { ExamConfig } from "@/types/omr";

describe("template-builder (Standar Cetak 30 PG & Filter Scan)", () => {
  describe("computeStandardLayout", () => {
    it("menghasilkan 30 PG terbagi rata dalam 3 kolom (10 per kolom)", () => {
      const layout = computeStandardLayout();
      expect(layout.slots).toHaveLength(STANDARD_TOTAL_PG);

      // Kolom 1: Q1..Q10 di X=14.0 mm
      expect(layout.slots[0].questionNumber).toBe(1);
      expect(layout.slots[0].xMm).toBe(COLUMN_X_MM[0]);
      expect(layout.slots[0].yMm).toBe(96.0);
      expect(layout.slots[9].questionNumber).toBe(10);
      expect(layout.slots[9].xMm).toBe(COLUMN_X_MM[0]);
      expect(layout.slots[9].yMm).toBe(176.0);

      // Kolom 2: Q11..Q20 di X=78.5 mm
      expect(layout.slots[10].questionNumber).toBe(11);
      expect(layout.slots[10].xMm).toBe(COLUMN_X_MM[1]);
      expect(layout.slots[10].yMm).toBe(96.0);
      expect(layout.slots[19].questionNumber).toBe(20);
      expect(layout.slots[19].xMm).toBe(COLUMN_X_MM[1]);
      expect(layout.slots[19].yMm).toBe(176.0);

      // Kolom 3: Q21..Q30 di X=143.0 mm
      expect(layout.slots[20].questionNumber).toBe(21);
      expect(layout.slots[20].xMm).toBe(COLUMN_X_MM[2]);
      expect(layout.slots[20].yMm).toBe(96.0);
      expect(layout.slots[29].questionNumber).toBe(30);
      expect(layout.slots[29].xMm).toBe(COLUMN_X_MM[2]);
      expect(layout.slots[29].yMm).toBe(176.0);

      // Area esai standar tepat di bawah batas PG
      expect(layout.essayAreaRect).not.toBeNull();
      expect(layout.essayAreaRect?.y).toBe(200.0);
      expect(layout.essayAreaRect?.w).toBe(176.0);
      expect(layout.essayAreaRect?.h).toBe(76.0);
    });

    it("setiap slot memiliki 4 opsi (A, B, C, D) dengan offset terstandarisasi", () => {
      const layout = computeStandardLayout();
      const slot1 = layout.slots[0];
      expect(slot1.options).toHaveLength(4);
      expect(slot1.options.map((o) => o.label)).toEqual(["A", "B", "C", "D"]);
      expect(slot1.options[0].xMm).toBeCloseTo(slot1.xMm + 10.0);
      expect(slot1.options[1].xMm).toBeCloseTo(slot1.xMm + 18.5);
      expect(slot1.options[2].xMm).toBeCloseTo(slot1.xMm + 27.0);
      expect(slot1.options[3].xMm).toBeCloseTo(slot1.xMm + 35.5);
    });
  });

  describe("getStandardA4Template", () => {
    it("menghasilkan template lengkap 30 PG untuk cetak fisik A4", () => {
      const template = getStandardA4Template("exam-demo");
      expect(template.pageWidthMm).toBe(PAGE_WIDTH_MM);
      expect(template.pageHeightMm).toBe(PAGE_HEIGHT_MM);
      expect(template.columnCount).toBe(COLUMN_COUNT);
      expect(template.fiducials).toHaveLength(4);
      expect(template.multipleChoiceSlots).toHaveLength(30);
      expect(template.nameCropRectMm).toEqual({ x: 14.0, y: 30.0, w: 90.0, h: 20.0 });
      expect(template.essayAreaRectMm).toEqual({ x: 14.0, y: 200.0, w: 176.0, h: 76.0 });
    });
  });

  describe("buildTemplateFromExam", () => {
    it("ketika guru mengatur 20 soal PG, hanya mengambil slot 1 s/d 20 dengan koordinat standar", () => {
      const mockConfig: Partial<ExamConfig> = {
        id: "exam-uts-20pg",
        multipleChoiceQuestions: Array.from({ length: 20 }, (_, i) => ({
          number: i + 1,
          correctAnswer: "A" as const,
          pointsCorrect: 1,
          pointsWrong: 0,
          status: "ACTIVE" as const,
        })),
        essayQuestions: [{ number: 1, maxScore: 10 }],
      };

      const template = buildTemplateFromExam(mockConfig as ExamConfig);
      expect(template.id).toBe("tpl-std30-20pg-active");
      expect(template.examId).toBe("exam-uts-20pg");
      expect(template.multipleChoiceSlots).toHaveLength(20);

      // Koordinat nomor 1 dan 10 tetap di Kolom 1 (X=14.0)
      expect(template.multipleChoiceSlots[0].questionNumber).toBe(1);
      expect(template.multipleChoiceSlots[0].xMm).toBe(COLUMN_X_MM[0]);
      expect(template.multipleChoiceSlots[9].questionNumber).toBe(10);
      expect(template.multipleChoiceSlots[9].xMm).toBe(COLUMN_X_MM[0]);

      // Koordinat nomor 11 dan 20 tetap di Kolom 2 (X=78.5)
      expect(template.multipleChoiceSlots[10].questionNumber).toBe(11);
      expect(template.multipleChoiceSlots[10].xMm).toBe(COLUMN_X_MM[1]);
      expect(template.multipleChoiceSlots[19].questionNumber).toBe(20);
      expect(template.multipleChoiceSlots[19].xMm).toBe(COLUMN_X_MM[1]);

      // Kolom 3 (nomor 21 s/d 30) tidak disertakan di template pemindaian
      const hasQ21 = template.multipleChoiceSlots.some((s) => s.questionNumber === 21);
      expect(hasQ21).toBe(false);
    });

    it("ketika guru mengatur 0 soal esai, essayAreaRectMm bernilai null untuk engine", () => {
      const mockConfig: Partial<ExamConfig> = {
        id: "exam-no-essay",
        multipleChoiceQuestions: Array.from({ length: 30 }, (_, i) => ({
          number: i + 1,
          correctAnswer: "A" as const,
          pointsCorrect: 1,
          pointsWrong: 0,
          status: "ACTIVE" as const,
        })),
        essayQuestions: [],
      };

      const template = buildTemplateFromExam(mockConfig as ExamConfig);
      expect(template.essayAreaRectMm).toBeNull();
    });
  });
});
