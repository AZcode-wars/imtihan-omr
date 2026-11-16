"""Engine Pembacaan & Penilaian Lembar Jawaban Komputer (LJK).

Modul ini bertanggung jawab untuk:
1. Membaca fill ratio setiap bubble PG menggunakan circular mask.
2. Mengklasifikasikan status jawaban: VALID, EMPTY, MULTIPLE, LOW_CONFIDENCE.
3. Menghitung nilai confidence secara objektif (0.0 - 1.0).
4. Menghasilkan potongan nama siswa dan potongan area esai.
5. Membentuk payload `OMRScanResponse` lengkap yang siap dikonsumsi Frontend/API.
"""

from __future__ import annotations

import datetime
import math
import uuid
from typing import Any

import cv2
import numpy as np
from openomr_schemas import (
    BubbleReadStatus,
    DetectedMCAnswer,
    OMRScanResponse,
    OptionLabel,
)

from .imaging import (
    binarize_for_inspection,
    crop_rect_mm,
    encode_image_to_data_url,
    find_fiducial_markers,
    select_and_order_fiducials,
    warp_to_standard_canvas,
)
from .template import (
    PAGE_HEIGHT_MM,
    PAGE_WIDTH_MM,
)

# --------------------------------------------------------------------------- #
# Ambang batas rasio isi (Fill Ratio Thresholds)
# --------------------------------------------------------------------------- #
# Lingkaran kosong (hanya garis tepi cetak): rasio piksel hitam biasanya ~0.08 - 0.16
# Arsiran pensil tipis / ragu (LOW_CONFIDENCE): ~0.22 - 0.38
# Arsiran pensil valid (tebal): >= 0.40
EMPTY_THRESHOLD = 0.18
LOW_CONF_THRESHOLD = 0.38
FILLED_THRESHOLD = 0.45


def calculate_bubble_fill_ratio(
    binary_img: np.ndarray,
    cx_px: int,
    cy_px: int,
    radius_px: int,
) -> float:
    """Hitung rasio piksel terisi (putih di binary inv) di dalam circular mask."""
    h_img, w_img = binary_img.shape
    # Margin boundary check
    x1 = max(0, cx_px - radius_px)
    y1 = max(0, cy_px - radius_px)
    x2 = min(w_img, cx_px + radius_px + 1)
    y2 = min(h_img, cy_px + radius_px + 1)

    roi = binary_img[y1:y2, x1:x2]
    if roi.size == 0:
        return 0.0

    # Buat circular mask lokal
    mask = np.zeros(roi.shape, dtype=np.uint8)
    roi_cx = cx_px - x1
    roi_cy = cy_px - y1
    # Gunakan 90% radius agar garis tepi bubble cetak tidak mendominasi hitungan
    inner_r = max(1, int(round(radius_px * 0.90)))
    cv2.circle(mask, (roi_cx, roi_cy), inner_r, 255, -1)

    total_mask_pixels = cv2.countNonZero(mask)
    if total_mask_pixels == 0:
        return 0.0

    filled_pixels = cv2.countNonZero(cv2.bitwise_and(roi, roi, mask=mask))
    return float(filled_pixels) / float(total_mask_pixels)


