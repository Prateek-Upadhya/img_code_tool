export type ProductCategory = "clothing" | "footwear";

/**
 * Backend used to generate the final VTON image.
 * - `gemini`: Nano Banana 2 (gemini-3.1-flash-image-preview). Default for everything.
 * - `gpt-image-2`: Azure OpenAI gpt-image-2. Currently exposed only for Footwear VTON.
 */
export type ImageGenModel = "gemini" | "gpt-image-2";

/**
 * Provider used to generate prompts / run analysis stages (text in, text out).
 * - `gemini`: Vertex AI gemini-3.1-pro-preview. Default meta-prompter.
 * - `gpt-5.4-pro`: Azure OpenAI gpt-5.4-pro (Responses API). Redundant provider.
 */
export type TextGenModel = "gemini" | "gpt-5.4-pro";

export type Gender = "male" | "female" | "unisex";

export type GarmentType = "topwear" | "bottomwear" | "onepiece";

export type FootwearType =
  | "casual-shoes"
  | "formal-shoes"
  | "sneakers"
  | "boots"
  | "sandals"
  | "loafers"
  | "heels"
  | "sports-shoes"
  | "slippers";

export type FitType =
  | "slim"
  | "regular"
  | "relaxed"
  | "oversized"
  | "tailored"
  | "loose"
  | "bodycon"
  | "boxy";

/**
 * Sleeve length for TOPWEAR / ONEPIECE garments. `null` = AI auto-detect from images (default).
 * Authoritative when set — overrides any AI inference from the reference photos.
 */
export type SleeveLength =
  | "full"          // Full sleeve — extends to the wrist
  | "three-quarter" // 3/4 sleeve — ends mid-forearm, between elbow and wrist
  | "half"          // Half sleeve — short sleeve ending around mid-bicep
  | "sleeveless";   // No sleeve — bare shoulder/arm

/**
 * Body / hemline length for TOPWEAR (and the upper portion of ONEPIECE).
 * Describes how far down the body the top extends. `null` = AI auto-detect (default).
 */
export type TopwearLength =
  | "full"          // Full length — hem reaches the shin (tunic / kurta / maxi-top)
  | "three-quarter" // 3/4 length — hem reaches around the knee
  | "mid-thigh"     // Mid-thigh length — hem ends mid-thigh (long shirt / longline)
  | "half";         // Half / waist length — hem ends at the natural waist (regular crop)

/**
 * Outseam length for BOTTOMWEAR garments (and the lower portion of ONEPIECE / jumpsuit).
 * Describes how far down the leg the bottomwear extends. `null` = AI auto-detect (default).
 */
export type BottomwearLength =
  | "full"           // Full length — hem reaches the ankle (regular pants / trousers / jeans)
  | "three-quarter"  // 3/4 length — hem ends below the knee / mid-calf (capri / cropped pants)
  | "shorts";        // Shorts — hem ends at or above mid-thigh

export type FootwearSide = "medial" | "lateral" | "sole";

export interface GarmentImage {
  id: string;
  file: File;
  preview: string;
  type: GarmentType | FootwearType;
  /** When true, this image shows the back view of the garment */
  isBackView?: boolean;
  /** For footwear: which side of the shoe this image represents */
  footwearSide?: FootwearSide;
  /**
   * Model Swap only. When true, allow subtle pose variation (gaze, hand position,
   * stance) while preserving image framing and body orientation. When false / undefined,
   * the new model must adopt the EXACT same pose as the source image. Default: false.
   */
  poseVariation?: boolean;
}

export interface ComplementaryImage {
  id: string;
  file: File;
  preview: string;
  label: string;
}

// --- Accessory Types ---

export type AccessoryCategory =
  | "necklace"
  | "watch"
  | "pendant"
  | "earrings"
  | "shoes"
  | "bracelet"
  | "belt"
  | "sunglasses"
  | "hat"
  | "scarf"
  | "ring"
  | "handbag"
  | "tie"
  | "brooch"
  | "cufflinks"
  | "anklet"
  | "hair-accessory"
  | "clutch"
  | "custom";

