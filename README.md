# ImtihanOMR (OpenOMR)

Aplikasi Pemindai Lembar Jawaban Komputer (LJK) Cepat & Akurat Berbasis AI/Computer Vision yang dirancang khusus untuk guru sekolah dan madrasah.

---

## 🚀 Fitur Unggulan

1. **Pemindaian LJK Cepat (≤5 detik/lembar):**
   - Deteksi 4 *fiducial marker* presisi dan koreksi orientasi (auto-rotate 180°).
   - Warp perspektif 4 titik ke kanvas standar A4.
   - Ambang batas circular mask lokal adaptif untuk membaca pensil 2B.
2. **Format Lembar Jawaban A4 Presisi:**
   - 3 Kolom Pilihan Ganda (10 nomor per kolom, kapasitas hingga 45 PG + esai atau 60 PG tanpa esai).
   - Bubble pitch 8.5 mm (standar pensil 2B lega) dengan jeda visual tiap 5 nomor.
   - Kolom identitas lengkap: **Nama**, **Mata Pelajaran**, **Kelas**, dan **Tanggal Ujian**.
   - Area esai besar satu zona untuk dinilai langsung oleh guru di aplikasi.
3. **Exception-First Review:**
   - Guru tidak perlu memeriksa nomor yang sudah jelas (valid).
   - Aplikasi hanya menyorot jawaban yang bermasalah (kosong, ganda, atau ragu) dengan tombol koreksi 1-klik `[A] [B] [C] [D]`.
4. **Offline-First dengan IndexedDB & Auto-Sync:**
   - Guru dapat memindai di dalam kelas tanpa koneksi internet.
   - Hasil scan tersimpan aman di IndexedDB lokal (`scans_queue`) dan otomatis terunggah saat terhubung ke internet.
5. **Dukungan Perangkat Responsif Ganda:**
   - **Mobile:** Kamera Viewfinder A4 dengan panduan sudut dan tombol shutter besar. Mendukung upload batch multi-file dari galeri HP dengan optimasi kompresi memori (anti-crash).
   - **Desktop:** Dropzone multi-file JPG/PNG dan PDF multi-halaman + *Split-Screen Batch Review* dengan navigasi keyboard (`↑` / `↓`).
6. **Ekspor Nilai:**
   - Ekspor rekapitulasi nilai ke format CSV standar Indonesia (`id-ID`, pemisah koma desimal).

---

## 📁 Struktur Monorepo

```
d:/openomr/
├── apps/
│   └── web/                   # Next.js 16 + React 19 + Tailwind v4 (CSS-first)
├── packages/
│   ├── omr-engine/            # Python 3.13 + OpenCV + ReportLab + FastAPI
│   └── shared-schemas/        # JSON Schema Draft 2020-12 + TypeScript & Pydantic v2
├── docs/                      # Dokumentasi teknis, PRD, dan token desain
├── prototype/                 # Pratinjau visual FigCraft & LJK A4
└── docker-compose.yml         # Konfigurasi container produksi
```

---

## 🛠️ Menjalankan Secara Lokal

### Prasyarat
- Node.js ≥ 20
- Python ≥ 3.13 dan `uv` (Astral uv package manager)

### 1. Menjalankan OMR Engine Backend (FastAPI + OpenCV)
```bash
cd packages/omr-engine
uv run uvicorn omr_engine.api:app --host 0.0.0.0 --port 8000 --reload
```
API Engine akan aktif di `http://localhost:8000`. Dokumentasi OpenAPI tersedia di `http://localhost:8000/docs`.

### 2. Menjalankan Web Frontend (Next.js)
```bash
cd apps/web
npm install
npm run dev
```
Buka browser di `http://localhost:3000`.

---

## 🧪 Menjalankan Pengujian (Test Suites)

### 1. Test Engine Python (Pytest)
```bash
cd packages/omr-engine
uv run pytest
```
*Menguji 86 pengujian: endpoint API, deteksi fiducial, warp citra, grading bubble, geometri ReportLab PDF, sintetis LJK, dan kontrak.*

### 2. Test Kontrak Bersama (Shared Schemas)
```bash
cd packages/shared-schemas
uv run pytest
```
*Menguji validitas JSON Schema dan round-trip serialisasi model Pydantic.*

### 3. Test Unit Frontend (Vitest) & TypeScript Check
```bash
cd apps/web
npm run test
npx tsc --noEmit
```
*Menguji 41 pengujian logika penskoran (Mode A, Mode B, KKM, pembulatan).*

---

## 🐳 Menjalankan dengan Docker

```bash
docker compose up --build
```
> **Catatan Docker:** Konfigurasi Dockerfile dan `docker-compose.yml` telah disediakan sebagai blueprint container produksi. Pada lingkungan Windows dev tanpa Docker Desktop aktif, jalankan aplikasi menggunakan metode lokal di atas.
