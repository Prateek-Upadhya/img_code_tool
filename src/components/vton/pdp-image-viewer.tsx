"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Wand2,
  Loader2,
  Download,
  RotateCw,
  Upload,
  Check,
  Undo2,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PdpResult } from "@/lib/types";

export interface PdpCorrectionAttachment {
  id: string;
  file: File;
  preview: string;
}

/**
 * Review modal for one product's generated images, with the correction loop attached.
 *
 * Laid out as TWO COLUMNS rather than as a vertical stack. The stack put the correction
 * box below the image, so on a tall image the operator had to scroll to reach the one
 * control they opened the viewer to use. Here the image owns the left column and the
 * correction form owns a fixed width right column, so the box is on screen the moment the
 * modal opens whatever shape the image is.
 *
 * Navigation is SCOPED TO ONE PRODUCT. Opening any image of a product puts every image of
 * that product within reach, by arrow key, by the edge buttons or by the filmstrip, so a
 * whole product can be reviewed and corrected without leaving. Moving to a different
 * product means closing and opening one of its images, which is what keeps a review
 * session anchored to the thing being reviewed.
 *
 * Still a hand-rolled overlay rather than a Radix Dialog, matching `infographic-editor.tsx`:
 * the image wants the viewport rather than a `max-w` box, and the Esc handler has to run
 * in the CAPTURE phase so closing this does not also close the wizard dialog beneath it.
 *
 * A correction produces a CANDIDATE shown beside the current image. It replaces the
 * original only when approved, because a correction can easily make things worse and the
 * original is expensive to recover.
 *
 * MOUNT THIS WITH `key={result.id}`. The correction text and its attachments belong to the
 * image they were written for, and remounting is what clears them on navigation. Carrying
 * a half-typed note across to the next image would be a quiet way to apply it to the wrong
 * one, and the unmount cleanup is also what revokes the attachment object URLs.
 */
