"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Sparkles,
  Download,
  RotateCw,
  Wand2,
  Loader2,
  Check,
  AlertCircle,
  FileText,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  generateInfographicPrompt,
  generateInfographicImage,
  editInfographicImage,
  buildInfographicImageContentParts,
} from "@/lib/gemini";
import { generateInfographicImageAzure } from "@/lib/azure-image";
import { ModelComboPicker } from "./model-combo-picker";
import { INFOGRAPHIC_TEMPLATE_OPTIONS } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { InfographicResult, InfographicTemplate, StepCost } from "@/lib/types";

const TEMPLATE_LABEL: Record<InfographicTemplate, string> = {
  minimalistic: "Minimalistic",
  "sole-construction": "Sole Construction",
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const BUSY_STATUSES: InfographicResult["status"][] = [
  "pending",
  "generating-prompt",
  "generating-image",
  "auto-retrying",
  "editing",
];
const isBusy = (status: InfographicResult["status"]) => BUSY_STATUSES.includes(status);

function StatusBadge({ status }: { status: InfographicResult["status"] }) {
  const map: Record<InfographicResult["status"], { label: string; icon: React.ReactNode; cls: string }> = {
    pending: { label: "Queued", icon: <Loader2 className="w-3 h-3" />, cls: "text-muted-foreground" },
    "generating-prompt": { label: "Writing prompt…", icon: <Loader2 className="w-3 h-3 animate-spin" />, cls: "text-primary" },
    "generating-image": { label: "Rendering…", icon: <Loader2 className="w-3 h-3 animate-spin" />, cls: "text-primary" },
    "auto-retrying": { label: "Retrying…", icon: <Loader2 className="w-3 h-3 animate-spin" />, cls: "text-amber-500" },
    editing: { label: "Editing…", icon: <Loader2 className="w-3 h-3 animate-spin" />, cls: "text-primary" },
    completed: { label: "Completed", icon: <Check className="w-3 h-3" />, cls: "text-emerald-500" },
    cancelled: { label: "Cancelled", icon: <AlertCircle className="w-3 h-3" />, cls: "text-muted-foreground" },
    error: { label: "Failed", icon: <AlertCircle className="w-3 h-3" />, cls: "text-destructive" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", s.cls)}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function StepInfographicGenerate({ store }: { store: VTONStore }) {
  const {
    apiKey,
    textGenModel,
    imageGenModel,
    infographicCategory,
    infographicFolders,
    infographicBrand,
    infographicBackgroundStyle,
    infographicTemplateCounts,
    infographicAspectRatio,
    infographicImageSize,
    infographicStylingInstructions,
    infographicResults,
    setInfographicResults,
    updateInfographicResult,
    isInfographicGenerating,
    setIsInfographicGenerating,
  } = store;

  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [contextualTarget, setContextualTarget] = useState<InfographicResult | null>(null);
  const [contextualText, setContextualText] = useState("");

  const plan = useMemo(() => {
    const items: { folderId: string; folderName: string; template: InfographicTemplate; variationIndex: number; variationCount: number }[] = [];
    for (const folder of infographicFolders) {
      if (folder.images.length === 0) continue;
      for (const opt of INFOGRAPHIC_TEMPLATE_OPTIONS) {
        const count = infographicTemplateCounts[opt.value] ?? 0;
        for (let v = 1; v <= count; v++) {
          items.push({
            folderId: folder.id,
            folderName: folder.name,
            template: opt.value,
            variationIndex: v,
            variationCount: count,
          });
        }
      }
    }
    return items;
  }, [infographicFolders, infographicTemplateCounts]);

  const canGenerate = apiKey.length > 0 && plan.length > 0 && !isInfographicGenerating;

  // Runs the two-step pipeline for one result (with a single auto-retry).
  const runOne = useCallback(
    async (result: InfographicResult) => {
      const folder = infographicFolders.find((f) => f.id === result.folderId);
      if (!folder || folder.images.length === 0) {
        updateInfographicResult(result.id, { status: "error", error: "Product images not found" });
        return;
      }
      const productImages = folder.images.map((i) => ({ file: i.file }));
      const collected: StepCost[] = [];
      let retrySteps: StepCost[] | undefined;

      const generate = async () => {
        collected.length = 0;
        updateInfographicResult(result.id, { status: "generating-prompt", error: undefined });

        const promptRes = await generateInfographicPrompt({
          apiKey,
          textGenModel,
          productImages,
          productInfo: folder.productInfo,
          productCategory: infographicCategory,
          backgroundStyle: infographicBackgroundStyle,
          template: result.template,
          brand: {
            logoPresent: !!infographicBrand.logoFile,
            placementInstructions: infographicBrand.logoPlacementInstructions,
          },
          aspectRatio: infographicAspectRatio,
          stylingInstructions: infographicStylingInstructions,
          variationIndex: result.variationIndex,
          variationCount: result.variationCount,
        });
        collected.push(promptRes.cost);
        updateInfographicResult(result.id, { enrichedPrompt: promptRes.enrichedPrompt, status: "generating-image" });

        // The Gemini path returns the original turn's content parts; the Azure
        // path doesn't. Refine rebuilds these from inputs, so absence is fine.
        let imgRes: { imageData: string; cost: StepCost; responseContent: unknown };
        let contentParts: Awaited<ReturnType<typeof generateInfographicImage>>["contentParts"] | undefined;
        if (imageGenModel === "gpt-image-2") {
          imgRes = await generateInfographicImageAzure({
            prompt: promptRes.enrichedPrompt,
            productImages,
            logoFile: infographicBrand.logoFile,
            aspectRatio: infographicAspectRatio,
            imageSize: infographicImageSize,
          });
        } else {
          const res = await generateInfographicImage({
            apiKey,
            prompt: promptRes.enrichedPrompt,
            productImages,
            logoFile: infographicBrand.logoFile,
            brandPlacementInstructions: infographicBrand.logoPlacementInstructions,
            aspectRatio: infographicAspectRatio,
            imageSize: infographicImageSize,
          });
          imgRes = res;
          contentParts = res.contentParts;
        }
        collected.push(imgRes.cost);

        const mainCost = collected.reduce((s, c) => s + c.totalCost, 0);
        const retryCost = retrySteps ? retrySteps.reduce((s, c) => s + c.totalCost, 0) : 0;
        updateInfographicResult(result.id, {
          imageData: imgRes.imageData,
          imageGenResponseContent: imgRes.responseContent,
          originalContentParts: contentParts,
          editHistory: [],
          status: "completed",
          costBreakdown: { steps: [...collected], totalCost: mainCost + retryCost, retrySteps },
        });
      };

      try {
        await generate();
      } catch {
        try {
          retrySteps = [...collected];
          updateInfographicResult(result.id, { status: "auto-retrying", error: undefined });
          await new Promise((r) => setTimeout(r, 1000));
          await generate();
        } catch (err2) {
          updateInfographicResult(result.id, {
            status: "error",
            error: err2 instanceof Error ? err2.message : "Generation failed",
          });
        }
      }
    },
    [
      apiKey,
      textGenModel,
      imageGenModel,
      infographicFolders,
      infographicCategory,
      infographicBackgroundStyle,
      infographicBrand,
      infographicAspectRatio,
      infographicImageSize,
      infographicStylingInstructions,
      updateInfographicResult,
    ]
  );

  const handleGenerateAll = useCallback(async () => {
    if (!canGenerate) return;
    setIsInfographicGenerating(true);

    const initial: InfographicResult[] = plan.map((p) => ({
      id: uid("ig-result"),
      folderId: p.folderId,
      folderName: p.folderName,
      template: p.template,
      variationIndex: p.variationIndex,
      variationCount: p.variationCount,
      status: "pending",
    }));
    setInfographicResults(initial);

    // Mirror VTON's provider-aware concurrency: the Azure gpt-image-2 endpoint
    // pool + 429 failover absorbs bursts (10), while non-Gemini text providers
    // are throttled tighter (2). Default Gemini path stays at 4.
    const concurrency =
      imageGenModel === "gpt-image-2" ? 10 : textGenModel !== "gemini" ? 2 : 4;
    let idx = 0;
    const runNext = async (): Promise<void> => {
      while (idx < initial.length) {
        const i = idx++;
        await runOne(initial[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, initial.length) }, () => runNext()));

    setIsInfographicGenerating(false);
  }, [canGenerate, plan, runOne, imageGenModel, textGenModel, setInfographicResults, setIsInfographicGenerating]);

  // Per-card retry — runs independently so multiple cards can retry in parallel
  // without freezing the rest. `runOne` drives only this result's status.
  const handleRetry = useCallback(
    (result: InfographicResult) => {
      if (isBusy(result.status)) return;
      void runOne(result);
    },
    [runOne]
  );

  const handleContextualRetry = useCallback(async () => {
    const result = contextualTarget;
    const change = contextualText.trim();
    if (!result || !change) return;
    const folder = infographicFolders.find((f) => f.id === result.folderId);
    if (
      !folder ||
      !result.imageData ||
      !result.enrichedPrompt ||
      result.imageGenResponseContent == null
    ) {
      return;
    }

    setContextualTarget(null);
    setContextualText("");
    updateInfographicResult(result.id, { status: "editing", error: undefined });

    try {
      const productImages = folder.images.map((i) => ({ file: i.file }));
      // Rebuild the original render turn from inputs so Refine works regardless
      // of which engine produced the image (the Azure path stores no parts).
      const originalContentParts =
        result.originalContentParts ??
        (await buildInfographicImageContentParts({
          prompt: result.enrichedPrompt,
          productImages,
          logoFile: infographicBrand.logoFile,
          brandPlacementInstructions: infographicBrand.logoPlacementInstructions,
          aspectRatio: infographicAspectRatio,
        }));

      const res = await editInfographicImage({
        apiKey,
        textGenModel,
        originalContentParts,
        imageGenResponseContent: result.imageGenResponseContent,
        editHistory: result.editHistory,
        generatedImageData: result.imageData,
        productImages,
        productInfo: folder.productInfo,
        userChangeRequest: change,
        aspectRatio: infographicAspectRatio,
        imageSize: infographicImageSize,
      });

      const newEditHistory = [
        ...(result.editHistory ?? []),
        { userInstruction: res.editInstruction, modelResponseContent: res.responseContent },
      ];
      const prevCost = result.costBreakdown?.totalCost ?? 0;
      const addCost = res.promptCost.totalCost + res.imageCost.totalCost;
      updateInfographicResult(result.id, {
        imageData: res.imageData,
        editHistory: newEditHistory,
        status: "completed",
        costBreakdown: {
          steps: [...(result.costBreakdown?.steps ?? []), res.promptCost, res.imageCost],
          totalCost: prevCost + addCost,
          retrySteps: result.costBreakdown?.retrySteps,
        },
      });
    } catch (err) {
      updateInfographicResult(result.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Contextual retry failed",
      });
    }
  }, [
    contextualTarget,
    contextualText,
    infographicFolders,
    infographicBrand,
    apiKey,
    textGenModel,
    infographicAspectRatio,
    infographicImageSize,
    updateInfographicResult,
  ]);

  const downloadOne = (result: InfographicResult) => {
    if (!result.imageData) return;
    const link = document.createElement("a");
    link.href = result.imageData;
    link.download = `${result.folderName}-${result.template}-v${result.variationIndex}.png`.replace(/\s+/g, "_");
    link.click();
  };

  const downloadZip = async () => {
    const completed = infographicResults.filter((r) => r.status === "completed" && r.imageData);
    if (completed.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let JSZipMod: any;
    try {
      JSZipMod = (await import("jszip")).default;
    } catch {
      // Fall back to individual downloads if JSZip is unavailable.
      completed.forEach(downloadOne);
      return;
    }
    const zip = new JSZipMod();
    const counters: Record<string, number> = {};
    for (const r of completed) {
      const base = `${r.folderName}-${r.template}`.replace(/\s+/g, "_");
      counters[base] = (counters[base] ?? 0) + 1;
      const data = r.imageData!.split(",")[1];
      zip.file(`${base}-v${r.variationIndex}.png`, data, { base64: true });
    }
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = "infographics.zip";
    link.click();
    URL.revokeObjectURL(url);
  };

  const completedCount = infographicResults.filter((r) => r.status === "completed").length;
  const hasResults = infographicResults.length > 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Model picker — choose prompt + image engines (Gemini / OpenAI) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <ModelComboPicker store={store} />
      </div>

      {/* Summary + generate */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {plan.length} infographic{plan.length === 1 ? "" : "s"} to generate
            </h3>
            <p className="text-xs text-muted-foreground">
              {infographicFolders.filter((f) => f.images.length > 0).length} product(s) ·{" "}
              {Object.entries(infographicTemplateCounts)
                .filter(([, n]) => n > 0)
                .map(([t, n]) => `${n}× ${TEMPLATE_LABEL[t as InfographicTemplate]}`)
                .join(", ") || "no templates selected"}{" "}
              · {infographicAspectRatio} · {infographicImageSize}
            </p>
            {!apiKey && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> No Gemini API key configured.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={downloadZip}>
                <Download className="w-3.5 h-3.5" />
                Download all
              </Button>
            )}
            <button
              onClick={handleGenerateAll}
              disabled={!canGenerate}
              className="btn-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none"
            >
              {isInfographicGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {hasResults ? "Regenerate all" : "Generate"}
            </button>
          </div>
        </div>
        {hasResults && (
          <p className="text-xs text-muted-foreground mt-3">
            {completedCount} of {infographicResults.length} completed
          </p>
        )}
      </div>

      {/* Results grid */}
      {hasResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {infographicResults.map((result) => (
            <div key={result.id} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
              {/* Image / placeholder */}
              <div className="relative aspect-[4/5] bg-muted/30 flex items-center justify-center">
                {result.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.imageData} alt={result.folderName} className="w-full h-full object-contain" />
                ) : result.status === "error" ? (
                  <div className="text-center px-4">
                    <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
                    <p className="text-xs text-destructive">{result.error || "Failed"}</p>
                  </div>
                ) : (
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                )}
              </div>

              {/* Meta + actions */}
              <div className="p-3 space-y-2.5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{result.folderName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {TEMPLATE_LABEL[result.template]}
                      {result.variationCount > 1 ? ` · v${result.variationIndex}/${result.variationCount}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={result.status} />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 gap-1 rounded-lg text-xs"
                    disabled={!result.imageData}
                    onClick={() => downloadOne(result)}
                  >
                    <Download className="w-3 h-3" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 gap-1 rounded-lg text-xs"
                    disabled={isBusy(result.status)}
                    onClick={() => handleRetry(result)}
                  >
                    <RotateCw className="w-3 h-3" />
                    Retry
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 gap-1 rounded-lg text-xs"
                    disabled={isBusy(result.status) || !result.imageData}
                    onClick={() => {
                      setContextualTarget(result);
                      setContextualText("");
                    }}
                  >
                    <Wand2 className="w-3 h-3" />
                    Refine
                  </Button>
                  {result.enrichedPrompt && (
                    <button
                      onClick={() => setExpandedPrompt(expandedPrompt === result.id ? null : result.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors h-7 px-1"
                    >
                      <FileText className="w-3 h-3" />
                      {expandedPrompt === result.id ? "Hide" : "Prompt"}
                    </button>
                  )}
                </div>

                {expandedPrompt === result.id && result.enrichedPrompt && (
                  <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2.5 max-h-40 overflow-auto whitespace-pre-wrap leading-relaxed">
                    {result.enrichedPrompt}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contextual retry dialog */}
      <Dialog open={contextualTarget !== null} onOpenChange={(open) => !open && setContextualTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contextual retry</DialogTitle>
            <DialogDescription>
              Describe the single change you want. Only that change is applied — everything else stays identical.
              {contextualTarget && (
                <span className="block mt-1 text-foreground">
                  {contextualTarget.folderName} · {TEMPLATE_LABEL[contextualTarget.template]}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={contextualText}
            onChange={(e) => setContextualText(e.target.value)}
            placeholder="e.g. Use 4 sole layers instead of 3. Or: move the headline to the bottom. Or: make the background a deeper teal."
            className="min-h-[110px] text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setContextualTarget(null)}>
              Cancel
            </Button>
            <button
              onClick={handleContextualRetry}
              disabled={!contextualText.trim()}
              className="btn-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none"
            >
              <Wand2 className="w-4 h-4" />
              Apply change
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
