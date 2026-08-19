"use client";

import JSZip from "jszip";

/**
 * Generic grouped ZIP export.
 *
 * The app currently open codes `await import("jszip")` in more than ten places, each
 * re-implementing the dynamic import, folder creation, blob conversion, anchor click and
 * object URL revocation, and each choosing its own filename convention. This module is
 * the shared version, written for the PDP Set delivery shape: one archive, one folder per
 * SKU, files numbered in catalog order.
 *
 * Entries carry base64 data URLs and are written with jszip's `base64` option, which
 * avoids a fetch and blob round trip per image. That matters here: a run can hold several
 * hundred images and the round trip version stalls the tab noticeably.
 *
 * jszip is imported STATICALLY, deliberately. The rest of the app reaches for
 * `await import("jszip")`, which fetches a separate chunk at the moment the operator
 * clicks. `next build` re-hashes every chunk, so a tab that was open across a redeploy
 * asks for a filename the server no longer has and the click dies with a ChunkLoadError
 * and no visible symptom. A static import puts jszip in the chunk graph the page already
 * loaded, so a page that rendered at all can always finish a download. The cost is around
 * 30KB gzipped on one internal route, which is the right trade for the button that
 * actually delivers the work.
 */

export interface ZipEntry {
  /** File name inside the folder, without extension. */
  name: string;
  /** Image as a data URL. */
  dataUrl: string;
}

export interface ZipGroup {
  /** Folder name inside the archive. */
  folder: string;
  entries: ZipEntry[];
}

/** Characters illegal in ZIP entries and on Windows filesystems. */
const ILLEGAL = /[<>:"/\\|?*\x00-\x1f]+/g;

export function safeName(raw: string): string {
  const cleaned = (raw ?? "").replace(ILLEGAL, "_").trim().replace(/\.+$/, "");
  return cleaned || "untitled";
}

/** Split a data URL into its base64 payload and file extension. */
function splitDataUrl(dataUrl: string): { base64: string; ext: string } | null {
  const match = /^data:image\/([a-z0-9.+-]+);base64,(.*)$/i.exec(dataUrl);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  const ext = raw === "jpeg" ? "jpg" : raw === "svg+xml" ? "svg" : raw;
  return { base64: match[2], ext };
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next frame; revoking synchronously can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Build and download a grouped archive.
 *
 * Duplicate names inside one folder are suffixed rather than silently overwritten, which
 * is what jszip would otherwise do. Entries whose data URL cannot be parsed are skipped
 * and counted, so a partial run still delivers everything that did work.
 *
 * Returns the number of files written and the number skipped.
 */
export async function downloadGroupedZip(
  groups: ZipGroup[],
  zipName: string
): Promise<{ written: number; skipped: number }> {
  const zip = new JSZip();
  let written = 0;
  let skipped = 0;

  const usedFolders = new Set<string>();

  for (const group of groups) {
    if (group.entries.length === 0) continue;

    let folderName = safeName(group.folder);
    let n = 2;
    while (usedFolders.has(folderName.toLowerCase())) folderName = `${safeName(group.folder)}-${n++}`;
    usedFolders.add(folderName.toLowerCase());

    const folder = zip.folder(folderName);
    if (!folder) continue;

    const usedFiles = new Set<string>();
    for (const entry of group.entries) {
      const parts = splitDataUrl(entry.dataUrl);
      if (!parts) {
        skipped += 1;
        continue;
      }
      let base = safeName(entry.name);
      let k = 2;
      while (usedFiles.has(`${base}.${parts.ext}`.toLowerCase())) base = `${safeName(entry.name)}-${k++}`;
      const fileName = `${base}.${parts.ext}`;
      usedFiles.add(fileName.toLowerCase());

      folder.file(fileName, parts.base64, { base64: true });
      written += 1;
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, zipName.endsWith(".zip") ? zipName : `${zipName}.zip`);
  return { written, skipped };
}

/** Download a single image without zipping it. */
export function downloadImage(dataUrl: string, fileName: string): void {
  const parts = splitDataUrl(dataUrl);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = parts ? `${safeName(fileName)}.${parts.ext}` : safeName(fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
