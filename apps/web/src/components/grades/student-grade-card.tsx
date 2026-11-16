"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StudentGradeRecord {
  id: string;
  nis: string;
  name: string;
  mcPoints: number;
  mcMaxPoints: number;
  essayPoints: number;
  essayMaxPoints: number;
  finalGrade: number;
  isPassing: boolean;
  verifiedAt: string;
}

export interface StudentGradeCardProps {
  record: StudentGradeRecord;
  onClick?: () => void;
  className?: string;
}

export function StudentGradeCard({
  record,
  onClick,
  className,
}: StudentGradeCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3.5 space-y-2 hover:border-brand-700/50 transition-all cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-800 leading-tight">
            {record.name}
          </h4>
          <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
            NIS: {record.nis}
          </span>
        </div>
        <Badge variant={record.isPassing ? "pass" : "remedial"}>
          {record.isPassing ? "● Lulus" : "● Remedial"}
        </Badge>
      </div>

      <div className="flex items-end justify-between border-t border-slate-100 pt-2 text-xs">
        <div className="text-[11px] text-slate-500 font-medium">
          PG:{" "}
          <strong className="text-slate-700 tabular-nums">
            {record.mcPoints}/{record.mcMaxPoints}
          </strong>{" "}
          · Esai:{" "}
          <strong className="text-slate-700 tabular-nums">
            {record.essayPoints}/{record.essayMaxPoints}
          </strong>
        </div>

        <div className="text-right">
          <span
            className={cn(
              "text-lg font-bold tabular-nums tracking-tight",
              record.isPassing ? "text-brand-800" : "text-rose-600"
            )}
          >
            {record.finalGrade.toLocaleString("id-ID", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
