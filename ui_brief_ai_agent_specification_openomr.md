# UI Brief & Frontend Specification — OpenOMR

* **Dokumen Induk:** `product_requirements_document_prd_openomr.md` (PRD v1.0)
* **Target Eksekutor:** AI Coding Agent (Next.js App Router + TypeScript + Tailwind CSS)
* **Mode Operasi UI:** Hybrid Responsive (*Mobile Camera Scanner* untuk guru di kelas & *Desktop Batch Upload* untuk admin/scanner ADF).
* **Versi dokumen:** 1.1 — disinkronkan dengan 4 dokumen turunan (lihat di bawah).

### Dokumen Turunan (WAJIB dibaca berdampingan)

| Dokumen | Isi |
|---|---|
| `docs/design_tokens.md` | Sumber kebenaran token: warna, tipografi, spasi, radius, shadow, motion, a11y |
| `docs/components.md` | Spec visual + state tiap komponen |
| `docs/screen_specs.md` | 8 layar lengkap, state, dan measuremenya |
| `docs/reference_patterns.md` | Analisis prototipe HTML: yang diadopsi, dikoreksi, dibuang |
| **`docs/tailwind_mapping.md`** | **Pemetaan FigCraft → Next.js/Tailwind/shadcn** (token, komponen, route, aturan wajib) — panduan implementasi untuk developer |
| `openomr_design_system.figcraft` | **Prototipe FigCraft** (token, komponen, 9 layar, blueprint LJK). Preview PNG di `prototype/previews/` |
| `openomr_prototipe_ui_mobile_scanner.html` | Prototipe interaktif (referensi, bukan sumber kebenaran) |

> **Precedence:** PRD menentukan *kebutuhan*, `docs/design_tokens.md` + `docs/components.md` menentukan *tampilan*, dokumen ini menentukan *struktur & perilaku*. Untuk nilai visual apa pun (hex, ukuran, radius, font) yang bertentangan, **`docs/design_tokens.md` yang menang**.

---

## 1. Design System & Guardrails (Aturan Wajib AI Agent)

1. **Tech Stack & Komponen:**
   * Framework: **Next.js (App Router)** dengan **TypeScript** (`strict: true`).
   * Styling: **Tailwind CSS** + **shadcn/ui** + **Lucide React** (`lucide-react`) untuk ikonografi.
   * Font: **Roboto** (UI) + **Caveat** (simulasi tulisan tangan siswa), dimuat via `next/font/google`.
   * State Management: React Context atau Zustand untuk mengelola `ExamConfig`, antrean hasil *scan*, dan daftar `GradedStudentRecord`.
2. **Palet Warna & Semantik Status:**
   * Token warna lengkap, skala `brand/50`–`brand/900`, skala status 4 warna, skala netral, dan aturan pemisahan aksi-vs-status: **`docs/design_tokens.md` §3**. Brief ini hanya meringkas.
   * **Primary Action:** Deep Emerald Green `brand/700` = `#355A15`. **Koreksi:** nilai ini **bukan** `emerald-700` (yang = `#047857`) — gunakan token `brand/700`, bukan `emerald-700`.
   * **Warna aksi dipisah dari warna status:** hijau pada tombol berarti "klik ini", hijau pada chip berarti "nilai valid". Keduanya tidak boleh memakai token yang sama.
   * **Status (4 jenis, wajib ikon + label teks — tidak boleh hanya warna):**

     | Status | Ikon | Label | Warna |
     |---|---|---|---|
     | `VALID` | `check-circle-2` | — | `brand/50` / `brand/200` / `brand/800` |
     | `EMPTY` | `circle-minus` | "kosong" | `amber/50` / `amber/300` / `amber/800` |
     | `LOW_CONFIDENCE` | `triangle-alert` | "perlu dicek" | `amber/100` / **dashed** `amber/500` / `amber/900` |
     | `MULTIPLE` | `copy` | "ganda" | `rose/50` / `rose/200` / `rose/800` |

     `EMPTY` (tidak diisi) **bukan error** — ia tidak boleh memakai rose, karena Exception-First (FR-5.3) butuh membedakan "siswa melewatkan" dari "siswa mencoret dua jawaban". `EMPTY` vs `LOW_CONFIDENCE` dibedakan oleh 4 lapis sekaligus: ikon, latar, border (solid vs dashed), dan angka confidence (hanya `LOW_CONFIDENCE`).
   * **Surface & Background:** Netral bersih (`slate/50` untuk latar belakang, `white` untuk kartu, `slate/950` khusus untuk mode *Camera Viewfinder*).
