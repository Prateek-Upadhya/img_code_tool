"use client";

import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { VTONStore } from "@/store/vton-store";

interface Props {
  store: VTONStore;
}

export function StepModelEditDirective({ store }: Props) {
  const {
    modelEditDirective,
    setModelEditDirective,
    modelEditReferenceDirective,
    setModelEditReferenceDirective,
    modelEditReference,
    setModelEditReference,
  } = store;

  const inputRef = useRef<HTMLInputElement>(null);
  const hasReference = !!modelEditReference;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* The single change directive */}
      <div className="space-y-2.5">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">What to change</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Describe the ONE attribute to change. Everything else (face, clothing, pose, background,
            lighting, framing) is preserved exactly.
          </p>
        </div>
        <Textarea
          value={modelEditDirective}
          onChange={(e) => setModelEditDirective(e.target.value)}
          rows={3}
          placeholder="e.g. make the model a bit heavier — a fuller body build and slightly rounder face"
          className="resize-y"
        />
      </div>

      <div className="h-px bg-border/60" />

      {/* Optional reference + what to take from it */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Reference image <span className="font-normal text-muted-foreground">· optional</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Attach an image that shows the desired trait, then say exactly what to take from it. Only
            that trait is used — the rest of the reference is ignored.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Reference upload (single) */}
          <div className="w-40 shrink-0">
            {hasReference ? (
              <div className="group relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={modelEditReference!.preview}
                  alt="Reference"
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => setModelEditReference(null)}
                  className="absolute right-2 top-2 rounded-md bg-black/50 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-red-500/90 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/10 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.02] hover:text-primary"
                >
                  <Upload className="h-5 w-5" />
                  <span className="px-2 text-center text-[11px] font-medium leading-tight">
                    Add reference
                    <br />
                    <span className="text-muted-foreground/60">optional</span>
                  </span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setModelEditReference(f);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                />
              </>
            )}
          </div>

          {/* What to take from the reference */}
          <div className="flex-1 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">What to take from the reference</p>
            <Textarea
              value={modelEditReferenceDirective}
              onChange={(e) => setModelEditReferenceDirective(e.target.value)}
              rows={4}
              disabled={!hasReference}
              placeholder={
                hasReference
                  ? "e.g. only the body type & weight distribution"
                  : "Attach a reference image to enable this"
              }
              className="resize-y disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
