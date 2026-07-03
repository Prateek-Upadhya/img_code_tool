"use client";

import { useCallback, useState, useMemo, useRef } from "react";
import {
  AccessoryCategory,
  AccessoryItem,
  AIModel,
  AppMode,
  AspectRatio,
  BULK_SPREADSHEET_FILTER_ALL,
  BackgroundConfig,
  BottomwearLength,
  BulkBackground,
  BulkSpreadsheetSession,
  BulkBgAssignmentMode,
  BulkCombination,
  BulkGeneratedResult,
  BulkModelImage,
  BulkPoseOverride,
  ComplementaryImage,
  CustomPose,
  PropBucket,
  FeatureMode,
  FitType,
  FootwearSide,
  FootwearType,
  GarmentImage,
  GarmentType,
  Gender,
  GeneratedResult,
  ImageGenModel,
  TextGenModel,
  GoogleBackend,
  ModelImage,
  ModelSwapBackgroundMode,
  SleeveLength,
  TopwearLength,
  ModelSwapBulkCombination,
  ModelSwapBulkResult,
  ModelSwapGeneratedResult,
  NamingLogic,
  Pose,
  ProductCategory,
  ProductFolder,
  SetBulkCombination,
  SetBulkResult,
  SetLayoutStyle,
  SetProductFolder,
  SetVariantFolder,
  SwatchImage,
  SwatchResult,
  SwatchShape,
  UGCGeneratedResult,
  UGCScene,
  WizardStep,
  ReplicateAssetImage,
  ReplicateReferenceOutput,
  ReplicateResult,
  ReplicateVariableGroup,
  ReplicateBulkResult,
  VideoTheme,
  CameraMovement,
  ModelMovement,
  VideoResolution,
  VideoDuration,
  VideoAspectRatio,
  VeoModel,
  VideoProductImage,
  VideoGeneratedResult,
  VideoBulkCombination,
  VideoBulkResult,
  RoomStagingCategory,
  HomeDecorType,
  HomeDecorSubType,
  FurnitureType,
  FurnitureSubType,
  ProductShape,
  RoomStyle,
  RoomStagingProductImage,
  StylingPropImage,
  RoomStagingShot,
  RoomStagingResult,
  RoomStagingBulkCombination,
  RoomStagingBulkResult,
  InfographicProductFolder,
  InfographicBrand,
  InfographicResult,
  InfographicBackgroundStyle,
  InfographicTemplate,
  ModelCreationGender,
  ModelAgeRange,
  ModelBodyType,
  ModelBox,
  ModelCreationResult,
  ModelReferenceImage,
  ModelEditSource,
  ModelEditResult,
  SavedModel,
  EditImageSubfolder,
  EditImageAsset,
  EditImageResult,
  EditType,
} from "@/lib/types";
import { MAX_CAMERA_MOVEMENTS, MAX_MODEL_MOVEMENTS } from "@/lib/constants";

const defaultBackground: BackgroundConfig = {
  mode: "text",
  textDescription: "",
};

/**
 * Reserved `poseId` for the "apply to all poses" accessory/prop layer. Stored as
 * its own entry in `poseAccessories` so it never collides with a real pose id and
 * is merged on top of each pose at generation time (see step-generate.tsx).
 */
export const GLOBAL_ACCESSORY_POSE_ID = "__global__";

