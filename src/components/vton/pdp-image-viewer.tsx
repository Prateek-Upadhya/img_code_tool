"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * Full-screen viewer for one generated image, with the correction loop attached.
 *
 * Deliberately a hand-rolled `fixed inset-0` overlay rather than a Radix Dialog, matching
 * the expanded views in `infographic-editor.tsx`. Two reasons: the image wants the whole
 * viewport rather than a `max-w` box, and the Esc handler has to run in the CAPTURE phase
 * so closing the viewer does not also close whatever dialog might be beneath it.
 *
 * A correction produces a CANDIDATE shown beside the current image. It replaces the
 * original only when approved, because a correction can easily make things worse and the
 * original is expensive to recover.
 */
export function PdpImageViewer({
  result,
  imageData,
  busy,
  onClose,
  onRetry,
  onDownload,
  onCorrect,
  onApprove,
  onDiscard,
}: {
  result: PdpResult;
  /** Full-size image for the current version, read from the store by the caller. */
  imageData: string | null;
  /** True while a correction or retry is in flight for this result. */
  busy: boolean;
  onClose: () => void;
  onRetry: () => void;
  onDownload: () => void;
  onCorrect: (text: string, attachments: PdpCorrectionAttachment[]) => void;
  onApprove: () => void;
  onDiscard: () => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PdpCorrectionAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const candidate = result.candidate;

  // Capture phase, or Radix eats the key and closes the wizard dialog behind this.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Object URLs are created here, so they are revoked here.
  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {result.sku} · {result.optionLabel}
          </p>
          {result.corrections && result.corrections.length > 0 && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <History className="h-3 w-3" />
              {result.corrections.length} correction
              {result.corrections.length === 1 ? "" : "s"} applied
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-xs"
            onClick={onRetry}
            disabled={busy}
          >
            <RotateCw className="h-3.5 w-3.5" />
            Retry
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Close
          </Button>
        </div>
      </div>

      {/* Image area: one pane normally, two when a candidate is awaiting a decision */}
      <div className="flex min-h-0 flex-1 items-center justify-center gap-4 p-5">
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
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Footer: approve/discard when a candidate exists, otherwise the correction form */}
      <div className="shrink-0 border-t border-border bg-background/80 px-5 py-3">
        {candidate ? (
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Applied: <span className="text-foreground">{candidate.correction}</span>
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={onDiscard}>
                <Undo2 className="h-3.5 w-3.5" />
                Discard
              </Button>
              <button
                onClick={approve}
                className="btn-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
              >
                <Check className="h-4 w-4" />
                Approve
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Describe the change. Only that change is applied, everything else stays as it is.
                </p>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Move the seal to the bottom right and make it a little smaller"
                  className="min-h-[60px] text-sm"
                  disabled={busy}
                />
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-lg"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Attach
                </Button>
                <button
                  onClick={submit}
                  disabled={!text.trim() || busy}
                  className="btn-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Apply
                </button>
              </div>
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

            <p className={cn("text-[11px] text-muted-foreground/70", busy && "text-primary")}>
              {busy ? "Working on the correction..." : "Press Esc to close."}
            </p>
          </div>
        )}
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
    </div>
  );
}
