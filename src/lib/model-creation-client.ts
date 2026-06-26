"use client";

import type { AspectRatio } from "./types";

/**
 * Client helpers for the AI Model Creation feature.
 */

/** Aspect ratios the image backends accept (mirrors the AspectRatio union). */
const SUPPORTED_ASPECT_RATIOS: { ratio: AspectRatio; value: number }[] = [
  { ratio: "1:1", value: 1 / 1 },
  { ratio: "2:3", value: 2 / 3 },
  { ratio: "3:2", value: 3 / 2 },
  { ratio: "3:4", value: 3 / 4 },
  { ratio: "4:3", value: 4 / 3 },
  { ratio: "4:5", value: 4 / 5 },
  { ratio: "5:4", value: 5 / 4 },
  { ratio: "9:16", value: 9 / 16 },
  { ratio: "16:9", value: 16 / 9 },
];

/**
 * Reads an uploaded image and returns the supported AspectRatio whose ratio is
 * closest to the image's true width/height — so an edited output can be rendered
 * at (effectively) the source image's framing. Falls back to "3:4".
 */
export function imageAspectRatio(file: File): Promise<AspectRatio> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = img.naturalWidth / img.naturalHeight;
      URL.revokeObjectURL(url);
      let best = SUPPORTED_ASPECT_RATIOS[0];
      let bestDiff = Infinity;
      for (const cand of SUPPORTED_ASPECT_RATIOS) {
        const diff = Math.abs(cand.value - r);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = cand;
        }
      }
      resolve(best.ratio);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("3:4");
    };
    img.src = url;
  });
}

/** Look up a brand's visual direction via the server (web-grounded). */
export async function researchBrand(brandName: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch("/api/brand-research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandName }),
    signal,
  });
  if (!res.ok) {
    let msg = `Brand research failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  const json = (await res.json()) as { directives: string };
  return json.directives;
}

/** Convert a base64 data URL into a File (used to feed a saved model into VTON). */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}
