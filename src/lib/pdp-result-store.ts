"use client";

/**
 * IndexedDB persistence for PDP Set generated images.
 *
 * A single run is much larger than anything the other modes produce: twenty products at
 * eleven options each is over two hundred images, and at 2K every one of those is several
 * megabytes as a base64 data URL. Holding them all in React state would both blow the
 * tab's memory and lose the entire run on a refresh, since nothing else in this app
 * persists.
 *
 * So the full image is written here the moment it completes, and React state keeps only a
 * small thumbnail plus the storage key. Full images are read back on demand: when a card
 * is opened, and when the ZIP is assembled.
 *
 * Records are grouped by `runId` so a new batch can clear the previous one without
 * disturbing anything else, and so a refresh can restore the run that was in flight.
 */

const DB_NAME = "catalogus-pdp-results";
const STORE = "results";
const VERSION = 1;

export interface PdpStoredImage {
  /** Matches PdpResult.id. */
  id: string;
  runId: string;
  sku: string;
  optionId: string;
  optionLabel: string;
  /** Full composited image as a data URL. */
  imageData: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("runId", "runId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const available = () => typeof indexedDB !== "undefined";

/**
 * Persist one finished image.
 *
 * Failures are swallowed deliberately. Storage quota is finite and a large run can hit
 * it; losing durability on the tail of a batch is bad, but failing the generation that
 * already succeeded and cost money would be worse. The caller keeps the thumbnail either
 * way, and `readPdpImage` returning null is handled at every call site.
 */
export async function savePdpImage(record: PdpStoredImage): Promise<boolean> {
  if (!available()) return false;
  try {
    const db = await openDB();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Full image for one result, or null when absent or unreadable. */
export async function readPdpImage(id: string): Promise<string | null> {
  if (!available()) return null;
  try {
    const db = await openDB();
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as PdpStoredImage | undefined)?.imageData ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Every stored image for one run, in completion order. */
export async function readPdpRun(runId: string): Promise<PdpStoredImage[]> {
  if (!available()) return [];
  try {
    const db = await openDB();
    return await new Promise<PdpStoredImage[]>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).index("runId").getAll(runId);
      req.onsuccess = () =>
        resolve((req.result as PdpStoredImage[]).sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Drop every image belonging to a run. Called when a new batch starts. */
export async function clearPdpRun(runId: string): Promise<void> {
  if (!available()) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.index("runId").getAllKeys(runId);
      req.onsuccess = () => {
        for (const key of req.result) store.delete(key);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* durability is best effort */
  }
}

/** Run ids currently held, newest first. Used to offer recovery after a reload. */
export async function listPdpRuns(): Promise<{ runId: string; count: number; createdAt: number }[]> {
  if (!available()) return [];
  try {
    const db = await openDB();
    const all = await new Promise<PdpStoredImage[]>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as PdpStoredImage[]);
      req.onerror = () => resolve([]);
    });
    const byRun = new Map<string, { runId: string; count: number; createdAt: number }>();
    for (const rec of all) {
      const entry = byRun.get(rec.runId);
      if (entry) {
        entry.count += 1;
        entry.createdAt = Math.max(entry.createdAt, rec.createdAt);
      } else {
        byRun.set(rec.runId, { runId: rec.runId, count: 1, createdAt: rec.createdAt });
      }
    }
    return [...byRun.values()].sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}
