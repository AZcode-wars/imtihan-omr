"""Uji silang: output generator template engine HARUS cocok dengan kontrak tunggal.

Ini penjaga utama dari "cetak ≠ deteksi": kalau engine menghasilkan koordinat
yang tidak lolos JSON Schema kontrak, semua pihak读写 struktur yang berbeda.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from openomr_schemas import ExamTemplate, load_exam_template_schema

from omr_engine.template import build_template

EXAMPLE_PATH = (
    Path(__file__).resolve().parents[2]
    / "shared-schemas"
    / "schema"
    / "example"
    / "exam-template.example.json"
)


@pytest.mark.parametrize(("pg", "essay"), [(25, 5), (10, 10), (50, 0), (30, 4)])
def test_output_engine_lolos_json_schema(pg: int, essay: int) -> None:
    schema = load_exam_template_schema()
    Draft202012Validator(schema).validate(build_template(pg_count=pg, essay_count=essay))


def test_output_engine_lolos_model_pydantic() -> None:
    template = ExamTemplate.model_validate(build_template(pg_count=25, essay_count=5))
    assert len(template.multiple_choice_slots) == 25
    assert len(template.essay_slots) == 5


def test_fixture_resmi_lolos_kontrak() -> None:
    """Fixture di shared-schemas harus valid menurut kontrak yang sama."""
    raw = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
    Draft202012Validator(load_exam_template_schema()).validate(raw)
    ExamTemplate.model_validate(raw)


def test_fixture_sama_dengan_output_engine() -> None:
    """Fixture harus identik dengan yang dihasilkan generator engine.

    Kalau tidak sama, berarti fixture sudah basi — dan itu tanda bahaya
    karena test di shared-schemas mengujinya sebagai acuan.
    """
    raw = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
    assert raw == build_template(
        exam_id="exam-example", template_id="tpl-example-25pg-5es", pg_count=25, essay_count=5
    )


def test_zona_esai_tidak_lagi_punya_lingkaran_skor() -> None:
    """Setelhema Opsi baru, zona esai hanya punya area jawaban siswa."""
    template = build_template(pg_count=25, essay_count=5)
    for slot in template["essaySlots"]:
        assert set(slot.keys()) == {"questionNumber", "xMm", "yMm", "studentAnswerRectMm"}
        assert slot["studentAnswerRectMm"]["w"] > 100  # lebar penuh


def test_area_jawaban_esai_lebar_penuh() -> None:
    """Kotak esai harus jauh lebih lebar daripada kotak pada model lama."""
    template = build_template(pg_count=25, essay_count=5)
    for slot in template["essaySlots"]:
        rect = slot["studentAnswerRectMm"]
        assert rect["w"] >= 150
        assert rect["h"] >= 14
