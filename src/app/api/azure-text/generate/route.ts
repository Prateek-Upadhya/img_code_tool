import { NextRequest, NextResponse } from "next/server";
import { Agent } from "undici";

// Mirror the Gemini route's budget — prompt generation against the GPT-5 series
// can be slow, especially when reference images are attached.
export const maxDuration = 300;

// Node's built-in fetch (undici) gives up waiting for response headers after
// 300s by default — gpt-5.4-pro regularly takes longer than that on large
// VTON meta-prompts, which surfaced as "fetch failed" 500s at exactly ~5.1min.
// A dedicated dispatcher raises both timeouts to 10 minutes.
const azureDispatcher = new Agent({
  headersTimeout: 600_000,
  bodyTimeout: 600_000,
  connectTimeout: 30_000,
});

// Transient Azure statuses worth retrying (capacity / throttling / gateway).
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [2_000, 8_000];

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Server-side bridge from the Gemini `generateContent` request shape to the
 * Azure-hosted text providers. The browser (via `src/lib/text-client.ts`) POSTs
 * the same `{ model, contents, config }` slice it would send to
 * `/api/gemini/generate`, plus an `azureProvider` tag selecting which Azure
 * deployment to run. This handler translates that slice into the provider's
 * native request, runs it with server-held credentials, and returns a
 * `{ text, usageMetadata }` payload so existing `gemini.ts` call sites (which
 * read `response.text` and token usage) keep working unchanged.
 *
 * Three providers are supported, each with a different URL shape:
 *   - `gpt-5.4-pro`  → Azure OpenAI **Responses API** (`/openai/responses`).
 *   - `gpt-5.2`      → AI Foundry **Models inference** chat completions
 *                      (`/models/chat/completions`).
 *   - `gpt-5.4-mini` → Azure OpenAI **chat completions**
 *                      (`/openai/deployments/<dep>/chat/completions`).
 *
 * Credentials live exclusively on the server (the `AZURE_TEXT_*` env vars) and
 * are never sent to the browser.
 */

// --- Gemini-side request shapes (the slice gemini.ts actually sends) ---------

interface GeminiTextPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role?: string;
  parts: GeminiTextPart[];
}

interface GeminiConfig {
  systemInstruction?: string | { parts?: Array<{ text?: string }> };
  temperature?: number;
  maxOutputTokens?: number;
}

interface GeminiGenerateBody {
  model?: string;
  azureProvider?: string;
  contents?: GeminiContent | GeminiContent[] | GeminiTextPart[];
  config?: GeminiConfig;
}

type AzureRole = "system" | "user" | "assistant";

/** Provider-agnostic normalized message (system instruction + each content). */
interface NormalizedMessage {
  role: AzureRole;
  parts: GeminiTextPart[];
}

// --- Provider configuration --------------------------------------------------

type ProviderConfig =
  | { kind: "responses"; endpoint: string; apiKey: string; deployment: string }
  | {
      kind: "chat";
      urlStyle: "inference" | "azure-openai";
      endpoint: string;
      apiKey: string;
      apiVersion: string;
      deployment: string;
    };

