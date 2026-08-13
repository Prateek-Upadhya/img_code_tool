import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";
import type { GoogleBackend } from "./vertex-server";
import { VTON_TIMEOUT_MS, rethrowWithDeadlineContext, withDeadline } from "./request-deadline";

/**
 * Module-level Google backend selection (Vertex AI vs Gemini Developer API).
 * Defaults to "vertex" (the prior behavior). Set from the first-page toggle via
 * {@link setGoogleBackend} and read on every proxied request, so every call site
 * in `gemini.ts` stays unchanged — the choice rides an HTTP header, not the
 * serialized SDK `params`. The server route (/api/gemini/generate) reads the
 * header and picks the matching server client; no credential is sent here.
 */
let googleBackend: GoogleBackend = "vertex";

export function setGoogleBackend(backend: GoogleBackend): void {
  googleBackend = backend;
}

/**
 * Browser-side drop-in for the small slice of the `@google/genai` client that
 * `gemini.ts` uses (`ai.models.generateContent`). Instead of talking to Google
 * directly with a client-held API key, it POSTs the request to our own
 * `/api/gemini/generate` route, which runs it against Vertex AI using
 * server-only credentials.
 *
 * This keeps every call site in `gemini.ts` unchanged — `getGeminiClient()`
 * returns the same `{ models: { generateContent } }` shape and the same
 * `GenerateContentResponse` type.
 */
/**
 * Per-call overrides that are OURS, not the SDK's. Kept as a second argument
 * rather than a field on `config` because `GenerateContentConfig` is Google's
 * type — smuggling an extra key through it would need a cast at every call site
 * and would risk the field reaching the wire.
 */
export interface GenerateContentOptions {
  /**
   * Wall-clock budget for this call. Defaults to a value chosen from the model
   * name (see {@link VTON_TIMEOUT_MS}); pass it explicitly where the call type is
   * known more precisely than the model implies — e.g. the judge, which uses the
   * same Pro model as prompt generation but should give up sooner.
   */
  timeoutMs?: number;
}

export interface GeminiClient {
  models: {
    generateContent(
      params: GenerateContentParameters,
      options?: GenerateContentOptions,
    ): Promise<GenerateContentResponse>;
  };
}

async function generateContent(
  params: GenerateContentParameters,
  options?: GenerateContentOptions,
): Promise<GenerateContentResponse> {
  // `abortSignal` lives inside `config` but can't be serialized — pull it out and
  // apply it to the fetch instead so cancellation still works.
  const { config, ...rest } = params;
  let abortSignal: AbortSignal | undefined;
  let wireConfig = config;

  if (config && "abortSignal" in config) {
    const { abortSignal: signal, ...restConfig } = config as typeof config & {
      abortSignal?: AbortSignal;
    };
    abortSignal = signal;
    wireConfig = restConfig;
  }

  // Advertise image calls in a header so the route can take its concurrency slot
  // BEFORE parsing the multi-MB body — a queued request then costs almost no
  // heap. The route trusts this only to decide gating, never to pick a model.
  const isImageCall = rest.model === "gemini-3.1-flash-image";

  // Every call gets a deadline. Without one, a wedged upstream request never
  // settles, so the card's status — written BEFORE this call and cleared only by
  // an explicit later write — stays on "Generating prompt…" / "Generating image…"
  // indefinitely, and an image call holds its `gemini-image-gate` slot for the
  // life of the process. See src/lib/request-deadline.ts.
  const budgetMs =
    options?.timeoutMs ?? (isImageCall ? VTON_TIMEOUT_MS.image : VTON_TIMEOUT_MS.prompt);

  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-google-backend": googleBackend,
      ...(isImageCall ? { "x-gemini-image": "1" } : {}),
    },
    body: JSON.stringify({ ...rest, config: wireConfig }),
    signal: withDeadline(abortSignal, budgetMs),
  }).catch((error: unknown) =>
    // Name the blown budget so the error card reads "timed out after 240s"
    // instead of a bare "signal is aborted". A user cancellation still carries an
    // AbortError and is rethrown untouched, so the existing `signal.aborted`
    // checks in step-generate.tsx keep classifying it as "Cancelled by user".
    rethrowWithDeadlineContext(
      error,
      isImageCall ? "Image generation" : "Prompt generation",
      budgetMs,
    ),
  );

  if (!response.ok) {
    let message = `Gemini request failed (${response.status})`;
    try {
      const err = await response.json();
      if (err?.error) message = err.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  return (await response.json()) as GenerateContentResponse;
}

/**
 * Returns the proxy client. The optional `apiKey` argument is accepted for
 * backwards-compatibility with existing call sites but is ignored — Vertex AI
 * credentials live exclusively on the server and are never sent from the browser.
 */
export function getGeminiClient(_apiKey?: string): GeminiClient {
  return { models: { generateContent } };
}