3. **Ergonomi & Responsivitas:**
   * **Mobile-First (`360px`–`430px`):** Gunakan tinggi viewport dinamis (`100dvh`) agar *viewfinder* kamera tidak tertutup *address bar* browser HP.
   * **Thumb-Friendly:** Seluruh tombol interaktif (koreksi opsi `A/B/C/D`, tombol `+0.5`/`-0.5` skor esai, dan CTA simpan) wajib memiliki area sentuh minimal **`44px x 44px`**. Lihat `docs/design_tokens.md` §10.
   * **Desktop Adaptive (`>= 1024px`):** Saat dibuka di layar desktop, navigasi bawah (*bottom nav*) berubah menjadi *sidebar* kiri, dan layar utama memprioritaskan mode **Batch Upload (JPG/PNG/PDF Multi-Halaman)** serta tabel verifikasi *split-screen*.

---

## 2. Kontrak Data & TypeScript Interfaces (`src/types/omr.ts`)

AI Agent **wajib** menggunakan definisi tipe data berikut di seluruh komponen frontend tanpa membuat struktur *props* ad-hoc:

> **Lokasi file (v1.1):** tipe-tipe ini kini hidup di paket kontrak **`packages/shared-schemas`** (`src/omr.ts` — TypeScript, `src/openomr_schemas/models.py` — Pydantic), dengan **JSON Schema `schema/exam-template.schema.json` sebagai kontrak tunggal** untuk struktur LJK.
> `apps/web/src/types/omr.ts` **re-export** dari paket tersebut, jadi path yang disebut di sini tetap berlaku.
> Aturan: kalau bentuk datanya berubah, ubah **JSON Schema dulu**, baru cermin di TypeScript dan Python — test kontrak (`packages/shared-schemas/tests/test_contract.py`) menangkap kalau cerminnya lupa.

