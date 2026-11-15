# OpenOMR — Spesifikasi Layar

> Token: `design_tokens.md` · Komponen: `components.md` · Konteks: `ui_brief_ai_agent_specification_openomr.md`

---

## 0. Peta Layar

```
PERSIAPAN ─────────────► PEMINDAIAN ─────────────► HASIL
 ① /setup                ③ /scan  (mobile)          ⑦ /grades
 ② /students             ④ /scan  (desktop batch)
 ⑧ /template             ⑤ /verify (sheet verifikasi)
                         ⑥ /queue  (antrean offline)
```

| # | Layar | Rute | Mobile | Desktop | Tab |
|---|---|---|---|---|---|
| ① | Ujian & Aturan | `/setup` | ✓ | ✓ | 1 |
| ② | Kelas & Siswa | `/students` | ✓ | ✓ | 2 |
| ③ | Scan LJK — Kamera | `/scan` | ✓ | — | 3 |
| ④ | Scan LJK — Batch & Review | `/scan` | — | ✓ | 3 |
| ⑤ | Verifikasi Cepat | sheet di atas ③/④ | ✓ | panel kanan | — |
| ⑥ | Antrean Offline | `/queue` | ✓ | ✓ | 4 |
| ⑦ | Rekap Nilai | `/grades` | ✓ | ✓ | 5 |
| ⑧ | Blueprint LJK A4 | `/template` | ✓ (sheet) | ✓ (halaman) | — |

**Navigasi mobile (5 tab):** `Ujian · Kelas · [⬤ SCAN] · Antrean · Nilai`
**Navigasi desktop (sidebar 240px):** `Ujian & Aturan · Kelas & Siswa · Blueprint LJK · Scan LJK · Antrean Offline · Rekap Nilai`

Layar ⑧ dan ⑥ punya entri di sidebar desktop, sedangkan di mobile keduanya adalah **sheet** yang dipicu dari konteksnya (Blueprint dari ①, Antrean dari ③). Alasannya: keduanya tidak pernah dibutuhkan tanpa konteks ujian/scan yang sedang berjalan.

---

## ① `/setup` — Ujian & Aturan

**Tujuan:** guru menyiapkan satu ujian dari nol sampai LJK siap cetak.

```
┌──────────────────────────────────────┐
│ ‹ Ujian & Aturan                     │
├──────────────────────────────────────┤
│ IDENTITAS UJIAN          A4 • 2 KOLOM│
│ ┌──────────────────────────────────┐ │
│ │ Judul ujian                     │ │
│ │ [UTS Matematika - Kelas 8A    ] │ │
│ │ Kelas          [ 8A          ▾ ] │ │
│ │ KKM            [ 75 ]            │ │
│ └──────────────────────────────────┘ │
│ STRUKTUR SOAL DINAMIS  [📄 Pratinjau LJK A4]│
│ ┌──────────────────────────────────┐ │
│ │ Pilihan Ganda (A–D)  │ Esai      │ │
│ │ [−]   25   [+]      │ [−] 5 [+] │ │
│ │ Maks. 50 soal/lembar │ 0–5 & +.5 │ │
│ └──────────────────────────────────┘ │
│ ATURAN PEMBOBOTAN NILAI              │
│ ┌──────────────────────────────────┐ │
│ │ (● Mode A: Persentase)(○ Mode B)│ │
│ │ Bobot PG: 60%    Bobot Esai: 40%│ │
│ │ [━━━━●━━━━━━━━━━]               │ │
│ │ 100% Esai   50:50   100% PG     │ │
│ │ ─────────────────────────────── │ │
│ │ Pembulatan  (EXACT_2_DECIMAL)   │ │
│ └──────────────────────────────────┘ │
│ KUNCI JAWABAN PG                      │
│ ┌────┐┌────┐┌────┐┌────┐┌────┐    │
│ │ 1 A││ 2 B││ 3 C⁺││ 4 D││ 5 A│    │
│ └────┘└────┘└────┘└────┘└────┘    │
│ Total: 30 soal · maks 40 poin        │
│ [ 📷 Simpan Aturan & Mulai Scan ]    │
└──────────────────────────────────────┘
```

### Section & komponen

