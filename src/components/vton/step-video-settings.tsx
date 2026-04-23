"use client";

import { useState } from "react";
import { Eye, EyeOff, Key, Check, Volume2, VolumeX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_RESOLUTION_OPTIONS,
  VEO_MODEL_OPTIONS,
} from "@/lib/constants";
import type { VTONStore } from "@/store/vton-store";

const NUMBER_OF_VIDEOS_OPTIONS = [1, 2, 3, 4] as const;

export function StepVideoSettings({ store }: { store: VTONStore }) {
  const {
    videoAspectRatio,
    setVideoAspectRatio,
    videoVeoModel,
    setVideoVeoModel,
    videoResolution,
    setVideoResolution,
    videoNumberOfResults,
    setVideoNumberOfResults,
    videoGenerateAudio,
    setVideoGenerateAudio,
    videoNegativePrompt,
    setVideoNegativePrompt,
    videoAdditionalInfo,
    setVideoAdditionalInfo,
    apiKey,
    setApiKey,
  } = store;

  const [showKey, setShowKey] = useState(false);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Aspect Ratio */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Aspect Ratio
        </label>
        <div className="flex gap-3">
          {VIDEO_ASPECT_RATIO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVideoAspectRatio(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 px-6 py-4 rounded-lg border transition-colors duration-200",
                videoAspectRatio === opt.value
                  ? "border-primary bg-muted shadow-sm"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div
                className={cn(
                  "border-2 rounded-sm transition-colors",
                  videoAspectRatio === opt.value
                    ? "border-primary"
                    : "border-muted-foreground/30"
                )}
                style={{
                  width: opt.value === "16:9" ? 40 : 22,
                  height: opt.value === "16:9" ? 22 : 40,
                }}
              />
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {opt.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Veo Model */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Video Model
        </label>
        <div className="flex gap-3">
          {VEO_MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVideoVeoModel(opt.value)}
              className={cn(
                "relative flex flex-col items-start gap-1 px-5 py-3.5 rounded-lg border text-left transition-colors duration-200 flex-1",
                videoVeoModel === opt.value
                  ? "border-primary bg-muted shadow-sm"
                  : "border-border hover:border-primary/50"
              )}
            >
              {videoVeoModel === opt.value && (
                <div className="absolute top-2.5 right-2.5">
                  <Check className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {opt.description}
              </span>
              <span className="text-[11px] font-medium text-primary/80">
                {opt.pricePerSecond}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Resolution */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Output Resolution
        </label>
        <div className="flex gap-3">
          {VIDEO_RESOLUTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVideoResolution(opt.value)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-lg border text-sm font-medium transition-colors duration-200",
                videoResolution === opt.value
                  ? "border-primary bg-muted text-primary shadow-sm"
                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {videoResolution === opt.value && (
                <Check className="w-3.5 h-3.5" />
              )}
              {opt.label}
              <span className="text-xs text-muted-foreground">
                ({opt.description})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Number of Videos */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Number of Videos per Product
        </label>
        <div className="flex gap-2">
          {NUMBER_OF_VIDEOS_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setVideoNumberOfResults(n)}
              className={cn(
                "w-12 h-12 rounded-lg border text-sm font-semibold transition-colors duration-200",
                videoNumberOfResults === n
                  ? "border-primary bg-muted text-primary shadow-sm"
                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Audio Toggle */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 block">
          Audio
        </label>
        <button
          onClick={() => setVideoGenerateAudio(!videoGenerateAudio)}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors duration-200",
            videoGenerateAudio
              ? "border-primary bg-muted"
              : "border-border"
          )}
        >
          {videoGenerateAudio ? (
            <Volume2 className="w-5 h-5 text-primary" />
          ) : (
            <VolumeX className="w-5 h-5 text-muted-foreground" />
          )}
          <div className="text-left">
            <span className="text-sm font-medium block">
              {videoGenerateAudio
                ? "Audio Enabled"
                : "Audio Disabled"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {videoGenerateAudio
                ? "AI-generated ambient audio will be included"
                : "Video will be silent"}
            </span>
          </div>
        </button>
      </div>

      {/* Negative Prompt */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">
          Negative Prompt (Optional)
        </label>
        <Textarea
          value={videoNegativePrompt}
          onChange={(e) => setVideoNegativePrompt(e.target.value)}
          placeholder="Things to avoid: blurry, low quality, distorted, multiple products..."
          className="min-h-[70px] text-sm resize-none rounded-lg"
        />
      </div>

      {/* Additional Instructions */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">
          Additional Instructions (Optional)
        </label>
        <Textarea
          value={videoAdditionalInfo}
          onChange={(e) => setVideoAdditionalInfo(e.target.value)}
          placeholder="Any special directions for the video: specific mood, pacing, color grading..."
          className="min-h-[70px] text-sm resize-none rounded-lg"
        />
      </div>

      {/* API Key */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-primary" />
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Google Gemini API Key
          </label>
        </div>
        <div className="relative">
          <Input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            className="pr-10 rounded-lg"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Required for both prompt generation (Gemini 3 Pro) and video generation (Veo 3.1).
          Your key is stored locally and never sent to our servers.
        </p>
      </div>
    </div>
  );
}
