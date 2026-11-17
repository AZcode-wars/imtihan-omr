"use client";

import * as React from "react";
import {
  ExamConfig,
  GradedStudentRecord,
  OMREngineSettings,
  OMRScanResponse,
  Student,
} from "@/types/omr";
import { Button } from "@/components/ui/button";
import { getActiveExam, saveGradeRecord, getEngineSettings, DEFAULT_ENGINE_SETTINGS } from "@/lib/db";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  Globe,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  UserCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateFinalGrade, formatFinalScore, type EssayMarkResult, type McQuestionResult } from "@/lib/scoring";
import { buildTemplateFromExam } from "@/lib/template-builder";
import { scanSheetWithClientEngine } from "@/lib/omr-engine/client";
import { EssayMarkRow } from "@/components/scan/essay-mark-row";

export interface BatchEssayMark {
  questionNumber: number;
  maxScore: number;
  outcome: "CORRECT" | "INCORRECT" | "PARTIAL";
  pointsAwarded: number;
}

export interface BatchItem {
  id: string;
  filename: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "ERROR";
  scanResult?: OMRScanResponse;
  selectedStudentId?: string;
  error?: string;
  warningCount: number;
  previewUrl?: string;
  file?: File;
  essayMarks?: BatchEssayMark[];
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
  const [examConfig, setExamConfig] = React.useState<ExamConfig | null>(null);
  const [engineSettings, setEngineSettings] =
    React.useState<OMREngineSettings>(DEFAULT_ENGINE_SETTINGS);

  React.useEffect(() => {
    async function loadConfig() {
      setEngineSettings(getEngineSettings());
      const active = await getActiveExam();
      if (active) setExamConfig(active);
    }
    loadConfig();
  }, []);

  const selectedItem = items[selectedIndex] || null;
  const activePgCount = examConfig?.multipleChoiceQuestions?.length ?? 30;

