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

from .template import CLASS_BOX_RECT_MM, NAME_CROP_RECT_MM

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


def _rect(c: canvas.Canvas, x_mm: float, y_mm: float, w_mm: float, h_mm: float) -> None:
    c.rect(
        mm_to_pt_x(x_mm),
        mm_to_pt_y(y_mm + h_mm),
        w_mm * MM_TO_PT,
        h_mm * MM_TO_PT,
        stroke=0,
        fill=1,
    )


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
    _text(c, "LEMBAR JAWABAN KOMPUTER", 14, 27, size_pt=9)
    _text(c, template.get("examId", ""), 196, 27, size_pt=7, color=FAINT, align="right")

    crop = template["nameCropRectMm"]
    _dashed_rect(c, crop["x"], crop["y"], crop["w"], crop["h"])
    _text(c, "NAMA", crop["x"] + 2, crop["y"] + 3, size_pt=5.5, color=FAINT)
    _text(c, "KELAS", crop["x"] + 2, crop["y"] + 8, size_pt=5.5, color=FAINT)
    _text(c, "________________________", crop["x"] + 16, crop["y"] + 3, size_pt=8)
    _text(c, "________________________", crop["x"] + 16, crop["y"] + 8, size_pt=8)

    klass = CLASS_BOX_RECT_MM
    _dashed_rect(c, klass["x"], klass["y"], klass["w"], klass["h"])
    _text(c, "KELAS", klass["x"] + 2, klass["y"] + 3, size_pt=5.5, color=FAINT)
    _text(c, "NO. ABSEN", klass["x"] + 2, klass["y"] + 8, size_pt=5.5, color=FAINT)
    _text(c, "____________", klass["x"] + 30, klass["y"] + 3, size_pt=8)
    _text(c, "____________", klass["x"] + 30, klass["y"] + 8, size_pt=8)

    # --- Pilihan Ganda ---
    _text(c, "I. PILIHAN GANDA", 14, 46, size_pt=7.5)
    bubble_d = template["bubbleDiameterMm"]
    for slot in template["multipleChoiceSlots"]:
        _text(c, f"{slot['questionNumber']:02d}", slot["xMm"], slot["yMm"] + 1, size_pt=6, color=FAINT)
        for opt in slot["options"]:
            _circle(c, opt["xMm"], opt["yMm"], bubble_d)

    # --- Zona esai: dua sub-bagian ---
    # Judul seksi diletakkan relatif terhadap zona esai, bukan di koordinat tetap,
    # supaya tidak menabrak baris PG terakhir.
    essay_slots = template["essaySlots"]
    essay_top = min((s["yMm"] for s in essay_slots), default=0.0)
    _text(c, "II. ZONA SKOR ESAI — DIISI GURU", 14, essay_top - 2, size_pt=7.5)
    for slot in essay_slots:
        _text(c, f"E{slot['questionNumber']}", 14, slot["yMm"] + 8, size_pt=7)
        rect = slot["studentAnswerRectMm"]
        _dashed_rect(c, rect["x"], rect["y"], rect["w"], rect["h"])
        _text(
            c,
            "jawaban esai siswa",
            rect["x"] + 2,
            rect["y"] + rect["h"] - 4,
            size_pt=5,
            color=GUIDE,
        )
        for value in slot["valueOptions"]:
            _circle(c, value["xMm"], value["yMm"], bubble_d)
        half = slot["halfModifierOffset"]
        c.saveState()
        c.setStrokeColor(INK)
        c.setLineWidth(0.5)
        c.rect(
            mm_to_pt_x(half["xMm"]),
            mm_to_pt_y(half["yMm"] + 3),
            7 * MM_TO_PT,
            6 * MM_TO_PT,
            stroke=1,
            fill=0,
        )
        c.restoreState()
        _text(c, "+.5", half["xMm"] + 1.5, half["yMm"] - 1, size_pt=5)

    c.showPage()
    c.save()
    return out


__all__ = ["MM_TO_PT", "mm_to_pt_x", "mm_to_pt_y", "render_pdf"]
