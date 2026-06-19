import { NextRequest, NextResponse } from "next/server";
import { Agent } from "undici";
import {
  acquireEndpoint,
  isConfigured,
  parseRetryAfterMs,
  poolSize,
  reportRateLimited,
  type EndpointRecord,
} from "@/lib/azure-image-pool";

// gpt-image-2 edits can take a while at higher qualities; match the Gemini budget.
// Queued requests may also wait briefly in `acquireEndpoint`, which is within this.
export const maxDuration = 300;

// gpt-image-2 renders (especially 2K/4K) routinely take 1–3 minutes to return.
// Node's built-in fetch (undici) aborts on its own header/body timeouts and the
// connect timeout defaults to only ~10s, which surfaced as intermittent
// "fetch failed" / timeout errors on slow renders. A dedicated dispatcher gives
// each upstream request an explicit 3-minute window for response headers and
// body, with a roomier connect timeout. Mirrors the azure-text route.
const IMAGE_TIMEOUT_MS = 180_000; // 3 minutes
const azureImageDispatcher = new Agent({
  headersTimeout: IMAGE_TIMEOUT_MS,
  bodyTimeout: IMAGE_TIMEOUT_MS,
  connectTimeout: 30_000,
});

/**
 * Server-side bridge to the Azure OpenAI gpt-image-2 `/images/edits` endpoint.
 *
 * The browser (via `src/lib/azure-image.ts`) builds a multipart FormData with
 * `prompt`, `model`, `n`, `size`, `quality`, and repeated `image[]` files and
 * POSTs it here. This handler re-POSTs that form to one of several configured
 * Azure deployments (in different regions) chosen by a sliding-window rate
 * limiter, then returns the Azure JSON `{ data:[{b64_json}], usage }` plus an
 * `_endpoint` index for observability.
 *
 * Endpoint selection, rate limiting, rotation and cooldown live in
 * `src/lib/azure-image-pool.ts`. Azure credentials live exclusively on the
 * server — `AZURE_IMAGE_ENDPOINT_{1..4}` / `AZURE_IMAGE_KEY_{1..4}` — plus an
 * optional `AZURE_IMAGE_RPM_PER_ENDPOINT` (default 5).
 */

interface AzureImageResponse {
  data?: Array<{ b64_json?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; code?: string };
}

/** Build the upstream multipart form; rebuilt per attempt (a body is one-shot). */
function rebuildForm(incoming: FormData): FormData {
  const outgoing = new FormData();
  for (const [field, value] of incoming.entries()) {
    if (value instanceof File) {
      outgoing.append(field, value, value.name);
    } else {
      outgoing.append(field, value);
    }
  }
  return outgoing;
}

export async function POST(request: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json(
        {
          error:
            "Azure image provider is not configured. Set AZURE_IMAGE_ENDPOINT_1 and AZURE_IMAGE_KEY_1.",
        },
        { status: 500 },
      );
    }

    const incoming = await request.formData();

    // Retry across distinct endpoints on throttling: at most one attempt per
    // configured deployment (capped at 4). Endpoints that 429/503 are excluded
    // from subsequent attempts and put into cooldown by the pool.
    const maxAttempts = Math.min(poolSize(), 4);
    const tried = new Set<number>();
    let lastDetail = "";

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const ep: EndpointRecord = await acquireEndpoint(request.signal, tried);
      tried.add(ep.index);

      const azureResponse = await fetch(ep.url, {
        method: "POST",
        headers: { "api-key": ep.key },
        body: rebuildForm(incoming),
        signal: request.signal,
        // Give slow gpt-image-2 renders the full 3-minute window instead of
        // undici's shorter defaults. `dispatcher` is an undici extension Node's
        // fetch supports but the DOM RequestInit type doesn't know about.
        dispatcher: azureImageDispatcher,
      } as RequestInit);

      if (azureResponse.ok) {
        const json = (await azureResponse.json()) as AzureImageResponse;
        return NextResponse.json({ ...json, _endpoint: ep.index });
      }

      // Throttled / transiently unavailable — cool this endpoint down and fail
      // over to another one.
      if (azureResponse.status === 429 || azureResponse.status === 503) {
        const retryAfterMs = parseRetryAfterMs(azureResponse.headers.get("retry-after"));
        reportRateLimited(ep, retryAfterMs);
        lastDetail = `${azureResponse.status} ${azureResponse.statusText} on deployment #${ep.index}`;
        continue;
      }

      // Any other upstream error is not a rate-limit problem — surface it.
      let detail = `${azureResponse.status} ${azureResponse.statusText}`;
      try {
        const errJson = (await azureResponse.json()) as AzureImageResponse;
        if (errJson.error?.message) detail = `${detail}: ${errJson.error.message}`;
      } catch {
        try {
          detail = `${detail}: ${await azureResponse.text()}`;
        } catch {
          /* noop */
        }
      }
      throw new Error(`Azure gpt-image-2 request failed — ${detail}`);
    }

    // Exhausted all endpoints while being throttled. Return 429 so the client's
    // existing auto-retry path re-queues the request.
    return NextResponse.json(
      {
        error: `Azure gpt-image-2 rate limited across all deployments — ${lastDetail || "all endpoints throttled"}`,
      },
      { status: 429 },
    );
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "Request cancelled" }, { status: 499 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("Azure image generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
