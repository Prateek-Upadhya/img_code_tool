"use client";

import { useEffect } from "react";
import { useVTONStore } from "@/store/vton-store";
import { setGoogleBackend as setGoogleBackendModule } from "@/lib/gemini-client";
import {
  WIZARD_STEPS,
  MODEL_SWAP_WIZARD_STEPS,
  SWATCH_WIZARD_STEPS,
  REPLICATE_WIZARD_STEPS,
  VIDEO_WIZARD_STEPS,
  ROOM_STAGING_WIZARD_STEPS,
  INFOGRAPHIC_WIZARD_STEPS,
} from "@/lib/constants";
import { StepGarments } from "./step-garments";
import { StepStyling } from "./step-styling";
import { StepOutput } from "./step-output";
import { StepDetails } from "./step-details";
import { StepGenerate } from "./step-generate";
import { StepSwatchUpload } from "./step-swatch-upload";
import { StepSwatchConfigure } from "./step-swatch-configure";
import { StepSwatchGenerate } from "./step-swatch-generate";
import { StepReplicateAssets } from "./step-replicate-assets";
import { StepReplicateConfigure } from "./step-replicate-configure";
import { StepReplicateGenerate } from "./step-replicate-generate";
import { StepVideoProducts } from "./step-video-products";
import { StepVideoStyling } from "./step-video-styling";
import { StepVideoSettings } from "./step-video-settings";
import { StepVideoGenerate } from "./step-video-generate";
import { StepRoomStagingProducts } from "./step-room-staging-products";
import { StepRoomStagingScene } from "./step-room-staging-scene";
import { StepRoomStagingShots } from "./step-room-staging-shots";
import { StepRoomStagingDetails } from "./step-room-staging-details";
import { StepRoomStagingGenerate } from "./step-room-staging-generate";
import { StepInfographicProducts } from "./step-infographic-products";
import { StepInfographicBackground } from "./step-infographic-background";
import { StepInfographicTemplate } from "./step-infographic-template";
import { StepInfographicGenerate } from "./step-infographic-generate";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Shirt,
  Palette,
  Ratio,
  FileText,
  Sparkles,
  Layers,
  User,
  ImageIcon,
  Upload,
  Settings,
  Scissors,
  Copy,
  Video,
  Sofa,
  LayoutTemplate,
} from "lucide-react";
import type { AppMode, FeatureMode, WizardStep } from "@/lib/types";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const VTON_STEP_ICONS: Record<number, React.ReactNode> = {
  1: <Shirt className="w-4 h-4" />,
  2: <Palette className="w-4 h-4" />,
  3: <Ratio className="w-4 h-4" />,
  4: <FileText className="w-4 h-4" />,
  5: <Sparkles className="w-4 h-4" />,
};

const MODEL_SWAP_STEP_ICONS: Record<number, React.ReactNode> = {
  1: <ImageIcon className="w-4 h-4" />,
  2: <Palette className="w-4 h-4" />,
  3: <Ratio className="w-4 h-4" />,
  4: <FileText className="w-4 h-4" />,
  5: <Sparkles className="w-4 h-4" />,
};

const SWATCH_STEP_ICONS: Record<number, React.ReactNode> = {
  1: <Upload className="w-4 h-4" />,
  2: <Settings className="w-4 h-4" />,
  3: <Scissors className="w-4 h-4" />,
};

const REPLICATE_STEP_ICONS: Record<number, React.ReactNode> = {
  1: <Upload className="w-4 h-4" />,
  2: <Settings className="w-4 h-4" />,
  3: <Copy className="w-4 h-4" />,
};

const VIDEO_STEP_ICONS: Record<number, React.ReactNode> = {
  1: <ImageIcon className="w-4 h-4" />,
  2: <Palette className="w-4 h-4" />,
  3: <Settings className="w-4 h-4" />,
  4: <Video className="w-4 h-4" />,
};

const ROOM_STAGING_STEP_ICONS: Record<number, React.ReactNode> = {
  1: <Sofa className="w-4 h-4" />,
  2: <Palette className="w-4 h-4" />,
  3: <Ratio className="w-4 h-4" />,
  4: <FileText className="w-4 h-4" />,
  5: <Sparkles className="w-4 h-4" />,
};

const INFOGRAPHIC_STEP_ICONS: Record<number, React.ReactNode> = {
  1: <ImageIcon className="w-4 h-4" />,
  2: <Palette className="w-4 h-4" />,
  3: <LayoutTemplate className="w-4 h-4" />,
  4: <Sparkles className="w-4 h-4" />,
};

function getFeatureLabel(featureMode: FeatureMode) {
  switch (featureMode) {
    case "vton":
      return "Virtual Try-On";
    case "model-swap":
      return "Model Swap";
    case "swatch":
      return "Swatch Studio";
    case "replicate":
      return "Replicate Fast";
    case "product-video":
      return "Product Video";
    case "room-staging":
      return "Room Staging";
    case "infographic":
      return "Infographics";
  }
}

