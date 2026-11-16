"use client";

import * as React from "react";
import { ExamConfig, ExamTemplate } from "@/types/omr";
import { LjkBlueprintSvg } from "@/components/template/ljk-blueprint-svg";
import { Button } from "@/components/ui/button";
import { getActiveExam } from "@/lib/db";
import { buildTemplateFromExam, getStandardA4Template, STANDARD_TOTAL_PG } from "@/lib/template-builder";
import { toast } from "sonner";
import {
  Download,
  FileCode,
  FileDown,
  Grid,
  Maximize2,
  Minimize2,
  Printer,
  RotateCcw,
  Square,
  ZoomIn,
  ZoomOut,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TemplateBlueprintPage() {
  const [template, setTemplate] = React.useState<ExamTemplate>(() => getStandardA4Template());
  const [examConfig, setExamConfig] = React.useState<ExamConfig | null>(null);
  const [showGrid, setShowGrid] = React.useState(false);
  const [showMargins, setShowMargins] = React.useState(true);
  const [zoom, setZoom] = React.useState(1.0);
  const [activeTab, setActiveTab] = React.useState<"svg" | "raster">("svg");

  // Muat data template standar & konfigurasi ujian aktif dari IndexedDB
  React.useEffect(() => {
    async function loadTemplate() {
      try {
        const active = await getActiveExam();
        if (active) {
          setExamConfig(active);
          setTemplate(getStandardA4Template(active.id));
        } else {
          setTemplate(getStandardA4Template());
        }
      } catch (err) {
        console.warn("Gagal memuat template ujian aktif:", err);
      }
    }
    loadTemplate();
  }, []);

  const handleDownloadPdf = () => {
    const link = document.createElement("a");
    link.href = "/sheet.pdf";
    link.download = "LJK_STANDAR_A4_30PG.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Mengunduh berkas PDF cetak LJK standar A4 (30 PG + Esai)");
  };

  const handleDownloadJson = () => {
    // Ekspor template pemindaian aktif yang dikirim ke engine OMR
    const activeScanTemplate = buildTemplateFromExam(examConfig);
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeScanTemplate, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `template-${activeScanTemplate.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`Metadata template-${activeScanTemplate.id}.json berhasil diunduh`);
  };

  const handlePrint = () => {
    window.print();
  };

  const activePgCount = examConfig?.multipleChoiceQuestions?.length ?? 30;
  const activeEssayCount = examConfig?.essayQuestions?.length ?? 5;
  const totalSlotsCount = template.multipleChoiceSlots.length; // selalu 30 di lembar cetak standar
  const rowsPerCol = Math.ceil(totalSlotsCount / (template.columnCount || 3));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5 print-hide">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Blueprint LJK A4
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
              {activePgCount} PG + {activeEssayCount} Esai
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Lembar cetak fisik berformat standar 30 nomor PG. Engine OMR otomatis hanya membaca nomor 1 sampai {activePgCount} sesuai ujian aktif ({examConfig?.title || "Ujian Aktif"} - {examConfig?.className || "Kelas 8A"}).
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadJson}
            className="text-xs text-slate-600 hover:text-slate-800"
          >
            <FileCode className="w-4 h-4 mr-1.5" /> Unduh Metadata JSON
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadPdf}
            className="bg-brand-700 hover:bg-brand-800 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
          >
            <FileDown className="w-4 h-4" /> Unduh PDF Siap Cetak
          </Button>
        </div>
      </div>

      {/* Main Grid: Blueprint Canvas (2 cols) & Properties Inspector (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left / Center: Interactive SVG & Controls (2 cols) */}
        <div className="lg:col-span-2 bg-slate-50 border border-slate-200/90 rounded-2xl overflow-hidden shadow-inner flex flex-col">
          {/* Canvas Toolbar Controls */}
          <div className="bg-white border-b border-slate-200/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2 print-hide">
            {/* View Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
              <button
                type="button"
                onClick={() => setActiveTab("svg")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                  activeTab === "svg"
                    ? "bg-white text-brand-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Vektor SVG (Dinamis)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raster")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                  activeTab === "raster"
                    ? "bg-white text-brand-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Raster Asli (Engine)
              </button>
            </div>

            {/* Toggle Overlay Helpers */}
            {activeTab === "svg" && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGrid(!showGrid)}
                  className={cn(
                    "h-8 px-2.5 text-xs cursor-pointer",
                    showGrid ? "bg-brand-50 text-brand-700 font-bold" : "text-slate-600"
                  )}
                >
                  <Grid className="w-3.5 h-3.5 mr-1" /> Grid 10mm
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMargins(!showMargins)}
                  className={cn(
                    "h-8 px-2.5 text-xs cursor-pointer",
                    showMargins ? "bg-brand-50 text-brand-700 font-bold" : "text-slate-600"
                  )}
                >
                  <Square className="w-3.5 h-3.5 mr-1" /> Margin 8mm
                </Button>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                {/* Zoom Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
                    className="h-8 w-8 p-0 text-slate-600 cursor-pointer"
                    title="Perkecil"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs font-mono font-medium text-slate-500 w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                    className="h-8 w-8 p-0 text-slate-600 cursor-pointer"
                    title="Perbesar"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setZoom(1.0)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Rendering Canvas */}
          <div className="w-full flex justify-center overflow-auto pb-8">
            {activeTab === "svg" ? (
              <LjkBlueprintSvg
                template={template}
                showGrid={showGrid}
                showMargins={showMargins}
                zoom={zoom}
                activePgCount={activePgCount}
              />
            ) : (
              <div
                className="relative bg-white shadow-2xl rounded-xs border border-slate-300 overflow-hidden"
                style={{ width: "595px", height: "842px", aspectRatio: "210 / 297" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sheet-preview.png"
                  alt="Render Hasil Engine Python"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Property Inspector Panel (1 col) */}
        <div className="space-y-5 print-hide">
          {/* Card 1: Spesifikasi Fisik Kertas */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-brand-700" /> Spesifikasi Lembar
            </h3>

            <div className="space-y-2.5 text-xs divide-y divide-slate-100">
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Format Kertas</span>
                <span className="font-bold text-slate-800">ISO A4 (210 × 297 mm)</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Rasio Bidik</span>
                <span className="font-mono font-medium text-slate-800">1 : 1.414</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Margin Fiducial</span>
                <span className="font-mono font-medium text-slate-800">8.0 mm</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Marker Kiri-Atas</span>
                <span className="font-mono font-medium text-slate-800">14.0 × 14.0 mm</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">3 Marker Lainnya</span>
                <span className="font-mono font-medium text-slate-800">10.0 × 10.0 mm</span>
              </div>
            </div>
          </div>

          {/* Card 2: Tata Letak Soal Dinamis */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Tata Letak Soal</h3>

            <div className="space-y-2.5 text-xs divide-y divide-slate-100">
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Jumlah Kolom PG</span>
                <span className="font-bold text-slate-800">
                  {template.columnCount} Kolom ({rowsPerCol} baris/kolom)
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Diameter Bubble</span>
                <span className="font-mono font-medium text-slate-800">⌀ 4.5 mm</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Jarak Antar Bubble</span>
                <span className="font-mono font-medium text-slate-800">8.5 mm (pitch)</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Jeda Tiap 5 Nomor</span>
                <span className="font-mono font-medium text-slate-800">+3.5 mm</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Format Lembar Fisik</span>
                <span className="font-bold text-slate-800">Standar 30 PG (Cetak Tetap)</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Nomor Aktif Dinilai</span>
                <span className="font-bold text-brand-700">
                  {activePgCount} Butir (No. 01-{activePgCount})
                </span>
              </div>
              {activePgCount < 30 && (
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-500">Nomor {activePgCount + 1}-30</span>
                  <span className="font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">
                    Diabaikan Engine
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Zona Esai & Identitas */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Area Tambahan</h3>

            <div className="space-y-2.5 text-xs divide-y divide-slate-100">
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Kotak Nama & Mapel</span>
                <span className="font-mono font-medium text-slate-800">90.0 × 20.0 mm</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Kotak Kelas & Tanggal</span>
                <span className="font-mono font-medium text-slate-800">80.0 × 20.0 mm</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Kotak Petunjuk</span>
                <span className="font-mono font-medium text-slate-800">176.0 × 22.0 mm</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Dimensi Zona Esai</span>
                <span className="font-mono font-medium text-slate-800">
                  {template.essayAreaRectMm
                    ? `${template.essayAreaRectMm.w} × ${template.essayAreaRectMm.h} mm (${activeEssayCount} Soal)`
                    : "Tidak ada (0 Esai)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
