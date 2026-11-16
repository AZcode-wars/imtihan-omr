"use client";

import * as React from "react";
import {
  DetectedMCAnswer,
  EssayMark,
  ExamConfig,
  OMRScanResponse,
  OptionLabel,
  Student,
} from "@/types/omr";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { ExceptionChip } from "@/components/ui/exception-chip";
import { EssayMarkRow } from "@/components/scan/essay-mark-row";
import { getActiveExam } from "@/lib/db";
import {
  calculateFinalGrade,
  formatFinalScore,
  McQuestionResult,
  EssayMarkResult,
} from "@/lib/scoring";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface VerifySheetProps {
  scanResult: OMRScanResponse;
  students: Student[];
  onClose: () => void;
  onSave: (record: any) => void;
}

const BUBBLE_OPTIONS: (OptionLabel | "EMPTY")[] = ["A", "B", "C", "D", "EMPTY"];

export function VerifySheet({
  scanResult,
  students,
  onClose,
  onSave,
}: VerifySheetProps) {
  // State Siswa Terpilih
  const [selectedStudentId, setSelectedStudentId] = React.useState<string>(
    students[0]?.id || ""
  );
  const [examConfig, setExamConfig] = React.useState<ExamConfig | null>(null);

  React.useEffect(() => {
    async function loadConfig() {
      const active = await getActiveExam();
      if (active) setExamConfig(active);
    }
    loadConfig();
  }, []);

  // Filter nomor jawaban sesuai soal aktif
  const activePgCount = examConfig?.multipleChoiceQuestions?.length ?? scanResult.mcAnswers.length;
  const filteredInitialMc = scanResult.mcAnswers.slice(0, activePgCount);

  // State Jawaban PG (Bisa dikoreksi)
  const [mcAnswers, setMcAnswers] = React.useState<DetectedMCAnswer[]>(
    filteredInitialMc
  );

  React.useEffect(() => {
    setMcAnswers(scanResult.mcAnswers.slice(0, activePgCount));
  }, [scanResult, activePgCount]);

  // Nomor soal yang sedang dibuka inline koreksinya
  const [activeCorrectionQuestion, setActiveCorrectionQuestion] =
    React.useState<number | null>(null);

  // State Nilai Esai Guru (sesuai jumlah esai pada ujian aktif)
  // Default: Belum dinilai (0 poin / INCORRECT) agar nilai tidak terinflasi sebelum diperiksa guru
  const essayCount = examConfig?.essayQuestions?.length ?? 0;
  const [essayMarks, setEssayMarks] = React.useState<EssayMark[]>(() => {
    return Array.from({ length: essayCount }, (_, i) => ({
      questionNumber: i + 1,
      maxScore: examConfig?.essayQuestions[i]?.maxScore || 5,
      outcome: "INCORRECT",
      pointsAwarded: 0,
    }));
  });

  React.useEffect(() => {
    if (examConfig?.essayQuestions) {
      setEssayMarks(
        examConfig.essayQuestions.map((eq) => ({
          questionNumber: eq.number,
          maxScore: eq.maxScore,
          outcome: "INCORRECT",
          pointsAwarded: 0,
        }))
      );
    }
  }, [examConfig]);

  // Nomor-nomor bermasalah (Exception First)
  const problemAnswers = mcAnswers.filter((a) => a.status !== "VALID");

  const handleCorrectBubble = (
    questionNumber: number,
    option: OptionLabel | "EMPTY"
  ) => {
    setMcAnswers((prev) =>
      prev.map((ans) => {
        if (ans.questionNumber === questionNumber) {
          if (option === "EMPTY") {
            return {
              ...ans,
              selectedOption: null,
              status: "EMPTY",
              confidence: 1.0,
            };
          }
          return {
            ...ans,
            selectedOption: option,
            status: "VALID",
            confidence: 1.0,
          };
        }
        return ans;
      })
    );
    setActiveCorrectionQuestion(null);
    toast.success(`Soal #${questionNumber} dikoreksi menjadi ${option}.`);
  };

  const handleUpdateEssay = (
    qNum: number,
    points: number,
    outcome: "CORRECT" | "INCORRECT" | "PARTIAL"
  ) => {
    setEssayMarks((prev) =>
      prev.map((e) =>
        e.questionNumber === qNum
          ? { ...e, pointsAwarded: points, outcome }
          : e
      )
    );
  };

  // Kalkulasi Skor Live (sesuai konfigurasi ujian aktif)
  const mcQuestionsInput: McQuestionResult[] = mcAnswers.map((a) => {
    const configQ = examConfig?.multipleChoiceQuestions?.find((q) => q.number === a.questionNumber);
    return {
      number: a.questionNumber,
      correctAnswer: configQ?.correctAnswer || "A",
      selectedOption: a.selectedOption,
      pointsCorrect: configQ?.pointsCorrect ?? 1,
      pointsWrong: configQ?.pointsWrong ?? 0,
      status: configQ?.status || "ACTIVE",
    };
  });

  const essayQuestionsInput: EssayMarkResult[] = essayMarks.map((e) => ({
    number: e.questionNumber,
    maxScore: e.maxScore,
    outcome: e.outcome,
    partialScore: e.pointsAwarded,
  }));

  const weights = examConfig?.sectionWeights || {
    multipleChoicePercent: essayCount > 0 ? 60 : 100,
    essayPercent: essayCount > 0 ? 40 : 0,
  };

  const scoreSummary = calculateFinalGrade({
    mode: examConfig?.scoringMode || "MODE_A_PERCENTAGE",
    weights,
    mcQuestions: mcQuestionsInput,
    essayQuestions: essayQuestionsInput,
    rounding: examConfig?.rounding || "ROUND_HALF_UP",
  });

  const formattedScore = formatFinalScore(scoreSummary);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const handleSaveRecord = () => {
    if (!selectedStudent) {
      toast.error("Harap pilih nama siswa terlebih dahulu.");
      return;
    }

    const record = {
      recordId: `rec-${Date.now()}`,
      examId: "exam-1",
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      rawMCScore: scoreSummary.mcPoints,
      maxMCScore: scoreSummary.mcMaxPoints,
      rawEssayScore: scoreSummary.essayPoints,
      maxEssayScore: scoreSummary.essayMaxPoints,
      finalGrade: scoreSummary.finalGrade,
      totalPossiblePoints: scoreSummary.totalPossiblePoints,
      verifiedAt: new Date().toISOString(),
      scanPayload: {
        ...scanResult,
        mcAnswers,
      },
    };

    onSave(record);
    toast.success(`Nilai ${selectedStudent.name} (${formattedScore}) berhasil disimpan!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col shadow-sheet overflow-hidden max-w-2xl w-full mx-auto animate-in slide-in-from-bottom duration-300">
        {/* Handle Sheet */}
        <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto mt-3 shrink-0" />

        {/* Header Sheet */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse" />
            <h2 className="text-base font-bold text-slate-800">
              Verifikasi Hasil Scan LJK
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Zona 1: Potongan Nama Siswa */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Potongan Tulisan Nama (Auto-Crop)
              </span>
              <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full">
                Sisa {students.length} Siswa
              </span>
            </div>

            <div className="bg-[#FCFCF9] border border-dashed border-slate-300 rounded-xl p-3 shadow-inner flex items-center justify-between">
              <div>
                <p className="text-[9px] font-mono text-slate-400 uppercase">
                  Nama Terpotong di LJK:
                </p>
                {scanResult.studentNameCropUrl ? (
                  <img
                    src={scanResult.studentNameCropUrl}
                    alt="Potongan Nama"
                    className="h-10 object-contain rounded mt-1 border border-slate-200"
                  />
                ) : (
                  <p className="text-xs text-slate-400 italic py-1 mt-0.5">
                    (Potongan tulisan nama tidak terdeteksi otomatis)
                  </p>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 px-2 py-1 rounded bg-slate-100">
                {examConfig?.className || "Kelas Aktif"}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Cocokkan Siswa di Daftar Kelas:
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border-2 border-brand-700/40 bg-white font-bold text-slate-800 text-sm focus:outline-none focus:border-brand-700"
              >
                {students.map((std) => (
                  <option key={std.id} value={std.id}>
                    {std.name} (NIS: {std.nis})
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Zona 2: Ringkasan Skor Live */}
          <section className="bg-gradient-to-br from-brand-800 to-brand-700 rounded-2xl p-4 text-white shadow-raised flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-[11px] text-brand-100/80 font-medium">
                Ringkasan Skor Terbaca
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-white/15 text-xs font-bold">
                  PG: {scoreSummary.mcPoints}/{scoreSummary.mcMaxPoints}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-white/15 text-xs font-bold">
                  Esai: {scoreSummary.essayPoints}/{scoreSummary.essayMaxPoints}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold tracking-wider uppercase text-brand-200 block">
                Nilai Akhir
              </span>
              <span className="text-3xl font-extrabold tracking-tight tabular-nums">
                {formattedScore}
              </span>
            </div>
          </section>

          {/* Zona 3: Exception-First (Nomor Bermasalah) */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-800">
                {problemAnswers.length > 0
                  ? `Perlu Dicek (${problemAnswers.length} Nomor) · Ketuk untuk Koreksi 1-Klik`
                  : "Semua Jawaban PG Terbaca Bersih (100% Valid)"}
              </h3>
            </div>

            {problemAnswers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {problemAnswers.map((ans) => (
                  <ExceptionChip
                    key={ans.questionNumber}
                    questionNumber={ans.questionNumber}
                    status={ans.status}
                    info={`${Math.round(ans.confidence * 100)}%`}
                    isOpen={activeCorrectionQuestion === ans.questionNumber}
                    onClick={() =>
                      setActiveCorrectionQuestion((prev) =>
                        prev === ans.questionNumber ? null : ans.questionNumber
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* Inline Editor Koreksi Cepat */}
            {activeCorrectionQuestion !== null && (
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900">
                    Koreksi Jawaban Soal #{activeCorrectionQuestion}
                  </span>
                  <span className="text-amber-700 text-[11px]">
                    Pilih arsiran siswa yang benar:
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {BUBBLE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        handleCorrectBubble(activeCorrectionQuestion, opt)
                      }
                      className={cn(
                        "h-11 rounded-xl font-bold border transition-all active:scale-95 cursor-pointer text-sm",
                        opt === "EMPTY"
                          ? "bg-white text-rose-700 border-rose-200 hover:bg-rose-50 text-xs"
                          : "bg-white text-slate-800 border-slate-200 hover:border-brand-700 hover:bg-brand-50"
                      )}
                    >
                      {opt === "EMPTY" ? "Kosong" : opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Zona 4: Penilaian Esai Guru */}
          <section className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800">
              Penilaian Jawaban Esai Guru
            </h3>

            {/* Potongan Area Esai Tunggal */}
            {scanResult.essayAreaCropUrl && (
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400">
                  Potongan Area Esai Lembar Jawaban:
                </span>
                <img
                  src={scanResult.essayAreaCropUrl}
                  alt="Area Esai"
                  className="w-full max-h-48 object-contain rounded-xl border border-slate-200 bg-white"
                />
              </div>
            )}

            {/* Baris Penilaian per Soal Esai */}
            <div className="grid grid-cols-1 gap-2">
              {essayMarks.map((essay) => (
                <EssayMarkRow
                  key={essay.questionNumber}
                  questionNumber={essay.questionNumber}
                  maxScore={essay.maxScore}
                  pointsAwarded={essay.pointsAwarded}
                  outcome={essay.outcome}
                  onChange={(pts, out) =>
                    handleUpdateEssay(essay.questionNumber, pts, out)
                  }
                />
              ))}
            </div>
          </section>
        </div>

        {/* Footer Sheet Sticky */}
        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
          <Button
            variant="primary"
            size="lg"
            onClick={handleSaveRecord}
            className="w-full gap-2 text-base font-bold"
          >
            <span>Simpan Nilai & Scan Berikutnya</span>
            <ArrowRight className="w-5 h-5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
