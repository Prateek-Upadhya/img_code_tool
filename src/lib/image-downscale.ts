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
 * shrinking requests to a few MB. Quality is unaffected: Gemini/Vertex internally
 * downsample image inputs to ~1568px, so 2048px discards only bytes the model never
 * uses. Images are only ever shrunk (never upscaled), re-encoded in their original
 * mime type (so PNG transparency survives), and anything that can't be processed is
 * passed through unchanged — a generation never fails because of downscaling.
 */

/** Longest-edge ceiling in pixels. Above the model's ~1568px effective input. */
const MAX_EDGE = 2048;
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
 * Downscale `file` to <= {@link MAX_EDGE}px on its longest edge and return raw
 * base64, preserving the original mime type. Passes the original through unchanged
 * when it's already small / within the cap / not a re-encodable raster, and falls
 * back to the original bytes on any decode or encode error.
 */
export async function downscaleImageToBase64(file: File): Promise<string> {
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
    if (longestEdge <= MAX_EDGE) {
      bitmap.close();
      return blobToBase64(file); // within cap — no recompression
    }

    const scale = MAX_EDGE / longestEdge;
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
