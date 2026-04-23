"use client";

import { useState } from "react";
import { Eye, EyeOff, Key } from "lucide-react";
import { ASPECT_RATIOS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { VTONStore } from "@/store/vton-store";
import type { AspectRatio } from "@/lib/types";

export function StepReplicateConfigure({ store }: { store: VTONStore }) {
  const {
    apiKey,
    setApiKey,
    aspectRatio,
    setAspectRatio,
    replicateAdditionalInfo,
    setReplicateAdditionalInfo,
  } = store;
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="space-y-6">
      {/* Aspect Ratio */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Output Aspect Ratio
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose the aspect ratio for the generated image. If unsure, pick the
          ratio that matches your reference output image.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.value}
              onClick={() => setAspectRatio(ar.value as AspectRatio)}
              className={cn(
                "rounded-lg border py-3 px-2 text-center transition-colors duration-200",
                aspectRatio === ar.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/30 hover:bg-muted/30"
              )}
            >
              <p className="text-sm font-semibold">{ar.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {ar.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Additional Instructions */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Additional Instructions
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Optional instructions to guide the AI. For example, describe specific
          changes, branding guidelines, or layout preferences.
        </p>
        <textarea
          value={replicateAdditionalInfo}
          onChange={(e) => setReplicateAdditionalInfo(e.target.value)}
          placeholder="e.g. Use the same font style for headings, keep the brand logo at the top, match the yellow header color..."
          rows={4}
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors duration-200 resize-none"
        />
      </div>

      {/* API Key */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <Key className="w-4 h-4" />
          Gemini API Key
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Required for AI-powered image generation.
        </p>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Google Gemini API key"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors duration-200"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
