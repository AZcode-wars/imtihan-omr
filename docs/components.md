# OpenOMR — Komponen

> Sumber token: `design_tokens.md` · Layar: `screen_specs.md` · Referensi visual: `reference_patterns.md`

Setiap komponen di bawah wajib diimplementasikan **tanpa struktur `props` ad-hoc**: nama, varian, dan state mengikuti tabel di sini.

---

## 1. AppHeader

Header tetap di semua layar mobile (di atas konten), tinggi **60px**, `bg brand/800`, teks putih, `shadow-sm`, `z-20`.

```
┌──────────────────────────────────────┐
│ [◧]  OpenOMR  [MVP]        [● Online]│
│      UTS Matematika - Kelas 8A       │
└──────────────────────────────────────┘
```

| Bagian | Spesifikasi |
|---|---|
| Logo | Kotak 32×32, `radius/md`, `bg brand/700`, border 1px `brand/500/40`, ikon `scan-line` 16px `brand/200` |
| Nama app | `h3` (16/24, 700), `tracking-tight`, putih |
| Badge `MVP` | `overline` 10/14, `px-6`, `radius/sm`, `bg brand/700`, teks `brand/200`, border 1px `brand/500/30` |
| Subtitle ujian | `caption` 11/16, teks `brand/100/80`, `truncate`, `max-w-[200px]` |
| Badge koneksi | Pill: `px-10`, `py-4`, `radius/pill`, `bg brand/700/90`, border 1px `brand/500/30`, `label` 11/14. Titik status 8px: `brand/400` + `animate-pulse` saat online; `amber/400` (tanpa pulse) saat offline |

Badge koneksi **bisa diklik** → mengubah mode simulasi offline (khusus prototipe/demo).

---

## 2. Navigasi

### 2.1 BottomNav (mobile `< 1024px`)

Tinggi **72px** + `padding-bottom: env(safe-area-inset-bottom)`. `bg white`, border atas 1px `slate/200`, `shadow` `0 -4px 20px rgb(0 0 0 / 0.04)`.

**5 tab, tab ke-3 (Scan) menonjol di tengah.**

| Pos | Label | Ikon | Ukuran |
|---|---|---|---|
| 1 | Ujian | `sliders-horizontal` | 20px |
| 2 | Kelas | `users` | 20px |
| **3** | **Scan** | `scan-line` | **26px** |
| 4 | Antrean | `cloud-upload` | 20px |
| 5 | Nilai | `clipboard-list` | 20px |

| State | Deskripsi |
|---|---|
| Tidak aktif | Ikon & label `slate/400`, `label` 11/14 |
| Aktif | Ikon & label `brand/700`, `label` 11/14 **700** |
| **Scan aktif** | Ikon `brand/700` di dalam **lingkaran 44×44 `bg brand/50`**, `radius/pill`; label `brand/700` 700 |
| Badge | Poin merah/amber `brand/600` 16px di kanan atas ikon, hanya pada tab Antrean saat queue ≠ 0 |

Setiap item tab: area sentuh **64 × 56**.

### 2.2 SidebarNav (desktop `≥ 1024px`)

Lebar **240px**, `bg white`, border kanan 1px `slate/200`. Berisi: logo + nama app, grup menu, dan blok info sesi di bawah.

| Menu | Rute | Ikon |
|---|---|---|
| Ujian & Aturan | `/setup` | `sliders-horizontal` |
| Kelas & Siswa | `/students` | `users` |
| Blueprint LJK | `/template` | `file-text` |
| Scan LJK | `/scan` | `scan-line` |
| Antrean Offline | `/queue` | `cloud-upload` |
| Rekap Nilai | `/grades` | `clipboard-list` |

Aktif: `bg brand/50`, ikon & teks `brand/700`, bar kiri 3px `brand/700`, `radius/md`.

---

## 3. Button

| Varian | Latar | Teks | Border |
|---|---|---|---|
| `primary` | `brand/700` → hover `brand/800` | white | — |
| `secondary` | white | `slate/700` | 1px `slate/200` |
| `ghost` | transparan | `brand/700` | — |
| `danger` | `rose/600` | white | — |
| `onBrand` | `white/15` | white | 1px `brand/500/30` (di atas header brand) |

