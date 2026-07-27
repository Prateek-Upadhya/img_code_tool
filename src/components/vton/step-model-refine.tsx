"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, Library, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadSavedModels, saveModel } from "@/lib/model-library";
import { downloadModelsZip, type ModelZipEntry } from "@/lib/model-zip";
import { modelAgeGroup } from "@/lib/constants";
import { ModelRefinePanel, type ModelRefinePatch } from "./model-refine-panel";
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
 * Step 4 — Refine. Per approved model: generate the two identity reference
 * shots (face close-up + back of head), make fine-grained facial edits, and
 * export models as zips (one folder per model in bulk).
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
  } = store;

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

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

  const selected = targets.find((t) => t.key === selectedKey) ?? null;

  const toggleChecked = useCallback((key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const zipEntry = useCallback(
    (t: RefineTarget): ModelZipEntry => ({
      name: t.name,
      imageData: t.source === "result" ? t.result!.imageData! : t.saved!.imageData,
      faceCloseUp:
        t.source === "result" ? t.result!.faceCloseUp?.imageData : t.saved!.faceCloseUp?.imageData,
      backHead:
        t.source === "result" ? t.result!.backHead?.imageData : t.saved!.backHead?.imageData,
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

  const handlePatch = useCallback(
    (t: RefineTarget, patch: ModelRefinePatch) => {
      if (t.source === "result") updateModelCreationResult(t.result!.id, patch);
      else updateSavedModel(t.saved!.id, patch);
    },
    [updateModelCreationResult, updateSavedModel]
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

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Bulk export toolbar */}
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
        <div className="flex gap-2">
          <button
            onClick={() => handleBulkDownload([...checked])}
            disabled={checked.size === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40 disabled:opacity-50 disabled:pointer-events-none"
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
        {targets.map((t) => (
          <div key={t.key} className="space-y-1">
            <button
              onClick={() => setSelectedKey(t.key === selectedKey ? null : t.key)}
              className={cn(
                "group relative block w-full overflow-hidden rounded-xl border bg-muted/20 transition-all",
                t.key === selectedKey
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
              {t.source === "saved" && (
                <div className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-black/50 p-1 backdrop-blur-sm">
                  <Library className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
            <label className="flex cursor-pointer items-center gap-1.5 px-0.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={checked.has(t.key)}
                onChange={() => toggleChecked(t.key)}
                className="h-3 w-3 accent-foreground"
              />
              Include in export
            </label>
          </div>
        ))}
      </div>

      {/* Refine panel for the selected model */}
      {selected && (
        <div className="space-y-3">
          {selected.source === "result" && (
            <button
              onClick={() => void handleSaveToLibrary(selected)}
              disabled={selected.result!.saved}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium",
                selected.result!.saved
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "border border-border bg-card text-foreground hover:bg-muted/40"
              )}
            >
              {selected.result!.saved ? (
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
            store={store}
            data={{
              name: selected.name,
              imageData:
                selected.source === "result"
                  ? selected.result!.imageData!
                  : selected.saved!.imageData,
              // Both sources carry the band the model was cast at, so refine
              // renders keep the same personGeneration as the original.
              ageGroup: modelAgeGroup(
                selected.source === "result"
                  ? selected.result!.ageRange
                  : selected.saved!.ageRange
              ),
              faceCloseUp:
                selected.source === "result"
                  ? selected.result!.faceCloseUp
                  : selected.saved!.faceCloseUp,
              backHead:
                selected.source === "result"
                  ? selected.result!.backHead
                  : selected.saved!.backHead,
              versions:
                selected.source === "result"
                  ? selected.result!.versions
                  : selected.saved!.versions,
            }}
            onChange={(patch) => handlePatch(selected, patch)}
          />
        </div>
      )}
    </div>
  );
}
