"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  Download,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  Upload,
  ImageIcon,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelComboPicker } from "./model-combo-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  generateEditImageInstruction,
  generateEditImage,
  buildEditImageContentParts,
  contextualRetryEditImage,
} from "@/lib/gemini";
import { generateEditImageAzure } from "@/lib/azure-image";
import { imageAspectRatio } from "@/lib/model-creation-client";
import type { VTONStore } from "@/store/vton-store";
import type {
  AspectRatio,
  EditImageResult,
  EditImageSubfolder,
  ProductOfInterest,
  StepCost,
} from "@/lib/types";

interface Props {
  store: VTONStore;
}

const SIZE_OPTIONS: ("1K" | "2K" | "4K")[] = ["1K", "2K", "4K"];

/** Everything needed to (re)run a single AI image edit, captured per result id. */
interface PlanItem {
  aiFile: File;
  aiPreview: string;
  productImages: { file: File }[];
  productPreviews: string[];
  productOfInterest: ProductOfInterest;
  subfolderId: string;
  subfolderName: string;
  diversityIndex: number;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isBusy(status: EditImageResult["status"]) {
  return (
    status === "pending" ||
    status === "generating-instruction" ||
    status === "generating-image" ||
    status === "auto-retrying" ||
    status === "editing"
  );
}

function statusLabel(status: EditImageResult["status"]) {
  switch (status) {
    case "generating-instruction":
      return "Planning edit…";
    case "generating-image":
      return "Editing…";
    case "auto-retrying":
      return "Retrying…";
    case "editing":
      return "Refining…";
    case "pending":
      return "Queued…";
    default:
      return "";
  }
}

function download(imageData: string, name: string) {
  const a = document.createElement("a");
  a.href = imageData;
  a.download = `${name.replace(/\s+/g, "-") || "edit"}.png`;
  a.click();
}

export function StepEditImageGenerate({ store }: Props) {
  const {
    apiKey,
    textGenModel,
    imageGenModel,
    editImageSubfolders,
    editImageVariationInstructions,
    editImageReferenceImages,
    editImageResults,
    setEditImageResults,
    updateEditImageResult,
    isEditImageGenerating,
    setIsEditImageGenerating,
  } = store;

  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("2K");
  const [reviewOpen, setReviewOpen] = useState(false);

  // Plan captured per result id, for regenerate + contextual retry.
  const planRef = useRef<Map<string, PlanItem>>(new Map());

  const validSubfolders = useMemo(
    () =>
      editImageSubfolders.filter(
        (s: EditImageSubfolder) =>
          !s.unmatched && s.aiImages.length > 0 && s.productImages.length > 0 && !!s.productOfInterest
      ),
    [editImageSubfolders]
  );

  const totalAiImages = validSubfolders.reduce((n, s) => n + s.aiImages.length, 0);

  const canGenerate =
    totalAiImages > 0 && editImageVariationInstructions.trim() !== "" && !isEditImageGenerating;

  const referenceImageArgs = useMemo(
    () => editImageReferenceImages.map((r) => ({ file: r.file })),
    [editImageReferenceImages]
  );

  const runImage = useCallback(
    async (
      editInstruction: string,
      plan: PlanItem,
      aspectRatio: AspectRatio
    ): Promise<{
      imageData: string;
      cost: StepCost;
      responseContent: unknown;
      contentParts?: Awaited<ReturnType<typeof generateEditImage>>["contentParts"];
    }> => {
      if (imageGenModel === "gpt-image-2") {
        const res = await generateEditImageAzure({
          editInstruction,
          aiImage: { file: plan.aiFile },
          productImages: plan.productImages,
          productOfInterest: plan.productOfInterest,
          aspectRatio,
          imageSize,
        });
        return { ...res, contentParts: undefined };
      }
      return generateEditImage({
        apiKey,
        editInstruction,
        aiImage: { file: plan.aiFile },
        productImages: plan.productImages,
        productOfInterest: plan.productOfInterest,
        aspectRatio,
        imageSize,
      });
    },
    [apiKey, imageGenModel, imageSize]
  );

  const runOne = useCallback(
    async (result: EditImageResult, plan: PlanItem) => {
      const collected: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      const generate = async () => {
        collected.length = 0;
        updateEditImageResult(result.id, { status: "generating-instruction", error: undefined });
        const instr = await generateEditImageInstruction({
          textGenModel,
          aiImage: { file: plan.aiFile },
          referenceImages: referenceImageArgs,
          variationInstructions: editImageVariationInstructions,
          productOfInterest: plan.productOfInterest,
          diversityIndex: plan.diversityIndex,
        });
        collected.push(instr.cost);

        updateEditImageResult(result.id, {
          status: "generating-image",
          editInstruction: instr.editInstruction,
        });

        const img = await runImage(instr.editInstruction, plan, result.aspectRatio);
        collected.push(img.cost);

        const mainCost = collected.reduce((s, c) => s + c.totalCost, 0);
        const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
        updateEditImageResult(result.id, {
          imageData: img.imageData,
          imageGenResponseContent: img.responseContent,
          originalContentParts: img.contentParts,
          editHistory: [],
          status: "completed",
          saved: false,
          costBreakdown: { steps: [...collected], totalCost: mainCost + retryCost, retrySteps },
        });
      };

      try {
        await generate();
      } catch {
        try {
          retrySteps = [...collected];
          updateEditImageResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          await generate();
        } catch (err2) {
          updateEditImageResult(result.id, {
            status: "error",
            error: err2 instanceof Error ? err2.message : "Edit failed",
          });
        }
      }
    },
    [textGenModel, referenceImageArgs, editImageVariationInstructions, runImage, updateEditImageResult]
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setIsEditImageGenerating(true);

    // Flatten every valid subfolder into one plan item per AI image, assigning a
    // running diversity index so each image is nudged toward a distinct variation.
    const plans: PlanItem[] = [];
    for (const sub of validSubfolders) {
      const productImages = sub.productImages.map((p) => ({ file: p.file }));
      const productPreviews = sub.productImages.map((p) => p.preview);
      for (const ai of sub.aiImages) {
        plans.push({
          aiFile: ai.file,
          aiPreview: ai.preview,
          productImages,
          productPreviews,
          productOfInterest: sub.productOfInterest!,
          subfolderId: sub.id,
          subfolderName: sub.name,
          diversityIndex: plans.length + 1,
        });
      }
    }

    const ratios = await Promise.all(plans.map((p) => imageAspectRatio(p.aiFile)));

    planRef.current = new Map();
    const initial: EditImageResult[] = plans.map((p, i) => {
      const id = uid("ei-result");
      planRef.current.set(id, p);
      return {
        id,
        subfolderId: p.subfolderId,
        subfolderName: p.subfolderName,
        sourceAiImageId: uid("src"),
        sourcePreview: p.aiPreview,
        productPreviews: p.productPreviews,
        productOfInterest: p.productOfInterest,
        diversityIndex: p.diversityIndex,
        aspectRatio: ratios[i],
        status: "pending",
      };
    });
    setEditImageResults(initial);

    const concurrency = imageGenModel === "gpt-image-2" ? 10 : 4;
    let idx = 0;
    const next = async (): Promise<void> => {
      while (idx < initial.length) {
        const i = idx++;
        await runOne(initial[i], plans[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, initial.length) }, () => next()));

    setIsEditImageGenerating(false);
  }, [
    canGenerate,
    validSubfolders,
    imageGenModel,
    runOne,
    setEditImageResults,
    setIsEditImageGenerating,
  ]);

