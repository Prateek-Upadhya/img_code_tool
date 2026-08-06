"use client";

/**
 * Source-filename-preserving output naming for Model Swap.
 *
 * Model Swap is strictly 1:1 with its inputs — one swapped image per uploaded
 * image — and clients feed it a lot whose filenames already encode their own
 * ordering and SKU identity. The deliverable is therefore a folder that can be
 * dropped straight over the input on the client's system, which means each
 * output must carry the input's filename *including its extension*.
 *
 * That last part is the awkward one. The generator hands back PNG bytes
 * regardless of what went in, so an input `ABC_001.jpg` would become a PNG
 * wearing a `.jpg` name. Rather than relabel, {@link resolveSourceNamedOutput}
 * re-encodes the output into the source's own format, so `ABC_001.jpg` really is
 * a JPEG. Images that skipped generation (no human detected) pass through as the
 * original bytes and are handed back untouched.
 *
 * Every failure path degrades rather than throws: a format canvas cannot produce
 * (HEIC, AVIF, TIFF…), a decode error, a missing name — each falls back to a
 * still-usable name over the original bytes. A download must never fail because
 * of naming.
 */

import { canvasToBlob } from "./image-downscale";

/** Re-encode quality for lossy targets. Ignored by PNG, which stays lossless. */
const QUALITY = 0.95;

/**
 * Mime types `canvas.toBlob` can be relied on to produce. Anything outside this
 * set is passed through in the generator's own format under an honest extension
 * instead of being relabelled — see {@link resolveSourceNamedOutput}.
 */
const ENCODABLE_TARGETS = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Characters that are illegal in ZIP entries / on Windows filesystems. Matches the
 * set already used for folder names elsewhere in the app; spaces, hyphens and dots
 * are deliberately left alone so client filenames survive verbatim.
 */
const ILLEGAL_NAME_CHARS = /[<>:"/\\|?*]+/g;

/**
 * Extension → mime for the formats we can round-trip. Deliberately local and
 * narrow: `bulk-spreadsheet-import.ts` has a broader URL-oriented map for
 * *decoding* remote images, but this one gates *encoding*, so it must list only
 * what a canvas can actually emit.
 */
const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Split a filename into its base and extension. A name with no dot — or one
 * whose only dot leads the name (`.gitkeep`) — yields an empty extension, so
 * callers can fall back to the real output format.
 */
export function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot + 1) };
}

/** Mime type for an extension, or `null` when we cannot re-encode into it. */
export function mimeFromExtension(ext: string): string | null {
  return EXTENSION_MIME[ext.trim().toLowerCase()] ?? null;
}

/** Strip path separators and filesystem-illegal characters from a name. */
export function sanitizeFileName(name: string): string {
  return name.replace(ILLEGAL_NAME_CHARS, "_").trim() || "image";
}

/**
 * Return `name` if unused, else `base-2.ext`, `base-3.ext`, … until free. The
 * chosen name is recorded in `used`.
 *
 * `used` is scoped by the caller to whatever namespace a collision would
 * actually clobber — one set per flat ZIP, but one set *per folder* in bulk,
 * where two products legitimately both contain a `1.jpg` and neither should be
 * renamed.
 */
export function uniqueName(name: string, used: Set<string>): string {
  const key = name.toLowerCase();
  if (!used.has(key)) {
    used.add(key);
    return name;
  }
  const { base, ext } = splitFileName(name);
  const suffix = ext ? `.${ext}` : "";
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}${suffix}`;
    const candidateKey = candidate.toLowerCase();
    if (!used.has(candidateKey)) {
      used.add(candidateKey);
      return candidate;
    }
  }
}

/**
 * Re-encode `blob` into `targetMime`, or return it untouched when it already is
 * that format, when the target is not canvas-encodable, or when anything goes
 * wrong decoding or encoding.
 */
export async function encodeBlobAs(
  blob: Blob,
  targetMime: string,
  quality: number = QUALITY,
): Promise<Blob> {
  if (blob.type === targetMime) return blob;
  if (!ENCODABLE_TARGETS.has(targetMime)) return blob;

  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blob;
    }
    // JPEG carries no alpha channel. Compositing onto white first keeps any
    // transparent pixels from being flattened to black.
    if (targetMime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const out = await canvasToBlob(canvas, targetMime, quality);
    // A canvas that silently produced a different format (rather than null) would
    // reintroduce exactly the mislabelling this module exists to prevent.
    if (!out || out.type !== targetMime) return blob;
    return out;
  } catch {
    return blob;
  }
}

/**
 * Sanitized, extension-stripped base of a source filename — the stem derived assets
 * (infographics) hang off. Computed independently of any fetch so it stays available
 * even when the generated image itself could not be read.
 */
export function sourceBaseName(sourceImageName: string | undefined): string {
  return splitFileName(sanitizeFileName(sourceImageName?.trim() || "")).base;
}

/** Extension implied by a blob's own mime type, normalised (`jpeg` → `jpg`). */
export function extensionForBlob(blob: Blob): string {
  const subtype = (blob.type || "").split("/")[1]?.split(";")[0]?.trim().toLowerCase();
  if (!subtype) return "png";
  return subtype === "jpeg" ? "jpg" : subtype;
}

/**
 * Resolve the filename and bytes for one generated image, keyed off the source
 * image's original filename.
 *
 * Returns `null` when the image data cannot be fetched, so callers skip the entry
 * rather than writing a broken file. Derived assets (infographics) should name
 * themselves from {@link sourceBaseName} instead, which needs no fetch.
 */
export async function resolveSourceNamedOutput(
  imageData: string,
  sourceImageName: string | undefined,
  used: Set<string>,
): Promise<{ name: string; blob: Blob } | null> {
  let blob: Blob;
  try {
    blob = await (await fetch(imageData)).blob();
  } catch {
    return null;
  }

  const source = sanitizeFileName(sourceImageName?.trim() || "");
  const { base, ext } = splitFileName(source);
  const targetMime = ext ? mimeFromExtension(ext) : null;

  // No usable source name at all — fall back to the generator's own format.
  if (!sourceImageName?.trim()) {
    const name = uniqueName(`${base}.${extensionForBlob(blob)}`, used);
    return { name, blob };
  }

  // A format canvas cannot emit (HEIC, AVIF, TIFF…). Keep the source's basename
  // so ordering survives, but let the extension describe the actual bytes.
  if (!targetMime) {
    const name = uniqueName(`${base}.${extensionForBlob(blob)}`, used);
    return { name, blob };
  }

  const encoded = await encodeBlobAs(blob, targetMime);
  // Re-encoding may have failed and fallen back to the original bytes; only claim
  // the source extension when the bytes genuinely match it.
  const name =
    encoded.type === targetMime
      ? uniqueName(source, used)
      : uniqueName(`${base}.${extensionForBlob(encoded)}`, used);

  return { name, blob: encoded };
}
