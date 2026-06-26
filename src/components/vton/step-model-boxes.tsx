"use client";

import { useRef } from "react";
import { Plus, X, Trash2, Upload, UsersRound, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { VTONStore } from "@/store/vton-store";
import type { ModelBox } from "@/lib/types";

interface Props {
  store: VTONStore;
}

const VARIANTS = [1, 2, 3, 4, 5];

function ReferenceUpload({
  box,
  onSet,
}: {
  box: ModelBox;
  onSet: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (box.referenceImage) {
    return (
      <div className="group relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={box.referenceImage.preview} alt="Face reference" className="h-full w-full object-cover" />
        <button
          onClick={() => onSet(null)}
          className="absolute top-2 right-2 rounded-md bg-black/50 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-red-500/90 group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
          <p className="text-[10px] font-medium text-white/90">Face / hair reference</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/10 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.02] hover:text-primary"
      >
        <Upload className="h-5 w-5" />
        <span className="px-2 text-center text-[11px] font-medium leading-tight">
          Add face reference
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
          if (f) onSet(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </>
  );
}

export function StepModelBoxes({ store }: Props) {
  const { modelBoxes, addModelBox, updateModelBox, removeModelBox, setModelBoxReferenceImage } = store;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
          Each card is one model. Give it a name and a description of the look, optionally add a face
          reference, and choose how many variant images to generate (1–5).
        </p>
        <button
          onClick={addModelBox}
          className="btn-gradient inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Add model
        </button>
      </div>

      {modelBoxes.length === 0 && (
        <button
          onClick={addModelBox}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-16 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.02] hover:text-primary"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
            <UsersRound className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Create your first model</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a model card to get started</p>
          </div>
        </button>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {modelBoxes.map((box, i) => (
          <div key={box.id} className="rounded-2xl border border-border bg-card/60 p-5">
            <div className="flex gap-4">
              <div className="w-28 shrink-0">
                <ReferenceUpload box={box} onSet={(f) => setModelBoxReferenceImage(box.id, f)} />
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={box.name}
                    onChange={(e) => updateModelBox(box.id, { name: e.target.value })}
                    placeholder={`Model ${i + 1} name`}
                    className="h-9 font-medium"
                  />
                  <button
                    onClick={() => removeModelBox(box.id)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                    title="Remove model"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <Textarea
                  value={box.description}
                  onChange={(e) => updateModelBox(box.id, { description: e.target.value })}
                  rows={3}
                  placeholder="Describe the look: face, hair, vibe, distinctive features…"
                  className="resize-y text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Variants</span>
                <div className="flex items-center gap-1">
                  {VARIANTS.map((v) => (
                    <button
                      key={v}
                      onClick={() => updateModelBox(box.id, { variantCount: v })}
                      className={cn(
                        "h-7 w-7 rounded-lg text-xs font-semibold transition-all",
                        box.variantCount === v
                          ? "bg-foreground text-background shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {box.referenceImage && (
                <button
                  onClick={() => updateModelBox(box.id, { lockToReferenceFace: !box.lockToReferenceFace })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    box.lockToReferenceFace
                      ? "border-foreground/30 bg-foreground/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                  title={
                    box.lockToReferenceFace
                      ? "Same reference face on every variant"
                      : "Reference guides loosely; each variant gets a distinct face"
                  }
                >
                  {box.lockToReferenceFace ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {box.lockToReferenceFace ? "Lock face to reference" : "Distinct face per variant"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
