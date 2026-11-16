"use client";

import * as React from "react";
import {
  getQueueItems,
  updateQueueItem,
  deleteQueueItem,
  clearQueue,
  addToQueue,
  getActiveExam,
} from "@/lib/db";
import { useSync } from "@/lib/sync-context";
import { OfflineQueueItem } from "@/types/omr";
import { buildTemplateFromExam } from "@/lib/template-builder";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CloudUpload,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileImage,
  Loader2,
  Clock,
  Wifi,
  WifiOff,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function QueuePage() {
  const { isOnline, refreshQueueCount } = useSync();
  const [items, setItems] = React.useState<OfflineQueueItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSyncingAll, setIsSyncingAll] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<{ current: number; total: number } | null>(
    null
  );

  const loadItems = React.useCallback(async () => {
    try {
      const q = await getQueueItems();
      setItems(q);
      refreshQueueCount();
    } catch (err) {
      console.error("Gagal mengambil data antrean:", err);
    } finally {
      setLoading(false);
    }
  }, [refreshQueueCount]);

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Sync single item ke OMR Engine via Next.js API route
  const syncItem = async (item: OfflineQueueItem): Promise<{ ok: boolean; error?: string }> => {
    try {
      // Tandai UPLOADING
      await updateQueueItem({ ...item, status: "UPLOADING", attempts: item.attempts + 1 });
      await loadItems();

      // Ambil konfigurasi ujian aktif untuk membuat template standar yang valid
      const activeExam = await getActiveExam();
      const template = buildTemplateFromExam(activeExam);

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          imageDataUrl: item.imageDataUrl,
          sourceDevice: "MOBILE_CAMERA",
        }),
      });

      if (!res.ok) {
        let errorDetail = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          errorDetail = errJson.error || errJson.detail || errorDetail;
        } catch {
          // ignore
        }

        if (res.status === 400 || res.status === 422) {
          throw new Error(`Citra tidak valid / 4 sudut fiducial tidak ditemukan (${errorDetail})`);
        } else if (res.status === 503) {
          throw new Error("Engine OMR tidak dapat dijangkau (503). Pastikan Engine OMR aktif.");
        } else {
          throw new Error(`Engine OMR gagal memproses: ${errorDetail}`);
        }
      }

      // Berhasil diproses oleh engine -> hapus dari antrean offline
      await deleteQueueItem(item.id);
      return { ok: true };
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : "Koneksi engine gagal";
      console.warn(`Sinkronisasi gagal untuk item ${item.id}:`, errMsg);
      // Update FAILED dengan catatan error yang spesifik dan akurat
      await updateQueueItem({
        ...item,
        status: "FAILED",
        attempts: item.attempts + 1,
        lastError: errMsg,
      });
      return { ok: false, error: errMsg };
    }
  };

  // Sync semua item
  const handleSyncAll = async () => {
    if (items.length === 0 || isSyncingAll) return;
    setIsSyncingAll(true);
    setSyncProgress({ current: 0, total: items.length });

    let successCount = 0;
    let lastError = "";
    const currentList = [...items];

    for (let i = 0; i < currentList.length; i++) {
      const item = currentList[i];
      setSyncProgress({ current: i + 1, total: currentList.length });
      const res = await syncItem(item);
      if (res.ok) {
        successCount++;
      } else if (res.error) {
        lastError = res.error;
      }
    }

    await loadItems();
    setIsSyncingAll(false);
    setSyncProgress(null);

    if (successCount > 0) {
      toast.success(`${successCount} hasil scan tersinkron ke server.`);
    } else {
      toast.error(lastError || "Semua antrean gagal disinkronkan. Periksa format citra atau status Engine OMR.");
    }
  };

  // Listen custom event dari SyncProvider saat koneksi kembali online
  React.useEffect(() => {
    const handleAutoSync = () => {
      if (items.length > 0 && !isSyncingAll) {
        handleSyncAll();
      }
    };

    window.addEventListener("trigger-omr-sync", handleAutoSync);
    return () => {
      window.removeEventListener("trigger-omr-sync", handleAutoSync);
    };
  }, [items, isSyncingAll]);

  // Hapus single item
  const handleDeleteItem = async (id: string) => {
    if (confirm("Hapus lembar scan ini dari antrean offline? Data gambar yang belum tersinkron akan hilang.")) {
      await deleteQueueItem(id);
      toast.info("Item dihapus dari antrean");
      await loadItems();
    }
  };

  // Kosongkan antrean
  const handleClearAll = async () => {
    if (confirm("Kosongkan semua antrean scan offline?")) {
      await clearQueue();
      toast.info("Antrean telah dikosongkan");
      await loadItems();
    }
  };

  // Buat antrean dummy/simulasi untuk pengujian guru
  const handleAddDemoItem = async () => {
    // 1x1 transparent png
    const dummyDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    await addToQueue({
      id: `scan-${Date.now().toString().slice(-4)}`,
      examId: "exam-uts-mat-8a",
      createdAt: new Date().toISOString(),
      thumbnailDataUrl: dummyDataUrl,
      imageDataUrl: dummyDataUrl,
    });
    toast.success("Foto scan offline ditambahkan ke antrean");
    await loadItems();
  };

  const pendingCount = items.filter((i) => i.status === "PENDING").length;
  const failedCount = items.filter((i) => i.status === "FAILED").length;
  const uploadingCount = items.filter((i) => i.status === "UPLOADING").length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Antrean Offline
            </h1>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5",
                isOnline
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              )}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5" /> Online
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" /> Mode Offline
                </>
              )}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {items.length === 0
              ? "Semua lembar scan telah tersinkronisasi ke server."
              : `${items.length} foto scan tersimpan lokal di IndexedDB menunggu unggah.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddDemoItem}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-4 h-4" /> Tambah Simulasi
          </Button>

          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Kosongkan
            </Button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {items.length > 0 && (
        <div className="bg-brand-50/60 border border-brand-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {isOnline
                  ? `${items.length} lembar siap diunggah ke OMR Engine`
                  : "Menunggu koneksi internet / engine untuk sinkronisasi"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {pendingCount} menunggu · {failedCount} gagal · {uploadingCount} sedang proses
              </p>
            </div>
          </div>

          <Button
            size="md"
            onClick={handleSyncAll}
            disabled={!isOnline || isSyncingAll}
            className="bg-brand-700 hover:bg-brand-800 text-white font-semibold shrink-0 shadow-sm"
          >
            {isSyncingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Mengunggah ({syncProgress?.current}/{syncProgress?.total})
              </>
            ) : (
              <>
                <RotateCw className="w-4 h-4 mr-2" />
                Unggah Semua Sekarang
              </>
            )}
          </Button>
        </div>
      )}

      {/* Daftar Antrean */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-brand-700" />
          <p className="text-sm">Memuat antrean IndexedDB...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 stroke-[1.8]" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Antrean Bersih</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">
            Tidak ada foto scan yang tertunda. Semua LJK yang dipindai saat offline akan tersimpan aman di sini.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {items.map((item, index) => {
            const timeStr = new Date(item.createdAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                {/* Thumbnail & Info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative">
                    {item.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailDataUrl}
                        alt="Scan preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileImage className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800 truncate">
                        {item.id}
                      </span>
                      {item.status === "PENDING" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                          Menunggu
                        </span>
                      )}
                      {item.status === "UPLOADING" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand-700 flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Mengunggah...
                        </span>
                      )}
                      {item.status === "FAILED" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" /> Gagal ({item.attempts}x)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timeStr}</span>
                      <span>·</span>
                      <span className="truncate">{item.examId || "Ujian Reguler"}</span>
                    </div>

                    {item.lastError && (
                      <p className="text-[11px] text-rose-500 mt-1 truncate max-w-md">
                        Error: {item.lastError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!isOnline || item.status === "UPLOADING"}
                    onClick={() => syncItem(item)}
                    className="h-8 px-2.5 text-xs text-slate-600 hover:text-brand-700"
                    title="Coba sinkronkan item ini"
                  >
                    <RotateCw
                      className={cn(
                        "w-3.5 h-3.5 mr-1",
                        item.status === "UPLOADING" && "animate-spin"
                      )}
                    />
                    Retry
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteItem(item.id)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Hapus dari antrean"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
