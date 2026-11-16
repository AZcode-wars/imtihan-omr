import * as React from "react";
import { cn } from "@/lib/utils";
import { OptionLabel, QuestionStatus } from "@/types/omr";

export interface AnswerKeyItem {
  questionNumber: number;
  key: OptionLabel | null;
  status: QuestionStatus;
}

export interface AnswerKeyGridProps {
  items: AnswerKeyItem[];
  selectedNumber?: number | null;
  onSelectQuestion: (questionNumber: number) => void;
  className?: string;
}

export function AnswerKeyGrid({
  items,
  selectedNumber,
  onSelectQuestion,
  className,
}: AnswerKeyGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-5 md:grid-cols-10 gap-2 select-none",
        className
      )}
    >
      {items.map((item) => {
        const isSelected = selectedNumber === item.questionNumber;
        const isVoid = item.status === "VOID";
        const isBonus = item.status === "BONUS";

        return (
          <button
            key={item.questionNumber}
            type="button"
            onClick={() => onSelectQuestion(item.questionNumber)}
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-[52px] rounded-xl border bg-white cursor-pointer transition-all active:scale-95",
              isSelected
                ? "border-brand-700 ring-2 ring-brand-700/20 bg-brand-50"
                : "border-slate-200 hover:border-brand-700/60 shadow-xs",
              isVoid && "bg-slate-50 border-slate-300"
            )}
          >
            {/* Nomor Soal */}
            <span className="text-[10px] text-slate-400 font-medium leading-none mb-0.5">
              {item.questionNumber}
            </span>

            {/* Kunci Jawaban */}
            <span
              className={cn(
                "text-base font-bold leading-none tracking-tight",
                isVoid
                  ? "line-through text-slate-400"
                  : item.key
                  ? "text-slate-800"
                  : "text-slate-300"
              )}
            >
              {item.key ?? "—"}
            </span>

            {/* Superscript Bonus */}
            {isBonus && (
              <span className="absolute top-1 right-1.5 text-xs font-black text-brand-700 leading-none">
                +
              </span>
            )}

            {/* Void Coretan Diagonal Marker */}
            {isVoid && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-4/5 h-[1.5px] bg-slate-400 rotate-[-28deg]" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
