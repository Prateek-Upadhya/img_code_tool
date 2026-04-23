"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Picker } from "emoji-mart";
import data from "@emoji-mart/data";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

// Headless emoji-mart Picker mounted as a web component
function EmojiMartPicker({
  onEmojiSelect,
}: {
  onEmojiSelect: (emoji: { native: string }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Picker is a class constructor; use `any` to bypass strict TS checks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance = new (Picker as any)({
      data,
      ref,
      onEmojiSelect,
      theme: "light",
      set: "native",
      previewPosition: "none",
      skinTonePosition: "search",
      maxFrequentRows: 2,
      perLine: 8,
    });

    return () => {
      void instance;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} />;
}

export function EmojiPicker({ value, onChange, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (emoji: { native: string }) => {
      onChange(emoji.native);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 w-full justify-start gap-2 text-xs rounded-lg font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value ? (
            <span className="text-base leading-none">{value}</span>
          ) : (
            <SmilePlus className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="truncate">
            {value ? "Change icon" : "Pick an icon"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-none shadow-xl"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <EmojiMartPicker onEmojiSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}
