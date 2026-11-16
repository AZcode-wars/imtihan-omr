# Handoff Document — OpenOMR Project

> **Tanggal:** 15 November 2026  
> **Status Proyek:** Task 1, Task 2, dan Task 3 (termasuk Revisi v2 LJK A4) **Selesai 100% & Ter-commit**  
> **Target Berikutnya:** **Task 4 — Fase 3: Engine Pembacaan Citra** (`omr_engine/imaging.py`, `omr_engine/grade.py`)  
> **Repository Root:** `D:\openomr` (Git branch: `main`, working tree clean, commit `7c738f1`)

---

## 1. Executive Summary & Visi Produk

**OpenOMR (Open-Source Mobile OMR Scanner)** adalah platform koreksi Lembar Jawaban Komputer (LJK) hibrida modern yang memadukan Next.js PWA (antarmuka guru di HP & desktop) dengan Python OMR Engine (OpenCV, ReportLab, FastAPI).

* **Target Pengguna:** Guru mata pelajaran di sekolah skala kecil-menengah yang membutuhkan koreksi cepat tanpa perangkat pemindai khusus.
* **Metrik Keberhasilan MVP:**
  1. Kecepatan operasional guru: **≤ 5 detik per lembar** (scan, auto-verifikasi exception, simpan).
  2. Akurasi deteksi lingkaran PG: **≥ 98%** pada kertas printer biasa dan cahaya kelas normal.
  3. Memangkas waktu koreksi ujian campuran (PG + Esai) hingga 80%.
  4. Adopsi awal: 1 sesi ujian nyata (25–35 siswa) berjalan mulus di browser HP guru tanpa crash.

---

## 2. Arsitektur Monorepo & Status Terkini

```text
D:\openomr\
├── apps/
│   └── web/                  # Next.js 16.4.6, React 19.3.0, Tailwind v4.3.3, shadcn radix-nova
├── packages/
│   ├── omr-engine/           # Python 3.13.5 (uv), OpenCV, ReportLab 5.1.0, FastAPI, PyMuPDF
│   └── shared-schemas/       # JSON Schema draft 2020-12 (kontrak tunggal), Pydantic v2, TypeScript types
├── docs/                     # Spesifikasi desain, token, komponen, layar, dan pola referensi
├── prototype/previews/       # 13 preview PNG hasil render FigCraft & engine nyata
├── TASKS.md                  # Daftar rencana kerja 12 task & log kemajuan
├── product_requirements_document_prd_openomr.md
├── ui_brief_ai_agent_specification_openomr.md
└── openomr_design_system.figcraft # Prototipe desain sistem FigCraft
```

### Riwayat Commit Kunci
* `02bceca` — `feat(0): fondasi repo OpenOMR` (Next.js 16, Tailwind v4 CSS-first, 17/17 token byte-per-byte, `omr_engine` module).
* `9b718e1` — `feat(1): perbaikan kontras` (Aturan kontras formal, foreground dinamis, pencegahan `brand/500` untuk teks).
* `713e0f3` — `feat(2): kontrak ExamTemplate + scoring pure function` (JSON Schema, pure function Mode A & B, 41 vitest passing).
* `23c6533` — `feat(3): engine template & PDF` (ReportLab uncompressed A4, OpenCV synth + ground truth).
* `4b3e4b9` — `amemen(3): layout LJK` (revisi amemen 1).
* `d829987` — `amemen(3): model esai dinilai guru` (revisi amemen 2).
* `36d842e` — `feat(3): revisi v2 geometri LJK A4, petunjuk, dan single essay area` (Revisi visual v2 final).
* `7c738f1` — `docs: update log kemajuan task 3 revisi v2 commit hash`.

### Status Verifikasi & Uji Otomatis
* **Python Engine (`packages/omr-engine`):** **65/65 pytest lolos (100%)** (`test_template.py`, `test_pdf_geometry.py`, `test_synth.py`, `test_contract.py`).
* **Kontrak Bersama (`packages/shared-schemas`):** **14/14 pytest lolos (100%)** (schema validation, fixture round-trip, negative test).
* **Frontend Web (`apps/web`):** **41/41 vitest lolos (100%)**, `npx tsc --noEmit` bersih tanpa error.

