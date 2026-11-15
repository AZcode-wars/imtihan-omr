# OpenOMR — Pemetaan FigCraft → Next.js / Tailwind / shadcn-ui

> **Untuk:** developer yang membangun `apps/web`.
> **Prototipe sumber:** `openomr_design_system.figcraft` (5 page, 48 variabel, 6 component set).
> **Aturan emas:** kalau ada yang tidak ada di dokumen ini, ambil dari `docs/design_tokens.md` — jangan menebak hex.
> **Implementasi sudah berjalan** di `apps/web` — dokumen ini adalah penjelasan dari apa yang sudah terpasang.

---

## 0. Cara pakai dokumen ini

1. **Token** (§2–§3) — sudah terpasang di `apps/web/src/app/globals.css`.
2. **Komponen** (§4) — 20 komponen shadcn/ui sudah terpasang di `apps/web/src/components/ui/`.
3. **Layar** (§5) — belum dibuat (Task 6 ke atas).
4. **Aturan wajib** (§6–§8).

### Versi yang dipakai (sudah terverifikasi)

| Paket | Versi | Catatan |
|---|---|---|
| Next.js | 16.4.6 | App Router, Turbopack, `LayoutProps<"/">` |
| React | 19.3.0 | |
| Tailwind CSS | **4.3.3** | **CSS-first — tidak ada `tailwind.config.ts`** |
| shadcn/ui | 4.23.0 | style `radix-nova`, CSS variables, base `neutral`, icon `lucide` |
| lucide-react | 1.73.0 | |
| TypeScript | 5.x | `strict: true` |

---

## 1. Scaffold (sudah dilakukan)

```
openomr/
├── apps/
│   └── web/                  # Next.js 16 App Router, TS strict, Tailwind v4, shadcn/ui
├── packages/
│   ├── omr-engine/           # Python 3.13 + FastAPI + OpenCV + ReportLab (uv)
│   └── shared-schemas/       # kontrak JSON Schema + tipe TS + model pydantic
└── docs/
```

**Perintah yang dipakai:**

```bash
# apps/web — CATATAN: create-next-app butuh folder target SUDAH ADA
mkdir -p apps/web
npx create-next-app@latest apps/web --typescript --tailwind --app --src-dir \
  --import-alias "@/*" --eslint --use-npm --yes
cd apps/web

# shadcn/ui — CLI v4 ada preset, pilih: -b radix (pustaka) -p nova (preset)
npx shadcn@latest init -b radix -p nova --monorepo --yes --force
npx shadcn@latest add button input label badge card dialog alert-dialog sheet slider \
  tabs progress skeleton table separator tooltip select sonner scroll-area sidebar dropdown-menu
```

> **Gotcha create-next-app:** kalau folder target belum ada, CLI gagal dengan
> *"The application path is not writable"*. Buat foldernya dulu (`mkdir -p apps/web`).

> **Gotcha shadcn init:** CLI interaktif. `-b` = pustaka komponen (`base` / `radix` / `aria`),
> `-p` = preset (`nova` / `vega` / `maia` / `lyra` / `mira` / `luma` / `sera` / `rhea` / `custom`).
> Kita pakai **radix** karena komponen yang dipakai (Dialog, AlertDialog, Sheet, Select, Slider,
> Tabs, Progress, Table, Toast) semuanya berbasis Radix.

> **Gotcha shadcn + Button kustom:** shadcn memakai `variant="default"` dan `variant="outline"`.
> Button OpenOMR memakai `primary` / `secondary` / `ghost` / `danger`, jadi
> `dialog.tsx` dan `alert-dialog.tsx` **sudah diedit** untuk memakai `secondary` / `primary`.
> Kalau menambah komponen shadcn baru, cek apakah ia memakai variant Button yang tidak ada.

**Font** — via `next/font/google` (bukan `<link>` CDN, supaya tidak ada layout shift):

```tsx
// apps/web/src/app/layout.tsx
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400","500","700"], display: "swap" });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["600","700"], display: "swap" });
// <html lang="id" className={`${roboto.variable} ${caveat.variable} ...`}>
```

`Caveat` hanya dipakai untuk **simulasi tulisan tangan siswa** di preview crop nama.

