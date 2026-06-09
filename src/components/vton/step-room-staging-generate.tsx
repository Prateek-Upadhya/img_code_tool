"use client";

import { useCallback, useRef, useState } from "react";
import { Download, Loader2, Check, AlertCircle, RotateCcw, Sparkles, ShieldCheck, ShieldAlert, ChevronDown, ChevronRight, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { generateRoomStagingPrompt, generateRoomStagingImage, validateGeneratedImage } from "@/lib/gemini";
import type { VTONStore } from "@/store/vton-store";
import type { RoomStagingResult, RoomStagingBulkResult, StepCost, ValidationStatus } from "@/lib/types";
import { InfographicEditor } from "./infographic-editor";

function StatusIcon({ status }: { status: RoomStagingResult["status"] }) {
  switch (status) {
    case "pending": return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />;
    case "generating-prompt": return <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />;
    case "generating-image": return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case "auto-retrying": return <RotateCcw className="w-5 h-5 text-primary animate-spin" />;
    case "completed": return <Check className="w-5 h-5 text-emerald-500" />;
    case "error": return <AlertCircle className="w-5 h-5 text-destructive" />;
  }
}

function statusLabel(status: RoomStagingResult["status"]) {
  switch (status) {
    case "pending": return "Waiting...";
    case "generating-prompt": return "Generating prompt with Gemini 3.1 Pro...";
    case "generating-image": return "Generating image with Nano Banana 2...";
    case "auto-retrying": return "Auto-retrying...";
    case "completed": return "Completed";
    case "error": return "Failed";
  }
}

function ValidationBadge({ status, message }: { status?: ValidationStatus; message?: string }) {
  if (!status || status === "idle") return null;
  if (status === "validating") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-sm px-2 py-1 border border-border">
            <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Validating</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs"><p className="text-xs text-muted-foreground">Checking product fidelity...</p></TooltipContent>
      </Tooltip>
    );
  }
  if (status === "passed") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-emerald-500/10 backdrop-blur-sm px-2 py-1 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Verified</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs"><p className="text-xs text-muted-foreground">{message || "Product matches well"}</p></TooltipContent>
      </Tooltip>
    );
  }
  if (status === "warning") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-amber-500/10 backdrop-blur-sm px-2 py-1 border border-amber-500/30">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Mismatch</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs"><p className="text-xs text-muted-foreground">{message || "Product may not match"}</p></TooltipContent>
      </Tooltip>
    );
  }
  return null;
}

