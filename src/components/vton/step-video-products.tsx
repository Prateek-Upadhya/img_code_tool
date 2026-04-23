"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FolderOpen, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { ImageUploadZone } from "./image-upload-zone";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { GENDER_OPTIONS, PRODUCT_CATEGORY_OPTIONS } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { ProductFolder } from "@/lib/types";

function VideoProductFolderCard({
  folder,
  onAddImages,
  onRemoveImage,
  onRemove,
  onRename,
  onProductInfoChange,
}: {
  folder: ProductFolder;
  onAddImages: (folderId: string, files: File[]) => void;
  onRemoveImage: (folderId: string, imageId: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onProductInfoChange?: (folderId: string, info: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) onAddImages(folder.id, files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [folder.id, onAddImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) onAddImages(folder.id, files);
    },
    [folder.id, onAddImages]
  );

  const saveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) onRename(folder.id, trimmed);
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" />
          {isEditing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="text-sm font-medium bg-transparent border-b border-primary outline-none w-40"
            />
          ) : (
            <span className="text-sm font-medium">{folder.name}</span>
          )}
          <Badge variant="secondary" className="text-[11px]">
            {folder.images.length} image{folder.images.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditName(folder.name); setIsEditing(true); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRemove(folder.id)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        className="relative border border-dashed border-border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        {folder.images.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {folder.images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted/30">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveImage(folder.id, img.id); }}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="aspect-square rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground/40">
              <Plus className="w-5 h-5" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/60">
            <Upload className="w-6 h-6 mb-2" />
            <span className="text-xs">Drop images or click to upload</span>
          </div>
        )}
      </div>

      {onProductInfoChange && (
        <div className="mt-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Product Info</span>
          </div>
          <Textarea
            value={folder.productInfo || ""}
            onChange={(e) => onProductInfoChange(folder.id, e.target.value)}
            placeholder="Fabric, key features, selling points..."
            className="min-h-[60px] text-xs resize-none rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

export function StepVideoProducts({ store }: { store: VTONStore }) {
  const {
    mode,
    videoProductCategory,
    setVideoProductCategory,
    videoGender,
    setVideoGender,
    videoProductImages,
    addVideoProductImage,
    removeVideoProductImage,
    videoProductInfo,
    setVideoProductInfo,
    videoPrimaryFolders,
    addVideoPrimaryFolder,
    removeVideoPrimaryFolder,
    addImageToVideoFolder,
    removeImageFromVideoFolder,
    renameVideoPrimaryFolder,
    updateVideoPrimaryFolderProductInfo,
  } = store;

  const isBulk = mode === "bulk";

  const handleImageUpload = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = `vid-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const preview = URL.createObjectURL(file);
        addVideoProductImage({ id, file, preview });
      });
    },
    [addVideoProductImage]
  );

  const handleFolderAddImages = useCallback(
    (folderId: string, files: File[]) => {
      files.forEach((file) => {
        const id = `vid-fimg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const preview = URL.createObjectURL(file);
        addImageToVideoFolder(folderId, { id, file, preview });
      });
    },
    [addImageToVideoFolder]
  );

  const handleAddFolder = useCallback(() => {
    const id = `vid-folder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    addVideoPrimaryFolder({
      id,
      name: `Product ${videoPrimaryFolders.length + 1}`,
      images: [],
    });
  }, [addVideoPrimaryFolder, videoPrimaryFolders.length]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Product Category */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Product Category
        </label>
        <div className="flex gap-2">
          {PRODUCT_CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVideoProductCategory(opt.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors duration-200",
                videoProductCategory === opt.value
                  ? "border-primary bg-muted text-primary shadow-sm"
                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gender */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Gender
        </label>
        <div className="flex gap-2">
          {GENDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVideoGender(opt.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors duration-200",
                videoGender === opt.value
                  ? "border-primary bg-muted text-primary shadow-sm"
                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product Images */}
      {isBulk ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block">
                Product Folders
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Each folder represents one product with multiple angle shots
              </p>
            </div>
            <button
              onClick={handleAddFolder}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product
            </button>
          </div>
          <div className="space-y-4">
            {videoPrimaryFolders.map((folder) => (
              <VideoProductFolderCard
                key={folder.id}
                folder={folder}
                onAddImages={handleFolderAddImages}
                onRemoveImage={removeImageFromVideoFolder}
                onRemove={removeVideoPrimaryFolder}
                onRename={renameVideoPrimaryFolder}
                onProductInfoChange={updateVideoPrimaryFolderProductInfo}
              />
            ))}
            {videoPrimaryFolders.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <FolderOpen className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">
                  Click &quot;Add Product&quot; to create your first product folder
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
            Product Images
          </label>
          <ImageUploadZone
            images={videoProductImages.map((img) => ({
              id: img.id,
              preview: img.preview,
              file: img.file,
            }))}
            onAdd={handleImageUpload}
            onRemove={removeVideoProductImage}
            label="Upload product images"
            description="Multiple angles of the same product for best results"
          />
        </div>
      )}

      {/* Product Info (single mode only) */}
      {!isBulk && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Product Info (Optional)
            </label>
          </div>
          <Textarea
            value={videoProductInfo}
            onChange={(e) => setVideoProductInfo(e.target.value)}
            placeholder="Fabric type, key features, collection name, selling points..."
            className="min-h-[80px] text-sm resize-none rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
