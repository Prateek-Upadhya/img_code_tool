"use client";

import { Textarea } from "@/components/ui/textarea";
import type { VTONStore } from "@/store/vton-store";

export function StepRoomStagingDetails({ store }: { store: VTONStore }) {
  const { roomAdditionalInfo, setRoomAdditionalInfo } = store;

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Additional Instructions (optional)</label>
        <Textarea
          value={roomAdditionalInfo}
          onChange={(e) => setRoomAdditionalInfo(e.target.value)}
          placeholder="e.g. warm afternoon light, emphasize handmade texture, show the rug's fringe prominently..."
          className="min-h-[100px] resize-none"
        />
      </div>
    </div>
  );
}