```typescript
export type OptionLabel = 'A' | 'B' | 'C' | 'D';
export type ScoringMode = 'MODE_A_PERCENTAGE' | 'MODE_B_DIRECT_POINTS';
export type RoundingRule = 'EXACT_2_DECIMAL' | 'ROUND_HALF_UP' | 'CEIL_UP';
export type QuestionStatus = 'ACTIVE' | 'BONUS' | 'VOID';
export type BubbleReadStatus = 'VALID' | 'EMPTY' | 'MULTIPLE' | 'LOW_CONFIDENCE';

export interface MultipleChoiceQuestionConfig {
  number: number;               // 1 .. N (dinamis)
  correctAnswer: OptionLabel;
  pointsCorrect: number;        // Default: 1 (Mode A) atau bobot bebas (Mode B)
  pointsWrong: number;          // Default: 0
  status: QuestionStatus;
}

export interface EssayQuestionConfig {
  number: number;               // 1 .. M (dinamis, 0 jika ujian full PG)
  maxScore: number;             // Default: 5 (mendukung kelipatan 0.5)
}

export interface ExamConfig {
  id: string;
  title: string;
  classId: string;                   // Relasi ke Class (bukan className bebas)
  className: string;                 // Ditampilkan; disimpan juga agar render cepat
  passingScore: number;              // KKM, skala 0-100 (Mode A) atau poin (Mode B)
  scoringMode: ScoringMode;
  rounding: RoundingRule;
  sectionWeights: {
    multipleChoicePercent: number; // Total dengan essayPercent = 100
    essayPercent: number;
  };
  multipleChoiceQuestions: MultipleChoiceQuestionConfig[];
  essayQuestions: EssayQuestionConfig[];
}

// PRD FR-5.1 & FR-3.4: roster kelas dan antrean offline belum tercakup di brief v1.0.
export interface Class {
  id: string;
  name: string;                      // "8A"
  students: Student[];
}

export interface OfflineQueueItem {
  id: string;
  examId: string;
  createdAt: string;                 // ISO 8601
  thumbnailDataUrl: string;          // pratinjau kecil, base64
  imageDataUrl: string;              // gambar penuh, base64
  status: 'PENDING' | 'UPLOADING' | 'FAILED';
  attempts: number;
  lastError?: string;
}

// PRD FR-1: blueprint LJK. Metadata koordinat inilah yang dipakai backend OMR
// (FR-4.3) untuk menghitung rasio piksel tiap lingkaran.
export interface ExamTemplate {
  id: string;
  examId: string;
  pageWidthMm: number;               // 210
  pageHeightMm: number;              // 297
  columnCount: number;               // 2
  bubbleDiameterMm: number;          // 4.5
  bubblePitchMm: number;             // 8.5 (jarak antar pusat)
  fiducials: Array<{
    corner: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
    sizeMm: number;                  // 14 untuk TOP_LEFT, 10 untuk lainnya
    xMm: number; yMm: number;
  }>;
  nameCropRectMm: { x: number; y: number; w: number; h: number };
  multipleChoiceSlots: Array<{
    questionNumber: number;
    xMm: number; yMm: number;
    options: Array<{ label: OptionLabel; xMm: number; yMm: number }>;
  }>;
  // Satu area kosong untuk seluruh nomor esai. Tidak ada nomor per soal di
  // kertas — siswa yang menomori sendiri jawabannya. null = tanpa zona esai.
  essayAreaRectMm: { x: number; y: number; w: number; h: number } | null;
}

export interface Student {
  id: string;
  nis: string;
  name: string;
  className: string;
}

export interface DetectedMCAnswer {
  questionNumber: number;
  selectedOption: OptionLabel | null;
  status: BubbleReadStatus;
  confidence: number;           // 0.0 - 1.0
  rawCandidates?: OptionLabel[];
}

/** Hasil penilaian guru atas satu soal esai (skor esai tidak dibaca dari kertas). */
export type EssayOutcome = 'CORRECT' | 'INCORRECT' | 'PARTIAL';

export interface EssayMark {
  questionNumber: number;
  maxScore: number;              // Poin penuh bila jawaban ini dianggap benar
  outcome: EssayOutcome;
  pointsAwarded: number;         // CORRECT = maxScore, INCORRECT = 0, PARTIAL = nilai guru
}

/** Potongan gambar area jawaban esai, supaya guru bisa membaca tulisan tangan. */
export interface EssayAreaCrop {
  /** Potongan gambar satu area jawaban esai (base64 data URL). */
  imageDataUrl: string;
}

export interface OMRScanResponse {
  scanId: string;
  sourceDevice: 'MOBILE_CAMERA' | 'DESKTOP_SCANNER';
  timestamp: string;
  studentNameCropUrl: string;   // Potongan gambar tulisan tangan nama siswa
  fullWarpedImageUrl: string;   // Gambar LJK utuh hasil 4-point transform
  mcAnswers: DetectedMCAnswer[];
  // Skor esai dinilai guru di aplikasi — mesin hanya memotong SATU area.
  essayAreaCropUrl: string | null;
}

export interface GradedStudentRecord {
  recordId: string;
  examId: string;
  studentId: string;
  studentName: string;
  rawMCScore: number;
  maxMCScore: number;
  rawEssayScore: number;
  maxEssayScore: number;
  // Mode A: skala 0-100. Mode B: poin mentah (0..totalPoinMaks) — PRD FR-2.2.
  // Lihat docs/screen_specs.md §7.
  finalGrade: number;
  totalPossiblePoints: number;      // Dipakai untuk badge Lulus/Remedial di Mode B
  verifiedAt: string;
  scanPayload: OMRScanResponse;
}
```

---

## 3. Arsitektur Navigasi & Screen Inventory

### A. Navigasi Utama
* **Mobile (`< 1024px`):** *Fixed Bottom Navigation Bar* dengan **5 tab**, tab **ke-3 (Scan) di tengah dan menonjol** (tombol 56px, `radius/pill`, `bg brand/50`):
  1. `Ujian & Aturan` (`/setup`) — ikon `sliders-horizontal`
  2. `Kelas & Siswa` (`/students`) — ikon `users`
  3. **`Scan LJK` (`/scan` — *Default Active*)** — ikon `scan-line`, **menonjol**
  4. `Antrean` (`/queue`) — ikon `cloud-upload`, badge jumlah antrean (hanya bila ≠ 0)
  5. `Rekap Nilai` (`/grades`) — ikon `clipboard-list`
* **Desktop (`>= 1024px`):** *Left Sidebar Navigation* (240px) dengan menu: `Ujian & Aturan`, `Kelas & Siswa`, `Blueprint LJK`, `Scan LJK`, `Antrean Offline`, `Rekap Nilai`. Rute `/scan` menampilkan antarmuka **Batch Scanner Upload & Split-Screen Review**.
* **Layar kontekstual:** `Blueprint LJK` (mobile: sheet dari `/setup`; desktop: halaman `/template`) dan `Antrean Offline` (mobile: sheet dari `/scan`; desktop: halaman `/queue`).
* Spec visual lengkap: `docs/components.md` §2 dan `docs/screen_specs.md` §0.

