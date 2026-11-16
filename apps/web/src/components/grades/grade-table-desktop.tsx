"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StudentGradeRecord } from "./student-grade-card";

export interface GradeTableDesktopProps {
  records: StudentGradeRecord[];
  selectedId?: string | null;
  onSelectRecord?: (record: StudentGradeRecord) => void;
  className?: string;
}

export function GradeTableDesktop({
  records,
  selectedId,
  onSelectRecord,
  className,
}: GradeTableDesktopProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold tracking-wider text-slate-500 uppercase h-11">
              <th className="px-5 py-3 w-12 text-center">No</th>
              <th className="px-5 py-3">Nama Siswa</th>
              <th className="px-5 py-3 w-32">NIS</th>
              <th className="px-5 py-3 w-28 text-right">Skor PG</th>
              <th className="px-5 py-3 w-32 text-right">Skor Esai</th>
              <th className="px-5 py-3 w-32 text-right">Nilai Akhir</th>
              <th className="px-5 py-3 w-28 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {records.map((record, index) => {
              const isSelected = selectedId === record.id;
              const isEven = index % 2 === 1;

              return (
                <tr
                  key={record.id}
                  onClick={() => onSelectRecord?.(record)}
                  className={cn(
                    "h-14 transition-colors cursor-pointer group",
                    isEven ? "bg-slate-50/50" : "bg-white",
                    "hover:bg-brand-50/50",
                    isSelected && "bg-brand-50 relative"
                  )}
                >
                  <td className="px-5 py-3 text-center text-xs font-bold text-slate-400 tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-5 py-3 font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="w-1 h-5 bg-brand-700 rounded-r-full" />
                      )}
                      <span>{record.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-500 tabular-nums">
                    {record.nis}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-700 tabular-nums">
                    {record.mcPoints} / {record.mcMaxPoints}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-700 tabular-nums">
                    {record.essayPoints} / {record.essayMaxPoints}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={cn(
                        "text-base font-bold tabular-nums",
                        record.isPassing ? "text-brand-800" : "text-rose-600"
                      )}
                    >
                      {record.finalGrade.toLocaleString("id-ID", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Badge variant={record.isPassing ? "pass" : "remedial"}>
                      {record.isPassing ? "Lulus" : "Remedial"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
