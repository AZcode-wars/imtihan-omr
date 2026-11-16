import * as React from "react";
import { cn } from "@/lib/utils";

export interface CornerBracketProps {
  state?: "IDLE" | "LOCKED" | "PROCESSING";
  corners?: {
    tl?: boolean;
    tr?: boolean;
    bl?: boolean;
    br?: boolean;
  };
  className?: string;
}

export function CornerBracket({ state = "IDLE", corners, className }: CornerBracketProps) {
  const activeColor = "border-emerald-400 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.7)] scale-105";
  const defaultLockedColor = "border-brand-400 text-brand-400 drop-shadow-[0_0_8px_rgba(125,169,93,0.5)]";
  const idleColor = "border-white/50 text-white/50";

  const isLockedOrProcessing = state === "LOCKED" || state === "PROCESSING";

  const getCornerClass = (isCornerActive?: boolean) => {
    if (isCornerActive) return activeColor;
    if (isLockedOrProcessing) return defaultLockedColor;
    return idleColor;
  };

  return (
    <div
      className={cn(
        "relative w-full max-w-[310px] sm:max-w-[340px] aspect-[1/1.414] mx-auto pointer-events-none transition-all duration-300",
        className
      )}
    >
      {/* Kiri Atas */}
      <div
        className={cn(
          "absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 rounded-tl-xl transition-all duration-200",
          getCornerClass(corners?.tl)
        )}
      />

      {/* Kanan Atas */}
      <div
        className={cn(
          "absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 rounded-tr-xl transition-all duration-200",
          getCornerClass(corners?.tr)
        )}
      />

      {/* Kiri Bawah */}
      <div
        className={cn(
          "absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 rounded-bl-xl transition-all duration-200",
          getCornerClass(corners?.bl)
        )}
      />

      {/* Kanan Bawah */}
      <div
        className={cn(
          "absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 rounded-br-xl transition-all duration-200",
          getCornerClass(corners?.br)
        )}
      />

      {/* Garis Arah LJK Halus di Tengah */}
      <div className="absolute inset-8 border border-dashed border-white/20 rounded-lg pointer-events-none" />
    </div>
  );
}
