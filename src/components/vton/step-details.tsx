"use client";

import { AlertCircle, KeyRound } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { VTONStore } from "@/store/vton-store";

interface StepDetailsProps {
  store: VTONStore;
}

export function StepDetails({ store }: StepDetailsProps) {
  const { additionalInfo, setAdditionalInfo, featureMode, apiKey } = store;
  const isModelSwap = featureMode === "model-swap";
  const hasEnvKey = apiKey.length > 0;

  return (
    <div className="space-y-6">
      {isModelSwap && (
        <div
          className={cn(
            "rounded-xl border p-4 flex items-start gap-3 transition-colors",
            hasEnvKey
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          )}
        >
          {hasEnvKey ? (
            <KeyRound className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <div className="space-y-0.5">
            <p
              className={cn(
                "text-sm font-medium",
                hasEnvKey
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-amber-700 dark:text-amber-300"
              )}
            >
              {hasEnvKey
                ? "Powered by Vertex AI (server-side credentials)"
                : "Vertex AI is not configured"}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasEnvKey
                ? "Model Swap runs on Vertex AI using credentials configured on the server — no API key entry needed."
                : "Set GCP_PROJECT_ID / GCP_LOCATION and authenticate the server to Vertex AI to enable Model Swap generation."}
            </p>
          </div>
        </div>
      )}

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