export interface AccessoryItem {
  id: string;
  category: AccessoryCategory;
  /** If no image is uploaded, AI will choose the best matching accessory */
  image?: {
    file: File;
    preview: string;
  };
  /** Free-text description for custom accessories (category === "custom") */
  customDescription?: string;
  /**
   * Pose-level reference to a {@link PropBucket}. When set, this accessory is a
   * placeholder for "draw one image from this bucket". `image` stays UNDEFINED
   * in store state and is materialized at generation time (see
   * `materializeAccessories` in `step-generate.tsx`): one image is drawn from
   * the bucket and the draw is held fixed per product so every pose of that
   * product reuses the same pick, while different products draw independently.
   */
  bucketId?: string;
}

/**
 * A named, user-created collection of interchangeable prop / accessory reference
 * images (e.g. a "Footwear" bucket holding 5 shoe images, or a "Sunglasses"
 * bucket holding 5 eyewear images). Each bucket surfaces as a selectable option
 * under every model-shot pose. When a pose enables a bucket, ONE image is drawn
 * at random from `images` at generation time — fixed per product, independent
 * across products — and applied via the existing accessory image plumbing.
 */
export interface PropBucket {
  id: string;
  name: string;
  /**
   * Which accessory category the drawn image represents (so the meta-prompter
   * frames it correctly). `"custom"` for a free-form prop with no fixed category.
   */
  category: AccessoryCategory | "custom";
  images: { file: File; preview: string }[];
}

export type BackgroundMode = "inspiration" | "text";

/**
 * Controls how an uploaded background `inspirationImage` is consumed by the VTON pipeline.
 * - `"inspiration"` (default when undefined): the image is analyzed once per batch by
 *   `analyzeBackgroundScene`, yielding a product-agnostic frozen scene + flat-lighting
 *   override; the image itself is NEVER attached to the Nano Banana image-gen call.
 * - `"replica"`: scene analysis is skipped. The image is attached directly to
 *   `gemini-3.1-flash-image-preview` (and to the meta-prompter) with an exact-replication
 *   directive so the generated output preserves the reference background pixel-for-pixel.
 *
 * Only meaningful when `mode === "inspiration"` AND `inspirationImage` is set.
 */
export type BackgroundImageMode = "inspiration" | "replica";

export interface BackgroundConfig {
  mode: BackgroundMode;
  inspirationImage?: {
    file: File;
    preview: string;
  };
  /** See {@link BackgroundImageMode}. `undefined` is treated as `"inspiration"`. */
  imageReferenceMode?: BackgroundImageMode;
  textDescription: string;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  ethnicity: string;
  gender: "male" | "female";
  thumbnail: string;
}

