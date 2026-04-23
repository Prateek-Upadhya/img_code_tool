"use client";

import { useCallback, useRef } from "react";
import { Upload, X, ImageIcon, LayoutTemplate, Plus, FolderOpen, Pencil, Trash2, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { VTONStore } from "@/store/vton-store";
import type { ReplicateVariableGroup } from "@/lib/types";

// ─── Shared Reference Output Section ───

function ReferenceOutputSection({ store }: { store: VTONStore }) {
  const { replicateReference, setReplicateReferenceOutput } = store;
  const refInputRef = useRef<HTMLInputElement>(null);

  const handleRefFile = useCallback(
    (files: File[]) => {
      const imageFile = files.find((f) => f.type.startsWith("image/"));
      if (!imageFile) return;
      setReplicateReferenceOutput({
        id: `rep-ref-${Date.now()}`,
        file: imageFile,
        preview: URL.createObjectURL(imageFile),
        name: imageFile.name.replace(/\.[^.]+$/, ""),
      });
    },
    [setReplicateReferenceOutput]
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        Reference Output Image
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Upload a reference image that shows the desired layout and structure.
        The generated image will replicate this exact layout using your input
        assets.
      </p>

      {replicateReference ? (
        <div className="relative inline-block">
          <div className="group relative w-64 rounded-lg overflow-hidden border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={replicateReference.preview}
              alt={replicateReference.name}
              className="w-full object-contain max-h-80"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
            <button
              onClick={() => setReplicateReferenceOutput(null)}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 truncate max-w-[16rem]">
            {replicateReference.name}
          </p>
          <button
            onClick={() => refInputRef.current?.click()}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Replace reference image
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleRefFile(Array.from(e.dataTransfer.files));
          }}
          onClick={() => refInputRef.current?.click()}
          className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-primary/5 group p-10"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <LayoutTemplate className="w-6 h-6 text-primary/70 group-hover:text-primary transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Drop reference output image here or click to upload
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This image defines the layout structure for the generated output
            </p>
          </div>
        </div>
      )}

      <input
        ref={refInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          handleRefFile(Array.from(e.target.files || []));
          if (refInputRef.current) refInputRef.current.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}

// ─── Single Mode ───

function SingleModeAssets({ store }: { store: VTONStore }) {
  const { replicateAssets, addReplicateAsset, removeReplicateAsset, replicateReference } = store;
  const assetInputRef = useRef<HTMLInputElement>(null);

  const handleAssetFiles = useCallback(
    (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      for (const file of imageFiles) {
        addReplicateAsset({
          id: `rep-asset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
          name: file.name.replace(/\.[^.]+$/, ""),
        });
      }
    },
    [addReplicateAsset]
  );

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Input Assets
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Upload the raw images/assets that should be composed into the final
          image. For example: size guide tables, product photos with
          measurement annotations, brand logos, etc.
        </p>

        {replicateAssets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {replicateAssets.map((img) => (
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
                  onClick={() => removeReplicateAsset(img.id)}
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
              onClick={() => assetInputRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 transition-colors text-muted-foreground hover:text-primary bg-muted/30 hover:bg-muted/50"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[11px] font-medium">Add More</span>
            </button>
          </div>
        )}

        {replicateAssets.length === 0 && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleAssetFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={() => assetInputRef.current?.click()}
            className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-muted/30 group p-10"
          >
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ImageIcon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Drop input asset images here or click to upload
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, WEBP — Upload all raw assets for the composition
              </p>
            </div>
          </div>
        )}

        <input
          ref={assetInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            handleAssetFiles(Array.from(e.target.files || []));
            if (assetInputRef.current) assetInputRef.current.value = "";
          }}
          className="hidden"
        />
      </div>

      {replicateAssets.length > 0 && replicateReference && (
        <div className={cn("rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center gap-2")}>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">
            {replicateAssets.length} asset{replicateAssets.length !== 1 ? "s" : ""} + reference uploaded — proceed to configure settings
          </span>
        </div>
      )}
    </>
  );
}

// ─── Folder Upload Button (webkitdirectory) ───

function VariableGroupFolderUpload({
  onGroupsCreated,
}: {
  onGroupsCreated: (groups: ReplicateVariableGroup[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

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
          folderName = parts[1];
        } else {
          folderName = parts.length > 1 ? parts[0] : "Untitled Group";
        }

        if (!folderMap.has(folderName)) folderMap.set(folderName, []);
        folderMap.get(folderName)!.push(file);
      }

      const groups: ReplicateVariableGroup[] = Array.from(folderMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
        .map(([name, groupFiles]) => ({
          id: `rep-grp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          images: groupFiles.map((file) => ({
            id: `rg-img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            preview: URL.createObjectURL(file),
          })),
        }));

      if (groups.length > 0) onGroupsCreated(groups);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onGroupsCreated]
  );

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors duration-200 border bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 hover:shadow-sm"
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

// ─── Bulk Image Upload (each image → one group) ───

function VariableGroupImageUpload({
  onGroupsCreated,
}: {
  onGroupsCreated: (groups: ReplicateVariableGroup[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      const groups: ReplicateVariableGroup[] = imageFiles.map((file) => ({
        id: `rep-grp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name.replace(/\.[^.]+$/, ""),
        images: [
          {
            id: `rg-img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            preview: URL.createObjectURL(file),
          },
        ],
      }));

      if (groups.length > 0) onGroupsCreated(groups);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onGroupsCreated]
  );

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors duration-200 border bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground hover:shadow-sm"
      >
        <Images className="w-3.5 h-3.5" />
        Upload Images
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSelect}
        className="hidden"
      />
    </>
  );
}

// ─── Bulk Mode ───

function BulkModeAssets({ store }: { store: VTONStore }) {
  const {
    replicateSharedAssets,
    addReplicateSharedAsset,
    removeReplicateSharedAsset,
    replicateVariableGroups,
    addReplicateVariableGroup,
    removeReplicateVariableGroup,
    renameReplicateVariableGroup,
    addImageToReplicateGroup,
    removeImageFromReplicateGroup,
    replicateReference,
  } = store;

  const sharedInputRef = useRef<HTMLInputElement>(null);
  const groupInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleSharedFiles = useCallback(
    (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      for (const file of imageFiles) {
        addReplicateSharedAsset({
          id: `rep-shared-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
          name: file.name.replace(/\.[^.]+$/, ""),
        });
      }
    },
    [addReplicateSharedAsset]
  );

  const handleAddEmptyGroup = useCallback(() => {
    addReplicateVariableGroup({
      id: `rep-grp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: `Group ${replicateVariableGroups.length + 1}`,
      images: [],
    });
  }, [addReplicateVariableGroup, replicateVariableGroups.length]);

  const handleBulkGroupsCreated = useCallback(
    (groups: ReplicateVariableGroup[]) => {
      for (const group of groups) {
        addReplicateVariableGroup(group);
      }
    },
    [addReplicateVariableGroup]
  );

  const hasValidGroups = replicateVariableGroups.some((g) => g.images.length > 0);

  return (
    <>
      {/* Shared Assets */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Shared Assets
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Images included in <strong>every</strong> generated output. For example:
          a model photo with measurement lines, a brand logo, etc.
        </p>

        {replicateSharedAssets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {replicateSharedAssets.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                <button
                  onClick={() => removeReplicateSharedAsset(img.id)}
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
              onClick={() => sharedInputRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 transition-colors text-muted-foreground hover:text-primary bg-muted/30 hover:bg-muted/50"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[11px] font-medium">Add More</span>
            </button>
          </div>
        )}

        {replicateSharedAssets.length === 0 && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleSharedFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={() => sharedInputRef.current?.click()}
            className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-muted/30 group p-8"
          >
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ImageIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Drop shared assets or click to upload
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Optional — these appear in every output
              </p>
            </div>
          </div>
        )}

        <input
          ref={sharedInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            handleSharedFiles(Array.from(e.target.files || []));
            if (sharedInputRef.current) sharedInputRef.current.value = "";
          }}
          className="hidden"
        />
      </div>

      {/* Variable Groups */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-foreground">
            Variable Asset Groups
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Each group produces <strong>one output image</strong>. Upload folders
          (each subfolder = one group), upload individual images (each image = one
          group), or add groups manually.
        </p>

        {/* Upload actions */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <VariableGroupFolderUpload onGroupsCreated={handleBulkGroupsCreated} />
          <VariableGroupImageUpload onGroupsCreated={handleBulkGroupsCreated} />
          <button
            onClick={handleAddEmptyGroup}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors duration-200 border bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground hover:shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Group Manually
          </button>
          {replicateVariableGroups.length > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              {replicateVariableGroups.length} group{replicateVariableGroups.length !== 1 ? "s" : ""} &middot;{" "}
              {replicateVariableGroups.reduce((sum, g) => sum + g.images.length, 0)} total images
            </span>
          )}
        </div>

        {replicateVariableGroups.length === 0 && (
          <div className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 p-8">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                No variable groups yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a folder with subfolders, upload images, or add a group manually
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {replicateVariableGroups.map((group) => (
            <div
              key={group.id}
              className="rounded-lg border border-border bg-muted/20 p-5"
            >
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                <input
                  type="text"
                  value={group.name}
                  onChange={(e) => renameReplicateVariableGroup(group.id, e.target.value)}
                  className="flex-1 text-sm font-medium bg-transparent border-none outline-none focus:ring-0 text-foreground"
                  placeholder="Group name..."
                />
                <Pencil className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                <button
                  onClick={() => removeReplicateVariableGroup(group.id)}
                  className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Group images */}
              <div className="flex gap-2 flex-wrap">
                {group.images.map((img) => (
                  <div
                    key={img.id}
                    className="group/img relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImageFromReplicateGroup(group.id, img.id)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => groupInputRefs.current[group.id]?.click()}
                  className="w-20 h-20 rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors text-muted-foreground hover:text-primary bg-muted/30 hover:bg-muted/50"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-[11px] font-medium">Add</span>
                </button>
                <input
                  ref={(el) => { groupInputRefs.current[group.id] = el; }}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    addImageToReplicateGroup(group.id, Array.from(e.target.files || []));
                    if (groupInputRefs.current[group.id]) groupInputRefs.current[group.id]!.value = "";
                  }}
                  className="hidden"
                />
              </div>

              {group.images.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60 mt-2">
                  No images yet — add the unique assets for this variation
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status */}
      {hasValidGroups && replicateReference && (
        <div className={cn("rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center gap-2")}>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">
            {replicateVariableGroups.filter((g) => g.images.length > 0).length} group{replicateVariableGroups.filter((g) => g.images.length > 0).length !== 1 ? "s" : ""} ready
            {replicateSharedAssets.length > 0 ? ` + ${replicateSharedAssets.length} shared asset${replicateSharedAssets.length !== 1 ? "s" : ""}` : ""}
            {" "}+ reference — proceed to configure settings
          </span>
        </div>
      )}
    </>
  );
}

// ─── Main Component ───

export function StepReplicateAssets({ store }: { store: VTONStore }) {
  const { mode } = store;
  const isBulk = mode === "bulk";

  return (
    <div className="space-y-6">
      <ReferenceOutputSection store={store} />
      {isBulk ? <BulkModeAssets store={store} /> : <SingleModeAssets store={store} />}
    </div>
  );
}
