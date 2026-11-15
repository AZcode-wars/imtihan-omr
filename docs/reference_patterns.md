# OpenOMR — Pola Referensi

> Sumber utama: `openomr_prototipe_ui_mobile_scanner.html` (71 KB, Tailwind CDN + Lucide + Tailwind config inline)
> Putusan: **sebagian besar dipakai, 3 koreksi, 1 bagian dibuang.**

Dokumen ini merekam apa yang diambil dari prototipe HTML, apa yang diubah, dan alasannya — supaya keputusan tidak hilang dan bisa diaudit.

---

## 1. Putusan Ringkas

| Kategori | Jumlah | Rincian |
|---|---|---|
| **Diadopsi** | 11 | Skala brand, skala radius, header app, kartu skor gradien, toast, anatomi blueprint LJK, font Caveat, chip status, anatomi sheet, viewfinder corner bracket, motion easing |
| **Dikoreksi** | 6 | Font utama, target sentuh, jumlah tab, opsi pembulatan, rentang poin esai, rentang jumlah PG |
| **Dibuang** | 3 | Garis laser animasi, tombol "Simulasikan Auto-Capture" lebar penuh, panel mock LJK di dalam viewfinder |
| **Ditambahkan** | 5 | Layar roster, antrean offline, field KKM, editor kunci per nomor, tata letak desktop |

---

## 2. Yang Diadopsi

### 2.1 Skala warna `brand` (50–900)

Prototipe mendefinisikan skala Tailwind kustom dengan `brand/700 = #355A15`. Ini **menyelesaikan konflik** di UI brief yang menyebut `#355A15` sebagai `emerald-700` (padahal `emerald-700` = `#047857`).

```
50 #F3F7EF  100 #E3EDD9  200 #C7DCB5  300 #A2C487  400 #7DA95D
50 #5D8B3E  600 #476E2E  700 #355A15  800 #24400E  900 #1C330C
```

Diadopsi penuh → `design_tokens.md` §3.1. Nama token Tailwind: `brand-{50..900}`.

### 2.2 Skala radius 8 / 12 / 16 / 24 / pill

Prototipe memakai `rounded-lg` (8), `rounded-xl` (12), `rounded-2xl` (16), `rounded-3xl` (24), `rounded-full`.

Awalnya saya usulkan 6 / 10 — **skala prototipe lebih kalem dan sudah tervalidasi secara visual**. Diadopsi.

### 2.3 AppHeader `bg brand/800`

Polos, tanpa gradien, dengan logo di kotak `brand/700` + badge `MVP` + subtitle ujian + badge koneksi di kanan. Tinggi 60px.

Memberi jangkar merek tanpa menambah warna baru. Diadopsi → `components.md` §1.

### 2.4 Kartu skor gradien `brand/800 → brand/700`

`bg-gradient-to-br from-brand-800 to-brand-700`, teks putih, chip translucent `bg-white/15`, nilai akhir besar 3xl extrabold.

Efektif karena kontras tinggi di sheet verifikasi dan menandai "ini angka yang penting". Diadopsi → `components.md` §11 `card/score`.

### 2.5 Toast

`top-16 left-4 right-4`, `bg-slate-900/95`, `rounded-2xl`, `border-white/10`, ikon `check-circle-2` `text-emerald-400`, durasi 2800ms.

Diadopsi → `components.md` §18. (Ikon diubah ke `brand/400` agar konsisten dengan skala brand.)

### 2.6 Anatomi blueprint LJK

Atribut `title` pada marker di prototipe sudah menyebut ukuran aslinya dengan benar:
- marker kiri-atas 14×14 mm, tiga lainnya 10×10 mm
- zona crop nama digambar dengan border putus-putus `brand-600` + latar `brand-50/40` — penanda visual area yang di-crop backend
- bubble PG: `w-3 h-3` (12px) dengan huruf A–D di dalam, grid 2 kolom
- zona esai: 6 lingkaran 0–5 + badge `+.5` bergaya `border-brand-700 text-brand-800`

