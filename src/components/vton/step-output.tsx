"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BarChart3, Camera, Check, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff, Filter, GripVertical, ImageIcon, Loader2, Lock, Package, Plus, RefreshCw, ShieldCheck, ShieldOff, Sparkles, Trash2, Upload, User, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCESSORY_CATEGORIES, ASPECT_RATIOS, DEFAULT_PRODUCT_FILL_PERCENT, FRAMING_OPTIONS, isPoseRelevantTo, POSES, FOOTWEAR_POSES, PRODUCT_FILL_PERCENT_MAX, PRODUCT_FILL_PERCENT_MIN, UGC_SHOT_TYPE_OPTIONS, UGC_SCENE_PRESETS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AccessoryCategory, AccessoryItem, CustomPose, CustomPoseShotKind, FootwearType, GarmentType, InfographicFidelity, InfographicPlan, InfographicPoseConfig, InfographicTextMode, InfographicTextPoint, NamingLogic, Pose, PoseFraming, PoseViewAngle, PropBucket, ReferenceImageItem, ReferencePhotoshootMode, UGCScene, UGCShotType } from "@/lib/types";
import { customPoseIsInfographic, customPoseNeedsModel, customPoseShotKind } from "@/lib/custom-pose";
import type { VTONStore } from "@/store/vton-store";
import { GLOBAL_ACCESSORY_POSE_ID } from "@/store/vton-store";
import { importReferenceFolders } from "@/lib/reference-folder-import";
import { analyzeInfographicReference } from "@/lib/gemini";
import { ImageUploadZone } from "./image-upload-zone";
import { Layers } from "lucide-react";

const CLOTHING_VIEW_ANGLE_GROUPS: { viewAngle: PoseViewAngle; label: string; description: string }[] = [
  { viewAngle: "front", label: "Front", description: "Camera facing the model" },
  { viewAngle: "three-quarter-front", label: "¾ Front", description: "Angled front view" },
  { viewAngle: "side", label: "Side", description: "Full profile view" },
  { viewAngle: "three-quarter-back", label: "¾ Back", description: "Angled rear view" },
  { viewAngle: "back", label: "Back", description: "Camera behind the model" },
  { viewAngle: "ghost", label: "Ghost Mannequin", description: "No visible model — garment shaped as if worn" },
];

const FOOTWEAR_VIEW_ANGLE_GROUPS: { viewAngle: PoseViewAngle; label: string; description: string }[] = [
  { viewAngle: "front", label: "Front (0°)", description: "Camera facing the toe box" },
  { viewAngle: "three-quarter-front", label: "45° Front", description: "Angled ~45° — classic hero angle" },
  { viewAngle: "side", label: "Side (90°)", description: "Lateral & medial profile" },
  { viewAngle: "three-quarter-back", label: "45° Back", description: "Angled ~135° — rear three-quarter" },
  { viewAngle: "back", label: "Back (180°)", description: "Camera facing the heel" },
  { viewAngle: "top-down", label: "Top-Down", description: "Bird's eye / overhead view" },
  { viewAngle: "bottom", label: "Bottom", description: "Sole / outsole view" },
];

const FRAMING_ORDER: PoseFraming[] = [
  "ghost-mannequin",
  "product-only",
  "full-body",
  "three-quarter",
  "mid-thigh",
  "waist-up",
  "bust-up",
  "hip-down",
  "knee-down",
  "waist-to-thigh",
  "cropped-shot",
  "feet-closeup",
];

function getFramingLabel(framing: PoseFraming): string {
  return FRAMING_OPTIONS.find((f) => f.value === framing)?.label ?? framing;
}

function getFramingDescription(framing: PoseFraming): string {
  return FRAMING_OPTIONS.find((f) => f.value === framing)?.description ?? "";
}

function getFramingShortLabel(framing: PoseFraming): string {
  return FRAMING_OPTIONS.find((f) => f.value === framing)?.shortLabel ?? framing;
}

function PoseThumbnail({ poseId, icon, isFootwear }: { poseId: string; icon: string; isFootwear: boolean }) {
  const [imgError, setImgError] = useState(false);

  if (isFootwear || imgError) {
    return <span className="text-xl">{icon}</span>;
  }

  return (
    <div className="relative w-28 h-28 rounded-lg overflow-hidden bg-muted/30">
      <Image
        src={`/poses/${poseId}.png`}
        alt={poseId}
        width={112}
        height={112}
        className="object-cover w-full h-full"
        onError={() => setImgError(true)}
        unoptimized
      />
    </div>
  );
}

