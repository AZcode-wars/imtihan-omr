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

## [ ] Task 2 — Fase 1: Kontrak & logika murni
**Lakukan:** tipe TS `src/types/omr.ts` · **JSON Schema `ExamTemplate`** + validator · model pydantic setara · `src/lib/scoring.ts` (Mode A/B, 3 pembulatan, KKM, Lulus/Remedial) · `vitest` + test table-driven.

- **Target:** `npm test` hijau; `calculateFinalGrade` ter-cover semua kombinasi mode × pembulatan × kasus batas; `ExamTemplate` divalidasi identik dari TS dan Python.
- **Tinjau:** tabel test (apakah kasus batas tercakup: 0, 100, 2,5, 1,999, pembulatan); JSON Schema (apakah field mm & sub-bagian zona esai sesuai keputusan Opsi 1).

## [ ] Task 3 — Fase 2: Engine template & PDF
**Lakukan:** `omr/template.py` (sumber koordinat: fiducial 14/10 mm, bubble ⌀4,5 mm pitch 8,5 mm, 2 kolom, zona nama, zona esai 2 sub-bagian) · `omr/pdf.py` (ReportLab) · `omr/synth.py` (LJK sintetis + `truth.json`) · CLI `python -m omr.synth`.

- **Target:** menghasilkan `ljk.pdf` + `template.json` (valid schema) + `synth.png` + `truth.json` dari koordinat identik; pytest hijau.
- **Tinjau:** **`prototype/previews/05-ljk-a4.png` sebagai acuan tampilan** — bandingkan hasil `synth.png`/PDF dengan preview itu; cek koordinat fiducial & bubble di dalam batas kertas.

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
| | | | |
