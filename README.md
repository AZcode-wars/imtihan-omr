# ImtihanOMR (OpenOMR)

Aplikasi Pemindai Lembar Jawaban Komputer (LJK) Cepat & Akurat Berbasis AI/Computer Vision yang dirancang khusus untuk guru sekolah dan madrasah, serta menyediakan Headless API Engine bagi mitra dan pengembang sistem pendidikan.

---

## 🏛️ Arsitektur Dual-Track

OpenOMR dikembangkan dengan arsitektur **Dual-Track** yang fleksibel dan independen:

1. **Client-Side Standalone PWA (`apps/web`):**
   - Dirancang khusus untuk **guru di sekolah dan madrasah**.
   - Berjalan mandiri langsung di browser (*In-Browser OMR Engine*) tanpa ketergantungan server lokal port 8000.
   - 100% *Offline-First*: pemindaian LJK, penilaian, dan rekap nilai tetap berfungsi penuh tanpa jaringan internet.
2. **Headless Microservice API (`packages/omr-engine`):**
   - Dirancang untuk **kolaborator, mitra institusi, atau platform pendidikan eksternal (misal: Kelaskita, LMS sekolah, e-Rapor dinas)**.
   - Layanan REST API berbasis FastAPI + OpenCV berkinerja tinggi untuk pemrosesan citra LJK secara terpusat dan *batch scanning* volume besar.
3. **Shared Contract (`packages/shared-schemas`):**
   - Sumber kebenaran tunggal (*Single Source of Truth*) geometri LJK dan format data OMR berbasis JSON Schema Draft 2020-12, TypeScript, dan Pydantic v2.

---

## 🚀 Fitur Unggulan

1. **Pemindaian LJK Cepat (≤5 detik/lembar):**
   - Deteksi 4 *fiducial marker* presisi dan koreksi orientasi otomatis.
   - Warp perspektif 4 titik ke kanvas standar A4.
   - Ambang batas circular mask lokal adaptif untuk membaca pensil 2B.
2. **Format Lembar Jawaban A4 Standar Presisi:**
   - 3 Kolom Pilihan Ganda (10 nomor per kolom, kapasitas standar **maksimum 30 PG + area esai** atau **maksimum 40 PG tanpa esai**).
   - Jarak antar pusat lingkaran (*bubble pitch*) 8.5 mm (standar pensil 2B lega) dengan jeda visual tiap 5 nomor.
   - Kolom identitas lengkap: **Nama**, **Mata Pelajaran**, **Kelas**, dan **Tanggal Ujian**.
   - Area esai terpadu untuk dinilai langsung oleh guru di aplikasi.
3. **Exception-First Review:**
   - Guru tidak perlu memeriksa nomor yang sudah jelas (valid).
   - Aplikasi hanya menyorot jawaban yang bermasalah (kosong, ganda, atau ragu) dengan tombol koreksi cepat 1-klik `[A] [B] [C] [D]`.
4. **Fleksibilitas Alur Verifikasi (Review Queue):**
   - Guru dapat memilih verifikasi langsung per lembar atau menimbun hasil scan ke antrean review untuk dinilai santai di lain waktu (*batch review*).
5. **Dukungan Perangkat Responsif Ganda:**
   - **Mobile:** Kamera Viewfinder A4 dengan panduan sudut dan tombol shutter besar. Mendukung upload batch multi-file dari galeri HP dengan optimasi kompresi memori (anti-crash).
   - **Desktop:** Dropzone multi-file JPG/PNG dan PDF multi-halaman + *Split-Screen Batch Review* dengan kontrol penilaian esai dan navigasi keyboard (`↑` / `↓`).
6. **Ekspor Nilai:**
   - Ekspor rekapitulasi nilai ke format CSV standar Indonesia (`id-ID`, pemisah koma desimal) untuk langsung diolah ke buku nilai rapor.

---

## 📁 Struktur Monorepo

```
d:/openomr/
├── apps/
│   └── web/                   # Next.js 16 + React 19 + Tailwind v4 (Client PWA)
├── packages/
│   ├── omr-engine/            # Python 3.13 + OpenCV + ReportLab + FastAPI (Mitra API Engine)
│   └── shared-schemas/        # JSON Schema Draft 2020-12 + TypeScript & Pydantic v2 (Kontrak)
├── docs/                      # Dokumentasi teknis, PRD, dan token desain
├── prototype/                 # Pratinjau visual FigCraft & LJK A4
└── docker-compose.yml         # Konfigurasi container produksi
```

---

## 🛠️ Menjalankan Secara Lokal

### Prasyarat
- Node.js ≥ 20
- Python ≥ 3.13 dan `uv` (Astral uv package manager)

### A. Untuk Pengembang Web Guru (`apps/web`)
```bash
cd apps/web
npm install
npm run dev
```
Buka browser di `http://localhost:3000`.

### B. Untuk Mitra / Integrator API Eksternal (`packages/omr-engine`)
```bash
cd packages/omr-engine
uv run uvicorn omr_engine.api:app --host 0.0.0.0 --port 8000 --reload
```
API Engine akan aktif di `http://localhost:8000`. Dokumentasi interaktif Swagger UI tersedia di `http://localhost:8000/docs`. (Lihat panduan integrasi lengkap di [`packages/omr-engine/README.md`](packages/omr-engine/README.md)).

---

## 🧪 Menjalankan Pengujian (Test Suites)

### 1. Test Unit Frontend (Vitest) & TypeScript Check
```bash
cd apps/web
npm run test
npx tsc --noEmit
```
*Menguji 52 pengujian: logika penskoran (Mode A, Mode B, KKM, pembulatan), template builder, detektor fiducial, dan utilitas kamera.*

### 2. Test Engine Python (Pytest)
```bash
cd packages/omr-engine
uv run pytest
```
*Menguji 86 pengujian: endpoint REST API, deteksi fiducial, warp citra, grading bubble, geometri ReportLab PDF, sintetis LJK, dan verifikasi kontrak.*

### 3. Test Kontrak Bersama (Shared Schemas)
```bash
cd packages/shared-schemas
uv run pytest
```
*Menguji validitas JSON Schema dan round-trip serialisasi model Pydantic.*

---

## 🐳 Menjalankan dengan Docker

```bash
docker compose up --build
```
> **Catatan Docker:** Konfigurasi Dockerfile dan `docker-compose.yml` telah disediakan sebagai blueprint container produksi. Pada lingkungan Windows dev tanpa Docker Desktop aktif, jalankan aplikasi menggunakan metode lokal di atas.
