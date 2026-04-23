"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, Plus, Trash2, Check, User, ChevronDown } from "lucide-react";
import { ImageUploadZone } from "./image-upload-zone";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  VIDEO_THEME_GROUPS,
  VIDEO_CAMERA_MOVEMENT_GROUPS,
  VIDEO_MODEL_MOVEMENT_GROUPS,
  VIDEO_DURATION_OPTIONS,
  MAX_CAMERA_MOVEMENTS,
  MAX_MODEL_MOVEMENTS,
  AI_MODELS,
} from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { BackgroundConfig, BulkBackground, BulkModelImage, CameraMovement, ModelMovement, VideoTheme } from "@/lib/types";

export function StepVideoStyling({ store }: { store: VTONStore }) {
  const {
    mode,
    videoProductCategory,
    videoGender,
    videoTheme,
    setVideoTheme,
    videoCameraMovements,
    setVideoCameraMovements,
    videoModelMovements,
    setVideoModelMovements,
    videoDuration,
    setVideoDuration,
    videoBackground,
    setVideoBackground,
    videoSelectedModel,
    setVideoSelectedModel,
    videoModelImage,
    setVideoModelImage,
    videoBulkModelImages,
    addVideoBulkModelImage,
    removeVideoBulkModelImage,
    videoBulkBackgrounds,
    addVideoBulkBackground,
    removeVideoBulkBackground,
    updateVideoBulkBackground,
  } = store;

  const isBulk = mode === "bulk";
  const isClothing = videoProductCategory === "clothing";
  const isFootwear = videoProductCategory === "footwear";
  const hasModel = videoSelectedModel !== null || videoModelImage !== null || (isBulk && videoBulkModelImages.length > 0);
  const showModelMovements = isClothing || (isFootwear && hasModel);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const maxCamMovements = MAX_CAMERA_MOVEMENTS[videoDuration];
  const maxModelMovements = MAX_MODEL_MOVEMENTS[videoDuration];

  const [expandedThemeGroups, setExpandedThemeGroups] = useState<Set<string>>(() => {
    const active = VIDEO_THEME_GROUPS.find((g) => g.options.some((o) => o.value === videoTheme));
    return new Set(active ? [active.category] : [VIDEO_THEME_GROUPS[0].category]);
  });
  const [expandedCamGroups, setExpandedCamGroups] = useState<Set<string>>(() => {
    const active = VIDEO_CAMERA_MOVEMENT_GROUPS.filter((g) => g.options.some((o) => videoCameraMovements.includes(o.value)));
    return new Set(active.length > 0 ? active.map((g) => g.category) : [VIDEO_CAMERA_MOVEMENT_GROUPS[0].category]);
  });
  const [expandedModelMoveGroups, setExpandedModelMoveGroups] = useState<Set<string>>(() => {
    const active = VIDEO_MODEL_MOVEMENT_GROUPS.filter((g) => g.options.some((o) => videoModelMovements.includes(o.value)));
    return new Set(active.length > 0 ? active.map((g) => g.category) : [VIDEO_MODEL_MOVEMENT_GROUPS[0].category]);
  });

  const toggleGroup = (set: Set<string>, setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredModels = AI_MODELS.filter(
    (m) => videoGender === "unisex" || m.gender === videoGender
  );

  const handleModelImageUpload = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const file = files[0];
        if (videoModelImage) URL.revokeObjectURL(videoModelImage.preview);
        setVideoModelImage({ file, preview: URL.createObjectURL(file) });
      }
    },
    [videoModelImage, setVideoModelImage]
  );

  const handleBulkModelImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) =>
        f.type.startsWith("image/")
      );
      files.forEach((file) => {
        const id = `vid-model-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        addVideoBulkModelImage({
          id,
          name: file.name.replace(/\.[^.]+$/, ""),
          file,
          preview: URL.createObjectURL(file),
        });
      });
      if (modelInputRef.current) modelInputRef.current.value = "";
    },
    [addVideoBulkModelImage]
  );

  const handleBgInspirationUpload = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const file = files[0];
        if (videoBackground.inspirationImage)
          URL.revokeObjectURL(videoBackground.inspirationImage.preview);
        setVideoBackground({
          ...videoBackground,
          mode: "inspiration",
          inspirationImage: { file, preview: URL.createObjectURL(file) },
        });
      }
    },
    [videoBackground, setVideoBackground]
  );

  const handleAddBulkBg = useCallback(() => {
    const id = `vid-bg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    addVideoBulkBackground({
      id,
      name: `Background ${videoBulkBackgrounds.length + 1}`,
      config: { mode: "text", textDescription: "" },
    });
  }, [addVideoBulkBackground, videoBulkBackgrounds.length]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Video Theme */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Video Theme
        </label>
        <div className="space-y-2">
          {VIDEO_THEME_GROUPS.map((group) => {
            const isOpen = expandedThemeGroups.has(group.category);
            const selectedInGroup = group.options.find((o) => o.value === videoTheme);
            return (
              <div key={group.category} className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => toggleGroup(expandedThemeGroups, setExpandedThemeGroups, group.category)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{group.label}</span>
                    {selectedInGroup && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {selectedInGroup.label}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 pt-1 border-t border-border/50">
                    {group.options.map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => setVideoTheme(theme.value)}
                        className={cn(
                          "relative flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-colors duration-200",
                          videoTheme === theme.value
                            ? "border-primary bg-muted shadow-sm"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {videoTheme === theme.value && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        <span className="text-lg">{theme.icon}</span>
                        <span className="text-sm font-medium">{theme.label}</span>
                        <span className="text-[11px] text-muted-foreground leading-tight">
                          {theme.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Video Duration */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Video Duration
        </label>
        <div className="flex gap-3">
          {VIDEO_DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVideoDuration(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1 px-6 py-3 rounded-lg border transition-colors duration-200",
                videoDuration === opt.value
                  ? "border-primary bg-muted shadow-sm"
                  : "border-border hover:border-primary/50"
              )}
            >
              <span
                className={cn(
                  "text-lg font-bold",
                  videoDuration === opt.value
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {opt.label}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {opt.description}
              </span>
            </button>
          ))}
        </div>
        {videoDuration > 8 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Extended videos are generated at 720p resolution. The base 8s clip is generated first, then extended by {videoDuration - 8}s.
          </p>
        )}
      </div>

      {/* Camera Movement */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Camera Movement
          </label>
          <span className="text-xs text-muted-foreground">
            {videoCameraMovements.length}/{maxCamMovements} selected
          </span>
        </div>
        <div className="space-y-2">
          {VIDEO_CAMERA_MOVEMENT_GROUPS.map((group) => {
            const isOpen = expandedCamGroups.has(group.category);
            const selectedCount = group.options.filter((o) => videoCameraMovements.includes(o.value)).length;
            return (
              <div key={group.category} className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => toggleGroup(expandedCamGroups, setExpandedCamGroups, group.category)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{group.label}</span>
                    {selectedCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {selectedCount}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 pt-1 border-t border-border/50">
                    {group.options.map((cam) => {
                      const isSelected = videoCameraMovements.includes(cam.value);
                      const isDisabled = !isSelected && videoCameraMovements.length >= maxCamMovements;
                      return (
                        <button
                          key={cam.value}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isSelected) {
                              const next = videoCameraMovements.filter((v) => v !== cam.value);
                              setVideoCameraMovements(next.length > 0 ? next : [cam.value]);
                            } else {
                              setVideoCameraMovements([...videoCameraMovements, cam.value]);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors duration-200",
                            isSelected
                              ? "border-primary bg-muted text-primary font-medium shadow-sm"
                              : isDisabled
                              ? "border-border opacity-40 cursor-not-allowed text-muted-foreground"
                              : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span>{cam.icon}</span>
                          <div className="text-left">
                            <div className="text-xs font-medium">{cam.label}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {videoCameraMovements.length >= 2 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            The video will transition between the selected camera movements for dynamic variety.
          </p>
        )}
      </div>

      {/* Model Movement */}
      {showModelMovements && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Model Movement
            </label>
            <span className="text-xs text-muted-foreground">
              {videoModelMovements.length}/{maxModelMovements} selected
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Choose how the model moves in the video. Movements are sequenced in the order you select them.
          </p>
          <div className="space-y-2">
            {VIDEO_MODEL_MOVEMENT_GROUPS
              .filter((group) => !group.footwearOnly || isFootwear)
              .map((group) => {
                const isOpen = expandedModelMoveGroups.has(group.category);
                const visibleOptions = group.options.filter((o) => !o.footwearOnly || isFootwear);
                const selectedCount = visibleOptions.filter((o) => videoModelMovements.includes(o.value)).length;
                return (
                  <div key={group.category} className="rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => toggleGroup(expandedModelMoveGroups, setExpandedModelMoveGroups, group.category)}
                      className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{group.label}</span>
                        {selectedCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {selectedCount}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 pt-1 border-t border-border/50">
                        {visibleOptions.map((mv) => {
                          const isSelected = videoModelMovements.includes(mv.value);
                          const isDisabled = !isSelected && videoModelMovements.length >= maxModelMovements;
                          return (
                            <button
                              key={mv.value}
                              disabled={isDisabled}
                              onClick={() => {
                                if (isSelected) {
                                  setVideoModelMovements(videoModelMovements.filter((v) => v !== mv.value));
                                } else {
                                  setVideoModelMovements([...videoModelMovements, mv.value]);
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors duration-200",
                                isSelected
                                  ? "border-primary bg-muted text-primary font-medium shadow-sm"
                                  : isDisabled
                                  ? "border-border opacity-40 cursor-not-allowed text-muted-foreground"
                                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <span>{mv.icon}</span>
                              <div className="text-left">
                                <div className="text-xs font-medium">{mv.label}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          {videoModelMovements.length >= 2 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              The model will perform these movements in sequence throughout the video.
            </p>
          )}
        </div>
      )}

      {/* Background / Scene */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Background / Scene
        </label>
        {isBulk ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">
                Add multiple backgrounds for round-robin pairing
              </p>
              <button
                onClick={handleAddBulkBg}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Background
              </button>
            </div>
            <div className="space-y-3">
              {videoBulkBackgrounds.map((bg) => (
                <BulkBackgroundCard
                  key={bg.id}
                  bg={bg}
                  onUpdate={(config) => updateVideoBulkBackground(bg.id, config)}
                  onRemove={() => removeVideoBulkBackground(bg.id)}
                />
              ))}
              {videoBulkBackgrounds.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-4">
                  No backgrounds added. Default studio background will be used.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setVideoBackground({ ...videoBackground, mode: "text" })
                }
                className={cn(
                  "px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
                  videoBackground.mode === "text"
                    ? "border-primary bg-muted text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                Text Description
              </button>
              <button
                onClick={() =>
                  setVideoBackground({ ...videoBackground, mode: "inspiration" })
                }
                className={cn(
                  "px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
                  videoBackground.mode === "inspiration"
                    ? "border-primary bg-muted text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                Inspiration Image
              </button>
            </div>
            {videoBackground.mode === "text" ? (
              <Textarea
                value={videoBackground.textDescription}
                onChange={(e) =>
                  setVideoBackground({
                    ...videoBackground,
                    textDescription: e.target.value,
                  })
                }
                placeholder="Describe the scene: modern studio, outdoor urban setting, luxury interior..."
                className="min-h-[80px] text-sm resize-none rounded-lg"
              />
            ) : (
              <div>
                {videoBackground.inspirationImage ? (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden group">
                    <img
                      src={videoBackground.inspirationImage.preview}
                      alt="Scene inspiration"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => {
                        if (videoBackground.inspirationImage)
                          URL.revokeObjectURL(videoBackground.inspirationImage.preview);
                        setVideoBackground({
                          ...videoBackground,
                          inspirationImage: undefined,
                        });
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <ImageUploadZone
                    images={[]}
                    onAdd={handleBgInspirationUpload}
                    onRemove={() => {}}
                    label="Upload scene inspiration image"
                    description="A reference image for the video environment"
                    maxImages={1}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Model Selection (clothing only) */}
      {isClothing && (
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
            Model (Optional)
          </label>
          {isBulk ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  Upload model reference photos for round-robin pairing
                </p>
                <button
                  onClick={() => modelInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary dark:text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Model
                </button>
                <input
                  ref={modelInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleBulkModelImageUpload}
                />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {videoBulkModelImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative group aspect-[3/4] rounded-lg overflow-hidden border border-border"
                  >
                    <img
                      src={img.preview}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <span className="text-[11px] text-white font-medium truncate block">
                        {img.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeVideoBulkModelImage(img.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preset Models */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {filteredModels.map((m) => {
                  const isSelected = videoSelectedModel?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() =>
                        setVideoSelectedModel(isSelected ? null : m)
                      }
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-colors duration-200",
                        isSelected
                          ? "border-primary bg-muted shadow-sm"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5">
                          <Check className="w-3.5 h-3.5 text-primary" />
                        </div>
                      )}
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {m.thumbnail ? (
                          <img
                            src={m.thumbnail}
                            alt={m.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-xs font-medium text-center leading-tight">
                        {m.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {m.ethnicity}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom model upload */}
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">
                  Or upload a custom model reference
                </span>
                {videoModelImage ? (
                  <div className="relative w-24 h-32 rounded-lg overflow-hidden group border border-border">
                    <img
                      src={videoModelImage.preview}
                      alt="Custom model"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(videoModelImage.preview);
                        setVideoModelImage(null);
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <ImageUploadZone
                    images={[]}
                    onAdd={handleModelImageUpload}
                    onRemove={() => {}}
                    label="Upload model reference"
                    description="A full-body photo of the model"
                    maxImages={1}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BulkBackgroundCard({
  bg,
  onUpdate,
  onRemove,
}: {
  bg: BulkBackground;
  onUpdate: (config: BackgroundConfig) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="secondary" className="text-[11px]">
          {bg.name}
        </Badge>
        <button
          onClick={onRemove}
          className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <Textarea
        value={bg.config.textDescription}
        onChange={(e) =>
          onUpdate({ ...bg.config, mode: "text", textDescription: e.target.value })
        }
        placeholder="Describe the background/scene..."
        className="min-h-[60px] text-xs resize-none rounded-lg"
      />
    </div>
  );
}
