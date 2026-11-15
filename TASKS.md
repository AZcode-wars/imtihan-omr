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
**Lakukan:** `omr_engine/template.py` (sumber koordinat) · `omr_engine/pdf.py` (ReportLab) · `omr_engine/synth.py` (LJK sintetis + ground truth, OpenCV) · CLI `python -m omr_engine.synth`.

**Hasil:**
- **`template.py` = sumber kebenaran geometri.** Semua koordinat dalam **milimeter**, jarak antar pusat antar bubble **persis 8,5 mm** (bukan angka teoretis — `bubblePitchMm` = jarak yang benar-benar dipakai). Menghasilkan dict yang valid menurut JSON Schema kontrak.
- **`pdf.py`** — PDF LJK dari koordinat template. MediaBox `595.2756 × 841.8898` pt = tepat A4. Ditulis **tanpa kompresi** supaya koordinatnya bisa diverifikasi.
- **`synth.py`** — LJK sintetis 840 × 1188 px (4 px/mm) + `truth.json`. Distribusi deterministik: kelipatan 7 → `EMPTY`, 11 → `MULTIPLE`, 13 → `LOW_CONFIDENCE`, sisanya `VALID`; skor esai 0–5 + modifier `+0,5`.
- CLI menghasilkan 4 berkas: `template.json`, `sheet.pdf`, `sheet.png`, `truth.json`.
- **45 test pytest** — termasuk `test_pdf_geometry.py` yang **membandingkan PDF dengan template**: posisi 4 fiducial & 5 kotak jawaban esai harus cocok, dan jumlah kurva ≥ jumlah lingkaran.
- Engine sekarang depend pada `openomr-schemas` (editable) → kontrak benar-benar dipakai, bukan diduplikasi.

**Commit:** `feat(3): engine template + PDF + LJK sintetis`

**Temuan produk yang perlu kamu putuskan:**
> **Tidak semua kombinasi jumlah soal muat di satu halaman A4.** Dengan jarak antar pusat 8,5 mm (PRD FR-1.2), batasnya: **0 esai → 50 PG · 5 esai → 30 PG · 10 esai → 10 PG**. Kombinasi lebih besar **ditolak sistem** dengan pesan actionable. Layar `/setup` (Task 6) wajib menampilkan batas ini sebelum guru mencetak. Dokumentasi sudah masuk `docs/screen_specs.md` §8 dan PRD FR-1.1.
> Kalau ini tidak bisa diterima, alternatifnya **dua halaman** (butuh dukungan multi-page di template, engine, dan pratinjau) — itu keputusan produk, bukan teknis.

**Bug yang ketemu & diperbaiki saat pengerjaan:**
- Zona esai dipaksa mulai di y=164 → ruang 78 mm terbuang. Sekarang menempel di bawah zona PG + celah.
- Kompresi tata letak bisa membuat **kotak jawaban esai saling tumpang tindih** (tinggi 16 mm, jarak 14 mm). Sekarang jarak antar blok **wajib ≥ tinggi kotak + 4 mm**.
- Batas bawah konten awalnya 282 mm → konten bisa menabrak pita fiducial bawah (277–287 mm). Sekarang 272 mm.
- Judul "II. ZONA SKOR ESAI" menabrak baris PG 13. Sekarang posisinya relatif terhadap zona esai.
- **Kotak "KELAS / NO. ABSEN" digambar di PDF tapi tidak di LJK sintetis** — sekarang keduanya pakai konstanta yang sama (`CLASS_BOX_RECT_MM` di `template.py`).

- **Target:** ✅ `uv run pytest` → 45/45 hijau · ✅ CLI menghasilkan 4 berkas · ✅ `template.json` lolos JSON Schema · ✅ PDF = A4, 1 halaman, koordinat cocok template · ✅ LJK sintetis terverifikasi visual
- **Tinjau:**
  1. `packages/omr-engine/out/sheet.png` — bandingkan dengan `prototype/previews/05-ljk-a4.png`. Seharusnya ada: 4 fiducial (kiri-atas lebih besar), zona nama, 2 kolom 25 PG, 5 blok esai dengan kotak tulis + 6 lingkaran + `[.5]`.
  2. `out/truth.json` — cek status per nomor (7/14/21 kosong, 11/22 dobel, 13 arsiran tipis).
  3. `src/omr_engine/template.py` — baca `compute_layout()`: urutan kompresi (tinggi kotak lalu jarak antar blok) dan syarat `pitch >= tinggi + 4`.
  4. `src/omr_engine/synth.py` — `plan_answers()` menentukan ground truth; Task 4 akan menguji engine terhadap file ini.

## [ ] Task 4 — Fase 3: Engine pembacaan citra
**Lakukan:** `omr/imaging.py` (deteksi 4 fiducial, verifikasi orientasi, 4-point transform ke 800×1100, adaptive threshold) · `omr/grade.py` (rasio piksel → `VALID`/`EMPTY`/`MULTIPLE`/`LOW_CONFIDENCE`, baca zona esai, crop nama).

- **Target:** pytest hijau terhadap `synth.png`; akurasi 100% pada kasus sintetik bersih; `LOW_CONFIDENCE` & `MULTIPLE` terdeteksi pada kasus buatan; tabel ambang terdokumentasi.
- **Tinjau:** tabel ambang rasio piksel + metodologi kalibrasi; kasus uji yang sengaja dibuat (ganda, arsiran tipis, kosong).

