"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Download,
  Loader2,
  Sparkles,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Palette,
  Filter,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSwatchImage } from "@/lib/gemini";
import type { VTONStore } from "@/store/vton-store";
import type { SwatchResult, SwatchShape } from "@/lib/types";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function applyShapeMask(
  img: HTMLImageElement,
  shape: SwatchShape,
  outputSize: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  } else if (shape === "rounded") {
    const r = outputSize * 0.12;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(outputSize - r, 0);
    ctx.quadraticCurveTo(outputSize, 0, outputSize, r);
    ctx.lineTo(outputSize, outputSize - r);
    ctx.quadraticCurveTo(outputSize, outputSize, outputSize - r, outputSize);
    ctx.lineTo(r, outputSize);
    ctx.quadraticCurveTo(0, outputSize, 0, outputSize - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(img, 0, 0, outputSize, outputSize);
  return canvas.toDataURL("image/png");
}

function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("resource_exhausted"))
    return "Rate limit reached — too many requests. Wait a moment and retry.";
  if (lower.includes("quota") || lower.includes("billing"))
    return "API quota exceeded. Check your Gemini billing or try again later.";
  if (lower.includes("safety") || lower.includes("blocked") || lower.includes("recitation"))
    return "Content was blocked by safety filters. Try a different garment image.";
  if (lower.includes("timeout") || lower.includes("deadline"))
    return "Request timed out. The server may be overloaded — retry shortly.";
  if (lower.includes("invalid") && lower.includes("key"))
    return "Invalid API key. Check your Gemini API key in the Configure step.";
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch"))
    return "Network error. Check your internet connection and retry.";
  if (lower.includes("no swatch image"))
    return "Model returned no image. This can happen with some garment photos — retry usually works.";
  if (raw.length > 120)
    return raw.slice(0, 117) + "...";
  return raw;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function StepSwatchGenerate({ store }: { store: VTONStore }) {
  const {
    swatchImages,
    swatchShape,
    swatchSize,
    swatchResults,
    setSwatchResults,
    updateSwatchResult,
    apiKey,
    isSwatchGenerating,
    setIsSwatchGenerating,
  } = store;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const processOneWithRetry = useCallback(
    async (resultId: string, sourceFile: File) => {
      updateSwatchResult(resultId, { status: "generating", error: undefined });

      let lastError = "";
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await delay(RETRY_DELAY_MS * attempt);
        }
        try {
          const generated = await generateSwatchImage({
            apiKey,
            imageFile: sourceFile,
            shape: swatchShape,
            size: swatchSize,
          });

          const img = await loadImage(generated.swatchDataUrl);
          const finalDataUrl = applyShapeMask(img, swatchShape, swatchSize);

          updateSwatchResult(resultId, {
            status: "completed",
            swatchDataUrl: finalDataUrl,
            dominantColors: generated.dominantColors,
            patternDescription: generated.patternDescription,
            error: undefined,
          });
          return;
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Unknown error";
        }
      }

      updateSwatchResult(resultId, {
        status: "error",
        error: friendlyError(lastError),
      });
    },
    [apiKey, swatchShape, swatchSize, updateSwatchResult]
  );

  const generateSwatches = useCallback(async () => {
    if (isSwatchGenerating || !apiKey) return;
    setIsSwatchGenerating(true);

    const initialResults: SwatchResult[] = swatchImages.map((img) => ({
      id: `result-${img.id}`,
      sourceImageId: img.id,
      sourceImageName: img.name,
      sourceImagePreview: img.preview,
      swatchDataUrl: "",
      dominantColors: [],
      patternDescription: "",
      status: "pending",
    }));

    setSwatchResults(initialResults);
    setShowFailedOnly(false);

    const concurrency = 7;
    for (let i = 0; i < initialResults.length; i += concurrency) {
      const batch = initialResults.slice(i, i + concurrency);
      await Promise.all(
        batch.map((result) => {
          const srcImage = swatchImages.find((img) => img.id === result.sourceImageId);
          if (!srcImage) return Promise.resolve();
          return processOneWithRetry(result.id, srcImage.file);
        })
      );
    }

    setIsSwatchGenerating(false);
  }, [
    isSwatchGenerating,
    apiKey,
    swatchImages,
    setSwatchResults,
    setIsSwatchGenerating,
    processOneWithRetry,
  ]);

  const retryOne = useCallback(
    async (resultId: string) => {
      const result = swatchResults.find((r) => r.id === resultId);
      if (!result) return;
      const srcImage = swatchImages.find((img) => img.id === result.sourceImageId);
      if (!srcImage) return;
      await processOneWithRetry(resultId, srcImage.file);
    },
    [swatchResults, swatchImages, processOneWithRetry]
  );

  const retryAllFailed = useCallback(async () => {
    const failed = swatchResults.filter((r) => r.status === "error");
    if (failed.length === 0) return;

    setRetryingFailed(true);

    const concurrency = 7;
    for (let i = 0; i < failed.length; i += concurrency) {
      const batch = failed.slice(i, i + concurrency);
      await Promise.all(
        batch.map((result) => {
          const srcImage = swatchImages.find((img) => img.id === result.sourceImageId);
          if (!srcImage) return Promise.resolve();
          return processOneWithRetry(result.id, srcImage.file);
        })
      );
    }

    setRetryingFailed(false);
  }, [swatchResults, swatchImages, processOneWithRetry]);

  const downloadSwatch = useCallback((result: SwatchResult) => {
    const a = document.createElement("a");
    a.href = result.swatchDataUrl;
    a.download = `swatch-${result.sourceImageName}.png`;
    a.click();
  }, []);

  const downloadAll = useCallback(async () => {
    const completed = swatchResults.filter((r) => r.status === "completed" && r.swatchDataUrl);
    if (completed.length === 0) return;

    if (completed.length === 1) {
      downloadSwatch(completed[0]);
      return;
    }

    setDownloadingZip(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const result of completed) {
        try {
          const resp = await fetch(result.swatchDataUrl);
          const blob = await resp.blob();
          zip.file(`swatch-${result.sourceImageName}.png`, blob);
        } catch {
          // skip files that fail to fetch
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `swatches-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      // fallback: download individually
      for (const result of completed) {
        downloadSwatch(result);
      }
    } finally {
      setDownloadingZip(false);
    }
  }, [swatchResults, downloadSwatch]);

  const completedCount = swatchResults.filter((r) => r.status === "completed").length;
  const errorCount = swatchResults.filter((r) => r.status === "error").length;
  const generatingCount = swatchResults.filter((r) => r.status === "generating" || r.status === "pending").length;

  const visibleResults = showFailedOnly
    ? swatchResults.filter((r) => r.status === "error")
    : swatchResults;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Generation Summary
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-2xl font-bold text-foreground">{swatchImages.length}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
              Garments
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-2xl font-bold text-foreground capitalize">{swatchShape}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
              Shape
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-2xl font-bold text-foreground">{swatchSize}px</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
              Size
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={generateSwatches}
            disabled={isSwatchGenerating || retryingFailed || swatchImages.length === 0}
            className="flex-1 gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md transition-colors duration-200"
          >
            {isSwatchGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating{generatingCount > 0 ? ` (${completedCount + errorCount}/${swatchResults.length})` : "..."}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {swatchResults.length > 0 ? "Regenerate All" : "Generate Swatches"}
              </>
            )}
          </Button>

          {completedCount > 1 && !isSwatchGenerating && (
            <Button
              variant="outline"
              onClick={downloadAll}
              disabled={downloadingZip}
              className="gap-2 rounded-lg"
            >
              {downloadingZip ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
              {downloadingZip ? "Zipping..." : `Download All (${completedCount})`}
            </Button>
          )}
        </div>
      </div>

      {/* Progress + Actions bar */}
      {swatchResults.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {completedCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {completedCount} completed
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                {errorCount} failed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {errorCount > 0 && !isSwatchGenerating && (
              <>
                <button
                  onClick={() => setShowFailedOnly((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                    showFailedOnly
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Filter className="w-3 h-3" />
                  {showFailedOnly ? "Show All" : "Show Failed"}
                </button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={retryAllFailed}
                  disabled={retryingFailed}
                  className="gap-1.5 h-7 text-[11px] rounded-lg border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  {retryingFailed ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  Retry All Failed ({errorCount})
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Results Grid */}
      {visibleResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleResults.map((result) => (
            <div
              key={result.id}
              className={cn(
                "rounded-xl border bg-card overflow-hidden",
                result.status === "error"
                  ? "border-red-200 dark:border-red-900/50"
                  : "border-border"
              )}
            >
              {/* Source + Swatch side by side */}
              <div className="flex gap-0">
                {/* Source image */}
                <div className="w-1/2 aspect-square bg-muted/30 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.sourceImagePreview}
                    alt={result.sourceImageName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1.5 left-1.5">
                    <span className="text-[11px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                      Source
                    </span>
                  </div>
                </div>

                {/* Swatch result */}
                <div className="w-1/2 aspect-square flex items-center justify-center bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] dark:bg-[repeating-conic-gradient(#374151_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] relative">
                  {result.status === "generating" && (
                    <div className="flex flex-col items-center gap-2 text-center p-4">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Palette className="w-3 h-3" />
                        Generating swatch...
                      </span>
                    </div>
                  )}

                  {result.status === "pending" && (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}

                  {result.status === "completed" && result.swatchDataUrl && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.swatchDataUrl}
                        alt={`Swatch - ${result.sourceImageName}`}
                        className="w-full h-full object-contain p-2"
                      />
                      <div className="absolute bottom-1.5 right-1.5">
                        <span className="text-[11px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                          Swatch
                        </span>
                      </div>
                    </>
                  )}

                  {result.status === "error" && (
                    <div className="flex flex-col items-center gap-2 text-center p-3">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                      <span className="text-[11px] text-red-400 leading-tight">
                        {result.error || "Generation failed"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info bar */}
              <div className="px-4 py-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {result.sourceImageName}
                    </p>
                    {result.patternDescription && result.status === "completed" && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {result.patternDescription}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {result.status === "completed" && (
                      <button
                        onClick={() => downloadSwatch(result)}
                        className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Download swatch"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {result.status === "error" && !retryingFailed && (
                      <button
                        onClick={() => retryOne(result.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-red-500 hover:text-red-600 transition-colors"
                        title="Retry this swatch"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Color swatches */}
                {result.dominantColors.length > 0 && result.status === "completed" && (
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === result.id ? null : result.id)
                    }
                    className="mt-2 flex items-center gap-1"
                  >
                    {result.dominantColors.map((color, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-full border border-border shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <span className="text-[11px] text-muted-foreground ml-1">
                      {result.dominantColors.length} color{result.dominantColors.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                )}

                {/* Expanded color details */}
                {expandedId === result.id && result.dominantColors.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {result.dominantColors.map((color, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 rounded-lg bg-muted/30 px-2 py-1"
                      >
                        <div
                          className="w-3 h-3 rounded-sm border border-border"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {color}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
