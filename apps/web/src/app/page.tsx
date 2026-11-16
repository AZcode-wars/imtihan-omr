import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BRAND = [
  ["brand-50", "#F3F7EF"],
  ["brand-100", "#E3EDD9"],
  ["brand-200", "#C7DCB5"],
  ["brand-300", "#A2C487"],
  ["brand-400", "#7DA95D"],
  ["brand-500", "#5D8B3E"],
  ["brand-600", "#476E2E"],
  ["brand-700", "#355A15"],
  ["brand-800", "#24400E"],
  ["brand-900", "#1C330C"],
] as const;

const SLATE = [
  ["slate-50", "#F8FAFC"],
  ["slate-100", "#F1F5F9"],
  ["slate-200", "#E2E8F0"],
  ["slate-300", "#CBD5E1"],
  ["slate-400", "#94A3B8"],
  ["slate-500", "#64748B"],
  ["slate-600", "#475569"],
  ["slate-700", "#334155"],
  ["slate-800", "#1E293B"],
  ["slate-900", "#0F172A"],
  ["slate-950", "#020617"],
] as const;

const STATUS = [
  ["valid", "brand-50", "brand-200", "brand-800"],
  ["empty", "status-empty-bg", "status-empty-border", "status-empty-text"],
  ["low", "status-low-bg", "status-low-border", "status-low-text"],
  ["multiple", "status-multiple-bg", "status-multiple-border", "status-multiple-text"],
] as const;

const TYPE = [
  ["display", "text-display", "Nilai Akhir 82,4"],
  ["h1", "text-h1", "Rekap Nilai"],
  ["h2", "text-h2", "Verifikasi Hasil Scan"],
  ["h3", "text-h3", "Kunci Jawaban PG"],
  ["body", "text-body", "Ahmad Fauzi — 22/25 PG · 18,5/25 Esai"],
  ["body-strong", "text-body-strong", "Ahmad Fauzi — 22/25 PG · 18,5/25 Esai"],
  ["label", "text-label", "PG: 22/25   Esai: 18,5/25"],
  ["caption", "text-caption", "Tersimpan 15/11/2026 11:24"],
  ["overline", "text-overline", "IDENTITAS UJIAN"],
  ["score-lg", "text-score-lg", "82,4"],
  ["score-md", "text-score-md", "79,4"],
  ["score-sm", "text-score-sm", "24/30"],
] as const;

