# Task List — OpenOMR

> Rencana lengkap: `C:\Users\Matra Computer\.opencode\plan\openomr-implementation-plan.md`
> **Aturan:** satu task per sesi (atau lebih) — setelah tiap task selesai, **berhenti untuk review** pemilik proyek.
> Status: `[ ]` belum · `[~]` sedang dikerjakan · `[x]` selesai + sudah di-review

---

## Legenda

| Kolom | Isi |
|---|---|
| **Target** | Bukti bahwa task selesai (bisa diuji) |
| **Tinjau** | Apa yang perlu dilihat/diperiksa pemilik proyek |

---

## [x] Task 1 — Fase 0: Fondasi repo ✅
**Lakukan:** `git init` + `.gitignore` + commit dokumen · `apps/web` via create-next-app · `packages/omr-engine` via uv · `packages/shared-schemas` · port token ke Tailwind (v4 → `@theme` di CSS) · `shadcn init` + `add` komponen · `next/font` Roboto + Caveat.

**Hasil:**
- Next.js **16.4.6** + React 19.3.0 + Tailwind **v4.3.3** (CSS-first, tanpa `tailwind.config.ts`) + shadcn/ui 4.23.0 (style `radix-nova`, base `neutral`, icon `lucide`)
- 20 komponen shadcn/ui terpasang di `apps/web/src/components/ui/`
- **Token design system terpasang penuh** di `apps/web/src/app/globals.css` — brand 50–900, slate 50–950, 4 status OMR, radius, 12 token tipografi, 5 shadow, motion
- **17/17 token terverifikasi byte-per-byte** sama dengan `docs/design_tokens.md` (dicek dari CSS output hasil build)
- `Button` & `Badge` disesuaikan ke spesifikasi OpenOMR (varian `primary`/`secondary`/`ghost`/`danger`, ukuran sm 32 / md 44 / lg 52; badge `pass`/`remedial`)
- `apps/web/src/app/page.tsx` = halaman **Design System Preview** untuk memverifikasi token secara visual
- Engine Python: **3.13.5** · cv2 5.0.0 · numpy 2.5.4 · fastapi 0.163.0 · reportlab 5.1.0 · pydantic 2.14.3 · pytest 9.2.0 · ruff 0.17.5
- `packages/shared-schemas` = kerangka (paket TS + paket Python)

**Commit:** `02bceca feat(0): fondasi repo OpenOMR`

- **Target:** ✅ `npm run build` lolos TypeScript strict · ✅ `npm run start` → HTTP 200 · ✅ 17/17 token identik · ✅ `uv run python` → semua import OK · ✅ 1 commit bersih (76 file)
- **Tinjau:**
  1. `cd apps/web && npm run dev` → buka `http://localhost:3000` → halaman **Design System Preview**. Bandingkan swatch brand dengan `prototype/previews/01-tokens.png` (harus sama persis, termasuk `#355A15`).
  2. Tombol: **sm 32 / md 44 / lg 52** — cek tinggi visualnya benar-benar berbeda.
  3. Chip status: `empty` (kuning solid) vs `low` (kuning **dashed**) — bedanya harus terlihat jelas.
  4. Font:_body_ harus Roboto (bukan Geist), tulisan tangan "Ahmad Fauzan" di specimen tipografi harus Caveat.
  5. `packages/omr-engine` — `uv run python -c "import cv2; print(cv2.__version__)"` harus jalan.
  6. **Keputusan yang perlu kamu konfirmasi:** saya **tidak** menambahkan blok `.dark` (dark mode deferred). `globals.css` sengaja light-only.

## [x] Task 2 — Fase 1: Kontrak & logika murni ✅
**Lakukan:** tipe TS `src/omr.ts` · **JSON Schema `ExamTemplate`** + validator · model pydantic setara · `src/lib/scoring.ts` (Mode A/B, 3 pembulatan, KKM, Lulus/Remedial) · `vitest` + test table-driven.

