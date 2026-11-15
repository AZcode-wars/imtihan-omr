# omr-engine — Mesin Pemrosesan Citra OpenOMR

Backend OMR: menemukan 4 *fiducial marker*, memverifikasi orientasi kertas,
melakukan *4-point perspective transform*, menghitung rasio piksel terisi
setiap lingkaran, dan mengklasifikasikan jawabannya.

Engine ini **stateless**: menerima (gambar + template) dan mengembalikan JSON.
Tidak butuh database, sehingga bisa dipakai pihak ketiga.

## Modul

| Modul | Isi |
|---|---|
| `omr_engine.template` | **Sumber kebenaran geometri.** Menghitung koordinat LJK dalam milimeter → `ExamTemplate`. |
| `omr_engine.pdf` | Generasi PDF LJK dari koordinat template (ReportLab). |
| `omr_engine.synth` | LJK sintetis + *ground truth* untuk menguji engine (OpenCV). |
| `omr_engine.imaging` | Pembacaan citra (Task 4). |
| `omr_engine.grade` | Klasifikasi jawaban (Task 4). |
| `omr_engine.api` | FastAPI (Task 5). |

> **Aturan besi:** hanya `template.py` yang boleh menghitung koordinat.
> PDF, LJK sintetis, dan engine pembacaan semuanya membaca koordinat yang
> sama — sehingga **yang dicetak pasti sama dengan yang dideteksi**.

## Menjalankan

```bash
cd packages/omr-engine

# LJK sintetis + metadata koordinat + ground truth
uv run python -m omr_engine.synth --pg 25 --essay 5 --out out

# dengan gangguan realistis (untuk uji ketahanan)
uv run python -m omr_engine.synth --pg 25 --essay 5 --out out --noise 6 --rotate 1.2

# test
uv run pytest
```

Keluaran `out/`:

| Berkas | Isi |
|---|---|
| `template.json` | Metadata koordinat, valid menurut JSON Schema kontrak tunggal |
| `sheet.png` | LJK sintetis (4 px/mm, 840 × 1188 px) |
| `truth.json` | Jawaban siswa + skor guru yang digambar, per nomor |

## Batas halaman

Dengan jarak antar pusat antar bubble minimal **8,5 mm** (PRD FR-1.2) dan
halaman A4 210 × 297 mm, tidak semua kombinasi jumlah soal muat di satu
halaman. `compute_layout()` mencari tata letak yang pas (memanfaatkan
tinggi kotak jawaban esai dan jarak antar blok secara bertahap), dan melempar
`TemplateOverflowError` dengan pesan yang bisa ditindaklanjuti bila tetap
tidak muat.

Kapasitas satu halaman (hasil implementasi):

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

`max_essay_count_for(pg_count)` memberi tahu antarmuka berapa soal esai
maksimum yang masih muat — dipakai layar `/setup` untuk memperingatkan guru
**sebelum** mencetak.

## Catatan

- Semua koordinat dalam **milimeter**. Konversi ke piksel hanya terjadi di renderer.
- Modul bernama `omr_engine` — `omr` adalah nama device cadangan di Windows.
