"use client";

import { useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODEL_EDIT_CATEGORIES } from "@/lib/constants";

interface Props {
  disabled?: boolean;
  /**
   * Fired with the composed change directive, a short human label, and the
   * structured category keys that contributed to it. The keys let the caller
   * tell — deterministically, without sniffing the prose — which attributes the
   * edit is allowed to move (see the skin-tone handling in
   * model-refine-panel.tsx). Freeform-only text contributes no keys.
   */
  onApply: (directive: string, label: string, categoryKeys: string[]) => void;
}

/**
 * Structured + freeform facial-edit controls for the Model Refine step.
 * Selected preset chips and the freeform note compose into ONE change
 * directive fed to the surgical edit pipeline (face close-up first, then the
 * other views re-sync — see model-refine-panel.tsx).
 */
export function ModelEditControls({ disabled, onApply }: Props) {
  // categoryKey -> selected option value (absent = untouched).
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [freeform, setFreeform] = useState("");

  const toggle = (categoryKey: string, value: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[categoryKey] === value) delete next[categoryKey];
      else next[categoryKey] = value;
      return next;
    });
  };

  const { directive, label, categoryKeys } = useMemo(() => {
    const sentences: string[] = [];
    const labelParts: string[] = [];
    const keys: string[] = [];
    for (const cat of MODEL_EDIT_CATEGORIES) {
      const value = selections[cat.key];
      if (!value) continue;
      sentences.push(cat.template.replace("{v}", value));
      const opt = cat.options.find((o) => o.value === value);
      labelParts.push(`${cat.label}: ${opt?.label ?? value}`);
      keys.push(cat.key);
    }
    const extra = freeform.trim();
    if (extra) {
      sentences.push(extra);
      labelParts.push(extra.length > 40 ? `${extra.slice(0, 40)}…` : extra);
    }
    return { directive: sentences.join(" "), label: labelParts.join(" · "), categoryKeys: keys };
  }, [selections, freeform]);

  const canApply = directive.length > 0 && !disabled;

  const handleApply = () => {
    if (!canApply) return;
    onApply(directive, label, categoryKeys);
    setSelections({});
    setFreeform("");
  };

  return (
    <div className="space-y-4">
      {MODEL_EDIT_CATEGORIES.map((cat) => (
        <div key={cat.key} className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {cat.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cat.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggle(cat.key, opt.value)}
                disabled={disabled}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 disabled:pointer-events-none",
                  selections[cat.key] === opt.value
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Anything else
        </p>
        <textarea
          value={freeform}
          onChange={(e) => setFreeform(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="e.g. add a small beauty mark above the lip, softer under-eye area…"
          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 disabled:opacity-50"
        />
      </div>

      <button
        onClick={handleApply}
        disabled={!canApply}
        className="btn-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none"
      >
        <Wand2 className="h-4 w-4" />
        Apply edit to face close-up
      </button>
    </div>
  );
}
