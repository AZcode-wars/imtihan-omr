# Product Requirements Document (PRD) - OpenOMR

## 0. Dokumen Terkait

PRD ini menentukan **kebutuhan produk**. Ia tidak menentukan tampilan — itu ada di dokumen turunan:

| Dokumen | Isi |
|---|---|
| `ui_brief_ai_agent_specification_openomr.md` | Struktur navigasi, kontrak data, dan spec tiap layar (UI Brief v1.1) |
| `docs/design_tokens.md` | Token warna, tipografi, spasi, radius, shadow, motion, a11y |
| `docs/components.md` | Spec visual + state tiap komponen |
| `docs/screen_specs.md` | 8 layar lengkap beserta measuremenya |
| `docs/reference_patterns.md` | Analisis prototipe HTML: yang diadopsi, dikoreksi, dibuang |
| `openomr_prototipe_ui_mobile_scanner.html` | Prototipe interaktif (referensi, bukan sumber kebenaran) |

> **Versi 1.1** — sinkronisasi scope: FR-2.5 (KKM), FR-2.6 (roster kelas), klarifikasi Mode B (FR-2.2), dan catatan status `EMPTY` (FR-5.3).

## 1. Informasi Dokumen & Visi Produk
* **Nama Proyek (Tentatif):** OpenOMR (Open-Source Mobile OMR Scanner)
* **Versi Dokumen:** 1.0 (MVP Specification)
* **Target Pengguna Utama:** Guru mata pelajaran di sekolah skala kecil–menengah yang membutuhkan koreksi ujian cepat tanpa membeli perangkat *scanner* khusus.
* **Tujuan Strategis:**
  1. Memangkas waktu koreksi ujian campuran (Pilihan Ganda + Esai) hingga 80% dengan akurasi pembacaan OMR >98% pada kondisi pencahayaan kelas normal.
  2. Membangun arsitektur *decoupled* (pemisahan *OMR Engine* dan *Web UI*) yang siap dibuka sebagai proyek *open-source* dan diintegrasikan melalui REST API / Webhook ke ekosistem Sistem Manajemen Sekolah (seperti **Kelaskita**).

---

## 2. Arsitektur Sistem & Tech Stack

Sistem menggunakan pendekatan **Monorepo Modular** untuk memisahkan antarmuka pengguna dari pemrosesan citra (*computer vision*):

```text
open-omr/
├── apps/
│   └── web/                  # Next.js PWA (UI Guru, Kamera, Verifikasi, Scoring Engine)
├── packages/
│   ├── omr-engine/           # Python FastAPI + OpenCV (Image Processing & PDF Generator)
│   └── shared-schemas/       # Kontrak JSON & TypeScript Types (Template LJK & API Payload)
└── docker-compose.yml        # Orkestrasi container Web + Engine
```

| Layer | Teknologi | Tanggung Jawab Utama |
| :--- | :--- | :--- |
| **Client / PWA** | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui | *Viewfinder* kamera HP, *auto-capture* berbasis Canvas, *offline queue* (IndexedDB), layar verifikasi cepat, dan kalkulasi nilai akhir. |
| **OMR Engine** | Python 3.11+, FastAPI, OpenCV (`headless`), NumPy | Meluruskan perspektif gambar (*4-point transform*), *adaptive thresholding*, pembacaan rasio piksel lingkaran, serta *cropping* area nama siswa. |
| **PDF Generator** | Python ReportLab | Menghasilkan dokumen PDF LJK siap cetak berdasarkan parameter jumlah soal ujian, sekaligus mengekspor metadata koordinat JSON. |
| **Database** | PostgreSQL (Supabase) / SQLite | Menyimpan data kelas, daftar siswa, konfigurasi ujian, kunci jawaban, dan rekap hasil pemindaian. |

---

## 3. Spesifikasi Fungsional (*Functional Requirements*)

