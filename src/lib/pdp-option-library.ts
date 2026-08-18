"use client";

import type { PdpShotOption } from "./types";

/**
 * IndexedDB persistence for user authored PDP Set shot options.
 *
 * Presets cover the no typing path, but an operator occasionally needs a shot the catalog
 * does not have. Rather than making them re-describe it on every run, a custom option is
 * saved here and appears beside the presets in its heading from then on. Over time the
 * library becomes the house style.
 *
 * Mirrors `model-library.ts`, which is the app's only other durable client store.
 */

const DB_NAME = "catalogus-pdp-options";
const STORE = "options";
const VERSION = 1;

export interface StoredPdpOption extends PdpShotOption {
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const available = () => typeof indexedDB !== "undefined";

/** All saved custom options, oldest first so the picker order stays stable as more are added. */
export async function loadCustomPdpOptions(): Promise<StoredPdpOption[]> {
  if (!available()) return [];
  try {
    const db = await openDB();
    return await new Promise<StoredPdpOption[]>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () =>
        resolve((req.result as StoredPdpOption[]).sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveCustomPdpOption(option: PdpShotOption): Promise<boolean> {
  if (!available()) return false;
  try {
    const db = await openDB();
    const record: StoredPdpOption = { ...option, isCustom: true, createdAt: Date.now() };
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

export async function deleteCustomPdpOption(id: string): Promise<void> {
  if (!available()) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* best effort */
  }
}
