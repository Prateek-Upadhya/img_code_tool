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
export async function POST(request: NextRequest) {
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

    const backend: GoogleBackend =
      request.headers.get("x-google-backend") === "gemini" ? "gemini" : "vertex";

    const ai = getGoogleClient(backend);

    // Forward the client's disconnect into the SDK call. Without this a browser
    // that gave up — Stop pressed, deadline blown, tab closed — left the upstream
    // Google call running to completion, and because the slot is only released in
    // the `finally` below, the gate stayed one slot smaller until it finished.
    // Under retry churn that shrinks the effective pool to well under
    // MAX_CONCURRENT and every later request queues behind ghosts.
    const response = await ai.models.generateContent({
      ...params,
      config: { ...params.config, abortSignal: request.signal },
    });

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
    console.error("Vertex generateContent error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (isGeminiImage) releaseGeminiImageSlot();
  }
}