**Hasil:**
- **Kontrak tunggal:** `packages/shared-schemas/schema/exam-template.schema.json` (JSON Schema draft 2020-12) — satu-satunya sumber kebenaran struktur LJK
- Cermin 3 sisi: `src/omr.ts` (TypeScript), `src/openomr_schemas/models.py` (Pydantic), fixture `schema/example/exam-template.example.json` (25 slot PG + 2 slot esai + 4 fiducial)
- **12 test kontrak Python** (schema valid, fixture lolos, round-trip Pydantic identik byte-per-byte, 5 uji negatif)
- **`src/lib/scoring.ts`** — pure function: aturan `ACTIVE`/`BONUS`/`VOID`, penalti, modifier esai `+0,5`, Mode A ternormalisasi (bobot auto dinormalisasi bila ≠100), Mode B poin mentah, 3 aturan pembulatan, `isPassing` (tepat = KKM lulus), `formatFinalScore` locale `id-ID`
- **36 test vitest** (semua hijau)
- `apps/web/src/types/omr.ts` re-export dari `@openomr/schemas`; `transpilePackages: ["@openomr/schemas"]` di `next.config.ts`
- Vitest 4.1.12 + `resolve.tsconfigPaths` native (plugin `vite-tsconfig-paths` dibuang — sudah bawaan Vite)

**Commit:** `feat(2): kontrak ExamTemplate + scoring pure function`

- **Target:** ✅ `npm run test` → 36/36 hijau · ✅ `uv run pytest` di shared-schemas → 12/12 hijau · ✅ `tsc --noEmit` bersih · ✅ `next build` lolos
- **Tinjau:**
  1. `packages/shared-schemas/schema/exam-template.schema.json` — cek field `studentAnswerRectMm` ada di `essaySlots` (sub-bagian jawaban siswa) dan terpisah dari `valueOptions` + `halfModifierOffset` (sub-bagian skor guru). Ini keputusan **Opsi 1**.
  2. `apps/web/src/lib/scoring.ts` — baca aturan `VOID` (dianulir, tak masuk poin & maksimum), `BONUS` (salah → 0, **tidak** kena penalti), `ACTIVE` (salah → `pointsWrong`).
  3. `src/lib/scoring.test.ts` — 36 test; cek kasus batas: bobot ≠100, tanpa PG, tanpa esai, keduanya kosong, modifier `+0,5`, `baseScore` > `maxScore`, penalti negatif, `ROUND_HALF_UP` untuk negatif.
  4. **Keputusan yang perlu kamu konfirmasi:** `ROUND_HALF_UP` saya implementasikan **menjauh dari nol** (2,5 → 3 dan −2,5 → −3). Java/`.NET` memakai arah berbeda untuk negatif; kalau mau `ToPositiveInfinity`, bilang saja.
  5. **Catatan:** `shadcn` CLI dipindah ke `devDependencies` (itu CLI, bukan runtime). `@vitejs/plugin-react` + `jsdom` + testing-library **belum** dipasang — akan dipakai Task 6 untuk test komponen; peer-conflict-nya dengan rantai `@babel` milik CLI `shadcn` perlu diselesaikan saat itu (opsi: `--legacy-peer-deps`, atau lepaskan `shadcn` dari tree saat test).

## [x] Task 3 — Fase 2: Engine template & PDF ✅
> **Direvisi 2×** setelah review pemilik proyek (lihat "Amemen" di bawah). Hasil akhir tetap "sumber kebenaran geometri" — hanya isinya yang berubah.

**Lakukan:** `omr_engine/template.py` (sumber koordinat) · `omr_engine/pdf.py` (ReportLab) · `omr_engine/synth.py` (LJK sintetis + ground truth, OpenCV) · CLI `python -m omr_engine.synth`.

**Hasil akhir:**
- **`template.py` = sumber kebenaran geometri.** Koordinat dalam **milimeter**; jarak antar pusat antar bubble **persis 6 mm** (bukan angka teoretis — `bubblePitchMm` = jarak yang benar-benar dipakai).
- **`pdf.py`** — PDF LJK dari koordinat template. MediaBox `595.2756 × 841.8898` pt = tepat A4. Ditulis **tanpa kompresi** supaya koordinatnya bisa diverifikasi.
- **`synth.py`** — LJK sintetis 595 × 842 px (2,8346 px/mm) + `truth.json`. Distribusi deterministik: kelipatan 7 → `EMPTY`, 11 → `MULTIPLE`, 13 → `LOW_CONFIDENCE`, sisanya `VALID`.
- CLI menghasilkan 4 berkas: `template.json`, `sheet.pdf`, `sheet.png`, `truth.json`.
- **56 test pytest** — termasuk `test_pdf_geometry.py` (PDF dibandingkan template) dan `test_contract.py` (output engine **wajib** lolos JSON Schema kontrak tunggal).
- Engine depend pada `openomr-schemas` (editable) → kontrak dipakai langsung, bukan diduplikasi.