## [ ] Task 5 — Fase 4: Engine API
**Lakukan:** `omr/api.py` FastAPI — `POST /v1/scan`, `POST /v1/templates`, `GET /health` · error handling (template tidak cocok, fiducial kurang, gambar buram) · `Dockerfile` + `docker-compose.yml` (draf).

- **Target:** `POST /v1/scan` dengan PNG sintetis → JSON `OMRScanResponse` persis sesuai tipe TS; contract test sisi Python.
- **Tinjau:** bentuk request/response + daftar error; **catatan: docker-compose tidak diverifikasi (Docker tidak terpasang).**

## [ ] Task 6 — Fase 5: Frontend shell & komponen inti
**Lakukan:** `app/(app)/layout.tsx` (BottomNav mobile 5 tab / Sidebar desktop 240px) · Button, StatusChip (4 state), Badge, Card, Input, NumberField, Stepper, SegmentedControl, Slider, KPI card, Toast, Dialog/AlertDialog, BottomSheet, Skeleton, EmptyState.

- **Target:** navigasi berpindah di HP & desktop; komponen cocok `prototype/previews/02-components.png` (selisih ≤2px).
- **Tinjau:** **bandingkan dengan `02-components.png`** — terutama StatusChip 4 state (warna, ikon, label, border dashed).

## [ ] Task 7 — Fase 6: Frontend `/setup` + `/students`
**Lakukan:** `/setup` (identitas, KKM, stepper PG 1–50 & Esai 0–10, Mode A/B, pembulatan, editor kunci `ACTIVE`/`BONUS`/`VOID`, ringkasan poin) · `/students` (roster, tambah manual, import CSV + preview validasi, export CSV).

- **Target:** configuring ujian + roster tersimpan; cocok `03-mobile-01-setup.png` & `03-mobile-02-students.png`.
- **Tinjau:** bandingan visual dengan kedua preview; alur import CSV (validasi per baris, baris invalid bisa di-skip).

## [ ] Task 8 — Fase 7: Frontend `/scan` + sheet verifikasi
**Lakukan:** kamera (viewfinder A4, corner bracket, torch, auto-capture ±0,5 d + haptic, IDLE/LOCKED/PROCESSING/OFFLINE_QUEUED, izin ditolak) · sheet verifikasi 4 zona · dialog konfirmasi timpa · unggah ke engine.

- **Target:** alur pindai → verifikasi → simpan; **≤5 detik/lembar**; cocok `03-mobile-03-scan-camera.png` & `03-mobile-05-verify-sheet.png`.
- **Tinjau:** bandingan visual dengan kedua preview; Exception-First (hanya nomor bermasalah yang tampil); integrasi engine (respons nyata, bukan mock).

## [ ] Task 9 — Fase 8: Frontend `/grades` + KKM
**Lakukan:** KPI (rata-rata/tertinggi/terendah/progres) · filter Lulus/Remedial terhadap KKM · pencarian · kartu mobile + tabel desktop (sticky header, zebra) · export CSV id-ID.

- **Target:** rekap + CSV benar; cocok `03-mobile-04-grades.png` & `04-desktop-02-grades.png`.
- **Tinjau:** bandingan visual; logika KKM (Mode A: persen, Mode B: poin) + badge Lulus/Remedial.

## [ ] Task 10 — Fase 9: Offline queue + import CSV
**Lakukan:** IndexedDB untuk antrean scan & draft · flush otomatis saat `online` · retry + status per item · badge di tab bar · parser CSV + validasi + pratinjau · tulis skema IndexedDB ke `docs/screen_specs.md` §6.

- **Target:** online → offline → scan tetap jalan → kembali online → antrean terkirim otomatis; spesifikasi IndexedDB tertulis di dokumen.
- **Tinjau:** skema IndexedDB (nama store, indeks, versi) — ini yang belum pernah ada di dokumen mana pun; perilaku retry.

## [ ] Task 11 — Fase 10: Desktop batch + blueprint preview
**Lakukan:** `/scan` desktop (dropzone multi-file + PDF multi-halaman, progress paralel, antrean + split-screen review, navigasi keyboard) · `/template` (render A4 dari `ExamTemplate` asli, toggle grid & margin, unduh PDF + metadata JSON).

- **Target:** 30 lembar diproses paralel tanpa crash; preview blueprint identik `prototype/previews/05-ljk-a4.png`.
- **Tinjau:** bandingan visual blueprint dengan preview; perilaku multi-halaman PDF.

## [ ] Task 12 — Fase 11: Polish & serah terima
**Lakukan:** PWA manifest + service worker app shell · audit a11y (kontras, fokus, target sentuh, `aria` chip status) · `docker-compose.yml` + README · `npm run build` strict · seluruh test hijau.

- **Target:** Lighthouse ≥90 (PWA & a11y); semua test hijau; README memuat cara jalankan lokal + catatan docker belum terverifikasi.
- **Tinjau:** hasil audit a11y; isi README; daftar final test.

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
| 3 — Engine template & PDF | ✅ | `feat(3)` | `template.py` (sumber koordinat mm) → `pdf.py` (ReportLab, A4) + `synth.py` (LJK sintetis + ground truth, OpenCV). 45 test pytest, termasuk PDF-vs-template. Kapasitas halaman ditemukan: 0 esai → 50 PG, 5 esai → 30 PG, 10 esai → 10 PG. |
| | | | |
