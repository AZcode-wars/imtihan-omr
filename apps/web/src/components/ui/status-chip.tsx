import * as React from "react";
import { CheckCircle2, CircleAlert, CircleMinus, Copy, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type OMRStatus = "VALID" | "EMPTY" | "MULTIPLE" | "LOW_CONFIDENCE";

export interface StatusChipProps extends React.HTMLAttributes<HTMLDivElement> {
  status: OMRStatus;
  label?: string;
  iconOnly?: boolean;
}

const statusConfig: Record<
  OMRStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    defaultLabel: string;
    className: string;
  }
> = {
  VALID: {
    icon: CheckCircle2,
    defaultLabel: "Valid",
    className: "bg-status-valid-bg border-status-valid-border text-status-valid-text",
  },
  EMPTY: {
    icon: CircleMinus,
    defaultLabel: "Kosong",
    className: "bg-status-empty-bg border-status-empty-border text-status-empty-text",
  },
  LOW_CONFIDENCE: {
    icon: TriangleAlert,
    defaultLabel: "Perlu Dicek",
    className:
      "bg-status-low-bg border-status-low-border border-dashed text-status-low-text",
  },
  MULTIPLE: {
    icon: Copy,
    defaultLabel: "Ganda",
    className: "bg-status-multiple-bg border-status-multiple-border text-status-multiple-text",
  },
};

export const StatusChip = React.forwardRef<HTMLDivElement, StatusChipProps>(
  ({ status, label, iconOnly = false, className, ...props }, ref) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    const displayText = label ?? config.defaultLabel;

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] text-xs font-bold leading-none border shadow-xs transition-colors",
          config.className,
          className
        )}
        {...props}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {!iconOnly && <span>{displayText}</span>}
      </div>
    );
  }
);
StatusChip.displayName = "StatusChip";
