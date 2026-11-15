"""Generator koordinat LJK — SATU-SATUNYA sumber kebenaran geometri.

Modul ini определя letak setiap elemen LJK dalam **milimeter** dan
menghasilkan objek ``ExamTemplate`` yang persis cocok dengan JSON Schema
``packages/shared-schemas/schema/exam-template.schema.json``.

Dari koordinat yang sama inilah dua hal lain diturunkan:

* ``pdf.py``    → PDF LJK siap cetak (ReportLab)
* ``synth.py``  → LJK sintetis + ground truth untuk menguji engine OMR

Jadi tidak ada kemungkinan "cetak ≠ deteksi": ketiganya membaca sumber yang sama.

Aturan geometri (PRD FR-1.2, FR-1.3, FR-1.5)
------------------------------------------------
* Jarak antar pusat antar bubble minimal **8,5 mm** — dipakai persis sebagai
  jarak tata letak, sehingga ``bubblePitchMm`` bukan angka teoretis melainkan
  jarak yang benar-benar dipakai.
* Diameter bubble **4,5 mm**.
* 4 fiducial marker; yang **kiri-atas 14 × 14 mm** (penanda orientasi),
  tiga sudut lain **10 × 10 mm**.
* 2 kolom untuk Pilihan Ganda.
* Zona esai punya dua sub-bagian dengan koordinat terpisah:
  area kosong jawaban siswa, dan lingkaran skor yang diisi guru.
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

#: Jarak antar pusat antar bubble. PRD FR-1.2: minimal 6 mm (dulu 8,5 mm).
#: Dengan 6 mm, 25 soal PG hanya butuh 78 mm (bukan 110 mm) sehingga zona
#: esai dapat jauh lebih lega. Celah antar sisi bubble = 6 - 4,5 = 1,5 mm;
#: keandalan pembacaan pada celah ini diverifikasi di Task 4 (kasus pensil
#: redis & pencahayaan redup).
BUBBLE_DIAMETER_MM = 4.5
BUBBLE_PITCH_MM = 6.0

FIDUCIAL_TL_MM = 14.0
FIDUCIAL_OTHER_MM = 10.0

COLUMN_COUNT = 2
COLUMN_X_MM = (14.0, 62.0)

OPTION_LABELS = ("A", "B", "C", "D")
MC_OPTION_OFFSET_MM = 9.0  # jarak dari x kolom ke pusat option pertama

CONTENT_TOP_MM = 30.0
#: Judul utama "LEMBAR JAWABAN KOMPUTER". X-nya di KANAN fiducial kiri-atas
#: (yang berakhir di 22 mm), supaya tidak pernah bertumpuk.
PAPER_TITLE_X_MM = 25.0
PAPER_TITLE_Y_MM = 27.0
#: Judul seksi "I. PILIHAN GANDA".
MC_SECTION_TITLE_Y_MM = 46.0
NAME_CROP_RECT_MM = {"x": 14.0, "y": 30.0, "w": 90.0, "h": 12.0}
CLASS_BOX_RECT_MM = {"x": 110.0, "y": 30.0, "w": 80.0, "h": 12.0}

#: Kotak petunjuk pengisian — mengisi ruang kosong di kanan zona PG.
INSTRUCTION_BOX_RECT_MM = {"x": 100.0, "y": 52.0, "w": 90.0, "h": 40.0}
INSTRUCTIONS = (
    "Isilah dengan pensil 2B",
    "Jangan memakai bolpoin",
    "Coret jawaban yang salah",
    "Tulis nama dan kelas dengan jelas",
)

MC_START_Y_MM = 52.0

ESSAY_LABEL_X_MM = 14.0
ESSAY_LABEL_W_MM = 12.0
ESSAY_ANSWER_X_MM = 26.0
#: Kotak jawaban esai memakai lebar penuh area konten (26 → 190 mm).
ESSAY_ANSWER_W_MM = 164.0
ESSAY_ANSWER_H_MAX_MM = 24.0
ESSAY_ANSWER_H_MIN_MM = 14.0
ESSAY_GAP_MM = 8.0
#: Jarak minimum antara dua blok esai, di luar tinggi kotak jawaban.
ESSAY_BLOCK_GAP_MM = 4.0

#: Batas bawah isi konten. Fiducial bawah menempati pita y 279-289 mm
#: (margin 8 mm), jadi konten harus berhenti 5 mm di atas pita itu.
CONTENT_BOTTOM_MM = PAGE_HEIGHT_MM - MARGIN_MM - 15.0  # 274 mm


class TemplateOverflowError(ValueError):
    """Kombinasi jumlah soal tidak muat di satu halaman A4.

    Pesannya sengaja bisa langsung ditindaklanjuti guru.
    """


# --------------------------------------------------------------------------- #
# Struktur hasil
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Layout:
    """Hasil perhitungan tata letak, dalam milimeter."""

    pg_count: int
    essay_count: int
    mc_rows: int
    mc_last_center_y: float
    essay_start_y: float
    essay_pitch: float
    essay_answer_h: float

    @property
    def content_bottom_y(self) -> float:
        if self.essay_count == 0:
            return self.mc_last_center_y + BUBBLE_DIAMETER_MM / 2
        return self.essay_start_y + (self.essay_count - 1) * self.essay_pitch + self.essay_answer_h


# --------------------------------------------------------------------------- #
# Perhitungan tata letak
# --------------------------------------------------------------------------- #


def _rows_for(pg_count: int) -> int:
    """Jumlah baris per kolom. Penomoran berjalan kolom 1 → kolom 2."""
    return math.ceil(pg_count / COLUMN_COUNT)


def compute_layout(pg_count: int, essay_count: int) -> Layout:
    """Hitung tata letak, atau lempar ``TemplateOverflowError`` bila tidak muat.

    Strategi: jarak antar pusat bubble (8,5 mm) dan tinggi minimum kotak
    jawaban esai (10 mm) adalah batas bawah yang tidak boleh dilanggar
    karena keduanya memengaruhi keterbacaan OMR dan ruang tulis siswa.
    """
    if pg_count < 1:
        raise ValueError("pg_count minimal 1")
    if essay_count < 0:
        raise ValueError("essay_count tidak boleh negatif")

    rows = _rows_for(pg_count)
    mc_last_center_y = MC_START_Y_MM + (rows - 1) * BUBBLE_PITCH_MM

    if essay_count == 0:
        layout = Layout(pg_count, essay_count, rows, mc_last_center_y, 0.0, 0.0, 0.0)
        if layout.content_bottom_y > CONTENT_BOTTOM_MM:
            raise TemplateOverflowError(_overflow_message(pg_count, essay_count, 0))
        return layout

    # Zona esai memakai lebar penuh dan tinggi dibagi rata ke seluruh soal.
    # Tidak ada lingkaran skor di kertas — skor esai dinilai guru di aplikasi.
    start = mc_last_center_y + ESSAY_GAP_MM
    available = CONTENT_BOTTOM_MM - start
    for answer_h in (
        ESSAY_ANSWER_H_MAX_MM,
        22.0,
        20.0,
        18.0,
        16.0,
        ESSAY_ANSWER_H_MIN_MM,
    ):
        pitch = answer_h + ESSAY_BLOCK_GAP_MM
        if (essay_count - 1) * pitch + answer_h <= available:
            return Layout(pg_count, essay_count, rows, mc_last_center_y, start, pitch, answer_h)

    raise TemplateOverflowError(_overflow_message(pg_count, essay_count, rows))


def _overflow_message(pg_count: int, essay_count: int, rows: int) -> str:
    return (
        f"{pg_count} soal Pilihan Ganda ({rows} baris) + {essay_count} soal esai "
        f"tidak muat di satu halaman A4 dengan jarak antar pusat "
        f"{BUBBLE_PITCH_MM} mm. Kurangi jumlah soal esai, atau cetak pada dua halaman."
    )


def max_essay_count_for(pg_count: int) -> int:
    """Berapa soal esai maksimum yang masih muat bersama ``pg_count`` soal PG.

    Dipakai antarmuka ``/setup`` untuk memberi tahu guru sebelum_save.
    """
    for n in range(0, 11):
        try:
            compute_layout(pg_count, n)
        except TemplateOverflowError:
            return max(0, n - 1)
    return 10


# --------------------------------------------------------------------------- #
# Pembuatan ExamTemplate
# --------------------------------------------------------------------------- #


def build_template(
    exam_id: str = "exam-1",
    template_id: str = "tpl-1",
    pg_count: int = 25,
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
    for number in range(1, pg_count + 1):
        col = (number - 1) // layout.mc_rows
        row = (number - 1) % layout.mc_rows
        x = COLUMN_X_MM[col]
        y = MC_START_Y_MM + row * BUBBLE_PITCH_MM
        mc_slots.append(
            {
                "questionNumber": number,
                "xMm": x,
                "yMm": y,
                "options": [
                    {
                        "label": label,
                        "xMm": x + MC_OPTION_OFFSET_MM + k * BUBBLE_PITCH_MM,
                        "yMm": y,
                    }
                    for k, label in enumerate(OPTION_LABELS)
                ],
            }
        )

    essay_slots = []
    for number in range(1, essay_count + 1):
        top = layout.essay_start_y + (number - 1) * layout.essay_pitch
        essay_slots.append(
            {
                "questionNumber": number,
                "xMm": ESSAY_LABEL_X_MM,
                "yMm": round(top, 3),
                # Area kosong untuk tulisan siswa. Mesin hanya memotong (crop)
                # area ini; skor esai dinilai guru di aplikasi.
                "studentAnswerRectMm": {
                    "x": ESSAY_ANSWER_X_MM,
                    "y": round(top, 3),
                    "w": ESSAY_ANSWER_W_MM,
                    "h": layout.essay_answer_h,
                },
            }
        )

    return {
        "id": template_id,
        "examId": exam_id,
        "pageWidthMm": PAGE_WIDTH_MM,
        "pageHeightMm": PAGE_HEIGHT_MM,
        "columnCount": COLUMN_COUNT,
        "bubbleDiameterMm": BUBBLE_DIAMETER_MM,
        "bubblePitchMm": BUBBLE_PITCH_MM,
        "fiducials": fiducials,
        "nameCropRectMm": dict(NAME_CROP_RECT_MM),
        "multipleChoiceSlots": mc_slots,
        "essaySlots": essay_slots,
    }


def build_validated_template(
    exam_id: str = "exam-1",
    template_id: str = "tpl-1",
    pg_count: int = 25,
    essay_count: int = 5,
) -> ExamTemplate:
    """``build_template`` yang divalidasi model pydantic."""
    return ExamTemplate.model_validate(
        build_template(exam_id, template_id, pg_count, essay_count)
    )


__all__ = [
    "BUBBLE_DIAMETER_MM",
    "BUBBLE_PITCH_MM",
    "CONTENT_BOTTOM_MM",
    "ESSAY_ANSWER_H_MM",
    "ESSAY_PITCH_MM",
    "FIDUCIAL_OTHER_MM",
    "FIDUCIAL_TL_MM",
    "Layout",
    "MARGIN_MM",
    "PAGE_HEIGHT_MM",
    "PAGE_WIDTH_MM",
    "TemplateOverflowError",
    "build_template",
    "build_validated_template",
    "compute_layout",
    "max_essay_count_for",
]
