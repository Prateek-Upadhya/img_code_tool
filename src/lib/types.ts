export type ProductCategory = "clothing" | "footwear";

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
}

export type BackgroundMode = "inspiration" | "text";

export interface BackgroundConfig {
  mode: BackgroundMode;
  inspirationImage?: {
    file: File;
    preview: string;
  };
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
}

export interface CustomPose {
  id: string;
  name: string;
  description: string;
  /** true = Model Shot (human model included), false = Product Shot (product only, no model) */
  isModelShot: boolean;
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
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "editing" | "completed" | "error";
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

export type FeatureMode = "vton" | "model-swap" | "swatch" | "replicate" | "product-video" | "room-staging";

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
  /** Present when this folder was created from CSV/XLSX bulk import; used to replace on filter change */
  bulkImportSessionId?: string;
}

/** Sentinel value for spreadsheet filter: include all rows */
export const BULK_SPREADSHEET_FILTER_ALL = "__all__" as const;
export type BulkSpreadsheetFilterValue = typeof BULK_SPREADSHEET_FILTER_ALL | string;

export interface BulkSpreadsheetMapping {
  productNameColumn: string;
  imageUrlColumns: string[];
  fitColumn: string | null;
  filterColumn: string | null;
}

export interface BulkSpreadsheetNormalizedRow {
  productName: string;
  imageUrls: string[];
  fit: FitType | null;
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
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "editing" | "completed" | "error";
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
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "completed" | "error";
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
