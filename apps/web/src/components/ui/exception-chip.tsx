import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { OMRStatus, StatusChip } from "./status-chip";

export interface ExceptionChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  status: OMRStatus;
  questionNumber: number;
  info?: string;
  isOpen?: boolean;
}

export const ExceptionChip = React.forwardRef<HTMLButtonElement, ExceptionChipProps>(
  ({ status, questionNumber, info, isOpen = false, className, ...props }, ref) => {
    let label = `No. ${questionNumber}`;
    if (status === "EMPTY") label = `${questionNumber} kosong`;
    else if (status === "MULTIPLE") label = `${questionNumber} ganda`;
    else if (status === "LOW_CONFIDENCE") label = `${questionNumber} · ${info || "ragu"}`;

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center min-h-[44px] min-w-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/50 rounded-[12px]",
          className
        )}
        {...props}
      >
        <StatusChip
          status={status}
          label={label}
          className="flex items-center gap-1.5 w-full justify-between"
        />
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 ml-1 transition-transform duration-200 text-slate-500",
            isOpen && "rotate-180 text-brand-700"
          )}
          aria-hidden="true"
        />
      </button>
    );
  }
);
ExceptionChip.displayName = "ExceptionChip";
