"use client";

import * as React from "react";
import { ExamTemplate } from "@/types/omr";
import { cn } from "@/lib/utils";

export interface LjkBlueprintSvgProps {
  template: ExamTemplate;
  showGrid?: boolean;
  showMargins?: boolean;
  zoom?: number;
  className?: string;
  activePgCount?: number;
}

/**
 * Render LJK A4 berbasis SVG terukur presisi mm.
 * Rasio A4: 210 x 297 mm.
 * Menggunakan metadata koordinat asli dari ExamTemplate.
 */
export function LjkBlueprintSvg({
  template,
  showGrid = false,
  showMargins = true,
  zoom = 1,
  className,
  activePgCount,
}: LjkBlueprintSvgProps) {
  const {
    pageWidthMm = 210,
    pageHeightMm = 297,
    fiducials = [],
    nameCropRectMm,
    multipleChoiceSlots = [],
    essayAreaRectMm,
  } = template;

  return (
    <div
      className={cn("relative flex items-center justify-center p-4 overflow-auto", className)}
      style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s ease-out" }}
    >
      <svg
        viewBox={`0 0 ${pageWidthMm} ${pageHeightMm}`}
        className="w-[595px] h-[842px] max-w-full bg-white shadow-2xl rounded-xs select-none border border-slate-300"
        xmlns="http://www.w3.org/2000/svg"
        style={{ aspectRatio: "210 / 297" }}
      >
        <defs>
          {/* Pola Grid 10mm */}
          <pattern id="grid-10mm" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e2e8f0" strokeWidth="0.25" />
          </pattern>
          {/* Pola Grid 2mm */}
          <pattern id="grid-2mm" width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M 2 0 L 0 0 0 2" fill="none" stroke="#f1f5f9" strokeWidth="0.1" />
          </pattern>
        </defs>

        {/* 1. Grid Background (Opsional) */}
        {showGrid && (
          <>
            <rect width={pageWidthMm} height={pageHeightMm} fill="url(#grid-2mm)" />
            <rect width={pageWidthMm} height={pageHeightMm} fill="url(#grid-10mm)" />
          </>
        )}

        {/* 2. Margin Cetak 8mm (Opsional) */}
        {showMargins && (
          <rect
            x="8"
            y="8"
            width={pageWidthMm - 16}
            height={pageHeightMm - 16}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="0.3"
            strokeDasharray="2,2"
          />
        )}

        {/* 3. 4 Fiducial Markers */}
        {fiducials.map((f, i) => (
          <rect
            key={`fiducial-${i}`}
            x={f.xMm}
            y={f.yMm}
            width={f.sizeMm}
            height={f.sizeMm}
            fill="#000000"
          />
        ))}

        {/* 4. Header & Judul LJK */}
        <text
          x="26"
          y="15"
          fontSize="4"
          fontWeight="bold"
          fontFamily="Roboto, sans-serif"
          fill="#0f172a"
        >
          LEMBAR JAWABAN KOMPUTER (LJK)
        </text>
        <text
          x="26"
          y="19"
          fontSize="2.5"
          fontWeight="medium"
          fontFamily="Roboto, sans-serif"
          fill="#334155"
        >
          ImtihanOMR · Standar Penilaian Otomatis A4
        </text>

        {/* 5. Kotak Identitas Nama & Mata Pelajaran */}
        {nameCropRectMm && (
          <g>
            <rect
              x={nameCropRectMm.x}
              y={nameCropRectMm.y}
              width={nameCropRectMm.w}
              height={nameCropRectMm.h}
              fill="#ffffff"
              stroke="#64748b"
              strokeWidth="0.35"
              strokeDasharray="1.5,1.5"
            />
            {/* Baris NAMA */}
            <text
              x={nameCropRectMm.x + 3}
              y={nameCropRectMm.y + 6}
              fontSize="2.4"
              fontWeight="bold"
              fontFamily="Roboto, sans-serif"
              fill="#1e293b"
            >
              NAMA:
            </text>
            <line
              x1={nameCropRectMm.x + 16}
              y1={nameCropRectMm.y + 6.5}
              x2={nameCropRectMm.x + nameCropRectMm.w - 3}
              y2={nameCropRectMm.y + 6.5}
              stroke="#94a3b8"
              strokeWidth="0.25"
              strokeDasharray="0.8,0.8"
            />
            {/* Baris MATA PELAJARAN */}
            <text
              x={nameCropRectMm.x + 3}
              y={nameCropRectMm.y + 14}
              fontSize="2.2"
              fontWeight="bold"
              fontFamily="Roboto, sans-serif"
              fill="#1e293b"
            >
              MAPEL:
            </text>
            <line
              x1={nameCropRectMm.x + 16}
              y1={nameCropRectMm.y + 14.5}
              x2={nameCropRectMm.x + nameCropRectMm.w - 3}
              y2={nameCropRectMm.y + 14.5}
              stroke="#94a3b8"
              strokeWidth="0.25"
              strokeDasharray="0.8,0.8"
            />
          </g>
        )}

        {/* 6. Kotak Identitas Kelas & Tanggal Ujian */}
        <g>
          <rect
            x="110"
            y="30"
            width="80"
            height="20"
            fill="#ffffff"
            stroke="#64748b"
            strokeWidth="0.35"
            strokeDasharray="1.5,1.5"
          />
          {/* Baris KELAS */}
          <text
            x="113"
            y="36"
            fontSize="2.4"
            fontWeight="bold"
            fontFamily="Roboto, sans-serif"
            fill="#1e293b"
          >
            KELAS:
          </text>
          <line
            x1="126"
            y1="36.5"
            x2="187"
            y2="36.5"
            stroke="#94a3b8"
            strokeWidth="0.25"
            strokeDasharray="0.8,0.8"
          />
          {/* Baris TANGGAL */}
          <text
            x="113"
            y="44"
            fontSize="2.2"
            fontWeight="bold"
            fontFamily="Roboto, sans-serif"
            fill="#1e293b"
          >
            TANGGAL:
          </text>
          <line
            x1="128"
            y1="44.5"
            x2="187"
            y2="44.5"
            stroke="#94a3b8"
            strokeWidth="0.25"
            strokeDasharray="0.8,0.8"
          />
        </g>

        {/* 7. Kotak Petunjuk Pengisian */}
        <g>
          <rect
            x="14"
            y="54"
            width="176"
            height="22"
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth="0.35"
          />
          <text
            x="17"
            y="59"
            fontSize="2.2"
            fontWeight="bold"
            fontFamily="Roboto, sans-serif"
            fill="#0f172a"
          >
            PETUNJUK PENGISIAN:
          </text>
          <text
            x="17"
            y="63"
            fontSize="1.9"
            fontFamily="Roboto, sans-serif"
            fill="#334155"
          >
            1. Hitamkan bulatan penuh pada jawaban yang benar menggunakan pensil 2B.
          </text>
          <text
            x="17"
            y="67"
            fontSize="1.9"
            fontFamily="Roboto, sans-serif"
            fill="#334155"
          >
            2. Tuliskan Nama, Mata Pelajaran, Kelas, dan Tanggal Ujian dengan jelas.
          </text>
          <text
            x="17"
            y="71"
            fontSize="1.9"
            fontFamily="Roboto, sans-serif"
            fill="#334155"
          >
            3. Lembar tidak boleh terlipat, robek, atau kotor.
          </text>

          {/* Contoh Benar / Salah Mini */}
          <g transform="translate(136, 56.5)">
            <text x="0" y="4" fontSize="1.8" fontWeight="bold" fill="#15803d">
              [✓] Benar
            </text>
            <circle cx="28" cy="3" r="2.2" fill="#0f172a" />

            <text x="0" y="11" fontSize="1.8" fontWeight="bold" fill="#b91c1c">
              [✗] Salah
            </text>
            <circle cx="28" cy="10" r="2.2" fill="none" stroke="#0f172a" strokeWidth="0.3" />
            <line x1="26.5" y1="8.5" x2="29.5" y2="11.5" stroke="#b91c1c" strokeWidth="0.4" />
            <line x1="29.5" y1="8.5" x2="26.5" y2="11.5" stroke="#b91c1c" strokeWidth="0.4" />

            <circle cx="35" cy="10" r="2.2" fill="none" stroke="#0f172a" strokeWidth="0.3" />
            <path d="M 33.8 10 L 34.6 11.2 L 36.4 8.8" fill="none" stroke="#b91c1c" strokeWidth="0.4" />
          </g>
        </g>

        {/* 8. Judul Bagian Pilihan Ganda */}
        <text
          x="14"
          y="89"
          fontSize="2.8"
          fontWeight="bold"
          fontFamily="Roboto, sans-serif"
          fill="#0f172a"
        >
          I. PILIHAN GANDA
        </text>

        {/* 9. Bubble Slots Pilihan Ganda */}
        {multipleChoiceSlots.map((slot) => {
          const isSlotActive = activePgCount === undefined || slot.questionNumber <= activePgCount;
          return (
            <g
              key={`slot-${slot.questionNumber}`}
              opacity={isSlotActive ? 1 : 0.35}
              className={isSlotActive ? undefined : "select-none"}
            >
              {/* Nomor Soal */}
              <text
                x={slot.xMm + 4}
                y={slot.yMm + 1.2}
                textAnchor="end"
                fontSize="2.3"
                fontWeight="bold"
                fontFamily="Roboto, sans-serif"
                fill={isSlotActive ? "#1e293b" : "#94a3b8"}
              >
                {String(slot.questionNumber).padStart(2, "0")}
              </text>

              {/* Pilihan Opsi A, B, C, D */}
              {slot.options.map((opt) => (
                <g key={`opt-${slot.questionNumber}-${opt.label}`}>
                  <circle
                    cx={opt.xMm}
                    cy={opt.yMm}
                    r="2.25"
                    fill="#ffffff"
                    stroke={isSlotActive ? "#1e293b" : "#94a3b8"}
                    strokeWidth="0.35"
                    strokeDasharray={isSlotActive ? undefined : "0.8,0.8"}
                  />
                  <text
                    x={opt.xMm}
                    y={opt.yMm + 0.9}
                    textAnchor="middle"
                    fontSize="2.0"
                    fontWeight="bold"
                    fontFamily="Roboto, sans-serif"
                    fill={isSlotActive ? "#1e293b" : "#94a3b8"}
                  >
                    {opt.label}
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {/* 10. Zona Jawaban Esai */}
        {essayAreaRectMm && (
          <g>
            <text
              x="14"
              y={essayAreaRectMm.y - 4}
              fontSize="2.8"
              fontWeight="bold"
              fontFamily="Roboto, sans-serif"
              fill="#0f172a"
            >
              II. ZONA JAWABAN ESAI
            </text>
            <rect
              x={essayAreaRectMm.x}
              y={essayAreaRectMm.y}
              width={essayAreaRectMm.w}
              height={essayAreaRectMm.h}
              fill="#fafaf9"
              stroke="#475569"
              strokeWidth="0.4"
              strokeDasharray="2,2"
            />
            <text
              x={essayAreaRectMm.x + essayAreaRectMm.w / 2}
              y={essayAreaRectMm.y + essayAreaRectMm.h / 2}
              textAnchor="middle"
              fontSize="2.8"
              fontStyle="italic"
              fontFamily="Roboto, sans-serif"
              fill="#94a3b8"
            >
              Area Jawaban Esai Siswa (Tuliskan nomor soal dan jawaban dengan jelas)
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
