# omr-engine — Mesin Pemrosesan Citra & Headless API OpenOMR

Backend Computer Vision dan REST API OMR berkinerja tinggi berbasis OpenCV, ReportLab, dan FastAPI. Engine ini dirancang **stateless** (menerima citra + blueprint template → mengembalikan hasil deteksi JSON terstruktur) sehingga siap diintegrasikan langsung oleh pihak ketiga, platform pendidikan eksternal (misal: **Kelaskita**, LMS sekolah, e-Rapor dinas), maupun sistem batch scanner terpusat.

---

## 🏛️ Peran dalam Ekosistem OpenOMR

1. **Headless API Microservice:** Menyediakan endpoint HTTP siap pakai untuk sistem luar yang ingin memanfaatkan teknologi koreksi LJK otomatis tanpa harus membangun algoritma OMR dari nol.
2. **Batch Processing Powerhouse:** Menangani pemindaian massal dengan kecepatan tinggi menggunakan multiprocessing dan pustaka native OpenCV C++/Python.
3. **Reference Implementation:** Menjadi acuan ground-truth algoritma geometri koordinat dan pengujian komparasi terhadap client-side engine (OpenCV.js WASM).

---

## 🚀 Menjalankan Server API

Pastikan Python ≥ 3.13 dan `uv` telah terpasang:

```bash
cd packages/omr-engine

# Jalankan server API FastAPI
uv run uvicorn omr_engine.api:app --host 0.0.0.0 --port 8000 --reload
```

- **Base URL:** `http://localhost:8000`
- **Dokumentasi Interaktif Swagger UI:** `http://localhost:8000/docs`
- **Dokumentasi Alternatif ReDoc:** `http://localhost:8000/redoc`

---

## 🔐 Autentikasi API Key (Opsional)

Secara default, engine terbuka untuk lingkungan pengujian lokal. Untuk mengamankan API di server produksi:
1. Tetapkan environment variable `OMR_API_KEY`:
   ```bash
   export OMR_API_KEY="rahasia-api-key-kelaskita"
   ```
2. Klien mitra wajib menyertakan header HTTP di setiap request pemindaian:
   ```http
   X-API-Key: rahasia-api-key-kelaskita
   ```
*Jika header tidak disertakan atau salah saat `OMR_API_KEY` aktif, API akan mengembalikan respon `401 Unauthorized`.*

---

## 📡 Panduan Integrasi Endpoint API Mitra

### 1. Health Check
*Cek kesiapan dan versi service.*
- **Method:** `GET`
- **Path:** `/health`
- **Response 200 OK:**
  ```json
  {
    "status": "ok",
    "version": "0.1.0",
    "engine": "openomr-engine"
  }
  ```

---

