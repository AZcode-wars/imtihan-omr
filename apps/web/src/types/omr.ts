/**
 * Tipe data OMR untuk aplikasi web.
 *
 * Sumber kebenaran adalah paket kontrak `@openomr/schemas`
 * (packages/shared-schemas) — file ini hanya re-export supaya path
 * `src/types/omr.ts` yang disebut di UI Brief §2 tetap berlaku.
 */
export type {
  BubbleReadStatus,
  Class,
  DetectedEssayScore,
  DetectedMCAnswer,
  EssayQuestionConfig,
  EssaySlot,
  EssayValueSlot,
  ExamConfig,
  ExamTemplate,
  Fiducial,
  FiducialCorner,
  GradedStudentRecord,
  McOptionSlot,
  MultipleChoiceQuestionConfig,
  MultipleChoiceSlot,
  OMRScanResponse,
  OfflineQueueItem,
  OfflineQueueStatus,
  OptionLabel,
  PointMm,
  QuestionStatus,
  RectMm,
  RoundingRule,
  ScoringMode,
  Student,
} from "@openomr/schemas";
