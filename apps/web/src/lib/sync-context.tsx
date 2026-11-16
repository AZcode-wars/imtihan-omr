"use client";

import * as React from "react";
import { getQueueItems } from "@/lib/db";
import { toast } from "sonner";

interface SyncContextType {
  isOnline: boolean;
  queueCount: number;
  toggleSimulationOnline: () => void;
  refreshQueueCount: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

const SyncContext = React.createContext<SyncContextType>({
  isOnline: true,
  queueCount: 0,
  toggleSimulationOnline: () => {},
  refreshQueueCount: async () => {},
  triggerSync: async () => {},
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [queueCount, setQueueCount] = React.useState<number>(0);

  const refreshQueueCount = React.useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        const items = await getQueueItems();
        setQueueCount(items.length);
      }
    } catch (err) {
      console.warn("Gagal membaca antrean:", err);
    }
  }, []);

  const triggerSync = React.useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      window.dispatchEvent(new CustomEvent("trigger-omr-sync"));
      await refreshQueueCount();
    } catch (err) {
      console.error("Gagal trigger sync:", err);
    }
  }, [refreshQueueCount]);

  const toggleSimulationOnline = React.useCallback(() => {
    setIsOnline((prev) => {
      const next = !prev;
      if (next) {
        toast.success("Koneksi online aktif kembali. Menyiapkan sinkronisasi...");
        triggerSync();
      } else {
        toast.warning("Mode Offline aktif. Foto scan akan disimpan di antrean lokal.");
      }
      return next;
    });
  }, [triggerSync]);

  React.useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Koneksi internet terhubung kembali. Memulai auto-sync...");
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Koneksi internet terputus. Beralih otomatis ke Mode Offline.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial fetch
    refreshQueueCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshQueueCount, triggerSync]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        queueCount,
        toggleSimulationOnline,
        refreshQueueCount,
        triggerSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return React.useContext(SyncContext);
}
