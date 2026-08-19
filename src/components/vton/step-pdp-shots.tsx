"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Plus, Trash2, AlertTriangle, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PDP_CATALOG_BY_HEADING, PDP_HEADINGS, buildCustomPdpOption } from "@/lib/pdp-catalog";
import { shouldDrawOptionalLogo } from "@/lib/pdp-directives";
import type { VTONStore } from "@/store/vton-store";
import type { PdpHeading, PdpShotOption } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Multi-select of sheet columns for one option.
 *
 * Assignment is authored here, from the option's side, because that is how the work is
 * actually thought about: "this infographic uses those points". The sheet panel renders
 * the inverse view so column coverage can still be checked at a glance.
 */
function ColumnPicker({
  headers,
  selected,
  onChange,
  fallbackNote,
}: {
  headers: string[];
  selected: string[];
  onChange: (columns: string[]) => void;
  fallbackNote: string;
}) {
  if (headers.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
      <p className="text-[11px] font-medium text-muted-foreground">Copy from</p>
      <div className="flex flex-wrap gap-1.5">
        {headers.map((h) => {
          const active = selected.includes(h);
          return (
            <button
              key={h}
              onClick={(e) => {
                e.stopPropagation();
                onChange(active ? selected.filter((c) => c !== h) : [...selected, h]);
              }}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-muted/60"
              )}
            >
              {h}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="text-[11px] text-muted-foreground/80">{fallbackNote}</p>
      )}
    </div>
  );
}