export function StepRoomStagingGenerate({ store }: { store: VTONStore }) {
  const {
    mode, apiKey,
    roomStagingCategory, roomHomeDecorType, roomFurnitureType,
    roomHomeDecorSubType, roomFurnitureSubType,
    roomProductShape, roomProductDimensions,
    roomProductImages, roomProductInfo,
    roomStylingProps,
    roomSelectedRoomStyle, roomInspirationImage,
    roomDescription, roomBackground,
    roomSelectedShots, roomAspectRatio, roomImageQuality, setRoomImageQuality,
    roomAdditionalInfo,
    roomResults, setRoomResults, updateRoomResult,
    isRoomStagingGenerating, setIsRoomStagingGenerating,
    roomPrimaryFolders, roomBulkRoomSettings, roomBulkBackgrounds,
    roomBulkCombinations,
    roomBulkResults, setRoomBulkResults, updateRoomBulkResult,
    skipValidation,
  } = store;

  const skipValidationRef = useRef(skipValidation);
  skipValidationRef.current = skipValidation;

  const isBulk = mode === "bulk";
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [infographicTarget, setInfographicTarget] = useState<{ resultId: string; imageData: string; resultType: "single" | "bulk" } | null>(null);
  const [validationFilter, setValidationFilter] = useState<"all" | "verified" | "mismatched">("all");

  const togglePrompt = (id: string) => setExpandedPrompts((prev) => ({ ...prev, [id]: !prev[id] }));

  const isHomeDecor = roomStagingCategory === "home-decor";
  const productTypeLabel = isHomeDecor ? roomHomeDecorType.replace(/-/g, " ") : roomFurnitureType.replace(/-/g, " ");
  const subTypeLabel = (isHomeDecor ? roomHomeDecorSubType : roomFurnitureSubType)?.replace(/-/g, " ") ?? "";

  // --- Single Mode Generation ---
  const handleGenerateSingle = useCallback(async () => {
    if (isRoomStagingGenerating || roomSelectedShots.length === 0) return;
    setIsRoomStagingGenerating(true);

    const initialResults: RoomStagingResult[] = roomSelectedShots.map((shot) => ({
      id: `rs-result-${shot.id}-${Date.now()}`,
      shotId: shot.id,
      shotName: shot.name,
      prompt: "",
      imageData: "",
      status: "pending",
    }));
    setRoomResults(initialResults);

    const concurrency = 5;
    let idx = 0;
    const runNext = async (): Promise<void> => {
      while (idx < initialResults.length) {
        const i = idx++;
        const result = initialResults[i];
        const shot = roomSelectedShots.find((s) => s.id === result.shotId)!;
        const collectedCosts: StepCost[] = [];
        let retrySteps: StepCost[] | undefined;

        const generate = async () => {
          collectedCosts.length = 0;
          updateRoomResult(result.id, { status: "generating-prompt", error: undefined });

          const promptResult = await generateRoomStagingPrompt({
            apiKey,
            category: roomStagingCategory,
            productType: isHomeDecor ? roomHomeDecorType : roomFurnitureType,
            subType: subTypeLabel,
            productShape: roomProductShape,
            productDimensions: roomProductDimensions,
            productImages: roomProductImages.map((i) => i.file),
            productInfo: roomProductInfo,
            stylingProps: roomStylingProps.map((p) => p.file),
            roomStyle: roomSelectedRoomStyle,
            roomInspirationImage: shot.requiresRoom ? roomInspirationImage : null,
            roomDescription,
            background: roomBackground,
            shot,
            aspectRatio: roomAspectRatio,
            additionalInfo: roomAdditionalInfo,
          });
          collectedCosts.push(promptResult.cost);

          updateRoomResult(result.id, { prompt: promptResult.text, status: "generating-image" });

          const imageResult = await generateRoomStagingImage({
            apiKey,
            prompt: promptResult.text,
            productImages: roomProductImages.map((i) => i.file),
            stylingProps: roomStylingProps.map((p) => p.file),
            roomInspirationImage: shot.requiresRoom ? roomInspirationImage : null,
            background: roomBackground,
            aspectRatio: roomAspectRatio,
            imageSize: roomImageQuality,
            isProductOnly: !shot.requiresRoom,
          });
          collectedCosts.push(imageResult.cost);

          updateRoomResult(result.id, { imageData: imageResult.imageData, status: "completed", validationStatus: skipValidationRef.current ? "skipped" : "validating" });

          if (skipValidationRef.current) return;
          validateGeneratedImage({
            apiKey,
            originalImages: roomProductImages.map((i) => i.file),
            generatedImageData: imageResult.imageData,
            validationMode: "room-staging",
          }).then((v) => {
            if (v.cost) collectedCosts.push(v.cost);
            const mainCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
            const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
            updateRoomResult(result.id, {
              validationStatus: v.status,
              validationMessage: v.message,
              costBreakdown: { steps: [...collectedCosts], totalCost: mainCost + retryCost, retrySteps },
            });
          });
        };

        try {
          await generate();
        } catch (err: any) {
          try {
            retrySteps = [...collectedCosts];
            updateRoomResult(result.id, { status: "auto-retrying", error: undefined });
            await new Promise((r) => setTimeout(r, 1000));
            await generate();
          } catch (err2: any) {
            updateRoomResult(result.id, { status: "error", error: err2?.message || "Generation failed" });
          }
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, initialResults.length) }, () => runNext()));
    setIsRoomStagingGenerating(false);
  }, [
    isRoomStagingGenerating, roomSelectedShots, roomProductImages, roomStylingProps,
    roomSelectedRoomStyle, roomInspirationImage, roomDescription, roomBackground,
    roomAspectRatio, roomImageQuality, roomAdditionalInfo, roomProductInfo,
    roomStagingCategory, roomHomeDecorType, roomFurnitureType, subTypeLabel,
    roomProductShape, roomProductDimensions, apiKey,
    setRoomResults, updateRoomResult, setIsRoomStagingGenerating,
  ]);

  const handleDownload = (imageData: string, name: string) => {
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `room-staging-${name}.png`;
    link.click();
  };

  const handleDownloadAll = useCallback(async () => {
    const completed = roomResults.filter((r) => r.status === "completed" && r.imageData);
    if (completed.length === 0) return;

    if (completed.length === 1) {
      handleDownload(completed[0].imageData, completed[0].shotName.toLowerCase().replace(/\s+/g, "-"));
      return;
    }

    let JSZip: any;
    try {
      JSZip = (await import("jszip")).default;
    } catch {
      return;
    }

    const zip = new JSZip();
    const timestamp = Date.now();

    for (const result of completed) {
      const safeName = result.shotName.replace(/[<>:"/\\|?*]+/g, "_").replace(/\s+/g, "-").toLowerCase();
      const [, base64Data] = result.imageData.match(/^data:[^;]+;base64,(.+)$/) ?? [null, null];
      if (base64Data) {
        zip.file(`${safeName}.png`, base64Data, { base64: true });
      }
      if (result.infographicImages?.length) {
        result.infographicImages.forEach((img, idx) => {
          const [, iBase64] = img.match(/^data:[^;]+;base64,(.+)$/) ?? [null, null];
          if (iBase64) zip.file(`${safeName}-infographic-${idx + 1}.png`, iBase64, { base64: true });
        });
      }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `room-staging-${timestamp}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [roomResults]);

  const handleRetrySingle = useCallback(async (resultId: string) => {
    const result = roomResults.find((r) => r.id === resultId);
    if (!result || isRoomStagingGenerating) return;
    setIsRoomStagingGenerating(true);

    const shot = roomSelectedShots.find((s) => s.id === result.shotId)!;
    const collectedCosts: StepCost[] = [];

    const previousFeedback = (result.validationStatus === "warning" || result.validationStatus === "error") && result.validationMessage
      ? result.validationMessage
      : undefined;

    try {
      updateRoomResult(result.id, { status: "generating-prompt", error: undefined, validationStatus: undefined, validationMessage: undefined });

      const promptResult = await generateRoomStagingPrompt({
        apiKey, category: roomStagingCategory, productType: isHomeDecor ? roomHomeDecorType : roomFurnitureType,
        subType: subTypeLabel, productShape: roomProductShape, productDimensions: roomProductDimensions,
        productImages: roomProductImages.map((i) => i.file), productInfo: roomProductInfo,
        stylingProps: roomStylingProps.map((p) => p.file),
        roomStyle: roomSelectedRoomStyle, roomInspirationImage: shot.requiresRoom ? roomInspirationImage : null,
        roomDescription, background: roomBackground, shot, aspectRatio: roomAspectRatio, additionalInfo: roomAdditionalInfo,
        previousMismatchFeedback: previousFeedback,
      });
      collectedCosts.push(promptResult.cost);
      updateRoomResult(result.id, { prompt: promptResult.text, status: "generating-image" });

      const imageResult = await generateRoomStagingImage({
        apiKey, prompt: promptResult.text, productImages: roomProductImages.map((i) => i.file),
        stylingProps: roomStylingProps.map((p) => p.file),
        roomInspirationImage: shot.requiresRoom ? roomInspirationImage : null,
        background: roomBackground, aspectRatio: roomAspectRatio, imageSize: roomImageQuality, isProductOnly: !shot.requiresRoom,
      });
      collectedCosts.push(imageResult.cost);
      updateRoomResult(result.id, { imageData: imageResult.imageData, status: "completed", validationStatus: skipValidationRef.current ? "skipped" : "validating" });

      if (!skipValidationRef.current) {
        validateGeneratedImage({ apiKey, originalImages: roomProductImages.map((i) => i.file), generatedImageData: imageResult.imageData, validationMode: "room-staging" }).then((v) => {
          if (v.cost) collectedCosts.push(v.cost);
          const totalCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          updateRoomResult(result.id, { validationStatus: v.status, validationMessage: v.message, costBreakdown: { steps: [...collectedCosts], totalCost } });
        });
      }
    } catch (err: any) {
      updateRoomResult(result.id, { status: "error", error: err?.message || "Retry failed" });
    }
    setIsRoomStagingGenerating(false);
  }, [roomResults, isRoomStagingGenerating, roomSelectedShots, roomProductImages, roomStylingProps, roomSelectedRoomStyle, roomInspirationImage, roomDescription, roomBackground, roomAspectRatio, roomImageQuality, roomAdditionalInfo, roomProductInfo, roomStagingCategory, roomHomeDecorType, roomFurnitureType, subTypeLabel, roomProductShape, roomProductDimensions, apiKey, updateRoomResult, setIsRoomStagingGenerating]);

  const handleRetryAllFailed = useCallback(async () => {
    const failed = roomResults.filter((r) => r.status === "error");
    if (failed.length === 0 || isRoomStagingGenerating) return;
    setIsRoomStagingGenerating(true);
    try {
      for (const r of failed) {
        await handleRetrySingle(r.id);
      }
    } finally {
      setIsRoomStagingGenerating(false);
    }
  }, [roomResults, isRoomStagingGenerating, handleRetrySingle, setIsRoomStagingGenerating]);

  const handleRetryAllMismatched = useCallback(async () => {
    const mismatched = roomResults.filter((r) => r.validationStatus === "warning" && r.status === "completed");
    if (mismatched.length === 0 || isRoomStagingGenerating) return;
    setIsRoomStagingGenerating(true);
    try {
      for (const r of mismatched) {
        await handleRetrySingle(r.id);
      }
    } finally {
      setIsRoomStagingGenerating(false);
    }
  }, [roomResults, isRoomStagingGenerating, handleRetrySingle, setIsRoomStagingGenerating]);

  const completedCount = roomResults.filter((r) => r.status === "completed").length;
  const errorCount = roomResults.filter((r) => r.status === "error").length;
  const mismatchCount = roomResults.filter((r) => r.validationStatus === "warning").length;
  const verifiedCount = roomResults.filter((r) => r.validationStatus === "passed").length;
  const totalCost = roomResults.reduce((sum, r) => sum + (r.costBreakdown?.totalCost ?? 0), 0);
  const hasAnyValidation = roomResults.some((r) => r.validationStatus === "passed" || r.validationStatus === "warning");

  const filterByValidation = <T extends { validationStatus?: ValidationStatus }>(items: T[]): T[] => {
    if (validationFilter === "all") return items;
    if (validationFilter === "verified") return items.filter((r) => r.validationStatus === "passed");
    return items.filter((r) => r.validationStatus === "warning");
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-medium mb-3">Generation Summary</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="text-muted-foreground">Category</div>
          <div className="font-medium capitalize">{roomStagingCategory.replace("-", " ")}</div>
          <div className="text-muted-foreground">Product Type</div>
          <div className="font-medium capitalize">{productTypeLabel}{subTypeLabel ? ` / ${subTypeLabel}` : ""}</div>
          <div className="text-muted-foreground">Product Images</div>
          <div className="font-medium">{isBulk ? `${roomPrimaryFolders.length} folders` : roomProductImages.length}</div>
          <div className="text-muted-foreground">Room Style</div>
          <div className="font-medium">{roomSelectedRoomStyle?.name ?? (roomInspirationImage ? "Custom photo" : "Default")}</div>
          <div className="text-muted-foreground">Shots</div>
          <div className="font-medium">{roomSelectedShots.length}</div>
          <div className="text-muted-foreground">Aspect Ratio</div>
          <div className="font-medium">{roomAspectRatio}</div>
        </div>
      </div>

      {/* Image Quality */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Image Quality</label>
        <div className="flex gap-2">
          {(["1K", "2K", "4K"] as const).map((q) => (
            <button
              key={q}
              onClick={() => setRoomImageQuality(q)}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-medium transition-all border",
                roomImageQuality === q
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              )}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={isBulk ? undefined : handleGenerateSingle}
        disabled={isRoomStagingGenerating || roomSelectedShots.length === 0 || !apiKey}
        className={cn(
          "w-full rounded-xl py-3 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2",
          isRoomStagingGenerating
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "btn-gradient text-white shadow-lg"
        )}
      >
        {isRoomStagingGenerating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Generate {roomSelectedShots.length} Shot{roomSelectedShots.length !== 1 ? "s" : ""}</>
        )}
      </button>

      {/* Progress & Actions */}
      {roomResults.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{completedCount}/{roomResults.length} completed</span>
          {errorCount > 0 && <span className="text-destructive">{errorCount} failed</span>}
          {totalCost > 0 && <span className="font-medium">${totalCost.toFixed(4)}</span>}
          <div className="ml-auto flex items-center gap-2">
            {!isRoomStagingGenerating && mismatchCount > 0 && (
              <button
                onClick={handleRetryAllMismatched}
                className="flex items-center gap-1 rounded-lg border border-amber-500/40 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-[11px] font-medium hover:bg-amber-500/10 transition-colors"
              >
                <ShieldAlert className="w-3 h-3" /> Retry {mismatchCount} Mismatched
              </button>
            )}
            {!isRoomStagingGenerating && errorCount > 0 && (
              <button
                onClick={handleRetryAllFailed}
                className="flex items-center gap-1 rounded-lg bg-destructive/10 text-destructive px-2.5 py-1.5 text-[11px] font-medium hover:bg-destructive/20 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Retry {errorCount} Failed
              </button>
            )}
            {!isRoomStagingGenerating && completedCount > 0 && (
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2.5 py-1.5 text-[11px] font-medium hover:bg-primary/20 transition-colors"
              >
                <Download className="w-3 h-3" /> Download All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Validation Filter */}
      {hasAnyValidation && (
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setValidationFilter("all")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                validationFilter === "all" ? "btn-gradient text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              All
            </button>
            <button
              onClick={() => setValidationFilter("verified")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 border-l border-border",
                validationFilter === "verified" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <ShieldCheck className="w-3 h-3" />
              Verified{verifiedCount > 0 && <span className="opacity-60">({verifiedCount})</span>}
            </button>
            <button
              onClick={() => setValidationFilter("mismatched")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 border-l border-border",
                validationFilter === "mismatched" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <ShieldAlert className="w-3 h-3" />
              Mismatched{mismatchCount > 0 && <span className="opacity-60">({mismatchCount})</span>}
            </button>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {roomResults.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {filterByValidation(roomResults).map((result) => (
            <div key={result.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="relative aspect-square bg-muted">
                {result.imageData ? (
                  <>
                    <img src={result.imageData} alt={result.shotName} className="w-full h-full object-cover" />
                    <ValidationBadge status={result.validationStatus} message={result.validationMessage} />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <StatusIcon status={result.status} />
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate">{result.shotName}</span>
                  <StatusIcon status={result.status} />
                </div>
                <p className="text-[10px] text-muted-foreground">{statusLabel(result.status)}</p>
                {result.error && <p className="text-[10px] text-destructive mt-1">{result.error}</p>}

                {result.prompt && (
                  <button onClick={() => togglePrompt(result.id)} className="text-[10px] text-primary mt-1 hover:underline">
                    {expandedPrompts[result.id] ? "Hide prompt" : "Show prompt"}
                  </button>
                )}
                {expandedPrompts[result.id] && result.prompt && (
                  <p className="text-[10px] text-muted-foreground mt-1 bg-muted rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">{result.prompt}</p>
                )}

                {result.status === "completed" && (
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => handleDownload(result.imageData, result.shotName.toLowerCase().replace(/\s+/g, "-"))}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-medium hover:bg-primary/20 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                    <button
                      onClick={() => setInfographicTarget({ resultId: result.id, imageData: result.imageData, resultType: "single" })}
                      className="flex items-center gap-1 rounded-lg bg-muted text-foreground px-2.5 py-1 text-[10px] font-medium hover:bg-muted/80 transition-colors"
                    >
                      Infographic
                    </button>
                  </div>
                )}
                {result.status === "error" && (
                  <button
                    onClick={() => handleRetrySingle(result.id)}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 text-destructive px-2.5 py-1 text-[10px] font-medium hover:bg-destructive/20 transition-colors mt-2"
                  >
                    <RotateCcw className="w-3 h-3" /> Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Infographic Editor */}
      {infographicTarget && (
        <InfographicEditor
          open={true}
          onOpenChange={(open) => { if (!open) setInfographicTarget(null); }}
          baseImageSrc={infographicTarget.imageData}
          poseName={
            (infographicTarget.resultType === "single"
              ? roomResults.find((r) => r.id === infographicTarget.resultId)?.shotName
              : roomBulkResults.find((r) => r.id === infographicTarget.resultId)?.shotName
            ) ?? "Room Staging"
          }
          productInfo={roomProductInfo}
          apiKey={apiKey}
          onSave={(dataUrl) => {
            if (infographicTarget.resultType === "single") {
              const existing = roomResults.find((r) => r.id === infographicTarget.resultId)?.infographicImages ?? [];
              updateRoomResult(infographicTarget.resultId, { infographicImages: [...existing, dataUrl] });
            } else {
              const existing = roomBulkResults.find((r) => r.id === infographicTarget.resultId)?.infographicImages ?? [];
              updateRoomBulkResult(infographicTarget.resultId, { infographicImages: [...existing, dataUrl] });
            }
          }}
        />
      )}
    </div>
  );
}
