import { describe, expect, it } from "vitest";
import {
  applyRounding,
  calculateFinalGrade,
  formatFinalScore,
  isPassing,
  roundTo,
  type EssayQuestionResult,
  type McQuestionResult,
} from "./scoring";

/* ------------------------------------------------------------------ *
 * Helper
 * ------------------------------------------------------------------ */

function mc(number: number, overrides: Partial<McQuestionResult> = {}): McQuestionResult {
  return {
    number,
    correctAnswer: "A",
    selectedOption: null,
    pointsCorrect: 1,
    pointsWrong: 0,
    status: "ACTIVE",
    ...overrides,
  };
}

/** `total` soal, `correctCount` pertama dijawab benar. */
function mcSeries(total: number, correctCount: number, overrides: Partial<McQuestionResult> = {}) {
  return Array.from({ length: total }, (_, i) =>
    mc(i + 1, { selectedOption: i < correctCount ? "A" : "B", ...overrides }),
  );
}

function essay(number: number, overrides: Partial<EssayQuestionResult> = {}): EssayQuestionResult {
  return { number, maxScore: 5, baseScore: 0, hasHalfModifier: false, ...overrides };
}

/** Skor esai eksplisit. Contoh: [4,3,4,3,4] + modifier pada soal ke-2 = 18,5. */
function essayFrom(baseScores: number[], modifiers: number[] = []) {
  return baseScores.map((base, i) =>
    essay(i + 1, { baseScore: base, hasHalfModifier: modifiers.includes(i + 1) }),
  );
}

/** Skenario baku: 5 soal esai, total 18,5 dari maksimum 25. */
const ESSAY_SCORES = [4, 3, 4, 3, 4];
const ESSAY_MODIFIER_ON = [2];

/* ------------------------------------------------------------------ *
 * Pembulatan
 * ------------------------------------------------------------------ */

describe("roundTo", () => {
  it.each([
    [1.005, 2, 1.01],
    [82.456, 2, 82.46],
    [82.455, 2, 82.46],
    [82.4, 2, 82.4],
    [82, 2, 82],
    [2.5, 0, 3],
    [-2.5, 0, -3],
    [0.5, 0, 1],
    [0, 2, 0],
  ])("roundTo(%s, %s) = %s", (value, decimals, expected) => {
    expect(roundTo(value as number, decimals as number)).toBe(expected);
  });
});

describe("applyRounding", () => {
  it("EXACT_2_DECIMAL menjaga dua desimal", () => {
    expect(applyRounding(82.456, "EXACT_2_DECIMAL")).toBe(82.46);
    expect(applyRounding(82.4, "EXACT_2_DECIMAL")).toBe(82.4);
    expect(applyRounding(82, "EXACT_2_DECIMAL")).toBe(82);
  });

  it("ROUND_HALF_UP membulatkan .5 ke atas (menjauh dari nol)", () => {
    expect(applyRounding(82.5, "ROUND_HALF_UP")).toBe(83);
    expect(applyRounding(82.4, "ROUND_HALF_UP")).toBe(82);
    expect(applyRounding(2.5, "ROUND_HALF_UP")).toBe(3);
    expect(applyRounding(-2.5, "ROUND_HALF_UP")).toBe(-3);
  });

  it("CEIL_UP selalu ke atas", () => {
    expect(applyRounding(82.01, "CEIL_UP")).toBe(83);
    expect(applyRounding(82, "CEIL_UP")).toBe(82);
    expect(applyRounding(0.1, "CEIL_UP")).toBe(1);
  });
});

/* ------------------------------------------------------------------ *
 * Mode A — Persentase Bagian
 * ------------------------------------------------------------------ */

