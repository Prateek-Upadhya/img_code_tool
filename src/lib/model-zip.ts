"use client";

/**
 * Zip export for AI models. One model → a zip with up to three images
 * (full body, face close-up, back of head); several models → one zip with a
 * sub-folder per model. Follows the dynamic-import JSZip pattern used by the
 * swatch/VTON bulk downloads.
 */

/** The three exportable images of one model. Missing views are skipped. */
export interface ModelZipEntry {
  name: string;
  /** Full-body image as a data URL. */
  imageData: string;
  faceCloseUp?: string;
  backHead?: string;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function safeName(name: string, fallback: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-");
  return cleaned || fallback;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Zippable = { file(name: string, data: Blob): void };

function addModelFiles(target: Zippable, entry: ModelZipEntry) {
  target.file("full-body.png", dataUrlToBlob(entry.imageData));
  if (entry.faceCloseUp) target.file("face-closeup.png", dataUrlToBlob(entry.faceCloseUp));
  if (entry.backHead) target.file("back-of-head.png", dataUrlToBlob(entry.backHead));
}

/** Download one model as `<name>.zip` with its (up to) three images. */
export async function downloadModelZip(entry: ModelZipEntry): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  addModelFiles(zip, entry);
  const content = await zip.generateAsync({ type: "blob" });
  triggerDownload(content, `${safeName(entry.name, "model")}.zip`);
}

/**
 * Download several models as one zip with a sub-folder per model, each holding
 * that model's (up to) three images. Duplicate names get a numeric suffix.
 */
export async function downloadModelsZip(
  entries: ModelZipEntry[],
  zipName = "models.zip"
): Promise<void> {
  if (entries.length === 0) return;
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();
  entries.forEach((entry, i) => {
    const base = safeName(entry.name, `model-${i + 1}`);
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) candidate = `${base}-${n++}`;
    used.add(candidate);
    const folder = zip.folder(candidate);
    if (folder) addModelFiles(folder, entry);
  });
  const content = await zip.generateAsync({ type: "blob" });
  triggerDownload(content, zipName);
}
