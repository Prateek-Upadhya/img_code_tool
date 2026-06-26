"use client";

import { ImageUploadZone } from "./image-upload-zone";
import type { VTONStore } from "@/store/vton-store";

interface Props {
  store: VTONStore;
}

export function StepModelEditUpload({ store }: Props) {
  const { modelEditSources, addModelEditSources, removeModelEditSource } = store;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
        Upload the set of model photos you want to transform. Each image returns one edited
        version — everything stays identical except the change you describe next.
      </p>
      <ImageUploadZone
        images={modelEditSources}
        onAdd={addModelEditSources}
        onRemove={removeModelEditSource}
        maxImages={40}
        label="Model images to edit"
        description="PNG, JPG, WEBP · up to 40 images"
      />
    </div>
  );
}
