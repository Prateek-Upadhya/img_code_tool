"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, Check, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff, Filter, GripVertical, ImageIcon, Package, Plus, Sparkles, Trash2, Upload, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCESSORY_CATEGORIES, ASPECT_RATIOS, FRAMING_OPTIONS, IMAGE_GEN_MODELS, POSES, FOOTWEAR_POSES, UGC_SHOT_TYPE_OPTIONS, UGC_SCENE_PRESETS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AccessoryCategory, AccessoryItem, CustomPose, FootwearType, GarmentType, NamingLogic, Pose, PoseFraming, PoseViewAngle, UGCScene, UGCShotType } from "@/lib/types";
import type { VTONStore } from "@/store/vton-store";

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
  isFootwear?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const filteredCategories = isFootwear
    ? ACCESSORY_CATEGORIES.filter((c) => c.value !== "shoes")
    : ACCESSORY_CATEGORIES;

  const presetAccessories = accessories.filter((a) => a.category !== "custom");
  const customAccessories = accessories.filter((a) => a.category === "custom");

  const isAccessorySelected = (category: AccessoryCategory) =>
    accessories.some((a) => a.category === category);

  const getAccessoryItem = (category: AccessoryCategory) =>
    accessories.find((a) => a.category === category);

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
/*  Custom Pose Card                                                    */
/* ------------------------------------------------------------------ */
function CustomPoseCard({
  pose,
  onUpdate,
  onRemove,
  onAddImage,
  onRemoveImage,
}: {
  pose: CustomPose;
  onUpdate: (id: string, update: Partial<Omit<CustomPose, "id">>) => void;
  onRemove: (id: string) => void;
  onAddImage: (poseId: string, file: File) => void;
  onRemoveImage: (poseId: string, imageId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="rounded-lg border border-primary/20 bg-card p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <input
            type="text"
            value={pose.name}
            onChange={(e) => onUpdate(pose.id, { name: e.target.value })}
            placeholder="Pose name..."
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

      {/* Model Shot / Product Shot Toggle */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Shot Type
        </label>
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => onUpdate(pose.id, { isModelShot: true })}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
              pose.isModelShot
                ? "bg-primary/10 border-primary text-primary"
                : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            <User className="w-4 h-4" />
            Model Shot
          </button>
          <button
            onClick={() => onUpdate(pose.id, { isModelShot: false })}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
              !pose.isModelShot
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                : "bg-card border-border text-muted-foreground hover:border-emerald-500/30 hover:text-foreground"
            )}
          >
            <Package className="w-4 h-4" />
            Product Shot
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {pose.isModelShot
            ? "Human model will be included in the generated image"
            : "Only the product will be shown — no human model"}
        </p>
      </div>

      {/* Text Description */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Pose Description
        </label>
        <textarea
          value={pose.description}
          onChange={(e) => onUpdate(pose.id, { description: e.target.value })}
          placeholder="Describe the pose in detail — body position, angle, stance, arm placement, weight distribution, mood..."
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          rows={3}
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

      {/* Reference Mode — only meaningful when at least one reference image is attached */}
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

      {/* Reference Images */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          Reference Images <span className="text-muted-foreground/50 normal-case">(optional)</span>
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
                alt="Pose reference"
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
            className="w-16 h-16 rounded-lg border border-dashed border-primary/30 bg-muted flex flex-col items-center justify-center gap-0.5 text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors"
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
/*  Custom Poses Section                                                */
/* ------------------------------------------------------------------ */
function CustomPosesSection({
  customPoses,
  addCustomPose,
  removeCustomPose,
  updateCustomPose,
  addCustomPoseImage,
  removeCustomPoseImage,
}: {
  customPoses: CustomPose[];
  addCustomPose: (pose: CustomPose) => void;
  removeCustomPose: (id: string) => void;
  updateCustomPose: (id: string, update: Partial<Omit<CustomPose, "id">>) => void;
  addCustomPoseImage: (poseId: string, file: File) => void;
  removeCustomPoseImage: (poseId: string, imageId: string) => void;
}) {
  const handleAddCustomPose = useCallback(() => {
    addCustomPose({
      id: `custom-pose-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "",
      description: "",
      isModelShot: true,
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
          Create your own poses with text descriptions and optional reference images. These are sent to the AI alongside preset poses.
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
        const isIrrelevant = showAllPoses && !pose.garmentRelevance.includes(activeType);
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
    mode,
    customPoses,
    addCustomPose,
    removeCustomPose,
    updateCustomPose,
    addCustomPoseImage,
    removeCustomPoseImage,
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
    syncAccessoriesToAllPoses,
    hasModel,
    featureMode,
    imageGenModel,
    setImageGenModel,
    ugcScenes,
    addUgcScene,
    removeUgcScene,
    updateUgcScene,
    addUgcSceneImage,
    removeUgcSceneImage,
  } = store;
  const [showAllPoses, setShowAllPoses] = useState(false);
  const isModelSwap = featureMode === "model-swap";

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
    : allPoses.filter((p) => p.garmentRelevance.includes(activeType));

  const garmentLabel = isFootwear
    ? (FOOTWEAR_POSES[0] ? footwearType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Footwear")
    : garmentType === "topwear"
      ? "Top Wear"
      : garmentType === "bottomwear"
        ? "Bottom Wear"
        : "One Piece";

  return (
    <div className="space-y-8">
      {/* Image Generation Model (Footwear VTON only) */}
      {featureMode === "vton" && isFootwear && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Image Generation Model
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose which AI engine renders the final footwear photo. Prompt enrichment always runs through Gemini 3.1 Pro.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {IMAGE_GEN_MODELS.map((opt) => {
              const isSelected = imageGenModel === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setImageGenModel(opt.value)}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-colors duration-200",
                    isSelected
                      ? "bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/50 shadow-sm shadow-orange-500/20"
                      : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      isSelected ? "border-orange-500" : "border-muted-foreground/40"
                    )}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                    </div>
                    <p className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-foreground" : "text-foreground"
                    )}>
                      {opt.label}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 pl-6">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
        {!hasModel && (selectedPoses.some((p) => p.requiresModel !== false) || customPoses.some((cp) => cp.isModelShot)) && (
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
      />

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
      {(selectedPoses.filter((p) => p.requiresModel !== false).length > 0 || customPoses.filter((cp) => cp.isModelShot).length > 0) && (
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
          {(selectedPoses.filter((p) => p.requiresModel !== false).length + customPoses.filter((cp) => cp.isModelShot).length) > 1 && (
            <button
              onClick={() => {
                const onModelPoseIds = [
                  ...selectedPoses.filter((p) => p.requiresModel !== false).map((p) => p.id),
                  ...customPoses.filter((cp) => cp.isModelShot).map((cp) => cp.id),
                ];
                setApplyAccessoriesToAllPoses(!applyAccessoriesToAllPoses, onModelPoseIds);
              }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-sm font-medium",
                applyAccessoriesToAllPoses
                  ? "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                {applyAccessoriesToAllPoses ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                Apply same accessories to all poses
              </span>
              <span className="text-xs opacity-70">
                {applyAccessoriesToAllPoses ? "ON" : "OFF"}
              </span>
            </button>
          )}

          <div className="space-y-2">
            {applyAccessoriesToAllPoses ? (
              <PoseAccessoriesPanel
                poseId={
                  selectedPoses.filter((p) => p.requiresModel !== false)[0]?.id
                  || customPoses.filter((cp) => cp.isModelShot)[0]?.id
                  || ""
                }
                poseName="All Poses"
                poseIcon="🔗"
                accessories={
                  poseAccessories[
                    selectedPoses.filter((p) => p.requiresModel !== false)[0]?.id
                    || customPoses.filter((cp) => cp.isModelShot)[0]?.id
                    || ""
                  ] || []
                }
                toggleAccessory={(poseId, category) => {
                  toggleAccessory(poseId, category);
                  setTimeout(() => syncAccessoriesToAllPoses(poseId), 0);
                }}
                setAccessoryImage={(poseId, category, file) => {
                  setAccessoryImage(poseId, category, file);
                  setTimeout(() => syncAccessoriesToAllPoses(poseId), 0);
                }}
                removeAccessoryImage={(poseId, category) => {
                  removeAccessoryImage(poseId, category);
                  setTimeout(() => syncAccessoriesToAllPoses(poseId), 0);
                }}
                addCustomAccessory={(poseId, desc, img) => {
                  addCustomAccessory(poseId, desc, img);
                  setTimeout(() => syncAccessoriesToAllPoses(poseId), 0);
                }}
                updateCustomAccessoryDescription={(poseId, accId, desc) => {
                  updateCustomAccessoryDescription(poseId, accId, desc);
                  setTimeout(() => syncAccessoriesToAllPoses(poseId), 0);
                }}
                removeCustomAccessory={(poseId, accId) => {
                  removeCustomAccessory(poseId, accId);
                  setTimeout(() => syncAccessoriesToAllPoses(poseId), 0);
                }}
                setCustomAccessoryImage={(poseId, accId, file) => {
                  setCustomAccessoryImage(poseId, accId, file);
                  setTimeout(() => syncAccessoriesToAllPoses(poseId), 0);
                }}
                removeCustomAccessoryImage={(poseId, accId) => {
                  removeCustomAccessoryImage(poseId, accId);
                  setTimeout(() => syncAccessoriesToAllPoses(poseId), 0);
                }}
                isFootwear={isFootwear}
              />
            ) : (
              <>
                {selectedPoses
                  .filter((p) => p.requiresModel !== false)
                  .map((pose) => (
                  <PoseAccessoriesPanel
                    key={pose.id}
                    poseId={pose.id}
                    poseName={pose.name}
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
                    isFootwear={isFootwear}
                  />
                ))}
                {customPoses
                  .filter((cp) => cp.isModelShot)
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
                    isFootwear={isFootwear}
                  />
                ))}
              </>
            )}
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
                  ? "Images are named using the product folder name: folder_name, folder_name_1, folder_name_2, ..."
                  : "Images are named using the download prefix: prefix, prefix_1, prefix_2, ..."
              }
              example={
                mode === "bulk"
                  ? "e.g. red_shirt.png, red_shirt_1.png, red_shirt_2.png"
                  : `e.g. ${singleDownloadPrefix}.png, ${singleDownloadPrefix}_1.png, ${singleDownloadPrefix}_2.png`
              }
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
              example={
                mode === "bulk"
                  ? "e.g. red_shirt_1.png, red_shirt_2.png, red_shirt_3.png"
                  : `e.g. ${singleDownloadPrefix}_1.png, ${singleDownloadPrefix}_2.png, ${singleDownloadPrefix}_3.png`
              }
            />
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
      )}
    </div>
  );
}
