export type ProductCategory = "clothing" | "footwear";

/**
 * Backend used to generate the final VTON image.
 * - `gemini`: Nano Banana 2 (gemini-3.1-flash-image). Default for everything.
 * - `gpt-image-2`: Azure OpenAI gpt-image-2. Currently exposed only for Footwear VTON.
 */
export type ImageGenModel = "gemini" | "gpt-image-2";

/**
 * Provider used to generate prompts / run analysis stages (text in, text out).
 * - `gemini`: Vertex AI gemini-3.1-pro-preview. Default meta-prompter.
 * - `gpt-5.4-pro`: Azure OpenAI gpt-5.4-pro (Responses API). Redundant provider.
 * - `gpt-5.2`: Azure AI Foundry gpt-5.2 (Models inference chat completions). Redundant provider.
 * - `gpt-5.4-mini`: Azure OpenAI gpt-5.4-mini (chat completions). Redundant provider.
 */
export type TextGenModel = "gemini" | "gpt-5.4-pro" | "gpt-5.2" | "gpt-5.4-mini";

/**
 * Which Google backend serves the Gemini text + image models.
 * - `vertex`: Vertex AI (default) — service-account / ADC credentials, project + location.
 * - `gemini`: Gemini Developer API (generativelanguage / Google AI) — server-held API key.
 * Both are served by the unified `@google/genai` SDK with the same model IDs.
 * Selected on the first page; affects image + prompt generation only (Veo video stays on Vertex).
 */
export type GoogleBackend = "vertex" | "gemini";

export type Gender = "male" | "female" | "unisex";

export type GarmentType = "topwear" | "bottomwear" | "onepiece" | "complete-outfit" | "innerwear";

/**
 * Product form for {@link GarmentType} `"innerwear"`.
 *
 * Innerwear is split out from bottomwear/topwear because its construction vocabulary is
 * genuinely different — rise, gusset, pouch, leg opening, seamless vs side-seam — and
 * because the elastic waistband, not the body of the garment, is where the brand lives
 * and where buyers judge quality. Covers the adjacent lounge/thermal forms too, which
 * share the same construction language and the same catalog treatment.
 */
export type InnerwearSubtype =
  // Bottoms
  | "brief"
  | "trunk"
  | "boxer-brief"
  | "boxer"
  // Tops
  | "vest"
  | "undershirt-crew"
  | "undershirt-vneck"
  // Loungewear / thermals
  | "lounge-shorts"
  | "lounge-pants"
  | "thermal-top"
  | "thermal-bottom";

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
 *   `gemini-3.1-flash-image` (and to the meta-prompter) with an exact-replication
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
  /**
   * Custom lighting override. When `true`, the whole frame is forced to flat,
   * even, high-key illumination: the model (foreground) is uniformly lit at one
   * exposure with no directional key/side/rim light, and the background is lit at
   * the same even intensity with NO cast shadows anywhere (neither on the model's
   * face/body nor on the floor/backdrop). Applies on top of any background mode
   * (inspiration / replica / text / default). `undefined`/`false` = normal,
   * scene-driven lighting. See `EVEN_HIGH_KEY_LIGHTING_DIRECTIVE` in `gemini.ts`.
   */
  evenLighting?: boolean;
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

/** Which of a model's reference views a {@link LabeledModelView} depicts. */
export type ModelReferenceViewKind = "full-body" | "face-closeup" | "back-head";

/**
 * One labelled model reference image passed into VTON generation. When two or
 * more are supplied, they are attached to the image request as explicitly
 * labelled parts (Full body / Face close-up / Back of head) so the generator
 * has a deterministic, all-angle likeness of the same person.
 */
