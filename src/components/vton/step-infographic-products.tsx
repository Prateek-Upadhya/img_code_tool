"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, X, Upload, ImageIcon, FolderOpen } from "lucide-react";
import { ImageUploadZone } from "./image-upload-zone";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { INFOGRAPHIC_CATEGORY_OPTIONS } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { InfographicProductFolder } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Folder upload (webkitdirectory). Each immediate subfolder becomes one product;
 * a flat folder of images becomes a single product. Mirrors VTON's FolderUploadButton.
 */
function FolderUploadButton({
  onFoldersSelected,
}: {
  onFoldersSelected: (folders: { name: string; files: File[] }[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      // Detect product sub-folders, e.g. Root/Product1/image.jpg → 3+ path segments
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
          folderName = parts[1]; // immediate child folder of the root
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <FolderOpen className="w-3.5 h-3.5" />
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

function ProductCard({
  folder,
  index,
  onRename,
  onRemove,
  onAddImages,
  onRemoveImage,
  onProductInfoChange,
}: {
  folder: InfographicProductFolder;
  index: number;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onAddImages: (folderId: string, files: File[]) => void;
  onRemoveImage: (folderId: string, imageId: string) => void;
  onProductInfoChange: (id: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);

  const commitName = () => {
    const trimmed = draftName.trim();
    onRename(folder.id, trimmed || `Product ${index + 1}`);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-semibold shrink-0">
            {index + 1}
          </span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="text-sm font-medium bg-muted/50 border border-border rounded-md px-2 py-1 outline-none focus:border-primary/50"
              />
              <button onClick={commitName} className="p-1 text-primary hover:bg-muted/60 rounded">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 text-muted-foreground hover:bg-muted/60 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setDraftName(folder.name);
                setEditing(true);
              }}
              className="group flex items-center gap-1.5 min-w-0"
            >
              <span className="text-sm font-medium text-foreground truncate">{folder.name}</span>
              <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
        <button
          onClick={() => onRemove(folder.id)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          title="Remove product"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Images */}
      <ImageUploadZone
        images={folder.images}
        onAdd={(files) => onAddImages(folder.id, files)}
        onRemove={(imageId) => onRemoveImage(folder.id, imageId)}
        maxImages={8}
        label="Product images"
        description="Upload clear shots of the footwear — top, side and sole angles work best."
        compact
      />

      {/* Product info */}
      <div>
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
          Product information
        </label>
        <Textarea
          value={folder.productInfo ?? ""}
          onChange={(e) => onProductInfoChange(folder.id, e.target.value)}
          placeholder="Feature bullets or a description. Bullets are used directly; long paragraphs are summarised to bullets automatically. e.g. • Breathable knit upper • Carbon-plate midsole • Rubber grip outsole"
          className="min-h-[90px] text-sm resize-y"
        />
      </div>
    </div>
  );
}

export function StepInfographicProducts({ store }: { store: VTONStore }) {
  const {
    infographicCategory,
    setInfographicCategory,
    infographicFolders,
    addInfographicFolder,
    removeInfographicFolder,
    renameInfographicFolder,
    addInfographicFolderImage,
    removeInfographicFolderImage,
    updateInfographicFolderProductInfo,
    infographicBrand,
    setInfographicBrandLogo,
    setInfographicBrandPlacement,
  } = store;

  const handleAddProduct = () => {
    addInfographicFolder({
      id: uid("ig-folder"),
      name: `Product ${infographicFolders.length + 1}`,
      images: [],
      productInfo: "",
    });
  };

  const handleAddImages = (folderId: string, files: File[]) => {
    files.forEach((file) => {
      addInfographicFolderImage(folderId, {
        id: uid("ig-img"),
        file,
        preview: URL.createObjectURL(file),
      });
    });
  };

  const handleFoldersSelected = (folders: { name: string; files: File[] }[]) => {
    folders.forEach((folder) => {
      addInfographicFolder({
        id: uid("ig-folder"),
        name: folder.name,
        images: folder.files.map((file) => ({
          id: uid("ig-img"),
          file,
          preview: URL.createObjectURL(file),
        })),
        productInfo: "",
      });
    });
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInfographicBrandLogo({ logoFile: file, logoPreview: URL.createObjectURL(file) });
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Category */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Product category</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Choose the type of product you&apos;re creating infographics for.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INFOGRAPHIC_CATEGORY_OPTIONS.map((opt) => {
            const isActive = infographicCategory === opt.value;
            const disabled = opt.comingSoon;
            return (
              <button
                key={opt.value}
                disabled={disabled}
                onClick={() => !disabled && setInfographicCategory(opt.value)}
                className={cn(
                  "text-left rounded-xl border p-4 transition-all duration-200 relative",
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-muted/30",
                  disabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{opt.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                      {opt.comingSoon && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Products */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Products</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add products individually, or upload a folder where each subfolder is a product. Infographics are generated for every product in bulk.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <FolderUploadButton onFoldersSelected={handleFoldersSelected} />
            <button
              onClick={handleAddProduct}
              className="btn-gradient inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product
            </button>
          </div>
        </div>

        {infographicFolders.length === 0 ? (
          <button
            onClick={handleAddProduct}
            className="w-full border border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Add your first product</p>
              <p className="text-xs text-muted-foreground mt-1">Upload product images and info to begin</p>
            </div>
          </button>
        ) : (
          <div className="space-y-4">
            {infographicFolders.map((folder, i) => (
              <ProductCard
                key={folder.id}
                folder={folder}
                index={i}
                onRename={renameInfographicFolder}
                onRemove={removeInfographicFolder}
                onAddImages={handleAddImages}
                onRemoveImage={removeInfographicFolderImage}
                onProductInfoChange={updateInfographicFolderProductInfo}
              />
            ))}
          </div>
        )}
      </section>

      {/* Brand logo */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Brand logo <span className="text-muted-foreground font-normal">(optional)</span></h3>
          <p className="text-xs text-muted-foreground mt-0.5">Applied to every generated infographic in this batch.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-start">
          {/* Logo upload */}
          <div>
            {infographicBrand.logoPreview ? (
              <div className="relative w-32 h-32 rounded-xl border border-border bg-muted/20 overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={infographicBrand.logoPreview} alt="Brand logo" className="w-full h-full object-contain p-2" />
                <button
                  onClick={() => setInfographicBrandLogo(null)}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/90"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="w-32 h-32 rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.02] transition-colors">
                <Upload className="w-5 h-5" />
                <span className="text-[11px] font-medium">Upload logo</span>
                <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
              </label>
            )}
          </div>
          {/* Placement instructions */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Logo placement instructions</label>
            <Textarea
              value={infographicBrand.logoPlacementInstructions ?? ""}
              onChange={(e) => setInfographicBrandPlacement(e.target.value)}
              placeholder="e.g. Place the logo in the top-left corner, small and subtle. Keep clear of the callouts."
              className="min-h-[90px] text-sm resize-y"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