Diadopsi → `screen_specs.md` §8. Ukuran dikunci ke satuan mm asli, bukan pixel preview.

### 2.7 Font `Caveat` untuk tulisan tangan

Ide yang sangat baik: crop nama siswa ditampilkan dalam font tangan supaya terasa seperti hasil scan, bukan teks UI. Diadopsi sebagai token `font/hand` (`components.md` §1, `screen_specs.md` §5).

### 2.8 Chip status

Prototipe sudah membedakan `bg-amber-50 border-amber-200 text-amber-800` (arsiran tipis) dari `bg-rose-50 border-rose-200 text-rose-800` (ganda) — pemisahan warna status yang benar. Diadopsi, dan **dikecilkan** sesuai aturan EMPTY-vs-LOW_CONFIDENCE di `design_tokens.md` §3.4.

### 2.9 Anatomi bottom sheet

`max-h-[92%]`, `rounded-t-3xl`, slide-up `0.28s cubic-bezier(0.16, 1, 0.3, 1)`, header `border-b`, body scroll `p-4 space-y-4`, footer sticky `p-4 border-t`.

Semua angka ini dipakai apa adanya → `components.md` §20.

### 2.10 Corner bracket viewfinder

`w-9 h-9` (36px), `border-4`, radius sudut luar `rounded-t-xl` (12px), warna `emerald-400` → diganti `brand/400`.

Diadopsi → `components.md` §24.

### 2.11 Easing motion

`cubic-bezier(0.16, 1, 0.3, 1)` untuk slide-up. Diadopsi sebagai `motion/standard`.

---

## 3. Yang Dikoreksi

### 3.1 Font utama: Plus Jakarta Sans → **Roboto**

Prototipe memakai Plus Jakarta Sans (weight sampai 800). Keputusan pemilik produk: **Roboto**.

Alasan: Roboto netral, konsisten, punya figur angka tabular yang seragam di semua weight, dan sudah jadi default materi Android yang relevan untuk pemakaian guru di HP. Plus Jakarta Sans tetap ada di repo sebagai kandidat, tapi tidak dipakai.

Dampak: `fontWeight` yang dipakai di prototipe (`font-extrabold` = 800) diturunkan ke **700** di seluruh token, karena Roboto men Rewards 800 (hanya tersedia di Roboto Flex/Black). Lihat `design_tokens.md` §2.

### 3.2 Target sentuh: 28px & 32px → **44px**

Ini temuan **accessibility**, bukan estetika. Di prototipe:

| Elemen | Prototipe | Diperbaiki |
|---|---|---|
| Tombol `−` / `+` skor esai | `w-7 h-7` = **28px** | 44 × 44 |
| Chip status di zona exception | `py-1.5` ≈ **32px** | area sentuh 44px (visual 32px + padding transparan) |
| Tombol opsi bubble | `py-2` ≈ **36px** | 44px |
| Tombol `×` tutup sheet | `p-1.5` ≈ **28px** | 44 × 44 |

UI brief sendiri mensyaratkan "area sentuh minimal 44px x 44px". Prototipe melanggarnya di 4 tempat. Diperbaiki → `design_tokens.md` §10, `components.md` §16.

### 3.3 Navigasi: 3 tab → **5 tab, Scan di tengah & menonjol**

Prototipe punya 3 tab datar (Ujian · Scan · Rekap) dan tab Scan **tidak menonjol** — hanya warnanya berbeda (`text-brand-700`).

Keputusan pemilik produk: **5 tab, tab Scan di posisi tengah dan menonjol** (lingkaran 44px). See `screen_specs.md` §0 dan `components.md` §2.1.

### 3.4 Opsi pembulatan

Prototipe memakai `EXACT_1 / ROUND / CEIL` dengan label "1 Desimal (81.5)". UI brief dan PRD memakai `EXACT_2_DECIMAL / ROUND_HALF_UP / CEIL_UP`.

