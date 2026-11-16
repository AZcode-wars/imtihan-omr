"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EssayMarkRowProps {
  questionNumber: number;
  maxScore: number;
  pointsAwarded: number;
  outcome: "CORRECT" | "INCORRECT" | "PARTIAL";
  onChange: (points: number, outcome: "CORRECT" | "INCORRECT" | "PARTIAL") => void;
  className?: string;
}

export function EssayMarkRow({
  questionNumber,
  maxScore,
  pointsAwarded,
  outcome,
  onChange,
  className,
}: EssayMarkRowProps) {
  const isCorrect = outcome === "CORRECT";
  const isIncorrect = outcome === "INCORRECT";

  const handleCorrect = () => {
    onChange(maxScore, "CORRECT");
  };

  const handleIncorrect = () => {
    onChange(0, "INCORRECT");
  };

  const handlePointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const clamped = Math.max(0, Math.min(maxScore, val));
    let newOutcome: "CORRECT" | "INCORRECT" | "PARTIAL" = "PARTIAL";
    if (clamped === maxScore) newOutcome = "CORRECT";
    else if (clamped === 0) newOutcome = "INCORRECT";
    onChange(clamped, newOutcome);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 gap-3",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
            outcome === "CORRECT"
              ? "bg-emerald-100 text-emerald-800"
              : outcome === "INCORRECT"
              ? "bg-rose-100 text-rose-800"
              : "bg-amber-100 text-amber-800"
          )}
        >
          {isCorrect ? <Check className="w-3 h-3" /> : isIncorrect ? <X className="w-3 h-3" /> : "~"}
        </span>
        <span className="text-xs font-bold text-slate-700">E{questionNumber}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCorrect}
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1",
            isCorrect
              ? "bg-brand-700 text-white border-brand-800 shadow-xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
          )}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Benar</span>
        </button>

        <button
          type="button"
          onClick={handleIncorrect}
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1",
            isIncorrect
              ? "bg-rose-600 text-white border-rose-700 shadow-xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
          )}
        >
          <X className="w-3.5 h-3.5" />
          <span>Salah</span>
        </button>

        <div className="flex items-center gap-1 pl-1">
          <span className="text-[11px] text-slate-400">Nilai:</span>
          <input
            type="number"
            min={0}
            max={maxScore}
            step={0.5}
            value={pointsAwarded}
            onChange={handlePointsChange}
            className="w-14 h-8 px-1.5 text-center text-xs font-bold border-2 border-brand-700/60 rounded-md bg-white text-brand-900 tabular-nums focus:border-brand-700 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
