"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, X } from "lucide-react";

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  studentName?: string;
  nis?: string;
  confirmLabel?: string;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  studentName,
  nis,
  confirmLabel = "Ya, Hapus Data",
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 border border-slate-100 z-10 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <Trash2 className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3
              id="confirm-delete-title"
              className="text-base font-bold text-slate-800 leading-snug"
            >
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informasi Siswa jika per-nilai */}
        {(studentName || nis) && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-800">{studentName || "-"}</p>
              {nis && <p className="text-[11px] text-slate-500">NIS: {nis}</p>}
            </div>
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Akan Dihapus
            </span>
          </div>
        )}

        {/* Peringatan Permanen */}
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold block text-amber-950">
              Data yang dihapus tidak dapat dipulihkan!
            </strong>
            Data akan dihapus permanen dari penyimpanan lokal (IndexedDB) browser ini.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-600 hover:text-slate-900 text-xs h-9"
          >
            Batal
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 gap-1.5 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? "Menghapus..." : confirmLabel}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
