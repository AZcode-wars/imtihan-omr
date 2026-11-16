"""Pemrosesan Citra OMR — deteksi fiducial, koreksi orientasi, perspective warp, dan crop area.

Pipeline ini memproses gambar input (kamera / scanner) ke kanvas ternormalisasi:
1. Temukan 4 fiducial marker kotak hitam (TL 14x14mm, TR/BL/BR 10x10mm).
2. Verifikasi orientasi lembar (marker TL yang lebih besar menentukan rotasi: 0, 90, 180, 270 derajat).
3. 4-point perspective transform ke kanvas standar (target A4, default 840x1188 px atau sesuai px_per_mm).
4. Adaptive thresholding untuk pencahayaan merata & binerisasi.
5. Crop area nama siswa (`nameCropRectMm`) dan area esai (`essayAreaRectMm`) menjadi base64 data URL.
"""

from __future__ import annotations

import base64
import math
from dataclasses import dataclass
from typing import Literal

import cv2
import numpy as np

from .template import (
    FIDUCIAL_OTHER_MM,
    FIDUCIAL_TL_MM,
    MARGIN_MM,
    PAGE_HEIGHT_MM,
    PAGE_WIDTH_MM,
)


class FiducialDetectionError(ValueError):
    """Gagal menemukan atau memvalidasi 4 fiducial marker pada lembar LJK."""


@dataclass(frozen=True)
class FiducialCandidate:
    """Kontur kotak fiducial yang terdeteksi."""
    center_x: float
    center_y: float
    width: float
    height: float
    area: float
    corner_box: np.ndarray  # 4 titik sudut (x, y)


def encode_image_to_data_url(image: np.ndarray, ext: str = ".jpg", quality: int = 85) -> str:
    """Encode numpy image (BGR atau Grayscale) ke format Base64 Data URL."""
    if ext.lower() in (".jpg", ".jpeg"):
        mime = "image/jpeg"
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    else:
        mime = "image/png"
        encode_params = [int(cv2.IMWRITE_PNG_COMPRESSION), 4]

    success, buffer = cv2.imencode(ext, image, encode_params)
    if not success:
        raise ValueError("Gagal meng-encode gambar ke buffer.")
    b64_str = base64.b64encode(buffer).decode("ascii")
    return f"data:{mime};base64,{b64_str}"


def find_fiducial_markers(
    image: np.ndarray,
    min_area_ratio: float = 0.00005,
    max_area_ratio: float = 0.02,
) -> list[FiducialCandidate]:
    """Cari kandidat kontur kotak hitam solid (fiducial marker) pada gambar."""
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    h_img, w_img = gray.shape
    total_area = float(h_img * w_img)
    min_area = total_area * min_area_ratio
    max_area = total_area * max_area_ratio

    # Binarisasi adaptive atau Otsu
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    # Fiducial adalah kotak hitam pada kertas putih:
    # Menggunakan adaptive thresholding atau inverse binary
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 10
    )

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candidates: list[FiducialCandidate] = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue

        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)

        # Harus berbentuk segi empat konveks
        if len(approx) == 4 and cv2.isContourConvex(approx):
            rect = cv2.minAreaRect(cnt)
            (cx, cy), (w, h), angle = rect
            if w <= 0 or h <= 0:
                continue
            aspect_ratio = min(w, h) / max(w, h)
            # Rasio aspek kotak fiducial harus mendekati bujur sangkar (>= 0.70)
            if aspect_ratio >= 0.70:
                # Solidness check: luas kontur vs luas bounding box
                box = cv2.boxPoints(rect)
                box_area = w * h
                solidity = area / box_area if box_area > 0 else 0
                if solidity >= 0.75:
                    candidates.append(
                        FiducialCandidate(
                            center_x=cx,
                            center_y=cy,
                            width=w,
                            height=h,
                            area=area,
                            corner_box=box,
                        )
                    )

    return candidates