### FR-1: Generator Template LJK Dinamis
* **FR-1.1:** Guru dapat membuat template LJK berukuran standar **A4 (210 x 297 mm)** dengan menentukan jumlah soal Pilihan Ganda (misal: 1–50 soal, opsi tetap **A, B, C, D**) dan jumlah soal Esai (0–10 soal).
* **FR-1.2:** Sistem menyusun soal ke dalam tata letak **2 kolom** dengan diameter lingkaran `4.5–5 mm` dan jarak antar pusat lingkaran minimal `8.5 mm` untuk mencegah tumpang tindih (*bleeding*).
* **FR-1.3:** Setiap LJK wajib memiliki **4 Fiducial Markers** (kotak hitam solid di keempat sudut zona aktif), dengan ukuran kotak kiri-atas (`14x14 mm`) lebih besar dari tiga sudut lainnya (`10x10 mm`) untuk deteksi orientasi otomatis.
* **FR-1.4:** Bagian atas zona aktif menyediakan kolom isian tulis tangan untuk **Nama Siswa** dan **Kelas**.
* **FR-1.5:** Bagian bawah zona aktif menyediakan **Zona Esai**, dengan dua sub-bagian per nomor esai:
  * **Area Jawaban Siswa** — kotak kosong untuk menulis jawaban esai secara tangan, dengan nomor soal (`E1`, `E2`, …) di sampingnya.
  * **Area Skor Esai (Diisi Guru)** — strip lingkaran angka bulat `(0) (1) (2) (3) (4) (5)` ditambah satu lingkaran modifier `[+.5]` pada setiap nomor esai, untuk mengakomodasi nilai separuh benar (misal `2,5`).
  * Kedua sub-bagian punya koordinat sendiri pada metadata template, sehingga mesin OMR membaca area skor tanpa mengotori tulisan siswa.

### FR-2: Manajemen Ujian & Konfigurasi Penilaian (*Scoring Rules*)
* **FR-2.1:** Sistem mendukung jumlah soal dinamis sesuai input guru (ujian *full* PG, *full* Esai, atau campuran).
* **FR-2.2:** Guru wajib memilih salah satu dari **2 Mode Pembobotan Nilai**:
  * **Mode A (Persentase Bagian):** Guru menentukan bobot persentase PG dan Esai (total = 100%, misal `PG 60% : Esai 40%`). Sistem otomatis menormalisasi skor mentah tiap bagian menjadi skala nilai akhir 0–100.
  * **Mode B (Akumulasi Poin Langsung):** Sistem menjumlahkan langsung poin PG dan poin Esai yang diperoleh siswa berdasarkan bobot poin yang ditetapkan guru per nomor soal. **Nilai akhir Mode B adalah poin mentah** (rentang `0`–`totalPoinMaksimal`), bukan skala 0–100. Konsekuensi UI: nilai ditampilkan sebagai `81 / 100 poin`, dan KKM (§FR-2.5) pada Mode B juga diekspresikan dalam poin.
* **FR-2.3:** Guru dapat mengatur poin benar, penalti salah (opsional, *default* `0`), serta status khusus per nomor PG (`ACTIVE`, `BONUS`, atau `VOID`/dianulir) tanpa perlu mencetak ulang LJK.
* **FR-2.4:** Guru dapat memilih aturan pembulatan nilai akhir (`EXACT_2_DECIMAL`, `ROUND_HALF_UP`, atau `CEIL_UP`).
* **FR-2.5 (KKM):** Guru menetapkan **KKM (Kriteria Ketercapaian Minimum)** per ujian, dalam skala yang sama dengan mode pembobotan aktif (persen untuk Mode A, poin untuk Mode B). KKM menjadi acuan status *Lulus* / *Remedial* pada rekapitulasi (§FR-6.1).
* **FR-2.6 (Roster Kelas):** Setiap ujian terkait dengan satu **kelas** yang memiliki daftar siswa (nama + NIS). Roster dapat diisi manual, diimpor dari CSV (`nama,nis`), dan diekspor kembali. Roster dipakai untuk dropdown pemilihan siswa pada proses verifikasi (§FR-5.1) dan menjadi acuan jumlah lembar yang harus dipindai.

### FR-3: Pemindaian Kamera HP (*Smart Capture*)
* **FR-3.1:** Layar kamera menampilkan panduan bingkai siku (*overlay*) berasio A4.
* **FR-3.2:** Sistem melakukan pengecekan ketajaman (*anti-blur*) dan stabilitas gerakan secara ringan di browser; apabila stabil dalam ~0.5 detik, kamera memotret secara otomatis (*auto-capture*) disertai umpan balik getar (*haptic*) dan indikator visual hijau.
* **FR-3.3:** Menyediakan tombol kontrol lampu *flash* (`torch`) untuk membantu pemindaian di ruangan kelas yang minim cahaya.
* **FR-3.4:** Menyediakan antrean penyimpanan lokal (*IndexedDB*) apabila koneksi internet terputus di tengah sesi pemindaian, dan mengunggahnya secara otomatis saat koneksi pulih.

