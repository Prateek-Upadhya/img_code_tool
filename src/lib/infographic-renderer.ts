import type { USPElement, LogoElement, OverlayPosition, BadgeStyle } from "./types";

// --- Image Cache ---
// Caches loaded images by src to avoid re-loading during drag operations
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Loads an image from a URL (base64 data URL or blob URL) into an HTMLImageElement.
 * Uses cache to avoid reloading the same image.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Clears the image cache. Call when the editor is closed.
 */
export function clearImageCache() {
  imageCache.clear();
}

/**
 * Resolves an OverlayPosition to x, y coordinates on the canvas.
 * Returns the anchor point for the element.
 */
function resolvePosition(
  position: OverlayPosition,
  canvasWidth: number,
  canvasHeight: number,
  elementWidth: number,
  elementHeight: number,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  const margin = Math.min(canvasWidth, canvasHeight) * 0.04;
  let x = margin;
  let y = margin;

  // Horizontal
  if (position.includes("left")) {
    x = margin;
  } else if (position.includes("right")) {
    x = canvasWidth - elementWidth - margin;
  } else if (position.includes("center")) {
    x = (canvasWidth - elementWidth) / 2;
  }

  // Vertical
  if (position.startsWith("top")) {
    y = margin;
  } else if (position.startsWith("bottom")) {
    y = canvasHeight - elementHeight - margin;
  } else if (position.startsWith("middle")) {
    y = (canvasHeight - elementHeight) / 2;
  }

  return { x: x + offsetX, y: y + offsetY };
}

/**
 * Measures text dimensions for a USP element.
 */
function measureUSP(
  ctx: CanvasRenderingContext2D,
  usp: USPElement,
  scale: number
): { width: number; height: number; textWidth: number } {
  const fontSize = usp.fontSize * scale;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  const displayText = usp.icon ? `${usp.icon}  ${usp.text}` : usp.text;
  const metrics = ctx.measureText(displayText);
  const textWidth = metrics.width;

  const paddingX = fontSize * 0.8;
  const paddingY = fontSize * 0.5;

  return {
    width: textWidth + paddingX * 2,
    height: fontSize + paddingY * 2,
    textWidth,
  };
}

/**
 * Draws a USP badge on the canvas.
 */