| Ukuran | Height | Padding | Font | Radius |
|---|---|---|---|---|
| `sm` | 32 | 12px | `label` 13/18 500 | `radius/sm` |
| `md` | 44 | 16px | `body` 15/22 500 | `radius/md` |
| `lg` | 52 | 20px | `body` 15/22 700 | `radius/lg` |

| State | Perubahan |
|---|---|
| default | — |
| hover | `motion/fast`, warna latar |
| active | `scale(0.97)`, `motion/press` |
| disabled | `bg slate/100`, teks `slate/400`, tanpa shadow, `cursor-not-allowed` |
| loading | spinner 16px + teks disabled, lebar tombol dipertahankan |

Area sentuh minimum 44 × 44 (varian `sm` memakai padding transparan).

---

## 4. IconButton

44 × 44, `radius/md`, ikon 20px, `slate/500`. Varian: `ghost` (default), `surface` (`bg white`, border `slate/200`), `onDark` (`bg black/60`, `backdrop-blur-md`, border `white/15`, ikon `white/80`).

---

## 5. TextField

| Bagian | Spesifikasi |
|---|---|
| Label | `bodyStrong` 15/22, `slate/700`, `mb-4` |
| Input | tinggi 44, `px-12`, `py-10`, `radius/md`, `bg white`, border 1px `slate/200`, `body` 15/22 `slate/800` |
| Placeholder | `slate/400` |
| Focus | border `brand/700` + ring `0 0 0 4px brand/700/15` |
| Error | border `rose/500`, pesan helper `label` `rose/700` di bawah |
| Icon di kiri (opsional) | 16px, `slate/400`, `pl-36` |

SearchField = TextField dengan ikon `search` di kiri + `bg white`.

---

## 6. NumberField

Untuk poin dan KKM. Sama seperti TextField, `text-align: right`, `font-variant-numeric: tabular-nums`, tanpa spinner native.

---

## 7. Stepper

Kontrol jumlah soal. `bg slate/50`, `border 1px slate/200/70`, `radius/md`, `p-12`.

```
┌──────────────────────────────┐
│ Pilihan Ganda (A–D)          │
│   [ − ]    30    [ + ]        │
│   Maks. 50 soal / lembar      │
└──────────────────────────────┘
```

| Bagian | Spesifikasi |
|---|---|
| Tombol ± | 32 × 32, `radius/sm`, `bg white`, border 1px `slate/200`, `h3` 700, `slate/700`; `active:scale-0.95` |
| Nilai | `scoreMd` (20/24, 700), `tabular-nums`, lebar tetap 40px, rata tengah |
| Label | `label` 13/18, `slate/500` |
| Helper | `caption` 12/16, `slate/400` |

---

## 8. Slider (Bobot Bagian)

`accent-color: brand/700`. `track` 4px `slate/200`, `thumb` 20px `brand/700` + `shadow/raised`.

Dua slider (PG & Esai) saling mengunci: total selalu 100%. Di bawah slider: label kiri `100% Esai`, tengah `50 : 50`, kanan `100% PG` (`caption` 12/16 `slate/400`).

Di atas slider: dua label `label` 13/18 700 — PG `brand/700`, Esai `amber/700`.

---

## 9. SegmentedControl

`bg slate/100`, `radius/md`, `p-4`, `grid-cols-2` (atau 3 untuk pembulatan).

| Segmen aktif | `bg white`, `shadow/raised`, `radius/sm`, teks `brand/800`, `label` 13/18 **700** |
|---|---|
| Segmen non-aktif | transparan, teks `slate/500`, `label` 13/18 500, hover `slate/700` |

---

## 10. Select — Smart Student Dropdown

`Select` native, tinggi 44, `px-12`, `py-10`, `radius/md`, `bg white`, **border 2px `brand/700/40`**, `body` 15/22 **700**.

Sudah discan disembunyikan dari daftar (FR-5.1). Kalau siswa yang dipilih sudah punya record → `dialog` konfirmasi timpa (lihat §19).

---

## 11. Card