export interface LabeledModelView {
  kind: ModelReferenceViewKind;
  file: File;
  /** Object URL or data URL for UI display. */
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

/**
 * Which kind of output a custom pose produces. `"model"` / `"product"` mirror the
 * legacy {@link CustomPose.isModelShot} boolean; `"infographic"` turns the pose into
 * a marketing-asset render driven by an uploaded infographic template — see
 * {@link InfographicPoseConfig}. Use the `customPose*` helpers in `@/lib/custom-pose`
 * rather than reading the raw fields.
 */
export type CustomPoseShotKind = "model" | "product" | "infographic";

/**
 * How the user's text input for an infographic pose is interpreted by the analysis step:
 * - `"exact"`: the input IS the on-image copy — split into callouts, never reworded
 * - `"describe"`: the input states what the copy should convey — rewritten to callout length
 * - `"creative"`: a vague creative direction — expanded into concrete, product-grounded points
 */
export type InfographicTextMode = "exact" | "describe" | "creative";

/**
 * How literally the uploaded infographic reference is reproduced:
 * - `"layout-lock"`: the reference's layout grid, callout geometry and typographic hierarchy
 *   are copied precisely, and the reference is ALSO forwarded to the image model as a
 *   composition reference (layout only — never its product, copy, or branding)
 * - `"inspiration"`: the reference informs style only; the composition is rebuilt around the
 *   product and the image model never sees the reference (text-only channel, as with poses)
 */
export type InfographicFidelity = "layout-lock" | "inspiration";

/** One callout on an infographic — the user-reviewable unit of on-image copy. */
export interface InfographicTextPoint {
  id: string;
  /** Exact on-image copy. Locked verbatim at render time. */
  text: string;
  /**
   * Which product region/feature this callout points to — a specific, visible feature
   * ("the jacquard-woven waistband"), not a generic restatement ("the product").
   * The literal string `"unanchored"` marks a claim with no position on the product
   * (care, pack size, certification); those render as a badge or footer item with no
   * leader line rather than being pointed at somewhere arbitrary.
   */
  anchor?: string;
  /**
   * Normalized canvas position the leader line terminates on, x/y in 0–1 from the
   * top-left. Absent for `"unanchored"` points.
   */
  anchorPoint?: { x: number; y: number };
}

/**
 * Output of the Step-1 analysis (`analyzeInfographicReference`) — the review surface the
 * user edits in the custom-pose card before generation is allowed to run.
 */
export interface InfographicPlan {
  /** Derived, user-editable callout copy. */
  points: InfographicTextPoint[];
  /** Full composition contract authored by Gemini 3.1 Pro; fed to the image model. */
  composition: string;
  /**
   * Contextual decision from the analysis: does a human model appear in the asset?
   * Drives `poseIsProductOnly` at generation time in place of `isModelShot`.
   */
  includesModel: boolean;
  /** The reference's layout restated in words (zones, grid, typography, palette). */
  layoutSummary?: string;
  /** Set once the analysis has returned and the user has seen the points — gates Generate. */
  approved: boolean;
  /**
   * True after the user edits/adds/removes a point. Forces a composition re-projection at
   * render time so the edited copy actually reaches the image model.
   */
  editedSinceAnalysis?: boolean;
}

/** Per-pose infographic configuration. Present only when `shotKind === "infographic"`. */
export interface InfographicPoseConfig {
  textMode: InfographicTextMode;
  /** Free-form text whose meaning depends on {@link textMode}. */
  textInput: string;
  fidelity: InfographicFidelity;
  /** Optional brand logo baked into the render. */
  brandLogo?: ReferenceImageItem;
  /** Free-form brand-logo placement guidance. */
  brandPlacementInstructions?: string;
  /** Populated by the Analyze step; absent until the user runs it. */
  plan?: InfographicPlan;
}

export interface CustomPose {
  id: string;
  name: string;
  description: string;
  /**
   * true = Model Shot (human model included), false = Product Shot (product only, no model).
   * Legacy storage for the model/product choice — for "does this output need a human model?"
   * always use `customPoseNeedsModel()` from `@/lib/custom-pose`, which also handles the
   * infographic shot kind (where model presence is decided by the analysis, not the user).
   */
  isModelShot: boolean;
  /** Absent on legacy poses ⇒ derived from {@link isModelShot}. */
  shotKind?: CustomPoseShotKind;
  /** Infographic configuration — meaningful only when `shotKind === "infographic"`. */
  infographic?: InfographicPoseConfig;
  /**
   * Controls how attached reference images are interpreted by the AI:
   * - "pose" (default): images are STRICT pose references — only body geometry, camera angle, and image framing are extracted; background, accessories, model identity, garments/footwear, and other product-specific elements are ignored
   * - "image": images are HOLISTIC inspirational references — pose, scene, lighting, mood, and an adapted color palette are extracted in a product-agnostic manner; the background palette is intentionally tuned to contrast with and highlight the user's product
   */
  referenceMode?: CustomPoseReferenceMode;
  /** Optional per-pose background/environment description that overrides the global background */
  customBackground?: string;
  /**
   * How much of the frame HEIGHT the product must occupy, as a percentage.
   *
   * Set: an AUTHORITATIVE user override of the `SUBJECT FILL` field in the FRAMING &
   * CROP CONTRACT, which is otherwise derived from the attached reference image. This
   * exists because small products (innerwear, accessories) are routinely framed too
   * loosely to read on a catalog grid, and the reference cannot express the intent —
   * the same override reasoning as the garment length options, which are authoritative
   * for the same reason.
   *
   * Absent/undefined: no fill constraint — the correct setting for lifestyle shots,
   * where the product is deliberately part of a wider scene.
   */
  productFillPercent?: number;
  referenceImages: {
    id: string;
    file: File;
    preview: string;
  }[];
}

/* ------------------------------------------------------------------ */
/*  Reference-Driven Photoshoot (evolved custom-pose feature)         */
/* ------------------------------------------------------------------ */

/**
 * Batch-level composition mode governing how faithfully each uploaded reference
 * image is reproduced. Applies to the whole run (single or bulk).
 * - "variation": image framing / camera distance are LOCKED from the reference
 *   (via the FRAMING & CROP CONTRACT); the pose is freshly AI-invented, and the
 *   background comes from the selected product background.
 * - "pose-lock": framing AND pose geometry are LOCKED from the reference; only
 *   background (selected product bg), AI model, and garment change.
 * - "replication": the reference is reproduced holistically — background,
 *   lighting, pose, framing, and relative object layout — while the AI model,
 *   garment (always replaced), and accessories come from configuration.
 */
export type ReferencePhotoshootMode = "variation" | "pose-lock" | "replication";

/**
 * Mode governing how a composition-reference image attached to the IMAGE MODEL is read.
 * Extends {@link ReferencePhotoshootMode} with the infographic layout channel, in which the
 * reference supplies layout geometry, callout placement and typographic hierarchy ONLY —
 * never its own product, copy, or branding.
 */
export type CompositionReferenceMode = ReferencePhotoshootMode | "infographic-layout";

/** A single uploaded reference or background image kept as File + object-URL preview. */
export interface ReferenceImageItem {
  id: string;
  file: File;
  preview: string;
}

/**
 * Per-input-product reference set (bulk mode). Uploaded via a folder picker whose
 * subfolders are matched to input {@link ProductFolder}s by name.
 */
export interface ProductReferenceFolder {
  id: string;
  /** Folder name exactly as uploaded (used to match a ProductFolder.name). */
  name: string;
  /** Matched input ProductFolder.id, or null while awaiting manual reconciliation. */
  matchedFolderId: string | null;
  /** Reference images — each one produces exactly one output for the matched product. */
  referenceImages: ReferenceImageItem[];
  /**
   * The Styling-page background (a {@link BulkBackground}.id) chosen for this product;
   * the selected one applies to ALL its outputs. `null` = none chosen yet. Ignored in
   * Replication mode (the reference's own scene is reproduced).
   */
  selectedBackgroundId: string | null;
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
  /**
   * Product form when `garmentType === "innerwear"`. `null` = AI infers from images.
   * Carries the hem/opening anchor that the bottomwear outseam options carry for pants —
   * those options are meaningless here and are suppressed for this garment type.
   */
  innerwearSubtype: InnerwearSubtype | null;
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

/**
 * `retrying` is VTON-only: the image scored below the pass mark and a correction
 * attempt is in flight. The result's own `status` stays `"completed"` throughout,
 * so the card keeps rendering the current best image while the repair lane works.
 * Every other feature only ever produces the original six states.
 */
export type ValidationStatus = "idle" | "validating" | "retrying" | "passed" | "warning" | "error" | "skipped";

export interface ValidationResult {
  status: ValidationStatus;
  message?: string;
}

// --- VTON Scored Validation ---

/**
 * The nine quality axes the VTON inspector grades. Weights live in
 * `VTON_SCORE_WEIGHTS` (gemini.ts). The total is computed client-side by
 * `computeVtonTotalScore` and is never asked of the model, which keeps the
 * rubric auditable and makes the hard caps actually enforceable.
 */
export type VtonScoreDimension =
  | "garmentFidelity"
  | "garmentColor"
  | "garmentShape"
  | "garmentLength"
  | "skinRealism"
  | "characterConsistency"
  | "backgroundComposition"
  | "framing"
  | "propPlacement";

export const VTON_SCORE_DIMENSION_KEYS: readonly VtonScoreDimension[] = [
  "garmentFidelity",
  "garmentColor",
  "garmentShape",
  "garmentLength",
  "skinRealism",
  "characterConsistency",
  "backgroundComposition",
  "framing",
  "propPlacement",
] as const;

/**
 * One graded axis. For a passing axis the prose fields are empty; for a failing
 * one they carry the evidence that drives BOTH the UI breakdown and the
 * correction sent back to the model — one source, two renderings.
 */
export interface VtonDefect {
  dimension: VtonScoreDimension;
  /** 0-100. Meaningless when `applicable` is false. */
  score: number;
  applicable: boolean;
  severity: "critical" | "major" | "minor" | "none";
  /** What the references / configuration called for. "" when passing. */
  expected: string;
  /** What the generated image actually shows. "" when passing. */
  observed: string;
  /** Imperative, image-specific fix. "" when passing. */
  fix: string;
  /** Coarse spatial hint, e.g. "garment body", "sleeves", "hemline", "face". */
  region: string;
  /** Effective weight AFTER renormalisation over the applicable set; 0 when N/A. */
  weight: number;
}

export interface VtonScoreResult {
  /** Final 0-100 after weighting AND hard caps. This is the number the UI shows. */
  score: number;
  /** Weighted mean before caps — diagnostics only. */
  weightedMean: number;
  /** Dimensions whose hard cap actually bound the total. */
  cappedBy: VtonScoreDimension[];
  /** All nine axes, passing and failing. */
  defects: VtonDefect[];
  /** Applicable dimensions scoring below the pass mark, worst first. */
  failedDimensions: VtonScoreDimension[];
  /** Short human summary for the badge tooltip. */
  summary: string;
}

export type VtonScoreOutcome =
  | ({ ok: true; cost?: StepCost } & VtonScoreResult)
  | { ok: false; cost?: StepCost; error: string };

/**
 * One entry per attempt, kept on the result so the tooltip can show the score
 * history and `buildScoreFeedback` can diff attempts to detect regressions.
 * Deliberately carries no image data — this lives in React state for the whole
 * session and a bulk run holds hundreds of them.
 */
export interface VtonAttemptRecord {
  /** 1-based. */
  attempt: number;
  strategy: "initial" | "surgical" | "reroll";
  /** null when the judge itself failed for this attempt. */
  score: number | null;
  summary: string;
  defects: VtonDefect[];
}

/**
 * Scored-validation fields shared by the single and bulk VTON result types. All
 * optional and additive: results from every other feature simply never set them,
 * and `ValidationBadge` falls back to its binary rendering when `validationScore`
 * is absent.
 */
export interface VtonScoreFields {
  /** Final score of the KEPT attempt. Presence of this field switches the UI to scored mode. */
  validationScore?: number;
  /** Per-dimension breakdown of the kept attempt. */
  validationDefects?: VtonDefect[];
  /** Attempt currently in flight (1-based); only meaningful while `validationStatus === "retrying"`. */
  validationAttempt?: number;
  /** Every attempt made, in order — drives the score-history line and regression diffing. */
  validationAttempts?: VtonAttemptRecord[];
  /** Dimensions whose hard cap bound the kept attempt's total. */
  validationCappedBy?: VtonScoreDimension[];
  /** Pre-cap weighted mean of the kept attempt. */
  validationWeightedMean?: number;
  /** Exact correction text sent to the model for the last retry — surfaced behind a UI expander. */
  validationCorrectionSent?: string;
}

// --- Multi-Turn Edit Types ---

export interface EditHistoryEntry {
  userInstruction: string;
  /** Full Content object from Gemini response — includes thought_signature fields needed for multi-turn */
  modelResponseContent: unknown;
}

export interface GeneratedResult extends VtonScoreFields {
  id: string;
  prompt: string;
  imageData: string; // base64
  pose: Pose;
  /** Set when this result was generated from a custom pose instead of a preset */
  customPose?: CustomPose;
  status: "pending" | "generating-prompt" | "generating-image" | "auto-retrying" | "editing" | "completed" | "cancelled" | "error";
  error?: string;
  /**
   * Reference-driven photoshoot context (evolved custom pose). When present, this
   * result was produced from a single uploaded reference image under the batch-level
   * `mode`, using the pre-analyzed `frozenScene` for its background instead of the
   * global background config.
   */
  referencePhotoshoot?: {
    mode: ReferencePhotoshootMode;
    /** Product-bg scene (variation/pose-lock, image background) OR the reference's own scene (replication). */
    frozenScene?: string;
    /** Text background description (variation/pose-lock) when the chosen Styling background is text, not an image. */
    backgroundText?: string;
  };
  /**
   * The exact frozen-scene text used at generation, persisted so a HARD retry reproduces the
   * identical background instead of re-deriving a different one. (For reference-photoshoot results
   * this mirrors `referencePhotoshoot.frozenScene`.)
   */
  frozenSceneUsed?: string;
  /**
   * The background/scene image attached to the image generator for scene consistency (see Fix B).
   * Persisted so a hard retry re-attaches the same image. Transient (in-memory) File handle.
   */
  sceneReferenceFile?: File;
  /**
   * The reference-photoshoot reference image attached to the image generator as a COMPOSITION &
   * FRAMING reference (strict crop/pose replication, + footwear/accessories for Complete Outfit).
   * Persisted so a hard retry re-attaches the same image. Transient (in-memory) File handle.
   */
  compositionReferenceFile?: File;
  /** On-model garment-only description used at generation, persisted for hard-retry reproduction. */
  garmentDescriptionUsed?: string;
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

export type FeatureMode = "vton" | "model-swap" | "swatch" | "replicate" | "product-video" | "room-staging" | "infographic" | "model-creation";

export type NamingLogic = "folder-name-sequential" | "folder-name-sequential-1";

// --- AI Model Creation Types ---

/**
 * Model gender. Only male/female (no unisex) because the ADULT locked wardrobe
 * rule is gender-specific: men → black short-sleeve T-shirt + black shorts;
 * women → black crop top + black shorts. Every non-adult age band (baby →
 * teen) shares one gender-neutral wardrobe instead — a black sleeveless U-neck
 * top + black shorts — so for those bands this field only drives casting
 * (boy / girl), not the clothing.
 */
export type ModelCreationGender = "male" | "female";

/**
 * Casting age band. The child bands use semantic keys rather than bare number
 * ranges so their labels can be reworded without migrating persisted
 * {@link SavedModel} records; the adult keys are byte-identical to the original
 * five, so models saved before child support keep validating.
 */
export type ModelAgeRange =
  // Children — see MODEL_AGE_OPTIONS for the age→group mapping.
  | "baby-0-12m"
  | "toddler-1-3"
  | "kid-4-7"
  | "kid-8-12"
  | "teen-13-17"
  // Adults
  | "18-25"
  | "26-35"
  | "36-45"
  | "46-60"
  | "60+";

/**
 * Coarse life-stage an age band belongs to. This — not the raw band — is the
 * axis every wardrobe / posture / anatomy prompt branch and casting-option
 * helper keys off.
 */
export type ModelAgeGroup = "baby" | "toddler" | "kid" | "teen" | "adult";

export type ModelBodyType =
  // Adult builds
  | "slim"
  | "athletic"
  | "average"
  | "curvy"
  | "plus-size"
  | "muscular"
  // Child builds ("average" and "athletic" are shared with the adult set)
  | "slight"
  | "chubby"
  | "sturdy"
  | "tall-for-age";

export interface ModelReferenceImage {
  file: File;
  preview: string;
}

/**
 * One model "brief" card on the Models step. Only the face / hairstyle /
 * complexion / hair-color are ever pulled from {@link referenceImage}.
 */
export interface ModelBox {
  id: string;
  name: string;
  /** Free-text visual direction for this model's appearance. */
  description: string;
  /** Optional face/hair/complexion reference. Only those traits are used. */
  referenceImage?: ModelReferenceImage;
  /** 1–5 — number of output images generated for this box. */
  variantCount: number;
  /**
   * When a reference image is set, copy its face onto EVERY variant (identity
   * locked). When false, each variant gets a distinct face. Ignored when no
   * reference image is present (faces are always distinct per variant then).
   */
  lockToReferenceFace: boolean;
}

/** The two identity reference shots generated per model on the Refine step. */
export type ModelViewKind = "face-closeup" | "back-head";

/** State of one reference-shot view (face close-up or back of head). */
export interface ModelViewResult {
  status: "generating" | "completed" | "error";
  /** Generated view as a data URL. */
  imageData?: string;
  /** True once the user has accepted this view (approve/regenerate loop). */
  approved?: boolean;
  error?: string;
  costBreakdown?: GenerationCostBreakdown;
}

/** One snapshot in a model's linear edit history (full body + both views). */
export interface ModelVersion {
  id: string;
  /** Human label, e.g. "Original" or the edit that produced the NEXT state. */
  label: string;
  createdAt: number;
  /** Full-body image as a data URL. */
  imageData: string;
  faceCloseUp?: string;
  backHead?: string;
}

/** Refine-step fields shared by {@link ModelCreationResult} and {@link SavedModel}. */
export interface ModelRefineFields {
  faceCloseUp?: ModelViewResult;
  backHead?: ModelViewResult;
  /** Linear edit history, oldest first. */
  versions?: ModelVersion[];
}

/** One generated result image — one variant of one {@link ModelBox}. */
export interface ModelCreationResult extends ModelRefineFields {
  id: string;
  boxId: string;
  boxName: string;
  /**
   * Casting age band this result was generated at. Captured per result rather
   * than read live from the store so the Refine step still targets the right
   * `personGeneration` after the casting attributes are changed.
   */
  ageRange: ModelAgeRange;
  /** 1-based variant number within this box. */
  variantIndex: number;
  variantCount: number;
  status:
    | "pending"
    | "generating-prompt"
    | "generating-image"
    | "auto-retrying"
    | "completed"
    | "cancelled"
    | "error";
  enrichedPrompt?: string;
  /** Generated image as a data URL. */
  imageData?: string;
  costBreakdown?: GenerationCostBreakdown;
  error?: string;
  /** True once this result has been saved into the Model Library. */
  saved?: boolean;
}

/** A model persisted to the IndexedDB-backed Model Library. */
export interface SavedModel extends ModelRefineFields {
  id: string;
  name: string;
  /** Base64 data URL of the model image. */
  imageData: string;
  gender: ModelCreationGender;
  ageRange: ModelAgeRange;
  bodyType: ModelBodyType;
  ethnicity: string;
  brandName?: string;
  description?: string;
  createdAt: number;
}

/** One uploaded source image in the Edit-models sub-mode (1:1 → one result). */
export interface ModelEditSource {
  id: string;
  file: File;
  preview: string;
}

/** One edited output — exactly one per uploaded {@link ModelEditSource}. */
export interface ModelEditResult {
  id: string;
  sourceId: string;
  sourceName: string;
  /** Aspect ratio derived from the source image and used for this render. */
  aspectRatio: AspectRatio;
  status:
    | "pending"
    | "generating-instruction"
    | "generating-image"
    | "auto-retrying"
    | "completed"
    | "cancelled"
    | "error";
  /** The concise "what changes" snippet from the enrichment step. */
  editInstruction?: string;
  /** Edited image as a data URL. */
  imageData?: string;
  costBreakdown?: GenerationCostBreakdown;
  error?: string;
  /** True once this result has been saved into the Model Library. */
  saved?: boolean;
}

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
  /**
   * When true, this product's garment images are ON-MODEL (worn by a stand-in person) rather
   * than flat-lay/product shots. Triggers the garment-isolation enrichment (a garment-only
   * description) and an "ignore the wearer" directive so the configured AI model — not the
   * garment image's person — appears in the output. Default: false.
   */
  onModelGarment?: boolean;
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
  /** Full body (primary) image. */
  file: File;
  preview: string;
  /** Optional extra reference views (VTON bulk). Sent as labelled references. */
  faceCloseUp?: { file: File; preview: string };
  backHead?: { file: File; preview: string };
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

export interface BulkGeneratedResult extends VtonScoreFields {
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
  /** Reference-driven photoshoot context — see {@link GeneratedResult.referencePhotoshoot}. */
  referencePhotoshoot?: {
    mode: ReferencePhotoshootMode;
    frozenScene?: string;
    backgroundText?: string;
  };
  /** Frozen-scene text used at generation, persisted for exact hard-retry reproduction. */
  frozenSceneUsed?: string;
  /** Background/scene image attached to the generator; re-attached verbatim on hard retry. */
  sceneReferenceFile?: File;
  /** Reference image attached as a COMPOSITION & FRAMING reference; re-attached on hard retry. */
  compositionReferenceFile?: File;
  /** On-model garment-only description used at generation, persisted for hard-retry reproduction. */
  garmentDescriptionUsed?: string;
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
  /**
   * Original filename of the source image, extension included. Model Swap output is
   * 1:1 with its input, and downloads reuse this name verbatim so a client can drop
   * the result straight over their input lot. See `src/lib/output-naming.ts`.
   */
  sourceImageName: string;
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
  /** See {@link ModelSwapGeneratedResult.sourceImageName}. */
  sourceImageName: string;
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

/**
 * Number of exploded horizontal layers to render for a sole-construction infographic.
 * Fixed per product. See {@link InfographicProductFolder.soleConstructionLayers} and
 * `buildSoleConstructionSnippet` in constants for what each layer means per count.
 */
export type SoleConstructionLayerCount = 2 | 3 | 4;

/** Structural content-part shape shared with the Gemini image pipeline (text or inline image). */
export type InfographicContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** One product in the bulk infographic queue — images + per-template callout info. */
export interface InfographicProductFolder {
  id: string;
  name: string;
  images: Array<{
    id: string;
    file: File;
    preview: string;
  }>;
  /**
   * Legacy / shared free-form product info. Kept as a fallback when a template-specific
   * field below is empty. Bullets or a paragraph; long paragraphs are summarised to
   * bullets during enrichment.
   */
  productInfo?: string;
  /** Callout info used ONLY for the minimalistic template. Falls back to `productInfo`. */
  minimalisticInfo?: string;
  /**
   * Callout info used ONLY for the sole-construction template — ideally one short label
   * per layer, top-to-bottom, matching {@link soleConstructionLayers}. Falls back to
   * `productInfo`. Quoted text renders verbatim; each label is pinned to its layer.
   */
  soleConstructionInfo?: string;
  /** Fixed exploded-layer count for this product's sole-construction infographic. Default 3. */
  soleConstructionLayers?: SoleConstructionLayerCount;
  /**
   * Which callout fields were last filled from the attached callout spreadsheet. Drives the
   * "from sheet" tag on the product card; each flag is cleared as soon as the user edits
   * that textarea by hand.
   */
  sheetFilled?: { minimalisticInfo?: boolean; soleConstructionInfo?: boolean };
}

/** Column mapping for the infographic callout spreadsheet import. */
export interface InfographicSheetMapping {
  /** Header whose cells hold the product SKU / style code. Required. */
  skuColumn: string;
  /** Header whose cells hold the minimalistic-template callouts. Null when not mapped. */
  minimalisticColumn: string | null;
  /** Header whose cells hold the sole-construction layer labels. Null when not mapped. */
  soleConstructionColumn: string | null;
}

/**
 * A parsed callout spreadsheet that stays attached to the session, so products added after
 * the import (e.g. a later folder upload) auto-fill without re-uploading the file.
 */
export interface InfographicSheetSession {
  fileName: string;
  headers: string[];
  records: Record<string, string>[];
  mapping: InfographicSheetMapping;
}

/** Outcome of the last callout-sheet import — drives the summary bar and its Undo. */
export interface InfographicSheetImportSummary {
  fileName: string;
  /** Number of products that had at least one field written. */
  filledCount: number;
  /** Sheet SKUs that matched no product. */
  unmatchedSkus: string[];
  /** Product names that got no sheet row. */
  unfilledProducts: string[];
  /** Pre-import field values, for one-click undo. */
  snapshot: Array<{ id: string; patch: Partial<InfographicProductFolder> }>;
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
