"use client";

import { Minus, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INFOGRAPHIC_TEMPLATE_OPTIONS,
  INFOGRAPHIC_IMAGE_SIZE_OPTIONS,
  ASPECT_RATIOS,
} from "@/lib/constants";
import { Textarea } from "@/components/ui/textarea";
import type { VTONStore } from "@/store/vton-store";

const MAX_VARIATIONS = 6;

export function StepInfographicTemplate({ store }: { store: VTONStore }) {
  const {
    infographicTemplateCounts,
    setInfographicTemplateCount,
    infographicAspectRatio,
    setInfographicAspectRatio,
    infographicImageSize,
    setInfographicImageSize,
    infographicStylingInstructions,
    setInfographicStylingInstructions,
    infographicFolders,
  } = store;

  const totalPerProduct = Object.values(infographicTemplateCounts).reduce((a, b) => a + b, 0);
  const productCount = infographicFolders.filter((f) => f.images.length > 0).length;
  const totalGenerations = totalPerProduct * productCount;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Templates with variation counts */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Templates &amp; variations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick how many variations of each template to generate per product. Variations differ subtly in background, footwear orientation and iconography.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INFOGRAPHIC_TEMPLATE_OPTIONS.map((opt) => {
            const count = infographicTemplateCounts[opt.value] ?? 0;
            const isActive = count > 0;
            return (
              <div
                key={opt.value}
                className={cn(
                  "rounded-xl border p-4 transition-all duration-200",
                  isActive ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none">{opt.icon}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
                  <span className="text-xs font-medium text-muted-foreground">Variations per product</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInfographicTemplateCount(opt.value, Math.max(0, count - 1))}
                      disabled={count <= 0}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-border text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{count}</span>
                    <button
                      onClick={() => setInfographicTemplateCount(opt.value, Math.min(MAX_VARIATIONS, count + 1))}
                      disabled={count >= MAX_VARIATIONS}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-border text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalPerProduct > 0 && (
          <p className="text-xs text-muted-foreground">
            {totalPerProduct} infographic{totalPerProduct === 1 ? "" : "s"} per product
            {productCount > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground">{totalGenerations}</span> total across {productCount} product
                {productCount === 1 ? "" : "s"}
              </>
            )}
          </p>
        )}
      </section>

      {/* Aspect ratio */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Aspect ratio</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Applied to every generated infographic.</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {ASPECT_RATIOS.map((ar) => {
            const isActive = infographicAspectRatio === ar.value;
            return (
              <button
                key={ar.value}
                onClick={() => setInfographicAspectRatio(ar.value)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-center transition-all duration-200",
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <div className="text-sm font-medium text-foreground">{ar.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{ar.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Resolution */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Resolution</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {INFOGRAPHIC_IMAGE_SIZE_OPTIONS.map((opt) => {
            const isActive = infographicImageSize === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setInfographicImageSize(opt.value)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-center transition-all duration-200 relative",
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                {isActive && (
                  <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
                <div className="text-sm font-medium text-foreground">{opt.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{opt.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Global styling */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Global styling instructions <span className="text-muted-foreground font-normal">(optional)</span></h3>
          <p className="text-xs text-muted-foreground mt-0.5">Applied to every generation — e.g. a consistent color accent, mood or typographic style.</p>
        </div>
        <Textarea
          value={infographicStylingInstructions}
          onChange={(e) => setInfographicStylingInstructions(e.target.value)}
          placeholder="e.g. Premium athletic look, cool color accents, bold sans-serif headings, lots of negative space."
          className="min-h-[90px] text-sm resize-y"
        />
      </section>
    </div>
  );
}
