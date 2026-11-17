"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { SyncProvider, useSync } from "@/lib/sync-context";
import { getActiveExam } from "@/lib/db";
import { usePathname } from "next/navigation";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { isOnline, queueCount, toggleSimulationOnline } = useSync();
  const pathname = usePathname();
  const [examLabel, setExamLabel] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    async function loadActiveExam() {
      try {
        const active = await getActiveExam();
        if (active) {
          const title = active.title || "UTS Matematika";
          const className = active.className ? `Kelas ${active.className}` : "";
          setExamLabel(`${title} ${className}`.trim());
        }
      } catch (err) {
        console.warn("Gagal memuat info ujian aktif di layout:", err);
      }
    }
    loadActiveExam();
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar (>= 1024px) */}
      <SidebarNav queueCount={queueCount} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header (< 1024px) */}
        <div className="lg:hidden">
          <AppHeader
            examTitle={examLabel}
            isOnline={isOnline}
            onToggleOnline={toggleSimulationOnline}
          />
        </div>

        {/* Content Body with bottom padding for mobile navigation */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-24 lg:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation (< 1024px) */}
        <BottomNav queueCount={queueCount} />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Daftarkan service worker untuk PWA offline shell
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("PWA Service worker registration failed:", err);
      });
    }
  }, []);

  return (
    <SyncProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SyncProvider>
  );
}