describe("calculateFinalGrade — Mode A (persentase)", () => {
  const base = {
    mode: "MODE_A_PERCENTAGE" as const,
    rounding: "EXACT_2_DECIMAL" as const,
    mcQuestions: mcSeries(25, 22),
    essayQuestions: essayFrom(ESSAY_SCORES, ESSAY_MODIFIER_ON),
    weights: { multipleChoicePercent: 60, essayPercent: 40 },
  };

  it("menghitung (poinPG/maksPG)×%PG + (poinEsai/maksEsai)×%Esai", () => {
    const r = calculateFinalGrade(base);
    expect(r.mcPoints).toBe(22);
    expect(r.mcMaxPoints).toBe(25);
    expect(r.essayPoints).toBe(18.5);
    expect(r.essayMaxPoints).toBe(25);
    expect(r.rawScore).toBeCloseTo((22 / 25) * 60 + (18.5 / 25) * 40, 10);
    expect(r.finalGrade).toBeCloseTo(82.4, 10);
    expect(r.scale).toBe("0-100");
    expect(r.totalPossiblePoints).toBe(100);
  });

  it("bobot 100/0 memakai hanya PG", () => {
    const r = calculateFinalGrade({
      ...base,
      weights: { multipleChoicePercent: 100, essayPercent: 0 },
    });
    expect(r.finalGrade).toBeCloseTo((22 / 25) * 100, 10);
  });

  it("bobot 0/100 memakai hanya esai", () => {
    const r = calculateFinalGrade({
      ...base,
      weights: { multipleChoicePercent: 0, essayPercent: 100 },
    });
    expect(r.finalGrade).toBeCloseTo((18.5 / 25) * 100, 10);
  });

  it("bobot yang tidak berjumlah 100 dinormalisasi, nilai tetap 0-100", () => {
    const r = calculateFinalGrade({
      ...base,
      weights: { multipleChoicePercent: 70, essayPercent: 50 },
    });
    // (22/25)*(70/120)*100 + (18.5/25)*(50/120)*100
    expect(r.rawScore).toBeCloseTo(82.1666666, 6);
    expect(r.finalGrade).toBe(82.17);
    expect(r.finalGrade).toBeGreaterThanOrEqual(0);
    expect(r.finalGrade).toBeLessThanOrEqual(100);
  });

  it("bobot default 60/40 dipakai bila tidak diisi", () => {
    const { weights: _ignored, ...withoutWeights } = base;
    const r = calculateFinalGrade(withoutWeights);
    expect(r.finalGrade).toBeCloseTo((22 / 25) * 60 + (18.5 / 25) * 40, 10);
  });

  it("tidak ada soal PG -> hanya esai yang dihitung, tanpa NaN", () => {
    const r = calculateFinalGrade({ ...base, mcQuestions: [] });
    expect(Number.isNaN(r.finalGrade)).toBe(false);
    expect(r.finalGrade).toBeCloseTo((18.5 / 25) * 40, 10);
  });

  it("tidak ada soal esai -> hanya PG yang dihitung, tanpa NaN", () => {
    const r = calculateFinalGrade({ ...base, essayQuestions: [] });
    expect(Number.isNaN(r.finalGrade)).toBe(false);
    expect(r.finalGrade).toBeCloseTo((22 / 25) * 60, 10);
  });

  it("tidak ada soal sama sekali -> 0, tanpa NaN", () => {
    const r = calculateFinalGrade({ ...base, mcQuestions: [], essayQuestions: [] });
    expect(r.finalGrade).toBe(0);
    expect(Number.isNaN(r.finalGrade)).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Mode B — Akumulasi Poin Langsung
 * ------------------------------------------------------------------ */

describe("calculateFinalGrade — Mode B (poin langsung)", () => {
  it("mengembalikan poin mentah, bukan skala 0-100", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: mcSeries(25, 22, { pointsCorrect: 2 }),
      essayQuestions: essayFrom(ESSAY_SCORES, ESSAY_MODIFIER_ON),
    });
    expect(r.mcPoints).toBe(44);
    expect(r.mcMaxPoints).toBe(50);
    expect(r.essayPoints).toBe(18.5);
    expect(r.rawScore).toBe(62.5);
    expect(r.finalGrade).toBe(62.5);
    expect(r.scale).toBe("points");
    expect(r.totalPossiblePoints).toBe(75);
  });

  it("bobot tidak berpengaruh di Mode B", () => {
    const withWeights = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: mcSeries(25, 22, { pointsCorrect: 2 }),
      essayQuestions: essayFrom(ESSAY_SCORES, ESSAY_MODIFIER_ON),
      weights: { multipleChoicePercent: 90, essayPercent: 10 },
    });
    const withoutWeights = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: mcSeries(25, 22, { pointsCorrect: 2 }),
      essayQuestions: essayFrom(ESSAY_SCORES, ESSAY_MODIFIER_ON),
    });
    expect(withWeights.finalGrade).toBe(withoutWeights.finalGrade);
  });
});

/* ------------------------------------------------------------------ *
 * Status per nomor
 * ------------------------------------------------------------------ */