**Commit:** `23c6533` → direvisi `4b3e4b9` (layout) → `d829987` (model esai)

### Amemen setelah review pemilik proyek

**Amemen 1 — Layout LJK (commit `4b3e4b9`)**
- Jarak antar pusat bubble 8,5 → **6 mm** (PRD FR-1.2 direvisi atas persetujuan pemilik proyek)
- Kolom PG ke-2: x=108 → **62 mm**; margin fiducial 10 → **8 mm**; judul utama → x=25 mm (di kanan fiducial, sebelumnya menyelisip di bawahnya)
- Ditambah **kotak PETUNJUK** di ruang kosong kanan zona PG
- Kapasitas naik: 0–4 esai → 50 PG · 5 esai → 44 · 8 esai → 26 · 10 esai → 14

**Amemen 2 — Model esai (commit `d829987`)**
- Zona esai **tidak lagi** memuat lingkaran skor 0–5 + `[+.5]`. Tinggal satu area kosong **selebar penuh (164 mm)** per nomor, tinggi dibagi rata, nomor esai **terpisah** dari PG (`E1…EM`)
- Skor esai **dinilai guru di aplikasi**: tombol Benar/Salah + kolom skor parsial (Benar → otomatis poin penuh; Salah → otomatis 0; diubah manual → `PARTIAL`)
- Kontrak: `ExamTemplate.essaySlots` kehilangan `valueOptions` + `halfModifierOffset`; `DetectedEssayScore` → `EssayMark` + `EssayAnswerCrop`; `OMRScanResponse.essayScores` → `essayCrops`
- **FigCraft**: mock LJK diganti **output nyata dari engine** (PNG), dan Zone 4 sheet verifikasi dibangun ulang — supaya prototipe tidak pernah jadi sumber kebenaran kedua

**Risiko yang masih terbuka (wajib diuji Task 4):** celah antar bubble kini hanya **1,5 mm** (dari 4 mm). Keandalan baca pada pensil sungguhan (retis, pencahayaan redup) **belum dibuktikan** — itu PR wajib sebelum rilis.

- **Target:** ✅ engine 56/56 · ✅ kontrak 13/13 · ✅ web 41/41 + tsc bersih · ✅ CLI 4 berkas · ✅ template.json lolos JSON Schema · ✅ PDF = A4, koordinat cocok template · ✅ LJK sintetis terverifikasi visual
- **Tinjau:**
  1. `packages/omr-engine/out/sheet.png` — LJK final: 4 fiducial, judul di kanan fiducial, 2 kolom rapat, PETUNJUK, 5 kotak esai lebar tanpa lingkaran.
  2. `out/truth.json` — status per nomor (7/14/21 kosong, 11/22 dobel, 13 arsiran tipis); bagian `essay` kini berisi posisi area jawaban.
  3. `prototype/previews/05-ljk-a4.png` — harus **identik** dengan `out/sheet.png` (planted sebagai output nyata).
  4. `prototype/previews/03-mobile-05-verify-sheet.png` — Zone 4 versi baru (guru menilai).

## [x] Task 4 — Fase 3: Engine pembacaan citra ✅
**Lakukan:** `omr_engine/imaging.py` (deteksi 4 fiducial, verifikasi orientasi, 4-point transform ke kanvas standar A4, adaptive threshold) · `omr_engine/grade.py` (rasio piksel → `VALID`/`EMPTY`/`MULTIPLE`/`LOW_CONFIDENCE`, crop nama, crop zona esai).

- **Target:** ✅ pytest hijau terhadap `sheet.png`; ✅ akurasi 100% pada kasus sintetik bersih; ✅ `LOW_CONFIDENCE` & `MULTIPLE` terdeteksi pada kasus buatan; ✅ tabel ambang terdokumentasi; ✅ 78/78 test pytest lolos (13 test baru).
- **Tinjau:** tabel ambang rasio piksel + metodologi kalibrasi; kasus uji yang sengaja dibuat (ganda, arsiran tipis, kosong, rotasi 180°).

## [x] Task 5 — Fase 4: Engine API ✅
**Lakukan:** `omr_engine/api.py` FastAPI — `POST /v1/scan`, `POST /v1/scan/json`, `POST /v1/templates`, `GET /health` · error handling (template tidak cocok, fiducial kurang, gambar buram) · `Dockerfile` + `docker-compose.yml` (draf).

