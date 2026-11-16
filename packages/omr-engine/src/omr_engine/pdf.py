"""Generator PDF LJK (ReportLab) dari koordinat ``ExamTemplate``.

Modul ini **tidak** menghitung koordinat sendiri — semuanya dibaca dari
template yang dihasilkan :mod:`omr_engine.template`. Karena itu PDF yang
dicetak dan yang dideteksi engine dijamin berasal dari geometri yang sama.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import Color, black, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .template import (
    CLASS_BOX_RECT_MM,
    COLUMN_X_MM,
    CONTENT_LEFT_MM,
    ESSAY_AREA_GAP_MM,
    INSTRUCTION_BOX_RECT_MM,
    INSTRUCTION_COLUMNS,
    INSTRUCTIONS,
    MC_OPTION_OFFSET_MM,
    MC_SECTION_TITLE_Y_MM,
    NAME_CROP_RECT_MM,
    PAPER_TITLE_X_MM,
    PAPER_TITLE_Y_MM,
)

MM_TO_PT = 72.0 / 25.4

PAGE_W_MM = 210.0
PAGE_H_MM = 297.0

INK = black
PAPER = white
FAINT = Color(0.55, 0.55, 0.55)
GUIDE = Color(0.72, 0.72, 0.72)


def mm_to_pt_x(x_mm: float) -> float:
    return x_mm * MM_TO_PT


def mm_to_pt_y(y_mm: float) -> float:
    """Milimeter dari atas → point dari bawah (sistem koordinat ReportLab)."""
    return PAGE_H_MM * MM_TO_PT - y_mm * MM_TO_PT


def _rect(c: canvas.Canvas, x_mm: float, y_mm: float, w_mm: float, h_mm: float, color=INK) -> None:
    c.saveState()
    c.setFillColor(color)
    c.rect(
        mm_to_pt_x(x_mm),
        mm_to_pt_y(y_mm + h_mm),
        w_mm * MM_TO_PT,
        h_mm * MM_TO_PT,
        stroke=0,
        fill=1,
    )
    c.restoreState()


def _dashed_rect(
    c: canvas.Canvas, x_mm: float, y_mm: float, w_mm: float, h_mm: float, color=FAINT
) -> None:
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(0.5)
    c.setDash(2, 2)
    c.rect(
        mm_to_pt_x(x_mm),
        mm_to_pt_y(y_mm + h_mm),
        w_mm * MM_TO_PT,
        h_mm * MM_TO_PT,
        stroke=1,
        fill=0,
    )
    c.restoreState()


def _circle(c: canvas.Canvas, x_mm: float, y_mm: float, diameter_mm: float) -> None:
    r = diameter_mm * MM_TO_PT / 2
    c.saveState()
    c.setLineWidth(0.7)
    c.circle(
        mm_to_pt_x(x_mm),
        mm_to_pt_y(y_mm),
        r,
        stroke=1,
        fill=0,
    )
    c.restoreState()


def _text(
    c: canvas.Canvas,
    text: str,
    x_mm: float,
    y_mm: float,
    size_pt: float = 7,
    color=INK,
    align: str = "left",
) -> None:
    c.saveState()
    c.setFillColor(color)
    c.setFont("Helvetica", size_pt)
    if align == "center":
        c.drawCentredString(mm_to_pt_x(x_mm), mm_to_pt_y(y_mm), text)
    elif align == "right":
        c.drawRightString(mm_to_pt_x(x_mm), mm_to_pt_y(y_mm), text)
    else:
        c.drawString(mm_to_pt_x(x_mm), mm_to_pt_y(y_mm), text)
    c.restoreState()


def render_pdf(template: dict, path: str | Path) -> Path:
    """Tulis PDF LJK dari ``template`` (dict ExamTemplate) ke ``path``."""
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)

    page_w = template.get("pageWidthMm", PAGE_W_MM)
    page_h = template.get("pageHeightMm", PAGE_H_MM)

    # pageCompression=0: isi PDF tetap terbaca teksnya. Berguna untuk
    # memverifikasi bahwa PDF benar-benar memakai koordinat template.
    c = canvas.Canvas(
        str(out), pagesize=(page_w * MM_TO_PT, page_h * MM_TO_PT), pageCompression=0
    )
    c.setTitle(f"LJK {template.get('examId', '')}")
    c.setFillColor(PAPER)
    c.rect(0, 0, page_w * MM_TO_PT, page_h * MM_TO_PT, stroke=0, fill=1)

    # --- fiducial marker ---
    for f in template["fiducials"]:
        _rect(c, f["xMm"], f["yMm"], f["sizeMm"], f["sizeMm"])

    # --- judul + zona nama ---
    _text(c, "LEMBAR JAWABAN KOMPUTER", PAPER_TITLE_X_MM, PAPER_TITLE_Y_MM, size_pt=9)
    _text(c, template.get("examId", ""), 196, PAPER_TITLE_Y_MM, size_pt=7, color=FAINT, align="right")

    crop = template["nameCropRectMm"]
    _dashed_rect(c, crop["x"], crop["y"], crop["w"], crop["h"])
    _text(c, "NAMA", crop["x"] + 2, crop["y"] + 6.5, size_pt=5.5, color=FAINT)
    _text(c, "________________________", crop["x"] + 24, crop["y"] + 6.5, size_pt=8)
    _text(c, "MATA PELAJARAN", crop["x"] + 2, crop["y"] + 15.0, size_pt=5.5, color=FAINT)
    _text(c, "________________________", crop["x"] + 24, crop["y"] + 15.0, size_pt=8)

    klass = CLASS_BOX_RECT_MM
    _dashed_rect(c, klass["x"], klass["y"], klass["w"], klass["h"])
    _text(c, "KELAS", klass["x"] + 2, klass["y"] + 6.5, size_pt=5.5, color=FAINT)
    _text(c, "____________________", klass["x"] + 22, klass["y"] + 6.5, size_pt=8)
    _text(c, "TANGGAL", klass["x"] + 2, klass["y"] + 15.0, size_pt=5.5, color=FAINT)
    _text(c, "____________________", klass["x"] + 22, klass["y"] + 15.0, size_pt=8)

    # --- Petunjuk pengisian (dipindah ke bawah kotak nama & kelas) ---
    guide = INSTRUCTION_BOX_RECT_MM
    _dashed_rect(c, guide["x"], guide["y"], guide["w"], guide["h"])
    _text(c, "PETUNJUK", guide["x"] + 3, guide["y"] + 4.5, size_pt=6, color=FAINT)

    # Kolom kiri: teks aturan
    for i, line in enumerate(INSTRUCTIONS):
        _text(
            c,
            f"- {line}",
            guide["x"] + 3,
            guide["y"] + 9.5 + i * 4.2,
            size_pt=5.8,
        )

    # Kolom kanan: visualisasi contoh pengisian benar vs salah
    ex_x = guide["x"] + 105.0
    _text(c, "Petunjuk Pengisian:", ex_x, guide["y"] + 5.0, size_pt=5.8, color=FAINT)

    # Benar: lingkaran terisi penuh
    b_r = 1.8  # radius contoh dalam mm
    c_y = guide["y"] + 13.5
    _circle(c, ex_x + 5.0, c_y, b_r * 2)
    # isi penuh
    c.saveState()
    c.setFillColor(INK)
    c.circle(mm_to_pt_x(ex_x + 5.0), mm_to_pt_y(c_y), b_r * MM_TO_PT, stroke=0, fill=1)
    c.restoreState()
    _text(c, "[v] Benar", ex_x + 8.5, c_y + 1.2, size_pt=5.5, color=INK)

    # Salah 1: lingkaran disilang
    s1_x = ex_x + 30.0
    _circle(c, s1_x, c_y, b_r * 2)
    c.saveState()
    c.setLineWidth(0.6)
    c.setStrokeColor(INK)
    r_pt = b_r * MM_TO_PT * 0.7
    c.line(mm_to_pt_x(s1_x) - r_pt, mm_to_pt_y(c_y) - r_pt, mm_to_pt_x(s1_x) + r_pt, mm_to_pt_y(c_y) + r_pt)
    c.line(mm_to_pt_x(s1_x) - r_pt, mm_to_pt_y(c_y) + r_pt, mm_to_pt_x(s1_x) + r_pt, mm_to_pt_y(c_y) - r_pt)
    c.restoreState()

    # Salah 2: lingkaran dicentang
    s2_x = ex_x + 38.0
    _circle(c, s2_x, c_y, b_r * 2)
    c.saveState()
    c.setLineWidth(0.6)
    c.setStrokeColor(INK)
    c.line(mm_to_pt_x(s2_x) - r_pt * 0.8, mm_to_pt_y(c_y), mm_to_pt_x(s2_x) - r_pt * 0.1, mm_to_pt_y(c_y) - r_pt * 0.8)
    c.line(mm_to_pt_x(s2_x) - r_pt * 0.1, mm_to_pt_y(c_y) - r_pt * 0.8, mm_to_pt_x(s2_x) + r_pt * 0.9, mm_to_pt_y(c_y) + r_pt * 0.8)
    c.restoreState()

    # Salah 3: titik / tidak penuh
    s3_x = ex_x + 46.0
    _circle(c, s3_x, c_y, b_r * 2)
    c.saveState()
    c.setFillColor(INK)
    c.circle(mm_to_pt_x(s3_x), mm_to_pt_y(c_y), b_r * MM_TO_PT * 0.4, stroke=0, fill=1)
    c.restoreState()

    _text(c, "[x] Salah", s3_x + 4.5, c_y + 1.2, size_pt=5.5, color=INK)

    # --- Pilihan Ganda ---
    _text(c, "I. PILIHAN GANDA", CONTENT_LEFT_MM, MC_SECTION_TITLE_Y_MM, size_pt=7.5)
    bubble_d = template["bubbleDiameterMm"]

    # Header label opsi A, B, C, D di atas setiap kolom
    header_y = MC_SECTION_TITLE_Y_MM + 4.5
    for col_x in COLUMN_X_MM:
        for k, label in enumerate(("A", "B", "C", "D")):
            opt_x = col_x + MC_OPTION_OFFSET_MM + k * template["bubblePitchMm"]
            _text(c, label, opt_x, header_y, size_pt=6.5, color=FAINT, align="center")

    for slot in template["multipleChoiceSlots"]:
        _text(c, f"{slot['questionNumber']:02d}", slot["xMm"], slot["yMm"] + 1, size_pt=6, color=FAINT)
        for opt in slot["options"]:
            _circle(c, opt["xMm"], opt["yMm"], bubble_d)

    # --- Zona esai: SATU kotak besar, tanpa nomor per soal ---
    # Skor esai dinilai guru di aplikasi, jadi kertas tidak perlu lingkaran
    # skor. Kotak ini hanya penanda zona esai; siswa menomori sendiri
    # jawabannya, sehingga mesin cukup memotong satu area.
    area = template.get("essayAreaRectMm")
    if area:
        _text(
            c,
            "II. ZONA JAWABAN ESAI",
            CONTENT_LEFT_MM,
            area["y"] - ESSAY_AREA_GAP_MM,
            size_pt=7.5,
        )
        _dashed_rect(c, area["x"], area["y"], area["w"], area["h"])
        _text(
            c,
            "Tulis jawaban esai di area ini. Nomor soal ditulis sendiri oleh siswa.",
            area["x"] + 2,
            area["y"] + area["h"] - 4,
            size_pt=5,
            color=GUIDE,
        )

    c.showPage()
    c.save()
    return out


__all__ = ["MM_TO_PT", "mm_to_pt_x", "mm_to_pt_y", "render_pdf"]
