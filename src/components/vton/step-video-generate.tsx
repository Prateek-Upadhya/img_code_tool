"use client";

import { useCallback, useState } from "react";
import {
  Play,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Video,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { generateVideoPrompt, generateVideoExtensionPrompt } from "@/lib/gemini";
import { fileToBase64Cached } from "@/lib/image-downscale";
import {
  VIDEO_THEME_OPTIONS,
  VIDEO_CAMERA_MOVEMENT_OPTIONS,
  VIDEO_MODEL_MOVEMENT_OPTIONS,
} from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { VideoGeneratedResult, VideoGenerationStatus } from "@/lib/types";

// Downscales large source images before base64-encoding (shared cache with the
// image-gen path). See src/lib/image-downscale.ts.
function fileToBase64(file: File): Promise<string> {
  return fileToBase64Cached(file);
}

function isRetryableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("deadline") ||
    lower.includes("unavailable") ||
    lower.includes("503") ||
    lower.includes("timeout") ||
    lower.includes("resource_exhausted") ||
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("internal") ||
    lower.includes("overloaded")
  );
}

function friendlyVideoError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("resource_exhausted"))
    return "Rate limit reached — too many requests. Wait a moment and retry.";
  if (lower.includes("quota") || lower.includes("billing"))
    return "API quota exceeded. Check your Gemini billing or try again later.";
  if (lower.includes("safety") || lower.includes("blocked") || lower.includes("filtered"))
    return "Content blocked by safety filters. Try different reference images.";
  if (lower.includes("deadline") || lower.includes("timeout") || lower.includes("unavailable"))
    return "Server timed out (likely overloaded). Will auto-retry — or retry manually.";
  if (lower.includes("invalid") && lower.includes("key"))
    return "Invalid API key. Check your Gemini API key in the Settings step.";
  if (lower.includes("no videos returned"))
    return "No video was returned. This can happen intermittently — retry usually works.";
  if (raw.length > 140) return raw.slice(0, 137) + "...";
  return raw;
}

const STATUS_LABELS: Record<VideoGenerationStatus, string> = {
  pending: "Pending",
  "generating-prompt": "Generating prompt...",
  "generating-extension-prompt": "Generating extension prompt...",
  "submitting-video": "Submitting to Veo...",
  "processing-video": "Generating video...",
  "extending-video": "Extending video...",
  downloading: "Downloading video...",
  "auto-retrying": "Retrying...",
  completed: "Completed",
  error: "Error",
};

