"use client";

import { useMemo } from "react";
import {
  Archive,
  Camera,
  Check,
  History,
  Loader2,
  RefreshCw,
  Square,
  ThumbsUp,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadModelZip } from "@/lib/model-zip";
import { ModelEditControls } from "./model-edit-controls";
import { VIEW_META } from "@/hooks/use-model-refine-ops";
import type {
  ModelRefineData,
  ModelRefinePatch,
  RefineOpState,
} from "@/hooks/use-model-refine-ops";
import type { ModelVersion, ModelViewKind, ModelViewResult } from "@/lib/types";

export type { ModelRefineData, ModelRefinePatch };

interface Props {
  /** Stable identity of the model this panel is bound to. */
  refineKey: string;
  data: ModelRefineData;
  /** Transient per-model state owned by the step (pending edit, stage, errors). */
  opState: RefineOpState;
  busy: boolean;
  onGenerateShots: () => void;
  onRegenerateView: (view: ModelViewKind) => void;
  onApproveView: (view: ModelViewKind) => void;
  onApplyEdit: (directive: string, label: string, categoryKeys: string[]) => void;
  onApproveEdit: () => void;
  onDiscardEdit: () => void;
  onRevert: (v: ModelVersion) => void;
  onUpload: (slotKind: "full-body" | ModelViewKind, file: File) => void;
  /** Cancels every in-flight render for THIS model only. */
  onStop: () => void;
}

/**
 * Per-model refine panel: the three view slots with their approve/regenerate
 * loop, the structured facial-edit controls, the pending-edit review card,
 * version history, and zip export.
 *
 * Purely presentational — every operation and all transient state live in
 * `useModelRefineOps`, owned by the Refine step. That is what lets many panels
 * run at once: each is bound to its own `refineKey`, and the step drives the
 * same operations for a single card or for a whole batch.
 */