---

## 3. Rangkuman Seluruh Dokumentasi Repo

### 3.1 `product_requirements_document_prd_openomr.md` (PRD)
* **FR-1 (Generator Template LJK):** Kertas A4 (210×297 mm), 2 kolom PG, diameter bubble 4,5 mm, pitch bubble **8,5 mm** (celah 4 mm lega untuk pensil 2B). Pengelompokan 5 nomor dengan jeda +7 mm. 4 Fiducial marker (TL 14×14 mm solid, TR/BL/BR 10×10 mm solid). Kotak PETUNJUK di bawah kotak Nama & Kelas. Zona esai: **satu area besar tanpa nomor di kertas**, siswa menomori sendiri. Kapasitas A4 2 kolom: 40 PG (tanpa esai), 30 PG (dengan esai).
* **FR-2 (Manajemen Ujian & Scoring):**
  * **Mode A (Persentase):** Bobot PG% + Esai% = 100%. Nilai akhir ternormalisasi 0–100.
  * **Mode B (Akumulasi Poin Langsung):** Poin mentah (0..totalPoinMaks), tampil `86 / 100 poin`.
  * Status soal: `ACTIVE` (penalti salah opsional), `BONUS` (salah → 0, tidak kena penalti), `VOID` (dianulir, dikeluarkan dari pembagi).
  * Pembulatan: `EXACT_2_DECIMAL`, `ROUND_HALF_UP` (menjauh dari nol), `CEIL_UP`.
  * KKM (FR-2.5): Acuan status Lulus / Remedial.
  * Roster Kelas (FR-2.6): Daftar siswa (nama + NIS), import/export CSV.
* **FR-3 (Smart Capture Kamera HP):** Viewfinder A4 ratio (1:1.414), 4 corner bracket, deteksi stabil ±0,5s → auto-capture + haptic + kilau visual, kontrol torch, offline queue ke IndexedDB saat offline.
* **FR-4 (Core OMR Pipeline):** 4 fiducial detection, rotasi 180° jika terbalik, 4-point transform ke kanvas 800×1100 px, adaptive Gaussian thresholding, rasio piksel bubble PG → `VALID`, `EMPTY`, `MULTIPLE`, `LOW_CONFIDENCE`. Crop nama siswa (`nameCropRectMm`) dan crop satu area esai (`essayAreaCropUrl`).
* **FR-5 (Layar Verifikasi Cepat):** Human-in-the-loop bottom sheet. Potongan nama + Smart Student Dropdown (sembunyikan siswa yang sudah discan), overwrite warning jika duplikat, Exception-First (hanya nomor bermasalah yang muncul), penilaian esai oleh guru di aplikasi.
* **FR-6 (Rekapitulasi & Ekspor):** KPI summary, filter Lulus/Remedial, export CSV id-ID.

### 3.2 `ui_brief_ai_agent_specification_openomr.md` (UI Brief)
* **Guardrails:** Next.js App Router, TS strict, Tailwind v4, shadcn/ui radix-nova, Roboto (UI) + Caveat (tulisan tangan).
* **Kontrak Data:** Lokasi resmi di `packages/shared-schemas`. Definisi TypeScript (`src/omr.ts`) dan Pydantic (`models.py`) mengacu pada `exam-template.schema.json`.
* **Navigasi:** Mobile BottomNav 5 tab (`Ujian`, `Kelas`, **`Scan` (menonjol)**, `Antrean`, `Nilai`). Desktop Left Sidebar 240px.
* **4 Milestone Pengembangan Frontend:** M1 (State, scoring, shell, setup, grades), M2 (Kamera mobile & batch desktop), M3 (Verification sheet & split-screen review), M4 (Roster, offline queue, blueprint A4, KKM).

