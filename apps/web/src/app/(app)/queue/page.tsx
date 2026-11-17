"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  getQueueItems,
  updateQueueItem,
  deleteQueueItem,
  clearQueue,
  addToQueue,
  getActiveExam,
  saveGradeRecord,
  getAllStudents,
} from "@/lib/db";
import { useSync } from "@/lib/sync-context";
import {
  ExamConfig,
  GradedStudentRecord,
  OfflineQueueItem,
  OMRScanResponse,
  Student,
} from "@/types/omr";
import { buildTemplateFromExam } from "@/lib/template-builder";
import {
  calculateFinalGrade,
  formatFinalScore,
  McQuestionResult,
  EssayMarkResult,
} from "@/lib/scoring";
import { VerifySheet } from "@/components/scan/verify-sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CloudUpload,
  Eye,
  FileImage,
  Inbox,
  Loader2,
  PenLine,
  Plus,
  RotateCw,
  Sparkles,
  Trash2,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemAnalysis {
  kind: "OFFLINE_PHOTO" | "REVIEW_READY";
  problemCount: number;
  hasEssay: boolean;
  needsEssayReview: boolean;
  statusLabel: string;
  statusType: "READY" | "ESSAY_REVIEW" | "AMBIGUOUS" | "OFFLINE";
}

function analyzeItem(item: OfflineQueueItem, exam: ExamConfig | null): ItemAnalysis {
  if (!item.scanResult) {
    return {
      kind: "OFFLINE_PHOTO",
      problemCount: 0,
      hasEssay: false,
      needsEssayReview: false,
      statusLabel:
        item.status === "FAILED"
          ? "Gagal Sinkronisasi"
          : "Foto Offline (Menunggu Engine)",
      statusType: "OFFLINE",
    };
  }

  const mcAnswers = item.scanResult.mcAnswers || [];
  const problemAnswers = mcAnswers.filter((a) => a.status !== "VALID");
  const problemCount = problemAnswers.length;

  const essayQuestions = exam?.essayQuestions || [];
  const hasEssay = essayQuestions.length > 0;
  const scoredEssayCount = item.essayMarks
    ? item.essayMarks.filter((e) => e.outcome !== "INCORRECT" || e.pointsAwarded > 0).length
    : 0;
  const needsEssayReview = hasEssay && scoredEssayCount === 0;

  if (problemCount > 0) {
    return {
      kind: "REVIEW_READY",
      problemCount,
      hasEssay,
      needsEssayReview,
      statusLabel: `${problemCount} Jawaban Ragu/Kosong`,
      statusType: "AMBIGUOUS",
    };
  }

  if (needsEssayReview) {
    return {
      kind: "REVIEW_READY",
      problemCount: 0,
      hasEssay: true,
      needsEssayReview: true,
      statusLabel: "Perlu Review Esai",
      statusType: "ESSAY_REVIEW",
    };
  }

  return {
    kind: "REVIEW_READY",
    problemCount: 0,
    hasEssay,
    needsEssayReview: false,
    statusLabel: "Siap Disetujui",
    statusType: "READY",
  };
}

