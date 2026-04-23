"use client";

import { Textarea } from "@/components/ui/textarea";
import type { VTONStore } from "@/store/vton-store";

interface StepDetailsProps {
  store: VTONStore;
}

export function StepDetails({ store }: StepDetailsProps) {
  const { additionalInfo, setAdditionalInfo } = store;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4 transition-colors hover:shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Additional Instructions
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Any extra details or preferences for the generation
          </p>
        </div>
        <Textarea
          placeholder="e.g., 'Make the lighting warm and golden', 'Focus on the embroidery details', 'Lifestyle look with natural movement', 'High-end editorial style photography'..."
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          rows={4}
          className="resize-none rounded-lg border-border bg-muted/30 focus:bg-background transition-colors"
        />
      </div>
    </div>
  );
}