/** Resolves the per-provider server-side config from env, keyed by `azureProvider`. */
function resolveProvider(name: string | undefined): { config?: ProviderConfig; error?: string } {
  if (name === "gpt-5.2") {
    const endpoint = process.env.AZURE_TEXT_GPT52_ENDPOINT;
    const apiKey = process.env.AZURE_TEXT_GPT52_KEY;
    const apiVersion = process.env.AZURE_TEXT_GPT52_APIVERSION;
    const deployment = process.env.AZURE_TEXT_GPT52_DEPLOYMENT;
    if (!endpoint || !apiKey || !apiVersion || !deployment) {
      return {
        error:
          "Azure gpt-5.2 provider is not configured. Set AZURE_TEXT_GPT52_ENDPOINT, AZURE_TEXT_GPT52_KEY, AZURE_TEXT_GPT52_APIVERSION and AZURE_TEXT_GPT52_DEPLOYMENT.",
      };
    }
    return { config: { kind: "chat", urlStyle: "inference", endpoint, apiKey, apiVersion, deployment } };
  }

  if (name === "gpt-5.4-mini") {
    const endpoint = process.env.AZURE_TEXT_GPT54MINI_ENDPOINT;
    const apiKey = process.env.AZURE_TEXT_GPT54MINI_KEY;
    const apiVersion = process.env.AZURE_TEXT_GPT54MINI_APIVERSION;
    const deployment = process.env.AZURE_TEXT_GPT54MINI_DEPLOYMENT;
    if (!endpoint || !apiKey || !apiVersion || !deployment) {
      return {
        error:
          "Azure gpt-5.4-mini provider is not configured. Set AZURE_TEXT_GPT54MINI_ENDPOINT, AZURE_TEXT_GPT54MINI_KEY, AZURE_TEXT_GPT54MINI_APIVERSION and AZURE_TEXT_GPT54MINI_DEPLOYMENT.",
      };
    }
    return { config: { kind: "chat", urlStyle: "azure-openai", endpoint, apiKey, apiVersion, deployment } };
  }

  // Default (and explicit `gpt-5.4-pro`): the original Responses-API deployment.
  const endpoint = process.env.AZURE_TEXT_ENDPOINT;
  const apiKey = process.env.AZURE_TEXT_KEY;
  const deployment = process.env.AZURE_TEXT_DEPLOYMENT;
  if (!endpoint || !apiKey || !deployment) {
    return {
      error:
        "Azure text provider is not configured. Set AZURE_TEXT_ENDPOINT, AZURE_TEXT_KEY and AZURE_TEXT_DEPLOYMENT.",
    };
  }
  return { config: { kind: "responses", endpoint, apiKey, deployment } };
}

