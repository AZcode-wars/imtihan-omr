"use client";

import * as React from "react";
import { OMRScanResponse, Student } from "@/types/omr";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
  UserCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateFinalGrade, formatFinalScore } from "@/lib/scoring";

export interface BatchItem {
  id: string;
  filename: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "ERROR";
  scanResult?: OMRScanResponse;
  selectedStudentId?: string;
  error?: string;
  warningCount: number;
}

export interface DesktopBatchScanProps {
  students: Student[];
  onSwitchToCamera?: () => void;
}

export function DesktopBatchScan({ students, onSwitchToCamera }: DesktopBatchScanProps) {
  const [items, setItems] = React.useState<BatchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);
  const [isProcessingAll, setIsProcessingAll] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"dropzone" | "workspace">("dropzone");

  const selectedItem = items[selectedIndex] || null;

  // Mock generator hasil scan untuk demo/uji
  const generateMockScan = (filename: string, idx: number): OMRScanResponse => {
    const student = students[idx % students.length];
    return {
      scanId: `batch-scan-${Date.now()}-${idx}`,
      sourceDevice: "DESKTOP_SCANNER",
      timestamp: new Date().toISOString(),
      studentNameCropUrl: "",
      fullWarpedImageUrl: "/sheet-preview.png",
      essayAreaCropUrl: "",
      mcAnswers: Array.from({ length: 30 }, (_, i) => {
        const qNum = i + 1;
        if (qNum === 7 && idx % 2 === 0) {
          return { questionNumber: qNum, selectedOption: null, status: "EMPTY", confidence: 0.95 };
        }
        if (qNum === 13 && idx % 3 === 0) {
          return { questionNumber: qNum, selectedOption: "A", status: "LOW_CONFIDENCE", confidence: 0.52, rawCandidates: ["A"] };
        }
        return {
          questionNumber: qNum,
          selectedOption: (["A", "B", "C", "D"] as const)[i % 4],
          status: "VALID",
          confidence: 0.98,
          rawCandidates: [(["A", "B", "C", "D"] as const)[i % 4]],
        };
      }),
    };
  };

  // Handler Multi-File & Dropzone
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newItems: BatchItem[] = Array.from(fileList).map((file, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      filename: file.name,
      status: "PENDING",
      warningCount: 0,
    }));

    setItems((prev) => [...prev, ...newItems]);
    setActiveTab("workspace");
    toast.success(`${newItems.length} berkas ditambahkan ke antrean batch`);
  };

  // Muat Demo 10 Lembar Sekaligus
  const handleLoadDemoBatch = () => {
    const demoItems: BatchItem[] = Array.from({ length: 8 }, (_, i) => {
      const mockResult = generateMockScan(`LJK_Siswa_${i + 1}.jpg`, i);
      const warnings = mockResult.mcAnswers.filter(
        (a) => a.status !== "VALID"
      ).length;

      return {
        id: `batch-${i + 1}`,
        filename: `LJK_Kelas8A_${String(i + 1).padStart(2, "0")}.png`,
        status: "DONE",
        scanResult: mockResult,
        selectedStudentId: students[i % students.length]?.id,
        warningCount: warnings,
      };
    });

    setItems(demoItems);
    setSelectedIndex(0);
    setActiveTab("workspace");
    toast.success("8 lembar demo berhasil dimuat ke antrean");
  };

  // Proses Semua Antrean Paralel
  const handleProcessBatch = async () => {
    if (items.length === 0 || isProcessingAll) return;
    setIsProcessingAll(true);

    const updated = [...items];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status !== "DONE") {
        updated[i].status = "PROCESSING";
        setItems([...updated]);

        // Simulasi latensi pemrosesan paralel 400ms per lembar
        await new Promise((r) => setTimeout(r, 400));

        const result = generateMockScan(updated[i].filename, i);
        const warnings = result.mcAnswers.filter((a) => a.status !== "VALID").length;

        updated[i].status = "DONE";
        updated[i].scanResult = result;
        updated[i].selectedStudentId = students[i % students.length]?.id;
        updated[i].warningCount = warnings;
        setItems([...updated]);
      }
    }

    setIsProcessingAll(false);
    toast.success("Pemrosesan batch selesai!");
  };

  // Navigasi Keyboard Arrow Up / Down
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "workspace" || items.length === 0) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, items.length]);

  // Perhitungan Nilai Live Lembar Aktif
  const calculateScore = (scan?: OMRScanResponse) => {
    if (!scan) return { grade: 0, validCount: 0 };
    const validCount = scan.mcAnswers.filter((a) => a.status === "VALID").length;
    return {
      grade: Math.round((validCount / 30) * 100),
      validCount,
    };
  };

  const processedCount = items.filter((i) => i.status === "DONE").length;

  return (
    <div className="w-full space-y-6">
      {/* Tab Switcher & Batch Action Header */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "dropzone" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("dropzone")}
            className="text-xs"
          >
            <Upload className="w-4 h-4 mr-1.5" /> Dropzone Berkas
          </Button>
          <Button
            variant={activeTab === "workspace" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("workspace")}
            className="text-xs"
          >
            <FileCheck2 className="w-4 h-4 mr-1.5" /> Split-Screen Review ({items.length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadDemoBatch}
            className="text-xs text-brand-700 hover:bg-brand-50"
          >
            Muat 8 Lembar Demo
          </Button>

          {onSwitchToCamera && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchToCamera}
              className="text-xs text-slate-500 hover:text-slate-800"
              title="Beralih ke mode bidik kamera"
            >
              Gunakan Kamera
            </Button>
          )}

          {items.length > 0 && (
            <Button
              size="sm"
              disabled={isProcessingAll || processedCount === items.length}
              onClick={handleProcessBatch}
              className="bg-brand-700 hover:bg-brand-800 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
            >
              {isProcessingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memproses {processedCount}/{items.length}
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Proses Semua ({items.length})
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* TAHAP 1: DROPZONE MULTI-FILE & PDF */}
      {activeTab === "dropzone" && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 flex flex-col items-center justify-center text-center hover:border-brand-500 transition-colors">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mb-4 shadow-xs">
            <Upload className="w-8 h-8 stroke-[1.8]" />
          </div>

          <h3 className="text-lg font-bold text-slate-800">
            Tarik & Lepas File LJK di Sini
          </h3>
          <p className="text-sm text-slate-500 max-w-md mt-1 mb-6">
            Mendukung file gambar (JPG, PNG) multi-file hingga puluhan lembar sekaligus atau dokumen PDF multi-halaman.
          </p>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-700 text-white font-semibold text-sm hover:bg-brand-800 shadow-sm cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span>Pilih Berkas Komputer</span>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </label>

          <div className="flex items-center gap-6 mt-8 text-xs text-slate-400">
            <span>✓ Multi-file JPG/PNG</span>
            <span>·</span>
            <span>✓ PDF Multi-Halaman</span>
            <span>·</span>
            <span>✓ Navigasi Keyboard ↑↓</span>
          </div>
        </div>
      )}

      {/* TAHAP 2: SPLIT-SCREEN BATCH WORKSPACE (Panel Kiri: Antrean, Panel Kanan: Inspeksi) */}
      {activeTab === "workspace" && (
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Panel Kiri: Daftar Antrean (4 cols, 320px approx) */}
          <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[750px]">
            {/* Header Antrean */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">
                  ANTREAN BATCH ({items.length})
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gunakan tombol panah ↑ / ↓ untuk navigasi
                </p>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                {processedCount}/{items.length} Selesai
              </span>
            </div>

            {/* List Lembar */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-transparent">
              {items.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const assignedStudent = students.find((s) => s.id === item.selectedStudentId);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={cn(
                      "w-full p-3 rounded-xl flex items-center justify-between text-left transition-all border",
                      isSelected
                        ? "bg-brand-50/80 border-brand-600 shadow-xs border-l-4 border-l-brand-700"
                        : "bg-white border-slate-200/80 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold font-mono text-xs text-slate-600 shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 truncate">
                          {assignedStudent ? assignedStudent.name : item.filename}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {assignedStudent ? `${assignedStudent.nis} · 8A` : item.filename}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {item.status === "DONE" && item.warningCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          {item.warningCount}
                        </span>
                      )}
                      {item.status === "DONE" && item.warningCount === 0 && (
                        <CheckCircle2 className="w-4 h-4 text-brand-600" />
                      )}
                      {item.status === "PROCESSING" && (
                        <Loader2 className="w-4 h-4 text-brand-700 animate-spin" />
                      )}
                      {item.status === "PENDING" && (
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel Kanan: Inspeksi LJK & Hasil Pindai (8 cols) */}
          <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col h-[750px] overflow-y-auto">
            {selectedItem ? (
              <div className="space-y-6">
                {/* Header Inspeksi */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <span>Inspeksi Lembar #{String(selectedIndex + 1).padStart(2, "0")}</span>
                      <span className="text-xs font-normal text-slate-400">
                        ({selectedItem.filename})
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cocokkan potongan nama dan periksa tanda ragu pada jawaban siswa.
                    </p>
                  </div>

                  {/* Navigasi Lembar Berikutnya */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={selectedIndex === 0}
                      onClick={() => setSelectedIndex((i) => i - 1)}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-mono font-medium text-slate-600 px-2">
                      {selectedIndex + 1} / {items.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={selectedIndex === items.length - 1}
                      onClick={() => setSelectedIndex((i) => i + 1)}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Grid Split Inspeksi: Potongan Gambar vs Identitas & Skor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sisi Kiri: Gambar LJK Lurus */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Kanvas Warp LJK Lurus
                    </span>
                    <div className="w-full h-80 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/sheet-preview.png"
                        alt="LJK Lurus"
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                  </div>

                  {/* Sisi Kanan: Siswa & Nilai */}
                  <div className="space-y-4">
                    {/* Identitas Siswa Dropdown */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Siswa Pemilik Lembar
                      </label>
                      <select
                        value={selectedItem.selectedStudentId || ""}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[selectedIndex].selectedStudentId = e.target.value;
                          setItems(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">-- Pilih Siswa Kelas 8A --</option>
                        {students.map((std) => (
                          <option key={std.id} value={std.id}>
                            {std.name} ({std.nis})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Ringkasan Skor Live */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-brand-50 to-emerald-50/40 border border-brand-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                          NILAI AKHIR
                        </span>
                        <span className="text-2xl font-bold font-mono text-brand-800">
                          {calculateScore(selectedItem.scanResult).grade}
                        </span>
                      </div>
                      <p className="text-xs text-brand-700 mt-1">
                        {calculateScore(selectedItem.scanResult).validCount} dari 30 soal pilihan ganda terjawab valid.
                      </p>
                    </div>

                    {/* Exception Warning List */}
                    <div>
                      <span className="text-xs font-bold text-slate-700 block mb-2">
                        Pemeriksaan Keraguan (Exception-First)
                      </span>
                      {selectedItem.warningCount === 0 ? (
                        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Semua 30 nomor terbaca mantap tanpa keraguan.</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedItem.scanResult?.mcAnswers
                            .filter((a) => a.status !== "VALID")
                            .map((ans) => (
                              <div
                                key={ans.questionNumber}
                                className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-xs"
                              >
                                <span className="font-bold text-amber-900">
                                  Soal No. {ans.questionNumber} ({ans.status})
                                </span>
                                <div className="flex gap-1">
                                  {(["A", "B", "C", "D"] as const).map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => {
                                        if (selectedItem.scanResult) {
                                          ans.selectedOption = opt;
                                          ans.status = "VALID";
                                          setItems([...items]);
                                          toast.success(`No ${ans.questionNumber} dikoreksi jadi ${opt}`);
                                        }
                                      }}
                                      className="px-2 py-0.5 rounded bg-white hover:bg-brand-700 hover:text-white border border-amber-300 font-bold transition-colors"
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Perubahan disimpan otomatis ke sesi lokal.
                  </span>
                  <Button
                    size="md"
                    onClick={() => {
                      toast.success(`Lembar #${selectedIndex + 1} diverifikasi`);
                      if (selectedIndex < items.length - 1) {
                        setSelectedIndex((i) => i + 1);
                      }
                    }}
                    className="bg-brand-700 hover:bg-brand-800 text-white font-semibold flex items-center gap-2"
                  >
                    <span>Simpan & Lembar Berikutnya</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400">
                <FileText className="w-12 h-12 stroke-[1.5] mb-2" />
                <p className="text-sm">Pilih salah satu lembar di sebelah kiri untuk melihat inspeksi.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