function drawUSP(
  ctx: CanvasRenderingContext2D,
  usp: USPElement,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  highlight: boolean = false
) {
  const fontSize = usp.fontSize * scale;
  const paddingX = fontSize * 0.8;

  ctx.save();

  const style: BadgeStyle = usp.style;

  // Draw highlight ring if element is being hovered/dragged
  if (highlight) {
    ctx.strokeStyle = "rgba(124, 58, 237, 0.9)";
    ctx.lineWidth = 3 * scale;
    ctx.setLineDash([6 * scale, 4 * scale]);
    ctx.beginPath();
    ctx.roundRect(x - 4 * scale, y - 4 * scale, width + 8 * scale, height + 8 * scale, 6 * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw background
  if (style !== "minimal") {
    ctx.globalAlpha = usp.bgOpacity;

    if (style === "outline") {
      ctx.strokeStyle = usp.bgColor;
      ctx.lineWidth = 2 * scale;
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = usp.bgColor;
    }

    const radius = style === "pill" ? height / 2 : style === "square" ? 0 : 8 * scale;

    if (style === "ribbon") {
      // Ribbon style: extends slightly beyond with a ribbon tail
      const ribbonExtra = 12 * scale;
      ctx.beginPath();
      ctx.moveTo(x - ribbonExtra, y);
      ctx.lineTo(x + width + ribbonExtra, y);
      ctx.lineTo(x + width + ribbonExtra, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width - ribbonExtra / 2, y + height - height * 0.15);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x - ribbonExtra, y + height);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      if (radius > 0) {
        ctx.roundRect(x, y, width, height, radius);
      } else {
        ctx.rect(x, y, width, height);
      }

      if (style === "outline") {
        ctx.stroke();
      } else {
        ctx.fill();
      }
    }
  }

  // Draw text
  ctx.globalAlpha = 1;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = usp.textColor;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const displayText = usp.icon ? `${usp.icon}  ${usp.text}` : usp.text;
  ctx.fillText(displayText, x + paddingX, y + height / 2);

  ctx.restore();
}

// --- Element Bounds (for hit-testing) ---

export interface ElementBounds {
  id: string;
  type: "usp" | "logo";
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes bounding boxes for all overlay elements in canvas-space coordinates.
 * Used for hit-testing during drag operations.
 */
export async function computeElementBounds(
  canvas: HTMLCanvasElement,
  baseImageSrc: string,
  usps: USPElement[],
  logos: LogoElement[]
): Promise<ElementBounds[]> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  // We need the base image dimensions to know the canvas size
  const baseImage = await loadImage(baseImageSrc);
  const canvasWidth = baseImage.naturalWidth;
  const canvasHeight = baseImage.naturalHeight;
  const scale = Math.min(canvasWidth, canvasHeight) / 800;

  const bounds: ElementBounds[] = [];

  // Logos
  for (const logo of logos) {
    try {
      const logoImage = await loadImage(logo.preview);
      const logoWidth = logo.size * scale;
      const logoHeight = (logoImage.naturalHeight / logoImage.naturalWidth) * logoWidth;
      const { x, y } = resolvePosition(
        logo.position,
        canvasWidth,
        canvasHeight,
        logoWidth,
        logoHeight,
        logo.offsetX * scale,
        logo.offsetY * scale
      );
      bounds.push({ id: logo.id, type: "logo", x, y, width: logoWidth, height: logoHeight });
    } catch {
      // Skip logos that fail to load
    }
  }

  // USPs
  for (const usp of usps) {
    const { width, height } = measureUSP(ctx, usp, scale);
    const { x, y } = resolvePosition(
      usp.position,
      canvasWidth,
      canvasHeight,
      width,
      height,
      usp.offsetX * scale,
      usp.offsetY * scale
    );
    bounds.push({ id: usp.id, type: "usp", x, y, width, height });
  }

  return bounds;
}

/**
 * Hit-tests a point (in canvas coordinates) against element bounds.
 * Returns the topmost element hit, or null.
 * Searches in reverse order (USPs drawn last are on top).
 */
export function hitTest(
  bounds: ElementBounds[],
  canvasX: number,
  canvasY: number
): ElementBounds | null {
  // Search in reverse so topmost (last drawn) elements are found first
  for (let i = bounds.length - 1; i >= 0; i--) {
    const b = bounds[i];
    if (
      canvasX >= b.x &&
      canvasX <= b.x + b.width &&
      canvasY >= b.y &&
      canvasY <= b.y + b.height
    ) {
      return b;
    }
  }
  return null;
}

/**
 * Renders the complete infographic to a canvas element.
 * @param highlightId - Optional element ID to highlight (for drag/hover feedback)
 */
export async function renderInfographic(
  canvas: HTMLCanvasElement,
  baseImageSrc: string,
  usps: USPElement[],
  logos: LogoElement[],
  overlayDimming: number,
  highlightId?: string | null
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Load base image
  const baseImage = await loadImage(baseImageSrc);

  // Set canvas size to match image
  canvas.width = baseImage.naturalWidth;
  canvas.height = baseImage.naturalHeight;

  // Scale factor based on image size (for responsive element sizing)
  const scale = Math.min(canvas.width, canvas.height) / 800;

  // Draw base image
  ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

  // Apply dimming overlay if any
  if (overlayDimming > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${overlayDimming})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw logos
  for (const logo of logos) {
    try {
      const logoImage = await loadImage(logo.preview);
      const logoWidth = logo.size * scale;
      const logoHeight = (logoImage.naturalHeight / logoImage.naturalWidth) * logoWidth;

      const { x, y } = resolvePosition(
        logo.position,
        canvas.width,
        canvas.height,
        logoWidth,
        logoHeight,
        logo.offsetX * scale,
        logo.offsetY * scale
      );

      ctx.save();

      // Highlight ring for hovered/dragged logo
      if (highlightId === logo.id) {
        ctx.strokeStyle = "rgba(124, 58, 237, 0.9)";
        ctx.lineWidth = 3 * scale;
        ctx.setLineDash([6 * scale, 4 * scale]);
        ctx.beginPath();
        ctx.roundRect(
          x - 4 * scale,
          y - 4 * scale,
          logoWidth + 8 * scale,
          logoHeight + 8 * scale,
          6 * scale
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.globalAlpha = logo.opacity;
      ctx.drawImage(logoImage, x, y, logoWidth, logoHeight);
      ctx.restore();
    } catch {
      // Skip logos that fail to load
      console.warn(`Failed to load logo: ${logo.id}`);
    }
  }

  // Draw USPs
  for (const usp of usps) {
    const { width, height } = measureUSP(ctx, usp, scale);
    const { x, y } = resolvePosition(
      usp.position,
      canvas.width,
      canvas.height,
      width,
      height,
      usp.offsetX * scale,
      usp.offsetY * scale
    );
    drawUSP(ctx, usp, x, y, width, height, scale, highlightId === usp.id);
  }
}

/**
 * Exports the canvas to a data URL.
 */
export function exportCanvasToDataURL(canvas: HTMLCanvasElement, format: "png" | "jpeg" = "png"): string {
  return canvas.toDataURL(`image/${format}`, format === "jpeg" ? 0.95 : undefined);
}

/**
 * Returns the renderer scale for a given canvas.
 */
export function getRendererScale(canvasWidth: number, canvasHeight: number): number {
  return Math.min(canvasWidth, canvasHeight) / 800;
}

/**
 * Creates a default USP element.
 */
export function createDefaultUSP(text: string = "Premium Quality", icon: string = "⭐"): USPElement {
  return {
    id: `usp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    position: "top-left",
    style: "pill",
    fontSize: 18,
    textColor: "#FFFFFF",
    bgColor: "#000000",
    bgOpacity: 0.8,
    icon,
    offsetX: 0,
    offsetY: 0,
  };
}

/**
 * Creates a default Logo element.
 */
export function createDefaultLogo(file: File, preview: string): LogoElement {
  return {
    id: `logo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    preview,
    position: "bottom-right",
    size: 80,
    opacity: 1,
    offsetX: 0,
    offsetY: 0,
  };
}
