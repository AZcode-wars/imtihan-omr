# Panduan Integrasi ImtihanOMR Engine untuk Kelaskita

Dokumen ini ditujukan bagi developer backend Kelaskita yang ingin mengintegrasikan kemampuan pemindaian Lembar Jawaban Komputer (LJK) otomatis ke dalam sistem SaaS Kelaskita.

---

## 🏗️ 1. Arsitektur & Cara Menjalankan Engine

ImtihanOMR Engine dibangun sebagai microservice berbasis **Python 3.13 + FastAPI + OpenCV**. Engine ini dapat dijalankan langsung di server internal Kelaskita sebagai container Docker.

### Menjalankan via Docker Compose
Di server Kelaskita, tambahkan service berikut pada `docker-compose.yml`:

```yaml
services:
  omr-engine:
    build:
      context: .
      dockerfile: packages/omr-engine/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1
      - OMR_API_KEY=kelaskita_secret_key_anda   # (Opsional) Kunci pengaman
    restart: unless-stopped
```

Jalankan container:
```bash
docker compose up -d omr-engine
```
Cek kesiapan: `curl http://localhost:8000/health` ➔ `{"status": "ok", "version": "0.1.0"}`.
Dokumentasi interaktif OpenAPI/Swagger tersedia di `http://localhost:8000/docs`.

---

## 📡 2. Endpoint Pemindaian Citra (`POST /v1/scan`)

Endpoint ini menerima foto/scan lembar LJK dari guru, meluruskan sudut (warp 4 fiducial marker), membaca jawaban bulatan pensil 2B, dan memotong nama siswa serta zona esai.

### Header
```http
Content-Type: multipart/form-data
X-API-Key: kelaskita_secret_key_anda   # (Wajib jika OMR_API_KEY disetel di env)
```

### Parameter Request (Form-Data)
| Field | Tipe | Keterangan |
|---|---|---|
| `file` | Binary (File) | Berkas gambar foto LJK (JPG, PNG, WebP) |
| `template` | String (JSON) | Metadata struktur LJK (koordinat fiducial, slot PG, dll) |
| `sourceDevice` | String | `"MOBILE_CAMERA"` atau `"DESKTOP_SCANNER"` (default: `"MOBILE_CAMERA"`) |

---

## 💻 3. Contoh Implementasi di Backend Kelaskita

### Contoh A: Menggunakan PHP (Laravel HTTP Client)
```php
use Illuminate\Support\Facades\Http;

public function processScanLjk(Request $request)
{
    $imageFile = $request->file('ljk_image');
    $examTemplateJson = $this->getExamTemplateFromDatabase($request->exam_id);

    $response = Http::withHeaders([
        'X-API-Key' => env('OMR_API_KEY')
    ])->attach(
        'file', file_get_contents($imageFile), $imageFile->getClientOriginalName()
    )->post('http://omr-engine:8000/v1/scan', [
        'template' => json_encode($examTemplateJson),
        'sourceDevice' => 'MOBILE_CAMERA',
    ]);

    if ($response->successful()) {
        $result = $response->json();
        // $result['mcAnswers'] berisi array status jawaban [1 => 'A', 2 => 'B', ...]
        // $result['studentNameCropUrl'] potongan foto nama siswa
        // $result['essayAreaCropUrl'] potongan foto jawaban esai
        return response()->json($result);
    }

    return response()->json(['error' => $response->body()], $response->status());
}
```

### Contoh B: Menggunakan Node.js / TypeScript (Fetch / Axios)
```typescript
import FormData from "form-data";
import fs from "fs";
import axios from "axios";

async function scanLjkSheet(imagePath: string, examTemplate: object) {
  const form = new FormData();
  form.append("file", fs.createReadStream(imagePath));
  form.append("template", JSON.stringify(examTemplate));
  form.append("sourceDevice", "MOBILE_CAMERA");

  const response = await axios.post("http://omr-engine:8000/v1/scan", form, {
    headers: {
      ...form.getHeaders(),
      "X-API-Key": process.env.OMR_API_KEY || "",
    },
  });

  return response.data;
}
```

---

## 📦 4. Struktur Output Response (`OMRScanResponse`)

```json
{
  "scanId": "scan-1715830219-9182",
  "sourceDevice": "MOBILE_CAMERA",
  "timestamp": "2026-11-16T04:30:00Z",
  "studentNameCropUrl": "data:image/jpeg;base64,...",
  "fullWarpedImageUrl": "data:image/jpeg;base64,...",
  "essayAreaCropUrl": "data:image/jpeg;base64,...",
  "mcAnswers": [
    {
      "questionNumber": 1,
      "selectedOption": "A",
      "status": "VALID",
      "confidence": 0.98,
      "rawCandidates": ["A"]
    },
    {
      "questionNumber": 7,
      "selectedOption": null,
      "status": "EMPTY",
      "confidence": 0.95,
      "rawCandidates": []
    },
    {
      "questionNumber": 11,
      "selectedOption": null,
      "status": "MULTIPLE",
      "confidence": 0.92,
      "rawCandidates": ["A", "C"]
    },
    {
      "questionNumber": 13,
      "selectedOption": "A",
      "status": "LOW_CONFIDENCE",
      "confidence": 0.52,
      "rawCandidates": ["A"]
    }
  ]
}
```

### Penjelasan Status Jawaban (`status`):
- **`VALID`**: Tepat satu bulatan terisi pensil 2B secara jelas.
- **`EMPTY`**: Siswa mengosongkan nomor tersebut.
- **`MULTIPLE`**: Siswa menghitamkan lebih dari 1 bulatan.
- **`LOW_CONFIDENCE`**: Arsiran pensil tipis / bekas hapusan yang membutuhkan konfirmasi guru (*exception-first*).

---

## ⚠️ 5. Status Error & Penanganan
- **HTTP 401 Unauthorized:** Header `X-API-Key` salah atau tidak disertakan saat `OMR_API_KEY` aktif.
- **HTTP 422 Unprocessable Content:**
  - *Citra Buram:* Laplacian variance $< 20.0$. Minta guru mengambil ulang dengan kamera diam & pencahayaan cukup.
  - *Fiducial Kurang:* Kurang dari 4 kotak sudut hitam yang terdeteksi di dalam foto. Pastikan lembar LJK masuk penuh ke dalam frame.