---

### B. Spesifikasi Tiap Layar & Component States

#### 1. Layar `Scan LJK` — Mode Mobile Camera (`/scan` pada HP)
* **Komponen Utama:**
  * *Header Overlay:* Badge progres pemindaian (`Terscan: 24/30 Siswa`), tombol *toggle* senter (`torch`), dan indikator status koneksi (`Online` vs `Offline Queue`).
  * *A4 Alignment Viewfinder:* Panduan 4 sudut siku di tengah layar yang berubah warna sesuai *state* deteksi.
  * *Action Footer:* Tombol pemicu capture (mendukung *auto-capture* saat stabil ±0.5 detik maupun tombol manual/simulasi).
* **States yang Wajib Ditangani:**
  * `IDLE`: Sudut bingkai berwarna putih transparan (`Arahkan kamera ke 4 kotak sudut LJK`).
  * `LOCKED`: Sudut bingkai berubah hijau terang (`4 Sudut Terdeteksi • Siap Capture`).
  * `PROCESSING`: Overlay *loading* singkat saat mengirim gambar ke API FastAPI.
  * `OFFLINE_QUEUED`: Jika `navigator.onLine === false`, simpan gambar ke `IndexedDB` dan tampilkan badge antrean lokal.

#### 2. Modal `Quick Verification Bottom-Sheet` (Human-in-the-Loop)
Muncul otomatis tepat setelah foto LJK selesai diproses:
* **Zona 1 — Identifikasi Siswa:**
  * Menampilkan gambar potongan tulisan tangan nama siswa (`studentNameCropUrl`) secara jelas di bagian atas.
  * **Smart Student Dropdown:** Daftar nama siswa di kelas tersebut yang **otomatis menyaring/menyembunyikan** siswa yang sudah memiliki `GradedStudentRecord` pada ujian aktif.
  * *Duplicate Warning:* Jika user tetap memilih siswa yang sudah ada, tampilkan peringatan konfirmasi timpa data.
* **Zona 2 — Ringkasan Skor Real-Time:**
  * Kartu ringkas menampilkan `Skor PG` (misal `22/25`), `Skor Esai` (misal `18.5/25`), dan `Nilai Akhir` yang langsung dihitung ulang secara *live* setiap kali guru mengedit jawaban/skor esai.
* **Zona 3 — Exception-First Correction:**
  * Hanya menampilkan *chip* peringatan untuk nomor PG yang berstatus `EMPTY`, `MULTIPLE`, atau `LOW_CONFIDENCE`.
  * Jika *chip* di-tap, buka *inline drawer* berisi gambar *crop* baris lingkaran nomor tersebut beserta 5 tombol 1-klik: `[A]`, `[B]`, `[C]`, `[D]`, `[Kosong]`.
* **Zona 4 — Penyesuaian Cepat Skor Esai:**
  * Menampilkan daftar skor esai terbaca (`E1` s.d. `EM`) lengkap dengan tombol `-0.5` dan `+0.5` untuk penyesuaian nilai pecahan/separuh benar.
* **Primary CTA:** Tombol penuh di bagian bawah (`Simpan & Scan Berikutnya`) yang menyimpan data ke *gradebook* dan langsung mengembalikan layar ke mode kamera.

#### 3. Layar `Scan LJK` — Mode Desktop Batch Upload (`/scan` pada Desktop `>= 1024px`)
* **Tahap 1 — Batch Dropzone:**
  * Area *Drag & Drop* yang menerima banyak file gambar (`.jpg`, `.png`) sekaligus atau 1 file `.pdf` multi-halaman hasil mesin *scanner* ADF.
  * Menampilkan *progress bar* pemrosesan paralel (*"Memproses 12 dari 30 lembar..."*).
* **Tahap 2 — Split-Screen Batch Review:**
  * **Panel Kiri (Tabel Antrean):** Daftar seluruh lembar yang berhasil diproses beserta status kelengkapan nama siswa dan jumlah peringatan (*flagged items*). Mendukung navigasi *keyboard* (`Up/Down` untuk pindah lembar, `Tab/Enter` untuk memilih siswa).
  * **Panel Kanan (Inspeksi LJK):** Menampilkan gambar LJK utuh yang sudah diluruskan (`fullWarpedImageUrl`), potongan tulisan nama siswa, *dropdown* pemilihan nama siswa, koreksi nomor bermasalah, dan editor skor esai `.5`.

