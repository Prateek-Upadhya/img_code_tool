"use client";

import { useCallback, useRef, useState } from "react";
import { ImageIcon, Type, Upload, X, Check, Camera, Pencil, Trash2, Users, Plus, Palette, FolderOpen, Library } from "lucide-react";
import { loadSavedModels } from "@/lib/model-library";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AI_MODELS } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { BackgroundConfig, BackgroundImageMode, BackgroundMode, BulkBackground, BulkModelImage, ModelSwapBackgroundMode, SavedModel, ModelReferenceViewKind } from "@/lib/types";
import { MODEL_SWAP_BG_OPTIONS } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/*  Bulk Model Image Card                                              */
/* ------------------------------------------------------------------ */
function BulkModelCard({
  model,
  onRemove,
  onRename,
}: {
  model: BulkModelImage;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(model.name);

  const saveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== model.name) onRename(model.id, trimmed);
    setIsEditing(false);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden border border-border bg-card transition-colors duration-200 hover:shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={model.preview}
        alt={model.name}
        className="w-full aspect-[3/4] object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      {/* Remove button */}
      <button
        onClick={() => onRemove(model.id)}
        className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/90"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {/* Name bar */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-2 bg-gradient-to-t from-black/80 to-transparent">
        {isEditing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="text-xs font-medium text-white bg-transparent border-b border-white/50 outline-none w-full"
          />
        ) : (
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-white truncate flex-1">{model.name}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditName(model.name);
                setIsEditing(true);
              }}
              className="p-0.5 rounded text-white/70 hover:text-white transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Background image reference-mode toggle (Inspiration | Replica)      */
/* ------------------------------------------------------------------ */
/**
 * Sub-toggle that controls how an uploaded background reference image is
 * consumed by the VTON pipeline.
 *
 * - "inspiration" (default): the image is analyzed once per batch
 *   (`analyzeBackgroundScene`) and never attached to the image-gen call.
 * - "replica": the image is passed directly to `gemini-3.1-flash-image-preview`
 *   with an exact-replication directive; scene analysis is skipped.
 */
