"use client";

import { useCallback } from "react";
import { X, Upload } from "lucide-react";
import { ImageUploadZone } from "./image-upload-zone";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ROOM_STYLES } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { BulkModelImage, RoomStyle } from "@/lib/types";

export function StepRoomStagingScene({ store }: { store: VTONStore }) {
  const {
    mode,
    roomSelectedRoomStyle, setRoomSelectedRoomStyle,
    roomInspirationImage, setRoomInspirationImage,
    roomDescription, setRoomDescription,
    roomBackground, setRoomBackground,
    roomBulkRoomSettings, addRoomBulkRoomSetting, removeRoomBulkRoomSetting,
  } = store;

  const isBulk = mode === "bulk";

  const handlePresetSelect = useCallback(
    (style: RoomStyle) => {
      setRoomSelectedRoomStyle(roomSelectedRoomStyle?.id === style.id ? null : style);
    },
    [roomSelectedRoomStyle, setRoomSelectedRoomStyle]
  );

  const handleInspirationUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const file = files[0];
      const preview = URL.createObjectURL(file);
      setRoomInspirationImage({ file, preview });
    },
    [setRoomInspirationImage]
  );

  const handleRemoveInspiration = useCallback(() => {
    setRoomInspirationImage(null);
  }, [setRoomInspirationImage]);

  const handleBulkRoomUpload = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = `room-setting-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const preview = URL.createObjectURL(file);
        addRoomBulkRoomSetting({ id, name: file.name.replace(/\.[^.]+$/, ""), file, preview });
      });
    },
    [addRoomBulkRoomSetting]
  );

  const handleBackgroundInspirationUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const file = files[0];
      const preview = URL.createObjectURL(file);
      setRoomBackground({
        ...roomBackground,
        mode: "inspiration",
        inspirationImage: { file, preview },
      });
    },
    [roomBackground, setRoomBackground]
  );

  return (
    <div className="space-y-6">
      {/* Preset Room Styles */}
      {!isBulk && (
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Room Style Presets</label>
          <div className="grid grid-cols-2 gap-2">
            {ROOM_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => handlePresetSelect(style)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all",
                  roomSelectedRoomStyle?.id === style.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{style.thumbnail}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{style.name}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{style.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom Room Image */}
      {!isBulk ? (
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Custom Room Photo (optional)</label>
          <p className="text-xs text-muted-foreground mb-2">Upload a reference room image for the AI to match</p>
          {roomInspirationImage ? (
            <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-border group">
              <img src={roomInspirationImage.preview} alt="Room reference" className="w-full h-full object-cover" />
              <button
                onClick={handleRemoveInspiration}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ) : (
            <ImageUploadZone images={[]} onAdd={handleInspirationUpload} onRemove={() => {}} label="Upload room reference" description="A photo of the room style you want" />
          )}
        </div>
      ) : (
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Room Settings</label>
          <p className="text-xs text-muted-foreground mb-2">Upload multiple room reference images — each will be paired with products via round-robin</p>
          {roomBulkRoomSettings.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {roomBulkRoomSettings.map((setting) => (
                <div key={setting.id} className="relative w-24 h-24 rounded-xl overflow-hidden border border-border group">
                  <img src={setting.preview} alt={setting.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeRoomBulkRoomSetting(setting.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white truncate">{setting.name}</div>
                </div>
              ))}
            </div>
          )}
          <ImageUploadZone images={[]} onAdd={handleBulkRoomUpload} onRemove={() => {}} label="Upload room setting images" description="Multiple room photos for bulk pairing" />
        </div>
      )}

      {/* Room Description */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Room Description (optional)</label>
        <Textarea
          value={roomDescription}
          onChange={(e) => setRoomDescription(e.target.value)}
          placeholder="Describe the room setting — furniture style, wall colors, flooring, lighting mood..."
          className="min-h-[70px] resize-none"
        />
      </div>

      {/* Environment / Background */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Environment Details (optional)</label>
        <p className="text-xs text-muted-foreground mb-2">Additional inspiration image or description for lighting and atmosphere</p>
        <div className="space-y-3">
          {roomBackground.inspirationImage ? (
            <div className="relative w-32 h-24 rounded-xl overflow-hidden border border-border group">
              <img src={roomBackground.inspirationImage.preview} alt="Environment" className="w-full h-full object-cover" />
              <button
                onClick={() => setRoomBackground({ ...roomBackground, mode: "text", inspirationImage: undefined })}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ) : (
            <ImageUploadZone images={[]} onAdd={handleBackgroundInspirationUpload} onRemove={() => {}} label="Upload environment inspiration" description="Lighting, atmosphere, or mood reference" />
          )}
          <Textarea
            value={roomBackground.textDescription}
            onChange={(e) => setRoomBackground({ ...roomBackground, textDescription: e.target.value })}
            placeholder="Warm afternoon sunlight, soft shadows, cozy atmosphere..."
            className="min-h-[50px] resize-none"
          />
        </div>
      </div>
    </div>
  );
}
