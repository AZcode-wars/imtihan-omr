"""Pengujian grade.py — penilaian lembar LJK, deteksi status, dan ground truth."""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
import pytest
from openomr_schemas import OMRScanResponse

from omr_engine.grade import (
    calculate_bubble_fill_ratio,
    classify_mc_slot,
    grade_sheet_image,
)
from omr_engine.synth import render_synthetic
from omr_engine.template import build_template


@pytest.fixture()
def synth_sheet(tmp_path: Path) -> tuple[np.ndarray, dict, dict]:
    template = build_template(pg_count=30, essay_count=5)
    png_path = tmp_path / "sheet.png"
    truth_path = tmp_path / "truth.json"
    truth = render_synthetic(template, png_path, truth_path, px_per_mm=4.0)
    img = cv2.imread(str(png_path))
    assert img is not None
    return img, template, truth


def test_classify_mc_slot_empty() -> None:
    ratios = {"A": 0.05, "B": 0.02, "C": 0.04, "D": 0.03}
    detected = classify_mc_slot(ratios, 1)
    assert detected.status == "EMPTY"
    assert detected.selected_option is None


def test_classify_mc_slot_valid() -> None:
    ratios = {"A": 0.55, "B": 0.05, "C": 0.04, "D": 0.02}
    detected = classify_mc_slot(ratios, 2)
    assert detected.status == "VALID"
    assert detected.selected_option == "A"
    assert detected.confidence > 0.70


def test_classify_mc_slot_multiple() -> None:
    ratios = {"A": 0.55, "B": 0.02, "C": 0.52, "D": 0.03}
    detected = classify_mc_slot(ratios, 3)
    assert detected.status == "MULTIPLE"
    assert detected.selected_option is None
    assert set(detected.raw_candidates or []) == {"A", "C"}


def test_classify_mc_slot_low_confidence() -> None:
    ratios = {"A": 0.28, "B": 0.04, "C": 0.02, "D": 0.03}
    detected = classify_mc_slot(ratios, 4)
    assert detected.status == "LOW_CONFIDENCE"
    assert detected.selected_option == "A"
    assert detected.confidence < 0.70


def test_grade_sheet_image_on_clean_synth(synth_sheet: tuple[np.ndarray, dict, dict]) -> None:
    img, template, truth = synth_sheet
    response = grade_sheet_image(img, template)

    assert isinstance(response, OMRScanResponse)
    assert len(response.mc_answers) == 30
    assert response.student_name_crop_url.startswith("data:image/jpeg;base64,")
    assert response.essay_area_crop_url is not None
    assert response.essay_area_crop_url.startswith("data:image/jpeg;base64,")

    # Bandingkan jawaban dengan ground truth
    truth_by_num = {t["questionNumber"]: t for t in truth["mc"]}
    matches = 0
    for ans in response.mc_answers:
        expected = truth_by_num[ans.question_number]
        assert ans.status == expected["status"], (
            f"Soal #{ans.question_number} beda status: terdeteksi {ans.status}, "
            f"diharapkan {expected['status']}"
        )
        if ans.status in ("VALID", "LOW_CONFIDENCE"):
            assert ans.selected_option == expected["markedAnswer"]
        matches += 1

    assert matches == 30


def test_grade_sheet_image_rotated_180(synth_sheet: tuple[np.ndarray, dict, dict]) -> None:
    img, template, truth = synth_sheet
    rotated = cv2.rotate(img, cv2.ROTATE_180)
    response = grade_sheet_image(rotated, template)

    assert len(response.mc_answers) == 30
    # Verifikasi status tetap 100% akurat meski dirotasi 180 derajat
    truth_by_num = {t["questionNumber"]: t for t in truth["mc"]}
    for ans in response.mc_answers:
        expected = truth_by_num[ans.question_number]
        assert ans.status == expected["status"]