### 3.3 `docs/design_tokens.md` (Design Tokens)
* **Warna Brand Primer:** `#355A15` (`brand/700`). Skala: `brand/50` (#F3F7EF) s/d `brand/900` (#1C330C).
* **Warna Aksi vs Warna Status (Dipisah Tegas):**
  * Aksi: `brand/700` primer (bg tombol), hover `brand/800`, secondary white/slate-200, ghost, danger `rose/600`.
  * Status OMR: Wajib **ikon + label teks + warna**:
    * `VALID`: `check-circle-2` | tanpa label | `brand/50` / border `brand/200` / teks `brand/800`.
    * `EMPTY`: `circle-minus` | "kosong" | `amber/50` / border `amber/300` / teks `amber/800`.
    * `LOW_CONFIDENCE`: `triangle-alert` | "perlu dicek" + % | `amber/100` / **border 1.5px dashed `amber/500`** / teks `amber/900`.
    * `MULTIPLE`: `copy` | "ganda" | `rose/50` / border `rose/200` / teks `rose/800`.
* **Tipografi:** Roboto (UI), Caveat 600 (handwriting). Tabular nums untuk seluruh angka skor. Locale format `id-ID` (koma desimal, titik ribuan).
* **Spasi & Radius:** Basis 4px. Radius: `sm` (8px), `md` (12px), `lg` (16px), `xl` (24px), `pill` (999px).
* **Target Sentuh Wajib:** Minimum **44 × 44 px** untuk semua kontrol interaktif (termasuk tombol sm, tombol opsi bubble, tombol skor esai).
* **Aksesibilitas & Kontras WCAG:** `brand/700` pada putih = 8,0:1 (AAA). Larangan keras memakai `brand/500` sebagai latar teks karena kontras < 4,5:1.

### 3.4 `docs/components.md` (Spesifikasi Komponen)
* Rincian visual & state untuk 30+ komponen: `AppHeader`, `BottomNav`, `SidebarNav`, `Button`, `IconButton`, `TextField`, `NumberField`, `Stepper`, `Slider`, `SegmentedControl`, `Smart Student Dropdown`, `Card` (section/inset/score), `KPI Card`, `StatusChip`, `ExceptionChip`, `BubbleOption` (A/B/C/D/Kosong), `EssayMarkRow` (Benar/Salah/parsial), `EssayAreaPreview` (gambar tunggal area esai), `AnswerKeyGrid` (editor kunci PG dengan penanda `BONUS` superscript `+` dan `VOID` line-through), `Toast`, `Dialog`, `BottomSheet`, `Viewfinder`, `ProgressBar`, `FilterChips`, `Dropzone`, `GradeTable`, `StudentCard`.

### 3.5 `docs/screen_specs.md` (Spesifikasi 8 Layar)
* **0. Peta Layar:** ① `/setup`, ② `/students`, ③ `/scan` (mobile), ④ `/scan` (desktop batch), ⑤ Sheet Verifikasi, ⑥ `/queue`, ⑦ `/grades`, ⑧ `/template`.
* **Sheet Verifikasi Cepat (§⑤):**
  * Zona 1: Potongan tulisan nama (`Caveat 28`) + Smart Student Dropdown + duplicate dialog warning.
  * Zona 2: Ringkasan skor gradien live (PG, Esai, Nilai Akhir).
  * Zona 3: Exception-First (hanya EMPTY, MULTIPLE, LOW_CONFIDENCE yang tampil; chip di-tap membuka koreksi 1-klik).
  * Zona 4: Penilaian Esai Guru. Bagian a: `EssayAreaPreview` (1 potong gambar area esai dari `essayAreaCropUrl`). Bagian b: baris penilaian per nomor esai (`E1`, `E2`, ...) dengan tombol Benar (auto maxScore), Salah (auto 0), dan input parsial (kelipatan 0,5).
* **Blueprint LJK A4 (§⑧):** Presisi koordinat ReportLab, 4 fiducial, kotak petunjuk 176×16 mm di y=46 mm, batas kapasitas 40 PG (tanpa esai) & 30 PG (dengan esai).

### 3.6 `docs/tailwind_mapping.md` & `docs/reference_patterns.md`
* Penjelasan setup Tailwind v4 CSS-first (`@theme` di `globals.css`, tanpa `tailwind.config.ts`), adaptasi shadcn CLI preset `radix-nova`, dan catatan keputusan desain dari prototipe HTML.

---

## 4. Evolusi Keputusan Penting (Evolution & Decisions)

1. **Geometri LJK A4 & Pitch Bubble:**
   * Semula: 8,5 mm.
   * Amemen 1: Diubah ke 6,0 mm agar kapasitas naik.
   * **Revisi v2 (Final):** Pengguna menginstruksikan mengembalikan pitch ke **8,5 mm** (celah 4 mm) agar pensil 2B tidak saling tumpah (*bleeding*) dan memberi jeda pengelompokan 5 nomor (+7 mm).
2. **Posisi Kotak PETUNJUK:**
   * Semula di samping kanan zona PG.
   * **Revisi v2 (Final):** Dipindah ke bawah kotak nama & kelas (`x=14`, `y=46`, `w=176`, `h=16 mm`) dengan teks format 2 kolom.
3. **Model & Penilaian Soal Esai:**
   * Awalnya: Di kertas ada bubble angka 0–5 + `[+.5]` per nomor untuk diarsir guru.
   * Amemen 2: Bubble skor dihapus, diganti slot kotak esai per nomor soal.
   * **Revisi v2 (Final):** Kertas hanya memuat **SATU area esai besar** tanpa nomor soal (`essayAreaRectMm`). Siswa yang menulis dan menomori jawabannya sendiri. Mesin OMR memotong satu area ini (`essayAreaCropUrl`), dan guru menilai per nomor di aplikasi (tombol Benar/Salah + skor parsial).
4. **Kapasitas Halaman & Batas Soal:**
   * Pada pitch 8,5 mm 2 kolom: Maksimal **40 PG tanpa esai**, atau **30 PG dengan zona esai**.
   * Catatan: Jika pengguna nantinya membutuhkan 50 PG dalam 1 lembar A4, solusinya adalah mengubah konfigurasi ke **3 kolom PG** di `template.py` (menampung 60 PG tanpa esai / 45 PG dengan esai).
5. **FigCraft Synchronization:**
   * Mockup LJK lama di page 05 dan frame 03-mobile-07 diganti dengan render nyata engine (`sheet.png`).
   * Zone 4 pada frame verifikasi mobile 03-mobile-05 diganti dengan komponen `EssayAreaPreview` + `EssayMarkRow`.

---

## 5. Rincian Teknis Implementasi Task 3 (Revisi v2)

### A. Geometri `packages/omr-engine/src/omr_engine/template.py`
* `PAGE_WIDTH_MM = 210.0`, `PAGE_HEIGHT_MM = 297.0`, `MARGIN_MM = 8.0`.
* `BUBBLE_DIAMETER_MM = 4.5`, `BUBBLE_PITCH_MM = 8.5`.
* `FIDUCIAL_TL_MM = 14.0`, `FIDUCIAL_OTHER_MM = 10.0`.
* `CONTENT_LEFT_MM = 14.0`, `CONTENT_WIDTH_MM = 176.0`.
* `COLUMN_COUNT = 2`, `COLUMN_X_MM = (14.0, 108.0)`.
* `GROUP_SIZE = 5`, `GROUP_GAP_MM = 7.0`.
* `NAME_CROP_RECT_MM = {"x": 14.0, "y": 30.0, "w": 90.0, "h": 12.0}`.
* `CLASS_BOX_RECT_MM = {"x": 110.0, "y": 30.0, "w": 80.0, "h": 12.0}`.
* `INSTRUCTION_BOX_RECT_MM = {"x": 14.0, "y": 46.0, "w": 176.0, "h": 16.0}`.
* `MC_SECTION_TITLE_Y_MM = 78.0`, `MC_START_Y_MM = 88.0`.
* `ESSAY_TITLE_GAP_MM = 13.75`, `ESSAY_AREA_GAP_MM = 8.0`, `ESSAY_AREA_MIN_H_MM = 30.0`.
* `CONTENT_BOTTOM_MM = 276.0`.
* `essay_area_rect`: `{"x": 14.0, "y": area_top, "w": 176.0, "h": area_height}` (atau `None` bila `essay_count == 0`).

### B. ReportLab Generator `packages/omr-engine/src/omr_engine/pdf.py`
* Koordinat mm dikonversi ke points: `pt = mm * 72 / 25.4`.
* Origin ReportLab kiri-bawah: `y_canvas = PAGE_H_PT - y_mm * MM_TO_PT`.
* Ditulis tanpa kompresi (`pageCompression=0`) agar inspeksi geometri PDF deterministik.

### C. LJK Sintetis `packages/omr-engine/src/omr_engine/synth.py`
* Skala render OpenCV: `DPI = 72` (2,8346 px/mm).
* Menghasilkan LJK sintetis, mengisi bubble dengan pola deterministik: kelipatan 7 → `EMPTY`, 11 → `MULTIPLE`, 13 → `LOW_CONFIDENCE`, lainnya `VALID`.
* Menulis teks simulasi di kotak nama, kotak kelas, dan simulasi tulisan tangan di zona esai.
* CLI: `python -m omr_engine.synth --pg 25 --essay 5 --out out` menghasilkan 4 berkas: `template.json`, `sheet.pdf`, `sheet.png`, `truth.json`.

### D. Kontrak JSON Schema & Model
* Schema: `packages/shared-schemas/schema/exam-template.schema.json`.
* Model Pydantic: `packages/shared-schemas/src/openomr_schemas/models.py`.
* Definisi TS: `packages/shared-schemas/src/omr.ts` (di-reexport oleh `apps/web/src/types/omr.ts`).
* Field `essayAreaRectMm: RectMm | null` menggantikan `essaySlots`.
* `OMRScanResponse`: `essayAreaCropUrl: string | null` menggantikan `essayCrops`.

---

## 6. Rencana & Panduan Eksekusi Task 4 (Fase 3: Engine Pembacaan Citra)

Agen berikutnya akan mengerjakan **Task 4: Engine Pembacaan Citra**. Berikut instruksi dan panduan implementasinya:

### Modul yang Akan Dibuat
1. `packages/omr-engine/src/omr_engine/imaging.py`:
   * **Deteksi 4 Fiducial Marker:**
     * Temukan 4 kontur kotak hitam solid di dekat margin kertas (8 mm dari tepi).
     * Marker kiri-atas (TL) memiliki ukuran 14×14 mm, sedangkan TR, BL, BR berukuran 10×10 mm.
     * Gunakan perbedaan luas kontur TL vs lainnya untuk memastikan orientasi lembar.
     * Jika marker TL terdeteksi di kanan-bawah atau sudut lain, lakukan rotasi kertas 180° / 90°.
   * **Perspective Transform (4-Point Transform):**
     * Petakan 4 koordinat pusat/sudut fiducial marker ke ukuran kanvas standar: resolusi **800 × 1100 px** (atau rasio A4 standar).
     * Dapatkan matriks transformasi perspektif via `cv2.getPerspectiveTransform` dan terapkan `cv2.warpPerspective`.
   * **Adaptive Thresholding:**
     * Gunakan Gaussian adaptive thresholding (`cv2.adaptiveThreshold`) untuk mengeliminasi bayangan tangan, lekukan kertas, dan pencahayaan tidak merata.
   * **Cropping:**
     * Crop area nama siswa berdasarkan `nameCropRectMm`.
     * Crop area jawaban esai berdasarkan `essayAreaRectMm` (jika ada).
     * Simpan/encode potongan ke format data URL (JPEG/PNG) untuk dikirim ke API.

2. `packages/omr-engine/src/omr_engine/grade.py`:
   * **Klasifikasi Bubble PG:**
     * Berdasarkan koordinat `multipleChoiceSlots` dari `ExamTemplate`.
     * Hitung rasio piksel terisi (*fill ratio*) pada setiap lingkaran A, B, C, D menggunakan circular mask.
     * Tentukan batas ambang (*thresholds*):
       * `FILLED_THRESHOLD`: ambang arsiran valid (misal rasio ≥ 0.45).
       * `EMPTY_THRESHOLD`: ambang lingkaran kosong (misal rasio ≤ 0.18).
       * Di antara ambang tersebut atau mendekati batas → `LOW_CONFIDENCE`.
       * Jika >1 bubble terisi di atas ambang → `MULTIPLE`.
       * Jika tepat 1 bubble terisi → `VALID`.
       * Jika 0 bubble terisi → `EMPTY`.
     * Hitung nilai confidence (0.0 - 1.0) untuk tiap baris jawaban.
   * **Struktur Output:**
     * Mengembalikan list `DetectedMCAnswer` dan potongan gambar `studentNameCropUrl` serta `essayAreaCropUrl`.

3. **Pengujian Task 4:**
   * Buat `packages/omr-engine/tests/test_imaging.py` dan `test_grade.py`.
   * Uji terhadap citra sintetis bersih dari `synth.py` (`sheet.png` + `truth.json`) → akurasi klasifikasi harus 100% pada kondisi bersih.
   * Uji terhadap citra dengan gangguan: noise, rotasi 180°, bayangan sintetis (fitur `--noise` dan `--rotate` pada `synth.py`).
   * Pastikan klasifikasi `EMPTY`, `MULTIPLE`, dan `LOW_CONFIDENCE` terdeteksi persis sesuai pola di `truth.json`.

---

## 7. Catatan Khusus & Gotchas untuk Agen Berikutnya

1. **Windows Reserved Device Name:**
   * Modul Python di monorepo ini bernama **`omr_engine`** (dan `openomr_schemas`), **BUKAN** `omr`. Di OS Windows, `CON`, `PRN`, `AUX`, `NUL`, dan nama tertentu bisa menyebabkan error IO. Selalu gunakan `omr_engine`.
2. **Paket & Lingkungan:**
   * Python dikelola via **`uv`**. Jalankan perintah di folder package: `cd packages/omr-engine; uv run pytest`.
   * Node dikelola via **`npm`** di `apps/web`.
3. **ReportLab Coordinate System:**
   * Origin ReportLab ada di pojok **kiri-bawah** kertas, sedangkan OpenCV dan CSS web memakai origin **kiri-atas**.
   * Konversi y: `y_pdf_pt = (PAGE_HEIGHT_MM - y_mm) * (72.0 / 25.4)`.
4. **Tailwind CSS v4:**
   * Tidak ada `tailwind.config.ts`. Semua token dan kustomisasi hidup di `@theme` blok di dalam `apps/web/src/app/globals.css`.
5. **Kapasitas LJK A4:**
   * Batas halaman saat ini: 40 PG tanpa esai, 30 PG dengan esai. Bila guru meminta 50 PG dengan esai, perlu menambah kolom ke-3 pada Pilihan Ganda di `template.py`.

---

## 8. Suggested Skills

Untuk melanjutkan pekerjaan pada repositori ini, agen berikutnya disarankan mengaktifkan keterampilan (*skills*) berikut sesuai kebutuhan:

1. **`diagnose`** — Sangat berguna saat mendiagnosis ambang batas (*threshold tuning*), kegagalan deteksi fiducial, atau warping error pada `packages/omr-engine/src/omr_engine/imaging.py`.
2. **`tdd`** — Sangat dianjurkan untuk implementasi Task 4: tulis uji pytest dengan input `synth.png` dan `truth.json` terlebih dahulu sebelum menyempurnakan fungsi deteksi dan grading.
3. **`review`** — Gunakan setelah menyelesaikan Task 4 untuk membandingkan implementasi dengan standar PRD FR-4 dan kriteria keberhasilan sebelum meminta review pengguna.
4. **`handoff`** — Gunakan skill ini kembali jika perlu menyerahkan sesi kerja ke agen berikutnya setelah Task 4 atau Task 5 selesai.