| Section | Isi | Komponen |
|---|---|---|
| Identitas Ujian | Judul (text), Kelas (select dari roster), **KKM** (number) | TextField, Select, NumberField |
| Struktur Soal | Stepper PG (1–50), Stepper Esai (0–10) | Stepper |
| Aturan Pembobotan | SegmentedControl Mode A/B + panel sesuai mode | SegmentedControl, Slider, NumberField |
| Pembulatan | SegmentedControl 3 opsi | SegmentedControl |
| Kunci Jawaban PG | Grid chip per nomor | AnswerKeyGrid |
| Ringkasan | Total soal & total poin maksimal | `label` `slate/500` |
| CTA | "Simpan Aturan & Mulai Scan LJK" | Button `primary` `lg` |

### Perilaku mode pembobotan

- **Mode A (Persentase):** dua slider yang saling mengunci, total selalu 100%. Label PG `brand/700`, Esai `amber/700`.
- **Mode B (Poin Langsung):** ganti slider dengan dua NumberField — *Poin per PG Benar* (default 1) dan *Poin Maks per Esai* (default 5) — plus bar "Total Skor Maksimal Ujian: 40 poin".

> **Koreksi terhadap prototipe HTML:** prototipe offering "Maks Poin per Esai" 10/25, padahal zona LJK hanya menyediakan lingkaran 0–5 (PRD FR-1.5). Nilai dibatasi **0–5**, dan `maxScore` per soal esai sudah ada di tipe data (`EssayQuestionConfig.maxScore`, default 5).

### Perilaku kunci jawaban PG

Ketuk chip → sheet pilihan: 4 opsi A–D + tombol **Kosong** + pengalih status `ACTIVE` / `BONUS` / `VOID`.

Penandaan status (PRD FR-2.3) langsung terlihat di grid:
- `BONUS` → superscript `⁺` di kanan atas kunci
- `VOID` → coretan diagonal + kunci dicoret `slate/400`
- `ACTIVE` → tanpa penanda

### Ringkasan bawah
`Total: 30 soal · maks 40 poin` — `label` 13/18, `slate/500`.

---

## ② `/students` — Kelas & Siswa

**Tujuan:** mengelola roster kelas. Diperlukan karena FR-5.1 memfilter dropdown berdasarkan daftar siswa — tanpa layar ini, data tidak pernah masuk.

```
┌──────────────────────────────────────┐
│ ‹ Kelas & Siswa              [+ Siswa]│
├──────────────────────────────────────┤
│ Kelas  [ 8A              ] [✎]      │
│ 32 siswa                             │
│ 🔍 Cari nama atau NIS...              │
│ ┌──────────────────────────────────┐ │
│ │ ● Ahmad Fauzi       2401      ⋮  │ │
│ │ ● Nadia Putri Rahma 2402     ⋮  │ │
│ │ ● Dimas Pratama    2403      ⋮  │ │
│ └──────────────────────────────────┘ │
│ [ Import CSV ]      [ Export CSV ]   │
└──────────────────────────────────────┘
```

### Komponen

| Bagian | Spesifikasi |
|---|---|
| Header | `h1` + tombol `secondary` "Tambah Siswa" |
| Panel kelas | Nama kelas (TextField, `bg slate/50`) + jumlah siswa `label` `slate/500` |
| Pencarian | SearchField, `bg white` |
| Daftar siswa | `bg white`, `radius/lg`, border 1px `slate/200/80`; tiap baris tinggi 56: titik 8px (abu = belum discan, `brand/400` = sudah discan), nama `bodyStrong`, NIS `caption` `slate/400` rata kanan, tombol `⋮` 44×44 |
| Aksi | `Import CSV` (`secondary`), `Export CSV` (`ghost`) |

### Import CSV — alur

1. Ketuk **Import CSV** → dialog (mobile) / panel kanan (desktop).
2. Pilih atau tarik file `.csv`.
3. **Pratinjau hasil parse**: tabel `No | Nama | NIS | Status`. Baris invalid ditandai `bg rose/50` dengan teks `rose/800`:
   - nama kosong → "Nama wajib diisi"
   - NIS duplikat dalam file atau sudah ada di kelas → "NIS sudah terdaftar"
   - jumlah kolom ≠ 2 → "Format kolom tidak sesuai"
4. Baris invalid punya checkbox tercentang otomatis; guru bisa decide included/excluded.
5. Footer: jumlah valid, tombol **Impor N Siswa** (`primary`, disabled bila 0 valid).

**Format CSV:** `nama,nis` — header baris pertama opsional (dilewati bila nilainya `nama`).

### Empty state
`Belum ada siswa di kelas ini.` + `Tambahkan manual atau import dari CSV.` + tombol `secondary` "Import CSV".

---

## ③ `/scan` — Kamera (Mobile `< 1024px`)

