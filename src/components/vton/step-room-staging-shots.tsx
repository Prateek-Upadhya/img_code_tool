"use client";

import { cn } from "@/lib/utils";
import { ROOM_STAGING_SHOTS } from "@/lib/constants";
import { ASPECT_RATIOS } from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";
import type { RoomStagingShot } from "@/lib/types";

export function StepRoomStagingShots({ store }: { store: VTONStore }) {
  const {
    roomSelectedShots, setRoomSelectedShots,
    roomAspectRatio, setRoomAspectRatio,
    roomSelectedRoomStyle,
    roomInspirationImage,
    roomProductDimensions,
  } = store;

  const hasRoomSelection = roomSelectedRoomStyle !== null || roomInspirationImage !== null;

  const productOnlyShots = ROOM_STAGING_SHOTS.filter((s) => !s.requiresRoom);
  const roomStagedShots = ROOM_STAGING_SHOTS.filter((s) => s.requiresRoom);

  const toggleShot = (shot: RoomStagingShot) => {
    const exists = roomSelectedShots.some((s) => s.id === shot.id);
    if (exists) {
      setRoomSelectedShots(roomSelectedShots.filter((s) => s.id !== shot.id));
    } else {
      setRoomSelectedShots([...roomSelectedShots, shot]);
    }
  };

  const isSelected = (id: string) => roomSelectedShots.some((s) => s.id === id);

  const selectAllInGroup = (shots: RoomStagingShot[]) => {
    const ids = shots.map((s) => s.id);
    const allSelected = ids.every((id) => isSelected(id));
    if (allSelected) {
      setRoomSelectedShots(roomSelectedShots.filter((s) => !ids.includes(s.id)));
    } else {
      const newShots = shots.filter((s) => !isSelected(s.id));
      setRoomSelectedShots([...roomSelectedShots, ...newShots]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Aspect Ratio */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Aspect Ratio</label>
        <div className="flex flex-wrap gap-1.5">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.value}
              onClick={() => setRoomAspectRatio(ar.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all border",
                roomAspectRatio === ar.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              )}
            >
              {ar.value}
            </button>
          ))}
        </div>
      </div>

      {/* Product-Only Shots */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Product-Only Shots</label>
          <button
            onClick={() => selectAllInGroup(productOnlyShots)}
            className="text-[11px] text-primary hover:text-primary/80 font-medium"
          >
            {productOnlyShots.every((s) => isSelected(s.id)) ? "Deselect All" : "Select All"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Clean product shots without any room context</p>
        <div className="grid grid-cols-2 gap-2">
          {productOnlyShots.map((shot) => (
            <button
              key={shot.id}
              onClick={() => toggleShot(shot)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                isSelected(shot.id)
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{shot.icon}</span>
                <span className="text-xs font-medium">{shot.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">{shot.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Room-Staged Shots */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Room-Staged Shots</label>
          <button
            onClick={() => selectAllInGroup(roomStagedShots)}
            className="text-[11px] text-primary hover:text-primary/80 font-medium"
          >
            {roomStagedShots.every((s) => isSelected(s.id)) ? "Deselect All" : "Select All"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-1">Product placed in a styled room setting</p>
        {!hasRoomSelection && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">Select a room style or upload a room photo in the Scene step to use these shots</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {roomStagedShots.map((shot) => (
            <button
              key={shot.id}
              onClick={() => toggleShot(shot)}
              disabled={!hasRoomSelection}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                isSelected(shot.id)
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30",
                !hasRoomSelection && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{shot.icon}</span>
                <span className="text-xs font-medium">{shot.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">{shot.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {roomSelectedShots.some((s) => s.id === "rs-dimension-diagram") && !roomProductDimensions && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Dimension Diagram requires product dimensions</p>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Go back to the Products step and enter the dimensions (e.g. 75 x 120 cm) for accurate measurement annotations.</p>
        </div>
      )}

      {/* Summary */}
      {roomSelectedShots.length > 0 && (
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs font-medium">
            {roomSelectedShots.length} shot{roomSelectedShots.length !== 1 ? "s" : ""} selected
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {roomSelectedShots.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                {s.icon} {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
