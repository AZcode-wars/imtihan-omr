# OpenOMR — Design Tokens

> Dokumen induk: `product_requirements_document_prd_openomr.md`
> Dokumen terkait: `ui_brief_ai_agent_specification_openomr.md`, `components.md`, `screen_specs.md`, `reference_patterns.md`
> Versi: 1.0 · Status: Disetujui (dipakai sebagai sumber kebenaran untuk FigCraft & kode)

Semua nilai di bawah ini adalah **satu-satunya sumber kebenaran**. Implementasi Tailwind dan FigCraft harus mengikuti dokumen ini, bukan sebaliknya.

---

## 1. Font

| Peran | Family | Weight | Sumber |
|---|---|---|---|
| UI (semua teks antarmuka) | **Roboto** | 400 / 500 / 700 | Google Fonts |
| Simulasi tulisan tangan siswa (pratinjau crop nama) | **Caveat** | 600 | Google Fonts |

> Catatan: prototipe HTML awal memakai *Plus Jakarta Sans*. Diganti ke **Roboto** atas keputusan pemilik produk (netral, iets, angka tabular-nya konsisten).

Font dimuat lewat `next/font/google` (Roboto + Caveat) — bukan `<link>` CDN — supaya tidak ada *layout shift* dan Font Sizer memberitahu AI agent bahwa `fontFamily: "Roboto"` tersedia offline.

### Fallback

`Roboto, ui-sans-serif, system-ui, "Segoe UI", sans-serif`

---

## 2. Skala Tipografi

| Token | Size / Line-height | Weight | Tracking | Pemakaian |
|---|---|---|---|---|
| `display` | 32 / 38 | 700 | -0.02em | Angka besar di KPI, nilai akhir |
| `h1` | 24 / 32 | 700 | -0.01em | Judul halaman |
| `h2` | 18 / 26 | 700 | -0.01em | Judul seksi, judul sheet |
| `h3` | 16 / 24 | 700 | 0 | Judul kartu, label form |
| `body` | 15 / 22 | 400 | 0 | Teks paragraf, isi dropdown |
| `bodyStrong` | 15 / 22 | 500 | 0 | Label form, nama siswa |
| `label` | 13 / 18 | 500 | 0 | Teks sekunder, caption tabel |
| `caption` | 12 / 16 | 400 | 0 | Teks bantu, timestamp |
| `overline` | 11 / 14 | 700 | +0.06em | Label seksi **uppercase** ("IDENTITAS UJIAN") |

### Tipografi numerik

Semua angka skor memakai `font-variant-numeric: tabular-nums` agar kolom sejajar.

| Token | Size / Line-height | Weight | Pemakaian |
|---|---|---|---|
| `scoreLg` | 28 / 32 | 700 | Nilai akhir di sheet verifikasi |
| `scoreMd` | 20 / 24 | 700 | Nilai akhir di KPI card & tabel |
| `scoreSm` | 15 / 20 | 700 | Skor PG / Esai, counter |

### Penulisan angka

- Locale **`id-ID`** — pemisah desimal koma, pemisah ribuan titik.
- `81.4` → `81,4` · `1234.5` → `1.234,5`
- Teks font **tangan** (Caveat) tidak pernah menampilkan angka terformat.

---

## 3. Warna

### 3.1 Skala Brand (hijau)

Satu-satunya warna aksen produk. Skala ini menggantikan penyebutan `emerald-700` yang keliru di UI brief — `#355A15` **bukan** `emerald-700` (= `#047857`), melainkan custom `brand-700`.

| Token | Hex | Pemakaian |
|---|---|---|
| `brand/50` | `#F3F7EF` | Latar chip & badge valid |
| `brand/100` | `#E3EDD9` | Latar badge header, hover |
| `brand/200` | `#C7DCB5` | Border chip valid, ring |
| `brand/300` | `#A2C487` | Border sekunder |
| `brand/400` | `#7DA95D` | Hover pada `brand/600` |
| `brand/500` | `#5D8B3E` | — |
| `brand/600` | `#476E2E` | Teks aksen di atas putih |
| `brand/700` | `#355A15` | **Primer**: tombol utama, teks aksen kuat |
| `brand/800` | `#24400E` | Header aplikasi, hover tombol utama |
| `brand/900` | `#1C330C` | Latar gradiensheet skor |

