import { NextRequest, NextResponse } from "next/server";
import type { GenerateContentParameters } from "@google/genai";
import { getGoogleClient, type GoogleBackend } from "@/lib/vertex-server";
import {
  acquireGeminiImageSlot,
  releaseGeminiImageSlot,
} from "@/lib/gemini-image-gate";

// Image generation (Nano Banana) can take a while; allow a generous budget.
export const maxDuration = 300;

/**
 * Server-side proxy for `ai.models.generateContent`.
 *
 * The browser builds the request (model + contents + config) exactly as before
 * and POSTs it here; this handler runs it against the Google backend selected by
 * the `x-google-backend` header (Vertex AI by default, or the Gemini Developer
 * API) using server-held credentials, and returns the response as plain JSON.
 *
 * Note: `GenerateContentResponse` exposes `.text`, `.data` and `.functionCalls`
 * as prototype getters, which are dropped by JSON serialization. We materialize
 * them onto the payload so the client shim sees the same shape the SDK gave.
 */
/** What we can say about a request without ever logging its base64 bodies. */
interface RequestShape {
  model: string;
  parts: number;
  images: number;
  /** Approximate outbound size in MB, counting base64 payloads. */
  approxMb: number;
  /** Byte length of the largest single inline part, base64. */
  largestPartMb: number;
  mimeTypes: string[];
  /** Inline parts carrying no data at all — a documented cause of INVALID_ARGUMENT. */
  emptyParts: number;
}

type InlinePart = { inlineData?: { mimeType?: string; data?: string }; text?: string };

/**
 * Summarise the outbound request for the error log.
 *
 * Never throws and never returns the payload itself: this runs on a failure path, where a
 * second exception would bury the original, and where dumping base64 would be useless
 * noise.
 */
function summariseRequest(params: unknown): RequestShape | null {
  try {
    const p = params as { model?: string; contents?: unknown };
    const raw = Array.isArray(p?.contents) ? (p.contents as unknown[]) : [];
    // `contents` is either a flat Part[] or [{ role, parts }]; flatten both.
    const parts: InlinePart[] = raw.flatMap((entry) => {
      const e = entry as { parts?: unknown };
      return Array.isArray(e?.parts) ? (e.parts as InlinePart[]) : [entry as InlinePart];
    });

    let bytes = 0;
    let largest = 0;
    let images = 0;
    let emptyParts = 0;
    const mimeTypes = new Set<string>();

    for (const part of parts) {
      if (part?.text) bytes += part.text.length;
      const inline = part?.inlineData;
      if (!inline) continue;
      images += 1;
      mimeTypes.add(inline.mimeType || "(missing)");
      const len = inline.data?.length ?? 0;
      if (len === 0) emptyParts += 1;
      bytes += len;
      if (len > largest) largest = len;
    }

    const mb = (n: number) => Math.round((n / 1_048_576) * 100) / 100;
    return {
      model: p?.model ?? "(unknown)",
      parts: parts.length,
      images,
      approxMb: mb(bytes),
      largestPartMb: mb(largest),
      mimeTypes: [...mimeTypes],
      emptyParts,
    };
  } catch {
    return null;
  }
}

function describeFailedRequest(shape: RequestShape | null, durationMs: number): string {
  if (!shape) return `(request shape unavailable, ${durationMs}ms)`;
  return (
    `model=${shape.model} parts=${shape.parts} images=${shape.images} ` +
    `approx=${shape.approxMb}MB largestPart=${shape.largestPartMb}MB ` +
    `mimes=[${shape.mimeTypes.join(", ")}] emptyParts=${shape.emptyParts} ` +
    `duration=${durationMs}ms`
  );
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let shape: RequestShape | null = null;
  // Gate BEFORE parsing the body. `request.json()` on an image request
  // materializes a multi-MB base64 payload, and a queued request would otherwise
  // hold that in the heap for its entire wait — making queue depth cost as much
  // memory as active work. Deciding from the header keeps a waiting request cheap.
  const isGeminiImage = request.headers.get("x-gemini-image") === "1";
  if (isGeminiImage) {
    try {
      await acquireGeminiImageSlot(request.signal);
    } catch {
      return NextResponse.json(
        { error: "request aborted while queued" },
        { status: 499 },
      );
    }
  }

  // One try/finally around EVERYTHING after the acquire. The release used to sit
  // in an inner block, which is safe only while the acquire happens after the
  // body parse; now that the gate comes first, an early 400 or a malformed-JSON
  // throw would leak a slot permanently and shrink the pool for the process's life.
  try {
    const params = (await request.json()) as GenerateContentParameters;

    if (!params?.model || !params?.contents) {
      return NextResponse.json(
        { error: "`model` and `contents` are required" },
        { status: 400 },
      );
    }

    shape = summariseRequest(params);

    const backend: GoogleBackend =
      request.headers.get("x-google-backend") === "gemini" ? "gemini" : "vertex";

    const ai = getGoogleClient(backend);
    const response = await ai.models.generateContent(params);

    // Shallow-copy own enumerable props (candidates, usageMetadata,
    // promptFeedback, ...). Avoids the JSON.stringify -> JSON.parse deep clone
    // of the multi-MB base64 image, which — even at 4 concurrent 2K/4K requests
    // in the single pm2 Node heap — spiked memory into OOM territory (connection
    // resets). NextResponse.json serializes this once on the way out.
    const payload: Record<string, unknown> = { ...response };

    // Re-attach the convenience getters the client relies on. `.text` and
    // `.functionCalls` are prototype getters dropped by serialization, so
    // materialize them. Deliberately NOT re-attaching `.data`: it duplicates the
    // base64 already carried under candidates[].content.parts[].inlineData.data,
    // and no client code reads the top-level `.data` field.
    try { payload.text = response.text; } catch { /* non-text response */ }
    try { payload.functionCalls = response.functionCalls; } catch { /* none */ }

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Describe the request that failed, not just the failure. A bare INVALID_ARGUMENT
    // carries no field names, so without this the only way to tell an oversized payload
    // from a malformed part from a provider-side refusal is to guess. Latency is included
    // because a preflight rejection returns far faster than a real generation, which is
    // the cheapest signal for telling "our request was bad" from "the service refused a
    // good one". Base64 bodies are measured, never logged.
    console.error("Vertex generateContent error:", message, describeFailedRequest(shape, Date.now() - startedAt));
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (isGeminiImage) releaseGeminiImageSlot();
  }
}
