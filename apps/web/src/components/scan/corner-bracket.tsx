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
  const isAllDetected =
    Boolean(corners?.tl && corners?.tr && corners?.bl && corners?.br);

  const getCornerClass = (isCornerActive?: boolean) => {
    if (isCornerActive) {
      return "border-emerald-400 bg-emerald-400/20 shadow-[0_0_12px_rgba(52,211,153,0.8)] scale-105";
    }
    return "border-white/35 bg-transparent scale-100";
  };

  return (
    <div
      className={cn(
        "relative w-full max-w-[310px] sm:max-w-[340px] aspect-[1/1.414] mx-auto pointer-events-none transition-all duration-300",
        isAllDetected && "ring-2 ring-emerald-400/70 shadow-[0_0_30px_rgba(52,211,153,0.35)] rounded-2xl",
        className
      )}
    >
      {/* Kiri Atas */}
      <div
        className={cn(
          "absolute top-0 left-0 w-11 h-11 border-t-4 border-l-4 rounded-tl-xl transition-all duration-200",
          getCornerClass(corners?.tl)
        )}
      />

      {/* Kanan Atas */}
      <div
        className={cn(
          "absolute top-0 right-0 w-11 h-11 border-t-4 border-r-4 rounded-tr-xl transition-all duration-200",
          getCornerClass(corners?.tr)
        )}
      />

      {/* Kiri Bawah */}
      <div
        className={cn(
          "absolute bottom-0 left-0 w-11 h-11 border-b-4 border-l-4 rounded-bl-xl transition-all duration-200",
          getCornerClass(corners?.bl)
        )}
      />

      {/* Kanan Bawah */}
      <div
        className={cn(
          "absolute bottom-0 right-0 w-11 h-11 border-b-4 border-r-4 rounded-br-xl transition-all duration-200",
          getCornerClass(corners?.br)
        )}
      />

      {/* Garis Pembantu Lembar LJK di Tengah */}
      <div
        className={cn(
          "absolute inset-6 border border-dashed rounded-lg pointer-events-none transition-colors duration-300",
          isAllDetected ? "border-emerald-400/50 bg-emerald-950/10" : "border-white/15"
        )}
      />
    </div>
  );
}
