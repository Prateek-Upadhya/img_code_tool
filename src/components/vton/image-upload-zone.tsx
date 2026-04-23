"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FootwearSide } from "@/lib/types";

const FOOTWEAR_SIDE_CYCLE: (FootwearSide | null)[] = [null, "medial", "lateral", "sole"];
const FOOTWEAR_SIDE_LABEL: Record<FootwearSide, string> = {
  medial: "MEDIAL",
  lateral: "LATERAL",
  sole: "SOLE",
};

interface ImageUploadZoneProps {
  images: Array<{ id: string; preview: string; file: File; isBackView?: boolean; footwearSide?: FootwearSide }>;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onToggleBackView?: (id: string) => void;
  onSetFootwearSide?: (id: string, side: FootwearSide | null) => void;
  maxImages?: number;
  label: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

export function ImageUploadZone({
  images,
  onAdd,
  onRemove,
  onToggleBackView,
  onSetFootwearSide,
  maxImages = 6,
  label,
  description,
  className,
  compact = false,
}: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) onAdd(files.slice(0, maxImages - images.length));
    },
    [onAdd, maxImages, images.length]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) onAdd(files.slice(0, maxImages - images.length));
      if (inputRef.current) inputRef.current.value = "";
    },
    [onAdd, maxImages, images.length]
  );

  const canAddMore = images.length < maxImages;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h4 className="text-sm font-medium text-foreground">{label}</h4>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className={cn(
          "grid gap-3",
          compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        )}>
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/20 transition-shadow duration-200 hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt="Uploaded garment"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <button
                onClick={() => onRemove(img.id)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-500/90"
              >
                <X className="w-3 h-3" />
              </button>
              {onToggleBackView && (
                <button
                  onClick={() => onToggleBackView(img.id)}
                  className={cn(
                    "absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all duration-200",
                    img.isBackView
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-black/40 backdrop-blur-sm text-white/70 opacity-0 group-hover:opacity-100 hover:bg-amber-500/80 hover:text-white"
                  )}
                >
                  {img.isBackView ? "BACK" : "Set Back"}
                </button>
              )}
              {onSetFootwearSide && (
                <button
                  onClick={() => {
                    const currentIdx = FOOTWEAR_SIDE_CYCLE.indexOf(img.footwearSide ?? null);
                    const next = FOOTWEAR_SIDE_CYCLE[(currentIdx + 1) % FOOTWEAR_SIDE_CYCLE.length];
                    onSetFootwearSide(img.id, next);
                  }}
                  className={cn(
                    "absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all duration-200",
                    img.footwearSide
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-black/40 backdrop-blur-sm text-white/70 opacity-0 group-hover:opacity-100 hover:bg-orange-500/80 hover:text-white"
                  )}
                  title="Click to cycle: Medial → Lateral → Sole → Unset"
                >
                  {img.footwearSide ? FOOTWEAR_SIDE_LABEL[img.footwearSide] : "Set Side"}
                </button>
              )}
              <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <p className="text-[11px] text-white/90 truncate bg-black/40 backdrop-blur-sm rounded-md px-2 py-1 font-medium">
                  {img.file.name}
                </p>
              </div>
            </div>
          ))}

          {/* Add More Button */}
          {canAddMore && (
            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 transition-colors duration-200 text-muted-foreground hover:text-primary bg-muted/10 hover:bg-primary/5"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[11px] font-medium">Add More</span>
            </button>
          )}
        </div>
      )}

      {/* Empty State Drop Zone */}
      {images.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 group",
            isDragging
              ? "border-primary bg-primary/5 glow-sm"
              : "border-border hover:border-primary/40 hover:bg-primary/[0.02]",
            compact ? "p-6" : "p-10"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200",
            isDragging
              ? "bg-primary/10 text-primary"
              : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          )}>
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {isDragging ? "Drop images here" : "Drop images here or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              PNG, JPG, WEBP up to 10MB each · Max {maxImages} images
            </p>
          </div>
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
