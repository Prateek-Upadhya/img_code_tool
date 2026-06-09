/**
 * Azure OpenAI gpt-image-2 integration.
 *
 * Used as an alternative image-generation backend for ALL VTON flows (clothing
 * + footwear, single + bulk). The browser builds a multipart form and POSTs it
 * to our own `/api/azure-image/generate` route, which forwards it to one of the
 * configured Azure `/images/edits` deployments using server-held credentials.
 * The `/images/edits` endpoint is used (never `/images/generations`) because
 * VTON always carries at least one reference image (the product).
 *
 * Size resolution: gpt-image-2 accepts arbitrary resolutions subject to:
 *   - both edges divisible by 16
 *   - long edge <= 3840 px
 *   - total pixel count 655,360 - 8,294,400
 *   - aspect ratio <= 3:1
 * All of our UI aspect ratios (up to 16:9) comply with the 3:1 cap.
 */

import type {
  AccessoryItem,
  AspectRatio,
  ComplementaryImage,
  GarmentImage,
  ModelImage,
  StepCost,
  TokenUsage,
} from "./types";

// --- Size resolver -------------------------------------------------------

type GptImageQuality = "low" | "medium" | "high";

const QUALITY_MAP: Record<"1K" | "2K" | "4K", { quality: GptImageQuality; longEdge: number }> = {
  "1K": { quality: "low", longEdge: 1024 },
  "2K": { quality: "medium", longEdge: 2048 },
  "4K": { quality: "high", longEdge: 3840 },
};

const MAX_PIXELS = 8_294_400;
const MIN_PIXELS = 655_360;
const MAX_LONG_EDGE = 3840;
const BLOCK = 16;

function roundTo16(n: number): number {
  return Math.max(BLOCK, Math.round(n / BLOCK) * BLOCK);
}

/**
 * Maps UI aspect ratio + image quality to a concrete `WxH` string that
 * satisfies every gpt-image-2 constraint.
 */
export function resolveAzureImageSize(
  aspectRatio: AspectRatio,
  imageQuality: "1K" | "2K" | "4K",
): { size: string; quality: GptImageQuality; width: number; height: number } {
  const [wPart, hPart] = aspectRatio.split(":").map((s) => Number(s));
  const isPortrait = hPart > wPart;
  const shortToLong = Math.min(wPart, hPart) / Math.max(wPart, hPart);

  let longEdge = Math.min(QUALITY_MAP[imageQuality].longEdge, MAX_LONG_EDGE);
  let shortEdge = longEdge * shortToLong;

  // Scale long edge down if pixel count exceeds the cap (happens at "4K" for
  // any aspect ratio that isn't exactly 16:9).
  const longCapForPixels = Math.sqrt(MAX_PIXELS / shortToLong);
  if (longEdge > longCapForPixels) longEdge = longCapForPixels;

  longEdge = Math.min(longEdge, MAX_LONG_EDGE);
  shortEdge = longEdge * shortToLong;

  let long = roundTo16(longEdge);
  let short = roundTo16(shortEdge);

  // Guarantee pixel count is within bounds even after rounding.
  while (long * short > MAX_PIXELS && long > BLOCK) {
    long -= BLOCK;
    short = roundTo16(long * shortToLong);
  }
  while (long * short < MIN_PIXELS && long < MAX_LONG_EDGE) {
    long += BLOCK;
    short = roundTo16(long * shortToLong);
  }

  const width = isPortrait ? short : long;
  const height = isPortrait ? long : short;

  return {
    size: `${width}x${height}`,
    quality: QUALITY_MAP[imageQuality].quality,
    width,
    height,
  };
}

// --- Cost accounting -----------------------------------------------------

// Azure gpt-image-2 per-image flat pricing (approximate, USD).
// Actual billing depends on contract; update if you have exact rates.
const GPT_IMAGE_2_COST: Record<GptImageQuality, number> = {
  low: 0.02,
  medium: 0.06,
  high: 0.15,
};

export function computeAzureImageGenCost(
  label: string,
  tokens: TokenUsage,
  quality: GptImageQuality,
): StepCost {
  const outputCost = GPT_IMAGE_2_COST[quality];
  return {
    model: "gpt-image-2",
    label,
    tokens,
    inputCost: 0,
    outputCost,
    totalCost: outputCost,
  };
}

// --- Image generation call ----------------------------------------------

export interface AzureVTONImageArgs {
  prompt: string;
  garmentImages: GarmentImage[];
  complementaryImages: ComplementaryImage[];
  accessories: AccessoryItem[];
  modelImage: ModelImage | null;
  aspectRatio: AspectRatio;
  imageSize: "1K" | "2K" | "4K";
  isProductOnlyShot?: boolean;
}

interface AzureImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string; code?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Generates a footwear VTON image using Azure gpt-image-2.
 *
 * Return shape matches `generateVTONImage` so callers can swap them freely.
 * Reference images are submitted as repeated `image[]` form fields in this
 * order to match the "images-first" attention pattern used for footwear:
 *   1. All footwear product images (hero)
 *   2. Model image (on-model shots only)
 *   3. Complementary garment images
 *   4. Accessory images that have files
 */
export async function generateVTONImageAzure({
  prompt,
  garmentImages,
  complementaryImages,
  accessories,
  modelImage,
  aspectRatio,
  imageSize,
  isProductOnlyShot = false,
}: AzureVTONImageArgs): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const { size, quality } = resolveAzureImageSize(aspectRatio, imageSize);

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("model", "gpt-image-2");
  form.append("n", "1");
  form.append("size", size);
  form.append("quality", quality);

  const imageFiles: File[] = [];
  for (const img of garmentImages) imageFiles.push(img.file);
  if (!isProductOnlyShot && modelImage) imageFiles.push(modelImage.file);
  for (const img of complementaryImages) imageFiles.push(img.file);
  for (const acc of accessories) {
    if (acc.image?.file) imageFiles.push(acc.image.file);
  }

  for (const file of imageFiles) {
    form.append("image[]", file, file.name);
  }

  // The call is proxied through our own route so Azure credentials stay
  // server-side and the two deployments can be rotated round-robin.
  const response = await fetch("/api/azure-image/generate", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const errJson = (await response.json()) as AzureImageResponse;
      if (errJson.error?.message) detail = `${detail}: ${errJson.error.message}`;
    } catch {
      try {
        detail = `${detail}: ${await response.text()}`;
      } catch {
        // noop
      }
    }
    throw new Error(`Azure gpt-image-2 request failed — ${detail}`);
  }

  const json = (await response.json()) as AzureImageResponse;
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image returned from Azure gpt-image-2");
  }

  const tokens: TokenUsage = {
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
  };
  const cost = computeAzureImageGenCost("Image Generation (gpt-image-2)", tokens, quality);

  return {
    imageData: `data:image/png;base64,${b64}`,
    cost,
    responseContent: json,
  };
}
