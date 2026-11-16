"""Generator koordinat LJK — SATU-SATUNYA sumber kebenaran geometri.

Modul ini menentukan letak setiap elemen LJK dalam **milimeter** dan
menghasilkan objek ``ExamTemplate`` yang persis cocok dengan JSON Schema
``packages/shared-schemas/schema/exam-template.schema.json``.

Dari koordinat yang sama inilah dua hal lain diturunkan:

* ``pdf.py``    → PDF LJK siap cetak (ReportLab)
* ``synth.py``  → LJK sintetis + ground truth untuk menguji engine OMR

Jadi tidak ada kemungkinan "cetak ≠ deteksi": ketiganya membaca sumber yang sama.

Tata letak (hasil revisi pemilik proyek)
------------------------------------------
* Jarak antar pusat antar bubble **8,5 mm** — lega untuk pensil 2B.
* Pilihan Ganda dikelompokkan **5 nomor per blok**, dengan jarak antar blok
  lebih jauh daripada jarak antar nomor di dalam blok.
* **PETUNJUK** dipindahkan ke bawah kotak nama & kelas, melingkupi lebar konten.
* Judul seksi diberi jarak lega dari elemen di atasnya.
* **Zona esai = satu kotak besar** setinggi sisa halaman. Tidak ada nomor
  per soal — siswa yang menomori sendiri jawabannya.

Aturan geometri (PRD FR-1.2, FR-1.3, FR-1.5)
---------------------------------------------------
* Jarak antar pusat antar bubble minimal **8,5 mm**.
* Diameter bubble **4,5 mm**.
* 4 fiducial marker; yang **kiri-atas 14 × 14 mm** (penanda orientasi),
  tiga sudut lain **10 × 10 mm**.
* 2 kolom untuk Pilihan Ganda.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from openomr_schemas import ExamTemplate

# --------------------------------------------------------------------------- #
# Konstanta tata letak (mm)
# --------------------------------------------------------------------------- #

PAGE_WIDTH_MM = 210.0
PAGE_HEIGHT_MM = 297.0
MARGIN_MM = 8.0

#: Jarak antar pusat antar bubble. PRD FR-1.2: minimal 8,5 mm.
BUBBLE_DIAMETER_MM = 4.5
BUBBLE_PITCH_MM = 8.5

FIDUCIAL_TL_MM = 14.0
FIDUCIAL_OTHER_MM = 10.0

#: Area konten. Semua elemen (kecuali fiducial) berada di dalam kotak ini.
CONTENT_LEFT_MM = 14.0
CONTENT_WIDTH_MM = 176.0

COLUMN_COUNT = 3
COLUMN_X_MM = (14.0, 78.5, 143.0)

OPTION_LABELS = ("A", "B", "C", "D")
MC_OPTION_OFFSET_MM = 10.0  # jarak dari x kolom ke pusat option pertama (A)

#: Pengelompokan: setiap GROUP_SIZE nomor soal dikelompokkan, dengan jarak
#: antar kelompok lebih jauh daripada jarak antar nomor di dalam kelompok.
GROUP_SIZE = 5
GROUP_GAP_MM = 3.5

#: Judul utama. X-nya di KANAN fiducial kiri-atas (yang berakhir di 22 mm).
PAPER_TITLE_X_MM = 25.0
PAPER_TITLE_Y_MM = 26.0

NAME_CROP_RECT_MM = {"x": 14.0, "y": 30.0, "w": 90.0, "h": 20.0}
CLASS_BOX_RECT_MM = {"x": 110.0, "y": 30.0, "w": 80.0, "h": 20.0}

#: Kotak petunjuk — dipindahkan ke bawah kotak nama & kelas, melingkupi lebar
#: konten. Isinya ditata dua kolom supaya kotaknya tetap ringkas.
INSTRUCTION_BOX_RECT_MM = {"x": 14.0, "y": 54.0, "w": 176.0, "h": 22.0}
INSTRUCTIONS = (
    "Jawab dengan memenuhi lingkaran pada jawaban yang tepat.",
    "Gunakan pensil 2B, tidak disarankan menggunakan bolpoin.",
    "Tuliskan nama dan kelas dengan jelas.",
)
#: Jumlah kolom teks di dalam kotak petunjuk.
INSTRUCTION_COLUMNS = 2

#: Judul seksi "I. PILIHAN GANDA".
MC_SECTION_TITLE_Y_MM = 86.0
#: Baris bubble pertama. Jarak ke judul seksi = 10 mm.
MC_START_Y_MM = 96.0

#: Jarak dari dasar baris PG terakhir ke baseline judul zona esai.
ESSAY_TITLE_GAP_MM = 13.75
#: Jarak dari baseline judul zona esai ke sisi atas kotak area esai.
ESSAY_AREA_GAP_MM = 8.0
#: Tinggi minimum area esai. Di bawah ini, area tidak cukup untuk menulis.
ESSAY_AREA_MIN_H_MM = 30.0

#: Batas bawah isi konten. Fiducial bawah menempati pita y 279-289 mm
#: (margin 8 mm), jadi konten harus berhenti di atas pita itu.
CONTENT_BOTTOM_MM = PAGE_HEIGHT_MM - MARGIN_MM - 13.0  # 276 mm


class TemplateOverflowError(ValueError):
    """Kombinasi jumlah soal tidak muat di satu halaman A4.

    Pesannya sengaja bisa langsung ditindaklanjuti guru.
    """


# --------------------------------------------------------------------------- #
# Struktur hasil
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class ColumnPlan:
    """Rencana satu kolom Pilihan Ganda.

    ``rows`` berisi pasangan ``(nomor soal, y pusat bubble)``. Jarak antar
    kelompok sudah termasuk di dalamnya.
    """

    index: int
    first: int
    last: int
    x_mm: float
    rows: tuple[tuple[int, float], ...]

    @property
    def bottom_y(self) -> float:
        """y tepi bawah baris terakhir kolom ini (tengah bubble + jari-jari)."""
        return self.rows[-1][1] + BUBBLE_DIAMETER_MM / 2


@dataclass(frozen=True)
class Layout:
    """Hasil perhitungan tata letak, dalam milimeter."""

    pg_count: int
    essay_count: int
    columns: tuple[ColumnPlan, ...]
    pg_bottom_y: float
    essay_title_y: float
    essay_area_rect: dict | None

    @property
    def rows_per_column(self) -> int:
        """Baris paling banyak di salah satu kolom."""
        return max((len(c.rows) for c in self.columns), default=0)

    @property
    def content_bottom_y(self) -> float:
        if self.essay_area_rect is None:
            return self.pg_bottom_y
        rect = self.essay_area_rect
        return rect["y"] + rect["h"]


# --------------------------------------------------------------------------- #
# Perhitungan tata letak
# --------------------------------------------------------------------------- #


def _rows_of(first: int, last: int) -> tuple[tuple[int, float], ...]:
    """Baris kolom: nomor soal + y pusat bubble.

    Setiap ``GROUP_SIZE`` nomor diberi jarak tambahan, asal nomor berikutnya
    masih berada di kolom yang sama — batas kolom sudah menjadi pemisah.
    """
    rows: list[tuple[int, float]] = []
    y = MC_START_Y_MM
    for number in range(first, last + 1):
        rows.append((number, round(y, 3)))
        y += BUBBLE_PITCH_MM
        if number % GROUP_SIZE == 0 and number < last:
            y += GROUP_GAP_MM
    return tuple(rows)


def _column_plans(pg_count: int) -> tuple[ColumnPlan, ...]:
    """Rencana kolom: penomoran berjalan kolom 1 → kolom 2."""
    rows = math.ceil(pg_count / COLUMN_COUNT)
    plans: list[ColumnPlan] = []
    start = 1
    for index in range(COLUMN_COUNT):
        if start > pg_count:
            break
        end = min(pg_count, start + rows - 1) if index < COLUMN_COUNT - 1 else pg_count
        plans.append(
            ColumnPlan(
                index=index,
                first=start,
                last=end,
                x_mm=COLUMN_X_MM[index],
                rows=_rows_of(start, end),
            )
        )
        start = end + 1
    return tuple(plans)


def compute_layout(pg_count: int, essay_count: int) -> Layout:
    """Hitung tata letak, atau lempar ``TemplateOverflowError`` bila tidak muat."""
    if pg_count < 1:
        raise ValueError("pg_count minimal 1")
    if essay_count < 0:
        raise ValueError("essay_count tidak boleh negatif")

    columns = _column_plans(pg_count)
    pg_bottom = max(column.bottom_y for column in columns)

    if essay_count == 0:
        if pg_bottom > CONTENT_BOTTOM_MM:
            raise TemplateOverflowError(
                _overflow_message(pg_count, essay_count, len(columns[0].rows))
            )
        return Layout(pg_count, essay_count, columns, pg_bottom, 0.0, None)

    essay_title_y = round(pg_bottom + ESSAY_TITLE_GAP_MM, 3)
    area_top = round(essay_title_y + ESSAY_AREA_GAP_MM, 3)
    area_height = round(CONTENT_BOTTOM_MM - area_top, 3)
    if area_height < ESSAY_AREA_MIN_H_MM:
        raise TemplateOverflowError(
            _overflow_message(pg_count, essay_count, len(columns[0].rows))
        )

    rect = {
        "x": CONTENT_LEFT_MM,
        "y": area_top,
        "w": CONTENT_WIDTH_MM,
        "h": area_height,
    }
    return Layout(pg_count, essay_count, columns, pg_bottom, essay_title_y, rect)


def _overflow_message(pg_count: int, essay_count: int, rows: int) -> str:
    return (
        f"{pg_count} soal Pilihan Ganda ({rows} baris) + {essay_count} soal esai "
        f"tidak muat di satu halaman A4 dengan jarak antar pusat "
        f"{BUBBLE_PITCH_MM} mm. Kurangi jumlah soal, atau cetak pada dua halaman."
    )


def max_essay_count_for(pg_count: int) -> int:
    """Berapa soal esai maksimum yang masih muat bersama ``pg_count`` soal PG.

    Karena zona esai kini **satu kotak besar**, jumlah soal esai tidak lagi
    mengubah tinggi area — hanya apakah ada zona esai atau tidak. Fungsi ini
    tetap dipakai antarmuka ``/setup`` agar guru melihat batas yang sama.
    """
    for n in range(0, 11):
        try:
            compute_layout(pg_count, n)
        except TemplateOverflowError:
            return max(0, n - 1)
    return 10


def max_pg_count_for(essay_count: int) -> int:
    """Berapa soal PG maksimum yang masih muat dengan ``essay_count`` soal esai."""
    low, high = 1, 200
    best = 0
    while low <= high:
        mid = (low + high) // 2
        try:
            compute_layout(mid, essay_count)
        except TemplateOverflowError:
            high = mid - 1
        else:
            best = mid
            low = mid + 1
    return best


# --------------------------------------------------------------------------- #
# Pembuatan ExamTemplate
# --------------------------------------------------------------------------- #


def build_template(
    exam_id: str = "exam-1",
    template_id: str = "tpl-1",
    pg_count: int = 30,
    essay_count: int = 5,
) -> dict:
    """Bangun objek ``ExamTemplate`` (siap diserialisasi ke JSON).

    Mengembalikan dict biasa — pydantic memvalidasi bentuknya saat diimpor.
    """
    layout = compute_layout(pg_count, essay_count)

    fiducials = [
        {
            "corner": "TOP_LEFT",
            "sizeMm": FIDUCIAL_TL_MM,
            "xMm": MARGIN_MM,
            "yMm": MARGIN_MM,
        },
        {
            "corner": "TOP_RIGHT",
            "sizeMm": FIDUCIAL_OTHER_MM,
            "xMm": PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM,
            "yMm": MARGIN_MM,
        },
        {
            "corner": "BOTTOM_LEFT",
            "sizeMm": FIDUCIAL_OTHER_MM,
            "xMm": MARGIN_MM,
            "yMm": PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM,
        },
        {
            "corner": "BOTTOM_RIGHT",
            "sizeMm": FIDUCIAL_OTHER_MM,
            "xMm": PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM,
            "yMm": PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM,
        },
    ]

    mc_slots = []
    for column in layout.columns:
        for number, y in column.rows:
            mc_slots.append(
                {
                    "questionNumber": number,
                    "xMm": column.x_mm,
                    "yMm": y,
                    "options": [
                        {
                            "label": label,
                            "xMm": round(column.x_mm + MC_OPTION_OFFSET_MM + k * BUBBLE_PITCH_MM, 3),
                            "yMm": y,
                        }
                        for k, label in enumerate(OPTION_LABELS)
                    ],
                }
            )

    return {
        "id": template_id,
        "examId": exam_id,
        "pageWidthMm": PAGE_WIDTH_MM,
        "pageHeightMm": PAGE_HEIGHT_MM,
        "columnCount": len(layout.columns),
        "bubbleDiameterMm": BUBBLE_DIAMETER_MM,
        "bubblePitchMm": BUBBLE_PITCH_MM,
        "fiducials": fiducials,
        "nameCropRectMm": dict(NAME_CROP_RECT_MM),
        "multipleChoiceSlots": mc_slots,
        # Satu area esai besar — penanda zona esai. Nomor esai dihapus;
        # siswa yang menomori sendiri jawabannya.
        "essayAreaRectMm": layout.essay_area_rect,
    }


def build_validated_template(
    exam_id: str = "exam-1",
    template_id: str = "tpl-1",
    pg_count: int = 30,
    essay_count: int = 5,
) -> ExamTemplate:
    """``build_template`` yang divalidasi model pydantic."""
    return ExamTemplate.model_validate(
        build_template(exam_id, template_id, pg_count, essay_count)
    )


__all__ = [
    "BUBBLE_DIAMETER_MM",
    "BUBBLE_PITCH_MM",
    "CLASS_BOX_RECT_MM",
    "CONTENT_BOTTOM_MM",
    "CONTENT_LEFT_MM",
    "CONTENT_WIDTH_MM",
    "ESSAY_AREA_GAP_MM",
    "ESSAY_AREA_MIN_H_MM",
    "ESSAY_TITLE_GAP_MM",
    "GROUP_GAP_MM",
    "GROUP_SIZE",
    "INSTRUCTION_BOX_RECT_MM",
    "INSTRUCTION_COLUMNS",
    "INSTRUCTIONS",
    "ColumnPlan",
    "Layout",
    "MARGIN_MM",
    "MC_OPTION_OFFSET_MM",
    "MC_SECTION_TITLE_Y_MM",
    "MC_START_Y_MM",
    "NAME_CROP_RECT_MM",
    "PAGE_HEIGHT_MM",
    "PAGE_WIDTH_MM",
    "PAPER_TITLE_X_MM",
    "PAPER_TITLE_Y_MM",
    "TemplateOverflowError",
    "build_template",
    "build_validated_template",
    "compute_layout",
    "max_essay_count_for",
    "max_pg_count_for",
]