**Tujuan:** menangkap LJK secepat mungkin — target ≤ 5 detik per lembar (PRD Success Metrics).

```
┌──────────────────────────────────────┐
│ [24/30]              [Demo LJK] [🔦] │ ← overlay atas
│                                      │
│    ┌ ─                        ─ ┐    │
│    │                          │    │ ← bingkai A4 (1:1.414)
│    │                          │    │
│    └ ─                        ─ ┘    │
│                                      │
│      ✓ 4 Sudut Terdeteksi • Siap Capture│ ← status pill
│                                      │
│                                      │
│            (  ◯  )                   │ ← shutter 72px
│                                      │
│        [ Scan Manual ]               │
├──────────────────────────────────────┤
│  Ujian    Kelas   ⬤ Scan   Antrean  Nilai │
└──────────────────────────────────────┘
```

### Struktur

| Bagian | Spesifikasi |
|---|---|
| Overlay atas | `absolute top-12 left-12 right-12`, `z-20`, `flex justify-between` |
| Kiri | ProgressBadge: titik `brand/400` + "Terscan: **24/30** Siswa" |
| Kanan | Tombol "Demo LJK" (onDark) + IconButton torch (onDark) |
| Area viewfinder | `flex-1`, `bg slate/950`, konten di tengah |
| Bingkai | 4 CornerBracket, rasio 1:1.414, lebar maks 325px |
| Status pill | di bawah bingkai, `bottom-12` |
| Action bar | `bg slate/900/95`, border atas 1px `white/10`, `px-20 pt-14 pb-16`, di atas tab bar |
| Shutter | 72×72, tengah |
| Tombol manual | `ghost` `onDark`, `label` 11/14 `slate/400` — "Di kelas, kamera otomatis memotret saat 4 sudut stabil ±0.5 detik" |

### State machine

| State | Sudut | Status pill | Shutter | Catatan |
|---|---|---|---|---|
| `IDLE` | `white/60` | "Arahkan kamera ke 4 kotak sudut LJK" — ikon `info` `slate/300` | redup | — |
| `LOCKED` | `brand/400` | "4 Sudut Terdeteksi • Siap Capture" — ikon `check-circle-2` `brand/300` | aktif + glow | transisi `motion/base` |
| `PROCESSING` | `brand/400` | spinner + "Memproses…" | disabled `opacity 40` | overlay `bg slate/950/40` |
| `OFFLINE_QUEUED` | `brand/400` | ConnectionBadge → "Offline · 3" | aktif | foto masuk IndexedDB, toast konfirmasi |

Auto-capture: saat `LOCKED` bertahan ±0.5 detik → shutter berdenyut + `navigator.vibrate(50)` + kilau hijau 200ms → `PROCESSING`.

**Izin kamera ditolak** → viewfinder menampilkan empty state `camera-off` "Izin kamera diperlukan" + tombol `primary` "Aktifkan Kamera" (tautan ke pengaturan browser).

### Gaya visual
Latar `slate/950`. Tidak ada garis laser bergerak (keputusan "kalem"). Tombol senter menyala → overlay `bg amber/100/15` + `mix-blend-mode: screen`, tombol berubah jadi `bg amber/400` ikon `slate/950`.

---

## ④ `/scan` — Batch & Review (Desktop `≥ 1024px`)

```
┌────────┬───────────────────────┬──────────────────────────────┐
│        │ ANTREAN (30)          │ INSPEKSI LJK                  │
│        │ ┌───────────────────┐ │ ┌──────────────────────────┐ │
│ Sidebar│ │▣ 01 Ahmad F.   ⚠2 │ │ │   [gambar LJK lurus]    │ │
│ 240px  │ │▣ 02 Budi S.    ✓  │ │ │                          │ │
│        │ │▣ 03 Citra D.   ⚠1 │ │ └──────────────────────────┘ │
│        │ │▣ 04 Dimas P.   ✓  │ │ Nama: [Ahmad Fauzi     ▾]  │
│        │ └───────────────────┘ │ ┌──────────────────────────┐ │
│        │ Memproses 12/30 ▓▓▓░ │ │ ⚠ 7  [A][B][C][D][Kosong]│ │
│        │                       │ │ E1 ✓Benar  [5]  ✗Salah    │ │
└────────┴───────────────────────┴──────────────────────────────┘
```

### Panel kiri — Antrean