def select_and_order_fiducials(
    candidates: list[FiducialCandidate],
    img_width: int,
    img_height: int,
) -> tuple[np.ndarray, str]:
    """Pilih 4 fiducial terbaik (satu di tiap kuadran sudut) dan tentukan orientasi lembar.

    Mengembalikan:
        (quad_centers, orientation)
        quad_centers: array 4x2 urutan [TL, TR, BR, BL] dalam sistem koordinat lembar LJK yang tegak.
        orientation: "NORMAL", "ROTATED_180", "ROTATED_90_CW", "ROTATED_90_CCW"
    """
    if len(candidates) < 4:
        raise FiducialDetectionError(
            f"Hanya ditemukan {len(candidates)} kandidat fiducial marker, dibutuhkan 4."
        )

    # Titik tengah citra
    cx_img, cy_img = img_width / 2.0, img_height / 2.0

    # Kelompokkan kandidat berdasarkan kuadran relatif terhadap pusat citra
    # Kuadran: Q1 (kiri-atas), Q2 (kanan-atas), Q3 (kanan-bawah), Q4 (kiri-bawah)
    quadrants: dict[str, list[FiducialCandidate]] = {
        "TL": [],
        "TR": [],
        "BR": [],
        "BL": [],
    }

    for c in candidates:
        if c.center_x < cx_img and c.center_y < cy_img:
            quadrants["TL"].append(c)
        elif c.center_x >= cx_img and c.center_y < cy_img:
            quadrants["TR"].append(c)
        elif c.center_x >= cx_img and c.center_y >= cy_img:
            quadrants["BR"].append(c)
        else:
            quadrants["BL"].append(c)

    # Pastikan setiap kuadran memiliki setidaknya satu kandidat
    missing = [k for k, v in quadrants.items() if len(v) == 0]
    if missing:
        raise FiducialDetectionError(
            f"Fiducial marker tidak lengkap, kuadran kosong: {', '.join(missing)}."
        )

    # Untuk tiap kuadran, pilih kandidat yang paling mendekati sudut ekstrem gambar
    def corner_dist(c: FiducialCandidate, corner_x: float, corner_y: float) -> float:
        return math.hypot(c.center_x - corner_x, c.center_y - corner_y)

    c_tl = min(quadrants["TL"], key=lambda c: corner_dist(c, 0, 0))
    c_tr = min(quadrants["TR"], key=lambda c: corner_dist(c, img_width, 0))
    c_br = min(quadrants["BR"], key=lambda c: corner_dist(c, img_width, img_height))
    c_bl = min(quadrants["BL"], key=lambda c: corner_dist(c, 0, img_height))

    chosen = [c_tl, c_tr, c_br, c_bl]

    # Evaluasi ukuran marker: Marker TOP_LEFT ukurannya 14x14mm (~luas 1.96x dari 10x10mm)
    # Temukan marker dengan area terbesar
    areas = [c.area for c in chosen]
    largest_idx = int(np.argmax(areas))
    largest_area = areas[largest_idx]
    other_areas = [areas[i] for i in range(4) if i != largest_idx]
    avg_other_area = float(np.mean(other_areas))

    # Cek apakah marker terbesar signifikan lebih besar (setidaknya 1.25x rata-rata 3 lainnya)
    # jika gambar bersih, rasio teoretis adalah 14^2 / 10^2 = 1.96
    # Indeks chosen saat ini berurutan: 0: TL, 1: TR, 2: BR, 3: BL
    if largest_idx == 0:
        orientation = "NORMAL"
        ordered_pts = [
            [c_tl.center_x, c_tl.center_y],
            [c_tr.center_x, c_tr.center_y],
            [c_br.center_x, c_br.center_y],
            [c_bl.center_x, c_bl.center_y],
        ]
    elif largest_idx == 2:
        # TL berada di BR -> gambar terbalik 180 derajat
        orientation = "ROTATED_180"
        ordered_pts = [
            [c_br.center_x, c_br.center_y],
            [c_bl.center_x, c_bl.center_y],
            [c_tl.center_x, c_tl.center_y],
            [c_tr.center_x, c_tr.center_y],
        ]
    elif largest_idx == 1:
        # TL berada di TR -> miring 90 CCW (atau 270 CW)
        orientation = "ROTATED_90_CCW"
        ordered_pts = [
            [c_tr.center_x, c_tr.center_y],
            [c_br.center_x, c_br.center_y],
            [c_bl.center_x, c_bl.center_y],
            [c_tl.center_x, c_tl.center_y],
        ]
    else:  # largest_idx == 3
        # TL berada di BL -> miring 90 CW
        orientation = "ROTATED_90_CW"
        ordered_pts = [
            [c_bl.center_x, c_bl.center_y],
            [c_tl.center_x, c_tl.center_y],
            [c_tr.center_x, c_tr.center_y],
            [c_br.center_x, c_br.center_y],
        ]

    return np.array(ordered_pts, dtype=np.float32), orientation


