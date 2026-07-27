"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  Download,
  Save,
  Check,
  RefreshCw,
  Shirt,
  Trash2,
  AlertCircle,
  Library,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelComboPicker } from "./model-combo-picker";
import {
  generateModelPrompt,
  generateModelImage,
  ImageSafetyBlockError,
  PersonGenerationNotAllowlistedError,
} from "@/lib/gemini";
import { generateModelImageAzure } from "@/lib/azure-image";
import { loadSavedModels, saveModel, deleteSavedModel } from "@/lib/model-library";
import { modelAgeGroup } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type {
  AspectRatio,
  ModelBox,
  ModelCreationResult,
  SavedModel,
  StepCost,
} from "@/lib/types";

interface Props {
  store: VTONStore;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface PlanItem {
  boxId: string;
  boxName: string;
  box: ModelBox;
  variantIndex: number;
  variantCount: number;
}

const ASPECT_OPTIONS: AspectRatio[] = ["3:4", "9:16", "2:3", "1:1"];
const SIZE_OPTIONS: ("1K" | "2K" | "4K")[] = ["1K", "2K", "4K"];

function isBusy(status: ModelCreationResult["status"]) {
  return (
    status === "pending" ||
    status === "generating-prompt" ||
    status === "generating-image" ||
    status === "auto-retrying"
  );
}

/**
 * Turns a thrown generation error into copy the user can act on. Both backends
 * feed through here so a content refusal reads the same whether it came from
 * Nano Banana or Azure's `moderation_blocked`.
 */
function friendlyError(err: unknown): string {
  if (err instanceof PersonGenerationNotAllowlistedError) return err.message;
  if (err instanceof ImageSafetyBlockError) {
    return "Blocked by the provider's content filters. Try a different reference image or casting brief.";
  }
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("moderation_blocked") || lower.includes("content_policy")) {
    return "Blocked by the provider's content filters. Try a different reference image or casting brief.";
  }
  if (lower.includes("aborted")) return "Generation cancelled.";
  return message || "Generation failed";
}

/**
 * A refusal is deterministic — the same request will be refused again — so
 * retrying one only burns a second full prompt + image pipeline.
 */
function isRetryable(err: unknown): boolean {
  return !(
    err instanceof ImageSafetyBlockError ||
    err instanceof PersonGenerationNotAllowlistedError
  );
}

function statusLabel(status: ModelCreationResult["status"]) {
  switch (status) {
    case "generating-prompt":
      return "Writing brief…";
    case "generating-image":
      return "Rendering…";
    case "auto-retrying":
      return "Retrying…";
    case "pending":
      return "Queued…";
    default:
      return "";
  }
}