export function PdpImageViewer({
  result,
  siblings,
  imageData,
  busy,
  onClose,
  onSelect,
  onRetry,
  onDownload,
  onCorrect,
  onApprove,
  onDiscard,
}: {
  result: PdpResult;
  /** Every viewable image of THIS product, in catalog order. Includes `result`. */
  siblings: PdpResult[];
  /** Full-size image for the current version, read from the store by the caller. */
  imageData: string | null;
  /** True while a correction or retry is in flight for this result. */
  busy: boolean;
  onClose: () => void;
  /** Move the viewer to another image of the same product. */
  onSelect: (result: PdpResult) => void;
  onRetry: () => void;
  onDownload: () => void;
  onCorrect: (text: string, attachments: PdpCorrectionAttachment[]) => void;
  onApprove: () => void;
  onDiscard: () => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PdpCorrectionAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const candidate = result.candidate;

  const index = siblings.findIndex((s) => s.id === result.id);
  const position = index >= 0 ? index : 0;
  const canPrev = siblings.length > 1;
  const canNext = siblings.length > 1;

  /** Wraps, so a long product set can be walked in either direction without stopping. */
  const step = useCallback(
    (delta: number) => {
      if (siblings.length < 2) return;
      const next = siblings[(position + delta + siblings.length) % siblings.length];
      if (next && next.id !== result.id) onSelect(next);
    },
    [siblings, position, result.id, onSelect]
  );

  // Revoke whatever is still held when the modal itself goes away. Mirrored into a ref
  // through an effect rather than assigned during render, so the unmount cleanup sees the
  // current list instead of closing over the empty one it started with.
  const attachmentsRef = useRef<PdpCorrectionAttachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.preview));
    };
  }, []);

  /**
   * Keep the active thumbnail in view when navigating by key or by edge button.
   *
   * Scrolls the strip itself rather than calling `scrollIntoView` on the thumbnail.
   * `scrollIntoView` walks up and scrolls EVERY scrollable ancestor, the document
   * included, so it moved the page behind the modal on every navigation.
   */
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>("[data-active='true']");
    if (!strip || !active) return;
    const target = active.offsetLeft - (strip.clientWidth - active.clientWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [result.id]);

  /**
   * Hold the page still underneath.
   *
   * With nothing locked, a wheel over the modal chains through to the results page and
   * moves it behind the backdrop. The previous value is restored rather than cleared, so
   * an overlay opened above another cannot leave the page permanently unscrollable.
   */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Capture phase, or Radix eats the key and closes the wizard dialog behind this.
        e.stopPropagation();
        onClose();
        return;
      }
      // Arrows must stay ordinary arrows while the operator is writing a correction,
      // otherwise moving the caret would jump to a different image mid sentence.
      const el = document.activeElement;
      const typing =
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLInputElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowLeft") {
        e.stopPropagation();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.stopPropagation();
        step(1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, step]);

  const addFiles = useCallback((files: File[]) => {
    const next = files
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
      }));
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const submit = useCallback(() => {
    if (!text.trim() || busy) return;
    onCorrect(text.trim(), attachments);
  }, [text, attachments, busy, onCorrect]);

  const approve = useCallback(() => {
    onApprove();
    setText("");
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });
  }, [onApprove]);

  // Portalled to the body, and this is not cosmetic. The PDP step's root carries
  // `animate-fade-in-up`, whose fill-mode leaves a permanent `transform: translateY(0)` on
  // it. An element with any transform other than `none` becomes the containing block for
  // its `position: fixed` descendants, so rendered in place this overlay sized itself to
  // the whole results page instead of to the viewport: a modal as long as the run, that
  // had to be scrolled to read. The portal takes it out of that ancestor entirely.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="flex h-[80vh] w-[80vw] max-w-[1200px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        {/* ── Left: the image, its navigation and the product's filmstrip ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 items-center justify-center gap-4 p-4">
            {candidate ? (
              <>
                <figure className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
                  <figcaption className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Current
                  </figcaption>
                  {imageData && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageData}
                      alt="Current"
                      className="min-h-0 max-w-full flex-1 rounded-lg object-contain opacity-70"
                    />
                  )}
                </figure>
                <figure className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
                  <figcaption className="text-[11px] font-medium uppercase tracking-wider text-primary">
                    Candidate
                  </figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={candidate.imageData}
                    alt="Candidate"
                    className="min-h-0 max-w-full flex-1 rounded-lg object-contain shadow-2xl ring-2 ring-primary/40"
                  />
                </figure>
              </>
            ) : imageData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageData}
                alt={result.optionLabel}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}

            {canPrev && (
              <button
                onClick={() => step(-1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/85 p-2 text-foreground shadow-lg transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {canNext && (
              <button
                onClick={() => step(1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/85 p-2 text-foreground shadow-lg transition-colors hover:bg-muted"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Filmstrip: every image of THIS product, so a whole product can be reviewed
              in one sitting without returning to the grid. */}
          {siblings.length > 1 && (
            <div
              ref={stripRef}
              className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-border px-4 py-2.5"
            >
              {siblings.map((s) => (
                <button
                  key={s.id}
                  data-active={s.id === result.id}
                  onClick={() => s.id !== result.id && onSelect(s)}
                  title={s.optionLabel}
                  className={cn(
                    "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border transition-all",
                    s.id === result.id
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border opacity-60 hover:opacity-100"
                  )}
                >
                  {s.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.thumbnail} alt={s.optionLabel} className="h-full w-full object-cover" />
                  )}
                  {s.candidate && (
                    <span
                      className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
                      title="Has a candidate awaiting a decision"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: everything the operator acts with, always on screen ── */}
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-border bg-muted/20">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{result.sku}</p>
              <p className="truncate text-xs text-muted-foreground">{result.optionLabel}</p>
              {siblings.length > 1 && (
                <p className="mt-1 text-[11px] tabular-nums text-muted-foreground/80">
                  {position + 1} of {siblings.length} in this product
                </p>
              )}
              {result.corrections && result.corrections.length > 0 && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <History className="h-3 w-3" />
                  {result.corrections.length} correction
                  {result.corrections.length === 1 ? "" : "s"} applied
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 rounded-lg p-0"
              onClick={onClose}
              aria-label="Close preview"
              title="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {candidate ? (
              <>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                    Candidate ready
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Applied: <span className="text-foreground">{candidate.correction}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={approve}
                    className="btn-gradient inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={onDiscard}>
                    <Undo2 className="h-3.5 w-3.5" />
                    Discard
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-foreground">Suggest a fix</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Describe the change. Only that change is applied, everything else stays as it
                    is.
                  </p>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. Move the seal to the bottom right and make it a little smaller"
                    className="min-h-[110px] text-sm"
                    disabled={busy}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 rounded-lg"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Attach
                  </Button>
                  <button
                    onClick={submit}
                    disabled={!text.trim() || busy}
                    className="btn-gradient inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:pointer-events-none disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    Apply
                  </button>
                </div>

                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((a) => (
                      <div
                        key={a.id}
                        className="group relative h-12 w-12 overflow-hidden rounded border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.preview} alt="Attachment" className="h-full w-full object-cover" />
                        <button
                          onClick={() => removeAttachment(a.id)}
                          className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Remove attachment"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="mt-auto space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 rounded-lg text-xs"
                  onClick={onDownload}
                >
                  <Download className="h-3.5 w-3.5" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 rounded-lg text-xs"
                  onClick={onRetry}
                  disabled={busy}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
              <p className={cn("text-[11px] text-muted-foreground/70", busy && "text-primary")}>
                {busy
                  ? "Working on the correction..."
                  : siblings.length > 1
                  ? "Arrow keys move through this product. Esc closes."
                  : "Press Esc to close."}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (fileRef.current) fileRef.current.value = "";
          addFiles(files);
        }}
      />
    </div>,
    document.body
  );
}
