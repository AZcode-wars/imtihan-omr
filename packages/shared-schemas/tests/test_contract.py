"""Uji kontrak: fixture harus valid menurut JSON Schema DAN bisa di-parse model Pydantic.

Tujuan: menangkap saat cermin Python/TypeScript meleset dari kontrak tunggal.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from openomr_schemas import ExamTemplate

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schema" / "exam-template.schema.json"
EXAMPLE_PATH = ROOT / "schema" / "example" / "exam-template.example.json"


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def load_example() -> dict:
    return json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))


def test_schema_is_itself_valid() -> None:
    """JSON Schema harus valid menurut meta-schema-nya."""
    Draft202012Validator.check_schema(load_schema())


def test_example_validates_against_schema() -> None:
    """Fixture resmi harus lolos JSON Schema."""
    Draft202012Validator(load_schema()).validate(load_example())


def test_example_parses_into_pydantic_model() -> None:
    """Cermin Python harus bisa menerima fixture yang sama."""
    template = ExamTemplate.model_validate(load_example())
    assert template.page_width_mm == 210.0
    assert template.page_height_mm == 297.0
    assert template.column_count == 2
    assert template.bubble_diameter_mm == 4.5
    assert template.bubble_pitch_mm == 8.5
    assert len(template.fiducials) == 4
    assert len(template.multiple_choice_slots) == 25
    assert template.essay_area_rect_mm is not None


def test_pydantic_round_trip_preserves_json() -> None:
    """Serialisasi model (dengan alias) harus identik dengan aslinya.

    Ini yang menangkap penyimpangan antara cermin Python dan kontrak.
    """
    raw = load_example()
    template = ExamTemplate.model_validate(raw)
    dumped = template.model_dump(by_alias=True, exclude_none=True)
    assert dumped == raw


def test_fiducial_topleft_is_largest() -> None:
    """PRD FR-1.3: marker kiri-atas 14 mm, tiga sudut lain 10 mm."""
    template = ExamTemplate.model_validate(load_example())
    by_corner = {f.corner: f.size_mm for f in template.fiducials}
    assert by_corner["TOP_LEFT"] == 14.0
    assert by_corner["TOP_RIGHT"] == 10.0
    assert by_corner["BOTTOM_LEFT"] == 10.0
    assert by_corner["BOTTOM_RIGHT"] == 10.0


def test_area_esai_adalah_satu_kotak_penuh() -> None:
    """Zona esai = satu area kosong; skor dinilai guru di aplikasi."""
    template = ExamTemplate.model_validate(load_example())
    area = template.essay_area_rect_mm
    assert area is not None
    assert area.w >= 150
    assert area.h >= 30


# --------------------------------------------------------------------------- #
# Uji negatif — kontrak harus menolak data yang salah
# --------------------------------------------------------------------------- #


def test_schema_rejects_missing_required_field() -> None:
    raw = load_example()
    del raw["bubblePitchMm"]
    with pytest.raises(Exception):
        Draft202012Validator(load_schema()).validate(raw)


def test_schema_rejects_extra_field() -> None:
    raw = load_example()
    raw["unexpectedField"] = 1
    with pytest.raises(Exception):
        Draft202012Validator(load_schema()).validate(raw)


def test_schema_rejects_three_fiducials() -> None:
    raw = load_example()
    raw["fiducials"] = raw["fiducials"][:3]
    with pytest.raises(Exception):
        Draft202012Validator(load_schema()).validate(raw)


def test_schema_rejects_invalid_option_label() -> None:
    raw = load_example()
    raw["multipleChoiceSlots"][0]["options"][0]["label"] = "E"
    with pytest.raises(Exception):
        Draft202012Validator(load_schema()).validate(raw)


def test_schema_rejects_missing_essay_area() -> None:
    """Area esai wajib ada di kontrak (boleh null, tapi tidak boleh hilang)."""
    raw = load_example()
    del raw["essayAreaRectMm"]
    with pytest.raises(Exception):
        Draft202012Validator(load_schema()).validate(raw)


def test_schema_rejects_legacy_essay_slots() -> None:
    """Model lama (essaySlots per nomor) sudah tidak berlaku."""
    raw = load_example()
    raw["essaySlots"] = []
    with pytest.raises(Exception):
        Draft202012Validator(load_schema()).validate(raw)


def test_schema_rejects_legacy_essay_score_circles() -> None:
    """Lingkaran skor esai sudah dihapus — schema harus menolaknya."""
    raw = load_example()
    raw["essayAreaRectMm"]["valueOptions"] = []
    with pytest.raises(Exception):
        Draft202012Validator(load_schema()).validate(raw)


def test_pydantic_rejects_extra_field() -> None:
    raw = load_example()
    raw["essayAreaRectMm"]["unexpected"] = True
    with pytest.raises(ValidationError):
        ExamTemplate.model_validate(raw)
