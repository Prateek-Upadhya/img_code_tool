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
  LabeledModelView,
  ModelImage,
  ModelViewKind,
  StepCost,
  TokenUsage,
} from "./types";
import { buildModelViewPrompt, CLEAR_SKIN_ANCHOR, MODEL_EDIT_COMPLEXION_SYNC_CLAUSE } from "./gemini";

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
  /**
   * Optional labelled model views. gpt-image-2 has no per-image slots, so when
   * ≥2 are supplied they are appended as `image[]` references and described by
   * order in the prompt prose (in place of the single `modelImage`).
   */
  modelViews?: LabeledModelView[];
  aspectRatio: AspectRatio;
  imageSize: "1K" | "2K" | "4K";
  isProductOnlyShot?: boolean;
  /**
   * Infographic Layout Lock: the reference template, appended as a trailing `image[]`
   * reference and named by order in the prompt prose (gpt-image-2 has no image labels).
   * Supplies layout geometry only — never its product, copy, or branding.
   */
  layoutReference?: File;
  /** Optional brand logo, appended after the layout reference and named in the prose. */
  brandLogo?: { file: File; placementInstructions?: string };
}

/** Prose sentence naming the model views by their `image[]` order. */
const AZURE_VIEW_LABEL: Record<LabeledModelView["kind"], string> = {
  "full-body": "the full body",
  "face-closeup": "a face close-up",
  "back-head": "the back of the head",
};

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
  modelViews,
  aspectRatio,
  imageSize,
  isProductOnlyShot = false,
  layoutReference,
  brandLogo,
}: AzureVTONImageArgs): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const { size, quality } = resolveAzureImageSize(aspectRatio, imageSize);

  const useMultiView = !isProductOnlyShot && !!modelViews && modelViews.length >= 2;

  // gpt-image-2 has no per-image labels, so name the model views by order in
  // the prompt prose. Product images come first, then the model view(s).
  let promptText = useMultiView
    ? `${prompt}\n\nMODEL REFERENCE IMAGES: after the product image(s), ${modelViews!.length} images depict the SAME person from multiple angles — ${modelViews!
        .map((v, i) => `image ${i + 1} is ${AZURE_VIEW_LABEL[v.kind]}`)
        .join(", ")}. Reproduce this exact person (face, skin tone, hair front and back, body type) and do not copy any clothing or background from them.`
    : prompt;

  // Trailing references, named by position since gpt-image-2 cannot label images.
  if (layoutReference) {
    promptText += `\n\nINFOGRAPHIC LAYOUT REFERENCE: the ${brandLogo ? "second-to-last" : "last"} attached image is a LAYOUT TEMPLATE. Replicate its structure — canvas grid, the placement and reading order of headline/callout zones, leader-line and icon treatment, typographic hierarchy, and palette relationships. Do NOT copy its product, any of its text, or its branding; the product comes solely from the product image(s) and every word comes solely from this prompt.`;
  }
  if (brandLogo) {
    promptText += `\n\nBRAND LOGO: the last attached image is the brand logo. Place it tastefully, preserving its proportions and keeping it legible. Do not redraw, restyle, or recolour it.${brandLogo.placementInstructions?.trim() ? ` Placement guidance: ${brandLogo.placementInstructions.trim()}` : ""}`;
  }

  const form = new FormData();
  form.append("prompt", promptText);
  form.append("model", "gpt-image-2");
  form.append("n", "1");
  form.append("size", size);
  form.append("quality", quality);

  const imageFiles: File[] = [];
  for (const img of garmentImages) imageFiles.push(img.file);
  if (useMultiView) {
    for (const view of modelViews!) imageFiles.push(view.file);
  } else if (!isProductOnlyShot && modelImage) {
    imageFiles.push(modelImage.file);
  }
  for (const img of complementaryImages) imageFiles.push(img.file);
  for (const acc of accessories) {
    if (acc.image?.file) imageFiles.push(acc.image.file);
  }
  // Order matters — the prose above refers to these by position.
  if (layoutReference) imageFiles.push(layoutReference);
  if (brandLogo) imageFiles.push(brandLogo.file);

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

