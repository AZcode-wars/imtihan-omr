import type { OptionLabel, QuestionStatus, RoundingRule, ScoringMode } from "@openomr/schemas";

/**
 * Kalkulasi nilai — pure function, tanpa I/O.
 *
 * Spec: PRD FR-2.1 s/d FR-2.5, ui_brief_ai_agent_specification_openomr.md §2,
 * dan docs/screen_specs.md §7.
 *
 * ## Perilaku per nomor Pilihan Ganda
 *
 * | Status    | Benar                          | Salah                          | Poin maksimum |
 * |-----------|--------------------------------|--------------------------------|----------------|
 * | `ACTIVE`  | +`pointsCorrect`               | +`pointsWrong` (default 0)     | +`pointsCorrect` |
 * | `BONUS`   | +`pointsCorrect`               | 0 — **tidak** kena penalti      | +`pointsCorrect` |
 * | `VOID`    | —                              | —                              | **tidak dihitung** (dianulir) |
 *
 * ## Perilaku per nomor Esai
 *
 * Skor = `min(maxScore, baseScore + (hasHalfModifier ? 0,5 : 0))`, dibatasi 0..maxScore.
 *
 * ## Dua mode
 *
 * | Mode | `rawScore` | `scale` | `totalPossiblePoints` |
 * |---|---|---|---|
 * | `MODE_A_PERCENTAGE` | `(poinPG/maksPG) × %PG + (poinEsai/maksEsai) × %Esai` | `"0-100"` | 100 |
 * | `MODE_B_DIRECT_POINTS` | `poinPG + poinEsai` (mentah) | `"points"` | `maksPG + maksEsai` |
 *
 * Bobot Mode A dinormalisasi otomatis bila totalnya bukan 100, sehingga nilai
 * tetap berada di rentang 0–100.
 */

export interface McQuestionResult {
  number: number;
  correctAnswer: OptionLabel;
  selectedOption: OptionLabel | null;
  pointsCorrect: number;
  pointsWrong: number;
  status: QuestionStatus;
}

export interface EssayQuestionResult {
  number: number;
  maxScore: number;
  baseScore: number;
  hasHalfModifier: boolean;
}

export interface SectionWeights {
  multipleChoicePercent: number;
  essayPercent: number;
}

export interface ScoringInput {
  mode: ScoringMode;
  rounding: RoundingRule;
  mcQuestions: McQuestionResult[];
  essayQuestions: EssayQuestionResult[];
  /** Mode A saja. Default 60 / 40. */
  weights?: SectionWeights;
}

export interface ScoringResult {
  mcPoints: number;
  mcMaxPoints: number;
  essayPoints: number;
  essayMaxPoints: number;
  /** Nilai sebelum pembulatan. */
  rawScore: number;
  /** Nilai setelah pembulatan. */
  finalGrade: number;
  /** `"0-100"` untuk Mode A, `"points"` untuk Mode B. */
  scale: "0-100" | "points";
  /** Denominator untuk menampilkan nilai Mode B. */
  totalPossiblePoints: number;
}

const DEFAULT_WEIGHTS: SectionWeights = {
  multipleChoicePercent: 60,
  essayPercent: 40,
};

/** Toleransi floating point saat pembulatan desimal (mis. 1.005 → 1.01). */
const EPS = 1e-9;

/**
 * Membulatkan ke jumlah desimal tertentu, setengah **menjauh dari nol**.
 * `roundTo(2.5, 0) === 3`, `roundTo(-2.5, 0) === -3`, `roundTo(1.005, 2) === 1.01`.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor + Math.sign(value) * EPS * factor) / factor;
}

/**
 * Aturan pembulatan nilai akhir (PRD FR-2.4).
 *
 * - `EXACT_2_DECIMAL` → dua desimal, dibulatkan setengah menjauh dari nol.
 * - `ROUND_HALF_UP` → bilangan bulat, setengah menjauh dari nol (2,5 → 3).
 * - `CEIL_UP` → selalu ke atas (2,1 → 3).
 */
export function applyRounding(value: number, rule: RoundingRule): number {
  switch (rule) {
    case "EXACT_2_DECIMAL":
      return roundTo(value, 2);
    case "ROUND_HALF_UP":
      return roundTo(value, 0);
    case "CEIL_UP":
      return Math.ceil(value);
  }
}

/**
 * Menghitung nilai akhir siswa.
 *
 * Fungsi ini murni: input yang sama selalu menghasilkan output yang sama.
 * Tidak ada akses jaringan, storage, atau waktu.
 */
export function calculateFinalGrade(input: ScoringInput): ScoringResult {
  const { mode, rounding, mcQuestions, essayQuestions } = input;

  let mcPoints = 0;
  let mcMaxPoints = 0;

  for (const q of mcQuestions) {
    // VOID: nomor dianulir — tidak masuk poin maupun poin maksimum.
    if (q.status === "VOID") continue;

    mcMaxPoints += q.pointsCorrect;

    const isCorrect = q.selectedOption !== null && q.selectedOption === q.correctAnswer;
    if (isCorrect) {
      mcPoints += q.pointsCorrect;
    } else if (q.status === "BONUS") {
      // Bonus yang dijawab salah: tidak menambah poin dan tidak kena penalti.
    } else {
      mcPoints += q.pointsWrong;
    }
  }

  let essayPoints = 0;
  let essayMaxPoints = 0;

  for (const q of essayQuestions) {
    essayMaxPoints += q.maxScore;
    const withModifier = q.baseScore + (q.hasHalfModifier ? 0.5 : 0);
    essayPoints += Math.min(q.maxScore, Math.max(0, withModifier));
  }

  let rawScore: number;
  let scale: ScoringResult["scale"];
  let totalPossiblePoints: number;

  if (mode === "MODE_A_PERCENTAGE") {
    const w = input.weights ?? DEFAULT_WEIGHTS;
    const totalWeight = w.multipleChoicePercent + w.essayPercent;
    const mcWeight = totalWeight > 0 ? w.multipleChoicePercent / totalWeight : 0;
    const essayWeight = totalWeight > 0 ? w.essayPercent / totalWeight : 0;

    const mcRatio = mcMaxPoints > 0 ? mcPoints / mcMaxPoints : 0;
    const essayRatio = essayMaxPoints > 0 ? essayPoints / essayMaxPoints : 0;

    rawScore = mcRatio * mcWeight * 100 + essayRatio * essayWeight * 100;
    scale = "0-100";
    totalPossiblePoints = 100;
  } else {
    rawScore = mcPoints + essayPoints;
    scale = "points";
    totalPossiblePoints = mcMaxPoints + essayMaxPoints;
  }

  return {
    mcPoints,
    mcMaxPoints,
    essayPoints,
    essayMaxPoints,
    rawScore,
    finalGrade: applyRounding(rawScore, rounding),
    scale,
    totalPossiblePoints,
  };
}

/**
 * Status kelulusan terhadap KKM. Tepat sama dengan KKM dianggap **lulus**
 * (batas bawah, bukan eksklusif).
 *
 * Pada Mode B, `passingScore` berada dalam skala poin — bukan persen.
 */
export function isPassing(finalGrade: number, passingScore: number): boolean {
  return finalGrade >= passingScore;
}

/**
 * Bentuk tampilan nilai akhir sesuai mode.
 * Mode A → `82,4` (skala 0–100). Mode B → `86 / 100 poin` (poin mentah).
 */
export function formatFinalScore(result: ScoringResult, locale = "id-ID"): string {
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
    result.finalGrade,
  );
  return result.scale === "points"
    ? `${value} / ${result.totalPossiblePoints} poin`
    : value;
}
