"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Camera, Check, CheckCheck, Library, Loader2, Save, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadSavedModels, saveModel } from "@/lib/model-library";
import { downloadModelsZip, type ModelZipEntry } from "@/lib/model-zip";
import { modelAgeGroup } from "@/lib/constants";
import { runPool } from "@/lib/two-lane-runner";
import { ModelRefinePanel } from "./model-refine-panel";
import { ModelEditControls } from "./model-edit-controls";
import { useModelRefineOps, type ModelRefinePatch } from "@/hooks/use-model-refine-ops";
import type { VTONStore } from "@/store/vton-store";
import type { ModelCreationResult, SavedModel } from "@/lib/types";

interface Props {
  store: VTONStore;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** One refine-able model card — a completed result or a library model. */
interface RefineTarget {
  key: string;
  name: string;
  imageData: string;
  source: "result" | "saved";
  result?: ModelCreationResult;
  saved?: SavedModel;
}

/**
 * Step 4 — Refine. Generate the two identity reference shots (face close-up +
 * back of head) and make fine-grained facial edits, for as many models at once
 * as the user selects, then export models as zips.
 *
 * Selection is ONE concept: the checkbox on each card decides which models get
 * an open panel, which the batch toolbar acts on, and which go into the export.
 */
export function StepModelRefine({ store }: Props) {
  const {
    modelCreationResults,
    updateModelCreationResult,
    savedModels,
    setSavedModels,
    updateSavedModel,
    modelGender,
    modelAgeRange,
    modelBodyType,
    modelEthnicity,
    modelBrandName,
    imageGenModel,
    modelRefineBusyKeys,
    cancelModelRefineOp,
    cancelAllModelRefineOps,
  } = store;

  const [checked, setChecked] = useState<Set<string>>(new Set());
  /** Set while a batch action is dispatching, so the toolbar can show progress. */
  const [batchLabel, setBatchLabel] = useState<string | null>(null);

  // Batch-level controller, held ALONGSIDE the per-model ones. The per-model
  // controllers cancel work already in flight; this one stops runPool handing
  // out the models it has not reached yet. Without it "Stop all" would abort the
  // running renders and then immediately start the rest of the queue.
  const batchAbortRef = useRef<AbortController | null>(null);

  const beginBatch = useCallback((label: string) => {
    const ctrl = new AbortController();
    batchAbortRef.current = ctrl;
    setBatchLabel(label);
    return ctrl.signal;
  }, []);

  const stopAll = useCallback(() => {
    batchAbortRef.current?.abort();
    cancelAllModelRefineOps();
  }, [cancelAllModelRefineOps]);

  // Load the Model Library once on mount (same as the Generate step).
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

  const targets: RefineTarget[] = useMemo(() => {
    const fromResults = modelCreationResults
      .filter((r) => r.status === "completed" && !!r.imageData)
      .map((r) => ({
        key: `result:${r.id}`,
        name: r.boxName + (r.variantCount > 1 ? ` · ${r.variantIndex}` : ""),
        imageData: r.imageData!,
        source: "result" as const,
        result: r,
      }));
    const fromSaved = savedModels.map((m) => ({
      key: `saved:${m.id}`,
      name: m.name,
      imageData: m.imageData,
      source: "saved" as const,
      saved: m,
    }));
    return [...fromResults, ...fromSaved];
  }, [modelCreationResults, savedModels]);

  const patch = useCallback(
    (key: string, p: ModelRefinePatch) => {
      const [source, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
      if (source === "result") updateModelCreationResult(id, p);
      else updateSavedModel(id, p);
    },
    [updateModelCreationResult, updateSavedModel]
  );

  const ops = useModelRefineOps({ store, patch });

  /** The refine-able slice of each target, keyed for the ops layer. */
  const refineTargets = useMemo(
    () =>
      targets.map((t) => ({
        key: t.key,
        data: {
          name: t.name,
          imageData: t.source === "result" ? t.result!.imageData! : t.saved!.imageData,
          // Both sources carry the band the model was cast at, so refine renders
          // keep the same personGeneration as the original.
          ageGroup: modelAgeGroup(
            t.source === "result" ? t.result!.ageRange : t.saved!.ageRange
          ),
          faceCloseUp: t.source === "result" ? t.result!.faceCloseUp : t.saved!.faceCloseUp,
          backHead: t.source === "result" ? t.result!.backHead : t.saved!.backHead,
          versions: t.source === "result" ? t.result!.versions : t.saved!.versions,
        },
      })),
    [targets]
  );

  const byKey = useMemo(
    () => new Map(refineTargets.map((t) => [t.key, t])),
    [refineTargets]
  );

  const selected = useMemo(
    () => targets.filter((t) => checked.has(t.key)),
    [targets, checked]
  );
  const selectedRefine = useMemo(
    () => selected.map((t) => byKey.get(t.key)!).filter(Boolean),
    [selected, byKey]
  );

  const anyBusy = modelRefineBusyKeys.size > 0;
  const pendingCount = selectedRefine.filter((t) => ops.getOpState(t.key).pendingEdit).length;

  const toggleChecked = useCallback((key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Batch actions ───────────────────────────────────────────────────────
  // All three fan out through runPool at the same concurrency the Generate step
  // uses, so selecting 20 models cannot fire 40 simultaneous renders.
  const concurrency = imageGenModel === "gpt-image-2" ? 10 : 4;

  const handleBatchShots = useCallback(async () => {
    // Skip models that already have both views so a second click does not
    // silently re-bill the whole selection.
    const todo = selectedRefine.filter(
      (t) => !t.data.faceCloseUp?.imageData || !t.data.backHead?.imageData
    );
    if (todo.length === 0) return;
    const signal = beginBatch(
      `Generating reference shots for ${todo.length} model${todo.length !== 1 ? "s" : ""}…`
    );
    try {
      await runPool(todo, concurrency, (t) => ops.generateShots(t), signal);
    } finally {
      setBatchLabel(null);
    }
  }, [selectedRefine, concurrency, ops, beginBatch]);

  const handleBatchEdit = useCallback(
    async (directive: string, label: string, keys: string[]) => {
      const todo = selectedRefine.filter((t) => t.data.faceCloseUp?.status === "completed");
      if (todo.length === 0) return;
      const signal = beginBatch(
        `Applying "${label}" to ${todo.length} model${todo.length !== 1 ? "s" : ""}…`
      );
      try {
        await runPool(todo, concurrency, (t) => ops.applyEdit(t, directive, label, keys), signal);
      } finally {
        setBatchLabel(null);
      }
    },
    [selectedRefine, concurrency, ops, beginBatch]
  );

  const handleApproveAll = useCallback(async () => {
    const todo = selectedRefine.filter((t) => ops.getOpState(t.key).pendingEdit);
    if (todo.length === 0) return;
    const signal = beginBatch(
      `Syncing ${todo.length} approved edit${todo.length !== 1 ? "s" : ""}…`
    );
    try {
      await runPool(todo, concurrency, (t) => ops.approveEdit(t), signal);
    } finally {
      setBatchLabel(null);
    }
  }, [selectedRefine, concurrency, ops, beginBatch]);

  // ── Export ──────────────────────────────────────────────────────────────
  const zipEntry = useCallback(
    (t: RefineTarget): ModelZipEntry => ({
      name: t.name,
      imageData: t.source === "result" ? t.result!.imageData! : t.saved!.imageData,
      faceCloseUp:
        t.source === "result" ? t.result!.faceCloseUp?.imageData : t.saved!.faceCloseUp?.imageData,
      backHead: t.source === "result" ? t.result!.backHead?.imageData : t.saved!.backHead?.imageData,
    }),
    []
  );

  const handleBulkDownload = useCallback(
    (keys: string[]) => {
      const entries = targets.filter((t) => keys.includes(t.key)).map(zipEntry);
      void downloadModelsZip(entries);
    },
    [targets, zipEntry]
  );

  /** Save a refined RESULT (incl. its views/versions) into the Model Library. */
  const handleSaveToLibrary = useCallback(
    async (t: RefineTarget) => {
      const r = t.result;
      if (!r?.imageData || r.saved) return;
      const model: SavedModel = {
        id: uid("saved-model"),
        name: t.name,
        imageData: r.imageData,
        gender: modelGender,
        ageRange: modelAgeRange,
        bodyType: modelBodyType,
        ethnicity: modelEthnicity.trim(),
        brandName: modelBrandName.trim() || undefined,
        createdAt: Date.now(),
        faceCloseUp: r.faceCloseUp,
        backHead: r.backHead,
        versions: r.versions,
      };
      try {
        await saveModel(model);
        setSavedModels([model, ...savedModels]);
        updateModelCreationResult(r.id, { saved: true });
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
      savedModels,
      setSavedModels,
      updateModelCreationResult,
    ]
  );

  if (targets.length === 0) {
    return (
      <div className="animate-fade-in-up rounded-xl border border-border/60 bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No models to refine yet — generate models on the previous step, or save some to the
          Model Library first.
        </p>
      </div>
    );
  }

  const allChecked = checked.size === targets.length;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Selection + export toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {targets.length} model{targets.length !== 1 ? "s" : ""}
          {checked.size > 0 && (
            <>
              {" "}
              · <span className="font-medium text-foreground">{checked.size}</span> selected
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              setChecked(allChecked ? new Set() : new Set(targets.map((t) => t.key)))
            }
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
          >
            <CheckCheck className="h-4 w-4" />
            {allChecked ? "Clear selection" : "Select all"}
          </button>
          <button
            onClick={() => handleBulkDownload([...checked])}
            disabled={checked.size === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
          >
            <Archive className="h-4 w-4" />
            Download selected
          </button>
          <button
            onClick={() => handleBulkDownload(targets.map((t) => t.key))}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
          >
            <Archive className="h-4 w-4" />
            Download all
          </button>
        </div>
      </div>

      {/* Model cards */}
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {targets.map((t) => {
          const busy = modelRefineBusyKeys.has(t.key);
          const isChecked = checked.has(t.key);
          return (
            <div key={t.key} className="space-y-1">
              <button
                onClick={() => toggleChecked(t.key)}
                className={cn(
                  "group relative block w-full overflow-hidden rounded-xl border bg-muted/20 transition-all",
                  isChecked
                    ? "border-foreground ring-1 ring-foreground"
                    : "border-border hover:border-foreground/40"
                )}
              >
                <div className="aspect-[3/4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.imageData} alt={t.name} className="h-full w-full object-cover" />
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent p-1.5">
                  <p className="truncate text-[10px] font-medium text-white">{t.name}</p>
                </div>
                {busy && (
                  <div className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-black/60 p-1 backdrop-blur-sm">
                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                  </div>
                )}
                {t.source === "saved" && (
                  <div className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-black/50 p-1 backdrop-blur-sm">
                    <Library className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
              <label className="flex cursor-pointer items-center gap-1.5 px-0.5 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleChecked(t.key)}
                  className="h-3 w-3 accent-foreground"
                />
                Select
              </label>
            </div>
          );
        })}
      </div>

      {/* Batch actions across every selected model */}
      {selected.length > 0 && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Batch actions · {selected.length} model{selected.length !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {(anyBusy || batchLabel) && (
                <button
                  onClick={stopAll}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600/90 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-600"
                  title="Stop every in-flight render across all models"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop all
                </button>
              )}
              <button
                onClick={() => void handleBatchShots()}
                className="btn-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-white"
              >
                <Camera className="h-3.5 w-3.5" />
                Generate reference shots
              </button>
              {pendingCount > 0 && (
                <button
                  onClick={() => void handleApproveAll()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/90 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600"
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve all ({pendingCount})
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Reference shots skip models that already have both views. Edits apply to every selected
            model&apos;s face close-up, then each model shows its own before/after card for approval.
          </p>

          <ModelEditControls
            disabled={selectedRefine.every((t) => t.data.faceCloseUp?.status !== "completed")}
            onApply={(d, l, keys) => void handleBatchEdit(d, l, keys)}
          />

          {batchLabel && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {batchLabel}
            </p>
          )}
        </div>
      )}

      {/* One refine panel per selected model */}
      {selected.map((t) => {
        const rt = byKey.get(t.key);
        if (!rt) return null;
        return (
          <div key={t.key} className="space-y-3">
            {t.source === "result" && (
              <button
                onClick={() => void handleSaveToLibrary(t)}
                disabled={t.result!.saved}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium",
                  t.result!.saved
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "border border-border bg-card text-foreground hover:bg-muted/40"
                )}
              >
                {t.result!.saved ? (
                  <>
                    <Check className="h-4 w-4" /> Saved to library
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save to library
                  </>
                )}
              </button>
            )}
            <ModelRefinePanel
              refineKey={rt.key}
              data={rt.data}
              opState={ops.getOpState(rt.key)}
              busy={modelRefineBusyKeys.has(rt.key)}
              onGenerateShots={() => void ops.generateShots(rt)}
              onRegenerateView={(view) => void ops.regenerateView(rt, view)}
              onApproveView={(view) => ops.approveView(rt, view)}
              onApplyEdit={(d, l, keys) => void ops.applyEdit(rt, d, l, keys)}
              onApproveEdit={() => void ops.approveEdit(rt)}
              onDiscardEdit={() => ops.discardEdit(rt.key)}
              onRevert={(v) => ops.revertTo(rt, v)}
              onUpload={(kind, file) => ops.uploadInto(rt.key, kind, file)}
              onStop={() => cancelModelRefineOp(rt.key)}
            />
          </div>
        );
      })}

      {selected.length === 0 && (
        <p className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Select one or more models above to generate reference shots, apply facial edits, or export
          them. Everything you select can run at the same time.
        </p>
      )}
    </div>
  );
}