export function StepModelGenerate({ store }: Props) {
  const {
    apiKey,
    textGenModel,
    imageGenModel,
    modelGender,
    modelAgeRange,
    modelBodyType,
    modelEthnicity,
    modelBrandName,
    modelBrandDirectives,
    modelGuidelines,
    modelBoxes,
    modelCreationResults,
    setModelCreationResults,
    updateModelCreationResult,
    isModelCreationGenerating,
    setIsModelCreationGenerating,
    savedModels,
    setSavedModels,
    attachSavedModelToVTON,
    setCurrentStep,
  } = store;

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("2K");

  // Plan items captured at generation time, keyed by result id (for regenerate).
  const planRef = useRef<Map<string, PlanItem>>(new Map());

  // Load the Model Library once on mount.
  useEffect(() => {
    let cancelled = false;
    loadSavedModels()
      .then((m) => {
        if (!cancelled) setSavedModels(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setSavedModels]);

  const readyBoxes = useMemo(
    () =>
      modelBoxes.filter(
        (b) => b.name.trim() !== "" || b.description.trim() !== "" || !!b.referenceImage
      ),
    [modelBoxes]
  );

  const plan: PlanItem[] = useMemo(
    () =>
      readyBoxes.flatMap((box, bi) =>
        Array.from({ length: Math.max(1, box.variantCount) }, (_, vi) => ({
          boxId: box.id,
          boxName: box.name.trim() || `Model ${bi + 1}`,
          box,
          variantIndex: vi + 1,
          variantCount: box.variantCount,
        }))
      ),
    [readyBoxes]
  );

  const canGenerate = plan.length > 0 && !isModelCreationGenerating;

  const runImage = useCallback(
    async (prompt: string, box: ModelBox, lock: boolean): Promise<{ imageData: string; cost: StepCost }> => {
      if (imageGenModel === "gpt-image-2") {
        return generateModelImageAzure({
          prompt,
          // Only attach the reference when locking the face; otherwise let the
          // model render a fresh distinct face from text.
          referenceImage: lock && box.referenceImage ? { file: box.referenceImage.file } : undefined,
          aspectRatio,
          imageSize,
        });
      }
      return generateModelImage({
        apiKey,
        prompt,
        // Non-adult bands need personGeneration: ALLOW_ALL — the Vertex default
        // of ALLOW_ADULT refuses them outright, before the prompt is read.
        ageGroup: modelAgeGroup(modelAgeRange),
        // Only attach the reference to the image model when locking the face.
        // In non-lock mode the reference reached only the enrichment model, which
        // authored a distinct face into the prompt — sending the image here would
        // make Nano Banana clone the reference and defeat the variations.
        referenceImage: lock && box.referenceImage ? { file: box.referenceImage.file } : undefined,
        lockToReferenceFace: lock,
        aspectRatio,
        imageSize,
      });
    },
    [apiKey, imageGenModel, aspectRatio, imageSize, modelAgeRange]
  );

  const runOne = useCallback(
    async (result: ModelCreationResult, item: PlanItem) => {
      const collected: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;
      const lock = !!item.box.referenceImage && item.box.lockToReferenceFace;

      const generate = async () => {
        collected.length = 0;
        updateModelCreationResult(result.id, { status: "generating-prompt", error: undefined });
        const promptRes = await generateModelPrompt({
          textGenModel,
          gender: modelGender,
          ageRange: modelAgeRange,
          bodyType: modelBodyType,
          ethnicity: modelEthnicity.trim() || undefined,
          brandDirectives: modelBrandDirectives.trim() || undefined,
          guidelines: modelGuidelines.trim() || undefined,
          box: item.box,
          variantIndex: item.variantIndex,
          variantCount: item.variantCount,
        });
        collected.push(promptRes.cost);

        updateModelCreationResult(result.id, {
          status: "generating-image",
          enrichedPrompt: promptRes.enrichedPrompt,
        });

        const imgRes = await runImage(promptRes.enrichedPrompt, item.box, lock);
        collected.push(imgRes.cost);

        const mainCost = collected.reduce((s, c) => s + c.totalCost, 0);
        const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
        updateModelCreationResult(result.id, {
          imageData: imgRes.imageData,
          status: "completed",
          saved: false,
          costBreakdown: { steps: [...collected], totalCost: mainCost + retryCost, retrySteps },
        });
      };

      try {
        await generate();
      } catch (err) {
        // A content refusal or a missing ALLOW_ALL entitlement is deterministic:
        // the identical request will be refused again, so surface it instead of
        // burning a second prompt + image cycle on it.
        if (!isRetryable(err)) {
          updateModelCreationResult(result.id, { status: "error", error: friendlyError(err) });
          return;
        }
        try {
          retrySteps = [...collected];
          updateModelCreationResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          await generate();
        } catch (err2) {
          updateModelCreationResult(result.id, {
            status: "error",
            error: friendlyError(err2),
          });
        }
      }
    },
    [
      textGenModel,
      modelGender,
      modelAgeRange,
      modelBodyType,
      modelEthnicity,
      modelBrandDirectives,
      modelGuidelines,
      runImage,
      updateModelCreationResult,
    ]
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setIsModelCreationGenerating(true);

    const items = plan;
    planRef.current = new Map();
    const initial: ModelCreationResult[] = items.map((p) => {
      const id = uid("mc-result");
      planRef.current.set(id, p);
      return {
        id,
        boxId: p.boxId,
        boxName: p.boxName,
        // Pinned at generation time so Refine keeps targeting the right
        // personGeneration even if the casting age band is changed afterwards.
        ageRange: modelAgeRange,
        variantIndex: p.variantIndex,
        variantCount: p.variantCount,
        status: "pending",
      };
    });
    setModelCreationResults(initial);

    const concurrency = imageGenModel === "gpt-image-2" ? 10 : 4;
    let idx = 0;
    const next = async (): Promise<void> => {
      while (idx < initial.length) {
        const i = idx++;
        await runOne(initial[i], items[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, initial.length) }, () => next()));

    setIsModelCreationGenerating(false);
  }, [canGenerate, plan, imageGenModel, modelAgeRange, runOne, setModelCreationResults, setIsModelCreationGenerating]);

  const handleRegenerate = useCallback(
    (result: ModelCreationResult) => {
      if (isBusy(result.status)) return;
      const item = planRef.current.get(result.id);
      if (!item) return;
      void runOne(result, item);
    },
    [runOne]
  );

  const handleSave = useCallback(
    async (result: ModelCreationResult) => {
      if (!result.imageData || result.saved) return;
      const model: SavedModel = {
        id: uid("saved-model"),
        name: result.boxName + (result.variantCount > 1 ? ` · ${result.variantIndex}` : ""),
        imageData: result.imageData,
        gender: modelGender,
        // The band this result was actually rendered at, not whatever the
        // casting controls happen to show now.
        ageRange: result.ageRange,
        bodyType: modelBodyType,
        ethnicity: modelEthnicity.trim(),
        brandName: modelBrandName.trim() || undefined,
        createdAt: Date.now(),
      };
      try {
        await saveModel(model);
        setSavedModels([model, ...savedModels]);
        updateModelCreationResult(result.id, { saved: true });
      } catch {
        /* ignore persistence failure */
      }
    },
    [
      modelGender,
      modelBodyType,
      modelEthnicity,
      modelBrandName,
      savedModels,
      setSavedModels,
      updateModelCreationResult,
    ]
  );

  const handleDeleteSaved = useCallback(
    async (id: string) => {
      try {
        await deleteSavedModel(id);
        setSavedModels(savedModels.filter((m) => m.id !== id));
      } catch {
        /* ignore */
      }
    },
    [savedModels, setSavedModels]
  );

  // Hand a model (+ any face/back reference views) to the VTON flow.
  const sendToTryOn = attachSavedModelToVTON;

  const download = (imageData: string, name: string) => {
    const a = document.createElement("a");
    a.href = imageData;
    a.download = `${name.replace(/\s+/g, "-") || "model"}.png`;
    a.click();
  };

  const totalCost = modelCreationResults.reduce(
    (s, r) => s + (r.costBreakdown?.totalCost ?? 0),
    0
  );
  const completed = modelCreationResults.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Models / engines */}
      <ModelComboPicker store={store} />

      {/* Output options */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aspect ratio</p>
          <div className="flex gap-1.5">
            {ASPECT_OPTIONS.map((a) => (
              <button
                key={a}
                onClick={() => setAspectRatio(a)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  aspectRatio === a
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quality</p>
          <div className="flex gap-1.5">
            {SIZE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setImageSize(s)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  imageSize === s
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {plan.length > 0 ? (
            <>
              {readyBoxes.length} model{readyBoxes.length !== 1 ? "s" : ""} ·{" "}
              <span className="font-medium text-foreground">{plan.length}</span> image
              {plan.length !== 1 ? "s" : ""} to generate
            </>
          ) : (
            "Add at least one model on the previous step."
          )}
        </p>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="btn-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none"
        >
          {isModelCreationGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isModelCreationGenerating ? "Generating…" : "Generate models"}
        </button>
      </div>

      {/* Results */}
      {modelCreationResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Results{" "}
              <span className="font-normal text-muted-foreground">
                ({completed}/{modelCreationResults.length})
              </span>
            </h3>
            {totalCost > 0 && (
              <span className="text-xs text-muted-foreground">≈ ${totalCost.toFixed(3)}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {modelCreationResults.map((r) => (
              <div
                key={r.id}
                className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted/20"
              >
                {r.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageData} alt={r.boxName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    {r.status === "error" ? (
                      <>
                        <AlertCircle className="h-6 w-6 text-red-500" />
                        <span className="px-3 text-center text-[11px] text-red-500">{r.error}</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-[11px]">{statusLabel(r.status)}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Label */}
                <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  {r.boxName}
                  {r.variantCount > 1 ? ` · ${r.variantIndex}` : ""}
                </div>

                {/* Hover actions */}
                {r.imageData && r.status === "completed" && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => download(r.imageData!, r.boxName)}
                      className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleSave(r)}
                      disabled={r.saved}
                      className={cn(
                        "rounded-md p-1.5 text-white backdrop-blur-sm",
                        r.saved ? "bg-emerald-500/70" : "bg-white/15 hover:bg-white/25"
                      )}
                      title={r.saved ? "Saved to library" : "Save to library"}
                    >
                      {r.saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => sendToTryOn({ ...r, imageData: r.imageData! })}
                      className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                      title="Use in Virtual Try-On"
                    >
                      <Shirt className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentStep(4)}
                      className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                      title="Refine (reference shots & facial edits)"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRegenerate(r)}
                      className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                      title="Regenerate"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {r.status === "error" && (
                  <button
                    onClick={() => handleRegenerate(r)}
                    className="absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Library */}
      {savedModels.length > 0 && (
        <div className="space-y-4 border-t border-border/60 pt-8">
          <div className="flex items-center gap-2">
            <Library className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Model Library{" "}
              <span className="font-normal text-muted-foreground">({savedModels.length})</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {savedModels.map((m) => (
              <div
                key={m.id}
                className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.imageData} alt={m.name} className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent p-2">
                  <p className="truncate text-[11px] font-medium text-white">{m.name}</p>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => download(m.imageData, m.name)}
                    className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => sendToTryOn(m)}
                    className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                    title="Use in Virtual Try-On"
                  >
                    <Shirt className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                    title="Refine (reference shots & facial edits)"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSaved(m.id)}
                    className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-red-500/80"
                    title="Delete from library"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