| Property | Spesifikasi |
|---|---|
| Lebar | 320px |
| Header | `overline` "ANTREAN (30)" + ProgressBar + label "Memproses 12 dari 30 lembar" |
| Baris | tinggi 56, `bg white`, border 1px `slate/200/80`, `radius/md`, `mb-8`; thumbnail 32×32 `radius/sm`; nama `bodyStrong` 13/18; flag warning berupa badge `amber/600` berisi jumlah |
| Selected | `bg brand/50`, border `brand/700`, bar kiri 3px `brand/700` |
| Selesai tanpa masalah | ikon `check-circle-2` `brand/600` |
| Navigasi keyboard | `↑` `↓` pindah lembar, `Enter` pilih |

### Panel kanan — Inspeksi

1. **Gambar LJK lurus** (`fullWarpedImageUrl`) — `radius/md`, border 1px `slate/200`, `max-h` 420px, `object-contain`.
2. **Potongan nama** (`studentNameCropUrl`) — 96×40, `radius/sm`, border 1px `slate/200`, `bg white`.
3. **Dropdown nama** — Select §10, hanya menampilkan siswa yang belum discan.
4. **Koreksi nomor bermasalah** — chip list; chip yang diketuk membuka inline editor yang sama dengan §⑤.
5. **Editor skor esai** — ScoreStepper per nomor dalam `grid-cols-2`.
6. **CTA sticky** — "Simpan & Lanjut ke Lembar Berikutnya" (`primary` `lg`).

### Tahap 1 — Dropzone
`/scan` dibuka dalam keadaan kosong menampilkan Dropzone (§26). Setelah file masuk, panel kanan berubah ke Welcome / instruksi, panel kiri terisi antrean.

---

## ⑤ Sheet Verifikasi Cepat

**Tujuan:** satu layar untuk mengenali siswa, membaca skor, dan mengoreksi yang perlu — tanpa keluar dari layar scan.

```
┌──────────────────────────────────────┐
│              ▬                        │ ← handle
│ ● Verifikasi Hasil Scan           ✕  │
├──────────────────────────────────────┤
│ POTONGAN TULISAN NAMA      [Sisa 6]  │
│ ┌──────────────────────────────────┐ │
│ │ NAMA SISWA:                     │ │
│ │ Ahmad Fauzan        (Caveat 28)  │ │
│ │                          [8A]    │ │
│ └──────────────────────────────────┘ │
│ Cocokkan Nama Siswa di Daftar Kelas:  │
│ [ Ahmad Fauzan                   ▾ ] │
├──────────────────────────────────────┤
│ ╔══════════════════════════════════╗ │
│ ║ Ringkasan Skor Terbaca           ║ │
│ ║ PG: 22/25   Esai: 18,5/25        ║ │
│ ║                    NILAI AKHIR    ║ │
│ ║                       82,4        ║ │
│ ╚══════════════════════════════════╝ │
├──────────────────────────────────────┤
│ ⚠ Perlu Dicek (2 Nomor)  Tap untuk  │
│   koreksi 1-klik                    │
│ [⊘ 7 kosong] [⚠ 23 · 52%]           │
│ ┌──────────────────────────────────┐ │
│ │ Koreksi Soal No. 23  [perlu dicek]│ │
│ │ Crop LJK:  (A)(B)(C)(D)  Kunci: C│ │
│ │ [ A ][ B ][ C ][ D ][ Kosong ]   │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ Skor Esai — diisi guru               │
│ ┌──────────┐┌──────────────────────┐  │
│ │crop tulis││ E1 [✓Benar] [✗Salah] │  │
│ │ tangan   ││    nilai: [5]         │  │
│ └──────────┘└──────────────────────┘  │
├──────────────────────────────────────┤
│ [ Simpan & Scan Berikutnya      → ]  │ ← sticky
└──────────────────────────────────────┘
```

### Zona 1 — Identifikasi Siswa
- Label `overline` "POTONGAN TULISAN NAMA (AUTO-CROP)" + badge `Sisa 6 siswa` (`brand/50`, teks `brand/700`).
- Kotak crop: `bg #FCFCF9`, **border 1px dashed `slate/300`**, `radius/md`, `px-14 py-8`, `shadow-inner`.
  - Label "NAMA SISWA:" `caption` 9/14 `mono` `slate/400`.
  - Nama dalam **Caveat 600, 28/32** — simulasi tulisan tangan.
  - Badge kelas `caption` 10/14 `mono` `slate/400` `bg slate/100`.
- Label form "Cocokkan Nama Siswa di Daftar Kelas:" + Select §10.