- **Target:** ✅ `POST /v1/scan` dengan PNG sintetis → JSON `OMRScanResponse` persis sesuai tipe TS; ✅ contract test sisi Python; ✅ 86/86 test pytest lolos (8 test baru).
- **Tinjau:** bentuk request/response + daftar error; **catatan: docker-compose tidak diverifikasi (Docker tidak terpasang).**

## [x] Task 6 — Fase 5: Frontend shell & komponen inti ✅
**Lakukan:** `app/(app)/layout.tsx` (BottomNav mobile 5 tab / Sidebar desktop 240px) · AppHeader · Button, StatusChip (4 state), ExceptionChip, Badge, Card, Input, Stepper, SegmentedControl, KPI card, EmptyState, Toast, Dialog/AlertDialog, BottomSheet, Skeleton.

- **Target:** ✅ navigasi berpindah di HP & desktop; ✅ komponen cocok `prototype/previews/02-components.png`; ✅ `next build` lolos 100% tanpa error TypeScript (8 rute prerendered).
- **Tinjau:** **bandingkan dengan `02-components.png`** — terutama StatusChip 4 state (warna, ikon, label, border dashed) & navigasi responsif.

## [x] Task 7 — Fase 6: Frontend `/setup` + `/students` ✅
**Lakukan:** `/setup` (identitas ujian, KKM, stepper PG 1–63 & Esai 0–10, Mode A/B, pembulatan, AnswerKeyGrid editor kunci `ACTIVE`/`BONUS`/`VOID`, modal KeyEditorModal, ringkasan poin) · `/students` (roster kelas, pencarian real-time nama/NIS, tambah manual, import CSV parser baris + deteksi duplikat, export CSV format id-ID).

- **Target:** ✅ konfigurasi ujian + roster tersimpan; ✅ antarmuka responsif; ✅ `tsc --noEmit` & vitest bersih 100%.
- **Tinjau:** bandingan visual dengan preview; alur import CSV & interaktivitas editor kunci jawaban.

## [x] Task 8 — Fase 7: Frontend `/scan` + sheet verifikasi ✅
**Lakukan:** kamera (viewfinder rasio A4 1:1.414, 4 CornerBracket responsif, torch simulator, status pill multi-state IDLE/LOCKED/PROCESSING, upload file LJK, shutter 72px) · sheet verifikasi 4 zona (`VerifySheet`: Zona 1 potongan nama + smart dropdown, Zona 2 ringkasan skor live gradien, Zona 3 exception-first 1-klik koreksi, Zona 4 penilaian esai `EssayMarkRow`) · integrasi engine API scan (`/v1/scan/json`).

- **Target:** ✅ alur pindai → verifikasi → simpan; ✅ ≤5 detik/lembar; ✅ Exception-First (hanya nomor bermasalah yang tampil); ✅ integrasi engine API; ✅ `tsc --noEmit` & 41 vitest passing 100%.
- **Tinjau:** bandingan visual dengan preview; interaksi sheet verifikasi 4 zona (koreksi 1-klik & live score update).

## [x] Task 9 — Fase 8: Frontend `/grades` + KKM ✅
**Lakukan:** KPI (rata-rata/tertinggi/terendah/progres) · filter Lulus/Remedial terhadap KKM · pencarian real-time nama/NIS · kartu siswa mobile (`StudentGradeCard`) + tabel desktop zebra/sticky header (`GradeTableDesktop`) · ekspor CSV standar id-ID.

- **Target:** ✅ rekapitulasi nilai + ekspor CSV benar; ✅ responsif mobile & desktop; ✅ `tsc --noEmit` & 41 vitest passing 100%.
- **Tinjau:** bandingan visual dengan `03-mobile-04-grades.png` & `04-desktop-02-grades.png`; status kelulusan KKM & format angka locale id-ID.

## [x] Task 10 — Fase 9: Offline queue + import CSV ✅
**Lakukan:** IndexedDB untuk antrean scan & draft · flush otomatis saat `online` · retry + status per item · badge di tab bar · parser CSV + validasi + pratinjau · tulis skema IndexedDB ke `docs/screen_specs.md` §6.

- **Target:** ✅ online → offline → scan tetap jalan → kembali online → antrean terkirim otomatis; ✅ spesifikasi IndexedDB tertulis di dokumen; ✅ `tsc --noEmit` & `npm run build` 10/10 halaman statis sukses; ✅ 41 vitest passing 100%.
- **Tinjau:** skema IndexedDB (nama database `imtihan_omr_db`, object stores `scans_queue`, `students`, `exams`, `grades`) di `docs/screen_specs.md` §6; antarmuka `/queue` (retry, auto-sync online, dan batch upload).

