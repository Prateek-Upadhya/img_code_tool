"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  Download,
  Loader2,
  Check,
  AlertCircle,
  Package,
  RotateCw,
  Square,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModelComboPicker } from "./model-combo-picker";
import {
  generatePdpPrompt,
  generatePdpImage,
  generatePdpCastMember,
  scorePdpImage,
  PDP_MAX_ATTEMPTS,
  PDP_SCORE_PASS_THRESHOLD,
} from "@/lib/gemini";
import { PDP_CATALOG } from "@/lib/pdp-catalog";
import { buildPdpStyleBlock, describePdpStyle } from "@/lib/pdp-style";
import {
  buildPdpGlobalDirectives,
  resolvePdpImageSize,
  PDP_MAX_PRODUCT_REFERENCES,
} from "@/lib/pdp-directives";
import { compositePdpLogos, placementLabel, shouldDrawOptionalLogo } from "@/lib/pdp-logo-composite";
import { resolvePdpCopy } from "@/lib/pdp-sheet";
import { savePdpImage, readPdpImage, clearPdpRun } from "@/lib/pdp-result-store";
import { downloadGroupedZip, downloadImage } from "@/lib/result-zip";
import { dataUrlToFile } from "@/lib/model-creation-client";
import type { VTONStore } from "@/store/vton-store";
import type { PdpProduct, PdpResult, PdpShotOption, StepCost } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Concurrency for the batch.
 *
 * The server side gate in gemini-image-gate.ts caps Gemini image calls at 30 across the
 * whole process, so this per-tab number only needs to avoid over-queuing. Kept at 6
 * because a PDP run is long and a mid-run failure is more costly here than elsewhere: the
 * lower number leaves headroom for another tab.
 */
const PDP_CONCURRENCY = 6;

const BUSY: PdpResult["status"][] = [
  "pending",
  "generating-prompt",
  "generating-image",
  "validating",
  "retrying",
  "compositing",
];

