"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MODEL_AGE_OPTIONS,
  MODEL_ETHNICITY_OPTIONS,
  FALLBACK_BODY_TYPE,
  bodyTypeOptionsForAge,
  genderOptionsForAge,
  modelAgeGroup,
} from "@/lib/constants";
import { researchBrand } from "@/lib/model-creation-client";
import type { ModelAgeRange } from "@/lib/types";
import type { VTONStore } from "@/store/vton-store";

interface Props {
  store: VTONStore;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
        active
          ? "bg-foreground text-background border-foreground shadow-sm"
          : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{label}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function StepModelCasting({ store }: Props) {
  const {
    modelGender,
    setModelGender,
    modelAgeRange,
    setModelAgeRange,
    modelBodyType,
    setModelBodyType,
    modelEthnicity,
    setModelEthnicity,
    modelBrandName,
    setModelBrandName,
    modelBrandDirectives,
    setModelBrandDirectives,
    modelBrandStatus,
    setModelBrandStatus,
    modelGuidelines,
    setModelGuidelines,
  } = store;

  const [brandError, setBrandError] = useState<string | null>(null);

  // Ethnicity: a value is "custom" if it's set but not one of the presets.
  const isPresetEthnicity =
    modelEthnicity === "" || MODEL_ETHNICITY_OPTIONS.includes(modelEthnicity);

  // Gender labels and body-type builds both depend on the age band.
  const genderOptions = genderOptionsForAge(modelAgeRange);
  const bodyTypeOptions = bodyTypeOptionsForAge(modelAgeRange);

  const childAgeOptions = MODEL_AGE_OPTIONS.filter((o) => o.group !== "adult");
  const adultAgeOptions = MODEL_AGE_OPTIONS.filter((o) => o.group === "adult");

  /**
   * Switching between the adult and child bands swaps the whole body-type set,
   * so a pick that no longer exists (e.g. "Plus-size" → Toddler) is coerced
   * back to the shared fallback rather than left dangling.
   */
  const handleAgeChange = (age: ModelAgeRange) => {
    setModelAgeRange(age);
    const nextOptions = bodyTypeOptionsForAge(age);
    if (!nextOptions.some((o) => o.value === modelBodyType)) {
      setModelBodyType(FALLBACK_BODY_TYPE);
    }
  };

  const handleResearch = async () => {
    if (!modelBrandName.trim() || modelBrandStatus === "researching") return;
    setBrandError(null);
    setModelBrandStatus("researching");
    try {
      const directives = await researchBrand(modelBrandName.trim());
      setModelBrandDirectives(directives);
      setModelBrandStatus("ready");
    } catch (e) {
      setModelBrandStatus("error");
      setBrandError(e instanceof Error ? e.message : "Brand research failed");
    }
  };

  return (
    <div className="space-y-10 animate-fade-in-up">
      {/* Casting attributes */}
      <div className="space-y-8">
        <Field
          label="Age"
          hint="Child bands generate a real child at true child proportions, in the kids base layer"
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Children
              </p>
              <div className="flex flex-wrap gap-2">
                {childAgeOptions.map((o) => (
                  <Pill key={o.value} active={modelAgeRange === o.value} onClick={() => handleAgeChange(o.value)}>
                    {o.label}
                  </Pill>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Adults
              </p>
              <div className="flex flex-wrap gap-2">
                {adultAgeOptions.map((o) => (
                  <Pill key={o.value} active={modelAgeRange === o.value} onClick={() => handleAgeChange(o.value)}>
                    {o.label}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </Field>

        <Field
          label="Gender"
          hint={
            modelAgeGroup(modelAgeRange) === "adult"
              ? "Sets the locked wardrobe for every model in this batch"
              : "Children of every band wear the same locked base layer — black sleeveless U-neck + black shorts"
          }
        >
          <div className="flex flex-wrap gap-2">
            {genderOptions.map((o) => (
              <Pill key={o.value} active={modelGender === o.value} onClick={() => setModelGender(o.value)}>
                {o.label}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Body type">
          <div className="flex flex-wrap gap-2">
            {bodyTypeOptions.map((o) => (
              <Pill key={o.value} active={modelBodyType === o.value} onClick={() => setModelBodyType(o.value)}>
                {o.label}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Ethnicity / skin tone" hint="Optional — pick a preset or type your own">
          <div className="flex flex-wrap gap-2">
            {MODEL_ETHNICITY_OPTIONS.map((e) => (
              <Pill key={e} active={modelEthnicity === e} onClick={() => setModelEthnicity(e)}>
                {e}
              </Pill>
            ))}
            <Pill active={!isPresetEthnicity} onClick={() => setModelEthnicity(isPresetEthnicity ? " " : modelEthnicity)}>
              Custom
            </Pill>
          </div>
          {!isPresetEthnicity && (
            <Input
              value={modelEthnicity}
              onChange={(e) => setModelEthnicity(e.target.value)}
              placeholder="Describe the ethnicity / skin tone"
              className="mt-1 max-w-md"
            />
          )}
        </Field>
      </div>

      <div className="h-px bg-border/60" />

      {/* Optional brand identity */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            Brand identity <span className="text-muted-foreground font-normal">· optional</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Name a brand and we&apos;ll research its visual direction, then distil it into directives
            applied to every model. You can edit the result.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={modelBrandName}
            onChange={(e) => setModelBrandName(e.target.value)}
            placeholder="e.g. Aimé Leon Dore, Jacquemus, Zara…"
            className="sm:max-w-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleResearch();
              }
            }}
          />
          <button
            type="button"
            onClick={handleResearch}
            disabled={!modelBrandName.trim() || modelBrandStatus === "researching"}
            className="btn-gradient inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none"
          >
            {modelBrandStatus === "researching" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : modelBrandDirectives ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {modelBrandStatus === "researching"
              ? "Researching…"
              : modelBrandDirectives
              ? "Re-research"
              : "Research brand"}
          </button>
        </div>

        {brandError && <p className="text-xs text-red-500">{brandError}</p>}

        {(modelBrandDirectives || modelBrandStatus === "ready") && (
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Brand creative brief (editable)
            </p>
            <Textarea
              value={modelBrandDirectives}
              onChange={(e) => setModelBrandDirectives(e.target.value)}
              rows={5}
              placeholder="Distilled visual directives…"
              className="resize-y"
            />
          </div>
        )}
      </div>

      <div className="h-px bg-border/60" />

      {/* Additional guidelines */}
      <Field
        label="Model appearance guidelines"
        hint="Optional — extra direction applied to every model (e.g. grooming, energy, casting notes)"
      >
        <Textarea
          value={modelGuidelines}
          onChange={(e) => setModelGuidelines(e.target.value)}
          rows={4}
          placeholder="e.g. natural, minimal makeup; confident but relaxed energy; clean editorial grooming…"
          className="resize-y"
        />
      </Field>
    </div>
  );
}