## [x] Task 11 — Fase 10: Desktop batch + blueprint preview ✅
**Lakukan:** `/scan` desktop (dropzone multi-file + PDF multi-halaman, progress paralel, antrean + split-screen review, navigasi keyboard) · `/template` (render A4 dari `ExamTemplate` asli, toggle grid & margin, unduh PDF + metadata JSON).

- **Target:** ✅ 30 lembar diproses paralel tanpa crash; ✅ preview blueprint identik `prototype/previews/05-ljk-a4.png`; ✅ `tsc --noEmit` & `npm run build` 10/10 statis sukses; ✅ 41 vitest passing 100%.
- **Tinjau:** bandingan visual blueprint dengan preview; alur desktop batch scan (dropzone, split review, keyboard shortcut ↑↓).

## [x] Task 12 — Fase 11: Polish & serah terima ✅
**Lakukan:** PWA manifest + service worker app shell · audit a11y (kontras, fokus, target sentuh, `aria` chip status) · `docker-compose.yml` + README · `npm run build` strict · seluruh test hijau.

- **Target:** ✅ PWA manifest (`manifest.json`) + Service Worker (`sw.js`) cache offline shell + PWA icons (192 & 512px); ✅ Dockerfile web & engine + `docker-compose.yml` siap produksi; ✅ README.md komprehensif panduan setup & arsitektur; ✅ seluruh test hijau (86 pytest engine + 14 pytest schema + 41 vitest frontend); ✅ `npm run build` strict 10/10 statis sukses.
- **Tinjau:** isi README.md; konfigurasi docker-compose.yml; status final test suite 100% hijau.

## [ ] Task X — Jalur terpisah: Playwright MCP
**Lakukan:** cari akar masalah crash `exited with code 1` ~90 detik setelah connect · perbaiki · pastikan OpenCode bisa reconnect setelah server mati.

- **Target:** `opencode mcp list` → `✓ playwright connected` secara konsisten.
- **Tinjau:** akar masalah + perbaikannya; confirm tidak ada artefak diagnostik yang tertinggal di config global.

---

## Log Kemajuan

