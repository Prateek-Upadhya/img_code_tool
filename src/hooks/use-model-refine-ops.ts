"use client";

import { useCallback, useRef, useState } from "react";
import {
  generateModelViewImage,
  generateModelEditInstruction,
  generateModelEditImage,
} from "@/lib/gemini";
import { generateModelViewImageAzure, generateModelEditImageAzure } from "@/lib/azure-image";
import { dataUrlToFile, imageAspectRatio } from "@/lib/model-creation-client";
import type { VTONStore } from "@/store/vton-store";
import type { ModelAgeGroup, ModelVersion, ModelViewKind, ModelViewResult } from "@/lib/types";

/** The refine-able slice of a ModelCreationResult or SavedModel. */
export interface ModelRefineData {
  name: string;
  /** Full-body image as a data URL. */
  imageData: string;
  /**
   * Life stage of the subject, driving `personGeneration` and the age-appropriate
   * texture anchor on every refine render. Optional so pre-existing library
   * entries without an age still load; those fall back to adult.
   */
  ageGroup?: ModelAgeGroup;
  faceCloseUp?: ModelViewResult;
  backHead?: ModelViewResult;
  versions?: ModelVersion[];
}

export type ModelRefinePatch = Partial<
  Pick<ModelRefineData, "imageData" | "faceCloseUp" | "backHead" | "versions">
>;

/** One refine-able model: a stable key plus its current data. */
export interface RefineTargetLike {
  key: string;
  data: ModelRefineData;
}

/** Transient per-model state that is NOT persisted with the model itself. */
export interface RefineOpState {
  /** Stage-1 edit output awaiting the user's approve / discard decision. */
  pendingEdit?: { label: string; imageData: string };
  editStage: "idle" | "editing" | "syncing-body" | "syncing-back";
  editError?: string;
  /** In-flight render count for this model. >0 means the model is busy. */
  opCount: number;
}

const IDLE: RefineOpState = { editStage: "idle", opCount: 0 };

/**
 * What the full body must copy from an edited face close-up on re-sync.
 * Complexion is included deliberately: the close-up is the identity source of
 * truth, so a skin-tone edit there has to travel to the body — otherwise a
 * re-toned head ends up on a body still at the old shade. The image prompt's
 * companion clause (MODEL_EDIT_COMPLEXION_SYNC_CLAUSE) spells out the full skin
 * inventory; this names the intent.
 */
const FACE_SYNC_INSTRUCTION =
  "the model's face, facial features, skin tone and complexion, hairstyle, hair color and makeup exactly match the REFERENCE image, with that complexion carried evenly across every area of exposed skin on the whole body";
const FACE_SYNC_REFERENCE_DIRECTIVE =
  "the face, skin tone and complexion, hairstyle, hair color and makeup";