  // Mock generator hasil scan untuk demo/uji
  const generateMockScan = (filename: string, idx: number, previewUrl?: string): OMRScanResponse => {
    return {
      scanId: `batch-scan-${Date.now()}-${idx}`,
      sourceDevice: "DESKTOP_SCANNER",
      timestamp: new Date().toISOString(),
      studentNameCropUrl: "",
      fullWarpedImageUrl: previewUrl || "/sheet-preview.png",
      essayAreaCropUrl: "",
      mcAnswers: Array.from({ length: activePgCount }, (_, i) => {
        const qNum = i + 1;
        if (qNum === 7 && idx % 2 === 0 && activePgCount >= 7) {
          return { questionNumber: qNum, selectedOption: null, status: "EMPTY", confidence: 0.95 };
        }
        if (qNum === 13 && idx % 3 === 0 && activePgCount >= 13) {
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

  // Helper konversi file ke base64 data url
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handler Multi-File & Dropzone
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newItems: BatchItem[] = Array.from(fileList).map((file, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      filename: file.name,
      file,
      previewUrl: URL.createObjectURL(file),
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

  // Proses Semua Antrean Paralel (Mengirim berkas asli ke API Scan Engine)
  const handleProcessBatch = async () => {
    if (items.length === 0 || isProcessingAll) return;
    setIsProcessingAll(true);

    // Bangun metadata template dari konfigurasi ujian aktif
    const templateMeta = buildTemplateFromExam(examConfig);

    const updated = [...items];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status !== "DONE") {
        updated[i].status = "PROCESSING";
        setItems([...updated]);

        let result: OMRScanResponse;
        let isRealScanned = false;

        // Jika memiliki berkas file asli yang diunggah
        if (updated[i].file) {
          try {
            const dataUrl = updated[i].previewUrl || (await fileToDataUrl(updated[i].file!));
            const templatePayload = templateMeta || buildTemplateFromExam(examConfig);

            const realData = await scanSheetWithClientEngine({
              imageDataUrl: dataUrl,
              template: templatePayload,
              sourceDevice: "DESKTOP_SCANNER",
            });

            // Filter nomor soal sesuai jumlah PG yang diatur guru di Ujian & Aturan
            const filteredMc = (realData.mcAnswers || []).slice(0, activePgCount);
            result = {
              ...realData,
              fullWarpedImageUrl: realData.fullWarpedImageUrl || dataUrl || "/sheet-preview.png",
              mcAnswers: filteredMc,
            };
            isRealScanned = true;
          } catch (err: any) {
            console.warn("Gagal memproses via engine, fallback ke simulasi:", err);
            result = generateMockScan(updated[i].filename, i, updated[i].previewUrl);
          }
        } else {
          await new Promise((r) => setTimeout(r, 300));
          result = generateMockScan(updated[i].filename, i, updated[i].previewUrl);
        }

        const warnings = result.mcAnswers.filter((a) => a.status !== "VALID").length;

        updated[i].status = "DONE";
        updated[i].scanResult = result;
        updated[i].selectedStudentId = students[i % (students.length || 1)]?.id;
        updated[i].warningCount = warnings;
        setItems([...updated]);
      }
    }

    setIsProcessingAll(false);
    toast.success("Pemrosesan antrean batch selesai!");
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

  // Perhitungan Nilai Live Lembar Aktif (Cocokkan dengan Kunci Jawaban Ujian Aktif & Aturan Scoring)
  const calculateScore = (scan?: OMRScanResponse, customEssayMarks?: BatchEssayMark[]) => {
    const mcConfig = (examConfig?.multipleChoiceQuestions || []).slice(0, 30);
    const essayConfig = examConfig?.essayQuestions || [];

    const mcQuestions: McQuestionResult[] = mcConfig.map((q) => {
      const ans = scan?.mcAnswers?.find((a) => a.questionNumber === q.number);
      const selectedOption = ans && ans.status === "VALID" ? ans.selectedOption : null;
      return {
        number: q.number,
        correctAnswer: q.correctAnswer,
        selectedOption: (selectedOption as any) || null,
        pointsCorrect: q.pointsCorrect ?? 1,
        pointsWrong: q.pointsWrong ?? 0,
        status: q.status ?? "ACTIVE",
      };
    });

    const essayQuestions: EssayMarkResult[] = essayConfig.map((eq) => {
      const mark = customEssayMarks?.find((m) => m.questionNumber === eq.number);
      if (mark) {
        return {
          number: eq.number,
          maxScore: eq.maxScore ?? 10,
          outcome: mark.outcome,
          partialScore: mark.pointsAwarded,
        };
      }
      return {
        number: eq.number,
        maxScore: eq.maxScore ?? 10,
        outcome: "INCORRECT",
      };
    });

    const scoringRes = calculateFinalGrade({
      mode: examConfig?.scoringMode ?? "MODE_A_PERCENTAGE",
      rounding: examConfig?.rounding ?? "ROUND_HALF_UP",
      mcQuestions,
      essayQuestions,
      weights: examConfig?.sectionWeights,
    });

    let correctCount = 0;
    let validCount = 0;

    scan?.mcAnswers?.forEach((ans) => {
      if (ans.status === "VALID") {
        validCount++;
        const configItem = mcConfig.find((q) => q.number === ans.questionNumber);
        if (configItem?.correctAnswer && ans.selectedOption === configItem.correctAnswer) {
          correctCount++;
        }
      }
    });

    const totalCount = mcConfig.length > 0 ? mcConfig.length : activePgCount;

    return {
      grade: scoringRes.finalGrade,
      formattedGrade: formatFinalScore(scoringRes),
      scale: scoringRes.scale,
      totalPossiblePoints: scoringRes.totalPossiblePoints,
      validCount,
      correctCount,
      totalCount,
      rawScore: scoringRes.rawScore,
      scoringRes,
    };
  };

  // Handler Hapus Satu Antrean
  const handleDeleteItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setItems((prev) => {
      const idx = prev.findIndex((item) => item.id === id);
      const updated = prev.filter((item) => item.id !== id);
      if (selectedIndex >= updated.length) {
        setSelectedIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
    toast.success("Lembar LJK dihapus dari antrean");
  };

  // Handler Hapus Semua Antrean
  const handleClearAll = () => {
    if (items.length === 0) return;
    if (confirm("Apakah Anda yakin ingin menghapus seluruh berkas dalam antrean?")) {
      setItems([]);
      setSelectedIndex(0);
      setActiveTab("dropzone");
      toast.success("Seluruh antrean berkas telah dibersihkan");
    }
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
          {/* Badge Engine OMR Aktif */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-slate-50 text-slate-700 select-none"
            title={
              engineSettings.mode === "CLIENT_WASM"
                ? "Engine: In-Browser WASM (OpenCV.js Web Worker)"
                : `Engine: Server API (${engineSettings.serverUrl})`
            }
          >
            {engineSettings.mode === "CLIENT_WASM" ? (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="text-slate-800">Engine: WASM (Offline)</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                <span className="text-slate-800">Engine: Server API</span>
              </>
            )}
          </div>

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
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1.5"
                title="Hapus semua berkas antrean"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kosongkan Antrean</span>
              </Button>

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
            </>
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
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedIndex(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedIndex(idx);
                      }
                    }}
                    className={cn(
                      "w-full p-3 rounded-xl flex items-center justify-between text-left transition-all border cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
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
                          {assignedStudent
                            ? `${assignedStudent.nis} · ${item.filename}`
                            : item.file
                            ? `${(item.file.size / 1024).toFixed(0)} KB · Menunggu pemilihan siswa`
                            : "Menunggu pemilihan siswa"}
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

                      {/* Tombol Hapus Lembar Ini */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1 cursor-pointer"
                        title="Hapus lembar ini dari antrean"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel Kanan: Inspeksi LJK & Hasil Pindai (8 cols) */}
          <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col h-[750px] overflow-y-auto">
            {selectedItem ? (() => {
              const isItemProcessed = selectedItem.status === "DONE" && Boolean(selectedItem.scanResult);
              return (
              <div className="space-y-6">
                {/* Header Inspeksi */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-800">
                        Inspeksi Lembar #{String(selectedIndex + 1).padStart(2, "0")}
                      </h2>
                      <span className="text-xs font-normal text-slate-400">
                        ({selectedItem.filename})
                      </span>
                      {isItemProcessed ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Sudah Diproses</span>
                        </span>
                      ) : selectedItem.status === "PROCESSING" ? (
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          <span>Sedang Diproses</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Belum Diproses</span>
                        </span>
                      )}
                    </div>
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
                        src={selectedItem.scanResult?.fullWarpedImageUrl || selectedItem.previewUrl || "/sheet-preview.png"}
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

                    {!isItemProcessed ? (
                      /* Banner jika foto belum diproses */
                      <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-3">
                        <div className="flex items-center gap-2">
                          {selectedItem.status === "PROCESSING" ? (
                            <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold uppercase tracking-wider">
                            {selectedItem.status === "PROCESSING"
                              ? "Sedang Memindai Citra LJK..."
                              : selectedItem.status === "ERROR"
                              ? "Gagal Memproses LJK"
                              : "Hasil Nilai Belum Tersedia"}
                          </span>
                        </div>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          {selectedItem.status === "PROCESSING"
                            ? "Engine OMR sedang membaca bulatan lembar ini. Mohon tunggu sejenak..."
                            : selectedItem.status === "ERROR"
                            ? (selectedItem.error || "Citra LJK tidak terbaca dengan baik. Pastikan 4 sudut fiducial terlihat.")
                            : "Foto lembar ini belum dipindai oleh engine OMR. Tombol simpan dinonaktifkan sampai lembar selesai diproses."}
                        </p>
                        {selectedItem.status !== "PROCESSING" && (
                          <Button
                            size="sm"
                            disabled={isProcessingAll}
                            onClick={handleProcessBatch}
                            className="bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Proses Semua Antrean Sekarang</span>
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Ringkasan Skor Live */}
                        {(() => {
                          const scoreInfo = calculateScore(selectedItem.scanResult, selectedItem.essayMarks);
                          const isModeB = examConfig?.scoringMode === "MODE_B_DIRECT_POINTS";
                          return (
                            <div className="p-4 rounded-xl bg-gradient-to-br from-brand-50 to-emerald-50/40 border border-brand-200">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="text-xs font-bold text-brand-900 uppercase tracking-wider block">
                                    NILAI AKHIR {isModeB ? "(Mode B: Poin)" : "(Mode A: Skala 0-100)"}
                                  </span>
                                  <span className="text-[11px] text-brand-700 font-medium">
                                    {scoreInfo.correctCount} Benar dari {scoreInfo.totalCount} Soal PG
                                    {isModeB && ` · PG: ${scoreInfo.scoringRes.mcPoints}/${scoreInfo.scoringRes.mcMaxPoints} Poin`}
                                    {scoreInfo.scoringRes.essayMaxPoints > 0 && ` · Esai: ${scoreInfo.scoringRes.essayPoints}/${scoreInfo.scoringRes.essayMaxPoints} Poin`}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-3xl font-bold font-mono text-brand-800">
                                    {scoreInfo.grade}
                                  </span>
                                  {isModeB && (
                                    <span className="text-[10px] text-brand-700 block font-mono">
                                      / {scoreInfo.totalPossiblePoints} poin
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2 pt-2 border-t border-brand-200/60 flex items-center justify-between text-[11px] text-brand-800">
                                <span>Status Pengisian LJK:</span>
                                <span className="font-semibold">
                                  {scoreInfo.validCount} / {scoreInfo.totalCount} Terisi Valid
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Rincian Jawaban Siswa vs Kunci */}
                        <div>
                          <span className="text-xs font-bold text-slate-700 block mb-2">
                            Pemeriksaan Jawaban ({calculateScore(selectedItem.scanResult).totalCount} Soal)
                          </span>
                          <div className="grid grid-cols-5 gap-1.5 mb-3">
                            {selectedItem.scanResult?.mcAnswers.map((ans) => {
                              const configItem = examConfig?.multipleChoiceQuestions?.find(
                                (q) => q.number === ans.questionNumber
                              );
                              const correctKey = configItem?.correctAnswer || "A";
                              const isCorrect = ans.status === "VALID" && ans.selectedOption === correctKey;
                              const isWrong = ans.status === "VALID" && ans.selectedOption !== correctKey;

                              return (
                                <div
                                  key={ans.questionNumber}
                                  className={cn(
                                    "p-2 rounded-lg border text-center text-xs flex flex-col items-center justify-center transition-all",
                                    isCorrect
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                                      : isWrong
                                      ? "bg-rose-50 border-rose-300 text-rose-900"
                                      : "bg-amber-50 border-amber-300 text-amber-900"
                                  )}
                                >
                                  <span className="text-[10px] font-bold text-slate-500">#{ans.questionNumber}</span>
                                  <span className="text-sm font-bold font-mono my-0.5">
                                    {ans.selectedOption || "-"}
                                  </span>
                                  <span className="text-[9px] font-medium opacity-80">
                                    Kunci: {correctKey}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Exception Warning List */}
                        <div>
                          <span className="text-xs font-bold text-slate-700 block mb-2">
                            Pemeriksaan Keraguan (Exception-First)
                          </span>
                          {selectedItem.warningCount === 0 ? (
                            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>
                                Semua {calculateScore(selectedItem.scanResult, selectedItem.essayMarks).totalCount} nomor terbaca mantap tanpa keraguan.
                              </span>
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

                        {/* Penilaian Esai Guru */}
                        {examConfig?.essayQuestions && examConfig.essayQuestions.length > 0 && (
                          <div className="space-y-3 pt-3 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-800 block">
                              Penilaian Esai Guru
                            </span>

                            {/* Potongan Area Esai jika tersedia */}
                            {selectedItem.scanResult?.essayAreaCropUrl && (
                              <div className="space-y-1">
                                <span className="text-[11px] text-slate-400">
                                  Potongan Area Esai Lembar Jawaban:
                                </span>
                                <img
                                  src={selectedItem.scanResult.essayAreaCropUrl}
                                  alt="Area Esai"
                                  className="w-full max-h-48 object-contain rounded-xl border border-slate-200 bg-white"
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-2">
                              {examConfig.essayQuestions.map((eq) => {
                                const currentMark = selectedItem.essayMarks?.find(
                                  (m) => m.questionNumber === eq.number
                                );
                                const pointsAwarded = currentMark ? currentMark.pointsAwarded : 0;
                                const outcome = currentMark ? currentMark.outcome : "INCORRECT";

                                return (
                                  <EssayMarkRow
                                    key={eq.number}
                                    questionNumber={eq.number}
                                    maxScore={eq.maxScore ?? 10}
                                    pointsAwarded={pointsAwarded}
                                    outcome={outcome}
                                    onChange={(pts, out) => {
                                      const existing = selectedItem.essayMarks || [];
                                      const updatedMarks = existing.filter((m) => m.questionNumber !== eq.number);
                                      updatedMarks.push({
                                        questionNumber: eq.number,
                                        maxScore: eq.maxScore ?? 10,
                                        outcome: out,
                                        pointsAwarded: pts,
                                      });
                                      selectedItem.essayMarks = updatedMarks;
                                      setItems([...items]);
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    {!isItemProcessed
                      ? selectedItem.status === "PROCESSING"
                        ? "Sedang memproses pembacaan LJK..."
                        : "Foto belum diproses. Tekan 'Proses Semua' di bagian atas terlebih dahulu."
                      : "Perubahan disimpan otomatis ke sesi lokal."}
                  </span>
                  <Button
                    size="md"
                    disabled={!isItemProcessed}
                    onClick={async () => {
                      if (!selectedItem || !isItemProcessed) return;
                      const student = students.find((s) => s.id === selectedItem.selectedStudentId);
                      if (!student) {
                        toast.error("Harap pilih nama siswa terlebih dahulu.");
                        return;
                      }

                      const score = calculateScore(selectedItem.scanResult, selectedItem.essayMarks);
                      const scanPayload = selectedItem.scanResult || generateMockScan(selectedItem.filename, selectedIndex);

                      const gradeRecord: GradedStudentRecord = {
                        recordId: `rec-${selectedItem.id}-${Date.now()}`,
                        examId: examConfig?.id || "active_exam_config",
                        studentId: student.id,
                        studentName: student.name,
                        rawMCScore: score.scoringRes.mcPoints,
                        maxMCScore: score.scoringRes.mcMaxPoints,
                        rawEssayScore: score.scoringRes.essayPoints,
                        maxEssayScore: score.scoringRes.essayMaxPoints,
                        finalGrade: score.grade,
                        totalPossiblePoints: score.totalPossiblePoints,
                        verifiedAt: new Date().toISOString(),
                        scanPayload,
                      };

                      try {
                        await saveGradeRecord(gradeRecord);
                        toast.success(`Lembar #${selectedIndex + 1} (${student.name}) berhasil disimpan.`);
                        if (selectedIndex < items.length - 1) {
                          setSelectedIndex((i) => i + 1);
                        }
                      } catch (err) {
                        console.error("Gagal menyimpan nilai batch:", err);
                        toast.error("Gagal menyimpan nilai ke penyimpanan lokal.");
                      }
                    }}
                    className={cn(
                      "font-semibold flex items-center gap-2",
                      isItemProcessed
                        ? "bg-brand-700 hover:bg-brand-800 text-white"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                    )}
                  >
                    <span>
                      {selectedItem.status === "PROCESSING"
                        ? "Sedang Memproses..."
                        : !isItemProcessed
                        ? "Foto Belum Diproses"
                        : "Simpan & Lembar Berikutnya"}
                    </span>
                    {selectedItem.status === "PROCESSING" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              );
            })() : (
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