### Zona 2 — Ringkasan Skor
Kartu `gradient/score` (`brand/800` → `brand/700`, 135°), `radius/lg`, `p-14`, teks putih, `shadow/raised`.

| Bagian | Spesifikasi |
|---|---|
| Label | `caption` 11/16 `brand/100/80` — "Ringkasan Skor Terbaca" |
| Chip PG / Esai | `bg white/15`, `radius/sm`, `px-8 py-2`, `label` 12/16 700 — "PG: 22/25", "Esai: 18,5/25" |
| Label nilai | `caption` 10/14 700 uppercase `brand/200` — "Nilai Akhir" |
| Nilai | `scoreLg` 28/32 700 `white`, `tracking-tight`, tabular |

Nilai **dihitung ulang live** setiap kali guru mengubah jawaban atau skor esai.

> **Mode B:** nilai ditampilkan sebagai poin mentah — `86 / 100 poin` — bukan skala 0–100. Lihat §7.

### Zona 3 — Exception-First
Hanya nomor berstatus `EMPTY`, `MULTIPLE`, atau `LOW_CONFIDENCE` yang tampil (FR-5.3). Nomor `VALID` tidak pernah ditampilkan.

- Header: ikon `triangle-alert` `amber/500` + "Perlu Dicek (2 Nomor)" `bodyStrong` 13/18 700 `slate/700` + bantuan "Tap untuk koreksi 1-klik" `caption` 10/14 `slate/400`.
- Chip list: `flex flex-wrap gap-8`, chip §13/§14.
- Chip yang sudah dikoreksi berubah jadi `VALID` dan tetap terlihat (agar guru tahu itu sudah beres).

### Zona 4 — Penilaian Esai (diisi guru)

`grid-cols-2 gap-8`. Tiap baris adalah satu nomor esai, terdiri dari:

| Bagian | Spec |
|---|---|
| Crop tulisan tangan | Potongan gambar area jawaban esai (dari `essayCrops`), rasio 16:9, `rounded-md`, border 1px `slate/200` |
| Label | `E1`, `E2`, … (nomor esai **terpisah** dari nomor PG), `bodyStrong` 13/18 700 `slate/600` |
| Tombol **Benar** | Toggle. Memilihnya mengisi otomatis kolom skor parsial dengan poin penuh (`maxScore`) |
| Tombol **Salah** | Toggle. Memilihnya mengisi otomatis kolom skor parsial dengan `0` |
| Kolom skor parsial | Input angka 0…`maxScore`, kelipatan 0,5. Diubah manual → status menjadi `PARTIAL` |
| Poin | `scoreSm` tabular, `brand/800` |

Aktif: tombol **Benar** → `bg-brand-700 text-white`; tombol **Salah** → `bg-white border-slate-200`. Kolom skor parsial `w-16` dengan `border-2 border-brand-700`.

Baris yang sudah dinilai diberi tanda centang hijau `brand/600` di kiri.

Jika `essayCount = 0`, tampilkan teks "Tidak ada soal esai pada ujian ini." (`label` 12/16, `slate/400`, italic).

### CTA
Sticky di footer sheet: "Simpan & Scan Berikutnya" (`primary` `lg`, penuh) dengan ikon `arrow-right`.

### Duplicate Warning (FR-5.2)
Jika guru memilih siswa yang sudah punya `GradedStudentRecord` pada ujian aktif, tampilkan Dialog §19 — **bukan** toast.

---

## ⑥ `/queue` — Antrean Offline

**Tujuan:** mengelola foto yang belum terunggah (PRD FR-3.4).

```
┌──────────────────────────────────────┐
│ ‹ Antrean Offline                3 ✕ │
├──────────────────────────────────────┤
│ Offline — 3 foto menunggu koneksi    │
│ ┌──────────────────────────────────┐ │
│ │ ▣ IMG_0213.jpg         11:24  › │ │
│ │ ▣ IMG_0214.jpg         11:25  › │ │
│ │ ▣ IMG_0215.jpg    Gagal   11:26 › │ │
│ └──────────────────────────────────┘ │
│ [ Unggah Semua Sekarang ]            │
└──────────────────────────────────────┘
```

| Status item | Tampilan |
|---|---|
| Menunggu | Teks `caption` 12/16 `slate/400` — waktu |
| Gagal | Badge `rose/50` / teks `rose/700` "Gagal" + tombol retry (ikon `rotate-cw`) |
| Mengunggah | ProgressBar inline + "Mengunggah…" |

