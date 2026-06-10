"use client";

import { cn } from "@/lib/utils";
import {
  IMAGE_GEN_MODELS,
  TEXT_GEN_MODELS,
  type ModelProvider,
} from "@/lib/constants";
import type { ImageGenModel, TextGenModel } from "@/lib/types";
import type { VTONStore } from "@/store/vton-store";

/**
 * Provider-bucketed model picker for the final review/generate page.
 *
 * Renders one soft-edged rectangle per provider (Gemini, OpenAI). Each rectangle
 * groups that provider's **text** (prompt-generation) and **image**-generation
 * options. The two selections stay independent — the text pick writes
 * `textGenModel` and the image pick writes `imageGenModel` — so any cross-provider
 * combination is valid; the rectangles are visual grouping only.
 *
 * This is the single place model selection is surfaced; the earlier wizard steps
 * no longer carry their own pickers.
 */

interface ModelComboPickerProps {
  store: VTONStore;
}

interface ProviderMeta {
  key: ModelProvider;
  label: string;
  subtitle: string;
}

const PROVIDERS: ProviderMeta[] = [
  { key: "gemini", label: "Gemini", subtitle: "Google · Vertex AI" },
  { key: "openai", label: "OpenAI", subtitle: "Azure OpenAI" },
];

interface OptionCardProps {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

function OptionCard({ label, description, selected, onSelect }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left p-3 rounded-xl border transition-colors duration-200",
        selected
          ? "bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/50 shadow-sm shadow-orange-500/20"
          : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
            selected ? "border-orange-500" : "border-muted-foreground/40"
          )}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-orange-500" />}
        </div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 pl-6">{description}</p>
    </button>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-2">{children}</div>
    </div>
  );
}

export function ModelComboPicker({ store }: ModelComboPickerProps) {
  const {
    featureMode,
    textGenModel,
    setTextGenModel,
    imageGenModel,
    setImageGenModel,
  } = store;

  // Image generation is only user-selectable for VTON flows; everything else is
  // fixed to the Gemini backend (matches the prior picker gating).
  const showImage = featureMode === "vton";

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">AI Models</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pick the prompt-generation and image-generation engines. Text and image
          can be mixed across providers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((provider) => {
          const textOptions = TEXT_GEN_MODELS.filter((m) => m.provider === provider.key);
          const imageOptions = IMAGE_GEN_MODELS.filter((m) => m.provider === provider.key);
          // Skip a provider that has nothing to offer in the current mode.
          if (textOptions.length === 0 && (!showImage || imageOptions.length === 0)) {
            return null;
          }

          return (
            <div
              key={provider.key}
              className="rounded-2xl border border-border bg-card/60 p-5 space-y-4"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{provider.label}</p>
                <p className="text-xs text-muted-foreground">{provider.subtitle}</p>
              </div>

              {textOptions.length > 0 && (
                <SubSection title="Text">
                  {textOptions.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      label={opt.label}
                      description={opt.description}
                      selected={textGenModel === opt.value}
                      onSelect={() => setTextGenModel(opt.value as TextGenModel)}
                    />
                  ))}
                </SubSection>
              )}

              {showImage && imageOptions.length > 0 && (
                <SubSection title="Image">
                  {imageOptions.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      label={opt.label}
                      description={opt.description}
                      selected={imageGenModel === opt.value}
                      onSelect={() => setImageGenModel(opt.value as ImageGenModel)}
                    />
                  ))}
                </SubSection>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