| Jenis | Spesifikasi |
|---|---|
| `section` | `bg white`, `radius/lg`, border 1px `slate/200/80`, `shadow/card`, `p-16` |
| `inset` | `bg slate/50`, `radius/md`, border 1px `slate/200/70`, `p-12` |
| `score` | `bg gradient/score`, `radius/lg`, `p-14`, teks putih, `shadow/raised` |

Judul seksi di dalam card: `overline` 11/14 700 uppercase `brand/700`, dengan `mb-12`.

---

## 12. KPI Card

3 kartu dalam `grid-cols-3`, `gap-10`. Tiap kartu `bg white`, `radius/lg`, border 1px `slate/200/80`, `shadow/card`, `p-12`.

```
┌────────────┐
│ RATA-RATA  │  ← overline 10/14 700 slate/400
│    79,4    │  ← scoreMd 20/24 700 brand/800, tabular-nums
│ KKM: 75    │  ← caption 10/14 600 emerald/700
└────────────┘
```

Nilai: `scoreMd`, warna `brand/800` bila nilai utama (rata-rata), `slate/800` bila netral (tertinggi), `brand/700` bila progres (terscan).
Sub-label: `caption` 10/14. Badge KKM `emerald/700`; sisa lembar `amber/700`.

---

## 13. StatusChip

Lihat `design_tokens.md` §3.4 untuk warna. Bentuk umum:

| Property | Nilai |
|---|---|
| Padding | `px-12`, `py-8` |
| Radius | `radius/md` (12px) |
| Font | `label` 13/18 700 |
| Border | 1px (1.5px dashed untuk `LOW_CONFIDENCE`) |
| Ikon | 14px, `aria-hidden` |
| Shadow | `shadow/xs` |
| Gap | 6px antara ikon & teks |

Isi per status:
- `VALID` → `✓` (tanpa label teks, hanya di list validasi)
- `EMPTY` → `⊘ 7 kosong`
- `LOW_CONFIDENCE` → `⚠ 23 · 52%`
- `MULTIPLE` → `⧉ 21 ganda`

Chip yang sudah dikoreksi guru berubah jadi `VALID` (latar `brand/50`, border `brand/200`, ikon `check-circle-2`, teks `brand/800`).

---

## 14. ExceptionChip

Turunan StatusChip yang dipakai di Zona 3 sheet verifikasi. Menambahkan `chevron-down` 14px di kanan sebagai affordance "bisa diketuk".

Hit area **44 × 44** (visual 32px + padding transparan 6px).

---

## 15. BubbleOption (koreksi 1-klik)

Grup 5 tombol dalam `grid-cols-5`, `gap-6`. Tiap tombol tinggi **44**, `radius/md`, `bg white`, border 1px `slate/200`, `h3` 700 `slate/700`.

| Tombol | Label | Style |
|---|---|---|
| `A` `B` `C` `D` | huruf | Seragam |
| `Kosong` | "Kosong" | `caption` 11/14 700, teks `rose/700`, border `rose/200` |

State: default · hover (border `brand/700`) · active (`scale-0.95`) · selected (`bg brand/700`, teks white, border `brand/800`).

---

## 16. ScoreStepper (Skor Esai)

Baris per nomor esai. `bg slate/50`, border 1px `slate/200/80`, `radius/md`, `px-10`, `py-8`.

```
┌───────────────────────────────┐
│ E1      [ − ]   3,5   [ + ]   │
└───────────────────────────────┘
```

| Bagian | Spesifikasi |
|---|---|
| Label | `body` 13/18 800 `slate/600` — "E1" |
| Tombol ± | **44 × 44**, `radius/sm`, `bg white`, border 1px `slate/200`, `h3` 700 `slate/700` |
| Nilai | lebar 40px, `scoreSm` 15/20 700, `tabular-nums`, `brand/800`, rata tengah |

Batas nilai 0.0 – 5.0, langkah 0.5.

---

## 17. AnswerKeyGrid (Editor Kunci Jawaban PG)

Grid chip per nomor PG. `grid-cols-5` (mobile) / `grid-cols-10` (desktop), `gap-8`.

