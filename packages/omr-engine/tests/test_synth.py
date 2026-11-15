"""Uji generator PDF & LJK sintetis.

Tujuannya: memastikan PDF dan LJK sintetis benar-benar berasal dari
koordinat template yang sama — sehingga ground truth untuk engine valid.
"""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
import pytest
from jsonschema import Draft202012Validator
from openomr_schemas import load_exam_template_schema

from omr_engine.pdf import MM_TO_PT, render_pdf
from omr_engine.synth import plan_answers, render_synthetic
from omr_engine.template import build_template


# --------------------------------------------------------------------------- #
# PDF
# --------------------------------------------------------------------------- #


def test_pdf_terbuat_dan_valid(tmp_path: Path) -> None:
    template = build_template(pg_count=25, essay_count=5)
    out = render_pdf(template, tmp_path / "ljk.pdf")
    assert out.exists()
    assert out.stat().st_size > 1000
    assert out.read_bytes()[:5] == b"%PDF-"


def test_pdf_satu_halaman(tmp_path: Path) -> None:
    template = build_template(pg_count=25, essay_count=5)
    out = render_pdf(template, tmp_path / "ljk.pdf")
    data = out.read_bytes()
    assert data.count(b"/Type /Page\n") + data.count(b"/Type /Page ") == 1


def test_konversi_milimeter_ke_point_benar() -> None:
    # 1 mm = 72/25,4 pt
    assert abs(MM_TO_PT - 2.834645669) < 1e-9


# --------------------------------------------------------------------------- #
# LJK sintetis
# --------------------------------------------------------------------------- #


def test_png_terbuat_dengan_ukuran_benar(tmp_path: Path) -> None:
    template = build_template(pg_count=25, essay_count=5)
    render_synthetic(template, tmp_path / "sheet.png", tmp_path / "truth.json")
    img = cv2.imread(str(tmp_path / "sheet.png"))
    assert img is not None
    assert img.shape[0] == 1188  # 297 mm x 4 px/mm
    assert img.shape[1] == 840  # 210 mm x 4 px/mm


def test_truth_json_tertulis_dan_konsisten(tmp_path: Path) -> None:
    template = build_template(pg_count=25, essay_count=5)
    truth = render_synthetic(template, tmp_path / "sheet.png", tmp_path / "truth.json")
    on_disk = json.loads((tmp_path / "truth.json").read_text(encoding="utf-8"))
    assert on_disk == truth
    assert len(truth["mc"]) == 25
    assert len(truth["essay"]) == 5


def test_distribusi_status_ground_truth() -> None:
    mc, essay = plan_answers(25, 5)
    statuses = [m["status"] for m in mc]
    assert statuses.count("EMPTY") == 3  # kelipatan 7 → 7, 14, 21
    assert statuses.count("MULTIPLE") == 2  # kelipatan 11 → 11, 22
    assert statuses.count("LOW_CONFIDENCE") == 1  # kelipatan 13 → 13
    assert statuses.count("VALID") == 19
    assert len(essay) == 5


def test_goreng_setiap_bubble_terisi_pada_lokasi_template(tmp_path: Path) -> None:
    """Bubble yang ditandai harus benar-benar berisi tinta di gambar."""
    template = build_template(pg_count=25, essay_count=5)
    truth = render_synthetic(template, tmp_path / "sheet.png", tmp_path / "truth.json")
    img = cv2.imread(str(tmp_path / "sheet.png"))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    px_per_mm = truth["image"]["pxPerMm"]

    truth_by_number = {t["questionNumber"]: t for t in truth["mc"]}
    checked = 0
    for slot in template["multipleChoiceSlots"]:
        plan = truth_by_number[slot["questionNumber"]]
        marked = set(plan["markedAnswer"] or "")
        for opt in slot["options"]:
            cx = int(round(opt["xMm"] * px_per_mm))
            cy = int(round(opt["yMm"] * px_per_mm))
            # 取 pusat lingkaran: dark bila terisi
            patch = gray[cy - 2 : cy + 3, cx - 2 : cx + 3]
            darkness = 255 - float(patch.mean())
            if opt["label"] in marked:
                assert darkness > 40, f"bubble {opt['label']} No.{slot['questionNumber']} kosong"
            checked += 1
    assert checked == 25 * 4


def test_template_dan_gambar_memakai_koordinat_yang_sama(tmp_path: Path) -> None:
    """Titik tengah fiducial di gambar harus cocok dengan koordinat template."""
    template = build_template(pg_count=25, essay_count=5)
    truth = render_synthetic(template, tmp_path / "sheet.png", tmp_path / "truth.json")
    img = cv2.imread(str(tmp_path / "sheet.png"))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    px_per_mm = truth["image"]["pxPerMm"]

    tl = next(f for f in template["fiducials"] if f["corner"] == "TOP_LEFT")
    cx = int(round((tl["xMm"] + tl["sizeMm"] / 2) * px_per_mm))
    cy = int(round((tl["yMm"] + tl["sizeMm"] / 2) * px_per_mm))
    patch = gray[cy - 3 : cy + 4, cx - 3 : cx + 4]
    assert patch.mean() < 60, "fiducial kiri-atas harus pekat di gambar"


def test_gangguan_tidak_mengubah_ground_truth(tmp_path: Path) -> None:
    """Derau dan rotasi boleh mengubah gambar, tapi jawaban tetap sama."""
    template = build_template(pg_count=25, essay_count=5)
    clean = render_synthetic(template, tmp_path / "a.png", tmp_path / "a.json")
    noisy = render_synthetic(
        template,
        tmp_path / "b.png",
        tmp_path / "b.json",
        noise_sigma=6.0,
        rotate_deg=1.5,
    )
    assert clean["mc"] == noisy["mc"]
    assert clean["essay"] == noisy["essay"]


def test_template_dari_cli_valid_terhadap_kontrak(tmp_path: Path) -> None:
    """Hasil CLI harus lolos JSON Schema kontrak tunggal."""
    from omr_engine.synth import main

    exit_code = main(
        ["--pg", "25", "--essay", "5", "--out", str(tmp_path)]
    )
    assert exit_code == 0
    template = json.loads((tmp_path / "template.json").read_text(encoding="utf-8"))
    Draft202012Validator(load_exam_template_schema()).validate(template)
    assert (tmp_path / "sheet.png").exists()
    assert (tmp_path / "truth.json").exists()


def test_gambar_adalah_hampir_putih_dengan_ink_hitam(tmp_path: Path) -> None:
    """Pemeriksaan cepat bahwa tidak ada kanvas kosong / seluruh hitam."""
    template = build_template(pg_count=25, essay_count=5)
    render_synthetic(template, tmp_path / "sheet.png", tmp_path / "truth.json")
    img = cv2.imread(str(tmp_path / "sheet.png"))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    assert gray.mean() > 200
    assert (gray < 100).sum() > 500  # ada tinta yang signifikan
    assert np.unique(gray).size > 3