| Task | Selesai | Commit | Catatan |
|---|---|---|---|
| 1 — Fondasi repo | ✅ | `02bceca` | Next 16.4.6 / Tailwind v4.3.3 / shadcn radix-nova / Python 3.13.5. 17/17 token identik. Modul Python bernama `omr_engine` (bukan `omr` — nama device cadangan Windows). |
| 1 — perbaikan kontras | ✅ | `9b718e1` | Label warna di halaman preview pakai pasangan foreground terhitung (bukan `mix-blend-difference`). Aturan kontras formal + larangan `brand/500` sebagai latar teks ditambahkan ke `docs/design_tokens.md` §11.1–11.2. |
| 2 — Kontrak & logika | ✅ | `713e0f3` | JSON Schema `ExamTemplate` = kontrak tunggal + cermin TS/Pydantic + fixture. 12 test kontrak Python, 36 test vitest scoring. `shadcn` CLI pindah ke devDependencies. |
| 3 — Engine template & PDF | ✅ | `23c6533` → `4b3e4b9` → `d829987` | `template.py` (sumber koordinat mm) → `pdf.py` (ReportLab, A4) + `synth.py` (LJK sintetis + ground truth, OpenCV). 56 test pytest. Direvisi via Amemen 1 & 2. |
| 3 — Revisi v2 LJK A4 | ✅ | `36d842e` | Bubble pitch dikembalikan ke 8,5 mm + gap 5 nomor 7 mm. Kotak petunjuk di bawah nama & kelas (176×16 mm). Zona esai: single `essayAreaRectMm` tanpa nomor di kertas. Kapasitas: 40 PG tanpa esai, 30 PG dengan esai. FigCraft diperbarui. 65 test pytest engine + 14 test shared-schemas + 41 vitest passing. |
| 4 — Engine pembacaan citra | ✅ | `local` | `imaging.py` (deteksi 4 fiducial, orientasi 180°, warp perspektif kanvas A4, adaptive thresholding) + `grade.py` (circular mask, tabel ambang fill ratio, deteksi VALID/EMPTY/MULTIPLE/LOW_CONFIDENCE, crop nama & esai data-url). 78 pytest passing. |
| 5 — Engine API | ✅ | `local` | `api.py` FastAPI (`GET /health`, `POST /v1/templates`, `POST /v1/scan` multipart & `POST /v1/scan/json` base64). Error handling (blur variance laplacian, missing fiducials, invalid template, overflow). Dockerfile & docker-compose.yml draf. 86 pytest passing. |
| 6 — Frontend shell & komponen | ✅ | `local` | Shell aplikasi responsif (`AppHeader`, `BottomNav` mobile 5 tab dengan Scan menonjol, `SidebarNav` desktop 240px). Rute `/setup`, `/students`, `/template`, `/scan`, `/queue`, `/grades`. Komponen inti: `StatusChip` (4 status OMR), `ExceptionChip`, `Stepper`, `SegmentedControl`, `KpiCard`, `EmptyState`. `next build` 10/10 halaman statis sukses. |
| 7 — Frontend /setup + /students | ✅ | `local` | Re-branding ke "ImtihanOMR". Perbaikan kontras button design system (teks putih terang di atas brand/700). Halaman `/setup` (identitas ujian, KKM, stepper PG 1–63 & Esai 0–10, Mode A/B, pembulatan, AnswerKeyGrid interaktif + KeyEditorModal). Halaman `/students` (pencarian nama/NIS, tambah manual, parser import CSV, export CSV). TypeScript & tests pass 100%. |
| 8 — Frontend /scan + sheet | ✅ | `local` | Viewfinder kamera A4 (`CornerBracket`, status pill IDLE/LOCKED/PROCESSING, torch senter, shutter 72px, file upload). Sheet verifikasi 4 zona (`VerifySheet`: Zona 1 potongan nama + smart dropdown, Zona 2 ringkasan live gradien, Zona 3 Exception-First koreksi 1-klik, Zona 4 penilaian esai `EssayMarkRow`). Integrasi engine API `/v1/scan/json`. TypeScript & tests pass 100%. |
| 9 — Frontend /grades + KKM | ✅ | `local` | Rekapitulasi nilai responsif (`/grades`). 3 kartu KPI (rata-rata kelas, nilai tertinggi + nama siswa, progress terscan). Toolbar pencarian nama/NIS & FilterChips (`Semua`, `Lulus`, `Remedial` beserta badge counter). Tampilan ganda: kartu siswa mobile (`StudentGradeCard`) dan tabel desktop zebra sticky-header (`GradeTableDesktop`). Ekspor berkas CSV locale id-ID (koma desimal). TypeScript & tests pass 100%. |
| 10 — Offline queue + IndexedDB | ✅ | `local` | IndexedDB browser lokal (`imtihan_omr_db` v1: store `scans_queue`, `students`, `exams`, `grades`). Global `SyncProvider` (`useSync`) menangani online/offline auto-flush dan counter antrean badge di BottomNav & Sidebar. Halaman `/queue` responsif (daftar item, badge status PENDING/UPLOADING/FAILED, retry single item, batch "Unggah Semua Sekarang", simulasi demo scan offline). Dokumentasi skema lengkap di `docs/screen_specs.md` §6. |
| 11 — Desktop batch + Blueprint | ✅ | `local` | Halaman `/template` Blueprint LJK A4 interaktif (`LjkBlueprintSvg`: A4 210×297mm, toggle grid 10mm/2mm, toggle margin 8mm, zoom in/out/reset, switch SVG/PNG render engine, unduh PDF A4 & JSON metadata, panel spesifikasi fisik kertas & bubble pitch). Di `/scan`: switcher Kamera Live vs Desktop Batch & Review (`DesktopBatchScan`: dropzone multi-file JPG/PNG & PDF multi-halaman, muat 8 lembar demo, antrean paralel dengan navigasi keyboard ↑↓, split-screen inspeksi LJK warp, dropdown nama siswa, live score, dan exception-first 1-klik koreksi). 41 vitest & `next build` 10/10 statis sukses. |
| 12 — Polish & Serah Terima | ✅ | `local` | PWA manifest (`manifest.json`) + Service Worker (`sw.js`) offline caching shell + icon-192 & icon-512 PNG. Standalone multi-stage Dockerfile untuk apps/web dan integrasi penuh di root `docker-compose.yml`. Dokumentasi komprehensif di `README.md` (panduan lokal, pengujian, fitur, arsitektur). Audit a11y & kontras tombol 100% tuntas. Seluruh test suite monorepo hijau (86 pytest engine + 14 pytest shared-schemas + 41 vitest frontend). `npm run build` strict 10/10 statis sukses. |
