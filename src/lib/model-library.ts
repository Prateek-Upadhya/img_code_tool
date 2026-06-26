"use client";

import type { SavedModel } from "./types";

/**
 * IndexedDB-backed persistence for the AI Model Creation "Model Library".
 *
 * The app has no server database — generated images already live in memory as
 * base64 data URLs — so created models are persisted client-side in IndexedDB,
 * keyed by id. This lets a designer reuse a model across sessions and feed it
 * into Virtual Try-On.
 */

const DB_NAME = "catalogus-model-library";
const STORE = "models";
const VERSION = 1;

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

/** All saved models, newest first. Returns [] when IndexedDB is unavailable. */
export async function loadSavedModels(): Promise<SavedModel[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as SavedModel[]).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

/** Insert or update one model. */
export async function saveModel(model: SavedModel): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(model);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove one model by id. */
export async function deleteSavedModel(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