#### 4. Layar `Ujian & Aturan` (`/setup`)
* **Identitas & Struktur Soal:** Input judul ujian, **dropdown kelas** (dari roster), **field KKM** (`passingScore`), *stepper* jumlah soal Pilihan Ganda (`1–50`, opsi tetap `A–D`), dan *stepper* jumlah soal Esai (`0–10`).
* **Pemilih Mode Pembobotan Nilai:**
  * **Mode A (Persentase Bagian):** Slider/input persentase `Bobot PG %` dan `Bobot Esai %` (terkunci total 100%).
  * **Mode B (Akumulasi Poin Langsung):** Input poin per PG benar (default 1) dan poin maksimal per Esai (**0–5**, default 5 — sesuai lingkaran 0–5 di LJK), disertai indikator total poin maksimal ujian.
* **Aturan Pembulatan & Kunci Jawaban:** Pilihan pembulatan (`EXACT_2_DECIMAL`, `ROUND_HALF_UP`, `CEIL_UP`), editor kunci jawaban PG sebagai **grid chip per nomor** (termasuk status `ACTIVE`, `BONUS`, `VOID`), serta tombol **Pratinjau Blueprint LJK A4**.

#### 5. Layar `Rekap Nilai` (`/grades`)
* **KPI Summary Cards:** Rata-rata kelas, nilai tertinggi, dan progres jumlah siswa yang sudah dipindai.
* **Daftar Nilai Siswa:** Pencarian nama siswa, filter status (`Semua`, `Lulus`, `Remedial`), rincian skor PG & Esai, serta nilai akhir.
* **Aksi Ekspor:** Tombol `Export CSV` untuk mengunduh rekap nilai siap olah di Excel.

#### 6. Layar `Kelas & Siswa` (`/students`) — BARU
* **Kenapa ada:** FR-5.1 memfilter dropdown nama siswa berdasarkan roster kelas, tapi brief v1.0 tidak punya layar maupun alur untuk mengisinya. Tanpa ini, data siswa tidak pernah masuk.
* **Isi:** Nama kelas (editable) + jumlah siswa, pencarian, daftar siswa (nama, NIS, status sudah/belum discan), hapus per siswa.
* **Aksi:** `Tambah Siswa` (manual), `Import CSV` (format `nama,nis`, dengan **pratinjau validasi per baris** — nama kosong / NIS duplikat ditandai dan bisa di-skip), `Export CSV`.
* **Mobile:** form tambah siswa jadi *bottom sheet*. **Desktop:** split — daftar di kiri, form + pratinjau import di kanan.

#### 7. Layar `Antrean Offline` (`/queue`) — BARU
* **Kenapa ada:** FR-3.4 mensyaratkan antrean IndexedDB; brief v1.0 hanya menyebut *badge* di header tanpa tempat managing antrean.
* **Isi:** Jumlah antrean, daftar item (thumbnail, nama file, waktu), status per item (`Menunggu` / `Mengunggah` / `Gagal`), hapus per item.
* **Aksi:** `Unggah Semua Sekarang`, retry per item yang gagal. Unggah otomatis saat `navigator.onLine` kembali `true`.

#### 8. Layar `Blueprint LJK A4` (`/template`) — BARU
* **Kenapa ada:** FR-1 membuat LJK dari parameter soal; guru harus bisa melihat hasilnya **sebelum** dicetak, dan hasilnya harus identik dengan yang keluar dari printer.
* **Isi:** Pratinjau A4 (rasio 1:1.414) berisi 4 *fiducial marker* (kiri-atas 14×14 mm, lainnya 10×10 mm), zona nama, 2 kolom bubble PG (⌀ 4,5 mm, jarak 8,5 mm), dan zona skor esai (0–5 + `[+.5]`).
* **Wajib presisi:** pratinjau dirender dari metadata koordinat yang **sama** dengan yang dipakai backend OMR (FR-4.3).
* **Aksi:** `Cetak / Unduh PDF`, `Unduh metadata JSON`, toggle overlay grid & margin cetak.

> **Catatan:** brief v1.0 menyebut tombol "Pratinjau Blueprint LJK A4" di `/setup` tanpa layar Blueprint tersendiri. Layar inilah yang jadi rujukan canonical-nya; tombol di `/setup` hanya membukanya.

---

