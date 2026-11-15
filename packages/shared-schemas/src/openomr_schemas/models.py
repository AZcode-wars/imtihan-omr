"""Kontrak data OpenOMR — model Pydantic.

Cermin dari JSON Schema ``schema/exam-template.schema.json`` (kontrak tunggal)
dan dari tipe TypeScript di ``src/omr.ts``.

Spec asal: ui_brief_ai_agent_specification_openomr.md §2.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SCHEMAS_VERSION = "0.1.0"


# --------------------------------------------------------------------------- #
# Enum dasar
# --------------------------------------------------------------------------- #

OptionLabel = Literal["A", "B", "C", "D"]
ScoringMode = Literal["MODE_A_PERCENTAGE", "MODE_B_DIRECT_POINTS"]
RoundingRule = Literal["EXACT_2_DECIMAL", "ROUND_HALF_UP", "CEIL_UP"]
QuestionStatus = Literal["ACTIVE", "BONUS", "VOID"]
BubbleReadStatus = Literal["VALID", "EMPTY", "MULTIPLE", "LOW_CONFIDENCE"]
FiducialCorner = Literal["TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT"]


# --------------------------------------------------------------------------- #
# Geometri (semua koordinat dalam milimeter)
# --------------------------------------------------------------------------- #


class RectMm(BaseModel):
    """Persegi panjang dalam milimeter."""

    model_config = ConfigDict(extra="forbid")

    x: float = Field(ge=0)
    y: float = Field(ge=0)
    w: float = Field(gt=0)
    h: float = Field(gt=0)


class PointMm(BaseModel):
    """Titik dalam milimeter."""

    model_config = ConfigDict(extra="forbid")

    x_mm: float = Field(ge=0, alias="xMm")
    y_mm: float = Field(ge=0, alias="yMm")

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Fiducial(BaseModel):
    """Penanda sudut. ``TOP_LEFT`` lebih besar sebagai penanda orientasi."""

    model_config = ConfigDict(extra="forbid")

    corner: FiducialCorner
    size_mm: float = Field(gt=0, alias="sizeMm")
    x_mm: float = Field(ge=0, alias="xMm")
    y_mm: float = Field(ge=0, alias="yMm")

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class McOptionSlot(BaseModel):
    label: OptionLabel
    x_mm: float = Field(ge=0, alias="xMm")
    y_mm: float = Field(ge=0, alias="yMm")

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class MultipleChoiceSlot(BaseModel):
    question_number: int = Field(ge=1, alias="questionNumber")
    x_mm: float = Field(ge=0, alias="xMm")
    y_mm: float = Field(ge=0, alias="yMm")
    options: list[McOptionSlot] = Field(min_length=1, max_length=4)

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class EssayValueSlot(BaseModel):
    value: float = Field(ge=0)
    x_mm: float = Field(ge=0, alias="xMm")
    y_mm: float = Field(ge=0, alias="yMm")

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class EssaySlot(BaseModel):
    """Satu nomor esai.

    Dua sub-bagian dengan koordinat terpisah:
    ``student_answer_rect_mm`` = area kosong untuk tulisan siswa (tidak dibaca mesin);
    ``value_options`` + ``half_modifier_offset`` = lingkaran skor guru (dibaca mesin).
    """

    question_number: int = Field(ge=1, alias="questionNumber")
    x_mm: float = Field(ge=0, alias="xMm")
    y_mm: float = Field(ge=0, alias="yMm")
    student_answer_rect_mm: RectMm = Field(alias="studentAnswerRectMm")
    value_options: list[EssayValueSlot] = Field(min_length=1, alias="valueOptions")
    half_modifier_offset: PointMm = Field(alias="halfModifierOffset")

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ExamTemplate(BaseModel):
    """Metadata koordinat LJK.

    Dibuat generator PDF (ReportLab), dibaca engine OMR (OpenCV), dan
    dirender ulang frontend untuk pratinjau.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str = Field(min_length=1)
    exam_id: str = Field(min_length=1, alias="examId")
    page_width_mm: float = Field(gt=0, alias="pageWidthMm")
    page_height_mm: float = Field(gt=0, alias="pageHeightMm")
    column_count: int = Field(ge=1, alias="columnCount")
    bubble_diameter_mm: float = Field(gt=0, alias="bubbleDiameterMm")
    bubble_pitch_mm: float = Field(gt=0, alias="bubblePitchMm")
    fiducials: list[Fiducial] = Field(min_length=4, max_length=4)
    name_crop_rect_mm: RectMm = Field(alias="nameCropRectMm")
    multiple_choice_slots: list[MultipleChoiceSlot] = Field(alias="multipleChoiceSlots")
    essay_slots: list[EssaySlot] = Field(alias="essaySlots")