### 2. Generate Blueprint Template
*Membuat definisi koordinat presisi lembar LJK A4 (`ExamTemplate`) yang valid menurut kontrak `@openomr/schemas`.*
- **Method:** `POST`
- **Path:** `/v1/templates`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "examId": "exam-uts-matika",
    "templateId": "tpl-uts-matika",
    "pgCount": 30,
    "essayCount": 5
  }
  ```
- **Response 200 OK:** Objek JSON `ExamTemplate` lengkap dengan koordinat milimeter 4 sudut fiducial, slot bubble PG (A–D), kotak nama, dan area esai.
- **Batas Kapasitas Lembar A4:**
  - Dengan zona esai: **maksimum 30 PG**
  - Tanpa zona esai: **maksimum 40 PG**
  - *Jika melebihi batas, mengembalikan HTTP `422 Unprocessable Entity (TemplateOverflowError)`.*

---

### 3. Pemindaian LJK via Base64 Data URL (Direkomendasikan untuk Integrasi Web/JSON)
*Memindai foto LJK siswa yang dikirimkan dalam format base64 string.*
- **Method:** `POST`
- **Path:** `/v1/scan/json`
- **Headers:** `Content-Type: application/json`, `X-API-Key: <token>` (opsional)
- **Request Body:**
  ```json
  {
    "template": { /* Objek ExamTemplate dari endpoint /v1/templates */ },
    "imageDataUrl": "data:image/jpeg;base64,...",
    "sourceDevice": "MOBILE_CAMERA"
  }
  ```
  *(Nilai `sourceDevice` yang valid: `"MOBILE_CAMERA"` atau `"DESKTOP_SCANNER"`)*

- **Response 200 OK (`OMRScanResponse`):**
  ```json
  {
    "scanId": "scan-1731839000-abcde",
    "sourceDevice": "MOBILE_CAMERA",
    "timestamp": "2026-11-17T03:40:00Z",
    "studentNameCropUrl": "data:image/png;base64,...",
    "fullWarpedImageUrl": "data:image/jpeg;base64,...",
    "essayAreaCropUrl": "data:image/png;base64,...",
    "mcAnswers": [
      {
        "questionNumber": 1,
        "selectedOption": "A",
        "confidence": 0.98,
        "status": "VALID",
        "rawValues": { "A": 0.88, "B": 0.04, "C": 0.02, "D": 0.03 }
      },
      {
        "questionNumber": 2,
        "selectedOption": null,
        "confidence": 0.12,
        "status": "EMPTY",
        "rawValues": { "A": 0.02, "B": 0.03, "C": 0.01, "D": 0.02 }
      }
    ]
  }
  ```

---

### 4. Pemindaian LJK via Multipart Form Data (Direkomendasikan untuk File Upload Langsung)
*Memindai berkas berkas biner gambar (JPG, PNG).*
- **Method:** `POST`
- **Path:** `/v1/scan`
- **Headers:** `Content-Type: multipart/form-data`, `X-API-Key: <token>` (opsional)
- **Form Fields:**
  - `template` (string JSON): Serialized string dari `ExamTemplate`.
  - `file` (binary): Berkas citra LJK.
  - `sourceDevice` (string, opsional): `"MOBILE_CAMERA"` atau `"DESKTOP_SCANNER"`.
- **Response 200 OK:** Format JSON `OMRScanResponse` yang sama persis dengan endpoint JSON.

---

## ⚠️ Status Kode & Penanganan Error

Engine OMR menyediakan respon error yang spesifik agar mitra dapat menampilkan panduan yang tepat ke pengguna:

| HTTP Status | Penyebab | Pesan Khas / Tindakan |
|---|---|---|
| `400 Bad Request` | Citra rusak / Format base64 cacat / JSON template tidak valid | Periksa kelengkapan payload request |
| `401 Unauthorized` | API Key tidak cocok | Periksa header `X-API-Key` |
| `422 Unprocessable Entity` | **Foto Buram:** Laplacian variance terlalu rendah (<3.0)<br>**Fiducial Gagal:** 4 sudut kotak hitam LJK tidak lengkap/terpotong | Ambil ulang foto dengan pencahayaan cukup dan pastikan 4 sudut lembar masuk dalam bingkai |
| `500 Internal Error` | Kegagalan komputasi citra internal | Hubungi tim engineer |

---

## 🛠️ CLI Sintesis & Pengujian Mandiri

Engine dilengkapi modul sintetis untuk menguji akurasi grading tanpa memerlukan lembar fisik:

```bash
cd packages/omr-engine

# Generate LJK sintetis + metadata koordinat + ground truth
uv run python -m omr_engine.synth --pg 30 --essay 5 --out out

# Uji ketahanan dengan rotasi sudut miring dan gangguan noise
uv run python -m omr_engine.synth --pg 30 --essay 5 --out out --noise 6 --rotate 1.5

# Menjalankan seluruh test suite (86 tests)
uv run pytest
```

Keluaran folder `out/`:
- `template.json`: Metadata koordinat lembar.
- `sheet.png`: Lembar sintetis LJK resolusi 4 px/mm.
- `truth.json`: Kunci ground truth jawaban simulasi untuk verifikasi akurasi.

---

## 📐 Arsitektur Modul Kode

| Modul | Peran Utama |
|---|---|
| `omr_engine.template` | **Sumber kebenaran geometri.** Menghitung koordinat LJK dalam milimeter → `ExamTemplate`. |
| `omr_engine.imaging` | Deteksi 4 fiducial marker, koreksi orientasi EXIF & rotasi 180°, dan 4-point perspective warp. |
| `omr_engine.grade` | Sampling circular mask kehitaman pensil, klasifikasi status jawaban (`VALID`, `EMPTY`, `DOUBLE_FILL`, `AMBIGUOUS`). |
| `omr_engine.pdf` | Generator berkas PDF lembar jawaban standar ReportLab untuk dicetak printer. |
| `omr_engine.synth` | Generator LJK sintetis untuk stress test dan benchmarking akurasi. |
| `omr_engine.api` | Antarmuka FastAPI HTTP REST API. |