function ImageReferenceModeToggle({
  value,
  onChange,
  size = "md",
}: {
  value: BackgroundImageMode;
  onChange: (mode: BackgroundImageMode) => void;
  size?: "sm" | "md";
}) {
  const padding = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  return (
    <div className="space-y-1">
      <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => onChange("inspiration")}
          title="Extract scene structure, palette, and lighting from the reference. The image itself is not sent to the image generator."
          className={cn(
            "font-medium transition-colors duration-200 flex items-center gap-1.5",
            padding,
            value === "inspiration"
              ? "btn-gradient text-white"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Inspiration
        </button>
        <button
          type="button"
          onClick={() => onChange("replica")}
          title="Pass this image directly to the image generator with an exact-replication directive."
          className={cn(
            "font-medium transition-colors duration-200 flex items-center gap-1.5 border-l border-border",
            padding,
            value === "replica"
              ? "btn-gradient text-white border-transparent"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Replica
        </button>
      </div>
      <p className={cn("text-muted-foreground leading-tight", size === "sm" ? "text-[10px]" : "text-[11px]")}>
        {value === "replica"
          ? "Image is attached directly to the generator with an exact-replication directive."
          : "Scene, palette, and lighting are extracted; image is not sent to the generator."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bulk Background Card                                               */
/* ------------------------------------------------------------------ */
function BulkBackgroundCard({
  bg,
  index,
  onRemove,
  onUpdate,
}: {
  bg: BulkBackground;
  index: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, update: Partial<BulkBackground>) => void;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(bg.name);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== bg.name) onUpdate(bg.id, { name: trimmed });
    setIsEditingName(false);
  };

  const handleModeSwitch = (mode: BackgroundMode) => {
    onUpdate(bg.id, { config: { ...bg.config, mode } });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (bg.config.inspirationImage) {
        URL.revokeObjectURL(bg.config.inspirationImage.preview);
      }
      onUpdate(bg.id, {
        config: {
          ...bg.config,
          mode: "inspiration",
          inspirationImage: { file, preview: URL.createObjectURL(file) },
        },
      });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = () => {
    if (bg.config.inspirationImage) {
      URL.revokeObjectURL(bg.config.inspirationImage.preview);
    }
    onUpdate(bg.id, {
      config: { ...bg.config, inspirationImage: undefined },
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 relative group transition-colors duration-200 hover:shadow-sm">
      {/* Header: index badge + name + remove */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          {isEditingName ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="text-sm font-medium bg-transparent border-b border-primary/50 outline-none w-full min-w-0"
            />
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <p className="text-sm font-medium truncate">{bg.name}</p>
              <button
                onClick={() => {
                  setEditName(bg.name);
                  setIsEditingName(true);
                }}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(bg.id)}
          className="p-1 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1.5">
        <button
          onClick={() => handleModeSwitch("inspiration")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 border",
            bg.config.mode === "inspiration"
              ? "btn-gradient text-white border-transparent shadow-sm"
              : "bg-card text-muted-foreground border-border hover:border-primary/50"
          )}
        >
          <ImageIcon className="w-3 h-3" />
          Image
        </button>
        <button
          onClick={() => handleModeSwitch("text")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 border",
            bg.config.mode === "text"
              ? "btn-gradient text-white border-transparent shadow-sm"
              : "bg-card text-muted-foreground border-border hover:border-primary/50"
          )}
        >
          <Type className="w-3 h-3" />
          Text
        </button>
      </div>

      {/* Content */}
      {bg.config.mode === "inspiration" ? (
        <div className="space-y-2">
          {bg.config.inspirationImage ? (
            <>
              <div className="relative inline-block rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bg.config.inspirationImage.preview}
                  alt={bg.name}
                  className="max-h-32 object-cover rounded-lg"
                />
                <button
                  onClick={removeImage}
                  className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <ImageReferenceModeToggle
                value={bg.config.imageReferenceMode ?? "inspiration"}
                onChange={(imageReferenceMode) =>
                  onUpdate(bg.id, {
                    config: { ...bg.config, imageReferenceMode },
                  })
                }
                size="sm"
              />
            </>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="border border-dashed border-border rounded-lg p-5 flex flex-col items-center gap-2 w-full cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-muted/50 group/upload"
            >
              <Upload className="w-4 h-4 text-muted-foreground group-hover/upload:text-primary transition-colors" />
              <p className="text-xs text-muted-foreground">Upload image</p>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      ) : (
        <Textarea
          placeholder="Describe the background... e.g., 'Clean white studio', 'Urban street'"
          value={bg.config.textDescription}
          onChange={(e) =>
            onUpdate(bg.id, {
              config: { ...bg.config, textDescription: e.target.value },
            })
          }
          rows={2}
          className="resize-none rounded-lg text-xs border-border bg-muted/20 focus:bg-background transition-colors"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main StepStyling component                                         */
/* ------------------------------------------------------------------ */

interface StepStylingProps {
  store: VTONStore;
}

export function StepStyling({ store }: StepStylingProps) {
  const {
    mode,
    featureMode,
    productCategory,
    background,
    setBackground,
    selectedModel,
    setSelectedModel,
    modelImage,
    setModelImage,
    modelReferenceViews,
    setModelReferenceView,
    clearModelReferenceViews,
    attachSavedModelToVTON,
    bulkModelImages,
    addBulkModelImage,
    removeBulkModelImage,
    renameBulkModelImage,
    bulkBackgrounds,
    addBulkBackground,
    removeBulkBackground,
    updateBulkBackground,
    bulkBgAssignment,
    setBulkBgAssignment,
    productBgMap,
    setProductBgMapping,
    primaryFolders,
    modelSwapBgMode,
    setModelSwapBgMode,
  } = store;

  const isModelSwap = featureMode === "model-swap";
  const isFootwear = productCategory === "footwear";
  const bgInputRef = useRef<HTMLInputElement>(null);
  const modelImageRef = useRef<HTMLInputElement>(null);
  const bulkModelInputRef = useRef<HTMLInputElement>(null);

  // Model reference views modal (single-VTON): manage up to 3 labelled images.
  const [modelModalOpen, setModelModalOpen] = useState(false);
  // Model Library picker (single-VTON): lazily loaded when opened.
  const [libraryModels, setLibraryModels] = useState<SavedModel[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const openLibrary = useCallback(() => {
    setShowLibrary((prev) => !prev);
    if (libraryModels.length === 0) {
      setLibraryLoading(true);
      loadSavedModels()
        .then(setLibraryModels)
        .catch(() => {})
        .finally(() => setLibraryLoading(false));
    }
  }, [libraryModels.length]);

  const VIEW_LABELS: Record<ModelReferenceViewKind, string> = {
    "full-body": "Full body",
    "face-closeup": "Face close-up",
    "back-head": "Back of head",
  };

  const handleBgModeChange = useCallback(
    (bgMode: BackgroundMode) => {
      setBackground({ ...background, mode: bgMode });
    },
    [background, setBackground]
  );

  const handleBgImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setBackground({
          ...background,
          mode: "inspiration",
          inspirationImage: {
            file,
            preview: URL.createObjectURL(file),
          },
        });
      }
    },
    [background, setBackground]
  );

  const removeBgImage = useCallback(() => {
    if (background.inspirationImage) {
      URL.revokeObjectURL(background.inspirationImage.preview);
    }
    setBackground({
      ...background,
      inspirationImage: undefined,
    });
  }, [background, setBackground]);

  const handleModelImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (modelImage) URL.revokeObjectURL(modelImage.preview);
        // A single manually-uploaded photo replaces any attached multi-view set.
        clearModelReferenceViews();
        setModelImage({
          file,
          preview: URL.createObjectURL(file),
        });
      }
      if (modelImageRef.current) modelImageRef.current.value = "";
    },
    [modelImage, setModelImage, clearModelReferenceViews]
  );

  const removeModelImage = useCallback(() => {
    if (modelImage) {
      URL.revokeObjectURL(modelImage.preview);
      setModelImage(null);
    }
    clearModelReferenceViews();
  }, [modelImage, setModelImage, clearModelReferenceViews]);

  // Bulk model upload handler
  const handleBulkModelUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) =>
        f.type.startsWith("image/")
      );
      for (const file of files) {
        const id = `bm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        addBulkModelImage({
          id,
          name: file.name.split(".")[0],
          file,
          preview: URL.createObjectURL(file),
        });
      }
      if (bulkModelInputRef.current) bulkModelInputRef.current.value = "";
    },
    [addBulkModelImage]
  );

  const handleBulkModelDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      for (const file of files) {
        const id = `bm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        addBulkModelImage({
          id,
          name: file.name.split(".")[0],
          file,
          preview: URL.createObjectURL(file),
        });
      }
    },
    [addBulkModelImage]
  );

  const handleAddBulkBackground = useCallback(() => {
    const id = `bg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const count = bulkBackgrounds.length + 1;
    addBulkBackground({
      id,
      name: `Background ${count}`,
      config: { mode: "text", textDescription: "" },
    });
  }, [bulkBackgrounds.length, addBulkBackground]);

  const maleModels = AI_MODELS.filter((m) => m.gender === "male");
  const femaleModels = AI_MODELS.filter((m) => m.gender === "female");

  // Background section is shared between modes
  const backgroundSection = (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Background</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose how you want the background to look
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleBgModeChange("inspiration")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border",
            background.mode === "inspiration"
              ? "btn-gradient text-white border-transparent shadow-sm"
              : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
          )}
        >
          <ImageIcon className="w-4 h-4" />
          Inspiration Image
        </button>
        <button
          onClick={() => handleBgModeChange("text")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 border",
            background.mode === "text"
              ? "btn-gradient text-white border-transparent shadow-sm"
              : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
          )}
        >
          <Type className="w-4 h-4" />
          Text Description
        </button>
      </div>

      {background.mode === "inspiration" ? (
        <div className="space-y-3">
          {background.inspirationImage ? (
            <>
              <div className="relative inline-block rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={background.inspirationImage.preview}
                  alt="Background inspiration"
                  className="max-h-48 object-cover rounded-lg"
                />
                <button
                  onClick={removeBgImage}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <ImageReferenceModeToggle
                value={background.imageReferenceMode ?? "inspiration"}
                onChange={(imageReferenceMode) =>
                  setBackground({ ...background, imageReferenceMode })
                }
              />
            </>
          ) : (
            <button
              onClick={() => bgInputRef.current?.click()}
              className="border border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 w-full cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-muted/50 group"
            >
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground">
                Upload an inspiration image for the background
              </p>
            </button>
          )}
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            onChange={handleBgImageUpload}
            className="hidden"
          />
        </div>
      ) : (
        <Textarea
          placeholder="Describe the background/environment... e.g., 'Clean white studio with soft shadow', 'Urban street in golden hour light', 'Minimalist grey backdrop with plants'"
          value={background.textDescription}
          onChange={(e) =>
            setBackground({ ...background, textDescription: e.target.value })
          }
          rows={3}
          className="resize-none rounded-lg border-border bg-muted/30 focus:bg-background transition-colors"
        />
      )}

      {/* Custom lighting: even high-key, shadowless. Works on top of any background mode. */}
      <button
        type="button"
        onClick={() => setBackground({ ...background, evenLighting: !background.evenLighting })}
        className={cn(
          "w-full flex items-start gap-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 border",
          background.evenLighting
            ? "bg-card border-primary shadow-sm"
            : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
        )}
      >
        <div
          className={cn(
            "mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 transition-colors",
            background.evenLighting ? "btn-gradient border-transparent text-white" : "border-border bg-background"
          )}
        >
          {background.evenLighting && <Check className="w-3.5 h-3.5" />}
        </div>
        <div className="space-y-0.5">
          <p className={cn("text-sm font-medium", background.evenLighting ? "text-foreground" : "")}>
            Even high-key lighting (no shadows)
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Lights the model and background evenly at one uniform intensity with no cast shadows
            anywhere — flat, bright, shadowless high-key studio light.
          </p>
        </div>
      </button>
    </div>
  );

  // Model swap background mode section
  const modelSwapBgSection = (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Background</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose whether to keep the original background or replace it
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODEL_SWAP_BG_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setModelSwapBgMode(option.value)}
            className={cn(
              "relative flex items-center gap-3 px-5 py-4 rounded-xl text-left transition-colors duration-200 border",
              modelSwapBgMode === option.value
                ? "bg-card border-primary shadow-sm"
                : "bg-card border-border hover:border-primary/50 hover:shadow-sm"
            )}
          >
            {modelSwapBgMode === option.value && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <span className="text-2xl leading-none">{option.icon}</span>
            <div>
              <p className={cn(
                "text-sm font-semibold",
                modelSwapBgMode === option.value ? "text-primary" : "text-foreground"
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
      {modelSwapBgMode === "new-background" && (
        <div className="pt-2">
          {backgroundSection}
        </div>
      )}
    </div>
  );

  // Common AI model section for model swap (both single and bulk will use model selection)
  const modelSwapModelSection = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">New AI Model</h3>
          <Badge variant="secondary" className="text-xs">Required</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose the new model to replace the existing one in your product photos
        </p>
      </div>

      {/* Upload Custom Model Image */}
      <div className={cn(
        "rounded-xl border p-6 space-y-3 transition-colors duration-200",
        modelImage
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:shadow-sm"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
              modelImage
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Upload Model Photo</p>
              <p className="text-[11px] text-muted-foreground">Best for exact likeness</p>
            </div>
          </div>
          {modelImage && (
            <Badge variant="default" className="text-[11px]">Active</Badge>
          )}
        </div>

        {modelImage ? (
          <div className="flex items-start gap-4">
            <div className="relative group rounded-lg overflow-hidden border border-border shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={modelImage.preview}
                alt="Model reference"
                className="w-28 h-36 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
              <button
                onClick={removeModelImage}
                className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/90"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                This model will replace the existing one in your product photos while preserving the clothing and pose.
              </p>
              <button
                onClick={() => modelImageRef.current?.click()}
                className="text-xs text-primary font-medium hover:underline underline-offset-2 w-fit"
              >
                Replace image
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => modelImageRef.current?.click()}
            className="border border-dashed border-border rounded-lg p-4 flex items-center gap-3 w-full cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 group"
          >
            <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0">
              <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">
                Upload a reference photo
              </p>
              <p className="text-[11px] text-muted-foreground">
                Full-body or portrait for best results
              </p>
            </div>
          </button>
        )}
        <input
          ref={modelImageRef}
          type="file"
          accept="image/*"
          onChange={handleModelImageUpload}
          className="hidden"
        />
      </div>

      {/* OR Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          and / or choose a preset
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Preset Models */}
      <div className={cn(
        "rounded-xl border p-6 space-y-4 transition-colors duration-200",
        selectedModel && !modelImage
          ? "border-primary bg-primary/5"
          : selectedModel
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:shadow-sm"
      )}>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Female Models
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {femaleModels.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(selectedModel?.id === model.id ? null : model)}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors text-center",
                  selectedModel?.id === model.id
                    ? "bg-card border-primary shadow-sm"
                    : "bg-background border-border hover:border-primary/50 hover:shadow-sm"
                )}
              >
                {selectedModel?.id === model.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <span className="text-3xl">{model.thumbnail}</span>
                <div>
                  <p className="text-sm font-medium">{model.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {model.ethnicity}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Male Models
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {maleModels.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(selectedModel?.id === model.id ? null : model)}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors text-center",
                  selectedModel?.id === model.id
                    ? "bg-card border-primary shadow-sm"
                    : "bg-background border-border hover:border-primary/50 hover:shadow-sm"
                )}
              >
                {selectedModel?.id === model.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <span className="text-3xl">{model.thumbnail}</span>
                <div>
                  <p className="text-sm font-medium">{model.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {model.ethnicity}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
        {selectedModel && (
          <p className="text-xs text-muted-foreground italic">
            Preset selected: {selectedModel.name}. {modelImage ? "This will be combined with your uploaded photo." : "Click again to deselect."}
          </p>
        )}
      </div>
    </div>
  );

  // ======================================================================
  // MODEL SWAP - BULK MODE
  // ======================================================================
  if (isModelSwap && mode === "bulk") {
    return (
      <div className="space-y-8">
        {/* Background Mode */}
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Background</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose whether to keep original backgrounds or use new ones
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODEL_SWAP_BG_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setModelSwapBgMode(option.value)}
                className={cn(
                  "relative flex items-center gap-3 px-5 py-4 rounded-xl text-left transition-colors border",
                  modelSwapBgMode === option.value
                    ? "bg-card border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/50 hover:shadow-sm"
                )}
              >
                {modelSwapBgMode === option.value && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <span className="text-2xl leading-none">{option.icon}</span>
                <div>
                  <p className={cn(
                    "text-sm font-semibold",
                    modelSwapBgMode === option.value ? "text-primary" : "text-foreground"
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

          {/* Multi-Background Section (only when new-background is selected) */}
          {modelSwapBgMode === "new-background" && (
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">Backgrounds</h4>
                  <Badge variant="secondary" className="text-xs">
                    Round-Robin
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add multiple backgrounds — each product will be assigned a background in round-robin order.
                </p>
              </div>
              {bulkBackgrounds.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {bulkBackgrounds.map((bg, i) => (
                    <BulkBackgroundCard
                      key={bg.id}
                      bg={bg}
                      index={i}
                      onRemove={removeBulkBackground}
                      onUpdate={updateBulkBackground}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={handleAddBulkBackground}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors border border-dashed",
                  "border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-muted/30"
                )}
              >
                <Plus className="w-4 h-4" />
                Add Background
              </button>
            </div>
          )}
        </div>

        {/* Bulk AI Models Upload */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">New AI Models</h3>
              <Badge variant="secondary" className="text-xs">
                Required
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload reference photos for each new AI model. Products will cycle through models via round-robin.
            </p>
          </div>

          {bulkModelImages.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {bulkModelImages.map((m) => (
                <BulkModelCard
                  key={m.id}
                  model={m}
                  onRemove={removeBulkModelImage}
                  onRename={renameBulkModelImage}
                />
              ))}
              <button
                onClick={() => bulkModelInputRef.current?.click()}
                className="aspect-[3/4] rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors duration-200 text-muted-foreground hover:text-primary bg-muted/20 hover:bg-muted/50"
              >
                <Users className="w-6 h-6" />
                <span className="text-xs font-medium">Add More</span>
              </button>
            </div>
          )}

          {bulkModelImages.length === 0 && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleBulkModelDrop}
              onClick={() => bulkModelInputRef.current?.click()}
              className="border border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-muted/50 group"
            >
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Users className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drop model photos here or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload one image per new AI model. Each will replace existing models in your product photos.
                </p>
              </div>
            </div>
          )}

          {bulkModelImages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {bulkModelImages.length} model{bulkModelImages.length !== 1 ? "s" : ""} uploaded
            </p>
          )}

          <input
            ref={bulkModelInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleBulkModelUpload}
            className="hidden"
          />
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
        {modelSwapBgSection}
        {modelSwapModelSection}
      </div>
    );
  }

  // ======================================================================
  // VTON - BULK MODE - Multiple AI Model Images + Multiple Backgrounds
  // ======================================================================
  if (mode === "bulk") {
    return (
      <div className="space-y-8">
        {/* Multi-Background Section */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Backgrounds</h3>
              <div className="flex items-center rounded-md border border-border overflow-hidden text-xs">
                <button
                  onClick={() => setBulkBgAssignment("round-robin")}
                  className={cn(
                    "px-2.5 py-1 font-medium transition-colors duration-150",
                    bulkBgAssignment === "round-robin"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  Round-Robin
                </button>
                <button
                  onClick={() => setBulkBgAssignment("manual")}
                  className={cn(
                    "px-2.5 py-1 font-medium transition-colors duration-150 border-l border-border",
                    bulkBgAssignment === "manual"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  Manual
                </button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {bulkBgAssignment === "round-robin"
                ? <>Add multiple backgrounds — each product will be assigned a background in round-robin order.
                    {bulkBackgrounds.length === 0 && " A default studio background is used if none are added."}</>
                : <>Manually assign a specific background to each product folder.
                    {bulkBackgrounds.length === 0 && " Add at least one background to begin assigning."}</>}
            </p>
          </div>

          {/* Existing backgrounds grid */}
          {bulkBackgrounds.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bulkBackgrounds.map((bg, i) => (
                <BulkBackgroundCard
                  key={bg.id}
                  bg={bg}
                  index={i}
                  onRemove={removeBulkBackground}
                  onUpdate={updateBulkBackground}
                />
              ))}
            </div>
          )}

          {/* Add background button */}
          <button
            onClick={handleAddBulkBackground}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 border border-dashed",
              "border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-muted/50"
            )}
          >
            <Plus className="w-4 h-4" />
            Add Background
          </button>

          {bulkBgAssignment === "round-robin" && bulkBackgrounds.length > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              {bulkBackgrounds.length} background{bulkBackgrounds.length !== 1 ? "s" : ""} configured — products will cycle through them
            </p>
          )}

          {/* Manual background assignment mapping */}
          {bulkBgAssignment === "manual" && bulkBackgrounds.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Product &rarr; Background Mapping
              </p>
              {primaryFolders.filter((f) => f.images.length > 0).length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  Add products in Step 1 to assign backgrounds.
                </p>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border">
                  {primaryFolders.filter((f) => f.images.length > 0).map((folder) => {
                    const currentBgId = productBgMap[folder.id] || bulkBackgrounds[0]?.id || "";
                    return (
                      <div key={folder.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">{folder.name}</span>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {folder.images.length} img{folder.images.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <Select
                          value={currentBgId}
                          onValueChange={(val) => setProductBgMapping(folder.id, val)}
                        >
                          <SelectTrigger className="h-7 text-xs w-[180px] shrink-0 bg-emerald-500/5 border-emerald-500/20">
                            <SelectValue placeholder="Select background" />
                          </SelectTrigger>
                          <SelectContent>
                            {bulkBackgrounds.map((bg) => (
                              <SelectItem key={bg.id} value={bg.id} className="text-xs">
                                {bg.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bulk AI Models Upload */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">AI Models</h3>
              <Badge variant="secondary" className="text-xs">
                Required
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload reference photos for each AI model. Each combination will use a different model.
            </p>
          </div>

          {/* Uploaded models grid */}
          {bulkModelImages.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {bulkModelImages.map((m) => (
                <BulkModelCard
                  key={m.id}
                  model={m}
                  onRemove={removeBulkModelImage}
                  onRename={renameBulkModelImage}
                />
              ))}
              {/* Add more card */}
              <button
                onClick={() => bulkModelInputRef.current?.click()}
                className="aspect-[3/4] rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors duration-200 text-muted-foreground hover:text-primary bg-muted/20 hover:bg-muted/50"
              >
                <Users className="w-6 h-6" />
                <span className="text-xs font-medium">Add More</span>
              </button>
            </div>
          )}

          {/* Empty state */}
          {bulkModelImages.length === 0 && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleBulkModelDrop}
              onClick={() => bulkModelInputRef.current?.click()}
              className="border border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-muted/50 group"
            >
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Users className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drop model photos here or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload one image per AI model. Each will be used in combinations with your garments.
                </p>
              </div>
            </div>
          )}

          {bulkModelImages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {bulkModelImages.length} model{bulkModelImages.length !== 1 ? "s" : ""} uploaded
            </p>
          )}

          <input
            ref={bulkModelInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleBulkModelUpload}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  // ======================================================================
  // SINGLE MODE (original)
  // ======================================================================
  return (
    <div className="space-y-8">
      {backgroundSection}

      {/* AI Model Selection */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">AI Model</h3>
            {isFootwear && (
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isFootwear
              ? "Optional — needed only for on-model poses. Product-only shots don't require a model."
              : "Pick a saved model with its reference views, upload your own photo, or choose a preset"}
          </p>
        </div>

        {/* Option A: model image — one tile; click to manage up to 3 labelled views */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              modelReferenceViews.length > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Model image</p>
              <p className="text-[11px] text-muted-foreground">
                Upload a model photo — click it to add face &amp; back-of-head views for stronger consistency
              </p>
            </div>
          </div>

          {modelReferenceViews.length > 0 || modelImage ? (
            <div className="flex items-start gap-4">
              <div className="relative group rounded-lg overflow-hidden border border-primary shrink-0">
                <button
                  onClick={() => setModelModalOpen(true)}
                  className="block"
                  title="Manage model images"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={modelReferenceViews.find((v) => v.kind === "full-body")?.preview ?? modelImage!.preview}
                    alt="Model reference"
                    className="w-28 h-36 object-cover"
                  />
                  <span className="absolute left-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {modelReferenceViews.length}/3 views
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-[11px] font-medium text-white">Manage images</span>
                  </div>
                </button>
                <button
                  onClick={removeModelImage}
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/50 backdrop-blur-sm text-white transition-colors hover:bg-red-500/90"
                  title="Remove model"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <p className="text-xs text-muted-foreground">
                  {modelReferenceViews.length > 1
                    ? "All views are sent as labelled references ([Full body] / [Face close-up] / [Back of head])."
                    : "With only the full body, a single-image generation is used. Click the image to add face & back-of-head views."}
                </p>
                <button
                  onClick={() => setModelModalOpen(true)}
                  className="text-xs text-primary font-medium hover:underline underline-offset-2 w-fit"
                >
                  Manage images
                </button>
              </div>
            </div>
          ) : (
            <label className="border border-dashed border-border rounded-lg p-4 flex items-center gap-3 w-full cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-muted/50 group">
              <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0">
                <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Upload a model photo</p>
                <p className="text-[11px] text-muted-foreground">Full body — add face &amp; back-of-head views after</p>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setModelReferenceView("full-body", file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {/* Modal: manage up to 3 labelled model views */}
        <Dialog open={modelModalOpen} onOpenChange={setModelModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Model images</DialogTitle>
              <DialogDescription>
                Upload up to 3 labelled images of the same person. Full body is required; add a
                face close-up and back of head for more consistent results across angles.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3">
              {([
                { kind: "full-body", label: VIEW_LABELS["full-body"] },
                { kind: "face-closeup", label: VIEW_LABELS["face-closeup"] },
                { kind: "back-head", label: VIEW_LABELS["back-head"] },
              ] as { kind: ModelReferenceViewKind; label: string }[]).map((slot) => {
                const view = modelReferenceViews.find((v) => v.kind === slot.kind);
                const hasFullBody = modelReferenceViews.some((v) => v.kind === "full-body");
                const locked = slot.kind !== "full-body" && !hasFullBody;
                return (
                  <div key={slot.kind} className="space-y-1.5">
                    <span className="text-[11px] font-medium text-foreground">{slot.label}</span>
                    {view ? (
                      <div className="relative rounded-lg overflow-hidden border border-primary aspect-[3/4]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={view.preview} alt={slot.label} className="h-full w-full object-cover" />
                        <button
                          onClick={() => setModelReferenceView(slot.kind, null)}
                          className="absolute top-1 right-1 p-1 rounded-lg bg-black/50 backdrop-blur-sm text-white transition-colors hover:bg-red-500/90"
                          title={`Remove ${slot.label}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label
                        className={cn(
                          "flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-2 text-center transition-colors",
                          locked
                            ? "border-border/50 opacity-50 pointer-events-none"
                            : "cursor-pointer border-border hover:border-primary/50 hover:bg-muted/40"
                        )}
                        title={locked ? "Add a full body shot first" : `Upload ${slot.label}`}
                      >
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {locked ? "Full body first" : "Upload"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={locked}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setModelReferenceView(slot.kind, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <button
                onClick={() => setModelModalOpen(false)}
                className="btn-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white"
              >
                Done
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Or use a saved model from the Model Library (fills the slots above) */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted text-muted-foreground">
                <Library className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Model Library</p>
                <p className="text-[11px] text-muted-foreground">Use a saved model with all its reference views</p>
              </div>
            </div>
            <button
              onClick={openLibrary}
              className="text-xs font-medium text-primary hover:underline underline-offset-2"
            >
              {showLibrary ? "Hide" : "Browse"}
            </button>
          </div>
          {showLibrary && (
            libraryLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : libraryModels.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No saved models yet. Create and save models in the AI Models feature.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {libraryModels.map((m) => {
                  const viewCount = 1 + (m.faceCloseUp?.imageData ? 1 : 0) + (m.backHead?.imageData ? 1 : 0);
                  return (
                    <button
                      key={m.id}
                      onClick={() => attachSavedModelToVTON(m)}
                      className="group relative overflow-hidden rounded-lg border border-border hover:border-primary transition-colors"
                      title={`Use ${m.name} (${viewCount} view${viewCount !== 1 ? "s" : ""})`}
                    >
                      <div className="aspect-[3/4]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.imageData} alt={m.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent p-1">
                        <p className="truncate text-[10px] font-medium text-white">{m.name}</p>
                      </div>
                      {viewCount > 1 && (
                        <span className="absolute bottom-1 right-1 rounded bg-primary px-1 py-0.5 text-[9px] font-medium text-primary-foreground">
                          {viewCount} views
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* OR Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            and / or choose a preset
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Option B: Preset Models */}
        <div className={cn(
          "rounded-xl border p-6 space-y-4 transition-colors",
          selectedModel && !modelImage
            ? "border-primary bg-primary/5"
            : selectedModel
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card"
        )}>
          {/* Female Models */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Female Models
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {femaleModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(selectedModel?.id === model.id ? null : model)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors duration-200 text-center",
                    selectedModel?.id === model.id
                      ? "bg-card border-primary shadow-sm"
                      : "bg-background border-border hover:border-primary/50 hover:shadow-sm"
                  )}
                >
                  {selectedModel?.id === model.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <span className="text-3xl">{model.thumbnail}</span>
                  <div>
                    <p className="text-sm font-medium">{model.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {model.ethnicity}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Male Models */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Male Models
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {maleModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(selectedModel?.id === model.id ? null : model)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors duration-200 text-center",
                    selectedModel?.id === model.id
                      ? "bg-card border-primary shadow-sm"
                      : "bg-background border-border hover:border-primary/50 hover:shadow-sm"
                  )}
                >
                  {selectedModel?.id === model.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <span className="text-3xl">{model.thumbnail}</span>
                  <div>
                    <p className="text-sm font-medium">{model.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {model.ethnicity}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedModel && (
            <p className="text-xs text-muted-foreground italic">
              Preset selected: {selectedModel.name}. {modelImage ? "This will be combined with your uploaded photo." : "Click again to deselect."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