describe("status nomor PG", () => {
  it("VOID tidak masuk poin maupun poin maksimum", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: [
        mc(1, { selectedOption: "A", status: "VOID" }),
        mc(2, { selectedOption: "A" }),
      ],
      essayQuestions: [],
    });
    expect(r.mcMaxPoints).toBe(1);
    expect(r.mcPoints).toBe(1);
  });

  it("VOID yang dijawab benar tetap diabaikan", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: [mc(1, { selectedOption: "A", status: "VOID" })],
      essayQuestions: [],
    });
    expect(r.mcMaxPoints).toBe(0);
    expect(r.mcPoints).toBe(0);
    expect(r.finalGrade).toBe(0);
  });

  it("BONUS benar menambah poin dan poin maksimum", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: [
        mc(1, { selectedOption: "A", status: "BONUS", pointsCorrect: 3 }),
        mc(2, { selectedOption: "A" }),
      ],
      essayQuestions: [],
    });
    expect(r.mcPoints).toBe(4);
    expect(r.mcMaxPoints).toBe(4);
  });

  it("BONUS salah tidak menambah poin dan tidak kena penalti", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: [
        mc(1, { selectedOption: "B", status: "BONUS", pointsCorrect: 3, pointsWrong: -2 }),
        mc(2, { selectedOption: "A" }),
      ],
      essayQuestions: [],
    });
    expect(r.mcPoints).toBe(1);
    expect(r.mcMaxPoints).toBe(4);
  });

  it("ACTIVE salah kena penalti (pointsWrong)", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: [
        mc(1, { selectedOption: "B", pointsWrong: -1 }),
        mc(2, { selectedOption: "A" }),
      ],
      essayQuestions: [],
    });
    expect(r.mcPoints).toBe(0);
    expect(r.mcMaxPoints).toBe(2);
  });

  it("soal yang tidak dijawab dianggap salah", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: [mc(1, { selectedOption: null })],
      essayQuestions: [],
    });
    expect(r.mcPoints).toBe(0);
    expect(r.mcMaxPoints).toBe(1);
  });
});

/* ------------------------------------------------------------------ *
 * Skor esai
 * ------------------------------------------------------------------ */

describe("skor esai", () => {
  it("modifier +0,5 menambah setengah poin", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: [],
      essayQuestions: [essay(1, { baseScore: 3, hasHalfModifier: true })],
    });
    expect(r.essayPoints).toBe(3.5);
    expect(r.essayMaxPoints).toBe(5);
  });

  it("skor dibatasi oleh maxScore", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: [],
      essayQuestions: [essay(1, { baseScore: 5, maxScore: 4, hasHalfModifier: true })],
    });
    expect(r.essayPoints).toBe(4);
  });

  it("skor negatif dibatasi 0", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: [],
      essayQuestions: [essay(1, { baseScore: -2 })],
    });
    expect(r.essayPoints).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * Kelulusan & format tampilan
 * ------------------------------------------------------------------ */

describe("isPassing", () => {
  it("tepat sama dengan KKM dianggap lulus", () => {
    expect(isPassing(75, 75)).toBe(true);
  });

  it("di bawah KKM tidak lulus", () => {
    expect(isPassing(74.9, 75)).toBe(false);
  });

  it("di atas KKM lulus", () => {
    expect(isPassing(82.4, 75)).toBe(true);
  });
});

describe("formatFinalScore", () => {
  it("Mode A menampilkan angka desimal locale id-ID", () => {
    const r = calculateFinalGrade({
      mode: "MODE_A_PERCENTAGE",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: mcSeries(25, 22),
      essayQuestions: essayFrom(ESSAY_SCORES, ESSAY_MODIFIER_ON),
      weights: { multipleChoicePercent: 60, essayPercent: 40 },
    });
    expect(formatFinalScore(r)).toBe("82,4");
  });

  it("Mode B menampilkan poin mentah dengan penyebut", () => {
    const r = calculateFinalGrade({
      mode: "MODE_B_DIRECT_POINTS",
      rounding: "EXACT_2_DECIMAL",
      mcQuestions: mcSeries(25, 22, { pointsCorrect: 2 }),
      essayQuestions: essayFrom(ESSAY_SCORES, ESSAY_MODIFIER_ON),
    });
    expect(formatFinalScore(r)).toBe("62,5 / 75 poin");
  });
});
