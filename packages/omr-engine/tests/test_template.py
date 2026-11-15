"""Uji tata letak & kontrak template LJK."""

from __future__ import annotations

import json
import math

import pytest
from jsonschema import Draft202012Validator
from openomr_schemas import ExamTemplate, load_exam_template_schema

from omr_engine.template import (
    BUBBLE_DIAMETER_MM,
    BUBBLE_PITCH_MM,
    COLUMN_X_MM,
    CONTENT_BOTTOM_MM,
    FIDUCIAL_OTHER_MM,
    FIDUCIAL_TL_MM,
    INSTRUCTION_BOX_RECT_MM,
    MARGIN_MM,
    MC_OPTION_OFFSET_MM,
    PAGE_HEIGHT_MM,
    PAGE_WIDTH_MM,
    PAPER_TITLE_X_MM,
    TemplateOverflowError,
    build_template,
    build_validated_template,
    compute_layout,
    max_essay_count_for,
)


def all_bubble_centers(template: dict) -> list[tuple[float, float]]:
    """Semua pusat lingkaran yang harus diarsir/dideteksi mesin.

    Zona esai tidak punya lingkaran lagi — skornya dinilai guru di aplikasi.
    """
    centers: list[tuple[float, float]] = []
    for slot in template["multipleChoiceSlots"]:
        for opt in slot["options"]:
            centers.append((opt["xMm"], opt["yMm"]))
    return centers


# --------------------------------------------------------------------------- #
# Tata letak
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("pg", "essay"),
    [(25, 5), (26, 5), (30, 5), (50, 0), (10, 10), (1, 0)],
)
def test_layout_tidak_meluber_kertas(pg: int, essay: int) -> None:
    layout = compute_layout(pg, essay)
    assert layout.content_bottom_y <= CONTENT_BOTTOM_MM


@pytest.mark.parametrize(
    ("pg", "essay"),
    [(25, 5), (26, 5), (30, 5), (50, 0), (10, 10)],
)
def test_semua_bubble_dalam_batas_kertas(pg: int, essay: int) -> None:
    template = build_template(pg_count=pg, essay_count=essay)
    radius = BUBBLE_DIAMETER_MM / 2
    for x, y in all_bubble_centers(template):
        assert radius <= x <= PAGE_WIDTH_MM - radius
        assert radius <= y <= PAGE_HEIGHT_MM - radius


@pytest.mark.parametrize(("pg", "essay"), [(25, 5), (30, 5), (20, 5)])
def test_jarak_antar_pusat_minimal_6_mm(pg: int, essay: int) -> None:
    """PRD FR-1.2: jarak antar pusat antar bubble minimal 6 mm."""
    template = build_template(pg_count=pg, essay_count=essay)
    centers = all_bubble_centers(template)
    for i, (x1, y1) in enumerate(centers):
        for x2, y2 in centers[i + 1 :]:
            distance = math.hypot(x1 - x2, y1 - y2)
            assert distance >= BUBBLE_PITCH_MM - 1e-9, (
                f"dua bubble hanya berjarak {distance:.3f} mm "
                f"({(x1, y1)} dan {(x2, y2)})"
            )


def test_bubble_diameter_tidak_bertabrakan() -> None:
    """Diameter 4,5 mm dengan pitch 8,5 mm → ada celah 4 mm antar bubble."""
    assert BUBBLE_PITCH_MM > BUBBLE_DIAMETER_MM


def test_dua_kolom_pilihan_ganda() -> None:
    template = build_template(pg_count=25, essay_count=0)
    xs = sorted({slot["xMm"] for slot in template["multipleChoiceSlots"]})
    assert len(xs) == 2
    assert template["columnCount"] == 2


def test_penomoran_berjalan_kolom_1_lalu_kolom_2() -> None:
    template = build_template(pg_count=25, essay_count=0)
    slots = template["multipleChoiceSlots"]
    assert slots[0]["questionNumber"] == 1
    # 25 soal -> 13 baris: kolom 1 berisi soal 1-13, kolom 2 berisi 14-25
    assert slots[12]["questionNumber"] == 13
    assert slots[13]["questionNumber"] == 14
    assert slots[13]["xMm"] > slots[0]["xMm"]  # soal 14 pindah ke kolom 2
    assert slots[24]["questionNumber"] == 25


# --------------------------------------------------------------------------- #
# Fiducial
# --------------------------------------------------------------------------- #


def test_fiducial_kiri_atas_lebih_besar() -> None:
    """PRD FR-1.3: marker kiri-atas 14 mm, tiga sudut lain 10 mm."""
    template = build_template(pg_count=25, essay_count=5)
    by_corner = {f["corner"]: f["sizeMm"] for f in template["fiducials"]}
    assert len(by_corner) == 4
    assert by_corner["TOP_LEFT"] == FIDUCIAL_TL_MM == 14.0
    for corner in ("TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT"):
        assert by_corner[corner] == FIDUCIAL_OTHER_MM == 10.0