```
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│ 1 A│ │ 2 B│ │ 3 C⁺│ │ 4 D│ │ 5 A│
└────┘ └────┘ └────┘ └────┘ └────┘
```

| Property | Nilai |
|---|---|
| Ukuran | 52 × 52, `radius/md`, `bg white`, border 1px `slate/200` |
| Isi | 2 baris: nomor (`caption` 10/14 `slate/400`) + kunci (`h3` 700 `slate/800`) |
| Status `BONUS` | Superscript `+` di kanan atas kunci, warna `brand/600`, `h3` 700 |
| Status `VOID` | Coretan diagonal 1px `slate/400` melewati chip, kunci teks `slate/400` + `line-through` |
| `ACTIVE` | Default (tidak ada penanda) |
| Hover | border `brand/700` |
| Selected (saat memilih) | border `brand/700` 2px + `bg brand/50` |

Ketuk chip → sheet pilihan: 4 opsi A–D, tombol `Kosong`, dan toggle status `ACTIVE` / `BONUS` / `VOID`.

---

## 18. Toast

Posisi atas, `top-64` (16px dari header), `left-16 right-16`, `z-50`.

`bg slate/900/95`, teks white, `radius/lg`, `p-16`, border 1px `white/10`, `shadow/floating`, `label` 13/18 600, ikon 16px.

| Jenis | Ikon | Warna ikon |
|---|---|---|
| sukses | `check-circle-2` | `brand/400` |
| info | `info` | `slate/300` |
| peringatan | `triangle-alert` | `amber/400` |
| error | `circle-alert` | `rose/400` |

Durasi tampil **2800ms**, masuk `motion/base` fade + slide-down 8px.

---

## 19. Dialog

`bg slate/950/75` + `backdrop-blur-xs`, `z-40`. Panel `bg white`, `radius/xl` (24px), `shadow/floating`, `p-24`, lebar maks 340px (mobile) / 420px (desktop).

Isi: judul `h2` 18/26 700, body `body` 15/22 `slate/600`, dua tombol di bawah (`secondary` + `primary`/`danger`).

**Dialog konfirmasi timpa (FR-5.2)**:
```
┌──────────────────────────────┐
│ ⚠  Timpa data yang ada?      │
│                              │
│ Ahmad Fauzi sudah punya hasil│
│ scan pada 15/11 11:24.       │
│ Data lama akan diganti.      │
│                              │
│ [ Batal ]  [ Timpa ]         │
└──────────────────────────────┘
```

---

## 20. BottomSheet

| Property | Nilai |
|---|---|
| Overlay | `bg slate/950/75` + `backdrop-blur-xs`, `z-40` |
| Panel | `bg white`, `radius/xl` (24px) **hanya sudut atas**, `max-height 92vh`, `shadow/sheet` |
| Animasi | Slide-up `motion/slow` (280ms) `cubic-bezier(0.16, 1, 0.3, 1)` |
| Handle | Batang 36 × 4, `radius/pill`, `slate/300`, di tengah, `mt-10` |
| Header | tinggi 56, `px-16`, `border-bottom 1px slate/100`, berisi titik status + judul `h2` + tombol tutup |
| Body | `p-16`, `overflow-y auto`, `space-y-16`, scrollbar disembunyikan |
| Footer | `p-16`, `border-top 1px slate/100`, `bg white`, menempel di bawah (sticky) |

Sheet verifikasi memakai **4 zona** dengan pemisah `border-top 1px slate/100` di antaranya.

---

## 21. InlineDrawer (Koreksi Bubble)

Terbuka di dalam sheet, tepat di bawah chip yang diketuk. Bukan overlay penuh — mendorong konten di bawahnya.

`bg amber/50`, border 1px `amber/200`, `radius/lg`, `p-12`, `mt-8`.

Isi:
1. **Header** — "Koreksi Soal No. 14" (`bodyStrong` 13/18 800 `amber/900`) + badge masalah (`caption` 10/14 700, `bg amber/200/80`, teks `amber/900`)
2. **Crop preview** — `bg white`, `radius/md`, border 1px `amber/200/80`, `p-8`, berisi baris bubble A–D (masing-masing 24px, `radius/pill`) dengan label "Crop LJK:" dan "Kunci: B"
3. **Tombol 1-klik** — `grid-cols-5 gap-6`, tinggi 44 (lihat §15)

