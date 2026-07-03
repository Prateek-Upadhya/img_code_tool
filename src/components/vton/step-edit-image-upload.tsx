"use client";

import { useCallback, useMemo, useRef } from "react";
import { FolderOpen, Trash2, AlertTriangle, ImageIcon, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupFilesByFolder, correlateFolders, type GroupedFolder } from "@/lib/folder-upload";
import { PRODUCT_OF_INTEREST_OPTIONS } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { EditImageAsset, EditImageSubfolder, ProductOfInterest } from "@/lib/types";

interface Props {
  store: VTONStore;
}

/** Reconstruct the grouped-folder list for one side from the correlated subfolders. */
function reconstruct(subs: EditImageSubfolder[], side: "ai" | "product"): GroupedFolder[] {
  return subs
    .map((s) => ({
      name: s.name,
      files: (side === "ai" ? s.aiImages : s.productImages).map((a) => a.file),
    }))
    .filter((g) => g.files.length > 0);
}

/** Hidden webkitdirectory input + button that emits grouped subfolders. */
function FolderUploadButton({
  label,
  onFolders,
}: {
  label: string;
  onFolders: (folders: GroupedFolder[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const folders = groupFilesByFolder(Array.from(e.target.files || []));
      if (folders.length > 0) onFolders(folders);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFolders]
  );

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        {label}
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

function ImageGrid({
  images,
  onRemove,
}: {
  images: EditImageAsset[];
  onRemove: (assetId: string) => void;
}) {
  if (images.length === 0) {
    return <p className="text-[11px] italic text-muted-foreground">None uploaded</p>;
  }
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
      {images.map((img) => (
        <div
          key={img.id}
          className="group/img relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted/20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.preview} alt="" className="h-full w-full object-cover" />
          <button
            onClick={() => onRemove(img.id)}
            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover/img:opacity-100"
            title="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function StepEditImageUpload({ store }: Props) {
  const {
    editImageSubfolders,
    setEditImageSubfolders,
    updateEditImageSubfolder,
    removeEditImageSubfolder,
    removeEditImageAsset,
  } = store;

  const recorrelate = useCallback(
    (ai: GroupedFolder[], product: GroupedFolder[]) => {
      setEditImageSubfolders(correlateFolders(ai, product, editImageSubfolders));
    },
    [editImageSubfolders, setEditImageSubfolders]
  );

  const handleAiUpload = useCallback(
    (ai: GroupedFolder[]) => recorrelate(ai, reconstruct(editImageSubfolders, "product")),
    [recorrelate, editImageSubfolders]
  );

  const handleProductUpload = useCallback(
    (product: GroupedFolder[]) => recorrelate(reconstruct(editImageSubfolders, "ai"), product),
    [recorrelate, editImageSubfolders]
  );

  const { matched, unmatched, aiCount } = useMemo(() => {
    const matchedList = editImageSubfolders.filter((s) => !s.unmatched);
    return {
      matched: matchedList,
      unmatched: editImageSubfolders.filter((s) => s.unmatched),
      aiCount: matchedList.reduce((n, s) => n + s.aiImages.length, 0),
    };
  }, [editImageSubfolders]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <FolderUploadButton label="Upload AI Generations" onFolders={handleAiUpload} />
          <FolderUploadButton label="Upload Product Garments" onFolders={handleProductUpload} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Upload two parallel folders whose subfolders share names — one holding the AI-generated images to edit,
          one holding the product images. Matching subfolders are paired automatically.
        </p>
        {editImageSubfolders.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{matched.length}</span> paired subfolder
            {matched.length !== 1 ? "s" : ""} ·{" "}
            <span className="font-medium text-foreground">{aiCount}</span> AI image
            {aiCount !== 1 ? "s" : ""} to edit
            {unmatched.length > 0 && (
              <span className="text-amber-600"> · {unmatched.length} unmatched (excluded)</span>
            )}
          </p>
        )}
      </div>

      {editImageSubfolders.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-16 text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <p className="text-sm">Upload both folders to begin pairing</p>
        </div>
      )}

      <div className="space-y-4">
        {editImageSubfolders.map((sub) => (
          <div
            key={sub.id}
            className={cn(
              "rounded-xl border bg-card p-4",
              sub.unmatched ? "border-amber-500/40" : "border-border"
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">{sub.name}</h4>
                {sub.unmatched && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    {sub.unmatched === "ai-only" ? "No product folder" : "No AI folder"}
                  </span>
                )}
              </div>
              <button
                onClick={() => removeEditImageSubfolder(sub.id)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                title="Remove subfolder"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" /> AI Generations ({sub.aiImages.length})
                </p>
                <ImageGrid
                  images={sub.aiImages}
                  onRemove={(assetId) => removeEditImageAsset(sub.id, assetId, "ai")}
                />
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Package className="h-3.5 w-3.5" /> Product Garments ({sub.productImages.length})
                </p>
                <ImageGrid
                  images={sub.productImages}
                  onRemove={(assetId) => removeEditImageAsset(sub.id, assetId, "product")}
                />
              </div>
            </div>

            {!sub.unmatched && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Product of interest
                </span>
                {PRODUCT_OF_INTEREST_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      updateEditImageSubfolder(sub.id, { productOfInterest: opt.value as ProductOfInterest })
                    }
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                      sub.productOfInterest === opt.value
                        ? "bg-foreground text-background"
                        : "bg-muted/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
                {!sub.productOfInterest && (
                  <span className="text-[11px] text-amber-600">Required</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