export const VIEW_META: Record<ModelViewKind, { key: "faceCloseUp" | "backHead"; title: string }> = {
  "face-closeup": { key: "faceCloseUp", title: "Face close-up" },
  "back-head": { key: "backHead", title: "Back of head" },
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** True when the throw was caused by the user pressing Stop rather than a real failure. */
function wasCancelled(signal: AbortSignal): boolean {
  return signal.aborted;
}

/**
 * The refine pipeline — reference-shot rendering, the two-stage facial edit, and
 * the approve/re-sync chain — lifted out of `ModelRefinePanel` so BOTH a single
 * model's own buttons and the step-level batch toolbar drive the exact same code.
 *
 * Every operation is keyed by model, so N models can run concurrently without
 * their busy state, errors or pending edits colliding. Each user action mints ONE
 * AbortController shared by all of its sub-calls (see `beginModelRefineOp`), which
 * is what makes per-model Stop work: stopping model A leaves model B running.
 */
export function useModelRefineOps({
  store,
  patch,
}: {
  store: VTONStore;
  /** Writes a patch back to the backing ModelCreationResult or SavedModel. */
  patch: (key: string, p: ModelRefinePatch) => void;
}) {
  const { apiKey, textGenModel, imageGenModel, setModelRefineBusy, beginModelRefineOp } = store;

  const [opStates, setOpStates] = useState<Record<string, RefineOpState>>({});

  // Mirror of opStates' counters, readable synchronously. Two ops on the same
  // model can start in the same tick (the two reference shots), and a functional
  // setState cannot be read back in time to report busy correctly.
  const counts = useRef<Map<string, number>>(new Map());

  const patchOp = useCallback((key: string, p: Partial<RefineOpState>) => {
    setOpStates((prev) => ({ ...prev, [key]: { ...IDLE, ...prev[key], ...p } }));
  }, []);

  const beginOp = useCallback(
    (key: string) => {
      const n = (counts.current.get(key) ?? 0) + 1;
      counts.current.set(key, n);
      patchOp(key, { opCount: n });
      setModelRefineBusy(key, true);
    },
    [patchOp, setModelRefineBusy]
  );

  const endOp = useCallback(
    (key: string) => {
      const n = Math.max(0, (counts.current.get(key) ?? 0) - 1);
      counts.current.set(key, n);
      patchOp(key, { opCount: n });
      if (n === 0) setModelRefineBusy(key, false);
    },
    [patchOp, setModelRefineBusy]
  );

  const getOpState = useCallback((key: string): RefineOpState => opStates[key] ?? IDLE, [opStates]);

  const isBusy = useCallback((key: string) => (counts.current.get(key) ?? 0) > 0, []);

  /**
   * Renders one reference shot from a full-body data URL and returns the image.
   * `signal` is supplied by the caller, never minted here: `generateShots` fires
   * two of these concurrently and both must share one controller, or Stop would
   * only ever cancel the second.
   */
  const runView = useCallback(
    async (
      target: RefineTargetLike,
      view: ModelViewKind,
      sourceDataUrl: string,
      signal: AbortSignal
    ): Promise<string | undefined> => {
      const { key: slot } = VIEW_META[view];
      const patchView = (v: ModelViewResult) =>
        patch(target.key, slot === "faceCloseUp" ? { faceCloseUp: v } : { backHead: v });

      patchView({ status: "generating" });
      beginOp(target.key);
      try {
        const file = dataUrlToFile(sourceDataUrl, "full-body.png");
        const aspectRatio = await imageAspectRatio(file);
        if (signal.aborted) throw new Error("aborted");
        const res =
          imageGenModel === "gpt-image-2"
            ? await generateModelViewImageAzure({
                sourceImage: { file },
                view,
                ageGroup: target.data.ageGroup,
                aspectRatio,
                imageSize: "2K",
                signal,
              })
            : await generateModelViewImage({
                apiKey,
                sourceImage: { file },
                view,
                ageGroup: target.data.ageGroup,
                aspectRatio,
                imageSize: "2K",
                abortSignal: signal,
              });
        patchView({
          status: "completed",
          imageData: res.imageData,
          approved: false,
          costBreakdown: { steps: [res.cost], totalCost: res.cost.totalCost },
        });
        return res.imageData;
      } catch (err) {
        // ModelViewResult has no "cancelled" status, so a cancel is surfaced as
        // an error with distinct copy. The slot's Regenerate button is already
        // shown for errors, so recovery works unchanged.
        patchView({
          status: "error",
          error: wasCancelled(signal)
            ? "Cancelled"
            : err instanceof Error
              ? err.message
              : "Generation failed",
        });
        return undefined;
      } finally {
        endOp(target.key);
      }
    },
    [apiKey, imageGenModel, patch, beginOp, endOp]
  );

  /** Both reference shots for one model, under a single shared controller. */
  const generateShots = useCallback(
    async (target: RefineTargetLike) => {
      const { signal } = beginModelRefineOp(target.key);
      await Promise.all([
        runView(target, "face-closeup", target.data.imageData, signal),
        runView(target, "back-head", target.data.imageData, signal),
      ]);
    },
    [beginModelRefineOp, runView]
  );

  /** Re-render a single view slot. */
  const regenerateView = useCallback(
    async (target: RefineTargetLike, view: ModelViewKind) => {
      const { signal } = beginModelRefineOp(target.key);
      await runView(target, view, target.data.imageData, signal);
    },
    [beginModelRefineOp, runView]
  );

  /**
   * Stage 1 — apply the composed directive to the face close-up only. The result
   * lands in `pendingEdit` for the user to approve or discard.
   */
  const applyEdit = useCallback(
    async (
      target: RefineTargetLike,
      directive: string,
      label: string,
      categoryKeys: string[] = []
    ) => {
      const closeUp = target.data.faceCloseUp?.imageData;
      if (!closeUp || isBusy(target.key)) return;
      // A complexion edit has to be exempted from the "preserve skin tone" rule,
      // or the preservation clause cancels the very change requested. Driven off
      // the structured selection, so there is no text sniffing.
      const releaseSkinTone = categoryKeys.includes("skin-tone");
      const { signal } = beginModelRefineOp(target.key);

      patchOp(target.key, { editError: undefined, editStage: "editing" });
      beginOp(target.key);
      try {
        const file = dataUrlToFile(closeUp, "face-closeup.png");
        const aspectRatio = await imageAspectRatio(file);
        if (signal.aborted) throw new Error("aborted");
        const instr = await generateModelEditInstruction({
          textGenModel,
          sourceImage: { file },
          changeDirective: directive,
          abortSignal: signal,
        });
        const res =
          imageGenModel === "gpt-image-2"
            ? await generateModelEditImageAzure({
                editInstruction: instr.editInstruction,
                sourceImage: { file },
                releaseSkinTone,
                ageGroup: target.data.ageGroup,
                aspectRatio,
                imageSize: "2K",
                signal,
              })
            : await generateModelEditImage({
                apiKey,
                editInstruction: instr.editInstruction,
                sourceImage: { file },
                releaseSkinTone,
                ageGroup: target.data.ageGroup,
                aspectRatio,
                imageSize: "2K",
                abortSignal: signal,
              });
        patchOp(target.key, { pendingEdit: { label, imageData: res.imageData } });
      } catch (err) {
        patchOp(target.key, {
          editError: wasCancelled(signal)
            ? "Cancelled"
            : err instanceof Error
              ? err.message
              : "Edit failed",
        });
      } finally {
        endOp(target.key);
        patchOp(target.key, { editStage: "idle" });
      }
    },
    [
      apiKey,
      textGenModel,
      imageGenModel,
      isBusy,
      beginModelRefineOp,
      patchOp,
      beginOp,
      endOp,
    ]
  );

  /**
   * Stage 2 — the user approved the edited close-up: snapshot the current state
   * into the version history, promote the edit, re-sync the full body from it,
   * then regenerate the back-of-head from the new full body.
   */
  const approveEdit = useCallback(
    async (target: RefineTargetLike) => {
      const pendingEdit = (opStates[target.key] ?? IDLE).pendingEdit;
      if (!pendingEdit) return;
      const { data } = target;

      const snapshot: ModelVersion = {
        id: uid("mv"),
        label: `Before: ${pendingEdit.label}`,
        createdAt: Date.now(),
        imageData: data.imageData,
        faceCloseUp: data.faceCloseUp?.imageData,
        backHead: data.backHead?.imageData,
      };
      const editedCloseUp = pendingEdit.imageData;
      patchOp(target.key, { pendingEdit: undefined, editError: undefined });
      patch(target.key, {
        faceCloseUp: { status: "completed", imageData: editedCloseUp, approved: true },
        versions: [...(data.versions ?? []), snapshot],
      });

      // One controller across the body re-sync AND the nested back-of-head
      // render, so Stop cancels the whole chain rather than half of it.
      const { signal } = beginModelRefineOp(target.key);
      patchOp(target.key, { editStage: "syncing-body" });
      beginOp(target.key);
      try {
        const bodyFile = dataUrlToFile(data.imageData, "full-body.png");
        const refFile = dataUrlToFile(editedCloseUp, "face-closeup.png");
        const aspectRatio = await imageAspectRatio(bodyFile);
        if (signal.aborted) throw new Error("aborted");
        const res =
          imageGenModel === "gpt-image-2"
            ? await generateModelEditImageAzure({
                editInstruction: FACE_SYNC_INSTRUCTION,
                sourceImage: { file: bodyFile },
                referenceImage: { file: refFile },
                referenceDirective: FACE_SYNC_REFERENCE_DIRECTIVE,
                identityFromReference: true,
                ageGroup: data.ageGroup,
                aspectRatio,
                imageSize: "2K",
                signal,
              })
            : await generateModelEditImage({
                apiKey,
                editInstruction: FACE_SYNC_INSTRUCTION,
                sourceImage: { file: bodyFile },
                referenceImage: { file: refFile },
                referenceDirective: FACE_SYNC_REFERENCE_DIRECTIVE,
                identityFromReference: true,
                ageGroup: data.ageGroup,
                aspectRatio,
                imageSize: "2K",
                abortSignal: signal,
              });
        patch(target.key, { imageData: res.imageData });
        patchOp(target.key, { editStage: "syncing-back" });
        await runView(target, "back-head", res.imageData, signal);
      } catch (err) {
        patchOp(target.key, {
          editError: wasCancelled(signal)
            ? "Cancelled during the full-body re-sync"
            : err instanceof Error
              ? `Full-body re-sync failed: ${err.message}`
              : "Full-body re-sync failed",
        });
      } finally {
        endOp(target.key);
        patchOp(target.key, { editStage: "idle" });
      }
    },
    [
      apiKey,
      imageGenModel,
      opStates,
      patch,
      patchOp,
      beginOp,
      endOp,
      beginModelRefineOp,
      runView,
    ]
  );

  const discardEdit = useCallback(
    (key: string) => patchOp(key, { pendingEdit: undefined }),
    [patchOp]
  );

  /** Restore a version as current; the replaced state is appended to history. */
  const revertTo = useCallback(
    (target: RefineTargetLike, v: ModelVersion) => {
      if (isBusy(target.key)) return;
      const { data } = target;
      const snapshot: ModelVersion = {
        id: uid("mv"),
        label: `Before revert to "${v.label}"`,
        createdAt: Date.now(),
        imageData: data.imageData,
        faceCloseUp: data.faceCloseUp?.imageData,
        backHead: data.backHead?.imageData,
      };
      patch(target.key, {
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
    [isBusy, patch]
  );

  /** Accept a view as final (the approve/regenerate loop). */
  const approveView = useCallback(
    (target: RefineTargetLike, view: ModelViewKind) => {
      const { key: slot } = VIEW_META[view];
      const current = target.data[slot];
      if (!current?.imageData) return;
      const approved: ModelViewResult = { ...current, approved: true };
      patch(target.key, slot === "faceCloseUp" ? { faceCloseUp: approved } : { backHead: approved });
    },
    [patch]
  );

  /** Replace a slot from an uploaded file instead of generating it. */
  const uploadInto = useCallback(
    (key: string, slotKind: "full-body" | ModelViewKind, file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (slotKind === "full-body") {
          patch(key, { imageData: dataUrl });
        } else {
          const view: ModelViewResult = { status: "completed", imageData: dataUrl, approved: true };
          patch(key, slotKind === "face-closeup" ? { faceCloseUp: view } : { backHead: view });
        }
      };
      reader.readAsDataURL(file);
    },
    [patch]
  );

  return {
    opStates,
    getOpState,
    isBusy,
    generateShots,
    regenerateView,
    applyEdit,
    approveEdit,
    discardEdit,
    revertTo,
    approveView,
    uploadInto,
  };
}
