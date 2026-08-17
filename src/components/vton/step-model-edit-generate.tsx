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
  Square,
  Trash2,
  AlertCircle,
  Library,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelComboPicker } from "./model-combo-picker";
import {
  generateModelEditInstruction,
  generateModelEditImage,
  ImageSafetyBlockError,
  PersonGenerationNotAllowlistedError,
} from "@/lib/gemini";
import { generateModelEditImageAzure } from "@/lib/azure-image";
import { loadSavedModels, saveModel, deleteSavedModel } from "@/lib/model-library";
import { dataUrlToFile, imageAspectRatio } from "@/lib/model-creation-client";
import { modelAgeGroup } from "@/lib/constants";
import { runPool } from "@/lib/two-lane-runner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VTONStore } from "@/store/vton-store";
import type {
  AspectRatio,
  ModelEditResult,
  ModelEditSource,
  SavedModel,
  StepCost,
} from "@/lib/types";

interface Props {
  store: VTONStore;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const SIZE_OPTIONS: ("1K" | "2K" | "4K")[] = ["1K", "2K", "4K"];

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function isBusy(status: ModelEditResult["status"]) {
  return (
    status === "pending" ||
    status === "generating-instruction" ||
    status === "generating-image" ||
    status === "auto-retrying"
  );
}

/**
 * Turns a thrown edit error into copy the user can act on. Mirrors the helper of
 * the same name in step-model-generate.tsx so a content refusal reads the same
 * on both backends.
 */
function friendlyError(err: unknown): string {
  if (err instanceof PersonGenerationNotAllowlistedError) return err.message;
  if (err instanceof ImageSafetyBlockError) {
    return "Blocked by the provider's content filters. Try a different source image or edit directive.";
  }
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("moderation_blocked") || lower.includes("content_policy")) {
    return "Blocked by the provider's content filters. Try a different source image or edit directive.";
  }
  if (lower.includes("aborted")) return "Edit cancelled.";
  return message || "Edit failed";
}

/**
 * A refusal is deterministic — the same request will be refused again — so
 * retrying one only burns a second full instruction + image pipeline.
 */
function isRetryable(err: unknown): boolean {
  return !(
    err instanceof ImageSafetyBlockError ||
    err instanceof PersonGenerationNotAllowlistedError
  );
}

function statusLabel(status: ModelEditResult["status"]) {
  switch (status) {
    case "generating-instruction":
      return "Planning edit…";
    case "generating-image":
      return "Editing…";
    case "auto-retrying":
      return "Retrying…";
    case "pending":
      return "Queued…";
    case "cancelled":
      return "Cancelled";
    default:
      return "";
  }
}

