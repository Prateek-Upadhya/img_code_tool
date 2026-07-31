"use client";

/**
 * Client-side source-image downscaler.
 *
 * Every source image (garment / model / complementary / accessory / prop /
 * inspiration) is base64-encoded and packed inline into the Gemini
 * `generateContent` requests that get POSTed to `/api/gemini/generate`. At full
 * resolution a single request reached 100+ MB, which nginx (`client_max_body_size`)
 * rejected mid-upload — the browser saw `ERR_CONNECTION_RESET` with a 0-byte body.
 *
 * This caps each image at {@link MAX_EDGE}px on its longest side before encoding,
 * shrinking requests to a few MB. Images are only ever shrunk (never upscaled),
 * re-encoded in their original mime type (so PNG transparency survives), and anything
 * that can't be processed is passed through unchanged — a generation never fails
 * because of downscaling.
 *
 * ── On the cap and why there are now two of them ──────────────────────────────
 * This header previously justified the 2048 cap by claiming Gemini/Vertex internally
 * downsample image inputs to ~1568px, so that anything above 2048 was bytes "the model
 * never uses". That is not how Gemini works — ~1568px is Anthropic Claude's image
 * scaling rule. Gemini tiles any image larger than 384px into 768x768 tiles costing
 * 258 tokens each, so additional input resolution IS carried through to the model
 * rather than discarded. See https://ai.google.dev/gemini-api/docs/tokens.
 *
 * The practical consequence: for a product whose identity lives in fine detail — a
 * jacquard-woven waistband wordmark, a rib-knit face — a 2048px cap plus a lossy
 * re-encode destroys precisely the information the identity-lock prompts then ask the
 * model to reproduce. No amount of prompt text recovers detail that never entered the
 * request.
 *
 * So the cap is now per-purpose:
 *   - {@link MAX_EDGE} (2048) — default. Model, background, composition, accessory and
 *     prop references, where fine detail is not what the reference is carrying.
 *   - {@link MAX_EDGE_HIRES} (3072) — product/garment references only, via
 *     {@link fileToBase64HiResCached}. Deliberately NOT higher: the 2048 cap was
 *     introduced to stop multi-image requests blowing past nginx `client_max_body_size`,
 *     and that constraint is still real. Raise this only alongside a measured check of
 *     request size and the deployed nginx limit.
 */

/** Longest-edge ceiling in pixels for general-purpose references. */
const MAX_EDGE = 2048;
/**
 * Longest-edge ceiling for product/garment references, whose fine detail (logos,
 * weave, stitching) is the thing being reproduced. See the header note on payload size
 * before raising this.
 */
const MAX_EDGE_HIRES = 3072;
/** JPEG/WebP re-encode quality (ignored by PNG, which stays lossless). */
const QUALITY = 0.9;
/** Below this byte size an image is already small enough — send it untouched. */
const SKIP_BELOW_BYTES = 1_000_000;
/** Mime types we can safely decode + re-encode via canvas. */
const ENCODABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Read a Blob/File as raw base64 (data-URL prefix stripped). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Promisified `canvas.toBlob`. */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscale `file` to <= `maxEdge`px on its longest edge and return raw base64,
 * preserving the original mime type. Passes the original through unchanged when it's
 * already small / within the cap / not a re-encodable raster, and falls back to the
 * original bytes on any decode or encode error.
 *
 * @param maxEdge Longest-edge ceiling. Defaults to {@link MAX_EDGE}; product/garment
 *   references pass {@link MAX_EDGE_HIRES} via {@link fileToBase64HiResCached}.
 */
export async function downscaleImageToBase64(
  file: File,
  maxEdge: number = MAX_EDGE,
): Promise<string> {
  // Fast path: already small, or a format we don't re-encode → original bytes.
  if (file.size < SKIP_BELOW_BYTES || !ENCODABLE.has(file.type)) {
    return blobToBase64(file);
  }

  try {
    // `imageOrientation: "from-image"` bakes EXIF rotation so downscaled phone
    // photos stay upright once flattened to canvas.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    const longestEdge = Math.max(bitmap.width, bitmap.height);
    if (longestEdge <= maxEdge) {
      bitmap.close();
      return blobToBase64(file); // within cap — no recompression
    }

    const scale = maxEdge / longestEdge;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blobToBase64(file);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvasToBlob(canvas, file.type, QUALITY);
    if (!blob) return blobToBase64(file);
    return blobToBase64(blob);
  } catch {
    // Decode/encode failure → send the original so the generation still succeeds.
    return blobToBase64(file);
  }
}

/**
 * Memoized {@link downscaleImageToBase64}. The same `File` is reused across the
 * prompt-generation request, the image-generation request, and every pose in a
 * batch — this ensures each source image is downscaled + encoded only once. Keyed
 * on `File` identity via a `WeakMap`, so entries are GC'd when the store drops the
 * file. Failed encodes are not cached (so a transient error can be retried).
 */
const cache = new WeakMap<File, Promise<string>>();

export function fileToBase64Cached(file: File): Promise<string> {
  let pending = cache.get(file);
  if (!pending) {
    pending = downscaleImageToBase64(file);
    cache.set(file, pending);
    pending.catch(() => cache.delete(file));
  }
  return pending;
}

/**
 * {@link fileToBase64Cached} at {@link MAX_EDGE_HIRES}, for product/garment references.
 *
 * Deliberately a SEPARATE `WeakMap`: the same `File` is legitimately encoded at both
 * resolutions within one run (a garment image is a hi-res product reference, but the
 * very same file can also be handed to a path that wants the standard cap). Sharing
 * one map keyed on `File` would hand back whichever resolution happened to be
 * requested first.
 */
const hiResCache = new WeakMap<File, Promise<string>>();

export function fileToBase64HiResCached(file: File): Promise<string> {
  let pending = hiResCache.get(file);
  if (!pending) {
    pending = downscaleImageToBase64(file, MAX_EDGE_HIRES);
    hiResCache.set(file, pending);
    pending.catch(() => hiResCache.delete(file));
  }
  return pending;
}
