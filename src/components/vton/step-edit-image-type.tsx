"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EDIT_TYPE_OPTIONS } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";

interface Props {
  store: VTONStore;
}

export function StepEditImageType({ store }: Props) {
  const { editType, setEditType } = store;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <p className="text-sm text-muted-foreground">
        Choose the nature of the bulk edit. More edit types are on the way.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {EDIT_TYPE_OPTIONS.map((opt) => {
          const selected = editType === opt.id;
          return (
            <button
              key={opt.id}
              disabled={!opt.enabled}
              onClick={() => opt.enabled && setEditType(opt.id)}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-all",
                !opt.enabled && "cursor-not-allowed opacity-60",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : opt.enabled
                    ? "border-border bg-card hover:border-primary/40"
                    : "border-border bg-card"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-2xl">{opt.icon}</span>
                {selected && <Check className="h-4 w-4 text-primary" />}
                {!opt.enabled && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Coming soon
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-foreground">{opt.label}</h4>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