# --------------------------------------------------------------------------- #
# Entitas dasar
# --------------------------------------------------------------------------- #


class Student(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    nis: str
    name: str
    class_name: str = Field(alias="className")


class Class(BaseModel):
    """Kelas + roster. PRD FR-2.6."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    students: list[Student] = Field(default_factory=list)


class MultipleChoiceQuestionConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    number: int = Field(ge=1)
    correct_answer: OptionLabel = Field(alias="correctAnswer")
    points_correct: float = Field(alias="pointsCorrect")
    points_wrong: float = Field(alias="pointsWrong")
    status: QuestionStatus


class EssayQuestionConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    number: int = Field(ge=1)
    max_score: float = Field(gt=0, alias="maxScore")


class ExamConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    title: str
    class_id: str = Field(alias="classId")
    class_name: str = Field(alias="className")
    passing_score: float = Field(alias="passingScore")
    scoring_mode: ScoringMode = Field(alias="scoringMode")
    rounding: RoundingRule
    section_weights: dict[str, float] = Field(alias="sectionWeights")
    multiple_choice_questions: list[MultipleChoiceQuestionConfig] = Field(
        alias="multipleChoiceQuestions"
    )
    essay_questions: list[EssayQuestionConfig] = Field(alias="essayQuestions")


# --------------------------------------------------------------------------- #
# Hasil pemindaian
# --------------------------------------------------------------------------- #


class DetectedMCAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_number: int = Field(ge=1, alias="questionNumber")
    selected_option: OptionLabel | None = Field(alias="selectedOption")
    status: BubbleReadStatus
    confidence: float = Field(ge=0, le=1)
    raw_candidates: list[OptionLabel] | None = Field(default=None, alias="rawCandidates")


class DetectedEssayScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_number: int = Field(ge=1, alias="questionNumber")
    base_score: float = Field(alias="baseScore")
    has_half_modifier: bool = Field(alias="hasHalfModifier")
    total_score: float = Field(alias="totalScore")
    status: BubbleReadStatus


class OMRScanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    scan_id: str = Field(alias="scanId")
    source_device: Literal["MOBILE_CAMERA", "DESKTOP_SCANNER"] = Field(alias="sourceDevice")
    timestamp: str
    student_name_crop_url: str = Field(alias="studentNameCropUrl")
    full_warped_image_url: str = Field(alias="fullWarpedImageUrl")
    mc_answers: list[DetectedMCAnswer] = Field(alias="mcAnswers")
    essay_scores: list[DetectedEssayScore] = Field(alias="essayScores")


class GradedStudentRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    record_id: str = Field(alias="recordId")
    exam_id: str = Field(alias="examId")
    student_id: str = Field(alias="studentId")
    student_name: str = Field(alias="studentName")
    raw_mc_score: float = Field(alias="rawMCScore")
    max_mc_score: float = Field(alias="maxMCScore")
    raw_essay_score: float = Field(alias="rawEssayScore")
    max_essay_score: float = Field(alias="maxEssayScore")
    final_grade: float = Field(alias="finalGrade")
    total_possible_points: float = Field(alias="totalPossiblePoints")
    verified_at: str = Field(alias="verifiedAt")
    scan_payload: OMRScanResponse = Field(alias="scanPayload")


class OfflineQueueStatus(str, Enum):
    PENDING = "PENDING"
    UPLOADING = "UPLOADING"
    FAILED = "FAILED"


class OfflineQueueItem(BaseModel):
    """Antrean scan offline (IndexedDB). PRD FR-3.4."""

    model_config = ConfigDict(extra="forbid")

    id: str
    exam_id: str = Field(alias="examId")
    created_at: str = Field(alias="createdAt")
    thumbnail_data_url: str = Field(alias="thumbnailDataUrl")
    image_data_url: str = Field(alias="imageDataUrl")
    status: OfflineQueueStatus
    attempts: int = Field(ge=0)
    last_error: str | None = Field(default=None, alias="lastError")


__all__ = [
    "SCHEMAS_VERSION",
    "BubbleReadStatus",
    "Class",
    "DetectedMCAnswer",
    "DetectedEssayScore",
    "EssayQuestionConfig",
    "EssaySlot",
    "EssayValueSlot",
    "ExamConfig",
    "ExamTemplate",
    "Fiducial",
    "FiducialCorner",
    "GradedStudentRecord",
    "McOptionSlot",
    "MultipleChoiceQuestionConfig",
    "MultipleChoiceSlot",
    "OMRScanResponse",
    "OfflineQueueItem",
    "OfflineQueueStatus",
    "OptionLabel",
    "PointMm",
    "QuestionStatus",
    "RectMm",
    "RoundingRule",
    "ScoringMode",
    "Student",
]
