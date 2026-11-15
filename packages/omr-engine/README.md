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

Dengan jarak antar pusat antar bubble **8,5 mm** (PRD FR-1.2), jeda pengelompokan
5 nomor (+7 mm), dan halaman A4 210 × 297 mm, kapasitas satu halaman dibatasi:

| Zona esai | PG maksimum |
|---|---|
| Tanpa zona esai | **40** |
| Dengan zona esai (satu kotak besar) | **30** |

Karena zona esai kini **satu kotak besar**, jumlah soal esai tidak lagi mengubah
tinggi area — yang menentukan adalah ada/tidaknya zona esai. Kombinasi melebihi
batas melempar `TemplateOverflowError`.

`max_pg_count_for(essay_count)` dan `max_essay_count_for(pg_count)` memberi tahu
antarmuka batas yang masih muat sebelum guru mencetak.

## Catatan

- Semua koordinat dalam **milimeter**. Konversi ke piksel hanya terjadi di renderer.
- Modul bernama `omr_engine` — `omr` adalah nama device cadangan di Windows.
