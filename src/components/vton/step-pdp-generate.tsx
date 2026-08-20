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
  derivePdpStoryDirection,
  scorePdpImage,
  contextualRetryPdpImage,
  PDP_MAX_ATTEMPTS,
  PDP_SCORE_PASS_THRESHOLD,
} from "@/lib/gemini";
import { PdpImageViewer } from "./pdp-image-viewer";
import { PDP_CATALOG } from "@/lib/pdp-catalog";
import { buildPdpStyleBlock, describePdpStyle } from "@/lib/pdp-style";
import {
  buildPdpGlobalDirectives,
  buildPdpMarkAwarenessClause,
  resolvePdpImageSize,
  selectPdpReferences,
  footwearSideLabel,
  placementLabel,
  shouldDrawOptionalLogo,
  buildPdpStoryBlock,
} from "@/lib/pdp-directives";
import { resolvePdpCopy, resolvePdpStory } from "@/lib/pdp-sheet";
import { savePdpImage, readPdpImage, clearPdpRun } from "@/lib/pdp-result-store";
import { downloadGroupedZip, downloadImage } from "@/lib/result-zip";
import { isChunkLoadError, STALE_BUILD_MESSAGE } from "@/lib/stale-build";
import { runPool } from "@/lib/two-lane-runner";
import { withPdpRetry, PdpConcurrencyGovernor } from "@/lib/pdp-retry";
import { dataUrlToFile } from "@/lib/model-creation-client";
import type { VTONStore } from "@/store/vton-store";
import type {
  PdpProduct,
  PdpResult,
  PdpShotOption,
  PdpStoryDirection,
  StepCost,
} from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Concurrency for the batch: 20 jobs in flight, the rest queued behind them.
 *
 * The server side gate in gemini-image-gate.ts caps Gemini image calls at 30 across the
 * whole process. Each job here is internally sequential (prompt, then image, then judge),
 * so 20 workers means at most 20 concurrent image calls, leaving 10 slots for a second tab
 * or another mode rather than pushing them into the server queue.
 *
 * Note this multiplies burn rate as well as throughput: each job may run up to three
 * attempts through the judge loop, so a batch that is failing spends roughly three times
 * faster than the nominal figure. Stop is the only brake.
 */
const PDP_CONCURRENCY = 20;

const BUSY: PdpResult["status"][] = [
  "pending",
  "generating-prompt",
  "generating-image",
  "validating",
  "retrying",
];

