"use client";

import { Textarea } from "@/components/ui/textarea";
import { ImageUploadZone } from "./image-upload-zone";
import type { VTONStore } from "@/store/vton-store";

interface Props {
  store: VTONStore;
}

export function StepEditImageVariation({ store }: Props) {
  const {
    editImageVariationInstructions,
    setEditImageVariationInstructions,
    editImageReferenceImages,
    addEditImageReferenceImages,
    removeEditImageReferenceImage,
  } = store;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">What should vary?</label>
        <Textarea
          value={editImageVariationInstructions}
          onChange={(e) => setEditImageVariationInstructions(e.target.value)}
          placeholder="e.g. Every image has a chair in the background — give each image a different, contextually fitting chair or prop, while keeping the product and everything else exactly the same."
          className="min-h-[120px] resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Describe the element to vary. Each AI image receives a distinct variation across the batch;
          the product of interest and everything else stays untouched.
        </p>
      </div>

      <div className="space-y-2">
        <ImageUploadZone
          images={editImageReferenceImages}
          onAdd={addEditImageReferenceImages}
          onRemove={removeEditImageReferenceImage}
          maxImages={12}
          label="Reference images (optional)"
          description="Optional visual guidance applied to the whole batch — the model uses these only to steer the variation."
        />
      </div>
    </div>
  );
}
