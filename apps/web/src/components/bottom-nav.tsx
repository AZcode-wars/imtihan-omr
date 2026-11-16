"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  CloudUpload,
  ScanLine,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomNavProps {
  queueCount?: number;
  className?: string;
}

const navItems = [
  { href: "/setup", label: "Ujian", icon: SlidersHorizontal },
  { href: "/students", label: "Kelas", icon: Users },
  { href: "/scan", label: "Scan", icon: ScanLine, isPrimary: true },
  { href: "/queue", label: "Antrean", icon: CloudUpload, hasBadge: true },
  { href: "/grades", label: "Nilai", icon: ClipboardList },
];

export function BottomNav({ queueCount = 0, className }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-white border-t border-slate-200 z-30 flex items-center justify-around px-2 shadow-[0_-4px_20px_rgb(0_0_0/0.04)] pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

        if (item.isPrimary) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center min-w-[64px] min-h-[56px] -mt-2 group"
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm",
                  isActive
                    ? "bg-brand-700 text-white shadow-brand-700/25"
                    : "bg-brand-50 text-brand-700 hover:bg-brand-100"
                )}
              >
                <Icon className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span
                className={cn(
                  "text-[11px] mt-1 font-bold",
                  isActive ? "text-brand-700" : "text-slate-500 group-hover:text-slate-700"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-col items-center justify-center min-w-[64px] min-h-[56px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            <div className="relative">
              <Icon
                className={cn(
                  "w-5 h-5",
                  isActive ? "text-brand-700 stroke-[2.2]" : "text-slate-400"
                )}
              />
              {item.hasBadge && queueCount > 0 && (
                <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {queueCount > 9 ? "9+" : queueCount}
                </span>
              )}
            </div>
            <span
              className={cn(
                "text-[11px] mt-1",
                isActive ? "text-brand-700 font-bold" : "text-slate-500"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
