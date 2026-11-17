"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

export interface AppHeaderProps {
  examTitle?: string;
  isOnline?: boolean;
  onToggleOnline?: () => void;
  className?: string;
}

export function AppHeader({
  examTitle = "UTS Matematika - Kelas 8A",
  isOnline = true,
  onToggleOnline,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "h-[60px] bg-brand-800 text-white px-4 flex items-center justify-between shadow-sm z-20 shrink-0 sticky top-0",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 bg-white rounded-md p-1 shrink-0 shadow-xs flex items-center justify-center">
          <img
            src="/imtihan-logo.svg"
            alt="Logo ImtihanOMR"
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white leading-tight">
              ImtihanOMR
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-700 text-brand-200 border border-brand-500/30 leading-none">
              MVP
            </span>
          </div>
          <p className="text-[11px] text-brand-100/80 truncate max-w-[200px] leading-tight">
            {examTitle}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleOnline}
        title="Klik untuk simulasi mode online/offline"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-700/90 border border-brand-500/30 text-xs font-semibold cursor-pointer hover:bg-brand-700 transition-colors",
          !isOnline && "bg-amber-950/40 border-amber-500/40"
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            isOnline ? "bg-brand-400 animate-pulse" : "bg-amber-400"
          )}
        />
        <span className="text-[11px]">
          {isOnline ? "Online" : "Offline"}
        </span>
      </button>
    </header>
  );
}
