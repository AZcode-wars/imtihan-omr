"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Scan } from "lucide-react";

export interface ShutterButtonProps {
  isLocked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ShutterButton({
  isLocked = false,
  disabled = false,
  onClick,
  className,
}: ShutterButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer shadow-lg",
        "bg-white/20 border-2 border-white/50 backdrop-blur-md",
        isLocked && "border-brand-400 ring-4 ring-brand-400/30 scale-105",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
        className
      )}
      aria-label="Ambil Foto LJK"
    >
      <div
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
          isLocked ? "bg-brand-500 text-white" : "bg-white text-brand-800"
        )}
      >
        <Scan className="w-6 h-6 stroke-[2.2]" />
      </div>
    </button>
  );
}
