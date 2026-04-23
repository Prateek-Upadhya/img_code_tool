import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 600;

interface GenerateVideoRequestBody {
  apiKey: string;
  prompt: string;
  /** Veo model to use */
  veoModel?: string;
  /** image-to-video mode: single starting frame */
  image?: { base64: string; mimeType: string };
  /** reference images mode: up to 3 asset images (mutually exclusive with image) */
  referenceImages?: { base64: string; mimeType: string; referenceType: "asset" | "style" }[];
  /** Extension: seconds to append after the base 8s clip (e.g. 4 or 8) */
  extensionSeconds?: number;
  /** Prompt used specifically for the extension phase */
  extensionPrompt?: string;
  config: {
    aspectRatio: string;
    resolution: string;
    durationSeconds: number;
    negativePrompt?: string;
    personGeneration?: string;
  };
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("deadline") ||
    lower.includes("unavailable") ||
    lower.includes("503") ||
    lower.includes("timeout") ||
    lower.includes("resource_exhausted") ||
    lower.includes("429") ||
    lower.includes("internal") ||
    lower.includes("500")
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  baseDelayMs = 5000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && isTransientError(err)) {
        const delay = baseDelayMs * attempt;
        console.log(`Veo ${label} attempt ${attempt} failed (transient), retrying in ${delay}ms...`, err instanceof Error ? err.message : err);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

async function pollOperation(
  ai: GoogleGenAI,
  operation: Awaited<ReturnType<GoogleGenAI["models"]["generateVideos"]>>,
  label: string,
  maxPolls = 60,
) {
  let pollCount = 0;
  while (!operation.done && pollCount < maxPolls) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    try {
      operation = await ai.operations.getVideosOperation({ operation });
    } catch (err) {
      if (isTransientError(err) && pollCount < maxPolls - 1) {
        console.log(`Veo ${label} poll #${pollCount} hit transient error, will retry...`, err instanceof Error ? err.message : err);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw err;
    }
    pollCount++;
    if (pollCount % 3 === 0) {
      console.log(`Veo ${label} poll #${pollCount}, still processing...`);
    }
  }
  return operation;
}

function extractVideoFromOperation(
  operation: Awaited<ReturnType<GoogleGenAI["models"]["generateVideos"]>>,
) {
  const response = operation.response as Record<string, unknown> | undefined;
  const generatedVideos =
    response?.generatedVideos ??
    response?.generated_videos ??
    (response?.generateVideoResponse as Record<string, unknown>)?.generatedSamples ??
    null;

  if (!generatedVideos || !Array.isArray(generatedVideos) || generatedVideos.length === 0) {
    return null;
  }

  const firstVid = generatedVideos[0] as Record<string, unknown>;
  return firstVid.video ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateVideoRequestBody = await request.json();
    const { apiKey, prompt, veoModel, image, referenceImages, extensionSeconds, extensionPrompt, config } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = veoModel || "veo-3.1-generate-preview";
    const hasRefImages = referenceImages && referenceImages.length > 0;
    const needsExtension = extensionSeconds && extensionSeconds > 0;

    // Extension requires 720p; high-res and ref images force 8s duration
    const baseResolution = needsExtension ? "720p" : config.resolution;
    const useHighRes = baseResolution === "1080p" || baseResolution === "4k";
    const baseDuration = hasRefImages || useHighRes ? 8 : (needsExtension ? 8 : config.durationSeconds);

    const generateConfig: Record<string, unknown> = {
      aspectRatio: config.aspectRatio,
      resolution: baseResolution,
      durationSeconds: baseDuration,
      numberOfVideos: 1,
      personGeneration: config.personGeneration ?? "allow_adult",
    };

    if (config.negativePrompt && !hasRefImages && !image) {
      generateConfig.negativePrompt = config.negativePrompt;
    }

    const generateParams: Record<string, unknown> = {
      model: modelId,
      prompt,
      config: generateConfig,
    };

    if (hasRefImages && !image) {
      const capped = referenceImages!.slice(0, 3);
      generateConfig.referenceImages = capped.map((ref) => ({
        image: {
          imageBytes: ref.base64,
          mimeType: ref.mimeType,
        },
        referenceType: ref.referenceType,
      }));
    } else if (image) {
      generateParams.image = {
        imageBytes: image.base64,
        mimeType: image.mimeType,
      };
    }

    console.log(
      "Veo request mode:",
      image ? "image-to-video" : hasRefImages ? "reference-images" : "text-to-video",
      needsExtension ? `(+ ${extensionSeconds}s extension)` : "",
    );
    console.log("Base duration:", baseDuration, "Resolution:", baseResolution, "AspectRatio:", config.aspectRatio);

    // --- Phase 1: Generate base video ---
    let operation = await withRetry(
      () => ai.models.generateVideos(
        generateParams as unknown as Parameters<typeof ai.models.generateVideos>[0]
      ),
      "base-submit",
      3,
      5000,
    );

    operation = await pollOperation(ai, operation, "base", 60);

    if (!operation.done) {
      return NextResponse.json(
        { error: "Base video generation timed out after 10 minutes" },
        { status: 504 },
      );
    }

    console.log("Veo base operation done. Response keys:", Object.keys(operation.response ?? {}));

    const baseVideo = extractVideoFromOperation(operation);
    if (!baseVideo) {
      console.error("Veo returned no base videos. Full response:", JSON.stringify(operation.response));
      return NextResponse.json(
        { error: "No videos were generated. The model may have filtered the content due to safety policies." },
        { status: 500 },
      );
    }

    // If no extension needed, return the base video directly
    if (!needsExtension) {
      const videoObj = baseVideo as Record<string, string> | string;
      const uri = typeof videoObj === "string" ? videoObj : videoObj.uri;
      if (!uri) {
        return NextResponse.json({ error: "Generated video has no downloadable content" }, { status: 500 });
      }
      return NextResponse.json({ videos: [{ videoUri: uri }], done: true });
    }

    // --- Phase 2: Extend the base video ---
    console.log(`Starting extension phase: +${extensionSeconds}s`);

    const extendConfig: Record<string, unknown> = {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: config.aspectRatio,
    };

    const extendParams: Record<string, unknown> = {
      model: modelId,
      prompt: extensionPrompt || `Continue the video seamlessly, maintaining the same person, clothing, lighting, background, and cinematic style.`,
      video: baseVideo,
      config: extendConfig,
    };

    let extOperation = await withRetry(
      () => ai.models.generateVideos(
        extendParams as unknown as Parameters<typeof ai.models.generateVideos>[0]
      ),
      "extension-submit",
      3,
      5000,
    );

    extOperation = await pollOperation(ai, extOperation, "extension", 60);

    if (!extOperation.done) {
      return NextResponse.json(
        { error: "Video extension timed out after 10 minutes" },
        { status: 504 },
      );
    }

    console.log("Veo extension operation done.");

    const extVideo = extractVideoFromOperation(extOperation);
    if (!extVideo) {
      console.error("Veo returned no extended videos. Full response:", JSON.stringify(extOperation.response));
      return NextResponse.json(
        { error: "Video extension failed. The model may have filtered the content due to safety policies." },
        { status: 500 },
      );
    }

    const extVideoObj = extVideo as Record<string, string> | string;
    const extUri = typeof extVideoObj === "string" ? extVideoObj : extVideoObj.uri;
    if (!extUri) {
      return NextResponse.json({ error: "Extended video has no downloadable content" }, { status: 500 });
    }

    return NextResponse.json({ videos: [{ videoUri: extUri }], done: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Video generation error:", message);
    const status = isTransientError(error) ? 503 : 500;
    return NextResponse.json({ error: message, retryable: status === 503 }, { status });
  }
}