export function VTONWizard() {
  const store = useVTONStore();
  const {
    currentStep,
    setCurrentStep,
    canProceedToStep,
    isGenerating,
    mode,
    setMode,
    featureMode,
    setFeatureMode,
    googleBackend,
    setGoogleBackend,
    isSwatchGenerating,
    isReplicateGenerating,
    isVideoGenerating,
    isRoomStagingGenerating,
    isInfographicGenerating,
  } = store;

  // Mirror the selected Google backend into the gemini-client module so every
  // proxied generateContent call carries the matching `x-google-backend` header.
  // Synced here (in the always-mounted wizard) rather than in a step component
  // so the value survives step navigation.
  useEffect(() => {
    setGoogleBackendModule(googleBackend);
  }, [googleBackend]);
  const isModelSwap = featureMode === "model-swap";
  const isSwatch = featureMode === "swatch";
  const isReplicate = featureMode === "replicate";
  const isProductVideo = featureMode === "product-video";
  const isRoomStaging = featureMode === "room-staging";
  const isInfographic = featureMode === "infographic";
  const activeWizardSteps = isInfographic
    ? INFOGRAPHIC_WIZARD_STEPS
    : isRoomStaging
    ? ROOM_STAGING_WIZARD_STEPS
    : isProductVideo
    ? VIDEO_WIZARD_STEPS
    : isReplicate
    ? REPLICATE_WIZARD_STEPS
    : isSwatch
    ? SWATCH_WIZARD_STEPS
    : isModelSwap
    ? MODEL_SWAP_WIZARD_STEPS
    : WIZARD_STEPS;
  const maxStep = activeWizardSteps.length;
  const anyGenerating = isGenerating || isSwatchGenerating || isReplicateGenerating || isVideoGenerating || isRoomStagingGenerating || isInfographicGenerating;

  const goNext = () => {
    const nextStep = (currentStep + 1) as WizardStep;
    if (nextStep <= maxStep && canProceedToStep(nextStep)) {
      setCurrentStep(nextStep);
    }
  };

  const goPrev = () => {
    const prevStep = (currentStep - 1) as WizardStep;
    if (prevStep >= 1) {
      setCurrentStep(prevStep);
    }
  };

  const goToStep = (step: WizardStep) => {
    if (canProceedToStep(step) || step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const handleModeSwitch = (newMode: AppMode) => {
    if (newMode !== mode && !anyGenerating) {
      setMode(newMode);
      setCurrentStep(1);
    }
  };

  const handleFeatureModeSwitch = (newFeatureMode: FeatureMode) => {
    if (newFeatureMode !== featureMode && !anyGenerating) {
      setFeatureMode(newFeatureMode);
      setCurrentStep(1);
    }
  };

  const stepIcons = isInfographic
    ? INFOGRAPHIC_STEP_ICONS
    : isRoomStaging
    ? ROOM_STAGING_STEP_ICONS
    : isProductVideo
    ? VIDEO_STEP_ICONS
    : isReplicate
    ? REPLICATE_STEP_ICONS
    : isSwatch
    ? SWATCH_STEP_ICONS
    : isModelSwap
    ? MODEL_SWAP_STEP_ICONS
    : VTON_STEP_ICONS;

  return (
    <SidebarProvider>
      <AppSidebar
        featureMode={featureMode}
        onFeatureModeChange={handleFeatureModeSwitch}
        disabled={anyGenerating}
      />
      <SidebarInset>
        {/* Top Header Bar */}
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4 bg-border/50" />

          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">
              {getFeatureLabel(featureMode)}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-muted-foreground">
              {activeWizardSteps[currentStep - 1].title}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Step Pills - Desktop */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {activeWizardSteps.map((s, i) => {
                const isActive = currentStep === s.step;
                const isCompleted = currentStep > s.step;
                const isAccessible =
                  canProceedToStep(s.step as WizardStep) ||
                  s.step <= currentStep;

                return (
                  <div key={s.step} className="flex items-center">
                    <button
                      onClick={() => goToStep(s.step as WizardStep)}
                      disabled={!isAccessible || anyGenerating}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                        isActive
                          ? "btn-gradient text-white shadow-sm"
                          : isCompleted
                          ? "text-foreground hover:bg-muted/60"
                          : isAccessible
                          ? "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          : "text-muted-foreground/30 cursor-not-allowed"
                      )}
                    >
                      <span className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-medium transition-colors",
                        isActive
                          ? "bg-white/15"
                          : isCompleted
                          ? "text-primary"
                          : ""
                      )}>
                        {isCompleted ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          stepIcons[s.step]
                        )}
                      </span>
                      <span className="hidden xl:inline">{s.title}</span>
                    </button>
                    {i < activeWizardSteps.length - 1 && (
                      <div
                        className={cn(
                          "w-6 h-px mx-0.5 transition-colors duration-200",
                          isCompleted ? "bg-primary/40" : "bg-border/50"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Step Counter - Tablet/Mobile */}
            <div className="flex lg:hidden items-center gap-2">
              <div className="flex gap-1.5">
                {activeWizardSteps.map((s) => (
                  <button
                    key={s.step}
                    onClick={() => goToStep(s.step as WizardStep)}
                    disabled={!(canProceedToStep(s.step as WizardStep) || s.step <= currentStep) || anyGenerating}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-200",
                      s.step === currentStep
                        ? "bg-primary w-5"
                        : s.step < currentStep
                        ? "bg-primary/40"
                        : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {currentStep}/{maxStep}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto ambient-glow">
          <div className="relative max-w-4xl mx-auto px-6 sm:px-8 lg:px-10 py-10">
            {/* Mode Toggle + Step Header */}
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-in-up">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary">
                    {stepIcons[currentStep]}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Step {currentStep} of {maxStep}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                  {activeWizardSteps[currentStep - 1].title}
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-relaxed">
                  {activeWizardSteps[currentStep - 1].description}
                </p>
              </div>

              {/* Single/Bulk toggle */}
              {!isSwatch && !isInfographic && (
                <div className="flex items-center rounded-xl border border-border/50 bg-muted/50 p-1 self-start sm:self-end backdrop-blur-sm">
                  <button
                    onClick={() => handleModeSwitch("single")}
                    disabled={anyGenerating}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                      mode === "single"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <User className="w-3.5 h-3.5" />
                    Single
                  </button>
                  <button
                    onClick={() => handleModeSwitch("bulk")}
                    disabled={anyGenerating}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                      mode === "bulk"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Bulk
                  </button>
                </div>
              )}
            </div>

            {/* Google AI backend toggle — first page only */}
            {currentStep === 1 && (
              <div className="mb-8 flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 backdrop-blur-sm animate-fade-in-up sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Google AI Backend
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Powers Gemini prompt &amp; image generation. Video always uses Vertex AI.
                  </p>
                </div>
                <div className="flex items-center rounded-xl border border-border/50 bg-muted/50 p-1 self-start backdrop-blur-sm sm:self-auto">
                  <button
                    onClick={() => setGoogleBackend("vertex")}
                    disabled={anyGenerating}
                    className={cn(
                      "px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-50",
                      googleBackend === "vertex"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Vertex AI
                  </button>
                  <button
                    onClick={() => setGoogleBackend("gemini")}
                    disabled={anyGenerating}
                    className={cn(
                      "px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-50",
                      googleBackend === "gemini"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Gemini API
                  </button>
                </div>
              </div>
            )}

            {/* Step Content */}
            <div className="min-h-[400px]">
              {isInfographic ? (
                <>
                  {currentStep === 1 && <StepInfographicProducts store={store} />}
                  {currentStep === 2 && <StepInfographicBackground store={store} />}
                  {currentStep === 3 && <StepInfographicTemplate store={store} />}
                  {currentStep === 4 && <StepInfographicGenerate store={store} />}
                </>
              ) : isRoomStaging ? (
                <>
                  {currentStep === 1 && <StepRoomStagingProducts store={store} />}
                  {currentStep === 2 && <StepRoomStagingScene store={store} />}
                  {currentStep === 3 && <StepRoomStagingShots store={store} />}
                  {currentStep === 4 && <StepRoomStagingDetails store={store} />}
                  {currentStep === 5 && <StepRoomStagingGenerate store={store} />}
                </>
              ) : isProductVideo ? (
                <>
                  {currentStep === 1 && <StepVideoProducts store={store} />}
                  {currentStep === 2 && <StepVideoStyling store={store} />}
                  {currentStep === 3 && <StepVideoSettings store={store} />}
                  {currentStep === 4 && <StepVideoGenerate store={store} />}
                </>
              ) : isReplicate ? (
                <>
                  {currentStep === 1 && <StepReplicateAssets store={store} />}
                  {currentStep === 2 && <StepReplicateConfigure store={store} />}
                  {currentStep === 3 && <StepReplicateGenerate store={store} />}
                </>
              ) : isSwatch ? (
                <>
                  {currentStep === 1 && <StepSwatchUpload store={store} />}
                  {currentStep === 2 && (
                    <StepSwatchConfigure store={store} />
                  )}
                  {currentStep === 3 && (
                    <StepSwatchGenerate store={store} />
                  )}
                </>
              ) : (
                <>
                  {currentStep === 1 && <StepGarments store={store} />}
                  {currentStep === 2 && <StepStyling store={store} />}
                  {currentStep === 3 && <StepOutput store={store} />}
                  {currentStep === 4 && <StepDetails store={store} />}
                  {currentStep === 5 && <StepGenerate store={store} />}
                </>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-14 pt-6 border-t border-border/50">
              <Button
                variant="ghost"
                onClick={goPrev}
                disabled={currentStep === 1 || anyGenerating}
                className="gap-2 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              {currentStep < maxStep ? (
                <button
                  onClick={goNext}
                  disabled={
                    !canProceedToStep((currentStep + 1) as WizardStep) ||
                    anyGenerating
                  }
                  className="btn-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