// --- Infographic image generation ---------------------------------------

// --- AI Model Creation image generation ---------------------------------

export interface AzureModelImageArgs {
  prompt: string;
  /** Optional face reference. When absent, the route uses /images/generations. */
  referenceImage?: { file: File };
  aspectRatio: AspectRatio;
  imageSize: "1K" | "2K" | "4K";
}

/**
 * Renders a full-body fashion model with Azure gpt-image-2. Return shape matches
 * the Gemini `generateModelImage` (minus `contentParts`) so callers can swap
 * them freely. When a face reference is supplied it is sent as `image[]` (the
 * route hits /images/edits); with no reference the route falls back to
 * /images/generations. Goes through `/api/azure-image/generate`, so the Azure
 * endpoint pool + 429 failover (≈10 concurrent) apply.
 */
export async function generateModelImageAzure({
  prompt,
  referenceImage,
  aspectRatio,
  imageSize,
}: AzureModelImageArgs): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const { size, quality } = resolveAzureImageSize(aspectRatio, imageSize);

  const form = new FormData();
  // Mirrors the anchor `generateModelImage` appends on the Gemini side. Unlike
  // that path this function has no prompt wrapper of its own, so without this
  // line the Azure backend would be the only route with no clear-skin guard.
  form.append("prompt", `${prompt}\n\n${CLEAR_SKIN_ANCHOR}`);
  form.append("model", "gpt-image-2");
  form.append("n", "1");
  form.append("size", size);
  form.append("quality", quality);
  if (referenceImage) {
    form.append("image[]", referenceImage.file, referenceImage.file.name);
  }

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
  const cost = computeAzureImageGenCost("Model Image (gpt-image-2)", tokens, quality);

  return {
    imageData: `data:image/png;base64,${b64}`,
    cost,
    responseContent: json,
  };
}

export interface AzureModelViewImageArgs {
  sourceImage: { file: File };
  view: ModelViewKind;
  aspectRatio: AspectRatio;
  imageSize: "1K" | "2K" | "4K";
}

/**
 * Model Refine — renders one identity reference shot (face close-up or back of
 * head) from a full-body model image with Azure gpt-image-2. The source is
 * always attached, so the route hits `/images/edits`. Return shape matches the
 * Gemini `generateModelViewImage` so callers can swap them freely.
 */
export async function generateModelViewImageAzure({
  sourceImage,
  view,
  aspectRatio,
  imageSize,
}: AzureModelViewImageArgs): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const { size, quality } = resolveAzureImageSize(aspectRatio, imageSize);

  const prompt = `The attached image is a full-body studio photograph of a fashion model — the definitive reference for this person's identity, hair, skin tone, background and lighting. ${buildModelViewPrompt(view)} Output a single photorealistic photograph.`;

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("model", "gpt-image-2");
  form.append("n", "1");
  form.append("size", size);
  form.append("quality", quality);
  form.append("image[]", sourceImage.file, sourceImage.file.name);

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
  const cost = computeAzureImageGenCost(
    view === "face-closeup" ? "Face Close-up (gpt-image-2)" : "Back of Head (gpt-image-2)",
    tokens,
    quality
  );

  return {
    imageData: `data:image/png;base64,${b64}`,
    cost,
    responseContent: json,
  };
}

export interface AzureModelEditImageArgs {
  editInstruction: string;
  sourceImage: { file: File };
  referenceImage?: { file: File };
  referenceDirective?: string;
  /** Face-sync: identity, hair and complexion come from the REFERENCE, not the SOURCE. */
  identityFromReference?: boolean;
  /** The edit is itself a complexion change, so skin tone is not pinned to the SOURCE. */
  releaseSkinTone?: boolean;
  aspectRatio: AspectRatio;
  imageSize: "1K" | "2K" | "4K";
}

/**
 * Edits a single model image with Azure gpt-image-2 (single-attribute change,
 * everything else preserved). The source is always attached, so the route hits
 * `/images/edits`. gpt-image-2 has no slot labels, so the source/reference are
 * referenced by ORDER in the flat prompt prose. Return shape matches the Gemini
 * `generateModelEditImage` (minus `contentParts`).
 */
