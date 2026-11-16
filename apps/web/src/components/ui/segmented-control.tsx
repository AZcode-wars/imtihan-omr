import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "bg-slate-100 p-1 rounded-xl grid gap-1 border border-slate-200/50",
        options.length === 2 && "grid-cols-2",
        options.length === 3 && "grid-cols-3",
        options.length === 4 && "grid-cols-4",
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "py-2 px-3 text-xs font-medium rounded-lg transition-all min-h-[38px] flex items-center justify-center cursor-pointer",
              isActive
                ? "bg-white text-brand-800 font-bold shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
