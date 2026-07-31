"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Shirt, Scissors, Check, Upload, X, FolderOpen, Plus, Pencil, Trash2, FileText, FileSpreadsheet, Download, Loader2, AlertCircle, Sparkles, Info } from "lucide-react";
import { ImageUploadZone } from "./image-upload-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  buildNormalizedRows,
  downloadSpreadsheetProductFolders,
  parseSpreadsheetFile,
  uniqueFilterValues,
  uniqueFilterValuesFromRecords,
  validateMapping,
} from "@/lib/bulk-spreadsheet-import";
import {
  BOTTOMWEAR_LENGTH_OPTIONS,
  INNERWEAR_SUBTYPE_OPTIONS,
  FIT_OPTIONS,
  FOOTWEAR_TYPE_OPTIONS,
  GENDER_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  SET_LAYOUT_OPTIONS,
  SLEEVE_LENGTH_OPTIONS,
  TOPWEAR_LENGTH_OPTIONS,
} from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type {
  BottomwearLength,
  BulkSpreadsheetMapping,
  GarmentType,
  FitType,
  FootwearSide,
  ProductFolder,
  SetProductFolder,
  SetVariantFolder,
  SleeveLength,
  TopwearLength,
} from "@/lib/types";
import { BULK_SPREADSHEET_FILTER_ALL } from "@/lib/types";

/**
 * Tooltip body for the Pose Variation toggle. Kept in one place so single-mode and
 * bulk-mode controls show identical guidance.
 */
const POSE_VARIATION_TOOLTIP =
  "When ON, the generated image introduces subtle pose changes (gaze direction, hand position, stance) while preserving image framing and body orientation. When OFF, the original pose is reproduced exactly.";

/**
 * Compact Model-Swap-only toggle for the "Pose Variation" product-level option.
 * Default OFF — when OFF the new model must reproduce the source pose exactly; when ON
 * the prompt is allowed to introduce subtle pose variations (see `POSE_VARIATION_TOOLTIP`).
 */
