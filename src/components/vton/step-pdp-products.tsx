"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import { FolderOpen, Trash2, ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PDP_STYLE_OPTIONS,
  PDP_LOGO_PLACEMENT_OPTIONS,
  SOLE_CONSTRUCTION_LAYER_OPTIONS,
} from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PdpSheetPanel } from "./pdp-sheet-panel";
import type { VTONStore } from "@/store/vton-store";
import type {
  OverlayPosition,
  PdpProduct,
  ReferenceImageItem,
  SoleConstructionLayerCount,
} from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Parent-folder upload. Each immediate subfolder becomes one product and its name is the
 * SKU; a flat folder of images collapses to a single product. Same shape as the
 * infographic wizard's importer, kept local because the grouping rule differs slightly:
 * here the folder name is load bearing, since it is what the sheet matches against.
 */
function FolderUploadButton({
  onFolders,
}: {
  onFolders: (folders: { name: string; files: File[] }[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
      if (inputRef.current) inputRef.current.value = "";
      if (files.length === 0) return;

      const hasSubFolders = files.some((file) => {
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        return path.split("/").length > 2;
      });

      const folderMap = new Map<string, File[]>();
      for (const file of files) {
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const parts = path.split("/");
        const folderName =
          hasSubFolders && parts.length > 2 ? parts[1] : parts.length > 1 ? parts[0] : "Untitled";
        if (!folderMap.has(folderName)) folderMap.set(folderName, []);
        folderMap.get(folderName)!.push(file);
      }

      const folders = [...folderMap.entries()]
        .map(([name, f]) => ({ name, files: f }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

      if (folders.length > 0) onFolders(folders);
    },
    [onFolders]
  );

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        Upload parent folder
      </button>
      <input
        ref={inputRef}
        type="file"
        onChange={handleSelect}
        className="hidden"
        {...({ webkitdirectory: "", directory: "", multiple: true } as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    </>
  );
}

/** One product with every image in its subfolder previewed. */
function ProductCard({
  product,
  onRemove,
  onLayers,
  contextColumns,
}: {
  product: PdpProduct;
  onRemove: (id: string) => void;
  onLayers: (id: string, layers: SoleConstructionLayerCount) => void;
  contextColumns: string[];
}) {
  const matched = Boolean(product.sheetRow);
  const contextPreview = matched
    ? contextColumns
        .map((c) => (product.sheetRow?.[c] ?? "").trim())
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{product.sku}</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                matched ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
              )}
            >
              {matched ? "matched" : "no sheet row"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {product.images.length} image{product.images.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => onRemove(product.id)}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${product.sku}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Every image in the subfolder is previewed, not just the first. */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {product.images.map((img) => (
          <div
            key={img.id}
            className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/40"
          >
            <Image
              src={img.preview}
              alt={img.file.name}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
          </div>
        ))}
      </div>

      {contextPreview && (
        <p className="text-xs text-muted-foreground line-clamp-2" title={contextPreview}>
          {contextPreview}
        </p>
      )}

      {/* Fixed per product, because the right number of layers depends on how this
          particular shoe is actually built. Only consumed by the sole construction
          infographic; harmless when that option is not ticked. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <span className="text-[11px] text-muted-foreground">Sole construction layers</span>
        <Select
          value={String(product.soleConstructionLayers ?? 3)}
          onValueChange={(v) => onLayers(product.id, Number(v) as SoleConstructionLayerCount)}
        >
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOLE_CONSTRUCTION_LAYER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground/70">
          {SOLE_CONSTRUCTION_LAYER_OPTIONS.find(
            (o) => o.value === (product.soleConstructionLayers ?? 3)
          )?.description}
        </span>
      </div>
    </div>
  );
}

/** Single-image upload used for the two logo slots. */
function LogoSlot({
  label,
  hint,
  image,
  placement,
  scale,
  onPick,
  onClear,
  onPlacement,
  onScale,
}: {
  label: string;
  hint: string;
  image?: ReferenceImageItem;
  placement: OverlayPosition;
  scale: number;
  onPick: (file: File) => void;
  onClear: () => void;
  onPlacement: (p: OverlayPosition) => void;
  onScale: (s: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>

      {image ? (
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-24 overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(#0001_0_25%,transparent_0_50%)] bg-[length:12px_12px]">
            <Image
              src={image.preview}
              alt={label}
              fill
              sizes="96px"
              className="object-contain"
              unoptimized
            />
          </div>
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X className="w-3 h-3" />
            Remove
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload logo
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Placement</span>
        <Select value={placement} onValueChange={(v) => onPlacement(v as OverlayPosition)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PDP_LOGO_PLACEMENT_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">Size</span>
        <input
          type="range"
          min={4}
          max={40}
          value={Math.round(scale * 100)}
          onChange={(e) => onScale(Number(e.target.value) / 100)}
          className="h-1 w-24 cursor-pointer accent-primary"
        />
        <span className="w-8 text-xs tabular-nums text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (inputRef.current) inputRef.current.value = "";
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

export function StepPdpProducts({ store }: { store: VTONStore }) {
  const {
    pdpResolvedProducts,
    setPdpProducts,
    pdpSheetSession,
    pdpStyle,
    setPdpStyle,
    pdpLogos,
    setPdpLogos,
  } = store;

  const handleFolders = useCallback(
    (folders: { name: string; files: File[] }[]) => {
      const next: PdpProduct[] = folders.map((f) => ({
        id: uid("pdp-product"),
        sku: f.name,
        images: f.files.map((file) => ({
          id: uid("pdp-img"),
          file,
          preview: URL.createObjectURL(file),
        })),
      }));
      setPdpProducts((prev) => {
        // Replace by SKU so re-uploading a folder refreshes it rather than duplicating.
        const bySku = new Map(prev.map((p) => [p.sku.toLowerCase(), p]));
        for (const product of next) {
          const existing = bySku.get(product.sku.toLowerCase());
          if (existing) existing.images.forEach((i) => URL.revokeObjectURL(i.preview));
          bySku.set(product.sku.toLowerCase(), product);
        }
        return [...bySku.values()];
      });
    },
    [setPdpProducts]
  );

  const removeProduct = useCallback(
    (id: string) => {
      setPdpProducts((prev) => {
        const target = prev.find((p) => p.id === id);
        target?.images.forEach((i) => URL.revokeObjectURL(i.preview));
        return prev.filter((p) => p.id !== id);
      });
    },
    [setPdpProducts]
  );

  const setLayers = useCallback(
    (id: string, layers: SoleConstructionLayerCount) => {
      setPdpProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, soleConstructionLayers: layers } : p))
      );
    },
    [setPdpProducts]
  );

  const setLogo = useCallback(
    (key: "brandLogo" | "optionalLogo", file: File | null) => {
      setPdpLogos((prev) => {
        const existing = prev[key];
        if (existing) URL.revokeObjectURL(existing.preview);
        return {
          ...prev,
          [key]: file
            ? { id: uid("pdp-logo"), file, preview: URL.createObjectURL(file) }
            : undefined,
        };
      });
    },
    [setPdpLogos]
  );

  const contextColumns = pdpSheetSession?.overallContextColumns ?? [];

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Products */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Products</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload the parent folder. Each subfolder becomes one product and its name is the SKU.
            </p>
          </div>
          <FolderUploadButton onFolders={handleFolders} />
        </div>

        {pdpResolvedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No products yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pdpResolvedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onRemove={removeProduct}
                onLayers={setLayers}
                contextColumns={contextColumns}
              />
            ))}
          </div>
        )}
      </section>

      {/* Sheet */}
      <PdpSheetPanel store={store} />

      {/* Artistic style */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Artistic style</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            One design grammar applied across every image in the set. It decides how things are
            rendered, layered on top of whatever else is configured, rather than deciding what the
            images contain.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {PDP_STYLE_OPTIONS.map((opt) => {
            const active = pdpStyle === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setPdpStyle(opt.value)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all duration-200",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{opt.icon}</span>
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                </div>
                <p className="mt-1.5 text-xs italic text-muted-foreground">{opt.tagline}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
                <p className="mt-2 text-[11px] text-muted-foreground/80">
                  <span className="font-medium">Strong for:</span> {opt.strongFor}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Logos */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Logos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Both marks are composited onto the finished image from your files, so they come out
            pixel exact. The generator is told to leave these areas clean rather than to draw a mark
            itself.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <LogoSlot
            label="Brand logo"
            hint="Placed on every image in the run."
            image={pdpLogos.brandLogo}
            placement={pdpLogos.brandPlacement}
            scale={pdpLogos.brandScale}
            onPick={(f) => setLogo("brandLogo", f)}
            onClear={() => setLogo("brandLogo", null)}
            onPlacement={(p) => setPdpLogos((prev) => ({ ...prev, brandPlacement: p }))}
            onScale={(s) => setPdpLogos((prev) => ({ ...prev, brandScale: s }))}
          />
          <LogoSlot
            label="Optional logo"
            hint="Applied only to the shot types you enable it for, on the Shots step."
            image={pdpLogos.optionalLogo}
            placement={pdpLogos.optionalPlacement}
            scale={pdpLogos.optionalScale}
            onPick={(f) => setLogo("optionalLogo", f)}
            onClear={() => setLogo("optionalLogo", null)}
            onPlacement={(p) => setPdpLogos((prev) => ({ ...prev, optionalPlacement: p }))}
            onScale={(s) => setPdpLogos((prev) => ({ ...prev, optionalScale: s }))}
          />
        </div>
      </section>
    </div>
  );
}
