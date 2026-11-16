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
    CLASS_BOX_RECT_MM,
    COLUMN_X_MM,
    CONTENT_BOTTOM_MM,
    ESSAY_AREA_GAP_MM,
    ESSAY_AREA_MIN_H_MM,
    FIDUCIAL_OTHER_MM,
    FIDUCIAL_TL_MM,
    GROUP_GAP_MM,
    GROUP_SIZE,
    INSTRUCTION_BOX_RECT_MM,
    MARGIN_MM,
    MC_OPTION_OFFSET_MM,
    MC_SECTION_TITLE_Y_MM,
    MC_START_Y_MM,
    NAME_CROP_RECT_MM,
    PAGE_HEIGHT_MM,
    PAGE_WIDTH_MM,
    PAPER_TITLE_X_MM,
    TemplateOverflowError,
    build_template,
    build_validated_template,
    compute_layout,
    max_essay_count_for,
    max_pg_count_for,
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


def rows_per_column(template: dict) -> dict[float, list[tuple[int, float]]]:
    """(nomor soal, y) tiap baris, dikelompokkan per kolom (x kolom)."""
    grouped: dict[float, list[tuple[int, float]]] = {}
    for slot in template["multipleChoiceSlots"]:
        grouped.setdefault(slot["xMm"], []).append((slot["questionNumber"], slot["yMm"]))
    return grouped


# --------------------------------------------------------------------------- #
# Tata letak
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("pg", "essay"),
    [(25, 5), (26, 5), (30, 5), (40, 0), (10, 10), (1, 0)],
)
def test_layout_tidak_meluber_kertas(pg: int, essay: int) -> None:
    layout = compute_layout(pg, essay)
    assert layout.content_bottom_y <= CONTENT_BOTTOM_MM


@pytest.mark.parametrize(
    ("pg", "essay"),
    [(25, 5), (26, 5), (30, 5), (40, 0), (10, 10)],
)
def test_semua_bubble_dalam_batas_kertas(pg: int, essay: int) -> None:
    template = build_template(pg_count=pg, essay_count=essay)
    radius = BUBBLE_DIAMETER_MM / 2
    for x, y in all_bubble_centers(template):
        assert radius <= x <= PAGE_WIDTH_MM - radius
        assert radius <= y <= PAGE_HEIGHT_MM - radius


@pytest.mark.parametrize(("pg", "essay"), [(25, 5), (30, 5), (20, 5)])
def test_jarak_antar_pusat_minimal_8_5_mm(pg: int, essay: int) -> None:
    """PRD FR-1.2: jarak antar pusat antar bubble minimal 8,5 mm."""
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


def test_tiga_kolom_pilihan_ganda() -> None:
    template = build_template(pg_count=25, essay_count=0)
    xs = sorted({slot["xMm"] for slot in template["multipleChoiceSlots"]})
    assert len(xs) == 3
    assert template["columnCount"] == 3


def test_penomoran_berjalan_kolom_1_lalu_kolom_2_lalu_kolom_3() -> None:
    template = build_template(pg_count=25, essay_count=0)
    slots = template["multipleChoiceSlots"]
    assert slots[0]["questionNumber"] == 1
    # 25 soal -> 9 baris/kolom: kolom 1 (1-9), kolom 2 (10-18), kolom 3 (19-25)
    assert slots[8]["questionNumber"] == 9
    assert slots[9]["questionNumber"] == 10
    assert slots[9]["xMm"] > slots[0]["xMm"]  # soal 10 pindah ke kolom 2
    assert slots[17]["questionNumber"] == 18
    assert slots[18]["questionNumber"] == 19
    assert slots[18]["xMm"] > slots[9]["xMm"]  # soal 19 pindah ke kolom 3
    assert slots[24]["questionNumber"] == 25


# --------------------------------------------------------------------------- #
# Pengelompokan 5 nomor
# --------------------------------------------------------------------------- #


def test_setiap_5_nomor_dikelompokkan_dengan_jeda_lebih_besar() -> None:
    """Setiap 5 nomor jadi satu blok, jaraknya lebih lega dari dalam blok."""
    template = build_template(pg_count=25, essay_count=0)
    for _x, rows in rows_per_column(template).items():
        for (n1, y1), (_n2, y2) in zip(rows, rows[1:]):
            gap = round(y2 - y1, 3)
            if n1 % GROUP_SIZE == 0:
                assert gap == pytest.approx(BUBBLE_PITCH_MM + GROUP_GAP_MM, abs=0.01), (
                    f"jeda setelah nomor {n1} hanya {gap} mm"
                )
            else:
                assert gap == pytest.approx(BUBBLE_PITCH_MM, abs=0.01), (
                    f"jarak dalam blok setelah nomor {n1} adalah {gap} mm"
                )


def test_jeda_kelompok_lebih_besar_daripada_pitch() -> None:
    assert GROUP_GAP_MM > 0
    assert GROUP_SIZE == 5


# --------------------------------------------------------------------------- #
# Jarak lega antar elemen (revisi pemilik proyek)
# --------------------------------------------------------------------------- #


