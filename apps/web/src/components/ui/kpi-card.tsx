import * as React from "react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  badge?: string;
  badgeVariant?: "pass" | "remedial" | "neutral" | "warning";
  className?: string;
}

export function KpiCard({
  label,
  value,
  subLabel,
  badge,
  badgeVariant = "pass",
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3.5 flex flex-col justify-between gap-1",
        className
      )}
    >
      <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums text-brand-800 tracking-tight">
        {value}
      </div>
      {(subLabel || badge) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {badge && (
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
                badgeVariant === "pass" && "bg-emerald-50 text-emerald-700",
                badgeVariant === "remedial" && "bg-rose-50 text-rose-700",
                badgeVariant === "warning" && "bg-amber-50 text-amber-700",
                badgeVariant === "neutral" && "bg-slate-100 text-slate-600"
              )}
            >
              {badge}
            </span>
          )}
          {subLabel && <span className="text-[11px] text-slate-500">{subLabel}</span>}
        </div>
      )}
    </div>
  );
}