function StatusBadge({ status }: { status: PdpResult["status"] }) {
  const map: Record<PdpResult["status"], { label: string; spin?: boolean; cls: string }> = {
    pending: { label: "Queued", cls: "text-muted-foreground" },
    "generating-prompt": { label: "Writing brief", spin: true, cls: "text-primary" },
    "generating-image": { label: "Rendering", spin: true, cls: "text-primary" },
    validating: { label: "Checking", spin: true, cls: "text-primary" },
    retrying: { label: "Retrying", spin: true, cls: "text-amber-500" },
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
    pdpOptionMarkCaptions,
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
  /** Outcome of the last download, so a batch download can never fail silently. */
  const [downloadNote, setDownloadNote] = useState<{ tone: "info" | "error"; text: string } | null>(
    null
  );
  /** Result currently open in the full-screen viewer. */
  const [viewerId, setViewerId] = useState<string | null>(null);
  /** Full image for the open viewer, read from the store on demand. */
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  /** Result ids with a correction in flight. */
  const [correcting, setCorrecting] = useState<string[]>([]);
  /** Set when the governor steps the worker count down, so the run says why it slowed. */
  const [backedOffTo, setBackedOffTo] = useState<number | null>(null);
  /**
   * Governor for the active run. Held in a ref because it is mutated from inside worker
   * closures and must not re-render on every reported failure.
   */
  const governorRef = useRef<PdpConcurrencyGovernor>(new PdpConcurrencyGovernor(PDP_CONCURRENCY));

  /** Record that a result needed more than one attempt, so a shaky run is visible. */
  const noteRetry = useCallback(
    (id: string, attempt: number) => {
      setPdpResults((prev) =>
        prev.map((r) => (r.id === id ? { ...r, callRetries: Math.max(r.callRetries ?? 0, attempt) } : r))
      );
    },
    [setPdpResults]
  );

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

  /**
   * The art direction is built per option, in two variants.
   *
   * Each style's grammar describes how callouts behave, so injecting it unconditionally
   * pushed callouts onto shots whose own brief excluded them. The text-free variant drops
   * that axis and forbids information graphics outright, which is what keeps the on-model
   * photography clean.
   *
   * Typographic pairing for this batch.
   *
   * A ref rather than state, and read at call time rather than captured in a memo. The
   * style block is consumed inside `runOne`, whose closure would otherwise still hold the
   * previous run's pairing when a second Generate re-rolled it, leaving the type one run
   * behind. Re-rolled on each Generate, fixed for the duration of that run, so a delivered
   * set shares one typographic identity while a later run looks different.
   */
  const typographyIndexRef = useRef<number>(Math.floor(Math.random() * 997));

  /** Interpreted story per product id, surviving the run so a later retry matches its set. */
  const storyDirectionsRef = useRef<Map<string, PdpStoryDirection>>(new Map());

  /**
   * The style block for one image.
   *
   * `direction` is the product's interpreted story, when it has one. It supplies the
   * typographic pairing, so a catalogue of products differs typographically while every
   * image of one product agrees; without a story the run-level pairing is used exactly as
   * before. `setsScene` is true only on options carrying a human model, which is the one
   * place a story is allowed to override a style's own background.
   */
  const buildStyleBlockFor = useCallback(
    (bearsText: boolean, direction: PdpStoryDirection | null, setsScene: boolean) =>
      buildPdpStyleBlock(
        pdpStyle,
        pdpBackground,
        bearsText,
        direction ? direction.typographyIndex : typographyIndexRef.current,
        setsScene
      ),
    [pdpStyle, pdpBackground]
  );

  /**
   * Story pre-pass.
   *
   * One text call per product that HAS a story, run before the batch and reused by every
   * image of that product. Interpreting the same sentence once per image would give each
   * image its own slightly different world, and a product's set disagreeing with itself is
   * worse than having no story at all.
   *
   * Products with no story, or whose interpretation fails, simply get no entry. Their
   * prompts fall back to the raw story text, or to the artistic style alone, which is the
   * behaviour that shipped before stories existed.
   */
  const prepareStoryDirections = useCallback(
    async (signal: AbortSignal): Promise<Map<string, PdpStoryDirection>> => {
      const byProduct = new Map<string, PdpStoryDirection>();
      // Held for the session, not just the run. A card retried after the batch finishes
      // must reuse its product's direction, or the replacement image would come back with
      // a different world and typeface from the set it belongs to.
      storyDirectionsRef.current = byProduct;
      if (!pdpSheetSession?.storyColumn) return byProduct;

      const withStories = readyProducts
        .map((product) => ({ product, story: resolvePdpStory(product, pdpSheetSession) }))
        .filter((entry) => entry.story.trim().length > 0);
      if (withStories.length === 0) return byProduct;

      setCastNote(
        `Reading ${withStories.length} product stor${withStories.length === 1 ? "y" : "ies"}...`
      );
      for (const { product, story } of withStories) {
        if (signal.aborted) break;
        const direction = await derivePdpStoryDirection({
          textGenModel,
          sku: product.sku,
          story,
          style: pdpStyle,
          abortSignal: signal,
        });
        if (direction) byProduct.set(product.id, direction);
      }
      setCastNote(null);
      return byProduct;
    },
    [pdpSheetSession, readyProducts, textGenModel, pdpStyle]
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
      storyDirection: PdpStoryDirection | null,
      runId: string,
      signal: AbortSignal
    ) => {
      const governor = governorRef.current;
      const costs: StepCost[] = [];
      let best: { imageData: string; prompt: string; score: number; summary: string; attempt: number } | null =
        null;

      const finish = async (inconclusive: boolean) => {
        if (!best) return;
        // Marks are already rendered into the image by the generator, so there is no
        // post-processing pass here; the render is the deliverable.
        await savePdpImage({
          id: result.id,
          runId,
          sku: product.sku,
          optionId: option.id,
          optionLabel: option.label,
          imageData: best.imageData,
          createdAt: Date.now(),
        });

        updateResult(result.id, {
          status: "completed",
          // Only a thumbnail is kept in React state. A full run is hundreds of images and
          // holding them all as data URLs would exhaust the tab.
          thumbnail: best.imageData,
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
        // Only a shot carrying a human model may take its location from the story. On a
        // staged product shot or a table-driven infographic a story-built environment
        // would read as a mistake, so there the story shapes everything except place.
        const storySetsScene = option.requiresModel === true;
        const story = resolvePdpStory(product, pdpSheetSession);
        const storyBlock = buildPdpStoryBlock({
          story,
          direction: storyDirection,
          setsScene: storySetsScene,
          bearsText: option.bearsText,
        });
        // Structural accuracy degrades past roughly six references, and product folders
        // routinely hold more. Trimming is tag-aware so a tagged sole is never the image
        // that gets dropped.
        const productImages = selectPdpReferences(product.images);
        const wantsOptionalMark = shouldDrawOptionalLogo(option, pdpLogos);

        const referenceLabels = productImages.map((img) =>
          footwearSideLabel(img.footwearSide, product.sku)
        );
        if (option.requiresModel && castFile) referenceLabels.push("the human model to cast");
        if (pdpLogos.brandLogo) referenceLabels.push("the brand mark to render into the image");
        if (wantsOptionalMark) referenceLabels.push("the secondary mark to compose into the image");

        const globalDirectives = buildPdpGlobalDirectives({
          includeHuman: option.requiresModel,
          includeText: option.bearsText,
          referenceLabels,
          referenceSides: productImages.map((img) => img.footwearSide),
          brandPlacementLabel: pdpLogos.brandLogo
            ? `the ${placementLabel(pdpLogos.brandPlacement)} area`
            : undefined,
          brandScale: pdpLogos.brandScale,
          optionalMarkPurpose: wantsOptionalMark ? "Give it the weight of a seal of approval." : undefined,
          optionalMarkCaption: wantsOptionalMark ? pdpOptionMarkCaptions[option.id] : undefined,
        });

        const markAwareness = buildPdpMarkAwarenessClause({
          brandPlacementLabel: pdpLogos.brandLogo
            ? `the ${placementLabel(pdpLogos.brandPlacement)} area`
            : undefined,
          hasOptionalMark: wantsOptionalMark,
        });

        let correction: string | undefined;

        for (let attempt = 1; attempt <= PDP_MAX_ATTEMPTS; attempt++) {
          if (signal.aborted) break;

          updateResult(result.id, {
            status: attempt === 1 ? "generating-prompt" : "retrying",
            attempt,
          });

          // Each call retries transport failures and bare INVALID_ARGUMENTs on its own,
          // independently of the judge-driven re-roll this loop performs.
          const { value: promptRes } = await withPdpRetry(
            () => generatePdpPrompt({
            apiKey,
            textGenModel,
            option,
            productImages,
            sku: product.sku,
            overallContext: copy.overallContext,
            optionCopy: copy.optionCopy,
            storyBlock,
            styleBlock: buildStyleBlockFor(option.bearsText, storyDirection, storySetsScene),
            globalDirectives,
            markAwareness,
            soleConstructionLayers: product.soleConstructionLayers ?? 3,
            aspectRatio: pdpAspectRatio,
            castDescription: option.requiresModel ? pdpCastDescription : undefined,
            correctionFeedback: correction,
            abortSignal: signal,
            }),
            { signal, onRetry: (n, err) => { governor.report(err); noteRetry(result.id, n); } }
          );
          const { enrichedPrompt, cost: promptCost } = promptRes;
          costs.push(promptCost);
          if (signal.aborted) break;

          updateResult(result.id, { status: "generating-image", prompt: enrichedPrompt });

          const { value: imageRes } = await withPdpRetry(
            () => generatePdpImage({
            apiKey,
            prompt: enrichedPrompt,
            option,
            productImages,
            castImage: option.requiresModel ? castFile : undefined,
            brandLogo: pdpLogos.brandLogo?.file,
            brandPlacementLabel: pdpLogos.brandLogo
              ? `the ${placementLabel(pdpLogos.brandPlacement)} area`
              : undefined,
            optionalLogo: wantsOptionalMark ? pdpLogos.optionalLogo?.file : undefined,
            aspectRatio: pdpAspectRatio,
            imageSize: resolvePdpImageSize(option, pdpImageSize),
            abortSignal: signal,
            }),
            { signal, onRetry: (n, err) => { governor.report(err); noteRetry(result.id, n); } }
          );
          const { imageData, cost: imageCost } = imageRes;
          costs.push(imageCost);
          if (signal.aborted) break;

          updateResult(result.id, { status: "validating" });
          const verdict = await scorePdpImage({
            textGenModel,
            generatedImageData: imageData,
            productImages,
            option,
            composition: enrichedPrompt,
            brandLogo: pdpLogos.brandLogo?.file,
            optionalLogo: wantsOptionalMark ? pdpLogos.optionalLogo?.file : undefined,
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
      noteRetry,
      pdpSheetSession,
      pdpOptionColumns,
      pdpOptionMarkCaptions,
      pdpLogos,
      buildStyleBlockFor,
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

    setBackedOffTo(null);
    // New batch, new typographic pairing. Within the run it stays fixed.
    typographyIndexRef.current = Math.floor(Math.random() * 997);
    const governor = new PdpConcurrencyGovernor(PDP_CONCURRENCY, (next) => setBackedOffTo(next));
    governorRef.current = governor;

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
      // Stories first: the cast pre-pass is the slower of the two, and a story that fails
      // to interpret should not have consumed a casting call before it did so.
      const storyByProduct = await prepareStoryDirections(controller.signal);
      const castByProduct = await prepareCast(controller.signal);

      // Sliding-window pool: as each job finishes the next starts, so PDP_CONCURRENCY are
      // always working until the queue drains.
      await runPool(
        initial.map((result, i) => ({ result, ...plan[i] })),
        governor.current,
        ({ result, product, option }) =>
          runOne(
            result,
            product,
            option,
            castByProduct.get(product.id),
            storyByProduct.get(product.id) ?? null,
            runId,
            controller.signal
          ),
        controller.signal
      );
    } finally {
      setIsPdpGenerating(false);
      setCastNote(null);
      abortRef.current = null;
    }
  }, [
    canGenerate,
    plan,
    prepareStoryDirections,
    prepareCast,
    runOne,
    setIsPdpGenerating,
    setPdpResults,
    pdpRunId,
    setPdpRunId,
  ]);

  /**
   * Per-card retry, deliberately independent of the batch.
   *
   * Not async and not awaited, and it never touches `isPdpGenerating`, so a retry can run
   * while the batch is still going and several cards can retry at once. It runs against a
   * signal that never aborts, because there is no batch of its own to cancel; Stop only
   * governs the main run.
   */
  const handleRetry = useCallback(
    (result: PdpResult) => {
      if (BUSY.includes(result.status) || !apiKey) return;
      const product = readyProducts.find((p) => p.id === result.productId);
      const option = allOptions.find((o) => o.id === result.optionId);
      if (!product || !option) return;

      const castFile =
        pdpCastSource === "uploaded"
          ? pdpCastImages[readyProducts.indexOf(product) % Math.max(1, pdpCastImages.length)]?.file
          : product.castModel?.file;

      void runOne(
        { ...result, status: "pending", error: undefined },
        product,
        option,
        castFile,
        storyDirectionsRef.current.get(product.id) ?? null,
        pdpRunId || uid("pdp-run"),
        new AbortController().signal
      );
    },
    [apiKey, readyProducts, allOptions, pdpCastSource, pdpCastImages, pdpRunId, runOne]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setPdpResults((prev) =>
      prev.map((r) => (BUSY.includes(r.status) ? { ...r, status: "cancelled" } : r))
    );
  }, [setPdpResults]);

  /** Full images are read back from IndexedDB at download time, not held in state. */
  /**
   * Collect completed results into folder-per-SKU groups, reading the full images back
   * from the store. Shared by the whole-run download and the per-product one, which are
   * the same operation over a different slice.
   */
  const collectGroups = useCallback(async (results: PdpResult[]) => {
    const bySku = new Map<string, { name: string; dataUrl: string }[]>();
    for (const result of results) {
      if (result.status !== "completed") continue;
      const dataUrl = (await readPdpImage(result.id)) ?? result.thumbnail;
      if (!dataUrl) continue;
      const list = bySku.get(result.sku) ?? [];
      list.push({ name: `${result.sku}_${list.length + 1}`, dataUrl });
      bySku.set(result.sku, list);
    }
    return [...bySku.entries()].map(([folder, entries]) => ({ folder, entries }));
  }, []);

  /**
   * Run one archive download and always report what happened.
   *
   * Both batch buttons used to hand React a floating promise and return silently when
   * they had nothing, so every failure — a chunk lost to a redeploy, an image that would
   * not read back, a zip too large for the tab — looked identical to a dead button. Every
   * path through here now ends in a visible note, the successful one included, because
   * "27 images downloaded" is how the operator knows the archive is complete.
   */
  const runDownload = useCallback(
    async (label: string, results: PdpResult[], zipName: string) => {
      setDownloadNote(null);
      try {
        const groups = await collectGroups(results);
        if (groups.length === 0) {
          setDownloadNote({
            tone: "error",
            text: `Nothing to download for ${label}. No completed image could be read back from storage.`,
          });
          return;
        }
        const { written, skipped } = await downloadGroupedZip(groups, zipName);
        const plural = written === 1 ? "" : "s";
        setDownloadNote(
          skipped > 0
            ? {
                tone: "error",
                text: `${label}: ${written} image${plural} downloaded as ${zipName}, ${skipped} skipped because the stored image could not be read.`,
              }
            : { tone: "info", text: `${label}: ${written} image${plural} downloaded as ${zipName}.` }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // A chunk that will not load is worth naming separately: the fix is a reload, not
        // a re-run, and nothing about the results themselves is wrong.
        setDownloadNote({
          tone: "error",
          text: isChunkLoadError(err) ? STALE_BUILD_MESSAGE : `Download failed: ${message}`,
        });
      }
    },
    [collectGroups]
  );

  const handleDownloadAll = useCallback(
    () => runDownload("All products", pdpResults, "pdp-set.zip"),
    [pdpResults, runDownload]
  );

  /** One product's images as their own archive, still foldered by SKU inside. */
  const handleDownloadProduct = useCallback(
    (sku: string, results: PdpResult[]) => runDownload(sku, results, `${sku}.zip`),
    [runDownload]
  );

  // ── Viewer and contextual retry ───────────────────────────────────────────
  const viewerResult = useMemo(
    () => pdpResults.find((r) => r.id === viewerId) ?? null,
    [pdpResults, viewerId]
  );

  const openViewer = useCallback(async (result: PdpResult) => {
    setViewerId(result.id);
    setViewerImage(result.thumbnail ?? null);
    // The thumbnail shows instantly; the full image swaps in once read.
    const full = await readPdpImage(result.id);
    if (full) setViewerImage(full);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerId(null);
    setViewerImage(null);
  }, []);

  /**
   * Build the same render context the original generation used, so a correction changes
   * only what was asked and nothing drifts underneath it.
   */
  const rebuildContext = useCallback(
    (result: PdpResult) => {
      const product = readyProducts.find((p) => p.id === result.productId);
      const option = allOptions.find((o) => o.id === result.optionId);
      if (!product || !option || !result.prompt) return null;

      const wantsOptionalMark = shouldDrawOptionalLogo(option, pdpLogos);
      return {
        prompt: result.prompt,
        option,
        productImages: selectPdpReferences(product.images),
        castImage: option.requiresModel ? product.castModel?.file : undefined,
        brandLogo: pdpLogos.brandLogo?.file,
        brandPlacementLabel: pdpLogos.brandLogo
          ? `the ${placementLabel(pdpLogos.brandPlacement)} area`
          : undefined,
        optionalLogo: wantsOptionalMark ? pdpLogos.optionalLogo?.file : undefined,
        aspectRatio: pdpAspectRatio,
      };
    },
    [readyProducts, allOptions, pdpLogos, pdpAspectRatio]
  );

  const handleCorrect = useCallback(
    async (result: PdpResult, text: string, attachments: { file: File }[]) => {
      const context = rebuildContext(result);
      if (!context || !apiKey) return;

      const current = (await readPdpImage(result.id)) ?? result.thumbnail;
      if (!current) return;

      setCorrecting((prev) => [...prev, result.id]);
      try {
        const res = await contextualRetryPdpImage({
          apiKey,
          textGenModel,
          context,
          currentImageData: current,
          correctionText: text,
          correctionImages: attachments,
          imageSize: resolvePdpImageSize(context.option, pdpImageSize),
        });
        // Held as a candidate, not written to the store: the operator decides.
        updateResult(result.id, {
          candidate: { imageData: res.imageData, correction: text, createdAt: Date.now() },
          costBreakdown: {
            steps: [...(result.costBreakdown?.steps ?? []), res.promptCost, res.imageCost],
            totalCost:
              (result.costBreakdown?.totalCost ?? 0) + res.promptCost.totalCost + res.imageCost.totalCost,
          },
        });
      } catch (err) {
        updateResult(result.id, {
          error: err instanceof Error ? err.message : "Correction failed",
        });
      } finally {
        setCorrecting((prev) => prev.filter((id) => id !== result.id));
      }
    },
    [rebuildContext, apiKey, textGenModel, pdpImageSize, updateResult]
  );

  const approveCandidate = useCallback(
    async (result: PdpResult) => {
      const candidate = result.candidate;
      if (!candidate) return;

      await savePdpImage({
        id: result.id,
        runId: pdpRunId,
        sku: result.sku,
        optionId: result.optionId,
        optionLabel: result.optionLabel,
        imageData: candidate.imageData,
        createdAt: Date.now(),
      });

      updateResult(result.id, {
        thumbnail: candidate.imageData,
        candidate: undefined,
        corrections: [...(result.corrections ?? []), candidate.correction],
        error: undefined,
      });
      setViewerImage(candidate.imageData);
    },
    [pdpRunId, updateResult]
  );

  const discardCandidate = useCallback(
    (result: PdpResult) => updateResult(result.id, { candidate: undefined }),
    [updateResult]
  );

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
  const retriedCount = pdpResults.filter((r) => (r.callRetries ?? 0) > 0).length;

  /**
   * Failures grouped by message. Twenty-five cards carrying the same error is one cause,
   * not twenty-five, and reading it as one line is the difference between diagnosing it
   * and opening every card.
   */
  const failureGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const r of pdpResults) {
      if (r.status !== "error") continue;
      const key = (r.error ?? "Unknown error").slice(0, 160);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    return [...groups.entries()].sort((a, b) => b[1] - a[1]);
  }, [pdpResults]);

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
          <Button onClick={() => void handleDownloadAll()} variant="outline" size="lg">
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

      {downloadNote && (
        <p
          className={
            downloadNote.tone === "error"
              ? "rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              : "rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          }
        >
          {downloadNote.text}
        </p>
      )}

      {pdpResults.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {doneCount} of {pdpResults.length} complete
            {failedCount > 0 && ` · ${failedCount} failed`}
            {retriedCount > 0 && ` · ${retriedCount} needed a retry`}
          </p>

          {backedOffTo !== null && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-500">
              Repeated connection failures, so this run stepped down to {backedOffTo} at a time. It
              will finish, just more slowly. If this keeps happening, the deployment is running out
              of memory under load rather than anything being wrong with the request.
            </p>
          )}

          {/* One line per distinct cause, rather than one card per symptom. */}
          {failureGroups.length > 0 && (
            <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
              {failureGroups.map(([message, count]) => (
                <p key={message} className="text-xs text-destructive">
                  <span className="font-medium tabular-nums">{count}×</span> {message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results, grouped by SKU, which is also how they are delivered */}
      {grouped.map(([sku, results]) => (
        <section key={sku} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium text-foreground">{sku}</h4>
            {results.some((r) => r.status === "completed") && (
              <button
                onClick={() => void handleDownloadProduct(sku, results)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                title={`Download every image for ${sku} as a zip`}
              >
                <Package className="h-3 w-3" />
                Download {sku}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((result) => (
              <div
                key={result.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <button
                  onClick={() => result.thumbnail && void openViewer(result)}
                  disabled={!result.thumbnail}
                  className="relative block aspect-square w-full bg-muted/40 disabled:cursor-default"
                  title={result.thumbnail ? "Click to enlarge" : undefined}
                >
                  {result.thumbnail ? (
                    <>
                      <Image
                        src={result.thumbnail}
                        alt={result.optionLabel}
                        fill
                        sizes="200px"
                        className="object-cover"
                        unoptimized
                      />
                      {result.candidate && (
                        <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                          review
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <StatusBadge status={result.status} />
                    </div>
                  )}
                </button>
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
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleRetry(result)}
                        disabled={BUSY.includes(result.status) || !apiKey}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                        aria-label="Retry"
                        title="Retry this image"
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
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

      {viewerResult && (
        <PdpImageViewer
          result={viewerResult}
          imageData={viewerImage}
          busy={correcting.includes(viewerResult.id) || BUSY.includes(viewerResult.status)}
          onClose={closeViewer}
          onRetry={() => handleRetry(viewerResult)}
          onDownload={() => void handleDownloadOne(viewerResult)}
          onCorrect={(text, attachments) => void handleCorrect(viewerResult, text, attachments)}
          onApprove={() => void approveCandidate(viewerResult)}
          onDiscard={() => discardCandidate(viewerResult)}
        />
      )}
    </div>
  );
}