Header menampilkan jumlah antrean; badge pada tab bar (mobile) memakai angka yang sama.

Aksi: **Unggah Semua Sekarang** (`primary`, disabled bila kosong), hapus per item (ikon `x`, dialog konfirmasi — hapus data scan berarti data hilang permanen).

Auto-upload otomatis saat `navigator.onLine` kembali `true`. Toast sukses: "3 hasil scan tersinkron ke server."

---

## ⑦ `/grades` — Rekap Nilai

```
┌──────────────────────────────────────┐
│ Rekap Nilai              [ Export CSV]│
├──────────────────────────────────────┤
│ ┌────────┐┌────────┐┌────────┐       │
│ │RATA-RATA││TERTINGGI││TERSCAN │       │
│ │  79,4  ││  96,0  ││ 24/30  │       │
│ │KKM: 75 ││Siti N. ││Sisa 6  │       │
│ └────────┘└────────┘└────────┘       │
│ 🔍 Cari nama siswa...      [Semua][Lulus][Remedial]│
│ ┌──────────────────────────────────┐ │
│ │ Ahmad Fauzi      22/25  18,5/25  │ │
│ │                  82,4  ● Lulus   │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Komponen

| Bagian | Spesifikasi |
|---|---|
| Header | `h1` "Rekap Nilai" + tombol `primary` "Export CSV" (ikon `download`) |
| KPI row | 3 KPI Card §12 (`grid-cols-3 gap-10`) |
| Toolbar | SearchField (flex-1) + FilterChips §30 |
| Daftar | **Mobile:** kartu siswa §29 · **Desktop:** tabel §28 |
| Detail (desktop) | Klik baris → panel detail muncul di kanan (320px): rincian per nomor PG + esai + tombol "Buka Lembar Asli" |

### KPI

| Kartu | Nilai | Sub-label |
|---|---|---|
| Rata-Rata | rata-rata seluruh siswa discan | "KKM: 75" (`emerald/700`) |
| Tertinggi | nilai maksimum + nama siswa | nama, `caption` `slate/500`, truncate |
| Terscan | `24/30` | "Sisa 6 lembar" (`amber/700`) / "Semua selesai!" (`brand/700`) |

### Export
Tombol mengunduh CSV dengan kolom: `NIS, Nama, Skor PG, Skor Esai, Nilai Akhir, Status`. Toast konfirmasi "Rekap_Ujian_X.csv sedang diunduh".

---

## ⑧ `/template` — Blueprint LJK A4

**Tujuan:** pratinjau LJK persis seperti yang akan dicetak — dengan koordinat asli, bukan mock.

```
┌──────────────────────────────────────┐
│ ‹ Blueprint LJK A4            [ Cetak]│
├──────────────────────────────────────┤
│      ┌───────────────────────────┐  │
│      │ ■                  ■      │  │ ← fiducial 14×14 & 10×10 mm
│      │ LEMBAR JAWABAN KOMPUTER    │  │
│      │ ┌─────────┐ ┌─────────┐   │  │
│      │ │Nama: ___│ │Kelas: __│   │  │
│      │ └─────────┘ └─────────┘   │  │
│      │ I. PILIHAN GANDA (25)      │  │
│      │ 01 (A)(B)(C)(D)  14 (A)(B)(C)(D)│
│      │ 02 (A)(B)(C)(D)  15 ...    │  │
│      │ II. ZONA JAWABAN ESAI      │  │
│      │ E1 ┌──────────────────────┐│  │
│      │ E2 │                      ││  │
│      │ E3 └──────────────────────┘│  │
│      └───────────────────────────┘  │
├──────────────────────────────────────┤
│ 25 PG · 5 Esai · A4 · 2 kolom        │
└──────────────────────────────────────┘
```

### Spesifikasi cetak (wajib presisi)

| Elemen | Ukuran | Posisi |
|---|---|---|
| Kertas | A4 = 210 × 297 mm | Rasio preview **1 : 1.414** |
| Margin fiducial | 8 mm | Sudut zona aktif |
| Fiducial kiri-atas | **14 × 14 mm** | Sudut zona aktif |
| Fiducial 3 lainnya | **10 × 10 mm** | Sudut zona aktif |
| Bubble PG | ⌀ **4,5 mm** | Jarak antar pusat ≥ **6 mm** |
| Jarak nomor → bubble pertama | 9 mm | Kolom PG |
| Posisi kolom PG | kolom 1 x = 14 mm, kolom 2 x = 62 mm | Penomoran kolom 1 → kolom 2 |
| Tata letak | **2 kolom** | |
| Judul utama | x = 25 mm | Di kanan fiducial kiri-atas |
| Zona nama | Kotak garis putus, 90 × 12 mm | Di atas zona aktif |
| Kotak petunjuk | 90 × 40 mm | Di kanan zona PG |
| **Zona esai** | **Satu area per nomor, tanpa lingkaran skor** | Di bawah zona PG |
| Area jawaban siswa | **164 mm × tinggi dibagi rata** (min. 14 mm) | Sepanjang area konten |

> **Perubahan v1.1:** zona esai tidak lagi memuat lingkaran skor `0–5` + `[+.5]`.
> Area jawaban sekarang selebar penuh (164 mm) dan tingginya dibagi rata ke seluruh
> nomor esai. Nomor esai terpisah dari nomor PG (`E1`…`EM`). Skor dinilai guru
> di aplikasi — lihat Zone 4 di bawah.

### Kapasitas satu halaman A4

Dibatasi jarak antar pusat antar bubble **6 mm** (PRD FR-1.2) — bukan pilihan desain. Angka di bawah hasil implementasi (`packages/omr-engine`, `compute_layout`):

| Soal esai | PG maksimum |
|---|---|
| 0 | 50 |
| 1 | 50 |
| 2 | 50 |
| 3 | 50 |
| 4 | 50 |
| 5 | 44 |
| 6 | 38 |
| 7 | 32 |
| 8 | 26 |
| 9 | 20 |
| 10 | 14 |

Kombinasi yang melebihi batas **ditolak sistem** dengan pesan yang bisa ditindaklanjuti guru. Layar `/setup` **wajib** menampilkan batas ini secara langsung dari `max_essay_count_for(pgCount)` — bukan hanya lewat pesan error saat menekan tombol cetak.

### Bentuk blok esai (satu area per nomor)

Setiap nomor esai punya **satu area kosong selebar penuh** untuk tulisan tangan siswa. Tidak ada lagi lingkaran skor di kertas:

```
┌── ZONA JAWABAN ESAI ───────────────────────────────────────┐
│ E1  ┌────────────────────────────────────────────────────┐   │
│     │                                                    │   │
│     │              tulisan tangan siswa                  │   │
│     │                                                    │   │
│     └────────────────────────────────────────────────────┘   │
│ E2  ┌────────────────────────────────────────────────────┐   │
│     │              tulisan tangan siswa                  │   │
│     └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

