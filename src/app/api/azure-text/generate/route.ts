import { NextRequest, NextResponse } from "next/server";

// Mirror the Gemini route's budget — prompt generation against gpt-5.4-pro can
// be slow, especially when reference images are attached.
export const maxDuration = 300;

/**
 * Server-side bridge from the Gemini `generateContent` request shape to the
 * Azure OpenAI **Responses API**.
 *
 * The browser (via `src/lib/text-client.ts`) POSTs the exact same
 * `{ model, contents, config }` slice it would send to `/api/gemini/generate`.
 * This handler translates that slice into an Azure Responses request, runs it
 * with server-held credentials, and returns a `{ text, usageMetadata }` payload
 * so existing `gemini.ts` call sites (which read `response.text` and token
 * usage) keep working unchanged.
 *
 * Azure credentials live exclusively on the server — `AZURE_TEXT_ENDPOINT`,
 * `AZURE_TEXT_KEY`, `AZURE_TEXT_DEPLOYMENT` — and are never sent to the browser.
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
  contents?: GeminiContent | GeminiContent[] | GeminiTextPart[];
  config?: GeminiConfig;
}

// --- Azure Responses API shapes ---------------------------------------------

type AzureContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

interface AzureInputMessage {
  role: "system" | "user" | "assistant";
  content: AzureContentPart[];
}

interface AzureResponsesResult {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; code?: string };
}

// --- Helpers ----------------------------------------------------------------

/** A bare `{text|inlineData}` part has no `parts` array of its own. */
function isBarePart(value: unknown): value is GeminiTextPart {
  if (typeof value !== "object" || value === null) return false;
  return ("text" in value || "inlineData" in value) && !("parts" in value);
}

/** Maps a single Gemini part to its Azure Responses content-part equivalent. */
function mapPart(part: GeminiTextPart): AzureContentPart | null {
  if (typeof part.text === "string") {
    return { type: "input_text", text: part.text };
  }
  if (part.inlineData?.data) {
    const { mimeType, data } = part.inlineData;
    return { type: "input_image", image_url: `data:${mimeType};base64,${data}` };
  }
  return null;
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
function mapRole(role?: string): AzureInputMessage["role"] {
  if (role === "system" || role === "assistant") return role;
  if (role === "model") return "assistant";
  return "user";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GeminiGenerateBody;

    const endpoint = process.env.AZURE_TEXT_ENDPOINT;
    const apiKey = process.env.AZURE_TEXT_KEY;
    const deployment = process.env.AZURE_TEXT_DEPLOYMENT;
    if (!endpoint || !apiKey || !deployment) {
      return NextResponse.json(
        {
          error:
            "Azure text provider is not configured. Set AZURE_TEXT_ENDPOINT, AZURE_TEXT_KEY and AZURE_TEXT_DEPLOYMENT.",
        },
        { status: 500 },
      );
    }

    const input: AzureInputMessage[] = [];

    // System instruction (string or `{parts:[{text}]}`) → leading system message.
    const sys = body.config?.systemInstruction;
    let sysText = "";
    if (typeof sys === "string") {
      sysText = sys;
    } else if (sys && Array.isArray(sys.parts)) {
      sysText = sys.parts.map((p) => p.text ?? "").join("");
    }
    if (sysText) {
      input.push({ role: "system", content: [{ type: "input_text", text: sysText }] });
    }

    // Each Gemini content → one Azure input message.
    for (const content of normaliseContents(body.contents)) {
      const parts = Array.isArray(content?.parts) ? content.parts : [];
      const mapped = parts
        .map(mapPart)
        .filter((p): p is AzureContentPart => p !== null);
      if (mapped.length === 0) continue;
      input.push({ role: mapRole(content.role), content: mapped });
    }

    const azureBody: Record<string, unknown> = {
      model: deployment,
      input,
    };
    if (typeof body.config?.temperature === "number") {
      azureBody.temperature = body.config.temperature;
    }
    if (typeof body.config?.maxOutputTokens === "number") {
      azureBody.max_output_tokens = body.config.maxOutputTokens;
    }

    const azureResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(azureBody),
      signal: request.signal,
    });

    if (!azureResponse.ok) {
      let detail = `${azureResponse.status} ${azureResponse.statusText}`;
      try {
        const errJson = (await azureResponse.json()) as AzureResponsesResult;
        if (errJson.error?.message) detail = `${detail}: ${errJson.error.message}`;
      } catch {
        try {
          detail = `${detail}: ${await azureResponse.text()}`;
        } catch {
          /* noop */
        }
      }
      throw new Error(`Azure Responses request failed — ${detail}`);
    }

    const json = (await azureResponse.json()) as AzureResponsesResult;

    // Prefer the convenience top-level `output_text`; otherwise stitch together
    // every `output_text` content part across the output items.
    let text = typeof json.output_text === "string" ? json.output_text : "";
    if (!text && Array.isArray(json.output)) {
      text = json.output
        .flatMap((item) => item.content ?? [])
        .filter((c) => c?.type === "output_text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("");
    }

    return NextResponse.json({
      text,
      usageMetadata: {
        promptTokenCount: json.usage?.input_tokens ?? 0,
        candidatesTokenCount: json.usage?.output_tokens ?? 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Azure text generateContent error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
