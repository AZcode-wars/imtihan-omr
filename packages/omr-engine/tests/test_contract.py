"""Uji silang: output generator template engine HARUS cocok dengan kontrak tunggal.

Ini penjaga utama dari "cetak ≠ deteksi": kalau engine menghasilkan koordinat
yang tidak lolos JSON Schema kontrak, semua pihak akan membaca struktur yang
berbeda.
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


@pytest.mark.parametrize(("pg", "essay"), [(25, 5), (10, 10), (40, 0), (30, 4)])
def test_output_engine_lolos_json_schema(pg: int, essay: int) -> None:
    schema = load_exam_template_schema()
    Draft202012Validator(schema).validate(build_template(pg_count=pg, essay_count=essay))


def test_output_engine_lolos_model_pydantic() -> None:
    template = ExamTemplate.model_validate(build_template(pg_count=25, essay_count=5))
    assert len(template.multiple_choice_slots) == 25
    assert template.essay_area_rect_mm is not None


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


def test_zona_esai_hanya_satu_area_besar() -> None:
    """Zona esai = SATU kotak kosong; tidak ada nomor per soal."""
    template = build_template(pg_count=25, essay_count=5)
    area = template["essayAreaRectMm"]
    assert isinstance(area, dict)
    assert set(area.keys()) == {"x", "y", "w", "h"}
    assert area["w"] > 100  # lebar penuh area konten


def test_area_jawaban_esai_lebar_penuh() -> None:
    """Kotak esai harus jauh lebih lebar daripada kotak pada model lama."""
    template = build_template(pg_count=25, essay_count=5)
    area = template["essayAreaRectMm"]
    assert area["w"] >= 150
    assert area["h"] >= 30


def test_tanpa_soal_esai_area_kosong() -> None:
    """Ujian tanpa soal esai → area esai null (bukan array kosong)."""
    template = build_template(pg_count=25, essay_count=0)
    assert template["essayAreaRectMm"] is None
