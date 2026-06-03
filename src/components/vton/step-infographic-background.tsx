"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INFOGRAPHIC_BACKGROUND_OPTIONS } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";

export function StepInfographicBackground({ store }: { store: VTONStore }) {
  const { infographicBackgroundStyle, setInfographicBackgroundStyle } = store;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h3 className="text-sm font-medium text-foreground">Background style</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          The enrichment model derives concrete colors that contrast the footwear, keeping lighting, shadow and gradient direction in sync.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INFOGRAPHIC_BACKGROUND_OPTIONS.map((opt) => {
          const isActive = infographicBackgroundStyle === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setInfographicBackgroundStyle(opt.value)}
              className={cn(
                "text-left rounded-xl border p-4 transition-all duration-200 relative",
                isActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              {isActive && (
                <span className="absolute top-3 right-3 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{opt.icon}</span>
                <div className="min-w-0 pr-6">
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
