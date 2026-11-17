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
  DetectedMCAnswer,
  EssayAreaRectMm,
  EssayMark,
  EssayOutcome,
  EssayQuestionConfig,
  ExamConfig,
  ExamTemplate,
  Fiducial,
  FiducialCorner,
  GradedStudentRecord,
  McOptionSlot,
  MultipleChoiceQuestionConfig,
  MultipleChoiceSlot,
  OMRScanResponse,
  OptionLabel,
  PointMm,
  QuestionStatus,
  RectMm,
  RoundingRule,
  ScoringMode,
  Student,
} from "@openomr/schemas";

import type {
  OfflineQueueItem as BaseOfflineQueueItem,
  OfflineQueueStatus as BaseOfflineQueueStatus,
  OMRScanResponse,
  EssayMark,
} from "@openomr/schemas";

/**
 * Status item di antrean lokal (IndexedDB)
 * Diperluas dengan PENDING_REVIEW untuk lembar yang sudah di-scan tapi ditunda reviewnya.
 */
export type OfflineQueueStatus = BaseOfflineQueueStatus | "PENDING_REVIEW";

/**
 * OfflineQueueItem diperkaya dengan scanResult opsional
 * agar hasil pembacaan OMR instan dapat disimpan ke antrean review.
 */
export interface OfflineQueueItem extends Omit<BaseOfflineQueueItem, "status"> {
  status: OfflineQueueStatus;
  scanResult?: OMRScanResponse;
  selectedStudentId?: string;
  selectedStudentName?: string;
  essayMarks?: EssayMark[];
}