export function StepModelEditGenerate({ store }: Props) {
  const {
    apiKey,
    textGenModel,
    imageGenModel,
    modelGender,
    modelAgeRange,
    modelBodyType,
    modelEthnicity,
    modelBrandName,
    modelEditSources,
    modelEditDirective,
    modelEditReferenceDirective,
    modelEditReference,
    modelEditResults,
    setModelEditResults,
    updateModelEditResult,
    isModelEditGenerating,
    setIsModelEditGenerating,
    beginModelEditGeneration,
    cancelModelEditGeneration,
    savedModels,
    setSavedModels,
    setModelImage,
    setSelectedModel,
    setFeatureMode,
    setCurrentStep,
  } = store;

  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("2K");

  // Source captured per result id, for regenerate.
  const planRef = useRef<Map<string, ModelEditSource>>(new Map());

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

  const canGenerate =
    modelEditSources.length > 0 && modelEditDirective.trim() !== "" && !isModelEditGenerating;

  const runImage = useCallback(
    async (
      editInstruction: string,
      source: ModelEditSource,
      aspectRatio: AspectRatio,
      signal: AbortSignal
    ): Promise<{ imageData: string; cost: StepCost }> => {
      const refImage = modelEditReference ? { file: modelEditReference.file } : undefined;
      // Drives `personGeneration` and selects the age-appropriate texture anchor.
      // Previously omitted entirely, so every edit silently ran as an adult —
      // which refuses outright on the non-adult bands.
      const ageGroup = modelAgeGroup(modelAgeRange);
      if (imageGenModel === "gpt-image-2") {
        return generateModelEditImageAzure({
          editInstruction,
          sourceImage: { file: source.file },
          referenceImage: refImage,
          referenceDirective: modelEditReferenceDirective,
          ageGroup,
          aspectRatio,
          imageSize,
          signal,
        });
      }
      return generateModelEditImage({
        apiKey,
        editInstruction,
        sourceImage: { file: source.file },
        referenceImage: refImage,
        referenceDirective: modelEditReferenceDirective,
        ageGroup,
        aspectRatio,
        imageSize,
        abortSignal: signal,
      });
    },
    [apiKey, imageGenModel, imageSize, modelAgeRange, modelEditReference, modelEditReferenceDirective]
  );

  const runOne = useCallback(
    async (result: ModelEditResult, source: ModelEditSource, signal: AbortSignal) => {
      const collected: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      /** Mark this slot cancelled, keeping whatever cost was already incurred. */
      const markCancelled = () => {
        const spent = collected.reduce((s, c) => s + c.totalCost, 0);
        const retrySpent = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
        updateModelEditResult(result.id, {
          status: "cancelled",
          error: "Cancelled by user",
          costBreakdown:
            spent + retrySpent > 0
              ? { steps: [...collected], totalCost: spent + retrySpent, retrySteps }
              : undefined,
        });
      };

      // The user hit Stop before a worker reached this slot — burn no requests.
      if (signal.aborted) {
        markCancelled();
        return;
      }

      const generate = async () => {
        collected.length = 0;
        updateModelEditResult(result.id, { status: "generating-instruction", error: undefined });
        const instr = await generateModelEditInstruction({
          textGenModel,
          sourceImage: { file: source.file },
          referenceImage: modelEditReference ? { file: modelEditReference.file } : undefined,
          changeDirective: modelEditDirective,
          referenceDirective: modelEditReferenceDirective,
          abortSignal: signal,
        });
        collected.push(instr.cost);

        updateModelEditResult(result.id, {
          status: "generating-image",
          editInstruction: instr.editInstruction,
        });

        const img = await runImage(instr.editInstruction, source, result.aspectRatio, signal);
        collected.push(img.cost);

        const mainCost = collected.reduce((s, c) => s + c.totalCost, 0);
        const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
        updateModelEditResult(result.id, {
          imageData: img.imageData,
          status: "completed",
          saved: false,
          costBreakdown: { steps: [...collected], totalCost: mainCost + retryCost, retrySteps },
        });
      };

      try {
        await generate();
      } catch (err) {
        // Checked FIRST: an abort looks like an ordinary transport failure, and
        // this path previously swallowed the error entirely (`catch {}`) and
        // retried unconditionally — so one Stop click would have kicked off a
        // full retry for every in-flight slot.
        if (signal.aborted) {
          markCancelled();
          return;
        }
        // A content refusal is deterministic — retrying only burns a second
        // instruction + image cycle to be refused again.
        if (!isRetryable(err)) {
          updateModelEditResult(result.id, { status: "error", error: friendlyError(err) });
          return;
        }
        try {
          retrySteps = [...collected];
          updateModelEditResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          // Stop may have landed during the backoff.
          if (signal.aborted) {
            markCancelled();
            return;
          }
          await generate();
        } catch (err2) {
          if (signal.aborted) {
            markCancelled();
            return;
          }
          updateModelEditResult(result.id, {
            status: "error",
            error: friendlyError(err2),
          });
        }
      }
    },
    [
      textGenModel,
      modelEditDirective,
      modelEditReference,
      modelEditReferenceDirective,
      runImage,
      updateModelEditResult,
    ]
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    // Begun BEFORE the aspect-ratio pre-pass so the Stop button appears
    // immediately rather than only once the first render starts.
    const { signal } = beginModelEditGeneration();

    try {
      const sources = modelEditSources;
      // Derive each source's aspect ratio so the edit keeps the original framing.
      const ratios = await Promise.all(sources.map((s) => imageAspectRatio(s.file)));
      // Stopped during the pre-pass — nothing has been rendered yet.
      if (signal.aborted) return;

      planRef.current = new Map();
      const initial: ModelEditResult[] = sources.map((s, i) => {
        const id = uid("me-result");
        planRef.current.set(id, s);
        return {
          id,
          sourceId: s.id,
          sourceName: s.file.name,
          aspectRatio: ratios[i],
          status: "pending",
        };
      });
      setModelEditResults(initial);

      // Zip up front so a worker never has to search for its source.
      const tasks = initial.map((result, i) => ({ result, source: sources[i] }));
      const concurrency = imageGenModel === "gpt-image-2" ? 10 : 4;
      await runPool(tasks, concurrency, (t) => runOne(t.result, t.source, signal), signal);
    } finally {
      // Sweep anything the workers never reached — a row still `pending` would
      // otherwise spin forever. Also the last-resort net for a task that threw
      // outside its own handler.
      setModelEditResults((prev) =>
        prev.map((r) =>
          r.status === "pending"
            ? { ...r, status: "cancelled" as const, error: "Cancelled by user" }
            : r
        )
      );
      // In a `finally` so an unexpected throw can never strand the flag `true`
      // and leave wizard navigation permanently disabled.
      setIsModelEditGenerating(false);
    }
  }, [
    canGenerate,
    modelEditSources,
    imageGenModel,
    runOne,
    beginModelEditGeneration,
    setModelEditResults,
    setIsModelEditGenerating,
  ]);

  const handleRegenerate = useCallback(
    (result: ModelEditResult) => {
      if (isBusy(result.status)) return;
      const source = planRef.current.get(result.id);
      if (!source) return;
      // A single regenerate runs outside any batch and has no Stop button on
      // screen, so it gets a controller that is never aborted.
      void runOne(result, source, new AbortController().signal);
    },
    [runOne]
  );

  const handleSave = useCallback(
    async (result: ModelEditResult) => {
      if (!result.imageData || result.saved) return;
      const model: SavedModel = {
        id: uid("saved-model"),
        name: stripExt(result.sourceName) || "Edited model",
        imageData: result.imageData,
        gender: modelGender,
        ageRange: modelAgeRange,
        bodyType: modelBodyType,
        ethnicity: modelEthnicity.trim(),
        brandName: modelBrandName.trim() || undefined,
        description: modelEditDirective.trim() || undefined,
        createdAt: Date.now(),
      };
      try {
        await saveModel(model);
        setSavedModels([model, ...savedModels]);
        updateModelEditResult(result.id, { saved: true });
      } catch {
        /* ignore persistence failure */
      }
    },
    [
      modelGender,
      modelAgeRange,
      modelBodyType,
      modelEthnicity,
      modelBrandName,
      modelEditDirective,
      savedModels,
      setSavedModels,
      updateModelEditResult,
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

  const sendToTryOn = useCallback(
    (imageData: string, name: string) => {
      const file = dataUrlToFile(imageData, `${name.replace(/\s+/g, "-") || "model"}.png`);
      setSelectedModel(null);
      setModelImage({ file, preview: imageData });
      setFeatureMode("vton");
      setCurrentStep(1);
    },
    [setModelImage, setSelectedModel, setFeatureMode, setCurrentStep]
  );

  const download = (imageData: string, name: string) => {
    const a = document.createElement("a");
    a.href = imageData;
    a.download = `${name.replace(/\s+/g, "-") || "model"}.png`;
    a.click();
  };

  const totalCost = modelEditResults.reduce((s, r) => s + (r.costBreakdown?.totalCost ?? 0), 0);
  const completed = modelEditResults.filter((r) => r.status === "completed").length;

  const sourcePreviewById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of modelEditSources) map.set(s.id, s.preview);
    return map;
  }, [modelEditSources]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <ModelComboPicker store={store} />

      {/* Quality (aspect ratio is taken from each source image) */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
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
        <p className="text-xs text-muted-foreground">
          Each output keeps the original image&apos;s aspect ratio &amp; framing.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {modelEditSources.length > 0 ? (
            <>
              <span className="font-medium text-foreground">{modelEditSources.length}</span> image
              {modelEditSources.length !== 1 ? "s" : ""} to edit
            </>
          ) : (
            "Upload images on the first step."
          )}
        </p>
        <div className="flex items-center gap-2">
        {isModelEditGenerating && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={cancelModelEditGeneration}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600/90 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Cancels queued and in-flight edits so you can go back and change the directive. Edits
              that already finished are kept. Requests already in flight may still incur a charge on
              the provider&apos;s side.
            </TooltipContent>
          </Tooltip>
        )}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="btn-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white disabled:pointer-events-none disabled:opacity-50"
        >
          {isModelEditGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isModelEditGenerating ? "Editing…" : "Apply edit"}
        </button>
        </div>
      </div>

      {/* Results */}
      {modelEditResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Results{" "}
              <span className="font-normal text-muted-foreground">
                ({completed}/{modelEditResults.length})
              </span>
            </h3>
            {totalCost > 0 && (
              <span className="text-xs text-muted-foreground">≈ ${totalCost.toFixed(3)}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {modelEditResults.map((r) => {
              const before = sourcePreviewById.get(r.sourceId);
              return (
                <div
                  key={r.id}
                  className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted/20"
                >
                  {r.imageData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageData} alt={r.sourceName} className="h-full w-full object-cover" />
                  ) : (
                    <>
                      {before && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={before}
                          alt={r.sourceName}
                          className="h-full w-full object-cover opacity-30"
                        />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        {r.status === "error" ? (
                          <>
                            <AlertCircle className="h-6 w-6 text-red-500" />
                            <span className="px-3 text-center text-[11px] text-red-500">{r.error}</span>
                          </>
                        ) : r.status === "cancelled" ? (
                          // Without this branch a cancelled card falls through to
                          // the spinner and spins forever under a blank label.
                          <>
                            <X className="h-6 w-6" />
                            <span className="px-3 text-center text-[11px]">
                              Cancelled — retry to run it again
                            </span>
                          </>
                        ) : (
                          <>
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="text-[11px]">{statusLabel(r.status)}</span>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  <div className="pointer-events-none absolute left-2 top-2 max-w-[85%] truncate rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                    {stripExt(r.sourceName)}
                  </div>

                  {r.imageData && r.status === "completed" && (
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => download(r.imageData!, stripExt(r.sourceName))}
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
                        onClick={() => sendToTryOn(r.imageData!, stripExt(r.sourceName))}
                        className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                        title="Use in Virtual Try-On"
                      >
                        <Shirt className="h-3.5 w-3.5" />
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

                  {(r.status === "error" || r.status === "cancelled") && (
                    <button
                      onClick={() => handleRegenerate(r)}
                      className="absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      Retry
                    </button>
                  )}
                </div>
              );
            })}
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
                    onClick={() => sendToTryOn(m.imageData, m.name)}
                    className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                    title="Use in Virtual Try-On"
                  >
                    <Shirt className="h-3.5 w-3.5" />
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
