import type { OverlayPosition, PdpLogos, PdpShotOption } from "./types";

/**
 * Post generation logo compositing for the PDP Set mode.
 *
 * Brand marks are painted onto the finished render from the operator's own files rather
 * than being drawn by the image model. Two documented failure modes make this the correct
 * approach for anything that must be exact:
 *
 *   - Canonical form substitution. Given a reference mark, the model will sometimes
 *     render the well known "correct" version of that mark instead of the supplied one.
 *   - Hallucinated lettering. The model produces sharp, confident, semantically wrong
 *     text, which on a wordmark is worse than no wordmark at all.
 *
 * It also satisfies the style brief's own rule that the brand mark is composited from
 * file and never redrawn, and the secondary mark reproduced from file and never typeset.
 * The prompt side counterpart is `buildPdpMarkReservation`, which asks the model to leave
 * the target corners clean and flat.
 *
 * Deliberately standalone rather than reusing `infographic-renderer.ts`. That module's
 * image cache is keyed by src and cleared when the editor closes, which is right for a
 * drag loop and wrong for a long batch that would otherwise retain every logo bitmap.
 */

/** Margin from the frame edge, as a fraction of the shorter canvas dimension. */
const MARGIN_RATIO = 0.04;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for compositing"));
    img.src = src;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read logo file"));
    reader.readAsDataURL(file);
  });
}

function resolvePlacement(
  position: OverlayPosition,
  canvasWidth: number,
  canvasHeight: number,
  elementWidth: number,
  elementHeight: number
): { x: number; y: number } {
  const margin = Math.min(canvasWidth, canvasHeight) * MARGIN_RATIO;
  let x = margin;
  let y = margin;

  if (position.includes("right")) x = canvasWidth - elementWidth - margin;
  else if (position.includes("center")) x = (canvasWidth - elementWidth) / 2;

  if (position.startsWith("bottom")) y = canvasHeight - elementHeight - margin;
  else if (position.startsWith("middle")) y = (canvasHeight - elementHeight) / 2;

  return { x, y };
}

interface MarkToDraw {
  src: string;
  placement: OverlayPosition;
  /** Fraction of canvas width the mark should span, 0 to 1. */
  scale: number;
}

async function drawMark(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  mark: MarkToDraw
): Promise<void> {
  const img = await loadImage(mark.src);
  if (!img.naturalWidth || !img.naturalHeight) return;

  const targetWidth = canvasWidth * mark.scale;
  const targetHeight = targetWidth * (img.naturalHeight / img.naturalWidth);
  const { x, y } = resolvePlacement(mark.placement, canvasWidth, canvasHeight, targetWidth, targetHeight);

  ctx.drawImage(img, x, y, targetWidth, targetHeight);
}

/**
 * Whether this option should carry the optional secondary mark. True Zero declares the
 * mark mandatory, so it is always drawn there when one exists, regardless of the per
 * option toggles.
 */
export function shouldDrawOptionalLogo(option: PdpShotOption, logos: PdpLogos): boolean {
  if (!logos.optionalLogo) return false;
  if (option.requiresOptionalLogo) return true;
  return logos.optionalEnabledFor.includes(option.id);
}

/**
 * Composite the brand mark, and where enabled the optional mark, onto a generated image.
 *
 * Returns a PNG data URL. Never throws: if the canvas is unavailable or a logo fails to
 * decode, the original image is returned untouched. A missing mark on one image is a far
 * better outcome than a failed batch, and the result card surfaces the discrepancy.
 */
export async function compositePdpLogos(
  imageDataUrl: string,
  option: PdpShotOption,
  logos: PdpLogos
): Promise<string> {
  const brandSrc = logos.brandLogo ? logos.brandLogo.preview : null;
  const wantsOptional = shouldDrawOptionalLogo(option, logos);
  if (!brandSrc && !wantsOptional) return imageDataUrl;

  try {
    const base = await loadImage(imageDataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = base.naturalWidth;
    canvas.height = base.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return imageDataUrl;

    ctx.drawImage(base, 0, 0);

    if (brandSrc) {
      await drawMark(ctx, canvas.width, canvas.height, {
        src: brandSrc,
        placement: logos.brandPlacement,
        scale: logos.brandScale,
      });
    }

    if (wantsOptional && logos.optionalLogo) {
      // Blob previews are revoked when state churns, so read the File directly for the
      // optional mark, which may be drawn long after upload in a slow batch.
      const src = await fileToDataUrl(logos.optionalLogo.file);
      await drawMark(ctx, canvas.width, canvas.height, {
        src,
        placement: logos.optionalPlacement,
        scale: logos.optionalScale,
      });
    }

    return canvas.toDataURL("image/png");
  } catch {
    return imageDataUrl;
  }
}

/** Human readable placement label, used in the prompt's mark reservation clause. */
export function placementLabel(position: OverlayPosition): string {
  return position.replace(/-/g, " ").replace("center", "centre");
}