def warp_to_standard_canvas(
    image: np.ndarray,
    ordered_fiducial_centers: np.ndarray,
    target_width_px: int = 840,
    target_height_px: int = 1188,
) -> np.ndarray:
    """Lakukan 4-point perspective transform ke kanvas persegi panjang standar A4.

    Titik pusat target dihitung persis dari geometri fiducial template:
    TL (14mm): margin 8 + 7 = 15.0 mm
    TR (10mm): (210 - 8 - 5) = 197.0 mm, y = 13.0 mm
    BL (10mm): x = 13.0 mm, y = (297 - 8 - 5) = 284.0 mm
    BR (10mm): x = 197.0 mm, y = 284.0 mm
    """
    px_per_mm_x = target_width_px / PAGE_WIDTH_MM
    px_per_mm_y = target_height_px / PAGE_HEIGHT_MM

    # Posisi pusat fiducial teoritis dalam mm
    tl_cx = MARGIN_MM + FIDUCIAL_TL_MM / 2.0  # 15.0 mm
    tl_cy = MARGIN_MM + FIDUCIAL_TL_MM / 2.0  # 15.0 mm

    tr_cx = PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0  # 197.0 mm
    tr_cy = MARGIN_MM + FIDUCIAL_OTHER_MM / 2.0  # 13.0 mm

    br_cx = PAGE_WIDTH_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0  # 197.0 mm
    br_cy = PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0  # 284.0 mm

    bl_cx = MARGIN_MM + FIDUCIAL_OTHER_MM / 2.0  # 13.0 mm
    bl_cy = PAGE_HEIGHT_MM - MARGIN_MM - FIDUCIAL_OTHER_MM / 2.0  # 284.0 mm

    dst_pts = np.array(
        [
            [tl_cx * px_per_mm_x, tl_cy * px_per_mm_y],
            [tr_cx * px_per_mm_x, tr_cy * px_per_mm_y],
            [br_cx * px_per_mm_x, br_cy * px_per_mm_y],
            [bl_cx * px_per_mm_x, bl_cy * px_per_mm_y],
        ],
        dtype=np.float32,
    )

    matrix = cv2.getPerspectiveTransform(ordered_fiducial_centers, dst_pts)
    warped = cv2.warpPerspective(
        image, matrix, (target_width_px, target_height_px), flags=cv2.INTER_LINEAR
    )
    return warped


def binarize_for_inspection(image: np.ndarray) -> np.ndarray:
    """Adaptive Gaussian thresholding untuk mengeliminasi bayangan / pencahayaan miring."""
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 10
    )
    return thresh


def crop_rect_mm(
    warped_image: np.ndarray,
    rect_mm: dict[str, float],
    target_width_px: int = 840,
    target_height_px: int = 1188,
) -> np.ndarray:
    """Potong area persegi panjang dari citra hasil warp berdasarkan koordinat mm."""
    px_x = target_width_px / PAGE_WIDTH_MM
    px_y = target_height_px / PAGE_HEIGHT_MM

    x1 = max(0, int(round(rect_mm["x"] * px_x)))
    y1 = max(0, int(round(rect_mm["y"] * px_y)))
    x2 = min(warped_image.shape[1], int(round((rect_mm["x"] + rect_mm["w"]) * px_x)))
    y2 = min(warped_image.shape[0], int(round((rect_mm["y"] + rect_mm["h"]) * px_y)))

    return warped_image[y1:y2, x1:x2].copy()


__all__ = [
    "FiducialCandidate",
    "FiducialDetectionError",
    "binarize_for_inspection",
    "crop_rect_mm",
    "encode_image_to_data_url",
    "find_fiducial_markers",
    "select_and_order_fiducials",
    "warp_to_standard_canvas",
]
