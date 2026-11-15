/**
 * Kontrak data OpenOMR — TypeScript.
 *
 * Cermin dari JSON Schema `schema/exam-template.schema.json` (kontrak tunggal)
 * dan dari model pydantic di `src/openomr_schemas/models.py`.
 * Spec asal: ui_brief_ai_agent_specification_openomr.md §2.
 */

/* ------------------------------------------------------------------ *
 * Enum dasar
 * ------------------------------------------------------------------ */

export type OptionLabel = "A" | "B" | "C" | "D";
export type ScoringMode = "MODE_A_PERCENTAGE" | "MODE_B_DIRECT_POINTS";
export type RoundingRule = "EXACT_2_DECIMAL" | "ROUND_HALF_UP" | "CEIL_UP";
export type QuestionStatus = "ACTIVE" | "BONUS" | "VOID";
export type BubbleReadStatus = "VALID" | "EMPTY" | "MULTIPLE" | "LOW_CONFIDENCE";

/* ------------------------------------------------------------------ *
 * Entitas dasar
 * ------------------------------------------------------------------ */

export interface Student {
  id: string;
  nis: string;
  name: string;
  className: string;
}

/** Kelas + roster. PRD FR-2.6. */
export interface Class {
  id: string;
  name: string;
  students: Student[];
}

export interface MultipleChoiceQuestionConfig {
  number: number; // 1 .. N (dinamis)
  correctAnswer: OptionLabel;
  pointsCorrect: number; // Default: 1 (Mode A) atau bobot bebas (Mode B)
  pointsWrong: number; // Default: 0
  status: QuestionStatus;
}

export interface EssayQuestionConfig {
  number: number; // 1 .. M (dinamis, 0 jika ujian full PG)
  maxScore: number; // Default: 5 (mendukung kelipatan 0.5)
}

export interface ExamConfig {
  id: string;
  title: string;
  classId: string; // Relasi ke Class
  className: string; // Disimpan juga agar render cepat
  /** KKM. Skala 0-100 pada Mode A, skala poin pada Mode B. PRD FR-2.5. */
  passingScore: number;
  scoringMode: ScoringMode;
  rounding: RoundingRule;
  sectionWeights: {
    multipleChoicePercent: number; // Total dengan essayPercent = 100
    essayPercent: number;
  };
  multipleChoiceQuestions: MultipleChoiceQuestionConfig[];
  essayQuestions: EssayQuestionConfig[];
}

/* ------------------------------------------------------------------ *
 * ExamTemplate — metadata koordinat LJK
 * ------------------------------------------------------------------ */

export interface RectMm {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PointMm {
  xMm: number;
  yMm: number;
}

export type FiducialCorner =
  | "TOP_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_RIGHT";

export interface Fiducial {
  corner: FiducialCorner;
  /** 14 mm untuk TOP_LEFT (penanda orientasi), 10 mm untuk tiga sudut lain. */
  sizeMm: number;
  xMm: number;
  yMm: number;
}

export interface McOptionSlot {
  label: OptionLabel;
  xMm: number;
  yMm: number;
}

export interface MultipleChoiceSlot {
  questionNumber: number;
  xMm: number;
  yMm: number;
  options: McOptionSlot[];
}

export interface EssayValueSlot {
  value: number;
  xMm: number;
  yMm: number;
}

/**
 * Satu nomor esai. Dua sub-bagian dengan koordinat TERPISAH:
 * - `studentAnswerRectMm` → area kosong untuk tulisan siswa (TIDAK dibaca mesin)
 * - `valueOptions` + `halfModifierOffset` → lingkaran skor yang diisi guru (dibaca mesin)
 */
export interface EssaySlot {
  questionNumber: number;
  xMm: number;
  yMm: number;
  studentAnswerRectMm: RectMm;
  valueOptions: EssayValueSlot[];
  halfModifierOffset: PointMm;
}

export interface ExamTemplate {
  id: string;
  examId: string;
  pageWidthMm: number;
  pageHeightMm: number;
  columnCount: number;
  bubbleDiameterMm: number;
  bubblePitchMm: number;
  fiducials: Fiducial[];
  nameCropRectMm: RectMm;
  multipleChoiceSlots: MultipleChoiceSlot[];
  essaySlots: EssaySlot[];
}

/* ------------------------------------------------------------------ *
 * Hasil pemindaian
 * ------------------------------------------------------------------ */

export interface DetectedMCAnswer {
  questionNumber: number;
  selectedOption: OptionLabel | null;
  status: BubbleReadStatus;
  confidence: number; // 0.0 - 1.0
  rawCandidates?: OptionLabel[];
}

export interface DetectedEssayScore {
  questionNumber: number;
  baseScore: number; // 0 - 5
  hasHalfModifier: boolean; // true jika lingkaran [+0.5] terarsir
  totalScore: number; // baseScore + (hasHalfModifier ? 0.5 : 0)
  status: BubbleReadStatus;
}

export interface OMRScanResponse {
  scanId: string;
  sourceDevice: "MOBILE_CAMERA" | "DESKTOP_SCANNER";
  timestamp: string;
  studentNameCropUrl: string; // Potongan gambar tulisan tangan nama siswa
  fullWarpedImageUrl: string; // Gambar LJK utuh hasil 4-point transform
  mcAnswers: DetectedMCAnswer[];
  essayScores: DetectedEssayScore[];
}

export interface GradedStudentRecord {
  recordId: string;
  examId: string;
  studentId: string;
  studentName: string;
  rawMCScore: number;
  maxMCScore: number;
  rawEssayScore: number;
  maxEssayScore: number;
  /**
   * Mode A: skala 0-100. Mode B: poin mentah (0..totalPossiblePoints).
   * Lihat docs/screen_specs.md §7.
   */
  finalGrade: number;
  totalPossiblePoints: number;
  verifiedAt: string;
  scanPayload: OMRScanResponse;
}

/* ------------------------------------------------------------------ *
 * Antrean offline (IndexedDB). PRD FR-3.4.
 * ------------------------------------------------------------------ */

export type OfflineQueueStatus = "PENDING" | "UPLOADING" | "FAILED";

export interface OfflineQueueItem {
  id: string;
  examId: string;
  createdAt: string; // ISO 8601
  thumbnailDataUrl: string; // pratinjau kecil, base64
  imageDataUrl: string; // gambar penuh, base64
  status: OfflineQueueStatus;
  attempts: number;
  lastError?: string;
}