export default function QueuePage() {
  const router = useRouter();
  const { isOnline, refreshQueueCount } = useSync();
  const [items, setItems] = React.useState<OfflineQueueItem[]>([]);
  const [students, setStudents] = React.useState<Student[]>([]);
  const [activeExam, setActiveExam] = React.useState<ExamConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSyncingAll, setIsSyncingAll] = React.useState(false);
  const [isApprovingAll, setIsApprovingAll] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<{ current: number; total: number } | null>(
    null
  );
  const [activeExamTitle, setActiveExamTitle] = React.useState<string>("Ujian Aktif");
  const [reviewingItem, setReviewingItem] = React.useState<OfflineQueueItem | null>(null);

  const loadItems = React.useCallback(async () => {
    try {
      const [q, exam, stList] = await Promise.all([
        getQueueItems(),
        getActiveExam(),
        getAllStudents(),
      ]);
      setItems(q);
      if (exam) {
        setActiveExam(exam);
        const title = exam.title || "UTS Matematika";
        const cls = exam.className ? `Kelas ${exam.className}` : "";
        setActiveExamTitle(`${title} ${cls}`.trim());
      }
      setStudents(stList);
      refreshQueueCount();
    } catch (err) {
      console.error("Gagal mengambil data antrean:", err);
    } finally {
      setLoading(false);
    }
  }, [refreshQueueCount]);

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Klasifikasi ringkasan
  const analyzedItems = React.useMemo(() => {
    return items.map((item) => ({
      item,
      analysis: analyzeItem(item, activeExam),
    }));
  }, [items, activeExam]);

  const readyItems = analyzedItems.filter((a) => a.analysis.statusType === "READY");
  const essayReviewItems = analyzedItems.filter((a) => a.analysis.statusType === "ESSAY_REVIEW");
  const ambiguousItems = analyzedItems.filter((a) => a.analysis.statusType === "AMBIGUOUS");
  const offlinePhotoItems = analyzedItems.filter((a) => a.analysis.statusType === "OFFLINE");

  // Sync single item mentah ke OMR Engine via Next.js API route
  const syncItem = async (item: OfflineQueueItem): Promise<{ ok: boolean; error?: string }> => {
    try {
      await updateQueueItem({ ...item, status: "UPLOADING", attempts: item.attempts + 1 });
      await loadItems();

      const active = activeExam || (await getActiveExam());
      const template = buildTemplateFromExam(active);

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          imageDataUrl: item.imageDataUrl,
          sourceDevice: "MOBILE_CAMERA",
        }),
      });

      if (!res.ok) {
        let errorDetail = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          errorDetail = errJson.error || errJson.detail || errorDetail;
        } catch {
          // ignore
        }

        if (res.status === 400 || res.status === 422) {
          throw new Error(`Citra tidak valid / 4 sudut fiducial tidak ditemukan (${errorDetail})`);
        } else if (res.status === 503) {
          throw new Error("Engine OMR tidak dapat dijangkau (503). Pastikan Engine OMR aktif.");
        } else {
          throw new Error(`Engine OMR gagal memproses: ${errorDetail}`);
        }
      }

      const realData = await res.json();
      const scanPayload: OMRScanResponse = {
        ...realData,
        fullWarpedImageUrl: realData.fullWarpedImageUrl || item.imageDataUrl,
      };

      // Simpan hasil OMR kembali ke item antrean sehingga guru bisa mereview
      await updateQueueItem({
        ...item,
        status: "PENDING_REVIEW",
        scanResult: scanPayload,
        thumbnailDataUrl:
          scanPayload.studentNameCropUrl || scanPayload.fullWarpedImageUrl || item.thumbnailDataUrl,
      });

      await loadItems();
      return { ok: true };
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : "Koneksi engine gagal";
      console.warn(`Sinkronisasi gagal untuk item ${item.id}:`, errMsg);
      await updateQueueItem({
        ...item,
        status: "FAILED",
        attempts: item.attempts + 1,
        lastError: errMsg,
      });
      await loadItems();
      return { ok: false, error: errMsg };
    }
  };

  // Sync semua foto offline mentah
  const handleSyncAllOffline = async () => {
    if (offlinePhotoItems.length === 0 || isSyncingAll) return;
    setIsSyncingAll(true);
    setSyncProgress({ current: 0, total: offlinePhotoItems.length });

    let successCount = 0;
    let lastError = "";

    for (let i = 0; i < offlinePhotoItems.length; i++) {
      const { item } = offlinePhotoItems[i];
      setSyncProgress({ current: i + 1, total: offlinePhotoItems.length });
      const res = await syncItem(item);
      if (res.ok) {
        successCount++;
      } else if (res.error) {
        lastError = res.error;
      }
    }

    await loadItems();
    setIsSyncingAll(false);
    setSyncProgress(null);

    if (successCount > 0) {
      toast.success(`${successCount} foto offline berhasil diproses via OMR Engine.`);
    } else {
      toast.error(
        lastError || "Semua antrean gagal disinkronkan. Periksa format citra atau status Engine OMR."
      );
    }
  };

  // Persetujuan Cepat untuk 1 Lembar yang Bersih
  const handleQuickApprove = async (item: OfflineQueueItem) => {
    if (!item.scanResult) return;
    try {
      const active = activeExam;
      const mcConfig = active?.multipleChoiceQuestions || [];
      const essayConfig = active?.essayQuestions || [];

      const mcQuestions: McQuestionResult[] = mcConfig.map((q) => {
        const ans = item.scanResult?.mcAnswers?.find((a) => a.questionNumber === q.number);
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
        const mark = item.essayMarks?.find((m) => m.questionNumber === eq.number);
        return {
          number: eq.number,
          maxScore: eq.maxScore ?? 10,
          outcome: mark?.outcome || "INCORRECT",
          partialScore: mark?.pointsAwarded ?? 0,
        };
      });

      const scoringRes = calculateFinalGrade({
        mode: active?.scoringMode ?? "MODE_A_PERCENTAGE",
        rounding: active?.rounding ?? "ROUND_HALF_UP",
        mcQuestions,
        essayQuestions,
        weights: active?.sectionWeights,
      });

      const matchedStudent =
        students.find((s) => s.id === item.selectedStudentId) || students[0];
      const studentId = matchedStudent?.id || item.selectedStudentId || `std-${Date.now()}`;
      const studentName = matchedStudent?.name || item.selectedStudentName || "Siswa Tanpa Nama";

      const recordId = `rec-${item.id.replace(/^queue-/, "")}`;
      const examId = item.examId || active?.id || "active_exam_config";

      const gradeRecord: GradedStudentRecord = {
        recordId,
        examId,
        studentId,
        studentName,
        rawMCScore: scoringRes.mcPoints,
        maxMCScore: scoringRes.mcMaxPoints,
        rawEssayScore: scoringRes.essayPoints,
        maxEssayScore: scoringRes.essayMaxPoints,
        finalGrade: scoringRes.finalGrade,
        totalPossiblePoints: scoringRes.totalPossiblePoints,
        verifiedAt: new Date().toISOString(),
        scanPayload: item.scanResult,
      };

      await saveGradeRecord(gradeRecord);
      await deleteQueueItem(item.id);
      await loadItems();
      toast.success(
        `Nilai ${studentName} (${formatFinalScore(scoringRes)}) berhasil disetujui & masuk Rekap!`
      );
    } catch (err: any) {
      console.error("Gagal menyetujui lembar:", err);
      toast.error("Gagal menyetujui lembar.");
    }
  };

  // Batch Approval: Setujui Semua yang Beres (1-klik)
  const handleApproveAllReady = async () => {
    if (readyItems.length === 0 || isApprovingAll) return;
    setIsApprovingAll(true);

    let count = 0;
    for (const { item } of readyItems) {
      try {
        await handleQuickApprove(item);
        count++;
      } catch (err) {
        console.warn("Gagal menyetujui item:", item.id, err);
      }
    }

    await loadItems();
    setIsApprovingAll(false);
    toast.success(`${count} lembar yang bersih berhasil disetujui sekaligus!`);
  };

  // Hapus single item
  const handleDeleteItem = async (id: string) => {
    if (confirm("Hapus lembar scan ini dari antrean? Data lembar yang belum direkap akan hilang.")) {
      await deleteQueueItem(id);
      toast.info("Item dihapus dari antrean review.");
      await loadItems();
    }
  };

  // Kosongkan antrean
  const handleClearAll = async () => {
    if (confirm("Kosongkan semua lembar di Antrean Review?")) {
      await clearQueue();
      toast.info("Antrean telah dikosongkan");
      await loadItems();
    }
  };

  // Simulasi Tambah Lembar untuk Demo / Uji Guru
  const handleAddDemoItem = async (type: "ready" | "issue") => {
    const isIssue = type === "issue";
    const dummyDataUrl = "/sheet-preview.png";
    const activePgCount = activeExam?.multipleChoiceQuestions?.length ?? 30;

    const demoAnswers = Array.from({ length: activePgCount }, (_, i) => ({
      questionNumber: i + 1,
      selectedOption:
        isIssue && (i === 4 || i === 12)
          ? null
          : ((["A", "B", "C", "D"] as const)[i % 4]),
      status:
        isIssue && i === 4
          ? ("EMPTY" as const)
          : isIssue && i === 12
          ? ("LOW_CONFIDENCE" as const)
          : ("VALID" as const),
      confidence: isIssue && i === 12 ? 0.52 : 0.98,
    }));

    const matchedStd = students[items.length % (students.length || 1)];

    await addToQueue({
      id: `review-${Date.now().toString().slice(-4)}`,
      examId: activeExam?.id || "active_exam_config",
      createdAt: new Date().toISOString(),
      thumbnailDataUrl: dummyDataUrl,
      imageDataUrl: dummyDataUrl,
      status: "PENDING_REVIEW",
      selectedStudentId: matchedStd?.id,
      selectedStudentName: matchedStd?.name,
      scanResult: {
        scanId: `sim-${Date.now()}`,
        sourceDevice: "MOBILE_CAMERA",
        timestamp: new Date().toISOString(),
        studentNameCropUrl: "",
        fullWarpedImageUrl: dummyDataUrl,
        essayAreaCropUrl: "/sheet-preview.png",
        mcAnswers: demoAnswers,
      },
    });

    toast.success(
      isIssue
        ? "Simulasi LJK dengan catatan review ditambahkan ke antrean."
        : "Simulasi LJK bersih (Siap Disetujui) ditambahkan ke antrean."
    );
    await loadItems();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Kotak Masuk Koreksi
            </h1>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5",
                isOnline
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              )}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5" /> Online
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" /> Mode Offline
                </>
              )}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {items.length === 0
              ? "Semua lembar scan telah ditinjau dan tersimpan di Rekap Nilai."
              : `${items.length} lembar LJK di kotak masuk menunggu verifikasi esai atau persetujuan nilai.`}
          </p>
        </div>

        {/* Action Tambah Simulasi & Kosongkan */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleAddDemoItem("issue")}
            className="flex items-center gap-1.5 text-xs"
            title="Tambah lembar simulasi yang perlu review"
          >
            <Plus className="w-3.5 h-3.5" /> + Review Esai/Ragu
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleAddDemoItem("ready")}
            className="flex items-center gap-1.5 text-xs text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
            title="Tambah lembar simulasi bersih siap setujui"
          >
            <Check className="w-3.5 h-3.5" /> + Siap Disetujui
          </Button>

          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Kosongkan
            </Button>
          )}
        </div>
      </div>

      {/* Ringkasan Status Tab / Pills */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              Total di Antrean
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-800">{items.length}</span>
              <span className="text-xs text-slate-500">Lembar</span>
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-700 block uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Siap Disetujui
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-800">{readyItems.length}</span>
              <span className="text-xs text-emerald-700 font-medium">100% Beres</span>
            </div>
          </div>

          <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-indigo-700 block uppercase flex items-center gap-1">
              <PenLine className="w-3 h-3" /> Perlu Review Esai
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-800">
                {essayReviewItems.length}
              </span>
              <span className="text-xs text-indigo-700 font-medium">Guru Menilai</span>
            </div>
          </div>

          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-amber-700 block uppercase flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Ada Jawaban Ragu
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-800">{ambiguousItems.length}</span>
              <span className="text-xs text-amber-700 font-medium">Koreksi Cepat</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Banner: Setujui Semua yang Beres (1-Klik Approval) */}
      {items.length > 0 && (
        <div className="bg-gradient-to-r from-brand-700 to-brand-800 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <h2 className="text-base font-bold">Persetujuan Nilai Sekaligus</h2>
            </div>
            <p className="text-xs text-brand-100 max-w-xl leading-relaxed">
              Ada <strong>{readyItems.length} lembar LJK</strong> yang sudah 100% bersih tanpa
              jawaban ragu dan tidak ada esai yang tertunda. Guru dapat menyetujui semuanya dalam satu
              klik untuk langsung masuk Rekap Nilai.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {offlinePhotoItems.length > 0 && (
              <Button
                variant="secondary"
                size="md"
                disabled={!isOnline || isSyncingAll}
                onClick={handleSyncAllOffline}
                className="bg-white/15 border-white/25 text-white hover:bg-white/25 text-xs font-bold"
              >
                {isSyncingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Memproses OMR ({syncProgress?.current}/{syncProgress?.total})
                  </>
                ) : (
                  <>
                    <RotateCw className="w-4 h-4 mr-1.5" />
                    Proses {offlinePhotoItems.length} Foto Offline
                  </>
                )}
              </Button>
            )}

            <Button
              size="md"
              disabled={readyItems.length === 0 || isApprovingAll}
              onClick={handleApproveAllReady}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold shadow-md text-xs sm:text-sm px-4"
            >
              {isApprovingAll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyetujui...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-slate-900" />
                  Setujui Semua yang Beres ({readyItems.length})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Daftar Item Kotak Masuk Koreksi */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-700" />
          <p className="text-sm font-medium">Memuat data kotak masuk koreksi...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-9 h-9 stroke-[1.8]" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Kotak Masuk Bersih!</h3>
          <p className="text-sm text-slate-500 max-w-md mt-1 leading-relaxed">
            Tidak ada lembar hasil scan yang tertunda. Semua LJK yang dipindai telah selesai ditinjau
            dan nilainya tersimpan rapi di Rekap Nilai.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push("/scan")}
              className="gap-2 font-bold"
            >
              <span>Scan Lembar Baru</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => handleAddDemoItem("issue")}
              className="gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Simulasi LJK
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {analyzedItems.map(({ item, analysis }) => {
            const timeStr = new Date(item.createdAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const studentName =
              item.selectedStudentName ||
              students.find((s) => s.id === item.selectedStudentId)?.name ||
              "Siswa Belum Dipilih";

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                {/* Kolom Kiri: Thumbnail & Metadata */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-14 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative shadow-2xs">
                    {item.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailDataUrl}
                        alt="Preview lembar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileImage className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-800 truncate">
                        {studentName}
                      </span>

                      {/* Status Badges */}
                      {analysis.statusType === "READY" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Siap Disetujui
                        </span>
                      )}

                      {analysis.statusType === "ESSAY_REVIEW" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                          <PenLine className="w-3 h-3 text-indigo-600" /> Perlu Review Esai
                        </span>
                      )}

                      {analysis.statusType === "AMBIGUOUS" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> {analysis.statusLabel}
                        </span>
                      )}

                      {analysis.statusType === "OFFLINE" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <CloudUpload className="w-3 h-3 text-blue-600" /> {analysis.statusLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timeStr}</span>
                      <span>·</span>
                      <span className="truncate">{activeExamTitle}</span>
                      <span>·</span>
                      <span className="font-mono text-[10px] text-slate-400">{item.id}</span>
                    </div>

                    {item.lastError && (
                      <p className="text-[11px] text-rose-500 font-medium">
                        Error: {item.lastError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Tombol Periksa Lembar (Membuka VerifySheet) */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (!item.scanResult) {
                        toast.info("Memproses citra lembar via OMR...");
                        syncItem(item);
                      } else {
                        setReviewingItem(item);
                      }
                    }}
                    className="h-9 px-3 gap-1.5 text-xs font-bold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Periksa Lembar</span>
                  </Button>

                  {/* Tombol Cepat Setujui jika status READY */}
                  {analysis.statusType === "READY" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleQuickApprove(item)}
                      className="h-9 px-3 gap-1.5 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      title="Setujui lembar ini langsung ke rekap nilai"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Setujui</span>
                    </Button>
                  )}

                  {/* Tombol Sync Ulang jika offline/failed */}
                  {analysis.statusType === "OFFLINE" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!isOnline || item.status === "UPLOADING"}
                      onClick={() => syncItem(item)}
                      className="h-9 px-2.5 text-xs text-slate-600 hover:text-brand-700"
                      title="Coba proses ulang lembar ini"
                    >
                      <RotateCw
                        className={cn(
                          "w-3.5 h-3.5 mr-1",
                          item.status === "UPLOADING" && "animate-spin"
                        )}
                      />
                      Retry
                    </Button>
                  )}

                  {/* Tombol Hapus */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteItem(item.id)}
                    className="h-9 w-9 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Hapus dari antrean"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Verifikasi Lembar Penuh (ReviewSheet) */}
      {reviewingItem && reviewingItem.scanResult && (
        <VerifySheet
          scanResult={reviewingItem.scanResult}
          students={students}
          initialStudentId={reviewingItem.selectedStudentId}
          initialEssayMarks={reviewingItem.essayMarks}
          onClose={() => setReviewingItem(null)}
          onSave={async (record) => {
            try {
              await saveGradeRecord(record);
              await deleteQueueItem(reviewingItem.id);
              await loadItems();
              setReviewingItem(null);
              toast.success(
                `Pemeriksaan selesai: Nilai ${record.studentName} (${record.finalGrade}) berhasil direkap!`
              );
            } catch (err) {
              console.error("Gagal menyimpan rekap:", err);
              toast.error("Gagal menyimpan nilai.");
            }
          }}
          onSaveToQueue={async (updated) => {
            try {
              await updateQueueItem({
                ...reviewingItem,
                scanResult: updated.scanResult,
                selectedStudentId: updated.selectedStudentId,
                selectedStudentName: updated.selectedStudentName,
                essayMarks: updated.essayMarks,
                status: "PENDING_REVIEW",
              });
              await loadItems();
              setReviewingItem(null);
              toast.success("Perubahan disimpan kembali ke Antrean Review.");
            } catch (err) {
              console.error("Gagal mengupdate antrean:", err);
              toast.error("Gagal memperbarui antrean.");
            }
          }}
        />
      )}
    </div>
  );
}