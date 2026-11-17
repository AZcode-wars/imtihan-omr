"use client";

import * as React from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { FilterChips, GradeFilter } from "@/components/grades/filter-chips";
import { StudentGradeCard, StudentGradeRecord } from "@/components/grades/student-grade-card";
import { GradeTableDesktop } from "@/components/grades/grade-table-desktop";
import { getGradeRecordsByExam, getAllStudents, getActiveExam, deleteGradeRecord, deleteAllGradeRecords } from "@/lib/db";
import { GradedStudentRecord } from "@/types/omr";
import { ConfirmDeleteModal } from "@/components/grades/confirm-delete-modal";
import { toast } from "sonner";
import { Download, Search, Trash2 } from "lucide-react";

export default function GradesPage() {
  const [records, setRecords] = React.useState<StudentGradeRecord[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filter, setFilter] = React.useState<GradeFilter>("ALL");
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);
  const [totalStudentsInClass, setTotalStudentsInClass] = React.useState(0);
  const [passingScore, setPassingScore] = React.useState(75);
  const [examLabel, setExamLabel] = React.useState("UTS Matematika Kelas 8A");
  const [activeExamId, setActiveExamId] = React.useState("active_exam_config");

  // State Dialog Konfirmasi Hapus
  const [recordToDelete, setRecordToDelete] = React.useState<StudentGradeRecord | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Load data dari IndexedDB saat mount
  React.useEffect(() => {
    async function loadData() {
      try {
        const config = await getActiveExam();
        const currentExamId = config?.id || "active_exam_config";
        setActiveExamId(currentExamId);

        const [gradeRecords, students] = await Promise.all([
          getGradeRecordsByExam(currentExamId),
          getAllStudents(),
        ]);

        setTotalStudentsInClass(students.length);

        if (config) {
          setPassingScore(config.passingScore ?? 75);
          const examTitle = config.title || "UTS Matematika";
          const className = config.className || "Kelas 8A";
          setExamLabel(`${examTitle} ${className}`);
        }

        // Urutkan berdasarkan waktu pindaian terbaru
        const sortedRecords = [...gradeRecords].sort(
          (a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime()
        );

        // Deduplikasi per studentId (ambil attempt terbaru)
        const latestPerStudent = new Map<string, GradedStudentRecord>();
        for (const gr of sortedRecords) {
          if (!latestPerStudent.has(gr.studentId)) {
            latestPerStudent.set(gr.studentId, gr);
          }
        }
        const uniqueGradeRecords = Array.from(latestPerStudent.values());

        // Map GradedStudentRecord ke StudentGradeRecord untuk tampilan
        const mapped: StudentGradeRecord[] = uniqueGradeRecords.map((gr) => {
          const isPassing = gr.finalGrade >= (config?.passingScore ?? 75);
          return {
            id: gr.recordId,
            studentId: gr.studentId,
            nis: "", // akan di-enrich dari students
            name: gr.studentName,
            mcPoints: gr.rawMCScore,
            mcMaxPoints: gr.maxMCScore,
            essayPoints: gr.rawEssayScore,
            essayMaxPoints: gr.maxEssayScore,
            finalGrade: gr.finalGrade,
            isPassing,
            verifiedAt: gr.verifiedAt,
          };
        });

        // Enrich NIS dari student data
        const studentMap = new Map(students.map((s) => [s.id, s]));
        for (const rec of mapped) {
          const gr = uniqueGradeRecords.find((g) => g.recordId === rec.id);
          if (gr) {
            const student = studentMap.get(gr.studentId);
            if (student) {
              rec.nis = student.nis;
            }
          }
        }

        setRecords(mapped);
      } catch (err) {
        console.warn("Gagal memuat data rekap:", err);
      }
    }
    loadData();
  }, []);

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

    const scannedUnique = Math.min(records.length, totalStudentsInClass);

    return {
      avg: avgVal.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      highest: maxRecord.finalGrade.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      highestName: maxRecord.name,
      scannedCount: scannedUnique,
      remainingCount: Math.max(0, totalStudentsInClass - scannedUnique),
      passCount: pass,
      remedialCount: remedial,
    };
  }, [records, totalStudentsInClass]);

  const handleConfirmDeleteSingle = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteGradeRecord(recordToDelete.id);
      setRecords((prev) => prev.filter((r) => r.id !== recordToDelete.id));
      if (selectedRecordId === recordToDelete.id) {
        setSelectedRecordId(null);
      }
      toast.success(`Data nilai ${recordToDelete.name} berhasil dihapus.`);
      setRecordToDelete(null);
    } catch (err) {
      console.error("Gagal menghapus nilai:", err);
      toast.error("Gagal menghapus nilai dari penyimpanan lokal.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await deleteAllGradeRecords(activeExamId);
      setRecords([]);
      setSelectedRecordId(null);
      toast.success("Semua data nilai berhasil dihapus.");
      setIsDeleteAllModalOpen(false);
    } catch (err) {
      console.error("Gagal menghapus semua nilai:", err);
      toast.error("Gagal menghapus semua data nilai.");
    } finally {
      setIsDeleting(false);
    }
  };

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
    link.setAttribute("download", `rekap-nilai-${examLabel.toLowerCase().replace(/\s+/g, "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Rekap nilai ${examLabel} berhasil diunduh.`);
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
            Hasil koreksi ujian {examLabel} · KKM: {passingScore}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {records.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => setIsDeleteAllModalOpen(true)}
              className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/60 shadow-2xs h-9 text-xs"
              title="Hapus semua data nilai yang tersimpan"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Hapus Semua Data</span>
            </Button>
          )}

          <Button
            variant="primary"
            onClick={handleExportCsv}
            className="gap-2 shadow-sm h-9"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Export CSV Nilai</span>
          </Button>
        </div>
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
          <label htmlFor="search-grades" className="sr-only">
            Cari nama atau NIS siswa
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-grades"
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
          onDeleteRecord={(r) => setRecordToDelete(r)}
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
              onDelete={(r) => setRecordToDelete(r)}
            />
          ))
        )}
      </div>

      {/* Modal Konfirmasi Hapus Per Nilai */}
      <ConfirmDeleteModal
        isOpen={Boolean(recordToDelete)}
        onClose={() => setRecordToDelete(null)}
        onConfirm={handleConfirmDeleteSingle}
        title="Hapus Data Nilai Siswa?"
        description="Data nilai siswa ini akan dihapus dari IndexedDB."
        studentName={recordToDelete?.name}
        nis={recordToDelete?.nis}
        confirmLabel="Ya, Hapus Nilai"
        isDeleting={isDeleting}
      />

      {/* Modal Konfirmasi Hapus Semua Data Nilai */}
      <ConfirmDeleteModal
        isOpen={isDeleteAllModalOpen}
        onClose={() => setIsDeleteAllModalOpen(false)}
        onConfirm={handleConfirmDeleteAll}
        title="Hapus Semua Data Nilai?"
        description={`Seluruh ${records.length} data rekap nilai ujian ini akan dihapus dari IndexedDB.`}
        confirmLabel="Ya, Hapus Semua Data"
        isDeleting={isDeleting}
      />
    </div>
  );
}