> Banding kontras di atas `white`: `brand/700` = **5,6:1** (AAA), `brand/600` = **7,0:1** (AAA). Aman untuk body text.

### 3.2 Skala Netral (slate)

| Token | Hex | Pemakaian |
|---|---|---|
| `slate/50` | `#F8FAFC` | Latar aplikasi |
| `slate/100` | `#F1F5F9` | Latar segmented control, skeleton |
| `slate/200` | `#E2E8F0` | Border kartu, pembatas |
| `slate/300` | `#CBD5E1` | Border input, garis bubble kosong |
| `slate/400` | `#94A3B8` | Ikon tidak aktif, teks placeholder |
| `slate/500` | `#64748B` | Teks sekunder |
| `slate/600` | `#475569` | Label form |
| `slate/700` | `#334155` | Teks tombol sekunder |
| `slate/800` | `#1E293B` | Teks utama pada surface |
| `slate/900` | `#0F172A` | Teks utama (paling kuat) |
| `slate/950` | `#020617` | **Latar viewfinder kamera** |

### 3.3 Warna Aksi (terpisah dari status)

Pemisahan ini disengaja: `brand/700` untuk **aksi** (tombol), tidak pernah untuk **status**. Sahabat guru harus bisa membedakan "tombol yang bisa diklik" dari "nilai yang valid" dalam sekali lihat.

| Token | Nilai | Pemakaian |
|---|---|---|
| `action/primary` | `brand/700` bg, teks `white` | Tombol utama |
| `action/primaryHover` | `brand/800` bg | Hover tombol utama |
| `action/secondary` | `white` bg, border `slate/200`, teks `slate/700` | Tombol sekunder |
| `action/ghost` | transparan, teks `brand/700` | Tombol teks (mis. "Pratinjau Blueprint") |
| `action/danger` | `rose/600` `#E11D48` | Hapus, batal destructive |
| `action/disabled` | bg `slate/100`, teks `slate/400` | Nonaktif |

### 3.4 Warna Status (4 status OMR)

**Aturan wajib: status tidak pernah ditandakan dengan warna saja.** Setiap chip wajib membawa **ikon + label teks**. Warna hanya lapisan ketiga.

| Status | Ikon | Label | Latar | Border | Teks |
|---|---|---|---|---|---|
| `VALID` | `check-circle-2` | *(tidak ditampilkan)* | `brand/50` | 1px solid `brand/200` | `brand/800` |
| `EMPTY` | `circle-minus` | "kosong" | `amber/50` `#FFFBEB` | 1px solid `amber/300` `#FCD34D` | `amber/800` `#92400E` |
| `LOW_CONFIDENCE` | `triangle-alert` | "perlu dicek" | `amber/100` `#FEF3C7` | **1.5px dashed** `amber/500` `#F59E0B` | `amber/900` `#78350F` |
| `MULTIPLE` | `copy` | "ganda" | `rose/50` `#FFF1F2` | 1px solid `rose/200` `#FECDD3` | `rose/800` `#9F1239` |

**Pembeda `EMPTY` vs `LOW_CONFIDENCE` — 4 lapis sekaligus:**

1. **Ikon berbeda** — `circle-minus` (⊘) vs `triangle-alert` (⚠)
2. **Latar berbeda** — `amber/50` (terang) vs `amber/100` (pekat)
3. **Border berbeda** — solid 1px vs **dashed 1.5px**
4. **Angka confidence** — hanya `LOW_CONFIDENCE` yang menampilkannya, mis. `52%`. `EMPTY` memang tidak punya apa pun untuk diukur, jadi kehadirannya sudah membedakan secara semantik.

> Fallback bila border dashed terasa ramai pada tinggi chip 32px: ganti dengan `border solid 2px` + latar `amber/100`. Pembeda utama tetap ikon + label + angka.

Contoh render:
```
 ⊘ 7 kosong              ⚠ 23 · 52%
[████████████████]        [▒▒▒▒▒▒▒▒▒▒▒▒▒▒]
```

### 3.5 Warna status lain

