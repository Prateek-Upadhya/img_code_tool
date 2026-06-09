import { NextRequest, NextResponse } from "next/server";

// gpt-image-2 edits can take a while at higher qualities; match the Gemini budget.
export const maxDuration = 300;

/**
 * Server-side bridge to the Azure OpenAI gpt-image-2 `/images/edits` endpoint.
 *
 * The browser (via `src/lib/azure-image.ts`) builds a multipart FormData with
 * `prompt`, `model`, `n`, `size`, `quality`, and repeated `image[]` files and
 * POSTs it here. This handler re-POSTs that form to one of two configured Azure
 * deployments (round-robin) using server-held credentials, then returns the
 * Azure JSON `{ data:[{b64_json}], usage }` plus an `_endpoint` index for
 * observability.
 *
 * Azure credentials live exclusively on the server — `AZURE_IMAGE_ENDPOINT_1`,
 * `AZURE_IMAGE_KEY_1`, `AZURE_IMAGE_ENDPOINT_2`, `AZURE_IMAGE_KEY_2`.
 */

// Module-level rotation counter — alternates between deployment 1 and 2.
let counter = 0;

interface AzureImageResponse {
  data?: Array<{ b64_json?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; code?: string };
}

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();

    const endpoint1 = process.env.AZURE_IMAGE_ENDPOINT_1;
    const key1 = process.env.AZURE_IMAGE_KEY_1;
    const endpoint2 = process.env.AZURE_IMAGE_ENDPOINT_2;
    const key2 = process.env.AZURE_IMAGE_KEY_2;

    if (!endpoint1 || !key1) {
      return NextResponse.json(
        {
          error:
            "Azure image provider is not configured. Set AZURE_IMAGE_ENDPOINT_1 and AZURE_IMAGE_KEY_1.",
        },
        { status: 500 },
      );
    }

    // Round-robin: even calls → deployment 1, odd calls → deployment 2.
    // Fall back to deployment 1 if the second deployment is unset.
    const hasSecond = Boolean(endpoint2 && key2);
    const useSecond = hasSecond && counter++ % 2 === 1;
    const endpoint = useSecond ? endpoint2! : endpoint1;
    const apiKey = useSecond ? key2! : key1;
    const endpointIndex = useSecond ? 2 : 1;
    console.log(`[azure-image] routing to Azure deployment #${endpointIndex}`);

    // Reconstruct the multipart form for the upstream call.
    const outgoing = new FormData();
    for (const [field, value] of incoming.entries()) {
      if (value instanceof File) {
        outgoing.append(field, value, value.name);
      } else {
        outgoing.append(field, value);
      }
    }

    const azureResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "api-key": apiKey },
      body: outgoing,
      signal: request.signal,
    });

    if (!azureResponse.ok) {
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

    const json = (await azureResponse.json()) as AzureImageResponse;
    return NextResponse.json({ ...json, _endpoint: endpointIndex });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Azure image generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
