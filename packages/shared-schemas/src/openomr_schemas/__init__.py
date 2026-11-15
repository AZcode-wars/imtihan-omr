"""openomr_schemas — kontrak data bersama OpenOMR.

Kontrak struktur LJK dikontrak oleh ``schema/exam-template.schema.json``
(satu-satunya sumber kebenaran). Modul ini adalah cermin Python-nya.
"""

from __future__ import annotations

import json
from pathlib import Path

from .models import (
    SCHEMAS_VERSION,
    BubbleReadStatus,
    Class,
    DetectedMCAnswer,
    EssayAnswerCrop,
    EssayMark,
    EssayQuestionConfig,
    EssaySlot,
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
)

__all__ = [
    "SCHEMAS_VERSION",
    "EXAM_TEMPLATE_SCHEMA_PATH",
    "load_exam_template_schema",
    "BubbleReadStatus",
    "Class",
    "DetectedMCAnswer",
    "EssayAnswerCrop",
    "EssayMark",
    "EssayQuestionConfig",
    "EssaySlot",
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

# --------------------------------------------------------------------------- #
# Pemuat kontrak
# --------------------------------------------------------------------------- #

#: Lokasi JSON Schema kontrak tunggal.
EXAM_TEMPLATE_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2] / "schema" / "exam-template.schema.json"
)


def load_exam_template_schema() -> dict:
    """Muat JSON Schema kontrak ``ExamTemplate``.

    Skema sengaja **tidak** diduplikasi ke dalam paket — agar tidak ada
    dua sumber kebenaran. File-nya dibaca dari lokasi di repo.
    """
    if not EXAM_TEMPLATE_SCHEMA_PATH.exists():
        raise FileNotFoundError(
            "exam-template.schema.json tidak ditemukan di "
            f"{EXAM_TEMPLATE_SCHEMA_PATH}. Jalankan dari checkout repo, atau "
            "pastikan folder `schema/` ikut terpasang."
        )
    return json.loads(EXAM_TEMPLATE_SCHEMA_PATH.read_text(encoding="utf-8"))
