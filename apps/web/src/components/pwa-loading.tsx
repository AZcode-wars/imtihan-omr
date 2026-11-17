import * as React from "react";
import { cn } from "@/lib/utils";

export interface PwaLoadingProps {
  message?: string;
  compact?: boolean;
  className?: string;
}

export function PwaLoading({
  message = "Memuat aplikasi...",
  compact = false,
  className,
}: PwaLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center select-none text-center p-6",
        compact ? "py-16 w-full" : "min-h-screen w-full bg-slate-50",
        className
      )}
    >
      {/* Animated Logo Container */}
      <div className="relative flex items-center justify-center mb-5">
        <div className="absolute inset-0 rounded-2xl bg-brand-500/15 blur-xl animate-pulse" />
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border border-slate-200/80 shadow-md p-2.5 flex items-center justify-center transition-transform">
          <img
            src="/imtihan-logo.svg"
            alt="ImtihanOMR Logo"
            className="w-full h-full object-contain animate-[pulse_2.5s_cubic-bezier(0.4,0,0.6,1)_infinite]"
          />
        </div>
      </div>

      {/* Brand Text */}
      <div className="flex items-center gap-2 mb-1.5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">
          ImtihanOMR
        </h1>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
          MVP
        </span>
      </div>

      <p className="text-xs text-slate-500 font-medium mb-5">
        Scanner LJK Pintar · Offline Ready
      </p>

      {/* Progress indicator */}
      <div className="w-36 h-1.5 bg-slate-200/80 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-brand-600 rounded-full animate-[shimmer_1.5s_infinite] w-2/3" />
      </div>

      <p className="text-xs text-slate-400 font-normal">{message}</p>
    </div>
  );
}