function OptionCard({
  option,
  selected,
  onToggle,
  headers,
  columns,
  onColumns,
  optionalLogoAvailable,
  optionalLogoOn,
  optionalLogoPreview,
  markCaption,
  onMarkCaption,
  onToggleOptionalLogo,
  onDelete,
}: {
  option: PdpShotOption;
  selected: boolean;
  onToggle: () => void;
  headers: string[];
  columns: string[];
  onColumns: (columns: string[]) => void;
  optionalLogoAvailable: boolean;
  optionalLogoOn: boolean;
  optionalLogoPreview?: string;
  markCaption: string;
  onMarkCaption: (caption: string) => void;
  onToggleOptionalLogo: () => void;
  onDelete?: () => void;
}) {
  // True Zero is meaningless without the mark that carries its story, so it is disabled
  // rather than silently generating a sustainability claim with nothing to attribute it to.
  const blocked = Boolean(option.requiresOptionalLogo) && !optionalLogoAvailable;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-all duration-200",
        blocked
          ? "border-border/60 opacity-60"
          : selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:bg-muted/40"
      )}
    >
      <button
        onClick={blocked ? undefined : onToggle}
        disabled={blocked}
        className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed"
      >
        <span
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
          )}
        >
          {selected && <Check className="h-3 w-3" />}
        </span>
        <span className="text-xl leading-none">{option.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{option.label}</span>
            {option.bearsText && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                text
              </span>
            )}
            {option.isCustom && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                yours
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {option.description}
          </span>
        </span>
        {onDelete && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onDelete();
              }
            }}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${option.label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {blocked && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          Upload an optional logo on the Products step to enable this.
        </p>
      )}

      {selected && !blocked && (
        <>
          {option.consumesCopy && (
            <ColumnPicker
              headers={headers}
              selected={columns}
              onChange={onColumns}
              fallbackNote="No column chosen, so this falls back to the overall context columns."
            />
          )}

          {optionalLogoAvailable && !option.requiresOptionalLogo && (
            <button
              onClick={onToggleOptionalLogo}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60"
            >
              <span
                className={cn(
                  "flex h-3 w-3 items-center justify-center rounded-sm border",
                  optionalLogoOn ? "border-primary bg-primary text-primary-foreground" : "border-border"
                )}
              >
                {optionalLogoOn && <Check className="h-2 w-2" />}
              </span>
              <Tag className="h-3 w-3" />
              Add the optional logo
            </button>
          )}

          {/* The mark is rendered with its claim text, and the wording belongs to the shot
              rather than the batch. The thumbnail sits beside the field so it is obvious
              which mark is being captioned. */}
          {optionalLogoOn && optionalLogoPreview && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-background">
                <Image
                  src={optionalLogoPreview}
                  alt="Secondary mark"
                  fill
                  sizes="36px"
                  className="object-contain p-0.5"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Text with this mark</p>
                <Input
                  value={markCaption}
                  onChange={(e) => onMarkCaption(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="e.g. 100% BIODEGRADABLE SOLE"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CustomOptionForm({ heading, onCreate }: { heading: PdpHeading; onCreate: (o: PdpShotOption) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  const submit = useCallback(() => {
    if (!label.trim() || !description.trim()) return;
    onCreate(
      buildCustomPdpOption({
        id: uid("pdp-custom"),
        heading,
        label: label.trim(),
        description: description.trim(),
      })
    );
    setLabel("");
    setDescription("");
    setOpen(false);
  }, [label, description, heading, onCreate]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
      >
        <Plus className="h-3.5 w-3.5" />
        New option from a description
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Name, for example: Monsoon grip story"
        className="h-8 text-sm"
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the image you want. Say what is in frame, how it is arranged, and what the viewer should take away."
        className="min-h-[70px] text-sm"
      />
      <p className="text-[11px] text-muted-foreground">
        Saved to your library and shown here on every future run.
      </p>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!label.trim() || !description.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          Save option
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function StepPdpShots({ store }: { store: VTONStore }) {
  const {
    pdpSelectedOptions,
    togglePdpOption,
    pdpOptionColumns,
    setPdpOptionColumnsFor,
    pdpOptionMarkCaptions,
    setPdpOptionMarkCaptionFor,
    pdpCustomOptions,
    addPdpCustomOption,
    removePdpCustomOption,
    pdpSheetSession,
    pdpLogos,
    setPdpLogos,
    pdpResolvedProducts,
  } = store;

  const headers = useMemo(
    () => (pdpSheetSession ? pdpSheetSession.headers.filter((h) => h !== pdpSheetSession.skuColumn) : []),
    [pdpSheetSession]
  );

  const allOptions = useMemo(
    () => [
      ...PDP_CATALOG_BY_HEADING["product-shot"],
      ...PDP_CATALOG_BY_HEADING["on-model"],
      ...PDP_CATALOG_BY_HEADING.infographic,
      ...pdpCustomOptions,
    ],
    [pdpCustomOptions]
  );

  const toggleOptionalLogo = useCallback(
    (optionId: string) => {
      setPdpLogos((prev) => ({
        ...prev,
        optionalEnabledFor: prev.optionalEnabledFor.includes(optionId)
          ? prev.optionalEnabledFor.filter((id) => id !== optionId)
          : [...prev.optionalEnabledFor, optionId],
      }));
    },
    [setPdpLogos]
  );

  const productCount = pdpResolvedProducts.filter((p) => p.images.length > 0).length;
  const perProduct = pdpSelectedOptions.length;

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h3 className="text-sm font-medium text-foreground">Shot types</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tick what you want. Each ticked option produces one image per product.
        </p>
      </div>

      {PDP_HEADINGS.map((headingDef) => {
        const presets = PDP_CATALOG_BY_HEADING[headingDef.value];
        const customs = pdpCustomOptions.filter((o) => o.heading === headingDef.value);
        const options = [...presets, ...customs];
        const chosen = options.filter((o) => pdpSelectedOptions.includes(o.id)).length;

        return (
          <section key={headingDef.value} className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium text-foreground">
                  {headingDef.label}
                  {headingDef.value === "product-shot" && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      no human model
                    </span>
                  )}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">{headingDef.description}</p>
              </div>
              {chosen > 0 && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {chosen} selected
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {options.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={pdpSelectedOptions.includes(option.id)}
                  onToggle={() => togglePdpOption(option.id)}
                  headers={headers}
                  columns={pdpOptionColumns[option.id] ?? []}
                  onColumns={(cols) => setPdpOptionColumnsFor(option.id, cols)}
                  optionalLogoAvailable={Boolean(pdpLogos.optionalLogo)}
                  optionalLogoOn={shouldDrawOptionalLogo(option, pdpLogos)}
                  optionalLogoPreview={pdpLogos.optionalLogo?.preview}
                  markCaption={pdpOptionMarkCaptions[option.id] ?? ""}
                  onMarkCaption={(caption) => setPdpOptionMarkCaptionFor(option.id, caption)}
                  onToggleOptionalLogo={() => toggleOptionalLogo(option.id)}
                  onDelete={option.isCustom ? () => removePdpCustomOption(option.id) : undefined}
                />
              ))}
              <CustomOptionForm heading={headingDef.value} onCreate={addPdpCustomOption} />
            </div>
          </section>
        );
      })}

      {perProduct > 0 && (
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-sm text-foreground">
            {perProduct} image{perProduct === 1 ? "" : "s"} per product
            {productCount > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {perProduct * productCount} in total across {productCount} product
                {productCount === 1 ? "" : "s"}
              </span>
            )}
          </p>
          {allOptions.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {pdpSelectedOptions
                .map((id) => allOptions.find((o) => o.id === id)?.label)
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