export function useVTONStore() {
  // --- Mode ---
  const [mode, setMode] = useState<AppMode>("single");
  const [featureMode, setFeatureMode] = useState<FeatureMode>("vton");

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [productCategory, setProductCategory] = useState<ProductCategory>("clothing");
  const [gender, setGender] = useState<Gender>("female");
  const [garmentImages, setGarmentImages] = useState<GarmentImage[]>([]);
  const [garmentType, setGarmentType] = useState<GarmentType>("topwear");
  const [footwearType, setFootwearType] = useState<FootwearType>("casual-shoes");
  const [fit, setFit] = useState<FitType | null>(null);
  const [sleeveLength, setSleeveLength] = useState<SleeveLength | null>(null);
  const [topwearLength, setTopwearLength] = useState<TopwearLength | null>(null);
  const [bottomwearLength, setBottomwearLength] = useState<BottomwearLength | null>(null);
  const [complementaryImages, setComplementaryImages] = useState<ComplementaryImage[]>([]);
  const [poseAccessories, setPoseAccessories] = useState<Record<string, AccessoryItem[]>>({});
  // User-created prop buckets. Each bucket holds multiple interchangeable
  // reference images and can be enabled per pose; at generation time one image
  // is drawn per product (see step-generate.tsx materializeAccessories).
  const [propBuckets, setPropBuckets] = useState<PropBucket[]>([]);
  const [applyAccessoriesToAllPoses, setApplyAccessoriesToAllPosesRaw] = useState(false);
  const [background, setBackground] = useState<BackgroundConfig>(defaultBackground);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [modelImage, setModelImage] = useState<ModelImage | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  const [imageQuality, setImageQuality] = useState<"1K" | "2K" | "4K">("2K");
  const [imageGenModel, setImageGenModel] = useState<ImageGenModel>("gemini");
  const [textGenModel, setTextGenModel] = useState<TextGenModel>("gemini");
  // Which Google backend serves the Gemini text + image models (first-page toggle).
  // Defaults to Vertex AI; affects image + prompt generation (not Veo video).
  const [googleBackend, setGoogleBackend] = useState<GoogleBackend>("vertex");
  const [selectedPoses, setSelectedPoses] = useState<Pose[]>([]);
  const [customPoses, setCustomPoses] = useState<CustomPose[]>([]);
  const [namingLogic, setNamingLogic] = useState<NamingLogic>("folder-name-sequential");
  const [singleDownloadPrefix, setSingleDownloadPrefix] = useState("product");
  // Comma-separated list of suffix numbers to skip when generating sequential
  // download filenames. Stored as raw user input; parsed at consumption time.
  // Example: "3, 7" with prefix "product" produces product_1, product_2, product_4,
  // product_5, product_6, product_8 (skipping _3 and _7).
  const [skipNamingIndicesText, setSkipNamingIndicesText] = useState("");
  // When true, the post-generation validation step (and its cost tracking) is
  // skipped entirely — no verification LLM call, no cost breakdown displayed.
  const [skipValidation, setSkipValidation] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [productInfo, setProductInfo] = useState("");
  // Vertex AI credentials live server-side (see src/lib/vertex-server.ts); the
  // browser no longer holds a key. This sentinel keeps the legacy `apiKey`
  // readiness checks ("apiKey.length > 0" / "!apiKey") satisfied without the user
  // supplying anything. It is never sent to Google.
  const [apiKey, setApiKey] = useState("vertex-ai");
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  // True while the once-per-batch background-scene pre-pass is running. This
  // surfaces a dedicated "Ingesting configuration… preparing to generate"
  // loader so the user knows why the per-pose results haven't started
  // appearing yet. Reset to false as soon as the analysis finishes (or
  // fails) and per-pose generation begins.
  const [isIngestingScene, setIsIngestingScene] = useState(false);

  // ----------------------------------------------------------------------
  // Generation cancellation
  // ----------------------------------------------------------------------
  // The current in-flight AbortController for the active generation batch.
  // Stored in a ref (not state) because we never want a re-render when the
  // controller is rotated — we only need a stable handle the Stop button can
  // use to call .abort(). The same ref is also consumed by the per-pose loop
  // to break out of the concurrency batches once the user has cancelled.
  //
  // NOTE per @google/genai docs: AbortSignal is a CLIENT-ONLY operation —
  // calling .abort() cancels the in-flight HTTP request but does NOT cancel
  // the work on Google's side, so any partial usage may still be billed.
  const generationAbortControllerRef = useRef<AbortController | null>(null);

  const beginGeneration = useCallback((): AbortController => {
    const ctrl = new AbortController();
    generationAbortControllerRef.current = ctrl;
    setIsGenerating(true);
    return ctrl;
  }, []);

  const cancelGeneration = useCallback(() => {
    const ctrl = generationAbortControllerRef.current;
    if (ctrl) {
      ctrl.abort();
    }
    // We deliberately leave isGenerating === true here so the per-pose
    // loops can finish their cleanup pass (mark in-flight + pending as
    // "cancelled"); the loops themselves call setIsGenerating(false) in
    // their finally blocks.
  }, []);

  // --- Bulk Mode State ---
  const [primaryFolders, setPrimaryFolders] = useState<ProductFolder[]>([]);
  const [complementaryFolders, setComplementaryFolders] = useState<ProductFolder[]>([]);
  const [bulkModelImages, setBulkModelImages] = useState<BulkModelImage[]>([]);
  const [bulkBackgrounds, setBulkBackgrounds] = useState<BulkBackground[]>([]);
  const [bulkBgAssignment, setBulkBgAssignmentRaw] = useState<BulkBgAssignmentMode>("round-robin");
  const [productBgMap, setProductBgMap] = useState<Record<string, string>>({});
  const [bulkResults, setBulkResults] = useState<BulkGeneratedResult[]>([]);
  const [bulkPoseOverrides, setBulkPoseOverrides] = useState<BulkPoseOverride[]>([]);
  const [bulkSpreadsheetSession, setBulkSpreadsheetSessionState] = useState<BulkSpreadsheetSession | null>(
    null
  );
  const [bulkSpreadsheetFilter, setBulkSpreadsheetFilterState] = useState<string>(BULK_SPREADSHEET_FILTER_ALL);

  // --- Model Swap State ---
  const [modelSwapBgMode, setModelSwapBgMode] = useState<ModelSwapBackgroundMode>("keep-same");
  const [modelSwapResults, setModelSwapResults] = useState<ModelSwapGeneratedResult[]>([]);
  const [modelSwapBulkResults, setModelSwapBulkResults] = useState<ModelSwapBulkResult[]>([]);

  // --- Swatch State ---
  const [swatchImages, setSwatchImages] = useState<SwatchImage[]>([]);
  const [swatchShape, setSwatchShape] = useState<SwatchShape>("square");
  const [swatchSize, setSwatchSize] = useState<number>(512);
  const [swatchResults, setSwatchResults] = useState<SwatchResult[]>([]);
  const [isSwatchGenerating, setIsSwatchGenerating] = useState(false);

  // --- Set Product State ---
  const [setProductEnabled, setSetProductEnabled] = useState(false);
  const [setProductLayout, setSetProductLayout] = useState<SetLayoutStyle>("side-by-side");
  // Single mode: single set with variants
  const [setProductVariants, setSetProductVariants] = useState<SetVariantFolder[]>([]);
  // Bulk mode: multiple set folders
  const [setProductFolders, setSetProductFolders] = useState<SetProductFolder[]>([]);
  const [setProductResults, setSetProductResults] = useState<SetBulkResult[]>([]);

  // --- UGC State ---
  const [ugcScenes, setUgcScenes] = useState<UGCScene[]>([]);
  const [ugcResults, setUgcResults] = useState<UGCGeneratedResult[]>([]);

  // --- Replicate Fast State ---
  const [replicateAssets, setReplicateAssets] = useState<ReplicateAssetImage[]>([]);
  const [replicateReference, setReplicateReference] = useState<ReplicateReferenceOutput | null>(null);
  const [replicateAdditionalInfo, setReplicateAdditionalInfo] = useState("");
  const [replicateResults, setReplicateResults] = useState<ReplicateResult[]>([]);
  const [isReplicateGenerating, setIsReplicateGenerating] = useState(false);
  // Bulk: shared assets go into every generation, variable groups produce one output each
  const [replicateSharedAssets, setReplicateSharedAssets] = useState<ReplicateAssetImage[]>([]);
  const [replicateVariableGroups, setReplicateVariableGroups] = useState<ReplicateVariableGroup[]>([]);
  const [replicateBulkResults, setReplicateBulkResults] = useState<ReplicateBulkResult[]>([]);

  // --- Product Video State ---
  const [videoProductCategory, setVideoProductCategory] = useState<ProductCategory>("clothing");
  const [videoGender, setVideoGender] = useState<Gender>("female");
  const [videoProductImages, setVideoProductImages] = useState<VideoProductImage[]>([]);
  const [videoProductInfo, setVideoProductInfo] = useState("");
  const [videoTheme, setVideoTheme] = useState<VideoTheme>("studio-clean");
  const [videoCameraMovements, setVideoCameraMovements] = useState<CameraMovement[]>(["slow-pan-right"]);
  const [videoModelMovements, setVideoModelMovements] = useState<ModelMovement[]>([]);
  const [videoBackground, setVideoBackground] = useState<BackgroundConfig>(defaultBackground);
  const [videoSelectedModel, setVideoSelectedModel] = useState<AIModel | null>(null);
  const [videoModelImage, setVideoModelImage] = useState<ModelImage | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>("9:16");
  const [videoVeoModel, setVideoVeoModel] = useState<VeoModel>("veo-3.1-generate-preview");
  const [videoResolution, setVideoResolution] = useState<VideoResolution>("1080p");
  const [videoDuration, setVideoDurationRaw] = useState<VideoDuration>(8);

  const setVideoDuration = useCallback((d: VideoDuration) => {
    setVideoDurationRaw(d);
    const maxCam = MAX_CAMERA_MOVEMENTS[d];
    setVideoCameraMovements((prev) => (prev.length > maxCam ? prev.slice(0, maxCam) : prev));
    const maxModel = MAX_MODEL_MOVEMENTS[d];
    setVideoModelMovements((prev) => (prev.length > maxModel ? prev.slice(0, maxModel) : prev));
  }, []);
  const [videoNumberOfResults, setVideoNumberOfResults] = useState<number>(1);
  const [videoGenerateAudio, setVideoGenerateAudio] = useState(true);
  const [videoNegativePrompt, setVideoNegativePrompt] = useState("");
  const [videoAdditionalInfo, setVideoAdditionalInfo] = useState("");
  const [videoResults, setVideoResults] = useState<VideoGeneratedResult[]>([]);
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  // Bulk
  const [videoPrimaryFolders, setVideoPrimaryFolders] = useState<ProductFolder[]>([]);
  const [videoBulkModelImages, setVideoBulkModelImages] = useState<BulkModelImage[]>([]);
  const [videoBulkBackgrounds, setVideoBulkBackgrounds] = useState<BulkBackground[]>([]);
  const [videoBulkResults, setVideoBulkResults] = useState<VideoBulkResult[]>([]);

  // --- Room Staging State ---
  const [roomStagingCategory, setRoomStagingCategory] = useState<RoomStagingCategory>("home-decor");
  const [roomHomeDecorType, setRoomHomeDecorType] = useState<HomeDecorType>("rugs-carpets");
  const [roomHomeDecorSubType, setRoomHomeDecorSubType] = useState<HomeDecorSubType | null>(null);
  const [roomFurnitureType, setRoomFurnitureType] = useState<FurnitureType>("sofas-seating");
  const [roomFurnitureSubType, setRoomFurnitureSubType] = useState<FurnitureSubType | null>(null);
  const [roomProductShape, setRoomProductShape] = useState<ProductShape>("rectangular");
  const [roomProductDimensions, setRoomProductDimensions] = useState("");
  const [roomProductImages, setRoomProductImages] = useState<RoomStagingProductImage[]>([]);
  const [roomProductInfo, setRoomProductInfo] = useState("");
  const [roomStylingProps, setRoomStylingProps] = useState<StylingPropImage[]>([]);
  const [roomSelectedRoomStyle, setRoomSelectedRoomStyle] = useState<RoomStyle | null>(null);
  const [roomInspirationImage, setRoomInspirationImage] = useState<ModelImage | null>(null);
  const [roomDescription, setRoomDescription] = useState("");
  const [roomBackground, setRoomBackground] = useState<BackgroundConfig>(defaultBackground);
  const [roomSelectedShots, setRoomSelectedShots] = useState<RoomStagingShot[]>([]);
  const [roomAspectRatio, setRoomAspectRatio] = useState<AspectRatio>("1:1");
  const [roomImageQuality, setRoomImageQuality] = useState<"1K" | "2K" | "4K">("2K");
  const [roomAdditionalInfo, setRoomAdditionalInfo] = useState("");
  const [roomResults, setRoomResults] = useState<RoomStagingResult[]>([]);
  const [isRoomStagingGenerating, setIsRoomStagingGenerating] = useState(false);
  // Bulk
  const [roomPrimaryFolders, setRoomPrimaryFolders] = useState<ProductFolder[]>([]);
  const [roomBulkRoomSettings, setRoomBulkRoomSettings] = useState<BulkModelImage[]>([]);
  const [roomBulkBackgrounds, setRoomBulkBackgrounds] = useState<BulkBackground[]>([]);
  const [roomBulkResults, setRoomBulkResults] = useState<RoomStagingBulkResult[]>([]);

  // --- Bulk Infographic State ---
  const [infographicCategory, setInfographicCategory] = useState<ProductCategory>("footwear");
  const [infographicFolders, setInfographicFolders] = useState<InfographicProductFolder[]>([]);
  const [infographicBrand, setInfographicBrand] = useState<InfographicBrand>({});
  const [infographicBackgroundStyle, setInfographicBackgroundStyle] = useState<InfographicBackgroundStyle>("solid-textured");
  const [infographicTemplateCounts, setInfographicTemplateCounts] = useState<Record<InfographicTemplate, number>>({
    minimalistic: 1,
    "sole-construction": 0,
  });
  const [infographicAspectRatio, setInfographicAspectRatio] = useState<AspectRatio>("3:4");
  const [infographicImageSize, setInfographicImageSize] = useState<"1K" | "2K" | "4K">("2K");
  const [infographicStylingInstructions, setInfographicStylingInstructions] = useState("");
  const [infographicResults, setInfographicResults] = useState<InfographicResult[]>([]);
  const [isInfographicGenerating, setIsInfographicGenerating] = useState(false);

  // --- AI Model Creation State ---
  // Global "casting" attributes — apply to every model box in the batch.
  const [modelGender, setModelGender] = useState<ModelCreationGender>("female");
  const [modelAgeRange, setModelAgeRange] = useState<ModelAgeRange>("26-35");
  const [modelBodyType, setModelBodyType] = useState<ModelBodyType>("average");
  const [modelEthnicity, setModelEthnicity] = useState<string>("");
  // Optional brand identity. Directives are auto-researched (web search) then
  // editable, and applied to every generation.
  const [modelBrandName, setModelBrandName] = useState<string>("");
  const [modelBrandDirectives, setModelBrandDirectives] = useState<string>("");
  const [modelBrandStatus, setModelBrandStatus] = useState<"idle" | "researching" | "ready" | "error">("idle");
  // Optional extra visual-appearance guidelines from the user.
  const [modelGuidelines, setModelGuidelines] = useState<string>("");
  const [modelBoxes, setModelBoxes] = useState<ModelBox[]>([]);
  const [modelCreationResults, setModelCreationResults] = useState<ModelCreationResult[]>([]);
  // Mirrors the IndexedDB-backed Model Library; loaded on mount by the Generate step.
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [isModelCreationGenerating, setIsModelCreationGenerating] = useState(false);

  // --- AI Model Creation Actions ---
  const addModelBox = useCallback(() => {
    setModelBoxes((prev) => [
      ...prev,
      {
        id: `mb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: "",
        description: "",
        variantCount: 1,
        lockToReferenceFace: true,
      },
    ]);
  }, []);

  const updateModelBox = useCallback(
    (id: string, update: Partial<Omit<ModelBox, "id" | "referenceImage">>) => {
      setModelBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...update } : b)));
    },
    []
  );

  const removeModelBox = useCallback((id: string) => {
    setModelBoxes((prev) => {
      const removed = prev.find((b) => b.id === id);
      if (removed?.referenceImage) URL.revokeObjectURL(removed.referenceImage.preview);
      return prev.filter((b) => b.id !== id);
    });
  }, []);

  const setModelBoxReferenceImage = useCallback((id: string, file: File | null) => {
    setModelBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        if (b.referenceImage) URL.revokeObjectURL(b.referenceImage.preview);
        return {
          ...b,
          referenceImage: file
            ? { file, preview: URL.createObjectURL(file) }
            : undefined,
        };
      })
    );
  }, []);

  const updateModelCreationResult = useCallback(
    (id: string, update: Partial<ModelCreationResult>) => {
      setModelCreationResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
    },
    []
  );

  const resetModelCreationResults = useCallback(() => {
    setModelCreationResults([]);
  }, []);

  // --- AI Model Editing (sub-mode of model-creation) ---
  // "create" = generate models from scratch; "edit" = edit a set of uploaded models.
  const [modelCreationMode, setModelCreationMode] = useState<"create" | "edit">("create");
  const [modelEditSources, setModelEditSources] = useState<ModelEditSource[]>([]);
  const [modelEditDirective, setModelEditDirective] = useState<string>("");
  const [modelEditReferenceDirective, setModelEditReferenceDirective] = useState<string>("");
  const [modelEditReference, setModelEditReferenceState] = useState<ModelReferenceImage | undefined>(undefined);
  const [modelEditResults, setModelEditResults] = useState<ModelEditResult[]>([]);
  const [isModelEditGenerating, setIsModelEditGenerating] = useState(false);

  const addModelEditSources = useCallback((files: File[]) => {
    setModelEditSources((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `mes-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const removeModelEditSource = useCallback((id: string) => {
    setModelEditSources((prev) => {
      const removed = prev.find((s) => s.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const setModelEditReference = useCallback((file: File | null) => {
    setModelEditReferenceState((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return file ? { file, preview: URL.createObjectURL(file) } : undefined;
    });
  }, []);

  const updateModelEditResult = useCallback((id: string, update: Partial<ModelEditResult>) => {
    setModelEditResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetModelEditResults = useCallback(() => {
    setModelEditResults([]);
  }, []);

  // --- Edit Image State ---
  const [editImageSubfolders, setEditImageSubfolders] = useState<EditImageSubfolder[]>([]);
  const [editType, setEditType] = useState<EditType>("variation");
  const [editImageVariationInstructions, setEditImageVariationInstructions] = useState<string>("");
  const [editImageReferenceImages, setEditImageReferenceImages] = useState<EditImageAsset[]>([]);
  const [editImageResults, setEditImageResults] = useState<EditImageResult[]>([]);
  const [isEditImageGenerating, setIsEditImageGenerating] = useState(false);

  const updateEditImageSubfolder = useCallback(
    (id: string, patch: Partial<EditImageSubfolder>) => {
      setEditImageSubfolders((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    []
  );

  const removeEditImageSubfolder = useCallback((id: string) => {
    setEditImageSubfolders((prev) => {
      const removed = prev.find((s) => s.id === id);
      if (removed) {
        for (const img of [...removed.aiImages, ...removed.productImages]) {
          URL.revokeObjectURL(img.preview);
        }
      }
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const removeEditImageAsset = useCallback(
    (subfolderId: string, assetId: string, side: "ai" | "product") => {
      setEditImageSubfolders((prev) =>
        prev.map((s) => {
          if (s.id !== subfolderId) return s;
          const key = side === "ai" ? "aiImages" : "productImages";
          const removed = s[key].find((a) => a.id === assetId);
          if (removed) URL.revokeObjectURL(removed.preview);
          return { ...s, [key]: s[key].filter((a) => a.id !== assetId) };
        })
      );
    },
    []
  );

  const addEditImageReferenceImages = useCallback((files: File[]) => {
    setEditImageReferenceImages((prev) => [
      ...prev,
      ...files
        .filter((f) => f.type.startsWith("image/"))
        .map((file) => ({
          id: `eir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          preview: URL.createObjectURL(file),
        })),
    ]);
  }, []);

  const removeEditImageReferenceImage = useCallback((id: string) => {
    setEditImageReferenceImages((prev) => {
      const removed = prev.find((r) => r.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const updateEditImageResult = useCallback((id: string, update: Partial<EditImageResult>) => {
    setEditImageResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetEditImageResults = useCallback(() => {
    setEditImageResults([]);
  }, []);

  // --- Single Mode Actions ---

  const addGarmentImage = useCallback((image: GarmentImage) => {
    setGarmentImages((prev) => [...prev, image]);
  }, []);

  const removeGarmentImage = useCallback((id: string) => {
    setGarmentImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const toggleGarmentBackView = useCallback((id: string) => {
    setGarmentImages((prev) =>
      prev.map((img) => ({
        ...img,
        isBackView: img.id === id ? !img.isBackView : false,
      }))
    );
  }, []);

  const setGarmentImageFootwearSide = useCallback(
    (id: string, side: FootwearSide | null) => {
      setGarmentImages((prev) =>
        prev.map((img) => {
          if (img.id === id) {
            return { ...img, footwearSide: side ?? undefined };
          }
          if (side && img.footwearSide === side) {
            return { ...img, footwearSide: undefined };
          }
          return img;
        })
      );
    },
    []
  );

  /**
   * Model Swap (single mode): per-source-image Pose Variation toggle.
   * When true, the generated image is allowed subtle pose changes while preserving
   * framing and body orientation. When false (default), the original pose is reproduced exactly.
   */
  const setGarmentImagePoseVariation = useCallback((id: string, value: boolean) => {
    setGarmentImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, poseVariation: value } : img))
    );
  }, []);

  const addComplementaryImage = useCallback((image: ComplementaryImage) => {
    setComplementaryImages((prev) => [...prev, image]);
  }, []);

  const removeComplementaryImage = useCallback((id: string) => {
    setComplementaryImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const toggleAccessory = useCallback((poseId: string, category: AccessoryCategory) => {
    setPoseAccessories((prev) => {
      const poseAccs = prev[poseId] || [];
      const exists = poseAccs.find((a) => a.category === category);
      if (exists) {
        if (exists.image) URL.revokeObjectURL(exists.image.preview);
        const filtered = poseAccs.filter((a) => a.category !== category);
        return { ...prev, [poseId]: filtered };
      }
      return {
        ...prev,
        [poseId]: [
          ...poseAccs,
          {
            id: `acc-${category}-${Date.now()}`,
            category,
          },
        ],
      };
    });
  }, []);

  const setAccessoryImage = useCallback(
    (poseId: string, category: AccessoryCategory, file: File) => {
      setPoseAccessories((prev) => {
        const poseAccs = (prev[poseId] || []).map((a) => {
          if (a.category !== category) return a;
          if (a.image) URL.revokeObjectURL(a.image.preview);
          return { ...a, image: { file, preview: URL.createObjectURL(file) } };
        });
        return { ...prev, [poseId]: poseAccs };
      });
    },
    []
  );

  const removeAccessoryImage = useCallback((poseId: string, category: AccessoryCategory) => {
    setPoseAccessories((prev) => {
      const poseAccs = (prev[poseId] || []).map((a) => {
        if (a.category !== category) return a;
        if (a.image) URL.revokeObjectURL(a.image.preview);
        return { ...a, image: undefined };
      });
      return { ...prev, [poseId]: poseAccs };
    });
  }, []);

  const addCustomAccessory = useCallback(
    (poseId: string, description?: string, image?: { file: File; preview: string }) => {
      setPoseAccessories((prev) => {
        const poseAccs = prev[poseId] || [];
        const newAcc: AccessoryItem = {
          id: `acc-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: "custom" as AccessoryCategory,
          customDescription: description,
          image,
        };
        return { ...prev, [poseId]: [...poseAccs, newAcc] };
      });
    },
    []
  );

  const updateCustomAccessoryDescription = useCallback(
    (poseId: string, accessoryId: string, description: string) => {
      setPoseAccessories((prev) => {
        const poseAccs = (prev[poseId] || []).map((a) =>
          a.id === accessoryId ? { ...a, customDescription: description } : a
        );
        return { ...prev, [poseId]: poseAccs };
      });
    },
    []
  );

  const removeCustomAccessory = useCallback((poseId: string, accessoryId: string) => {
    setPoseAccessories((prev) => {
      const poseAccs = prev[poseId] || [];
      const target = poseAccs.find((a) => a.id === accessoryId);
      if (target?.image) URL.revokeObjectURL(target.image.preview);
      return { ...prev, [poseId]: poseAccs.filter((a) => a.id !== accessoryId) };
    });
  }, []);

  const setCustomAccessoryImage = useCallback(
    (poseId: string, accessoryId: string, file: File) => {
      setPoseAccessories((prev) => {
        const poseAccs = (prev[poseId] || []).map((a) => {
          if (a.id !== accessoryId) return a;
          if (a.image) URL.revokeObjectURL(a.image.preview);
          return { ...a, image: { file, preview: URL.createObjectURL(file) } };
        });
        return { ...prev, [poseId]: poseAccs };
      });
    },
    []
  );

  const removeCustomAccessoryImage = useCallback((poseId: string, accessoryId: string) => {
    setPoseAccessories((prev) => {
      const poseAccs = (prev[poseId] || []).map((a) => {
        if (a.id !== accessoryId) return a;
        if (a.image) URL.revokeObjectURL(a.image.preview);
        return { ...a, image: undefined };
      });
      return { ...prev, [poseId]: poseAccs };
    });
  }, []);

  // Non-destructive: flips the flag only. The "apply to all poses" accessories/
  // props live in their own bucket under GLOBAL_ACCESSORY_POSE_ID and are merged
  // on top of each pose's own selections at generation time — individual per-pose
  // selections are never copied over or overwritten.
  const setApplyAccessoriesToAllPoses = useCallback((value: boolean) => {
    setApplyAccessoriesToAllPosesRaw(value);
  }, []);

  // --- Prop Bucket Actions ---

  /**
   * Creates a new, empty prop bucket and returns its id. The id scheme mirrors
   * the accessory id scheme used elsewhere in this store (`<prefix>-<ts>-<rand>`).
   */
  const createPropBucket = useCallback(
    (name: string, category: AccessoryCategory | "custom" = "custom"): string => {
      const id = `bucket-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setPropBuckets((prev) => [...prev, { id, name, category, images: [] }]);
      return id;
    },
    []
  );

  const renamePropBucket = useCallback((bucketId: string, name: string) => {
    setPropBuckets((prev) => prev.map((b) => (b.id === bucketId ? { ...b, name } : b)));
  }, []);

  const setPropBucketCategory = useCallback(
    (bucketId: string, category: AccessoryCategory | "custom") => {
      setPropBuckets((prev) => prev.map((b) => (b.id === bucketId ? { ...b, category } : b)));
      // Keep already-toggled pose accessories in sync with the bucket's category
      // so the meta-prompter frames the drawn image correctly.
      setPoseAccessories((prev) => {
        const updated: Record<string, AccessoryItem[]> = {};
        for (const [pid, accs] of Object.entries(prev)) {
          updated[pid] = accs.map((a) =>
            a.bucketId === bucketId ? { ...a, category: category as AccessoryCategory } : a
          );
        }
        return updated;
      });
    },
    []
  );

  const addPropBucketImages = useCallback((bucketId: string, files: File[]) => {
    setPropBuckets((prev) =>
      prev.map((b) => {
        if (b.id !== bucketId) return b;
        const newImages = files.map((file) => ({
          file,
          preview: URL.createObjectURL(file),
        }));
        return { ...b, images: [...b.images, ...newImages] };
      })
    );
  }, []);

  const removePropBucketImage = useCallback((bucketId: string, imageIndex: number) => {
    setPropBuckets((prev) =>
      prev.map((b) => {
        if (b.id !== bucketId) return b;
        const target = b.images[imageIndex];
        if (target) URL.revokeObjectURL(target.preview);
        return { ...b, images: b.images.filter((_, i) => i !== imageIndex) };
      })
    );
  }, []);

  const deletePropBucket = useCallback((bucketId: string) => {
    setPropBuckets((prev) => {
      const removed = prev.find((b) => b.id === bucketId);
      if (removed) removed.images.forEach((img) => URL.revokeObjectURL(img.preview));
      return prev.filter((b) => b.id !== bucketId);
    });
    // Drop any pose-level references to this bucket from every pose.
    setPoseAccessories((prev) => {
      const updated: Record<string, AccessoryItem[]> = {};
      for (const [pid, accs] of Object.entries(prev)) {
        updated[pid] = accs.filter((a) => a.bucketId !== bucketId);
      }
      return updated;
    });
  }, []);

  /**
   * Toggles a bucket reference on/off for one pose. Mirrors {@link toggleAccessory}:
   * adds an `AccessoryItem` carrying `bucketId` (and the bucket's category) when
   * absent, or removes it when present. The `image` is intentionally left
   * undefined — it is materialized at generation time.
   */
  const togglePoseBucket = useCallback((poseId: string, bucketId: string) => {
    // IMPORTANT: do a SINGLE setPoseAccessories call and read the bucket from the
    // component-scope `propBuckets`. Calling setPoseAccessories nested inside a
    // setPropBuckets updater makes the update impure, so React's dev-StrictMode
    // double-invocation runs the toggle twice (add then remove) and the bucket
    // never stays selected.
    const bucket = propBuckets.find((b) => b.id === bucketId);
    setPoseAccessories((prev) => {
      const poseAccs = prev[poseId] || [];
      const exists = poseAccs.some((a) => a.bucketId === bucketId);
      if (exists) {
        return { ...prev, [poseId]: poseAccs.filter((a) => a.bucketId !== bucketId) };
      }
      return {
        ...prev,
        [poseId]: [
          ...poseAccs,
          {
            id: `acc-bucket-${bucketId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: (bucket?.category ?? "custom") as AccessoryCategory,
            bucketId,
          },
        ],
      };
    });
  }, [propBuckets]);

  const togglePose = useCallback((pose: Pose) => {
    setSelectedPoses((prev) => {
      const exists = prev.find((p) => p.id === pose.id);
      if (exists) {
        // Clean up accessories for this pose
        setPoseAccessories((prevAccs) => {
          const accs = prevAccs[pose.id];
          if (accs) {
            accs.forEach((a) => { if (a.image) URL.revokeObjectURL(a.image.preview); });
          }
          const { [pose.id]: _, ...rest } = prevAccs;
          return rest;
        });
        return prev.filter((p) => p.id !== pose.id);
      }
      return [...prev, pose];
    });
  }, []);

  const movePoseInSequence = useCallback((fromIndex: number, toIndex: number) => {
    setSelectedPoses((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const addCustomPose = useCallback((pose: CustomPose) => {
    setCustomPoses((prev) => [...prev, { ...pose, isModelShot: pose.isModelShot ?? true }]);
  }, []);

  const removeCustomPose = useCallback((id: string) => {
    setCustomPoses((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed) {
        removed.referenceImages.forEach((img) => URL.revokeObjectURL(img.preview));
      }
      return prev.filter((p) => p.id !== id);
    });
    setPoseAccessories((prevAccs) => {
      const { [id]: _, ...rest } = prevAccs;
      return rest;
    });
  }, []);

  const updateCustomPose = useCallback((id: string, update: Partial<Omit<CustomPose, "id">>) => {
    setCustomPoses((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...update } : p))
    );
  }, []);

  const addCustomPoseImage = useCallback((poseId: string, file: File) => {
    setCustomPoses((prev) =>
      prev.map((p) => {
        if (p.id !== poseId) return p;
        const newImg = {
          id: `cpi-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
        };
        return { ...p, referenceImages: [...p.referenceImages, newImg] };
      })
    );
  }, []);

  const removeCustomPoseImage = useCallback((poseId: string, imageId: string) => {
    setCustomPoses((prev) =>
      prev.map((p) => {
        if (p.id !== poseId) return p;
        const img = p.referenceImages.find((i) => i.id === imageId);
        if (img) URL.revokeObjectURL(img.preview);
        return { ...p, referenceImages: p.referenceImages.filter((i) => i.id !== imageId) };
      })
    );
  }, []);

  const updateResult = useCallback((id: string, update: Partial<GeneratedResult>) => {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetResults = useCallback(() => {
    setResults([]);
  }, []);

  // --- Bulk Mode Actions ---

  const addPrimaryFolder = useCallback((folder: ProductFolder) => {
    setPrimaryFolders((prev) => [...prev, folder]);
  }, []);

  const removePrimaryFolder = useCallback((id: string) => {
    setPrimaryFolders((prev) => {
      const folder = prev.find((f) => f.id === id);
      if (folder) folder.images.forEach((img) => URL.revokeObjectURL(img.preview));
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const addImageToFolder = useCallback(
    (folderId: string, target: "primary" | "complementary", files: File[]) => {
      const setter = target === "primary" ? setPrimaryFolders : setComplementaryFolders;
      setter((prev) =>
        prev.map((folder) => {
          if (folder.id !== folderId) return folder;
          const newImages = files.map((file) => ({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            preview: URL.createObjectURL(file),
          }));
          return { ...folder, images: [...folder.images, ...newImages] };
        })
      );
    },
    []
  );

  const removeImageFromFolder = useCallback(
    (folderId: string, imageId: string, target: "primary" | "complementary") => {
      const setter = target === "primary" ? setPrimaryFolders : setComplementaryFolders;
      setter((prev) =>
        prev.map((folder) => {
          if (folder.id !== folderId) return folder;
          const img = folder.images.find((i) => i.id === imageId);
          if (img) URL.revokeObjectURL(img.preview);
          return { ...folder, images: folder.images.filter((i) => i.id !== imageId) };
        })
      );
    },
    []
  );

  const toggleFolderImageBackView = useCallback(
    (folderId: string, imageId: string) => {
      setPrimaryFolders((prev) =>
        prev.map((folder) => {
          if (folder.id !== folderId) return folder;
          return {
            ...folder,
            images: folder.images.map((img) => ({
              ...img,
              isBackView: img.id === imageId ? !img.isBackView : false,
            })),
          };
        })
      );
    },
    []
  );

  const setFolderImageFootwearSide = useCallback(
    (folderId: string, imageId: string, side: FootwearSide | null) => {
      setPrimaryFolders((prev) =>
        prev.map((folder) => {
          if (folder.id !== folderId) return folder;
          return {
            ...folder,
            images: folder.images.map((img) => {
              if (img.id === imageId) {
                return { ...img, footwearSide: side ?? undefined };
              }
              if (side && img.footwearSide === side) {
                return { ...img, footwearSide: undefined };
              }
              return img;
            }),
          };
        })
      );
    },
    []
  );

  const renamePrimaryFolder = useCallback((id: string, name: string) => {
    setPrimaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name } : f))
    );
  }, []);

  const updatePrimaryFolderProductInfo = useCallback((id: string, info: string) => {
    setPrimaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, productInfo: info } : f))
    );
  }, []);

  const updatePrimaryFolderFit = useCallback((id: string, newFit: FitType | null) => {
    setPrimaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, fit: newFit } : f))
    );
  }, []);

  const updatePrimaryFolderSleeveLength = useCallback((id: string, v: SleeveLength | null) => {
    setPrimaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, sleeveLength: v } : f))
    );
  }, []);

  const updatePrimaryFolderTopwearLength = useCallback((id: string, v: TopwearLength | null) => {
    setPrimaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, topwearLength: v } : f))
    );
  }, []);

  const updatePrimaryFolderBottomwearLength = useCallback((id: string, v: BottomwearLength | null) => {
    setPrimaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, bottomwearLength: v } : f))
    );
  }, []);

  /**
   * Model Swap (bulk mode): per-ProductFolder Pose Variation toggle.
   * Applies to all source images in this folder. When true, subtle pose changes are
   * allowed while preserving framing and body orientation. When false (default),
   * every image's original pose is reproduced exactly.
   */
  const setProductFolderPoseVariation = useCallback((id: string, value: boolean) => {
    setPrimaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, poseVariation: value } : f))
    );
  }, []);

  const setBulkSpreadsheetSession = useCallback(
    (session: BulkSpreadsheetSession | null, initialFilter?: string) => {
      setBulkSpreadsheetSessionState(session);
      if (session === null) {
        setBulkSpreadsheetFilterState(BULK_SPREADSHEET_FILTER_ALL);
      } else {
        setBulkSpreadsheetFilterState(initialFilter ?? BULK_SPREADSHEET_FILTER_ALL);
      }
    },
    []
  );

  const setBulkSpreadsheetFilter = useCallback((value: string) => {
    setBulkSpreadsheetFilterState(value);
  }, []);

  const removePrimaryFoldersBySessionId = useCallback((sessionId: string) => {
    setPrimaryFolders((prev) => {
      const next: ProductFolder[] = [];
      for (const f of prev) {
        if (f.bulkImportSessionId === sessionId) {
          f.images.forEach((img) => URL.revokeObjectURL(img.preview));
        } else {
          next.push(f);
        }
      }
      return next;
    });
  }, []);

  const replacePrimaryFoldersForSpreadsheetSession = useCallback((sessionId: string, folders: ProductFolder[]) => {
    setPrimaryFolders((prev) => {
      const kept: ProductFolder[] = [];
      for (const f of prev) {
        if (f.bulkImportSessionId === sessionId) {
          f.images.forEach((img) => URL.revokeObjectURL(img.preview));
        } else {
          kept.push(f);
        }
      }
      return [...kept, ...folders];
    });
  }, []);

  const addComplementaryFolder = useCallback((folder: ProductFolder) => {
    setComplementaryFolders((prev) => [...prev, folder]);
  }, []);

  const removeComplementaryFolder = useCallback((id: string) => {
    setComplementaryFolders((prev) => {
      const folder = prev.find((f) => f.id === id);
      if (folder) folder.images.forEach((img) => URL.revokeObjectURL(img.preview));
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const renameComplementaryFolder = useCallback((id: string, name: string) => {
    setComplementaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name } : f))
    );
  }, []);

  const addBulkModelImage = useCallback((img: BulkModelImage) => {
    setBulkModelImages((prev) => [...prev, img]);
  }, []);

  const removeBulkModelImage = useCallback((id: string) => {
    setBulkModelImages((prev) => {
      const removed = prev.find((m) => m.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const renameBulkModelImage = useCallback((id: string, name: string) => {
    setBulkModelImages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name } : m))
    );
  }, []);

  const addBulkBackground = useCallback((bg: BulkBackground) => {
    setBulkBackgrounds((prev) => [...prev, bg]);
  }, []);

  const removeBulkBackground = useCallback((id: string) => {
    setBulkBackgrounds((prev) => {
      const removed = prev.find((b) => b.id === id);
      if (removed?.config.inspirationImage) {
        URL.revokeObjectURL(removed.config.inspirationImage.preview);
      }
      const remaining = prev.filter((b) => b.id !== id);
      // Clean up manual mapping entries that reference the removed background
      setProductBgMap((map) => {
        const updated = { ...map };
        let changed = false;
        for (const key of Object.keys(updated)) {
          if (updated[key] === id) {
            updated[key] = remaining.length > 0 ? remaining[0].id : "";
            changed = true;
          }
        }
        return changed ? updated : map;
      });
      return remaining;
    });
  }, []);

  const updateBulkBackground = useCallback((id: string, update: Partial<BulkBackground>) => {
    setBulkBackgrounds((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...update } : b))
    );
  }, []);

  const setBulkBgAssignment = useCallback((mode: BulkBgAssignmentMode) => {
    setBulkBgAssignmentRaw((prev) => {
      if (mode === "manual" && prev !== "manual") {
        // Auto-populate productBgMap with current round-robin assignments
        const pgFolders = primaryFolders.filter((f) => f.images.length > 0);
        const bgs = bulkBackgrounds;
        if (pgFolders.length > 0 && bgs.length > 0) {
          const map: Record<string, string> = {};
          pgFolders.forEach((pg, i) => {
            map[pg.id] = bgs[i % bgs.length].id;
          });
          setProductBgMap(map);
        }
      }
      return mode;
    });
  }, [primaryFolders, bulkBackgrounds]);

  const setProductBgMapping = useCallback((productFolderId: string, backgroundId: string) => {
    setProductBgMap((prev) => ({ ...prev, [productFolderId]: backgroundId }));
  }, []);

  const updateBulkResult = useCallback((id: string, update: Partial<BulkGeneratedResult>) => {
    setBulkResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetBulkResults = useCallback(() => {
    setBulkResults([]);
  }, []);

  const updateBulkPoseOverride = useCallback(
    (productFolderId: string, poseId: string, update: Partial<Pick<BulkPoseOverride, "modelImageId" | "backgroundId" | "complementaryFolderId">>) => {
      setBulkPoseOverrides((prev) => {
        const idx = prev.findIndex(
          (o) => o.productFolderId === productFolderId && o.poseId === poseId
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...update };
          return updated;
        }
        return [...prev, { productFolderId, poseId, ...update }];
      });
    },
    []
  );

  const removeBulkPoseOverride = useCallback(
    (productFolderId: string, poseId: string) => {
      setBulkPoseOverrides((prev) =>
        prev.filter(
          (o) => !(o.productFolderId === productFolderId && o.poseId === poseId)
        )
      );
    },
    []
  );

  const clearAllBulkPoseOverrides = useCallback(() => {
    setBulkPoseOverrides([]);
  }, []);

  const clearProductBgPoseOverrides = useCallback((productFolderId: string) => {
    setBulkPoseOverrides((prev) =>
      prev.map((o) =>
        o.productFolderId === productFolderId
          ? { ...o, backgroundId: undefined }
          : o
      )
    );
  }, []);

  // --- Model Swap Actions ---

  const updateModelSwapResult = useCallback((id: string, update: Partial<ModelSwapGeneratedResult>) => {
    setModelSwapResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetModelSwapResults = useCallback(() => {
    setModelSwapResults([]);
  }, []);

  const updateModelSwapBulkResult = useCallback((id: string, update: Partial<ModelSwapBulkResult>) => {
    setModelSwapBulkResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetModelSwapBulkResults = useCallback(() => {
    setModelSwapBulkResults([]);
  }, []);

  // --- Swatch Actions ---

  const addSwatchImage = useCallback((image: SwatchImage) => {
    setSwatchImages((prev) => [...prev, image]);
  }, []);

  const removeSwatchImage = useCallback((id: string) => {
    setSwatchImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((img) => img.id !== id);
    });
    setSwatchResults((prev) => prev.filter((r) => r.sourceImageId !== id));
  }, []);

  const updateSwatchResult = useCallback((id: string, update: Partial<SwatchResult>) => {
    setSwatchResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetSwatchResults = useCallback(() => {
    setSwatchResults([]);
  }, []);

  // --- Set Product Actions ---

  const addSetProductVariant = useCallback((variant: SetVariantFolder) => {
    setSetProductVariants((prev) => [...prev, variant]);
  }, []);

  const removeSetProductVariant = useCallback((id: string) => {
    setSetProductVariants((prev) => {
      const removed = prev.find((v) => v.id === id);
      if (removed) removed.images.forEach((img) => URL.revokeObjectURL(img.preview));
      return prev.filter((v) => v.id !== id);
    });
  }, []);

  const renameSetProductVariant = useCallback((id: string, name: string) => {
    setSetProductVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, name } : v))
    );
  }, []);

  const addImageToSetVariant = useCallback((variantId: string, files: File[]) => {
    setSetProductVariants((prev) =>
      prev.map((v) => {
        if (v.id !== variantId) return v;
        const newImages = files.map((file) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
        }));
        return { ...v, images: [...v.images, ...newImages] };
      })
    );
  }, []);

  const removeImageFromSetVariant = useCallback((variantId: string, imageId: string) => {
    setSetProductVariants((prev) =>
      prev.map((v) => {
        if (v.id !== variantId) return v;
        const img = v.images.find((i) => i.id === imageId);
        if (img) URL.revokeObjectURL(img.preview);
        return { ...v, images: v.images.filter((i) => i.id !== imageId) };
      })
    );
  }, []);

  // Bulk set product folder actions
  const addSetProductFolder = useCallback((folder: SetProductFolder) => {
    setSetProductFolders((prev) => [...prev, folder]);
  }, []);

  const removeSetProductFolder = useCallback((id: string) => {
    setSetProductFolders((prev) => {
      const folder = prev.find((f) => f.id === id);
      if (folder) {
        folder.variants.forEach((v) =>
          v.images.forEach((img) => URL.revokeObjectURL(img.preview))
        );
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const updateSetProductFolderInfo = useCallback((id: string, info: string) => {
    setSetProductFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, productInfo: info } : f))
    );
  }, []);

  const removeVariantFromSetFolder = useCallback((folderId: string, variantId: string) => {
    setSetProductFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        const removed = f.variants.find((v) => v.id === variantId);
        if (removed) removed.images.forEach((img) => URL.revokeObjectURL(img.preview));
        return { ...f, variants: f.variants.filter((v) => v.id !== variantId) };
      })
    );
  }, []);

  const updateSetProductResult = useCallback((id: string, update: Partial<SetBulkResult>) => {
    setSetProductResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetSetProductResults = useCallback(() => {
    setSetProductResults([]);
  }, []);

  // --- UGC Actions ---

  const addUgcScene = useCallback((scene: UGCScene) => {
    setUgcScenes((prev) => [...prev, scene]);
  }, []);

  const removeUgcScene = useCallback((id: string) => {
    setUgcScenes((prev) => {
      const removed = prev.find((s) => s.id === id);
      if (removed) {
        removed.referenceImages.forEach((img) => URL.revokeObjectURL(img.preview));
      }
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const updateUgcScene = useCallback((id: string, update: Partial<Omit<UGCScene, "id">>) => {
    setUgcScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...update } : s))
    );
  }, []);

  const addUgcSceneImage = useCallback((sceneId: string, file: File) => {
    setUgcScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s;
        const newImg = {
          id: `ugc-img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
        };
        return { ...s, referenceImages: [...s.referenceImages, newImg] };
      })
    );
  }, []);

  const removeUgcSceneImage = useCallback((sceneId: string, imageId: string) => {
    setUgcScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s;
        const img = s.referenceImages.find((i) => i.id === imageId);
        if (img) URL.revokeObjectURL(img.preview);
        return { ...s, referenceImages: s.referenceImages.filter((i) => i.id !== imageId) };
      })
    );
  }, []);

  const updateUgcResult = useCallback((id: string, update: Partial<UGCGeneratedResult>) => {
    setUgcResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetUgcResults = useCallback(() => {
    setUgcResults([]);
  }, []);

  // --- Replicate Fast Actions ---

  const addReplicateAsset = useCallback((image: ReplicateAssetImage) => {
    setReplicateAssets((prev) => [...prev, image]);
  }, []);

  const removeReplicateAsset = useCallback((id: string) => {
    setReplicateAssets((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const setReplicateReferenceOutput = useCallback((ref: ReplicateReferenceOutput | null) => {
    setReplicateReference((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return ref;
    });
  }, []);

  const updateReplicateResult = useCallback((id: string, update: Partial<ReplicateResult>) => {
    setReplicateResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetReplicateResults = useCallback(() => {
    setReplicateResults([]);
  }, []);

  // --- Replicate Fast Bulk Actions ---

  const addReplicateSharedAsset = useCallback((image: ReplicateAssetImage) => {
    setReplicateSharedAssets((prev) => [...prev, image]);
  }, []);

  const removeReplicateSharedAsset = useCallback((id: string) => {
    setReplicateSharedAssets((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const addReplicateVariableGroup = useCallback((group: ReplicateVariableGroup) => {
    setReplicateVariableGroups((prev) => [...prev, group]);
  }, []);

  const removeReplicateVariableGroup = useCallback((id: string) => {
    setReplicateVariableGroups((prev) => {
      const group = prev.find((g) => g.id === id);
      if (group) group.images.forEach((img) => URL.revokeObjectURL(img.preview));
      return prev.filter((g) => g.id !== id);
    });
  }, []);

  const renameReplicateVariableGroup = useCallback((id: string, name: string) => {
    setReplicateVariableGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, name } : g))
    );
  }, []);

  const addImageToReplicateGroup = useCallback((groupId: string, files: File[]) => {
    setReplicateVariableGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const newImages = files.map((file) => ({
          id: `rg-img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
        }));
        return { ...g, images: [...g.images, ...newImages] };
      })
    );
  }, []);

  const removeImageFromReplicateGroup = useCallback((groupId: string, imageId: string) => {
    setReplicateVariableGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const img = g.images.find((i) => i.id === imageId);
        if (img) URL.revokeObjectURL(img.preview);
        return { ...g, images: g.images.filter((i) => i.id !== imageId) };
      })
    );
  }, []);

  const updateReplicateBulkResult = useCallback((id: string, update: Partial<ReplicateBulkResult>) => {
    setReplicateBulkResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetReplicateBulkResults = useCallback(() => {
    setReplicateBulkResults([]);
  }, []);

  // --- Product Video Actions ---
  const addVideoProductImage = useCallback((image: VideoProductImage) => {
    setVideoProductImages((prev) => [...prev, image]);
  }, []);

  const removeVideoProductImage = useCallback((id: string) => {
    setVideoProductImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const updateVideoResult = useCallback((id: string, update: Partial<VideoGeneratedResult>) => {
    setVideoResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...update } : r))
    );
  }, []);

  const resetVideoResults = useCallback(() => {
    setVideoResults([]);
  }, []);

  const addVideoPrimaryFolder = useCallback((folder: ProductFolder) => {
    setVideoPrimaryFolders((prev) => [...prev, folder]);
  }, []);

  const removeVideoPrimaryFolder = useCallback((id: string) => {
    setVideoPrimaryFolders((prev) => {
      const folder = prev.find((f) => f.id === id);
      if (folder) folder.images.forEach((img) => URL.revokeObjectURL(img.preview));
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const addImageToVideoFolder = useCallback(
    (folderId: string, image: { id: string; file: File; preview: string }) => {
      setVideoPrimaryFolders((prev) =>
        prev.map((f) =>
          f.id === folderId ? { ...f, images: [...f.images, image] } : f
        )
      );
    },
    []
  );

  const removeImageFromVideoFolder = useCallback(
    (folderId: string, imageId: string) => {
      setVideoPrimaryFolders((prev) =>
        prev.map((f) => {
          if (f.id !== folderId) return f;
          const img = f.images.find((i) => i.id === imageId);
          if (img) URL.revokeObjectURL(img.preview);
          return { ...f, images: f.images.filter((i) => i.id !== imageId) };
        })
      );
    },
    []
  );

  const renameVideoPrimaryFolder = useCallback((id: string, name: string) => {
    setVideoPrimaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name } : f))
    );
  }, []);

  const updateVideoPrimaryFolderProductInfo = useCallback((id: string, productInfo: string) => {
    setVideoPrimaryFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, productInfo } : f))
    );
  }, []);

  const addVideoBulkModelImage = useCallback((img: BulkModelImage) => {
    setVideoBulkModelImages((prev) => [...prev, img]);
  }, []);

  const removeVideoBulkModelImage = useCallback((id: string) => {
    setVideoBulkModelImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const addVideoBulkBackground = useCallback((bg: BulkBackground) => {
    setVideoBulkBackgrounds((prev) => [...prev, bg]);
  }, []);

  const removeVideoBulkBackground = useCallback((id: string) => {
    setVideoBulkBackgrounds((prev) => {
      const bg = prev.find((b) => b.id === id);
      if (bg?.config.inspirationImage) URL.revokeObjectURL(bg.config.inspirationImage.preview);
      return prev.filter((b) => b.id !== id);
    });
  }, []);

  const updateVideoBulkBackground = useCallback((id: string, config: BackgroundConfig) => {
    setVideoBulkBackgrounds((prev) =>
      prev.map((bg) => (bg.id === id ? { ...bg, config } : bg))
    );
  }, []);

  const updateVideoBulkResult = useCallback((id: string, update: Partial<VideoBulkResult>) => {
    setVideoBulkResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...update } : r))
    );
  }, []);

  const resetVideoBulkResults = useCallback(() => {
    setVideoBulkResults([]);
  }, []);

  // --- Room Staging Actions ---
  const addRoomProductImage = useCallback((image: RoomStagingProductImage) => {
    setRoomProductImages((prev) => [...prev, image]);
  }, []);

  const removeRoomProductImage = useCallback((id: string) => {
    setRoomProductImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const addRoomStylingProp = useCallback((prop: StylingPropImage) => {
    setRoomStylingProps((prev) => [...prev, prop]);
  }, []);

  const removeRoomStylingProp = useCallback((id: string) => {
    setRoomStylingProps((prev) => {
      const p = prev.find((i) => i.id === id);
      if (p) URL.revokeObjectURL(p.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const setRoomInspirationImageAction = useCallback((img: ModelImage | null) => {
    setRoomInspirationImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return img;
    });
  }, []);

  const updateRoomResult = useCallback((id: string, update: Partial<RoomStagingResult>) => {
    setRoomResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const updateRoomBulkResult = useCallback((id: string, update: Partial<RoomStagingBulkResult>) => {
    setRoomBulkResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  // --- Bulk Infographic Actions ---
  const addInfographicFolder = useCallback((folder: InfographicProductFolder) => {
    setInfographicFolders((prev) => [...prev, folder]);
  }, []);

  const removeInfographicFolder = useCallback((id: string) => {
    setInfographicFolders((prev) => {
      const folder = prev.find((f) => f.id === id);
      if (folder) folder.images.forEach((img) => URL.revokeObjectURL(img.preview));
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const renameInfographicFolder = useCallback((id: string, name: string) => {
    setInfographicFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  }, []);

  const updateInfographicFolderProductInfo = useCallback((id: string, productInfo: string) => {
    setInfographicFolders((prev) => prev.map((f) => (f.id === id ? { ...f, productInfo } : f)));
  }, []);

  // Generic per-product patch — used for the template-specific callout info boxes and the
  // fixed sole-construction layer count.
  const updateInfographicFolder = useCallback(
    (id: string, patch: Partial<InfographicProductFolder>) => {
      setInfographicFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    },
    []
  );

  const addInfographicFolderImage = useCallback(
    (folderId: string, image: { id: string; file: File; preview: string }) => {
      setInfographicFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, images: [...f.images, image] } : f))
      );
    },
    []
  );

  const removeInfographicFolderImage = useCallback((folderId: string, imageId: string) => {
    setInfographicFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        const img = f.images.find((i) => i.id === imageId);
        if (img) URL.revokeObjectURL(img.preview);
        return { ...f, images: f.images.filter((i) => i.id !== imageId) };
      })
    );
  }, []);

  const setInfographicBrandLogo = useCallback(
    (logo: { logoFile: File; logoPreview: string } | null) => {
      setInfographicBrand((prev) => {
        if (prev.logoPreview) URL.revokeObjectURL(prev.logoPreview);
        return {
          ...prev,
          logoFile: logo?.logoFile,
          logoPreview: logo?.logoPreview,
        };
      });
    },
    []
  );

  const setInfographicBrandPlacement = useCallback((logoPlacementInstructions: string) => {
    setInfographicBrand((prev) => ({ ...prev, logoPlacementInstructions }));
  }, []);

  const setInfographicTemplateCount = useCallback((template: InfographicTemplate, count: number) => {
    setInfographicTemplateCounts((prev) => ({ ...prev, [template]: Math.max(0, count) }));
  }, []);

  const updateInfographicResult = useCallback((id: string, update: Partial<InfographicResult>) => {
    setInfographicResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }, []);

  const resetInfographicResults = useCallback(() => {
    setInfographicResults([]);
  }, []);

  // Bulk folder actions
  const addRoomPrimaryFolder = useCallback((folder: ProductFolder) => {
    setRoomPrimaryFolders((prev) => [...prev, folder]);
  }, []);

  const removeRoomPrimaryFolder = useCallback((id: string) => {
    setRoomPrimaryFolders((prev) => {
      const folder = prev.find((f) => f.id === id);
      if (folder) folder.images.forEach((img) => URL.revokeObjectURL(img.preview));
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const addImageToRoomFolder = useCallback((folderId: string, images: Array<{ id: string; file: File; preview: string }>) => {
    setRoomPrimaryFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, images: [...f.images, ...images] } : f))
    );
  }, []);

  const removeImageFromRoomFolder = useCallback((folderId: string, imageId: string) => {
    setRoomPrimaryFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        const img = f.images.find((i) => i.id === imageId);
        if (img) URL.revokeObjectURL(img.preview);
        return { ...f, images: f.images.filter((i) => i.id !== imageId) };
      })
    );
  }, []);

  const renameRoomPrimaryFolder = useCallback((id: string, name: string) => {
    setRoomPrimaryFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  }, []);

  const updateRoomPrimaryFolderProductInfo = useCallback((id: string, productInfo: string) => {
    setRoomPrimaryFolders((prev) => prev.map((f) => (f.id === id ? { ...f, productInfo } : f)));
  }, []);

  const addRoomBulkRoomSetting = useCallback((setting: BulkModelImage) => {
    setRoomBulkRoomSettings((prev) => [...prev, setting]);
  }, []);

  const removeRoomBulkRoomSetting = useCallback((id: string) => {
    setRoomBulkRoomSettings((prev) => {
      const s = prev.find((i) => i.id === id);
      if (s) URL.revokeObjectURL(s.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const addRoomBulkBackground = useCallback((bg: BulkBackground) => {
    setRoomBulkBackgrounds((prev) => [...prev, bg]);
  }, []);

  const removeRoomBulkBackground = useCallback((id: string) => {
    setRoomBulkBackgrounds((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const updateRoomBulkBackground = useCallback((id: string, config: BackgroundConfig) => {
    setRoomBulkBackgrounds((prev) => prev.map((b) => (b.id === id ? { ...b, config } : b)));
  }, []);

  const resetRoomBulkResults = useCallback(() => {
    setRoomBulkResults([]);
  }, []);

  // Compute bulk combinations: one per primary product, cycling CGs, models, and backgrounds
  const bulkCombinations = useMemo((): BulkCombination[] => {
    if (mode !== "bulk") return [];
    const pgFolders = primaryFolders.filter((f) => f.images.length > 0);
    const cgFolders = complementaryFolders.filter((f) => f.images.length > 0);
    const models = bulkModelImages;
    const bgs = bulkBackgrounds;

    if (pgFolders.length === 0 || models.length === 0) return [];

    return pgFolders.map((pg, i) => {
      const cg = cgFolders.length > 0 ? cgFolders[i % cgFolders.length] : null;
      const model = models[i % models.length];
      let bg: BackgroundConfig;
      if (bulkBgAssignment === "manual" && bgs.length > 0) {
        const mappedId = productBgMap[pg.id];
        const mappedBg = mappedId ? bgs.find((b) => b.id === mappedId) : undefined;
        bg = mappedBg ? mappedBg.config : (bgs.length > 0 ? bgs[0].config : defaultBackground);
      } else {
        bg = bgs.length > 0 ? bgs[i % bgs.length].config : defaultBackground;
      }
      return {
        id: `combo-${pg.id}-${cg?.id ?? "none"}-${model.id}`,
        primaryFolder: pg,
        complementaryFolder: cg,
        modelImage: model,
        background: bg,
      };
    });
  }, [mode, primaryFolders, complementaryFolders, bulkModelImages, bulkBackgrounds, bulkBgAssignment, productBgMap]);

  // Model Swap bulk combinations: primary[i] + model[i % modelCount] + background[i % bgCount]
  const modelSwapBulkCombinations = useMemo((): ModelSwapBulkCombination[] => {
    if (mode !== "bulk" || featureMode !== "model-swap") return [];
    const pgFolders = primaryFolders.filter((f) => f.images.length > 0);
    const models = bulkModelImages;
    const bgs = bulkBackgrounds;

    if (pgFolders.length === 0 || models.length === 0) return [];

    return pgFolders.map((pg, i) => {
      const model = models[i % models.length];
      const bg = modelSwapBgMode === "new-background" && bgs.length > 0
        ? bgs[i % bgs.length].config
        : defaultBackground;
      return {
        id: `ms-combo-${pg.id}-${model.id}`,
        primaryFolder: pg,
        modelImage: model,
        background: bg,
      };
    });
  }, [mode, featureMode, primaryFolders, bulkModelImages, bulkBackgrounds, modelSwapBgMode]);

  // Set Product bulk combinations: setFolder[i] + model[i % modelCount] + background[i % bgCount]
  const setProductBulkCombinations = useMemo((): SetBulkCombination[] => {
    if (mode !== "bulk" || !setProductEnabled) return [];
    const validFolders = setProductFolders.filter(
      (f) => f.variants.length >= 2 && f.variants.every((v) => v.images.length > 0)
    );
    const models = bulkModelImages;
    const bgs = bulkBackgrounds;

    if (validFolders.length === 0 || models.length === 0) return [];

    return validFolders.map((sf, i) => {
      const model = models[i % models.length];
      const bg = bgs.length > 0 ? bgs[i % bgs.length].config : defaultBackground;
      return {
        id: `set-combo-${sf.id}-${model.id}`,
        setFolder: sf,
        modelImage: model,
        background: bg,
      };
    });
  }, [mode, setProductEnabled, setProductFolders, bulkModelImages, bulkBackgrounds]);

  // Product Video bulk combinations: primary[i] + model[i % modelCount] + background[i % bgCount]
  const videoBulkCombinations = useMemo((): VideoBulkCombination[] => {
    if (mode !== "bulk" || featureMode !== "product-video") return [];
    const pgFolders = videoPrimaryFolders.filter((f) => f.images.length > 0);
    const models = videoBulkModelImages;
    const bgs = videoBulkBackgrounds;

    if (pgFolders.length === 0) return [];

    return pgFolders.map((pg, i) => {
      const model = models.length > 0 ? models[i % models.length] : null!;
      const bg = bgs.length > 0 ? bgs[i % bgs.length].config : defaultBackground;
      return {
        id: `vid-combo-${pg.id}-${model?.id ?? "no-model"}`,
        primaryFolder: pg,
        modelImage: model,
        background: bg,
      };
    });
  }, [mode, featureMode, videoPrimaryFolders, videoBulkModelImages, videoBulkBackgrounds]);

  // Room Staging bulk combinations: primary[i] + roomSetting[i % roomCount] + background[i % bgCount]
  const roomBulkCombinations = useMemo((): RoomStagingBulkCombination[] => {
    if (mode !== "bulk" || featureMode !== "room-staging") return [];
    const pgFolders = roomPrimaryFolders.filter((f) => f.images.length > 0);
    const rooms = roomBulkRoomSettings;
    const bgs = roomBulkBackgrounds;

    if (pgFolders.length === 0) return [];

    return pgFolders.map((pg, i) => {
      const room = rooms.length > 0 ? rooms[i % rooms.length] : null!;
      const bg = bgs.length > 0 ? bgs[i % bgs.length].config : defaultBackground;
      return {
        id: `room-combo-${pg.id}-${room?.id ?? "no-room"}`,
        primaryFolder: pg,
        roomSetting: room,
        background: bg,
      };
    });
  }, [mode, featureMode, roomPrimaryFolders, roomBulkRoomSettings, roomBulkBackgrounds]);

  const hasModel = selectedModel !== null || modelImage !== null;

  const canProceedToStep = useCallback(
    (step: WizardStep): boolean => {
      // --- BULK INFOGRAPHIC MODE ---
      if (featureMode === "infographic") {
        const hasProducts = infographicFolders.some((f) => f.images.length > 0);
        const hasTemplate = Object.values(infographicTemplateCounts).some((n) => n > 0);
        switch (step) {
          case 1: return true;
          case 2: return hasProducts;            // Background
          case 3: return hasProducts;            // Template & Output
          case 4: return hasProducts && hasTemplate; // Generate
          default: return false;
        }
      }

      // --- EDIT IMAGE MODE ---
      if (featureMode === "edit-image") {
        const hasValidPairs = editImageSubfolders.some(
          (s) =>
            !s.unmatched &&
            s.aiImages.length > 0 &&
            s.productImages.length > 0 &&
            !!s.productOfInterest
        );
        const hasInstructions = editImageVariationInstructions.trim() !== "";
        switch (step) {
          case 1: return true;                                          // Upload & Pair
          case 2: return hasValidPairs;                                 // Edit Type
          case 3: return hasValidPairs && editType === "variation";     // Variation
          case 4: return hasValidPairs && editType === "variation" && hasInstructions; // Review
          default: return false;
        }
      }

      // --- AI MODEL CREATION MODE ---
      if (featureMode === "model-creation") {
        if (modelCreationMode === "edit") {
          const hasSources = modelEditSources.length > 0;
          const hasDirective = modelEditDirective.trim() !== "";
          switch (step) {
            case 1: return true;                       // Upload
            case 2: return hasSources;                 // Edit directive
            case 3: return hasSources && hasDirective; // Generate
            default: return false;
          }
        }
        const hasReadyBoxes = modelBoxes.some(
          (b) => b.name.trim() !== "" || b.description.trim() !== "" || !!b.referenceImage
        );
        switch (step) {
          case 1: return true;          // Casting
          case 2: return true;          // Models (boxes are added on this step)
          case 3: return hasReadyBoxes; // Generate
          default: return false;
        }
      }

      // --- SWATCH MODE ---
      if (featureMode === "swatch") {
        switch (step) {
          case 1: return true;
          case 2: return swatchImages.length > 0;
          case 3: return swatchImages.length > 0;
          default: return false;
        }
      }

      // --- REPLICATE FAST MODE ---
      if (featureMode === "replicate") {
        if (mode === "bulk") {
          const hasGroups = replicateVariableGroups.some((g) => g.images.length > 0);
          const hasRef = replicateReference !== null;
          switch (step) {
            case 1: return true;
            case 2: return hasGroups && hasRef;
            case 3: return hasGroups && hasRef;
            default: return false;
          }
        }
        switch (step) {
          case 1: return true;
          case 2: return replicateAssets.length > 0 && replicateReference !== null;
          case 3: return replicateAssets.length > 0 && replicateReference !== null;
          default: return false;
        }
      }

      // --- PRODUCT VIDEO MODE ---
      if (featureMode === "product-video") {
        if (mode === "bulk") {
          const hasPG = videoPrimaryFolders.some((f) => f.images.length > 0);
          switch (step) {
            case 1: return true;
            case 2: return hasPG;
            case 3: return hasPG;
            case 4: return hasPG;
            default: return false;
          }
        }
        switch (step) {
          case 1: return true;
          case 2: return videoProductImages.length > 0;
          case 3: return videoProductImages.length > 0;
          case 4: return videoProductImages.length > 0;
          default: return false;
        }
      }

      // --- ROOM STAGING MODE ---
      if (featureMode === "room-staging") {
        const hasRoomSelection = roomSelectedRoomStyle !== null || roomInspirationImage !== null;
        if (mode === "bulk") {
          const hasPG = roomPrimaryFolders.some((f) => f.images.length > 0);
          const hasRooms = roomBulkRoomSettings.length > 0;
          switch (step) {
            case 1: return true;
            case 2: return hasPG;
            case 3: return hasPG && hasRooms;
            case 4: return hasPG && roomSelectedShots.length > 0;
            case 5: return hasPG && roomSelectedShots.length > 0;
            default: return false;
          }
        }
        const anyNeedsRoom = roomSelectedShots.some((s) => s.requiresRoom);
        switch (step) {
          case 1: return true;
          case 2: return roomProductImages.length > 0;
          case 3: return roomProductImages.length > 0 && (!anyNeedsRoom || hasRoomSelection);
          case 4: return roomProductImages.length > 0 && roomSelectedShots.length > 0;
          case 5: return roomProductImages.length > 0 && roomSelectedShots.length > 0;
          default: return false;
        }
      }

      // --- MODEL SWAP MODE ---
      if (featureMode === "model-swap") {
        if (mode === "bulk") {
          const hasPG = primaryFolders.some((f) => f.images.length > 0);
          const hasModels = bulkModelImages.length > 0;
          switch (step) {
            case 1: return true;
            case 2: return hasPG;
            case 3: return hasPG && hasModels;
            case 4: return hasPG && hasModels; // aspect ratio has default, always ok
            case 5: return hasPG && hasModels;
            default: return false;
          }
        }
        // Single model swap
        const hasModelSelection = selectedModel !== null || modelImage !== null;
        switch (step) {
          case 1: return true;
          case 2: return garmentImages.length > 0;
          case 3: return garmentImages.length > 0 && hasModelSelection;
          case 4: return garmentImages.length > 0 && hasModelSelection; // aspect ratio has default
          case 5: return garmentImages.length > 0 && hasModelSelection;
          default: return false;
        }
      }

      // --- VTON MODE ---
      if (mode === "bulk") {
        // Set product bulk mode
        if (setProductEnabled) {
          const hasValidSets = setProductFolders.some(
            (f) => f.variants.length >= 2 && f.variants.every((v) => v.images.length > 0)
          );
          const hasModels = bulkModelImages.length > 0;
          switch (step) {
            case 1: return true;
            case 2: return hasValidSets;
            case 3: return hasValidSets && hasModels;
            case 4: return hasValidSets && hasModels;
            case 5: return hasValidSets && hasModels;
            default: return false;
          }
        }
        const hasPG = primaryFolders.some((f) => f.images.length > 0);
        const hasModels = bulkModelImages.length > 0;
        const hasPoses = selectedPoses.length > 0 || customPoses.length > 0 || ugcScenes.length > 0;
        switch (step) {
          case 1:
            return true;
          case 2:
            return hasPG;
          case 3:
            return hasPG && hasModels;
          case 4:
            return hasPG && hasModels && hasPoses;
          case 5:
            return hasPG && hasModels && hasPoses;
          default:
            return false;
        }
      }
      // Single mode
      const hasModelSelection = selectedModel !== null || modelImage !== null;
      const isFootwear = productCategory === "footwear";

      // Set product single mode
      if (setProductEnabled) {
        const hasValidVariants = setProductVariants.length >= 2 &&
          setProductVariants.every((v) => v.images.length > 0);
        switch (step) {
          case 1: return true;
          case 2: return hasValidVariants;
          case 3: return hasValidVariants && hasModelSelection;
          case 4: return hasValidVariants && hasModelSelection;
          case 5: return hasValidVariants && hasModelSelection;
          default: return false;
        }
      }

      const anyPresetPoseNeedsModel = selectedPoses.some((p) => p.requiresModel !== false);
      const anyCustomPoseNeedsModel = customPoses.some((cp) => cp.isModelShot);
      const anyPoseNeedsModel = anyPresetPoseNeedsModel || anyCustomPoseNeedsModel;
      const hasPoses = selectedPoses.length > 0 || customPoses.length > 0 || ugcScenes.length > 0;

      switch (step) {
        case 1:
          return true;
        case 2:
          return garmentImages.length > 0;
        case 3:
          return garmentImages.length > 0 && (!anyPoseNeedsModel || hasModelSelection || isFootwear);
        case 4:
          return (
            garmentImages.length > 0 &&
            hasPoses &&
            (!anyPoseNeedsModel || hasModelSelection)
          );
        case 5:
          return (
            garmentImages.length > 0 &&
            hasPoses &&
            (!anyPoseNeedsModel || hasModelSelection) &&
            apiKey.length > 0
          );
        default:
          return false;
      }
    },
    [featureMode, mode, productCategory, garmentImages, selectedModel, modelImage, selectedPoses, customPoses, ugcScenes, primaryFolders, bulkModelImages, swatchImages, setProductEnabled, setProductVariants, setProductFolders, replicateAssets, replicateReference, replicateVariableGroups, videoProductImages, videoPrimaryFolders, roomProductImages, roomPrimaryFolders, roomSelectedShots, roomSelectedRoomStyle, roomInspirationImage, roomBulkRoomSettings, infographicFolders, infographicTemplateCounts, modelBoxes, modelCreationMode, modelEditSources, modelEditDirective, editImageSubfolders, editImageVariationInstructions, editType]
  );

  return {
    // Mode
    mode,
    setMode,
    featureMode,
    setFeatureMode,
    // Navigation
    currentStep,
    setCurrentStep,
    // Product Category
    productCategory,
    setProductCategory,
    // Single mode
    gender,
    setGender,
    garmentImages,
    garmentType,
    setGarmentType,
    footwearType,
    setFootwearType,
    fit,
    setFit,
    sleeveLength,
    setSleeveLength,
    topwearLength,
    setTopwearLength,
    bottomwearLength,
    setBottomwearLength,
    addGarmentImage,
    removeGarmentImage,
    toggleGarmentBackView,
    setGarmentImageFootwearSide,
    setGarmentImagePoseVariation,
    complementaryImages,
    addComplementaryImage,
    removeComplementaryImage,
    poseAccessories,
    toggleAccessory,
    setAccessoryImage,
    removeAccessoryImage,
    addCustomAccessory,
    updateCustomAccessoryDescription,
    removeCustomAccessory,
    setCustomAccessoryImage,
    removeCustomAccessoryImage,
    applyAccessoriesToAllPoses,
    setApplyAccessoriesToAllPoses,
    // Prop Buckets
    propBuckets,
    createPropBucket,
    renamePropBucket,
    setPropBucketCategory,
    addPropBucketImages,
    removePropBucketImage,
    deletePropBucket,
    togglePoseBucket,
    background,
    setBackground,
    selectedModel,
    setSelectedModel,
    modelImage,
    setModelImage,
    aspectRatio,
    setAspectRatio,
    imageQuality,
    setImageQuality,
    imageGenModel,
    setImageGenModel,
    textGenModel,
    setTextGenModel,
    googleBackend,
    setGoogleBackend,
    selectedPoses,
    togglePose,
    movePoseInSequence,
    namingLogic,
    setNamingLogic,
    singleDownloadPrefix,
    setSingleDownloadPrefix,
    skipNamingIndicesText,
    setSkipNamingIndicesText,
    skipValidation,
    setSkipValidation,
    customPoses,
    addCustomPose,
    removeCustomPose,
    updateCustomPose,
    addCustomPoseImage,
    removeCustomPoseImage,
    additionalInfo,
    setAdditionalInfo,
    productInfo,
    setProductInfo,
    apiKey,
    setApiKey,
    results,
    setResults,
    updateResult,
    resetResults,
    hasModel,
    isGenerating,
    setIsGenerating,
    isIngestingScene,
    setIsIngestingScene,
    beginGeneration,
    cancelGeneration,
    generationAbortControllerRef,
    canProceedToStep,
    // Bulk mode
    primaryFolders,
    addPrimaryFolder,
    removePrimaryFolder,
    addImageToFolder,
    removeImageFromFolder,
    toggleFolderImageBackView,
    setFolderImageFootwearSide,
    renamePrimaryFolder,
    updatePrimaryFolderProductInfo,
    updatePrimaryFolderFit,
    updatePrimaryFolderSleeveLength,
    updatePrimaryFolderTopwearLength,
    updatePrimaryFolderBottomwearLength,
    setProductFolderPoseVariation,
    bulkSpreadsheetSession,
    setBulkSpreadsheetSession,
    bulkSpreadsheetFilter,
    setBulkSpreadsheetFilter,
    removePrimaryFoldersBySessionId,
    replacePrimaryFoldersForSpreadsheetSession,
    complementaryFolders,
    addComplementaryFolder,
    removeComplementaryFolder,
    renameComplementaryFolder,
    bulkModelImages,
    addBulkModelImage,
    removeBulkModelImage,
    renameBulkModelImage,
    bulkBackgrounds,
    addBulkBackground,
    removeBulkBackground,
    updateBulkBackground,
    bulkBgAssignment,
    setBulkBgAssignment,
    productBgMap,
    setProductBgMapping,
    bulkCombinations,
    bulkResults,
    setBulkResults,
    updateBulkResult,
    resetBulkResults,
    bulkPoseOverrides,
    updateBulkPoseOverride,
    removeBulkPoseOverride,
    clearAllBulkPoseOverrides,
    clearProductBgPoseOverrides,
    // Model Swap
    modelSwapBgMode,
    setModelSwapBgMode,
    modelSwapResults,
    setModelSwapResults,
    updateModelSwapResult,
    resetModelSwapResults,
    modelSwapBulkResults,
    setModelSwapBulkResults,
    updateModelSwapBulkResult,
    resetModelSwapBulkResults,
    modelSwapBulkCombinations,
    // Swatch
    swatchImages,
    addSwatchImage,
    removeSwatchImage,
    swatchShape,
    setSwatchShape,
    swatchSize,
    setSwatchSize,
    swatchResults,
    setSwatchResults,
    updateSwatchResult,
    resetSwatchResults,
    isSwatchGenerating,
    setIsSwatchGenerating,
    // Set Product
    setProductEnabled,
    setSetProductEnabled,
    setProductLayout,
    setSetProductLayout,
    setProductVariants,
    setSetProductVariants,
    addSetProductVariant,
    removeSetProductVariant,
    renameSetProductVariant,
    addImageToSetVariant,
    removeImageFromSetVariant,
    setProductFolders,
    setSetProductFolders,
    addSetProductFolder,
    removeSetProductFolder,
    updateSetProductFolderInfo,
    removeVariantFromSetFolder,
    setProductBulkCombinations,
    setProductResults,
    setSetProductResults,
    updateSetProductResult,
    resetSetProductResults,
    // UGC
    ugcScenes,
    addUgcScene,
    removeUgcScene,
    updateUgcScene,
    addUgcSceneImage,
    removeUgcSceneImage,
    ugcResults,
    setUgcResults,
    updateUgcResult,
    resetUgcResults,
    // Replicate Fast
    replicateAssets,
    addReplicateAsset,
    removeReplicateAsset,
    replicateReference,
    setReplicateReferenceOutput,
    replicateAdditionalInfo,
    setReplicateAdditionalInfo,
    replicateResults,
    setReplicateResults,
    updateReplicateResult,
    resetReplicateResults,
    isReplicateGenerating,
    setIsReplicateGenerating,
    // Replicate Fast Bulk
    replicateSharedAssets,
    addReplicateSharedAsset,
    removeReplicateSharedAsset,
    replicateVariableGroups,
    addReplicateVariableGroup,
    removeReplicateVariableGroup,
    renameReplicateVariableGroup,
    addImageToReplicateGroup,
    removeImageFromReplicateGroup,
    replicateBulkResults,
    setReplicateBulkResults,
    updateReplicateBulkResult,
    resetReplicateBulkResults,
    // Product Video
    videoProductCategory,
    setVideoProductCategory,
    videoGender,
    setVideoGender,
    videoProductImages,
    addVideoProductImage,
    removeVideoProductImage,
    videoProductInfo,
    setVideoProductInfo,
    videoTheme,
    setVideoTheme,
    videoCameraMovements,
    setVideoCameraMovements,
    videoModelMovements,
    setVideoModelMovements,
    videoBackground,
    setVideoBackground,
    videoSelectedModel,
    setVideoSelectedModel,
    videoModelImage,
    setVideoModelImage,
    videoAspectRatio,
    setVideoAspectRatio,
    videoVeoModel,
    setVideoVeoModel,
    videoResolution,
    setVideoResolution,
    videoDuration,
    setVideoDuration,
    videoNumberOfResults,
    setVideoNumberOfResults,
    videoGenerateAudio,
    setVideoGenerateAudio,
    videoNegativePrompt,
    setVideoNegativePrompt,
    videoAdditionalInfo,
    setVideoAdditionalInfo,
    videoResults,
    setVideoResults,
    updateVideoResult,
    resetVideoResults,
    isVideoGenerating,
    setIsVideoGenerating,
    // Product Video Bulk
    videoPrimaryFolders,
    addVideoPrimaryFolder,
    removeVideoPrimaryFolder,
    addImageToVideoFolder,
    removeImageFromVideoFolder,
    renameVideoPrimaryFolder,
    updateVideoPrimaryFolderProductInfo,
    videoBulkModelImages,
    addVideoBulkModelImage,
    removeVideoBulkModelImage,
    videoBulkBackgrounds,
    addVideoBulkBackground,
    removeVideoBulkBackground,
    updateVideoBulkBackground,
    videoBulkCombinations,
    videoBulkResults,
    setVideoBulkResults,
    updateVideoBulkResult,
    resetVideoBulkResults,

    // Room Staging
    roomStagingCategory, setRoomStagingCategory,
    roomHomeDecorType, setRoomHomeDecorType,
    roomHomeDecorSubType, setRoomHomeDecorSubType,
    roomFurnitureType, setRoomFurnitureType,
    roomFurnitureSubType, setRoomFurnitureSubType,
    roomProductShape, setRoomProductShape,
    roomProductDimensions, setRoomProductDimensions,
    roomProductImages, setRoomProductImages,
    addRoomProductImage, removeRoomProductImage,
    roomProductInfo, setRoomProductInfo,
    roomStylingProps, setStylingProps: setRoomStylingProps,
    addRoomStylingProp, removeRoomStylingProp,
    roomSelectedRoomStyle, setRoomSelectedRoomStyle,
    roomInspirationImage, setRoomInspirationImage: setRoomInspirationImageAction,
    roomDescription, setRoomDescription,
    roomBackground, setRoomBackground,
    roomSelectedShots, setRoomSelectedShots,
    roomAspectRatio, setRoomAspectRatio,
    roomImageQuality, setRoomImageQuality,
    roomAdditionalInfo, setRoomAdditionalInfo,
    roomResults, setRoomResults,
    updateRoomResult,
    isRoomStagingGenerating, setIsRoomStagingGenerating,
    roomPrimaryFolders, setRoomPrimaryFolders,
    addRoomPrimaryFolder, removeRoomPrimaryFolder,
    addImageToRoomFolder, removeImageFromRoomFolder,
    renameRoomPrimaryFolder, updateRoomPrimaryFolderProductInfo,
    roomBulkRoomSettings,
    addRoomBulkRoomSetting, removeRoomBulkRoomSetting,
    roomBulkBackgrounds,
    addRoomBulkBackground, removeRoomBulkBackground, updateRoomBulkBackground,
    roomBulkCombinations,
    roomBulkResults, setRoomBulkResults,
    updateRoomBulkResult, resetRoomBulkResults,

    // Bulk Infographic
    infographicCategory, setInfographicCategory,
    infographicFolders, setInfographicFolders,
    addInfographicFolder, removeInfographicFolder,
    renameInfographicFolder, updateInfographicFolderProductInfo, updateInfographicFolder,
    addInfographicFolderImage, removeInfographicFolderImage,
    infographicBrand, setInfographicBrand,
    setInfographicBrandLogo, setInfographicBrandPlacement,
    infographicBackgroundStyle, setInfographicBackgroundStyle,
    infographicTemplateCounts, setInfographicTemplateCounts,
    setInfographicTemplateCount,
    infographicAspectRatio, setInfographicAspectRatio,
    infographicImageSize, setInfographicImageSize,
    infographicStylingInstructions, setInfographicStylingInstructions,
    infographicResults, setInfographicResults,
    updateInfographicResult, resetInfographicResults,
    isInfographicGenerating, setIsInfographicGenerating,
    // AI Model Creation
    modelGender, setModelGender,
    modelAgeRange, setModelAgeRange,
    modelBodyType, setModelBodyType,
    modelEthnicity, setModelEthnicity,
    modelBrandName, setModelBrandName,
    modelBrandDirectives, setModelBrandDirectives,
    modelBrandStatus, setModelBrandStatus,
    modelGuidelines, setModelGuidelines,
    modelBoxes, addModelBox, updateModelBox, removeModelBox, setModelBoxReferenceImage,
    modelCreationResults, setModelCreationResults, updateModelCreationResult, resetModelCreationResults,
    savedModels, setSavedModels,
    isModelCreationGenerating, setIsModelCreationGenerating,
    // AI Model Editing (sub-mode)
    modelCreationMode, setModelCreationMode,
    modelEditSources, addModelEditSources, removeModelEditSource,
    modelEditDirective, setModelEditDirective,
    modelEditReferenceDirective, setModelEditReferenceDirective,
    modelEditReference, setModelEditReference,
    modelEditResults, setModelEditResults, updateModelEditResult, resetModelEditResults,
    isModelEditGenerating, setIsModelEditGenerating,

    // --- Edit Image ---
    editImageSubfolders, setEditImageSubfolders, updateEditImageSubfolder, removeEditImageSubfolder, removeEditImageAsset,
    editType, setEditType,
    editImageVariationInstructions, setEditImageVariationInstructions,
    editImageReferenceImages, addEditImageReferenceImages, removeEditImageReferenceImage,
    editImageResults, setEditImageResults, updateEditImageResult, resetEditImageResults,
    isEditImageGenerating, setIsEditImageGenerating,
  };
}

export type VTONStore = ReturnType<typeof useVTONStore>;
