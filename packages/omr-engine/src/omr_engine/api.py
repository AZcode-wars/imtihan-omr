"""FastAPI HTTP API untuk OpenOMR Engine.

Menyediakan endpoint:
* `GET /health` : Cek kesiapan & versi service.
* `POST /v1/templates` : Buat template baru berdasarkan konfigurasi soal.
* `POST /v1/scan` : Unggah citra lembar jawaban (multipart/form-data atau JSON data URL)
  dan kembalikan `OMRScanResponse`.
"""

from __future__ import annotations

import base64
import json
import os
from typing import Annotated, Any, Literal

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from openomr_schemas import ExamTemplate, OMRScanResponse
from pydantic import BaseModel, Field

from .grade import grade_sheet_image
from .imaging import FiducialDetectionError
from .template import TemplateOverflowError, build_template

# API Key opsional via environment variable OMR_API_KEY
OMR_API_KEY = os.getenv("OMR_API_KEY", "")


def verify_api_key(x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None) -> None:
    """Verifikasi header X-API-Key jika OMR_API_KEY dikonfigurasi di environment."""
    if OMR_API_KEY:
        if not x_api_key or x_api_key != OMR_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Akses ditolak: X-API-Key tidak valid atau belum disertakan.",
            )

app = FastAPI(
    title="OpenOMR Engine API",
    version="0.1.0",
    description="Engine OMR presisi tinggi berbasis OpenCV, ReportLab, dan FastAPI",
)

# Izinkan CORS untuk aplikasi Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Skema Request / Response
# --------------------------------------------------------------------------- #


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    engine: str = "openomr-engine"


class CreateTemplateRequest(BaseModel):
    exam_id: str = Field(default="exam-1", alias="examId")
    template_id: str = Field(default="tpl-1", alias="templateId")
    pg_count: int = Field(default=30, ge=1, le=100, alias="pgCount")
    essay_count: int = Field(default=5, ge=0, le=20, alias="essayCount")


class ScanJSONRequest(BaseModel):
    template: dict[str, Any]
    image_data_url: str = Field(alias="imageDataUrl")
    source_device: Literal["MOBILE_CAMERA", "DESKTOP_SCANNER"] = Field(
        default="MOBILE_CAMERA", alias="sourceDevice"
    )


# --------------------------------------------------------------------------- #
# Helper Dekode Citra
# --------------------------------------------------------------------------- #


def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Dekode bytes citra mentah menjadi format numpy BGR."""
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Berkas gambar tidak valid atau rusak.",
        )
    return img


def decode_data_url(data_url: str) -> np.ndarray:
    """Dekode base64 data URL ke citra numpy BGR."""
    if "," in data_url:
        _, b64_part = data_url.split(",", 1)
    else:
        b64_part = data_url
    try:
        raw_bytes = base64.b64decode(b64_part)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format Base64 Data URL tidak valid: {exc}",
        ) from exc
    return decode_image_bytes(raw_bytes)


def check_blurriness(image: np.ndarray, threshold: float = 15.0) -> float:
    """Hitung varians Laplacian untuk mendeteksi blur."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if variance < threshold:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Citra terlalu buram (laplacian variance = {variance:.1f} < {threshold}). "
                "Harap ambil foto ulang dengan fokus yang stabil dan pencahayaan cukup."
            ),
        )
    return variance


# --------------------------------------------------------------------------- #
# Endpoint
# --------------------------------------------------------------------------- #


@app.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Cek status kesehatan dan versi service."""
    return HealthResponse(status="ok", version="0.1.0")


@app.post("/v1/templates", response_model=dict[str, Any])
def create_template(req: CreateTemplateRequest) -> dict[str, Any]:
    """Buat definisi ExamTemplate baru sesuai jumlah soal PG & Esai."""
    try:
        tpl = build_template(
            exam_id=req.exam_id,
            template_id=req.template_id,
            pg_count=req.pg_count,
            essay_count=req.essay_count,
        )
        # Validasi bentuk pydantic
        ExamTemplate.model_validate(tpl)
        return tpl
    except TemplateOverflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@app.post("/v1/scan", response_model=OMRScanResponse)
def scan_sheet_multipart(
    template: Annotated[str, Form(description="JSON string dari ExamTemplate")],
    file: Annotated[UploadFile, File(description="Berkas citra LJK")],
    source_device: Annotated[
        Literal["MOBILE_CAMERA", "DESKTOP_SCANNER"], Form(alias="sourceDevice")
    ] = "MOBILE_CAMERA",
    _: None = Depends(verify_api_key),
) -> OMRScanResponse:
    """Scan lembar LJK via multipart/form-data upload."""
    try:
        template_dict = json.loads(template)
        # Validasi struktur template
        ExamTemplate.model_validate(template_dict)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template JSON tidak valid: {exc}",
        ) from exc

    raw_bytes = file.file.read()
    image = decode_image_bytes(raw_bytes)
    check_blurriness(image)

    try:
        scan_result = grade_sheet_image(
            image=image,
            template=template_dict,
            source_device=source_device,
        )
        return scan_result
    except FiducialDetectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Gagal mendeteksi lembar LJK: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terjadi kesalahan saat memproses citra: {exc}",
        ) from exc


@app.post("/v1/scan/json", response_model=OMRScanResponse)
def scan_sheet_json(
    req: ScanJSONRequest,
    _: None = Depends(verify_api_key),
) -> OMRScanResponse:
    """Scan lembar LJK via JSON body dengan Base64 data URL."""
    try:
        ExamTemplate.model_validate(req.template)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template JSON tidak valid: {exc}",
        ) from exc

    image = decode_data_url(req.image_data_url)
    check_blurriness(image)

    try:
        scan_result = grade_sheet_image(
            image=image,
            template=req.template,
            source_device=req.source_device,
        )
        return scan_result
    except FiducialDetectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Gagal mendeteksi lembar LJK: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terjadi kesalahan saat memproses citra: {exc}",
        ) from exc


__all__ = ["app"]