function VideoResultCard({
  result,
  onRetry,
}: {
  result: VideoGeneratedResult;
  onRetry: (id: string) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const isActive =
    result.status !== "pending" &&
    result.status !== "completed" &&
    result.status !== "error";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-colors duration-300",
        result.status === "completed"
          ? "border-emerald-500/30"
          : result.status === "error"
          ? "border-destructive/30"
          : isActive
          ? "border-primary/30"
          : "border-border"
      )}
    >
      {/* Video Preview / Status */}
      <div className="aspect-video bg-muted/30 relative flex items-center justify-center">
        {result.status === "completed" && result.videoDataUrl ? (
          <video
            src={result.videoDataUrl}
            controls
            className="w-full h-full object-contain"
            preload="metadata"
          />
        ) : result.status === "error" ? (
          <div className="flex flex-col items-center gap-2 text-destructive/70 px-4 text-center">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs">{result.error || "Generation failed"}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {isActive && (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            )}
            <span className="text-xs text-muted-foreground">
              {STATUS_LABELS[result.status]}
            </span>
          </div>
        )}

        {/* Source image thumbnail */}
        {result.sourceImagePreview && (
          <div className="absolute top-2 left-2 w-10 h-10 rounded-lg overflow-hidden border border-white/20 shadow-sm">
            <img
              src={result.sourceImagePreview}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Badge
            variant={
              result.status === "completed"
                ? "default"
                : result.status === "error"
                ? "destructive"
                : "secondary"
            }
            className="text-[11px]"
          >
            {STATUS_LABELS[result.status]}
          </Badge>
          <div className="flex items-center gap-1">
            {result.status === "completed" && result.videoDataUrl && (
              <a
                href={result.videoDataUrl}
                download={`product-video-${result.id}.mp4`}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
            {result.status === "error" && (
              <button
                onClick={() => onRetry(result.id)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Expandable prompt */}
        {result.prompt && (
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPrompt ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {showPrompt ? "Hide prompt" : "Show prompt"}
          </button>
        )}
        {showPrompt && result.prompt && (
          <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
            {result.prompt}
          </div>
        )}
      </div>
    </div>
  );
}

function SingleModeGenerate({ store }: { store: VTONStore }) {
  const {
    videoProductCategory,
    videoGender,
    videoProductImages,
    videoProductInfo,
    videoTheme,
    videoCameraMovements,
    videoModelMovements,
    videoBackground,
    videoSelectedModel,
    videoModelImage,
    videoAspectRatio,
    videoVeoModel,
    videoResolution,
    videoDuration,
    videoNumberOfResults,
    videoGenerateAudio,
    videoNegativePrompt,
    videoAdditionalInfo,
    apiKey,
    videoResults,
    setVideoResults,
    updateVideoResult,
    isVideoGenerating,
    setIsVideoGenerating,
  } = store;

  const themeOption = VIDEO_THEME_OPTIONS.find((t) => t.value === videoTheme);
  const camOptions = videoCameraMovements.map(
    (m) => VIDEO_CAMERA_MOVEMENT_OPTIONS.find((c) => c.value === m)!
  ).filter(Boolean);
  const modelMoveOptions = videoModelMovements.map(
    (m) => VIDEO_MODEL_MOVEMENT_OPTIONS.find((c) => c.value === m)!
  ).filter(Boolean);

  const needsExtension = videoDuration > 8;
  const splitIdx = needsExtension ? Math.ceil(camOptions.length / 2) : camOptions.length;
  const baseCamOptions = camOptions.slice(0, splitIdx);
  const extCamOptions = needsExtension ? camOptions.slice(splitIdx) : [];

  const baseCamLabels = baseCamOptions.map((c) => c.label).join(" + ");
  const baseCamDescriptions = baseCamOptions.map((c) => `"${c.label}" — ${c.description}`).join("; then transitions to ");
  const extCamLabels = extCamOptions.map((c) => c.label).join(" + ");
  const extCamDescriptions = extCamOptions.map((c) => `"${c.label}" — ${c.description}`).join("; then transitions to ");

  const mmSplitIdx = needsExtension ? Math.ceil(modelMoveOptions.length / 2) : modelMoveOptions.length;
  const baseModelMoveOptions = modelMoveOptions.slice(0, mmSplitIdx);
  const extModelMoveOptions = needsExtension ? modelMoveOptions.slice(mmSplitIdx) : [];

  const baseModelMoveLabels = baseModelMoveOptions.map((c) => c.label).join(" + ");
  const baseModelMoveDescriptions = baseModelMoveOptions.map((c) => `"${c.label}" — ${c.description}`).join("; then transitions to ");
  const extModelMoveLabels = extModelMoveOptions.map((c) => c.label).join(" + ");
  const extModelMoveDescriptions = extModelMoveOptions.map((c) => `"${c.label}" — ${c.description}`).join("; then transitions to ");

  const generateAll = useCallback(async () => {
    if (isVideoGenerating || videoProductImages.length === 0) return;
    setIsVideoGenerating(true);

    const initialResults: VideoGeneratedResult[] = Array.from(
      { length: videoNumberOfResults },
      (_, i) => ({
        id: `vr-${Date.now()}-${i}`,
        sourceImageId: videoProductImages[0].id,
        sourceImagePreview: videoProductImages[0].preview,
        prompt: "",
        videoDataUrl: "",
        status: "pending" as const,
      })
    );
    setVideoResults(initialResults);

    for (const result of initialResults) {
      let attempts = 0;
      const maxRetries = 2;
      while (attempts <= maxRetries) {
        try {
          if (attempts > 0) {
            const backoffMs = 5000 * attempts;
            updateVideoResult(result.id, { status: "auto-retrying", error: undefined });
            await new Promise((r) => setTimeout(r, backoffMs));
          }

          updateVideoResult(result.id, { status: "generating-prompt" });
          const { text: prompt } = await generateVideoPrompt({
            apiKey,
            productCategory: videoProductCategory,
            gender: videoGender,
            productImages: videoProductImages.map((img) => ({
              file: img.file,
              preview: img.preview,
            })),
            productInfo: videoProductInfo,
            theme: themeOption?.label ?? videoTheme,
            themeKeywords: themeOption?.keywords ?? "",
            cameraMovement: baseCamLabels,
            cameraMovementDescription: baseCamDescriptions,
            modelMovement: baseModelMoveLabels,
            modelMovementDescription: baseModelMoveDescriptions,
            background: videoBackground,
            model: videoSelectedModel,
            modelImage: videoModelImage,
            aspectRatio: videoAspectRatio,
            duration: needsExtension ? 8 : videoDuration,
            totalDuration: videoDuration,
            negativePrompt: videoNegativePrompt,
            additionalInfo: videoAdditionalInfo,
          });
          updateVideoResult(result.id, { prompt, status: needsExtension ? "generating-extension-prompt" : "submitting-video" });

          let extensionPromptText: string | undefined;
          if (needsExtension) {
            const { text: extText } = await generateVideoExtensionPrompt({
              apiKey,
              basePrompt: prompt,
              extensionCameraMovement: extCamLabels,
              extensionCameraMovementDescription: extCamDescriptions,
              extensionModelMovement: extModelMoveLabels,
              extensionModelMovementDescription: extModelMoveDescriptions,
              theme: themeOption?.label ?? videoTheme,
              themeKeywords: themeOption?.keywords ?? "",
              duration: videoDuration - 8,
              productCategory: videoProductCategory,
              gender: videoGender,
              productInfo: videoProductInfo,
              additionalInfo: videoAdditionalInfo,
            });
            extensionPromptText = extText;
            updateVideoResult(result.id, { status: "submitting-video" });
          }

          const imagesToSend = videoProductImages.slice(0, 3);
          const refImages = await Promise.all(
            imagesToSend.map(async (img) => ({
              base64: await fileToBase64(img.file),
              mimeType: img.file.type,
              referenceType: "asset" as const,
            }))
          );

          const effectiveResolution = needsExtension ? "720p" : videoResolution;

          const apiResponse = await fetch("/api/veo/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey,
              prompt,
              veoModel: videoVeoModel,
              referenceImages: refImages,
              ...(needsExtension && {
                extensionSeconds: videoDuration - 8,
                extensionPrompt: extensionPromptText,
              }),
              config: {
                aspectRatio: videoAspectRatio,
                resolution: effectiveResolution,
                durationSeconds: videoDuration,
                negativePrompt: videoNegativePrompt || undefined,
              },
            }),
          });

          updateVideoResult(result.id, {
            status: needsExtension ? "extending-video" : "processing-video",
          });

          if (!apiResponse.ok) {
            const err = await apiResponse.json();
            throw new Error(err.error || "Video generation failed");
          }

          const data = await apiResponse.json();
          if (!data.videos || data.videos.length === 0) {
            throw new Error("No videos returned");
          }

          updateVideoResult(result.id, { status: "downloading" });
          const downloadResponse = await fetch("/api/veo/poll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey,
              videoUri: data.videos[0].videoUri,
            }),
          });

          if (!downloadResponse.ok) {
            const err = await downloadResponse.json();
            throw new Error(err.error || "Video download failed");
          }

          const downloadData = await downloadResponse.json();
          const videoDataUrl = `data:${downloadData.mimeType};base64,${downloadData.videoBase64}`;

          updateVideoResult(result.id, {
            videoDataUrl,
            status: "completed",
          });
          break;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          if (attempts < maxRetries && isRetryableError(message)) {
            attempts++;
            continue;
          }
          updateVideoResult(result.id, { status: "error", error: friendlyVideoError(message) });
          break;
        }
      }
    }

    setIsVideoGenerating(false);
  }, [
    isVideoGenerating,
    videoProductImages,
    videoProductCategory,
    videoGender,
    videoProductInfo,
    videoTheme,
    videoCameraMovements,
    videoBackground,
    videoSelectedModel,
    videoModelImage,
    videoAspectRatio,
    videoResolution,
    videoDuration,
    videoNumberOfResults,
    videoGenerateAudio,
    videoNegativePrompt,
    videoAdditionalInfo,
    apiKey,
    themeOption,
    baseCamLabels,
    baseCamDescriptions,
    extCamLabels,
    extCamDescriptions,
    needsExtension,
    setVideoResults,
    updateVideoResult,
    setIsVideoGenerating,
  ]);

  const handleRetry = useCallback(
    async (id: string) => {
      const result = videoResults.find((r) => r.id === id);
      if (!result) return;

      setIsVideoGenerating(true);
      let attempts = 0;
      const maxRetries = 2;

      while (attempts <= maxRetries) {
        try {
          if (attempts > 0) {
            const backoffMs = 5000 * attempts;
            updateVideoResult(id, { status: "auto-retrying", error: undefined });
            await new Promise((r) => setTimeout(r, backoffMs));
          }

          updateVideoResult(id, { status: "generating-prompt", error: undefined });

          const { text: prompt } = await generateVideoPrompt({
            apiKey,
            productCategory: videoProductCategory,
            gender: videoGender,
            productImages: videoProductImages.map((img) => ({
              file: img.file,
              preview: img.preview,
            })),
            productInfo: videoProductInfo,
            theme: themeOption?.label ?? videoTheme,
            themeKeywords: themeOption?.keywords ?? "",
            cameraMovement: baseCamLabels,
            cameraMovementDescription: baseCamDescriptions,
            modelMovement: baseModelMoveLabels,
            modelMovementDescription: baseModelMoveDescriptions,
            background: videoBackground,
            model: videoSelectedModel,
            modelImage: videoModelImage,
            aspectRatio: videoAspectRatio,
            duration: needsExtension ? 8 : videoDuration,
            totalDuration: videoDuration,
            negativePrompt: videoNegativePrompt,
            additionalInfo: videoAdditionalInfo,
          });
          updateVideoResult(id, { prompt, status: needsExtension ? "generating-extension-prompt" : "submitting-video" });

          let retryExtPrompt: string | undefined;
          if (needsExtension) {
            const { text: extText } = await generateVideoExtensionPrompt({
              apiKey,
              basePrompt: prompt,
              extensionCameraMovement: extCamLabels,
              extensionCameraMovementDescription: extCamDescriptions,
              extensionModelMovement: extModelMoveLabels,
              extensionModelMovementDescription: extModelMoveDescriptions,
              theme: themeOption?.label ?? videoTheme,
              themeKeywords: themeOption?.keywords ?? "",
              duration: videoDuration - 8,
              productCategory: videoProductCategory,
              gender: videoGender,
              productInfo: videoProductInfo,
              additionalInfo: videoAdditionalInfo,
            });
            retryExtPrompt = extText;
            updateVideoResult(id, { status: "submitting-video" });
          }

          const imagesToSend = videoProductImages.slice(0, 3);
          const refImages = await Promise.all(
            imagesToSend.map(async (img) => ({
              base64: await fileToBase64(img.file),
              mimeType: img.file.type,
              referenceType: "asset" as const,
            }))
          );

          const retryResolution = needsExtension ? "720p" : videoResolution;

          const apiResponse = await fetch("/api/veo/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey,
              prompt,
              veoModel: videoVeoModel,
              referenceImages: refImages,
              ...(needsExtension && {
                extensionSeconds: videoDuration - 8,
                extensionPrompt: retryExtPrompt,
              }),
              config: {
                aspectRatio: videoAspectRatio,
                resolution: retryResolution,
                durationSeconds: videoDuration,
                negativePrompt: videoNegativePrompt || undefined,
              },
            }),
          });

          updateVideoResult(id, {
            status: needsExtension ? "extending-video" : "processing-video",
          });
          if (!apiResponse.ok) {
            const err = await apiResponse.json();
            throw new Error(err.error || "Video generation failed");
          }
          const data = await apiResponse.json();
          if (!data.videos || data.videos.length === 0)
            throw new Error("No videos returned");

          updateVideoResult(id, { status: "downloading" });
          const downloadResponse = await fetch("/api/veo/poll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey, videoUri: data.videos[0].videoUri }),
          });
          if (!downloadResponse.ok) {
            const err = await downloadResponse.json();
            throw new Error(err.error || "Video download failed");
          }
          const downloadData = await downloadResponse.json();
          updateVideoResult(id, {
            videoDataUrl: `data:${downloadData.mimeType};base64,${downloadData.videoBase64}`,
            status: "completed",
          });
          break;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          if (attempts < maxRetries && isRetryableError(message)) {
            attempts++;
            continue;
          }
          updateVideoResult(id, {
            status: "error",
            error: friendlyVideoError(message),
          });
          break;
        }
      }

      setIsVideoGenerating(false);
    },
    [
      videoResults,
      videoProductImages,
      videoProductCategory,
      videoGender,
      videoProductInfo,
      videoTheme,
      videoCameraMovements,
      videoBackground,
      videoSelectedModel,
      videoModelImage,
      videoAspectRatio,
      videoResolution,
      videoDuration,
      videoNumberOfResults,
      videoGenerateAudio,
      videoNegativePrompt,
      videoAdditionalInfo,
      apiKey,
      themeOption,
      baseCamLabels,
      baseCamDescriptions,
      extCamLabels,
      extCamDescriptions,
      needsExtension,
      updateVideoResult,
      setIsVideoGenerating,
    ]
  );

  const completedCount = videoResults.filter(
    (r) => r.status === "completed"
  ).length;
  const errorCount = videoResults.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold mb-3">Generation Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block">Products</span>
            <span className="font-medium">
              {videoProductImages.length} reference image
              {videoProductImages.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Videos</span>
            <span className="font-medium">
              {videoNumberOfResults}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Theme</span>
            <span className="font-medium">{themeOption?.label ?? videoTheme}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Camera</span>
            <span className="font-medium">
              {needsExtension
                ? `${baseCamLabels}${extCamLabels ? ` → ${extCamLabels}` : ""}`
                : baseCamLabels}
            </span>
          </div>
          {modelMoveOptions.length > 0 && (
            <div>
              <span className="text-muted-foreground block">Model Movement</span>
              <span className="font-medium">
                {needsExtension
                  ? `${baseModelMoveLabels}${extModelMoveLabels ? ` → ${extModelMoveLabels}` : ""}`
                  : baseModelMoveLabels}
              </span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground block">Output</span>
            <span className="font-medium">
              {videoAspectRatio} &middot; {videoDuration > 8 ? "720p" : videoResolution} &middot;{" "}
              {videoDuration}s{videoDuration > 8 && ` (8s + ${videoDuration - 8}s ext)`}
            </span>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      {videoResults.length === 0 && (
        <div className="flex justify-center">
          <Button
            onClick={generateAll}
            disabled={isVideoGenerating || videoProductImages.length === 0}
            size="lg"
            className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
          >
            {isVideoGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate Videos
          </Button>
        </div>
      )}

      {/* Progress */}
      {videoResults.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {completedCount > 0 && (
              <Badge
                variant="default"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              >
                <Check className="w-3 h-3 mr-1" />
                {completedCount} completed
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="destructive" className="text-[11px]">
                {errorCount} failed
              </Badge>
            )}
            {isVideoGenerating && (
              <Badge variant="secondary" className="text-[11px]">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Generating...
              </Badge>
            )}
          </div>
          {!isVideoGenerating && videoResults.length > 0 && (
            <Button
              onClick={generateAll}
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg text-xs"
            >
              <RefreshCw className="w-3 h-3" />
              Regenerate All
            </Button>
          )}
        </div>
      )}

      {/* Results Grid */}
      {videoResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videoResults.map((result) => (
            <VideoResultCard
              key={result.id}
              result={result}
              onRetry={handleRetry}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BulkModeGenerate({ store }: { store: VTONStore }) {
  const {
    videoProductCategory,
    videoGender,
    videoTheme,
    videoCameraMovements,
    videoModelMovements,
    videoBackground,
    videoSelectedModel,
    videoModelImage,
    videoAspectRatio,
    videoVeoModel,
    videoResolution,
    videoDuration,
    videoNumberOfResults,
    videoGenerateAudio,
    videoNegativePrompt,
    videoAdditionalInfo,
    apiKey,
    videoBulkCombinations,
    videoBulkResults,
    setVideoBulkResults,
    updateVideoBulkResult,
    isVideoGenerating,
    setIsVideoGenerating,
  } = store;

  const themeOption = VIDEO_THEME_OPTIONS.find((t) => t.value === videoTheme);
  const camOptions = videoCameraMovements.map(
    (m) => VIDEO_CAMERA_MOVEMENT_OPTIONS.find((c) => c.value === m)!
  ).filter(Boolean);
  const modelMoveOptions = videoModelMovements.map(
    (m) => VIDEO_MODEL_MOVEMENT_OPTIONS.find((c) => c.value === m)!
  ).filter(Boolean);

  const needsExtension = videoDuration > 8;
  const splitIdx = needsExtension ? Math.ceil(camOptions.length / 2) : camOptions.length;
  const baseCamOptions = camOptions.slice(0, splitIdx);
  const extCamOptions = needsExtension ? camOptions.slice(splitIdx) : [];

  const baseCamLabels = baseCamOptions.map((c) => c.label).join(" + ");
  const baseCamDescriptions = baseCamOptions.map((c) => `"${c.label}" — ${c.description}`).join("; then transitions to ");
  const extCamLabels = extCamOptions.map((c) => c.label).join(" + ");
  const extCamDescriptions = extCamOptions.map((c) => `"${c.label}" — ${c.description}`).join("; then transitions to ");

  const mmSplitIdx = needsExtension ? Math.ceil(modelMoveOptions.length / 2) : modelMoveOptions.length;
  const baseModelMoveOptions = modelMoveOptions.slice(0, mmSplitIdx);
  const extModelMoveOptions = needsExtension ? modelMoveOptions.slice(mmSplitIdx) : [];

  const baseModelMoveLabels = baseModelMoveOptions.map((c) => c.label).join(" + ");
  const baseModelMoveDescriptions = baseModelMoveOptions.map((c) => `"${c.label}" — ${c.description}`).join("; then transitions to ");
  const extModelMoveLabels = extModelMoveOptions.map((c) => c.label).join(" + ");
  const extModelMoveDescriptions = extModelMoveOptions.map((c) => `"${c.label}" — ${c.description}`).join("; then transitions to ");

  const generateSingleBulkResult = useCallback(
    async (resultId: string, combo: typeof videoBulkCombinations[number]) => {
      let attempts = 0;
      const maxRetries = 2;

      while (attempts <= maxRetries) {
        try {
          if (attempts > 0) {
            const backoffMs = 5000 * attempts;
            updateVideoBulkResult(resultId, { status: "auto-retrying", error: undefined });
            await new Promise((r) => setTimeout(r, backoffMs));
          }

          updateVideoBulkResult(resultId, { status: "generating-prompt" });
          const bgConfig = combo.background ?? videoBackground;

          const folderImages = combo.primaryFolder.images;
          const { text: prompt } = await generateVideoPrompt({
            apiKey,
            productCategory: videoProductCategory,
            gender: videoGender,
            productImages: folderImages.map((img) => ({
              file: img.file,
              preview: img.preview,
            })),
            productInfo: combo.primaryFolder.productInfo ?? "",
            theme: themeOption?.label ?? videoTheme,
            themeKeywords: themeOption?.keywords ?? "",
            cameraMovement: baseCamLabels,
            cameraMovementDescription: baseCamDescriptions,
            modelMovement: baseModelMoveLabels,
            modelMovementDescription: baseModelMoveDescriptions,
            background: bgConfig,
            model: videoSelectedModel,
            modelImage: videoModelImage,
            aspectRatio: videoAspectRatio,
            duration: needsExtension ? 8 : videoDuration,
            totalDuration: videoDuration,
            negativePrompt: videoNegativePrompt,
            additionalInfo: videoAdditionalInfo,
          });
          updateVideoBulkResult(resultId, { prompt, status: needsExtension ? "generating-extension-prompt" : "submitting-video" });

          let bulkExtPrompt: string | undefined;
          if (needsExtension) {
            const { text: extText } = await generateVideoExtensionPrompt({
              apiKey,
              basePrompt: prompt,
              extensionCameraMovement: extCamLabels,
              extensionCameraMovementDescription: extCamDescriptions,
              extensionModelMovement: extModelMoveLabels,
              extensionModelMovementDescription: extModelMoveDescriptions,
              theme: themeOption?.label ?? videoTheme,
              themeKeywords: themeOption?.keywords ?? "",
              duration: videoDuration - 8,
              productCategory: videoProductCategory,
              gender: videoGender,
              productInfo: combo.primaryFolder.productInfo ?? "",
              additionalInfo: videoAdditionalInfo,
            });
            bulkExtPrompt = extText;
            updateVideoBulkResult(resultId, { status: "submitting-video" });
          }

          const imagesToSend = folderImages.slice(0, 3);
          const refImages = await Promise.all(
            imagesToSend.map(async (img) => ({
              base64: await fileToBase64(img.file),
              mimeType: img.file.type,
              referenceType: "asset" as const,
            }))
          );

          const effectiveResolution = needsExtension ? "720p" : videoResolution;
          const apiResponse = await fetch("/api/veo/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey,
              prompt,
              veoModel: videoVeoModel,
              referenceImages: refImages,
              ...(needsExtension && {
                extensionSeconds: videoDuration - 8,
                extensionPrompt: bulkExtPrompt,
              }),
              config: {
                aspectRatio: videoAspectRatio,
                resolution: effectiveResolution,
                durationSeconds: videoDuration,
                negativePrompt: videoNegativePrompt || undefined,
              },
            }),
          });

          updateVideoBulkResult(resultId, {
            status: needsExtension ? "extending-video" : "processing-video",
          });
          if (!apiResponse.ok) {
            const err = await apiResponse.json();
            throw new Error(err.error || "Video generation failed");
          }
          const data = await apiResponse.json();
          if (!data.videos?.length) throw new Error("No videos returned");

          updateVideoBulkResult(resultId, { status: "downloading" });
          const downloadResponse = await fetch("/api/veo/poll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey, videoUri: data.videos[0].videoUri }),
          });
          if (!downloadResponse.ok) {
            const err = await downloadResponse.json();
            throw new Error(err.error || "Download failed");
          }
          const downloadData = await downloadResponse.json();
          updateVideoBulkResult(resultId, {
            videoDataUrl: `data:${downloadData.mimeType};base64,${downloadData.videoBase64}`,
            status: "completed",
          });
          break;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          if (attempts < maxRetries && isRetryableError(message)) {
            attempts++;
            continue;
          }
          updateVideoBulkResult(resultId, {
            status: "error",
            error: friendlyVideoError(message),
          });
          break;
        }
      }
    },
    [
      videoBulkCombinations,
      videoProductCategory,
      videoGender,
      videoTheme,
      videoBackground,
      videoSelectedModel,
      videoModelImage,
      videoAspectRatio,
      videoVeoModel,
      videoResolution,
      videoDuration,
      videoNegativePrompt,
      videoAdditionalInfo,
      apiKey,
      themeOption,
      baseCamLabels,
      baseCamDescriptions,
      extCamLabels,
      extCamDescriptions,
      baseModelMoveLabels,
      baseModelMoveDescriptions,
      extModelMoveLabels,
      extModelMoveDescriptions,
      needsExtension,
      updateVideoBulkResult,
    ]
  );

  const generateAll = useCallback(async () => {
    if (isVideoGenerating || videoBulkCombinations.length === 0) return;
    setIsVideoGenerating(true);

    const allResults = videoBulkCombinations.flatMap((combo) =>
      Array.from({ length: videoNumberOfResults }, (_, i) => ({
        id: `vbr-${combo.id}-${i}-${Date.now()}`,
        combinationId: combo.id,
        combinationLabel: combo.primaryFolder.name,
        sourceImageId: combo.primaryFolder.images[0]?.id ?? "",
        sourceImagePreview: combo.primaryFolder.images[0]?.preview ?? "",
        prompt: "",
        videoDataUrl: "",
        status: "pending" as const,
      }))
    );
    setVideoBulkResults(allResults);

    for (const result of allResults) {
      const combo = videoBulkCombinations.find(
        (c) => c.id === result.combinationId
      );
      if (!combo) continue;
      await generateSingleBulkResult(result.id, combo);
    }

    setIsVideoGenerating(false);
  }, [
    isVideoGenerating,
    videoBulkCombinations,
    videoNumberOfResults,
    generateSingleBulkResult,
    setVideoBulkResults,
    setIsVideoGenerating,
  ]);

  const handleRetry = useCallback(
    async (id: string) => {
      const result = videoBulkResults.find((r) => r.id === id);
      if (!result) return;
      const combo = videoBulkCombinations.find((c) => c.id === result.combinationId);
      if (!combo) return;

      setIsVideoGenerating(true);
      await generateSingleBulkResult(id, combo);
      setIsVideoGenerating(false);
    },
    [videoBulkResults, videoBulkCombinations, generateSingleBulkResult, setIsVideoGenerating]
  );

  const completedCount = videoBulkResults.filter(
    (r) => r.status === "completed"
  ).length;
  const errorCount = videoBulkResults.filter((r) => r.status === "error").length;
  const totalVideos = videoBulkCombinations.length * videoNumberOfResults;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold mb-3">Bulk Generation Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block">Products</span>
            <span className="font-medium">{videoBulkCombinations.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Total Videos</span>
            <span className="font-medium">{totalVideos} ({videoNumberOfResults} per product)</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Theme</span>
            <span className="font-medium">{themeOption?.label}</span>
          </div>
          {modelMoveOptions.length > 0 && (
            <div>
              <span className="text-muted-foreground block">Model Movement</span>
              <span className="font-medium">
                {modelMoveOptions.map((m) => m.label).join(", ")}
              </span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground block">Output</span>
            <span className="font-medium">
              {videoAspectRatio} &middot; {videoDuration > 8 ? "720p" : videoResolution} &middot;{" "}
              {videoDuration}s{videoDuration > 8 && ` (8s + ${videoDuration - 8}s ext)`}
            </span>
          </div>
        </div>
      </div>

      {videoBulkResults.length === 0 && (
        <div className="flex justify-center">
          <Button
            onClick={generateAll}
            disabled={isVideoGenerating || videoBulkCombinations.length === 0}
            size="lg"
            className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
          >
            {isVideoGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate All Videos ({totalVideos} total)
          </Button>
        </div>
      )}

      {videoBulkResults.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {completedCount > 0 && (
                <Badge
                  variant="default"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                >
                  <Check className="w-3 h-3 mr-1" />
                  {completedCount}/{videoBulkResults.length} completed
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="text-[11px]">
                  {errorCount} failed
                </Badge>
              )}
              {isVideoGenerating && (
                <Badge variant="secondary" className="text-[11px]">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Generating...
                </Badge>
              )}
            </div>
            {!isVideoGenerating && videoBulkResults.length > 0 && (
              <Button
                onClick={generateAll}
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-lg text-xs"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate All
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {videoBulkResults.map((result) => (
              <VideoResultCard
                key={result.id}
                result={result as unknown as VideoGeneratedResult}
                onRetry={handleRetry}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function StepVideoGenerate({ store }: { store: VTONStore }) {
  const { mode } = store;
  return (
    <div className="space-y-6">
      {mode === "bulk" ? (
        <BulkModeGenerate store={store} />
      ) : (
        <SingleModeGenerate store={store} />
      )}
    </div>
  );
}