  const handleRegenerate = useCallback(
    (result: EditImageResult) => {
      if (isBusy(result.status)) return;
      const plan = planRef.current.get(result.id);
      if (!plan) return;
      void runOne(result, plan);
    },
    [runOne]
  );

  const handleContextualRetry = useCallback(
    async (result: EditImageResult, change: string, referenceFile: File | null) => {
      const plan = planRef.current.get(result.id);
      const trimmed = change.trim();
      if (
        !plan ||
        !trimmed ||
        !result.imageData ||
        result.imageGenResponseContent == null ||
        !result.editInstruction
      ) {
        return;
      }

      updateEditImageResult(result.id, { status: "editing", error: undefined });
      try {
        // Rebuild the original render turn from inputs when the Azure path (which
        // stores no content parts) produced the image, so Refine works either way.
        const originalContentParts =
          result.originalContentParts ??
          (await buildEditImageContentParts({
            editInstruction: result.editInstruction,
            aiImage: { file: plan.aiFile },
            productImages: plan.productImages,
            productOfInterest: plan.productOfInterest,
          }));

        const res = await contextualRetryEditImage({
          apiKey,
          textGenModel,
          originalContentParts,
          imageGenResponseContent: result.imageGenResponseContent,
          editHistory: result.editHistory,
          generatedImageData: result.imageData,
          productImages: plan.productImages,
          productOfInterest: plan.productOfInterest,
          userChangeRequest: trimmed,
          referenceImage: referenceFile ? { file: referenceFile } : undefined,
          aspectRatio: result.aspectRatio,
          imageSize,
        });

        const newEditHistory = [
          ...(result.editHistory ?? []),
          { userInstruction: res.editInstruction, modelResponseContent: res.responseContent },
        ];
        const prevCost = result.costBreakdown?.totalCost ?? 0;
        const addCost = res.promptCost.totalCost + res.imageCost.totalCost;
        updateEditImageResult(result.id, {
          imageData: res.imageData,
          imageGenResponseContent: res.responseContent,
          editHistory: newEditHistory,
          status: "completed",
          costBreakdown: {
            steps: [...(result.costBreakdown?.steps ?? []), res.promptCost, res.imageCost],
            totalCost: prevCost + addCost,
            retrySteps: result.costBreakdown?.retrySteps,
          },
        });
      } catch (err) {
        updateEditImageResult(result.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Contextual retry failed",
        });
      }
    },
    [apiKey, textGenModel, imageSize, updateEditImageResult]
  );

  const totalCost = editImageResults.reduce((s, r) => s + (r.costBreakdown?.totalCost ?? 0), 0);
  const completed = editImageResults.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-8 animate-fade-in-up">
      <ModelComboPicker store={store} />

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
        <p className="text-xs text-muted-foreground">Each output keeps the base image&apos;s aspect ratio.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {totalAiImages > 0 ? (
            <>
              <span className="font-medium text-foreground">{totalAiImages}</span> AI image
              {totalAiImages !== 1 ? "s" : ""} across{" "}
              <span className="font-medium text-foreground">{validSubfolders.length}</span> subfolder
              {validSubfolders.length !== 1 ? "s" : ""}
            </>
          ) : (
            "No paired subfolders ready — go back and pair folders + set a product of interest."
          )}
        </p>
        <div className="flex items-center gap-2">
          {completed > 0 && (
            <button
              onClick={() => setReviewOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              <Eye className="h-4 w-4" />
              Review mode
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="btn-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white disabled:pointer-events-none disabled:opacity-50"
          >
            {isEditImageGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isEditImageGenerating ? "Editing…" : "Generate edits"}
          </button>
        </div>
      </div>

      {editImageResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Results{" "}
              <span className="font-normal text-muted-foreground">
                ({completed}/{editImageResults.length})
              </span>
            </h3>
            {totalCost > 0 && <span className="text-xs text-muted-foreground">≈ ${totalCost.toFixed(3)}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {editImageResults.map((r) => (
              <div
                key={r.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/20"
              >
                {r.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageData} alt={r.subfolderName} className="h-full w-full object-cover" />
                ) : (
                  <>
                    {r.sourcePreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.sourcePreview}
                        alt={r.subfolderName}
                        className="h-full w-full object-cover opacity-30"
                      />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
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
                  </>
                )}

                <div className="pointer-events-none absolute left-2 top-2 max-w-[85%] truncate rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  {r.subfolderName}
                </div>

                {r.imageData && r.status === "completed" && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => download(r.imageData!, r.subfolderName)}
                      className="rounded-md bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
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

      {reviewOpen && (
        <ReviewMode
          results={editImageResults}
          onClose={() => setReviewOpen(false)}
          onRetry={handleContextualRetry}
        />
      )}
    </div>
  );
}

/** Full-screen review overlay: each edited output beside its original + product images, with contextual retry. */
function ReviewMode({
  results,
  onClose,
  onRetry,
}: {
  results: EditImageResult[];
  onClose: () => void;
  onRetry: (result: EditImageResult, change: string, referenceFile: File | null) => void;
}) {
  const reviewable = results.filter((r) => r.imageData);
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Review Mode</h2>
          <span className="text-xs text-muted-foreground">({reviewable.length})</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {reviewable.map((r) => (
            <ReviewCard key={r.id} result={r} onRetry={onRetry} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  result,
  onRetry,
}: {
  result: EditImageResult;
  onRetry: (result: EditImageResult, change: string, referenceFile: File | null) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = isBusy(result.status);

  const onPick = (f: File | null) => {
    setFile(f);
    setFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  };

  const submit = () => {
    if (!text.trim() || busy) return;
    onRetry(result, text, file);
    setText("");
    onPick(null);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{result.subfolderName}</h3>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Edited output
          </p>
          <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.imageData} alt="edited" className="w-full object-contain" />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" /> Original AI image
          </p>
          <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.sourcePreview} alt="original" className="w-full object-contain" />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Product images
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {result.productPreviews.map((p, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-md border border-border/60 bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Refine this result</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe the change to apply. Everything else stays identical."
          className="min-h-[64px] resize-y bg-card"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            {file ? "Reference added" : "Add reference (optional)"}
          </button>
          {filePreview && (
            <div className="relative h-8 w-8 overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={filePreview} alt="ref" className="h-full w-full object-cover" />
              <button
                onClick={() => onPick(null)}
                className="absolute right-0 top-0 bg-black/60 p-0.5 text-white"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={submit}
            disabled={!text.trim() || busy}
            className="btn-gradient ml-auto inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium text-white disabled:pointer-events-none disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refine
          </button>
        </div>
      </div>
    </div>
  );
}