| Metadata | Isi | Dibaca mesin? |
|---|---|---|
| `studentAnswerRectMm` | Area jawaban siswa | Tidak — hanya di-*crop* lalu ditampilkan ke guru saat menilai |

Tinggi area dibagi rata ke seluruh nomor esai (minimal 14 mm agar muat ≥2 baris tulisan tangan), dengan jarak antar blok 4 mm.

> **Kenapa begitu:** dengan skor esai dinilai guru di aplikasi, tidak perlu ada ruang di kertas untuk lingkaran skor. Area jawaban menjadi jauh lebih luas — dan mesin hanya perlu memotong satu area per nomor untuk dibaca guru.

> **Alur guru (FR-5.4):** guru menilai esai → mencatat di kertas (atau ingatnya) → LJK selesai → dipindai → di aplikasi, Zone 4 menampilkan **satu baris per nomor esai** berisi crop tulisan tangan + tombol Benar/Salah + kolom skor parsial → digabung dengan skor PG menjadi nilai akhir.

### Komponen

| Bagian | Spesifikasi |
|---|---|
| Panel preview | `bg slate/100`, `p-16`, sheet `bg white` + `shadow/raised` |
| Kontrol | Toggle "Tampilkan grid" · Toggle "Tampilkan margin cetak" |
| Ringkasan | "25 PG · 5 Esai · A4 · 2 kolom" `label` `slate/500` |
| CTA | "Cetak / Unduh PDF" (`primary`) + "Unduh metadata JSON" (`ghost`) |

**Mobile:** sheet dengan `max-h 90vh`, preview bisa di-pinch-zoom, sheet bisa di-drag turun.
**Desktop:** halaman penuh — preview di tengah, panel properti kanan (240px) berisi ukuran marker, diameter bubble, jarak, margin dalam mm.

> Pratinjau ini **wajib** dirender dari metadata koordinat yang sama dengan yang dipakai backend OMR — supaya yang dilihat guru = yang keluar dari printer.

---

