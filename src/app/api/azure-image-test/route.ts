import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Server-side proxy that forwards a test request to the configured Azure
 * OpenAI gpt-image-2 endpoint. Azure endpoints do not support browser CORS,
 * so the test page posts here and we relay to Azure using the key from env.
 *
 * Accepts multipart/form-data with fields:
 *   - prompt (string, required)
 *   - mode ("generations" | "edits", required)
 *   - size (string, e.g. "1024x1024")
 *   - quality ("low" | "medium" | "high")
 *   - n (string number, default "1")
 *   - image (File, repeatable; required when mode === "edits")
 *   - endpoint (optional override of NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT)
 *   - apiKey  (optional override of NEXT_PUBLIC_AZURE_OPENAI_KEY)
 */
export async function POST(req: NextRequest) {
  const incoming = await req.formData();

  const prompt = (incoming.get("prompt") ?? "").toString().trim();
  const mode = (incoming.get("mode") ?? "edits").toString();
  const size = (incoming.get("size") ?? "1024x1024").toString();
  const quality = (incoming.get("quality") ?? "medium").toString();
  const n = (incoming.get("n") ?? "1").toString();
  const endpointOverride = (incoming.get("endpoint") ?? "").toString().trim();
  const keyOverride = (incoming.get("apiKey") ?? "").toString().trim();

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const envEndpoint = process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT ?? "";
  const envKey = process.env.NEXT_PUBLIC_AZURE_OPENAI_KEY ?? "";

  const baseEndpoint = endpointOverride || envEndpoint;
  const apiKey = keyOverride || envKey;

  if (!baseEndpoint) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT (or endpoint override)" },
      { status: 500 }
    );
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_AZURE_OPENAI_KEY (or apiKey override)" },
      { status: 500 }
    );
  }

  // Toggle the last path segment between /generations and /edits while keeping
  // the query string (api-version) intact.
  const targetUrl = (() => {
    try {
      const u = new URL(baseEndpoint);
      u.pathname = u.pathname.replace(/\/(generations|edits)$/, `/${mode}`);
      return u.toString();
    } catch {
      return baseEndpoint;
    }
  })();

  const images = incoming.getAll("image").filter((v): v is File => v instanceof File);

  if (mode === "edits" && images.length === 0) {
    return NextResponse.json(
      { error: "At least one image file is required when mode = edits" },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  let azureResponse: Response;

  try {
    if (mode === "generations") {
      // JSON body, no images
      azureResponse = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          size,
          quality,
          n: Number(n),
        }),
      });
    } else {
      const forwardForm = new FormData();
      forwardForm.set("prompt", prompt);
      forwardForm.set("size", size);
      forwardForm.set("quality", quality);
      forwardForm.set("n", n);
      for (const img of images) {
        forwardForm.append("image[]", img, img.name || "image.png");
      }

      azureResponse = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "api-key": apiKey,
        },
        body: forwardForm,
      });
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: "Fetch to Azure failed",
        detail: err instanceof Error ? err.message : String(err),
        targetUrl,
      },
      { status: 502 }
    );
  }

  const elapsedMs = Date.now() - startedAt;
  const contentType = azureResponse.headers.get("content-type") ?? "";

  let rawBody: string;
  try {
    rawBody = await azureResponse.text();
  } catch (err) {
    rawBody = `<failed to read body: ${err instanceof Error ? err.message : String(err)}>`;
  }

  let parsed: unknown = null;
  if (contentType.includes("application/json")) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
  }

  return NextResponse.json(
    {
      ok: azureResponse.ok,
      status: azureResponse.status,
      statusText: azureResponse.statusText,
      elapsedMs,
      targetUrl,
      mode,
      contentType,
      parsed,
      rawBody: parsed ? undefined : rawBody.slice(0, 4000),
    },
    { status: 200 }
  );
}
