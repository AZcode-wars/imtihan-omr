# @openomr/schemas — Kontrak Data Bersama

Satu-satunya sumber kebenaran **struktur** LJK dan tipe data OMR, dipakai tiga pihak:

| Pihak | Pemakaian |
|---|---|
| `packages/omr-engine` (ReportLab) | **menulis** metadata koordinat LJK |
| `packages/omr-engine` (OpenCV) | **membaca** metadata koordinat LJK |
| `apps/web` | merender pratinjau blueprint & menyimpan konfigurasi ujian |

## Isi

```
schema/
  exam-template.schema.json          ← KONTRAK TUNGGAL (JSON Schema draft 2020-12)
  example/exam-template.example.json ← fixture yang divalidasi kedua sisi
src/
  omr.ts                             ← tipe TypeScript
  index.ts
  openomr_schemas/
    models.py                        ← model Pydantic (cermin)
    __init__.py
tests/
  test_contract.py                   ← validasi fixture + uji negatif
```

> **Aturan:** kalau struktur berubah, ubah **JSON Schema dulu**, baru cermin di
> `omr.ts` dan `models.py`. Test kontrak akan menangkap kalau cerminnya lupa.

## Dua sub-bagian zona esai

Satu nomor esai punya **dua area dengan koordinat terpisah**:

| Field | Isi | Dibaca mesin? |
|---|---|---|
| `studentAnswerRectMm` | Area kosong untuk tulisan tangan siswa | Tidak — hanya ditampilkan sebagai crop saat verifikasi |
| `valueOptions` + `halfModifierOffset` | Lingkaran skor 0–5 + kotak `[+0.5]` yang diisi guru | Ya |

## Menjalankan test

```bash
cd packages/shared-schemas
uv run pytest
```

## Catatan

- Semua koordinat dalam **milimeter** (`Mm`). Konversi ke piksel hanya terjadi di renderer.
- Modul Python bernama `openomr_schemas` (bukan `omr` — `omr` adalah nama device cadangan Windows).
