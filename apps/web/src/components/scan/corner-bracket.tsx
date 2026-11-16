import * as React from "react";
import { cn } from "@/lib/utils";

export interface CornerBracketProps {
  state?: "IDLE" | "LOCKED" | "PROCESSING";
  className?: string;
}

export function CornerBracket({ state = "IDLE", className }: CornerBracketProps) {
  const colorClass =
    state === "IDLE"
      ? "border-white/60 text-white/60"
      : "border-brand-400 text-brand-400 drop-shadow-[0_0_8px_rgba(125,169,93,0.5)]";

  return (
    <div
      className={cn(
        "relative w-full max-w-[320px] aspect-[1/1.414] mx-auto pointer-events-none transition-all duration-300",
        className
      )}
    >
      {/* Kiri Atas */}
      <div
        className={cn(
          "absolute top-0 left-0 w-9 h-9 border-t-4 border-l-4 rounded-tl-xl transition-colors duration-200",
          colorClass
        )}
      />

      {/* Kanan Atas */}
      <div
        className={cn(
          "absolute top-0 right-0 w-9 h-9 border-t-4 border-r-4 rounded-tr-xl transition-colors duration-200",
          colorClass
        )}
      />

      {/* Kiri Bawah */}
      <div
        className={cn(
          "absolute bottom-0 left-0 w-9 h-9 border-b-4 border-l-4 rounded-bl-xl transition-colors duration-200",
          colorClass
        )}
      />

      {/* Kanan Bawah */}
      <div
        className={cn(
          "absolute bottom-0 right-0 w-9 h-9 border-b-4 border-r-4 rounded-br-xl transition-colors duration-200",
          colorClass
        )}
      />

      {/* Garis Arah LJK Halus di Tengah */}
      <div className="absolute inset-8 border border-dashed border-white/20 rounded-lg pointer-events-none" />
    </div>
  );
}
