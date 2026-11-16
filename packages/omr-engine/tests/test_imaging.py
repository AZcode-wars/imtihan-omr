"""Pengujian imaging.py — deteksi fiducial, orientasi lembar, dan perspective warp."""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from omr_engine.imaging import (
    FiducialDetectionError,
    binarize_for_inspection,
    crop_rect_mm,
    encode_image_to_data_url,
    find_fiducial_markers,
    select_and_order_fiducials,
    warp_to_standard_canvas,
)
from omr_engine.synth import render_synthetic
from omr_engine.template import build_template


@pytest.fixture()
def clean_sheet_image(tmp_path) -> np.ndarray:
    template = build_template(pg_count=30, essay_count=5)
    png_path = tmp_path / "clean_sheet.png"
    truth_path = tmp_path / "truth.json"
    render_synthetic(template, png_path, truth_path, px_per_mm=4.0)
    img = cv2.imread(str(png_path))
    assert img is not None
    return img


def test_find_fiducial_markers_finds_at_least_four(clean_sheet_image: np.ndarray) -> None:
    candidates = find_fiducial_markers(clean_sheet_image)
    assert len(candidates) >= 4


def test_select_and_order_fiducials_normal(clean_sheet_image: np.ndarray) -> None:
    h, w = clean_sheet_image.shape[:2]
    candidates = find_fiducial_markers(clean_sheet_image)
    ordered, orientation = select_and_order_fiducials(candidates, w, h)
    assert orientation == "NORMAL"
    assert ordered.shape == (4, 2)


def test_select_and_order_fiducials_rotated_180(clean_sheet_image: np.ndarray) -> None:
    h, w = clean_sheet_image.shape[:2]
    rotated = cv2.rotate(clean_sheet_image, cv2.ROTATE_180)
    candidates = find_fiducial_markers(rotated)
    ordered, orientation = select_and_order_fiducials(candidates, w, h)
    assert orientation == "ROTATED_180"


def test_warp_to_standard_canvas(clean_sheet_image: np.ndarray) -> None:
    h, w = clean_sheet_image.shape[:2]
    candidates = find_fiducial_markers(clean_sheet_image)
    ordered, _ = select_and_order_fiducials(candidates, w, h)
    warped = warp_to_standard_canvas(clean_sheet_image, ordered, target_width_px=840, target_height_px=1188)
    assert warped.shape == (1188, 840, 3)


def test_binarize_for_inspection(clean_sheet_image: np.ndarray) -> None:
    binary = binarize_for_inspection(clean_sheet_image)
    assert binary.shape == clean_sheet_image.shape[:2]
    assert set(np.unique(binary)).issubset({0, 255})


def test_crop_rect_mm(clean_sheet_image: np.ndarray) -> None:
    rect = {"x": 14.0, "y": 30.0, "w": 90.0, "h": 12.0}
    crop = crop_rect_mm(clean_sheet_image, rect, 840, 1188)
    assert crop.shape[0] > 0
    assert crop.shape[1] > 0


def test_encode_image_to_data_url(clean_sheet_image: np.ndarray) -> None:
    data_url = encode_image_to_data_url(clean_sheet_image)
    assert data_url.startswith("data:image/jpeg;base64,")
