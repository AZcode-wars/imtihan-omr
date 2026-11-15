"""LJK sintetis + ground truth — untuk menguji engine OMR tanpa LJK asli.

Modul ini menggambar lembar jawaban **dari koordinat template yang sama**
dengan yang dipakai :mod:`omr_engine.pdf`. Karena itu ground truth yang
dihasilkan dijamin cocok dengan apa yang ada di template — dan dengan
apa yang keluar dari printer.

Yang digambar:
* seluruh elemen LJK (fiducial, zona nama, bubble PG, zona esai)
* **jawaban siswa** pada bubble PG (tebal / kosong / dobel / arsiran tipis)
* **skor guru** pada lingkaran zona esai (nilai 0-5 dan modifier +0,5)

Distribusi jawaban dibuat deterministik agar bisa dipakai sebagai ground truth:
* nomor kelipatan 7  → kosong (status ``EMPTY``)
* nomor kelipatan 11 → dobel (status ``MULTIPLE``)
* nomor kelipatan 13 → arsiran tipis (status ``LOW_CONFIDENCE``)
* selain itu         → benar, arsiran tebal (status ``VALID``)
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np

from .pdf import render_pdf
from .template import (
    CLASS_BOX_RECT_MM,
    CONTENT_LEFT_MM,
    ESSAY_AREA_GAP_MM,
    INSTRUCTION_BOX_RECT_MM,
    INSTRUCTION_COLUMNS,
    INSTRUCTIONS,
    MC_SECTION_TITLE_Y_MM,
    PAPER_TITLE_X_MM,
    PAPER_TITLE_Y_MM,
    build_template,
    compute_layout,
)

DEFAULT_PX_PER_MM = 4.0
FILL_VALID = 0.55
FILL_LOW_CONFIDENCE = 0.30

STATUS_EMPTY = "EMPTY"
STATUS_MULTIPLE = "MULTIPLE"
STATUS_LOW_CONFIDENCE = "LOW_CONFIDENCE"
STATUS_VALID = "VALID"


# --------------------------------------------------------------------------- #
# Helper gambar
# --------------------------------------------------------------------------- #


def _px(value_mm: float, px_per_mm: float) -> int:
    return int(round(value_mm * px_per_mm))


def _dashed_rect(
    img: np.ndarray, x: int, y: int, w: int, h: int, color, thickness: int = 1, dash: int = 6
) -> None:
    """Persegi putus-putus (cv2 tidak punya ini bawaan)."""
    for start in range(0, w, dash * 2):
        end = min(start + dash, w)
        cv2.line(img, (x + start, y), (x + end, y), color, thickness)
        cv2.line(img, (x + start, y + h), (x + end, y + h), color, thickness)
    for start in range(0, h, dash * 2):
        end = min(start + dash, h)
        cv2.line(img, (x, y + start), (x, y + end), color, thickness)
        cv2.line(img, (x + w, y + start), (x + w, y + end), color, thickness)


def _dashed_circle(img: np.ndarray, cx: int, cy: int, r: int, color, thickness: int = 1) -> None:
    """Lingkaran putus-putus (dipakai untuk lingkaran bersebelahan)."""
    total = 2 * math.pi * r
    step = 2 * math.pi / max(12, int(total / 4))
    angle = 0.0
    while angle < 2 * math.pi:
        x1 = cx + r * math.cos(angle)
        y1 = cy + r * math.sin(angle)
        angle += step
        x2 = cx + r * math.cos(angle)
        y2 = cy + r * math.sin(angle)
        cv2.line(img, (int(x1), int(y1)), (int(x2), int(y2)), color, thickness)


def _fill_bubble(
    img: np.ndarray, cx: int, cy: int, r: int, ratio: float, color=(30, 30, 30)
) -> None:
    """Isi sebagian lingkaran (rasio area) — meniru arsiran pensil."""
    if ratio <= 0:
        return
    # Rasio area achieved dengan circle elips di dalam lingkaran.
    ellipse_ratio = math.sqrt(ratio)
    axes = (int(r * ellipse_ratio), int(r * math.sqrt(max(0.0, ratio))))
    cv2.ellipse(img, (cx, cy), axes, 0, 0, 360, color, -1)


# --------------------------------------------------------------------------- #
# Ground truth
# --------------------------------------------------------------------------- #


def plan_answers(pg_count: int) -> list[dict]:
    """Susun rencana jawaban siswa pada bubble PG (deterministik).

    Zona esai **tidak** memiliki tanda skoring di kertas, jadi tidak ada
    rencana yang perlu dibuat untuknya — skor esai dinilai guru di aplikasi.
    Yang perlu机器 knows hanyalah di mana area jawabannya.
    """
    mc: list[dict] = []
    for number in range(1, pg_count + 1):
        if number % 7 == 0:
            mc.append(
                {
                    "questionNumber": number,
                    "correctAnswer": "A",
                    "markedAnswer": None,
                    "status": STATUS_EMPTY,
                    "fillRatio": 0.0,
                }
            )
        elif number % 11 == 0:
            mc.append(
                {
                    "questionNumber": number,
                    "correctAnswer": "A",
                    "markedAnswer": "AC",
                    "status": STATUS_MULTIPLE,
                    "fillRatio": FILL_VALID,
                }
            )
        elif number % 13 == 0:
            mc.append(
                {
                    "questionNumber": number,
                    "correctAnswer": "A",
                    "markedAnswer": "A",
                    "status": STATUS_LOW_CONFIDENCE,
                    "fillRatio": FILL_LOW_CONFIDENCE,
                }
            )
        else:
            mc.append(
                {
                    "questionNumber": number,
                    "correctAnswer": "A",
                    "markedAnswer": "A",
                    "status": STATUS_VALID,
                    "fillRatio": FILL_VALID,
                }
            )
    return mc


# --------------------------------------------------------------------------- #
# Renderer
# --------------------------------------------------------------------------- #


def render_synthetic(
    template: dict,
    png_path: str | Path,
    truth_path: str | Path,
    px_per_mm: float = DEFAULT_PX_PER_MM,
    noise_sigma: float = 0.0,
    rotate_deg: float = 0.0,
) -> dict:
    """Gambar LJK sintetis + tulis ground truth. Kembalikan isi truth."""
    page_w = _px(template["pageWidthMm"], px_per_mm)
    page_h = _px(template["pageHeightMm"], px_per_mm)
    img = np.full((page_h, page_w, 3), 250, dtype=np.uint8)

    ink = (40, 40, 40)
    faint = (150, 150, 150)
    bubble_d = template["bubbleDiameterMm"]
    bubble_r = max(3, _px(bubble_d / 2, px_per_mm))

    # --- fiducial ---
    for f in template["fiducials"]:
        x = _px(f["xMm"], px_per_mm)
        y = _px(f["yMm"], px_per_mm)
        size = _px(f["sizeMm"], px_per_mm)
        cv2.rectangle(img, (x, y), (x + size, y + size), (0, 0, 0), -1)

    # --- judul & zona nama ---
    cv2.putText(
        img,
        "LEMBAR JAWABAN KOMPUTER",
        (_px(PAPER_TITLE_X_MM, px_per_mm), _px(PAPER_TITLE_Y_MM, px_per_mm)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        ink,
        1,
        cv2.LINE_AA,
    )
    crop = template["nameCropRectMm"]
    cx, cy = _px(crop["x"], px_per_mm), _px(crop["y"], px_per_mm)
    cw, ch = _px(crop["w"], px_per_mm), _px(crop["h"], px_per_mm)
    _dashed_rect(img, cx, cy, cw, ch, faint)
    cv2.putText(
        img, "NAMA", (cx + 6, cy + 24), cv2.FONT_HERSHEY_SIMPLEX, 0.3, faint, 1, cv2.LINE_AA
    )
    cv2.putText(
        img,
        "____________________",
        (cx + 34, cy + 26),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.4,
        faint,
        1,
        cv2.LINE_AA,
    )
    klass = CLASS_BOX_RECT_MM
    kx, ky = _px(klass["x"], px_per_mm), _px(klass["y"], px_per_mm)
    kw, kh = _px(klass["w"], px_per_mm), _px(klass["h"], px_per_mm)
    _dashed_rect(img, kx, ky, kw, kh, faint)
    cv2.putText(
        img, "KELAS", (kx + 4, ky + 11), cv2.FONT_HERSHEY_SIMPLEX, 0.3, faint, 1, cv2.LINE_AA
    )
    cv2.putText(
        img,
        "____________________",
        (kx + 34, ky + 13),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.4,
        faint,
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        img, "NO. ABSEN", (kx + 4, ky + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.3, faint, 1, cv2.LINE_AA
    )
    cv2.putText(
        img,
        "____________________",
        (kx + 34, ky + 27),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.4,
        faint,
        1,
        cv2.LINE_AA,
    )

    # --- Petunjuk pengisian (dipindah ke bawah kotak nama & kelas) ---
    guide = INSTRUCTION_BOX_RECT_MM
    gx, gy = _px(guide["x"], px_per_mm), _px(guide["y"], px_per_mm)
    gw, gh = _px(guide["w"], px_per_mm), _px(guide["h"], px_per_mm)
    _dashed_rect(img, gx, gy, gw, gh, faint)
    cv2.putText(
        img, "PETUNJUK", (gx + 6, gy + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.32, faint, 1, cv2.LINE_AA
    )
    col_w = gw / INSTRUCTION_COLUMNS
    for i, line in enumerate(INSTRUCTIONS):
        col = i % INSTRUCTION_COLUMNS
        row = i // INSTRUCTION_COLUMNS
        cv2.putText(
            img,
            f"- {line}",
            (int(gx + 6 + col * col_w), gy + 34 + row * 18),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.3,
            faint,
            1,
            cv2.LINE_AA,
        )

    # --- Pilihan Ganda ---
    cv2.putText(
        img,
        "I. PILIHAN GANDA",
        (_px(CONTENT_LEFT_MM, px_per_mm), _px(MC_SECTION_TITLE_Y_MM, px_per_mm)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.4,
        ink,
        1,
        cv2.LINE_AA,
    )
    mc_truth = plan_answers(len(template["multipleChoiceSlots"]))
    truth_by_number = {t["questionNumber"]: t for t in mc_truth}

    for slot in template["multipleChoiceSlots"]:
        number = slot["questionNumber"]
        cv2.putText(
            img,
            f"{number:02d}",
            (_px(slot["xMm"], px_per_mm), _px(slot["yMm"], px_per_mm) + 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.3,
            faint,
            1,
            cv2.LINE_AA,
        )
        plan = truth_by_number[number]
        marked = set(plan["markedAnswer"] or "")
        for opt in slot["options"]:
            ox = _px(opt["xMm"], px_per_mm)
            oy = _px(opt["yMm"], px_per_mm)
            cv2.circle(img, (ox, oy), bubble_r, ink, 1, cv2.LINE_AA)
            if opt["label"] in marked:
                _fill_bubble(img, ox, oy, bubble_r, plan["fillRatio"])

    # --- Zona esai: SATU kotak besar, tanpa nomor per soal ---
    area = template.get("essayAreaRectMm")
    if area:
        cv2.putText(
            img,
            "II. ZONA JAWABAN ESAI",
            (
                _px(CONTENT_LEFT_MM, px_per_mm),
                _px(area["y"] - ESSAY_AREA_GAP_MM, px_per_mm),
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            ink,
            1,
            cv2.LINE_AA,
        )
        ax, ay = _px(area["x"], px_per_mm), _px(area["y"], px_per_mm)
        aw, ah = _px(area["w"], px_per_mm), _px(area["h"], px_per_mm)
        _dashed_rect(img, ax, ay, aw, ah, faint)
        cv2.putText(
            img,
            "Tulis jawaban esai di area ini. Nomor soal ditulis sendiri oleh siswa.",
            (ax + 6, ay + ah - 12),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.3,
            faint,
            1,
            cv2.LINE_AA,
        )

    # --- gangguan realistis (opsional) ---
    if noise_sigma > 0:
        rng = np.random.default_rng(12345)
        noise = rng.normal(0, noise_sigma, img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    if rotate_deg:
        center = (page_w / 2, page_h / 2)
        matrix = cv2.getRotationMatrix2D(center, rotate_deg, 1.0)
        img = cv2.warpAffine(
            img, matrix, (page_w, page_h), flags=cv2.INTER_LINEAR, borderValue=(250, 250, 250)
        )

    out_png = Path(png_path)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_png), img)

    truth = {
        "examId": template["examId"],
        "templateId": template["id"],
        "image": {
            "widthPx": page_w,
            "heightPx": page_h,
            "pxPerMm": px_per_mm,
            "rotationDeg": rotate_deg,
            "noiseSigma": noise_sigma,
        },
        "mc": mc_truth,
        # Zona esai tidak bertanda di kertas — hanya satu area kosong.
        # Yang dicatat adalah posisinya: mesin harus memotong tepat di area
        # ini supaya guru bisa membaca tulisan tangan saat menilai.
        "essay": (
            {"answerRectMm": template["essayAreaRectMm"]}
            if template.get("essayAreaRectMm")
            else None
        ),
    }
    out_truth = Path(truth_path)
    out_truth.parent.mkdir(parents=True, exist_ok=True)
    out_truth.write_text(json.dumps(truth, indent=2) + "\n", encoding="utf-8")
    return truth


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m omr_engine.synth",
        description="Generate LJK sintetis + metadata koordinat + ground truth.",
    )
    parser.add_argument("--pg", type=int, default=25, help="jumlah soal Pilihan Ganda")
    parser.add_argument("--essay", type=int, default=5, help="jumlah soal esai")
    parser.add_argument("--exam-id", default="exam-1")
    parser.add_argument("--template-id", default="tpl-1")
    parser.add_argument("--out", default="out", help="folder keluaran")
    parser.add_argument("--px-per-mm", type=float, default=DEFAULT_PX_PER_MM)
    parser.add_argument("--noise", type=float, default=0.0, help="sigma derau piksel")
    parser.add_argument("--rotate", type=float, default=0.0, help="rotasi derajat")
    args = parser.parse_args(argv)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    template = build_template(
        exam_id=args.exam_id, template_id=args.template_id, pg_count=args.pg, essay_count=args.essay
    )
    layout = compute_layout(args.pg, args.essay)

    template_path = out_dir / "template.json"
    template_path.write_text(json.dumps(template, indent=2) + "\n", encoding="utf-8")

    pdf_path = render_pdf(template, out_dir / "sheet.pdf")

    truth = render_synthetic(
        template,
        out_dir / "sheet.png",
        out_dir / "truth.json",
        px_per_mm=args.px_per_mm,
        noise_sigma=args.noise,
        rotate_deg=args.rotate,
    )

    print(f"template  : {template_path}")
    print(f"pdf       : {pdf_path}")
    print(f"sheet     : {out_dir / 'sheet.png'}")
    print(f"truth     : {out_dir / 'truth.json'}")
    print(
        f"layout    : {args.pg} PG ({layout.rows_per_column} baris/kolom), "
        f"{args.essay} esai, isi sampai y={layout.content_bottom_y:.1f} mm"
    )
    essay_area = truth["essay"]["answerRectMm"] if truth["essay"] else None
    print(
        f"zona esai : "
        + (
            f"{essay_area['w']:.0f} × {essay_area['h']:.0f} mm"
            if essay_area
            else "tidak ada"
        )
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())


__all__ = [
    "DEFAULT_PX_PER_MM",
    "plan_answers",
    "render_synthetic",
]
