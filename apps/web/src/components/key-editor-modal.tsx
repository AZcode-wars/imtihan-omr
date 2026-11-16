"use client";

import * as React from "react";
import { OptionLabel, QuestionStatus } from "@/types/omr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface KeyEditorModalProps {
  questionNumber: number;
  currentKey: OptionLabel | null;
  currentStatus: QuestionStatus;
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: OptionLabel | null, status: QuestionStatus) => void;
}

const OPTIONS: OptionLabel[] = ["A", "B", "C", "D"];

export function KeyEditorModal({
  questionNumber,
  currentKey,
  currentStatus,
  isOpen,
  onClose,
  onSave,
}: KeyEditorModalProps) {
  const [key, setKey] = React.useState<OptionLabel | null>(currentKey);
  const [status, setStatus] = React.useState<QuestionStatus>(currentStatus);

  React.useEffect(() => {
    setKey(currentKey);
    setStatus(currentStatus);
  }, [currentKey, currentStatus, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(key, status);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-floating space-y-5 border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-800">
            Edit Kunci Soal #{questionNumber}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
            Status: {status}
          </span>
        </div>

        {/* Pilihan Opsi A, B, C, D */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Opsi Jawaban Benar
          </label>
          <div className="grid grid-cols-4 gap-2">
            {OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setKey(opt)}
                className={cn(
                  "h-12 rounded-xl font-bold text-lg border transition-all active:scale-95 cursor-pointer",
                  key === opt
                    ? "bg-brand-700 text-white border-brand-800 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-brand-700/60"
                )}
              >
                {opt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setKey(null)}
            className={cn(
              "w-full py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer mt-1",
              key === null
                ? "bg-rose-50 border-rose-300 text-rose-800"
                : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
            )}
          >
            Kosongkan Kunci
          </button>
        </div>

        {/* Pengalih Status Soal */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Status Khusus Soal
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["ACTIVE", "BONUS", "VOID"] as QuestionStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatus(st)}
                className={cn(
                  "py-2 px-2 text-xs font-bold rounded-lg border transition-all text-center cursor-pointer",
                  status === st
                    ? "bg-brand-800 text-white border-brand-900 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                )}
              >
                {st === "ACTIVE" ? "Aktif" : st === "BONUS" ? "Bonus (+)" : "Void (Anulir)"}
              </button>
            ))}
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="flex items-center gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSave}>
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}