function PoseVariationToggle({
  value,
  onChange,
  size = "md",
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border bg-card transition-colors",
        size === "sm" ? "px-2.5 py-1.5" : "px-3 py-2",
        value
          ? "border-orange-500/40 bg-orange-500/5"
          : "border-border hover:border-primary/40",
      )}
    >
      <Sparkles
        className={cn(
          size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5",
          value ? "text-orange-500" : "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "font-medium",
          size === "sm" ? "text-[11px]" : "text-xs",
          value ? "text-orange-700 dark:text-orange-400" : "text-foreground",
        )}
      >
        Pose Variation
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label="What is Pose Variation?"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs leading-relaxed">{POSE_VARIATION_TOOLTIP}</p>
        </TooltipContent>
      </Tooltip>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label="Toggle Pose Variation"
        onClick={() => onChange(!value)}
        className={cn(
          "relative inline-flex items-center rounded-full transition-colors duration-200 shrink-0",
          size === "sm" ? "h-4 w-7" : "h-[18px] w-8",
          value ? "bg-orange-500" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block rounded-full bg-white shadow-sm transition-transform duration-200",
            size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
            value
              ? size === "sm"
                ? "translate-x-3.5"
                : "translate-x-[18px]"
              : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

const GARMENT_TYPES: { value: GarmentType; label: string; icon: React.ReactNode }[] = [
  { value: "topwear", label: "Top Wear", icon: <Shirt className="w-4 h-4" /> },
  { value: "bottomwear", label: "Bottom Wear", icon: <Scissors className="w-4 h-4" /> },
  { value: "onepiece", label: "One Piece", icon: <Shirt className="w-4 h-4" /> },
  { value: "complete-outfit", label: "Complete Outfit", icon: <Shirt className="w-4 h-4" /> },
  { value: "innerwear", label: "Innerwear", icon: <Shirt className="w-4 h-4" /> },
];

/** Which per-product override dimension is shown in the folder card tab strip */
type ProductOverrideTab = "fit" | "sleeve" | "tophem" | "bottomlen";

function productOverrideTabs(garmentType: GarmentType | undefined): ProductOverrideTab[] {
  switch (garmentType) {
    case "topwear":
      return ["fit", "sleeve", "tophem"];
    case "bottomwear":
      return ["fit", "bottomlen"];
    case "onepiece":
    case "complete-outfit":
      return ["fit", "sleeve", "tophem", "bottomlen"];
    default:
      return ["fit"];
  }
}

function tabLabel(t: ProductOverrideTab): string {
  switch (t) {
    case "fit":
      return "Fit";
    case "sleeve":
      return "Sleeve";
    case "tophem":
      return "Top hem";
    case "bottomlen":
      return "Bottom";
    default:
      return t;
  }
}

/* ------------------------------------------------------------------ */
/*  Product Folder Card - used in bulk mode                            */
/* ------------------------------------------------------------------ */
function ProductFolderCard({
  folder,
  target,
  onAddImages,
  onRemoveImage,
  onRemove,
  onRename,
  onUploadFolder,
  onProductInfoChange,
  onToggleBackView,
  onSetFootwearSide,
  garmentType,
  globalFit,
  globalSleeveLength,
  globalTopwearLength,
  globalBottomwearLength,
  onFitChange,
  onSleeveLengthChange,
  onTopwearLengthChange,
  onBottomwearLengthChange,
  isFootwear,
  onTogglePoseVariation,
  onToggleOnModelGarment,
}: {
  folder: ProductFolder;
  target: "primary" | "complementary";
  onAddImages: (folderId: string, target: "primary" | "complementary", files: File[]) => void;
  onRemoveImage: (folderId: string, imageId: string, target: "primary" | "complementary") => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onUploadFolder: (target: "primary" | "complementary") => void;
  onProductInfoChange?: (folderId: string, info: string) => void;
  onToggleBackView?: (folderId: string, imageId: string) => void;
  onSetFootwearSide?: (folderId: string, imageId: string, side: FootwearSide | null) => void;
  garmentType?: GarmentType;
  globalFit?: FitType | null;
  globalSleeveLength?: SleeveLength | null;
  globalTopwearLength?: TopwearLength | null;
  globalBottomwearLength?: BottomwearLength | null;
  onFitChange?: (folderId: string, fit: FitType | null) => void;
  onSleeveLengthChange?: (folderId: string, length: SleeveLength | null) => void;
  onTopwearLengthChange?: (folderId: string, length: TopwearLength | null) => void;
  onBottomwearLengthChange?: (folderId: string, length: BottomwearLength | null) => void;
  isFootwear?: boolean;
  /**
   * Model Swap (bulk) only — when provided, renders a per-folder Pose Variation toggle.
   * In VTON mode this prop is omitted and the control does not render.
   */
  onTogglePoseVariation?: (folderId: string, value: boolean) => void;
  /** VTON clothing (bulk) only — per-folder "garment images are on-model" toggle. */
  onToggleOnModelGarment?: (folderId: string, value: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [activeOverrideTab, setActiveOverrideTab] = useState<ProductOverrideTab>("fit");

  const overrideTabs = useMemo(() => productOverrideTabs(garmentType), [garmentType]);
  const displayOverrideTab = overrideTabs.includes(activeOverrideTab)
    ? activeOverrideTab
    : overrideTabs[0] ?? "fit";

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) onAddImages(folder.id, target, files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [folder.id, target, onAddImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) onAddImages(folder.id, target, files);
    },
    [folder.id, target, onAddImages]
  );

  const saveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) onRename(folder.id, trimmed);
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-colors duration-200 hover:shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <FolderOpen className="w-4 h-4 text-primary shrink-0" />
        {isEditing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="text-sm font-medium bg-transparent border-b border-primary outline-none flex-1 min-w-0"
          />
        ) : (
          <p className="text-sm font-medium text-foreground truncate flex-1">
            {folder.name}
          </p>
        )}
        <Badge variant="secondary" className="text-[11px] shrink-0">
          {folder.images.length} image{folder.images.length !== 1 ? "s" : ""}
        </Badge>
        <button
          onClick={() => {
            setEditName(folder.name);
            setIsEditing(true);
          }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onRemove(folder.id)}
          className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Image Grid */}
      <div className="p-3">
        {folder.images.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {folder.images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30 transition-colors duration-200 hover:shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt="Product"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => onRemoveImage(folder.id, img.id, target)}
                  className="absolute top-1 right-1 p-0.5 rounded-lg bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/90"
                >
                  <X className="w-3 h-3" />
                </button>
                {onToggleBackView && (
                  <button
                    onClick={() => onToggleBackView(folder.id, img.id)}
                    className={cn(
                      "absolute top-1 left-1 px-1 py-0.5 rounded text-[9px] font-semibold transition-all duration-200",
                      img.isBackView
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-black/40 backdrop-blur-sm text-white/70 opacity-0 group-hover:opacity-100 hover:bg-amber-500/80 hover:text-white"
                    )}
                  >
                    {img.isBackView ? "BACK" : "Back"}
                  </button>
                )}
                {onSetFootwearSide && (
                  <button
                    onClick={() => {
                      const cycle: (FootwearSide | null)[] = [null, "medial", "lateral", "sole"];
                      const currentIdx = cycle.indexOf(img.footwearSide ?? null);
                      const next = cycle[(currentIdx + 1) % cycle.length];
                      onSetFootwearSide(folder.id, img.id, next);
                    }}
                    className={cn(
                      "absolute top-1 left-1 px-1 py-0.5 rounded text-[9px] font-semibold transition-all duration-200",
                      img.footwearSide
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-black/40 backdrop-blur-sm text-white/70 opacity-0 group-hover:opacity-100 hover:bg-orange-500/80 hover:text-white"
                    )}
                    title="Click to cycle: Medial → Lateral → Sole → Unset"
                  >
                    {img.footwearSide === "medial" ? "MEDIAL" : img.footwearSide === "lateral" ? "LATERAL" : img.footwearSide === "sole" ? "SOLE" : "Side"}
                  </button>
                )}
              </div>
            ))}
            {/* Add more button */}
            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors duration-200 text-muted-foreground hover:text-primary bg-muted/20 hover:bg-muted/50"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[11px] font-medium">Add</span>
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-muted/50 group"
          >
            <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <p className="text-xs text-muted-foreground">
              Drop images or click to upload
            </p>
          </div>
        )}
      </div>

      {/* Pose Variation (Model Swap only — onTogglePoseVariation is only passed in model-swap mode) */}
      {target === "primary" && onTogglePoseVariation && (
        <div className="px-3 pb-3">
          <PoseVariationToggle
            value={folder.poseVariation === true}
            onChange={(v) => onTogglePoseVariation(folder.id, v)}
            size="sm"
          />
        </div>
      )}

      {/* On-model garment (VTON clothing only) */}
      {target === "primary" && !isFootwear && onToggleOnModelGarment && (
        <div className="px-3 pb-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={folder.onModelGarment === true}
              onChange={(e) => onToggleOnModelGarment(folder.id, e.target.checked)}
            />
            <span className="text-[11px] leading-snug text-muted-foreground">
              <span className="font-medium text-foreground">Garment images are on-model</span> — worn by a person. Strips the wearer so your chosen AI model appears (not the input person).
            </span>
          </label>
        </div>
      )}

      {/* Product Info */}
      {target === "primary" && onProductInfoChange && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              Product Info
            </span>
          </div>
          <Textarea
            placeholder="e.g., 'Pure cotton fabric with handloom weave', 'Premium leather with anti-slip sole', 'Key selling points: breathable, lightweight'..."
            value={folder.productInfo || ""}
            onChange={(e) => onProductInfoChange(folder.id, e.target.value)}
            rows={2}
            className="resize-none rounded-lg text-xs border-border bg-muted/20 focus:bg-background transition-colors"
          />
        </div>
      )}

      {/* Per-product overrides: Fit / Sleeve / Top hem / Bottom (clothing bulk — tab strip) */}
      {target === "primary" &&
        onFitChange &&
        onSleeveLengthChange &&
        onTopwearLengthChange &&
        onBottomwearLengthChange &&
        !isFootwear && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Shirt className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                Product sizing
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {overrideTabs.map((tab) => {
                const overridden =
                  (tab === "fit" &&
                    folder.fit !== undefined &&
                    folder.fit !== globalFit) ||
                  (tab === "sleeve" &&
                    folder.sleeveLength !== undefined &&
                    folder.sleeveLength !== globalSleeveLength) ||
                  (tab === "tophem" &&
                    folder.topwearLength !== undefined &&
                    folder.topwearLength !== globalTopwearLength) ||
                  (tab === "bottomlen" &&
                    folder.bottomwearLength !== undefined &&
                    folder.bottomwearLength !== globalBottomwearLength);
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveOverrideTab(tab)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border",
                      displayOverrideTab === tab
                        ? "bg-primary/15 border-primary/50 text-primary"
                        : "bg-muted/20 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {tabLabel(tab)}
                    {overridden ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {displayOverrideTab === "fit" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {FIT_OPTIONS.map((option) => {
                    const effectiveFit = folder.fit !== undefined ? folder.fit : globalFit;
                    const isSelected = effectiveFit === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onFitChange(folder.id, isSelected ? null : option.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border",
                          isSelected
                            ? "bg-primary/10 border-primary/50 text-primary"
                            : "bg-muted/20 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {folder.fit !== undefined && folder.fit !== globalFit && (
                  <button
                    type="button"
                    onClick={() => onFitChange(folder.id, globalFit ?? null)}
                    className="mt-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors underline"
                  >
                    Reset to global ({globalFit ? FIT_OPTIONS.find((f) => f.value === globalFit)?.label : "Auto"})
                  </button>
                )}
              </>
            )}

            {displayOverrideTab === "sleeve" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {SLEEVE_LENGTH_OPTIONS.map((option) => {
                    const effective =
                      folder.sleeveLength !== undefined ? folder.sleeveLength : globalSleeveLength;
                    const isSelected = effective === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          onSleeveLengthChange(folder.id, isSelected ? null : option.value)
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border",
                          isSelected
                            ? "bg-primary/10 border-primary/50 text-primary"
                            : "bg-muted/20 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {folder.sleeveLength !== undefined &&
                  folder.sleeveLength !== globalSleeveLength && (
                    <button
                      type="button"
                      onClick={() => onSleeveLengthChange(folder.id, globalSleeveLength ?? null)}
                      className="mt-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors underline"
                    >
                      Reset to global (
                      {globalSleeveLength
                        ? SLEEVE_LENGTH_OPTIONS.find((o) => o.value === globalSleeveLength)?.label
                        : "Auto"}
                      )
                    </button>
                  )}
              </>
            )}

            {displayOverrideTab === "tophem" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {TOPWEAR_LENGTH_OPTIONS.map((option) => {
                    const effective =
                      folder.topwearLength !== undefined ? folder.topwearLength : globalTopwearLength;
                    const isSelected = effective === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          onTopwearLengthChange(folder.id, isSelected ? null : option.value)
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border",
                          isSelected
                            ? "bg-primary/10 border-primary/50 text-primary"
                            : "bg-muted/20 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {folder.topwearLength !== undefined &&
                  folder.topwearLength !== globalTopwearLength && (
                    <button
                      type="button"
                      onClick={() => onTopwearLengthChange(folder.id, globalTopwearLength ?? null)}
                      className="mt-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors underline"
                    >
                      Reset to global (
                      {globalTopwearLength
                        ? TOPWEAR_LENGTH_OPTIONS.find((o) => o.value === globalTopwearLength)?.label
                        : "Auto"}
                      )
                    </button>
                  )}
              </>
            )}

            {displayOverrideTab === "bottomlen" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {BOTTOMWEAR_LENGTH_OPTIONS.map((option) => {
                    const effective =
                      folder.bottomwearLength !== undefined
                        ? folder.bottomwearLength
                        : globalBottomwearLength;
                    const isSelected = effective === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          onBottomwearLengthChange(folder.id, isSelected ? null : option.value)
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border",
                          isSelected
                            ? "bg-primary/10 border-primary/50 text-primary"
                            : "bg-muted/20 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {folder.bottomwearLength !== undefined &&
                  folder.bottomwearLength !== globalBottomwearLength && (
                    <button
                      type="button"
                      onClick={() =>
                        onBottomwearLengthChange(folder.id, globalBottomwearLength ?? null)
                      }
                      className="mt-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors underline"
                    >
                      Reset to global (
                      {globalBottomwearLength
                        ? BOTTOMWEAR_LENGTH_OPTIONS.find((o) => o.value === globalBottomwearLength)
                            ?.label
                        : "Auto"}
                      )
                    </button>
                  )}
              </>
            )}
          </div>
        )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Folder Upload Helper - uses webkitdirectory for folder selection    */
/* ------------------------------------------------------------------ */
function FolderUploadButton({
  target,
  onFoldersSelected,
}: {
  target: "primary" | "complementary";
  onFoldersSelected: (folders: { name: string; files: File[] }[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      // Detect if the selected folder contains product sub-folders
      // e.g. ParentFolder/Product1/image.jpg → 3+ path segments
      const hasSubFolders = imageFiles.some((file) => {
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        return path.split("/").length > 2;
      });

      const folderMap = new Map<string, File[]>();
      for (const file of imageFiles) {
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const parts = path.split("/");

        let folderName: string;
        if (hasSubFolders && parts.length > 2) {
          // Sub-folder detected — group by immediate child folder of the root
          folderName = parts[1];
        } else {
          folderName = parts.length > 1 ? parts[0] : "Untitled Product";
        }

        if (!folderMap.has(folderName)) folderMap.set(folderName, []);
        folderMap.get(folderName)!.push(file);
      }

      const folders = Array.from(folderMap.entries())
        .map(([name, files]) => ({ name, files }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

      if (folders.length > 0) onFoldersSelected(folders);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFoldersSelected]
  );

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 hover:shadow-sm"
      >
        <FolderOpen className="w-4 h-4" />
        Upload Folder(s)
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

/* ------------------------------------------------------------------ */
/*  Set Product Folder Upload - parses 3-level nesting                  */
/*  Root / SetName / VariantName / images                               */
/* ------------------------------------------------------------------ */
function SetFolderUploadButton({
  onSetsSelected,
}: {
  onSetsSelected: (sets: SetProductFolder[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      // Parse 3-level folder structure: root/setName/variantName/image.jpg
      const setMap = new Map<string, Map<string, File[]>>();

      for (const file of imageFiles) {
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const parts = path.split("/");

        if (parts.length >= 4) {
          // 3-level nesting: root/set/variant/file
          const setName = parts[1];
          const variantName = parts[2];
          if (!setMap.has(setName)) setMap.set(setName, new Map());
          const variantMap = setMap.get(setName)!;
          if (!variantMap.has(variantName)) variantMap.set(variantName, []);
          variantMap.get(variantName)!.push(file);
        } else if (parts.length === 3) {
          // 2-level nesting: root/set/file — treat each subfolder as a set with one variant
          const setName = parts[1];
          if (!setMap.has(setName)) setMap.set(setName, new Map());
          const variantMap = setMap.get(setName)!;
          const variantName = "Default";
          if (!variantMap.has(variantName)) variantMap.set(variantName, []);
          variantMap.get(variantName)!.push(file);
        }
      }

      const sets: SetProductFolder[] = Array.from(setMap.entries())
        .map(([setName, variantMap]) => ({
          id: `set-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: setName,
          variants: Array.from(variantMap.entries())
            .map(([variantName, vFiles]) => ({
              id: `var-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: variantName,
              images: vFiles.map((f) => ({
                id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file: f,
                preview: URL.createObjectURL(f),
              })),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

      if (sets.length > 0) onSetsSelected(sets);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onSetsSelected]
  );

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 hover:shadow-sm"
      >
        <FolderOpen className="w-4 h-4" />
        Upload Set Folder(s)
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

/* ------------------------------------------------------------------ */
/*  CSV / XLSX Upload for Bulk Products (column mapping + filter)        */
/* ------------------------------------------------------------------ */

const MAP_NONE = "__none__";

const SPREADSHEET_SAMPLE_HEADERS = ["sku", "fit", "photo_front", "photo_back", "department"];

const SPREADSHEET_SAMPLE_ROWS = [
  ["STYLE001", "Slim fit", "https://example.com/style001/front.jpg", "https://example.com/style001/back.jpg", "Mens"],
  ["STYLE001", "Slim fit", "https://example.com/style001/side.jpg", "", "Mens"],
  [
    "STYLE002",
    "Relaxed fit",
    "https://example.com/style002/front.jpg",
    "https://example.com/style002/back.jpg",
    "Womens",
  ],
  ["STYLE003", "Oversized", "https://example.com/style003/img1.jpg", "https://example.com/style003/img2.jpg", "Mens"],
];

function BulkSpreadsheetImportSection({ store }: { store: VTONStore }) {
  const {
    bulkSpreadsheetSession,
    setBulkSpreadsheetSession,
    bulkSpreadsheetFilter,
    setBulkSpreadsheetFilter,
    removePrimaryFoldersBySessionId,
    replacePrimaryFoldersForSpreadsheetSession,
  } = store;

  const inputRef = useRef<HTMLInputElement>(null);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mapHeaders, setMapHeaders] = useState<string[]>([]);
  const [mapRecords, setMapRecords] = useState<Record<string, string>[]>([]);
  const [productCol, setProductCol] = useState("");
  const [imageCols, setImageCols] = useState<Set<string>>(() => new Set());
  const [fitCol, setFitCol] = useState(MAP_NONE);
  const [sleeveLengthCol, setSleeveLengthCol] = useState(MAP_NONE);
  const [topwearLengthCol, setTopwearLengthCol] = useState(MAP_NONE);
  const [bottomwearLengthCol, setBottomwearLengthCol] = useState(MAP_NONE);
  const [filterCol, setFilterCol] = useState(MAP_NONE);
  /** Chosen filter slice when filter column is set (must match normalized labels e.g. "(empty)") */
  const [mappingFilterValue, setMappingFilterValue] = useState("");
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const filterOptions = useMemo(() => {
    if (!bulkSpreadsheetSession?.mapping.filterColumn) return [];
    return uniqueFilterValues(bulkSpreadsheetSession.normalizedRows);
  }, [bulkSpreadsheetSession]);

  const dialogFilterOptions = useMemo(() => {
    if (filterCol === MAP_NONE) return [];
    return uniqueFilterValuesFromRecords(mapRecords, filterCol);
  }, [filterCol, mapRecords]);

  const downloadSample = useCallback(() => {
    const csvContent = [SPREADSHEET_SAMPLE_HEADERS.join(","), ...SPREADSHEET_SAMPLE_ROWS.map((r) => r.join(","))].join(
      "\n"
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_upload_sample.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const toggleImageCol = useCallback((h: string) => {
    setImageCols((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  }, []);

  const runDownloadForFilter = useCallback(
    async (
      rows: Parameters<typeof downloadSpreadsheetProductFolders>[0],
      filter: string,
      sessionId: string
    ) => {
      const { folders, errors } = await downloadSpreadsheetProductFolders(
        rows,
        filter,
        sessionId,
        (current, total) => setProgress({ current, total })
      );
      replacePrimaryFoldersForSpreadsheetSession(sessionId, folders);
      if (errors.length > 0) {
        setParseErrors((prev) => [...prev, ...errors]);
      }
    },
    [replacePrimaryFoldersForSpreadsheetSession]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (inputRef.current) inputRef.current.value = "";

      setParseErrors([]);
      setMappingError(null);
      setIsProcessing(true);

      try {
        const { headers, records, errors } = await parseSpreadsheetFile(file);

        if (errors.length > 0) {
          setParseErrors(errors);
        }
        if (headers.length === 0 || records.length === 0) {
          setIsProcessing(false);
          if (headers.length === 0 && errors.length === 0) {
            setParseErrors(["Could not read spreadsheet"]);
          }
          return;
        }

        setMapHeaders(headers);
        setMapRecords(records);
        setProductCol(headers[0] ?? "");
        setImageCols(new Set());
        setFitCol(MAP_NONE);
        setSleeveLengthCol(MAP_NONE);
        setTopwearLengthCol(MAP_NONE);
        setBottomwearLengthCol(MAP_NONE);
        setFilterCol(MAP_NONE);
        setMappingFilterValue("");
        setMappingOpen(true);
      } catch (err) {
        setParseErrors([(err as Error).message || "Failed to read file"]);
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const handleConfirmMapping = useCallback(async () => {
    const mapping: BulkSpreadsheetMapping = {
      productNameColumn: productCol,
      imageUrlColumns: Array.from(imageCols),
      fitColumn: fitCol === MAP_NONE ? null : fitCol,
      sleeveLengthColumn: sleeveLengthCol === MAP_NONE ? null : sleeveLengthCol,
      topwearLengthColumn: topwearLengthCol === MAP_NONE ? null : topwearLengthCol,
      bottomwearLengthColumn: bottomwearLengthCol === MAP_NONE ? null : bottomwearLengthCol,
      filterColumn: filterCol === MAP_NONE ? null : filterCol,
    };

    const v = validateMapping(mapping, mapHeaders);
    if (v) {
      setMappingError(v);
      return;
    }
    setMappingError(null);

    const { rows, errors } = buildNormalizedRows(mapRecords, mapping);
    if (errors.length > 0) {
      setParseErrors(errors);
    }
    if (rows.length === 0) {
      setMappingError("No valid data rows after mapping. Check columns and try again.");
      return;
    }

    if (mapping.filterColumn && !mappingFilterValue.trim()) {
      setMappingError("Select which value to import for the filter column.");
      return;
    }

    const effectiveFilter = mapping.filterColumn ? mappingFilterValue : BULK_SPREADSHEET_FILTER_ALL;

    setIsProcessing(true);

    const prev = bulkSpreadsheetSession;
    if (prev) {
      removePrimaryFoldersBySessionId(prev.sessionId);
    }

    const sessionId = globalThis.crypto.randomUUID();
    setBulkSpreadsheetSession({ sessionId, normalizedRows: rows, mapping }, effectiveFilter);
    setMappingOpen(false);

    setParseErrors(errors);
    try {
      await runDownloadForFilter(rows, effectiveFilter, sessionId);
    } catch (err) {
      setParseErrors((p) => [...p, (err as Error).message || "Import failed"]);
    } finally {
      setIsProcessing(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [
    productCol,
    imageCols,
    fitCol,
    sleeveLengthCol,
    topwearLengthCol,
    bottomwearLengthCol,
    filterCol,
    mapHeaders,
    mapRecords,
    bulkSpreadsheetSession,
    removePrimaryFoldersBySessionId,
    setBulkSpreadsheetSession,
    runDownloadForFilter,
    mappingFilterValue,
  ]);

  const handleFilterSelect = useCallback(
    async (value: string) => {
      if (!bulkSpreadsheetSession || isProcessing) return;
      setBulkSpreadsheetFilter(value);
      setIsProcessing(true);
      setParseErrors([]);
      try {
        await runDownloadForFilter(
          bulkSpreadsheetSession.normalizedRows,
          value,
          bulkSpreadsheetSession.sessionId
        );
      } catch (err) {
        setParseErrors([(err as Error).message || "Failed to reload products for filter"]);
      } finally {
        setIsProcessing(false);
        setProgress({ current: 0, total: 0 });
      }
    },
    [bulkSpreadsheetSession, isProcessing, setBulkSpreadsheetFilter, runDownloadForFilter]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isProcessing}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border",
          isProcessing
            ? "bg-muted/30 text-muted-foreground border-border cursor-not-allowed"
            : "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 hover:shadow-sm"
        )}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4" />
        )}
        {isProcessing
          ? `Downloading (${progress.current}/${progress.total})...`
          : "Upload CSV / Excel"}
      </button>
      <button
        type="button"
        onClick={downloadSample}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-primary/50"
      >
        <Download className="w-3 h-3" />
        Sample
      </button>
      <p className="w-full text-[11px] text-muted-foreground">
        Any column names work—map product name, image URLs, and optionally a filter column and which value to import.
      </p>

      {bulkSpreadsheetSession?.mapping.filterColumn != null && filterOptions.length > 0 && (
        <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Filter by {bulkSpreadsheetSession.mapping.filterColumn}
          </Label>
          <Select value={bulkSpreadsheetFilter} onValueChange={handleFilterSelect} disabled={isProcessing}>
            <SelectTrigger size="sm" className="w-full sm:w-[240px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Import Warnings</span>
          </div>
          <ul className="space-y-0.5">
            {parseErrors.slice(0, 5).map((err, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">
                {err}
              </li>
            ))}
            {parseErrors.length > 5 && (
              <li className="text-[11px] text-muted-foreground">
                ...and {parseErrors.length - 5} more warnings
              </li>
            )}
          </ul>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col" showCloseButton={!isProcessing}>
          <DialogHeader>
            <DialogTitle>Map columns</DialogTitle>
            <DialogDescription>
              Use{" "}
              <strong className="text-foreground font-medium">Fields</strong> for dropdowns, then open{" "}
              <strong className="text-foreground font-medium">Image URLs</strong> to pick one or more link columns.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="fields" className="w-full flex flex-col min-h-0">
            <TabsList className="w-full grid grid-cols-2 shrink-0">
              <TabsTrigger value="fields" className="gap-1.5">
                Fields
              </TabsTrigger>
              <TabsTrigger value="images" className="gap-1.5">
                Image URLs
                {imageCols.size > 0 ? (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                    {imageCols.size}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="mt-4 space-y-4 data-[state=inactive]:hidden">
              <div className="space-y-2">
                <Label>Product name column</Label>
                <Select value={productCol || mapHeaders[0] || ""} onValueChange={setProductCol}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                    {mapHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fit column (optional)</Label>
                <Select value={fitCol} onValueChange={setFitCol}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                    <SelectItem value={MAP_NONE}>None</SelectItem>
                    {mapHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sleeve length column (optional)</Label>
                <Select value={sleeveLengthCol} onValueChange={setSleeveLengthCol}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                    <SelectItem value={MAP_NONE}>None</SelectItem>
                    {mapHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Top hemline length column (optional)</Label>
                <Select value={topwearLengthCol} onValueChange={setTopwearLengthCol}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                    <SelectItem value={MAP_NONE}>None</SelectItem>
                    {mapHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Bottomwear length column (optional)</Label>
                <Select value={bottomwearLengthCol} onValueChange={setBottomwearLengthCol}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                    <SelectItem value={MAP_NONE}>None</SelectItem>
                    {mapHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Filter column (optional)</Label>
                <Select
                  value={filterCol}
                  onValueChange={(v) => {
                    setFilterCol(v);
                    setMappingFilterValue("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None — no filter" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                    <SelectItem value={MAP_NONE}>None</SelectItem>
                    {mapHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {filterCol !== MAP_NONE && (
                  <div className="space-y-2 pt-1">
                    <Label>Value to import</Label>
                    <Select
                      value={mappingFilterValue || undefined}
                      onValueChange={setMappingFilterValue}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a value…" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-[min(280px,50vh)]">
                        {dialogFilterOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Only rows with this value in “{filterCol}” are imported. Empty cells appear as “(empty)”.
                    </p>
                  </div>
                )}

                {filterCol === MAP_NONE ? (
                  <p className="text-[11px] text-muted-foreground">
                    Leave as none to import every valid row from the file.
                  </p>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="images" className="mt-4 flex flex-col gap-2 min-h-0 data-[state=inactive]:hidden">
              <p className="text-xs text-muted-foreground">
                Select one or more columns that contain image URLs (same row can use multiple columns).
              </p>
              <ScrollArea className="h-[min(280px,42vh)] rounded-lg border border-border bg-muted/20">
                <div className="p-3 space-y-2">
                  {mapHeaders.map((h) => (
                    <label key={h} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={imageCols.has(h)}
                        onChange={() => toggleImageCol(h)}
                        className="rounded border-input shrink-0"
                      />
                      <span className="truncate min-w-0">{h}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              {imageCols.size === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Select at least one column to continue.</p>
              )}
            </TabsContent>
          </Tabs>

          {mappingError && <p className="text-sm text-destructive shrink-0">{mappingError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMappingOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmMapping}
              disabled={
                isProcessing ||
                imageCols.size === 0 ||
                (filterCol !== MAP_NONE && !mappingFilterValue)
              }
            >
              Import products
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Set Product Folder Card - shows a set with nested variant cards      */
/* ------------------------------------------------------------------ */
function SetProductFolderCard({
  folder,
  onRemove,
  onRemoveVariant,
  onProductInfoChange,
}: {
  folder: SetProductFolder;
  onRemove: (id: string) => void;
  onRemoveVariant: (folderId: string, variantId: string) => void;
  onProductInfoChange?: (folderId: string, info: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const totalImages = folder.variants.reduce((sum, v) => sum + v.images.length, 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-colors duration-200 hover:shadow-md">
      {/* Set Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 rounded-md hover:bg-muted transition-colors"
        >
          <svg className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <FolderOpen className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm font-medium text-foreground truncate flex-1">
          {folder.name}
        </p>
        <Badge variant="secondary" className="text-[11px] shrink-0">
          {folder.variants.length} variant{folder.variants.length !== 1 ? "s" : ""}
        </Badge>
        <Badge variant="outline" className="text-[11px] shrink-0">
          {totalImages} image{totalImages !== 1 ? "s" : ""}
        </Badge>
        <button
          onClick={() => onRemove(folder.id)}
          className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-2">
          {folder.variants.map((variant) => (
            <div key={variant.id} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <span className="text-xs font-medium text-foreground truncate flex-1">
                  {variant.name}
                </span>
                <Badge variant="outline" className="text-[11px]">
                  {variant.images.length} img{variant.images.length !== 1 ? "s" : ""}
                </Badge>
                <button
                  onClick={() => onRemoveVariant(folder.id, variant.id)}
                  className="p-0.5 rounded text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {variant.images.length > 0 && (
                <div className="p-2 flex gap-1.5 overflow-x-auto">
                  {variant.images.map((img) => (
                    <div
                      key={img.id}
                      className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt="Variant" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Product Info */}
          {onProductInfoChange && (
            <div className="pt-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Product Info
                </span>
              </div>
              <Textarea
                placeholder="e.g., 'Set of 3 cotton shirts in grey, blue, and maroon'..."
                value={folder.productInfo || ""}
                onChange={(e) => onProductInfoChange(folder.id, e.target.value)}
                rows={2}
                className="resize-none rounded-lg text-xs border-border bg-muted/20 focus:bg-background transition-colors"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Variant Card for single-mode set product                            */
/* ------------------------------------------------------------------ */
function SingleSetVariantCard({
  variant,
  onAddImages,
  onRemoveImage,
  onRemove,
  onRename,
}: {
  variant: SetVariantFolder;
  onAddImages: (variantId: string, files: File[]) => void;
  onRemoveImage: (variantId: string, imageId: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(variant.name);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) onAddImages(variant.id, files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [variant.id, onAddImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) onAddImages(variant.id, files);
    },
    [variant.id, onAddImages]
  );

  const saveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== variant.name) onRename(variant.id, trimmed);
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-colors duration-200 hover:shadow-md">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-sm">🏷️</span>
        {isEditing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="text-sm font-medium bg-transparent border-b border-primary outline-none flex-1 min-w-0"
          />
        ) : (
          <p className="text-sm font-medium text-foreground truncate flex-1">{variant.name}</p>
        )}
        <Badge variant="secondary" className="text-[11px] shrink-0">
          {variant.images.length} image{variant.images.length !== 1 ? "s" : ""}
        </Badge>
        <button
          onClick={() => { setEditName(variant.name); setIsEditing(true); }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onRemove(variant.id)}
          className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3">
        {variant.images.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {variant.images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30 transition-colors duration-200 hover:shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt="Variant" className="w-full h-full object-cover" />
                <button
                  onClick={() => onRemoveImage(variant.id, img.id)}
                  className="absolute top-1 right-1 p-0.5 rounded-lg bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/90"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors duration-200 text-muted-foreground hover:text-primary bg-muted/20 hover:bg-muted/50"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[11px] font-medium">Add</span>
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-muted/50 group"
          >
            <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <p className="text-xs text-muted-foreground">Drop images or click to upload</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main StepGarments component                                        */
/* ------------------------------------------------------------------ */

interface StepGarmentsProps {
  store: VTONStore;
}

export function StepGarments({ store }: StepGarmentsProps) {
  const {
    mode,
    featureMode,
    productCategory,
    setProductCategory,
    gender,
    setGender,
    garmentImages,
    onModelGarment,
    setOnModelGarment,
    garmentType,
    setGarmentType,
    footwearType,
    setFootwearType,
    fit,
    setFit,
    sleeveLength,
    setSleeveLength,
    topwearLength,
    setTopwearLength,
    bottomwearLength,
    setBottomwearLength,
    innerwearSubtype,
    setInnerwearSubtype,
    addGarmentImage,
    removeGarmentImage,
    toggleGarmentBackView,
    setGarmentImageFootwearSide,
    setGarmentImagePoseVariation,
    complementaryImages,
    addComplementaryImage,
    removeComplementaryImage,
    productInfo,
    setProductInfo,
    // Bulk mode
    primaryFolders,
    addPrimaryFolder,
    removePrimaryFolder,
    addImageToFolder,
    removeImageFromFolder,
    toggleFolderImageBackView,
    setFolderImageFootwearSide,
    renamePrimaryFolder,
    updatePrimaryFolderProductInfo,
    updatePrimaryFolderFit,
    updatePrimaryFolderSleeveLength,
    updatePrimaryFolderTopwearLength,
    updatePrimaryFolderBottomwearLength,
    setProductFolderPoseVariation,
    setProductFolderOnModelGarment,
    complementaryFolders,
    addComplementaryFolder,
    removeComplementaryFolder,
    renameComplementaryFolder,
    // Set Product
    setProductEnabled,
    setSetProductEnabled,
    setProductLayout,
    setSetProductLayout,
    setProductVariants,
    addSetProductVariant,
    removeSetProductVariant,
    renameSetProductVariant,
    addImageToSetVariant,
    removeImageFromSetVariant,
    setProductFolders,
    addSetProductFolder,
    removeSetProductFolder,
    updateSetProductFolderInfo,
    removeVariantFromSetFolder,
  } = store;

  const isModelSwap = featureMode === "model-swap";
  const isFootwear = productCategory === "footwear";

  const handleGarmentAdd = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = `garment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        addGarmentImage({
          id,
          file,
          preview: URL.createObjectURL(file),
          type: isFootwear ? footwearType : garmentType,
        });
      });
    },
    [addGarmentImage, garmentType, footwearType, isFootwear]
  );

  const handleComplementaryAdd = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = `comp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        addComplementaryImage({
          id,
          file,
          preview: URL.createObjectURL(file),
          label: file.name.split(".")[0],
        });
      });
    },
    [addComplementaryImage]
  );

  // --- Bulk mode handlers ---

  const handleAddEmptyPrimaryFolder = useCallback(() => {
    const id = `pf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addPrimaryFolder({
      id,
      name: `Product ${primaryFolders.length + 1}`,
      images: [],
    });
  }, [addPrimaryFolder, primaryFolders.length]);

  const handleAddEmptyComplementaryFolder = useCallback(() => {
    const id = `cf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addComplementaryFolder({
      id,
      name: `Complementary ${complementaryFolders.length + 1}`,
      images: [],
    });
  }, [addComplementaryFolder, complementaryFolders.length]);

  const handlePrimaryFoldersSelected = useCallback(
    (folders: { name: string; files: File[] }[]) => {
      for (const folder of folders) {
        const id = `pf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const images = folder.files.map((file) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
        }));
        addPrimaryFolder({ id, name: folder.name, images });
      }
    },
    [addPrimaryFolder]
  );

  const handleComplementaryFoldersSelected = useCallback(
    (folders: { name: string; files: File[] }[]) => {
      for (const folder of folders) {
        const id = `cf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const images = folder.files.map((file) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
        }));
        addComplementaryFolder({ id, name: folder.name, images });
      }
    },
    [addComplementaryFolder]
  );

  // --- Set Product handlers ---

  const handleSetFoldersSelected = useCallback(
    (sets: SetProductFolder[]) => {
      for (const set of sets) {
        addSetProductFolder(set);
      }
    },
    [addSetProductFolder]
  );

  const handleAddEmptyVariant = useCallback(() => {
    const id = `var-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addSetProductVariant({
      id,
      name: `Variant ${setProductVariants.length + 1}`,
      images: [],
    });
  }, [addSetProductVariant, setProductVariants.length]);

  // Shared sections: product category, gender, garment/footwear type, fit
  const sharedSettingsSection = (
    <>
      {/* Product Category Selection */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Product Category</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            What type of product are you photographing?
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {PRODUCT_CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setProductCategory(option.value)}
              className={cn(
                "relative flex items-center gap-3 px-5 py-4 rounded-xl text-left transition-all duration-200 border",
                productCategory === option.value
                  ? "bg-primary/5 border-primary/50 shadow-sm glow-border"
                  : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
              )}
            >
              {productCategory === option.value && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full btn-gradient flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div>
                <p className={cn(
                  "text-sm font-semibold",
                  productCategory === option.value ? "text-primary" : "text-foreground"
                )}>
                  {option.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Gender Selection */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Gender</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Who is this {isFootwear ? "footwear" : "garment"} designed for?
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {GENDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setGender(option.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border",
                gender === option.value
                  ? "btn-gradient text-white border-transparent shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground hover:shadow-sm"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Garment Type / Footwear Type Selection */}
      {isFootwear ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Footwear Type</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select the type of footwear you are uploading
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FOOTWEAR_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFootwearType(option.value)}
                className={cn(
                  "relative flex items-center gap-2.5 px-3.5 py-3 rounded-lg text-left transition-colors duration-200 border",
                  footwearType === option.value
                    ? "bg-card border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/50 hover:shadow-sm"
                )}
              >
                {footwearType === option.value && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
                <div className="min-w-0 pr-4">
                  <p className={cn(
                    "text-sm font-medium",
                    footwearType === option.value ? "text-primary" : "text-foreground"
                  )}>
                    {option.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Garment Type</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select the type of garment you are uploading
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {GARMENT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setGarmentType(type.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border",
                  garmentType === type.value
                    ? "btn-gradient text-white border-transparent shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground hover:shadow-sm"
                )}
              >
                {type.icon}
                {type.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fit Selection (clothing only) */}
      {!isFootwear && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Fit</h3>
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              How should the garment fit on the model? Leave unselected to let AI decide based on the garment images.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FIT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFit(fit === option.value ? null : option.value)}
                className={cn(
                  "relative flex flex-col items-start gap-0.5 px-3.5 py-3 rounded-lg text-left transition-colors duration-200 border",
                  fit === option.value
                    ? "bg-card border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/50 hover:shadow-sm"
                )}
              >
                {fit === option.value && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
                <p className={cn(
                  "text-sm font-medium",
                  fit === option.value ? "text-primary" : "text-foreground"
                )}>
                  {option.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight pr-4">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sleeve Length (clothing topwear / onepiece only) */}
      {!isFootwear && (garmentType === "topwear" || garmentType === "onepiece" || garmentType === "complete-outfit") && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Sleeve Length</h3>
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Lock the sleeve length. Leave unselected (Auto-Detect) to let AI infer it from the garment images.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SLEEVE_LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSleeveLength(sleeveLength === option.value ? null : option.value)}
                className={cn(
                  "relative flex flex-col items-start gap-0.5 px-3.5 py-3 rounded-lg text-left transition-colors duration-200 border",
                  sleeveLength === option.value
                    ? "bg-card border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/50 hover:shadow-sm",
                )}
              >
                {sleeveLength === option.value && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
                <p
                  className={cn(
                    "text-sm font-medium",
                    sleeveLength === option.value ? "text-primary" : "text-foreground",
                  )}
                >
                  {option.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight pr-4">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Hemline Length (clothing topwear / onepiece only) */}
      {!isFootwear && (garmentType === "topwear" || garmentType === "onepiece" || garmentType === "complete-outfit") && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Top Hemline Length</h3>
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Lock how far down the body the top extends. Leave unselected (Auto-Detect) to let AI infer it from the garment images.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TOPWEAR_LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setTopwearLength(topwearLength === option.value ? null : option.value)}
                className={cn(
                  "relative flex flex-col items-start gap-0.5 px-3.5 py-3 rounded-lg text-left transition-colors duration-200 border",
                  topwearLength === option.value
                    ? "bg-card border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/50 hover:shadow-sm",
                )}
              >
                {topwearLength === option.value && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
                <p
                  className={cn(
                    "text-sm font-medium",
                    topwearLength === option.value ? "text-primary" : "text-foreground",
                  )}
                >
                  {option.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight pr-4">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottomwear Outseam Length (clothing bottomwear / onepiece only) */}
      {!isFootwear && (garmentType === "bottomwear" || garmentType === "onepiece" || garmentType === "complete-outfit") && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Bottomwear Length</h3>
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Lock how far down the leg the bottomwear extends. Leave unselected (Auto-Detect) to let AI infer it from the garment images.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BOTTOMWEAR_LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setBottomwearLength(bottomwearLength === option.value ? null : option.value)}
                className={cn(
                  "relative flex flex-col items-start gap-0.5 px-3.5 py-3 rounded-lg text-left transition-colors duration-200 border",
                  bottomwearLength === option.value
                    ? "bg-card border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/50 hover:shadow-sm",
                )}
              >
                {bottomwearLength === option.value && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
                <p
                  className={cn(
                    "text-sm font-medium",
                    bottomwearLength === option.value ? "text-primary" : "text-foreground",
                  )}
                >
                  {option.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight pr-4">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Innerwear product form. Replaces the outseam length control, whose options
          (ankle / capri / shorts) are meaningless for this category — the hem or leg
          opening is pinned by the subtype's own anatomical anchor instead. */}
      {!isFootwear && garmentType === "innerwear" && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Innerwear Type</h3>
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Lock the product form so the cut and leg/sleeve opening cannot drift between generations. Leave unselected (Auto-Detect) to let AI infer it from the garment images.
            </p>
          </div>
          {(["Bottoms", "Tops", "Loungewear & Thermals"] as const).map((group) => (
            <div key={group} className="space-y-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {group}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {INNERWEAR_SUBTYPE_OPTIONS.filter((o) => o.group === group).map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setInnerwearSubtype(
                        innerwearSubtype === option.value ? null : option.value,
                      )
                    }
                    className={cn(
                      "relative flex flex-col items-start gap-0.5 px-3.5 py-3 rounded-lg text-left transition-colors duration-200 border",
                      innerwearSubtype === option.value
                        ? "bg-card border-primary shadow-sm"
                        : "bg-card border-border hover:border-primary/50 hover:shadow-sm",
                    )}
                  >
                    {innerwearSubtype === option.value && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                    <p
                      className={cn(
                        "text-sm font-medium",
                        innerwearSubtype === option.value ? "text-primary" : "text-foreground",
                      )}
                    >
                      {option.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight pr-4">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ======================================================================
  // MODEL SWAP - BULK MODE
  // ======================================================================
  if (isModelSwap && mode === "bulk") {
    return (
      <div className="space-y-8">
        {/* Gender Selection */}
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Gender</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              What gender are the models in your product photos?
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setGender(option.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                  gender === option.value
                    ? "btn-gradient text-white border-transparent shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Folders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  Product Images
                </h3>
                <Badge variant="secondary" className="text-xs">
                  Required
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Upload existing product photos with models. Each folder is one product.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FolderUploadButton target="primary" onFoldersSelected={handlePrimaryFoldersSelected} />
            <button
              onClick={handleAddEmptyPrimaryFolder}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Product Manually
            </button>
            {primaryFolders.length > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                {primaryFolders.length} product{primaryFolders.length !== 1 ? "s" : ""} &middot;{" "}
                {primaryFolders.reduce((sum, f) => sum + f.images.length, 0)} total images
              </span>
            )}
          </div>
          {primaryFolders.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {primaryFolders.map((folder) => (
                <ProductFolderCard
                  key={folder.id}
                  folder={folder}
                  target="primary"
                  onAddImages={addImageToFolder}
                  onRemoveImage={removeImageFromFolder}
                  onRemove={removePrimaryFolder}
                  onRename={renamePrimaryFolder}
                  onUploadFolder={() => {}}
                  onProductInfoChange={updatePrimaryFolderProductInfo}
                  onToggleBackView={!isModelSwap && !isFootwear ? toggleFolderImageBackView : undefined}
                  onSetFootwearSide={!isModelSwap && isFootwear ? setFolderImageFootwearSide : undefined}
                  isFootwear={isFootwear}
                  onTogglePoseVariation={isModelSwap ? setProductFolderPoseVariation : undefined}
                  onToggleOnModelGarment={!isModelSwap && !isFootwear ? setProductFolderOnModelGarment : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ======================================================================
  // MODEL SWAP - SINGLE MODE
  // ======================================================================
  if (isModelSwap && mode === "single") {
    return (
      <div className="space-y-8">
        {/* Gender Selection */}
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Gender</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              What gender is the model in your product photos?
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setGender(option.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                  gender === option.value
                    ? "btn-gradient text-white border-transparent shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Images Upload */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Product Images
            </h3>
            <Badge variant="secondary" className="text-xs">
              Required
            </Badge>
          </div>
          <ImageUploadZone
            images={garmentImages}
            onAdd={handleGarmentAdd}
            onRemove={removeGarmentImage}
            maxImages={6}
            label=""
            description="Upload existing product photos with models wearing clothes. The AI will swap the model while preserving the clothing and pose."
          />
        </div>

        {/* Per-image Pose Variation toggles (Model Swap single mode) */}
        {garmentImages.length > 0 && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">Pose Variation</h3>
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Toggle per image. {POSE_VARIATION_TOOLTIP}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {garmentImages.map((img) => (
                <div
                  key={img.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.preview}
                    alt={img.file.name}
                    className="w-12 h-12 rounded-md object-cover border border-border shrink-0"
                  />
                  <p className="flex-1 text-xs text-foreground truncate" title={img.file.name}>
                    {img.file.name}
                  </p>
                  <PoseVariationToggle
                    value={img.poseVariation === true}
                    onChange={(v) => setGarmentImagePoseVariation(img.id, v)}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* On-model garment (VTON clothing single mode) */}
        {!isFootwear && !isModelSwap && garmentImages.length > 0 && (
          <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-border bg-card p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={onModelGarment === true}
              onChange={(e) => setOnModelGarment(e.target.checked)}
            />
            <span className="text-xs leading-snug text-muted-foreground">
              <span className="font-medium text-foreground">Garment images are on-model</span> — worn by a person. Strips the wearer so your chosen AI model appears in the output (not the person in the input images).
            </span>
          </label>
        )}

        {/* Product Info */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Product Info</h3>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Product-specific details like fabric, key features, or selling points that should be reflected in the generated image
            </p>
          </div>
          <Textarea
            placeholder="e.g., 'Pure cotton fabric with handloom weave', 'Premium leather with anti-slip sole', 'Key selling points: breathable, lightweight'..."
            value={productInfo}
            onChange={(e) => setProductInfo(e.target.value)}
            rows={3}
            className="resize-none rounded-lg border-border bg-muted/20 focus:bg-background transition-colors"
          />
        </div>
      </div>
    );
  }

  // ======================================================================
  // VTON - BULK MODE
  // ======================================================================
  if (mode === "bulk") {
    return (
      <div className="space-y-8">
        {sharedSettingsSection}

        {/* ─── Set Product Toggle ─── */}
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Product Type</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Are you photographing individual products or set/combo packs?
            </p>
          </div>
          <div className="flex items-center rounded-lg border border-border bg-muted/20 p-1 self-start backdrop-blur-sm w-fit">
            <button
              onClick={() => setSetProductEnabled(false)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors duration-200",
                !setProductEnabled
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Individual
            </button>
            <button
              onClick={() => setSetProductEnabled(true)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors duration-200",
                setProductEnabled
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Set / Combo
            </button>
          </div>
        </div>

        {setProductEnabled ? (
          <>
            {/* ─── Set Layout Style ─── */}
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Layout Style</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  How should variants be arranged in the composite image?
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {SET_LAYOUT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSetProductLayout(option.value)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border",
                      setProductLayout === option.value
                        ? "btn-gradient text-white border-transparent shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Set Product Folders ─── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      Set Products
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Upload a folder with this structure: Root / SetName / VariantName / images.
                    Each set should have 2-5 variant subfolders.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <SetFolderUploadButton onSetsSelected={handleSetFoldersSelected} />
                {setProductFolders.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {setProductFolders.length} set{setProductFolders.length !== 1 ? "s" : ""} &middot;{" "}
                    {setProductFolders.reduce((sum, f) => sum + f.variants.length, 0)} total variants
                  </span>
                )}
              </div>
              {setProductFolders.length > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  {setProductFolders.map((folder) => (
                    <SetProductFolderCard
                      key={folder.id}
                      folder={folder}
                      onRemove={removeSetProductFolder}
                      onRemoveVariant={removeVariantFromSetFolder}
                      onProductInfoChange={updateSetProductFolderInfo}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* ─── Primary Garment Folders (original bulk flow) ─── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {isFootwear ? "Primary Footwear Products" : "Primary Garment Products"}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Each product is a folder containing multiple images of the same {isFootwear ? "footwear" : "garment"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <FolderUploadButton target="primary" onFoldersSelected={handlePrimaryFoldersSelected} />
                <button
                  onClick={handleAddEmptyPrimaryFolder}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Product Manually
                </button>
                <BulkSpreadsheetImportSection store={store} />
                {primaryFolders.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {primaryFolders.length} product{primaryFolders.length !== 1 ? "s" : ""} &middot;{" "}
                    {primaryFolders.reduce((sum, f) => sum + f.images.length, 0)} total images
                  </span>
                )}
              </div>
              {primaryFolders.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {primaryFolders.map((folder) => (
                    <ProductFolderCard
                      key={folder.id}
                      folder={folder}
                      target="primary"
                      onAddImages={addImageToFolder}
                      onRemoveImage={removeImageFromFolder}
                      onRemove={removePrimaryFolder}
                      onRename={renamePrimaryFolder}
                      onUploadFolder={() => {}}
                      onProductInfoChange={updatePrimaryFolderProductInfo}
                      onToggleBackView={!isFootwear ? toggleFolderImageBackView : undefined}
                      onSetFootwearSide={isFootwear ? setFolderImageFootwearSide : undefined}
                      garmentType={garmentType}
                      globalFit={fit}
                      globalSleeveLength={sleeveLength}
                      globalTopwearLength={topwearLength}
                      globalBottomwearLength={bottomwearLength}
                      onFitChange={updatePrimaryFolderFit}
                      onSleeveLengthChange={updatePrimaryFolderSleeveLength}
                      onTopwearLengthChange={updatePrimaryFolderTopwearLength}
                      onBottomwearLengthChange={updatePrimaryFolderBottomwearLength}
                      isFootwear={isFootwear}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ─── Complementary Garment Folders ─── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {isFootwear ? "Complementary Item Products" : "Complementary Garment Products"}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      Optional
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isFootwear
                      ? "Add matching pants, socks, or pairing items. Each folder is one complementary product."
                      : "Add matching bottoms, tops, or layering pieces. Each folder is one complementary product."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <FolderUploadButton target="complementary" onFoldersSelected={handleComplementaryFoldersSelected} />
                <button
                  onClick={handleAddEmptyComplementaryFolder}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Product Manually
                </button>
                {complementaryFolders.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {complementaryFolders.length} product{complementaryFolders.length !== 1 ? "s" : ""} &middot;{" "}
                    {complementaryFolders.reduce((sum, f) => sum + f.images.length, 0)} total images
                  </span>
                )}
              </div>
              {complementaryFolders.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {complementaryFolders.map((folder) => (
                    <ProductFolderCard
                      key={folder.id}
                      folder={folder}
                      target="complementary"
                      onAddImages={addImageToFolder}
                      onRemoveImage={removeImageFromFolder}
                      onRemove={removeComplementaryFolder}
                      onRename={renameComplementaryFolder}
                      onUploadFolder={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ======================================================================
  // SINGLE MODE (original)
  // ======================================================================
  return (
    <div className="space-y-8">
      {sharedSettingsSection}

      {/* Set Product Toggle */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Product Type</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Are you photographing a single product or a set/combo pack?
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-border bg-muted/20 p-1 self-start backdrop-blur-sm w-fit">
          <button
            onClick={() => setSetProductEnabled(false)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors duration-200",
              !setProductEnabled
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Individual
          </button>
          <button
            onClick={() => setSetProductEnabled(true)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors duration-200",
              setProductEnabled
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Set / Combo
          </button>
        </div>
      </div>

      {setProductEnabled ? (
        <>
          {/* Set Layout Style */}
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Layout Style</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                How should variants be arranged in the composite image?
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {SET_LAYOUT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSetProductLayout(option.value)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border",
                    setProductLayout === option.value
                      ? "btn-gradient text-white border-transparent shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground hover:shadow-sm"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Variant Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">Variants</h3>
                  <Badge variant="secondary" className="text-xs">
                    Min 2 required
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Add 2-5 color/style variants of the same product. Each variant gets its own images.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleAddEmptyVariant}
                disabled={setProductVariants.length >= 5}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Variant
              </button>
              {setProductVariants.length > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  {setProductVariants.length} variant{setProductVariants.length !== 1 ? "s" : ""} &middot;{" "}
                  {setProductVariants.reduce((sum, v) => sum + v.images.length, 0)} total images
                </span>
              )}
            </div>
            {setProductVariants.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {setProductVariants.map((variant) => (
                  <SingleSetVariantCard
                    key={variant.id}
                    variant={variant}
                    onAddImages={addImageToSetVariant}
                    onRemoveImage={removeImageFromSetVariant}
                    onRemove={removeSetProductVariant}
                    onRename={renameSetProductVariant}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">Product Info</h3>
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Describe the set — e.g., &quot;Set of 3 cotton shirts in grey, blue, and maroon&quot;
              </p>
            </div>
            <Textarea
              placeholder="e.g., 'Set of 3 cotton shirts, slim fit, spread collar, available in grey, blue, and maroon'..."
              value={productInfo}
              onChange={(e) => setProductInfo(e.target.value)}
              rows={3}
              className="resize-none rounded-lg border-border bg-muted/20 focus:bg-background transition-colors"
            />
          </div>
        </>
      ) : (
        <>
          {/* Primary Product Upload */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {isFootwear ? "Primary Footwear Images" : "Primary Garment Images"}
              </h3>
              <Badge variant="secondary" className="text-xs">
                Required
              </Badge>
            </div>
            <ImageUploadZone
              images={garmentImages}
              onAdd={handleGarmentAdd}
              onRemove={removeGarmentImage}
              onToggleBackView={!isModelSwap && !isFootwear ? toggleGarmentBackView : undefined}
              onSetFootwearSide={!isModelSwap && isFootwear ? setGarmentImageFootwearSide : undefined}
              maxImages={6}
              label=""
              description={
                isFootwear
                  ? "Upload multiple angles of the same footwear. Hover an image and click 'Set Side' to cycle through Medial / Lateral / Sole — helps the model render each side correctly."
                  : "Upload multiple angles of the same garment for better results. Hover an image and click 'Set Back' to mark the back-view photo."
              }
            />
          </div>

          {/* Complementary Items */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {isFootwear ? "Complementary Items" : "Complementary Garments"}
              </h3>
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            </div>
            <ImageUploadZone
              images={complementaryImages}
              onAdd={handleComplementaryAdd}
              onRemove={removeComplementaryImage}
              maxImages={4}
              label=""
              description={
                isFootwear
                  ? "Add matching pants, socks, or other items to pair with the footwear"
                  : "Add a matching bottom, top, or layering piece to complete the outfit"
              }
              compact
            />
          </div>

          {/* Product Info */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">Product Info</h3>
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Product-specific details like fabric, key features, or selling points that should be reflected in the generated image
              </p>
            </div>
            <Textarea
              placeholder="e.g., 'Pure cotton fabric with handloom weave', 'Premium leather with anti-slip sole', 'Key selling points: breathable, lightweight'..."
              value={productInfo}
              onChange={(e) => setProductInfo(e.target.value)}
              rows={3}
              className="resize-none rounded-lg"
            />
          </div>

          {/* Per-Product Fit (clothing only, single mode convenience) */}
          {!isFootwear && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">Product Fit</h3>
                  <Badge variant="outline" className="text-xs">Optional</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Override the global fit for this product. Leave unselected to let AI decide.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {FIT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFit(fit === option.value ? null : option.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                      fit === option.value
                        ? "bg-primary/10 border-primary/50 text-primary"
                        : "bg-muted/20 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