---

## 22. ProgressBadge

Pill di viewfinder. `bg black/60`, `backdrop-blur-md`, `px-12`, `py-6`, `radius/pill`, border 1px `white/10`.

Isi: titik 8px `brand/400` + teks `Terscan: 24/30 Siswa` (`label` 11/14 600 `white/90`), angka **24/30**ibold `brand/300`.

---

## 23. ConnectionBadge

Sama seperti ProgressBadge, tapi teks: `Online` (titik `brand/400` + pulse) / `Offline · 3` (titik `amber/400`).

---

## 24. CornerBracket (Viewfinder)

4 siku di dalam viewfinder, tiap siku **36 × 36**, ketebalan **4px**, `radius/tl-xl` (12px) di sudut luarnya, warna `brand/400`.

| State | Warna |
|---|---|
| `IDLE` | `white/60` |
| `LOCKED` | `brand/400` |
| `PROCESSING` | `brand/400` |

Transisi warna `motion/base`. Rasio bingkai **1 : 1.414** (A4).

Status pill di bawah bingkai: `bg brand/950/85`, border 1px `brand/400/40`, `backdrop-blur-sm`, `px-12`, `py-4`, `radius/pill`, ikon `check-circle-2` 14px `brand/300` + teks `label` 11/14 600 `brand/300`.

---

## 25. ShutterButton

72 × 72, `radius/pill`, `bg white/15`, border 2px `white/40`, ikon `scan` 28px `brand/200`.

| State | Perubahan |
|---|---|
| default | seperti di atas |
| `LOCKED` | border `brand/400`, `shadow 0 0 0 4px brand/400/25`, `motion/fast` |
| capture | ring hijau menyala 200ms + `navigator.vibrate(50)` |
| disabled (saat `PROCESSING`) | `opacity 40` |

---

## 26. Dropzone (Batch Desktop)

`bg slate/50`, border **2px dashed** `slate/300`, `radius/lg`, tinggi minimal 220, `p-24`.

Isi: ikon `upload-cloud` 32px `slate/400`, judul `h3` "Tarik file ke sini" `slate/700`, sub `label` "JPG, PNG, atau PDF multi-halaman · maks 50 file" `slate/400`, tombol `secondary` "Pilih File".

Hover: border `brand/700`, `bg brand/50`.

---

## 27. ProgressBar

Tinggi 6, `radius/pill`, `bg slate/200`, isi `bg brand/700`.

Dilengkapi label di atas: `label` 13/18 500 `slate/600` — "Memproses 12 dari 30 lembar" — dan persentase `scoreSm` `slate/700`.

---

## 28. Tabel Rekap (desktop)

| Property | Nilai |
|---|---|
| Header | tinggi 44, `bg slate/50`, `overline` 11/14 700 `slate/500`, `border-bottom 1px slate/200`, **sticky** |
| Baris | tinggi 56, `border-bottom 1px slate/100`, `label` 13/18 |
| Zebra | baris genap `bg slate/50/60` |
| Kolom | Nama (fleksibel) · Skor PG (96px, kanan) · Skor Esai (112px, kanan) · Nilai Akhir (104px, kanan) · Status (96px) |
| Angka | `scoreSm` 15/20 700, `tabular-nums`, rata kanan |
| Nilai akhir | `brand/800` bila lulus, `rose/600` bila remedial |
| Hover baris | `bg brand/50/50` |
| Selected | `bg brand/50`, bar kiri 3px `brand/700` |

Di bawah 1024px tabel diganti **kartu siswa** (§29).

---

## 29. Kartu Siswa (mobile)

`bg white`, `radius/lg`, border 1px `slate/200/80`, `shadow/xs`, `p-14`.

```
┌────────────────────────────────────┐
│ Ahmad Fauzi          [● Lulus]     │
│ PG: 22/25 · Esai: 18,5/25    81,4  │
└────────────────────────────────────┘
```