/**
 * Menentukan warna teks di atas sebuah permukaan, mengikuti WCAG AA
 * (lihat docs/design_tokens.md §11).
 *
 * Dipakai untuk label specimen warna. Ini BUKAN bagian dari sistem desain
 * produk — di UI asli, teks di atas brand/800 selalu putih dan teks di atas
 * putih selalu slate-900.
 */
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

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-h3 font-bold text-slate-900">{title}</h2>
      {note ? <p className="mt-1 text-caption text-slate-500">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DesignSystemPreview() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="rounded-lg bg-brand-800 p-6 text-white">
        <p className="text-overline text-brand-200">ImtihanOMR</p>
        <h1 className="text-h1 font-bold tracking-tight">Design System Preview</h1>
        <p className="mt-1 text-body text-brand-100/80">
          Preview token yang sudah dipetakan ke Tailwind v4. Halaman ini
          membuktikan bahwa <code className="font-mono text-caption">globals.css</code>{" "}
          memuat seluruh token OpenOMR.
        </p>
      </header>

      <Section
        title="Brand"
        note="brand/700 = #355A15 adalah warna Primer (tombol utama). Bukan emerald-700."
      >
        <div className="flex flex-wrap gap-2">
          {BRAND.map(([name, hex]) => (
            <div
              key={name}
              className="h-20 w-[104px] rounded-md border border-slate-200 p-2"
              style={{ backgroundColor: `var(--${name})`, color: foreground(hex) }}
            >
              <p className="text-[10px] font-semibold">{name}</p>
              <p className="mt-6 text-[10px]">{hex}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Netral (slate)"
        note="Identik dengan default Tailwind — ditulis eksplisit agar tidak berubah diam-diam."
      >
        <div className="flex flex-wrap gap-2">
          {SLATE.map(([name, hex]) => (
            <div
              key={name}
              className="h-16 w-24 rounded-md border border-slate-200 p-2"
              style={{ backgroundColor: `var(--${name})`, color: foreground(hex) }}
            >
              <p className="text-[10px] font-semibold">{name}</p>
              <p className="mt-3 text-[10px]">{hex}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Status OMR"
        note="EMPTY (tidak diisi) sengaja netral — bukan error. LOW_CONFIDENCE memakai border dashed + angka confidence."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {STATUS.map(([name, bg, border, text]) => (
            <div key={name} className="flex items-center gap-3">
              <span
                className="rounded-md border px-3 py-2 text-label font-bold"
                style={{
                  backgroundColor: `var(--${bg})`,
                  borderColor: `var(--${border})`,
                  color: `var(--${text})`,
                  borderStyle: name === "low" ? "dashed" : "solid",
                }}
              >
                {name}
              </span>
              <code className="font-mono text-caption text-slate-500">
                {bg} / {border} / {text}
              </code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografi" note="Roboto untuk UI, Caveat untuk simulasi tulisan tangan.">
        <div className="flex flex-col gap-3">
          {TYPE.map(([name, cls, sample]) => (
            <div key={name} className="flex items-baseline gap-4">
              <span className="w-28 shrink-0 font-mono text-caption text-slate-400">{name}</span>
              <span className={`${cls} tabular text-slate-900`}>{sample}</span>
            </div>
          ))}
          <div className="flex items-baseline gap-4">
            <span className="w-28 shrink-0 font-mono text-caption text-slate-400">hand</span>
            <span className="font-hand text-2xl font-bold text-slate-900">Ahmad Fauzan</span>
          </div>
        </div>
      </Section>

      <Section title="Radius & Elevation">
        <div className="flex flex-wrap gap-4">
          {["sm", "md", "lg", "xl"].map((r) => (
            <div key={r} className="flex flex-col items-center gap-2">
              <div
                className="size-20 border border-brand-200 bg-brand-50"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <span className="font-mono text-caption text-slate-500">radius-{r}</span>
            </div>
          ))}
          {["card", "raised", "floating", "sheet"].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className="h-20 w-28 rounded-md border border-slate-200 bg-white" style={{ boxShadow: `var(--shadow-${s})` }} />
              <span className="font-mono text-caption text-slate-500">shadow-{s}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Button" note="Varian: primary / secondary / ghost / danger. Ukuran: sm 32 / md 44 / lg 52.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Simpan</Button>
            <Button variant="secondary">Batal</Button>
            <Button variant="ghost">Lihat pratinjau</Button>
            <Button variant="danger">Hapus</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm">
              sm 32
            </Button>
            <Button variant="primary" size="md">
              md 44
            </Button>
            <Button variant="primary" size="lg">
              lg 52
            </Button>
            <Button variant="primary" size="icon" aria-label="Tambah">
              +
            </Button>
            <Button variant="primary" size="md" disabled>
              disabled
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="pass">Lulus</Badge>
          <Badge variant="remedial">Remedial</Badge>
          <Badge variant="default">MVP</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="secondary">secondary</Badge>
        </div>
      </Section>

      <Section title="Navigasi Aplikasi (Task 6)">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/setup"
            className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg text-sm shadow-sm"
          >
            Buka Halaman Ujian (/setup) →
          </a>
          <a
            href="/scan"
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg text-sm shadow-sm hover:bg-slate-50"
          >
            Buka Halaman Scan (/scan) →
          </a>
        </div>
      </Section>
    </main>
  );
}