/** Builds the chat-completions URL for the two chat url styles. */
function chatCompletionsUrl(config: Extract<ProviderConfig, { kind: "chat" }>): string {
  const base = config.endpoint.replace(/\/+$/, "");
  if (config.urlStyle === "inference") {
    // AI Foundry Models inference endpoint (e.g. `<resource>.services.ai.azure.com`).
    // Tolerate an endpoint that already includes the `/models` segment.
    const root = base.replace(/\/models$/, "");
    return `${root}/models/chat/completions?api-version=${config.apiVersion}`;
  }
  // Azure OpenAI deployment-scoped chat completions.
  return `${base}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;
}

// --- Azure response shapes ---------------------------------------------------

interface AzureResponsesResult {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; code?: string };
}

interface AzureChatResult {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string };
}

// --- Helpers ----------------------------------------------------------------

/** A bare `{text|inlineData}` part has no `parts` array of its own. */
function isBarePart(value: unknown): value is GeminiTextPart {
  if (typeof value !== "object" || value === null) return false;
  return ("text" in value || "inlineData" in value) && !("parts" in value);
}

/** Normalises Gemini `contents` (object | array of contents | bare parts) into a content list. */
function normaliseContents(
  contents: GeminiGenerateBody["contents"],
): GeminiContent[] {
  if (!contents) return [];
  // Single content object.
  if (!Array.isArray(contents)) return [contents as GeminiContent];
  // Array of bare parts → wrap as one user content.
  if (contents.length > 0 && isBarePart(contents[0])) {
    return [{ role: "user", parts: contents as GeminiTextPart[] }];
  }
  return contents as GeminiContent[];
}

/** Maps a Gemini role to an Azure-accepted role. */
function mapRole(role?: string): AzureRole {
  if (role === "system" || role === "assistant") return role;
  if (role === "model") return "assistant";
  return "user";
}

/** Builds the provider-agnostic message list: system instruction first, then contents. */
function buildMessages(body: GeminiGenerateBody): NormalizedMessage[] {
  const messages: NormalizedMessage[] = [];

  const sys = body.config?.systemInstruction;
  let sysText = "";
  if (typeof sys === "string") {
    sysText = sys;
  } else if (sys && Array.isArray(sys.parts)) {
    sysText = sys.parts.map((p) => p.text ?? "").join("");
  }
  if (sysText) {
    messages.push({ role: "system", parts: [{ text: sysText }] });
  }

  for (const content of normaliseContents(body.contents)) {
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    const usable = parts.filter((p) => typeof p.text === "string" || p.inlineData?.data);
    if (usable.length === 0) continue;
    messages.push({ role: mapRole(content.role), parts: usable });
  }

  return messages;
}

// --- Responses-API body / parsing -------------------------------------------

type ResponsesContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

function mapPartResponses(part: GeminiTextPart): ResponsesContentPart | null {
  if (typeof part.text === "string") return { type: "input_text", text: part.text };
  if (part.inlineData?.data) {
    const { mimeType, data } = part.inlineData;
    return { type: "input_image", image_url: `data:${mimeType};base64,${data}` };
  }
  return null;
}

function buildResponsesBody(
  messages: NormalizedMessage[],
  deployment: string,
  reasoningEffort: string,
  includeReasoning: boolean,
  maxOutputTokens?: number,
): string {
  const input = messages.map((m) => ({
    role: m.role,
    content: m.parts.map(mapPartResponses).filter((p): p is ResponsesContentPart => p !== null),
  }));
  const azureBody: Record<string, unknown> = { model: deployment, input };
  if (includeReasoning && reasoningEffort !== "omit") {
    azureBody.reasoning = { effort: reasoningEffort };
  }
  // `temperature` is intentionally NOT forwarded — reasoning models reject it.
  if (typeof maxOutputTokens === "number") azureBody.max_output_tokens = maxOutputTokens;
  return JSON.stringify(azureBody);
}

function parseResponsesResult(json: AzureResponsesResult): { text: string; promptTokens: number; outputTokens: number } {
  let text = typeof json.output_text === "string" ? json.output_text : "";
  if (!text && Array.isArray(json.output)) {
    text = json.output
      .flatMap((item) => item.content ?? [])
      .filter((c) => c?.type === "output_text" && typeof c.text === "string")
      .map((c) => c.text as string)
      .join("");
  }
  return {
    text,
    promptTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
  };
}

// --- Chat-completions body / parsing ----------------------------------------

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function mapPartChat(part: GeminiTextPart): ChatContentPart | null {
  if (typeof part.text === "string") return { type: "text", text: part.text };
  if (part.inlineData?.data) {
    const { mimeType, data } = part.inlineData;
    return { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } };
  }
  return null;
}

function buildChatBody(
  messages: NormalizedMessage[],
  deployment: string,
  reasoningEffort: string,
  includeReasoning: boolean,
  maxOutputTokens?: number,
): string {
  const chatMessages = messages.map((m) => {
    // Text-only messages send a plain string `content` (broadest compatibility);
    // messages with images use the structured content-parts array.
    const hasImage = m.parts.some((p) => p.inlineData?.data);
    if (!hasImage) {
      return { role: m.role, content: m.parts.map((p) => p.text ?? "").join("") };
    }
    return {
      role: m.role,
      content: m.parts.map(mapPartChat).filter((p): p is ChatContentPart => p !== null),
    };
  });
  const azureBody: Record<string, unknown> = { model: deployment, messages: chatMessages };
  if (includeReasoning && reasoningEffort !== "omit") {
    azureBody.reasoning_effort = reasoningEffort;
  }
  // `temperature` is intentionally NOT forwarded — GPT-5 reasoning models reject
  // it. GPT-5 chat completions use `max_completion_tokens` (not `max_tokens`).
  if (typeof maxOutputTokens === "number") azureBody.max_completion_tokens = maxOutputTokens;
  return JSON.stringify(azureBody);
}

function parseChatResult(json: AzureChatResult): { text: string; promptTokens: number; outputTokens: number } {
  const text = json.choices?.[0]?.message?.content ?? "";
  return {
    text: typeof text === "string" ? text : "",
    promptTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GeminiGenerateBody;

    const { config, error } = resolveProvider(body.azureProvider);
    if (!config) {
      return NextResponse.json({ error }, { status: 500 });
    }

    const messages = buildMessages(body);
    const maxOutputTokens =
      typeof body.config?.maxOutputTokens === "number" ? body.config.maxOutputTokens : undefined;

    // The GPT-5 series supports reasoning.effort values "medium" | "high" |
    // "xhigh" — "low"/"none" are rejected with a 400. "medium" is the documented
    // minimum and cheapest valid setting. Override with AZURE_TEXT_REASONING_EFFORT;
    // set to "omit" to drop the param entirely (deployment uses its default).
    const VALID_EFFORTS = new Set(["medium", "high", "xhigh"]);
    const effortEnv = process.env.AZURE_TEXT_REASONING_EFFORT;
    const reasoningEffort =
      effortEnv && VALID_EFFORTS.has(effortEnv) ? effortEnv : effortEnv === "omit" ? "omit" : "medium";

    const url = config.kind === "responses" ? config.endpoint : chatCompletionsUrl(config);

    const buildBody = (includeReasoning: boolean): string =>
      config.kind === "responses"
        ? buildResponsesBody(messages, config.deployment, reasoningEffort, includeReasoning, maxOutputTokens)
        : buildChatBody(messages, config.deployment, reasoningEffort, includeReasoning, maxOutputTokens);

    const callAzure = (includeReasoning: boolean) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.apiKey,
        },
        body: buildBody(includeReasoning),
        signal: request.signal,
        dispatcher: azureDispatcher,
        // `dispatcher` is an undici extension Node's fetch supports but the DOM
        // RequestInit type doesn't know about.
      } as RequestInit);

    let includeReasoning = true;
    let azureResponse: Response | undefined;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 8_000));
        if (request.signal.aborted) throw new Error("aborted");
      }

      try {
        azureResponse = await callAzure(includeReasoning);
      } catch (fetchError) {
        // Client disconnected — don't retry on the user's behalf.
        if (isAbortError(fetchError) || request.signal.aborted) throw fetchError;
        // Network-level failure (incl. undici timeouts) — retry.
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        console.warn(`Azure text attempt ${attempt + 1}/${MAX_ATTEMPTS} failed: ${lastError.message}`);
        continue;
      }

      if (azureResponse.ok) break;

      const status = azureResponse.status;
      let detail = `${azureResponse.status} ${azureResponse.statusText}`;
      try {
        const errJson = (await azureResponse.json()) as { error?: { message?: string } };
        if (errJson.error?.message) detail = `${detail}: ${errJson.error.message}`;
      } catch {
        try {
          detail = `${detail}: ${await azureResponse.text()}`;
        } catch {
          /* noop */
        }
      }

      lastError = new Error(`Azure text request failed — ${detail}`);
      azureResponse = undefined;

      // Deployment doesn't accept the reasoning param / effort value (Azure
      // phrases this as e.g. "Unsupported value: 'low' is not supported with
      // the '<model>' model") — drop the param and retry rather than failing
      // the whole request.
      if (status === 400 && includeReasoning && /reasoning|effort|unsupported value/i.test(detail)) {
        includeReasoning = false;
        continue;
      }

      if (!RETRYABLE_STATUSES.has(status)) break;
      console.warn(`Azure text attempt ${attempt + 1}/${MAX_ATTEMPTS} failed: ${detail}`);
    }

    if (!azureResponse) {
      throw lastError ?? new Error("Azure text request failed");
    }

    const json = await azureResponse.json();
    const { text, promptTokens, outputTokens } =
      config.kind === "responses"
        ? parseResponsesResult(json as AzureResponsesResult)
        : parseChatResult(json as AzureChatResult);

    return NextResponse.json({
      text,
      usageMetadata: {
        promptTokenCount: promptTokens,
        candidatesTokenCount: outputTokens,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Azure text generateContent error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