| Token | Nilai | Pemakaian |
|---|---|---|
| `pass` | `brand/50` / border `brand/200` / teks `brand/800` | Badge "Lulus" |
| `remedial` | `rose/50` / border `rose/200` / teks `rose/800` | Badge "Remedial" |
| `offline` | `amber/400` | Badge koneksi & titik status offline |

### 3.6 Gradasi

| Token | Definisi | Pemakaian |
|---|---|---|
| `gradient/score` | linear `brand/800` → `brand/700`, sudut 135° | Kartu ringkasan skor di sheet verifikasi |
| `gradient/cameraTorch` | `amber/100` @ 15% + `mix-blend-mode: screen` | Efek lampu senter menyala |

---

## 4. Spasi

Basis **4px**. Hanya nilai-nilai ini yang boleh dipakai.

| Token | px | Token | px |
|---|---|---|---|
| `space/1` | 4 | `space/6` | 24 |
| `space/2` | 8 | `space/8` | 32 |
| `space/3` | 12 | `space/10` | 40 |
| `space/4` | 16 | `space/12` | 48 |
| `space/5` | 20 | `space/16` | 64 |

Padding halaman: `space/4` (16px) mobile · `space/8` (32px) desktop.

---

## 5. Radius

| Token | px | Pemakaian |
|---|---|---|
| `radius/sm` | 8 | Tombol kecil, input, badge |
| `radius/md` | 12 | Kartu, chip, dropdown, stepper |
| `radius/lg` | 16 | Kartu utama (section card), kartu skor |
| `radius/xl` | 24 | Sudut atas bottom sheet, modal |
| `radius/pill` | 999 | Badge, chip pill, avatar |

---

## 6. Border, Border Radius & Outline

| Token | Nilai |
|---|---|
| `border/default` | 1px solid `slate/200` |
| `border/strong` | 1px solid `slate/300` |
| `border/input` | 1px solid `slate/200` |
| `border/inputFocus` | 1px solid `brand/700` + ring `0 0 0 4px brand/700/15` |
| `outline/focus` | 2px solid `brand/700`, offset 2px (untuk navigasi keyboard) |

---

## 7. Elevation

| Token | Nilai | Pemakaian |
|---|---|---|
| `shadow/xs` | `0 1px 2px rgb(15 23 42 / 0.05)` | Chip, badge |
| `shadow/card` | `0 1px 2px rgb(15 23 42 / 0.04)` | Section card |
| `shadow/raised` | `0 1px 3px rgb(15 23 42 / 0.08)` | Tombol, dropdown |
| `shadow/floating` | `0 8px 24px -12px rgb(15 23 42 / 0.18)` | Toast, dialog, drawer |
| `shadow/sheet` | `0 -8px 32px -12px rgb(15 23 42 / 0.16)` | Bottom sheet |

---

## 8. Gerak (Motion)

| Token | Durasi | Easing | Pemakaian |
|---|---|---|---|
| `motion/instant` | 0ms | — | Perubahan state tanpa animasi |
| `motion/fast` | 120ms | `cubic-bezier(0, 0, 0.2, 1)` | Hover, fokus, warna state |
| `motion/base` | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Chip masuk/keluar, chip status |
| `motion/slow` | 280ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Slide-up bottom sheet |
| `motion/press` | 90ms | `ease-out` | Tekan tombol (`scale: 0.97`) |

> Prinsip "minimalis & kalem": tidak ada animasi dekoratif. Yang boleh beranimasi hanya transisi yang menjelaskan perubahan state (sheet naik, chip berubah, tombol ditekan, state viewfinder). **Garis laser yang menyapu di viewfinder dihapus** — bingkai 4 sudut + status pill sudah cukup mengomunikasikan "mendeteksi".

`prefers-reduced-motion: reduce` → semua durasi menjadi 0ms kecuali opacity (tetap 120ms agar tidak hilang mendadak).

---

## 9. Breakpoint & Grid

| Token | Nilai |
|---|---|
| `bp/mobile` | 360–430px (tujuan utama) |
| `bp/tablet` | 640–1023px |
| `bp/desktop` | ≥ 1024px |
| `bp/wide` | ≥ 1440px |

| Grid | Kolom | Gutter | Margin |
|---|---|---|---|
| Mobile | 4 | 16 | 16 |
| Desktop | 12 | 24 | 32 |

