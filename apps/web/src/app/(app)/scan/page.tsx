"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerBracket } from "@/components/scan/corner-bracket";
import { ShutterButton } from "@/components/scan/shutter-button";
import { VerifySheet } from "@/components/scan/verify-sheet";
import { DesktopBatchScan } from "@/components/scan/desktop-batch-scan";
import { Button } from "@/components/ui/button";
import { addToQueue, getActiveExam, getAllStudents, saveGradeRecord } from "@/lib/db";
import { useSync } from "@/lib/sync-context";
import { resizeImageFile } from "@/lib/image-utils";
import { ExamConfig, GradedStudentRecord, OMRScanResponse, Student } from "@/types/omr";
import { buildTemplateFromExam } from "@/lib/template-builder";
import { detectFiducialsFromImageData, type CornerFlags } from "@/lib/fiducial-detector";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileCheck2,
  Flashlight,
  Info,
  Loader2,
  RefreshCw,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ScanPage() {
  const router = useRouter();
  const { isOnline, refreshQueueCount } = useSync();
  // State escape hatch jika pengguna ingin beralih manual (misal tablet)
  const [deviceOverride, setDeviceOverride] = React.useState<"auto" | "camera" | "batch">("auto");
  // Defaultkan true saat inisialisasi awal di browser desktop agar kamera tidak langsung diminta
  const [isDesktopScreen, setIsDesktopScreen] = React.useState(true);

  const [scanState, setScanState] = React.useState<
    "IDLE" | "LOCKED" | "PROCESSING" | "VERIFY"
  >("IDLE");
  const [torchOn, setTorchOn] = React.useState(false);
  const [scanResult, setScanResult] = React.useState<OMRScanResponse | null>(null);
  const [savedCount, setSavedCount] = React.useState(0);
  const [examConfig, setExamConfig] = React.useState<ExamConfig | null>(null);

  // Status Akses & Kesiapan Kamera (TGG-05)
  const [cameraStatus, setCameraStatus] = React.useState<
    "IDLE" | "REQUESTING" | "ACTIVE" | "DENIED" | "UNAVAILABLE"
  >("IDLE");

  // Load students dari IndexedDB
  const [students, setStudents] = React.useState<Student[]>([]);

  React.useEffect(() => {
    async function loadInitialData() {
      try {
        const [active, storedStudents] = await Promise.all([
          getActiveExam(),
          getAllStudents(),
        ]);
        if (active) setExamConfig(active);
        setStudents(storedStudents);
      } catch (err) {
        console.warn("Gagal memuat data awal scan:", err);
      }
    }
    loadInitialData();
  }, []);

  const totalStudents = students.length;
  const activePgCount = examConfig?.multipleChoiceQuestions?.length ?? 30;

  // Batch mobile upload queue
  const [pendingMobileFiles, setPendingMobileFiles] = React.useState<string[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = React.useState<number>(0);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Fitur Auto-Shutter & Deteksi 4 Sudut LJK
  const [autoShutter, setAutoShutter] = React.useState(true);
  const [detectedCorners, setDetectedCorners] = React.useState<CornerFlags>({
    tl: false,
    tr: false,
    bl: false,
    br: false,
  });
  const [isShutterFlashing, setIsShutterFlashing] = React.useState(false);
  const consecutiveHitsRef = React.useRef(0);
  const autoCaptureBusyRef = React.useRef(false);
  const cameraReadyTimeRef = React.useRef<number>(0);
  const offscreenCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Deteksi otomatis lebar layar peramban (breakpoint lg: 1024px)
  React.useEffect(() => {
    const checkScreen = () => {
      setIsDesktopScreen(window.innerWidth >= 1024);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const activeMode =
    deviceOverride === "auto" ? (isDesktopScreen ? "batch" : "camera") : deviceOverride;

  // Inisialisasi & Pengendalian Akses Kamera (TGG-05)
  const startCamera = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("UNAVAILABLE");
      return;
    }

    setCameraStatus("REQUESTING");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          cameraReadyTimeRef.current = Date.now();
          setCameraStatus("ACTIVE");
          setScanState("LOCKED");
        };
      }
    } catch (err: any) {
      console.warn("Kamera tidak dapat diakses langsung:", err);
      setCameraStatus("DENIED");
      setScanState("IDLE");
    }
  }, []);

  React.useEffect(() => {
    if (activeMode !== "camera") return;

    startCamera();

    const videoEl = videoRef.current;
    return () => {
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [activeMode, startCamera]);

  // Auto-Shutter loop: mengevaluasi frame setiap 200ms saat kamera aktif
  React.useEffect(() => {
    if (cameraStatus !== "ACTIVE" || scanState !== "LOCKED") {
      setDetectedCorners({ tl: false, tr: false, bl: false, br: false });
      consecutiveHitsRef.current = 0;
      return;
    }

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
      offscreenCanvasRef.current.width = 320;
      offscreenCanvasRef.current.height = 450;
    }

    const canvas = offscreenCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let isDisposed = false;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (
        isDisposed ||
        !video ||
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        autoCaptureBusyRef.current ||
        Date.now() - cameraReadyTimeRef.current < 900 // Jeda 900ms pemanasan sensor & autofocus kamera
      ) {
        return;
      }

      try {
        ctx.drawImage(video, 0, 0, 320, 450);
        const imgData = ctx.getImageData(0, 0, 320, 450);
        const res = detectFiducialsFromImageData(imgData);

        setDetectedCorners(res.corners);

        // Jika autoShutter aktif dan ke-4 sudut fiducial terdeteksi tajam
        if (autoShutter && res.detected) {
          consecutiveHitsRef.current += 1;

          // Trigger capture seketika saat ke-4 sudut terdeteksi
          if (consecutiveHitsRef.current >= 1) {
            autoCaptureBusyRef.current = true;
            setIsShutterFlashing(true);
            setTimeout(() => setIsShutterFlashing(false), 220);

            if (navigator.vibrate) {
              navigator.vibrate([40, 30, 40]);
            }

            const frame = captureFrameFromVideo();
            if (frame) {
              toast.info("4 Sudut LJK terkunci! Memindai otomatis...", { duration: 1500 });
              handleCapture(frame);
            }

            setTimeout(() => {
              autoCaptureBusyRef.current = false;
              consecutiveHitsRef.current = 0;
            }, 2000);
          }
        } else {
          consecutiveHitsRef.current = 0;
        }
      } catch (err) {
        // Abaikan error sesaat saat render canvas
      }
    }, 200);

    return () => {
      isDisposed = true;
      clearInterval(interval);
    };
  }, [cameraStatus, scanState, autoShutter]);

  // Tangkap frame citra nyata dari video kamera (KRT-02)
  const captureFrameFromVideo = (): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  // Handler Trigger Capture LJK Riil (KRT-02)
  const handleCapture = async (imageDataUrl: string) => {
    if (!imageDataUrl) {
      toast.error("Tidak ada citra LJK untuk dipindai.");
      return;
    }

    setScanState("PROCESSING");
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    try {
      // Jika sedang offline, masukkan langsung ke antrean IndexedDB
      if (!isOnline) {
        await addToQueue({
          examId: examConfig?.id || "exam-uts-mat-8a",
          thumbnailDataUrl: imageDataUrl,
          imageDataUrl,
        });
        await refreshQueueCount();
        toast.info("Offline: Foto scan disimpan di Antrean IndexedDB.");
      }

      // Bangun metadata template dinamis dari ujian aktif
      const templatePayload = buildTemplateFromExam(examConfig);

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: templatePayload,
          imageDataUrl,
          sourceDevice: "MOBILE_CAMERA",
        }),
      });

      if (!res.ok) {
        let errorMsg = "Gagal memproses via Engine OMR.";
        try {
          const errData = await res.json();
          if (errData.error || errData.detail) {
            errorMsg = errData.error || errData.detail;
          }
        } catch {
          if (res.status === 503) {
            errorMsg = "Engine OMR tidak tersedia (503). Pastikan layanan backend aktif.";
          }
        }
        throw new Error(errorMsg);
      }

      const realData = await res.json();
      const result: OMRScanResponse = {
        ...realData,
        fullWarpedImageUrl: realData.fullWarpedImageUrl || imageDataUrl,
        mcAnswers: (realData.mcAnswers || []).slice(0, activePgCount),
      };

      setScanResult(result);
      setScanState("VERIFY");
    } catch (err: any) {
      const errorMsg: string = err?.message || "";
      console.warn("Scan LJK belum berhasil:", errorMsg);

      if (errorMsg.includes("buram") || errorMsg.includes("laplacian")) {
        toast.warning("Foto terlalu buram / goyang. Dekatkan kamera dan pastikan kertas LJK fokus serta cukup cahaya.");
      } else if (errorMsg.includes("fiducial") || errorMsg.includes("sudut")) {
        toast.warning("4 sudut kotak LJK belum pas. Pastikan seluruh batas lembar masuk dalam bingkai.");
      } else {
        toast.error(errorMsg || "Gagal mendeteksi LJK. Pastikan 4 sudut masuk bingkai.");
      }

      setScanState(cameraStatus === "ACTIVE" ? "LOCKED" : "IDLE");
    }
  };

  // Handler tombol shutter (manual atau fallback)
  const handleShutterClick = () => {
    if (cameraStatus !== "ACTIVE") {
      toast.error("Kamera belum siap. Izinkan akses kamera atau pilih foto dari penyimpanan.");
      return;
    }
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 220);
    const frame = captureFrameFromVideo();
    if (!frame) {
      toast.error("Frame video kamera belum siap. Arahkan kamera ke lembar LJK.");
      return;
    }
    handleCapture(frame);
  };

  // Handler Multi-Upload Mobile dengan Resize & Antrean
  const handleMobileBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    toast.info(`Memproses ${files.length} foto LJK...`);

    const processedDataUrls: string[] = [];

    // Baca dan resize satu demi satu untuk mencegah crash RAM
    for (let i = 0; i < files.length; i++) {
      try {
        const { dataUrl } = await resizeImageFile(files[i], {
          maxWidth: 1800,
          maxHeight: 2400,
          quality: 0.82,
        });
        processedDataUrls.push(dataUrl);

        // Jika offline, simpan otomatis ke IndexedDB
        if (!isOnline) {
          await addToQueue({
            examId: examConfig?.id || "exam-uts-mat-8a",
            thumbnailDataUrl: dataUrl,
            imageDataUrl: dataUrl,
          });
        }
      } catch (err) {
        console.warn("Gagal me-resize foto:", err);
      }
    }

    if (processedDataUrls.length > 0) {
      setPendingMobileFiles(processedDataUrls);
      setCurrentFileIndex(0);
      handleCapture(processedDataUrls[0]);
      await refreshQueueCount();
      toast.success(`${processedDataUrls.length} lembar siap diverifikasi`);
    }
  };

  // Simpan hasil verifikasi & lanjut lembar berikutnya jika batch
  const handleSaveVerify = async (record: any) => {
    // Persist ke IndexedDB
    try {
      const gradeRecord: GradedStudentRecord = {
        recordId: record.recordId || `rec-${Date.now()}`,
        examId: record.examId || examConfig?.id || "exam-1",
        studentId: record.studentId,
        studentName: record.studentName,
        rawMCScore: record.rawMCScore,
        maxMCScore: record.maxMCScore,
        rawEssayScore: record.rawEssayScore,
        maxEssayScore: record.maxEssayScore,
        finalGrade: record.finalGrade,
        totalPossiblePoints: record.totalPossiblePoints,
        verifiedAt: record.verifiedAt || new Date().toISOString(),
        scanPayload: record.scanPayload,
      };
      await saveGradeRecord(gradeRecord);
      setSavedCount((c) => Math.min(totalStudents, c + 1));
    } catch (err) {
      console.error("Gagal menyimpan nilai:", err);
      toast.error("Gagal menyimpan nilai ke penyimpanan lokal.");
      return;
    }

    // Jika masih ada sisa lembar dalam upload batch mobile
    if (pendingMobileFiles.length > 0 && currentFileIndex < pendingMobileFiles.length - 1) {
      const nextIdx = currentFileIndex + 1;
      setCurrentFileIndex(nextIdx);
      handleCapture(pendingMobileFiles[nextIdx]);
      toast.success(`Menampilkan lembar ${nextIdx + 1} dari ${pendingMobileFiles.length}`);
    } else {
      setPendingMobileFiles([]);
      setScanResult(null);
      setScanState(cameraStatus === "ACTIVE" ? "LOCKED" : "IDLE");
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. JIKA MODE DESKTOP BATCH */}
      {activeMode === "batch" ? (
        <div className="space-y-3">
          <DesktopBatchScan
            students={students}
            onSwitchToCamera={() => setDeviceOverride("camera")}
          />
        </div>
      ) : (
        /* 2. JIKA MODE MOBILE KAMERA (FULLSCREEN VIEWPORT TANPA SCROLL) */
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between overflow-hidden select-none">
          {/* Efek Flash Shutter */}
          {isShutterFlashing && (
            <div className="absolute inset-0 bg-white/70 z-50 pointer-events-none transition-opacity duration-200" />
          )}

          {/* Efek Senter Torch */}
          {torchOn && (
            <div className="absolute inset-0 bg-amber-100/15 mix-blend-screen pointer-events-none z-10 animate-in fade-in duration-200" />
          )}

          {/* Video Stream Kamera Fullscreen */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none",
              cameraStatus === "ACTIVE" ? "opacity-80" : "opacity-0"
            )}
          />

          {/* Overlay Atas: Tombol Keluar, Status Siswa, Toggle Auto-Shutter, Upload, Senter */}
          <div className="relative z-20 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-[max(12px,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deviceOverride === "camera" && isDesktopScreen) {
                    setDeviceOverride("batch");
                  } else {
                    router.push("/");
                  }
                }}
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                title="Keluar dari layar kamera"
                aria-label="Kembali"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white">
                <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-xs font-semibold">
                  Terscan:{" "}
                  <strong className="text-brand-300 font-bold tabular-nums">
                    {savedCount}/{totalStudents}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Auto-Shutter */}
              <button
                type="button"
                onClick={() => {
                  setAutoShutter((prev) => {
                    const next = !prev;
                    toast.info(next ? "Auto-shutter diaktifkan (memotret otomatis saat 4 sudut terkunci)" : "Auto-shutter dinonaktifkan (mode manual)");
                    return next;
                  });
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold backdrop-blur-md border transition-all cursor-pointer",
                  autoShutter
                    ? "bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400/30"
                    : "bg-black/60 text-white/70 border-white/15 hover:bg-black/80"
                )}
                title={autoShutter ? "Auto-Shutter Aktif" : "Auto-Shutter Nonaktif"}
              >
                <Zap className={cn("w-3.5 h-3.5", autoShutter ? "fill-current text-white" : "text-white/60")} />
                <span>{autoShutter ? "Auto-Shutter" : "Manual"}</span>
              </button>

              {/* Tombol Upload Batch File LJK */}
              <label
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/90 flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                title="Unggah Foto LJK dari Galeri"
              >
                <Upload className="w-4 h-4 text-brand-300" />
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleMobileBatchUpload}
                  className="hidden"
                />
              </label>

              {/* Tombol Senter */}
              <button
                type="button"
                onClick={() => setTorchOn((t) => !t)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer backdrop-blur-md border",
                  torchOn
                    ? "bg-amber-400 text-slate-950 border-amber-300 shadow-lg"
                    : "bg-black/60 text-white/80 border-white/15 hover:bg-black/80"
                )}
                title="Senter Kamera"
                aria-label="Senter Kamera"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Area Bingkai Bidik Viewfinder A4 */}
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-4">
            <CornerBracket
              state={scanState === "VERIFY" ? "IDLE" : scanState}
              corners={detectedCorners}
            />

            {/* Status Pill Live di Bawah Bingkai */}
            <div className="mt-4 flex flex-col items-center gap-2">
              {scanState === "PROCESSING" ? (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-950/90 border border-brand-400/40 text-brand-300 text-xs font-semibold backdrop-blur-md animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                  <span>
                    {pendingMobileFiles.length > 0
                      ? `Memproses Lembar ${currentFileIndex + 1} dari ${pendingMobileFiles.length}...`
                      : "Memproses Pembacaan LJK..."}
                  </span>
                </div>
              ) : cameraStatus === "DENIED" || cameraStatus === "UNAVAILABLE" ? (
                <div className="flex flex-col items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-rose-500/40 text-slate-200 text-xs backdrop-blur-md shadow-lg text-center max-w-xs">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Kamera Tidak Dapat Diakses</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {cameraStatus === "DENIED"
                      ? "Izin akses kamera ditolak di browser. Silakan beri izin atau gunakan tombol 'Pilih Foto LJK'."
                      : "Perangkat kamera tidak ditemukan di peramban ini."}
                  </p>
                  {cameraStatus === "DENIED" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={startCamera}
                      className="mt-1 text-xs h-7 gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Coba Lagi</span>
                    </Button>
                  )}
                </div>
              ) : cameraStatus === "REQUESTING" ? (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 text-xs font-medium backdrop-blur-md">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                  <span>Meminta izin akses kamera...</span>
                </div>
              ) : scanState === "LOCKED" && cameraStatus === "ACTIVE" ? (
                detectedCorners.tl && detectedCorners.tr && detectedCorners.bl && detectedCorners.br ? (
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-400/80 text-emerald-300 text-xs font-bold backdrop-blur-md shadow-[0_0_15px_rgba(52,211,153,0.4)] animate-pulse">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>4/4 Sudut Terkunci! {autoShutter ? "Memindai Otomatis..." : "Ketuk Tombol Rana"}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 border border-white/20 text-white text-xs font-medium backdrop-blur-md shadow-md">
                    <span className="flex items-center gap-1">
                      <span className={cn("w-2 h-2 rounded-full transition-colors", detectedCorners.tl ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-white/30")} title="Kiri Atas" />
                      <span className={cn("w-2 h-2 rounded-full transition-colors", detectedCorners.tr ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-white/30")} title="Kanan Atas" />
                      <span className={cn("w-2 h-2 rounded-full transition-colors", detectedCorners.bl ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-white/30")} title="Kiri Bawah" />
                      <span className={cn("w-2 h-2 rounded-full transition-colors", detectedCorners.br ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-white/30")} title="Kanan Bawah" />
                    </span>
                    <span>
                      {Object.values(detectedCorners).filter(Boolean).length > 0
                        ? `${Object.values(detectedCorners).filter(Boolean).length}/4 Sudut Terdeteksi`
                        : "Arahkan kamera ke 4 kotak sudut LJK"}
                    </span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 border border-white/10 text-white/70 text-xs font-medium backdrop-blur-md">
                  <Info className="w-4 h-4 text-slate-300" />
                  <span>Arahkan kamera ke 4 kotak sudut lembar LJK</span>
                </div>
              )}
            </div>

            {/* Escape Hatch kecil untuk beralih ke Desktop Batch jika di tablet */}
            <button
              type="button"
              onClick={() => setDeviceOverride("batch")}
              className="mt-3 text-[11px] text-white/50 hover:text-white/90 underline transition-colors cursor-pointer"
            >
              Beralih ke mode batch review tabel
            </button>
          </div>

          {/* Action Bar Bawah Mengambang (Tidak Pernah Tenggelam, Tanpa Scroll) */}
          <div className="relative z-20 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pb-[max(18px,env(safe-area-inset-bottom))] flex flex-col items-center gap-2">
            <ShutterButton
              isLocked={scanState === "LOCKED" && cameraStatus === "ACTIVE"}
              disabled={scanState === "PROCESSING" || cameraStatus !== "ACTIVE"}
              onClick={handleShutterClick}
            />

            <p className="text-[11px] text-slate-400 text-center max-w-xs leading-relaxed">
              {autoShutter
                ? "Auto-Shutter aktif: Begitu 4 sudut kotak sejajar, kamera langsung memotret otomatis."
                : "Ketuk tombol lingkaran di atas untuk memotret secara manual."}
            </p>
          </div>

          {/* Sheet Verifikasi 4 Zona */}
          {scanState === "VERIFY" && scanResult && (
            <VerifySheet
              scanResult={scanResult}
              students={students}
              onClose={() => {
                setPendingMobileFiles([]);
                setScanState(cameraStatus === "ACTIVE" ? "LOCKED" : "IDLE");
              }}
              onSave={handleSaveVerify}
            />
          )}
        </div>
      )}
    </div>
  );
}
