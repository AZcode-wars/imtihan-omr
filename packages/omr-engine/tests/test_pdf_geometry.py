"""Uji bahwa PDF benar-benar digambar dari koordinat template.

PDF ditulis tanpa kompresi (``pageCompression=0``) supaya isi stream-nya bisa
diparsing dan dibandingkan dengan ``ExamTemplate``. Inilah pembuktian bahwa
"yang dicetak = yang dideteksi".
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from omr_engine.pdf import MM_TO_PT, render_pdf
from omr_engine.template import build_template

RECT_RE = re.compile(rb"([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+re")


def content_stream(pdf_path: Path) -> bytes:
    return pdf_path.read_bytes()


def rects(pdf_path: Path) -> list[tuple[float, float, float, float]]:
    found = []
    for m in RECT_RE.finditer(content_stream(pdf_path)):
        found.append(tuple(float(g) for g in m.groups()))  # type: ignore[arg-type]
    return found


def approx(a: float, b: float, tol: float = 0.05) -> bool:
    return abs(a - b) <= tol


@pytest.fixture()
def pdf(tmp_path: Path) -> tuple[Path, dict]:
    template = build_template(pg_count=25, essay_count=5)
    path = render_pdf(template, tmp_path / "sheet.pdf")
    return path, template


def test_pdf_memuat_konten_tanpa_kompresi(pdf: tuple[Path, dict]) -> None:
    path, _ = pdf
    data = path.read_bytes()
    assert b"/FlateDecode" not in data, "PDF harus uncompressed agar bisa diverifikasi"
    assert b" re" in data
    assert b" c" in data


def test_empat_fiducial_tergambar_dengan_ukuran_benar(pdf: tuple[Path, dict]) -> None:
    """PRD FR-1.3: kiri-atas 14 mm, tiga sudut lain 10 mm."""
    path, template = pdf
    sizes = sorted(round(w / MM_TO_PT, 3) for _, _, w, _ in rects(path))
    # 4 fiducial + 2 kotak garis putus (nama & kelas) + 5 kotak jawaban esai
    assert sizes.count(14.0) == 1, "harus ada tepat satu fiducial 14 mm"
    assert sizes.count(10.0) == 3, "harus ada tiga fiducial 10 mm"
    assert sizes.count(96.0) == 5, "harus ada lima kotak jawaban esai"


def test_kotak_jawaban_esai_di_posisi_yang_benar(pdf: tuple[Path, dict]) -> None:
    """Kotak jawaban esai harus berada tepat di studentAnswerRectMm template."""
    path, template = pdf
    page_h_pt = template["pageHeightMm"] * MM_TO_PT
    expected = set()
    for slot in template["essaySlots"]:
        rect = slot["studentAnswerRectMm"]
        x = rect["x"] * MM_TO_PT
        y = page_h_pt - (rect["y"] + rect["h"]) * MM_TO_PT
        expected.add((round(x, 2), round(y, 2)))
    drawn = {(round(x, 2), round(y, 2)) for x, y, w, h in rects(path) if approx(w / MM_TO_PT, 96.0, 0.1)}
    assert expected.issubset(drawn), "kotak jawaban esai di PDF tidak cocok dengan template"


def test_fiducial_kiri_atas_di_poin_atas_kiri(pdf: tuple[Path, dict]) -> None:
    path, template = pdf
    page_h_pt = template["pageHeightMm"] * MM_TO_PT
    tl = next(f for f in template["fiducials"] if f["corner"] == "TOP_LEFT")
    want_x = tl["xMm"] * MM_TO_PT
    want_y = page_h_pt - (tl["yMm"] + tl["sizeMm"]) * MM_TO_PT
    want_size = tl["sizeMm"] * MM_TO_PT
    matches = [
        (x, y, w, h)
        for x, y, w, h in rects(path)
        if approx(w, want_size) and approx(h, want_size) and approx(x, want_x)
    ]
    assert matches, "fiducial kiri-atas tidak digambar di posisi template"
    assert approx(matches[0][1], want_y)


def test_jumlah_lingkaran_sesuai_jumlah_bubble(pdf: tuple[Path, dict]) -> None:
    """Setiap lingkaran digambar dengan 4 operator bezier."""
    path, template = pdf
    data = path.read_bytes()
    curves = len(re.findall(rb"\s[c]\s", data))
    bubble_count = len(template["multipleChoiceSlots"]) * 4 + len(template["essaySlots"]) * 6
    assert curves >= bubble_count * 4, (
        f"hanya {curves} kurva untuk {bubble_count} lingkaran"
    )