function PoseMiniThumbnail({
  poseId,
  icon,
  name,
  framing,
  viewAngle,
  isFootwear,
  onRemove,
}: {
  poseId: string;
  icon: string;
  name: string;
  framing: PoseFraming;
  viewAngle: string;
  isFootwear: boolean;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const framingLabel = getFramingLabel(framing);

  if (isFootwear || imgError) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="group/mini relative shrink-0">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary text-base cursor-default">
              {icon}
            </span>
            <div
              role="button"
              tabIndex={0}
              onClick={onRemove}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRemove(e as unknown as React.MouseEvent); } }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/mini:opacity-100 transition-opacity shadow-sm cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-center">
          <p className="font-semibold">{name}</p>
          <p className="text-[11px] opacity-80">{viewAngle} &middot; {framingLabel}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="group/mini relative shrink-0">
          <div
            className="w-10 h-10 rounded-lg overflow-hidden border-2 border-primary/25 bg-muted/30 cursor-default transition-colors hover:border-primary/50 hover:shadow-sm"
          >
            <Image
              src={`/poses/${poseId}.png`}
              alt={name}
              width={40}
              height={40}
              className="object-cover w-full h-full"
              onError={() => setImgError(true)}
              unoptimized
            />
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={onRemove}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRemove(e as unknown as React.MouseEvent); } }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/mini:opacity-100 transition-opacity shadow-sm cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-center">
        <p className="font-semibold">{name}</p>
        <p className="text-[11px] opacity-80">{viewAngle} &middot; {framingLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline accessory image upload slot                                 */
/* ------------------------------------------------------------------ */
function AccessoryImageSlot({
  poseId,
  category,
  label,
  icon,
  image,
  onUpload,
  onRemoveImage,
}: {
  poseId: string;
  category: AccessoryCategory;
  label: string;
  icon: string;
  image?: { file: File; preview: string };
  onUpload: (poseId: string, category: AccessoryCategory, file: File) => void;
  onRemoveImage: (poseId: string, category: AccessoryCategory) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(poseId, category, file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [poseId, category, onUpload]
  );

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3 transition-colors duration-200 hover:shadow-sm">
      {image ? (
        <div className="group relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.preview}
            alt={label}
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => onRemoveImage(poseId, category)}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      ) : (
        <div className="w-14 h-14 rounded-lg bg-muted border border-dashed border-primary/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary/60" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <span>{icon}</span>
          {label}
        </p>
        {image ? (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {image.file.name}
          </p>
        ) : (
          <p className="text-[11px] text-primary/70 font-medium mt-0.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI will choose the best match
          </p>
        )}
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        className={cn(
          "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
          image
            ? "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            : "bg-muted/50 text-primary border-primary/20 hover:bg-primary/10"
        )}
      >
        {image ? (
          <>
            <ImageIcon className="w-3 h-3" />
            Replace
          </>
        ) : (
          <>
            <Upload className="w-3 h-3" />
            Upload
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom accessory card (text description + optional image)          */
/* ------------------------------------------------------------------ */
function CustomAccessoryCard({
  poseId,
  accessory,
  onUpdateDescription,
  onUploadImage,
  onRemoveImage,
  onRemove,
}: {
  poseId: string;
  accessory: AccessoryItem;
  onUpdateDescription: (poseId: string, accessoryId: string, description: string) => void;
  onUploadImage: (poseId: string, accessoryId: string, file: File) => void;
  onRemoveImage: (poseId: string, accessoryId: string) => void;
  onRemove: (poseId: string, accessoryId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUploadImage(poseId, accessory.id, file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [poseId, accessory.id, onUploadImage]
  );

  return (
    <div className="rounded-lg border border-dashed border-violet-400/40 bg-violet-500/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Custom Accessory
        </p>
        <button
          onClick={() => onRemove(poseId, accessory.id)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <Textarea
        placeholder="Describe the accessory (e.g., 'gold jhumka earrings with pearl drops' or 'brown leather kolhapuri sandals')..."
        value={accessory.customDescription || ""}
        onChange={(e) => onUpdateDescription(poseId, accessory.id, e.target.value)}
        className="min-h-[60px] text-xs resize-none"
      />

      <div className="flex items-center gap-3">
        {accessory.image ? (
          <div className="group relative w-12 h-12 rounded-lg overflow-hidden border border-border shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={accessory.image.preview}
              alt="Custom accessory"
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => onRemoveImage(poseId, accessory.id)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        ) : null}
        <button
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            accessory.image
              ? "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              : "bg-muted/50 text-violet-700 dark:text-violet-400 border-violet-400/20 hover:bg-violet-500/10"
          )}
        >
          {accessory.image ? (
            <>
              <ImageIcon className="w-3 h-3" />
              Replace Image
            </>
          ) : (
            <>
              <Upload className="w-3 h-3" />
              Add Reference Image
            </>
          )}
        </button>
        {!accessory.image && (
          <span className="text-[10px] text-muted-foreground">Optional</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

/**
 * Builds the per-pose header label for the accessories/props panel, e.g.
 * "Dynamic: Front full-body" — combining the pose type, view-angle label, and
 * framing so each pose is distinguishable when assigning props (Dynamic poses
 * would otherwise all read "Dynamic").
 */
function formatPoseDescriptor(pose: Pose, isFootwear: boolean): string {
  const groups = isFootwear ? FOOTWEAR_VIEW_ANGLE_GROUPS : CLOTHING_VIEW_ANGLE_GROUPS;
  const angle = groups.find((g) => g.viewAngle === pose.viewAngle)?.label ?? pose.viewAngle;
  const type = pose.poseType ?? "standard";
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  return `${typeLabel}: ${angle} ${pose.framing}`;
}

/* ------------------------------------------------------------------ */
/*  Accessories panel for a single pose                                */
/* ------------------------------------------------------------------ */
function PoseAccessoriesPanel({
  poseId,
  poseName,
  poseIcon,
  accessories,
  toggleAccessory,
  setAccessoryImage,
  removeAccessoryImage,
  addCustomAccessory,
  updateCustomAccessoryDescription,
  removeCustomAccessory,
  setCustomAccessoryImage,
  removeCustomAccessoryImage,
  propBuckets = [],
  togglePoseBucket,
  isFootwear = false,
}: {
  poseId: string;
  poseName: string;
  poseIcon: string;
  accessories: AccessoryItem[];
  toggleAccessory: (poseId: string, category: AccessoryCategory) => void;
  setAccessoryImage: (poseId: string, category: AccessoryCategory, file: File) => void;
  removeAccessoryImage: (poseId: string, category: AccessoryCategory) => void;
  addCustomAccessory: (poseId: string, description?: string, image?: { file: File; preview: string }) => void;
  updateCustomAccessoryDescription: (poseId: string, accessoryId: string, description: string) => void;
  removeCustomAccessory: (poseId: string, accessoryId: string) => void;
  setCustomAccessoryImage: (poseId: string, accessoryId: string, file: File) => void;
  removeCustomAccessoryImage: (poseId: string, accessoryId: string) => void;
  /** User-created prop buckets surfaced as per-pose toggles. */
  propBuckets?: PropBucket[];
  togglePoseBucket?: (poseId: string, bucketId: string) => void;
  isFootwear?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const isBucketSelected = (bucketId: string) =>
    accessories.some((a) => a.bucketId === bucketId);

  const filteredCategories = isFootwear
    ? ACCESSORY_CATEGORIES.filter((c) => c.value !== "shoes")
    : ACCESSORY_CATEGORIES;

  // Bucket-backed accessories (those carrying a `bucketId`) are surfaced ONLY as
  // the dedicated prop-bucket toggle chips below — never as a category image slot
  // or a Custom Accessory card. A bucket inherits its parent bucket's `category`
  // (which is `"custom"` for a Generic Prop bucket), so WITHOUT this guard a
  // selected Generic-Prop bucket would wrongly render as a custom-accessory
  // dialogue, and a typed-category bucket would wrongly light up its category chip.
  const presetAccessories = accessories.filter((a) => !a.bucketId && a.category !== "custom");
  const customAccessories = accessories.filter((a) => !a.bucketId && a.category === "custom");

  const isAccessorySelected = (category: AccessoryCategory) =>
    accessories.some((a) => !a.bucketId && a.category === category);

  const getAccessoryItem = (category: AccessoryCategory) =>
    accessories.find((a) => !a.bucketId && a.category === category);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden transition-colors duration-200 hover:shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{poseIcon}</span>
          <span className="text-sm font-medium text-foreground">{poseName}</span>
          {accessories.length > 0 && (
            <Badge variant="secondary" className="text-[11px]">
              {accessories.length} accessor{accessories.length !== 1 ? "ies" : "y"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {accessories.length > 0 && (
            <div className="flex -space-x-1">
              {accessories.slice(0, 4).map((acc) => {
                const catInfo = ACCESSORY_CATEGORIES.find((c) => c.value === acc.category);
                return (
                  <span key={acc.id} className="text-xs" title={catInfo?.label || "Custom"}>
                    {catInfo?.icon || "✦"}
                  </span>
                );
              })}
              {accessories.length > 4 && (
                <span className="text-[11px] text-muted-foreground ml-1">
                  +{accessories.length - 4}
                </span>
              )}
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <p className="text-xs text-muted-foreground pt-3">
            Select accessories for this pose. Upload an exact image or let AI choose.
          </p>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5">
            {filteredCategories.map((cat) => {
              const selected = isAccessorySelected(cat.value);
              const item = getAccessoryItem(cat.value);
              const hasImage = !!item?.image;
              return (
                <button
                  key={cat.value}
                  onClick={() => toggleAccessory(poseId, cat.value)}
                  className={cn(
                    "group relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border",
                    selected
                      ? hasImage
                        ? "bg-primary/10 text-primary border-primary/40 shadow-sm"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <span className="text-xs">{cat.icon}</span>
                  {cat.label}
                  {selected && (
                    <span className={cn(
                      "ml-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px]",
                      hasImage
                        ? "bg-primary text-primary-foreground"
                        : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                    )}>
                      {hasImage ? <Check className="w-2 h-2" /> : <Sparkles className="w-2 h-2" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Prop bucket toggles — one image is drawn at random per product */}
          {propBuckets.length > 0 && togglePoseBucket && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                Prop buckets — select one or more; a reference image is sampled per product and the prop is replicated exactly in the shot
              </p>
              <div className="flex flex-wrap gap-1.5">
                {propBuckets.map((bucket) => {
                  const selected = isBucketSelected(bucket.id);
                  const empty = bucket.images.length === 0;
                  return (
                    <button
                      key={bucket.id}
                      onClick={() => togglePoseBucket(poseId, bucket.id)}
                      disabled={empty}
                      title={empty ? "Add images to this bucket first" : undefined}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border",
                        empty && "opacity-50 cursor-not-allowed",
                        selected
                          ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/40 shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:border-indigo-400/30 hover:text-foreground"
                      )}
                    >
                      <Layers className="w-3 h-3" />
                      {bucket.name || "Bucket"} ({bucket.images.length})
                      {selected && (
                        <span className="ml-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] bg-indigo-500 text-white">
                          <Check className="w-2 h-2" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected preset accessories image upload slots */}
          {presetAccessories.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                {presetAccessories.filter((a) => a.image).length} with uploaded image
                {presetAccessories.filter((a) => !a.image).length > 0 && (
                  <> &middot; {presetAccessories.filter((a) => !a.image).length} AI-chosen</>
                )}
              </p>
              <div className="grid gap-2">
                {presetAccessories.map((acc) => {
                  const catInfo = ACCESSORY_CATEGORIES.find((c) => c.value === acc.category);
                  if (!catInfo) return null;
                  return (
                    <AccessoryImageSlot
                      key={acc.category}
                      poseId={poseId}
                      category={acc.category}
                      label={catInfo.label}
                      icon={catInfo.icon}
                      image={acc.image}
                      onUpload={setAccessoryImage}
                      onRemoveImage={removeAccessoryImage}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom accessories */}
          {customAccessories.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground font-medium">
                Custom Accessories ({customAccessories.length})
              </p>
              <div className="grid gap-2">
                {customAccessories.map((acc) => (
                  <CustomAccessoryCard
                    key={acc.id}
                    poseId={poseId}
                    accessory={acc}
                    onUpdateDescription={updateCustomAccessoryDescription}
                    onUploadImage={setCustomAccessoryImage}
                    onRemoveImage={removeCustomAccessoryImage}
                    onRemove={removeCustomAccessory}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add custom accessory button */}
          <button
            onClick={() => addCustomAccessory(poseId)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-dashed border-violet-400/30 text-violet-700 dark:text-violet-400 hover:bg-violet-500/5 hover:border-violet-400/50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Custom Accessory
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Prop bucket card (one named bucket: rename, category, images)      */
/* ------------------------------------------------------------------ */
const BUCKET_CATEGORY_OPTIONS: { value: AccessoryCategory | "custom"; label: string; icon: string }[] = [
  { value: "custom", label: "Generic Prop", icon: "✦" },
  ...ACCESSORY_CATEGORIES.map((c) => ({ value: c.value, label: c.label, icon: c.icon })),
];

function PropBucketCard({
  bucket,
  renamePropBucket,
  setPropBucketCategory,
  addPropBucketImages,
  removePropBucketImage,
  deletePropBucket,
}: {
  bucket: PropBucket;
  renamePropBucket: (bucketId: string, name: string) => void;
  setPropBucketCategory: (bucketId: string, category: AccessoryCategory | "custom") => void;
  addPropBucketImages: (bucketId: string, files: File[]) => void;
  removePropBucketImage: (bucketId: string, imageIndex: number) => void;
  deletePropBucket: (bucketId: string) => void;
}) {
  // The shared ImageUploadZone keys/removes by id; map bucket images (which have
  // no stable id) to index-based ids for that contract.
  const zoneImages = bucket.images.map((img, i) => ({
    id: String(i),
    file: img.file,
    preview: img.preview,
  }));

  return (
    <div className="rounded-lg border border-indigo-400/30 bg-indigo-500/[0.03] p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <Input
          value={bucket.name}
          onChange={(e) => renamePropBucket(bucket.id, e.target.value)}
          placeholder="Bucket name (e.g. Footwear)"
          className="h-8 text-sm flex-1"
        />
        <select
          value={bucket.category}
          onChange={(e) => setPropBucketCategory(bucket.id, e.target.value as AccessoryCategory | "custom")}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
        >
          {BUCKET_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => deletePropBucket(bucket.id)}
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
          title="Delete bucket"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <ImageUploadZone
        images={zoneImages}
        onAdd={(files) => addPropBucketImages(bucket.id, files)}
        onRemove={(id) => removePropBucketImage(bucket.id, Number(id))}
        maxImages={20}
        label={`${bucket.images.length} reference image${bucket.images.length !== 1 ? "s" : ""}`}
        description="One of these is chosen at random per product at generation time."
        compact
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Prop bucket manager (create / manage named multi-image buckets)    */
/* ------------------------------------------------------------------ */
function PropBucketManager({
  propBuckets,
  createPropBucket,
  renamePropBucket,
  setPropBucketCategory,
  addPropBucketImages,
  removePropBucketImage,
  deletePropBucket,
}: {
  propBuckets: PropBucket[];
  createPropBucket: (name: string, category?: AccessoryCategory | "custom") => string;
  renamePropBucket: (bucketId: string, name: string) => void;
  setPropBucketCategory: (bucketId: string, category: AccessoryCategory | "custom") => void;
  addPropBucketImages: (bucketId: string, files: File[]) => void;
  removePropBucketImage: (bucketId: string, imageIndex: number) => void;
  deletePropBucket: (bucketId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-medium text-foreground">Prop Buckets</span>
          {propBuckets.length > 0 && (
            <Badge variant="secondary" className="text-[11px]">
              {propBuckets.length}
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <p className="text-xs text-muted-foreground pt-3">
            Create named buckets of interchangeable prop images (e.g. a
            &ldquo;Footwear&rdquo; bucket with 5 shoes). Each bucket can then be
            toggled under any pose; one image is drawn at random per product at
            generation, and the same draw is reused across that product&rsquo;s poses.
          </p>

          {propBuckets.map((bucket) => (
            <PropBucketCard
              key={bucket.id}
              bucket={bucket}
              renamePropBucket={renamePropBucket}
              setPropBucketCategory={setPropBucketCategory}
              addPropBucketImages={addPropBucketImages}
              removePropBucketImage={removePropBucketImage}
              deletePropBucket={deletePropBucket}
            />
          ))}

          <button
            onClick={() => createPropBucket(`Bucket ${propBuckets.length + 1}`)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-dashed border-indigo-400/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/5 hover:border-indigo-400/60"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Bucket
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Pose Card                                                    */
/* ------------------------------------------------------------------ */
/** Actions + analysis state the infographic shot kind needs, bundled to avoid prop sprawl. */
type InfographicCardApi = {
  setShotKind: (poseId: string, kind: CustomPoseShotKind) => void;
  updateConfig: (poseId: string, update: Partial<InfographicPoseConfig>) => void;
  setPlan: (poseId: string, plan: InfographicPlan | undefined) => void;
  addPoint: (poseId: string) => void;
  updatePoint: (
    poseId: string,
    pointId: string,
    update: Partial<Omit<InfographicTextPoint, "id">>
  ) => void;
  removePoint: (poseId: string, pointId: string) => void;
  setBrandLogo: (poseId: string, file: File) => void;
  clearBrandLogo: (poseId: string) => void;
  analyzing: Record<string, boolean>;
  errors: Record<string, string>;
  onAnalyze: (pose: CustomPose) => void;
  /** Bulk mode analyses are product-agnostic and re-specialised per product at generate time. */
  isBulk: boolean;
};

const INFOGRAPHIC_TEXT_MODES: {
  value: InfographicTextMode;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    value: "exact",
    label: "Exact Text",
    hint: "Your wording is printed verbatim — split into callouts, never reworded.",
    placeholder:
      "Paste the exact copy to print, one callout per line — e.g.\nBreathable Knit Upper\nOrtholite® Insole\nRubber Traction Outsole",
  },
  {
    value: "describe",
    label: "Describe Content",
    hint: "You say what the copy should convey; the AI writes it at callout length.",
    placeholder:
      "Describe what the text should get across — e.g. 'call out the cushioning tech, the breathable upper, and the grip on the outsole'...",
  },
  {
    value: "creative",
    label: "Creative Direction",
    hint: "A loose direction is expanded into explicit, product-grounded points.",
    placeholder:
      "Give a rough creative direction — e.g. 'premium everyday comfort, understated performance'. The AI derives concrete callouts from your product.",
  },
];

/* ------------------------------------------------------------------ */
/*  Infographic panel (shown inside CustomPoseCard)                     */
/* ------------------------------------------------------------------ */
function InfographicPanel({
  pose,
  api,
}: {
  pose: CustomPose;
  api: InfographicCardApi;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const config = pose.infographic;
  const plan = config?.plan;
  const isAnalyzing = api.analyzing[pose.id] === true;
  const error = api.errors[pose.id];
  const hasReference = pose.referenceImages.length > 0;
  const textMode = config?.textMode ?? "creative";
  const activeMode =
    INFOGRAPHIC_TEXT_MODES.find((m) => m.value === textMode) ?? INFOGRAPHIC_TEXT_MODES[2];

  const setFidelity = (fidelity: InfographicFidelity) =>
    api.updateConfig(pose.id, { fidelity });

  return (
    <>
      {/* Fidelity — only meaningful when there is a template to be faithful TO.
          With no reference the layout is authored from the operator's brief, so both
          modes would describe a relationship that does not exist. */}
      {hasReference && (
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Fidelity
        </label>
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => setFidelity("layout-lock")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
              (config?.fidelity ?? "layout-lock") === "layout-lock"
                ? "bg-violet-500/10 border-violet-500 text-violet-700 dark:text-violet-400"
                : "bg-card border-border text-muted-foreground hover:border-violet-500/30 hover:text-foreground"
            )}
          >
            <Lock className="w-4 h-4" />
            Layout Lock
          </button>
          <button
            onClick={() => setFidelity("inspiration")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
              config?.fidelity === "inspiration"
                ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400"
                : "bg-card border-border text-muted-foreground hover:border-amber-500/30 hover:text-foreground"
            )}
          >
            <Sparkles className="w-4 h-4" />
            Loose Inspiration
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {(config?.fidelity ?? "layout-lock") === "layout-lock"
            ? "The template's grid, callout placement and typographic hierarchy are copied precisely. The reference is also shown to the image model as a wireframe — never its product, copy or branding."
            : "The template informs style only — the layout is rebuilt around your product. The image model never sees the reference."}
        </p>
      </div>
      )}

      {/* Infographic Text */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Infographic Text
        </label>
        <div className="mt-1 flex gap-2">
          {INFOGRAPHIC_TEXT_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => api.updateConfig(pose.id, { textMode: m.value })}
              className={cn(
                "flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition-colors",
                textMode === m.value
                  ? "bg-violet-500/10 border-violet-500 text-violet-700 dark:text-violet-400"
                  : "bg-card border-border text-muted-foreground hover:border-violet-500/30 hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <textarea
          value={config?.textInput ?? ""}
          onChange={(e) => api.updateConfig(pose.id, { textInput: e.target.value })}
          placeholder={activeMode.placeholder}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
          rows={3}
        />
        <p className="text-[11px] text-muted-foreground mt-1">{activeMode.hint}</p>
      </div>

      {/* Brand Logo */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Brand Logo <span className="text-muted-foreground/50 normal-case">(optional)</span>
        </label>
        <div className="mt-1 flex items-start gap-2">
          {config?.brandLogo ? (
            <div className="group relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.brandLogo.preview}
                alt="Brand logo"
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => api.clearBrandLogo(pose.id)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => logoInputRef.current?.click()}
              className="w-16 h-16 shrink-0 rounded-lg border border-dashed border-violet-500/30 bg-muted flex flex-col items-center justify-center gap-0.5 text-violet-500/60 hover:text-violet-500 hover:border-violet-500/50 hover:bg-violet-500/10 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="text-[8px] font-medium">Logo</span>
            </button>
          )}
          <input
            value={config?.brandPlacementInstructions ?? ""}
            onChange={(e) =>
              api.updateConfig(pose.id, {
                brandPlacementInstructions: e.target.value || undefined,
              })
            }
            placeholder="Placement guidance — e.g. 'top-left header, small'"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) api.setBrandLogo(pose.id, file);
            if (logoInputRef.current) logoInputRef.current.value = "";
          }}
          className="hidden"
        />
      </div>

      {/* Analysis — the review step */}
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.03] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Text Points
          </label>
          <button
            onClick={() => api.onAnalyze(pose)}
            disabled={isAnalyzing}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              isAnalyzing
                ? "border-border text-muted-foreground/50 cursor-not-allowed"
                : "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-400 hover:bg-violet-500/20"
            )}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing...
              </>
            ) : plan ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Re-analyze
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                {hasReference ? "Analyze reference" : "Design layout"}
              </>
            )}
          </button>
        </div>

        {!hasReference && (
          <p className="text-[11px] text-muted-foreground">
            No reference attached — the layout will be designed from your position notes,
            background and infographic text. Attach one above to follow an existing design.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-500">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        {!plan && !isAnalyzing && !error && (
          <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              {hasReference ? "Analyze this reference" : "Run “Design layout”"} before
              generating — generation stays disabled until the text points are reviewed.
            </span>
          </div>
        )}

        {plan && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px]",
                  plan.includesModel
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                )}
              >
                {plan.includesModel ? "AI decided: with model" : "AI decided: product only"}
              </Badge>
              {api.isBulk && (
                <Badge variant="secondary" className="text-[10px]">
                  Re-specialized per product
                </Badge>
              )}
              {plan.editedSinceAnalysis && (
                <Badge variant="secondary" className="text-[10px]">
                  Edited
                </Badge>
              )}
            </div>

            {plan.layoutSummary && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {plan.layoutSummary}
              </p>
            )}

            <div className="space-y-1.5">
              {plan.points.map((pt, i) => (
                <div key={pt.id} className="flex items-start gap-1.5">
                  <span className="text-[11px] text-muted-foreground/60 w-4 shrink-0 pt-2 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <input
                      value={pt.text}
                      onChange={(e) =>
                        api.updatePoint(pose.id, pt.id, { text: e.target.value })
                      }
                      placeholder="On-image copy..."
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                    <input
                      value={pt.anchor ?? ""}
                      onChange={(e) =>
                        api.updatePoint(pose.id, pt.id, {
                          anchor: e.target.value || undefined,
                        })
                      }
                      placeholder="Points to... (e.g. the jacquard waistband)"
                      className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                    {/* Where the leader line will actually land. Surfaced so a callout
                        pointing at the wrong feature is caught here, before rendering. */}
                    {pt.anchor === "unanchored" ? (
                      <p className="text-[10px] text-muted-foreground/60 pl-0.5">
                        Unanchored — renders as a badge / footer item, no leader line
                      </p>
                    ) : pt.anchorPoint ? (
                      <p className="text-[10px] text-muted-foreground/60 pl-0.5 tabular-nums">
                        Leader line lands at x={pt.anchorPoint.x.toFixed(2)}, y=
                        {pt.anchorPoint.y.toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-500/80 pl-0.5">
                        No anchor point — placement is left to the image model
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => api.removePoint(pose.id, pt.id)}
                    className="shrink-0 p-1 mt-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => api.addPoint(pose.id)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-dashed border-violet-500/30 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add point
            </button>

            {plan.editedSinceAnalysis && (
              <p className="text-[11px] text-muted-foreground">
                Edited copy is locked verbatim and the composition is re-derived at generation
                time.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function CustomPoseCard({
  pose,
  onUpdate,
  onRemove,
  onAddImage,
  onRemoveImage,
  infographicApi,
}: {
  pose: CustomPose;
  onUpdate: (id: string, update: Partial<Omit<CustomPose, "id">>) => void;
  onRemove: (id: string) => void;
  onAddImage: (poseId: string, file: File) => void;
  onRemoveImage: (poseId: string, imageId: string) => void;
  infographicApi: InfographicCardApi;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shotKind = customPoseShotKind(pose);
  const isInfographic = shotKind === "infographic";

  const handleFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        Array.from(files).forEach((file) => onAddImage(pose.id, file));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [pose.id, onAddImage]
  );

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3 shadow-sm",
        isInfographic ? "border-violet-500/30" : "border-primary/20"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              isInfographic ? "bg-violet-500/10" : "bg-primary/10"
            )}
          >
            {isInfographic ? (
              <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary" />
            )}
          </div>
          <input
            type="text"
            value={pose.name}
            onChange={(e) => onUpdate(pose.id, { name: e.target.value })}
            placeholder={isInfographic ? "Infographic name..." : "Pose name..."}
            className="text-sm font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0 flex-1"
          />
        </div>
        <button
          onClick={() => onRemove(pose.id)}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Shot Type — Model / Product / Infographic */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Shot Type
        </label>
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => infographicApi.setShotKind(pose.id, "model")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-colors",
              shotKind === "model"
                ? "bg-primary/10 border-primary text-primary"
                : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            <User className="w-4 h-4" />
            Model Shot
          </button>
          <button
            onClick={() => infographicApi.setShotKind(pose.id, "product")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-colors",
              shotKind === "product"
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                : "bg-card border-border text-muted-foreground hover:border-emerald-500/30 hover:text-foreground"
            )}
          >
            <Package className="w-4 h-4" />
            Product Shot
          </button>
          <button
            onClick={() => infographicApi.setShotKind(pose.id, "infographic")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-colors",
              shotKind === "infographic"
                ? "bg-violet-500/10 border-violet-500 text-violet-700 dark:text-violet-400"
                : "bg-card border-border text-muted-foreground hover:border-violet-500/30 hover:text-foreground"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Infographic
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {shotKind === "model"
            ? "Human model will be included in the generated image"
            : shotKind === "product"
              ? "Only the product will be shown — no human model"
              : "A finished marketing asset with text baked in. Model presence, garment staging and background are decided from the reference and product."}
        </p>
      </div>

      {/* Description / Composition Notes */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          {isInfographic ? (
            <>
              Composition Notes{" "}
              <span className="text-muted-foreground/50 normal-case">(optional)</span>
            </>
          ) : (
            "Pose Description"
          )}
        </label>
        <textarea
          value={pose.description}
          onChange={(e) => onUpdate(pose.id, { description: e.target.value })}
          placeholder={
            isInfographic
              ? "Anything the layout must honour — e.g. 'keep the shoe angled toe-left', 'leave room for a headline across the top'..."
              : "Describe the pose in detail — body position, angle, stance, arm placement, weight distribution, mood..."
          }
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          rows={isInfographic ? 2 : 3}
        />
      </div>

      {/* Custom Background Composition */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Custom Background <span className="text-muted-foreground/50 normal-case">(optional — overrides global background for this pose)</span>
        </label>
        <textarea
          value={pose.customBackground || ""}
          onChange={(e) => onUpdate(pose.id, { customBackground: e.target.value || undefined })}
          placeholder="Describe a custom background/environment for this specific pose — e.g., 'urban sidewalk with wet pavement reflections at dusk', 'white infinity cove with soft gradient shadows'..."
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
          rows={2}
        />
      </div>

      {/* Product Frame Fill — authoritative override of the SUBJECT FILL contract field.
          Hidden for infographics, whose composition comes from the approved layout plan. */}
      {!isInfographic && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              Product Frame Fill{" "}
              <span className="text-muted-foreground/50 normal-case">
                (share of frame height the product fills)
              </span>
            </label>
            <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={pose.productFillPercent == null}
                onChange={(e) =>
                  onUpdate(pose.id, {
                    productFillPercent: e.target.checked
                      ? undefined
                      : DEFAULT_PRODUCT_FILL_PERCENT,
                  })
                }
                className="h-3 w-3 accent-emerald-500"
              />
              Lifestyle — no constraint
            </label>
          </div>
          {pose.productFillPercent == null ? (
            <p className="mt-1 text-[11px] text-muted-foreground/60">
              Framing is left to the pose description and reference image.
            </p>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={PRODUCT_FILL_PERCENT_MIN}
                max={PRODUCT_FILL_PERCENT_MAX}
                step={5}
                value={pose.productFillPercent}
                onChange={(e) =>
                  onUpdate(pose.id, { productFillPercent: Number(e.target.value) })
                }
                className="flex-1 accent-emerald-500"
              />
              <span className="w-10 text-right text-sm font-medium tabular-nums text-foreground">
                {pose.productFillPercent}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Reference Mode — replaced by the Fidelity toggle for infographics */}
      {!isInfographic && (
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Reference Mode
          </label>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => onUpdate(pose.id, { referenceMode: "pose" })}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                (pose.referenceMode ?? "pose") === "pose"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              <Sparkles className="w-4 h-4" />
              Pose Reference
            </button>
            <button
              onClick={() => onUpdate(pose.id, { referenceMode: "image" })}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                pose.referenceMode === "image"
                  ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400"
                  : "bg-card border-border text-muted-foreground hover:border-amber-500/30 hover:text-foreground"
              )}
            >
              <ImageIcon className="w-4 h-4" />
              Image Reference
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {(pose.referenceMode ?? "pose") === "pose"
              ? "Strict pose reference — only body geometry, camera angle, and image framing are copied. Background, accessories, garments, and model identity are ignored."
              : "Holistic inspiration — pose, scene, lighting, and mood are extracted in a product-agnostic manner. Background colors are adapted to contrast with and highlight your product."}
          </p>
        </div>
      )}

      {/* Reference Images */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          {isInfographic ? (
            <>
              Infographic Reference{" "}
              <span className="text-muted-foreground/50 normal-case">
                (template / inspiration — optional)
              </span>
            </>
          ) : (
            <>
              Reference Images{" "}
              <span className="text-muted-foreground/50 normal-case">(optional)</span>
            </>
          )}
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          {pose.referenceImages.map((img) => (
            <div
              key={img.id}
              className="group relative w-16 h-16 rounded-lg overflow-hidden border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt={isInfographic ? "Infographic reference" : "Pose reference"}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => onRemoveImage(pose.id, img.id)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-16 h-16 rounded-lg border border-dashed bg-muted flex flex-col items-center justify-center gap-0.5 transition-colors",
              isInfographic
                ? "border-violet-500/30 text-violet-500/60 hover:text-violet-500 hover:border-violet-500/50 hover:bg-violet-500/10"
                : "border-primary/30 text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/10"
            )}
          >
            <Upload className="w-4 h-4" />
            <span className="text-[8px] font-medium">Add</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </div>

      {isInfographic && <InfographicPanel pose={pose} api={infographicApi} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Poses Section                                                */
/* ------------------------------------------------------------------ */
function CustomPosesSection({
  customPoses,
  addCustomPose,
  removeCustomPose,
  updateCustomPose,
  addCustomPoseImage,
  removeCustomPoseImage,
  infographicApi,
}: {
  customPoses: CustomPose[];
  addCustomPose: (pose: CustomPose) => void;
  removeCustomPose: (id: string) => void;
  updateCustomPose: (id: string, update: Partial<Omit<CustomPose, "id">>) => void;
  addCustomPoseImage: (poseId: string, file: File) => void;
  removeCustomPoseImage: (poseId: string, imageId: string) => void;
  infographicApi: InfographicCardApi;
}) {
  const handleAddCustomPose = useCallback(() => {
    addCustomPose({
      id: `custom-pose-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "",
      description: "",
      isModelShot: true,
      shotKind: "model",
      referenceMode: "pose",
      referenceImages: [],
    });
  }, [addCustomPose]);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-foreground">Custom Poses</h3>
          {customPoses.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {customPoses.length} custom
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Create your own poses with text descriptions and optional reference images. These are sent to the AI alongside preset poses. Switch a card to <span className="font-medium text-violet-600 dark:text-violet-400">Infographic</span> to turn an uploaded infographic into a template for a finished marketing asset.
        </p>
      </div>

      {/* Custom Pose Cards */}
      {customPoses.length > 0 && (
        <div className="space-y-3">
          {customPoses.map((pose) => (
            <CustomPoseCard
              key={pose.id}
              pose={pose}
              onUpdate={updateCustomPose}
              onRemove={removeCustomPose}
              onAddImage={addCustomPoseImage}
              onRemoveImage={removeCustomPoseImage}
              infographicApi={infographicApi}
            />
          ))}
        </div>
      )}

      {/* Add Custom Pose Button */}
      <button
        onClick={handleAddCustomPose}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-primary/20 bg-muted text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors duration-200 text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Add Custom Pose
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reference-Driven Photoshoot (evolved custom-pose feature)          */
/* ------------------------------------------------------------------ */

const REFERENCE_PHOTOSHOOT_MODES: {
  value: ReferencePhotoshootMode;
  label: string;
  desc: string;
}[] = [
  {
    value: "variation",
    label: "Inspiration: Variation",
    desc: "Lock the reference's framing & camera distance (same crop, same subject distance). The pose is freshly re-invented and the background, model, garment & accessories follow your configuration.",
  },
  {
    value: "pose-lock",
    label: "Inspiration: Pose Lock",
    desc: "Lock the reference's framing AND pose exactly. Only the background, AI model & garment change per your configuration.",
  },
  {
    value: "replication",
    label: "Replication",
    desc: "Reproduce the reference exactly — background, lighting, pose & framing. Only the AI model, garment (always swapped) & accessories follow your configuration.",
  },
];

/** Thumbnail grid with add + per-item delete; optionally a single-select (pick one) mode. */
function ReferenceImageGrid({
  images,
  onAdd,
  onRemove,
  selectedId,
  onSelect,
  addLabel = "Add",
  emptyHint,
}: {
  images: ReferenceImageItem[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  /** When provided (even null), thumbnails become single-select (pick one). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  addLabel?: string;
  emptyHint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectable = selectedId !== undefined && !!onSelect;

  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-2">
        {images.map((img) => {
          const isSel = selectable && selectedId === img.id;
          return (
            <div
              key={img.id}
              className={cn(
                "group relative w-16 h-16 rounded-lg overflow-hidden border",
                isSel ? "border-primary ring-2 ring-primary" : "border-border",
                selectable && "cursor-pointer"
              )}
              onClick={selectable ? () => onSelect!(img.id) : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt="reference" className="w-full h-full object-cover" />
              {isSel && (
                <div className="absolute top-0.5 left-0.5 bg-primary rounded-full p-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(img.id);
                }}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        <button
          onClick={() => inputRef.current?.click()}
          className="w-16 h-16 rounded-lg border border-dashed border-primary/30 bg-muted flex flex-col items-center justify-center gap-0.5 text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span className="text-[8px] font-medium">{addLabel}</span>
        </button>
      </div>
      {images.length === 0 && emptyHint && (
        <p className="text-[11px] text-muted-foreground mt-1">{emptyHint}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAdd(Array.from(e.target.files));
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}

function ReferencePhotoshootSection({ store }: { store: VTONStore }) {
  const {
    mode,
    primaryFolders,
    background,
    bulkBackgrounds,
    referencePhotoshootMode,
    setReferencePhotoshootMode,
    singleReferenceImages,
    addSingleReferenceImages,
    removeSingleReferenceImage,
    referenceFolders,
    addReferenceFolders,
    removeReferenceFolder,
    clearReferenceFolders,
    assignReferenceFolderMatch,
    addReferenceImageToFolder,
    removeReferenceImageFromFolder,
    selectReferenceFolderBackground,
    unmatchedReferenceFolders,
  } = store;

  const folderInputRef = useRef<HTMLInputElement>(null);
  // webkitdirectory / directory are non-standard input attributes — set imperatively.
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const activeMode = REFERENCE_PHOTOSHOOT_MODES.find((m) => m.value === referencePhotoshootMode);

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    primaryFolders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [primaryFolders]);

  const singleOutputCount = singleReferenceImages.length;
  const bulkOutputCount = referenceFolders
    .filter((f) => f.matchedFolderId)
    .reduce((sum, f) => sum + f.referenceImages.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-foreground">Reference Photoshoot</h3>
          <Badge variant="secondary" className="text-xs">
            {mode === "bulk" ? `${bulkOutputCount} output${bulkOutputCount === 1 ? "" : "s"}` : `${singleOutputCount} output${singleOutputCount === 1 ? "" : "s"}`}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload reference images to recreate a photoshoot. Each reference image produces one output.
        </p>
      </div>

      {/* Batch-level composition mode */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Composition Mode <span className="text-muted-foreground/50 normal-case">(applies to the whole batch)</span>
        </label>
        <Select
          value={referencePhotoshootMode}
          onValueChange={(v) => setReferencePhotoshootMode(v as ReferencePhotoshootMode)}
        >
          <SelectTrigger className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REFERENCE_PHOTOSHOOT_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeMode && <p className="text-[11px] text-muted-foreground mt-1">{activeMode.desc}</p>}
      </div>

      {/* ---------------- SINGLE MODE ---------------- */}
      {mode === "single" && (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              Reference Images <span className="text-muted-foreground/50 normal-case">(each image = 1 output)</span>
            </label>
            <ReferenceImageGrid
              images={singleReferenceImages}
              onAdd={addSingleReferenceImages}
              onRemove={removeSingleReferenceImage}
              addLabel="Add"
              emptyHint="Upload one or more reference images. Each becomes a separate output."
            />
          </div>
          {referencePhotoshootMode !== "replication" && (
            <p className="text-[11px] text-muted-foreground">
              {(background.mode === "inspiration" && background.inspirationImage) || background.textDescription.trim()
                ? "Background: uses the background you configured on the Styling step, applied to every output."
                : "⚠ No background configured. Set a background on the Styling step (image or text) before generating."}
            </p>
          )}
        </div>
      )}

      {/* ---------------- BULK MODE ---------------- */}
      {mode === "bulk" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/30 bg-muted text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Upload reference folders
            </button>
            {referenceFolders.length > 0 && (
              <button
                onClick={clearReferenceFolders}
                className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            )}
            <input
              ref={folderInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const folders = importReferenceFolders(e.target.files, primaryFolders);
                  if (folders.length > 0) addReferenceFolders(folders);
                }
                if (folderInputRef.current) folderInputRef.current.value = "";
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Pick a parent folder whose subfolders are named after your input products (e.g. &ldquo;prod 1&rdquo;, &ldquo;prod 2&rdquo;). Each subfolder&rsquo;s images become that product&rsquo;s references.
          </p>

          {/* Reconciliation UI for unmatched folders */}
          {unmatchedReferenceFolders.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {unmatchedReferenceFolders.length} folder{unmatchedReferenceFolders.length === 1 ? "" : "s"} didn&rsquo;t match a product
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Map each unmatched reference folder to an input product.</p>
              {unmatchedReferenceFolders.map((rf) => (
                <div key={rf.id} className="flex items-center gap-2">
                  <span className="text-sm text-foreground truncate flex-1" title={rf.name}>
                    {rf.name} <span className="text-muted-foreground">({rf.referenceImages.length})</span>
                  </span>
                  <Select
                    value=""
                    onValueChange={(v) => assignReferenceFolderMatch(rf.id, v)}
                  >
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Choose product…" />
                    </SelectTrigger>
                    <SelectContent>
                      {primaryFolders.map((pf) => (
                        <SelectItem key={pf.id} value={pf.id}>
                          {pf.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => removeReferenceFolder(rf.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Discard folder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Per-product accordion */}
          {referenceFolders.length > 0 && (
            <Accordion type="multiple" className="space-y-2">
              {referenceFolders.map((rf) => {
                const matchedName = rf.matchedFolderId ? folderNameById.get(rf.matchedFolderId) : undefined;
                return (
                  <AccordionItem
                    key={rf.id}
                    value={rf.id}
                    className="rounded-lg border border-border bg-card px-3"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <span className="text-sm font-medium text-foreground truncate">{rf.name}</span>
                        {matchedName ? (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            → {matchedName}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] shrink-0 text-amber-600 border-amber-500/40">
                            unmatched
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {rf.referenceImages.length} ref{rf.referenceImages.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-3">
                      <div>
                        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                          Reference Images <span className="text-muted-foreground/50 normal-case">(each = 1 output)</span>
                        </label>
                        <ReferenceImageGrid
                          images={rf.referenceImages}
                          onAdd={(files) => addReferenceImageToFolder(rf.id, files)}
                          onRemove={(imageId) => removeReferenceImageFromFolder(rf.id, imageId)}
                        />
                      </div>
                      {referencePhotoshootMode !== "replication" && (
                        <div>
                          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                            Background <span className="text-muted-foreground/50 normal-case">(pick one from the Styling step — applied to all this product&rsquo;s images)</span>
                          </label>
                          {bulkBackgrounds.length === 0 ? (
                            <p className="text-[11px] text-amber-600 mt-1">
                              ⚠ No backgrounds configured. Add one on the Styling step first.
                            </p>
                          ) : (
                            <Select
                              value={rf.selectedBackgroundId ?? ""}
                              onValueChange={(v) => selectReferenceFolderBackground(rf.id, v)}
                            >
                              <SelectTrigger className="mt-1 w-full h-9 text-sm">
                                <SelectValue placeholder="Choose a background…" />
                              </SelectTrigger>
                              <SelectContent>
                                {bulkBackgrounds.map((bg) => (
                                  <SelectItem key={bg.id} value={bg.id}>
                                    {bg.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {!matchedName && (
                          <Select value="" onValueChange={(v) => assignReferenceFolderMatch(rf.id, v)}>
                            <SelectTrigger className="w-48 h-8 text-xs">
                              <SelectValue placeholder="Map to product…" />
                            </SelectTrigger>
                            <SelectContent>
                              {primaryFolders.map((pf) => (
                                <SelectItem key={pf.id} value={pf.id}>
                                  {pf.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <button
                          onClick={() => removeReferenceFolder(rf.id)}
                          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove folder
                        </button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  UGC Scene Card                                                      */
/* ------------------------------------------------------------------ */
function UGCSceneCard({
  scene,
  onUpdate,
  onRemove,
  onAddImage,
  onRemoveImage,
}: {
  scene: UGCScene;
  onUpdate: (id: string, update: Partial<Omit<UGCScene, "id">>) => void;
  onRemove: (id: string) => void;
  onAddImage: (sceneId: string, file: File) => void;
  onRemoveImage: (sceneId: string, imageId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        Array.from(files).forEach((file) => onAddImage(scene.id, file));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [scene.id, onAddImage]
  );

  return (
    <div className="rounded-lg border border-rose-500/20 bg-card p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4 text-rose-500" />
          </div>
          <input
            type="text"
            value={scene.name}
            onChange={(e) => onUpdate(scene.id, { name: e.target.value })}
            placeholder="Scene name..."
            className="text-sm font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0 flex-1"
          />
        </div>
        <button
          onClick={() => onRemove(scene.id)}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Shot Type Toggle */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Shot Type
        </label>
        <div className="mt-1 flex gap-2">
          {UGC_SHOT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate(scene.id, { shotType: opt.value })}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                scene.shotType === opt.value
                  ? opt.value === "normal"
                    ? "bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400"
                    : "bg-pink-500/10 border-pink-500 text-pink-700 dark:text-pink-400"
                  : "bg-card border-border text-muted-foreground hover:border-rose-500/30 hover:text-foreground"
              )}
            >
              <span>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {scene.shotType === "selfie"
            ? "Front-camera selfie — slight wide-angle distortion, arm may be visible"
            : "Third-person candid photo — as if a friend casually took the picture"}
        </p>
      </div>

      {/* Scene Description */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Scene / Setting Description
        </label>
        <textarea
          value={scene.description}
          onChange={(e) => onUpdate(scene.id, { description: e.target.value })}
          placeholder="Describe the scene — location, time of day, vibe, what's happening... e.g. 'Walking near Gateway of India in Mumbai, golden hour, busy tourist crowd, casual candid moment'"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none"
          rows={3}
        />
      </div>

      {/* Quick Preset Chips */}
      {!scene.description && (
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Quick Presets
          </label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {UGC_SCENE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => onUpdate(scene.id, { name: preset.name, description: preset.description })}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-rose-500/5 text-rose-700 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reference Images */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Scene Reference Images <span className="text-muted-foreground/50 normal-case">(optional — mood/vibe reference)</span>
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          {scene.referenceImages.map((img) => (
            <div
              key={img.id}
              className="group relative w-16 h-16 rounded-lg overflow-hidden border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt="Scene reference"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => onRemoveImage(scene.id, img.id)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 rounded-lg border border-dashed border-rose-500/30 bg-rose-500/5 flex flex-col items-center justify-center gap-0.5 text-rose-500/60 hover:text-rose-500 hover:border-rose-500/50 hover:bg-rose-500/10 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[8px] font-medium">Add</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  UGC Scenes Section                                                  */
/* ------------------------------------------------------------------ */
function UGCScenesSection({
  ugcScenes,
  addUgcScene,
  removeUgcScene,
  updateUgcScene,
  addUgcSceneImage,
  removeUgcSceneImage,
}: {
  ugcScenes: UGCScene[];
  addUgcScene: (scene: UGCScene) => void;
  removeUgcScene: (id: string) => void;
  updateUgcScene: (id: string, update: Partial<Omit<UGCScene, "id">>) => void;
  addUgcSceneImage: (sceneId: string, file: File) => void;
  removeUgcSceneImage: (sceneId: string, imageId: string) => void;
}) {
  const handleAddScene = useCallback(() => {
    addUgcScene({
      id: `ugc-scene-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "",
      description: "",
      shotType: "normal",
      referenceImages: [],
    });
  }, [addUgcScene]);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-foreground">Instagram UGC Scenes</h3>
          {ugcScenes.length > 0 && (
            <Badge className="text-xs bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20">
              {ugcScenes.length} scene{ugcScenes.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate authentic User Generated Content — real-looking Instagram photos of everyday people wearing your product in real-world settings. The AI model, pose, background, and vibe are all derived from the scene description.
        </p>
      </div>

      {/* Scene Cards */}
      {ugcScenes.length > 0 && (
        <div className="space-y-3">
          {ugcScenes.map((scene) => (
            <UGCSceneCard
              key={scene.id}
              scene={scene}
              onUpdate={updateUgcScene}
              onRemove={removeUgcScene}
              onAddImage={addUgcSceneImage}
              onRemoveImage={removeUgcSceneImage}
            />
          ))}
        </div>
      )}

      {/* Add Scene Button */}
      <button
        onClick={handleAddScene}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 transition-colors duration-200 text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Add UGC Scene
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Nested Pose Accordion (View Angle > Framing > Pose Cards)          */
/* ------------------------------------------------------------------ */

function SelectAllButton({
  label,
  poses,
  selectedPoses,
  togglePose,
}: {
  label: string;
  poses: Pose[];
  selectedPoses: Pose[];
  togglePose: (pose: Pose) => void;
}) {
  const allSelected = poses.every((p) => selectedPoses.some((sp) => sp.id === p.id));
  const someSelected = poses.some((p) => selectedPoses.some((sp) => sp.id === p.id));

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (allSelected) {
        poses.forEach((p) => {
          if (selectedPoses.some((sp) => sp.id === p.id)) togglePose(p);
        });
      } else {
        poses.forEach((p) => {
          if (!selectedPoses.some((sp) => sp.id === p.id)) togglePose(p);
        });
      }
    },
    [allSelected, poses, selectedPoses, togglePose]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(e as unknown as React.MouseEvent); } }}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border cursor-pointer select-none",
        allSelected
          ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/10"
          : someSelected
            ? "bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10"
            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
      )}
    >
      {allSelected ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <Plus className="w-3 h-3" />
      )}
      {allSelected ? `Deselect ${label}` : `Select all ${label}`}
    </div>
  );
}

function FramingAccordionContent({
  framingPoses,
  selectedPoses,
  togglePose,
  showAllPoses,
  activeType,
  isFootwear,
}: {
  framingPoses: Pose[];
  selectedPoses: Pose[];
  togglePose: (pose: Pose) => void;
  showAllPoses: boolean;
  activeType: GarmentType | FootwearType;
  isFootwear: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
      {framingPoses.map((pose) => {
        const isSelected = selectedPoses.some((p) => p.id === pose.id);
        const isIrrelevant = showAllPoses && !isPoseRelevantTo(pose, activeType);
        const isProductOnly = pose.requiresModel === false;

        return (
          <button
            key={pose.id}
            onClick={() => togglePose(pose)}
            className={cn(
              "relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-colors duration-200 text-center",
              isSelected
                ? "bg-card border-primary shadow-sm"
                : isIrrelevant
                  ? "bg-muted/30 border-border opacity-50 hover:opacity-75 hover:border-border"
                  : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
            )}
          >
            {isSelected && (
              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-primary-foreground" />
              </div>
            )}
            {isProductOnly && (
              <Badge className="absolute top-1.5 left-1.5 text-[8px] py-0 px-1 h-3.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                No Model
              </Badge>
            )}
            {pose.poseType === "dynamic" && (
              <Badge className="absolute top-1.5 left-1.5 text-[8px] py-0 px-1 h-3.5 bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30">
                Dynamic
              </Badge>
            )}
            <PoseThumbnail poseId={pose.id} icon={pose.icon} isFootwear={isFootwear} />
            <div className="space-y-0.5">
              <p className="text-xs font-medium leading-tight">{pose.name}</p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px] py-0 px-1 h-3.5 font-normal",
                  isSelected ? "border-primary/30 text-primary" : "border-border text-muted-foreground"
                )}
              >
                {getFramingShortLabel(pose.framing)}
              </Badge>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                {pose.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PoseAccordion({
  viewAngleGroups,
  relevantPoses,
  selectedPoses,
  togglePose,
  showAllPoses,
  activeType,
  isFootwear,
}: {
  viewAngleGroups: { viewAngle: PoseViewAngle; label: string; description: string }[];
  relevantPoses: Pose[];
  selectedPoses: Pose[];
  togglePose: (pose: Pose) => void;
  showAllPoses: boolean;
  activeType: GarmentType | FootwearType;
  isFootwear: boolean;
}) {
  const groupData = useMemo(() => {
    return viewAngleGroups.map((group) => {
      const groupPoses = relevantPoses.filter((p) => p.viewAngle === group.viewAngle);
      const selectedInGroup = groupPoses.filter((p) => selectedPoses.some((sp) => sp.id === p.id)).length;
      const framingsInGroup = FRAMING_ORDER.filter((f) => groupPoses.some((p) => p.framing === f));
      const framingData = framingsInGroup.map((framing) => {
        const framingPoses = groupPoses.filter((p) => p.framing === framing);
        const selectedInFraming = framingPoses.filter((p) => selectedPoses.some((sp) => sp.id === p.id)).length;
        return { framing, poses: framingPoses, selectedCount: selectedInFraming };
      });
      return { ...group, poses: groupPoses, selectedCount: selectedInGroup, framings: framingData };
    }).filter((g) => g.poses.length > 0);
  }, [viewAngleGroups, relevantPoses, selectedPoses]);

  const defaultOpenAngles = useMemo(
    () => groupData.filter((g) => g.selectedCount > 0).map((g) => g.viewAngle),
    // Only compute on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Accordion type="multiple" defaultValue={defaultOpenAngles} className="space-y-3">
      {groupData.map((group) => {
        const allSelectedInGroup = group.poses.length > 0 && group.poses.every((p) => selectedPoses.some((sp) => sp.id === p.id));

        return (
          <AccordionItem
            key={group.viewAngle}
            value={group.viewAngle}
            className={cn(
              "rounded-xl border transition-colors duration-200 overflow-hidden",
              group.selectedCount > 0
                ? "border-primary/25 bg-primary/[0.02] shadow-sm"
                : "border-border bg-card/50 hover:border-border"
            )}
          >
            <AccordionTrigger
              className={cn(
                "px-5 py-4 hover:no-underline gap-3 [&[data-state=open]>svg]:rotate-180",
                "group"
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Selection indicator */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors text-sm font-bold",
                    allSelectedInGroup
                      ? "bg-primary text-primary-foreground"
                      : group.selectedCount > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {allSelectedInGroup ? (
                    <Check className="w-4 h-4" />
                  ) : group.selectedCount > 0 ? (
                    group.selectedCount
                  ) : (
                    <span className="text-xs">{group.poses.length}</span>
                  )}
                </div>
                <div className="flex flex-col items-start gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{group.label}</span>
                    {group.selectedCount > 0 && (
                      <Badge className="text-[11px] py-0 px-1.5 h-4 bg-primary/10 text-primary border-primary/20">
                        {group.selectedCount}/{group.poses.length}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">{group.description}</span>
                </div>
              </div>

              {/* Selected preview thumbnails */}
              {group.selectedCount > 0 && group.selectedCount <= 5 && (
                <div className="hidden sm:flex items-center gap-2 mr-2 shrink-0">
                  {group.poses
                    .filter((p) => selectedPoses.some((sp) => sp.id === p.id))
                    .slice(0, 5)
                    .map((p) => (
                      <PoseMiniThumbnail
                        key={p.id}
                        poseId={p.id}
                        icon={p.icon}
                        name={p.name}
                        framing={p.framing}
                        viewAngle={group.label}
                        isFootwear={isFootwear}
                        onRemove={(e) => {
                          e.stopPropagation();
                          togglePose(p);
                        }}
                      />
                    ))}
                </div>
              )}
            </AccordionTrigger>

            <AccordionContent className="px-5 pb-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <span className="text-xs text-muted-foreground">
                  {group.framings.length} framing{group.framings.length !== 1 ? "s" : ""} &middot; {group.poses.length} pose{group.poses.length !== 1 ? "s" : ""}
                </span>
                <SelectAllButton
                  label={group.label.toLowerCase()}
                  poses={group.poses}
                  selectedPoses={selectedPoses}
                  togglePose={togglePose}
                />
              </div>

              {/* Inner accordion for framings */}
              <Accordion
                type="multiple"
                defaultValue={group.framings.filter((f) => f.selectedCount > 0).map((f) => `${group.viewAngle}-${f.framing}`)}
                className="space-y-2"
              >
                {group.framings.map((framingGroup) => {
                  if (framingGroup.poses.length === 0) return null;
                  const framingLabel = getFramingLabel(framingGroup.framing);
                  const allSelectedInFraming = framingGroup.poses.every((p) => selectedPoses.some((sp) => sp.id === p.id));

                  return (
                    <AccordionItem
                      key={`${group.viewAngle}-${framingGroup.framing}`}
                      value={`${group.viewAngle}-${framingGroup.framing}`}
                      className={cn(
                        "rounded-lg border transition-colors duration-200 overflow-hidden",
                        framingGroup.selectedCount > 0
                          ? "border-primary/15 bg-primary/[0.015]"
                          : "border-border bg-background/50"
                      )}
                    >
                      <AccordionTrigger
                        className="px-4 py-3 hover:no-underline text-left gap-3 [&[data-state=open]>svg]:rotate-180"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-[13px] font-medium text-foreground">{framingLabel}</span>
                            <span className="text-[11px] text-muted-foreground/70 hidden sm:inline">
                              {getFramingDescription(framingGroup.framing)}
                            </span>
                          </div>
                          {framingGroup.selectedCount > 0 && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] py-0 px-1.5 h-4 shrink-0",
                                allSelectedInFraming
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "border-primary/20 text-primary/70"
                              )}
                            >
                              {framingGroup.selectedCount}/{framingGroup.poses.length}
                            </Badge>
                          )}
                          {!framingGroup.selectedCount && (
                            <span className="text-[11px] text-muted-foreground/50 shrink-0">
                              {framingGroup.poses.length} pose{framingGroup.poses.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mr-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <SelectAllButton
                            label=""
                            poses={framingGroup.poses}
                            selectedPoses={selectedPoses}
                            togglePose={togglePose}
                          />
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-4 pb-3">
                        <FramingAccordionContent
                          framingPoses={framingGroup.poses}
                          selectedPoses={selectedPoses}
                          togglePose={togglePose}
                          showAllPoses={showAllPoses}
                          activeType={activeType}
                          isFootwear={isFootwear}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

/* ------------------------------------------------------------------ */
/*  Skip-aware sequence preview helpers                                */
/* ------------------------------------------------------------------ */
/** Parses a comma-separated user input into a deduped array of non-negative integers. */
function parseSkipIndices(text: string): number[] {
  return Array.from(
    new Set(
      text
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0)
    )
  );
}

/** Walks the counter to produce the suffix number for the i-th file given the skip set. */
function nthSkipAwareCounter(
  index: number,
  oneIndexed: boolean,
  skipIndices: number[]
): number {
  const skipSet = new Set(skipIndices);
  let counter = oneIndexed ? 1 : 0;
  for (let i = 0; i < index; i++) {
    counter++;
    while (skipSet.has(counter)) counter++;
  }
  while (skipSet.has(counter)) counter++;
  return counter;
}

/** Builds a 3-example preview string for one of the naming-logic radio cards. */
function buildNamingExample(
  prefix: string,
  oneIndexed: boolean,
  skipIndices: number[]
): string {
  const safe = prefix.replace(/[<>:"/\\|?*]+/g, "_");
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const counter = nthSkipAwareCounter(i, oneIndexed, skipIndices);
    // First image is always suffixed (`_0` in 0-indexed mode) — matches
    // getSequencedFileName in step-generate.tsx.
    parts.push(`${safe}_${counter}.png`);
  }
  return `e.g. ${parts.join(", ")}`;
}

/* ------------------------------------------------------------------ */
/*  Naming logic section (radio cards + skip indices + prefix)         */
/* ------------------------------------------------------------------ */
function NamingLogicSection({
  namingLogic,
  setNamingLogic,
  singleDownloadPrefix,
  setSingleDownloadPrefix,
  skipNamingIndicesText,
  setSkipNamingIndicesText,
  mode,
}: {
  namingLogic: NamingLogic;
  setNamingLogic: (v: NamingLogic) => void;
  singleDownloadPrefix: string;
  setSingleDownloadPrefix: (v: string) => void;
  skipNamingIndicesText: string;
  setSkipNamingIndicesText: (v: string) => void;
  mode: "single" | "bulk";
}) {
  const skipIndices = useMemo(
    () => parseSkipIndices(skipNamingIndicesText),
    [skipNamingIndicesText]
  );

  const zeroPrefix = mode === "bulk" ? "red_shirt" : singleDownloadPrefix || "product";
  const onePrefix = mode === "bulk" ? "red_shirt" : singleDownloadPrefix || "product";

  const zeroIndexedExample = buildNamingExample(zeroPrefix, false, skipIndices);
  const oneIndexedExample = buildNamingExample(onePrefix, true, skipIndices);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">Naming Logic</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          How generated images are named when downloading.
        </p>
      </div>
      <div className="space-y-2">
        <NamingOption
          value="folder-name-sequential"
          current={namingLogic}
          onChange={setNamingLogic}
          label="Folder name sequential (starts at 0)"
          description={
            mode === "bulk"
              ? "Images are named using the product folder name: folder_name_0, folder_name_1, folder_name_2, ..."
              : "Images are named using the download prefix: prefix_0, prefix_1, prefix_2, ..."
          }
          example={zeroIndexedExample}
        />
        <NamingOption
          value="folder-name-sequential-1"
          current={namingLogic}
          onChange={setNamingLogic}
          label="Folder name sequential (starts at 1)"
          description={
            mode === "bulk"
              ? "Images are named using the product folder name starting from _1: folder_name_1, folder_name_2, folder_name_3, ..."
              : "Images are named using the download prefix starting from _1: prefix_1, prefix_2, prefix_3, ..."
          }
          example={oneIndexedExample}
        />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium whitespace-nowrap">
          Skip these numbers
        </label>
        <Input
          value={skipNamingIndicesText}
          onChange={(e) => setSkipNamingIndicesText(e.target.value)}
          placeholder="e.g. 3, 7"
          className="max-w-xs h-8 text-sm font-mono"
        />
        <span className="text-xs text-muted-foreground">
          Comma-separated suffix numbers to skip in the sequence.
        </span>
      </div>
      {mode === "single" && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium whitespace-nowrap">
            Download prefix
          </label>
          <Input
            value={singleDownloadPrefix}
            onChange={(e) => setSingleDownloadPrefix(e.target.value.replace(/[<>:"/\\|?*]+/g, "_"))}
            placeholder="product"
            className="max-w-xs h-8 text-sm"
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Naming option radio card                                           */
/* ------------------------------------------------------------------ */
function NamingOption({
  value,
  current,
  onChange,
  label,
  description,
  example,
}: {
  value: NamingLogic;
  current: NamingLogic;
  onChange: (v: NamingLogic) => void;
  label: string;
  description: string;
  example: string;
}) {
  const isSelected = current === value;
  return (
    <button
      onClick={() => onChange(value)}
      className={cn(
        "w-full text-left rounded-xl border-2 p-4 transition-colors duration-200",
        isSelected
          ? "border-orange-500/60 bg-orange-500/5"
          : "border-border bg-card hover:border-orange-500/25"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            isSelected ? "border-orange-500 bg-orange-500" : "border-muted-foreground/40"
          )}
        >
          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
        <span className="font-medium text-sm text-foreground">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 ml-6">{description}</p>
      <p className="text-xs text-muted-foreground mt-0.5 ml-6 font-mono">{example}</p>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Drag-and-drop sequencing with pose preview thumbnails              */
/* ------------------------------------------------------------------ */
function SequencingSection({
  selectedPoses,
  movePoseInSequence,
  isFootwear,
}: {
  selectedPoses: Pose[];
  movePoseInSequence: (from: number, to: number) => void;
  isFootwear: boolean;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIdx: number) => {
      e.preventDefault();
      const fromIdx = Number(e.dataTransfer.getData("text/plain"));
      if (!Number.isNaN(fromIdx) && fromIdx !== toIdx) {
        movePoseInSequence(fromIdx, toIdx);
      }
      setDragIdx(null);
      setOverIdx(null);
    },
    [movePoseInSequence]
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">Sequencing</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Define the order in which images appear in downloads. Drag and drop to reorder.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {selectedPoses.map((pose, idx) => {
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== idx;
          return (
            <div
              key={pose.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 cursor-grab active:cursor-grabbing transition-all duration-200 select-none",
                isDragging && "opacity-40 scale-95",
                isOver
                  ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
              )}
            >
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-muted text-[11px] font-bold text-muted-foreground">
                  {idx + 1}
                </span>
              </div>
              <div className="absolute top-1.5 right-1.5 text-muted-foreground/40">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              <div className="mt-4">
                <SequencingThumbnail poseId={pose.id} icon={pose.icon} isFootwear={isFootwear} />
              </div>
              <p className="text-xs font-medium text-foreground text-center leading-tight line-clamp-2">
                {pose.name}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {pose.viewAngle} · {getFramingShortLabel(pose.framing)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SequencingThumbnail({ poseId, icon, isFootwear }: { poseId: string; icon: string; isFootwear: boolean }) {
  const [imgError, setImgError] = useState(false);

  if (isFootwear || imgError) {
    return (
      <div className="w-20 h-20 rounded-lg bg-muted/30 flex items-center justify-center">
        <span className="text-2xl">{icon}</span>
      </div>
    );
  }

  return (
    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted/30 border border-border">
      <Image
        src={`/poses/${poseId}.png`}
        alt={poseId}
        width={80}
        height={80}
        className="object-cover w-full h-full"
        onError={() => setImgError(true)}
        unoptimized
        draggable={false}
      />
    </div>
  );
}

interface StepOutputProps {
  store: VTONStore;
}

export function StepOutput({ store }: StepOutputProps) {
  const {
    aspectRatio,
    setAspectRatio,
    selectedPoses,
    togglePose,
    movePoseInSequence,
    namingLogic,
    setNamingLogic,
    singleDownloadPrefix,
    setSingleDownloadPrefix,
    skipNamingIndicesText,
    setSkipNamingIndicesText,
    skipValidation,
    setSkipValidation,
    mode,
    customPoses,
    addCustomPose,
    removeCustomPose,
    updateCustomPose,
    addCustomPoseImage,
    removeCustomPoseImage,
    setCustomPoseShotKind,
    updateCustomPoseInfographic,
    setInfographicPlan,
    addInfographicPoint,
    updateInfographicPoint,
    removeInfographicPoint,
    setCustomPoseBrandLogo,
    clearCustomPoseBrandLogo,
    infographicAnalyzing,
    setInfographicAnalyzingFor,
    infographicAnalysisError,
    setInfographicAnalysisErrorFor,
    apiKey,
    textGenModel,
    garmentImages,
    productInfo,
    productCategory,
    garmentType,
    footwearType,
    poseAccessories,
    toggleAccessory,
    setAccessoryImage,
    removeAccessoryImage,
    addCustomAccessory,
    updateCustomAccessoryDescription,
    removeCustomAccessory,
    setCustomAccessoryImage,
    removeCustomAccessoryImage,
    applyAccessoriesToAllPoses,
    setApplyAccessoriesToAllPoses,
    propBuckets,
    createPropBucket,
    renamePropBucket,
    setPropBucketCategory,
    addPropBucketImages,
    removePropBucketImage,
    deletePropBucket,
    togglePoseBucket,
    hasModel,
    featureMode,
    ugcScenes,
    addUgcScene,
    removeUgcScene,
    updateUgcScene,
    addUgcSceneImage,
    removeUgcSceneImage,
  } = store;
  const [showAllPoses, setShowAllPoses] = useState(false);
  const isModelSwap = featureMode === "model-swap";

  /**
   * Step 1 of the infographic pipeline — run from the card so the operator reviews and edits
   * the derived text points before any image is rendered.
   *
   * In bulk mode the plan is deliberately product-agnostic (no garment images attached): one
   * review surface covers the whole batch, and `generateCustomPoseInfographicPrompt` then
   * re-specialises it against each product folder's own images at generation time.
   */
  const handleAnalyzeInfographic = useCallback(
    async (pose: CustomPose) => {
      const config = pose.infographic;
      // No reference-image requirement: without one the analysis designs the layout from
      // the operator's notes, background and callout text instead of reading a template.
      if (!config) return;

      setInfographicAnalysisErrorFor(pose.id, undefined);
      setInfographicAnalyzingFor(pose.id, true);
      try {
        const isBulk = mode === "bulk";
        const { plan } = await analyzeInfographicReference({
          apiKey,
          textGenModel,
          referenceImages: pose.referenceImages.map((img) => ({ file: img.file })),
          garmentImages: isBulk ? [] : garmentImages.map((g) => ({ file: g.file })),
          productCategory,
          productInfo,
          poseName: pose.name,
          compositionNotes: pose.description,
          customBackground: pose.customBackground,
          textMode: config.textMode,
          textInput: config.textInput,
          fidelity: config.fidelity,
          aspectRatio,
          brandLogoPresent: !!config.brandLogo,
          brandPlacementInstructions: config.brandPlacementInstructions,
          productAgnostic: isBulk,
        });
        setInfographicPlan(pose.id, plan);
      } catch (err) {
        setInfographicAnalysisErrorFor(
          pose.id,
          err instanceof Error ? err.message : "Analysis failed — please try again."
        );
      } finally {
        setInfographicAnalyzingFor(pose.id, false);
      }
    },
    [
      apiKey,
      textGenModel,
      garmentImages,
      productCategory,
      productInfo,
      aspectRatio,
      mode,
      setInfographicPlan,
      setInfographicAnalyzingFor,
      setInfographicAnalysisErrorFor,
    ]
  );

  const infographicApi = useMemo<InfographicCardApi>(
    () => ({
      setShotKind: setCustomPoseShotKind,
      updateConfig: updateCustomPoseInfographic,
      setPlan: setInfographicPlan,
      addPoint: addInfographicPoint,
      updatePoint: updateInfographicPoint,
      removePoint: removeInfographicPoint,
      setBrandLogo: setCustomPoseBrandLogo,
      clearBrandLogo: clearCustomPoseBrandLogo,
      analyzing: infographicAnalyzing,
      errors: infographicAnalysisError,
      onAnalyze: handleAnalyzeInfographic,
      isBulk: mode === "bulk",
    }),
    [
      setCustomPoseShotKind,
      updateCustomPoseInfographic,
      setInfographicPlan,
      addInfographicPoint,
      updateInfographicPoint,
      removeInfographicPoint,
      setCustomPoseBrandLogo,
      clearCustomPoseBrandLogo,
      infographicAnalyzing,
      infographicAnalysisError,
      handleAnalyzeInfographic,
      mode,
    ]
  );

  const isFootwear = productCategory === "footwear";
  const activeType = isFootwear ? footwearType : garmentType;
  const allPoses = isFootwear ? FOOTWEAR_POSES : POSES;
  const viewAngleGroups = isFootwear ? FOOTWEAR_VIEW_ANGLE_GROUPS : CLOTHING_VIEW_ANGLE_GROUPS;

  // ======================================================================
  // MODEL SWAP MODE - Only aspect ratio
  // ======================================================================
  if (isModelSwap) {
    return (
      <div className="space-y-8">
        {/* Aspect Ratio */}
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Output Aspect Ratio
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose the dimensions for the generated images
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ASPECT_RATIOS.map((ratio) => {
              const isSelected = aspectRatio === ratio.value;
              const [w, h] = ratio.value.split(":").map(Number);
              const maxSize = 40;
              const scale = maxSize / Math.max(w, h);
              const boxW = Math.round(w * scale);
              const boxH = Math.round(h * scale);

              return (
                <button
                  key={ratio.value}
                  onClick={() => setAspectRatio(ratio.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors duration-200",
                    isSelected
                      ? "bg-card border-primary shadow-sm"
                      : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
                  )}
                >
                  <div className="flex items-center justify-center h-12">
                    <div
                      className={cn(
                        "rounded border-2 transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-muted-foreground/30 bg-muted/30"
                      )}
                      style={{ width: `${boxW}px`, height: `${boxH}px` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-primary" : "text-foreground"
                    )}>
                      {ratio.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {ratio.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Model Swap preserves the exact pose from your original product photos. No pose selection is needed — the new model will adopt the same pose as the original.
          </p>
        </div>
      </div>
    );
  }

  const relevantPoses = showAllPoses
    ? allPoses
    : allPoses.filter((p) => isPoseRelevantTo(p, activeType));

  const garmentLabel = isFootwear
    ? (FOOTWEAR_POSES[0] ? footwearType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Footwear")
    : garmentType === "topwear"
      ? "Top Wear"
      : garmentType === "bottomwear"
        ? "Bottom Wear"
        : garmentType === "complete-outfit"
          ? "Complete Outfit"
          : garmentType === "innerwear"
            ? "Innerwear"
            : "One Piece";

  return (
    <div className="space-y-8">
      {/* Aspect Ratio */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Output Aspect Ratio
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose the dimensions for the generated images
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ASPECT_RATIOS.map((ratio) => {
            const isSelected = aspectRatio === ratio.value;
            // Calculate visual box dimensions
            const [w, h] = ratio.value.split(":").map(Number);
            const maxSize = 40;
            const scale = maxSize / Math.max(w, h);
            const boxW = Math.round(w * scale);
            const boxH = Math.round(h * scale);

            return (
              <button
                key={ratio.value}
                onClick={() => setAspectRatio(ratio.value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                  isSelected
                    ? "bg-card border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
                )}
              >
                {/* Visual Ratio Box */}
                <div className="flex items-center justify-center h-12">
                  <div
                    className={cn(
                      "rounded border-2 transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-muted-foreground/30 bg-muted/30"
                    )}
                    style={{ width: `${boxW}px`, height: `${boxH}px` }}
                  />
                </div>
                <div className="text-center">
                  <p className={cn(
                    "text-sm font-semibold",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {ratio.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {ratio.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pose Selection */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">Poses</h3>
            {(selectedPoses.length > 0 || customPoses.length > 0 || ugcScenes.length > 0) && (
              <Badge variant="secondary" className="text-xs">
                {selectedPoses.length + customPoses.length + ugcScenes.length} selected · {selectedPoses.length + customPoses.length + ugcScenes.length} output{(selectedPoses.length + customPoses.length + ugcScenes.length) !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isFootwear
              ? "Select one or more poses. Product-only shots don't require an AI model. On-model shots require a model selected in the Styling step."
              : "Select one or more poses. Each pose generates one output image. Prompts are automatically tailored to the angle, framing, and garment type."}
          </p>
        </div>

        {/* Warning if model-shot poses selected without model */}
        {!hasModel && (selectedPoses.some((p) => p.requiresModel !== false) || customPoses.some(customPoseNeedsModel)) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Some selected poses require an AI model. Go back to Styling to select or upload one, or switch model-shot poses to product shots.</span>
          </div>
        )}

        {/* Type filter bar */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {relevantPoses.length}
              </span>{" "}
              poses
              {!showAllPoses && (
                <>
                  {" "}relevant for{" "}
                  <span className="font-semibold text-foreground">
                    {garmentLabel}
                  </span>
                </>
              )}
            </span>
          </div>
          <button
            onClick={() => setShowAllPoses(!showAllPoses)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAllPoses ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Filter by {garmentLabel}
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Show all poses
              </>
            )}
          </button>
        </div>

        {/* View Angle Groups — Nested Accordion */}
        <PoseAccordion
          viewAngleGroups={viewAngleGroups}
          relevantPoses={relevantPoses}
          selectedPoses={selectedPoses}
          togglePose={togglePose}
          showAllPoses={showAllPoses}
          activeType={activeType}
          isFootwear={isFootwear}
        />
      </div>

      {/* Custom Poses */}
      <CustomPosesSection
        customPoses={customPoses}
        addCustomPose={addCustomPose}
        removeCustomPose={removeCustomPose}
        updateCustomPose={updateCustomPose}
        addCustomPoseImage={addCustomPoseImage}
        removeCustomPoseImage={removeCustomPoseImage}
        infographicApi={infographicApi}
      />

      {/* Reference-Driven Photoshoot (evolved custom pose) */}
      <ReferencePhotoshootSection store={store} />

      {/* UGC Scenes */}
      <UGCScenesSection
        ugcScenes={ugcScenes}
        addUgcScene={addUgcScene}
        removeUgcScene={removeUgcScene}
        updateUgcScene={updateUgcScene}
        addUgcSceneImage={addUgcSceneImage}
        removeUgcSceneImage={removeUgcSceneImage}
      />

      {/* Per-Pose Accessories - only for on-model / model-shot poses */}
      {(selectedPoses.filter((p) => p.requiresModel !== false).length > 0 || customPoses.filter(customPoseNeedsModel).length > 0) && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                Accessories
              </h3>
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {applyAccessoriesToAllPoses
                ? "Configure accessories once — they will be applied identically to every pose."
                : "Configure accessories for each model-shot pose. Each pose can have different accessories."}
            </p>
          </div>

          {/* Apply to all poses toggle */}
          {(selectedPoses.filter((p) => p.requiresModel !== false).length + customPoses.filter(customPoseNeedsModel).length) > 1 && (
            <button
              onClick={() => setApplyAccessoriesToAllPoses(!applyAccessoriesToAllPoses)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-sm font-medium",
                applyAccessoriesToAllPoses
                  ? "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                {applyAccessoriesToAllPoses ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                Apply accessories &amp; props to all poses
              </span>
              <span className="text-xs opacity-70">
                {applyAccessoriesToAllPoses ? "ON" : "OFF"}
              </span>
            </button>
          )}
          {applyAccessoriesToAllPoses && (
            <p className="text-[11px] text-muted-foreground px-1 -mt-1">
              Accessories &amp; prop buckets added under <span className="font-medium">All Poses</span> apply to every pose, on top of each pose&apos;s own selections. A prop bucket here samples one image per product and uses it consistently across all poses.
            </p>
          )}

          {/* Prop bucket manager — create reusable multi-image buckets */}
          <PropBucketManager
            propBuckets={propBuckets}
            createPropBucket={createPropBucket}
            renamePropBucket={renamePropBucket}
            setPropBucketCategory={setPropBucketCategory}
            addPropBucketImages={addPropBucketImages}
            removePropBucketImage={removePropBucketImage}
            deletePropBucket={deletePropBucket}
          />

          <div className="space-y-2">
            {/* Global "apply to all poses" layer — additive, never overwrites the
                per-pose selections below. */}
            {applyAccessoriesToAllPoses && (
              <PoseAccessoriesPanel
                poseId={GLOBAL_ACCESSORY_POSE_ID}
                poseName="All Poses"
                poseIcon="🔗"
                accessories={poseAccessories[GLOBAL_ACCESSORY_POSE_ID] || []}
                toggleAccessory={toggleAccessory}
                setAccessoryImage={setAccessoryImage}
                removeAccessoryImage={removeAccessoryImage}
                addCustomAccessory={addCustomAccessory}
                updateCustomAccessoryDescription={updateCustomAccessoryDescription}
                removeCustomAccessory={removeCustomAccessory}
                setCustomAccessoryImage={setCustomAccessoryImage}
                removeCustomAccessoryImage={removeCustomAccessoryImage}
                propBuckets={propBuckets}
                togglePoseBucket={togglePoseBucket}
                isFootwear={isFootwear}
              />
            )}
            {/* Per-pose selections — always visible & editable, even when the
                global layer above is ON (the two merge additively at generation). */}
            {selectedPoses
              .filter((p) => p.requiresModel !== false)
              .map((pose) => (
              <PoseAccessoriesPanel
                key={pose.id}
                poseId={pose.id}
                poseName={formatPoseDescriptor(pose, isFootwear)}
                poseIcon={pose.icon}
                accessories={poseAccessories[pose.id] || []}
                toggleAccessory={toggleAccessory}
                setAccessoryImage={setAccessoryImage}
                removeAccessoryImage={removeAccessoryImage}
                addCustomAccessory={addCustomAccessory}
                updateCustomAccessoryDescription={updateCustomAccessoryDescription}
                removeCustomAccessory={removeCustomAccessory}
                setCustomAccessoryImage={setCustomAccessoryImage}
                removeCustomAccessoryImage={removeCustomAccessoryImage}
                propBuckets={propBuckets}
                togglePoseBucket={togglePoseBucket}
                isFootwear={isFootwear}
              />
            ))}
            {customPoses
              // Infographics compose their own asset from the reference layout, so accessories
              // are not forwarded to their render — don't offer a control that does nothing.
              .filter((cp) => customPoseNeedsModel(cp) && !customPoseIsInfographic(cp))
              .map((cp) => (
              <PoseAccessoriesPanel
                key={cp.id}
                poseId={cp.id}
                poseName={cp.name || "Custom Pose"}
                poseIcon="✨"
                accessories={poseAccessories[cp.id] || []}
                toggleAccessory={toggleAccessory}
                setAccessoryImage={setAccessoryImage}
                removeAccessoryImage={removeAccessoryImage}
                addCustomAccessory={addCustomAccessory}
                updateCustomAccessoryDescription={updateCustomAccessoryDescription}
                removeCustomAccessory={removeCustomAccessory}
                setCustomAccessoryImage={setCustomAccessoryImage}
                removeCustomAccessoryImage={removeCustomAccessoryImage}
                propBuckets={propBuckets}
                togglePoseBucket={togglePoseBucket}
                isFootwear={isFootwear}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sequencing */}
      {selectedPoses.length > 1 && (
        <SequencingSection
          selectedPoses={selectedPoses}
          movePoseInSequence={movePoseInSequence}
          isFootwear={isFootwear}
        />
      )}

      {/* Naming Logic */}
      {selectedPoses.length > 0 && (
        <NamingLogicSection
          namingLogic={namingLogic}
          setNamingLogic={setNamingLogic}
          singleDownloadPrefix={singleDownloadPrefix}
          setSingleDownloadPrefix={setSingleDownloadPrefix}
          skipNamingIndicesText={skipNamingIndicesText}
          setSkipNamingIndicesText={setSkipNamingIndicesText}
          mode={mode}
        />
      )}

      {/* Validation & cost toggle */}
      <div className="space-y-2">
        <button
          onClick={() => setSkipValidation(!skipValidation)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-sm font-medium",
            skipValidation
              ? "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30"
              : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            {skipValidation ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            Skip validation &amp; cost tracking
          </span>
          <span className="text-xs opacity-70">{skipValidation ? "ON" : "OFF"}</span>
        </button>
        <p className="text-[11px] text-muted-foreground px-1">
          When ON, generated images skip the post-generation verification step and no cost breakdown is shown — faster and cheaper, with no automatic product-match check.
        </p>
      </div>
    </div>
  );
}
