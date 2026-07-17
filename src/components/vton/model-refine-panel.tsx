"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Archive,
  Camera,
  Check,
  History,
  Loader2,
  RefreshCw,
  ThumbsUp,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generateModelViewImage,
  generateModelEditInstruction,
  generateModelEditImage,
} from "@/lib/gemini";
import {
  generateModelViewImageAzure,
  generateModelEditImageAzure,
} from "@/lib/azure-image";
import { dataUrlToFile, imageAspectRatio } from "@/lib/model-creation-client";
import { downloadModelZip } from "@/lib/model-zip";
import { ModelEditControls } from "./model-edit-controls";
import type { VTONStore } from "@/store/vton-store";
import type { ModelVersion, ModelViewKind, ModelViewResult } from "@/lib/types";

/** The refine-able slice of a ModelCreationResult or SavedModel. */
export interface ModelRefineData {
  name: string;
  /** Full-body image as a data URL. */
  imageData: string;
  faceCloseUp?: ModelViewResult;
  backHead?: ModelViewResult;
  versions?: ModelVersion[];
}

export type ModelRefinePatch = Partial<
  Pick<ModelRefineData, "imageData" | "faceCloseUp" | "backHead" | "versions">
>;

interface Props {
  store: VTONStore;
  data: ModelRefineData;
  /** Shallow-merged into the backing ModelCreationResult / SavedModel. */
  onChange: (patch: ModelRefinePatch) => void;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** What the full body must copy from an edited face close-up on re-sync. */
const FACE_SYNC_INSTRUCTION =
  "the model's face, facial features, hairstyle, hair color and makeup exactly match the REFERENCE image";
const FACE_SYNC_REFERENCE_DIRECTIVE = "the face, hairstyle, hair color and makeup";

const VIEW_META: Record<ModelViewKind, { key: "faceCloseUp" | "backHead"; title: string }> = {
  "face-closeup": { key: "faceCloseUp", title: "Face close-up" },
  "back-head": { key: "backHead", title: "Back of head" },
};

/**
 * Per-model refine panel: reference-shot generation with an approve/regenerate
 * loop, the structured facial-edit pipeline (face close-up is the identity
 * source of truth), linear version history with revert, and zip export.
 * Used by the wizard's Refine step (bound to a ModelCreationResult) and by the
 * Model Library (bound to a SavedModel).
 */
export function ModelRefinePanel({ store, data, onChange }: Props) {
  const { apiKey, textGenModel, imageGenModel, setIsModelRefineGenerating } = store;

  const [pendingEdit, setPendingEdit] = useState<{ label: string; imageData: string } | null>(null);
  const [editStage, setEditStage] = useState<"idle" | "editing" | "syncing-body" | "syncing-back">("idle");
  const [editError, setEditError] = useState<string | null>(null);
  const [opCount, setOpCount] = useState(0);

  const beginOp = useCallback(() => {
    setOpCount((n) => n + 1);
    setIsModelRefineGenerating(true);
  }, [setIsModelRefineGenerating]);
  const endOp = useCallback(() => {
    setOpCount((n) => {
      const next = n - 1;
      if (next <= 0) setIsModelRefineGenerating(false);
      return Math.max(0, next);
    });
  }, [setIsModelRefineGenerating]);

  const busy =
    opCount > 0 ||
    editStage !== "idle" ||
    data.faceCloseUp?.status === "generating" ||
    data.backHead?.status === "generating";

  /** Renders one reference shot from a full-body data URL. Returns the image. */
  const runView = useCallback(
    async (view: ModelViewKind, sourceDataUrl: string): Promise<string | undefined> => {
      const { key } = VIEW_META[view];
      const patchView = (v: ModelViewResult): ModelRefinePatch =>
        key === "faceCloseUp" ? { faceCloseUp: v } : { backHead: v };
      onChange(patchView({ status: "generating" }));
      beginOp();
      try {
        const file = dataUrlToFile(sourceDataUrl, "full-body.png");
        const aspectRatio = await imageAspectRatio(file);
        const res =
          imageGenModel === "gpt-image-2"
            ? await generateModelViewImageAzure({
                sourceImage: { file },
                view,
                aspectRatio,
                imageSize: "2K",
              })
            : await generateModelViewImage({
                apiKey,
                sourceImage: { file },
                view,
                aspectRatio,
                imageSize: "2K",
              });
        onChange(
          patchView({
            status: "completed",
            imageData: res.imageData,
            approved: false,
            costBreakdown: { steps: [res.cost], totalCost: res.cost.totalCost },
          })
        );
        return res.imageData;
      } catch (err) {
        onChange(
          patchView({
            status: "error",
            error: err instanceof Error ? err.message : "Generation failed",
          })
        );
        return undefined;
      } finally {
        endOp();
      }
    },
    [apiKey, imageGenModel, onChange, beginOp, endOp]
  );

  const handleGenerateShots = useCallback(() => {
    void runView("face-closeup", data.imageData);
    void runView("back-head", data.imageData);
  }, [runView, data.imageData]);

  const approveView = useCallback(
    (view: ModelViewKind) => {
      const { key } = VIEW_META[view];
      const current = data[key];
      if (!current?.imageData) return;
      const approved: ModelViewResult = { ...current, approved: true };
      onChange(key === "faceCloseUp" ? { faceCloseUp: approved } : { backHead: approved });
    },
    [data, onChange]
  );

  /** Stage 1 — apply the composed directive to the face close-up only. */
  const handleApplyEdit = useCallback(
    async (directive: string, label: string) => {
      const closeUp = data.faceCloseUp?.imageData;
      if (!closeUp || busy) return;
      setEditError(null);
      setEditStage("editing");
      beginOp();
      try {
        const file = dataUrlToFile(closeUp, "face-closeup.png");
        const aspectRatio = await imageAspectRatio(file);
        const instr = await generateModelEditInstruction({
          textGenModel,
          sourceImage: { file },
          changeDirective: directive,
        });
        const res =
          imageGenModel === "gpt-image-2"
            ? await generateModelEditImageAzure({
                editInstruction: instr.editInstruction,
                sourceImage: { file },
                aspectRatio,
                imageSize: "2K",
              })
            : await generateModelEditImage({
                apiKey,
                editInstruction: instr.editInstruction,
                sourceImage: { file },
                aspectRatio,
                imageSize: "2K",
              });
        setPendingEdit({ label, imageData: res.imageData });
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Edit failed");
      } finally {
        endOp();
        setEditStage("idle");
      }
    },
    [data.faceCloseUp, busy, apiKey, textGenModel, imageGenModel, beginOp, endOp]
  );

  /**
   * Stage 2 — the user approved the edited close-up: snapshot the current
   * state into the version history, promote the edit, re-sync the full body
   * from it, then regenerate the back-of-head from the new full body.
   */
  const handleApproveEdit = useCallback(async () => {
    if (!pendingEdit) return;
    const snapshot: ModelVersion = {
      id: uid("mv"),
      label: `Before: ${pendingEdit.label}`,
      createdAt: Date.now(),
      imageData: data.imageData,
      faceCloseUp: data.faceCloseUp?.imageData,
      backHead: data.backHead?.imageData,
    };
    const editedCloseUp = pendingEdit.imageData;
    setPendingEdit(null);
    setEditError(null);
    onChange({
      faceCloseUp: { status: "completed", imageData: editedCloseUp, approved: true },
      versions: [...(data.versions ?? []), snapshot],
    });

    setEditStage("syncing-body");
    beginOp();
    try {
      const bodyFile = dataUrlToFile(data.imageData, "full-body.png");
      const refFile = dataUrlToFile(editedCloseUp, "face-closeup.png");
      const aspectRatio = await imageAspectRatio(bodyFile);
      const res =
        imageGenModel === "gpt-image-2"
          ? await generateModelEditImageAzure({
              editInstruction: FACE_SYNC_INSTRUCTION,
              sourceImage: { file: bodyFile },
              referenceImage: { file: refFile },
              referenceDirective: FACE_SYNC_REFERENCE_DIRECTIVE,
              aspectRatio,
              imageSize: "2K",
            })
          : await generateModelEditImage({
              apiKey,
              editInstruction: FACE_SYNC_INSTRUCTION,
              sourceImage: { file: bodyFile },
              referenceImage: { file: refFile },
              referenceDirective: FACE_SYNC_REFERENCE_DIRECTIVE,
              aspectRatio,
              imageSize: "2K",
            });
      onChange({ imageData: res.imageData });
      setEditStage("syncing-back");
      await runView("back-head", res.imageData);
    } catch (err) {
      setEditError(
        err instanceof Error
          ? `Full-body re-sync failed: ${err.message}`
          : "Full-body re-sync failed"
      );
    } finally {
      endOp();
      setEditStage("idle");
    }
  }, [pendingEdit, data, apiKey, imageGenModel, onChange, runView, beginOp, endOp]);

  /** Restore a version as current; the replaced state is appended to history. */
  const handleRevert = useCallback(
    (v: ModelVersion) => {
      if (busy) return;
      const snapshot: ModelVersion = {
        id: uid("mv"),
        label: `Before revert to "${v.label}"`,
        createdAt: Date.now(),
        imageData: data.imageData,
        faceCloseUp: data.faceCloseUp?.imageData,
        backHead: data.backHead?.imageData,
      };
      onChange({
        imageData: v.imageData,
        faceCloseUp: v.faceCloseUp
          ? { status: "completed", imageData: v.faceCloseUp, approved: true }
          : undefined,
        backHead: v.backHead
          ? { status: "completed", imageData: v.backHead, approved: true }
          : undefined,
        versions: [...(data.versions ?? []), snapshot],
      });
    },
    [busy, data, onChange]
  );

  const handleDownload = useCallback(() => {
    void downloadModelZip({
      name: data.name,
      imageData: data.imageData,
      faceCloseUp: data.faceCloseUp?.imageData,
      backHead: data.backHead?.imageData,
    });
  }, [data]);

  /** Upload an image into a slot as an alternative to generating it. */
  const handleUpload = useCallback(
    (slotKind: "full-body" | ModelViewKind, file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (slotKind === "full-body") {
          onChange({ imageData: dataUrl });
        } else {
          const view: ModelViewResult = { status: "completed", imageData: dataUrl, approved: true };
          onChange(slotKind === "face-closeup" ? { faceCloseUp: view } : { backHead: view });
        }
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

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

  return (
    <div className="space-y-6 rounded-xl border border-border/60 bg-muted/10 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground">{data.name}</h4>
        <div className="flex items-center gap-2">
          {!hasAnyView && (
            <button
              onClick={handleGenerateShots}
              disabled={busy}
              className="btn-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none"
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
              {slot.state?.approved && (
                <Check className="ml-1 inline h-3 w-3 text-emerald-500" />
              )}
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
                    <span className="text-[11px] text-red-500">{slot.state.error}</span>
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
                    onClick={() => approveView(slot.view!)}
                    disabled={busy}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600/90 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Approve
                  </button>
                )}
                {slot.view && slot.state && (
                  <button
                    onClick={() => void runView(slot.view!, data.imageData)}
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
                      if (file) handleUpload(slot.kind, file);
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
              onClick={() => void handleApproveEdit()}
              disabled={busy}
              className="btn-gradient inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Approve & sync all views
            </button>
            <button
              onClick={() => setPendingEdit(null)}
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
      {editError && <p className="text-xs text-red-500">{editError}</p>}

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
        <ModelEditControls disabled={!canEdit || busy} onApply={(d, l) => void handleApplyEdit(d, l)} />
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
                  onClick={() => handleRevert(v)}
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
