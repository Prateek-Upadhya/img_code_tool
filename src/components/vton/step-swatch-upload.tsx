"use client";

import { useCallback, useRef } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VTONStore } from "@/store/vton-store";

export function StepSwatchUpload({ store }: { store: VTONStore }) {
  const { swatchImages, addSwatchImage, removeSwatchImage } = store;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      for (const file of imageFiles) {
        addSwatchImage({
          id: `swatch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
          name: file.name.replace(/\.[^.]+$/, ""),
        });
      }
    },
    [addSwatchImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(Array.from(e.target.files || []));
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFiles]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Garment Images
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Upload one or more garment images. A fabric swatch will be extracted
          from the most representative area of each garment.
        </p>

        {swatchImages.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {swatchImages.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                <button
                  onClick={() => removeSwatchImage(img.id)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-1.5 left-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[11px] text-white truncate bg-black/50 rounded px-1.5 py-0.5">
                    {img.name}
                  </p>
                </div>
              </div>
            ))}

            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 transition-colors text-muted-foreground hover:text-primary bg-muted/30 hover:bg-muted/50"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[11px] font-medium">Add More</span>
            </button>
          </div>
        )}

        {swatchImages.length === 0 && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 group p-10"
          >
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ImageIcon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Drop garment images here or click to upload
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, WEBP — Upload as many garments as needed
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

      {swatchImages.length > 0 && (
        <div className={cn(
          "rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center gap-2",
        )}>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">
            {swatchImages.length} garment{swatchImages.length !== 1 ? "s" : ""} uploaded — proceed to configure swatch settings
          </span>
        </div>
      )}
    </div>
  );
}