def classify_mc_slot(
    option_fill_ratios: dict[OptionLabel, float],
    question_number: int,
) -> DetectedMCAnswer:
    """Klasifikasi jawaban satu nomor PG berdasarkan fill ratio masing-masing opsi.

    Menggunakan kombinasi relative contrast (margin terhadap opsi lain dalam baris)
    dan absolute thresholding agar tahan terhadap variasi pencahayaan kamera dan noise cetak.
    """
    if not option_fill_ratios:
        return DetectedMCAnswer(
            questionNumber=question_number,
            selectedOption=None,
            status="EMPTY",
            confidence=1.0,
            rawCandidates=None,
        )

    # Urutkan berdasarkan rasio tertinggi menurun
    sorted_opts = sorted(option_fill_ratios.items(), key=lambda x: x[1], reverse=True)
    top_opt, top_val = sorted_opts[0]
    runner_opt, runner_val = sorted_opts[1] if len(sorted_opts) > 1 else (top_opt, 0.0)
    min_val = sorted_opts[-1][1]

    margin = top_val - runner_val
    spread = top_val - min_val

    # Kasus 1: Baris Kosong (EMPTY)
    # Berlaku jika nilai tertinggi di bawah batas kosong minimal ATAU
    # seluruh opsi nilainya seragam (spread kecil = noise cetak/bayangan merata pada kertas)
    if top_val < EMPTY_THRESHOLD or (spread < 0.12 and top_val < 0.38):
        conf = max(0.0, min(1.0, 1.0 - (top_val / 0.30)))
        return DetectedMCAnswer(
            questionNumber=question_number,
            selectedOption=None,
            status="EMPTY",
            confidence=round(conf, 3),
            rawCandidates=None,
        )

    # Kasus 2: Jawaban Ganda (MULTIPLE)
    # Ada dua atau lebih opsi yang sama-sama diarsir tebal dan selisihnya tipis
    if runner_val >= 0.38 and margin < 0.12:
        conf = round(min(1.0, runner_val / top_val), 3)
        significant_cands = [
            opt for opt, val in sorted_opts if val >= 0.38 or (top_val - val) < 0.12
        ]
        return DetectedMCAnswer(
            questionNumber=question_number,
            selectedOption=None,
            status="MULTIPLE",
            confidence=conf,
            rawCandidates=significant_cands,
        )

    # Kasus 3: Jawaban Solid & Mantap (VALID)
    # Opsi teratas tebal (>= 0.48) dan memiliki margin kontras yang jelas terhadap opsi lain
    if top_val >= 0.48 and margin >= 0.15:
        conf = round(min(1.0, 0.70 + 0.30 * (margin / top_val)), 3)
        return DetectedMCAnswer(
            questionNumber=question_number,
            selectedOption=top_opt,
            status="VALID",
            confidence=conf,
            rawCandidates=[top_opt],
        )

    # Kasus 4: Arsiran Ragu / Tipis / Ada Bekas Penghapusan (LOW_CONFIDENCE)
    conf = round(max(0.30, min(0.69, top_val / FILLED_THRESHOLD)), 3)
    return DetectedMCAnswer(
        questionNumber=question_number,
        selectedOption=top_opt,
        status="LOW_CONFIDENCE",
        confidence=conf,
        rawCandidates=[top_opt],
    )


def grade_sheet_image(
    image: np.ndarray,
    template: dict[str, Any],
    source_device: str = "MOBILE_CAMERA",
    target_width_px: int = 840,
    target_height_px: int = 1188,
) -> OMRScanResponse:
    """Pipeline penuh OMR:
    1. Deteksi fiducial & orientasi.
    2. Warp ke kanvas standar.
    3. Binarisasi adaptive.
    4. Evaluasi PG & Crop Nama / Esai.
    """
    # 1 & 2: Transformasi perspektif
    candidates = find_fiducial_markers(image)
    h_img, w_img = image.shape[:2]
    ordered_centers, orientation = select_and_order_fiducials(candidates, w_img, h_img)
    warped = warp_to_standard_canvas(
        image, ordered_centers, target_width_px=target_width_px, target_height_px=target_height_px
    )

    # 3: Binarisasi
    binary_img = binarize_for_inspection(warped)

    # 4: Klasifikasi bubble PG
    px_x = target_width_px / PAGE_WIDTH_MM
    px_y = target_height_px / PAGE_HEIGHT_MM
    radius_px = int(round((template["bubbleDiameterMm"] / 2.0) * px_x))

    mc_answers: list[DetectedMCAnswer] = []
    for slot in template["multipleChoiceSlots"]:
        q_num = slot["questionNumber"]
        opt_ratios: dict[OptionLabel, float] = {}
        for opt in slot["options"]:
            label = opt["label"]
            cx = int(round(opt["xMm"] * px_x))
            cy = int(round(opt["yMm"] * px_y))
            ratio = calculate_bubble_fill_ratio(binary_img, cx, cy, radius_px)
            opt_ratios[label] = ratio

        detected = classify_mc_slot(opt_ratios, q_num)
        mc_answers.append(detected)

    # 5: Crop Potongan Nama & Esai
    name_crop = crop_rect_mm(
        warped, template["nameCropRectMm"], target_width_px, target_height_px
    )
    name_crop_url = encode_image_to_data_url(name_crop, ext=".jpg", quality=90)

    essay_crop_url: str | None = None
    essay_rect = template.get("essayAreaRectMm")
    if essay_rect:
        essay_crop = crop_rect_mm(
            warped, essay_rect, target_width_px, target_height_px
        )
        essay_crop_url = encode_image_to_data_url(essay_crop, ext=".jpg", quality=85)

    full_warped_url = encode_image_to_data_url(warped, ext=".jpg", quality=80)

    return OMRScanResponse(
        scanId=str(uuid.uuid4()),
        sourceDevice=source_device,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        studentNameCropUrl=name_crop_url,
        fullWarpedImageUrl=full_warped_url,
        mcAnswers=mc_answers,
        essayAreaCropUrl=essay_crop_url,
    )


__all__ = [
    "EMPTY_THRESHOLD",
    "FILLED_THRESHOLD",
    "LOW_CONF_THRESHOLD",
    "calculate_bubble_fill_ratio",
    "classify_mc_slot",
    "grade_sheet_image",
]
