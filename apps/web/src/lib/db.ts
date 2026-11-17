/**
 * Modul IndexedDB Lokal untuk ImtihanOMR / OpenOMR.
 * Mengelola antrean scan offline (OfflineQueueItem), draft konfigurasi ujian,
 * data siswa lokal, dan hasil penilaian.
 */

import {
  OfflineQueueItem,
  Student,
  ExamConfig,
  GradedStudentRecord,
  OMREngineSettings,
} from "@/types/omr";

export const DB_NAME = "imtihan_omr_db";
export const DB_VERSION = 1;

export const STORES = {
  QUEUE: "scans_queue",
  STUDENTS: "students",
  EXAMS: "exams",
  GRADES: "grades",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB hanya tersedia di sisi browser"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Store 1: scans_queue (antrean scan offline)
        if (!db.objectStoreNames.contains(STORES.QUEUE)) {
          const queueStore = db.createObjectStore(STORES.QUEUE, { keyPath: "id" });
          queueStore.createIndex("by_status", "status", { unique: false });
          queueStore.createIndex("by_examId", "examId", { unique: false });
          queueStore.createIndex("by_createdAt", "createdAt", { unique: false });
        }

        // Store 2: students (daftar siswa lokal)
        if (!db.objectStoreNames.contains(STORES.STUDENTS)) {
          const studentStore = db.createObjectStore(STORES.STUDENTS, { keyPath: "id" });
          studentStore.createIndex("by_nis", "nis", { unique: true });
          studentStore.createIndex("by_className", "className", { unique: false });
        }

        // Store 3: exams (draft konfigurasi ujian)
        if (!db.objectStoreNames.contains(STORES.EXAMS)) {
          db.createObjectStore(STORES.EXAMS, { keyPath: "id" });
        }

        // Store 4: grades (rekap nilai siswa lokal)
        if (!db.objectStoreNames.contains(STORES.GRADES)) {
          const gradesStore = db.createObjectStore(STORES.GRADES, { keyPath: "id" });
          gradesStore.createIndex("by_examId", "examId", { unique: false });
          gradesStore.createIndex("by_studentId", "studentId", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

/* ------------------------------------------------------------------ *
 * Operasi Antrean Scan Offline (scans_queue)
 * ------------------------------------------------------------------ */

export async function addToQueue(
  item: Omit<OfflineQueueItem, "attempts" | "status" | "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
    attempts?: number;
    status?: OfflineQueueItem["status"];
    scanResult?: OfflineQueueItem["scanResult"];
    selectedStudentId?: string;
    selectedStudentName?: string;
    essayMarks?: OfflineQueueItem["essayMarks"];
  }
): Promise<OfflineQueueItem> {
  const db = await getDB();
  const queueItem: OfflineQueueItem = {
    id: item.id || `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    examId: item.examId,
    createdAt: item.createdAt || new Date().toISOString(),
    thumbnailDataUrl: item.thumbnailDataUrl,
    imageDataUrl: item.imageDataUrl,
    status: item.status || "PENDING",
    attempts: item.attempts ?? 0,
    lastError: item.lastError,
    scanResult: item.scanResult,
    selectedStudentId: item.selectedStudentId,
    selectedStudentName: item.selectedStudentName,
    essayMarks: item.essayMarks,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.QUEUE, "readwrite");
    const store = tx.objectStore(STORES.QUEUE);
    const req = store.put(queueItem);
    req.onsuccess = () => resolve(queueItem);
    req.onerror = () => reject(req.error);
  });
}

export async function getQueueItems(): Promise<OfflineQueueItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.QUEUE, "readonly");
    const store = tx.objectStore(STORES.QUEUE);
    const req = store.getAll();
    req.onsuccess = () => {
      // Urutkan dari yang paling baru
      const items = (req.result as OfflineQueueItem[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getQueueItem(id: string): Promise<OfflineQueueItem | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.QUEUE, "readonly");
    const store = tx.objectStore(STORES.QUEUE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateQueueItem(item: OfflineQueueItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.QUEUE, "readwrite");
    const store = tx.objectStore(STORES.QUEUE);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteQueueItem(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.QUEUE, "readwrite");
    const store = tx.objectStore(STORES.QUEUE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearQueue(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.QUEUE, "readwrite");
    const store = tx.objectStore(STORES.QUEUE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ *
 * Operasi Siswa Lokal (students)
 * ------------------------------------------------------------------ */

export async function getAllStudents(): Promise<Student[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.STUDENTS, "readonly");
    const store = tx.objectStore(STORES.STUDENTS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveStudents(students: Student[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.STUDENTS, "readwrite");
    const store = tx.objectStore(STORES.STUDENTS);
    for (const student of students) {
      store.put(student);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function addStudent(student: Student): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.STUDENTS, "readwrite");
    const store = tx.objectStore(STORES.STUDENTS);
    const req = store.put(student);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ *
 * Operasi Konfigurasi Ujian Aktif (exams)
 * ------------------------------------------------------------------ */

export const ACTIVE_EXAM_ID = "active_exam_config";

export async function saveActiveExam(exam: ExamConfig): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EXAMS, "readwrite");
    const store = tx.objectStore(STORES.EXAMS);
    const req = store.put({ ...exam, id: ACTIVE_EXAM_ID });
    req.onsuccess = () => {
      // Simpan juga di localStorage sebagai backup sinkron langsung
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(ACTIVE_EXAM_ID, JSON.stringify(exam));
        } catch {
          // ignore localStorage error
        }
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getActiveExam(): Promise<ExamConfig | null> {
  if (typeof window === "undefined") return null;

  // Coba ambil cepat dari localStorage lebih dulu
  try {
    const cached = localStorage.getItem(ACTIVE_EXAM_ID);
    if (cached) {
      return JSON.parse(cached) as ExamConfig;
    }
  } catch {
    // fallback ke indexedDB
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EXAMS, "readonly");
    const store = tx.objectStore(STORES.EXAMS);
    const req = store.get(ACTIVE_EXAM_ID);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ *
 * Operasi Rekap Nilai (grades)
 * ------------------------------------------------------------------ */

export async function saveGradeRecord(record: GradedStudentRecord): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GRADES, "readwrite");
    const store = tx.objectStore(STORES.GRADES);
    // GradedStudentRecord uses `recordId` as its natural key but
    // the IndexedDB store was created with keyPath "id", so we map it.
    const doc = { ...record, id: record.recordId };
    const req = store.put(doc);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllGradeRecords(): Promise<GradedStudentRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GRADES, "readonly");
    const store = tx.objectStore(STORES.GRADES);
    const req = store.getAll();
    req.onsuccess = () => {
      const docs = (req.result || []) as (GradedStudentRecord & { id?: string })[];
      // Strip the extra `id` key we added for IndexedDB
      resolve(docs.map(({ id: _id, ...rest }) => rest as GradedStudentRecord));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getGradeRecordsByExam(examId: string): Promise<GradedStudentRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GRADES, "readonly");
    const store = tx.objectStore(STORES.GRADES);
    const index = store.index("by_examId");
    const req = index.getAll(examId);
    req.onsuccess = () => {
      const docs = (req.result || []) as (GradedStudentRecord & { id?: string })[];
      resolve(docs.map(({ id: _id, ...rest }) => rest as GradedStudentRecord));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteGradeRecord(recordId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GRADES, "readwrite");
    const store = tx.objectStore(STORES.GRADES);
    const req = store.delete(recordId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStudent(studentId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.STUDENTS, "readwrite");
    const store = tx.objectStore(STORES.STUDENTS);
    const req = store.delete(studentId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ *
 * Preferensi Mode Engine OMR (CLIENT_WASM vs SERVER_API)
 * ------------------------------------------------------------------ */

export const ENGINE_SETTINGS_KEY = "openomr_engine_settings";

export const DEFAULT_ENGINE_SETTINGS: OMREngineSettings = {
  mode: "CLIENT_WASM",
  serverUrl: "http://localhost:8000",
};

export function getEngineSettings(): OMREngineSettings {
  if (typeof window === "undefined") return DEFAULT_ENGINE_SETTINGS;
  try {
    const raw = localStorage.getItem(ENGINE_SETTINGS_KEY);
    if (!raw) return DEFAULT_ENGINE_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === "SERVER_API" ? "SERVER_API" : "CLIENT_WASM",
      serverUrl:
        typeof parsed.serverUrl === "string" && parsed.serverUrl.trim()
          ? parsed.serverUrl.trim().replace(/\/+$/, "")
          : "http://localhost:8000",
      apiKey: typeof parsed.apiKey === "string" && parsed.apiKey.trim() ? parsed.apiKey.trim() : undefined,
    };
  } catch {
    return DEFAULT_ENGINE_SETTINGS;
  }
}

export function saveEngineSettings(settings: OMREngineSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ENGINE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore localStorage error
  }
}


