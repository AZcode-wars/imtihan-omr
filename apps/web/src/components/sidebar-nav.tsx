"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  CloudUpload,
  FileText,
  ScanLine,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidebarNavProps {
  queueCount?: number;
  className?: string;
}

const menuItems = [
  { href: "/", label: "Ujian & Aturan", icon: SlidersHorizontal },
  { href: "/students", label: "Kelas & Siswa", icon: Users },
  { href: "/template", label: "Blueprint LJK", icon: FileText },
  { href: "/scan", label: "Scan LJK", icon: ScanLine },
  { href: "/queue", label: "Antrean Offline", icon: CloudUpload, hasBadge: true },
  { href: "/grades", label: "Rekap Nilai", icon: ClipboardList },
];

export function SidebarNav({ queueCount = 0, className }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden lg:flex w-60 shrink-0 bg-white border-r border-slate-200 flex-col justify-between h-screen sticky top-0 z-30 select-none",
        className
      )}
    >
      <div className="p-4">
        {/* Brand Logo & Header */}
        <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center text-white shadow-xs">
            <ScanLine className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-slate-800">
                ImtihanOMR
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                MVP
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Scanner LJK Pintar</p>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/" || pathname === "/setup"
                : pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-800 font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-1 bg-brand-700 rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-brand-700" : "text-slate-400"
                  )}
                />
                <span className="truncate">{item.label}</span>
                {item.hasBadge && queueCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold">
                    {queueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Info Sesi Bawah */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="px-2 py-1">
          <p className="text-xs font-bold text-slate-700 truncate">
            UTS Matematika
          </p>
          <p className="text-[11px] text-slate-400">Kelas 8A · 30 Siswa</p>
        </div>
      </div>
    </aside>
  );
}
