"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wand2,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Layers,
  FolderOpen,
  Users,
  Grid3X3,
  RefreshCw,
  RotateCcw,
  Palette,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Info,
  Filter,
  Eye,
  SkipForward,
  Pencil,
  Send,
  X,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, buildDynamicPoseSeed, pickBucketImage } from "@/lib/utils";
import { generateVTONPrompt, generateVTONImage, generateModelSwapPrompt, generateModelSwapImage, validateGeneratedImage, checkHumanVisibility, generateSetProductPrompt, generateSetProductImage, generateUGCPrompt, generateUGCImage, buildVTONImageContentParts, contextualRetryVTONImage, buildModelSwapImageContentParts, editModelSwapImage, analyzeBackgroundScene } from "@/lib/gemini";
import { generateVTONImageAzure } from "@/lib/azure-image";
import { FRAMING_OPTIONS, SET_LAYOUT_OPTIONS, AI_MODELS, TEXT_GEN_MODELS, IMAGE_GEN_MODELS } from "@/lib/constants";
import { ProviderPicker } from "./provider-picker";
import Image from "next/image";
import type { VTONStore } from "@/store/vton-store";
import { GLOBAL_ACCESSORY_POSE_ID } from "@/store/vton-store";
import type {
  AccessoryItem,
  BackgroundConfig,
  BulkCombination,
  BulkGeneratedResult,
  BulkPoseOverride,
  ComplementaryImage,
  CustomPose,
  EditHistoryEntry,
  GarmentImage,
  GeneratedResult,
  GenerationCostBreakdown,
  ModelImage,
  ModelSwapBulkResult,
  ModelSwapGeneratedResult,
  Pose,
  PoseFraming,
  SetBulkResult,
  StepCost,
  UGCGeneratedResult,
  ValidationStatus,
} from "@/lib/types";
import { InfographicEditor } from "./infographic-editor";
import { useState } from "react";

function getFramingShortLabel(framing: PoseFraming): string {
  return FRAMING_OPTIONS.find((f) => f.value === framing)?.shortLabel ?? framing;
}

function getBgShortLabel(bg: BackgroundConfig): string {
  if (bg.mode === "inspiration" && bg.inspirationImage) return "Image";
  if (bg.mode === "text" && bg.textDescription) {
    return bg.textDescription.length > 20
      ? bg.textDescription.slice(0, 20) + "..."
      : bg.textDescription;
  }
  return "Studio Default";
}

/**
 * Walks a counter past every value in `skipIndices` to compute the
 * skip-aware suffix number for the i-th file in a sequence.
 *
 * - 0-indexed mode: counter starts at 0; the 0th file with no skips returns 0
 *   (rendered as a bare prefix with no suffix), the 1st returns 1, etc.
 * - 1-indexed mode: counter starts at 1; the 0th file returns 1, etc.
 *
 * Skipped values are jumped over: skipIndices=[3] in 1-indexed mode produces
 * the sequence 1, 2, 4, 5, 6, ... for sequenceIndex 0, 1, 2, 3, 4, ...
 */
function computeSkipAwareCounter(
  sequenceIndex: number,
  oneIndexed: boolean,
  skipIndices: number[],
): number {
  const skipSet = new Set(skipIndices);
  let counter = oneIndexed ? 1 : 0;
  for (let i = 0; i < sequenceIndex; i++) {
    counter++;
    while (skipSet.has(counter)) counter++;
  }
  while (skipSet.has(counter)) counter++;
  return counter;
}