> **Semua ukuran, warna, dan state pada 8 layar ini dirinci di `docs/screen_specs.md`.** Brief ini menyatakan *apa* dan *mengapa*; dokumen turunan menyatakan *bagaimana*.

---

## 4. Panduan Eksekusi Bertahap untuk AI Agent (Prompt Milestones)

Jalankan pengembangan frontend secara berurutan dalam **4 Milestone** berikut agar kode tetap bersih dan mudah diverifikasi:

> **Semua milestone membaca:** `product_requirements_document_prd_openomr.md`, `ui_brief_ai_agent_specification_openomr.md`, `docs/design_tokens.md`, `docs/components.md`, `docs/screen_specs.md`.
> **Nilai visual apa pun diambil dari `docs/design_tokens.md` dan `docs/components.md`** — jangan menebak hex atau radius.

### Milestone 1: Fondasi State, Logika Kalkulasi, & Halaman Setup/Rekap
> **Instruksi ke AI Agent:**
> "Baca `product_requirements_document_prd_openomr.md`, `ui_brief_ai_agent_specification_openomr.md`, `docs/design_tokens.md`, `docs/components.md`, dan `docs/screen_specs.md`. Inisialisasi file tipe data di `src/types/omr.ts` (termasuk `Class`, `OfflineQueueItem`, dan `ExamTemplate`), buat *pure function* kalkulator nilai (`src/lib/scoring.ts`) yang mendukung Mode A (Persentase) dan Mode B (Poin Langsung) beserta pembulatannya — Mode B mengembalikan poin mentah, bukan skala 0–100 — lalu bangun shell navigasi responsif (Bottom Nav 5 tab dengan Scan menonjol di tengah, Sidebar di desktop) beserta halaman `Ujian & Aturan` (`/setup`) dan `Rekap Nilai` (`/grades`) menggunakan mock data."

### Milestone 2: Layar Scan Mobile (Camera Viewfinder) & Desktop (Batch Upload)
> **Instruksi ke AI Agent:**
> "Berdasarkan `docs/screen_specs.md` §3 dan §4, bangun halaman `/scan` yang adaptif: di layar mobile (`< 1024px`) tampilkan *Camera Viewfinder* dengan overlay bingkai A4 (rasio 1:1.414, 4 *corner bracket*), tombol senter, status `OFFLINE_QUEUED`, shutter 72px, dan tombol sekunder *Scan Manual*; sedangkan di layar desktop (`>= 1024px`) tampilkan *Batch Dropzone* untuk upload multi-file JPG/PNG/PDF beserta progress bar, lalu *Split-Screen* antrean + inspeksi."

### Milestone 3: Quick Verification Bottom-Sheet & Split-Screen Review
> **Instruksi ke AI Agent:**
> "Berdasarkan `docs/screen_specs.md` §5 dan `docs/components.md` §20–21, bangun komponen verifikasi hasil scan: *Bottom-Sheet* (maks 92vh, 4 zona, CTA sticky) untuk mobile dan *Split-Screen Panel* untuk desktop. Pastikan fitur *Smart Student Dropdown* (menyembunyikan siswa yang sudah terscan), *Exception-First* koreksi 1-klik dengan chip 4 status (`VALID` / `EMPTY` / `LOW_CONFIDENCE` / `MULTIPLE` — ikon + label, tidak hanya warna), penyesuaian skor esai kelipatan `0.5` dengan target sentuh 44px, dialog konfirmasi timpa, serta penyimpanan langsung ke state `Rekap Nilai` berjalan penuh."

### Milestone 4: Roster, Antrean Offline, Blueprint LJK & KKM
> **Instruksi ke AI Agent:**
> "Berdasarkan `docs/screen_specs.md` §2, §6, dan §8, bangun: (a) halaman `Kelas & Siswa` (`/students`) dengan tambah manual, *Import CSV* beserta pratinjau validasi per baris, dan export; (b) halaman `Antrean Offline` (`/queue`) dengan status per item, retry, dan unggah otomatis saat koneksi pulih; (c) layar `Blueprint LJK A4` (`/template`) yang merender pratinjau A4 **presisi dari metadata koordinat** `ExamTemplate` (fiducial 14×14 mm di kiri-atas dan 10×10 mm di tiga sudut lain, bubble ⌀ 4,5 mm jarak 8,5 mm, 2 kolom, zona esai 0–5 + `[+.5]`); dan (d) field **KKM** di `/setup` beserta badge Lulus/Remedial di `/grades` yang membandingkan nilai terhadap KKM."