Lebar sidebar desktop: **240px** (tetap). Konten desktop maksimum: **1200px**.

---

## 10. Target Sentuh (Wajib)

| Elemen | Area sentuh minimum | Catatan |
|---|---|---|
| Tombol biasa | 44 × 44 | termasuk varian `sm` (visual 32px, area sentuh 44px lewat padding transparan) |
| Tombol ikon | 44 × 44 | ikon 20px |
| Chip status di daftar exception | 44 × 44 | visual 32px + padding 6px transparan |
| Tombol `−` / `+` skor esai | 44 × 44 | **revisi dari prototipe HTML yang 28px** |
| Tombol opsi bubble `A/B/C/D/Kosong` | 44 × 44 | lebar minimal 44px tiap kolom |
| Shutter kamera | 72 × 72 | |
| Item tab bar | 64 × 56 | |

---

## 11. Aturan Aksesibilitas

1. Kontras teks ≥ **4.5:1**; komponen UI & grafis ≥ **3:1**.
2. **Status tidak pernah hanya lewat warna** — selalu ikon + label teks (lihat §3.4).
3. Semua elemen interaktif punya `outline/focus` saat dinavigasi keyboard.
4. Area sentuh ≥ 44 × 44 (§10).
5. `prefers-reduced-motion` dihormati (§8).
6. Label form selalu terikat (`<label for>`), bukan placeholder saja.
7. Pembaca layar: chip status diumumkan sebagai "Nomor 7, kosong" (bukan "amber").
8. Ikon dekoratif (di dalam tombol berlabel) diberi `aria-hidden="true"`.

### 11.1 Pasangan permukaan ↔ teks (wajib)

Setiap permukaan berwarna punya **satu** pasangan foreground yang sah. Nilai di bawah dihitung dari rasio kontras WCAG, bukan dikira-kira.

| Permukaan | Teks | Rasio |
|---|---|---|
| `brand/50` | `slate/900` | 16,5 : 1 |
| `brand/100` | `slate/900` | 14,8 : 1 |
| `brand/200` | `slate/900` | 12,2 : 1 |
| `brand/300` | `slate/900` | 9,2 : 1 |
| `brand/400` | `slate/900` | 6,6 : 1 |
| **`brand/500`** | **tidak ada** | **4,44 : 1 / 4,02 : 1 — dua-duanya < 4,5** |
| `brand/600` | putih | 5,9 : 1 |
| `brand/700` | putih | 8,0 : 1 |
| `brand/800` | putih | 11,6 : 1 |
| `brand/900` | putih | 13,7 : 1 |
| `slate/50` … `slate/400` | `slate/900` | 6,96 – 17,06 : 1 |
| `slate/500` | putih | 4,8 : 1 |
| `slate/600` … `slate/950` | putih | 7,6 – 20,2 : 1 |
| `status/*/bg` (3 warna) | `slate/900` | 16,0 – 17,2 : 1 |
| `white` | `slate/900` | 17,9 : 1 |

> **Larangan `brand/500`:** satu-satunya token tanpa pasangan foreground yang lolos AA. **Jangan pernah memakainya sebagai latar teks.** Boleh sebagai isian, border, garis, atau elemen grafis (grafik, progres, dekorasi). Kalau butuh hijau "terang" sebagai latar teks, pakai `brand/400` dengan teks `slate/900`, atau `brand/600` dengan teks putih.

**Cara praktis memilih teks di atas warna acak** (dipakai di halaman preview token, bukan di UI produk):

```ts
function luminance(hex: string) {
  const c = hex.replace("#", "");
  const v = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16) / 255).map((x) =>
    x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function foreground(hex: string) {
  return luminance(hex) > 0.35 ? "#0F172A" : "#FFFFFF";
}
```

> Jangan pakai `mix-blend-difference` untuk teks di atas permukaan berwarna — hasilnya tidak
> terjamin kontras (lihat catatan pada §11.2).

### 11.2 Jebakan kontras yang pernah terjadi

