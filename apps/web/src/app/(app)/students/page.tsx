"use client";

import * as React from "react";
import { Student } from "@/types/omr";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Download,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";

// Initial data kosong untuk siap produksi & diisi data riil
const INITIAL_STUDENTS: Student[] = [];

export default function StudentsPage() {
  const [students, setStudents] = React.useState<Student[]>(INITIAL_STUDENTS);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedClass, setSelectedClass] = React.useState("Kelas 8A");

  // Modal Tambah Siswa
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newNis, setNewNis] = React.useState("");
  const [newName, setNewName] = React.useState("");

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nis.includes(searchQuery)
  );

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNis.trim() || !newName.trim()) {
      toast.error("Nama dan NIS siswa wajib diisi.");
      return;
    }

    if (students.some((s) => s.nis === newNis.trim())) {
      toast.error("NIS sudah terdaftar untuk siswa lain.");
      return;
    }

    const newStudent: Student = {
      id: `std-${Date.now()}`,
      nis: newNis.trim(),
      name: newName.trim(),
      className: selectedClass,
    };

    setStudents((prev) => [newStudent, ...prev]);
    setNewNis("");
    setNewName("");
    setIsAddOpen(false);
    toast.success(`Siswa ${newStudent.name} berhasil ditambahkan.`);
  };

  const handleDeleteStudent = (id: string, name: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    toast.success(`${name} dihapus dari daftar.`);
  };

  const handleExportCsv = () => {
    const headers = "NIS,Nama Siswa,Kelas\n";
    const rows = students
      .map((s) => `"${s.nis}","${s.name}","${s.className}"`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `roster-${selectedClass.toLowerCase().replace(/\s+/g, "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Roster siswa berhasil diekspor ke CSV.");
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        toast.error("Berkas CSV kosong atau tidak memiliki baris data.");
        return;
      }

      const imported: Student[] = [];
      // Skip header baris 0
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.replace(/^"|"$/g, "").trim());
        if (parts.length >= 2 && parts[0] && parts[1]) {
          imported.push({
            id: `std-imp-${Date.now()}-${i}`,
            nis: parts[0],
            name: parts[1],
            className: parts[2] || selectedClass,
          });
        }
      }

      if (imported.length > 0) {
        setStudents((prev) => {
          // Filter duplikat NIS
          const existingNis = new Set(prev.map((s) => s.nis));
          const uniqueNew = imported.filter((s) => !existingNis.has(s.nis));
          return [...prev, ...uniqueNew];
        });
        toast.success(`Berhasil mengimpor ${imported.length} siswa.`);
      } else {
        toast.error("Format CSV tidak sesuai (diperlukan kolom: NIS, Nama).");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Kelas & Siswa
          </h1>
          <p className="text-sm text-slate-500">
            Daftar siswa untuk filter otomatis verifikasi hasil scan LJK (Smart Student Dropdown).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Tambah Siswa</span>
          </Button>
        </div>
      </div>

      {/* Bar Pencarian & Info Kelas */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{selectedClass}</h3>
            <p className="text-xs text-slate-500">{students.length} siswa terdaftar</p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau NIS..."
            className="w-full h-10 pl-9 pr-3 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-all"
          />
        </div>
      </div>

      {/* Daftar Siswa */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="font-bold text-slate-700">Tidak ada siswa ditemukan</p>
            <p className="text-xs text-slate-400">
              Silakan periksa kata kunci pencarian atau tambahkan siswa baru.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredStudents.map((student, idx) => (
              <div
                key={student.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 text-xs font-bold text-slate-400 tabular-nums">
                    {idx + 1}.
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 leading-tight">
                      {student.name}
                    </h4>
                    <p className="text-xs font-semibold text-slate-400 tabular-nums leading-tight mt-0.5">
                      NIS: {student.nis}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Aktif</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDeleteStudent(student.id, student.name)}
                    className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer rounded-lg hover:bg-rose-50"
                    title="Hapus siswa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bar Impor / Ekspor CSV */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors">
          <Upload className="w-4 h-4 text-brand-700" />
          <span>Import CSV Roster</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCsv}
            className="hidden"
          />
        </label>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCsv}
          className="w-full sm:w-auto gap-2"
        >
          <Download className="w-4 h-4 text-slate-600" />
          <span>Export CSV Roster</span>
        </Button>
      </div>

      {/* Modal Tambah Siswa */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-floating space-y-4 border border-slate-100">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-base font-bold text-slate-800">
                Tambah Siswa Baru
              </h3>
              <p className="text-xs text-slate-400">
                Masukkan identitas siswa untuk kelas {selectedClass}.
              </p>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">NIS (Nomor Induk Siswa)</label>
                <input
                  type="text"
                  value={newNis}
                  onChange={(e) => setNewNis(e.target.value)}
                  placeholder="Contoh: 2409"
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Farhan Alamsyah"
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setIsAddOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  Tambahkan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