---

## 2. Token — `src/app/globals.css`

Tailwind v4 bersifat **CSS-first**: semua token didefinisikan di CSS, bukan di `tailwind.config.ts`.

### 2.1 Kenapa HEX, bukan HSL

Nilai ditulis sebagai **hex**, bukan `hsl()`. Alasannya nyata: Tailwind v4 mengonversi
`hsl()` → hex dengan pembulatan yang bisa bergeser **1/255**:

```
hsl(92 62% 22%)  →  #365b15      ← meleset
#355a15          →  #355a15      ← identik dengan docs/design_tokens.md
```

Karena `docs/design_tokens.md` adalah sumber kebenaran (dan nilai di situ hex),
CSS harus memakai hex supaya **tidak ada drift** antara dokumen dan implementasi.

### 2.2 `@theme inline` — warna

Blok ini memetakan variabel CSS ke utilitas Tailwind. `inline` berarti Tailwind menyisipkan
nilai variabel secara langsung (bukan menyalin nilainya), sehingga mengubah `:root`
langsung mengubah semua utilitas — persis pola shadcn/ui.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... shadcn semantic (card, popover, primary, secondary, muted, accent,
        destructive, border, input, ring, chart-1..5, sidebar-*) ... */

  --color-brand-50:  var(--brand-50);   /* ... s/d. brand/900 */
  --color-slate-50: var(--slate-50);   /* ... s/d. slate/950 */

  --color-status-valid-bg:     var(--status-valid-bg);
  --color-status-valid-border: var(--status-valid-border);
  --color-status-valid-text:   var(--status-valid-text);
  --color-status-empty-bg:     var(--status-empty-bg);
  --color-status-empty-border: var(--status-empty-border);
  --color-status-empty-text:   var(--status-empty-text);
  --color-status-low-bg:       var(--status-low-bg);
  --color-status-low-border:   var(--status-low-border);
  --color-status-low-text:     var(--status-low-text);
  --color-status-multiple-bg:     var(--status-multiple-bg);
  --color-status-multiple-border: var(--status-multiple-border);
  --color-status-multiple-text:   var(--status-multiple-text);

  --font-sans: var(--font-roboto);
  --font-hand: var(--font-caveat);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