export async function generateModelEditImageAzure({
  editInstruction,
  sourceImage,
  referenceImage,
  referenceDirective,
  identityFromReference = false,
  releaseSkinTone = false,
  aspectRatio,
  imageSize,
}: AzureModelEditImageArgs): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const { size, quality } = resolveAzureImageSize(aspectRatio, imageSize);

  const refClause = referenceImage
    ? ` The second attached image is a REFERENCE — take ONLY ${
        referenceDirective?.trim() || "guidance for the requested change"
      } from it and ignore everything else about it.`
    : "";
  // The preservation sentence stays in gpt-image-2's flat, order-referenced
  // phrasing (it has no slot labels), but it branches on the SAME flag as the
  // Nano Banana path — see buildModelEditPreservationClause in gemini.ts. In the
  // face-sync case identity, hair and complexion come from the REFERENCE, so
  // pinning them to the source here would cancel the edit out.
  const preservedParts: string[] = [];
  if (!identityFromReference) preservedParts.push("face and identity", "hairstyle", "hair color");
  if (!identityFromReference && !releaseSkinTone) preservedParts.push("skin tone");
  preservedParts.push(
    "clothing",
    "pose and body position",
    "hands",
    "background",
    "lighting",
    "shadows",
    "framing and crop"
  );
  const preserved = preservedParts.join(", ");
  const complexionClause = identityFromReference ? ` ${MODEL_EDIT_COMPLEXION_SYNC_CLAUSE}` : "";
  const prompt = `Edit the first attached image (the SOURCE). Change ONLY: ${editInstruction.trim()}.${refClause}${complexionClause} Maintain the identical ${preserved} from the source image — every region the change does not touch stays exactly the same. Output a single photorealistic edited image keeping the same framing as the source.`;

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("model", "gpt-image-2");
  form.append("n", "1");
  form.append("size", size);
  form.append("quality", quality);
  form.append("image[]", sourceImage.file, sourceImage.file.name);
  if (referenceImage) {
    form.append("image[]", referenceImage.file, referenceImage.file.name);
  }

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
  const cost = computeAzureImageGenCost("Model Edit Image (gpt-image-2)", tokens, quality);

  return {
    imageData: `data:image/png;base64,${b64}`,
    cost,
    responseContent: json,
  };
}

export interface AzureInfographicImageArgs {
  prompt: string;
  productImages: { file: File }[];
  logoFile?: File;
  aspectRatio: AspectRatio;
  imageSize: "1K" | "2K" | "4K";
}

/**
 * Generates a product infographic using Azure gpt-image-2.
 *
 * Return shape matches the Gemini `generateInfographicImage` (minus the
 * Gemini-only `contentParts`) so callers can swap them freely. Reference images
 * are submitted as repeated `image[]` form fields — product images first (the
 * source of truth), then the optional brand logo. Logo placement and all layout
 * direction reach gpt-image-2 through the enriched prose `prompt`, since the
 * `/images/edits` endpoint takes only a flat prompt plus images.
 */
export async function generateInfographicImageAzure({
  prompt,
  productImages,
  logoFile,
  aspectRatio,
  imageSize,
}: AzureInfographicImageArgs): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const { size, quality } = resolveAzureImageSize(aspectRatio, imageSize);

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("model", "gpt-image-2");
  form.append("n", "1");
  form.append("size", size);
  form.append("quality", quality);

  for (const img of productImages) {
    form.append("image[]", img.file, img.file.name);
  }
  if (logoFile) {
    form.append("image[]", logoFile, logoFile.name);
  }

  // Proxied through our own route so Azure credentials stay server-side and the
  // endpoint pool can be rotated with 429 failover.
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
  const cost = computeAzureImageGenCost("Infographic Image (gpt-image-2)", tokens, quality);

  return {
    imageData: `data:image/png;base64,${b64}`,
    cost,
    responseContent: json,
  };
}
