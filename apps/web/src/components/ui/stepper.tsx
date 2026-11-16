import * as React from "react";
import { cn } from "@/lib/utils";

export interface StepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  helper?: string;
  onChange: (val: number) => void;
  className?: string;
}

export function Stepper({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  helper,
  onChange,
  className,
}: StepperProps) {
  const handleDecrement = () => {
    if (value - step >= min) onChange(value - step);
  };

  const handleIncrement = () => {
    if (value + step <= max) onChange(value + step);
  };

  return (
    <div
      className={cn(
        "bg-slate-50 border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-between gap-2",
        className
      )}
    >
      <span className="text-xs font-medium text-slate-500 self-start">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label={`Kurangi ${label}`}
          className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
        >
          −
        </button>
        <span className="w-12 text-center text-xl font-bold tabular-nums text-slate-800" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label={`Tambah ${label}`}
          className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
        >
          +
        </button>
      </div>
      {helper && <span className="text-[11px] text-slate-400 self-center">{helper}</span>}
    </div>
  );
}