```

### 2.3 `@theme` — radius, ukuran teks, shadow, motion

Blok `@theme` (tanpa `inline`) untuk nilai yang **tidak pernah berubah** per mode.

```css
@theme {
  --radius-sm: 8px;  --radius-md: 12px;  --radius-lg: 16px;
  --radius-xl: 24px; --radius-2xl: 24px; --radius-3xl: 999px; --radius-4xl: 999px;

  --text-display: 32px;  --text-display--line-height: 38px;  --text-display--letter-spacing: -0.02em;
  --text-h1: 24px;      --text-h1--line-height: 32px;      --text-h1--letter-spacing: -0.01em;
  --text-h2: 18px;      --text-h2--line-height: 26px;      --text-h2--letter-spacing: -0.01em;
  --text-h3: 16px;      --text-h3--line-height: 24px;
  --text-body: 15px;    --text-body--line-height: 22px;
  --text-body-strong: 15px; --text-body-strong--line-height: 22px; --text-body-strong--font-weight: 500;
  --text-label: 13px;   --text-label--line-height: 18px;    --text-label--font-weight: 500;
  --text-caption: 12px;  --text-caption--line-height: 16px;
  --text-overline: 11px; --text-overline--line-height: 14px; --text-overline--font-weight: 700;
  --text-overline--letter-spacing: 0.06em;
  --text-score-lg: 28px; --text-score-lg--line-height: 32px; --text-score-lg--font-weight: 700;
  --text-score-md: 20px; --text-score-md--line-height: 24px; --text-score-md--font-weight: 700;
  --text-score-sm: 15px; --text-score-sm--line-height: 20px; --text-score-sm--font-weight: 700;

  --shadow-xs:      0 1px 2px rgb(15 23 42 / 0.05);
  --shadow-card:    0 1px 2px rgb(15 23 42 / 0.04);
  --shadow-raised:  0 1px 3px rgb(15 23 42 / 0.08);
  --shadow-floating:0 8px 24px -12px rgb(15 23 42 / 0.18);
  --shadow-sheet:   0 -8px 32px -12px rgb(15 23 42 / 0.16);

  --ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out:      cubic-bezier(0, 0, 0.2, 1);

  --animate-slide-up: slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

> **Catatan Tailwind v4:** token `@theme` **hanya tercetak ke CSS output bila ada utility
> yang memakainya**. `--shadow-sheet` baru muncul di CSS ketika ada `shadow-sheet` di
> markup. Ini perilaku on-demand, bukan bug — jangan panik kalau token "hilang" di bundle.

### 2.4 `@utility` — utility kustom

```css
@utility tabular { font-variant-numeric: tabular-nums; }
@utility duration-fast { transition-duration: 120ms; }
@utility duration-base { transition-duration: 200ms; }
@utility duration-slow { transition-duration: 280ms; }
```

Pemakaian: `class="tabular text-score-md"` · `class="duration-fast"`.

### 2.5 `:root` — nilai warna

Isi lengkap ada di `apps/web/src/app/globals.css`. Ringkasnya:

```css
:root {
  --brand-50: #f3f7ef;  --brand-100: #e3edd9; --brand-200: #c7dcb5;
  --brand-300: #a2c487; --brand-400: #7da95d; --brand-500: #5d8b3e;
  --brand-600: #476e2e; --brand-700: #355a15;  --brand-800: #24400e;
  --brand-900: #1c330c;

  --slate-50: #f8fafc;  --slate-100: #f1f5f9; --slate-200: #e2e8f0;
  --slate-300: #cbd5e1; --slate-400: #94a3b8; --slate-500: #64748b;
  --slate-600: #475569; --slate-700: #334155; --slate-800: #1e293b;
  --slate-900: #0f172a; --slate-950: #020617;

  --status-valid-bg: #f3f7ef;     --status-valid-border: #c7dcb5; --status-valid-text: #24400e;
  --status-empty-bg: #fffbeb;     --status-empty-border: #fcd34d; --status-empty-text: #92400e;
  --status-low-bg:   #fef3c7;     --status-low-border:   #f59e0b; --status-low-text:   #78350f;
  --status-multiple-bg: #fff1f2;  --status-multiple-border: #fecdd3; --status-multiple-text: #9f1239;

  /* shadcn semantic */
  --background: var(--slate-50);
  --foreground: var(--slate-900);
  --card: #ffffff;          --card-foreground: var(--slate-900);
  --popover: #ffffff;       --popover-foreground: var(--slate-900);
  --primary: var(--brand-700);   --primary-foreground: #ffffff;
  --secondary: var(--brand-100); --secondary-foreground: var(--brand-800);
  --muted: var(--slate-100);     --muted-foreground: var(--slate-500);
  --accent: var(--brand-50);     --accent-foreground: var(--brand-800);
  --destructive: #e11d48;       --destructive-foreground: #ffffff;
  --border: var(--slate-200);    --input: var(--slate-200);   --ring: var(--brand-700);
  --radius: 12px;
}
```

**Dark mode belum diimplementasikan** (deferred). Blok `.dark` sengaja dihapus supaya
tidak ada tema gelap setengah jadi. Infrastruktur variabelnya sudah siap: cukup isi
blok `.dark` + tambahkan kelas `dark` ke `<html>`.

---

## 3. Peta Token → Kelas Tailwind

| Token | Kelas | Contoh |
|---|---|---|
| `brand/700` | `bg-brand-700` `text-brand-700` `border-brand-700` | `bg-brand-700 text-white` |
| `slate/200` | `border-slate-200` | `border border-slate-200` |
| `status/empty/bg` | `bg-status-empty-bg` | |
| `status/low/border` | `border-status-low-border` + `border-dashed` | |
| `radius/md` | `rounded-md` (12px) | |
| `radius/lg` | `rounded-lg` (16px) | |
| `radius/pill` | `rounded-3xl` / `rounded-4xl` (999px) | |
| `text/h2` | `text-h2` | |
| `text/score-md` | `text-score-md` + `tabular` | |
| `text/overline` | `text-overline` | |
| `shadow/card` | `shadow-card` | |
| `motion/slow` | `duration-slow` + `ease-standard` | |
| `font/hand` | `font-hand` | |

---

## 4. Peta Komponen

### 4.1 shadcn/ui yang dipakai langsung

| Komponen FigCraft | shadcn/ui | File | Catatan konfigurasi |
|---|---|---|---|
| `Button` (Primary/Secondary/Ghost/Danger) | `Button` | `ui/button.tsx` | **sudah disesuaikan** ke cva OpenOMR (§4.3) |
| `IconButton` (Ghost/Surface/OnDark) | `Button` | `ui/button.tsx` | size `icon` = 44×44, ikon 20px |
| `TextField` (default/focus/error) | `Input` + `Label` | `ui/input.tsx` | tinggi 44, `rounded-md`, focus ring brand |
| `NumberField` | `Input type="number"` | `ui/input.tsx` | `text-right tabular`, sembunyikan spinner native |
| `SegmentedControl` | `Tabs` (List/Trigger) | `ui/tabs.tsx` | list `bg-slate-100 rounded-md p-1`, trigger aktif `bg-white shadow-raised` |
| `Slider` (bobot %) | `Slider` | `ui/slider.tsx` | thumb 20px, aksen brand |
| `Badge` (Lulus/Remedial) | `Badge` | `ui/badge.tsx` | **sudah disesuaikan**: varian `pass` / `remedial` |
| `Card` (section/inset/score) | `Card` | `ui/card.tsx` | 3 varian: `default` / `inset` / `score` |
| `Dialog` (konfirmasi timpa) | `Dialog` + `AlertDialog` | `ui/dialog.tsx` | **pakai `AlertDialog`** — ini konfirmasi, bukan dialog biasa |
| `BottomSheet` | `Sheet` | `ui/sheet.tsx` | `side="bottom"`, `rounded-t-xl`, max-h 92vh, anim 280ms |
| `Toast` | `sonner` | `ui/sonner.tsx` | posisi `top-center`, `rounded-lg` |
| `ProgressBar` | `Progress` | `ui/progress.tsx` | tinggi 6, `rounded-pill` |
| `Skeleton` | `Skeleton` | `ui/skeleton.tsx` | |
| `Table` (rekap desktop) | `Table` | `ui/table.tsx` | header sticky, zebra `bg-slate-50/60` |
| `Dropdown` (pilih nama siswa) | `Select` | `ui/select.tsx` | border 2px brand/700 |
| `SearchField` | `Input` + ikon `Search` | `ui/input.tsx` | ikon 16px di kiri, `pl-9` |
| `Sidebar` (desktop) | `Sidebar` | `ui/sidebar.tsx` | lebar 240px (`--sidebar-width: 240px`) |
| `FilterChips` | `Badge` (clickable) | `ui/badge.tsx` | pill, aktif `bg-brand-700 text-white` |
| `Tooltip` | `Tooltip` | `ui/tooltip.tsx` | perlu `TooltipProvider` di layout — **sudah dipasang** |
| `DropdownMenu` | `DropdownMenu` | `ui/dropdown-menu.tsx` | |
| `ScrollArea` | `ScrollArea` | `ui/scroll-area.tsx` | |

### 4.2 Komponen custom (belum dibuat — Task 6)

| Komponen | File yang harus dibuat |
|---|---|
| `StatusChip` (4 state) | `src/components/omr/status-chip.tsx` |
| `AppHeader` | `src/components/omr/app-header.tsx` |
| `BottomNav` | `src/components/omr/bottom-nav.tsx` |
| `Stepper` | `src/components/omr/stepper.tsx` |
| `ScoreStepper` | `src/components/omr/score-stepper.tsx` |
| `BubbleOption` | `src/components/omr/bubble-option.tsx` |
| `AnswerKeyGrid` | `src/components/omr/answer-key-grid.tsx` |
| `CornerBracket` | `src/components/omr/corner-bracket.tsx` |
| `KPI Card` | `src/components/omr/kpi-card.tsx` |
| `EmptyState` | `src/components/omr/empty-state.tsx` |
| `Dropzone` | `src/components/omr/dropzone.tsx` |
| `LJK Sheet` (preview A4) | `src/components/omr/ljk-sheet.tsx` |

### 4.3 `Button` — sudah disesuaikan

`apps/web/src/components/ui/button.tsx`:

```tsx
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-fast select-none outline-none active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:   "bg-brand-700 text-white shadow-raised hover:bg-brand-800",
        secondary: "bg-white text-slate-700 border border-slate-200 hover:border-slate-300",
        ghost:     "bg-transparent text-brand-700 hover:bg-brand-50",
        danger:    "bg-rose-600 text-white shadow-raised hover:bg-rose-700",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-label",
        md: "h-11 rounded-md px-4 text-body",
        lg: "h-[52px] rounded-lg px-5 text-body font-bold",
        icon: "size-11 rounded-md",
        "icon-sm": "size-8 rounded-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);
```

> `h-[52px]` memakai arbitrary value karena Tailwind tidak punya `h-13`.

### 4.4 `StatusChip` — jangan pakai `Badge`

Chip status punya **empat** state dengan aturan berbeda; `Badge` terlalu generic.
Buat `src/components/omr/status-chip.tsx` dengan `cva`:

```tsx
const statusVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-label font-bold shadow-xs",
  {
    variants: {
      status: {
        VALID:           "bg-status-valid-bg border-status-valid-border text-status-valid-text",
        EMPTY:           "bg-status-empty-bg border-status-empty-border text-status-empty-text",
        LOW_CONFIDENCE:  "bg-status-low-bg border-status-low-border border-dashed text-status-low-text",
        MULTIPLE:        "bg-status-multiple-bg border-status-multiple-border text-status-multiple-text",
      },
    },
    defaultVariants: { status: "VALID" },
  }
);
```

**Aturan wajib** (lihat §6.3):

| Status | Ikon (lucide) | Label | Perbedaan wajib |
|---|---|---|---|
| `VALID` | `CheckCircle2` | — | — |
| `EMPTY` | `CircleMinus` | "kosong" | **tidak boleh** merah |
| `LOW_CONFIDENCE` | `TriangleAlert` | "perlu dicek" | border **dashed** + tampilkan angka confidence (`52%`) |
| `MULTIPLE` | `Copy` | "ganda" | — |

### 4.5 `BottomNav` — 5 tab, Scan di tengah

```
┌──────────────────────────────────────┐
│  Ujian    Kelas   ⬤ Scan   Antrean  Nilai │
└──────────────────────────────────────┘
```

- Tinggi **72px** + `padding-bottom: env(safe-area-inset-bottom)`.
- Tab ke-3 (Scan): ikon **26px** di dalam lingkaran **44px** `bg-brand-50` `rounded-pill`; label `text-brand-700 font-bold`.
- Tab lain: ikon 20px `text-slate-400`, label 11px `font-semibold`.
- Aktif non-Scan: ikon + label `text-brand-700`, label `font-bold`.
- Badge jumlah antrean: pill `bg-brand-600 text-white` di kanan atas ikon tab Antrean — **hanya tampil bila antrean ≠ 0**.
- Area sentuh tiap tab **64 × 56**.

Aktif `< 1024px`. Di `>= 1024px` navigasi berubah jadi `Sidebar` (240px).

### 4.6 `AppHeader`

Tinggi **60px**, `bg-brand-800`, teks putih. Isi: logo 32px `bg-brand-700 rounded-md` + ikon `ScanLine` 16px `text-brand-200`, nama "OpenOMR" 14px bold + badge "MVP", subtitle ujian 11px `text-brand-100/80` truncate, dan pill status koneksi (`Online` / `Offline · 3`) **yang bisa diklik** untuk simulasi offline.

---

## 5. Peta Layar → Route Next.js

| Layar | Route | File | Breadcrumb di sidebar |
|---|---|---|---|
| Ujian & Aturan | `/setup` | `app/(app)/setup/page.tsx` | "Ujian & Aturan" |
| Kelas & Siswa | `/students` | `app/(app)/students/page.tsx` | "Kelas & Siswa" |
| Blueprint LJK A4 | `/template` | `app/(app)/template/page.tsx` | "Blueprint LJK" |
| Scan LJK | `/scan` | `app/(app)/scan/page.tsx` | "Scan LJK" |
| Antrean Offline | `/queue` | `app/(app)/queue/page.tsx` | "Antrean Offline" |
| Rekap Nilai | `/grades` | `app/(app)/grades/page.tsx` | "Rekap Nilai" |

- Route group `(app)` = layout dengan `BottomNav` (mobile) / `Sidebar` (desktop).
- `/scan` adaptif: `< 1024px` → kamera; `>= 1024px` → batch upload + split-screen review.
- Sheet verifikasi **bukan** route terpisah — dipicu dari `/scan` setelah capture.
- `/template` di mobile dibuka sebagai sheet, di desktop sebagai halaman.

---

## 6. Aturan Wajib

### 6.1 Target sentuh

Semua elemen interaktif **≥ 44 × 44 px**. Termasuk: tombol `−`/`+` skor esai, chip status (visual 32px + padding transparan 6px), tombol opsi bubble, tombol tutup sheet.

### 6.2 Tipografi angka

Semua angka skor memakai `tabular`. Format locale **`id-ID`**: koma desimal, titik ribuan.

```ts
const nf = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
nf.format(81.4); // "81,4"
```

### 6.3 Status OMR — 4 state, ikon + label wajib

**Status tidak boleh ditandakan dengan warna saja.** `EMPTY` (tidak diisi) **bukan error** —
kalau merah, Exception-First kehilangan sinyal antara "siswa melewatkan" dan "siswa mencoret dua jawaban".

Pembeda `EMPTY` vs `LOW_CONFIDENCE` ada **4 lapis**: ikon berbeda, latar berbeda (`amber-50` vs `amber-100`),
border (solid 1px vs **dashed 1.5px**), dan **angka confidence** (hanya `LOW_CONFIDENCE` yang menampilkannya).

### 6.4 Kontras & fokus

Teks ≥ 4,5:1; komponen UI ≥ 3:1. Semua elemen interaktif punya `focus-visible:outline-2 focus-visible:outline-brand-700`.

### 6.5 Viewfinder kamera

- Latar `bg-slate-950`.
- Bingkai rasio **1 : 1.414** (A4), 4 corner bracket 36×36, tebal 4px, `rounded-xl` di sudut luar.
- State: `IDLE` (putih 60%) → `LOCKED` (brand/400) → `PROCESSING`.
- Auto-capture saat stabil ±0,5 s → shutter berdenyut + `navigator.vibrate(50)` + kilau hijau 200ms.
- **Tidak ada garis laser animasi** (keputusan "minimalis & kalem").
- `100dvh`, bukan `100vh`.

---

## 7. Yang harus delegasikan ke backend

| Zat | Penjelasan |
|---|---|
| **Metadata koordinat LJK** | `ExamTemplate` dihasilkan ReportLab saat PDF dicetak, dan **dikonsumsi** engine OpenCV. Kontrak ini harus sama persis — letakkan di `packages/shared-schemas`. |
| **Normalisasi & pembulatan nilai** | Mode A (0–100) vs Mode B (poin mentah) — lihat `docs/screen_specs.md` §7. Pure function, harus ada test. |
| **Offline queue** | IndexedDB + strategi flush. Belum dispesifikasikan — lihat Task 9. |
| **Import CSV** | Format `nama,nis`; parser + validasi (duplikat, kolom kosong) + pratinjau per-baris. |

---

## 8. Checklist serah terima

- [ ] `globals.css` tetap memuat token §2 apa adanya (hex/HSL tidak boleh diubah diam-diam).
- [ ] Semua komponen §4 ada, dengan variant & state yang sesuai.
- [ ] Semua angka skor `tabular` + format `id-ID`.
- [ ] Semua target sentuh ≥ 44×44.
- [ ] Semua status punya ikon + label.
- [ ] `npm run build` lolos TypeScript strict.
- [ ] Preview PNG tiap layar dibandingkan dengan `prototype/previews/` — harus cocok pixel-wise.

> **Referensi visual ada di `prototype/previews/`** (12 PNG, 1× skala). Bandingkan hasilmu dengan file-file itu;
> kalau beda, tanyakan jangan menebak.