def test_judul_pilihan_ganda_jarak_lega_dari_petunjuk() -> None:
    """Kotak petunjuk dipindah ke bawah nama & kelas; judul PG harus lega."""
    assert INSTRUCTION_BOX_RECT_MM["y"] >= NAME_CROP_RECT_MM["y"] + NAME_CROP_RECT_MM["h"]
    gap = MC_SECTION_TITLE_Y_MM - (
        INSTRUCTION_BOX_RECT_MM["y"] + INSTRUCTION_BOX_RECT_MM["h"]
    )
    assert gap >= 10, f"judul Pilihan Ganda hanya {gap:.1f} mm dari kotak petunjuk"


def test_baris_pg_pertama_jarak_lega_dari_judul_seksi() -> None:
    gap = MC_START_Y_MM - MC_SECTION_TITLE_Y_MM
    assert gap >= 8, f"baris pertama hanya {gap:.1f} mm dari judul seksi"


def test_judul_zona_esai_jarak_lega_dari_baris_pg_terakhir() -> None:
    layout = compute_layout(25, 5)
    assert layout.essay_title_y - layout.pg_bottom_y >= 10


def test_kotak_petunjuk_di_bawah_kotak_nama_dan_kelas() -> None:
    """PETUNJUK pindah ke bawah kotak nama & kelas (revisi pemilik proyek)."""
    guide_top = INSTRUCTION_BOX_RECT_MM["y"]
    assert guide_top >= NAME_CROP_RECT_MM["y"] + NAME_CROP_RECT_MM["h"]
    assert guide_top >= CLASS_BOX_RECT_MM["y"] + CLASS_BOX_RECT_MM["h"]
    # Tidak boleh menabrak zona Pilihan Ganda.
    assert guide_top + INSTRUCTION_BOX_RECT_MM["h"] < MC_SECTION_TITLE_Y_MM


def test_kotak_petunjuk_melingkupi_lebar_konten() -> None:
    assert INSTRUCTION_BOX_RECT_MM["w"] >= 150


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


def test_judul_utama_tidak_menabrak_fiducial_kiri_atas() -> None:
    """Judul "LEMBAR JAWABAN KOMPUTER" harus di kanan fiducial kiri-atas."""
    tl_right = MARGIN_MM + FIDUCIAL_TL_MM
    assert PAPER_TITLE_X_MM > tl_right, "judul menabrak fiducial kiri-atas"


# --------------------------------------------------------------------------- #
# Zona esai — SATU kotak besar
# --------------------------------------------------------------------------- #


def test_zona_esai_hanya_satu_area_besar() -> None:
    """Zona esai = satu area kosong; tidak ada nomor per soal di kertas."""
    template = build_template(pg_count=25, essay_count=5)
    area = template["essayAreaRectMm"]
    assert isinstance(area, dict)
    assert set(area.keys()) == {"x", "y", "w", "h"}
    assert area["w"] >= 150
    assert area["h"] >= ESSAY_AREA_MIN_H_MM


def test_zona_esai_tidak_ada_kalau_tidak_ada_soal_esai() -> None:
    template = build_template(pg_count=25, essay_count=0)
    assert template["essayAreaRectMm"] is None


def test_area_esai_di_bawah_zona_pilihan_ganda() -> None:
    layout = compute_layout(25, 5)
    rect = layout.essay_area_rect
    assert rect is not None
    assert rect["y"] > layout.pg_bottom_y
    # Sisi atas kotak esai mengikuti gap dari judul zona esai.
    assert rect["y"] == pytest.approx(layout.essay_title_y + ESSAY_AREA_GAP_MM, abs=0.01)


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
    assert template.essay_area_rect_mm is not None


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
    """60 PG tanpa zona esai masih muat (3 kolom x 20 baris); 61 sudah tidak.

    Batas ini dibatasi jarak antar pusat 8,5 mm (PRD FR-1.2) plus jeda
    pengelompokan 5 nomor (3,5 mm) dalam 3 kolom dengan slot identitas 2 baris
    (Nama + Mapel & Kelas + Tanggal).
    """
    assert compute_layout(60, 0).content_bottom_y <= CONTENT_BOTTOM_MM
    with pytest.raises(TemplateOverflowError):
        build_template(pg_count=61, essay_count=0)


def test_zona_esai_membatasi_jumlah_pg() -> None:
    """Dengan zona esai, kapasitas PG turun (zona esai butuh ruang)."""
    assert max_pg_count_for(0) == 60
    assert max_pg_count_for(5) == 45


def test_max_essay_count_memberi_petunjuk_untuk_ui() -> None:
    # Zona esai kini satu kotak besar: jumlah soal esai tidak mengubah
    # tinggi area, jadi batasnya hanya "ada zona esai atau tidak".
    assert max_essay_count_for(25) == 10
    assert max_essay_count_for(45) == 10
    # 50 PG tidak muat kalau zona esai ikut ada.
    assert max_essay_count_for(50) == 0


def test_jumlah_pg_nol_ditolak() -> None:
    with pytest.raises(ValueError):
        build_template(pg_count=0)