Nama `bodyStrong` 15/22 700 `slate/800`; badge status `caption` 10/14 700; ringkasan `caption` 11/16 `slate/500` dengan angka `slate/700`; nilai akhir `scoreMd` 20/24 700 (`brand/800` / `rose/600`).

---

## 30. FilterChips

Baris chip filter `Semua` · `Lulus` · `Remedial`. `flex gap-8`, chip `px-12 py-6`, `radius/pill`, `caption` 12/16 700.

Aktif: `bg brand/700` teks white. Non-aktif: `bg white` border 1px `slate/200` teks `slate/600`.

---

## 31. Skeleton

`bg slate/100`, `radius/md`, `animate-pulse`. Bentuk mengikuti siluet komponen yang dimuat (baris tabel, kartu siswa, baris daftar).

---

## 32. EmptyState

Tengah, `py-32`, `px-24`.

```
        [icon 32px slate/300]
   Judul 13/18 700 slate-700
   Penjelasan 13/18 400 slate-500
        [ Tombol aksi ]
```

Ikon 32px dalam kotak 64×64 `bg slate/100`, `radius/pill`.

---

## 33. Toast / ErrorState (jaringan)

ErrorState: `bg rose/50`, border 1px `rose/200`, `radius/md`, `p-16`, ikon `circle-alert` `rose/600`, judul `bodyStrong` `rose/900`, body `label` `rose/800`, tombol "Coba Lagi" `secondary`.

---

## 34. Badge Lulus / Remedial

`caption` 10/14 700, `px-6`, `py-2`, `radius/sm`, border 1px.

| Status | Latar | Border | Teks |
|---|---|---|---|
| Lulus | `brand/50` | `brand/200` | `brand/800` |
| Remedial | `rose/50` | `rose/200` | `rose/700` |

---

## 36. Struktur Component di FigCraft

Sebagian komponen di `openomr_design_system.figcraft` adalah **component & instance sungguhan**, bukan frame biasa:

| Component set | Varian | Dipakai di |
|---|---|---|
| `Button` | `Primary`, `Secondary`, `Ghost`, `Danger` | Pustaka komponen (page 02) |
| `StatusChip` | `VALID`, `EMPTY`, `LOW_CONFIDENCE`, `MULTIPLE` | Pustaka komponen |
| `IconButton` | `Ghost`, `Surface`, `OnDark` | Pustaka komponen |
| `Badge` | `Lulus`, `Remedial` | Pustaka komponen |
| `BottomNav` | property `State` = `Ujian`, `Kelas`, `Scan`, `Antrean`, `Nilai` | **6 instance** di 6 layar mobile |
| `Sidebar` (desktop) | property `State` = `Scan LJK`, `Rekap Nilai` | Halaman `04 Desktop` |
| `AppHeader` | — (main component tunggal) | **6 instance** di 6 layar mobile |

**Aturan:**
- Navigasi yang aktif berbeda per layar ditangani lewat **variant property**, bukan dengan menggambar ulang. Mengubah tampilan navigasi cukup di satu tempat.
- Warna di dalam komponen memakai **variabel** (§15 `design_tokens.md`), bukan hex.
- Layar `05 · Verifikasi Cepat (sheet)` sengaja **tidak** memakai AppHeader/BottomNav — sheet muncul di atas kamera.

**Yang masih frame biasa** (belum dikomponentkan): Input, Stepper, SegmentedControl, Slider, Card, KPI Card, Toast, Dialog, EmptyState, ScoreStepper, BubbleOption, AnswerKey chip, CornerBracket. Semuanya sudah ter-bind variabel, jadi mengupgrade satu per satu ke component set tidak mengubah tampilan.

---

## 37. Checklist Implementasi

- [ ] Semua komponen memakai token dari `design_tokens.md`, tidak ada hex literal.
- [ ] Semua target sentuh ≥ 44 × 44.
- [ ] Semua status punya ikon + label, tidak hanya warna.
- [ ] Semua komponen punya state `disabled` dan `focus-visible`.
- [ ] Angka skor `tabular-nums`.
- [ ] Angka diformat locale `id-ID`.
- [ ] Grafis dekoratif diberi `aria-hidden="true"`.
