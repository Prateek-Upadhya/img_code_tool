import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";

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
export interface GeminiClient {
  models: {
    generateContent(
      params: GenerateContentParameters,
    ): Promise<GenerateContentResponse>;
  };
}

async function generateContent(
  params: GenerateContentParameters,
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

  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...rest, config: wireConfig }),
    signal: abortSignal,
  });

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
