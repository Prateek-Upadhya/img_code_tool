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

    // Cap Gemini image generation at a global 4 concurrent in-flight across all
    // tabs (see src/lib/gemini-image-gate.ts). Acquire before the model call so
    // an abort-while-queued is handled cleanly; release in `finally` so the slot
    // is always returned. Non-image Gemini calls (text/prompt) are not gated.
    const isGeminiImage = params.model === "gemini-3.1-flash-image-preview";
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

    try {
      const ai = getGoogleClient(backend);
      const response = await ai.models.generateContent(params);

      // Own enumerable props (candidates, usageMetadata, promptFeedback, ...).
      const payload: Record<string, unknown> = JSON.parse(JSON.stringify(response));

      // Re-attach the convenience getters the client relies on.
      try { payload.text = response.text; } catch { /* non-text response */ }
      try { payload.data = response.data; } catch { /* no inline data */ }
      try { payload.functionCalls = response.functionCalls; } catch { /* none */ }

      return NextResponse.json(payload);
    } finally {
      if (isGeminiImage) releaseGeminiImageSlot();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Vertex generateContent error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