Diikuti **PRD** (sumber kebutuhan), label UI diterjemahkan:
- `EXACT_2_DECIMAL` → "2 Desimal (81,45)"
- `ROUND_HALF_UP` → "Bulat Standar (81)"
- `CEIL_UP` → "Bulat ke Atas (82)"

### 3.5 Poin esai: 10/25 → **0–5 tetap**

Prototipe punya input "Maks. Poin per Esai" (default 10, max 25) yang **bertentangan dengan LJK**: zona skor esai di kertas hanya menyediakan lingkaran 0–5 (PRD FR-1.5). Tidak ada cara guru menulis `+7` di lingkaran 5.

Diperbaiki: rentang 0–5, `maxScore` default 5, sesuai `EssayQuestionConfig.maxScore` di UI brief. Angka 10/25 di prototipe dihapus.

### 3.6 Jumlah PG: minimum 5 → **1**

Prototipe melakukan clamp `Math.min(50, Math.max(5, pgCount + delta))`. PRD FR-1.1 menyebut "1–50 soal". Diperbaiki ke rentang 1–50.

---

## 4. Yang Dibuang

### 4.1 Garis laser animasi (`animate-scan`)

`@keyframes scanLine` yang menyapu dari 8% → 88% selama 2.8s.

Alasan: prinsip "minimalis & kalem" — bingkai 4 sudut + status pill sudah mengomunikasikan "mendeteksi", dan gerakan konstan di layar kamera mengganggu konsentrasi guru. Motion yang dibolehkan hanya yang menjelaskan perubahan state.

### 4.2 Tombol "Simulasikan Auto-Capture" lebar penuh

Prototipe memakai tombol `w-full` sebagai satu-satunya kontrol di action bar kamera.

Diperbaiki: **shutter 72×72** di tengah (kamera sungguhan, sesuai affordance yang dikenal pengguna) + tombol sekunder kecil "Scan Manual" untuk mode simulasi/demo. Lihat `screen_specs.md` §3.

### 4.3 Mock lembar LJK di dalam viewfinder

Prototipe menggambar lembar kertas simulasi (dengan bubble, marker, zona esai) di tengah viewfinder sebagai visualisasi.

Alasan: itu **artefak demo**, bukan bagian dari UI produksi. Dieskalasi menjadi komponen terpisah: **Blueprint LJK A4** (`screen_specs.md` §8), yang dirender presisi dari metadata koordinat. Di prototipe HTML, mock ini membingungkan karena terlihat seperti "kamera sedang memotret kertas".

---

## 5. Yang Ditambahkan (tidak ada di prototipe)

| Fitur | Alasan | Sumber |
|---|---|---|
| Layar **Kelas & Siswa** | FR-5.1 butuh daftar siswa; tidak ada tempat mengisinya | PRD FR-5.1 |
| Layar **Antrean Offline** | FR-3.4 butuh antrean; prototipe hanya badge di header | PRD FR-3.4 |
| Field **KKM** | FR-6.1 menyebut status kelulusan/KKM; nilainya 75 hardcoded di prototipe | PRD FR-6.1 |
| **Editor kunci per nomor** (`ACTIVE`/`BONUS`/`VOID`) | FR-2.3; prototipe tidak punya sama sekali | PRD FR-2.3 |
| **Tata letak desktop** | Prototipe mobile-only; UI brief mensyaratkan batch upload + split-screen | UI Brief §3.B.3 |

---

## 6. Temuan Teknis dari Kode Prototipe

Catatan untuk implementasi — bukan keputusan desain, tapi penting agar bug yang sama tidak terulang.

### 6.1 Skor Mode B salah satu

Di `calculateFinalGrade()`:

```js
// Mode B
const pgPoints = pgCorrect * state.modeBPgPoint;              // mis. 22 × 2 = 44
const essayRatio = essaySum / essayMax;                        // 0.74
const essayPoints = essayRatio * (essayCount * maxEssayPoint); // 0.74 × 50 = 37
rawFinal = pgPoints + essayPoints;                             // 81 → ditampilkan sebagai "81.0"
```

