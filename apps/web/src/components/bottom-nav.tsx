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
  { href: "/", label: "Ujian", icon: SlidersHorizontal },
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
        "lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md z-30 flex items-center justify-around px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgb(0_0_0/0.05)] border-t border-slate-100",
        className
      )}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/" || pathname === "/setup"
            : pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

        // Tombol Tengah Floating (Scan / +)
        if (item.isPrimary) {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label || "Scan LJK"}
              className="flex flex-col items-center justify-center min-w-[68px] -mt-5 group"
            >
              <div
                className={cn(
                  "w-[56px] h-[56px] rounded-full flex items-center justify-center transition-all duration-200 shadow-md",
                  isActive
                    ? "bg-brand-700 text-white shadow-brand-700/30 ring-4 ring-white scale-105"
                    : "bg-brand-700 text-white hover:bg-brand-800 shadow-brand-700/20 ring-4 ring-white"
                )}
              >
                <img
                  src="/scan-logo.svg"
                  alt="Scan LJK"
                  className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105"
                />
              </div>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        }

        // 4 Item Navigasi Sisi Kiri & Kanan
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-col items-center justify-center min-w-[60px] py-1 transition-colors group"
          >
            <div className="relative mb-1 flex items-center justify-center">
              <Icon
                className={cn(
                  "w-[22px] h-[22px] transition-all duration-150",
                  isActive
                    ? "text-brand-700 stroke-[2.4] scale-105"
                    : "text-slate-400 group-hover:text-slate-600 stroke-[1.8]"
                )}
              />
              {item.hasBadge && queueCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                  {queueCount > 9 ? "9+" : queueCount}
                </span>
              )}
            </div>

            <span
              className={cn(
                "text-[12px] tracking-tight transition-all duration-150",
                isActive
                  ? "text-brand-700 font-bold"
                  : "text-slate-400 group-hover:text-slate-600 font-medium"
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
