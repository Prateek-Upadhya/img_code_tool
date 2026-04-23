"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FolderOpen, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { ImageUploadZone } from "./image-upload-zone";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ROOM_STAGING_CATEGORY_OPTIONS,
  HOME_DECOR_TYPE_OPTIONS,
  FURNITURE_TYPE_OPTIONS,
  HOME_DECOR_SUBTYPE_OPTIONS,
  FURNITURE_SUBTYPE_OPTIONS,
  PRODUCT_SHAPE_OPTIONS,
} from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { ProductFolder, RoomStagingProductImage, StylingPropImage } from "@/lib/types";

function RoomFolderCard({
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
      const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) onAddImages(folder.id, files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [folder.id, onAddImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
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
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        {isEditing ? (
          <input
            className="text-sm font-medium bg-transparent border-b border-primary outline-none px-1"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{folder.name}</span>
            <Badge variant="secondary" className="text-[10px]">{folder.images.length} images</Badge>
            <button onClick={() => { setEditName(folder.name); setIsEditing(true); }} className="text-muted-foreground hover:text-foreground">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <button onClick={() => onRemove(folder.id)} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {folder.images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {folder.images.map((img) => (
            <div key={img.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
              <img src={img.preview} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onRemoveImage(folder.id, img.id)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className="rounded-xl border-2 border-dashed border-border hover:border-primary/50 p-3 text-center cursor-pointer transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Drop images or click to upload</p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
      </div>

      {onProductInfoChange && (
        <div className="mt-3">
          <div className="flex items-center gap-1 mb-1">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Product Info</span>
          </div>
          <Textarea
            value={folder.productInfo ?? ""}
            onChange={(e) => onProductInfoChange(folder.id, e.target.value)}
            placeholder="Material, dimensions, origin..."
            className="text-xs min-h-[50px] resize-none"
          />
        </div>
      )}
    </div>
  );
}

export function StepRoomStagingProducts({ store }: { store: VTONStore }) {
  const {
    mode,
    roomStagingCategory, setRoomStagingCategory,
    roomHomeDecorType, setRoomHomeDecorType,
    roomHomeDecorSubType, setRoomHomeDecorSubType,
    roomFurnitureType, setRoomFurnitureType,
    roomFurnitureSubType, setRoomFurnitureSubType,
    roomProductShape, setRoomProductShape,
    roomProductDimensions, setRoomProductDimensions,
    roomProductImages, addRoomProductImage, removeRoomProductImage,
    roomProductInfo, setRoomProductInfo,
    roomStylingProps, addRoomStylingProp, removeRoomStylingProp,
    roomPrimaryFolders, addRoomPrimaryFolder, removeRoomPrimaryFolder,
    addImageToRoomFolder, removeImageFromRoomFolder,
    renameRoomPrimaryFolder, updateRoomPrimaryFolderProductInfo,
  } = store;

  const isBulk = mode === "bulk";
  const isHomeDecor = roomStagingCategory === "home-decor";

  const typeOptions = isHomeDecor ? HOME_DECOR_TYPE_OPTIONS : FURNITURE_TYPE_OPTIONS;
  const activeType = isHomeDecor ? roomHomeDecorType : roomFurnitureType;
  const subtypeOptions = isHomeDecor
    ? HOME_DECOR_SUBTYPE_OPTIONS[roomHomeDecorType] ?? []
    : FURNITURE_SUBTYPE_OPTIONS[roomFurnitureType] ?? [];
  const activeSubType = isHomeDecor ? roomHomeDecorSubType : roomFurnitureSubType;

  const showShape = isHomeDecor && (roomHomeDecorType === "rugs-carpets" || roomHomeDecorType === "table-linen");

  const handleTypeChange = (val: string) => {
    if (isHomeDecor) {
      setRoomHomeDecorType(val as any);
      setRoomHomeDecorSubType(null);
    } else {
      setRoomFurnitureType(val as any);
      setRoomFurnitureSubType(null);
    }
  };

  const handleSubTypeChange = (val: string) => {
    if (isHomeDecor) setRoomHomeDecorSubType(val as any);
    else setRoomFurnitureSubType(val as any);
  };

  const handleUpload = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = `room-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const preview = URL.createObjectURL(file);
        addRoomProductImage({ id, file, preview });
      });
    },
    [addRoomProductImage]
  );

  const handleStylingPropUpload = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const preview = URL.createObjectURL(file);
        addRoomStylingProp({ id, file, preview, label: file.name.replace(/\.[^.]+$/, "") });
      });
    },
    [addRoomStylingProp]
  );

  const handleAddBulkFolder = useCallback(() => {
    const id = `room-folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    addRoomPrimaryFolder({ id, name: `Product ${roomPrimaryFolders.length + 1}`, images: [] });
  }, [addRoomPrimaryFolder, roomPrimaryFolders.length]);

  const handleAddImagestoFolder = useCallback(
    (folderId: string, files: File[]) => {
      const imgs = files.map((file) => ({
        id: `rfi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
      }));
      addImageToRoomFolder(folderId, imgs);
    },
    [addImageToRoomFolder]
  );

  return (
    <div className="space-y-6">
      {/* Category Toggle */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Category</label>
        <div className="grid grid-cols-2 gap-2">
          {ROOM_STAGING_CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRoomStagingCategory(opt.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                roomStagingCategory === opt.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30"
              )}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Product Type */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Product Type</label>
        <div className="flex flex-wrap gap-1.5">
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleTypeChange(opt.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all border",
                activeType === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-Type */}
      {subtypeOptions.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Sub-Type</label>
          <div className="flex flex-wrap gap-1.5">
            {subtypeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSubTypeChange(opt.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all border",
                  activeSubType === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shape (for rugs & table linen) */}
      {showShape && (
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Product Shape</label>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRoomProductShape(opt.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all border flex items-center gap-1.5",
                  roomProductShape === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                <span>{opt.icon}</span> {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dimensions */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Dimensions (optional)</label>
        <input
          type="text"
          value={roomProductDimensions}
          onChange={(e) => setRoomProductDimensions(e.target.value)}
          placeholder="e.g. 8ft x 10ft, 120cm x 180cm"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Product Images */}
      {!isBulk ? (
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Product Images</label>
          {roomProductImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {roomProductImages.map((img) => (
                <div key={img.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border group">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeRoomProductImage(img.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <ImageUploadZone images={roomProductImages.map((i) => ({ id: i.id, preview: i.preview, file: i.file }))} onAdd={handleUpload} onRemove={removeRoomProductImage} label="Upload product images" description="Multiple angles of the same product" />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Product Folders</label>
            <button
              onClick={handleAddBulkFolder}
              className="flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Folder
            </button>
          </div>
          <div className="space-y-3">
            {roomPrimaryFolders.map((folder) => (
              <RoomFolderCard
                key={folder.id}
                folder={folder}
                onAddImages={handleAddImagestoFolder}
                onRemoveImage={removeImageFromRoomFolder}
                onRemove={removeRoomPrimaryFolder}
                onRename={renameRoomPrimaryFolder}
                onProductInfoChange={updateRoomPrimaryFolderProductInfo}
              />
            ))}
            {roomPrimaryFolders.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No product folders yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Each folder represents one product with multiple angle shots</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Info */}
      {!isBulk && (
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Product Info (optional)</label>
          <Textarea
            value={roomProductInfo}
            onChange={(e) => setRoomProductInfo(e.target.value)}
            placeholder="Material, craftsmanship, origin story, key features..."
            className="min-h-[70px] resize-none"
          />
        </div>
      )}

      {/* Styling Props */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Styling Props (optional)</label>
        <p className="text-xs text-muted-foreground mb-2">Reference images of complementary decor items to include in the scene</p>
        {roomStylingProps.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {roomStylingProps.map((prop) => (
              <div key={prop.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border group">
                <img src={prop.preview} alt={prop.label} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeRoomStylingProp(prop.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white truncate">
                  {prop.label}
                </div>
              </div>
            ))}
          </div>
        )}
        <ImageUploadZone images={roomStylingProps.map((p) => ({ id: p.id, preview: p.preview, file: p.file }))} onAdd={handleStylingPropUpload} onRemove={removeRoomStylingProp} label="Upload styling props" description="Vases, cushions, plants, furniture references" />
      </div>
    </div>
  );
}