export function ModelRefinePanel({
  refineKey,
  data,
  opState,
  busy,
  onGenerateShots,
  onRegenerateView,
  onApproveView,
  onApplyEdit,
  onApproveEdit,
  onDiscardEdit,
  onRevert,
  onUpload,
  onStop,
}: Props) {
  const { pendingEdit, editStage, editError } = opState;

  const hasAnyView = !!data.faceCloseUp || !!data.backHead;
  const canEdit = data.faceCloseUp?.status === "completed" && !!data.faceCloseUp.imageData;

  const slots = useMemo(
    () =>
      [
        { title: "Full body", kind: "full-body" as const, imageData: data.imageData, view: undefined as ModelViewKind | undefined, state: undefined as ModelViewResult | undefined },
        { title: VIEW_META["face-closeup"].title, kind: "face-closeup" as const, imageData: data.faceCloseUp?.imageData, view: "face-closeup" as ModelViewKind, state: data.faceCloseUp },
        { title: VIEW_META["back-head"].title, kind: "back-head" as const, imageData: data.backHead?.imageData, view: "back-head" as ModelViewKind, state: data.backHead },
      ] as const,
    [data]
  );

  const handleDownload = () => {
    void downloadModelZip({
      name: data.name,
      imageData: data.imageData,
      faceCloseUp: data.faceCloseUp?.imageData,
      backHead: data.backHead?.imageData,
    });
  };

  return (
    <div
      id={`refine-panel-${refineKey}`}
      className={cn(
        "space-y-6 rounded-xl border bg-muted/10 p-4 transition-colors",
        busy ? "border-primary/40" : "border-border/60"
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {data.name}
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        </h4>
        <div className="flex items-center gap-2">
          {/* Per-model Stop — cancels only this model's renders. */}
          {busy && (
            <button
              onClick={onStop}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600/90 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-600"
              title={`Stop every in-flight render for ${data.name}`}
            >
              <Square className="h-3 w-3 fill-current" />
              Stop
            </button>
          )}
          {!hasAnyView && (
            <button
              onClick={onGenerateShots}
              disabled={busy}
              className="btn-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:pointer-events-none disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              Generate reference shots
            </button>
          )}
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
            title="Download this model's images as a zip"
          >
            <Archive className="h-4 w-4" />
            Download zip
          </button>
        </div>
      </div>

      {/* Three view slots */}
      <div className="grid grid-cols-3 gap-3">
        {slots.map((slot) => (
          <div key={slot.title} className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {slot.title}
              {slot.state?.approved && <Check className="ml-1 inline h-3 w-3 text-emerald-500" />}
            </p>
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted/20">
              {slot.imageData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slot.imageData} alt={slot.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center text-muted-foreground">
                  {slot.state?.status === "generating" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-[11px]">Rendering…</span>
                    </>
                  ) : slot.state?.status === "error" ? (
                    <span
                      className={cn(
                        "text-[11px]",
                        slot.state.error === "Cancelled" ? "text-muted-foreground" : "text-red-500"
                      )}
                    >
                      {slot.state.error}
                    </span>
                  ) : (
                    <span className="text-[11px]">Not generated yet</span>
                  )}
                </div>
              )}
            </div>
            {slot.state?.status !== "generating" && (
              <div className="flex gap-1.5">
                {slot.view && slot.state?.status === "completed" && !slot.state.approved && (
                  <button
                    onClick={() => onApproveView(slot.view!)}
                    disabled={busy}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600/90 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Approve
                  </button>
                )}
                {slot.view && slot.state && (
                  <button
                    onClick={() => onRegenerateView(slot.view!)}
                    disabled={busy}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {slot.state.status === "error" ? "Retry" : "Regenerate"}
                  </button>
                )}
                <label
                  className={cn(
                    "inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40",
                    busy && "pointer-events-none opacity-50"
                  )}
                  title={`Upload ${slot.title.toLowerCase()}`}
                >
                  <Upload className="h-3 w-3" />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUpload(slot.kind, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending edit review (stage 1 output, awaiting approval) */}
      {pendingEdit && (
        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-foreground">
            Review edit: <span className="text-muted-foreground">{pendingEdit.label}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</p>
              <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.faceCloseUp?.imageData} alt="Current close-up" className="h-full w-full object-cover" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Edited</p>
              <div className="aspect-[3/4] overflow-hidden rounded-lg border border-amber-500/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingEdit.imageData} alt="Edited close-up" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onApproveEdit}
              disabled={busy}
              className="btn-gradient inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Approve &amp; sync all views
            </button>
            <button
              onClick={onDiscardEdit}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Edit progress / errors */}
      {editStage !== "idle" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {editStage === "editing"
            ? "Applying edit to the face close-up…"
            : editStage === "syncing-body"
              ? "Re-syncing the full-body shot from the edited face…"
              : "Regenerating the back-of-head shot…"}
        </p>
      )}
      {editError && (
        <p
          className={cn(
            "text-xs",
            editError.startsWith("Cancelled") ? "text-muted-foreground" : "text-red-500"
          )}
        >
          {editError}
        </p>
      )}

      {/* Structured + freeform facial edits */}
      <div className="space-y-2 border-t border-border/60 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Facial refinement
        </p>
        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Generate and complete a face close-up first — edits apply to it, then the other views
            re-sync from the result.
          </p>
        )}
        <ModelEditControls
          disabled={!canEdit || busy}
          onApply={(d, l, keys) => onApplyEdit(d, l, keys)}
        />
      </div>

      {/* Version history */}
      {(data.versions?.length ?? 0) > 0 && (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
            <History className="h-3.5 w-3.5" />
            Version history
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {data.versions!.map((v) => (
              <div key={v.id} className="w-24 shrink-0 space-y-1">
                <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.imageData} alt={v.label} className="h-full w-full object-cover" />
                </div>
                <p className="truncate text-[10px] text-muted-foreground" title={v.label}>
                  {v.label}
                </p>
                <button
                  onClick={() => onRevert(v)}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-card px-1.5 py-1 text-[10px] font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  <Undo2 className="h-3 w-3" />
                  Revert
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
