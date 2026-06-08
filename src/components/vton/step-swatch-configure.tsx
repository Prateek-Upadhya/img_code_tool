"use client";

import { cn } from "@/lib/utils";
import { SWATCH_SHAPE_OPTIONS, SWATCH_SIZE_OPTIONS } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";

export function StepSwatchConfigure({ store }: { store: VTONStore }) {
  const { swatchShape, setSwatchShape, swatchSize, setSwatchSize } = store;

  return (
    <div className="space-y-6">
      {/* Shape */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Swatch Shape
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose how the extracted swatch should be shaped.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {SWATCH_SHAPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSwatchShape(opt.value)}
              className={cn(
                "rounded-lg border p-4 text-center transition-colors",
                swatchShape === opt.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
            >
              <span className="text-2xl">{opt.icon}</span>
              <p className="text-xs font-medium mt-2">{opt.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Swatch Size
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Output resolution of the extracted swatch (pixels).
        </p>
        <div className="grid grid-cols-4 gap-3">
          {SWATCH_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              onClick={() => setSwatchSize(size)}
              className={cn(
                "rounded-lg border py-3 px-2 text-center transition-colors",
                swatchSize === size
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
            >
              <p className="text-sm font-semibold">{size}px</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {size}x{size}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
