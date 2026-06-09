import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";
import { getGeminiClient, type GeminiClient } from "./gemini-client";
import type { TextGenModel } from "./types";

/**
 * Provider-agnostic text (prompt-generation / analysis) client.
 *
 * Returns the SAME `{ models: { generateContent } }` interface as
 * `gemini-client.ts`, so every call site in `gemini.ts` that reads
 * `response.text` and `response.usageMetadata` works unchanged regardless of
 * which provider is selected.
 *
 * - `gemini`: delegates straight to the existing Vertex AI proxy client.
 * - `gpt-5.4-pro`: POSTs the request to `/api/azure-text/generate`, which runs
 *   it against Azure OpenAI (Responses API) with server-held credentials, and
 *   adapts the `{ text, usageMetadata }` route payload back into the
 *   `GenerateContentResponse` shape the callers expect.
 */

interface AzureTextRouteResponse {
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: string;
}

async function generateContentAzure(
  params: GenerateContentParameters,
): Promise<GenerateContentResponse> {
  // `abortSignal` lives inside `config` but can't be serialized — pull it out and
  // apply it to the fetch instead so cancellation still works (mirrors gemini-client).
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

  const response = await fetch("/api/azure-text/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...rest, config: wireConfig }),
    signal: abortSignal,
  });

  if (!response.ok) {
    let message = `Azure text request failed (${response.status})`;
    try {
      const err = (await response.json()) as AzureTextRouteResponse;
      if (err?.error) message = err.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const json = (await response.json()) as AzureTextRouteResponse;
  const text = json.text ?? "";

  // Adapt the route payload into the slice of `GenerateContentResponse` the
  // callers read: `.text` (getter on the SDK type) and `.usageMetadata`.
  const adapted = {
    text,
    usageMetadata: {
      promptTokenCount: json.usageMetadata?.promptTokenCount ?? 0,
      candidatesTokenCount: json.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
  return adapted as unknown as GenerateContentResponse;
}

const azureClient: GeminiClient = {
  models: { generateContent: generateContentAzure },
};

/**
 * Returns a text-generation client for the selected provider. The shape matches
 * `getGeminiClient()` exactly so it is a drop-in replacement at call sites.
 */
export function getTextClient(provider: TextGenModel = "gemini"): GeminiClient {
  if (provider === "gpt-5.4-pro") return azureClient;
  return getGeminiClient();
}