### FR-4: Pemrosesan Citra (*Core OMR Pipeline*)
* **FR-4.1:** Mendeteksi 4 *fiducial markers*, memverifikasi orientasi kertas (memutar 180° jika terbalik), dan melakukan *4-point perspective transform* ke resolusi kanvas standar (`800 x 1100` piksel).
* **FR-4.2:** Menerapkan *adaptive Gaussian thresholding* untuk mengeliminasi bayangan tangan dan variasi pencahayaan ruangan.
* **FR-4.3:** Menghitung rasio piksel terisi di dalam koordinat setiap lingkaran berdasarkan file JSON template, lalu mengklasifikasikan status setiap baris menjadi: `VALID`, `EMPTY` (kosong), `MULTIPLE` (ganda), atau `LOW_CONFIDENCE` (arsiran tipis di ambang batas).
* **FR-4.4:** Memotong (*crop*) area kotak Nama Siswa dari gambar yang telah diluruskan dan mengirimkannya dalam respons API.

### FR-5: Layar Verifikasi Cepat (*Human-in-the-Loop UI*)
* **FR-5.1:** Menampilkan potongan gambar tulisan nama siswa tepat di atas *dropdown* daftar siswa kelas. Daftar siswa secara otomatis menyembunyikan nama yang LJK-nya sudah dipindai pada ujian berjalan. Sumber daftar ini adalah roster kelas (§FR-2.6).
* **FR-5.2:** Menampilkan peringatan duplikasi (*Overwrite Warning*) jika guru memilih nama siswa yang datanya sudah tersimpan.
* **FR-5.3:** Menerapkan tampilan *Exception-First*: menyorot hanya nomor PG yang berstatus `EMPTY`, `MULTIPLE`, atau `LOW_CONFIDENCE` agar guru dapat melakukan koreksi manual dalam 1 sentuhan tanpa memeriksa seluruh nomor.
  * **Catatan status:** `EMPTY` (siswa melewatkan / tidak diisi) adalah kondisi netral, **bukan error** — harus tampil berbeda dari `MULTIPLE` (ganda, kondisi error) agar Exception-First tetap informatif. Setiap status wajib ditandai dengan ikon + label teks, tidak hanya dengan warna.
* **FR-5.4:** Menampilkan rincian skor esai yang terbaca (termasuk akumulasi `+.5`) dengan opsi edit cepat di layar apabila diperlukan penyesuaian manual.

### FR-6: Rekapitulasi & Ekspor Data
* **FR-6.1:** Menampilkan tabel rekap nilai seluruh siswa dalam satu kelas (Skor PG, Skor Esai, Nilai Akhir, dan status kelulusan terhadap KKM §FR-2.5).
* **FR-6.2:** Menyediakan fitur ekspor hasil nilai ke format **CSV / Excel** serta endpoint REST API JSON terstruktur untuk integrasi eksternal.

---

## 4. Spesifikasi Non-Fungsional (*Non-Functional Requirements*)
1. **Performa & Latensi:** Waktu pemrosesan gambar di *backend* Python maksimal **< 1.5 detik** per lembar (dengan ukuran gambar input terkompresi ~500 KB–1 MB di sisi *client*).
2. **Kompatibilitas Perangkat:** Berjalan lancar pada browser mobile modern (Chrome Android 10+ dan Safari iOS 15+) tanpa memerlukan instalasi aplikasi native.
3. **Kesiapan Open-Source & Integrasi:**
   * *OMR Engine* harus *stateless* (menerima gambar + skema JSON template, mengembalikan JSON hasil pembacaan) agar dapat digunakan oleh aplikasi pihak ketiga tanpa terikat skema database aplikasi web ini.
   * Seluruh layanan dapat dijalankan secara lokal maupun di *cloud VPS* menggunakan satu berkas `docker-compose.yml`.

---

## 5. Metrik Keberhasilan MVP (*Success Metrics*)
* **Kecepatan Operasional:** Rata-rata waktu yang dibutuhkan guru untuk memindai, memilih nama siswa, dan menyimpan 1 lembar LJK adalah **≤ 5 detik**.
* **Akurasi Pembacaan:** Tingkat akurasi deteksi lingkaran terisi mencapai **≥ 98%** pada kondisi kertas A4 cetak printer biasa dengan cahaya ruang kelas standar.
* **Adopsi Awal:** Berhasil digunakan untuk mengoreksi minimal 1 sesi ujian nyata (1 kelas / ~25–35 siswa) di sekolah uji coba tanpa kendala *crash* pada *browser* HP guru.