function StatusBadge({ status }: { status: PdpResult["status"] }) {
  const map: Record<PdpResult["status"], { label: string; spin?: boolean; cls: string }> = {
    pending: { label: "Queued", cls: "text-muted-foreground" },
    "generating-prompt": { label: "Writing brief", spin: true, cls: "text-primary" },
    "generating-image": { label: "Rendering", spin: true, cls: "text-primary" },
    validating: { label: "Checking", spin: true, cls: "text-primary" },
    retrying: { label: "Retrying", spin: true, cls: "text-amber-500" },
    compositing: { label: "Adding marks", spin: true, cls: "text-primary" },
    completed: { label: "Done", cls: "text-emerald-500" },
    cancelled: { label: "Stopped", cls: "text-muted-foreground" },
    error: { label: "Failed", cls: "text-destructive" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", s.cls)}>
      {s.spin ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : status === "completed" ? (
        <Check className="h-3 w-3" />
      ) : status === "error" ? (
        <AlertCircle className="h-3 w-3" />
      ) : null}
      {s.label}
    </span>
  );
}

export function StepPdpGenerate({ store }: { store: VTONStore }) {
  const {
    apiKey,
    textGenModel,
    pdpResolvedProducts,
    setPdpProducts,
    pdpSheetSession,
    pdpOptionColumns,
    pdpCustomOptions,
    pdpSelectedOptions,
    pdpStyle,
    pdpBackground,
    pdpLogos,
    pdpCastSource,
    pdpCastDescription,
    pdpCastImages,
    pdpAspectRatio,
    pdpImageSize,
    pdpResults,
    setPdpResults,
    isPdpGenerating,
    setIsPdpGenerating,
    pdpRunId,
    setPdpRunId,
  } = store;

  const abortRef = useRef<AbortController | null>(null);
  const [castNote, setCastNote] = useState<string | null>(null);

  const allOptions = useMemo(() => [...PDP_CATALOG, ...pdpCustomOptions], [pdpCustomOptions]);

  const selected = useMemo(
    () =>
      pdpSelectedOptions
        .map((id) => allOptions.find((o) => o.id === id))
        .filter((o): o is PdpShotOption => Boolean(o)),
    [pdpSelectedOptions, allOptions]
  );

  const readyProducts = useMemo(
    () => pdpResolvedProducts.filter((p) => p.images.length > 0),
    [pdpResolvedProducts]
  );

  // The flat work list: one image per product per ticked option.
  const plan = useMemo(
    () =>
      readyProducts.flatMap((product) =>
        selected.map((option) => ({ product, option }))
      ),
    [readyProducts, selected]
  );

  const needsCast = selected.some((o) => o.requiresModel);
  const canGenerate = apiKey.length > 0 && plan.length > 0 && !isPdpGenerating;

  const styleBlock = useMemo(
    () => buildPdpStyleBlock(pdpStyle, pdpBackground),
    [pdpStyle, pdpBackground]
  );

  /**
   * Cast pre-pass.
   *
   * With a described cast, one model is generated per product before the batch starts and
   * pinned onto the product, so every on-model shot of that product shows the same person
   * while different products show different people. With uploaded photos, the images are
   * simply cycled. Either way the image is what the render sees, because these models have
   * no seed and a text description alone would drift between calls.
   */
  const prepareCast = useCallback(
    async (signal: AbortSignal): Promise<Map<string, File>> => {
      const byProduct = new Map<string, File>();
      if (!needsCast) return byProduct;

      if (pdpCastSource === "uploaded") {
        if (pdpCastImages.length === 0) return byProduct;
        readyProducts.forEach((product, i) => {
          byProduct.set(product.id, pdpCastImages[i % pdpCastImages.length].file);
        });
        return byProduct;
      }

      setCastNote(`Casting ${readyProducts.length} model${readyProducts.length === 1 ? "" : "s"}...`);
      for (let i = 0; i < readyProducts.length; i++) {
        if (signal.aborted) break;
        const product = readyProducts[i];
        // An already-cast product keeps its model, so a re-run does not reshuffle faces.
        if (product.castModel) {
          byProduct.set(product.id, product.castModel.file);
          continue;
        }
        try {
          const { imageData } = await generatePdpCastMember({
            apiKey,
            description: pdpCastDescription,
            variationIndex: i + 1,
            abortSignal: signal,
          });
          const file = await dataUrlToFile(imageData, `cast-${product.sku}.png`);
          byProduct.set(product.id, file);
          setPdpProducts((prev) =>
            prev.map((p) =>
              p.id === product.id
                ? { ...p, castModel: { file, preview: URL.createObjectURL(file) } }
                : p
            )
          );
        } catch {
          // A failed cast member is not fatal: that product's on-model shots fall back to
          // the text description alone, which still renders, just without a pinned face.
        }
        setCastNote(`Casting ${i + 1} of ${readyProducts.length}...`);
      }
      setCastNote(null);
      return byProduct;
    },
    [
      needsCast,
      pdpCastSource,
      pdpCastImages,
      readyProducts,
      apiKey,
      pdpCastDescription,
      setPdpProducts,
    ]
  );

  const updateResult = useCallback(
    (id: string, patch: Partial<PdpResult>) => {
      setPdpResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [setPdpResults]
  );

  /**
   * One product, one option: brief, render, judge, and re-roll on failure.
   *
   * The loop keeps the highest scoring attempt rather than the last one, because attempt
   * three is not reliably better than attempt two. A judge failure stops the loop instead
   * of burning two more renders chasing an unknown score, and the image is kept with its
   * verification marked inconclusive.
   */
  const runOne = useCallback(
    async (
      result: PdpResult,
      product: PdpProduct,
      option: PdpShotOption,
      castFile: File | undefined,
      runId: string,
      signal: AbortSignal
    ) => {
      const costs: StepCost[] = [];
      let best: { imageData: string; prompt: string; score: number; summary: string; attempt: number } | null =
        null;

      const finish = async (inconclusive: boolean) => {
        if (!best) return;
        updateResult(result.id, { status: "compositing" });
        const composited = await compositePdpLogos(best.imageData, option, pdpLogos);

        await savePdpImage({
          id: result.id,
          runId,
          sku: product.sku,
          optionId: option.id,
          optionLabel: option.label,
          imageData: composited,
          createdAt: Date.now(),
        });

        updateResult(result.id, {
          status: "completed",
          // Only a thumbnail is kept in React state. A full run is hundreds of images and
          // holding them all as data URLs would exhaust the tab.
          thumbnail: composited,
          storageKey: result.id,
          prompt: best.prompt,
          score: best.score,
          attempt: best.attempt,
          scoreSummary: inconclusive ? "Not verified" : best.summary,
          costBreakdown: {
            steps: costs,
            totalCost: costs.reduce((sum, c) => sum + c.totalCost, 0),
          },
        });
      };

      try {
        const copy = resolvePdpCopy(product, option, pdpSheetSession, pdpOptionColumns);
        // Structural accuracy degrades past roughly six references, and product folders
        // routinely hold more, so the set is trimmed rather than sent whole.
        const productImages = product.images.slice(0, PDP_MAX_PRODUCT_REFERENCES);

        const referenceLabels = productImages.map(
          (_img, i) =>
            `footwear product reference ${i + 1} of ${productImages.length}, style ${product.sku}`
        );
        if (option.requiresModel && castFile) referenceLabels.push("the human model to cast");

        const globalDirectives = buildPdpGlobalDirectives({
          includeHuman: option.requiresModel,
          includeText: option.bearsText,
          referenceLabels,
          brandPlacementLabel: pdpLogos.brandLogo
            ? `the ${placementLabel(pdpLogos.brandPlacement)} corner area`
            : undefined,
          optionalPlacementLabel: shouldDrawOptionalLogo(option, pdpLogos)
            ? `the ${placementLabel(pdpLogos.optionalPlacement)} corner area`
            : undefined,
        });

        let correction: string | undefined;

        for (let attempt = 1; attempt <= PDP_MAX_ATTEMPTS; attempt++) {
          if (signal.aborted) break;

          updateResult(result.id, {
            status: attempt === 1 ? "generating-prompt" : "retrying",
            attempt,
          });

          const { enrichedPrompt, cost: promptCost } = await generatePdpPrompt({
            apiKey,
            textGenModel,
            option,
            productImages,
            sku: product.sku,
            overallContext: copy.overallContext,
            optionCopy: copy.optionCopy,
            styleBlock,
            globalDirectives,
            soleConstructionLayers: product.soleConstructionLayers ?? 3,
            aspectRatio: pdpAspectRatio,
            castDescription: option.requiresModel ? pdpCastDescription : undefined,
            correctionFeedback: correction,
            abortSignal: signal,
          });
          costs.push(promptCost);
          if (signal.aborted) break;

          updateResult(result.id, { status: "generating-image", prompt: enrichedPrompt });

          const { imageData, cost: imageCost } = await generatePdpImage({
            apiKey,
            prompt: enrichedPrompt,
            option,
            productImages,
            castImage: option.requiresModel ? castFile : undefined,
            aspectRatio: pdpAspectRatio,
            imageSize: resolvePdpImageSize(option, pdpImageSize),
            abortSignal: signal,
          });
          costs.push(imageCost);
          if (signal.aborted) break;

          updateResult(result.id, { status: "validating" });
          const verdict = await scorePdpImage({
            textGenModel,
            generatedImageData: imageData,
            productImages,
            option,
            composition: enrichedPrompt,
            attemptNumber: attempt,
            abortSignal: signal,
          });
          if (verdict.cost) costs.push(verdict.cost);

          if (!verdict.ok) {
            // The judge itself failed. Keep this image rather than spending two more
            // renders chasing a score we cannot read.
            best = { imageData, prompt: enrichedPrompt, score: 0, summary: "", attempt };
            await finish(true);
            return;
          }

          if (!best || verdict.result.score > best.score) {
            best = {
              imageData,
              prompt: enrichedPrompt,
              score: verdict.result.score,
              summary: verdict.result.summary,
              attempt,
            };
          }

          if (verdict.result.passed) break;
          correction = verdict.result.correction;
        }

        if (signal.aborted) {
          if (best) await finish(false);
          else updateResult(result.id, { status: "cancelled" });
          return;
        }

        if (!best) {
          updateResult(result.id, { status: "error", error: "No image was produced" });
          return;
        }

        await finish(false);
      } catch (err) {
        if (signal.aborted) {
          if (best) await finish(false);
          else updateResult(result.id, { status: "cancelled" });
          return;
        }
        // An earlier attempt may already have produced something usable, and a graded
        // imperfect image beats an error card.
        if (best) {
          await finish(false);
          return;
        }
        updateResult(result.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Generation failed",
        });
      }
    },
    [
      apiKey,
      textGenModel,
      pdpSheetSession,
      pdpOptionColumns,
      pdpLogos,
      styleBlock,
      pdpAspectRatio,
      pdpImageSize,
      pdpCastDescription,
      updateResult,
    ]
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsPdpGenerating(true);

    const runId = uid("pdp-run");
    if (pdpRunId) await clearPdpRun(pdpRunId);
    setPdpRunId(runId);

    const initial: PdpResult[] = plan.map(({ product, option }) => ({
      id: uid("pdp-result"),
      productId: product.id,
      sku: product.sku,
      optionId: option.id,
      optionLabel: option.label,
      heading: option.heading,
      status: "pending",
    }));
    setPdpResults(initial);

    try {
      const castByProduct = await prepareCast(controller.signal);

      let index = 0;
      const worker = async (): Promise<void> => {
        while (index < initial.length && !controller.signal.aborted) {
          const i = index++;
          const { product, option } = plan[i];
          await runOne(
            initial[i],
            product,
            option,
            castByProduct.get(product.id),
            runId,
            controller.signal
          );
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(PDP_CONCURRENCY, initial.length) }, () => worker())
      );
    } finally {
      setIsPdpGenerating(false);
      setCastNote(null);
      abortRef.current = null;
    }
  }, [
    canGenerate,
    plan,
    prepareCast,
    runOne,
    setIsPdpGenerating,
    setPdpResults,
    pdpRunId,
    setPdpRunId,
  ]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setPdpResults((prev) =>
      prev.map((r) => (BUSY.includes(r.status) ? { ...r, status: "cancelled" } : r))
    );
  }, [setPdpResults]);

  /** Full images are read back from IndexedDB at download time, not held in state. */
  const handleDownloadAll = useCallback(async () => {
    const completed = pdpResults.filter((r) => r.status === "completed");
    if (completed.length === 0) return;

    const bySku = new Map<string, { name: string; dataUrl: string }[]>();
    for (const result of completed) {
      const dataUrl = (await readPdpImage(result.id)) ?? result.thumbnail;
      if (!dataUrl) continue;
      const list = bySku.get(result.sku) ?? [];
      list.push({ name: `${result.sku}_${list.length + 1}`, dataUrl });
      bySku.set(result.sku, list);
    }

    await downloadGroupedZip(
      [...bySku.entries()].map(([folder, entries]) => ({ folder, entries })),
      "pdp-set.zip"
    );
  }, [pdpResults]);

  const handleDownloadOne = useCallback(async (result: PdpResult) => {
    const dataUrl = (await readPdpImage(result.id)) ?? result.thumbnail;
    if (dataUrl) downloadImage(dataUrl, `${result.sku}_${result.optionLabel}`);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, PdpResult[]>();
    for (const r of pdpResults) {
      const list = map.get(r.sku) ?? [];
      list.push(r);
      map.set(r.sku, list);
    }
    return [...map.entries()];
  }, [pdpResults]);

  const doneCount = pdpResults.filter((r) => r.status === "completed").length;
  const failedCount = pdpResults.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <ModelComboPicker store={store} />

      {/* Review */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Review</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Products</dt>
            <dd className="font-medium text-foreground">{readyProducts.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Per product</dt>
            <dd className="font-medium text-foreground">{selected.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total images</dt>
            <dd className="font-medium text-foreground">{plan.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Output</dt>
            <dd className="font-medium text-foreground">
              {pdpAspectRatio} · {pdpImageSize}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-muted-foreground">Style</dt>
            <dd className="font-medium text-foreground">
              {describePdpStyle(pdpStyle, pdpBackground)}
            </dd>
          </div>
        </dl>

        {needsCast && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Users className="mt-px h-3.5 w-3.5 shrink-0" />
            {pdpCastSource === "described"
              ? "One model is cast per product before rendering starts, so each product's images share one face."
              : `${pdpCastImages.length} uploaded model${pdpCastImages.length === 1 ? "" : "s"} cycled across products.`}
          </p>
        )}

        {pdpLogos.brandLogo && (
          <p className="text-xs text-muted-foreground">
            Brand mark composited at {placementLabel(pdpLogos.brandPlacement)} on every image.
            {pdpLogos.optionalLogo &&
              ` Optional mark on ${selected.filter((o) => shouldDrawOptionalLogo(o, pdpLogos)).length} of ${selected.length} shot types.`}
          </p>
        )}
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="btn-gradient text-white"
          size="lg"
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          Generate {plan.length} image{plan.length === 1 ? "" : "s"}
        </Button>
        {isPdpGenerating && (
          <Button onClick={handleStop} variant="outline" size="lg">
            <Square className="mr-1.5 h-3.5 w-3.5" />
            Stop
          </Button>
        )}
        {doneCount > 0 && !isPdpGenerating && (
          <Button onClick={handleDownloadAll} variant="outline" size="lg">
            <Package className="mr-1.5 h-4 w-4" />
            Download all as ZIP
          </Button>
        )}
        {apiKey.length === 0 && (
          <span className="text-xs text-muted-foreground">Add an API key to generate.</span>
        )}
      </div>

      {castNote && (
        <p className="flex items-center gap-1.5 text-xs text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          {castNote}
        </p>
      )}

      {pdpResults.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {doneCount} of {pdpResults.length} complete
          {failedCount > 0 && ` · ${failedCount} failed`}
        </p>
      )}

      {/* Results, grouped by SKU, which is also how they are delivered */}
      {grouped.map(([sku, results]) => (
        <section key={sku} className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">{sku}</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((result) => (
              <div
                key={result.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="relative aspect-square bg-muted/40">
                  {result.thumbnail ? (
                    <Image
                      src={result.thumbnail}
                      alt={result.optionLabel}
                      fill
                      sizes="200px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <StatusBadge status={result.status} />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-2">
                  <div className="flex items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                      {result.optionLabel}
                    </p>
                    {result.status === "completed" && typeof result.score === "number" && result.score > 0 && (
                      <span
                        title={
                          result.scoreSummary ||
                          `Inspected ${result.attempt ?? 1} time${(result.attempt ?? 1) === 1 ? "" : "s"}`
                        }
                        className={cn(
                          "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium tabular-nums",
                          result.score >= PDP_SCORE_PASS_THRESHOLD
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        )}
                      >
                        {result.score}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <StatusBadge status={result.status} />
                    {result.status === "completed" && (
                      <button
                        onClick={() => handleDownloadOne(result)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Download"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {result.error && (
                    <p className="text-[10px] leading-tight text-destructive" title={result.error}>
                      {result.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {pdpResults.length === 0 && plan.length > 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
          <RotateCw className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            {plan.length} image{plan.length === 1 ? "" : "s"} ready to generate.
          </p>
        </div>
      )}
    </div>
  );
}