def test_fiducial_di_sudut_zona_aktif() -> None:
    template = build_template(pg_count=25, essay_count=5)
    by_corner = {f["corner"]: f for f in template["fiducials"]}
    assert by_corner["TOP_LEFT"]["xMm"] == MARGIN_MM
    assert by_corner["TOP_LEFT"]["yMm"] == MARGIN_MM
    assert by_corner["BOTTOM_RIGHT"]["xMm"] + 10 == PAGE_WIDTH_MM - MARGIN_MM
    assert by_corner["BOTTOM_RIGHT"]["yMm"] + 10 == PAGE_HEIGHT_MM - MARGIN_MM


# --------------------------------------------------------------------------- #
# Zona esai — dua sub-bagian terpisah (Opsi 1)
# --------------------------------------------------------------------------- #


def test_zona_esai_hanya_punya_area_jawaban_siswa() -> None:
    """Zona esai = satu area kosong lebar; skor dinilai guru di aplikasi."""
    template = build_template(pg_count=25, essay_count=5)
    for slot in template["essaySlots"]:
        rect = slot["studentAnswerRectMm"]
        assert set(slot.keys()) == {"questionNumber", "xMm", "yMm", "studentAnswerRectMm"}
        assert rect["w"] >= 150
        assert rect["h"] >= 14


def test_area_jawaban_esai_berdampingan_tidak_tumpang_tindih() -> None:
    """Kotak esai tidak boleh menabrak kotak di bawahnya."""
    template = build_template(pg_count=25, essay_count=5)
    slots = template["essaySlots"]
    for a, b in zip(slots, slots[1:]):
        ra = a["studentAnswerRectMm"]
        rb = b["studentAnswerRectMm"]
        assert rb["y"] >= ra["y"] + ra["h"], "kotak jawaban esai saling tumpang tindih"


# --------------------------------------------------------------------------- #
# Kontrak
# --------------------------------------------------------------------------- #


def test_template_valid_menurut_json_schema() -> None:
    schema = load_exam_template_schema()
    template = build_template(pg_count=25, essay_count=5)
    Draft202012Validator(schema).validate(template)


def test_template_valid_menurut_model_pydantic() -> None:
    template = build_validated_template(pg_count=25, essay_count=5)
    assert isinstance(template, ExamTemplate)
    assert len(template.multiple_choice_slots) == 25
    assert len(template.essay_slots) == 5


def test_template_bisa_diserialisasi_ulang() -> None:
    raw = build_template(pg_count=25, essay_count=5)
    round_trip = json.loads(json.dumps(raw))
    Draft202012Validator(load_exam_template_schema()).validate(round_trip)


# --------------------------------------------------------------------------- #
# Batas halaman
# --------------------------------------------------------------------------- #


def test_kombinasi_yang_tidak_muat_ditolak_dengan_pesan_bergerak() -> None:
    with pytest.raises(TemplateOverflowError) as exc:
        build_template(pg_count=50, essay_count=5)
    message = str(exc.value)
    assert "50" in message
    assert "tidak muat" in message
    assert "dua halaman" in message


def test_batas_praktis_tercatat() -> None:
    """44 PG + 5 esai masih muat; 46 PG + 5 esai sudah tidak.

    Batas ini dibatasi jarak antar pusat 6 mm (PRD FR-1.2) — bukan pilihan
    desain. Antarmuka /setup harus memberi tahu guru sebelum mencetak.
    """
    assert compute_layout(44, 5).content_bottom_y <= CONTENT_BOTTOM_MM
    with pytest.raises(TemplateOverflowError):
        build_template(pg_count=46, essay_count=5)


def test_judul_utama_tidak_menabrak_fiducial_kiri_atas() -> None:
    """Judul "LEMBAR JAWABAN KOMPUTER" harus di kanan fiducial kiri-atas."""
    tl_right = MARGIN_MM + FIDUCIAL_TL_MM
    assert PAPER_TITLE_X_MM > tl_right, "judul menabrak fiducial kiri-atas"


def test_kotak_petunjuk_di_kanan_zona_pilihan_ganda() -> None:
    """Kotak petunjuk mengisi ruang kosong, tidak menabrak kolom PG."""
    assert INSTRUCTION_BOX_RECT_MM["x"] > COLUMN_X_MM[1] + MC_OPTION_OFFSET_MM
    assert (
        INSTRUCTION_BOX_RECT_MM["x"]
        > COLUMN_X_MM[1] + MC_OPTION_OFFSET_MM + 3 * BUBBLE_PITCH_MM + BUBBLE_DIAMETER_MM
    )


def test_kotak_jawaban_esai_tidak_saling_tumpang_tindih() -> None:
    """Jarak antar blok esai harus >= tinggi kotak + 4 mm."""
    for pg, essay in [(25, 5), (28, 5), (20, 6), (10, 10)]:
        layout = compute_layout(pg, essay)
        assert layout.essay_pitch >= layout.essay_answer_h + 4


def test_max_essay_count_memberi_petunjuk_untuk_ui() -> None:
    # 50 PG masih muat sampai 4 soal esai; lebih dari itu tidak.
    assert max_essay_count_for(50) == 4
    # 25 PG + 10 soal esai tidak muat: kotak jawaban minimum 14 mm (2 baris
    # handwriting). 8 soal esai masih muat.
    assert max_essay_count_for(25) == 8
    assert max_essay_count_for(10) >= 10


def test_jumlah_pg_nol_ditolak() -> None:
    with pytest.raises(ValueError):
        build_template(pg_count=0)
