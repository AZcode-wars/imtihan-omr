"use client";

import * as React from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { FilterChips, GradeFilter } from "@/components/grades/filter-chips";
import { StudentGradeCard, StudentGradeRecord } from "@/components/grades/student-grade-card";
import { GradeTableDesktop } from "@/components/grades/grade-table-desktop";
import { toast } from "sonner";
import { Download, Search, Users } from "lucide-react";

const INITIAL_RECORDS: StudentGradeRecord[] = [
  {
    id: "rec-1",
    nis: "2401",
    name: "Ahmad Fauzi",
    mcPoints: 24,
    mcMaxPoints: 30,
    essayPoints: 18.5,
    essayMaxPoints: 25,
    finalGrade: 81.4,
    isPassing: true,
    verifiedAt: "2026-11-15T11:24:00Z",
  },
  {
    id: "rec-2",
    nis: "2402",
    name: "Nadia Putri Rahma",
    mcPoints: 28,
    mcMaxPoints: 30,
    essayPoints: 23.0,
    essayMaxPoints: 25,
    finalGrade: 92.8,
    isPassing: true,
    verifiedAt: "2026-11-15T11:26:00Z",
  },
  {
    id: "rec-3",
    nis: "2403",
    name: "Dimas Pratama",
    mcPoints: 19,
    mcMaxPoints: 30,
    essayPoints: 14.0,
    essayMaxPoints: 25,
    finalGrade: 68.2,
    isPassing: false,
    verifiedAt: "2026-11-15T11:28:00Z",
  },
  {
    id: "rec-4",
    nis: "2404",
    name: "Siti Nurhaliza",
    mcPoints: 29,
    mcMaxPoints: 30,
    essayPoints: 24.5,
    essayMaxPoints: 25,
    finalGrade: 96.0,
    isPassing: true,
    verifiedAt: "2026-11-15T11:30:00Z",
  },
  {
    id: "rec-5",
    nis: "2405",
    name: "Budi Santoso",
    mcPoints: 21,
    mcMaxPoints: 30,
    essayPoints: 16.0,
    essayMaxPoints: 25,
    finalGrade: 73.5,
    isPassing: false,
    verifiedAt: "2026-11-15T11:32:00Z",
  },
  {
    id: "rec-6",
    nis: "2406",
    name: "Dewi Lestari",
    mcPoints: 26,
    mcMaxPoints: 30,
    essayPoints: 21.0,
    essayMaxPoints: 25,
    finalGrade: 86.2,
    isPassing: true,
    verifiedAt: "2026-11-15T11:35:00Z",
  },
  {
    id: "rec-7",
    nis: "2407",
    name: "Rian Hidayat",
    mcPoints: 25,
    mcMaxPoints: 30,
    essayPoints: 19.0,
    essayMaxPoints: 25,
    finalGrade: 82.5,
    isPassing: true,
    verifiedAt: "2026-11-15T11:37:00Z",
  },
  {
    id: "rec-8",
    nis: "2408",
    name: "Anisa Rahmawati",
    mcPoints: 27,
    mcMaxPoints: 30,
    essayPoints: 22.5,
    essayMaxPoints: 25,
    finalGrade: 90.0,
    isPassing: true,
    verifiedAt: "2026-11-15T11:40:00Z",
  },
];

export default function GradesPage() {
  const [records, setRecords] = React.useState<StudentGradeRecord[]>(INITIAL_RECORDS);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filter, setFilter] = React.useState<GradeFilter>("ALL");
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);

  const passingScore = 75;
  const totalStudentsInClass = 30;

  // Filter & Search Records
  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.nis.includes(searchQuery);

      if (!matchesSearch) return false;

      if (filter === "PASS") return r.isPassing;
      if (filter === "REMEDIAL") return !r.isPassing;
      return true;
    });
  }, [records, searchQuery, filter]);

  // Statistik KPI
  const stats = React.useMemo(() => {
    if (records.length === 0) {
      return {
        avg: "0,0",
        highest: "—",
        highestName: "—",
        scannedCount: 0,
        remainingCount: totalStudentsInClass,
        passCount: 0,
        remedialCount: 0,
      };
    }

    const sum = records.reduce((acc, r) => acc + r.finalGrade, 0);
    const avgVal = sum / records.length;

    let maxRecord = records[0];
    let pass = 0;
    let remedial = 0;

    for (const r of records) {
      if (r.finalGrade > maxRecord.finalGrade) {
        maxRecord = r;
      }
      if (r.isPassing) pass++;
      else remedial++;
    }

    return {
      avg: avgVal.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      highest: maxRecord.finalGrade.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      highestName: maxRecord.name,
      scannedCount: records.length,
      remainingCount: Math.max(0, totalStudentsInClass - records.length),
      passCount: pass,
      remedialCount: remedial,
    };
  }, [records]);

  const handleExportCsv = () => {
    // Format CSV id-ID (titik koma / koma desimal)
    const header = "NIS,Nama Siswa,Skor PG,Maks PG,Skor Esai,Maks Esai,Nilai Akhir,Status\n";
    const rows = records
      .map(
        (r) =>
          `"${r.nis}","${r.name}",${r.mcPoints},${r.mcMaxPoints},${r.essayPoints},${r.essayMaxPoints},"${r.finalGrade.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}","${r.isPassing ? "Lulus" : "Remedial"}"`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `rekap-nilai-uts-matematika-8a.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Rekap_Ujian_UTS_Matematika_8A.csv berhasil diunduh.");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Rekap Nilai
          </h1>
          <p className="text-sm text-slate-500">
            Hasil koreksi ujian UTS Matematika Kelas 8A · KKM: {passingScore}
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleExportCsv}
          className="gap-2 shadow-sm self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-white" />
          <span>Export CSV Nilai</span>
        </Button>
      </div>

      {/* Baris 3 Kartu KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="RATA-RATA KELAS"
          value={stats.avg}
          badge={`KKM: ${passingScore}`}
          badgeVariant="pass"
        />
        <KpiCard
          label="NILAI TERTINGGI"
          value={stats.highest}
          subLabel={stats.highestName}
          badgeVariant="neutral"
        />
        <KpiCard
          label="PROGRESS TERSCAN"
          value={`${stats.scannedCount}/${totalStudentsInClass}`}
          badge={stats.remainingCount > 0 ? `Sisa ${stats.remainingCount} lembar` : "Selesai 100%"}
          badgeVariant={stats.remainingCount > 0 ? "warning" : "pass"}
        />
      </div>

      {/* Toolbar Pencarian & Filter Status */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau NIS siswa..."
            className="w-full h-10 pl-9 pr-3 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-all"
          />
        </div>

        <FilterChips
          value={filter}
          onChange={setFilter}
          counts={{
            all: records.length,
            pass: stats.passCount,
            remedial: stats.remedialCount,
          }}
        />
      </div>

      {/* Konten Responsif: Tabel di Desktop (>= 1024px) / Kartu Siswa di Mobile (< 1024px) */}
      <div className="hidden lg:block">
        <GradeTableDesktop
          records={filteredRecords}
          selectedId={selectedRecordId}
          onSelectRecord={(r) => setSelectedRecordId(r.id)}
        />
      </div>

      <div className="lg:hidden space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-1">
            <p className="font-bold text-slate-700">Tidak ada data nilai</p>
            <p className="text-xs text-slate-400">
              Tidak ada siswa yang cocok dengan kriteria filter saat ini.
            </p>
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <StudentGradeCard
              key={rec.id}
              record={rec}
              onClick={() => setSelectedRecordId(rec.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