| Jebakan | Gejala | Larangan |
|---|---|---|
| `mix-blend-difference` untuk label di atas swatch | Warna label jadi keruh/pudar, hampir tak terbaca | Gunakan pasangan foreground dari §11.1 |
| Menyamakan `emerald-700` dengan `brand/700` | Warna benar-benar berbeda: `#047857` vs `#355A15` | Selalu tulis hex lengkap |
| Menulis `hsl()` di CSS lalu membandingkan hex | Tailwind v4 membulatkan ke hex dan bisa meleset 1/255 | Tulis **hex** di CSS agar identik dengan dokumen ini |

---

## 12. Format Angka & Tanggal

- Angka: locale `id-ID`.
- Tanggal: `dd/MM/yyyy` (contoh `15/11/2026`), waktu `HH:mm` 24 jam (contoh `11:24`).
- Nilai akhir Mode B ditampilkan sebagai **poin mentah** — `82 / 100 poin`, bukan `82,0` — karena PRD FR-2.2 mendefinisikan Mode B sebagai akumulasi poin langsung. Lihat `screen_specs.md` §7 dan catatan kontrak data.

---

## 13. Frame Referensi (FigCraft)

| Frame | Ukuran | Keterangan |
|---|---|---|
| Mobile | **390 × 844** | iPhone 14, status bar + safe area ikut digambar |
| Desktop | **1440 × 1024** | Sidebar 240px + konten 1200px |

---

## 15. Binding Variabel di FigCraft

Semua warna di file prototipe **ter-bind ke variabel**, bukan hex literal. Ada **4 collection** dan **48 variabel**:

| Collection | Isi | Mode |
|---|---|---|
| `Brand` | `brand/50` … `brand/900` (10) | `Light` |
| `Neutral` | `neutral/50` … `neutral/950` (11) | `Light` |
| `Status` | `valid/*`, `empty/*`, `low/*`, `multiple/*` (12) | `Light` |
| `Surface` | `bg`, `surface`, `inset`, `border`, `borderStrong`, `textPrimary`, `textSecondary`, `textMuted`, `actionPrimary`, `actionPrimaryHover`, `actionDanger`, `cameraBackground`, `brandHeader`, `brandSubtle`, `brandBorder` (15) | `Light` |

> **Catatan:** collection `Surface` punya beberapa nilai yang sama dengan `Brand` (mis. `actionPrimary` = `brand/700`). Untuk menghindari ambiguitas saat binding, pemetaan hex → variabel memakai **prioritas**: `Status` > `Brand`/`Neutral` > `Surface`. Warna yang sama tetap bisa diakses lewat kedua collection.

**Konsekuensi praktis:**

1. Mengubah `Brand/700` sekali → seluruh tombol, header, dan badge ikut berubah.
2. Menambah mode `Dark` pada collection → frame bisa di-*switch* ke tema gelap tanpa menggambar ulang.
3. Isi file auto-dokumentasi: nama variabel muncul di panel Design FigCraft, bukan angka hex.

**Layer yang tetap hex literal:** HITAM `#000000` pada 4 *fiducial marker* LJK (warna cetak, bukan token UI).

---

## 16. Pemetaan ke Tailwind

```ts
// tailwind.config.ts
theme: {
  extend: {
    fontFamily: {
      sans: ["var(--font-roboto)", "ui-sans-serif", "system-ui", "sans-serif"],
      hand: ["var(--font-caveat)", "cursive"],
    },
    colors: {
      brand: {
        50: "#F3F7EF", 100: "#E3EDD9", 200: "#C7DCB5", 300: "#A2C487",
        400: "#7DA95D", 500: "#5D8B3E", 600: "#476E2E", 700: "#355A15",
        800: "#24400E", 900: "#1C330C",
      },
    },
    borderRadius: { sm: "8px", md: "12px", lg: "16px", xl: "24px" },
    boxShadow: {
      xs: "0 1px 2px rgb(15 23 42 / 0.05)",
      card: "0 1px 2px rgb(15 23 42 / 0.04)",
      raised: "0 1px 3px rgb(15 23 42 / 0.08)",
      floating: "0 8px 24px -12px rgb(15 23 42 / 0.18)",
      sheet: "0 -8px 32px -12px rgb(15 23 42 / 0.16)",
    },
    transitionDuration: { fast: "120ms", base: "200ms", slow: "280ms" },
  },
}
```

Angka tabular: `style={{ fontVariantNumeric: "tabular-nums" }}` — bukan kelas Tailwind standar.