## 7. Catatan Kontrak Data — Mode A vs Mode B

PRD FR-2.2 mendefinisikan dua mode pembobotan dengan sifat yang berbeda:

| Mode | Nilai akhir | Rentang tampil |
|---|---|---|
| **Mode A** — Persentase Bagian | Ternormalisasi ke skala 0–100 | `0` – `100`, tampil `82,4` |
| **Mode B** — Akumulasi Poin Langsung | Jumlah poin mentah | `0` – `totalPoinMaks`, tampil `86 / 100 poin` |

Konsekuensi:
1. Tipe `GradedStudentRecord.finalGrade` yang beranotasi "Skala 0 - 100" **hanya berlaku untuk Mode A**. Untuk Mode B, nilai yang disimpan adalah poin mentah. Perlu diperjelas di `src/types/omr.ts` — bagian ini menjadi acuan.
2. Badge Lulus/Remedial pada Mode B dibandingkan terhadap KKM yang **juga** diekspresikan dalam poin (bukan persen).
3. Label KPI "Rata-Rata" berubah menyesuaikan mode: "Rata-rata 79,4" (Mode A) vs "Rata-rata 86 poin" (Mode B).

---

## 8. Prototipe FigCraft

File prototipe: **`openomr_design_system.figcraft`** (dibangun via FigCraft MCP server).

| Page FigCraft | Isi | Frame |
|---|---|---|
| `01 Tokens` | 48 variabel warna, skala tipografi, spacing, radius, elevation | — |
| `02 Components` | 15 grup komponen (button, input, chip, badge, card, KPI, nav, sheet, drawer, viewfinder) | — |
| `03 Mobile` | 7 layar 390×844 | `01 · Ujian & Aturan` … `07 · Blueprint LJK A4` |
| `04 Desktop` | 2 layar 1440×1024 + sidebar 240px | `01 · Scan LJK (desktop batch)`, `02 · Rekap Nilai (desktop)` |
| `05 LJK Template` | Blueprint A4 presisi 595×842 @ 2,83 px/mm | `LJK A4 — 25 PG · 5 Esai` |

Preview PNG tiap frame ada di `prototype/previews/`.

Mapping layar mobile → frame:

| Layar | Frame | Rute |
|---|---|---|
| ① Ujian & Aturan | `03 Mobile / 01 · Ujian & Aturan` | `/setup` |
| ② Kelas & Siswa | `03 Mobile / 02 · Kelas & Siswa` | `/students` |
| ③ Scan LJK (kamera) | `03 Mobile / 03 · Scan LJK (kamera)` | `/scan` |
| ④ Scan batch | `04 Desktop / 01 · Scan LJK (desktop batch)` | `/scan` |
| ⑤ Verifikasi Cepat | `03 Mobile / 05 · Verifikasi Cepat (sheet)` | sheet |
| ⑥ Antrean Offline | `03 Mobile / 06 · Antrean Offline` | `/queue` |
| ⑦ Rekap Nilai | `03 Mobile / 04 · Rekap Nilai` + `04 Desktop / 02` | `/grades` |
| ⑧ Blueprint LJK A4 | `03 Mobile / 07 · Blueprint LJK A4` + `05 LJK Template` | `/template` |

**Catatan:** prototipe memakai **warna ter-bind ke variabel** (`Brand/700`, `Status/low/border`, …), bukan hex literal — lihat `design_tokens.md` §15. Pengecualian: 4 *fiducial marker* LJK tetap hitam `#000000` (warna cetak, bukan token UI). Font Caveat dimuat dari `assets/fonts/Caveat-Variable.ttf` (bukan font sistem) supaya file tetap portabel.

**Component & instance:** `AppHeader` dan `BottomNav` (5 varian `State`) dipakai sebagai instance di 6 layar mobile; `Sidebar` (2 varian `State`) dipakai di halaman desktop. Komponen lain masih frame biasa — daftar lengkap di `components.md` §36.

---

## 9. Rekap State yang Wajib Ada di Setiap Layar

| State | Hadir di |
|---|---|
| Loading | ① ② ④ ⑥ ⑦ ⑧ — skeleton sesuai siluet |
| Empty | ② (belum ada siswa), ⑥ (antrean kosong), ⑦ (belum ada yang discan) |
| Error jaringan | ① ④ ⑥ ⑦ — error state dengan tombol "Coba Lagi" |
| Izin ditolak | ③ — empty state khusus kamera |
| Sukses | Toast, dipakai setelah aksi simpan/import/export/sync |