Masalahnya: `rawFinal` adalah **jumlah poin** (81 dari total 100), tapi ditampilkan sebagai "Nilai Akhir 81.0" seolah-olah skala 0–100 seperti Mode A. Tipe `GradedStudentRecord.finalGrade` juga beranotasi "Skala 0 - 100".

Perbaikan didokumentasikan di `screen_specs.md` §7: Mode B menampilkan poin mentah (`81 / 100 poin`), dan anotasi tipe perlu diperjelas.

### 6.2 Logika "bonusFromFixes" bisa menambah nilai dobel

```js
if (q.resolved && q.selectedAnswer === q.correctKey) bonusFromFixes += 1;
```

Kalau nomor tadinya **sudah terbaca benar** tapi berstatus `LOW_CONFIDENCE`, guru menekan "B" (kunci) → skor naik +1 padahal jawaban aslinya sudah bernilai penuh.

Perbaikan: skor dihitung dari **hasil koreksi akhir**, bukan dari `pgCorrectBase` + bonus. Nomor yang sudah terkoreksi memakai nilai hasil koreksi; nomor yang tidak dikoreksi memakai nilai deteksi asli.

### 6.3 Klaim "di luar zona" tidak konsisten

`state.pgCount` di-clamp 5–50 (lihat 3.6) sementara `flaggedQuestions` memakai nomor hardcoded 14 dan 21 — nomor 21 tidak ada kalau `pgCount = 20`. Kode sudah ditangani dengan `.pop()` duplikat, tapi nomor 21 bisa tetap muncul di `pgCount` 15–20.

Perbaikan: nomor bermasalah dipilih dari rentang `1..pgCount` secara deterministik dari data mock, bukan hardcode.

### 6.4 `examTotal` vs `unscannedStudents`

`totalClassSize = 30` tapi `unscannedStudents` hanya berisi 6 entri dan `gradebook` 6 entri. Badge "24/30" tidak konsisten dengan data. Untuk prototipe FigCraft dan mock final, angka harus konsisten: 32 siswa total, 26 discan, 6 tersisa.

### 6.5 Tombol `Export CSV` hanya menampilkan toast

Tidak ada file yang benar-benar dibuat. Pada implementasi final, pakai `Blob` + `URL.createObjectURL` dengan BOM UTF-8 agar Excel di Windows membaca karakter Indonesia dengan benar.

---

## 7. Ringkasan Nilai yang Diekstrak dari Prototipe

Nilai-nilai ini diambil apa adanya dari kode prototipe dan dipakai sebagai acuan angka.

| Token | Nilai prototipe | Dipakai di |
|---|---|---|
| Radius kartu utama | `rounded-2xl` = 16px | `radius/lg` |
| Radius kartu dalam | `rounded-xl` = 12px | `radius/md` |
| Radius kontrol | `rounded-lg` = 8px | `radius/sm` |
| Radius sheet | `rounded-t-3xl` = 24px | `radius/xl` |
| Radius chip | `rounded-xl` = 12px | `radius/md` |
| Radius pill | `rounded-full` | `radius/pill` |
| Tinggi sheet maks | `max-h-[92%]` | §20 |
| Slide-up | `0.28s cubic-bezier(0.16,1,0.3,1)` | `motion/slow` |
| Toast durasi | 2800ms | §18 |
| Corner bracket | `w-9 h-9 border-4 rounded-t-xl` | §24 |
| Chip ikon | `w-3.5 h-3.5` = 14px | §13 |
| Badge MV P | `text-[10px] px-1.5 py-0.5 rounded` | §1 |
| Padding card | `p-4` = 16px | `space/4` |
| Padding card dalam | `p-3` = 12px | `space/3` |
| Gap chip | `gap-2` = 8px | `space/2` |
| Grid bubble | `grid-cols-5 gap-1.5` | §15 |
| Grid skor esai | `grid-cols-2 gap-2` | §16 |
| Rasio kertas | `aspect-[1/1.41]` | §8 |
