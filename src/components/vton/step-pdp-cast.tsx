"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import { Upload, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  ASPECT_RATIOS,
  PDP_BACKGROUND_OPTIONS,
  PDP_CAST_SOURCE_OPTIONS,
  PDP_IMAGE_SIZE_OPTIONS,
} from "@/lib/constants";
import { resolveBackgroundClause } from "@/lib/pdp-style";
import type { VTONStore } from "@/store/vton-store";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function StepPdpCast({ store }: { store: VTONStore }) {
  const {
    pdpCastSource,
    setPdpCastSource,
    pdpCastDescription,
    setPdpCastDescription,
    pdpCastImages,
    setPdpCastImages,
    pdpBackground,
    setPdpBackground,
    pdpStyle,
    pdpAspectRatio,
    setPdpAspectRatio,
    pdpImageSize,
    setPdpImageSize,
  } = store;

  const inputRef = useRef<HTMLInputElement>(null);

  const addImages = useCallback(
    (files: File[]) => {
      const next = files
        .filter((f) => f.type.startsWith("image/"))
        .map((file) => ({ id: uid("pdp-cast"), file, preview: URL.createObjectURL(file) }));
      if (next.length > 0) setPdpCastImages((prev) => [...prev, ...next]);
    },
    [setPdpCastImages]
  );

  const removeImage = useCallback(
    (id: string) => {
      setPdpCastImages((prev) => {
        const target = prev.find((i) => i.id === id);
        if (target) URL.revokeObjectURL(target.preview);
        return prev.filter((i) => i.id !== id);
      });
    },
    [setPdpCastImages]
  );

  // ORBIT is placeless by definition, so the background choice is not applied there. The
  // control stays visible and says so, rather than disappearing, because the operator may
  // switch styles later and expects their choice to still be there.
  const backgroundApplies = resolveBackgroundClause(pdpStyle, pdpBackground) !== null;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Cast source */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Cast</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Only used by the shot types that show a human model.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PDP_CAST_SOURCE_OPTIONS.map((opt) => {
            const active = pdpCastSource === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setPdpCastSource(opt.value)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all duration-200",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{opt.icon}</span>
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>

        {pdpCastSource === "described" ? (
          <div className="space-y-2">
            <Textarea
              value={pdpCastDescription}
              onChange={(e) => setPdpCastDescription(e.target.value)}
              placeholder="Describe the cast in general terms, for example: fair skinned, Caucasian, mid twenties, athletic build"
              className="min-h-[80px] text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Keep it general. One model is generated per product from this description, with facial
              features and hairstyle varying between products, so the catalogue does not show the
              same face throughout. Within a single product every image shows the same person.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {pdpCastImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative h-24 w-20 overflow-hidden rounded-lg border border-border bg-muted/40"
                >
                  <Image
                    src={img.preview}
                    alt="Cast member"
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute right-1 top-1 rounded bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => inputRef.current?.click()}
                className="flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted/60"
              >
                <Upload className="w-4 h-4" />
                <span className="text-[10px]">Add</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {pdpCastImages.length === 0
                ? "Upload one or more model photos."
                : `${pdpCastImages.length} model${pdpCastImages.length === 1 ? "" : "s"}, cycled across products in order.`}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (inputRef.current) inputRef.current.value = "";
                addImages(files);
              }}
            />
          </div>
        )}
      </section>

      {/* Background treatment */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Background</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Where the footwear sits. The artistic style then decides how that setting is rendered.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PDP_BACKGROUND_OPTIONS.map((opt) => {
            const active = pdpBackground === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setPdpBackground(opt.value)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all duration-200",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{opt.icon}</span>
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
        {!backgroundApplies && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-500">
            The Orbit style is placeless by design, so it renders a single tint field and this
            background choice is not applied. Your selection is kept for if you switch style.
          </p>
        )}
      </section>

      {/* Output */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Output</h3>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Aspect ratio
          </span>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map((ratio) => {
              const active = pdpAspectRatio === ratio.value;
              return (
                <button
                  key={ratio.value}
                  onClick={() => setPdpAspectRatio(ratio.value)}
                  title={ratio.description}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {ratio.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Resolution
          </span>
          <div className="flex flex-wrap gap-2">
            {PDP_IMAGE_SIZE_OPTIONS.map((opt) => {
              const active = pdpImageSize === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setPdpImageSize(opt.value)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "block text-xs font-medium",
                      active ? "text-primary" : "text-foreground"
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">{opt.description}</span>
                </button>
              );
            })}
          </div>
          {pdpImageSize === "1K" && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Users className="mt-px w-3.5 h-3.5 shrink-0" />
              Any shot that carries text is raised to 2K automatically. Small type is the first thing
              to degrade at 1K.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
