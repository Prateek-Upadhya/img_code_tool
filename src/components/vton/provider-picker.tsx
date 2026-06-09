"use client";

import { cn } from "@/lib/utils";

/**
 * Reusable provider/model picker rendered as a grid of selectable button-cards.
 *
 * Shared by the Details page and the review/generate page so the text- and
 * image-generation backends can be switched from either location (and a switch
 * before a Retry takes effect). The visual treatment matches the existing
 * selector in `step-output.tsx`.
 */
export interface ProviderOption<V extends string> {
  value: V;
  label: string;
  description: string;
}

interface ProviderPickerProps<V extends string> {
  title: string;
  subtitle?: string;
  options: ProviderOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** When true, render a tighter layout suited to inline rows. */
  compact?: boolean;
}

export function ProviderPicker<V extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
  compact = false,
}: ProviderPickerProps<V>) {
  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div>
        <h3
          className={cn(
            "font-semibold text-foreground",
            compact ? "text-sm" : "text-base"
          )}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "text-left rounded-xl border transition-colors duration-200",
                compact ? "p-3" : "p-4",
                isSelected
                  ? "bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/50 shadow-sm shadow-orange-500/20"
                  : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                    isSelected ? "border-orange-500" : "border-muted-foreground/40"
                  )}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {opt.label}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 pl-6">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
