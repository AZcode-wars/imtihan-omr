"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type GradeFilter = "ALL" | "PASS" | "REMEDIAL";

export interface FilterChipsProps {
  value: GradeFilter;
  onChange: (val: GradeFilter) => void;
  counts?: {
    all: number;
    pass: number;
    remedial: number;
  };
  className?: string;
}

export function FilterChips({
  value,
  onChange,
  counts,
  className,
}: FilterChipsProps) {
  const options: { id: GradeFilter; label: string; count?: number }[] = [
    { id: "ALL", label: "Semua", count: counts?.all },
    { id: "PASS", label: "Lulus", count: counts?.pass },
    { id: "REMEDIAL", label: "Remedial", count: counts?.remedial },
  ];

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95",
              isActive
                ? "bg-brand-700 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-bold",
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
