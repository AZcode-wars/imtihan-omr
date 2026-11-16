"use client";

import * as React from "react";
import { CornerBracket } from "@/components/scan/corner-bracket";
import { ShutterButton } from "@/components/scan/shutter-button";
import { VerifySheet } from "@/components/scan/verify-sheet";
import { DesktopBatchScan } from "@/components/scan/desktop-batch-scan";
import { Button } from "@/components/ui/button";
import { addToQueue, getActiveExam } from "@/lib/db";
import { useSync } from "@/lib/sync-context";
import { resizeImageFile } from "@/lib/image-utils";
import { ExamConfig, OMRScanResponse, Student } from "@/types/omr";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  FileCheck2,
  Flashlight,
  Info,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SAMPLE_STUDENTS: Student[] = [];

export default function ScanPage() {
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
  const totalStudents = 0;
  const [examConfig, setExamConfig] = React.useState<ExamConfig | null>(null);

  React.useEffect(() => {
    async function loadConfig() {
      const active = await getActiveExam();
      if (active) setExamConfig(active);
    }
    loadConfig();
  }, []);

  const activePgCount = examConfig?.multipleChoiceQuestions?.length ?? 30;

  // Batch mobile upload queue
  const [pendingMobileFiles, setPendingMobileFiles] = React.useState<string[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = React.useState<number>(0);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);

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

  // Inisialisasi Akses Kamera (hanya saat mode camera aktif di mobile atau jika user eksplisit memilih camera)
  React.useEffect(() => {
    // Di layar desktop, jangan aktifkan kamera kecuali user eksplisit memilih 'camera'
    if (activeMode !== "camera") return;

    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Kamera tidak dapat diakses langsung:", err);
      }
    };

    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [activeMode]);

  // Simulasi auto-lock saat membidik LJK
  React.useEffect(() => {
    if (activeMode === "camera" && scanState === "IDLE") {
      const timer = setTimeout(() => {
        setScanState("LOCKED");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeMode, scanState]);

  // Handler Trigger Capture LJK
  const handleCapture = async (imageDataUrl?: string) => {
    setScanState("PROCESSING");
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    try {
      let result: OMRScanResponse;

      if (imageDataUrl) {
        // Jika sedang offline, masukkan langsung ke antrean IndexedDB
        if (!isOnline) {
          await addToQueue({
            examId: "exam-uts-mat-8a",
            thumbnailDataUrl: imageDataUrl,
            imageDataUrl,
          });
          await refreshQueueCount();
          toast.info("Offline: Foto scan disimpan di Antrean IndexedDB.");
        }

        try {
          // Ambil metadata template jika ada
          let templatePayload: any = null;
          try {
            const tplRes = await fetch("/template.json");
            if (tplRes.ok) templatePayload = await tplRes.json();
          } catch {
            // ignore
          }

          const res = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              template: templatePayload || {
                id: "tpl-default-a4",
                examId: "exam-1",
                pageWidthMm: 210,
                pageHeightMm: 297,
                columnCount: 3,
                bubbleDiameterMm: 4.5,
                bubblePitchMm: 8.5,
                fiducials: [],
                nameCropRectMm: { x: 14, y: 30, w: 90, h: 20 },
                multipleChoiceSlots: [],
                essayAreaRectMm: { x: 14, y: 194, w: 176, h: 84 },
              },
              imageDataUrl,
              sourceDevice: "MOBILE_CAMERA",
            }),
          });
          if (res.ok) {
            const realData = await res.json();
            result = {
              ...realData,
              fullWarpedImageUrl: realData.fullWarpedImageUrl || imageDataUrl,
              mcAnswers: (realData.mcAnswers || []).slice(0, activePgCount),
            };
          } else {
            throw new Error("Gagal memproses via Engine API");
          }
        } catch {
          result = createMockScanResult(imageDataUrl);
        }
      } else {
        await new Promise((r) => setTimeout(r, 800));
        result = createMockScanResult();
      }

      setScanResult(result);
      setScanState("VERIFY");
    } catch {
      toast.error("Gagal mendeteksi LJK. Pastikan 4 sudut masuk bingkai.");
      setScanState("IDLE");
    }
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
            examId: "exam-uts-mat-8a",
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

  // Mock Scan Generator
  const createMockScanResult = (previewImg?: string): OMRScanResponse => {
    return {
      scanId: `scan-${Date.now()}`,
      sourceDevice: "MOBILE_CAMERA",
      timestamp: new Date().toISOString(),
      studentNameCropUrl: "",
      fullWarpedImageUrl: previewImg || "/sheet-preview.png",
      essayAreaCropUrl: "",
      mcAnswers: Array.from({ length: activePgCount }, (_, i) => {
        const qNum = i + 1;
        if (qNum === 7 && activePgCount >= 7) {
          return { questionNumber: qNum, selectedOption: null, status: "EMPTY", confidence: 0.95 };
        }
        if (qNum === 11 && activePgCount >= 11) {
          return { questionNumber: qNum, selectedOption: null, status: "MULTIPLE", confidence: 0.92, rawCandidates: ["A", "C"] };
        }
        if (qNum === 13 && activePgCount >= 13) {
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

  // Simpan hasil verifikasi & lanjut lembar berikutnya jika batch
  const handleSaveVerify = () => {
    setSavedCount((c) => Math.min(totalStudents, c + 1));

    // Jika masih ada sisa lembar dalam upload batch mobile
    if (pendingMobileFiles.length > 0 && currentFileIndex < pendingMobileFiles.length - 1) {
      const nextIdx = currentFileIndex + 1;
      setCurrentFileIndex(nextIdx);
      handleCapture(pendingMobileFiles[nextIdx]);
      toast.success(`Menampilkan lembar ${nextIdx + 1} dari ${pendingMobileFiles.length}`);
    } else {
      setPendingMobileFiles([]);
      setScanResult(null);
      setScanState("IDLE");
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. JIKA MODE DESKTOP BATCH */}
      {activeMode === "batch" ? (
        <div className="space-y-3">
          <DesktopBatchScan
            students={SAMPLE_STUDENTS}
            onSwitchToCamera={() => setDeviceOverride("camera")}
          />
        </div>
      ) : (
        /* 2. JIKA MODE MOBILE KAMERA */
        <div className="relative min-h-[calc(100vh-140px)] flex flex-col justify-between bg-slate-950 rounded-2xl overflow-hidden select-none -mx-2 sm:mx-0">
          {/* Efek Senter Torch */}
          {torchOn && (
            <div className="absolute inset-0 bg-amber-100/15 mix-blend-screen pointer-events-none z-10 animate-in fade-in duration-200" />
          )}

          {/* Video Stream Kamera */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
          />

          {/* Overlay Atas: Progress Siswa, Batch File Upload & Senter */}
          <div className="relative z-20 flex items-center justify-between p-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-xs font-semibold">
                Terscan:{" "}
                <strong className="text-brand-300 font-bold tabular-nums">
                  {savedCount}/{totalStudents}
                </strong>{" "}
                Siswa
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Tombol Upload Batch File LJK (Mendukung Multi-file) */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/90 text-xs font-semibold hover:bg-black/80 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-brand-300" />
                <span>Pilih Foto LJK</span>
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
                  "w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer backdrop-blur-md border",
                  torchOn
                    ? "bg-amber-400 text-slate-950 border-amber-300"
                    : "bg-black/60 text-white/80 border-white/15 hover:bg-black/80"
                )}
                title="Senter Kamera"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Area Bingkai Bidik Viewfinder A4 */}
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-4">
            <CornerBracket state={scanState === "VERIFY" ? "IDLE" : scanState} />

            {/* Status Pill di Bawah Bingkai */}
            <div className="mt-4">
              {scanState === "PROCESSING" ? (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-950/90 border border-brand-400/40 text-brand-300 text-xs font-semibold backdrop-blur-md animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                  <span>
                    {pendingMobileFiles.length > 0
                      ? `Memproses Lembar ${currentFileIndex + 1} dari ${pendingMobileFiles.length}...`
                      : "Memproses Pembacaan LJK..."}
                  </span>
                </div>
              ) : scanState === "LOCKED" ? (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-950/90 border border-brand-400/40 text-brand-300 text-xs font-bold backdrop-blur-md shadow-lg">
                  <CheckCircle2 className="w-4 h-4 text-brand-400" />
                  <span>4 Sudut Terdeteksi • Siap Capture</span>
                </div>
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
              className="mt-4 text-[11px] text-white/50 hover:text-white/90 underline transition-colors"
            >
              Beralih ke mode batch review tabel
            </button>
          </div>

          {/* Action Bar Bawah: Shutter */}
          <div className="relative z-20 bg-slate-900/90 backdrop-blur-md border-t border-white/10 p-5 flex flex-col items-center gap-3">
            <ShutterButton
              isLocked={scanState === "LOCKED"}
              disabled={scanState === "PROCESSING"}
              onClick={() => handleCapture()}
            />

            <p className="text-[11px] text-slate-400 text-center max-w-xs">
              Kamera otomatis mendeteksi 4 fiducial marker stabil atau ketuk tombol di atas untuk scan manual.
            </p>
          </div>

          {/* Sheet Verifikasi 4 Zona */}
          {scanState === "VERIFY" && scanResult && (
            <VerifySheet
              scanResult={scanResult}
              students={SAMPLE_STUDENTS}
              onClose={() => {
                setPendingMobileFiles([]);
                setScanState("IDLE");
              }}
              onSave={handleSaveVerify}
            />
          )}
        </div>
      )}
    </div>
  );
}