function getSequencedFileName(
  baseName: string,
  sequenceIndex: number,
  ext: string,
  oneIndexed = false,
  skipIndices: number[] = [],
): string {
  const safeName = baseName.replace(/[<>:"/\\|?*]+/g, "_");
  const counter = computeSkipAwareCounter(sequenceIndex, oneIndexed, skipIndices);
  // Both modes always carry a numeric suffix. In 0-indexed mode the first image
  // is `${safeName}_0` (never a bare `${safeName}`): this keeps the sequence
  // consistent and avoids the collision where a bare folder name inside a
  // folder-scoped ZIP duplicates its parent folder entry and gets dropped.
  return `${safeName}_${counter}.${ext}`;
}

function sortResultsByPoseSequence<T extends { pose: Pose }>(
  results: T[],
  selectedPoses: Pose[],
): T[] {
  const poseOrder = new Map(selectedPoses.map((p, i) => [p.id, i]));
  return [...results].sort(
    (a, b) => (poseOrder.get(a.pose.id) ?? 999) - (poseOrder.get(b.pose.id) ?? 999)
  );
}

function PoseMiniThumb({ poseId, icon, isFootwear, size = 24 }: { poseId: string; icon: string; isFootwear?: boolean; size?: number }) {
  const [err, setErr] = useState(false);
  if (isFootwear || err) {
    return <span className="shrink-0" style={{ fontSize: size * 0.7 }}>{icon}</span>;
  }
  return (
    <div className="shrink-0 rounded overflow-hidden bg-muted/30" style={{ width: size, height: size }}>
      <Image
        src={`/poses/${poseId}.png`}
        alt={poseId}
        width={size}
        height={size}
        className="object-cover w-full h-full"
        onError={() => setErr(true)}
        unoptimized
      />
    </div>
  );
}

function ModelThumb({ modelName, modelPreview, size = 24 }: { modelName: string; modelPreview?: string; size?: number }) {
  const preset = AI_MODELS.find((m) => m.name === modelName);
  if (modelPreview) {
    return (
      <div className="shrink-0 rounded-full overflow-hidden border border-primary/30" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={modelPreview} alt={modelName} className="object-cover w-full h-full" />
      </div>
    );
  }
  if (preset) {
    return <span className="shrink-0" style={{ fontSize: size * 0.75 }}>{preset.thumbnail}</span>;
  }
  return null;
}

const getStatusIcon = (status: GeneratedResult["status"] | BulkGeneratedResult["status"] | ModelSwapGeneratedResult["status"]) => {
  switch (status) {
    case "pending":
      return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />;
    case "checking-human":
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case "generating-prompt":
      return <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />;
    case "generating-image":
      return <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />;
    case "auto-retrying":
      return <RefreshCw className="w-5 h-5 text-primary animate-spin" />;
    case "editing":
      return <Pencil className="w-5 h-5 text-violet-500 animate-pulse" />;
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case "skipped":
      return <SkipForward className="w-5 h-5 text-blue-500" />;
    case "cancelled":
      return <X className="w-5 h-5 text-muted-foreground" />;
    case "error":
      return <AlertCircle className="w-5 h-5 text-red-500" />;
  }
};

const getStatusText = (status: GeneratedResult["status"] | BulkGeneratedResult["status"] | ModelSwapGeneratedResult["status"]) => {
  switch (status) {
    case "pending":
      return "Waiting...";
    case "checking-human":
      return "Checking for human model...";
    case "generating-prompt":
      return "Generating prompt with Gemini 3 Pro...";
    case "generating-image":
      return "Generating image with Nano Banana 2...";
    case "auto-retrying":
      return "Auto-retrying...";
    case "editing":
      return "Applying edit...";
    case "completed":
      return "Completed";
    case "skipped":
      return "Skipped — No model detected";
    case "cancelled":
      return "Cancelled — re-generate to retry";
    case "error":
      return "Error";
  }
};

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
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">Comparing output with original product images...</p>
        </TooltipContent>
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
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{message || "Product matches the original"}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "warning") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-amber-500/15 backdrop-blur-sm px-2.5 py-1 border border-amber-500/40 shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Mismatch</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Product mismatch detected</p>
          <p className="text-xs text-muted-foreground mt-0.5">{message || "The product may differ from the original. Consider regenerating."}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-sm px-2 py-1 border border-border">
            <ShieldQuestion className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs text-muted-foreground">Validation check could not be completed</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}

function formatCost(cost: number): string {
  if (cost < 0.0001) return "$0.0000";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(4)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function CostBreakdownPopover({ costBreakdown, skip = false }: { costBreakdown?: GenerationCostBreakdown; skip?: boolean }) {
  // When validation & cost tracking are disabled, suppress the cost UI entirely
  // (covers retry/edit paths that may still have populated a breakdown).
  if (skip || !costBreakdown) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="absolute top-2 left-2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-background/95 transition-colors">
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-semibold text-foreground">Generation Cost Breakdown</p>
        </div>
        <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
          {costBreakdown.steps.map((step, idx) => {
            const isImageGen = step.model === "gemini-3.1-flash-image-preview";
            return (
              <div key={idx} className="space-y-1.5">
                <p className="text-[11px] font-semibold text-foreground">{step.label}</p>
                <div className="rounded-lg bg-muted/50 p-2 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Input Tokens</span>
                    <span className="font-mono text-foreground">{formatTokens(step.tokens.inputTokens)}</span>
                  </div>
                  {!isImageGen && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Output Tokens</span>
                      <span className="font-mono text-foreground">{formatTokens(step.tokens.outputTokens)}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-1 mt-1 space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Input Cost</span>
                      <span className="font-mono text-foreground">{formatCost(step.inputCost)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{isImageGen ? "Image Output Cost" : "Output Cost"}</span>
                      <span className="font-mono text-foreground">
                        {formatCost(step.outputCost)}
                        {isImageGen && <span className="text-muted-foreground ml-0.5">(per image)</span>}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span className="text-foreground">Step Total</span>
                      <span className="font-mono text-foreground">{formatCost(step.totalCost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {costBreakdown.retrySteps && costBreakdown.retrySteps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Failed Attempt (Auto-Retry)</p>
              {costBreakdown.retrySteps.map((step, idx) => (
                <div key={`retry-${idx}`} className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2 space-y-1">
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">{step.label}</p>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Tokens (In / Out)</span>
                    <span className="font-mono text-foreground">{formatTokens(step.tokens.inputTokens)} / {formatTokens(step.tokens.outputTokens)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-mono text-amber-700 dark:text-amber-300">{formatCost(step.totalCost)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-foreground">Total Cost</span>
            <span className="text-sm font-bold font-mono text-primary">{formatCost(costBreakdown.totalCost)}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface StepGenerateProps {
  store: VTONStore;
}

export function StepGenerate({ store }: StepGenerateProps) {
  const {
    mode,
    featureMode,
    productCategory,
    gender,
    garmentImages,
    garmentType,
    footwearType,
    fit,
    sleeveLength,
    topwearLength,
    bottomwearLength,
    complementaryImages,
    poseAccessories,
    propBuckets,
    applyAccessoriesToAllPoses,
    background,
    selectedModel,
    modelImage,
    aspectRatio,
    selectedPoses,
    customPoses,
    additionalInfo,
    productInfo,
    apiKey,
    results,
    setResults,
    updateResult,
    isGenerating,
    setIsGenerating,
    isIngestingScene,
    setIsIngestingScene,
    beginGeneration,
    cancelGeneration,
    // Bulk
    primaryFolders,
    complementaryFolders,
    bulkModelImages,
    bulkBackgrounds,
    bulkBgAssignment,
    setBulkBgAssignment,
    setProductBgMapping,
    bulkCombinations,
    bulkResults,
    setBulkResults,
    updateBulkResult,
    // Bulk Pose Overrides
    bulkPoseOverrides,
    updateBulkPoseOverride,
    removeBulkPoseOverride,
    clearAllBulkPoseOverrides,
    clearProductBgPoseOverrides,
    // Model Swap
    modelSwapBgMode,
    modelSwapResults,
    setModelSwapResults,
    updateModelSwapResult,
    modelSwapBulkResults,
    setModelSwapBulkResults,
    updateModelSwapBulkResult,
    modelSwapBulkCombinations,
    // Set Product
    setProductEnabled,
    setProductLayout,
    setProductVariants,
    setProductFolders,
    setProductBulkCombinations,
    setProductResults,
    setSetProductResults,
    updateSetProductResult,
    // UGC
    ugcScenes,
    ugcResults,
    setUgcResults,
    updateUgcResult,
    // Sequencing & Naming
    singleDownloadPrefix,
    namingLogic,
    skipNamingIndicesText,
    // Validation / cost
    skipValidation,
  } = store;
  // Mirrored in a ref so the many async generation closures read the live value
  // without each having to thread `skipValidation` through its dependency array.
  const skipValidationRef = useRef(skipValidation);
  skipValidationRef.current = skipValidation;
  const { imageQuality, setImageQuality } = store;
  const { imageGenModel, setImageGenModel, textGenModel, setTextGenModel } = store;
  const isModelSwap = featureMode === "model-swap";
  // gpt-image-2 is selectable for ALL VTON flows (clothing + footwear), so we
  // route to Azure purely on the selected image model, not the category.
  const useAzure = imageGenModel === "gpt-image-2";

  // Parse the comma-separated user input into a deduped array of non-negative
  // integers. Any non-integer / negative tokens are silently dropped.
  const skipIndices = useMemo(
    () =>
      Array.from(
        new Set(
          skipNamingIndicesText
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n >= 0)
        )
      ),
    [skipNamingIndicesText]
  );

  /**
   * Routes the VTON image call to either Nano Banana 2 (Gemini) or Azure gpt-image-2,
   * depending on the user-selected model. Kept call-signature-identical to
   * `generateVTONImage` so existing call sites only need to swap the function name.
   * The Azure backend ignores params that don't apply (productCategory, isGhostMannequin,
   * isBackViewPose); those are Gemini-specific prompt-assembly hints.
   */
  const generateVTONImageRouted = useCallback(
    (args: Parameters<typeof generateVTONImage>[0]) => {
      if (useAzure) {
        return generateVTONImageAzure({
          prompt: args.prompt,
          garmentImages: args.garmentImages,
          complementaryImages: args.complementaryImages,
          accessories: args.accessories,
          modelImage: args.modelImage,
          aspectRatio: args.aspectRatio,
          imageSize: args.imageSize ?? "2K",
          isProductOnlyShot: args.isProductOnlyShot,
        });
      }
      return generateVTONImage(args);
    },
    [useAzure],
  );

  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [infographicImage, setInfographicImage] = useState<{
    src: string;
    poseName: string;
    resultId: string;
    resultType: "single" | "bulk" | "model-swap-single" | "model-swap-bulk" | "set-product";
  } | null>(null);
  const [expandedCombos, setExpandedCombos] = useState<Record<string, boolean>>({});
  const [validationFilter, setValidationFilter] = useState<"all" | "verified" | "mismatched">("all");
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const togglePrompt = (id: string) => {
    setExpandedPrompts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCombo = (id: string) => {
    setExpandedCombos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filterByValidation = <T extends { validationStatus?: ValidationStatus }>(items: T[]): T[] => {
    if (validationFilter === "all") return items;
    if (validationFilter === "verified") return items.filter((r) => r.validationStatus === "passed");
    return items.filter((r) => r.validationStatus === "warning");
  };

  const hasAnyValidation = (items: { validationStatus?: ValidationStatus }[]): boolean =>
    items.some((r) => r.validationStatus === "passed" || r.validationStatus === "warning");

  const validationFilterBar = (items: { validationStatus?: ValidationStatus }[]) => {
    if (!hasAnyValidation(items)) return null;
    const verifiedCount = items.filter((r) => r.validationStatus === "passed").length;
    const mismatchCount = items.filter((r) => r.validationStatus === "warning").length;

    return (
      <div className="flex items-center gap-1.5">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setValidationFilter("all")}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium transition-colors",
              validationFilter === "all"
                ? "btn-gradient text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            All
          </button>
          <button
            onClick={() => setValidationFilter("verified")}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 border-l border-border",
              validationFilter === "verified"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <ShieldCheck className="w-3 h-3" />
            Verified{verifiedCount > 0 && <span className="opacity-60">({verifiedCount})</span>}
          </button>
          <button
            onClick={() => setValidationFilter("mismatched")}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 border-l border-border",
              validationFilter === "mismatched"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <ShieldAlert className="w-3 h-3" />
            Mismatch{mismatchCount > 0 && <span className="opacity-60">({mismatchCount})</span>}
          </button>
        </div>
      </div>
    );
  };

  const hasModel = selectedModel !== null || modelImage !== null;
  const isFootwear = productCategory === "footwear";

  // ----------------------------------------------------------------------
  // Prop-bucket draw cache
  // ----------------------------------------------------------------------
  // Holds the ONE image drawn from each (product, bucket) pair so the pick is
  // fixed per product — every pose of a product that enables the bucket reuses
  // the same image, while different products draw independently. Keyed by
  // `${productKey}::${bucketId}`. A ref (not state) so the cache survives across
  // renders and retries without triggering re-renders.
  const bucketPickCacheRef = useRef<Map<string, { file: File; preview: string }>>(new Map());

  /**
   * Resolves bucket-backed accessories into concrete reference images.
   *
   * For each raw accessory that carries a `bucketId`, looks up the bucket in
   * `propBuckets`; draws one image (cached per `(productKey, bucketId)` so the
   * pick stays fixed for that product and consistent across retries) and returns
   * a NEW `AccessoryItem` with `image` populated. Accessories WITHOUT a
   * `bucketId` pass through unchanged. Bucket refs whose bucket is missing or
   * empty are dropped (no image to apply). The returned array is what should be
   * passed to BOTH the prompt call and the image-gen call so they reference the
   * same prop image.
   *
   * @param productKey Stable per-product identity. Single mode uses the constant
   *   `"single"` (one product → one draw per bucket); bulk mode passes the
   *   product folder id so each folder draws independently.
   */
  const materializeAccessories = useCallback(
    (rawAccessories: AccessoryItem[], productKey: string): AccessoryItem[] => {
      // Fold in the non-destructive "apply to all poses" global layer when the
      // flag is ON. Global items are ADDITIVE on top of this pose's own
      // selections, but de-duplicated so a prop the pose already chose isn't
      // applied twice (match on bucketId, or on non-custom category).
      let merged = rawAccessories;
      if (applyAccessoriesToAllPoses) {
        const globalAccs = poseAccessories[GLOBAL_ACCESSORY_POSE_ID] || [];
        const ownBucketIds = new Set(rawAccessories.map((a) => a.bucketId).filter(Boolean));
        const ownCategories = new Set(
          rawAccessories.filter((a) => !a.bucketId && a.category !== "custom").map((a) => a.category)
        );
        const extras = globalAccs.filter((a) => {
          if (a.bucketId) return !ownBucketIds.has(a.bucketId);
          if (a.category === "custom") return true;
          return !ownCategories.has(a.category);
        });
        merged = extras.length > 0 ? [...rawAccessories, ...extras] : rawAccessories;
      }

      const out: AccessoryItem[] = [];
      for (const acc of merged) {
        if (!acc.bucketId) {
          out.push(acc);
          continue;
        }
        const bucket = propBuckets.find((b) => b.id === acc.bucketId);
        if (!bucket || bucket.images.length === 0) continue; // missing/empty → drop
        // A global bucket draws ONE image per product (cacheKey is keyed only by
        // productKey + bucketId, not pose), so every pose of the product shares
        // the same sampled prop — consistent across poses.
        const cacheKey = `${productKey}::${acc.bucketId}`;
        let pick = bucketPickCacheRef.current.get(cacheKey);
        if (!pick) {
          const drawn = pickBucketImage(bucket);
          if (!drawn) continue;
          pick = drawn;
          bucketPickCacheRef.current.set(cacheKey, pick);
        }
        out.push({ ...acc, image: pick });
      }
      return out;
    },
    [propBuckets, applyAccessoriesToAllPoses, poseAccessories]
  );

  const resolveOverride = useCallback(
    (combo: BulkCombination, poseId: string) => {
      const override = bulkPoseOverrides.find(
        (o) => o.productFolderId === combo.primaryFolder.id && o.poseId === poseId
      );
      if (!override) return { model: combo.modelImage, bg: combo.background, cg: combo.complementaryFolder };

      const model = override.modelImageId
        ? bulkModelImages.find((m) => m.id === override.modelImageId) ?? combo.modelImage
        : combo.modelImage;
      const bg = override.backgroundId
        ? bulkBackgrounds.find((b) => b.id === override.backgroundId)?.config ?? combo.background
        : combo.background;
      const cg = override.complementaryFolderId !== undefined
        ? (override.complementaryFolderId === null
          ? null
          : complementaryFolders.find((f) => f.id === override.complementaryFolderId) ?? combo.complementaryFolder)
        : combo.complementaryFolder;

      return { model, bg, cg };
    },
    [bulkPoseOverrides, bulkModelImages, bulkBackgrounds, complementaryFolders]
  );

  const setProductBackground = useCallback(
    (productFolderId: string, bgId: string) => {
      if (bulkBgAssignment !== "manual") setBulkBgAssignment("manual");
      setProductBgMapping(productFolderId, bgId);
      clearProductBgPoseOverrides(productFolderId);
    },
    [bulkBgAssignment, setBulkBgAssignment, setProductBgMapping, clearProductBgPoseOverrides]
  );

  const overrideCount = bulkPoseOverrides.length;

  // ======================================================================
  // SINGLE MODE GENERATION
  // ======================================================================
  const handleGenerate = useCallback(async () => {
    const anyPresetNeedsModel = selectedPoses.some((p) => p.requiresModel !== false);
    const anyCustomNeedsModel = customPoses.some((cp) => cp.isModelShot);
    const anyPoseNeedsModel = anyPresetNeedsModel || anyCustomNeedsModel;
    if (anyPoseNeedsModel && !selectedModel && !modelImage) return;
    if ((selectedPoses.length === 0 && customPoses.length === 0 && ugcScenes.length === 0) || !apiKey) return;

    // Clear any leftover cancelled / errored results from a previous batch
    // before kicking off a fresh run.
    setResults([]);
    setUgcResults([]);

    const ctrl = beginGeneration();
    const signal = ctrl.signal;

    try {
    // ──────────────────────────────────────────────────────────────────
    // STEP 0 — Background scene pre-analysis (ONCE per batch).
    // When the user has uploaded an inspiration image, we run a single
    // Gemini 3.1 Pro pass to extract a structured WIDE-SHOT LAYOUT +
    // hex palette + forced-flat-lighting directive. The resulting
    // string is reused VERBATIM by every per-pose prompt-generation
    // call so the entire batch reads as the same physical photoshoot.
    // ──────────────────────────────────────────────────────────────────
    let frozenSceneDescription: string | undefined;
    // REPLICA MODE skips scene analysis entirely — the inspiration image is attached
    // directly to the image-gen call (see `generateVTONImageRouted` below) with an
    // exact-replication directive. Frozen-scene + flat-lighting overrides would
    // contradict the user's intent to reproduce the reference verbatim.
    const shouldAnalyzeScene =
      background.mode === "inspiration" &&
      !!background.inspirationImage &&
      background.imageReferenceMode !== "replica";
    if (shouldAnalyzeScene && background.inspirationImage) {
      setIsIngestingScene(true);
      try {
        const r = await analyzeBackgroundScene({
          apiKey,
          textGenModel,
          inspirationImage: background.inspirationImage,
          abortSignal: signal,
        });
        frozenSceneDescription = r.sceneDescription;
      } catch (err) {
        if (signal.aborted) {
          setIsIngestingScene(false);
          return;
        }
        console.warn("Background scene analysis failed; falling back to per-pose inspiration image:", err);
      } finally {
        setIsIngestingScene(false);
      }
    }

    if (signal.aborted) return;

    // Create results for preset poses
    const presetResults: GeneratedResult[] = selectedPoses.map((pose) => ({
      id: `result-${pose.id}-${Date.now()}`,
      prompt: "",
      imageData: "",
      pose,
      status: "pending",
    }));

    // Create a dummy Pose shell for custom poses (used for display/download purposes)
    const customResults: GeneratedResult[] = customPoses.map((cp) => ({
      id: `result-${cp.id}-${Date.now()}`,
      prompt: "",
      imageData: "",
      pose: {
        id: cp.id,
        name: cp.name || "Custom Pose",
        description: cp.description,
        icon: "\u2728",
        viewAngle: "front" as const,
        framing: "full-body" as const,
        garmentRelevance: [],
      },
      customPose: cp,
      status: "pending",
    }));

    const initialResults = [...presetResults, ...customResults];
    setResults(initialResults);

    // Create UGC results
    const initialUgcResults: UGCGeneratedResult[] = ugcScenes.map((scene) => ({
      id: `ugc-result-${scene.id}-${Date.now()}`,
      sceneId: scene.id,
      sceneName: scene.name || "UGC Scene",
      prompt: "",
      imageData: "",
      status: "pending",
    }));
    setUgcResults(initialUgcResults);

    const processPose = async (result: GeneratedResult) => {
      // If the user already cancelled before this slot started, mark as
      // cancelled without firing any network calls.
      if (signal.aborted) {
        updateResult(result.id, { status: "cancelled", error: "Cancelled by user" });
        return;
      }

      // Materialize bucket-backed accessories into concrete picks (fixed per
      // product — single mode has one product, so key on "single"). Done BEFORE
      // the dynamic-pose seed so the `hasProp` check below sees the drawn props.
      const accessories = materializeAccessories(poseAccessories[result.pose.id] || [], "single");
      const poseIsProductOnly = result.customPose
        ? !result.customPose.isModelShot
        : result.pose.requiresModel === false;
      const poseIsGhostMannequin = result.pose.framing === "ghost-mannequin";
      const collectedCosts: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      const generate = async () => {
        collectedCosts.length = 0;
        updateResult(result.id, { status: "generating-prompt", error: undefined });

        const promptResult = await generateVTONPrompt({
          apiKey,
          textGenModel,
          productCategory,
          gender,
          garmentImages,
          garmentType,
          footwearType,
          fit,
          sleeveLength,
          topwearLength,
          bottomwearLength,
          complementaryImages,
          accessories,
          background,
          model: poseIsProductOnly ? null : selectedModel,
          modelImage: poseIsProductOnly ? null : modelImage,
          pose: result.pose,
          customPose: result.customPose,
          aspectRatio,
          additionalInfo,
          productInfo,
          applyAccessoriesToAllPoses,
          targetImageModel: imageGenModel,
          frozenSceneDescription,
          // Fresh per-generation seed for Dynamic poses so the posture re-varies
          // on every call; undefined (ignored) for standard poses.
          dynamicSeed:
            result.pose.poseType === "dynamic"
              ? buildDynamicPoseSeed({
                  hasProp: accessories.length > 0 || complementaryImages.length > 0,
                })
              : undefined,
          abortSignal: signal,
        });
        collectedCosts.push(promptResult.cost);

        updateResult(result.id, { prompt: promptResult.text, status: "generating-image" });

        const imageResult = await generateVTONImageRouted({
          apiKey,
          prompt: promptResult.text,
          garmentImages,
          complementaryImages,
          accessories,
          modelImage: poseIsProductOnly ? null : modelImage,
          background,
          aspectRatio,
          productCategory,
          isProductOnlyShot: poseIsProductOnly,
          isGhostMannequin: poseIsGhostMannequin,
          isBackViewPose: result.pose.viewAngle === "back" || result.pose.viewAngle === "three-quarter-back",
          imageSize: imageQuality,
          abortSignal: signal,
        });
        collectedCosts.push(imageResult.cost);

        updateResult(result.id, {
          imageData: imageResult.imageData,
          status: "completed",
          validationStatus: skipValidationRef.current ? "skipped" : "validating",
          imageGenResponseContent: imageResult.responseContent,
          editHistory: [],
        });

        if (!skipValidationRef.current) {
          validateGeneratedImage({
            apiKey,
            textGenModel,
            originalImages: garmentImages.map((g) => g.file),
            generatedImageData: imageResult.imageData,
            productCategory,
            abortSignal: signal,
          }).then((v) => {
            if (v.cost) collectedCosts.push(v.cost);
            const mainCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
            const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
            updateResult(result.id, {
              validationStatus: v.status,
              validationMessage: v.message,
              costBreakdown: { steps: [...collectedCosts], totalCost: mainCost + retryCost, retrySteps },
            });
          });
        }
      };

      try {
        await generate();
      } catch {
        // If the cancel button was pressed, skip auto-retry — mark cancelled
        // and exit. Auto-retry on a cancellation would defeat the whole
        // purpose of the Stop button.
        if (signal.aborted) {
          updateResult(result.id, { status: "cancelled", error: "Cancelled by user" });
          return;
        }
        try {
          retrySteps = [...collectedCosts];
          updateResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          if (signal.aborted) {
            updateResult(result.id, { status: "cancelled", error: "Cancelled by user" });
            return;
          }
          await generate();
        } catch (retryError) {
          if (signal.aborted) {
            updateResult(result.id, { status: "cancelled", error: "Cancelled by user" });
            return;
          }
          const allCosts = [...(retrySteps || []), ...collectedCosts];
          const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
          updateResult(result.id, {
            status: "error",
            error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
            costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
          });
        }
      }
    };

    const CONCURRENCY_LIMIT = 7;
    for (let i = 0; i < initialResults.length; i += CONCURRENCY_LIMIT) {
      if (signal.aborted) break;
      const batch = initialResults.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(processPose));
    }

    // After the loop ends, sweep any results still in `pending` state and
    // mark them cancelled (this can happen when the user aborted partway
    // through the concurrency batches before those slots even started).
    // updateResult patches whatever the latest state has — `processPose`
    // already wrote `cancelled` to anything it actually touched, so this
    // is only an extra safety net for never-touched pending entries.
    if (signal.aborted) {
      setResults((prev) =>
        prev.map((r) =>
          r.status === "pending" ? { ...r, status: "cancelled", error: "Cancelled by user" } : r
        )
      );
    }

    // Process UGC scenes
    const processUgcScene = async (result: UGCGeneratedResult) => {
      if (signal.aborted) {
        updateUgcResult(result.id, { status: "cancelled", error: "Cancelled by user" });
        return;
      }
      const scene = ugcScenes.find((s) => s.id === result.sceneId);
      if (!scene) return;
      const collectedCosts: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      const generate = async () => {
        collectedCosts.length = 0;
        updateUgcResult(result.id, { status: "generating-prompt", error: undefined });

        const promptResult = await generateUGCPrompt({
          apiKey,
          textGenModel,
          productCategory,
          gender,
          garmentImages,
          garmentType,
          footwearType,
          complementaryImages,
          scene,
          aspectRatio,
          additionalInfo,
          productInfo,
        });
        collectedCosts.push(promptResult.cost);

        updateUgcResult(result.id, { prompt: promptResult.prompt, status: "generating-image" });

        const imageResult = await generateUGCImage({
          apiKey,
          prompt: promptResult.prompt,
          garmentImages,
          complementaryImages,
          sceneReferenceImages: scene.referenceImages.map((img) => img.file),
          aspectRatio,
          gender,
          productCategory,
          isSelfie: scene.shotType === "selfie",
          imageSize: imageQuality,
        });
        collectedCosts.push(imageResult.cost);

        const totalCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
        const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
        updateUgcResult(result.id, {
          imageData: imageResult.imageData,
          status: "completed",
          costBreakdown: { steps: [...collectedCosts], totalCost: totalCost + retryCost, retrySteps },
        });
      };

      try {
        await generate();
      } catch {
        if (signal.aborted) {
          updateUgcResult(result.id, { status: "cancelled", error: "Cancelled by user" });
          return;
        }
        try {
          retrySteps = [...collectedCosts];
          updateUgcResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          if (signal.aborted) {
            updateUgcResult(result.id, { status: "cancelled", error: "Cancelled by user" });
            return;
          }
          await generate();
        } catch (retryError) {
          if (signal.aborted) {
            updateUgcResult(result.id, { status: "cancelled", error: "Cancelled by user" });
            return;
          }
          const allCosts = [...(retrySteps || []), ...collectedCosts];
          const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
          updateUgcResult(result.id, {
            status: "error",
            error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
            costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
          });
        }
      }
    };

    const UGC_CONCURRENCY = 5;
    for (let i = 0; i < initialUgcResults.length; i += UGC_CONCURRENCY) {
      if (signal.aborted) break;
      const batch = initialUgcResults.slice(i, i + UGC_CONCURRENCY);
      await Promise.all(batch.map(processUgcScene));
    }

    if (signal.aborted) {
      setUgcResults((prev) =>
        prev.map((r) =>
          r.status === "pending" ? { ...r, status: "cancelled", error: "Cancelled by user" } : r
        )
      );
    }

    } finally {
      setIsGenerating(false);
    }
  }, [
    productCategory,
    selectedModel,
    selectedPoses,
    customPoses,
    ugcScenes,
    apiKey,
    gender,
    garmentImages,
    garmentType,
    footwearType,
    fit,
    sleeveLength,
    topwearLength,
    bottomwearLength,
    complementaryImages,
    poseAccessories,
    materializeAccessories,
    applyAccessoriesToAllPoses,
    background,
    modelImage,
    aspectRatio,
    additionalInfo,
    productInfo,
    imageQuality,
    imageGenModel,
    textGenModel,
    generateVTONImageRouted,
    setResults,
    updateResult,
    setUgcResults,
    updateUgcResult,
    setIsGenerating,
    setIsIngestingScene,
    beginGeneration,
  ]);

  // ======================================================================
  // BULK MODE GENERATION
  // ======================================================================
  const handleBulkGenerate = useCallback(async () => {
    const hasAnyPoses = selectedPoses.length > 0 || customPoses.length > 0;
    const hasUgc = ugcScenes.length > 0;
    if (bulkCombinations.length === 0 || (!hasAnyPoses && !hasUgc) || !apiKey) return;

    // Clear any leftover cancelled / errored results before kicking off a fresh batch.
    setBulkResults([]);
    setUgcResults([]);

    const ctrl = beginGeneration();
    const signal = ctrl.signal;

    try {
    // ──────────────────────────────────────────────────────────────────
    // STEP 0 — Background scene pre-analysis (ONCE per unique
    // inspiration image used in this batch). In bulk mode the user may
    // assign different backgrounds to different products / poses, so we
    // pre-analyze each unique image once and key the resulting frozen
    // scene description by the image's File reference.
    // ──────────────────────────────────────────────────────────────────
    const sceneCache = new Map<File, string>();
    const uniqueInspirationFiles: File[] = [];
    const collectFile = (bg: BackgroundConfig | undefined | null) => {
      if (!bg || bg.mode !== "inspiration" || !bg.inspirationImage) return;
      // REPLICA-mode backgrounds skip the scene-analysis pre-pass — they are attached
      // directly to the image-gen call with an exact-replication directive instead.
      if (bg.imageReferenceMode === "replica") return;
      const f = bg.inspirationImage.file;
      if (!uniqueInspirationFiles.includes(f)) uniqueInspirationFiles.push(f);
    };
    // Collect from every combo's default background
    for (const combo of bulkCombinations) collectFile(combo.background);
    // Collect from every per-pose override background
    for (const ov of bulkPoseOverrides) {
      if (!ov.backgroundId) continue;
      const bg = bulkBackgrounds.find((b) => b.id === ov.backgroundId)?.config;
      collectFile(bg);
    }

    if (uniqueInspirationFiles.length > 0) {
      setIsIngestingScene(true);
    }
    try {
      for (const file of uniqueInspirationFiles) {
        if (signal.aborted) return;
        try {
          const r = await analyzeBackgroundScene({
            apiKey,
            textGenModel,
            inspirationImage: { file },
            abortSignal: signal,
          });
          sceneCache.set(file, r.sceneDescription);
        } catch (err) {
          if (signal.aborted) return;
          console.warn("Background scene analysis failed for an inspiration image; falling back per-pose:", err);
        }
      }
    } finally {
      setIsIngestingScene(false);
    }

    const lookupFrozenScene = (bg: BackgroundConfig): string | undefined => {
      if (bg.mode !== "inspiration" || !bg.inspirationImage) return undefined;
      // REPLICA mode never uses a frozen scene, even if the same image file was
      // analyzed under a different (inspiration-mode) background slot.
      if (bg.imageReferenceMode === "replica") return undefined;
      return sceneCache.get(bg.inspirationImage.file);
    };

    if (signal.aborted) return;

    // Create result entries for every combination x pose (preset + custom)
    const allResults: BulkGeneratedResult[] = [];
    for (const combo of bulkCombinations) {
      const comboLabel = [
        combo.primaryFolder.name,
        combo.complementaryFolder ? combo.complementaryFolder.name : null,
        combo.modelImage.name,
      ]
        .filter(Boolean)
        .join(" + ");

      for (const pose of selectedPoses) {
        allResults.push({
          id: `bulk-${combo.id}-${pose.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          combinationId: combo.id,
          combinationLabel: comboLabel,
          prompt: "",
          imageData: "",
          pose,
          status: "pending",
        });
      }

      for (const cp of customPoses) {
        allResults.push({
          id: `bulk-${combo.id}-${cp.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          combinationId: combo.id,
          combinationLabel: comboLabel,
          prompt: "",
          imageData: "",
          pose: {
            id: cp.id,
            name: cp.name || "Custom Pose",
            description: cp.description,
            icon: "\u2728",
            viewAngle: "front" as const,
            framing: "full-body" as const,
            garmentRelevance: [],
          },
          customPose: cp,
          status: "pending",
        });
      }
    }
    setBulkResults(allResults);

    // Process a single bulk result
    const processResult = async (result: BulkGeneratedResult) => {
      if (signal.aborted) {
        updateBulkResult(result.id, { status: "cancelled", error: "Cancelled by user" });
        return;
      }
      const combo = bulkCombinations.find((c) => c.id === result.combinationId);
      if (!combo) return;

      const effectivePoseId = result.customPose ? result.customPose.id : result.pose.id;
      const { model: effectiveModel, bg: effectiveBg, cg: effectiveCg } = resolveOverride(combo, effectivePoseId);
      const frozenSceneDescription = lookupFrozenScene(effectiveBg);

      const pgImages: GarmentImage[] = combo.primaryFolder.images.map((img) => ({
        id: img.id,
        file: img.file,
        preview: img.preview,
        type: garmentType,
        isBackView: img.isBackView,
        footwearSide: img.footwearSide,
      }));

      const cgImages: ComplementaryImage[] = effectiveCg
        ? effectiveCg.images.map((img) => ({
            id: img.id,
            file: img.file,
            preview: img.preview,
            label: effectiveCg!.name,
          }))
        : [];

      const bulkModelImg: ModelImage = {
        file: effectiveModel.file,
        preview: effectiveModel.preview,
      };

      const poseIsProductOnly = result.customPose
        ? !result.customPose.isModelShot
        : result.pose.requiresModel === false;
      const poseIsGhostMannequin = result.pose.framing === "ghost-mannequin";

      const collectedCosts: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      const generate = async () => {
        collectedCosts.length = 0;
        updateBulkResult(result.id, { status: "generating-prompt", error: undefined });

        // Materialize bucket-backed accessories with a per-product draw keyed on
        // the product folder id, so each folder gets its own consistent pick.
        const accessories = materializeAccessories(
          poseAccessories[result.pose.id] || [],
          combo.primaryFolder.id
        );

        const promptResult = await generateVTONPrompt({
          apiKey,
          textGenModel,
          productCategory,
          gender,
          garmentImages: pgImages,
          garmentType,
          footwearType,
          fit: combo.primaryFolder.fit !== undefined ? combo.primaryFolder.fit : fit,
          sleeveLength:
            combo.primaryFolder.sleeveLength !== undefined
              ? combo.primaryFolder.sleeveLength
              : sleeveLength,
          topwearLength:
            combo.primaryFolder.topwearLength !== undefined
              ? combo.primaryFolder.topwearLength
              : topwearLength,
          bottomwearLength:
            combo.primaryFolder.bottomwearLength !== undefined
              ? combo.primaryFolder.bottomwearLength
              : bottomwearLength,
          complementaryImages: cgImages,
          accessories,
          background: effectiveBg,
          model: null,
          modelImage: poseIsProductOnly ? null : bulkModelImg,
          pose: result.pose,
          customPose: result.customPose,
          aspectRatio,
          additionalInfo,
          productInfo: combo.primaryFolder.productInfo || "",
          applyAccessoriesToAllPoses,
          targetImageModel: imageGenModel,
          frozenSceneDescription,
          // Fresh per-generation seed for Dynamic poses; undefined for standard poses.
          dynamicSeed:
            result.pose.poseType === "dynamic"
              ? buildDynamicPoseSeed({
                  hasProp: accessories.length > 0 || cgImages.length > 0,
                })
              : undefined,
          abortSignal: signal,
        });
        collectedCosts.push(promptResult.cost);

        updateBulkResult(result.id, { prompt: promptResult.text, status: "generating-image" });

        const imageResult = await generateVTONImageRouted({
          apiKey,
          prompt: promptResult.text,
          garmentImages: pgImages,
          complementaryImages: cgImages,
          accessories,
          modelImage: poseIsProductOnly ? null : bulkModelImg,
          background: effectiveBg,
          aspectRatio,
          productCategory,
          isProductOnlyShot: poseIsProductOnly,
          isGhostMannequin: poseIsGhostMannequin,
          isBackViewPose: result.pose.viewAngle === "back" || result.pose.viewAngle === "three-quarter-back",
          imageSize: imageQuality,
          abortSignal: signal,
        });
        collectedCosts.push(imageResult.cost);

        updateBulkResult(result.id, {
          imageData: imageResult.imageData,
          status: "completed",
          validationStatus: skipValidationRef.current ? "skipped" : "validating",
          imageGenResponseContent: imageResult.responseContent,
          editHistory: [],
        });

        if (skipValidationRef.current) return;
        validateGeneratedImage({
          apiKey,
          textGenModel,
          originalImages: pgImages.map((g) => g.file),
          generatedImageData: imageResult.imageData,
          productCategory,
          abortSignal: signal,
        }).then((v) => {
          if (v.cost) collectedCosts.push(v.cost);
          const mainCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
          updateBulkResult(result.id, {
            validationStatus: v.status,
            validationMessage: v.message,
            costBreakdown: { steps: [...collectedCosts], totalCost: mainCost + retryCost, retrySteps },
          });
        });
      };

      try {
        await generate();
      } catch {
        if (signal.aborted) {
          updateBulkResult(result.id, { status: "cancelled", error: "Cancelled by user" });
          return;
        }
        try {
          retrySteps = [...collectedCosts];
          updateBulkResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          if (signal.aborted) {
            updateBulkResult(result.id, { status: "cancelled", error: "Cancelled by user" });
            return;
          }
          await generate();
        } catch (retryError) {
          if (signal.aborted) {
            updateBulkResult(result.id, { status: "cancelled", error: "Cancelled by user" });
            return;
          }
          const allCosts = [...(retrySteps || []), ...collectedCosts];
          const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
          updateBulkResult(result.id, {
            status: "error",
            error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
            costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
          });
        }
      }
    };

    // Process in batches with concurrency limit
    const CONCURRENCY_LIMIT = 7;
    for (let i = 0; i < allResults.length; i += CONCURRENCY_LIMIT) {
      if (signal.aborted) break;
      const batch = allResults.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(processResult));
    }

    // Sweep any remaining pending bulk results into cancelled.
    if (signal.aborted) {
      setBulkResults((prev) =>
        prev.map((r) =>
          r.status === "pending" ? { ...r, status: "cancelled", error: "Cancelled by user" } : r
        )
      );
    }

    // Process UGC scenes — one per combination × scene
    if (ugcScenes.length > 0) {
      const initialUgcResults: UGCGeneratedResult[] = [];
      for (const combo of bulkCombinations) {
        for (const scene of ugcScenes) {
          initialUgcResults.push({
            id: `ugc-bulk-${combo.id}-${scene.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            sceneId: scene.id,
            sceneName: `${combo.primaryFolder.name} — ${scene.name || "UGC Scene"}`,
            prompt: "",
            imageData: "",
            status: "pending",
          });
        }
      }
      setUgcResults(initialUgcResults);

      const processUgcScene = async (result: UGCGeneratedResult) => {
        if (signal.aborted) {
          updateUgcResult(result.id, { status: "cancelled", error: "Cancelled by user" });
          return;
        }
        const scene = ugcScenes.find((s) => s.id === result.sceneId);
        if (!scene) return;
        const comboIndex = initialUgcResults.indexOf(result);
        const sceneCount = ugcScenes.length;
        const comboIdx = sceneCount > 0 ? Math.floor(comboIndex / sceneCount) : 0;
        const combo = bulkCombinations[comboIdx];
        if (!combo) return;

        const pgImages: GarmentImage[] = combo.primaryFolder.images.map((img) => ({
          id: img.id,
          file: img.file,
          preview: img.preview,
          type: garmentType,
          isBackView: img.isBackView,
          footwearSide: img.footwearSide,
        }));

        const cgImages: ComplementaryImage[] = combo.complementaryFolder
          ? combo.complementaryFolder.images.map((img) => ({
              id: img.id,
              file: img.file,
              preview: img.preview,
              label: combo.complementaryFolder!.name,
            }))
          : [];

        const collectedCosts: StepCost[] = [];
        let retrySteps: StepCost[] | undefined;

        const generate = async () => {
          collectedCosts.length = 0;
          updateUgcResult(result.id, { status: "generating-prompt", error: undefined });

          const promptResult = await generateUGCPrompt({
            apiKey,
            textGenModel,
            productCategory,
            gender,
            garmentImages: pgImages,
            garmentType,
            footwearType,
            complementaryImages: cgImages,
            scene,
            aspectRatio,
            additionalInfo,
            productInfo: combo.primaryFolder.productInfo || "",
          });
          collectedCosts.push(promptResult.cost);

          updateUgcResult(result.id, { prompt: promptResult.prompt, status: "generating-image" });

          const imageResult = await generateUGCImage({
            apiKey,
            prompt: promptResult.prompt,
            garmentImages: pgImages,
            complementaryImages: cgImages,
            sceneReferenceImages: scene.referenceImages.map((img) => img.file),
            aspectRatio,
            gender,
            productCategory,
            isSelfie: scene.shotType === "selfie",
            imageSize: imageQuality,
          });
          collectedCosts.push(imageResult.cost);

          const totalCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
          updateUgcResult(result.id, {
            imageData: imageResult.imageData,
            status: "completed",
            costBreakdown: { steps: [...collectedCosts], totalCost: totalCost + retryCost, retrySteps },
          });
        };

        try {
          await generate();
        } catch {
          if (signal.aborted) {
            updateUgcResult(result.id, { status: "cancelled", error: "Cancelled by user" });
            return;
          }
          try {
            retrySteps = [...collectedCosts];
            updateUgcResult(result.id, { status: "auto-retrying", error: undefined });
            await new Promise((r) => setTimeout(r, 1000));
            if (signal.aborted) {
              updateUgcResult(result.id, { status: "cancelled", error: "Cancelled by user" });
              return;
            }
            await generate();
          } catch (retryError) {
            if (signal.aborted) {
              updateUgcResult(result.id, { status: "cancelled", error: "Cancelled by user" });
              return;
            }
            const allCosts = [...(retrySteps || []), ...collectedCosts];
            const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
            updateUgcResult(result.id, {
              status: "error",
              error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
              costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
            });
          }
        }
      };

      const UGC_CONCURRENCY = 5;
      for (let i = 0; i < initialUgcResults.length; i += UGC_CONCURRENCY) {
        if (signal.aborted) break;
        const batch = initialUgcResults.slice(i, i + UGC_CONCURRENCY);
        await Promise.all(batch.map(processUgcScene));
      }

      if (signal.aborted) {
        setUgcResults((prev) =>
          prev.map((r) =>
            r.status === "pending" ? { ...r, status: "cancelled", error: "Cancelled by user" } : r
          )
        );
      }
    }

    } finally {
      setIsGenerating(false);
    }
  }, [
    bulkCombinations,
    selectedPoses,
    customPoses,
    ugcScenes,
    apiKey,
    productCategory,
    gender,
    garmentType,
    footwearType,
    fit,
    sleeveLength,
    topwearLength,
    bottomwearLength,
    poseAccessories,
    materializeAccessories,
    applyAccessoriesToAllPoses,
    aspectRatio,
    additionalInfo,
    productInfo,
    imageQuality,
    imageGenModel,
    textGenModel,
    generateVTONImageRouted,
    resolveOverride,
    setBulkResults,
    updateBulkResult,
    setUgcResults,
    updateUgcResult,
    setIsGenerating,
    setIsIngestingScene,
    beginGeneration,
    bulkPoseOverrides,
    bulkBackgrounds,
  ]);

  // Retry/regenerate a single result (single mode) — works for both errored and completed results
  const handleRetrySingle = useCallback(
    async (result: GeneratedResult) => {
      if (result.status === "pending" || !apiKey) return;
      const poseIsProductOnly = result.customPose
        ? !result.customPose.isModelShot
        : result.pose.requiresModel === false;
      const poseIsGhostMannequin = result.pose.framing === "ghost-mannequin";
      if (!poseIsProductOnly && !selectedModel && !modelImage) return;

      const collectedCosts: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      const generate = async () => {
        collectedCosts.length = 0;
        updateResult(result.id, { status: "generating-prompt", error: undefined });
        // Reuse the same per-product bucket draw as the original generation
        // (single product → "single"), so retries keep the same prop image.
        const accessories = materializeAccessories(poseAccessories[result.pose.id] || [], "single");

        const promptResult = await generateVTONPrompt({
          apiKey,
          textGenModel,
          productCategory,
          gender,
          garmentImages,
          garmentType,
          footwearType,
          fit,
          sleeveLength,
          topwearLength,
          bottomwearLength,
          complementaryImages,
          accessories,
          background,
          model: poseIsProductOnly ? null : selectedModel,
          modelImage: poseIsProductOnly ? null : modelImage,
          pose: result.pose,
          customPose: result.customPose,
          aspectRatio,
          additionalInfo,
          productInfo,
          applyAccessoriesToAllPoses,
          targetImageModel: imageGenModel,
          // Fresh per-retry seed for Dynamic poses so every retry re-varies the
          // posture; undefined for standard poses.
          dynamicSeed:
            result.pose.poseType === "dynamic"
              ? buildDynamicPoseSeed({
                  hasProp: accessories.length > 0 || complementaryImages.length > 0,
                })
              : undefined,
        });
        collectedCosts.push(promptResult.cost);
        updateResult(result.id, { prompt: promptResult.text, status: "generating-image" });

        const imageResult = await generateVTONImageRouted({
          apiKey,
          prompt: promptResult.text,
          garmentImages,
          complementaryImages,
          accessories,
          modelImage: poseIsProductOnly ? null : modelImage,
          background,
          aspectRatio,
          productCategory,
          isProductOnlyShot: poseIsProductOnly,
          isGhostMannequin: poseIsGhostMannequin,
          isBackViewPose: result.pose.viewAngle === "back" || result.pose.viewAngle === "three-quarter-back",
          imageSize: imageQuality,
        });
        collectedCosts.push(imageResult.cost);
        updateResult(result.id, {
          imageData: imageResult.imageData,
          status: "completed",
          validationStatus: skipValidationRef.current ? "skipped" : "validating",
          validationMessage: undefined,
          imageGenResponseContent: imageResult.responseContent,
          editHistory: [],
        });

        if (skipValidationRef.current) return;
        validateGeneratedImage({
          apiKey,
          textGenModel,
          originalImages: garmentImages.map((g) => g.file),
          generatedImageData: imageResult.imageData,
          productCategory,
        }).then((v) => {
          if (v.cost) collectedCosts.push(v.cost);
          const mainCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
          updateResult(result.id, {
            validationStatus: v.status,
            validationMessage: v.message,
            costBreakdown: { steps: [...collectedCosts], totalCost: mainCost + retryCost, retrySteps },
          });
        });
      };

      try {
        await generate();
      } catch {
        try {
          retrySteps = [...collectedCosts];
          updateResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          await generate();
        } catch (retryError) {
          const allCosts = [...(retrySteps || []), ...collectedCosts];
          const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
          updateResult(result.id, {
            status: "error",
            error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
            costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
          });
        }
      }
    },
    [
      apiKey,
      productCategory,
      gender,
      selectedModel,
      modelImage,
      garmentImages,
      garmentType,
      footwearType,
      fit,
      sleeveLength,
      topwearLength,
      bottomwearLength,
      complementaryImages,
      poseAccessories,
      materializeAccessories,
      applyAccessoriesToAllPoses,
      background,
      aspectRatio,
      additionalInfo,
      productInfo,
      imageQuality,
      imageGenModel,
      textGenModel,
      generateVTONImageRouted,
      updateResult,
    ]
  );

  // Retry/regenerate a single bulk result — works for both errored and completed results
  const handleRetryBulk = useCallback(
    async (result: BulkGeneratedResult) => {
      if (result.status === "pending" || !apiKey) return;
      const combo = bulkCombinations.find((c) => c.id === result.combinationId);
      if (!combo) return;

      const effectivePoseId = result.customPose ? result.customPose.id : result.pose.id;
      const { model: effectiveModel, bg: effectiveBg, cg: effectiveCg } = resolveOverride(combo, effectivePoseId);

      const pgImages: GarmentImage[] = combo.primaryFolder.images.map((img) => ({
        id: img.id,
        file: img.file,
        preview: img.preview,
        type: garmentType,
        isBackView: img.isBackView,
        footwearSide: img.footwearSide,
      }));
      const cgImages: ComplementaryImage[] = effectiveCg
        ? effectiveCg.images.map((img) => ({
            id: img.id,
            file: img.file,
            preview: img.preview,
            label: effectiveCg!.name,
          }))
        : [];
      const bulkModelImg: ModelImage = {
        file: effectiveModel.file,
        preview: effectiveModel.preview,
      };

      const poseIsProductOnly = result.customPose
        ? !result.customPose.isModelShot
        : result.pose.requiresModel === false;
      const poseIsGhostMannequin = result.pose.framing === "ghost-mannequin";

      const collectedCosts: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      const generate = async () => {
        collectedCosts.length = 0;
        updateBulkResult(result.id, { status: "generating-prompt", error: undefined });
        // Reuse the same per-product bucket draw as the original bulk generation
        // (keyed on the product folder id) so retries keep the same prop image.
        const accessories = materializeAccessories(
          poseAccessories[result.pose.id] || [],
          combo.primaryFolder.id
        );

        const promptResult = await generateVTONPrompt({
          apiKey,
          textGenModel,
          productCategory,
          gender,
          garmentImages: pgImages,
          garmentType,
          footwearType,
          fit: combo.primaryFolder.fit !== undefined ? combo.primaryFolder.fit : fit,
          sleeveLength:
            combo.primaryFolder.sleeveLength !== undefined
              ? combo.primaryFolder.sleeveLength
              : sleeveLength,
          topwearLength:
            combo.primaryFolder.topwearLength !== undefined
              ? combo.primaryFolder.topwearLength
              : topwearLength,
          bottomwearLength:
            combo.primaryFolder.bottomwearLength !== undefined
              ? combo.primaryFolder.bottomwearLength
              : bottomwearLength,
          complementaryImages: cgImages,
          accessories,
          background: effectiveBg,
          model: null,
          modelImage: poseIsProductOnly ? null : bulkModelImg,
          pose: result.pose,
          customPose: result.customPose,
          aspectRatio,
          additionalInfo,
          productInfo: combo.primaryFolder.productInfo || "",
          applyAccessoriesToAllPoses,
          targetImageModel: imageGenModel,
          // Fresh per-retry seed for Dynamic poses; undefined for standard poses.
          dynamicSeed:
            result.pose.poseType === "dynamic"
              ? buildDynamicPoseSeed({
                  hasProp: accessories.length > 0 || cgImages.length > 0,
                })
              : undefined,
        });
        collectedCosts.push(promptResult.cost);
        updateBulkResult(result.id, { prompt: promptResult.text, status: "generating-image" });

        const imageResult = await generateVTONImageRouted({
          apiKey,
          prompt: promptResult.text,
          garmentImages: pgImages,
          complementaryImages: cgImages,
          accessories,
          modelImage: poseIsProductOnly ? null : bulkModelImg,
          background: effectiveBg,
          aspectRatio,
          productCategory,
          isProductOnlyShot: poseIsProductOnly,
          isGhostMannequin: poseIsGhostMannequin,
          isBackViewPose: result.pose.viewAngle === "back" || result.pose.viewAngle === "three-quarter-back",
          imageSize: imageQuality,
        });
        collectedCosts.push(imageResult.cost);
        updateBulkResult(result.id, {
          imageData: imageResult.imageData,
          status: "completed",
          validationStatus: skipValidationRef.current ? "skipped" : "validating",
          validationMessage: undefined,
          imageGenResponseContent: imageResult.responseContent,
          editHistory: [],
        });

        if (skipValidationRef.current) return;
        validateGeneratedImage({
          apiKey,
          textGenModel,
          originalImages: pgImages.map((g) => g.file),
          generatedImageData: imageResult.imageData,
          productCategory,
        }).then((v) => {
          if (v.cost) collectedCosts.push(v.cost);
          const mainCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
          updateBulkResult(result.id, {
            validationStatus: v.status,
            validationMessage: v.message,
            costBreakdown: { steps: [...collectedCosts], totalCost: mainCost + retryCost, retrySteps },
          });
        });
      };

      try {
        await generate();
      } catch {
        try {
          retrySteps = [...collectedCosts];
          updateBulkResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          await generate();
        } catch (retryError) {
          const allCosts = [...(retrySteps || []), ...collectedCosts];
          const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
          updateBulkResult(result.id, {
            status: "error",
            error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
            costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
          });
        }
      }
    },
    [
      apiKey,
      productCategory,
      gender,
      bulkCombinations,
      garmentType,
      footwearType,
      fit,
      sleeveLength,
      topwearLength,
      bottomwearLength,
      poseAccessories,
      materializeAccessories,
      applyAccessoriesToAllPoses,
      aspectRatio,
      additionalInfo,
      productInfo,
      imageQuality,
      imageGenModel,
      textGenModel,
      generateVTONImageRouted,
      resolveOverride,
      updateBulkResult,
    ]
  );

  const handleRetryAllMismatchedSingle = useCallback(async () => {
    const mismatched = results.filter((r) => r.validationStatus === "warning" && r.status === "completed");
    if (mismatched.length === 0 || isGenerating) return;
    setIsGenerating(true);
    try {
      const CONCURRENCY = 5;
      for (let i = 0; i < mismatched.length; i += CONCURRENCY) {
        const batch = mismatched.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((r) => handleRetrySingle(r)));
      }
    } finally {
      setIsGenerating(false);
    }
  }, [results, isGenerating, handleRetrySingle, setIsGenerating]);

  const handleRetryAllMismatchedBulk = useCallback(async () => {
    const mismatched = bulkResults.filter((r) => r.validationStatus === "warning" && r.status === "completed");
    if (mismatched.length === 0 || isGenerating) return;
    setIsGenerating(true);
    try {
      const CONCURRENCY = 3;
      for (let i = 0; i < mismatched.length; i += CONCURRENCY) {
        const batch = mismatched.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((r) => handleRetryBulk(r)));
      }
    } finally {
      setIsGenerating(false);
    }
  }, [bulkResults, isGenerating, handleRetryBulk, setIsGenerating]);

  // ======================================================================
  // MULTI-TURN EDIT HANDLERS
  // ======================================================================

  const handleEditSingle = useCallback(
    async (result: GeneratedResult, editInstruction: string) => {
      if (!result.imageGenResponseContent || !apiKey) return;
      const poseIsProductOnly = result.customPose
        ? !result.customPose.isModelShot
        : result.pose.requiresModel === false;
      const poseIsGhostMannequin = result.pose.framing === "ghost-mannequin";

      updateResult(result.id, { status: "editing", error: undefined });

      try {
        const accessories = materializeAccessories(poseAccessories[result.pose.id] || [], "single");
        const originalContentParts = await buildVTONImageContentParts({
          prompt: result.prompt,
          garmentImages,
          complementaryImages,
          accessories,
          modelImage: poseIsProductOnly ? null : modelImage,
          productCategory,
          isProductOnlyShot: poseIsProductOnly,
          isGhostMannequin: poseIsGhostMannequin,
        });

        const editResult = await contextualRetryVTONImage({
          apiKey,
          textGenModel,
          originalContentParts,
          imageGenResponseContent: result.imageGenResponseContent,
          editHistory: result.editHistory,
          generatedImageData: result.imageData,
          garmentImages,
          complementaryImages,
          accessories,
          modelImage: poseIsProductOnly ? null : modelImage,
          background,
          productInfo,
          userChangeRequest: editInstruction,
          aspectRatio,
          imageSize: imageQuality,
        });

        const newEditEntry: EditHistoryEntry = {
          userInstruction: editResult.editInstruction,
          modelResponseContent: editResult.responseContent,
        };

        const prevCost = result.costBreakdown?.totalCost ?? 0;
        updateResult(result.id, {
          imageData: editResult.imageData,
          status: "completed",
          imageGenResponseContent: editResult.responseContent,
          editHistory: [...(result.editHistory || []), newEditEntry],
          costBreakdown: {
            steps: [...(result.costBreakdown?.steps ?? []), editResult.promptCost, editResult.imageCost],
            totalCost: prevCost + editResult.promptCost.totalCost + editResult.imageCost.totalCost,
            retrySteps: result.costBreakdown?.retrySteps,
          },
        });
      } catch (err) {
        updateResult(result.id, {
          status: "completed",
          error: err instanceof Error ? err.message : "Edit failed",
        });
      }

      setEditingResultId(null);
      setEditText("");
    },
    [apiKey, textGenModel, garmentImages, complementaryImages, modelImage, background, productInfo, productCategory, poseAccessories, materializeAccessories, aspectRatio, imageQuality, updateResult]
  );

  const handleEditBulk = useCallback(
    async (result: BulkGeneratedResult, editInstruction: string) => {
      if (!result.imageGenResponseContent || !apiKey) return;
      const combo = bulkCombinations.find((c) => c.id === result.combinationId);
      if (!combo) return;

      const effectivePoseId = result.customPose ? result.customPose.id : result.pose.id;
      const { model: effectiveModel, bg: effectiveBg, cg: effectiveCg } = resolveOverride(combo, effectivePoseId);

      const pgImages: GarmentImage[] = combo.primaryFolder.images.map((img) => ({
        id: img.id, file: img.file, preview: img.preview, type: garmentType, isBackView: img.isBackView, footwearSide: img.footwearSide,
      }));
      const cgImages: ComplementaryImage[] = effectiveCg
        ? effectiveCg.images.map((img) => ({ id: img.id, file: img.file, preview: img.preview, label: effectiveCg!.name }))
        : [];
      const bulkModelImg: ModelImage = { file: effectiveModel.file, preview: effectiveModel.preview };

      const poseIsProductOnly = result.customPose ? !result.customPose.isModelShot : result.pose.requiresModel === false;
      const poseIsGhostMannequin = result.pose.framing === "ghost-mannequin";

      updateBulkResult(result.id, { status: "editing", error: undefined });

      try {
        const accessories = materializeAccessories(
          poseAccessories[result.pose.id] || [],
          combo.primaryFolder.id
        );
        const originalContentParts = await buildVTONImageContentParts({
          prompt: result.prompt,
          garmentImages: pgImages,
          complementaryImages: cgImages,
          accessories,
          modelImage: poseIsProductOnly ? null : bulkModelImg,
          productCategory,
          isProductOnlyShot: poseIsProductOnly,
          isGhostMannequin: poseIsGhostMannequin,
        });

        const editResult = await contextualRetryVTONImage({
          apiKey,
          textGenModel,
          originalContentParts,
          imageGenResponseContent: result.imageGenResponseContent,
          editHistory: result.editHistory,
          generatedImageData: result.imageData,
          garmentImages: pgImages,
          complementaryImages: cgImages,
          accessories,
          modelImage: poseIsProductOnly ? null : bulkModelImg,
          background: effectiveBg,
          productInfo: combo.primaryFolder.productInfo || "",
          userChangeRequest: editInstruction,
          aspectRatio,
          imageSize: imageQuality,
        });

        const newEditEntry: EditHistoryEntry = {
          userInstruction: editResult.editInstruction,
          modelResponseContent: editResult.responseContent,
        };

        const prevCost = result.costBreakdown?.totalCost ?? 0;
        updateBulkResult(result.id, {
          imageData: editResult.imageData,
          status: "completed",
          imageGenResponseContent: editResult.responseContent,
          editHistory: [...(result.editHistory || []), newEditEntry],
          costBreakdown: {
            steps: [...(result.costBreakdown?.steps ?? []), editResult.promptCost, editResult.imageCost],
            totalCost: prevCost + editResult.promptCost.totalCost + editResult.imageCost.totalCost,
            retrySteps: result.costBreakdown?.retrySteps,
          },
        });
      } catch (err) {
        updateBulkResult(result.id, {
          status: "completed",
          error: err instanceof Error ? err.message : "Edit failed",
        });
      }

      setEditingResultId(null);
      setEditText("");
    },
    [apiKey, textGenModel, bulkCombinations, garmentType, productCategory, poseAccessories, materializeAccessories, aspectRatio, imageQuality, resolveOverride, updateBulkResult]
  );

  const handleEditModelSwap = useCallback(
    async (result: ModelSwapGeneratedResult, editInstruction: string) => {
      if (!result.imageGenResponseContent || !apiKey) return;
      const sourceImg = garmentImages.find((g) => g.id === result.sourceImageId);
      if (!sourceImg) return;

      updateModelSwapResult(result.id, { status: "editing", error: undefined });

      try {
        const originalContentParts = await buildModelSwapImageContentParts({
          prompt: result.prompt,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          modelImage,
          backgroundMode: modelSwapBgMode,
          background,
        });

        const editResult = await editModelSwapImage({
          apiKey,
          originalContentParts,
          imageGenResponseContent: result.imageGenResponseContent,
          editHistory: result.editHistory,
          editInstruction,
          aspectRatio,
          imageSize: imageQuality,
        });

        const newEditEntry: EditHistoryEntry = {
          userInstruction: editInstruction,
          modelResponseContent: editResult.responseContent,
        };

        updateModelSwapResult(result.id, {
          imageData: editResult.imageData,
          status: "completed",
          imageGenResponseContent: editResult.responseContent,
          editHistory: [...(result.editHistory || []), newEditEntry],
          costBreakdown: {
            steps: [editResult.cost],
            totalCost: editResult.cost.totalCost + (result.costBreakdown?.totalCost || 0),
          },
        });
      } catch (err) {
        updateModelSwapResult(result.id, {
          status: "completed",
          error: err instanceof Error ? err.message : "Edit failed",
        });
      }

      setEditingResultId(null);
      setEditText("");
    },
    [apiKey, garmentImages, modelImage, modelSwapBgMode, background, aspectRatio, imageQuality, updateModelSwapResult]
  );

  const handleEditModelSwapBulk = useCallback(
    async (result: ModelSwapBulkResult, editInstruction: string) => {
      if (!result.imageGenResponseContent || !apiKey) return;
      const combo = modelSwapBulkCombinations.find((c) => c.id === result.combinationId);
      if (!combo) return;

      const sourceImg = combo.primaryFolder.images.find((img) => img.id === result.sourceImageId);
      if (!sourceImg) return;

      const bulkModelImg: ModelImage = { file: combo.modelImage.file, preview: combo.modelImage.preview };

      updateModelSwapBulkResult(result.id, { status: "editing", error: undefined });

      try {
        const originalContentParts = await buildModelSwapImageContentParts({
          prompt: result.prompt,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          modelImage: bulkModelImg,
          backgroundMode: modelSwapBgMode,
          background: combo.background,
        });

        const editResult = await editModelSwapImage({
          apiKey,
          originalContentParts,
          imageGenResponseContent: result.imageGenResponseContent,
          editHistory: result.editHistory,
          editInstruction,
          aspectRatio,
          imageSize: imageQuality,
        });

        const newEditEntry: EditHistoryEntry = {
          userInstruction: editInstruction,
          modelResponseContent: editResult.responseContent,
        };

        updateModelSwapBulkResult(result.id, {
          imageData: editResult.imageData,
          status: "completed",
          imageGenResponseContent: editResult.responseContent,
          editHistory: [...(result.editHistory || []), newEditEntry],
          costBreakdown: {
            steps: [editResult.cost],
            totalCost: editResult.cost.totalCost + (result.costBreakdown?.totalCost || 0),
          },
        });
      } catch (err) {
        updateModelSwapBulkResult(result.id, {
          status: "completed",
          error: err instanceof Error ? err.message : "Edit failed",
        });
      }

      setEditingResultId(null);
      setEditText("");
    },
    [apiKey, modelSwapBulkCombinations, modelSwapBgMode, aspectRatio, imageQuality, updateModelSwapBulkResult]
  );

  const handleDownload = useCallback(async (imageData: string, pose: Pose, prefix?: string) => {
    const baseName = prefix || singleDownloadPrefix || "product";
    const seqIdx = selectedPoses.findIndex((p) => p.id === pose.id);
    const oneIndexed = namingLogic === "folder-name-sequential-1";
    const fileName = seqIdx >= 0
      ? getSequencedFileName(baseName, seqIdx, "png", oneIndexed, skipIndices)
      : `${baseName.replace(/[<>:"/\\|?*]+/g, "_")}-${pose.id}.png`;
    try {
      const resp = await fetch(imageData);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      const link = document.createElement("a");
      link.href = imageData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [selectedPoses, singleDownloadPrefix, namingLogic, skipIndices]);

  // Resolve the effective productInfo for the infographic editor based on result type.
  // In bulk mode, per-folder productInfo is used; in single mode, the global store value.
  const infographicProductInfo = (() => {
    if (!infographicImage) return productInfo;
    const { resultId, resultType } = infographicImage;
    if (resultType === "bulk") {
      const bulkResult = bulkResults.find((r) => r.id === resultId);
      if (bulkResult) {
        const combo = bulkCombinations.find((c) => c.id === bulkResult.combinationId);
        if (combo?.primaryFolder.productInfo) return combo.primaryFolder.productInfo;
      }
    }
    if (resultType === "model-swap-bulk") {
      const msResult = modelSwapBulkResults.find((r) => r.id === resultId);
      if (msResult) {
        const combo = modelSwapBulkCombinations.find((c) => c.id === msResult.combinationId);
        if (combo?.primaryFolder.productInfo) return combo.primaryFolder.productInfo;
      }
    }
    return productInfo;
  })();

  // Save an infographic image back to the corresponding result
  const handleInfographicSave = useCallback(
    (imageDataUrl: string) => {
      if (!infographicImage) return;
      const { resultId, resultType } = infographicImage;
      const appendImage = (existing?: string[]) => {
        const prev = existing ?? [];
        if (prev.includes(imageDataUrl)) return prev;
        return [...prev, imageDataUrl];
      };

      switch (resultType) {
        case "single": {
          const found = results.find((r) => r.id === resultId);
          updateResult(resultId, { infographicImages: appendImage(found?.infographicImages) });
          break;
        }
        case "bulk": {
          const found = bulkResults.find((r) => r.id === resultId);
          updateBulkResult(resultId, { infographicImages: appendImage(found?.infographicImages) });
          break;
        }
        case "model-swap-single": {
          const found = modelSwapResults.find((r) => r.id === resultId);
          updateModelSwapResult(resultId, { infographicImages: appendImage(found?.infographicImages) });
          break;
        }
        case "model-swap-bulk": {
          const found = modelSwapBulkResults.find((r) => r.id === resultId);
          updateModelSwapBulkResult(resultId, { infographicImages: appendImage(found?.infographicImages) });
          break;
        }
      }
    },
    [infographicImage, results, bulkResults, modelSwapResults, modelSwapBulkResults, updateResult, updateBulkResult, updateModelSwapResult, updateModelSwapBulkResult]
  );

  // Download all completed images for VTON single mode as a ZIP
  const handleDownloadAllSingle = useCallback(async () => {
    const completedResults = results.filter((r) => r.status === "completed" && r.imageData);
    const completedUgc = ugcResults.filter((r) => r.status === "completed" && r.imageData);
    if (completedResults.length === 0 && completedUgc.length === 0) return;

    let JSZip: any;
    try {
      JSZip = (await import("jszip")).default;
    } catch (err) {
      console.error("JSZip not available. Run `npm install jszip` to enable ZIP downloads.", err);
      return;
    }

    const zip = new JSZip();
    const prefix = singleDownloadPrefix || "product";
    const oneIndexed = namingLogic === "folder-name-sequential-1";
    const sorted = sortResultsByPoseSequence(completedResults, selectedPoses);
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      try {
        const resp = await fetch(r.imageData);
        const blob = await resp.blob();
        const ext = (blob.type && blob.type.split("/")[1]) || "png";
        zip.file(getSequencedFileName(prefix, i, ext, oneIndexed, skipIndices), blob);
      } catch (e) {
        console.error("Failed to add image to zip:", e);
      }
      if (r.infographicImages?.length) {
        const counter = computeSkipAwareCounter(i, oneIndexed, skipIndices);
        for (let idx = 0; idx < r.infographicImages.length; idx++) {
          try {
            const resp = await fetch(r.infographicImages[idx]);
            const blob = await resp.blob();
            const ext = (blob.type && blob.type.split("/")[1]) || "png";
            const safePrefix = prefix.replace(/[<>:"/\\|?*]+/g, "_");
            zip.file(!oneIndexed && counter === 0
              ? `${safePrefix}-infographic-${idx + 1}.${ext}`
              : `${safePrefix}_${counter}-infographic-${idx + 1}.${ext}`, blob);
          } catch (e) {
            console.error("Failed to add infographic to zip:", e);
          }
        }
      }
    }

    if (completedUgc.length > 0) {
      const ugcFolder = zip.folder("UGC")!;
      for (const r of completedUgc) {
        const safeName = r.sceneName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
        try {
          const resp = await fetch(r.imageData);
          const blob = await resp.blob();
          const ext = (blob.type && blob.type.split("/")[1]) || "png";
          ugcFolder.file(`${safeName}.${ext}`, blob);
        } catch (e) {
          console.error("Failed to add UGC image to zip:", e);
        }
        if (r.infographicImages?.length) {
          for (let idx = 0; idx < r.infographicImages.length; idx++) {
            try {
              const resp = await fetch(r.infographicImages[idx]);
              const blob = await resp.blob();
              const ext = (blob.type && blob.type.split("/")[1]) || "png";
              ugcFolder.file(`${safeName}-infographic-${idx + 1}.${ext}`, blob);
            } catch (e) {
              console.error("Failed to add UGC infographic to zip:", e);
            }
          }
        }
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(prefix || "product").replace(/[<>:"/\\|?*]+/g, "_")}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [results, ugcResults, selectedPoses, singleDownloadPrefix, namingLogic, skipIndices]);

  // Download all completed images for Model Swap single mode as a ZIP
  const handleDownloadAllModelSwapSingle = useCallback(async () => {
    const completedResults = modelSwapResults.filter((r) => (r.status === "completed" || r.status === "skipped") && r.imageData);
    if (completedResults.length === 0) return;

    let JSZip: any;
    try {
      JSZip = (await import("jszip")).default;
    } catch (err) {
      console.error("JSZip not available. Run `npm install jszip` to enable ZIP downloads.", err);
      return;
    }

    const zip = new JSZip();
    const timestamp = Date.now();
    for (const r of completedResults) {
      try {
        const resp = await fetch(r.imageData);
        const blob = await resp.blob();
        const ext = (blob.type && blob.type.split("/")[1]) || "png";
        zip.file(`model-swap-${r.sourceImageId}.${ext}`, blob);
      } catch (e) {
        console.error("Failed to add image to zip:", e);
      }
      if (r.infographicImages?.length) {
        for (let idx = 0; idx < r.infographicImages.length; idx++) {
          try {
            const resp = await fetch(r.infographicImages[idx]);
            const blob = await resp.blob();
            const ext = (blob.type && blob.type.split("/")[1]) || "png";
            zip.file(`model-swap-${r.sourceImageId}-infographic-${idx + 1}.${ext}`, blob);
          } catch (e) {
            console.error("Failed to add infographic to zip:", e);
          }
        }
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `model-swap-images-${timestamp}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [modelSwapResults]);

  // Download all completed images for a given bulk combination as a ZIP
  const handleDownloadAllCombo = useCallback(
    async (comboId: string, folderName: string) => {
      const comboResults = bulkResults.filter((r) => r.combinationId === comboId && r.status === "completed");
      const comboUgcResults = ugcResults.filter(
        (r) => r.status === "completed" && r.imageData && r.id.startsWith(`ugc-bulk-${comboId}-`)
      );
      if (comboResults.length === 0 && comboUgcResults.length === 0) return;

      let JSZip: any;
      try {
        JSZip = (await import("jszip")).default;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("JSZip not available. Run `npm install jszip` to enable ZIP downloads.", err);
        return;
      }

      const safeName = folderName.replace(/[<>:"/\\|?*]+/g, "_");
      const oneIndexed = namingLogic === "folder-name-sequential-1";
      const zip = new JSZip();
      const folder = zip.folder(safeName)!;
      const sorted = sortResultsByPoseSequence(comboResults, selectedPoses);
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        try {
          const resp = await fetch(r.imageData);
          const blob = await resp.blob();
          const ext = (blob.type && blob.type.split("/")[1]) || "png";
          folder.file(getSequencedFileName(safeName, i, ext, oneIndexed, skipIndices), blob);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to add image to zip:", e);
        }
        if (r.infographicImages?.length) {
          const counter = computeSkipAwareCounter(i, oneIndexed, skipIndices);
          for (let idx = 0; idx < r.infographicImages.length; idx++) {
            try {
              const resp = await fetch(r.infographicImages[idx]);
              const blob = await resp.blob();
              const ext = (blob.type && blob.type.split("/")[1]) || "png";
              folder.file(!oneIndexed && counter === 0
                ? `${safeName}-infographic-${idx + 1}.${ext}`
                : `${safeName}_${counter}-infographic-${idx + 1}.${ext}`, blob);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error("Failed to add infographic to zip:", e);
            }
          }
        }
      }

      if (comboUgcResults.length > 0) {
        const ugcFolder = folder.folder("UGC")!;
        for (const r of comboUgcResults) {
          const safeSName = r.sceneName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
          try {
            const resp = await fetch(r.imageData);
            const blob = await resp.blob();
            const ext = (blob.type && blob.type.split("/")[1]) || "png";
            ugcFolder.file(`${safeSName}.${ext}`, blob);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Failed to add UGC image to zip:", e);
          }
          if (r.infographicImages?.length) {
            for (let idx = 0; idx < r.infographicImages.length; idx++) {
              try {
                const resp = await fetch(r.infographicImages[idx]);
                const blob = await resp.blob();
                const ext = (blob.type && blob.type.split("/")[1]) || "png";
                ugcFolder.file(`${safeSName}-infographic-${idx + 1}.${ext}`, blob);
              } catch (e) {
                // eslint-disable-next-line no-console
                console.error("Failed to add UGC infographic to zip:", e);
              }
            }
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    [bulkResults, ugcResults, selectedPoses, namingLogic, skipIndices]
  );

  // Download all completed images for a Model Swap bulk combination as a ZIP
  const handleDownloadAllModelSwapCombo = useCallback(
    async (comboId: string, folderName: string) => {
      const comboResults = modelSwapBulkResults.filter((r) => r.combinationId === comboId && (r.status === "completed" || r.status === "skipped") && r.imageData);
      if (comboResults.length === 0) return;

      let JSZip: any;
      try {
        JSZip = (await import("jszip")).default;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("JSZip not available. Run `npm install jszip` to enable ZIP downloads.", err);
        return;
      }

      const safeName = folderName.replace(/[<>:"/\\|?*]+/g, "_");
      const zip = new JSZip();
      const folder = zip.folder(safeName)!;
      for (let i = 0; i < comboResults.length; i++) {
        const r = comboResults[i];
        try {
          const resp = await fetch(r.imageData);
          const blob = await resp.blob();
          const ext = (blob.type && blob.type.split("/")[1]) || "png";
          folder.file(`${i + 1}.${ext}`, blob);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to add image to zip:", e);
        }
        if (r.infographicImages?.length) {
          for (let idx = 0; idx < r.infographicImages.length; idx++) {
            try {
              const resp = await fetch(r.infographicImages[idx]);
              const blob = await resp.blob();
              const ext = (blob.type && blob.type.split("/")[1]) || "png";
              folder.file(`${i + 1}-infographic-${idx + 1}.${ext}`, blob);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error("Failed to add infographic to zip:", e);
            }
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    [modelSwapBulkResults]
  );

  // Master download: all VTON bulk products in one ZIP with nested folders
  const handleDownloadAllBulk = useCallback(async () => {
    const completed = bulkResults.filter((r) => r.status === "completed");
    const completedUgc = ugcResults.filter((r) => r.status === "completed" && r.imageData);
    if (completed.length === 0 && completedUgc.length === 0) return;

    let JSZip: any;
    try {
      JSZip = (await import("jszip")).default;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("JSZip not available.", err);
      return;
    }

    const zip = new JSZip();
    const oneIndexed = namingLogic === "folder-name-sequential-1";
    for (const combo of bulkCombinations) {
      const comboResults = completed.filter((r) => r.combinationId === combo.id);
      const comboUgcResults = completedUgc.filter((r) =>
        r.id.startsWith(`ugc-bulk-${combo.id}-`)
      );
      if (comboResults.length === 0 && comboUgcResults.length === 0) continue;
      const safeName = combo.primaryFolder.name.replace(/[<>:"/\\|?*]+/g, "_");
      const folder = zip.folder(safeName)!;
      const sorted = sortResultsByPoseSequence(comboResults, selectedPoses);
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        try {
          const resp = await fetch(r.imageData);
          const blob = await resp.blob();
          const ext = (blob.type && blob.type.split("/")[1]) || "png";
          folder.file(getSequencedFileName(safeName, i, ext, oneIndexed, skipIndices), blob);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to add image to zip:", e);
        }
        if (r.infographicImages?.length) {
          const counter = computeSkipAwareCounter(i, oneIndexed, skipIndices);
          for (let idx = 0; idx < r.infographicImages.length; idx++) {
            try {
              const resp = await fetch(r.infographicImages[idx]);
              const blob = await resp.blob();
              const ext = (blob.type && blob.type.split("/")[1]) || "png";
              folder.file(!oneIndexed && counter === 0
                ? `${safeName}-infographic-${idx + 1}.${ext}`
                : `${safeName}_${counter}-infographic-${idx + 1}.${ext}`, blob);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error("Failed to add infographic to zip:", e);
            }
          }
        }
      }
      if (comboUgcResults.length > 0) {
        const ugcFolder = folder.folder("UGC")!;
        for (const r of comboUgcResults) {
          const safeSName = r.sceneName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
          try {
            const resp = await fetch(r.imageData);
            const blob = await resp.blob();
            const ext = (blob.type && blob.type.split("/")[1]) || "png";
            ugcFolder.file(`${safeSName}.${ext}`, blob);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Failed to add UGC image to zip:", e);
          }
          if (r.infographicImages?.length) {
            for (let idx = 0; idx < r.infographicImages.length; idx++) {
              try {
                const resp = await fetch(r.infographicImages[idx]);
                const blob = await resp.blob();
                const ext = (blob.type && blob.type.split("/")[1]) || "png";
                ugcFolder.file(`${safeSName}-infographic-${idx + 1}.${ext}`, blob);
              } catch (e) {
                // eslint-disable-next-line no-console
                console.error("Failed to add UGC infographic to zip:", e);
              }
            }
          }
        }
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = "all-products.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [bulkResults, bulkCombinations, ugcResults, selectedPoses, namingLogic, skipIndices]);

  // Download all UGC images in bulk mode as a ZIP with nested product folders
  const handleDownloadAllUgcBulk = useCallback(async () => {
    const completedUgc = ugcResults.filter((r) => r.status === "completed" && r.imageData);
    if (completedUgc.length === 0) return;

    let JSZip: any;
    try {
      JSZip = (await import("jszip")).default;
    } catch (err) {
      console.error("JSZip not available.", err);
      return;
    }

    const zip = new JSZip();
    for (const combo of bulkCombinations) {
      const comboUgc = completedUgc.filter((r) => r.id.startsWith(`ugc-bulk-${combo.id}-`));
      if (comboUgc.length === 0) continue;
      const safeName = combo.primaryFolder.name.replace(/[<>:"/\\|?*]+/g, "_");
      const folder = zip.folder(safeName)!;
      for (const r of comboUgc) {
        const safeSName = r.sceneName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
        try {
          const resp = await fetch(r.imageData);
          const blob = await resp.blob();
          const ext = (blob.type && blob.type.split("/")[1]) || "png";
          folder.file(`${safeSName}.${ext}`, blob);
        } catch (e) {
          console.error("Failed to add UGC image to zip:", e);
        }
        if (r.infographicImages?.length) {
          for (let idx = 0; idx < r.infographicImages.length; idx++) {
            try {
              const resp = await fetch(r.infographicImages[idx]);
              const blob = await resp.blob();
              const ext = (blob.type && blob.type.split("/")[1]) || "png";
              folder.file(`${safeSName}-infographic-${idx + 1}.${ext}`, blob);
            } catch (e) {
              console.error("Failed to add UGC infographic to zip:", e);
            }
          }
        }
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ugc-all-products.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [ugcResults, bulkCombinations]);

  // Download all UGC images in single mode as a ZIP
  const handleDownloadAllUgcSingle = useCallback(async () => {
    const completedUgc = ugcResults.filter((r) => r.status === "completed" && r.imageData);
    if (completedUgc.length === 0) return;

    let JSZip: any;
    try {
      JSZip = (await import("jszip")).default;
    } catch (err) {
      console.error("JSZip not available.", err);
      return;
    }

    const zip = new JSZip();
    for (const r of completedUgc) {
      const safeName = r.sceneName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      try {
        const resp = await fetch(r.imageData);
        const blob = await resp.blob();
        const ext = (blob.type && blob.type.split("/")[1]) || "png";
        zip.file(`${safeName}.${ext}`, blob);
      } catch (e) {
        console.error("Failed to add UGC image to zip:", e);
      }
      if (r.infographicImages?.length) {
        for (let idx = 0; idx < r.infographicImages.length; idx++) {
          try {
            const resp = await fetch(r.infographicImages[idx]);
            const blob = await resp.blob();
            const ext = (blob.type && blob.type.split("/")[1]) || "png";
            zip.file(`${safeName}-infographic-${idx + 1}.${ext}`, blob);
          } catch (e) {
            console.error("Failed to add UGC infographic to zip:", e);
          }
        }
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ugc-images-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [ugcResults]);

  // Master download: all Model Swap bulk products in one ZIP with nested folders
  const handleDownloadAllModelSwapBulk = useCallback(async () => {
    const completed = modelSwapBulkResults.filter((r) => r.status === "completed" || r.status === "skipped");
    if (completed.length === 0) return;

    let JSZip: any;
    try {
      JSZip = (await import("jszip")).default;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("JSZip not available.", err);
      return;
    }

    const zip = new JSZip();
    for (const combo of modelSwapBulkCombinations) {
      const comboResults = completed.filter((r) => r.combinationId === combo.id);
      if (comboResults.length === 0) continue;
      const safeName = combo.primaryFolder.name.replace(/[<>:"/\\|?*]+/g, "_");
      const folder = zip.folder(safeName)!;
      for (let i = 0; i < comboResults.length; i++) {
        const r = comboResults[i];
        try {
          const resp = await fetch(r.imageData);
          const blob = await resp.blob();
          const ext = (blob.type && blob.type.split("/")[1]) || "png";
          folder.file(`${i + 1}.${ext}`, blob);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to add image to zip:", e);
        }
        if (r.infographicImages?.length) {
          for (let idx = 0; idx < r.infographicImages.length; idx++) {
            try {
              const resp = await fetch(r.infographicImages[idx]);
              const blob = await resp.blob();
              const ext = (blob.type && blob.type.split("/")[1]) || "png";
              folder.file(`${i + 1}-infographic-${idx + 1}.${ext}`, blob);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error("Failed to add infographic to zip:", e);
            }
          }
        }
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = "all-products.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [modelSwapBulkResults, modelSwapBulkCombinations]);

  // ======================================================================
  // SET PRODUCT GENERATION (single + bulk)
  // ======================================================================
  const handleSetProductGenerate = useCallback(async () => {
    if (!apiKey) return;

    const isBulkMode = mode === "bulk";

    if (isBulkMode) {
      // Bulk set product
      if (setProductBulkCombinations.length === 0) return;

      setIsGenerating(true);
      try {
        const allResults: SetBulkResult[] = setProductBulkCombinations.map((combo) => ({
          id: `set-res-${combo.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          combinationId: combo.id,
          combinationLabel: `${combo.setFolder.name} + ${combo.modelImage.name}`,
          setFolderName: combo.setFolder.name,
          prompt: "",
          imageData: "",
          status: "pending" as const,
        }));

        setSetProductResults(allResults);

        const processResult = async (result: SetBulkResult) => {
          const combo = setProductBulkCombinations.find((c) => c.id === result.combinationId);
          if (!combo) return;

          const bulkModelImg: ModelImage = {
            file: combo.modelImage.file,
            preview: combo.modelImage.preview,
          };

          const collectedCosts: StepCost[] = [];
          let retrySteps: StepCost[] | undefined;

          const generate = async () => {
            collectedCosts.length = 0;
            updateSetProductResult(result.id, { status: "generating-prompt", error: undefined });

            const promptResult = await generateSetProductPrompt({
              apiKey,
              textGenModel,
              productCategory,
              gender,
              garmentType,
              footwearType,
              fit,
              variants: combo.setFolder.variants,
              layoutStyle: setProductLayout,
              background: combo.background,
              model: null,
              modelImage: bulkModelImg,
              aspectRatio,
              additionalInfo,
              productInfo: combo.setFolder.productInfo || "",
            });
            collectedCosts.push(promptResult.cost);

            updateSetProductResult(result.id, { prompt: promptResult.text, status: "generating-image" });

            const imageResult = await generateSetProductImage({
              apiKey,
              prompt: promptResult.text,
              variants: combo.setFolder.variants,
              modelImage: bulkModelImg,
              aspectRatio,
              imageSize: imageQuality,
            });
            collectedCosts.push(imageResult.cost);

            const totalCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
            const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
            updateSetProductResult(result.id, {
              imageData: imageResult.imageData,
              status: "completed",
              costBreakdown: { steps: [...collectedCosts], totalCost: totalCost + retryCost, retrySteps },
            });
          };

          try {
            await generate();
          } catch {
            try {
              retrySteps = [...collectedCosts];
              updateSetProductResult(result.id, { status: "auto-retrying", error: undefined });
              await new Promise((r) => setTimeout(r, 1000));
              await generate();
            } catch (retryError) {
              const allCosts = [...(retrySteps || []), ...collectedCosts];
              const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
              updateSetProductResult(result.id, {
                status: "error",
                error: retryError instanceof Error ? retryError.message : "Unknown error",
                costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
              });
            }
          }
        };

        const CONCURRENCY_LIMIT = 3;
        for (let i = 0; i < allResults.length; i += CONCURRENCY_LIMIT) {
          const batch = allResults.slice(i, i + CONCURRENCY_LIMIT);
          await Promise.all(batch.map(processResult));
        }
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Single set product
      if (setProductVariants.length < 2 || !setProductVariants.every((v) => v.images.length > 0)) return;
      if (!selectedModel && !modelImage) return;

      setIsGenerating(true);
      try {
        const singleResult: SetBulkResult = {
          id: `set-res-single-${Date.now()}`,
          combinationId: "single",
          combinationLabel: "Set Product",
          setFolderName: "Set Product",
          prompt: "",
          imageData: "",
          status: "pending",
        };
        setSetProductResults([singleResult]);

        const collectedCosts: StepCost[] = [];
        let retrySteps: StepCost[] | undefined;

        const generate = async () => {
          collectedCosts.length = 0;
          updateSetProductResult(singleResult.id, { status: "generating-prompt", error: undefined });

          const promptResult = await generateSetProductPrompt({
            apiKey,
            textGenModel,
            productCategory,
            gender,
            garmentType,
            footwearType,
            fit,
            variants: setProductVariants,
            layoutStyle: setProductLayout,
            background,
            model: selectedModel,
            modelImage,
            aspectRatio,
            additionalInfo,
            productInfo,
          });
          collectedCosts.push(promptResult.cost);

          updateSetProductResult(singleResult.id, { prompt: promptResult.text, status: "generating-image" });

          const imageResult = await generateSetProductImage({
            apiKey,
            prompt: promptResult.text,
            variants: setProductVariants,
            modelImage,
            aspectRatio,
            imageSize: imageQuality,
          });
          collectedCosts.push(imageResult.cost);

          const totalCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
          updateSetProductResult(singleResult.id, {
            imageData: imageResult.imageData,
            status: "completed",
            costBreakdown: { steps: [...collectedCosts], totalCost: totalCost + retryCost, retrySteps },
          });
        };

        try {
          await generate();
        } catch {
          try {
            retrySteps = [...collectedCosts];
            updateSetProductResult(singleResult.id, { status: "auto-retrying", error: undefined });
            await new Promise((r) => setTimeout(r, 1000));
            await generate();
          } catch (retryError) {
            const allCosts = [...(retrySteps || []), ...collectedCosts];
            const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
            updateSetProductResult(singleResult.id, {
              status: "error",
              error: retryError instanceof Error ? retryError.message : "Unknown error",
              costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
            });
          }
        }
      } finally {
        setIsGenerating(false);
      }
    }
  }, [
    apiKey, textGenModel, mode, productCategory, gender, garmentType, footwearType, fit,
    setProductVariants, setProductLayout, setProductBulkCombinations,
    background, selectedModel, modelImage, aspectRatio, additionalInfo,
    productInfo, imageQuality,
    setIsGenerating, setSetProductResults, updateSetProductResult,
  ]);

  // ======================================================================
  // MODEL SWAP - SINGLE MODE GENERATION
  // ======================================================================
  const handleModelSwapGenerate = useCallback(async () => {
    if (garmentImages.length === 0 || (!selectedModel && !modelImage) || !apiKey) return;

    setIsGenerating(true);

    try {
    const initialResults: ModelSwapGeneratedResult[] = garmentImages.map((img) => ({
      id: `ms-result-${img.id}-${Date.now()}`,
      sourceImageId: img.id,
      sourceImagePreview: img.preview,
      prompt: "",
      imageData: "",
      status: "pending",
    }));
    setModelSwapResults(initialResults);

    const processImage = async (result: ModelSwapGeneratedResult) => {
      const sourceImg = garmentImages.find((g) => g.id === result.sourceImageId);
      if (!sourceImg) return;

      const collectedCosts: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      // Pre-check: is a human model visible in the source image?
      updateModelSwapResult(result.id, { status: "checking-human", error: undefined });
      const visibilityCheck = await checkHumanVisibility({ apiKey, textGenModel, sourceImage: sourceImg.file });
      if (visibilityCheck.cost) collectedCosts.push(visibilityCheck.cost);

      if (!visibilityCheck.humanVisible) {
        const totalCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
        updateModelSwapResult(result.id, {
          status: "skipped",
          imageData: sourceImg.preview,
          prompt: `No human model detected — original image returned. ${visibilityCheck.reason}`,
          costBreakdown: totalCost > 0 ? { steps: [...collectedCosts], totalCost, retrySteps: undefined } : undefined,
        });
        return;
      }

      // Product-level Pose Variation toggle for this source image (Model Swap single mode).
      // Default: false (strict exact-pose reproduction). When true, the prompt is allowed
      // to introduce subtle gaze/hand/stance variation within locked framing & body orientation.
      const poseVariation = sourceImg.poseVariation === true;

      const generate = async () => {
        collectedCosts.length = 0;
        if (visibilityCheck.cost) collectedCosts.push(visibilityCheck.cost);
        updateModelSwapResult(result.id, { status: "generating-prompt", error: undefined });

        const promptResult = await generateModelSwapPrompt({
          apiKey,
          textGenModel,
          gender,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          model: selectedModel,
          modelImage,
          backgroundMode: modelSwapBgMode,
          background,
          aspectRatio,
          additionalInfo,
          productInfo,
          poseVariation,
        });
        collectedCosts.push(promptResult.cost);

        updateModelSwapResult(result.id, { prompt: promptResult.text, status: "generating-image" });

        const imageResult = await generateModelSwapImage({
          apiKey,
          prompt: promptResult.text,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          modelImage,
          backgroundMode: modelSwapBgMode,
          background,
          aspectRatio,
          imageSize: imageQuality,
          poseVariation,
        });
        collectedCosts.push(imageResult.cost);

        updateModelSwapResult(result.id, {
          imageData: imageResult.imageData,
          status: "completed",
          validationStatus: skipValidationRef.current ? "skipped" : "validating",
          imageGenResponseContent: imageResult.responseContent,
          editHistory: [],
        });

        if (skipValidationRef.current) return;
        validateGeneratedImage({
          apiKey,
          textGenModel,
          originalImages: [sourceImg.file],
          generatedImageData: imageResult.imageData,
          validationMode: "model-swap",
          allowPoseVariation: poseVariation,
        }).then((v) => {
          if (v.cost) collectedCosts.push(v.cost);
          const mainCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
          updateModelSwapResult(result.id, {
            validationStatus: v.status,
            validationMessage: v.message,
            costBreakdown: { steps: [...collectedCosts], totalCost: mainCost + retryCost, retrySteps },
          });
        });
      };

      try {
        await generate();
      } catch {
        try {
          retrySteps = [...collectedCosts];
          updateModelSwapResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          await generate();
        } catch (retryError) {
          const allCosts = [...(retrySteps || []), ...collectedCosts];
          const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
          updateModelSwapResult(result.id, {
            status: "error",
            error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
            costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
          });
        }
      }
    };

    const CONCURRENCY_LIMIT = 7;
    for (let i = 0; i < initialResults.length; i += CONCURRENCY_LIMIT) {
      const batch = initialResults.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(processImage));
    }
    } finally {
      setIsGenerating(false);
    }
  }, [
    garmentImages, selectedModel, modelImage, apiKey, textGenModel, gender,
    modelSwapBgMode, background, aspectRatio, additionalInfo, productInfo,
    imageQuality, setModelSwapResults, updateModelSwapResult, setIsGenerating,
  ]);

  // ======================================================================
  // MODEL SWAP - BULK MODE GENERATION
  // ======================================================================
  const handleModelSwapBulkGenerate = useCallback(async () => {
    if (modelSwapBulkCombinations.length === 0 || !apiKey) return;

    setIsGenerating(true);

    try {
    const allResults: ModelSwapBulkResult[] = [];
    for (const combo of modelSwapBulkCombinations) {
      const comboLabel = `${combo.primaryFolder.name} + ${combo.modelImage.name}`;

      for (const img of combo.primaryFolder.images) {
        allResults.push({
          id: `ms-bulk-${combo.id}-${img.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          combinationId: combo.id,
          combinationLabel: comboLabel,
          sourceImageId: img.id,
          sourceImagePreview: img.preview,
          prompt: "",
          imageData: "",
          status: "pending",
        });
      }
    }
    setModelSwapBulkResults(allResults);

    const processResult = async (result: ModelSwapBulkResult) => {
      const combo = modelSwapBulkCombinations.find((c) => c.id === result.combinationId);
      if (!combo) return;

      const sourceImg = combo.primaryFolder.images.find((i) => i.id === result.sourceImageId);
      if (!sourceImg) return;

      const bulkModelImg: ModelImage = {
        file: combo.modelImage.file,
        preview: combo.modelImage.preview,
      };

      const collectedCosts: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      // Pre-check: is a human model visible in the source image?
      updateModelSwapBulkResult(result.id, { status: "checking-human", error: undefined });
      const visibilityCheck = await checkHumanVisibility({ apiKey, textGenModel, sourceImage: sourceImg.file });
      if (visibilityCheck.cost) collectedCosts.push(visibilityCheck.cost);

      if (!visibilityCheck.humanVisible) {
        const totalCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
        updateModelSwapBulkResult(result.id, {
          status: "skipped",
          imageData: sourceImg.preview,
          prompt: `No human model detected — original image returned. ${visibilityCheck.reason}`,
          costBreakdown: totalCost > 0 ? { steps: [...collectedCosts], totalCost, retrySteps: undefined } : undefined,
        });
        return;
      }

      // Product-level Pose Variation toggle for this folder (Model Swap bulk mode).
      // The toggle lives on the ProductFolder, so all images in this folder share the setting.
      const poseVariation = combo.primaryFolder.poseVariation === true;

      const generate = async () => {
        collectedCosts.length = 0;
        if (visibilityCheck.cost) collectedCosts.push(visibilityCheck.cost);
        updateModelSwapBulkResult(result.id, { status: "generating-prompt", error: undefined });

        const promptResult = await generateModelSwapPrompt({
          apiKey,
          textGenModel,
          gender,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          model: null,
          modelImage: bulkModelImg,
          backgroundMode: modelSwapBgMode,
          background: combo.background,
          aspectRatio,
          additionalInfo,
          productInfo: combo.primaryFolder.productInfo || "",
          poseVariation,
        });
        collectedCosts.push(promptResult.cost);

        updateModelSwapBulkResult(result.id, { prompt: promptResult.text, status: "generating-image" });

        const imageResult = await generateModelSwapImage({
          apiKey,
          prompt: promptResult.text,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          modelImage: bulkModelImg,
          backgroundMode: modelSwapBgMode,
          background: combo.background,
          aspectRatio,
          imageSize: imageQuality,
          poseVariation,
        });
        collectedCosts.push(imageResult.cost);

        updateModelSwapBulkResult(result.id, {
          imageData: imageResult.imageData,
          status: "completed",
          validationStatus: skipValidationRef.current ? "skipped" : "validating",
          imageGenResponseContent: imageResult.responseContent,
          editHistory: [],
        });

        if (skipValidationRef.current) return;
        validateGeneratedImage({
          apiKey,
          textGenModel,
          originalImages: [sourceImg.file],
          generatedImageData: imageResult.imageData,
          validationMode: "model-swap",
          allowPoseVariation: poseVariation,
        }).then((v) => {
          if (v.cost) collectedCosts.push(v.cost);
          const mainCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
          updateModelSwapBulkResult(result.id, {
            validationStatus: v.status,
            validationMessage: v.message,
            costBreakdown: { steps: [...collectedCosts], totalCost: mainCost + retryCost, retrySteps },
          });
        });
      };

      try {
        await generate();
      } catch {
        try {
          retrySteps = [...collectedCosts];
          updateModelSwapBulkResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          await generate();
        } catch (retryError) {
          const allCosts = [...(retrySteps || []), ...collectedCosts];
          const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
          updateModelSwapBulkResult(result.id, {
            status: "error",
            error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
            costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
          });
        }
      }
    };

    const CONCURRENCY_LIMIT = 7;
    for (let i = 0; i < allResults.length; i += CONCURRENCY_LIMIT) {
      const batch = allResults.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(processResult));
    }
    } finally {
      setIsGenerating(false);
    }
  }, [
    modelSwapBulkCombinations, apiKey, textGenModel, gender, modelSwapBgMode,
    aspectRatio, additionalInfo, productInfo, imageQuality,
    setModelSwapBulkResults, updateModelSwapBulkResult, setIsGenerating,
  ]);

  // Model swap retry/regenerate single — works for both errored and completed results
  const handleRetryModelSwap = useCallback(
    async (result: ModelSwapGeneratedResult) => {
      if (result.status === "pending" || !apiKey) return;
      if (!selectedModel && !modelImage) return;

      const sourceImg = garmentImages.find((g) => g.id === result.sourceImageId);
      if (!sourceImg) return;

      // Capture previous validation feedback before clearing the result
      const previousFeedback = (result.validationStatus === "warning" || result.validationStatus === "error") && result.validationMessage
        ? result.validationMessage
        : undefined;

      const collectedCosts: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      // Pre-check: is a human model visible in the source image?
      updateModelSwapResult(result.id, { status: "checking-human", error: undefined });
      const visibilityCheck = await checkHumanVisibility({ apiKey, textGenModel, sourceImage: sourceImg.file });
      if (visibilityCheck.cost) collectedCosts.push(visibilityCheck.cost);

      if (!visibilityCheck.humanVisible) {
        const totalCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
        updateModelSwapResult(result.id, {
          status: "skipped",
          imageData: sourceImg.preview,
          prompt: `No human model detected — original image returned. ${visibilityCheck.reason}`,
          costBreakdown: totalCost > 0 ? { steps: [...collectedCosts], totalCost, retrySteps: undefined } : undefined,
        });
        return;
      }

      // Product-level Pose Variation toggle (single mode retry). Read from the GarmentImage.
      const poseVariation = sourceImg.poseVariation === true;

      const generate = async () => {
        collectedCosts.length = 0;
        if (visibilityCheck.cost) collectedCosts.push(visibilityCheck.cost);
        updateModelSwapResult(result.id, { status: "generating-prompt", error: undefined });
        const promptResult = await generateModelSwapPrompt({
          apiKey,
          textGenModel,
          gender,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          model: selectedModel,
          modelImage,
          backgroundMode: modelSwapBgMode,
          background,
          aspectRatio,
          additionalInfo,
          productInfo,
          poseVariation,
          previousMismatchFeedback: previousFeedback,
        });
        collectedCosts.push(promptResult.cost);
        updateModelSwapResult(result.id, { prompt: promptResult.text, status: "generating-image" });

        const imageResult = await generateModelSwapImage({
          apiKey,
          prompt: promptResult.text,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          modelImage,
          backgroundMode: modelSwapBgMode,
          background,
          aspectRatio,
          imageSize: imageQuality,
          poseVariation,
        });
        collectedCosts.push(imageResult.cost);
        updateModelSwapResult(result.id, {
          imageData: imageResult.imageData,
          status: "completed",
          validationStatus: skipValidationRef.current ? "skipped" : "validating",
          validationMessage: undefined,
          imageGenResponseContent: imageResult.responseContent,
          editHistory: [],
        });

        if (skipValidationRef.current) return;
        validateGeneratedImage({
          apiKey,
          textGenModel,
          originalImages: [sourceImg.file],
          generatedImageData: imageResult.imageData,
          validationMode: "model-swap",
          allowPoseVariation: poseVariation,
        }).then((v) => {
          if (v.cost) collectedCosts.push(v.cost);
          const mainCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
          updateModelSwapResult(result.id, {
            validationStatus: v.status,
            validationMessage: v.message,
            costBreakdown: { steps: [...collectedCosts], totalCost: mainCost + retryCost, retrySteps },
          });
        });
      };

      try {
        await generate();
      } catch {
        try {
          retrySteps = [...collectedCosts];
          updateModelSwapResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          await generate();
        } catch (retryError) {
          const allCosts = [...(retrySteps || []), ...collectedCosts];
          const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
          updateModelSwapResult(result.id, {
            status: "error",
            error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
            costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
          });
        }
      }
    },
    [apiKey, textGenModel, gender, selectedModel, modelImage, garmentImages, modelSwapBgMode, background, aspectRatio, additionalInfo, productInfo, imageQuality, updateModelSwapResult]
  );

  const handleRetryAllMismatchedModelSwap = useCallback(async () => {
    const mismatched = modelSwapResults.filter((r) => r.validationStatus === "warning" && r.status === "completed");
    if (mismatched.length === 0 || isGenerating) return;
    setIsGenerating(true);
    try {
      const CONCURRENCY = 5;
      for (let i = 0; i < mismatched.length; i += CONCURRENCY) {
        const batch = mismatched.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((r) => handleRetryModelSwap(r)));
      }
    } finally {
      setIsGenerating(false);
    }
  }, [modelSwapResults, isGenerating, handleRetryModelSwap, setIsGenerating]);

  // Model swap download
  const handleModelSwapDownload = useCallback(async (imageData: string, sourceId: string) => {
    try {
      const resp = await fetch(imageData);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `model-swap-${sourceId}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      const link = document.createElement("a");
      link.href = imageData;
      link.download = `model-swap-${sourceId}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  // Model swap retry/regenerate single bulk result — works for both errored and completed results
  const handleRetryModelSwapBulk = useCallback(
    async (result: ModelSwapBulkResult) => {
      if (result.status === "pending" || !apiKey) return;
      const combo = modelSwapBulkCombinations.find((c) => c.id === result.combinationId);
      if (!combo) return;

      const sourceImg = combo.primaryFolder.images.find((i) => i.id === result.sourceImageId);
      if (!sourceImg) return;

      const bulkModelImg: ModelImage = {
        file: combo.modelImage.file,
        preview: combo.modelImage.preview,
      };

      // Capture previous validation feedback before clearing the result
      const previousFeedback = (result.validationStatus === "warning" || result.validationStatus === "error") && result.validationMessage
        ? result.validationMessage
        : undefined;

      const collectedCosts: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      // Pre-check: is a human model visible in the source image?
      updateModelSwapBulkResult(result.id, { status: "checking-human", error: undefined });
      const visibilityCheck = await checkHumanVisibility({ apiKey, textGenModel, sourceImage: sourceImg.file });
      if (visibilityCheck.cost) collectedCosts.push(visibilityCheck.cost);

      if (!visibilityCheck.humanVisible) {
        const totalCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
        updateModelSwapBulkResult(result.id, {
          status: "skipped",
          imageData: sourceImg.preview,
          prompt: `No human model detected — original image returned. ${visibilityCheck.reason}`,
          costBreakdown: totalCost > 0 ? { steps: [...collectedCosts], totalCost, retrySteps: undefined } : undefined,
        });
        return;
      }

      // Product-level Pose Variation toggle (bulk mode retry). Read from the ProductFolder.
      const poseVariation = combo.primaryFolder.poseVariation === true;

      const generate = async () => {
        collectedCosts.length = 0;
        if (visibilityCheck.cost) collectedCosts.push(visibilityCheck.cost);
        updateModelSwapBulkResult(result.id, { status: "generating-prompt", error: undefined, imageData: "" });
        const promptResult = await generateModelSwapPrompt({
          apiKey,
          textGenModel,
          gender,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          model: null,
          modelImage: bulkModelImg,
          backgroundMode: modelSwapBgMode,
          background: combo.background,
          aspectRatio,
          additionalInfo,
          productInfo: combo.primaryFolder.productInfo || "",
          poseVariation,
          previousMismatchFeedback: previousFeedback,
        });
        collectedCosts.push(promptResult.cost);
        updateModelSwapBulkResult(result.id, { prompt: promptResult.text, status: "generating-image" });

        const imageResult = await generateModelSwapImage({
          apiKey,
          prompt: promptResult.text,
          sourceImage: { file: sourceImg.file, preview: sourceImg.preview },
          modelImage: bulkModelImg,
          backgroundMode: modelSwapBgMode,
          background: combo.background,
          aspectRatio,
          imageSize: imageQuality,
          poseVariation,
        });
        collectedCosts.push(imageResult.cost);
        updateModelSwapBulkResult(result.id, {
          imageData: imageResult.imageData,
          status: "completed",
          validationStatus: skipValidationRef.current ? "skipped" : "validating",
          validationMessage: undefined,
          imageGenResponseContent: imageResult.responseContent,
          editHistory: [],
        });

        if (skipValidationRef.current) return;
        validateGeneratedImage({
          apiKey,
          textGenModel,
          originalImages: [sourceImg.file],
          generatedImageData: imageResult.imageData,
          validationMode: "model-swap",
          allowPoseVariation: poseVariation,
        }).then((v) => {
          if (v.cost) collectedCosts.push(v.cost);
          const mainCost = collectedCosts.reduce((s, c) => s + c.totalCost, 0);
          const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
          updateModelSwapBulkResult(result.id, {
            validationStatus: v.status,
            validationMessage: v.message,
            costBreakdown: { steps: [...collectedCosts], totalCost: mainCost + retryCost, retrySteps },
          });
        });
      };

      try {
        await generate();
      } catch {
        try {
          retrySteps = [...collectedCosts];
          updateModelSwapBulkResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          await generate();
        } catch (retryError) {
          const allCosts = [...(retrySteps || []), ...collectedCosts];
          const totalCost = allCosts.reduce((s, c) => s + c.totalCost, 0);
          updateModelSwapBulkResult(result.id, {
            status: "error",
            error: retryError instanceof Error ? retryError.message : "Unknown error occurred",
            costBreakdown: totalCost > 0 ? { steps: collectedCosts, totalCost, retrySteps } : undefined,
          });
        }
      }
    },
    [apiKey, textGenModel, gender, modelSwapBulkCombinations, modelSwapBgMode, aspectRatio, additionalInfo, productInfo, imageQuality, updateModelSwapBulkResult]
  );

  const handleRetryAllMismatchedModelSwapBulk = useCallback(async () => {
    const mismatched = modelSwapBulkResults.filter((r) => r.validationStatus === "warning" && r.status === "completed");
    if (mismatched.length === 0 || isGenerating) return;
    setIsGenerating(true);
    try {
      const CONCURRENCY = 3;
      for (let i = 0; i < mismatched.length; i += CONCURRENCY) {
        const batch = mismatched.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((r) => handleRetryModelSwapBulk(r)));
      }
    } finally {
      setIsGenerating(false);
    }
  }, [modelSwapBulkResults, isGenerating, handleRetryModelSwapBulk, setIsGenerating]);

  // Compact provider pickers shown at the top of every results/regenerate view,
  // so the user can switch text/image backends before clicking Retry/Regenerate.
  // Switching writes straight to the store, which the retry handlers read live.
  const providerPickerRow = (
    <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <ProviderPicker
        compact
        title="Prompt Model"
        options={TEXT_GEN_MODELS}
        value={textGenModel}
        onChange={setTextGenModel}
      />
      {featureMode === "vton" && (
        <ProviderPicker
          compact
          title="Image Model"
          options={IMAGE_GEN_MODELS}
          value={imageGenModel}
          onChange={setImageGenModel}
        />
      )}
    </div>
  );

  // ======================================================================
  // MODEL SWAP - BULK MODE RENDER
  // ======================================================================
  if (isModelSwap && mode === "bulk") {
    const totalBulkResults = modelSwapBulkResults.length;
    const completedBulkResults = modelSwapBulkResults.filter((r) => r.status === "completed" || r.status === "skipped").length;
    const pgCount = primaryFolders.filter((f) => f.images.length > 0).length;
    const totalImages = primaryFolders.filter((f) => f.images.length > 0).reduce((sum, f) => sum + f.images.length, 0);

    const resultsByCombo = new Map<string, ModelSwapBulkResult[]>();
    for (const r of modelSwapBulkResults) {
      if (!resultsByCombo.has(r.combinationId)) resultsByCombo.set(r.combinationId, []);
      resultsByCombo.get(r.combinationId)!.push(r);
    }

    return (
      <div className="space-y-6">
        {providerPickerRow}
        {/* Bulk Summary */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Model Swap Summary</h3>
            <Badge variant="secondary" className="text-xs">Bulk Mode</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Products</p>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                {pgCount}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">New Models</p>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                {bulkModelImages.length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Background</p>
              <p className="text-sm font-semibold">
                {modelSwapBgMode === "keep-same" ? "Keep Same" : `${bulkBackgrounds.length || "Default"} new`}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Images</p>
              <p className="text-lg font-bold text-primary">{totalImages}</p>
            </div>
          </div>

          {/* Combination breakdown */}
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Assignments ({modelSwapBulkCombinations.length})
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {modelSwapBulkCombinations.map((combo, i) => (
                <div
                  key={combo.id}
                  className="flex items-center gap-2 text-xs rounded-lg border border-border px-3 py-2 bg-muted/15"
                >
                  <span className="text-muted-foreground font-mono w-5 shrink-0">{i + 1}.</span>
                  <Badge variant="secondary" className="text-[11px]">
                    {combo.primaryFolder.name}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge className="text-[11px] bg-primary/10 text-primary dark:text-primary border-primary/30">
                    {combo.modelImage.name}
                  </Badge>
                  <span className="ml-auto text-muted-foreground">
                    {combo.primaryFolder.images.length} image{combo.primaryFolder.images.length !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Image Quality */}
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Image Quality</p>
          <div className="flex items-center gap-2 ml-2">
            {(["1K", "2K", "4K"] as const).map((q) => (
              <label key={q} className="inline-flex items-center text-xs">
                <input type="radio" name="msImageQualityBulk" value={q} checked={imageQuality === q} onChange={() => setImageQuality(q)} className="mr-1" />
                {q}
              </label>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        {modelSwapBulkResults.length === 0 && (
          <Button
            onClick={handleModelSwapBulkGenerate}
            disabled={isGenerating || !apiKey || modelSwapBulkCombinations.length === 0}
            className="w-full h-14 text-base font-semibold rounded-xl gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm transition-colors duration-200"
            size="lg"
          >
            <Sparkles className="w-5 h-5" />
            Swap Models in {totalImages} Image{totalImages !== 1 ? "s" : ""}
          </Button>
        )}

        {/* Progress */}
        {modelSwapBulkResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {isGenerating ? "Generating..." : `${completedBulkResults}/${totalBulkResults} completed`}
              </p>
              <div className="flex items-center gap-2">
                {!isGenerating && completedBulkResults > 0 && (
                  <Button
                    onClick={handleDownloadAllModelSwapBulk}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download All
                  </Button>
                )}
                {!isGenerating && modelSwapBulkResults.some((r) => r.validationStatus === "warning" && r.status === "completed") && (
                  <Button
                    onClick={handleRetryAllMismatchedModelSwapBulk}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Regenerate Mismatched ({modelSwapBulkResults.filter((r) => r.validationStatus === "warning" && r.status === "completed").length})
                  </Button>
                )}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${totalBulkResults > 0 ? (completedBulkResults / totalBulkResults) * 100 : 0}%` }}
              />
            </div>
            {validationFilterBar(modelSwapBulkResults)}
          </div>
        )}

        {/* Results grouped by combination */}
        {modelSwapBulkResults.length > 0 && (
          <div className="space-y-4">
            {modelSwapBulkCombinations.map((combo) => {
              const allComboResults = resultsByCombo.get(combo.id) || [];
              const comboResults = filterByValidation(allComboResults);
              const comboCompleted = allComboResults.filter((r) => r.status === "completed").length;
              const isExpanded = expandedCombos[combo.id] !== false;

              return (
                <div key={combo.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleCombo(combo.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCombo(combo.id); } }}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{combo.primaryFolder.name}</Badge>
                      <span className="text-xs text-muted-foreground">→</span>
                      <Badge className="text-xs bg-primary/10 text-primary dark:text-primary border-primary/30">
                        {combo.modelImage.name}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{comboCompleted}/{allComboResults.length}</span>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadAllModelSwapCombo(combo.id, combo.primaryFolder.name);
                        }}
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1.5"
                        disabled={comboCompleted === 0}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {comboResults.map((result) => (
                          <div key={result.id} className="rounded-xl border border-border bg-background overflow-hidden">
                            <div className="aspect-[3/4] bg-muted/30 relative flex items-center justify-center overflow-hidden">
                              {(result.status === "completed" || result.status === "skipped") && result.imageData ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={result.imageData} alt="Model Swap" className="w-full h-full object-cover" />
                                  {result.status === "skipped" && (
                                    <div className="absolute top-2 left-2 bg-blue-500/90 text-white text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <SkipForward className="w-3 h-3" />
                                      No Model
                                    </div>
                                  )}
                                  {result.status === "completed" && <CostBreakdownPopover costBreakdown={result.costBreakdown} skip={skipValidation} />}
                                  {result.status === "completed" && <ValidationBadge status={result.validationStatus} message={result.validationMessage} />}
                                </>
                              ) : result.status === "error" ? (
                                <div className="flex flex-col items-center gap-3 p-4 text-center">
                                  <AlertCircle className="w-6 h-6 text-red-400" />
                                  <p className="text-xs text-red-500 font-medium">Failed</p>
                                  <p className="text-[11px] text-muted-foreground max-w-[160px]">{result.error}</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRetryModelSwapBulk(result)}
                                    disabled={!apiKey}
                                    className="rounded-lg gap-1.5 h-8 text-xs"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    Retry
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2">
                                  {result.status === "checking-human" ? (
                                    <>
                                      <Eye className="w-5 h-5 text-blue-500 animate-pulse" />
                                      <p className="text-[11px] text-muted-foreground">Checking image...</p>
                                    </>
                                  ) : result.status === "auto-retrying" ? (
                                    <>
                                      <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                                      <p className="text-[11px] text-muted-foreground">Auto-retrying...</p>
                                    </>
                                  ) : result.status === "generating-prompt" ? (
                                    <>
                                      <Wand2 className="w-5 h-5 text-amber-500 animate-pulse" />
                                      <p className="text-[11px] text-muted-foreground">Writing prompt...</p>
                                    </>
                                  ) : result.status === "generating-image" ? (
                                    <>
                                      <ImageIcon className="w-5 h-5 text-amber-500 animate-pulse" />
                                      <p className="text-[11px] text-muted-foreground">Swapping model...</p>
                                    </>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20" />
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {getStatusIcon(result.status)}
                                  <p className="text-[11px] text-muted-foreground">{getStatusText(result.status)}</p>
                                </div>
                                {result.status === "completed" && result.imageData && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant={editingResultId === result.id ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => {
                                        if (editingResultId === result.id) { setEditingResultId(null); setEditText(""); }
                                        else { setEditingResultId(result.id); setEditText(""); }
                                      }}
                                      disabled={!result.imageGenResponseContent}
                                      className={cn("rounded-md gap-1 h-7 px-2 text-[11px]", editingResultId === result.id && "bg-violet-600 hover:bg-violet-700 text-white")}
                                      title="Edit with feedback"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRetryModelSwapBulk(result)}
                                      className="rounded-md gap-1 h-7 px-2 text-[11px]"
                                      title="Regenerate"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setInfographicImage({ src: result.imageData, poseName: result.sourceImageId, resultId: result.id, resultType: "model-swap-bulk" })} className="rounded-md gap-1 h-7 px-2 text-[11px]">
                                      <Layers className="w-3 h-3" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleModelSwapDownload(result.imageData, result.sourceImageId)} className="rounded-md gap-1 h-7 px-2 text-[11px]">
                                      <Download className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                                {result.status === "skipped" && result.imageData && (
                                  <div className="flex items-center gap-1">
                                    <Button variant="outline" size="sm" onClick={() => handleModelSwapDownload(result.imageData, result.sourceImageId)} className="rounded-md gap-1 h-7 px-2 text-[11px]" title="Save Original">
                                      <Download className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {editingResultId === result.id && result.status === "completed" && (
                                <div className="flex items-center gap-2 p-2 rounded-lg border border-violet-500/30 bg-violet-500/5 mt-2">
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && editText.trim()) handleEditModelSwapBulk(result, editText.trim()); }}
                                    placeholder="Describe what to change..."
                                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none px-2"
                                    autoFocus
                                  />
                                  <Button size="sm" onClick={() => { if (editText.trim()) handleEditModelSwapBulk(result, editText.trim()); }} disabled={!editText.trim()} className="rounded-lg gap-1 h-6 px-2 bg-violet-600 hover:bg-violet-700 text-white text-[11px]">
                                    <Send className="w-2.5 h-2.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingResultId(null); setEditText(""); }} className="rounded-lg h-6 w-6 p-0">
                                    <X className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <InfographicEditor
          open={infographicImage !== null}
          onOpenChange={(open) => { if (!open) setInfographicImage(null); }}
          baseImageSrc={infographicImage?.src ?? ""}
          poseName={infographicImage?.poseName ?? ""}
          productInfo={infographicProductInfo}
          apiKey={apiKey}
          onSave={handleInfographicSave}
        />
      </div>
    );
  }

  // ======================================================================
  // MODEL SWAP - SINGLE MODE RENDER
  // ======================================================================
  if (isModelSwap && mode === "single") {
    const msCompletedCount = modelSwapResults.filter((r) => r.status === "completed" || r.status === "skipped").length;
    const msTotalCount = modelSwapResults.length;

    return (
      <div className="space-y-6">
        {providerPickerRow}
        {/* Summary */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Model Swap Summary</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Product Images</p>
              <p className="text-sm font-semibold">{garmentImages.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">New Model</p>
              <div className="flex items-center gap-2">
                <ModelThumb
                  modelName={selectedModel?.name || "Custom"}
                  modelPreview={modelImage?.preview}
                  size={28}
                />
                <p className="text-sm font-semibold">{selectedModel?.name || (modelImage ? "Custom" : "None")}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Background</p>
              <p className="text-sm font-semibold">{modelSwapBgMode === "keep-same" ? "Keep Same" : "New"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Aspect Ratio</p>
              <p className="text-sm font-semibold">{aspectRatio}</p>
            </div>
          </div>
          {/* Image Quality */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Image Quality</p>
            <div className="flex items-center gap-3 mt-2">
              {(["1K", "2K", "4K"] as const).map((q) => (
                <label key={q} className="inline-flex items-center text-sm">
                  <input type="radio" name="msImageQuality" value={q} checked={imageQuality === q} onChange={() => setImageQuality(q)} className="mr-2" />
                  <span className="text-sm">{q}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        {modelSwapResults.length === 0 && (
          <Button
            onClick={handleModelSwapGenerate}
            disabled={isGenerating || !apiKey || garmentImages.length === 0 || (!selectedModel && !modelImage)}
            className="w-full h-14 text-base font-semibold rounded-xl gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm transition-colors duration-200"
            size="lg"
          >
            <Sparkles className="w-5 h-5" />
            Swap Model in {garmentImages.length} Image{garmentImages.length !== 1 ? "s" : ""}
          </Button>
        )}

        {/* Progress */}
        {modelSwapResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {isGenerating ? "Generating..." : `${msCompletedCount}/${msTotalCount} completed`}
              </p>
              <div className="flex items-center gap-2">
                {!isGenerating && msCompletedCount > 0 && (
                  <Button
                    onClick={handleDownloadAllModelSwapSingle}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download All
                  </Button>
                )}
                {!isGenerating && msCompletedCount < msTotalCount && (
                  <Button onClick={handleModelSwapGenerate} size="sm" variant="outline" className="rounded-xl gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Regenerate All
                  </Button>
                )}
                {!isGenerating && modelSwapResults.some((r) => r.validationStatus === "warning" && r.status === "completed") && (
                  <Button
                    onClick={handleRetryAllMismatchedModelSwap}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Regenerate Mismatched ({modelSwapResults.filter((r) => r.validationStatus === "warning" && r.status === "completed").length})
                  </Button>
                )}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${msTotalCount > 0 ? (msCompletedCount / msTotalCount) * 100 : 0}%` }}
              />
            </div>
            {validationFilterBar(modelSwapResults)}
          </div>
        )}

        {/* Results Grid */}
        {modelSwapResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filterByValidation(modelSwapResults).map((result) => (
              <div key={result.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Before/After */}
                <div className="aspect-[3/4] bg-muted/30 relative flex items-center justify-center overflow-hidden">
                  {(result.status === "completed" || result.status === "skipped") && result.imageData ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={result.imageData} alt="Model Swap Result" className="w-full h-full object-cover" />
                      {result.status === "skipped" && (
                        <div className="absolute top-2 left-2 bg-blue-500/90 text-white text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <SkipForward className="w-3.5 h-3.5" />
                          Original — No Model Detected
                        </div>
                      )}
                      {result.status === "completed" && <CostBreakdownPopover costBreakdown={result.costBreakdown} skip={skipValidation} />}
                      {result.status === "completed" && <ValidationBadge status={result.validationStatus} message={result.validationMessage} />}
                    </>
                  ) : result.status === "error" ? (
                    <div className="flex flex-col items-center gap-3 p-6 text-center">
                      <AlertCircle className="w-8 h-8 text-red-400" />
                      <p className="text-sm text-red-500 font-medium">Generation Failed</p>
                      <p className="text-xs text-muted-foreground max-w-[200px]">{result.error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetryModelSwap(result)}
                        disabled={!apiKey || (!selectedModel && !modelImage)}
                        className="rounded-lg gap-1.5"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      {result.status === "checking-human" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Eye className="w-6 h-6 text-blue-500 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Checking Image</p>
                            <p className="text-xs text-muted-foreground">Detecting human model...</p>
                          </div>
                        </>
                      ) : result.status === "auto-retrying" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Auto-Retrying</p>
                            <p className="text-xs text-muted-foreground">Retrying automatically...</p>
                          </div>
                        </>
                      ) : result.status === "generating-prompt" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <Wand2 className="w-6 h-6 text-amber-500 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Analyzing Image</p>
                            <p className="text-xs text-muted-foreground">Gemini 3 Pro is analyzing...</p>
                          </div>
                        </>
                      ) : result.status === "generating-image" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-amber-500 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Swapping Model</p>
                            <p className="text-xs text-muted-foreground">Nano Banana 2 is creating...</p>
                          </div>
                        </>
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20" />
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <div>
                        <p className="text-xs text-muted-foreground">{getStatusText(result.status)}</p>
                      </div>
                    </div>
                    {result.status === "completed" && result.imageData && (
                      <div className="flex items-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={editingResultId === result.id ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (editingResultId === result.id) {
                                  setEditingResultId(null);
                                  setEditText("");
                                } else {
                                  setEditingResultId(result.id);
                                  setEditText("");
                                }
                              }}
                              disabled={!result.imageGenResponseContent}
                              className={cn("rounded-lg gap-1.5", editingResultId === result.id && "bg-violet-600 hover:bg-violet-700 text-white")}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">Refine this image with feedback{result.editHistory && result.editHistory.length > 0 ? ` (${result.editHistory.length} edit${result.editHistory.length > 1 ? "s" : ""} so far)` : ""}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryModelSwap(result)}
                          className="rounded-lg gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Regenerate
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setInfographicImage({ src: result.imageData, poseName: result.sourceImageId, resultId: result.id, resultType: "model-swap-single" })} className="rounded-lg gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          Infographic
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleModelSwapDownload(result.imageData, result.sourceImageId)} className="rounded-lg gap-1.5">
                          <Download className="w-3.5 h-3.5" />
                          Save
                        </Button>
                      </div>
                    )}
                    {result.status === "skipped" && result.imageData && (
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => handleModelSwapDownload(result.imageData, result.sourceImageId)} className="rounded-lg gap-1.5">
                          <Download className="w-3.5 h-3.5" />
                          Save Original
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Multi-turn Edit Input */}
                  {editingResultId === result.id && result.status === "completed" && (
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-violet-500/30 bg-violet-500/5">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && editText.trim()) handleEditModelSwap(result, editText.trim()); }}
                        placeholder="Describe what to change..."
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none px-2"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => { if (editText.trim()) handleEditModelSwap(result, editText.trim()); }} disabled={!editText.trim()} className="rounded-lg gap-1 h-7 px-2.5 bg-violet-600 hover:bg-violet-700 text-white">
                        <Send className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingResultId(null); setEditText(""); }} className="rounded-lg h-7 w-7 p-0">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Expandable Prompt */}
                  {result.prompt && (
                    <div>
                      <button
                        onClick={() => togglePrompt(result.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedPrompts[result.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {expandedPrompts[result.id] ? "Hide" : "View"} generated prompt
                      </button>
                      {expandedPrompts[result.id] && (
                        <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground leading-relaxed max-h-40 overflow-y-auto">
                          {result.prompt}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <InfographicEditor
          open={infographicImage !== null}
          onOpenChange={(open) => { if (!open) setInfographicImage(null); }}
          baseImageSrc={infographicImage?.src ?? ""}
          poseName={infographicImage?.poseName ?? ""}
          productInfo={infographicProductInfo}
          apiKey={apiKey}
          onSave={handleInfographicSave}
        />
      </div>
    );
  }

  // ======================================================================
  // SET PRODUCT RENDER
  // ======================================================================
  if (setProductEnabled && featureMode === "vton") {
    const spResults = setProductResults;
    const totalSP = spResults.length;
    const completedSP = spResults.filter((r) => r.status === "completed").length;

    const variantsForSummary = mode === "bulk"
      ? setProductFolders.map((f) => `${f.name} (${f.variants.length} variants)`).join(", ")
      : setProductVariants.map((v) => v.name).join(", ");

    const totalOutputs = mode === "bulk" ? setProductBulkCombinations.length : 1;

    const handleSetDownload = (imageData: string, label: string) => {
      const link = document.createElement("a");
      link.href = imageData;
      link.download = `set-product-${label.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="space-y-6">
        {providerPickerRow}
        {/* Summary */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Set Product Summary</h3>
            <Badge variant="secondary" className="text-xs">Set / Combo</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Mode</p>
              <p className="text-sm font-semibold capitalize">{mode}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Layout</p>
              <p className="text-sm font-semibold capitalize">{setProductLayout.replace(/-/g, " ")}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {mode === "bulk" ? "Sets" : "Variants"}
              </p>
              <p className="text-sm font-semibold">
                {mode === "bulk" ? setProductFolders.length : setProductVariants.length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Model</p>
              <div className="flex items-center gap-2">
                <ModelThumb
                  modelName={selectedModel?.name || "Custom"}
                  modelPreview={modelImage?.preview}
                  size={28}
                />
                <p className="text-sm font-semibold">{selectedModel?.name || (modelImage ? "Custom" : "None")}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Output Images</p>
              <p className="text-sm font-semibold">{totalOutputs}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Variants</p>
            <p className="text-sm text-foreground">{variantsForSummary || "None"}</p>
          </div>
          {/* Image Quality */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Image Quality</p>
            <div className="flex items-center gap-3 mt-2">
              {(["1K", "2K", "4K"] as const).map((q) => (
                <label key={q} className="inline-flex items-center text-sm">
                  <input
                    type="radio"
                    name="imageQualitySet"
                    value={q}
                    checked={imageQuality === q}
                    onChange={() => setImageQuality(q)}
                    className="mr-2"
                  />
                  <span className="text-sm">{q}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleSetProductGenerate}
          disabled={isGenerating || !apiKey}
          className="w-full gap-2 rounded-xl py-6 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Set Product...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Set Product ({totalOutputs} image{totalOutputs !== 1 ? "s" : ""})
            </>
          )}
        </Button>

        {/* Progress Bar */}
        {isGenerating && totalSP > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedSP} of {totalSP} completed
              </span>
              <span className="font-medium">{totalSP > 0 ? Math.round((completedSP / totalSP) * 100) : 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
                style={{ width: `${totalSP > 0 ? (completedSP / totalSP) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Results Grid */}
        {spResults.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {spResults.map((result) => (
              <div
                key={result.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="aspect-video bg-muted/30 relative flex items-center justify-center overflow-hidden">
                  {result.status === "completed" && result.imageData ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.imageData}
                        alt={`Set Product - ${result.setFolderName}`}
                        className="w-full h-full object-contain"
                      />
                      <CostBreakdownPopover costBreakdown={result.costBreakdown} skip={skipValidation} />
                    </>
                  ) : result.status === "error" ? (
                    <div className="flex flex-col items-center gap-3 p-6 text-center">
                      <AlertCircle className="w-8 h-8 text-red-400" />
                      <p className="text-sm text-red-500 font-medium">Generation Failed</p>
                      <p className="text-xs text-muted-foreground max-w-[200px]">{result.error}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      {result.status === "auto-retrying" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                          </div>
                          <p className="text-sm font-medium">Auto-Retrying</p>
                        </>
                      ) : result.status === "generating-prompt" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <Wand2 className="w-6 h-6 text-amber-500 animate-pulse" />
                          </div>
                          <p className="text-sm font-medium">Writing Prompt</p>
                        </>
                      ) : result.status === "generating-image" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-amber-500 animate-pulse" />
                          </div>
                          <p className="text-sm font-medium">Generating Image</p>
                        </>
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20" />
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <div>
                        <p className="text-sm font-medium">{result.setFolderName}</p>
                        <p className="text-xs text-muted-foreground">{getStatusText(result.status)}</p>
                      </div>
                    </div>
                    {result.status === "completed" && result.imageData && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setInfographicImage({
                              src: result.imageData,
                              poseName: result.setFolderName,
                              resultId: result.id,
                              resultType: "set-product",
                            })
                          }
                          className="rounded-lg gap-1.5"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          Infographic
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDownload(result.imageData, result.setFolderName)}
                          className="rounded-lg gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save
                        </Button>
                      </div>
                    )}
                  </div>

                  {result.prompt && (
                    <div>
                      <button
                        onClick={() => togglePrompt(result.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedPrompts[result.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {expandedPrompts[result.id] ? "Hide" : "View"} generated prompt
                      </button>
                      {expandedPrompts[result.id] && (
                        <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground leading-relaxed max-h-40 overflow-y-auto">
                          {result.prompt}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Infographic Editor */}
        <InfographicEditor
          open={infographicImage !== null}
          onOpenChange={(open) => { if (!open) setInfographicImage(null); }}
          baseImageSrc={infographicImage?.src ?? ""}
          poseName={infographicImage?.poseName ?? ""}
          productInfo={productInfo || additionalInfo}
          apiKey={apiKey}
          onSave={(imgDataUrl) => {
            if (!infographicImage) return;
            updateSetProductResult(infographicImage.resultId, {
              infographicImages: [
                ...(spResults.find((r) => r.id === infographicImage.resultId)?.infographicImages || []),
                imgDataUrl,
              ],
            });
          }}
        />
      </div>
    );
  }

  // ======================================================================
  // VTON - BULK MODE RENDER
  // ======================================================================
  if (mode === "bulk") {
    const completedBulkPoseResults = bulkResults.filter((r) => r.status === "completed").length;
    const completedBulkUgcResults = ugcResults.filter((r) => r.status === "completed").length;
    const totalBulkResults = bulkResults.length + ugcResults.length;
    const completedBulkResults = completedBulkPoseResults + completedBulkUgcResults;
    const pgCount = primaryFolders.filter((f) => f.images.length > 0).length;
    const totalPoses = selectedPoses.length + customPoses.length;
    const totalUgcImages = pgCount * ugcScenes.length;
    const totalImages = pgCount * totalPoses + totalUgcImages;

    // Group results by combination
    const resultsByCombo = new Map<string, BulkGeneratedResult[]>();
    for (const r of bulkResults) {
      if (!resultsByCombo.has(r.combinationId)) resultsByCombo.set(r.combinationId, []);
      resultsByCombo.get(r.combinationId)!.push(r);
    }

    return (
      <div className="space-y-6">
        {providerPickerRow}
        {/* Bulk Summary */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Bulk Generation Summary</h3>
            <Badge variant="secondary" className="text-xs">
              Bulk Mode
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Primary Products
              </p>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                {pgCount}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Complementary
              </p>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                {complementaryFolders.filter((f) => f.images.length > 0).length || "None"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                AI Models
              </p>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                {bulkModelImages.length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Backgrounds
              </p>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary" />
                {bulkBackgrounds.length || "Default"}
                <span className="text-[10px] font-medium text-muted-foreground">
                  ({bulkBgAssignment === "manual" ? "Manual" : "Round-Robin"})
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Poses
              </p>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Grid3X3 className="w-3.5 h-3.5 text-primary" />
                {totalPoses}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Total Images
              </p>
              <p className="text-lg font-bold text-primary">
                {totalImages}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {pgCount} products &times; {totalPoses} poses{totalUgcImages > 0 ? ` + ${totalUgcImages} UGC` : ""}
              </p>
            </div>
          </div>

          {/* Review & Customize Assignments */}
          <div className="rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <Eye className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Review Assignments
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {bulkCombinations.length} products &times; {totalPoses} poses &mdash; expand to review and customize per pose
                  </p>
                </div>
              </div>
              {overrideCount > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="text-[11px] bg-primary/10 text-primary border-primary/30">
                    {overrideCount} override{overrideCount !== 1 ? "s" : ""}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                    onClick={clearAllBulkPoseOverrides}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset All
                  </Button>
                </div>
              )}
            </div>

            <Accordion type="multiple" className="space-y-1.5">
              {bulkCombinations.map((combo, comboIdx) => {
                const allPoses = [
                  ...selectedPoses.map((p) => ({ id: p.id, name: p.name, icon: p.icon, label: `${p.icon} ${p.name}`, framing: p.framing, isCustom: false as const })),
                  ...customPoses.map((cp) => ({ id: cp.id, name: cp.name || "Custom Pose", icon: "\u2728", label: `\u2728 ${cp.name || "Custom Pose"}`, framing: cp.isModelShot ? "full-body" as const : "product-only" as const, isCustom: true as const })),
                ];
                const productOverrides = bulkPoseOverrides.filter((o) => o.productFolderId === combo.primaryFolder.id);

                return (
                  <AccordionItem key={combo.id} value={combo.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/30 [&[data-state=open]]:border-b [&[data-state=open]]:border-border">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold shrink-0">{comboIdx + 1}</span>
                        <span className="text-sm font-semibold text-foreground truncate">{combo.primaryFolder.name}</span>
                        <span className="text-muted-foreground/50 shrink-0">&rarr;</span>
                        <Badge className="text-[11px] bg-primary/10 text-primary dark:text-primary border-primary/30 shrink-0 flex items-center gap-1.5 py-0.5">
                          <ModelThumb modelName={combo.modelImage.name} modelPreview={combo.modelImage.preview} size={18} />
                          {combo.modelImage.name}
                        </Badge>
                        <Badge className="text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shrink-0 py-0.5">
                          {getBgShortLabel(combo.background)}
                        </Badge>
                        {combo.complementaryFolder && (
                          <Badge variant="outline" className="text-[11px] shrink-0 py-0.5">{combo.complementaryFolder.name}</Badge>
                        )}
                        {productOverrides.length > 0 && (
                          <Badge className="text-[11px] bg-primary/10 text-primary border-primary/30 ml-auto shrink-0 py-0.5">
                            {productOverrides.length} override{productOverrides.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3 pt-2">
                      <div className="space-y-px">
                        <div className="grid grid-cols-[1fr_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center rounded px-2 py-1 text-[11px] bg-muted/40 border border-border mb-1.5">
                          <div className="flex items-center gap-1.5 text-foreground font-medium min-w-0">
                            <Layers className="w-3 h-3 shrink-0" />
                            <span className="truncate">Apply to all poses</span>
                          </div>
                          <div />
                          <Select
                            value={bulkBackgrounds.find((b) => b.config === combo.background)?.id ?? "__default__"}
                            onValueChange={(val) => setProductBackground(combo.primaryFolder.id, val)}
                            disabled={bulkBackgrounds.length === 0}
                          >
                            <SelectTrigger className="h-6 text-[11px] px-2 bg-emerald-500/5 border-emerald-500/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {bulkBackgrounds.length === 0 ? (
                                <SelectItem value="__default__" className="text-[11px]">Default Studio</SelectItem>
                              ) : (
                                bulkBackgrounds.map((b) => (
                                  <SelectItem key={b.id} value={b.id} className="text-[11px]">
                                    {b.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <div />
                          <div className="w-5 shrink-0" />
                        </div>
                        {productOverrides.some((o) => o.backgroundId) && (
                          <p className="text-[10px] text-muted-foreground px-2 mb-1">
                            Tip: changing the background here resets per-pose background overrides for this product.
                          </p>
                        )}
                        {allPoses.map((pose) => {
                          const override = bulkPoseOverrides.find(
                            (o) => o.productFolderId === combo.primaryFolder.id && o.poseId === pose.id
                          );
                          const hasOverride = !!override;
                          const effectiveModelId = override?.modelImageId ?? combo.modelImage.id;
                          const effectiveBgId = override?.backgroundId ?? (bulkBackgrounds.find((b) => b.config === combo.background)?.id ?? "__default__");
                          const effectiveCgId = override?.complementaryFolderId !== undefined
                            ? (override.complementaryFolderId ?? "__none__")
                            : (combo.complementaryFolder?.id ?? "__none__");

                          return (
                            <div
                              key={pose.id}
                              className={cn(
                                "grid grid-cols-[1fr_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center rounded px-2 py-1 text-[11px]",
                                hasOverride ? "bg-primary/5 border border-primary/15" : "hover:bg-muted/20 border border-transparent"
                              )}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 truncate text-muted-foreground" title={pose.label}>
                                {hasOverride && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                                {!pose.isCustom && <PoseMiniThumb poseId={pose.id} icon={pose.icon} isFootwear={isFootwear} size={18} />}
                                {pose.isCustom && <span className="shrink-0 text-xs">{pose.icon}</span>}
                                <span className="truncate">{pose.name}</span>
                                <span className="text-muted-foreground opacity-60 shrink-0">{getFramingShortLabel(pose.framing as PoseFraming)}</span>
                              </div>

                              <Select
                                value={effectiveModelId}
                                onValueChange={(val) => updateBulkPoseOverride(combo.primaryFolder.id, pose.id, { modelImageId: val === combo.modelImage.id ? undefined : val })}
                              >
                                <SelectTrigger className="h-6 text-[11px] px-2 bg-primary/5 border-primary/20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {bulkModelImages.map((m) => (
                                    <SelectItem key={m.id} value={m.id} className="text-[11px]">
                                      {m.name}{m.id === combo.modelImage.id ? " (default)" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={effectiveBgId}
                                onValueChange={(val) => {
                                  const defaultBgId = bulkBackgrounds.find((b) => b.config === combo.background)?.id ?? "__default__";
                                  updateBulkPoseOverride(combo.primaryFolder.id, pose.id, { backgroundId: val === defaultBgId ? undefined : val });
                                }}
                              >
                                <SelectTrigger className="h-6 text-[11px] px-2 bg-emerald-500/5 border-emerald-500/20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {bulkBackgrounds.length === 0 ? (
                                    <SelectItem value="__default__" className="text-[11px]">Default Studio</SelectItem>
                                  ) : (
                                    bulkBackgrounds.map((b) => (
                                      <SelectItem key={b.id} value={b.id} className="text-[11px]">
                                        {b.name}{b.config === combo.background ? " (default)" : ""}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>

                              {complementaryFolders.length > 0 ? (
                                <Select
                                  value={effectiveCgId}
                                  onValueChange={(val) => {
                                    const defaultCgId = combo.complementaryFolder?.id ?? "__none__";
                                    if (val === defaultCgId) {
                                      updateBulkPoseOverride(combo.primaryFolder.id, pose.id, { complementaryFolderId: undefined });
                                    } else if (val === "__none__") {
                                      updateBulkPoseOverride(combo.primaryFolder.id, pose.id, { complementaryFolderId: null });
                                    } else {
                                      updateBulkPoseOverride(combo.primaryFolder.id, pose.id, { complementaryFolderId: val });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-6 text-[11px] px-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__" className="text-[11px]">None</SelectItem>
                                    {complementaryFolders.filter((f) => f.images.length > 0).map((f) => (
                                      <SelectItem key={f.id} value={f.id} className="text-[11px]">
                                        {f.name}{f.id === combo.complementaryFolder?.id ? " (default)" : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-muted-foreground/50 text-[11px]">No CG</span>
                              )}

                              {hasOverride && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={() => removeBulkPoseOverride(combo.primaryFolder.id, pose.id)}
                                  title="Reset to default"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </Button>
                              )}
                              {!hasOverride && <div className="w-5 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                      {allPoses.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <span className="font-mono text-muted-foreground/60">
                              Model
                            </span>
                            <span className="font-mono text-muted-foreground/60">/</span>
                            <span className="font-mono text-muted-foreground/60">
                              Background
                            </span>
                            <span className="font-mono text-muted-foreground/60">/</span>
                            <span className="font-mono text-muted-foreground/60">
                              Complementary
                            </span>
                            &mdash; change any dropdown to override the round-robin default for this pose
                          </span>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          {/* Poses */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Poses ({selectedPoses.length + customPoses.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedPoses.map((pose) => (
                <Badge key={pose.id} variant="secondary" className="text-xs flex items-center gap-1">
                  <PoseMiniThumb poseId={pose.id} icon={pose.icon} isFootwear={isFootwear} size={18} />
                  {pose.name}
                  <span className="ml-0.5 opacity-60">&middot; {getFramingShortLabel(pose.framing)}</span>
                </Badge>
              ))}
              {customPoses.map((cp) => (
                <Badge key={cp.id} variant="secondary" className={cn("text-xs", cp.isModelShot ? "bg-primary/10 text-primary dark:text-primary border-primary/30" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30")}>
                  &#x2728; {cp.name || "Custom Pose"}
                  <span className="ml-1 opacity-60">&middot; {cp.isModelShot ? "Model" : "Product"}</span>
                  {cp.referenceImages.length > 0 && (
                    <span className="ml-1 opacity-60">&middot; {cp.referenceImages.length} ref</span>
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* UGC Scenes */}
          {ugcScenes.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                UGC Scenes ({ugcScenes.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ugcScenes.map((scene) => (
                  <Badge key={scene.id} className="text-xs bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30">
                    &#x1f4f8; {scene.name || "UGC Scene"}
                    <span className="ml-1 opacity-60">&middot; {scene.shotType === "selfie" ? "Selfie" : "Normal"}</span>
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {pgCount} products &times; {ugcScenes.length} scene{ugcScenes.length !== 1 ? "s" : ""} = {totalUgcImages} UGC image{totalUgcImages !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>

        {/* Generate Button */}
        {bulkResults.length === 0 && ugcResults.length === 0 && !isIngestingScene && (
          <Button
            onClick={handleBulkGenerate}
            disabled={isGenerating || !apiKey || (totalPoses === 0 && ugcScenes.length === 0) || bulkCombinations.length === 0}
            className="w-full h-14 text-base font-semibold rounded-xl gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm transition-colors duration-200"
            size="lg"
          >
            <Sparkles className="w-5 h-5" />
            Generate {totalImages} VTON Image{totalImages !== 1 ? "s" : ""} ({bulkCombinations.length} combination{bulkCombinations.length !== 1 ? "s" : ""})
          </Button>
        )}

        {/* Scene-ingestion loader (bulk) — runs once per UNIQUE inspiration
            image referenced by any combination's effective background. */}
        {isIngestingScene && (
          <div className="w-full rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 flex items-center gap-4">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-primary/15 shrink-0">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Ingesting configuration… preparing to generate
              </p>
              <p className="text-xs text-muted-foreground">
                Analysing each unique background scene once so every pose stays in the same location.
              </p>
            </div>
            <div className="ml-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={cancelGeneration}
                    size="sm"
                    variant="destructive"
                    className="rounded-xl gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Stop
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Cancel before per-pose generation starts. May still incur a small charge for the in-flight analysis call.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
        {/* Image Quality Selection */}
        <div className="mt-3 flex items-center gap-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Image Quality</p>
          <div className="flex items-center gap-2 ml-2">
            {(["1K", "2K", "4K"] as const).map((q) => (
              <label key={q} className="inline-flex items-center text-xs">
                <input
                  type="radio"
                  name="imageQualityBulk"
                  value={q}
                  checked={imageQuality === q}
                  onChange={() => setImageQuality(q)}
                  className="mr-1"
                />
                {q}
              </label>
            ))}
          </div>
        </div>

        {/* Progress */}
        {(bulkResults.length > 0 || ugcResults.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {isGenerating
                  ? "Generating..."
                  : `${completedBulkResults}/${totalBulkResults} completed`}
              </p>
              <div className="flex items-center gap-2">
                {isGenerating && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={cancelGeneration}
                        size="sm"
                        variant="destructive"
                        className="rounded-xl gap-1.5"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        Stop
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Cancels pending and in-flight requests. Already-completed images stay. May still incur charges for requests already in flight on Google&apos;s servers.
                    </TooltipContent>
                  </Tooltip>
                )}
                {!isGenerating && completedBulkResults > 0 && (
                  <Button
                    onClick={handleDownloadAllBulk}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download All
                  </Button>
                )}
                {!isGenerating && completedBulkResults < totalBulkResults && (
                  <Button
                    onClick={handleBulkGenerate}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Regenerate All
                  </Button>
                )}
                {!isGenerating && bulkResults.some((r) => r.validationStatus === "warning" && r.status === "completed") && (
                  <Button
                    onClick={handleRetryAllMismatchedBulk}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Regenerate Mismatched ({bulkResults.filter((r) => r.validationStatus === "warning" && r.status === "completed").length})
                  </Button>
                )}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{
                  width: `${totalBulkResults > 0 ? (completedBulkResults / totalBulkResults) * 100 : 0}%`,
                }}
              />
            </div>
            {validationFilterBar(bulkResults)}
          </div>
        )}

        {/* Bulk Results - Grouped by Combination */}
        {bulkResults.length > 0 && (
          <div className="space-y-4">
            {bulkCombinations.map((combo) => {
              const allComboResults = resultsByCombo.get(combo.id) || [];
              const comboResults = filterByValidation(allComboResults);
              const comboCompleted = allComboResults.filter((r) => r.status === "completed").length;
              const comboLabel = [
                combo.primaryFolder.name,
                combo.complementaryFolder?.name,
                combo.modelImage.name,
              ]
                .filter(Boolean)
                .join(" + ");
              const isExpanded = expandedCombos[combo.id] !== false; // default expanded

              return (
                <div key={combo.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  {/* Combo Header */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleCombo(combo.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCombo(combo.id); } }}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {combo.primaryFolder.name}
                        </Badge>
                        {combo.complementaryFolder && (
                          <>
                            <span className="text-xs text-muted-foreground">+</span>
                            <Badge variant="outline" className="text-xs">
                              {combo.complementaryFolder.name}
                            </Badge>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground">+</span>
                        <Badge className="text-xs bg-primary/10 text-primary dark:text-primary border-primary/30">
                          {combo.modelImage.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">+</span>
                        <Badge className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                          {getBgShortLabel(combo.background)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {comboCompleted}/{allComboResults.length}
                      </span>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadAllCombo(combo.id, combo.primaryFolder.name);
                        }}
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1.5"
                        disabled={comboCompleted === 0}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Combo Results Grid */}
                  {isExpanded && (
                    <div className="px-5 pb-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {comboResults.map((result) => (
                          <div
                            key={result.id}
                            className="rounded-xl border border-border bg-background overflow-hidden"
                          >
                            {/* Image Area */}
                            <div className="aspect-[3/4] bg-muted/30 relative flex items-center justify-center overflow-hidden">
                              {result.status === "completed" && result.imageData ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={result.imageData}
                                    alt={`VTON - ${result.combinationLabel} - ${result.pose.name}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <CostBreakdownPopover costBreakdown={result.costBreakdown} skip={skipValidation} />
                                  <ValidationBadge status={result.validationStatus} message={result.validationMessage} />
                                </>
                              ) : result.status === "error" ? (
                                <div className="flex flex-col items-center gap-3 p-4 text-center">
                                  <AlertCircle className="w-6 h-6 text-red-400" />
                                  <p className="text-xs text-red-500 font-medium">Failed</p>
                                  <p className="text-[11px] text-muted-foreground max-w-[160px]">
                                    {result.error}
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRetryBulk(result)}
                                    disabled={!apiKey}
                                    className="rounded-lg gap-1.5 h-8 text-xs"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    Retry
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2">
                                  {result.status === "auto-retrying" ? (
                                    <>
                                      <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                                      <p className="text-[11px] text-muted-foreground">Auto-retrying...</p>
                                    </>
                                  ) : result.status === "generating-prompt" ? (
                                    <>
                                      <Wand2 className="w-5 h-5 text-amber-500 animate-pulse" />
                                      <p className="text-[11px] text-muted-foreground">Writing prompt...</p>
                                    </>
                                  ) : result.status === "generating-image" ? (
                                    <>
                                      <ImageIcon className="w-5 h-5 text-amber-500 animate-pulse" />
                                      <p className="text-[11px] text-muted-foreground">Generating...</p>
                                    </>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20" />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Card Footer */}
                            <div className="p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {getStatusIcon(result.status)}
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {result.pose.icon} {result.pose.name}
                                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                                        &middot; {getFramingShortLabel(result.pose.framing)}
                                      </span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {getStatusText(result.status)}
                                    </p>
                                  </div>
                                </div>
                                {result.status === "completed" && result.imageData && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant={editingResultId === result.id ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => {
                                        if (editingResultId === result.id) { setEditingResultId(null); setEditText(""); }
                                        else { setEditingResultId(result.id); setEditText(""); }
                                      }}
                                      disabled={!result.imageGenResponseContent}
                                      className={cn("rounded-md gap-1 h-7 px-2 text-[11px]", editingResultId === result.id && "bg-violet-600 hover:bg-violet-700 text-white")}
                                      title="Edit with feedback"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRetryBulk(result)}
                                      className="rounded-md gap-1 h-7 px-2 text-[11px]"
                                      title="Regenerate"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setInfographicImage({
                                          src: result.imageData,
                                          poseName: result.pose.id,
                                          resultId: result.id,
                                          resultType: "bulk",
                                        })
                                      }
                                      className="rounded-md gap-1 h-7 px-2 text-[11px]"
                                    >
                                      <Layers className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleDownload(
                                          result.imageData,
                                          result.pose,
                                          result.combinationLabel.replace(/\s+/g, "-")
                                        )
                                      }
                                      className="rounded-md gap-1 h-7 px-2 text-[11px]"
                                    >
                                      <Download className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {editingResultId === result.id && result.status === "completed" && (
                                <div className="flex items-center gap-2 p-2 rounded-lg border border-violet-500/30 bg-violet-500/5">
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && editText.trim()) handleEditBulk(result, editText.trim()); }}
                                    placeholder="Describe what to change..."
                                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none px-2"
                                    autoFocus
                                  />
                                  <Button size="sm" onClick={() => { if (editText.trim()) handleEditBulk(result, editText.trim()); }} disabled={!editText.trim()} className="rounded-lg gap-1 h-6 px-2 bg-violet-600 hover:bg-violet-700 text-white text-[11px]">
                                    <Send className="w-2.5 h-2.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingResultId(null); setEditText(""); }} className="rounded-lg h-6 w-6 p-0">
                                    <X className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              )}

                              {result.prompt && (
                                <div>
                                  <button
                                    onClick={() => togglePrompt(result.id)}
                                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {expandedPrompts[result.id] ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                    {expandedPrompts[result.id] ? "Hide" : "View"} prompt
                                  </button>
                                  {expandedPrompts[result.id] && (
                                    <div className="mt-1.5 p-2 rounded-md bg-muted/50 text-[11px] text-muted-foreground leading-relaxed max-h-32 overflow-y-auto">
                                      {result.prompt}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* UGC Results in Bulk Mode */}
        {ugcResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">Instagram UGC Results</h3>
                <Badge className="text-xs bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20">
                  {ugcResults.filter((r) => r.status === "completed").length}/{ugcResults.length} done
                </Badge>
              </div>
              {!isGenerating && ugcResults.some((r) => r.status === "completed" && r.imageData) && (
                <Button
                  onClick={handleDownloadAllUgcBulk}
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download All
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ugcResults.map((result) => (
                <div key={result.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="aspect-[3/4] relative bg-muted/30">
                    {result.status === "completed" && result.imageData ? (
                      <img
                        src={result.imageData.startsWith("data:") ? result.imageData : `data:image/png;base64,${result.imageData}`}
                        alt={result.sceneName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {result.status === "error" ? (
                          <div className="text-center p-4">
                            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                            <p className="text-xs text-destructive">{result.error}</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground capitalize">{result.status.replace(/-/g, " ")}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate">{result.sceneName}</p>
                      {result.status === "completed" && result.imageData && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 rounded-lg"
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = result.imageData.startsWith("data:") ? result.imageData : `data:image/png;base64,${result.imageData}`;
                            a.download = `ugc-${result.sceneName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`;
                            a.click();
                          }}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Infographic Editor Dialog */}
        <InfographicEditor
          open={infographicImage !== null}
          onOpenChange={(open) => {
            if (!open) setInfographicImage(null);
          }}
          baseImageSrc={infographicImage?.src ?? ""}
          poseName={infographicImage?.poseName ?? ""}
          productInfo={infographicProductInfo}
          apiKey={apiKey}
          onSave={handleInfographicSave}
        />
      </div>
    );
  }

  // ======================================================================
  // SINGLE MODE RENDER (original)
  // ======================================================================
  const completedCount = results.filter((r) => r.status === "completed").length;
  const totalCount = results.length;

  return (
    <div className="space-y-6">
      {providerPickerRow}
      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Generation Summary</h3>
          {isFootwear && (
            <Badge variant="secondary" className="text-xs">Footwear</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {isFootwear ? "Footwear" : "Garments"}
            </p>
            <p className="text-sm font-semibold">
              {garmentImages.length} image{garmentImages.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {isFootwear ? "Type" : "Fit"}
            </p>
            <p className="text-sm font-semibold capitalize">
              {isFootwear ? footwearType.replace(/-/g, " ") : (fit || "Auto")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Model
            </p>
            <div className="flex items-center gap-2">
              <ModelThumb
                modelName={selectedModel?.name || "Custom"}
                modelPreview={modelImage?.preview}
                size={28}
              />
              <p className="text-sm font-semibold">{selectedModel?.name || (modelImage ? "Custom" : "None")}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Model Photo
            </p>
            {modelImage ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded overflow-hidden border border-border shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={modelImage.preview} alt="Model" className="w-full h-full object-cover" />
                </div>
                <p className="text-sm font-semibold">Uploaded</p>
              </div>
            ) : (
              <p className="text-sm font-semibold">Preset only</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Aspect Ratio
            </p>
            <p className="text-sm font-semibold">{aspectRatio}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Output Images
            </p>
            <p className="text-sm font-semibold">{selectedPoses.length + customPoses.length + ugcScenes.length}</p>
          </div>
        </div>
        {/* Image Quality Selection */}
        <div className="mt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Image Quality</p>
          <div className="flex items-center gap-3 mt-2">
            {(["1K", "2K", "4K"] as const).map((q) => (
              <label key={q} className="inline-flex items-center text-sm">
                <input
                  type="radio"
                  name="imageQualitySingle"
                  value={q}
                  checked={imageQuality === q}
                  onChange={() => setImageQuality(q)}
                  className="mr-2"
                />
                <span className="text-sm">{q}</span>
              </label>
            ))}
          </div>
        </div>
        {/* Poses */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Poses ({selectedPoses.length + customPoses.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedPoses.map((pose) => (
              <Badge key={pose.id} variant="secondary" className="text-xs flex items-center gap-1">
                <PoseMiniThumb poseId={pose.id} icon={pose.icon} isFootwear={isFootwear} size={18} />
                {pose.name}
                <span className="ml-0.5 opacity-60">&middot; {getFramingShortLabel(pose.framing)}</span>
              </Badge>
            ))}
            {customPoses.map((cp) => (
              <Badge key={cp.id} variant="secondary" className={cn("text-xs", cp.isModelShot ? "bg-primary/10 text-primary dark:text-primary border-primary/30" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30")}>
                &#x2728; {cp.name || "Custom Pose"}
                <span className="ml-1 opacity-60">&middot; {cp.isModelShot ? "Model" : "Product"}</span>
                {cp.referenceImages.length > 0 && (
                  <span className="ml-1 opacity-60">&middot; {cp.referenceImages.length} ref</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
        {/* UGC Scenes */}
        {ugcScenes.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              UGC Scenes ({ugcScenes.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ugcScenes.map((scene) => (
                <Badge key={scene.id} className="text-xs bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30">
                  📸 {scene.name || "UGC Scene"}
                  <span className="ml-1 opacity-60">&middot; {scene.shotType === "selfie" ? "Selfie" : "Normal"}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      {results.length === 0 && ugcResults.length === 0 && !isIngestingScene && (
        <Button
          onClick={handleGenerate}
          disabled={
            isGenerating ||
            !apiKey ||
            (selectedPoses.length === 0 && customPoses.length === 0 && ugcScenes.length === 0) ||
            ((selectedPoses.some((p) => p.requiresModel !== false) || customPoses.some((cp) => cp.isModelShot)) && !hasModel)
          }
          className="w-full h-14 text-base font-semibold rounded-xl gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm transition-colors duration-200"
          size="lg"
        >
          <Sparkles className="w-5 h-5" />
          Generate {selectedPoses.length + customPoses.length + ugcScenes.length} {isFootwear ? "Footwear" : "VTON"} Image{(selectedPoses.length + customPoses.length + ugcScenes.length) !== 1 ? "s" : ""}
        </Button>
      )}

      {/* Scene-ingestion loader — shown ONCE per Generate batch while
          analyzeBackgroundScene is running its single Gemini 3.1 Pro pre-pass.
          Replaces the Generate button visually so the user knows why per-pose
          results haven't started appearing yet. */}
      {isIngestingScene && (
        <div className="w-full rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 flex items-center gap-4">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-primary/15 shrink-0">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Ingesting configuration… preparing to generate
            </p>
            <p className="text-xs text-muted-foreground">
              Analysing the background scene once so every pose stays in the same location.
            </p>
          </div>
          <div className="ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={cancelGeneration}
                  size="sm"
                  variant="destructive"
                  className="rounded-xl gap-1.5"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Cancel before per-pose generation starts. May still incur a small charge for the in-flight analysis call.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Progress */}
      {results.length > 0 && (
        <div className="space-y-2">
          {totalCount > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {isGenerating
                  ? "Generating..."
                  : `${completedCount}/${totalCount} completed`}
              </p>
              <div className="flex items-center gap-2">
                {isGenerating && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={cancelGeneration}
                        size="sm"
                        variant="destructive"
                        className="rounded-xl gap-1.5"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        Stop
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Cancels pending and in-flight requests. Already-completed images stay. May still incur charges for requests already in flight on Google&apos;s servers.
                    </TooltipContent>
                  </Tooltip>
                )}
                {!isGenerating && completedCount > 0 && (
                  <Button
                    onClick={handleDownloadAllSingle}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download All
                  </Button>
                )}
                {!isGenerating && completedCount < totalCount && (
                  <Button
                    onClick={handleGenerate}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Regenerate All
                  </Button>
                )}
                {!isGenerating && results.some((r) => r.validationStatus === "warning" && r.status === "completed") && (
                  <Button
                    onClick={handleRetryAllMismatchedSingle}
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Regenerate Mismatched ({results.filter((r) => r.validationStatus === "warning" && r.status === "completed").length})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
              style={{
                width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
          {validationFilterBar(results)}
        </div>
      )}

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filterByValidation(results).map((result) => (
            <div
              key={result.id}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Image Area */}
              <div className="aspect-[3/4] bg-muted/30 relative flex items-center justify-center overflow-hidden">
                {result.status === "completed" && result.imageData ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.imageData}
                      alt={`VTON - ${result.pose.name}`}
                      className="w-full h-full object-cover"
                    />
                    <CostBreakdownPopover costBreakdown={result.costBreakdown} skip={skipValidation} />
                    <ValidationBadge status={result.validationStatus} message={result.validationMessage} />
                  </>
                ) : result.status === "error" ? (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                    <p className="text-sm text-red-500 font-medium">Generation Failed</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      {result.error}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetrySingle(result)}
                      disabled={!apiKey || (!(result.customPose ? !result.customPose.isModelShot : result.pose.requiresModel === false) && !selectedModel && !modelImage)}
                      className="rounded-lg gap-1.5"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    {result.status === "auto-retrying" ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">
                            Auto-Retrying
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Retrying automatically...
                          </p>
                        </div>
                      </>
                    ) : result.status === "editing" ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                          <Pencil className="w-6 h-6 text-violet-500 animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">
                            Applying Edit
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Nano Banana 2 is refining...
                          </p>
                        </div>
                      </>
                    ) : result.status === "generating-prompt" ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <Wand2 className="w-6 h-6 text-amber-500 animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">
                            Writing Prompt
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Gemini 3 Pro is analyzing...
                          </p>
                        </div>
                      </>
                    ) : result.status === "generating-image" ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-amber-500 animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">
                            Generating Image
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Nano Banana 2 is creating...
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20" />
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="text-sm font-medium">
                        {result.pose.icon} {result.pose.name}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          &middot; {getFramingShortLabel(result.pose.framing)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getStatusText(result.status)}
                      </p>
                    </div>
                  </div>
                  {result.status === "completed" && result.imageData && (
                    <div className="flex items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={editingResultId === result.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (editingResultId === result.id) {
                                setEditingResultId(null);
                                setEditText("");
                              } else {
                                setEditingResultId(result.id);
                                setEditText("");
                              }
                            }}
                            disabled={!result.imageGenResponseContent}
                            className={cn(
                              "rounded-lg gap-1.5",
                              editingResultId === result.id && "bg-violet-600 hover:bg-violet-700 text-white"
                            )}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Refine this image with feedback{result.editHistory && result.editHistory.length > 0 ? ` (${result.editHistory.length} edit${result.editHistory.length > 1 ? "s" : ""} so far)` : ""}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetrySingle(result)}
                        className="rounded-lg gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setInfographicImage({
                            src: result.imageData,
                            poseName: result.pose.id,
                            resultId: result.id,
                            resultType: "single",
                          })
                        }
                        className="rounded-lg gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Infographic
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(result.imageData, result.pose)}
                        className="rounded-lg gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>

                {/* Multi-turn Edit Input */}
                {editingResultId === result.id && result.status === "completed" && (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-violet-500/30 bg-violet-500/5">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editText.trim()) {
                          handleEditSingle(result, editText.trim());
                        }
                      }}
                      placeholder="Describe what to change..."
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none px-2"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (editText.trim()) handleEditSingle(result, editText.trim());
                      }}
                      disabled={!editText.trim()}
                      className="rounded-lg gap-1 h-7 px-2.5 bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEditingResultId(null); setEditText(""); }}
                      className="rounded-lg h-7 w-7 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {/* Expandable Prompt */}
                {result.prompt && (
                  <div>
                    <button
                      onClick={() => togglePrompt(result.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expandedPrompts[result.id] ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      {expandedPrompts[result.id] ? "Hide" : "View"} generated prompt
                    </button>
                    {expandedPrompts[result.id] && (
                      <div className={cn(
                        "mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground leading-relaxed max-h-40 overflow-y-auto"
                      )}>
                        {result.prompt}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Infographic Editor Dialog */}

      {/* UGC Results */}
      {ugcResults.length > 0 && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">Instagram UGC Results</h3>
                <Badge className="text-xs bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20">
                  {ugcResults.filter((r) => r.status === "completed").length}/{ugcResults.length} done
                </Badge>
              </div>
              {!isGenerating && ugcResults.some((r) => r.status === "completed" && r.imageData) && (
                <Button
                  onClick={handleDownloadAllUgcSingle}
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download All
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ugcResults.map((result) => (
              <div
                key={result.id}
                className="rounded-xl border border-rose-500/20 bg-card overflow-hidden"
              >
                {/* Image Area */}
                <div className="aspect-[4/5] bg-muted/30 relative flex items-center justify-center overflow-hidden">
                  {result.status === "completed" && result.imageData ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.imageData}
                        alt={`UGC - ${result.sceneName}`}
                        className="w-full h-full object-cover"
                      />
                      <CostBreakdownPopover costBreakdown={result.costBreakdown} skip={skipValidation} />
                    </>
                  ) : result.status === "error" ? (
                    <div className="flex flex-col items-center gap-3 p-6 text-center">
                      <AlertCircle className="w-8 h-8 text-red-400" />
                      <p className="text-sm text-red-500 font-medium">Generation Failed</p>
                      <p className="text-xs text-muted-foreground max-w-[200px]">
                        {result.error}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      {result.status === "auto-retrying" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Auto-Retrying</p>
                            <p className="text-xs text-muted-foreground">Retrying automatically...</p>
                          </div>
                        </>
                      ) : result.status === "generating-prompt" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                            <Wand2 className="w-6 h-6 text-rose-500 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Writing UGC Prompt</p>
                            <p className="text-xs text-muted-foreground">Gemini 3 Pro is crafting the scene...</p>
                          </div>
                        </>
                      ) : result.status === "generating-image" ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-rose-500 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Generating UGC Image</p>
                            <p className="text-xs text-muted-foreground">Nano Banana 2 is creating...</p>
                          </div>
                        </>
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20" />
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <div>
                        <p className="text-sm font-medium">
                          <span className="text-rose-500">📸</span> {result.sceneName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getStatusText(result.status)}
                        </p>
                      </div>
                    </div>
                    {result.status === "completed" && result.imageData && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setInfographicImage({
                              src: result.imageData,
                              poseName: result.sceneId,
                              resultId: result.id,
                              resultType: "single",
                            });
                          }}
                          className="rounded-lg gap-1.5"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          Infographic
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = result.imageData;
                            link.download = `ugc-${result.sceneName.replace(/\s+/g, "-").toLowerCase()}.png`;
                            link.click();
                          }}
                          className="rounded-lg gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Expandable Prompt */}
                  {result.prompt && (
                    <div>
                      <button
                        onClick={() => togglePrompt(result.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedPrompts[result.id] ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        {expandedPrompts[result.id] ? "Hide prompt" : "Show prompt"}
                      </button>
                      {expandedPrompts[result.id] && (
                        <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground leading-relaxed max-h-40 overflow-y-auto">
                          {result.prompt}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Infographic Editor Dialog -- must remain last */}
      <InfographicEditor
        open={infographicImage !== null}
        onOpenChange={(open) => {
          if (!open) setInfographicImage(null);
        }}
        baseImageSrc={infographicImage?.src ?? ""}
        poseName={infographicImage?.poseName ?? ""}
        productInfo={infographicProductInfo}
        apiKey={apiKey}
        onSave={handleInfographicSave}
      />
    </div>
  );
}