export interface ModelImage {
  file: File;
  preview: string;
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9";

export type PoseViewAngle = "front" | "side" | "back" | "three-quarter-front" | "three-quarter-back" | "top-down" | "bottom" | "ghost";

export type PoseFraming =
  | "full-body"       // Head to toe, complete model visible
  | "three-quarter"   // Head to below-knee, ~75% of body
  | "mid-thigh"       // Head to mid-thigh, "cowboy shot"
  | "waist-up"        // Head to waist/hip area
  | "bust-up"         // Head to mid-chest, close-up detail
  | "hip-down"        // Hip/waist to feet, lower body focus
  | "knee-down"       // Knee to feet, hemline and footwear detail
  | "waist-to-thigh"  // Just above waistband to just above knee — bottomwear detail close-up
  | "cropped-shot"    // Below chest to just below knee — e-commerce bottomwear crop (abdomen, waist, thigh, knee visible; head/chest/feet out of frame)
  | "product-only"    // Just the product, no human model
  | "feet-closeup"    // Close-up of feet wearing footwear
  | "ghost-mannequin";// Garment shaped as if worn, no visible model (invisible mannequin)

export interface Pose {
  id: string;
  name: string;
  description: string;
  icon: string;
  viewAngle: PoseViewAngle;
  framing: PoseFraming;
  garmentRelevance: (GarmentType | FootwearType)[];
  requiresModel?: boolean; // defaults to true; false for product-only shots
  /**
   * Pose generation flavour. Absence (or `"standard"`) means a fixed, canonical
   * pose described verbatim by `description`. `"dynamic"` means the orientation
   * (`viewAngle`) and framing (`framing`) stay LOCKED, but the actual posture —
   * weight shift, gaze, head tilt, arm/hand & leg placement, micro-mood — is
   * freshly re-randomised on every generation and every retry via a per-call
   * VARIATION SEED (see `buildDynamicPoseSeed` + the `DYNAMIC_POSE_DIRECTIVE`).
   */
  poseType?: "standard" | "dynamic";
}

export type CustomPoseReferenceMode = "pose" | "image";

export interface CustomPose {
  id: string;
  name: string;
  description: string;
  /** true = Model Shot (human model included), false = Product Shot (product only, no model) */
  isModelShot: boolean;
  /**
   * Controls how attached reference images are interpreted by the AI:
   * - "pose" (default): images are STRICT pose references — only body geometry, camera angle, and image framing are extracted; background, accessories, model identity, garments/footwear, and other product-specific elements are ignored
   * - "image": images are HOLISTIC inspirational references — pose, scene, lighting, mood, and an adapted color palette are extracted in a product-agnostic manner; the background palette is intentionally tuned to contrast with and highlight the user's product
   */
  referenceMode?: CustomPoseReferenceMode;
  /** Optional per-pose background/environment description that overrides the global background */
  customBackground?: string;
  referenceImages: {
    id: string;
    file: File;
    preview: string;
  }[];
}

export interface VTONConfig {
  productCategory: ProductCategory;
  gender: Gender;
  garmentImages: GarmentImage[];
  garmentType: GarmentType;
  footwearType: FootwearType;
  fit: FitType | null;
  /** Sleeve length override (topwear/onepiece). `null` = AI auto-detect. */
  sleeveLength: SleeveLength | null;
  /** Body length override for topwear / upper portion of onepiece. `null` = AI auto-detect. */
  topwearLength: TopwearLength | null;
  /** Outseam length override for bottomwear / lower portion of onepiece. `null` = AI auto-detect. */
  bottomwearLength: BottomwearLength | null;
  complementaryImages: ComplementaryImage[];
  /** Accessories keyed by pose ID — each pose can have its own set of accessories */
  poseAccessories: Record<string, AccessoryItem[]>;
  background: BackgroundConfig;
  selectedModel: AIModel | null;
  modelImage: ModelImage | null;
  aspectRatio: AspectRatio;
  selectedPoses: Pose[];
  additionalInfo: string;
  productInfo: string;
  apiKey: string;
}

export type ValidationStatus = "idle" | "validating" | "passed" | "warning" | "error";

export interface ValidationResult {
  status: ValidationStatus;
  message?: string;
}

// --- Multi-Turn Edit Types ---

export interface EditHistoryEntry {
  userInstruction: string;
  /** Full Content object from Gemini response — includes thought_signature fields needed for multi-turn */
  modelResponseContent: unknown;
}

export interface GeneratedResult {
  id: string;
  prompt: string;
  imageData: string; // base64
  pose: Pose;
  /** Set when this result was generated from a custom pose instead of a preset */
  customPose?: CustomPose;
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "editing" | "completed" | "cancelled" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  /** Saved infographic image data URLs (manual canvas export and/or AI-generated) */
  infographicImages?: string[];
  /** Model's response Content from initial image generation (needed for multi-turn editing context) */
  imageGenResponseContent?: unknown;
  /** History of multi-turn edit exchanges for iterative refinement */
  editHistory?: EditHistoryEntry[];
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export type AppMode = "single" | "bulk";

export type FeatureMode = "vton" | "model-swap" | "swatch" | "replicate" | "product-video" | "room-staging" | "infographic";

export type NamingLogic = "folder-name-sequential" | "folder-name-sequential-1";

// --- Swatch Types ---

export interface SwatchImage {
  id: string;
  file: File;
  preview: string;
  name: string;
}

export type SwatchShape = "square" | "circle" | "rounded";

export interface SwatchResult {
  id: string;
  sourceImageId: string;
  sourceImageName: string;
  sourceImagePreview: string;
  swatchDataUrl: string;
  dominantColors: string[];
  patternDescription: string;
  status: "pending" | "generating" | "completed" | "error";
  error?: string;
}

export type ModelSwapBackgroundMode = "keep-same" | "new-background";

// --- Set Product Types ---

export type SetLayoutStyle = "side-by-side" | "overlapping" | "staggered";

export interface SetVariantFolder {
  id: string;
  name: string;
  images: Array<{
    id: string;
    file: File;
    preview: string;
  }>;
}

export interface SetProductFolder {
  id: string;
  name: string;
  variants: SetVariantFolder[];
  productInfo?: string;
}

export interface SetBulkCombination {
  id: string;
  setFolder: SetProductFolder;
  modelImage: BulkModelImage;
  background: BackgroundConfig;
}

export interface SetBulkResult {
  id: string;
  combinationId: string;
  combinationLabel: string;
  setFolderName: string;
  prompt: string;
  imageData: string;
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "completed" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  infographicImages?: string[];
}

// --- Bulk Mode Types ---

export interface ProductFolder {
  id: string;
  name: string;
  images: Array<{
    id: string;
    file: File;
    preview: string;
    /** When true, this image shows the back view of the garment */
    isBackView?: boolean;
    /** For footwear: which side of the shoe this image represents */
    footwearSide?: FootwearSide;
  }>;
  productInfo?: string;
  /** Per-product fit override; when undefined, the global fit selection is used */
  fit?: FitType | null;
  /** Per-product sleeve length override (topwear/onepiece); undefined = inherit global */
  sleeveLength?: SleeveLength | null;
  /** Per-product top hemline length override (topwear/onepiece); undefined = inherit global */
  topwearLength?: TopwearLength | null;
  /** Per-product bottomwear outseam length override (bottomwear/onepiece); undefined = inherit global */
  bottomwearLength?: BottomwearLength | null;
  /** Present when this folder was created from CSV/XLSX bulk import; used to replace on filter change */
  bulkImportSessionId?: string;
  /**
   * Model Swap only. When true, allow subtle pose variation (gaze, hand position,
   * stance) for every image in this folder while preserving image framing and body
   * orientation. When false / undefined, the new model must adopt the EXACT same pose
   * as each source image. Default: false.
   */
  poseVariation?: boolean;
}

/** Sentinel value for spreadsheet filter: include all rows */
export const BULK_SPREADSHEET_FILTER_ALL = "__all__" as const;
export type BulkSpreadsheetFilterValue = typeof BULK_SPREADSHEET_FILTER_ALL | string;

export interface BulkSpreadsheetMapping {
  productNameColumn: string;
  imageUrlColumns: string[];
  fitColumn: string | null;
  sleeveLengthColumn: string | null;
  topwearLengthColumn: string | null;
  bottomwearLengthColumn: string | null;
  filterColumn: string | null;
}

export interface BulkSpreadsheetNormalizedRow {
  productName: string;
  imageUrls: string[];
  fit: FitType | null;
  sleeveLength: SleeveLength | null;
  topwearLength: TopwearLength | null;
  bottomwearLength: BottomwearLength | null;
  /** Stable label for filtering; null when no filter column is mapped */
  filterValue: string | null;
}

export interface BulkSpreadsheetSession {
  sessionId: string;
  normalizedRows: BulkSpreadsheetNormalizedRow[];
  mapping: BulkSpreadsheetMapping;
}

export interface BulkModelImage {
  id: string;
  name: string;
  file: File;
  preview: string;
}

export interface BulkBackground {
  id: string;
  name: string;
  config: BackgroundConfig;
}

export type BulkBgAssignmentMode = "round-robin" | "manual";

export interface BulkCombination {
  id: string;
  primaryFolder: ProductFolder;
  complementaryFolder: ProductFolder | null;
  modelImage: BulkModelImage;
  background: BackgroundConfig;
}

export interface BulkPoseOverride {
  productFolderId: string;
  poseId: string;
  modelImageId?: string;
  backgroundId?: string;
  complementaryFolderId?: string | null;
}

export interface BulkGeneratedResult {
  id: string;
  combinationId: string;
  combinationLabel: string;
  prompt: string;
  imageData: string;
  pose: Pose;
  /** Set when this result was generated from a custom pose instead of a preset */
  customPose?: CustomPose;
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "editing" | "completed" | "cancelled" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  /** Saved infographic image data URLs (manual canvas export and/or AI-generated) */
  infographicImages?: string[];
  imageGenResponseContent?: unknown;
  editHistory?: EditHistoryEntry[];
}

// --- Model Swap Types ---

export interface ModelSwapGeneratedResult {
  id: string;
  sourceImageId: string;
  sourceImagePreview: string;
  prompt: string;
  imageData: string;
  status: "pending" | "checking-human" | "generating-prompt" | "generating-image" | "auto-retrying" | "editing" | "completed" | "skipped" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  /** Saved infographic image data URLs (manual canvas export and/or AI-generated) */
  infographicImages?: string[];
  imageGenResponseContent?: unknown;
  editHistory?: EditHistoryEntry[];
}

export interface ModelSwapBulkCombination {
  id: string;
  primaryFolder: ProductFolder;
  modelImage: BulkModelImage;
  background: BackgroundConfig;
}

export interface ModelSwapBulkResult {
  id: string;
  combinationId: string;
  combinationLabel: string;
  sourceImageId: string;
  sourceImagePreview: string;
  prompt: string;
  imageData: string;
  status: "pending" | "checking-human" | "generating-prompt" | "generating-image" | "auto-retrying" | "editing" | "completed" | "skipped" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  /** Saved infographic image data URLs (manual canvas export and/or AI-generated) */
  infographicImages?: string[];
  imageGenResponseContent?: unknown;
  editHistory?: EditHistoryEntry[];
}

// --- Replicate Fast Types ---

export interface ReplicateAssetImage {
  id: string;
  file: File;
  preview: string;
  name: string;
}

export interface ReplicateReferenceOutput {
  id: string;
  file: File;
  preview: string;
  name: string;
}

export interface ReplicateVariableGroup {
  id: string;
  name: string;
  images: Array<{
    id: string;
    file: File;
    preview: string;
  }>;
}

export interface ReplicateResult {
  id: string;
  prompt: string;
  imageData: string;
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "completed" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  infographicImages?: string[];
}

export interface ReplicateBulkResult {
  id: string;
  groupId: string;
  groupName: string;
  prompt: string;
  imageData: string;
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "completed" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  infographicImages?: string[];
}

// --- Token Usage & Cost Tracking Types ---

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StepCost {
  model: string;
  label: string;
  tokens: TokenUsage;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface GenerationCostBreakdown {
  steps: StepCost[];
  totalCost: number;
  /** If the generation was retried, this holds the cost data of the failed attempt(s) */
  retrySteps?: StepCost[];
}

// --- Infographic Types ---

export type BadgeStyle = "rounded" | "pill" | "square" | "ribbon" | "outline" | "minimal";

export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface USPElement {
  id: string;
  text: string;
  position: OverlayPosition;
  style: BadgeStyle;
  fontSize: number; // px
  textColor: string; // hex
  bgColor: string; // hex
  bgOpacity: number; // 0-1
  icon?: string; // emoji or text icon
  offsetX: number; // fine-tune offset px
  offsetY: number; // fine-tune offset px
}

export interface LogoElement {
  id: string;
  file: File;
  preview: string;
  position: OverlayPosition;
  size: number; // px width (height auto-scaled)
  opacity: number; // 0-1
  offsetX: number;
  offsetY: number;
}

export interface InfographicConfig {
  usps: USPElement[];
  logos: LogoElement[];
  overlayDimming: number; // 0-1 overall background dim
}

// --- AI Infographic Types ---

export type InfographicMode = "manual" | "ai";

export type AIInfographicStyle =
  | "modern-minimal"
  | "bold-lifestyle"
  | "premium-luxury"
  | "vibrant-pop"
  | "clean-technical";

export type AIInfographicStatus =
  | "idle"
  | "generating"
  | "completed"
  | "error";

// --- UGC Types ---

export type UGCShotType = "normal" | "selfie";

export interface UGCScene {
  id: string;
  name: string;
  description: string;
  shotType: UGCShotType;
  referenceImages: {
    id: string;
    file: File;
    preview: string;
  }[];
}

export interface UGCGeneratedResult {
  id: string;
  sceneId: string;
  sceneName: string;
  prompt: string;
  imageData: string;
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "completed" | "cancelled" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  infographicImages?: string[];
}

// --- Product Video Types ---

export type VideoThemeCategory =
  | "editorial"
  | "urban"
  | "lifestyle"
  | "studio"
  | "seasonal"
  | "dynamic"
  | "product-focused";

export type VideoTheme =
  // Editorial / High-Fashion
  | "luxe-editorial"
  | "fashion-runway"
  | "haute-couture"
  | "vogue-cover"
  | "backstage-bts"
  // Urban / Street
  | "street-style"
  | "streetwear-hype"
  | "night-city"
  | "rooftop-vibes"
  | "subway-transit"
  // Lifestyle / Casual
  | "lifestyle"
  | "coffee-shop"
  | "weekend-outing"
  | "home-lounge"
  | "beach-coastal"
  // Studio / Minimal
  | "studio-clean"
  | "studio-dramatic"
  | "color-block"
  | "infinity-cove"
  // Seasonal / Occasion
  | "seasonal-collection"
  | "festive-party"
  | "resort-vacation"
  | "monsoon-rainy"
  | "winter-layering"
  // Dynamic / Sport
  | "dynamic-action"
  | "gym-fitness"
  | "outdoor-adventure"
  | "dance-movement"
  // Product-Focused
  | "product-showcase"
  | "flat-lay-to-model"
  | "detail-macro";

export type CameraMovementCategory =
  | "static-locked"
  | "pan"
  | "tilt"
  | "dolly-slider"
  | "crane-jib"
  | "orbit-circular"
  | "zoom-lens"
  | "tracking-follow";

export type CameraMovement =
  // Static / Locked
  | "static"
  | "locked-tripod"
  | "subtle-sway"
  // Pan (Horizontal Rotation)
  | "slow-pan-left"
  | "slow-pan-right"
  | "whip-pan"
  | "arc-pan"
  // Tilt (Vertical Rotation)
  | "tilt-up"
  | "tilt-down"
  | "dutch-tilt"
  | "reveal-tilt"
  // Dolly / Slider
  | "dolly-in"
  | "dolly-out"
  | "lateral-slide"
  | "push-pull"
  // Crane / Jib
  | "crane-up"
  | "crane-down"
  | "boom-sweep"
  // Orbit / Circular
  | "orbit"
  | "half-orbit"
  | "spiral-rise"
  // Zoom (Lens)
  | "zoom-in"
  | "zoom-out"
  | "snap-zoom"
  | "vertigo-dolly-zoom"
  // Tracking / Follow
  | "tracking"
  | "lead-track"
  | "side-track"
  | "low-angle-track";

export type ModelMovementCategory =
  | "standing"
  | "walking"
  | "dynamic-athletic"
  | "transitions"
  | "upper-body"
  | "footwear-specific";

export type ModelMovement =
  // Standing / Stationary
  | "confident-stand"
  | "hip-shift"
  | "hair-touch"
  | "slow-turn"
  | "power-pose"
  // Walking / Locomotion
  | "casual-walk"
  | "runway-walk"
  | "walk-and-stop"
  | "walk-past"
  | "approach-and-turn"
  // Dynamic / Athletic
  | "light-jog"
  | "jump-leap"
  | "dance-move"
  | "spin"
  | "squat-lunge"
  // Transitions / Sequences
  | "stand-to-walk"
  | "walk-to-pose"
  | "sit-to-stand"
  | "lean-and-push-off"
  // Upper Body / Detail
  | "arms-crossed"
  | "jacket-open"
  | "collar-adjust"
  | "cuff-roll"
  | "pocket-hands"
  // Footwear-Specific
  | "step-forward"
  | "cross-step"
  | "heel-toe-rock"
  | "kick-up"
  | "lace-up-close";

export type VideoResolution = "720p" | "1080p";

export type VideoDuration = 4 | 6 | 8 | 12 | 16;

export type VideoAspectRatio = "16:9" | "9:16";

export type VeoModel = "veo-3.1-generate-preview" | "veo-3.1-fast-generate-preview";

export type VideoGenerationStatus =
  | "pending"
  | "generating-prompt"
  | "generating-extension-prompt"
  | "submitting-video"
  | "processing-video"
  | "extending-video"
  | "downloading"
  | "auto-retrying"
  | "completed"
  | "error";

export interface VideoProductImage {
  id: string;
  file: File;
  preview: string;
}

export interface VideoGeneratedResult {
  id: string;
  sourceImageId: string;
  sourceImagePreview: string;
  prompt: string;
  videoDataUrl: string;
  status: VideoGenerationStatus;
  error?: string;
  costBreakdown?: GenerationCostBreakdown;
}

export interface VideoBulkCombination {
  id: string;
  primaryFolder: ProductFolder;
  modelImage: BulkModelImage;
  background: BackgroundConfig;
}

export interface VideoBulkResult {
  id: string;
  combinationId: string;
  combinationLabel: string;
  sourceImageId: string;
  sourceImagePreview: string;
  prompt: string;
  videoDataUrl: string;
  status: VideoGenerationStatus;
  error?: string;
  costBreakdown?: GenerationCostBreakdown;
}

// --- Room Staging Types ---

export type RoomStagingCategory = "home-decor" | "furniture";

export type HomeDecorType =
  | "rugs-carpets"
  | "curtains-drapes"
  | "cushions-pillows"
  | "wall-art"
  | "throws-blankets"
  | "table-linen"
  | "lighting";

export type FurnitureType =
  | "sofas-seating"
  | "tables"
  | "beds-bedroom"
  | "storage"
  | "outdoor";

export type HomeDecorSubType =
  | "hand-knotted" | "hand-tufted" | "flatweave" | "dhurrie" | "shag" | "kilim" | "overdyed" | "patchwork" | "braided" | "jute-natural"
  | "sheer" | "blackout" | "linen-curtain" | "velvet-curtain" | "embroidered-curtain" | "printed-curtain" | "layered"
  | "throw-pillow" | "floor-cushion" | "bolster" | "lumbar" | "decorative-pillow" | "outdoor-cushion"
  | "framed-print" | "canvas" | "tapestry" | "wall-hanging" | "macrame" | "mirror" | "metal-wall-art"
  | "knit-throw" | "woven-blanket" | "quilted-throw" | "faux-fur" | "cotton-throw" | "wool-throw"
  | "tablecloth" | "table-runner" | "placemats" | "napkins" | "coasters"
  | "table-lamp" | "floor-lamp" | "pendant-light" | "chandelier" | "wall-sconce" | "lantern";

export type FurnitureSubType =
  | "sofa" | "sectional" | "armchair" | "accent-chair" | "recliner" | "loveseat" | "bench" | "ottoman" | "pouf"
  | "coffee-table" | "dining-table" | "side-table" | "console-table" | "desk" | "nesting-tables"
  | "bed-frame" | "headboard" | "nightstand" | "dresser" | "wardrobe" | "vanity"
  | "bookshelf" | "cabinet" | "sideboard" | "tv-unit" | "shoe-rack" | "chest"
  | "patio-set" | "garden-chair" | "outdoor-table" | "hanging-chair" | "daybed" | "planter";

export type ProductShape = "rectangular" | "round" | "runner" | "square" | "oval" | "irregular";

export interface RoomStyle {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
}

export interface RoomStagingProductImage {
  id: string;
  file: File;
  preview: string;
}

export interface StylingPropImage {
  id: string;
  file: File;
  preview: string;
  label: string;
}

export interface RoomStagingResult {
  id: string;
  shotId: string;
  shotName: string;
  prompt: string;
  imageData: string;
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "completed" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  infographicImages?: string[];
}

export interface RoomStagingBulkCombination {
  id: string;
  primaryFolder: ProductFolder;
  roomSetting: BulkModelImage;
  background: BackgroundConfig;
}

export interface RoomStagingBulkResult {
  id: string;
  combinationId: string;
  combinationLabel: string;
  shotId: string;
  shotName: string;
  prompt: string;
  imageData: string;
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "completed" | "error";
  error?: string;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  costBreakdown?: GenerationCostBreakdown;
  infographicImages?: string[];
}

export type RoomStagingShotFraming =
  | "flat-lay"
  | "detail-closeup"
  | "room-wide"
  | "room-vignette"
  | "product-only"
  | "room-overhead";

export interface RoomStagingShot {
  id: string;
  name: string;
  description: string;
  icon: string;
  viewAngle: PoseViewAngle;
  framing: RoomStagingShotFraming;
  requiresRoom: boolean;
}

// --- Bulk Infographic Types ---

/** Background treatment for a generated infographic. */
export type InfographicBackgroundStyle =
  | "solid-uniform"
  | "solid-textured"
  | "dreamy"
  | "themed";

/** Infographic layout/composition template. */
export type InfographicTemplate = "minimalistic" | "sole-construction";

/** Structural content-part shape shared with the Gemini image pipeline (text or inline image). */
export type InfographicContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** One product in the bulk infographic queue — images + free-form product info. */
export interface InfographicProductFolder {
  id: string;
  name: string;
  images: Array<{
    id: string;
    file: File;
    preview: string;
  }>;
  /** Bullets or a paragraph; long paragraphs are summarised to bullets during enrichment. */
  productInfo?: string;
}

/** Optional brand logo + placement guidance applied to every generation in the batch. */
export interface InfographicBrand {
  logoFile?: File;
  logoPreview?: string;
  logoPlacementInstructions?: string;
}

/** Result of generating one infographic for one product. */
export interface InfographicResult {
  id: string;
  folderId: string;
  folderName: string;
  /** Template this result was generated from. */
  template: InfographicTemplate;
  /** 1-based variation number within this (folder, template) group. */
  variationIndex: number;
  /** Total variations requested for this (folder, template) group. */
  variationCount: number;
  status:
    | "pending"
    | "generating-prompt"
    | "generating-image"
    | "auto-retrying"
    | "editing"
    | "completed"
    | "cancelled"
    | "error";
  /** Enriched composition prompt from step 1 (kept for normal retry + display). */
  enrichedPrompt?: string;
  /** Generated image as a data URL. */
  imageData?: string;
  /** Model's response Content from the image step — needed for multi-turn contextual retry. */
  imageGenResponseContent?: unknown;
  /** Original image-step content parts — replayed for multi-turn contextual retry. */
  originalContentParts?: InfographicContentPart[];
  /** History of contextual-retry exchanges for iterative refinement. */
  editHistory?: EditHistoryEntry[];
  costBreakdown?: GenerationCostBreakdown;
  error?: string;
}
