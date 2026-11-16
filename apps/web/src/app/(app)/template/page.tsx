"use client";

import * as React from "react";
import { ExamTemplate } from "@/types/omr";
import { LjkBlueprintSvg } from "@/components/template/ljk-blueprint-svg";
import { Button } from "@/components/ui/button";
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

// Template referensi standar A4 25 PG + 5 Esai (atau 30 PG)
const DEFAULT_A4_TEMPLATE: ExamTemplate = {
  id: "tpl-default-a4",
  examId: "exam-imtihan-uts",
  pageWidthMm: 210,
  pageHeightMm: 297,
  columnCount: 3,
  bubbleDiameterMm: 4.5,
  bubblePitchMm: 8.5,
  fiducials: [
    { corner: "TOP_LEFT", sizeMm: 14, xMm: 8, yMm: 8 },
    { corner: "TOP_RIGHT", sizeMm: 10, xMm: 192, yMm: 8 },
    { corner: "BOTTOM_LEFT", sizeMm: 10, xMm: 8, yMm: 279 },
    { corner: "BOTTOM_RIGHT", sizeMm: 10, xMm: 192, yMm: 279 },
  ],
  nameCropRectMm: { x: 14, y: 30, w: 90, h: 20 },
  multipleChoiceSlots: Array.from({ length: 30 }, (_, i) => {
    const qNum = i + 1;
    // 3 kolom: kolom 1 (1-10), kolom 2 (11-20), kolom 3 (21-30)
    const colIndex = Math.floor(i / 10);
    const rowIndex = i % 10;
    const colX = 14 + colIndex * 64.5;
    // gap kelompok 5 nomor (+3.5 mm)
    const groupGap = rowIndex >= 5 ? 3.5 : 0;
    const rowY = 96 + rowIndex * 8.5 + groupGap;

    return {
      questionNumber: qNum,
      xMm: colX,
      yMm: rowY,
      options: [
        { label: "A" as const, xMm: colX + 10, yMm: rowY },
        { label: "B" as const, xMm: colX + 18.5, yMm: rowY },
        { label: "C" as const, xMm: colX + 27, yMm: rowY },
        { label: "D" as const, xMm: colX + 35.5, yMm: rowY },
      ],
    };
  }),
  essayAreaRectMm: { x: 14, y: 195, w: 176, h: 81 },
};

export default function TemplateBlueprintPage() {
  const [template, setTemplate] = React.useState<ExamTemplate>(DEFAULT_A4_TEMPLATE);
  const [showGrid, setShowGrid] = React.useState(false);
  const [showMargins, setShowMargins] = React.useState(true);
  const [zoom, setZoom] = React.useState(1.0);
  const [activeTab, setActiveTab] = React.useState<"svg" | "raster">("svg");

  // Muat data template dari file JSON jika ada
  React.useEffect(() => {
    fetch("/template.json")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && data.multipleChoiceSlots) {
          setTemplate(data);
        }
      })
      .catch(() => {
        // Fallback ke default template
      });
  }, []);

  const handleDownloadPdf = () => {
    const link = document.createElement("a");
    link.href = "/sheet.pdf";
    link.download = "LJK_ImtihanOMR_A4.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Mengunduh LJK_ImtihanOMR_A4.pdf");
  };

  const handleDownloadJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `template-${template.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Metadata template.json diunduh");
  };

  const handlePrint = () => {
    window.print();
  };

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
              Presisi 1 : 1.414 (A4)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Pratinjau akurat tata letak LJK asli, verifikasi koordinat fiducial & bubble, dan cetak PDF.
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

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left / Center: Interactive Sheet Canvas (3 cols) */}
        <div className="lg:col-span-3 bg-slate-100 rounded-2xl border border-slate-200 p-4 md:p-8 flex flex-col items-center min-h-[850px] relative overflow-hidden print-sheet-container">
          {/* Canvas Floating Toolbar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-6 bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 shadow-xs print-hide">
            {/* View Mode Switcher Ringkas */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab("svg")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                  activeTab === "svg"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Vektor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raster")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                  activeTab === "raster"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                PNG
              </button>
            </div>

            {/* Toggle Controls */}
            {activeTab === "svg" && (
              <div className="flex flex-wrap items-center gap-2">
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

          {/* Card 2: Tata Letak Bubble OMR */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Tata Letak Soal</h3>

            <div className="space-y-2.5 text-xs divide-y divide-slate-100">
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Jumlah Kolom PG</span>
                <span className="font-bold text-slate-800">3 Kolom (10/kolom)</span>
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
                <span className="text-slate-500">Total Soal PG Aktif</span>
                <span className="font-bold text-brand-700">
                  {template.multipleChoiceSlots.length} Butir
                </span>
              </div>
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
                    ? `${template.essayAreaRectMm.w} × ${template.essayAreaRectMm.h} mm`
                    : "Tidak ada"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
