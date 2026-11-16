"""Pengujian HTTP API FastAPI omr_engine.api."""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from omr_engine.api import app
from omr_engine.imaging import encode_image_to_data_url
from omr_engine.synth import render_synthetic
from omr_engine.template import build_template

client = TestClient(app)


@pytest.fixture()
def synth_sheet(tmp_path: Path) -> tuple[Path, dict, dict]:
    template = build_template(pg_count=30, essay_count=5)
    png_path = tmp_path / "sheet.png"
    truth_path = tmp_path / "truth.json"
    truth = render_synthetic(template, png_path, truth_path, px_per_mm=4.0)
    return png_path, template, truth


def test_get_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert data["engine"] == "openomr-engine"


def test_create_template_success() -> None:
    payload = {
        "examId": "exam-midterm",
        "templateId": "tpl-midterm-30",
        "pgCount": 30,
        "essayCount": 5,
    }
    res = client.post("/v1/templates", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "tpl-midterm-30"
    assert data["examId"] == "exam-midterm"
    assert len(data["multipleChoiceSlots"]) == 30
    assert data["columnCount"] == 3
    assert data["essayAreaRectMm"] is not None


def test_create_template_overflow() -> None:
    payload = {
        "examId": "exam-fail",
        "templateId": "tpl-fail",
        "pgCount": 80,
        "essayCount": 5,
    }
    res = client.post("/v1/templates", json=payload)
    assert res.status_code == 422
    assert "tidak muat" in res.json()["detail"]


def test_scan_multipart_success(synth_sheet: tuple[Path, dict, dict]) -> None:
    png_path, template, truth = synth_sheet
    with open(png_path, "rb") as f:
        files = {"file": ("sheet.png", f, "image/png")}
        data = {
            "template": json.dumps(template),
            "sourceDevice": "DESKTOP_SCANNER",
        }
        res = client.post("/v1/scan", data=data, files=files)

    assert res.status_code == 200
    res_data = res.json()
    assert "scanId" in res_data
    assert res_data["sourceDevice"] == "DESKTOP_SCANNER"
    assert len(res_data["mcAnswers"]) == 30
    assert res_data["studentNameCropUrl"].startswith("data:image/jpeg;base64,")
    assert res_data["essayAreaCropUrl"].startswith("data:image/jpeg;base64,")


def test_scan_json_success(synth_sheet: tuple[Path, dict, dict]) -> None:
    png_path, template, truth = synth_sheet
    img = cv2.imread(str(png_path))
    data_url = encode_image_to_data_url(img)

    payload = {
        "template": template,
        "imageDataUrl": data_url,
        "sourceDevice": "MOBILE_CAMERA",
    }
    res = client.post("/v1/scan/json", json=payload)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["sourceDevice"] == "MOBILE_CAMERA"
    assert len(res_data["mcAnswers"]) == 30


def test_scan_invalid_template(synth_sheet: tuple[Path, dict, dict]) -> None:
    png_path, _, _ = synth_sheet
    with open(png_path, "rb") as f:
        files = {"file": ("sheet.png", f, "image/png")}
        data = {"template": "invalid-json"}
        res = client.post("/v1/scan", data=data, files=files)
    assert res.status_code == 400


def test_scan_missing_fiducials(tmp_path: Path) -> None:
    # Buat gambar putih tajam dengan teks/garis tapi tanpa 4 fiducial
    blank = np.full((1188, 840, 3), 255, dtype=np.uint8)
    cv2.putText(blank, "TEKS UJIAN COBA", (100, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 3)
    cv2.line(blank, (50, 300), (750, 300), (0, 0, 0), 2)
    blank_path = tmp_path / "blank.png"
    cv2.imwrite(str(blank_path), blank)
    template = build_template(pg_count=30, essay_count=5)

    with open(blank_path, "rb") as f:
        files = {"file": ("blank.png", f, "image/png")}
        data = {"template": json.dumps(template)}
        res = client.post("/v1/scan", data=data, files=files)

    assert res.status_code == 422
    assert "Fiducial" in res.json()["detail"] or "lembar LJK" in res.json()["detail"]


def test_scan_blurry_image(tmp_path: Path) -> None:
    # Citra seragam abu-abu memiliki Laplacian variance = 0 (buram)
    blurry = np.full((1188, 840, 3), 128, dtype=np.uint8)
    # Tambahkan sedikit rectangle hitam agar bukan solid mutlak namun tetap sangat buram
    cv2.rectangle(blurry, (10, 10), (100, 100), (0, 0, 0), -1)
    blurry_blurred = cv2.GaussianBlur(blurry, (81, 81), 0)
    blurry_path = tmp_path / "blurry.png"
    cv2.imwrite(str(blurry_path), blurry_blurred)
    template = build_template(pg_count=30, essay_count=5)

    with open(blurry_path, "rb") as f:
        files = {"file": ("blurry.png", f, "image/png")}
        data = {"template": json.dumps(template)}
        res = client.post("/v1/scan", data=data, files=files)

    assert res.status_code == 422
    assert "buram" in res.json()["detail"]
