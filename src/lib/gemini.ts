import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  AccessoryItem,
  AIModel,
  AspectRatio,
  BackgroundConfig,
  ComplementaryImage,
  CustomPose,
  EditHistoryEntry,
  FitType,
  FootwearType,
  GarmentImage,
  GarmentType,
  Gender,
  ModelImage,
  ModelSwapBackgroundMode,
  Pose,
  ProductCategory,
  SetLayoutStyle,
  SetVariantFolder,
  StepCost,
  SwatchShape,
  TokenUsage,
  UGCScene,
  UGCShotType,
  ValidationResult,
  RoomStagingCategory,
  RoomStagingShot,
  RoomStyle,
  ProductShape,
} from "./types";
import { ACCESSORY_CATEGORIES, FIT_OPTIONS, FOOTWEAR_TYPE_OPTIONS } from "./constants";

// Pricing per 1M tokens (USD)
// Image generation models use flat per-image pricing for output (handled separately).
const MODEL_PRICING: Record<string, { input: number; outputText: number }> = {
  "gemini-3.1-pro-preview":          { input: 2.00, outputText: 12.00 },
  "gemini-3.1-flash-image-preview":  { input: 0.15, outputText: 0.60 },
  "gemini-3-flash-preview":          { input: 0.50, outputText: 3.00 },
};

// Flat per-image output cost for Nano Banana 2 (gemini-3.1-flash-image-preview)
const IMAGE_OUTPUT_COST: Record<string, number> = {
  "512": 0.045,
  "1K": 0.067,
  "2K": 0.067,
  "4K": 0.151,
};

function extractTokenUsage(response: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }): TokenUsage {
  return {
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export function computeStepCost(model: string, label: string, tokens: TokenUsage): StepCost {
  const pricing = MODEL_PRICING[model] ?? { input: 0, outputText: 0 };
  const inputCost = (tokens.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.outputTokens / 1_000_000) * pricing.outputText;
  return { model, label, tokens, inputCost, outputCost, totalCost: inputCost + outputCost };
}

/** For the image generation model, output cost = flat per-image rate + text input token cost */
export function computeImageGenCost(label: string, tokens: TokenUsage, imageSize: "512" | "1K" | "2K" | "4K"): StepCost {
  const model = "gemini-3.1-flash-image-preview";
  const pricing = MODEL_PRICING[model]!;
  const inputCost = (tokens.inputTokens / 1_000_000) * pricing.input;
  const outputCost = IMAGE_OUTPUT_COST[imageSize] ?? 0.067;
  return { model, label, tokens, inputCost, outputCost, totalCost: inputCost + outputCost };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix to get just base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Shared directive: forces the Gemini 3.1 Pro meta-prompter to include photographic
 * human-texture descriptors in its output prompt so that Nano Banana 2 produces
 * skin/hair/teeth that are indistinguishable from a real human being.
 *
 * Written in positive framing per official Nano Banana prompting guidance — negatives
 * (e.g. "no plastic", "no airbrushed") tend to bias the generator toward those very
 * aesthetics, so we describe what the image SHOULD contain instead of what it should not.
 */
const CLOTHING_VTON_REALISM_DIRECTIVE = `
PHOTOREALISM & HUMAN TEXTURE DIRECTIVE (MANDATORY — apply to ALL clothing VTON outputs that feature a human model):
The output prompt you generate MUST include an explicit photorealism clause that forces the image generator to render the model as visually indistinguishable from a real human being. Weave the following language into a natural-sounding paragraph (photographer-style prose, not a keyword dump) and include it inside the output prompt.

1. SKIN — describe the low-level texture in positive terms:
   - "Natural, healthy, hydrated skin with authentic low-level texture: visible fine pores distributed across the cheeks, nose, and forehead; subtle vellus (peach-fuzz) hair catching the light along the jawline and temples; realistic subsurface scattering giving the skin depth and warmth."
   - "Even, luminous skin tone with natural micro-variations in color — slightly warmer across the cheeks and nose bridge, cooler in the under-eye area. Specular highlights appear only as soft sheen on the T-zone and cheekbones, never as blown-out hotspots."
   - The skin is HEALTHY. Do NOT introduce pimples, acne, active blemishes, scars, dark pigmentation patches, eczema, rashes, or any unhealthy skin conditions. The goal is realistic-but-healthy — real skin texture without distracting imperfections.

2. HAIR — "Individual hair strands are visible at the hairline, temples, and part line, with a few natural micro-flyaways catching the light. Hair shows realistic anisotropic highlights that run along the length of the strands — not a uniform plastic sheen."

3. TEETH (if visible — smile, parted lips) — "Teeth show natural, slightly off-white enamel with subtle translucence near the edges and soft shading between individual teeth — not uniformly white or artificially bright."

4. EYES — "Detailed iris texture (radial fibers, subtle color variation), natural corneal reflection with a visible catchlight, soft individual lash definition, and a thin moisture meniscus along the lower lid."

5. PHOTOGRAPHIC ANCHOR (include verbatim in the output prompt): "Photographed on a full-frame camera with an 85mm lens at f/4, the subject renders with authentic photographic skin texture — visible pores, fine vellus hair, natural skin hydration, and realistic subsurface scattering — so the model reads as a real human being photographed in a real studio."

POSITIVE-FRAMING RULE (Nano Banana 2 best practice — strictly enforce):
- Describe what the image SHOULD contain (visible pores, natural texture, healthy hydrated skin, individual hair strands). Do NOT describe what it should NOT be (avoid words like "flawless", "perfect", "porcelain", "airbrushed", "beauty filter", "smooth skin", "doll-like", "CGI", "render", "plastic", "waxy" — these adjectives either trigger beauty-filter defaults or bias the generator toward the very aesthetics we are trying to avoid).
- Use the vocabulary: "natural", "healthy", "authentic", "photographic", "lived-in", "hydrated", "low-level texture".
`;

/**
 * Shared directive: instructs the meta-prompter to (a) pose the model naturally,
 * (b) introduce subtle per-generation variations in gaze/head-tilt/arm-position/expression
 * so that a batch of 50 outputs of the "same" pose reads as 50 distinct catalog images,
 * and (c) treat the user's ADDITIONAL INSTRUCTIONS field as authoritative for posture,
 * expression, and styling attitude.
 */
const CLOTHING_VTON_POSING_DIRECTIVE = `
NATURAL POSING & SUBTLE VARIATION DIRECTIVE:
The model's pose MUST feel like a real person — relaxed, subtly dynamic, and never stiff or mechanical. Incorporate micro-details that make the pose human: a slight weight shift to one leg, a gentle head tilt, naturally asymmetric shoulders, relaxed fingers (not splayed flat), and a soft, genuine facial expression. Avoid perfectly symmetrical stances or robotic limb placement. Think "candid street-style photograph", never "mannequin display".

ACROSS-BATCH VARIATION (IMPORTANT — this same pose may be generated across dozens of products):
Within the canonical constraints of the specified pose and framing, introduce small, subtle variations in:
  • direction of gaze (eyes meeting camera / slightly off-camera left or right / down / soft middle distance)
  • head tilt and chin angle (a few degrees left/right, slight lift or drop)
  • shoulder line and torso micro-rotation (within the pose's canonical orientation)
  • positioning of arms and hands (one hand relaxed at side, the other touching thigh / waistband / hip / tucked into pocket / behind back / lightly adjusting the garment)
  • weight distribution (left vs right leg as the supporting leg)
  • micro facial expression (neutral gaze, soft closed-lip smile, very slight lip parting)
These variations must stay STRICTLY within the pose's canonical identity (a "front view, waist-up" pose remains frontal and waist-up — variations never turn it into a side view or a different framing / crop). The crop boundaries dictated by FRAMING are absolute; only the posture, gaze, and expression vary.

ADDITIONAL INSTRUCTIONS INTEGRATION (CRITICAL):
If the user's ADDITIONAL INSTRUCTIONS field (see SCENE PARAMETERS below) contains guidance about posture, stance, gaze, head tilt, arm/hand positioning, facial expression, mood, or styling attitude, you MUST weave those instructions directly into the pose description you produce. Treat ADDITIONAL INSTRUCTIONS as AUTHORITATIVE USER INTENT for posture and expression — describe the pose in terms that explicitly reflect those cues (e.g., if the user writes "confident, slight smirk, arms crossed", the output prompt must describe a confident stance with a slight smirk and arms crossed, not a generic smile with relaxed arms). When ADDITIONAL INSTRUCTIONS specify a mood or styling direction that will be reused across many products, translate it into concrete body-language micro-variations per generation so each output in the batch reads as a different moment within the same mood.
`;

/**
 * Step 1: Use Gemini 3.1 Pro to generate a detailed VTON prompt
 */
export async function generateVTONPrompt({
  apiKey,
  productCategory = "clothing",
  gender,
  garmentImages,
  garmentType,
  footwearType,
  fit,
  complementaryImages,
  accessories,
  background,
  model,
  modelImage,
  pose,
  customPose,
  aspectRatio,
  additionalInfo,
  productInfo,
  applyAccessoriesToAllPoses = false,
}: {
  apiKey: string;
  productCategory?: ProductCategory;
  gender: Gender;
  garmentImages: GarmentImage[];
  garmentType: GarmentType;
  footwearType?: FootwearType;
  fit: FitType | null;
  complementaryImages: ComplementaryImage[];
  accessories: AccessoryItem[];
  background: BackgroundConfig;
  model: AIModel | null;
  modelImage: ModelImage | null;
  pose: Pose;
  /** If provided, overrides the preset pose with a user-defined text + image description */
  customPose?: CustomPose;
  aspectRatio: AspectRatio;
  additionalInfo: string;
  productInfo?: string;
  /** When true, the same accessories are applied to all poses — enforce visual consistency */
  applyAccessoriesToAllPoses?: boolean;
}): Promise<{ text: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  // Build content parts
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  const isFootwear = productCategory === "footwear";
  const isProductOnlyShot = customPose ? !customPose.isModelShot : pose.requiresModel === false;
  const isGhostMannequin = pose.framing === "ghost-mannequin";
  const isCustomPose = !!customPose;

  // Determine what garment details to emphasize based on pose view angle, framing, and garment type
  const viewAngle = pose.viewAngle;
  const framing = pose.framing;

  // === VIEW ANGLE INSTRUCTIONS ===
  let viewSpecificGarmentInstruction = "";

  if (isFootwear) {
    // Footwear-specific view angle instructions
    if (viewAngle === "front") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (FRONT VIEW - camera facing the toe):
Your prompt must EMPHASIZE these FRONT-FACING footwear details:
- TOE BOX: Shape (round, pointed, square, almond), material, cap toe detail, stitching
- VAMP: Upper material, texture, perforations, overlays, branding placement
- TONGUE: Visibility, material, padding, logo/branding on tongue
- LACING/CLOSURE: Lace type, eyelets, lace color, closure mechanism from front
- FRONT BRANDING: Any logo, text, symbol, emblem visible from the front — EXACT position, size, color, and design
- FRONT SILHOUETTE: Overall shape and proportions as seen from the front`;
    } else if (viewAngle === "back") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (BACK VIEW - camera facing the heel):
Your prompt must EMPHASIZE these REAR-FACING footwear details:
- HEEL COUNTER: Shape, height, material, stiffness
- BACK TAB / PULL TAB: Position, material, logo or branding
- HEEL: Type (flat, block, stiletto, wedge, platform), height, material
- BACK BRANDING: Any logo, text, reflective elements on the heel area — EXACT position, size, color
- OUTSOLE REAR: Visible sole edge, color, tread pattern from behind
- COLLAR/TOPLINE: Opening shape as seen from behind`;
    } else if (viewAngle === "side") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (SIDE VIEW - lateral or medial profile):
Your prompt must EMPHASIZE these SIDE-VISIBLE footwear details:
- FULL SILHOUETTE: The complete shoe profile from toe to heel — this is the MOST important detail
- LATERAL/MEDIAL BRANDING: Logo, swoosh, stripes, or brand marks on the side — EXACT position, size, color, angle, and proportions
- MIDSOLE: Thickness, material, color, air units, cushioning visible from side
- OUTSOLE: Tread pattern edge, color contrast, thickness from side
- UPPER CONSTRUCTION: Panels, overlays, mesh, leather, suede sections from side
- HEEL HEIGHT and profile
- TOE SPRING: How much the toe curves upward
- LACING PROFILE: How the lacing system appears from the side`;
    } else if (viewAngle === "three-quarter-front") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (THREE-QUARTER FRONT VIEW - angled, showing front and side):
Your prompt must describe BOTH front and partial side footwear details:
- TOE BOX and VAMP from the angled front
- PARTIAL SIDE showing branding, midsole, and silhouette depth
- LACING/CLOSURE at an angled perspective
- BRANDING visible from this angle — describe ALL logos/marks on both front and side surfaces
- UPPER CONSTRUCTION panels and material transitions
- Overall 3D form and depth perception`;
    } else if (viewAngle === "three-quarter-back") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (THREE-QUARTER BACK VIEW - angled away, showing heel and side):
Your prompt must describe BOTH back and partial side footwear details:
- HEEL COUNTER and back tab from angled rear
- PARTIAL SIDE showing branding, midsole, and silhouette
- OUTSOLE visible at this angle
- BRANDING on heel and side surfaces — exact position, size, color
- COLLAR/TOPLINE shape and padding`;
    } else if (viewAngle === "top-down") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (TOP-DOWN VIEW - bird's eye looking straight down):
Your prompt must EMPHASIZE these details visible from directly above:
- TONGUE: Full tongue visible with all branding, labels, logo
- LACING PATTERN: Complete lacing system from above
- INSOLE: If visible, describe insole branding and material
- COLLAR/TOPLINE: Full opening shape
- TOE BOX from above
- OVERALL SHAPE: The footprint/outline shape
- TOP BRANDING: Any logos, text, patterns on upper surfaces`;
    } else if (viewAngle === "bottom") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (BOTTOM/SOLE VIEW - looking at the outsole):
Your prompt must EMPHASIZE these sole-specific details:
- TREAD PATTERN: Exact pattern, lugs, grooves, flex points
- SOLE BRANDING: Brand logo, text, size markings on the sole
- SOLE MATERIAL: Rubber, EVA, leather, composition
- SOLE COLOR: Color zones, contrasts
- HEEL AREA: Wear indicators, heel strike zone
- FOREFOOT: Flex grooves, pivot point`;
    }
  } else {
    // Original clothing view angle instructions
    if (viewAngle === "front") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (FRONT VIEW - this is the primary visible side):
Your prompt must EMPHASIZE these FRONT-FACING garment details:
- NECKLINE: Exact neckline shape and depth as seen from the front
- FRONT CLOSURE: Buttons, zippers, snaps, ties, or open front - describe count, placement, material
- FRONT PATTERN/PRINT: How the pattern/print appears on the front panel
- FRONT POCKETS: Chest pockets, kangaroo pocket, welt pockets - exact position and style
- FRONT EMBELLISHMENTS: Logos, embroidery, appliqués, screen prints, text on the front
- FRONT DRAPE: How the fabric falls and drapes from the front
- SLEEVE LENGTH from the front perspective
- HEMLINE as visible from the front`;
    } else if (viewAngle === "back") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (BACK VIEW - the model's back is facing the camera):
Your prompt must EMPHASIZE these BACK-FACING garment details:
- BACK NECKLINE/COLLAR: How the neckline or collar looks from behind (crew back, scoop back, keyhole, open back, etc.)
- BACK CLOSURE: Back zipper, buttons, lace-up, hook-and-eye, tie-back - describe exact placement
- BACK YOKE: Shoulder yoke shape, seam lines, stitching details
- BACK PATTERN/PRINT: How the pattern/print continues or changes on the back panel
- BACK POCKETS: Back pockets on pants/jeans - shape, placement, stitching
- BACK VENT/SLIT: Center vent, side vents, back slit - length and position
- BACK EMBELLISHMENTS: Any logos, embroidery, prints, tags visible on the back
- BACK SEAMS: Center back seam, princess seams, darting
- BACK HEMLINE: How the hem falls from behind
- BACK DRAPE: How the fabric falls, gathers, or flows when seen from behind
CRITICAL: The camera shows the model FROM BEHIND. The entire back of the garment must be fully visible and described with precision.`;
    } else if (viewAngle === "side") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (SIDE VIEW - the model is in full profile):
Your prompt must EMPHASIZE these SIDE-VISIBLE garment details:
- SILHOUETTE: The overall garment outline/shape as seen from the side - this is the MOST important detail
- SIDE SEAMS: Construction lines, panel seams running down the side
- SIDE DRAPE: How the fabric falls and hangs from the side view
- SLEEVE SHAPE: How the sleeve looks in profile - the curve, taper, and length
- HEM SHAPE: Whether the hem is straight, curved, high-low, or asymmetric from the side
- SIDE POCKETS: Side slit pockets, cargo pockets, their depth and angle
- THICKNESS/STRUCTURE: How thick or structured the garment appears in profile
- FIT PROFILE: How tight or loose the garment sits on the body from the side`;
    } else if (viewAngle === "three-quarter-front") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (THREE-QUARTER FRONT VIEW — model rotated EXACTLY 45° about the vertical axis):
★★★ CRITICAL ORIENTATION ANCHOR — NON-NEGOTIABLE ★★★

BODY ORIENTATION (the most important thing to get right — the current failure mode is this view being rendered as a pure front-facing shot):
- The model's body is rotated EXACTLY 45 degrees about the vertical axis (the imaginary line running from the crown of the head straight down to the floor between the feet). This rotation is HALF-WAY between a pure front view (0°) and a pure side profile (90°).
- Equivalently: the camera is positioned at roughly 45° off-axis from the body's frontal plane — NOT in front of the model, NOT to the side, but diagonally between the two.
- Either the LEFT half or the RIGHT half of the body is closer to the camera (the "near side"); the other half is rotated away from the camera (the "far side"). Both sides remain visible, but only at 45°.

ANATOMICAL VERIFICATION CUES (every one of these must hold — if any is violated, the shot has drifted toward a straight front view and is INVALID):
- NEAR SHOULDER (the one closer to the camera) appears clearly FORWARD of the far shoulder; the shoulder line is visibly diagonal, NOT parallel to the image plane.
- FAR SHOULDER is visibly receded — partially obscured by the torso or noticeably further from the camera.
- CHEST / TORSO reads as a diagonal plane — both pectoral / bust areas are visible but one is clearly closer to the camera than the other. The chest is NOT rendered as a flat, fully-frontal plane.
- HIPS follow the same 45° rotation as the shoulders (hip line is diagonal relative to the image plane).
- NOSE / FACE CENTERLINE points ~45° off-camera (the bridge of the nose is angled toward the near shoulder side, not straight at the lens). The far cheek/eye/jaw are partially visible but compressed in perspective; the far ear is largely hidden.
- FEET: one foot is slightly forward of the other, consistent with the 45° stance.

FORBIDDEN — these indicate the shot collapsed into a pure front view:
- Shoulders parallel to the image plane (both at the same distance from the camera) → INVALID.
- Chest / torso rendered as a flat, symmetrical, fully-frontal plane → INVALID.
- Both ears fully and symmetrically visible → INVALID (too frontal).
- Nose pointing directly at the camera → INVALID.
- Both feet symmetrically placed on a line parallel to the camera plane → INVALID.

VERBATIM ANCHOR SENTENCE (the output prompt you generate MUST include this sentence word-for-word so the image generator locks the orientation):
"The model's body is rotated exactly 45 degrees about the vertical axis running from the crown of the head down to the floor — a true three-quarter front orientation, not a straight front view. The near shoulder sits clearly forward of the far shoulder, the chest reads as a diagonal plane, the face is angled approximately 45 degrees off-camera with the bridge of the nose pointing toward the near-shoulder side, and the hip line matches the 45-degree rotation of the shoulder line."

GARMENT DETAILS TO DESCRIBE FROM THIS ANGLE:
- All FRONT details (neckline, front closure, front pockets, front pattern) remain primary, but as they appear at a 45° rotation rather than face-on.
- The PARTIAL SIDE view on the near side shows the garment's silhouette, side seam, and how it drapes along the rotated profile.
- SLEEVE: Describe how each sleeve looks at this angle — the near sleeve foreshortened toward the camera, the far sleeve receding.
- FIT: How the garment fits is very visible at this angle — describe waist, torso fit, and the diagonal fall of fabric across the torso.
- FRONT EMBELLISHMENTS as they appear in the angled perspective (logos, prints, and text will be partially foreshortened, not face-on).`;
    } else if (viewAngle === "three-quarter-back") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (THREE-QUARTER BACK VIEW - angled away, mostly back with some side visible):
Your prompt must describe BOTH back and partial side garment details:
- All BACK details (back closure, back yoke, back seams, back embellishments) are primary
- PARTIAL SIDE view showing how the garment drapes and the silhouette profile
- BACK PATTERN: How the pattern flows at this angle
- BACK HEM: How the hemline appears from this angled rear perspective
- BACK FIT: How the garment fits across the shoulders, back, and waist from behind`;
    } else if (viewAngle === "ghost") {
      viewSpecificGarmentInstruction = `
VIEW-SPECIFIC DETAILS (GHOST MANNEQUIN / INVISIBLE MANNEQUIN - no visible model):
This is a GHOST MANNEQUIN shot. The garment must appear THREE-DIMENSIONAL and shaped as if worn by an invisible person — inflated/filled out with natural body volume, but with NO visible human, mannequin, or body parts.
Your prompt must EMPHASIZE:
- 3D FORM: The garment must have realistic volume and shape as if worn, NOT flat or collapsed
- NECKLINE/COLLAR: The neckline or collar opening should reveal the hollow interior, showing inner construction, labels, or lining
- SHOULDER SHAPE: Natural shoulder line and drape as if resting on invisible shoulders
- SLEEVE SHAPE: Sleeves must hang or curve naturally as if arms are inside them
- BODY CONTOUR: The torso area should show natural fit and fabric tension
- HEMLINE: Clean, natural hemline falling as it would when worn
- FABRIC DRAPE: Natural wrinkles, folds, and fabric behavior from gravity
- CONSTRUCTION DETAILS: Seams, stitching, closures, pockets — all visible and crisp
- LIGHTING: Professional studio lighting that accentuates the 3D form and fabric texture
- SHADOW: Subtle shadow beneath the garment suggesting it floats or is worn by an invisible form
CRITICAL: There must be ZERO visible human body parts, skin, hands, neck, face, or mannequin structure. The garment appears self-supporting and three-dimensional, as if worn by a completely invisible person.`;
    }
  }

  // === FRAMING / CROP INSTRUCTIONS ===
  let framingInstruction = "";
  if (framing === "product-only") {
    framingInstruction = `
FRAMING: PRODUCT ONLY (No Human Model)
This is a PRODUCT-ONLY shot. There is NO human model in this image. The image shows ONLY the footwear product against the background. The shoe(s) should be the SOLE subject of the image, well-lit, with the full product visible. The camera is at the appropriate angle for this view. Ensure the product fills the frame appropriately with professional studio-quality composition.`;
  } else if (framing === "feet-closeup") {
    framingInstruction = `
FRAMING: FEET CLOSE-UP (Extreme Detail of Feet Wearing Footwear)
This is an extreme close-up shot showing ONLY the feet and ankles of the model wearing the footwear. The frame should capture from approximately mid-calf or ankle down to the ground/sole. This is a detail shot focused on how the footwear looks when worn - the fit around the foot, the interaction with the ground, and all product details at close range.`;
  } else if (framing === "full-body") {
    framingInstruction = `
FRAMING: FULL BODY (Head to Toe)
The image must show the COMPLETE model from head to toe, including feet and footwear. The entire length of the ${isFootwear ? "outfit" : "garment"} must be visible. Leave some breathing room above the head and below the feet. No part of the body should be cropped.`;
  } else if (framing === "three-quarter") {
    framingInstruction = `
FRAMING: THREE-QUARTER BODY (Head to Below Knee)
The image should frame the model from the top of the head to just below the knees (approximately 75% of the body). The lower calves and feet are NOT visible. This framing is ideal for showing the complete garment length for most tops, dresses, and how pants/skirts drape through the thigh and knee area.`;
  } else if (framing === "mid-thigh") {
    framingInstruction = `
FRAMING: MID-THIGH / COWBOY SHOT (Head to 2 cm Below the Bottomwear's Gusset)
★★★ CRITICAL FRAMING BOUNDARY RULES — NON-NEGOTIABLE ★★★

This is a tightly controlled "cowboy shot" framing with a PRECISE, MATHEMATICALLY ANCHORED lower crop line. The lower boundary of the image MUST NOT fluctuate between generations — it is pegged to a specific anatomical landmark.

UPPER BOUNDARY (TOP EDGE OF IMAGE):
- The top of the frame includes the model's full head with a small amount of breathing room above.

LOWER BOUNDARY (BOTTOM EDGE OF IMAGE) — PRECISE ANATOMICAL ANCHOR:
- The bottom of the frame MUST cut off EXACTLY 2 cm (approximately 0.8 inches — roughly one finger-width) BELOW the GUSSET of the bottomwear.
- The GUSSET is the point on pants / shorts / jeans / trousers where the four garment seams converge at the crotch — i.e., the junction where the front rise seam, back rise seam, and left + right inseams meet. It sits directly at the top of the inner-thigh area.
- If the model is wearing a garment without a visible gusset (e.g., a dress, long top, jumpsuit where the gusset is hidden, or a skirt), use the EQUIVALENT anatomical landmark: 2 cm below the natural crotch point / pubic symphysis line (the crease where the torso meets the thighs, on the body's centerline).
- Expressed anatomically, the crop line sits on the VERY UPPER THIGH — a narrow band of thigh fabric / leg is visible immediately below the gusset, and nothing more.

ABSOLUTE EXCLUSIONS (these NEVER appear in the frame):
- The KNEES — not even partially.
- The MIDDLE THIGH and LOWER THIGH (the half of the thigh closer to the knee).
- Calves, shins, ankles, feet, shoes — NONE of these may appear.

CONSISTENCY RULE — NON-NEGOTIABLE:
- The vertical crop point MUST remain pegged to the SAME anatomical landmark (2 cm below the bottomwear gusset / crotch point) across EVERY generation using this framing, regardless of whether the model is standing still, shifting weight, walking, posing with a hand on the hip, arms crossed, or in any other pose. The crop does NOT drift up toward the hip or down toward the knee between images.
- This mathematical anchor guarantees a uniform, catalog-consistent lower edge when many outputs are placed side by side.

WHAT MUST BE VISIBLE:
- Full head and face
- Complete upper body (shoulders, arms, torso)
- Full hip region and the full waistband / waist of any bottomwear
- The gusset / crotch area of any bottomwear, PLUS a narrow ~2 cm band of fabric (or skin, for very short bottomwear) immediately below it

PURPOSE: A compact, mathematically consistent "cowboy shot" that shows the complete garment on the torso and the very top of the thighs — enough context for fit and silhouette, with a lower crop line that never wanders between images.`;
  } else if (framing === "waist-up") {
    framingInstruction = `
FRAMING: WAIST-UP (Head to Lower Ribcage — Lower Boundary STRICTLY ABOVE the Waistline)
★★★ CRITICAL FRAMING BOUNDARY RULES — NON-NEGOTIABLE ★★★

UPPER BOUNDARY (TOP EDGE OF IMAGE):
- The top of the frame includes the model's full head with a small amount of breathing room above.

LOWER BOUNDARY (BOTTOM EDGE OF IMAGE) — ABSOLUTE AND FIXED:
- The bottom of the frame MUST cut off STRICTLY ABOVE the model's natural waistline — anchored at the LOWER RIBCAGE / UPPER ABDOMEN level, roughly 2–3 inches (5–7 cm) ABOVE the navel.
- The NAVEL, BELLY BUTTON, natural WAISTLINE (the narrowest point of the torso), WAISTBAND of any bottomwear, HIP CREASE, and HIP BONES must NEVER be visible — not even partially.
- For tucked or short tops: the crop ends at the lower ribcage, well before the top's hem would show.
- For longer tops: the crop still ends at the lower ribcage; the garment simply continues out of frame below.

CONSISTENCY RULE — NON-NEGOTIABLE:
- The vertical crop point MUST remain pegged to the SAME anatomical landmark (lower ribcage / upper abdomen, STRICTLY ABOVE the natural waistline) across EVERY generation using this framing, regardless of pose, stance, or garment length. This guarantees a uniform, catalog-consistent lower edge across the entire batch — the crop never drifts down to expose the waist or waistband.

WHAT MUST BE VISIBLE:
- Full head and face
- Complete shoulder line, chest / bust, upper and mid torso down to (but not past) the lower ribcage
- Arms, fully or partially depending on the pose

WHAT MUST NOT BE VISIBLE:
- The natural waistline (narrowest point of the torso)
- The navel / belly button
- The waistband of any bottomwear, belt, or hip-level accessory
- Any bottomwear (pants, skirt, jeans, shorts) at all
- Hip crease, hip bones, or anything below the upper abdomen

PURPOSE: A medium close-up that showcases necklines, collars, sleeves, bust fit, upper garment construction, prints, and fabric texture — while keeping the waist, waistband, bottomwear, and hips ENTIRELY out of frame.`;
  } else if (framing === "bust-up" && pose.id === "front-neckline-bust") {
    framingInstruction = `
FRAMING: HEADLESS NECKLINE DETAIL CROP (Lower Chin to Mid-Chest — STRICTLY ABOVE the Waistline)
★★★ CRITICAL IMAGE BOUNDARY RULES — NON-NEGOTIABLE ★★★

This is a HEADLESS e-commerce detail crop focused entirely on the neckline, collar construction, and upper-torso fit of the garment. The model's face is intentionally and completely excluded from every generation. The lower boundary is locked ABOVE the waistline so the image stays purely in the neckline / chest zone.

BODY ORIENTATION (NON-NEGOTIABLE):
- The model's body is SQUARE TO THE CAMERA — a true frontal orientation, rotated 0 degrees about the vertical axis. The collarbones, chest line, and shoulder line all run parallel to the image plane.
- Both shoulders are at the SAME distance from the camera (symmetric shoulder line). The neckline / collar opening is centered and symmetrical in the frame.
- The torso is NOT rotated, angled, or turned — no three-quarter, no profile, no tilt. Any rotation of the body would pull the neckline off-axis and is forbidden.

UPPER BOUNDARY (TOP EDGE OF IMAGE):
- The top of the frame cuts at the LOWER CHIN / JAWLINE. A sliver of the jawline and the underside of the jaw may be visible, but absolutely NO mouth, NO nose, NO eyes, NO forehead, NO hair, NO crown of the head.
- The crop is HEADLESS in every single generation — this is non-negotiable.

LOWER BOUNDARY (BOTTOM EDGE OF IMAGE) — STRICTLY ABOVE THE WAISTLINE:
- The bottom of the frame MUST cut off STRICTLY ABOVE the model's natural waistline. Anchor: mid-to-lower chest, roughly at the level of the lower sternum / mid-ribcage.
- The NAVEL, BELLY BUTTON, lower abdomen, natural waistline (narrowest point of the torso), waistband of any bottomwear, and HIP region must NEVER be visible — not even partially.
- As a landmark: the lower edge sits between the collarbone and the bottom of the ribcage — several inches ABOVE the navel.

VISIBLE AREA (summary): lower chin / jawline → neck → collarbone → full neckline / collar of the garment → upper-to-mid chest. That's the entire content of the frame.

ABSOLUTE EXCLUSIONS (these NEVER appear in the frame):
- Face (mouth, nose, eyes, forehead, ears, hair, crown of the head)
- The complete head / full face
- Natural waistline, navel, lower abdomen
- Waistband, belt, hips, or any bottomwear
- Anything at or below the waistline

CONSISTENCY RULE — NON-NEGOTIABLE:
- The TOP edge stays pegged at the lower chin (headless) and the BOTTOM edge stays pegged STRICTLY ABOVE the waistline (mid-to-lower chest) across EVERY generation. The crop does not drift in either direction between images.

PURPOSE: A clean, repeatable headless close-up dedicated entirely to the neckline and upper garment construction. Every image in a batch must share an identical framing: headless top, above-the-waist bottom.`;
  } else if (framing === "bust-up") {
    framingInstruction = `
FRAMING: BUST-UP / CLOSE-UP (Chest and Above)
This is a CLOSE-UP shot showing only the upper chest, neck, and head area. Focus on fine details: neckline construction, collar shape, fabric texture, stitching quality, button/closure detail, print clarity up close, and embellishment craftsmanship. This is a detail-oriented shot for showcasing garment quality.`;
  } else if (framing === "hip-down") {
    framingInstruction = `
FRAMING: LOWER BODY (Hip to Feet)
The image should frame ONLY the lower body from the hip/waist area down to the feet. The upper body above the hip/waist is NOT visible or only barely visible at the very top edge. ${isFootwear ? "The FOOTWEAR is the HERO of this shot - it must be prominently visible and detailed at the bottom of the frame, with complementary clothing/pants providing context above." : "This framing puts the LOWER BODY GARMENT as the hero - emphasize waistband, belt loops, pockets, fly, thigh fit, knee break, taper, hemline, and how the garment interacts with footwear."}`;
  } else if (framing === "knee-down") {
    framingInstruction = `
FRAMING: KNEE-DOWN (Knee to Feet)
The image should show ONLY the area from the knee down to the feet. ${isFootwear ? "The FOOTWEAR is the absolute HERO of this shot. Show extreme detail of the shoe on the foot, how the pant/sock interacts with the shoe, and every detail of the footwear construction, material, and branding." : "This is an extreme lower-body detail shot. Focus on: pant leg taper below the knee, hem/cuff detail, ankle fit, pant break on shoes, cropped length accuracy, and how the garment hem pairs with footwear."} The upper body and thighs are NOT visible.`;
  } else if (framing === "waist-to-thigh") {
    framingInstruction = `
FRAMING: BOTTOMWEAR CLOSE-UP DETAIL SHOT (Waist-to-Thigh Crop)
★★★ CRITICAL IMAGE BOUNDARY RULES — NON-NEGOTIABLE ★★★

This is a TIGHT CLOSE-UP e-commerce detail shot showing ONLY the bottomwear garment on the model's body. The image must be cropped so that ONLY the garment and a thin strip of surrounding skin are visible.

UPPER BOUNDARY (TOP EDGE OF IMAGE):
- The top of the frame must start JUST ABOVE the waistband of the bottomwear — approximately 1–2 inches of bare skin above the waistband may be visible, but absolutely NOTHING higher.
- The model's NAVEL/BELLY BUTTON must NOT be visible.
- The model's STOMACH, CHEST, RIBCAGE, HEAD, FACE, NECK, SHOULDERS — NONE of these may appear.
- Think of it as: the very top of the image barely includes the lower abdomen skin right above where the garment sits.

LOWER BOUNDARY (BOTTOM EDGE OF IMAGE):
- The bottom of the frame must end ABOVE THE KNEES. The garment hem (or the thigh skin just below a short garment's hem) is the lowest visible element.
- The model's KNEES must NOT be visible — not even partially.
- The model's CALVES, SHINS, FEET — NONE of these may appear.
- For shorter garments (shorts, boxers, underwear): show the hem and at most 1–2 inches of upper thigh skin below the hem, but NEVER reach the knee.
- For longer garments (jeans, trousers, long pants): the garment fabric fills most of the lower frame, cutting off at mid-thigh to upper-thigh level.

SIDE BOUNDARIES:
- The model's HANDS may be naturally visible at the sides (hanging at rest, lightly touching thighs, or thumbs hooked in pockets/waistband).
- The arms above the wrist should NOT be visible.

WHAT MUST BE VISIBLE AND IN FOCUS:
- The ENTIRE waistband area: elastic, drawstring, button, fly, belt loops, zipper, snap closure — whatever the garment has
- The full hip and seat area as covered by the garment
- The thigh area showing fit, drape, and fabric behavior
- The garment's hemline (for shorts/boxers) or mid-thigh fabric (for full-length pants)
- All construction details: stitching, seams, pocket openings, rivets, branding/logos, fabric texture, print/pattern

PURPOSE: This is a GARMENT-ONLY detail shot for e-commerce. The viewer's attention must be 100% on the bottomwear product. The tight crop eliminates all distracting body parts (face, torso, legs) and forces focus onto the garment's design, construction, fit, and fabric.

This framing must produce the SAME style of crop regardless of whether the garment is jeans, chinos, shorts, boxers, underwear, a skirt, leggings, joggers, or any other bottomwear type. The crop boundaries (just above waistband → just above knees) remain FIXED and ABSOLUTE.`;
  } else if (framing === "cropped-shot") {
    framingInstruction = `
FRAMING: E-COMMERCE BOTTOMWEAR CROPPED SHOT (Below Chest to Just Below Knee)
★★★ CRITICAL IMAGE BOUNDARY RULES — NON-NEGOTIABLE ★★★

This is a mid-body CROPPED SHOT typical of e-commerce bottomwear photography. The image captures the model from below the chest to just below the knees. The bottomwear garment is the HERO PRODUCT and must be fully visible and in sharp focus.

UPPER BOUNDARY (TOP EDGE OF IMAGE):
- The top of the frame starts at the LOWER RIBCAGE / UPPER ABDOMEN area — roughly 2–4 inches BELOW the chest line (below the pectorals for men, below the bust for women).
- The ABDOMEN and NAVEL area MUST be visible (bare skin or covered by a complementary top — whichever is natural).
- The model's CHEST, SHOULDERS, NECK, FACE, and HEAD must be COMPLETELY OUT OF FRAME — absolutely NONE of these may appear, not even partially.
- If a complementary top garment is present, the lower portion of it may be visible (e.g., the hem of a t-shirt, the bottom of a crop top), but the top edge of the frame must still cut BELOW the chest line.

LOWER BOUNDARY (BOTTOM EDGE OF IMAGE):
- The bottom of the frame ends JUST BELOW THE KNEES — approximately 2–4 inches below the kneecap.
- The KNEES themselves MUST be visible in the frame.
- The model's CALVES (below mid-calf), SHINS, ANKLES, and FEET must be COMPLETELY OUT OF FRAME.
- For shorter garments (shorts, boxers, underwear, mini skirts): the hem is visible, plus bare thigh/knee skin below the hem, cutting off just below the knee.
- For longer garments (jeans, trousers, joggers): the fabric covers the knee area, and the frame cuts off just below where the knee fabric sits.

SIDE BOUNDARIES:
- The model's HANDS and WRISTS may be naturally visible (hanging at sides, resting on hips, thumbs hooked in waistband/pockets).
- The FOREARMS and upper arms should be mostly OUT OF FRAME or only minimally visible at the extreme edges.

WHAT MUST BE VISIBLE AND IN FOCUS:
- The FULL WAISTBAND area: elastic, drawstring, branded waistband, button, fly, belt loops, zipper — whatever the garment has
- The COMPLETE HIP AND SEAT AREA as covered by the garment
- The FULL THIGH area showing fit, drape, and fabric behavior from waist to knee
- The KNEE AREA — this is a key differentiator from the "Close-Up Shot" framing; here the knees ARE visible
- The garment's hemline (for shorts/boxers/underwear) OR the knee-level fabric (for full-length pants)
- All construction details: stitching, seams, pockets, rivets, branding/logos, fabric texture, print/pattern
- ABDOMEN / LOWER TORSO skin or lower portion of any complementary top garment

BODY VISIBLE IN FRAME (summary):
✅ Lower ribcage / upper abdomen (bare or covered by complementary top hem)
✅ Full abdomen and navel area
✅ Full waist and hip area
✅ Full thighs
✅ Knees (including just below kneecap)
❌ Chest / pectorals / bust — NOT visible
❌ Shoulders, neck, face, head — NOT visible
❌ Lower calves, shins, ankles, feet — NOT visible

PURPOSE: This is a standard e-commerce bottomwear crop shot that shows the garment in context on a real body, with enough surrounding anatomy (abdomen above, knees below) to convey fit, proportion, and styling — while keeping the bottomwear as the undeniable hero product. It provides MORE body context than the tight "Close-Up Shot" (waist-to-thigh) but LESS than a full-body or three-quarter shot.

This framing must produce the SAME style of crop regardless of whether the garment is jeans, chinos, shorts, boxers, briefs, underwear, a skirt, leggings, joggers, cargo pants, or any other bottomwear type. The crop boundaries (below chest → just below knees) remain FIXED and ABSOLUTE.`;
  } else if (framing === "ghost-mannequin") {
    framingInstruction = `
FRAMING: GHOST MANNEQUIN / INVISIBLE MANNEQUIN (No Visible Model)
This is a GHOST MANNEQUIN shot — the garment must appear three-dimensional, shaped and inflated as if worn by an invisible person. There is NO visible human model, NO mannequin structure, NO body parts of any kind.

KEY REQUIREMENTS:
- The garment must have realistic 3D volume — it should look "filled out" from inside, as if a person is wearing it but is completely invisible
- The neckline/collar area should appear open, potentially revealing the hollow interior or inner lining
- Sleeves should hang or curve naturally as if invisible arms are inside
- The overall silhouette must look natural and true to how the garment fits when worn
- Professional e-commerce studio lighting, typically on a clean white or neutral background
- The full garment should be visible and well-lit, filling the frame appropriately
- Subtle shadow beneath the garment to ground it in the scene

CRITICAL: ZERO visible human body, skin, hands, feet, neck, or mannequin parts. The garment appears completely self-supporting as if worn by a totally invisible person.`;
  }

  // === GARMENT-TYPE / FOOTWEAR-TYPE SPECIFIC EMPHASIS ===
  let garmentTypeInstruction = "";

  if (isFootwear) {
    const fwLabel = FOOTWEAR_TYPE_OPTIONS.find((f) => f.value === footwearType)?.label || footwearType;
    garmentTypeInstruction = `
PRODUCT TYPE EMPHASIS (FOOTWEAR - ${fwLabel}):
The hero product is FOOTWEAR (${fwLabel}). Your prompt must give MAXIMUM detail to:
- UPPER: Material (leather, suede, mesh, canvas, synthetic, knit), texture, color, panels, overlays
- TOE: Shape (round, pointed, square, almond, open), cap toe, reinforcement
- HEEL: Type (flat, low, mid, high, stiletto, block, wedge, platform), height, material, construction
- SOLE/OUTSOLE: Material (rubber, leather, EVA), color, tread pattern, thickness
- MIDSOLE: Cushioning, visible technology, color, thickness
- CLOSURE: Lacing (type, color, eyelets), straps, buckles, zippers, slip-on, velcro, elastic
- COLLAR/TOPLINE: Opening shape, padding, lining visible at top
- TONGUE: Material, padding, branding
- INSOLE: If visible, material, cushioning, branding
- COLORWAY: Exact color blocking, gradient, accent colors
- STITCHING: Color, style (contrast, tonal), visible construction methods
- HARDWARE: Eyelets, D-rings, hooks, buckles, zippers - material and color

═══════════════════════════════════════════════════════════════
 BRANDING & LOGO PRESERVATION — BRAND-BLIND APPROACH (MOST CRITICAL)
═══════════════════════════════════════════════════════════════
★★★ CRITICAL: DO NOT IDENTIFY THE BRAND BY NAME ★★★

You MUST describe every branding element PURELY as abstract visual shapes and graphics. NEVER name the brand (e.g., do NOT write "Nike Swoosh", "Adidas Stripes", "Puma Cat", "New Balance N"). Instead, describe them as unnamed geometric/visual elements.

For EACH branding element visible in the reference images, describe:

1. VISUAL SHAPE: The exact geometric form (e.g., "a curved checkmark-shaped graphic", "three parallel diagonal stripes", "a leaping feline silhouette", "a stylized letter-shaped overlay") — describe the SHAPE you see, not the brand it belongs to
2. RENDERING STYLE: How it is applied (embossed, debossed, printed, stitched, reflective, rubberized, metallic, perforated, woven, heat-pressed)
3. COLOR(S): Exact color of the mark — if multi-colored, describe each color zone
4. SIZE: Approximate size relative to the shoe surface it sits on (e.g., "spans roughly 60% of the lateral panel width")
5. PLACEMENT: Exact position — which surface (lateral side, medial side, tongue, heel counter, toe box, sole, pull tab) and precise location on that surface
6. TEXT/WORDMARKS: If text is visible, describe the EXACT letterforms, font style (sans-serif, bold, italic, uppercase), letter spacing, color, and position — but treat it as visual text, not as a brand identifier
7. MULTIPLE MARKS: If branding appears in MULTIPLE locations, describe EACH instance separately with full detail — a shoe may have different marks on different surfaces; describe ONLY what you see in the reference images

WHY BRAND-BLIND: The image generator has world knowledge of brand logos and will substitute its own version if it recognizes a brand name. By describing branding as abstract visual elements, the generator is forced to copy ONLY what appears in the reference images rather than hallucinating from its training data.

THE IMAGE GENERATOR MUST REPRODUCE ALL VISUAL MARKS WITH 100% FIDELITY:
- Copy ONLY from the provided reference images — NEVER from world knowledge
- ZERO changes to shape, proportions, or design of any visual mark
- ZERO changes to color or opacity
- ZERO changes to position or placement
- ZERO changes to any text letterforms or typography
- ZERO omission of any visible mark
- ZERO addition of marks not present in the reference images
- If the reference images show a specific logo variant, use THAT EXACT variant — brands have multiple logo versions; only the one in the photos matters

Any deviation from the reference images is a CRITICAL FAILURE.
═══════════════════════════════════════════════════════════════`;
  } else if (garmentType === "topwear") {
    garmentTypeInstruction = `
GARMENT TYPE EMPHASIS (TOPWEAR - the primary garment is worn on the upper body):
The hero garment is a TOP (shirt, t-shirt, blouse, jacket, sweater, vest, etc.). Your prompt must give MAXIMUM detail to:
- Neckline shape and depth
- Sleeve length and sleeve construction (cuff, hem, rolled, etc.)
- Front and back closure details
- Shoulder seam placement and shape
- Body/torso fit and drape
- Fabric texture and weight
- Print, pattern, or color placement on the upper body
- Hemline of the top (where it falls - cropped, waist, hip, tunic length)
Any bottomwear visible in the frame is secondary/complementary - describe it briefly but do NOT make it the focus.`;
  } else if (garmentType === "bottomwear") {
    garmentTypeInstruction = `
GARMENT TYPE EMPHASIS (BOTTOMWEAR - the primary garment is worn on the lower body):
The hero garment is a BOTTOM (pants, jeans, trousers, skirt, shorts, etc.). Your prompt must give MAXIMUM detail to:
- Waistband style (flat, elastic, paperbag, high-rise, mid-rise, low-rise)
- Rise height and waist fit
- Front fly and closure (button, zip, drawstring, hidden)
- Pocket style and placement (slash, welt, patch, cargo, coin pocket)
- Belt loops, belt detail if any
- Thigh fit (slim, straight, wide, tapered)
- Knee area (articulated, relaxed, distressed)
- Leg silhouette (straight, bootcut, flared, skinny, wide-leg, jogger)
- Hemline and cuff detail (raw hem, cuffed, tapered, cropped, full-length)
- Fabric texture, weight, and any distressing or wash detail
- Seam construction (flat-felled, side seams, inseam detail)
Any topwear visible in the frame is secondary/complementary - describe it briefly but do NOT make it the focus.`;
  } else if (garmentType === "onepiece") {
    garmentTypeInstruction = `
GARMENT TYPE EMPHASIS (ONE PIECE - the garment covers both upper and lower body):
The hero garment is a ONE PIECE (dress, jumpsuit, romper, overalls, etc.). Your prompt must give MAXIMUM detail to:
- Neckline and upper construction
- Bodice fit and structure
- Waistline treatment (defined, empire, dropped, natural, belted)
- Skirt/leg portion (A-line, straight, flared, pleated, gathered)
- Overall length (mini, knee, midi, maxi, full-length)
- Sleeve details if present
- Back detail (open back, zip, buttons)
- Fabric flow and movement
- Pattern placement across the full garment
- Transition from upper to lower body (seamline, waist seam, continuous)
Both upper and lower portions of the garment must be described with equal precision.`;
  }

  // Gender context for prompt analysis
  const genderLabel = gender === "male" ? "men's / masculine" : gender === "female" ? "women's / feminine" : "unisex / gender-neutral";

  // Build the system prompt differently for footwear vs clothing
  if (isFootwear) {
    const fwLabel = FOOTWEAR_TYPE_OPTIONS.find((f) => f.value === footwearType)?.label || footwearType;

    if (isCustomPose) {
      parts.push({
        text: `You are an expert e-commerce footwear photographer and prompt engineer. Your job is to analyze a custom pose/arrangement reference and write a PRECISE, DETERMINISTIC image generation prompt for Nano Banana 2 (gemini-3.1-flash-image-preview).

THE MODEL: The downstream image generator receives your text prompt AND the actual footwear product reference photos — but NOT the pose reference image${customPose.referenceImages.length > 1 ? "s" : ""}. Use clear, photographer-style sentences; lock the backdrop and relighting to the user's SCENE PARAMETERS so every output shares one consistent stage (no clutter bleeding from product photos).

${customPose.referenceImages.length > 0 ? `★★★ CRITICAL CHANNEL NOTICE ★★★
The pose reference image${customPose.referenceImages.length > 1 ? "s" : ""} provided below ${customPose.referenceImages.length > 1 ? "are" : "is"} visible to YOU ONLY. The image generator will NOT receive ${customPose.referenceImages.length > 1 ? "them" : "it"}. Your generated text prompt is the ONLY channel that carries pose, orientation, and composition information to the image generator. Therefore you MUST translate every relevant detail of the pose reference into explicit, measurable, photographer-grade English in your output prompt. If a detail is not in your text, the image generator cannot know it.

` : ""}PRODUCT: ${fwLabel} (${genderLabel} footwear)
SHOT TYPE: ${isProductOnlyShot ? "PRODUCT SHOT — No human model. The image shows ONLY the footwear product." : "MODEL SHOT — The footwear is shown being worn by a human model."}

═══ CUSTOM ${isProductOnlyShot ? "PRODUCT ARRANGEMENT" : "POSE"} ═══
${customPose.name ? `Name: "${customPose.name}"` : ""}
Description: "${customPose.description}"
${customPose.referenceImages.length > 0 ? `${customPose.referenceImages.length} reference image${customPose.referenceImages.length > 1 ? "s" : ""} provided below (for YOUR analysis only — not forwarded to the image generator).` : ""}

═══ CRITICAL: POSE EXTRACTION RULES ═══
${customPose.referenceImages.length > 0 ? `You must analyze the custom pose reference image${customPose.referenceImages.length > 1 ? "s" : ""} and extract a FOOTWEAR-AGNOSTIC and BACKGROUND-AGNOSTIC description. Because the image generator will not see the reference, your extracted description MUST be exhaustive and self-contained — reading your prompt alone, the generator should be able to reconstruct the exact pose/orientation without seeing the reference at all.

EXTRACT AND DESCRIBE (copy these from the reference, in dense detail):
- Camera angle (specify in DEGREES — e.g., "30-degree low angle looking up", "eye-level at 0 degrees", "75-degree top-down")
- Camera distance / framing (close-up, medium, wide) and the resulting crop boundaries (what enters the frame at top/bottom/left/right edges)
${isProductOnlyShot ? `- Product orientation: toe direction (toward camera / away / left / right), lateral vs medial side facing camera, heel orientation, sole angle relative to ground plane
- Product arrangement: single shoe or pair, relative spacing, stacking/leaning/floating/placement on surface, any tilt or rotation expressed in degrees
- Surface and contact: how the product meets the surface (flat, tipped, elevated, suspended) and any interaction with other objects` : `- Body position: full-body stance, weight distribution (which leg bears weight), hip angle, torso tilt, shoulder line, head/gaze direction, arm positions
- Lower-body geometry (most important for footwear): exact leg angles, knee bend, foot placement (parallel, staggered, one in front, heel lifted, on tiptoe, crossed, etc.), ankle angle, direction each foot points (in degrees relative to camera), which foot/feet are planted and which are lifted
- How the footwear presents to camera: lateral vs medial side visibility, toe direction, whether sole is visible and at what angle, whether the shoe is in motion / static / mid-step`}
- Compositional framing (what fills the frame, subject placement by rule-of-thirds/percentage, negative space distribution)
- Broad key-light *direction* only (e.g., frontal vs side key) — final exposure, color temperature, and bounce must match the USER's background in SCENE PARAMETERS, not the warm/cool cast of the pose reference's room

DO NOT TRANSFER (ignore these in the reference):
- The specific footwear/product visible (the user's ACTUAL product replaces it entirely)
- The specific background/environment (use the user's background specification below instead)
- Any branding, colors, patterns, or design elements of the reference product
- The specific model's identity (use the user's model selection instead)

Your extracted pose description must work identically for ANY footwear product placed into this composition, and must be detailed enough that a photographer could reproduce the shot from the text alone.` : "Use the text description above to determine the pose/arrangement. Specify all angles in degrees and describe the geometry exhaustively so the image generator can reproduce it from text alone."}

═══ MANDATORY PROMPT STRUCTURE ═══

1. OPENING LINE (verbatim):
   "A professional e-commerce product photograph of the exact footwear shown in the provided reference images. CRITICAL: Preserve the exact colors, materials, branding, shape, and design details of the provided input footwear."

2. ANGLE & ORIENTATION: A DENSE, SELF-CONTAINED paragraph extracted from the custom pose — specify camera angle in degrees, camera distance, footwear/body orientation, toe direction, sole visibility angle, and all geometric relationships needed to reconstruct the shot without any reference image.

3. FRAMING & COMPOSITION: Exact frame boundaries (what is cropped at each edge), subject placement (percentage or rule-of-thirds), negative space distribution, and overall compositional approach.

4. LIGHTING & SHADOW: Describe a clean, intentional relight (professional studio terms) that matches the USER's background from SCENE PARAMETERS — neutralize any color cast or messy shadow character from cluttered source product photos. Do not preserve on-location lighting cues from the product reference images.

5. BACKGROUND: Reproduce the user's background specification from SCENE PARAMETERS exactly and literally — same colors (repeat hex codes verbatim, e.g. #FFFFFF), same seamless/environmental intent. The pose reference background, the product photo backdrop, and any incidental environment in uploads must NOT appear. State clearly that the only valid environment is the user's specification.

${!isProductOnlyShot ? `6. MODEL & BODY POSITION: A DENSE paragraph capturing the exact body position, stance, weight distribution, leg angles, foot placement, and how the footwear meets the ground — extracted from the pose reference and written as complete text so the image generator needs no visual reference.` : ""}

${!isProductOnlyShot ? "7" : "6"}. STYLE & QUALITY (verbatim):
   "High-end commercial product photography, 8K resolution, photorealistic, ultra-sharp focus, macro-level texture detail, crisp edges, professional lighting aesthetic."

═══ RULES ═══
- Do NOT name any brand — the model will hallucinate incorrect logos
- Do NOT describe specific product details (colors, patterns, logos) from the reference — the actual product comes from separate reference photos
- The pose reference may show a DIFFERENT product — extract ONLY the pose/composition, discard the product identity entirely
- The pose reference is NOT forwarded to the image generator — your text must be complete enough on its own
- Product reference images may show cluttered real-world backgrounds — treat all non-footwear pixels as forbidden in the final scene; never transfer floors, props, walls, or color spill
- Use precise, measurable language: angles in degrees, positions as frame percentages
- Include verbatim: "Reproduce the footwear EXACTLY as shown in the reference images — every color, pattern, texture, material, construction detail, shape, and visual mark must be an exact copy."
${!isProductOnlyShot ? `- FOOTWEAR SCALE & FIT (MANDATORY — include this clause verbatim in the ANGLE & ORIENTATION or MODEL & BODY POSITION section of your output prompt): "The footwear must fit the model's feet with natural, realistic proportions — neither oversized nor undersized relative to the model's foot. The shoe length, width, and opening must match the model's foot size exactly, with the heel seated flush against the heel counter, the toes reaching the toe box naturally, and the upper wrapping the foot without gapping, bulging, or slippage. The ground contact and ankle line must look anatomically correct."` : ""}

${isProductOnlyShot ? "IMPORTANT: This is a PRODUCT-ONLY shot. Do NOT include any human model, feet, or body parts." : modelImage ? "A reference photo of the model is provided. Include: 'Use the EXACT person shown in the model reference image — same face, skin tone, hair, and body proportions.'" : ""}

Output ONLY the generation prompt text following the mandatory structure.`,
      });
    } else {
    parts.push({
      text: `You are an expert e-commerce footwear photographer and prompt engineer. Your job is to write a PRECISE, DETERMINISTIC image generation prompt for an AI model (Nano Banana 2 / gemini-3.1-flash-image-preview).

THE MODEL: The image generator is a multimodal model that receives BOTH your text prompt AND the actual footwear reference photos simultaneously. Your text prompt guides the scene, composition, and camera work while the reference photos define the product appearance.

YOUR GOAL: Write a generation prompt that will produce the EXACT same image every time it is run — no ambiguity, no creative latitude, no subjective interpretation. Every sentence must be precise and measurable.

PROMPTING FOR gemini-3.1-flash-image-preview (multimodal image): Use tight, photographer-style sentences per section — clear scene intent beats keyword dumps. For BACKGROUND and LIGHTING, be specific enough that every shoe in a batch gets the same stage (identical backdrop color/temperature, same shadow policy); match light quality and color temperature to the stated environment so the subject looks photographed IN that environment, not cut out of an old one.

PRODUCT: ${fwLabel} (${genderLabel} footwear)
${isProductOnlyShot ? "SHOT TYPE: PRODUCT-ONLY — No human model. The image shows ONLY the footwear product." : `SHOT TYPE: ON-MODEL — The footwear is shown being worn by a ${model ? model.name + " (" + model.description + ")" : modelImage ? "the provided model reference" : gender === "unisex" ? "model" : gender + " model"}.`}

THE POSE/VIEW: "${viewAngle}" (${pose.name} — ${pose.description})
Camera captures from the ${viewAngle.replace("-", " ")} perspective.
${framingInstruction}
${viewSpecificGarmentInstruction}

═══ MANDATORY PROMPT STRUCTURE ═══
Your output prompt MUST follow this EXACT labeled structure. Do not skip, merge, or reorder sections:

1. OPENING LINE (include this verbatim as the first sentence):
   "A professional e-commerce product photograph of the exact footwear shown in the provided reference images. CRITICAL: Preserve the exact colors, materials, branding, shape, and design details of the provided input footwear."

2. ANGLE & ORIENTATION:
   - Specify the EXACT camera angle using degrees (e.g., "perfect side profile at 90 degrees to the camera", "45-degree three-quarter front view")
   - Specify footwear orientation: which direction the toe points (left, right, toward camera, away from camera), sole alignment (flat on ground plane, angled, visible)
   - For product-only: specify single shoe or pair, and their exact arrangement
   - Use NUMERIC precision — never vague terms like "nice angle" or "good position"

3. FRAMING & COMPOSITION:
   - Specify exact placement in frame (dead center, offset left by rule-of-thirds, etc.)
   - Specify negative space: "generous pure white negative space around the entire product" or "product fills 85% of frame"
   - Describe the minimalist/commercial composition approach
   - Specify what is included and excluded from the frame

4. LIGHTING & SHADOW:
   - Specify the exact lighting setup using photography terminology (e.g., "soft, highly diffused, even studio lighting from above and front at 45 degrees")
   - Relight the footwear for the USER's stated background — do not carry over color cast, bounce light, or shadow shapes from cluttered product reference photos
   - Specify shadow behavior precisely (e.g., "very subtle, soft, narrow drop shadow directly underneath the sole to ground the product — no long cast shadows")
   - Specify highlight quality (e.g., "gentle highlights on material textures without blown-out hotspots")
   - Specify what must be eliminated (e.g., "eliminate harsh shadows on the product itself")

5. BACKGROUND:
   - Copy the user's background specification from SCENE PARAMETERS verbatim for any color values (e.g. repeat #FFFFFF exactly if given) — use the SAME backdrop description across every pose in this job so all outputs match
   - For studio: specify the EXACT background (e.g., "Pure, seamless, pristine white background (#FFFFFF). Absolutely no props, no scenery, and no context.")
   - For environmental: describe every element with precision — surface material, colors, atmosphere, depth of field
   - Include SEMANTIC NEGATIVES: forbid any element from the original product photo's setting (old floor texture, shelves, outdoor ground, props, horizon clutter). The only valid environment is the user's specification

${!isProductOnlyShot ? `6. MODEL & ON-FOOT DETAILS:
   - Describe the model's exact stance, weight distribution, leg positions, body angle
   - Specify what body parts are visible in this framing
   - Describe how the footwear interacts with the ground/surface` : ""}

${!isProductOnlyShot ? "7" : "6"}. STYLE & QUALITY (include this verbatim as the closing):
   "High-end commercial product photography, 8K resolution, photorealistic, ultra-sharp focus, macro-level texture detail, crisp edges, minimalist, professional studio lighting aesthetic."

═══ RULES ═══
- Do NOT name any brand (Nike, Adidas, Puma, New Balance, etc.) — the model will hallucinate incorrect logos
- Do NOT describe specific product colors, patterns, logos, branding, or construction details — the reference photos are the absolute source of truth for product appearance
- Product reference images may contain messy real-world backdrops — those regions are NOT part of the product; instruct the generator to ignore them completely and never composite them into the output
- You MAY mention the general footwear type (${fwLabel}) and general material category (e.g., "leather", "canvas", "mesh")
- Your prompt must be DETERMINISTIC — use precise, measurable language: angles in degrees, percentages for frame fill, specific color codes for backgrounds, photography terminology for lighting
- Keep each section to 1-2 focused sentences — total prompt should be concise and directive, not flowery
- Do NOT add creative flourishes, artistic interpretations, or variable/random elements
- Every detail you specify must be reproducible across multiple generations
${!isProductOnlyShot ? `- FOOTWEAR SCALE & FIT (MANDATORY — include this clause verbatim in the ANGLE & ORIENTATION or MODEL & ON-FOOT DETAILS section of your output prompt): "The footwear must fit the model's feet with natural, realistic proportions — neither oversized nor undersized relative to the model's foot. The shoe length, width, and opening must match the model's foot size exactly, with the heel seated flush against the heel counter, the toes reaching the toe box naturally, and the upper wrapping the foot without gapping, bulging, or slippage. The ground contact and ankle line must look anatomically correct."` : ""}

${!isProductOnlyShot && modelImage ? "A reference photo of the model is provided. Include in your prompt: 'Use the EXACT person shown in the model reference image — same face, skin tone, hair, and body proportions.'" : ""}

Output ONLY the generation prompt text following the mandatory structure — no preamble, no explanation, no metadata.`,
    });
    }
  } else {
    // Clothing system prompt
    if (isCustomPose) {
      parts.push({
        text: `You are an expert fashion photographer and prompt engineer specializing in Virtual Try-On (VTON) image generation. Your job is to analyze garment images and create a HIGHLY detailed, photorealistic prompt for an AI image generation model (Gemini Nano Banana 2 / gemini-3.1-flash-image-preview).

GARMENT GENDER CONTEXT: This is a ${genderLabel} garment. Use this context to inform your analysis of the garment's design language, fit conventions, styling cues, silhouette proportions, and detail descriptions. For example, ${gender === "male" ? "men's garments typically have broader shoulder seams, straighter cuts, functional pockets, and more structured silhouettes" : gender === "female" ? "women's garments may feature more varied necklines, darting for bust shape, tapered waists, and more diverse silhouette options" : "unisex garments tend to have relaxed proportions, minimal darting, and neutral styling cues that work across body types"}.${isProductOnlyShot ? "" : ` Ensure the model used in the output aligns with this gender context${model ? "" : modelImage ? "" : ` - select a ${gender === "unisex" ? "model of any gender" : gender} model`}.`}

SHOT TYPE: ${isGhostMannequin ? "GHOST MANNEQUIN SHOT — This is a GHOST/INVISIBLE MANNEQUIN shot. The garment must appear three-dimensional and shaped as if worn by an invisible person — inflated with natural body volume, but with NO visible human, mannequin parts, or body parts. The garment appears self-supporting." : isProductOnlyShot ? "PRODUCT SHOT — This is a PRODUCT-ONLY shot. There is NO human model in this image. The image shows ONLY the garment product laid out, styled on a flat surface, or displayed on a mannequin/hanger. Focus entirely on showcasing the product with professional studio-quality composition." : "MODEL SHOT — The garment will be shown on a human model."}

═══ CUSTOM POSE ═══
The user has described a CUSTOM ${isProductOnlyShot ? "PRODUCT ARRANGEMENT" : "POSE"} instead of selecting a preset. Use their description as the primary ${isProductOnlyShot ? "product arrangement and camera" : "pose and camera"} direction.
${customPose.name ? `${isProductOnlyShot ? "Arrangement" : "Pose"} Name: "${customPose.name}"` : ""}
${isProductOnlyShot ? "Product Arrangement" : "Pose"} Description: "${customPose.description}"
${customPose.referenceImages.length > 0 ? `\nReference images for this custom ${isProductOnlyShot ? "arrangement" : "pose"} are provided below. Analyze them carefully to understand the exact ${isProductOnlyShot ? "product placement, styling, camera angle, and composition" : "body position, camera angle, framing, and composition"} the user wants. Replicate the ${isProductOnlyShot ? "arrangement" : "pose"} from the reference images as closely as possible.

★★★ CRITICAL CHANNEL NOTICE ★★★
The pose reference image${customPose.referenceImages.length > 1 ? "s" : ""} ${customPose.referenceImages.length > 1 ? "are" : "is"} visible to YOU ONLY. The downstream image generator will NOT receive ${customPose.referenceImages.length > 1 ? "them" : "it"}. Your generated text prompt is the ONLY channel that carries pose, orientation, and composition information to the image generator. Therefore you MUST translate every relevant detail of the pose reference into explicit, measurable, photographer-grade English in your output prompt. If a detail is not in your text, the image generator cannot know it. Produce a dense, self-contained ${isProductOnlyShot ? "arrangement" : "pose"} paragraph that a photographer could reproduce from the text alone — exact camera angle in degrees, camera distance/framing, body/product geometry, limb angles, weight distribution, head/gaze direction, foot placement, and how the subject fills the frame.` : ""}

Based on the custom ${isProductOnlyShot ? "arrangement" : "pose"} description${customPose.referenceImages.length > 0 ? " and reference images" : ""}, determine:
- The camera angle (front, side, back, three-quarter, top-down, etc. — specify in degrees)
- The framing (${isProductOnlyShot ? "full product, close-up detail, etc." : "full-body, waist-up, etc."})
- Which garment details would be most visible from this angle and framing
Then describe those visible garment details with maximum precision. Describe the pose/arrangement geometry itself with equal precision so the image generator can reconstruct it from the text alone.

${garmentTypeInstruction}

CRITICAL ACCURACY REQUIREMENTS - Your prompt MUST describe these garment details with EXACT precision based on the provided images:
1. SLEEVE LENGTH: Describe the exact sleeve length as observed (sleeveless, cap sleeve, short sleeve, elbow length, three-quarter, full length, etc.). DO NOT change or assume the sleeve length.
2. NECKLINE: Describe the exact neckline (crew neck, V-neck, scoop, collar, mandarin, off-shoulder, etc.)
3. HEMLINE & LENGTH: Describe exactly where the garment ends (cropped, waist-length, hip-length, knee-length, full-length, etc.)
4. FABRIC & TEXTURE: Describe the fabric type, weight, and texture (cotton, silk, denim, knit, sheer, etc.)
5. COLOR & PATTERN: Describe exact colors, prints, patterns, stripes, checks, florals, etc.
6. CONSTRUCTION DETAILS: Buttons, zippers, pockets, pleats, seams, embroidery, embellishments, logos
7. FIT: ${fit ? `**CRITICAL OVERRIDE** - The user has explicitly selected "${fit}" fit. DO NOT infer or guess the fit from the garment images. You MUST describe the garment as "${fit}" fit in the prompt regardless of how the garment appears in the reference photos. The "${fit}" fit means: "${FIT_OPTIONS.find(f => f.value === fit)?.description || fit}". Use this exact fit description - never substitute words like "oversized", "loose", "slim", etc. unless that is the user's actual selected fit.` : `No specific fit was selected by the user. Analyze the garment images and determine the most appropriate fit description (slim, regular, relaxed, oversized, tailored, loose, bodycon, boxy, etc.) based on what you observe in the reference photos.`}
8. SILHOUETTE: Overall shape and drape of the garment

LIGHTING DIRECTIVE (MANDATORY — apply to ALL clothing VTON outputs):
Unless the user's background description explicitly calls for different lighting, the output prompt MUST include this exact lighting description:
"Shot with high-key commercial studio lighting — flat, even illumination directly facing the subject. Strong fill lighting lifts all shadows, producing a low-contrast, bright, airy look with extremely soft shadow roll-off and absolutely no harsh shadows under the chin, on the face, neck, body, or garment. The overall feel is clean, bright, and evenly lit."
- Do NOT deviate from this high-key flat lighting description across poses — every output must use the same lighting language.
- Do NOT mention specific lighting equipment names (softbox, octabox, reflector, strobe, ring light, beauty dish, etc.) — describe ONLY the resulting light quality.

${!isProductOnlyShot && !isGhostMannequin ? CLOTHING_VTON_REALISM_DIRECTIVE : ""}

${!isProductOnlyShot && !isGhostMannequin ? CLOTHING_VTON_POSING_DIRECTIVE : ""}

${fit ? `The prompt MUST instruct the image generator to faithfully reproduce every visual detail from the provided garment images (sleeve length, neckline, color, pattern, fabric texture, construction details). However, the FIT/SIZING of the garment${isProductOnlyShot ? "" : " on the model's body"} MUST follow the user's selection of "${fit}" fit, NOT your visual interpretation of the images.` : `The prompt MUST instruct the image generator to faithfully reproduce every detail from the provided garment images. Emphasize that the garment details must match the reference images exactly.`}

${isProductOnlyShot ? "IMPORTANT: This is a PRODUCT-ONLY shot. Do NOT include any human model, mannequin body, or person in the generated image. Show ONLY the garment product." : modelImage ? "A reference photo of the model is provided. The prompt must instruct the generator to use the EXACT same person from this reference photo - same face, skin tone, hair, and body proportions." : ""}

Output ONLY the generation prompt text, nothing else. The prompt should be 3-5 paragraphs, extremely descriptive, suitable for professional e-commerce fashion photography.`,
      });
    } else {
    parts.push({
      text: `You are an expert fashion photographer and prompt engineer specializing in Virtual Try-On (VTON) image generation. Your job is to analyze garment images and create a HIGHLY detailed, photorealistic prompt for an AI image generation model (Gemini Nano Banana 2 / gemini-3.1-flash-image-preview).

GARMENT GENDER CONTEXT: This is a ${genderLabel} garment. Use this context to inform your analysis of the garment's design language, fit conventions, styling cues, silhouette proportions, and detail descriptions. For example, ${gender === "male" ? "men's garments typically have broader shoulder seams, straighter cuts, functional pockets, and more structured silhouettes" : gender === "female" ? "women's garments may feature more varied necklines, darting for bust shape, tapered waists, and more diverse silhouette options" : "unisex garments tend to have relaxed proportions, minimal darting, and neutral styling cues that work across body types"}.${isProductOnlyShot ? "" : ` Ensure the model used in the output aligns with this gender context${model ? "" : modelImage ? "" : ` - select a ${gender === "unisex" ? "model of any gender" : gender} model`}.`}

THE POSE VIEW ANGLE IS: "${viewAngle}" (${pose.name} - ${pose.description})
This means the camera will capture the garment from the ${viewAngle === "ghost" ? "specified ghost mannequin" : viewAngle.replace("-", " ")} perspective. Your prompt MUST describe the garment details that would be VISIBLE from this specific angle.
${framingInstruction}
${garmentTypeInstruction}

CRITICAL ACCURACY REQUIREMENTS - Your prompt MUST describe these garment details with EXACT precision based on the provided images:
1. SLEEVE LENGTH: Describe the exact sleeve length as observed (sleeveless, cap sleeve, short sleeve, elbow length, three-quarter, full length, etc.). DO NOT change or assume the sleeve length.
2. NECKLINE: Describe the exact neckline (crew neck, V-neck, scoop, collar, mandarin, off-shoulder, etc.)
3. HEMLINE & LENGTH: Describe exactly where the garment ends (cropped, waist-length, hip-length, knee-length, full-length, etc.)
4. FABRIC & TEXTURE: Describe the fabric type, weight, and texture (cotton, silk, denim, knit, sheer, etc.)
5. COLOR & PATTERN: Describe exact colors, prints, patterns, stripes, checks, florals, etc.
6. CONSTRUCTION DETAILS: Buttons, zippers, pockets, pleats, seams, embroidery, embellishments, logos
7. FIT: ${fit ? `**CRITICAL OVERRIDE** - The user has explicitly selected "${fit}" fit. DO NOT infer or guess the fit from the garment images. You MUST describe the garment as "${fit}" fit in the prompt regardless of how the garment appears in the reference photos. The "${fit}" fit means: "${FIT_OPTIONS.find(f => f.value === fit)?.description || fit}". Use this exact fit description - never substitute words like "oversized", "loose", "slim", etc. unless that is the user's actual selected fit.` : `No specific fit was selected by the user. Analyze the garment images and determine the most appropriate fit description (slim, regular, relaxed, oversized, tailored, loose, bodycon, boxy, etc.) based on what you observe in the reference photos.`}
8. SILHOUETTE: Overall shape and drape of the garment
${viewSpecificGarmentInstruction}

IMPORTANT FRAMING RULE: The image MUST be framed exactly as specified in the FRAMING instruction above. If the framing says "waist-up", do NOT show the lower body. If the framing says "hip-down", do NOT show the upper body above the hip. If the framing says "full-body", the COMPLETE model from head to toe must be visible. The framing determines what portion of the model/garment is visible in the final image.

${!isProductOnlyShot && !isGhostMannequin ? CLOTHING_VTON_POSING_DIRECTIVE : ""}

LIGHTING DIRECTIVE (MANDATORY — apply to ALL clothing VTON outputs):
Unless the user's background description explicitly calls for different lighting, the output prompt MUST include this exact lighting description:
"Shot with high-key commercial studio lighting — flat, even illumination directly facing the subject. Strong fill lighting lifts all shadows, producing a low-contrast, bright, airy look with extremely soft shadow roll-off and absolutely no harsh shadows under the chin, on the face, neck, body, or garment. The overall feel is clean, bright, and evenly lit."
- Do NOT deviate from this high-key flat lighting description across poses — every output must use the same lighting language.
- Do NOT mention specific lighting equipment names (softbox, octabox, reflector, strobe, ring light, beauty dish, etc.) — describe ONLY the resulting light quality.

${!isProductOnlyShot && !isGhostMannequin ? CLOTHING_VTON_REALISM_DIRECTIVE : ""}

${fit ? `The prompt MUST instruct the image generator to faithfully reproduce every visual detail from the provided garment images (sleeve length, neckline, color, pattern, fabric texture, construction details). However, the FIT/SIZING of the garment on the model's body MUST follow the user's selection of "${fit}" fit, NOT your visual interpretation of the images. The garment images are flat-lay or mannequin shots - you cannot reliably determine intended body fit from them. Always use the user-specified fit: "${fit}".` : `The prompt MUST instruct the image generator to faithfully reproduce every detail from the provided garment images. Emphasize that the garment details must match the reference images exactly - no modifications to sleeve length, neckline, color, pattern, or any construction detail. For the fit, use your best judgment based on what you observe in the garment images.`}

${modelImage ? "A reference photo of the model is provided. The prompt must instruct the generator to use the EXACT same person from this reference photo - same face, skin tone, hair, and body proportions." : ""}

Output ONLY the generation prompt text, nothing else. The prompt should be 3-5 paragraphs, extremely descriptive, suitable for professional e-commerce fashion photography.`,
    });
    }
  }

  // Add model reference image if provided (only for on-model shots)
  if (modelImage && !isProductOnlyShot) {
    parts.push({
      text: `\n\nHere is the reference photo of the model to use. The generated image must feature this EXACT person:`,
    });
    const modelBase64 = await fileToBase64(modelImage.file);
    parts.push({
      inlineData: {
        mimeType: modelImage.file.type,
        data: modelBase64,
      },
    });
  }

  // Add custom pose reference images
  if (customPose && customPose.referenceImages.length > 0) {
    parts.push({
      text: `\n\nHere are the POSE REFERENCE images (${customPose.referenceImages.length} image${customPose.referenceImages.length > 1 ? "s" : ""}). The model must replicate this exact pose, body position, camera angle, and framing:`,
    });
    for (const img of customPose.referenceImages) {
      const base64 = await fileToBase64(img.file);
      parts.push({
        inlineData: {
          mimeType: img.file.type,
          data: base64,
        },
      });
    }
  }

  // Add product images
  const hasBackViewImage = garmentImages.some((img) => img.isBackView);
  const isBackViewPose = viewAngle === "back" || viewAngle === "three-quarter-back";

  if (isFootwear) {
    const hasFootwearSideLabel = garmentImages.some((img) => img.footwearSide);
    parts.push({
      text: `\n\n═══ FOOTWEAR PRODUCT REFERENCE (${garmentImages.length} image${garmentImages.length > 1 ? "s" : ""}) ═══\nThese images show the actual product in real photography conditions. The image generator will also receive them as the source of truth for the SHOES ONLY.

THOROUGH ANALYSIS, STRICT SEGMENTATION:
1. Examine each image in full — silhouette, stance in frame, visible panels, sole orientation — only to plan composition and camera-relative placement compatible with the requested pose.
2. Treat everything that is NOT the footwear (floor, carpet, shelves, props, walls, outdoor ground, bags, boxes, limbs, shadows cast by the room, color spill from nearby objects, sensor noise patterns tied to the old scene) as NON-TRANSFERABLE. Never mention or imply those elements in your output prompt.
3. The legacy backdrop in these photos is CONTAMINATION, not a style reference. The final image environment must come ONLY from the user's background specification in SCENE PARAMETERS below (or the inspiration image, if provided).
4. Do NOT describe specific colors, logos, patterns, branding, or construction details in your prompt — the image generator copies product appearance directly from these photos; long textual product descriptions cause substitutions instead of copying.${hasFootwearSideLabel ? `

POSITIONAL SIDE LABELS — AUTHORITATIVE:
Some of the images below are tagged with a positional label ([MEDIAL SIDE], [LATERAL SIDE], [SOLE]). These labels are AUTHORITATIVE and define which physical side of the footwear each image depicts.
- MEDIAL SIDE = the inner-facing side of the shoe (faces the opposite foot when worn).
- LATERAL SIDE = the outer-facing side of the shoe (faces away from the opposite foot).
- SOLE = the bottom / outsole.
When writing the output prompt, NEVER swap, mirror, or conflate these sides. If a branding mark, stripe, logo, or panel is visible on the [LATERAL SIDE] image, the generated shoe must show that mark on its outer (lateral) side — not on its medial side. Do not claim a detail is on the medial side if the reference only shows it on the lateral image, and vice versa. Do NOT mention specific side-specific details in the prompt text; the image generator will read the labels directly.` : ""}`,
    });
  } else {
    let garmentIntro = `\n\nHere are the ${garmentType} garment images to try on (${garmentImages.length} image${garmentImages.length > 1 ? "s" : ""} of the same product). ANALYZE EVERY DETAIL - sleeve length, neckline, color, pattern, fabric, construction:`;
    if (hasBackViewImage && isBackViewPose) {
      garmentIntro += `\n\n★★★ BACK-VIEW IMAGE IDENTIFIED ★★★\nThe user has marked one of the following images as the BACK VIEW of the garment. For this back-view pose, you MUST base your description of the garment's back side EXCLUSIVELY on the image labelled "[BACK VIEW]". Do NOT apply front-side patterns, prints, graphics, or design elements to the back — the back may be completely different (plain, different print, different color). Only describe what is actually visible in the back-view reference image.`;
    }
    parts.push({ text: garmentIntro });
  }

  // Sort so back-view image comes first for back-view poses, with clear labelling
  const sortedGarmentImages = hasBackViewImage && isBackViewPose && !isFootwear
    ? [...garmentImages].sort((a, b) => (a.isBackView ? -1 : 0) - (b.isBackView ? -1 : 0))
    : garmentImages;

  const anyFootwearSideLabeled = isFootwear && sortedGarmentImages.some((img) => img.footwearSide);
  for (const img of sortedGarmentImages) {
    if (hasBackViewImage && !isFootwear) {
      parts.push({ text: img.isBackView ? "\n[BACK VIEW — This is the authoritative reference for the back of the garment]:" : "\n[FRONT / OTHER ANGLE]:" });
    }
    if (anyFootwearSideLabeled) {
      const sideLabel =
        img.footwearSide === "medial"
          ? "\n[MEDIAL SIDE — inner-facing side of the footwear, faces the opposite foot]:"
          : img.footwearSide === "lateral"
          ? "\n[LATERAL SIDE — outer-facing side of the footwear, faces away from the opposite foot]:"
          : img.footwearSide === "sole"
          ? "\n[SOLE — bottom / outsole of the footwear]:"
          : "\n[ADDITIONAL ANGLE — unlabeled reference]:";
      parts.push({ text: sideLabel });
    }
    const base64 = await fileToBase64(img.file);
    parts.push({
      inlineData: {
        mimeType: img.file.type,
        data: base64,
      },
    });
  }

  // Add complementary images if any (skip for ghost mannequin — only the hero garment is shown)
  if (complementaryImages.length > 0 && !isGhostMannequin) {
    parts.push({
      text: `\n\nHere are complementary garment/accessory images to include in the outfit. These must also be reproduced with exact detail:`,
    });
    for (const img of complementaryImages) {
      const base64 = await fileToBase64(img.file);
      parts.push({
        inlineData: {
          mimeType: img.file.type,
          data: base64,
        },
      });
      parts.push({ text: `(${img.label})` });
    }
  } else if (complementaryImages.length === 0 && !isFootwear && !isGhostMannequin && !isProductOnlyShot && garmentType === "topwear") {
    // Default complementary bottomwear rule for topwear when user has not uploaded any
    const needsLowerBody = framing === "full-body" || framing === "three-quarter" || framing === "mid-thigh" || framing === "hip-down" || framing === "knee-down";
    if (needsLowerBody) {
      parts.push({
        text: `\n\nDEFAULT COMPLEMENTARY BOTTOMWEAR (no complementary garment was uploaded):
Since the user has not provided a complementary bottom, you MUST pair the topwear with pants using this STRICT color rule:
- If the topwear is LIGHT-colored (white, cream, beige, pastel, light grey, yellow, light pink, light blue, etc.) → pair with SOLID BLACK slim-fit pants/trousers. The pants must be plain solid black with no patterns.
- If the topwear is DARK-colored (black, navy, dark grey, dark green, dark brown, burgundy, etc.) → pair with LIGHT BLUE slim-fit jeans/denim pants. The jeans must be a classic light wash blue denim.
This complementary bottomwear must remain EXACTLY the same across all generated images — do NOT vary the pants between poses. They are a consistent styling choice. The pants are secondary to the hero topwear garment.`,
      });
    }
  }

  // Add accessories
  if (accessories.length > 0) {
    const presetWithImages = accessories.filter((a) => a.category !== "custom" && a.image);
    const presetAIChosen = accessories.filter((a) => a.category !== "custom" && !a.image);
    const customAccessories = accessories.filter((a) => a.category === "custom");

    let accessoryInstruction = `\n\nACCESSORIES TO INCLUDE IN THE OUTFIT:\n`;

    if (presetAIChosen.length > 0) {
      const aiChosenLabels = presetAIChosen.map((a) => {
        const catInfo = ACCESSORY_CATEGORIES.find((c) => c.value === a.category);
        return catInfo ? catInfo.label : a.category;
      });
      accessoryInstruction += `\n═══ STYLE-MATCHING RULE FOR AI-CHOSEN ACCESSORIES ═══
First, analyze the primary garment's style category from the reference images (formal/business, casual/everyday, ethnic/traditional, streetwear/urban, sportswear/athletic, luxury/designer, bohemian, minimalist, etc.).
Then select accessories that are STYLISTICALLY COHERENT with that garment style:
  - FORMAL garments (suits, blazers, dress shirts) → classic/refined accessories (oxford shoes, leather belt, cufflinks, silk tie, minimal watch)
  - ETHNIC/TRADITIONAL garments (kurta, saree, lehenga, sherwani) → traditional accessories (juttis, kolhapuri chappals, jhumka earrings, kundan jewelry, mojari, ethnic clutch)
  - CASUAL garments (t-shirts, jeans, hoodies) → relaxed accessories (sneakers, canvas belt, casual watch, beanie)
  - STREETWEAR (graphic tees, cargo pants, oversized hoodies) → urban accessories (chunky sneakers, bucket hat, chain necklace, crossbody bag)
  - SPORTSWEAR (activewear, track pants, jerseys) → athletic accessories (sports shoes, sport watch, headband, gym bag)
  - LUXURY/DESIGNER garments → premium accessories (designer shoes, statement jewelry, leather goods)
  - BOHEMIAN garments → artisan accessories (woven sandals, beaded jewelry, fringe bag, layered necklaces)

The following accessories should be AI-chosen to complement the garment:\n- ${aiChosenLabels.join("\n- ")}

For each AI-chosen accessory, describe it with SPECIFIC detail in the prompt: exact material, color, style variant, and placement. The description must be DETERMINISTIC — use precise terms, not vague ones.\n`;
    }

    if (customAccessories.length > 0) {
      accessoryInstruction += `\n═══ CUSTOM ACCESSORIES (USER-SPECIFIED) ═══\n`;
      for (const acc of customAccessories) {
        if (acc.customDescription && acc.image) {
          accessoryInstruction += `\n- CUSTOM ACCESSORY: "${acc.customDescription}" — EXACT reference image provided below. Reproduce this accessory with PRECISE fidelity matching both the description and the reference image.`;
        } else if (acc.customDescription) {
          accessoryInstruction += `\n- CUSTOM ACCESSORY: "${acc.customDescription}" — No reference image. Generate this accessory as described, ensuring it complements the garment's style.`;
        } else if (acc.image) {
          accessoryInstruction += `\n- CUSTOM ACCESSORY: Reference image provided below. Reproduce this exact accessory with precise fidelity.`;
        }
      }
    }

    if (presetWithImages.length > 0) {
      accessoryInstruction += `\n\nThe following accessories have EXACT reference images provided. The generated image must reproduce these accessories with PRECISE fidelity - same design, color, material, and proportions:`;
    }

    if (applyAccessoriesToAllPoses) {
      accessoryInstruction += `\n\n═══ CRITICAL ACCESSORY CONSISTENCY (MULTI-POSE BATCH) ═══
This image is part of a multi-pose batch where the SAME accessories must appear IDENTICAL across EVERY pose.
For AI-chosen accessories: describe each with ULTRA-SPECIFIC detail (exact material, exact color with hex code if possible, exact style variant, exact proportions). Use these EXACT descriptions word-for-word — do NOT vary, reinterpret, or introduce creative alternatives between poses. Every pose in this batch must render the same accessory items with pixel-level consistency.
For reference-image accessories: reproduce the exact same accessory across all poses.`;
    }

    const allWithImages = [...presetWithImages, ...customAccessories.filter((a) => a.image)];
    if (allWithImages.length > 0) {
      parts.push({ text: accessoryInstruction });
      for (const acc of allWithImages) {
        const catInfo = ACCESSORY_CATEGORIES.find((c) => c.value === acc.category);
        const label = acc.category === "custom"
          ? (acc.customDescription ? `CUSTOM: ${acc.customDescription}` : "CUSTOM ACCESSORY")
          : (catInfo ? catInfo.label : acc.category);
        if (acc.image) {
          const base64 = await fileToBase64(acc.image.file);
          parts.push({ text: `\n[${label.toUpperCase()} - use this EXACT accessory]:` });
          parts.push({
            inlineData: {
              mimeType: acc.image.file.type,
              data: base64,
            },
          });
        }
      }
    } else {
      parts.push({ text: accessoryInstruction });
    }
  }

  // Background details — per-pose custom background overrides the global setting
  let bgInstruction = "";
  if (customPose?.customBackground) {
    bgInstruction = `Background/environment description (CUSTOM FOR THIS POSE — DETERMINISTIC): ${customPose.customBackground}\nBACKGROUND LOCK: Reproduce this description VERBATIM in every output prompt — identical wording, identical colors, identical elements. Do NOT paraphrase, add synonyms, introduce creative variations, or reinterpret. If colors are specified, repeat them as exact hex/RGB values. Every pose in this batch must share a pixel-identical backdrop.`;
  } else if (background.mode === "inspiration" && background.inspirationImage) {
    parts.push({
      text: `\n\nHere is the inspiration image for the background/environment:`,
    });
    const bgBase64 = await fileToBase64(background.inspirationImage.file);
    parts.push({
      inlineData: {
        mimeType: background.inspirationImage.file.type,
        data: bgBase64,
      },
    });
    bgInstruction = "Use the provided inspiration image as reference for the background/environment style. BACKGROUND LOCK: Describe the inspiration image's environment in FIXED, DETERMINISTIC terms — specify exact colors (hex codes), surface materials, atmospheric qualities, and spatial layout. Use the SAME description word-for-word for every pose in this batch so all outputs share one consistent backdrop. Do NOT introduce creative variations or synonym swaps between poses.";
  } else if (background.textDescription) {
    bgInstruction = `Background/environment description (DETERMINISTIC — reproduce EXACTLY): ${background.textDescription}\nBACKGROUND LOCK: This text is a FIXED SPECIFICATION — copy it into every output prompt VERBATIM. Do NOT paraphrase, swap synonyms, add creative embellishments, or reinterpret the scene. If colors are mentioned (e.g. "warm beige", "soft grey"), lock them to specific hex values (e.g. warm beige → #F5F0E8, soft grey → #E8E8E8) and reuse those EXACT hex codes in every pose. Every image in this batch must render the SAME backdrop.`;
  } else {
    bgInstruction = isFootwear
      ? "Use a clean e-commerce studio background: seamless cyclorama, no props or location clutter. Default to seamless pure white (#FFFFFF) unless the user specifies a different backdrop in Additional Instructions or Product Info."
      : "Use a clean, professional e-commerce photography studio background.";
  }

  if (isFootwear) {
    bgInstruction +=
      "\nFOOTWEAR SOURCE-PHOTO RULE: The product images may show cluttered floors, shelves, or outdoor surfaces. That environment is INVALID for the output — build the scene solely from this background specification (and the inspiration image above if provided).";
  }

  // Build accessories summary for parameters
  let accessoriesSummary = "";
  if (accessories.length > 0) {
    const lines = accessories.map((a) => {
      if (a.category === "custom") {
        const desc = a.customDescription ? `"${a.customDescription}"` : "custom accessory";
        return a.image
          ? `  - CUSTOM (${desc}): reference image + description provided`
          : `  - CUSTOM (${desc}): described by user, AI generates to match garment style`;
      }
      const catInfo = ACCESSORY_CATEGORIES.find((c) => c.value === a.category);
      const label = catInfo ? catInfo.label : a.category;
      return a.image
        ? `  - ${label}: EXACT reference image provided (must match precisely)`
        : `  - ${label}: AI-chosen (select style-complementary match for the garment)`;
    });
    accessoriesSummary = `Accessories:\n${lines.join("\n")}`;
    if (applyAccessoriesToAllPoses) {
      accessoriesSummary += `\n  ★ CONSISTENCY MODE: These EXACT same accessories must appear identically in ALL poses of this batch.`;
    }
  }

  // Final instruction with all parameters
  const framingLabel = framing.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (isFootwear) {
    const fwLabel = FOOTWEAR_TYPE_OPTIONS.find((f) => f.value === footwearType)?.label || footwearType;
    const poseDescription = isCustomPose
      ? `CUSTOM: "${customPose.name || "Unnamed"}" — ${customPose.description}${customPose.referenceImages.length > 0 ? ` (${customPose.referenceImages.length} reference image${customPose.referenceImages.length > 1 ? "s" : ""} provided)` : ""}`
      : `${pose.name} - ${pose.description}`;
    parts.push({
      text: `\n\n--- SCENE PARAMETERS ---
Product: ${fwLabel} (${genderLabel})
Shot Type: ${isProductOnlyShot ? "PRODUCT ONLY (no human model)" : "ON-MODEL"}
${!isProductOnlyShot ? (model ? `Model: ${model.name} - ${model.description}` : modelImage ? "Model: Use the provided model reference image (EXACT same person)" : `Model: Select a ${gender === "unisex" ? "model" : gender + " model"}`) : ""}
Pose: ${poseDescription}
${!isCustomPose ? `Framing: ${framingLabel} (${pose.framing})` : ""}
Aspect Ratio: ${aspectRatio}
${bgInstruction}
${accessoriesSummary}
${productInfo ? `Product Info: ${productInfo}` : ""}
${additionalInfo ? `Additional Instructions: ${additionalInfo}` : ""}

═══ BACKGROUND LOCK (FOOTWEAR — READ CAREFULLY) ═══
The product reference photos may be taken on cluttered floors, shelves, or outdoor surfaces. That is NOISE: your output prompt must instruct the image generator to extract ONLY the footwear and to build a brand-new scene where the ENTIRE environment (backdrop, floor plane, walls, air, global light) matches ONLY the background line above (or the inspiration image if one was provided). Repeat any hex/RGB color the user gave verbatim in the Background section. For one generation batch, use identical backdrop wording for every pose — no synonym swapping, no "creative variation" between images.

═══ FINAL REMINDERS ═══
1. Follow the MANDATORY PROMPT STRUCTURE: your output must contain labeled sections (Angle & Orientation, Framing & Composition, Lighting & Shadow, Background, ${!isProductOnlyShot ? "Model & Body Position, " : ""}Style & Quality).
2. Use DETERMINISTIC language: specific angles in degrees, exact positions, photography terminology, color codes for backgrounds.
3. The OPENING LINE must be verbatim: "A professional e-commerce product photograph of the exact footwear shown in the provided reference images. CRITICAL: Preserve the exact colors, materials, branding, shape, and design details of the provided input footwear."
4. The CLOSING must include verbatim: "High-end commercial product photography, 8K resolution, photorealistic, ultra-sharp focus, macro-level texture detail, crisp edges."
5. Do NOT describe specific product details (colors, logos, patterns) — the image generator has the actual photos.
6. Do NOT name any brand.
7. In LIGHTING and BACKGROUND, explicitly forbid importing any pixel of the original product-photo setting (old surfaces, props, color spill).
${accessories.length > 0 ? `\nACCESSORY NOTE: For accessories with reference images, instruct exact reproduction. For AI-chosen accessories, analyze the footwear style and select accessories that are STYLISTICALLY COHERENT (e.g., formal shoes pair with refined accessories, athletic shoes with sporty gear, ethnic footwear with traditional items). Describe each AI-chosen accessory with specific material, color, and style details.${applyAccessoriesToAllPoses ? " CONSISTENCY: Use IDENTICAL accessory descriptions word-for-word — no creative variation between poses." : ""}${accessories.some((a) => a.category === "custom") ? " For custom-described accessories, follow the user's description precisely while ensuring garment-style coherence." : ""}` : ""}

Now write the footwear image generation prompt following the mandatory structure.`,
    });
  } else {
    const clothingPoseDescription = isCustomPose
      ? `CUSTOM: "${customPose.name || "Unnamed"}" — ${customPose.description}${customPose.referenceImages.length > 0 ? ` (${customPose.referenceImages.length} reference image${customPose.referenceImages.length > 1 ? "s" : ""} provided)` : ""}`
      : `${pose.name} - ${pose.description}`;
    parts.push({
      text: `\n\n--- GENERATION PARAMETERS ---
Gender: ${genderLabel}
Garment Type: ${garmentType}
Garment Fit: ${fit ? `${fit} (${FIT_OPTIONS.find(f => f.value === fit)?.label || fit} - ${FIT_OPTIONS.find(f => f.value === fit)?.description || fit}) — USE THIS FIT, do NOT override with your own visual assessment` : "Not specified — analyze the garment images and determine the most appropriate fit"}
Shot Type: ${isGhostMannequin ? "GHOST MANNEQUIN (no visible model — garment shaped as if worn by invisible person)" : isProductOnlyShot ? "PRODUCT ONLY (no human model)" : "ON-MODEL"}
${!isProductOnlyShot ? (model ? `AI Model: ${model.name} - ${model.description}` : "AI Model: Use the provided model reference image as the person") : ""}
${!isProductOnlyShot && modelImage ? "Model Reference Image: PROVIDED (use the EXACT person from the reference photo - same face, skin tone, hair, body type)" : ""}
Pose: ${clothingPoseDescription}
${!isCustomPose ? `Framing: ${framingLabel} (${pose.framing})` : ""}
Aspect Ratio: ${aspectRatio}
${bgInstruction}
${accessoriesSummary}
${productInfo ? `Product Info: ${productInfo}` : ""}
${additionalInfo ? `Additional Instructions (AUTHORITATIVE USER INTENT — treat as primary direction for posture, expression, styling, mood, and any other cues it contains): ${additionalInfo}

★ ADDITIONAL INSTRUCTIONS HANDLING: If the text above contains guidance about posture, stance, gaze, head tilt, arm/hand positioning, facial expression, mood, or styling attitude, you MUST weave those cues DIRECTLY into the pose description in the output prompt (see NATURAL POSING & SUBTLE VARIATION DIRECTIVE). Do NOT paraphrase the intent away; reflect the user's specific words and intent in concrete, descriptive pose language. When the same guidance applies across many products, express it as a mood with subtle per-generation micro-variations in gaze, head tilt, arm/hand position, and expression — so each output reads as a distinct moment within the same mood.` : ""}

IMPORTANT: The generated prompt must explicitly instruct to preserve ALL garment visual details exactly as shown in the reference images (sleeve length, neckline, color, pattern, fabric texture, and all construction details).${fit ? ` For FIT, the prompt MUST describe the garment as "${fit}" fit (${FIT_OPTIONS.find(f => f.value === fit)?.description || fit}). Do NOT use any other fit descriptor (e.g., do not say "oversized" if the user selected "regular", do not say "slim" if the user selected "relaxed"). The user's fit selection is authoritative.` : ` For FIT, use your best judgment based on the garment images to describe how the garment should fit${isProductOnlyShot ? "" : " on the model"}.`}
${!isProductOnlyShot && !isGhostMannequin && !accessories.some(a => a.category === "shoes") ? `\nFOOTWEAR COLOR RULE: When footwear is visible in the frame, the shoes/footwear must NEVER be white or off-white. Always use a non-white color (black, tan, brown, navy, grey, etc.) that complements the outfit. This rule is absolute — no white sneakers, no white shoes of any kind.` : ""}
${isGhostMannequin ? "\nCRITICAL: This is a GHOST MANNEQUIN shot. The generated image must show the garment shaped as if worn by an invisible person — three-dimensional, filled with natural body volume, but with ZERO visible human body parts, skin, mannequin structure, or person. The garment appears completely self-supporting." : isProductOnlyShot ? "\nCRITICAL: This is a PRODUCT-ONLY shot. The generated image must show ONLY the garment product — NO human model, NO mannequin body, NO person. Focus entirely on the product." : ""}
${accessories.length > 0 ? `\nACCESSORY INSTRUCTION: For accessories with reference images, the prompt MUST instruct the image generator to reproduce the EXACT accessory shown - same design, material, color, and proportions. For AI-chosen accessories (no reference image), FIRST analyze the garment's style category (formal, casual, ethnic/traditional, streetwear, sportswear, luxury, bohemian, etc.) and then select accessories that are STYLISTICALLY COHERENT:
  - Formal garments → refined accessories (oxfords, leather belt, silk tie, cufflinks)
  - Ethnic/traditional garments → traditional accessories (juttis, kolhapuri chappals, jhumkas, kundan sets)
  - Casual garments → relaxed accessories (sneakers, canvas belt, casual watch)
  - Streetwear → urban accessories (chunky sneakers, chain, bucket hat)
  - Sportswear → athletic accessories (sport shoes, sport watch, headband)
Describe each AI-chosen accessory with SPECIFIC detail (exact material, color, style variant).${applyAccessoriesToAllPoses ? "\nCONSISTENCY: This is a multi-pose batch with identical accessories. Use EXACTLY the same accessory descriptions word-for-word across every pose — no synonym swapping, no creative variation." : ""}${accessories.some((a) => a.category === "custom") ? "\nFor custom-described accessories, follow the user's text description precisely while ensuring visual coherence with the garment style." : ""}` : ""}

Now write the ${isGhostMannequin ? "ghost mannequin" : isProductOnlyShot ? "product-only" : "VTON"} image generation prompt.`,
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: parts,
    config: {
      thinkingConfig: {
        thinkingLevel: isFootwear ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No prompt generated from Gemini 3.1 Pro");
  }

  const tokens = extractTokenUsage(response);
  const cost = computeStepCost("gemini-3.1-pro-preview", "Prompt Generation (Gemini 3.1 Pro)", tokens);

  return { text, cost };
}

/**
 * Step 2: Use Nano Banana 2 (gemini-3.1-flash-image-preview) to generate the VTON image
 */
type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export async function buildVTONImageContentParts({
  prompt,
  garmentImages,
  complementaryImages,
  accessories,
  modelImage,
  productCategory = "clothing",
  isProductOnlyShot = false,
  isGhostMannequin = false,
  isBackViewPose = false,
}: {
  prompt: string;
  garmentImages: GarmentImage[];
  complementaryImages: ComplementaryImage[];
  accessories: AccessoryItem[];
  modelImage: ModelImage | null;
  productCategory?: ProductCategory;
  isProductOnlyShot?: boolean;
  isGhostMannequin?: boolean;
  isBackViewPose?: boolean;
}): Promise<ContentPart[]> {
  const isFootwear = productCategory === "footwear";
  const parts: ContentPart[] = [];

  if (isFootwear) {
    const hasFootwearSideLabel = garmentImages.some((img) => img.footwearSide);
    // ═══ PRODUCT REFERENCE IMAGES — labeled and framed as source of truth ═══
    parts.push({
      text: `═══ PRODUCT REFERENCE IMAGES — ABSOLUTE SOURCE OF TRUTH ═══\n` +
        `The following ${garmentImages.length} image${garmentImages.length > 1 ? "s show" : " shows"} the EXACT footwear product to reproduce. ` +
        `Every visual detail ON THE FOOTWEAR ITSELF — colors, materials, textures, patterns, shape, silhouette, logos, branding marks, text, engravings, stitching, hardware, sole pattern, overlays, panels — MUST be preserved with 100% fidelity in the generated image. ` +
        `These reference photos are AUTHORITATIVE for the shoes ONLY and override any conflicting information.\n` +
        `SEGMENTATION: Many shots are catalog or phone photos on messy backgrounds. Silently IGNORE all non-footwear pixels (floors, walls, props, limbs, bags, outdoor ground, shelves, shadows cast by the room, environmental color cast). Do NOT composite, remember, or echo any part of those backgrounds in the output.\n` +
        `LOGO & BRANDING RULE: Copy every visual mark EXACTLY as it appears — same shape, same proportional size, same position, same orientation angle, same color, same rendering style (embossed/printed/stitched/etc.). ` +
        `Do NOT use world knowledge of any brand to modify, "correct", reposition, resize, or substitute any logo or branding element. Reproduce ONLY what is visible in these photos.${hasFootwearSideLabel ? `\n\nPOSITIONAL SIDE LABELS — AUTHORITATIVE (do NOT swap medial/lateral):\nEach image below is preceded by a label indicating which physical side of the footwear it depicts ([MEDIAL SIDE], [LATERAL SIDE], [SOLE], or [ADDITIONAL ANGLE]). These labels are the source of truth for side placement — branding, stripes, logos, panels, or any visual mark shown on a [MEDIAL SIDE] image must appear on the INNER (medial, facing the opposite foot) side of the generated shoe; marks on a [LATERAL SIDE] image must appear on the OUTER (lateral, facing away from the opposite foot) side. NEVER mirror, swap, or move side-specific details across sides. The [SOLE] image defines the bottom / outsole only.` : ""}`,
    });
    for (const img of garmentImages) {
      if (hasFootwearSideLabel) {
        const sideLabel =
          img.footwearSide === "medial"
            ? "\n[MEDIAL SIDE — inner side, faces the opposite foot]:"
            : img.footwearSide === "lateral"
            ? "\n[LATERAL SIDE — outer side, faces away from the opposite foot]:"
            : img.footwearSide === "sole"
            ? "\n[SOLE — bottom / outsole]:"
            : "\n[ADDITIONAL ANGLE — unlabeled reference]:";
        parts.push({ text: sideLabel });
      }
      const base64 = await fileToBase64(img.file);
      parts.push({ inlineData: { mimeType: img.file.type, data: base64 } });
    }
    parts.push({
      text: `═══ END PRODUCT REFERENCE — everything above defines the product identity ═══`,
    });

    // ═══ MODEL REFERENCE (if on-model shot) ═══
    if (modelImage && !isProductOnlyShot) {
      parts.push({
        text: `\n═══ MODEL REFERENCE — PERSON IDENTITY ═══\n` +
          `Generate this EXACT person — same face, skin tone, hair color/style, body type and proportions. ` +
          `This image defines ONLY the person's appearance. Do NOT copy footwear, clothing, or background from this image.`,
      });
      const modelBase64 = await fileToBase64(modelImage.file);
      parts.push({ inlineData: { mimeType: modelImage.file.type, data: modelBase64 } });
    }

    // ═══ COMPLEMENTARY OUTFIT ITEMS ═══
    if (!isGhostMannequin && complementaryImages.length > 0) {
      parts.push({
        text: `\n═══ COMPLEMENTARY OUTFIT ITEMS ═══\n` +
          `The following items complete the outfit. Reproduce them accurately alongside the footwear:`,
      });
      for (const img of complementaryImages) {
        const base64 = await fileToBase64(img.file);
        parts.push({ inlineData: { mimeType: img.file.type, data: base64 } });
      }
    }

    // ═══ ACCESSORY REFERENCE IMAGES ═══
    const accessoriesWithImages = accessories.filter((a) => a.image);
    if (accessoriesWithImages.length > 0) {
      parts.push({
        text: `\n═══ ACCESSORY REFERENCES ═══\nReproduce these accessories exactly as shown:`,
      });
      for (const acc of accessoriesWithImages) {
        if (acc.image) {
          const base64 = await fileToBase64(acc.image.file);
          parts.push({ inlineData: { mimeType: acc.image.file.type, data: base64 } });
        }
      }
    }

    // ═══ GENERATION PROMPT + MANDATORY FIDELITY REQUIREMENTS ═══
    parts.push({
      text: `\n═══ GENERATION INSTRUCTIONS ═══\n${prompt}\n\n` +
        `═══ BACKGROUND & ENVIRONMENT (gemini-3.1-flash-image-preview) ═══\n` +
        `The scene, backdrop, surfaces, atmosphere, and global lighting MUST follow ONLY the generation prompt text above (which encodes the user's intended environment). ` +
        `Treat the product reference photos as defining footwear identity only: ZERO transfer of their original location, flooring, walls, props, or spill light from those photos. ` +
        `Relight the footwear so it belongs in that described environment (shadow softness, color temperature, and wrap consistent with that backdrop).\n\n` +
        `═══ MANDATORY PRODUCT FIDELITY REQUIREMENTS ═══\n` +
        `The footwear in the generated image MUST be a pixel-accurate reproduction of the PRODUCT REFERENCE IMAGES provided above. This is non-negotiable:\n\n` +
        `• SHAPE & SILHOUETTE: Identical overall shape, proportions, toe box form, heel height, sole thickness, toe spring, profile curvature — zero deviation from reference\n` +
        `• COLORS & COLORWAY: Exact same color scheme, color blocking zones, accent colors, gradients, color transitions — no color shifts, no artistic reinterpretation\n` +
        `• MATERIALS & TEXTURES: Same material types (leather, suede, mesh, canvas, knit, rubber, EVA) with identical grain, weave, sheen, matte/gloss, surface quality\n` +
        `• LOGOS & BRANDING: Every visual mark (swooshes, stripes, symbols, emblems, wordmarks) must be IDENTICAL — same geometric shape, same proportional size relative to the shoe, same exact position on the shoe surface, same orientation angle, same color, same rendering style (embossed, debossed, printed, stitched, rubberized, reflective, perforated). Do NOT use world knowledge of any brand to substitute, resize, reposition, redesign, or "correct" any mark. Copy ONLY what the reference photos show\n` +
        `• TEXT & LETTERING: Any text on the footwear (tongue labels, heel tab, side panels, insole, size tags) must preserve the EXACT same letterforms, font style, font size, letter spacing, position, orientation, and color — do not change, omit, or hallucinate any text\n` +
        `• SOLE & ENGRAVINGS: Tread pattern, sole color, sole engravings, brand marks on the outsole must match reference exactly. Do NOT hallucinate new engravings, tread patterns, or sole markings that are not in the reference photos\n` +
        `• OVERLAYS & PANELS: Same panel shapes, overlay boundaries, material transition lines, mudguard shape — preserve the exact construction geometry\n` +
        `• HARDWARE: Same eyelets (count, material, color), buckles, zippers, hooks, D-rings, pull tabs — identical in every detail\n` +
        `• STITCHING: Same stitch color, stitch pattern, stitch density, and placement lines\n` +
        `• MEDIAL / LATERAL / SOLE ORIENTATION: When reference images are tagged with positional labels ([MEDIAL SIDE], [LATERAL SIDE], [SOLE]), the generated shoe MUST respect those labels exactly. Branding, stripes, logos, or panels shown on the MEDIAL image must appear ONLY on the medial (inner, facing the other foot) side of the rendered shoe; those on the LATERAL image ONLY on the lateral (outer) side; sole-only details ONLY on the outsole. Do NOT mirror, swap, flip, or hallucinate side placement across sides\n\n` +
        `Any deviation from the product reference images — even a subtle logo repositioning, color shift, added engraving, or side swap — is a CRITICAL FAILURE that invalidates the entire output.` +
        `${!isProductOnlyShot ? "\n\n═══ FOOTWEAR SCALE & FIT (ON-MODEL — MANDATORY) ═══\nThe footwear must fit the model's feet with natural, realistic proportions — neither oversized nor undersized relative to the model's foot. The shoe length, width, and opening must match the model's foot size exactly: heel seated flush against the heel counter, toes reaching the toe box naturally, and the upper wrapping the foot without gapping, bulging, or slippage. The sole must make correct ground contact and the ankle line must look anatomically correct. Do NOT render the shoes smaller or larger than the model's actual foot — this is a critical failure mode to avoid." : ""}` +
        `${!isProductOnlyShot && modelImage ? "\n\nMODEL IDENTITY: Generate the EXACT same person from the model reference image — same face, skin tone, hair color/style, and body type." : ""}` +
        `${isProductOnlyShot ? "\n\nPRODUCT-ONLY SHOT: No human model, feet, legs, or any body parts should appear in the generated image. Show ONLY the footwear product." : ""}`,
    });
  } else {
    const hasBackViewImg = garmentImages.some((img) => img.isBackView);
    let backViewSuffix = "";
    if (hasBackViewImg && isBackViewPose) {
      backViewSuffix = " CRITICAL: The first garment image provided below is the BACK VIEW of the garment. For this back-view pose, the garment's back must match ONLY that back-view reference — do NOT mirror front-side patterns, prints, or graphics onto the back.";
    }
    parts.push({
      text: `${prompt}\n\nIMPORTANT: The garment in the output must match the provided garment reference images EXACTLY - preserve the same sleeve length, neckline, hem length, color, pattern, fabric texture, and every construction detail. Do not modify any garment attributes.${isGhostMannequin ? " This is a ghost mannequin shot — the garment must appear three-dimensional and shaped as if worn by an invisible person. ZERO visible human body, skin, hands, mannequin structure, or person. The garment appears completely self-supporting." : isProductOnlyShot ? " This is a product-only shot — no human model, mannequin body, or person should be visible. Show ONLY the garment product." : modelImage ? " Use the provided model reference photo to generate the EXACT same person - same face, skin tone, hair color, and body type." : ""}${backViewSuffix}`,
    });
    if (modelImage && !isProductOnlyShot) {
      const modelBase64 = await fileToBase64(modelImage.file);
      parts.push({ inlineData: { mimeType: modelImage.file.type, data: modelBase64 } });
    }
    const orderedImages = hasBackViewImg && isBackViewPose
      ? [...garmentImages].sort((a, b) => (a.isBackView ? -1 : 0) - (b.isBackView ? -1 : 0))
      : garmentImages;
    for (const img of orderedImages) {
      const base64 = await fileToBase64(img.file);
      parts.push({ inlineData: { mimeType: img.file.type, data: base64 } });
    }
    if (!isGhostMannequin) {
      for (const img of complementaryImages) {
        const base64 = await fileToBase64(img.file);
        parts.push({ inlineData: { mimeType: img.file.type, data: base64 } });
      }
    }
    const accessoriesWithImages = accessories.filter((a) => a.image);
    for (const acc of accessoriesWithImages) {
      if (acc.image) {
        const base64 = await fileToBase64(acc.image.file);
        parts.push({ inlineData: { mimeType: acc.image.file.type, data: base64 } });
      }
    }
  }

  return parts;
}

export async function generateVTONImage({
  apiKey,
  prompt,
  garmentImages,
  complementaryImages,
  accessories,
  modelImage,
  aspectRatio,
  productCategory = "clothing",
  isProductOnlyShot = false,
  isGhostMannequin = false,
  isBackViewPose = false,
  imageSize = "2K",
}: {
  apiKey: string;
  prompt: string;
  garmentImages: GarmentImage[];
  complementaryImages: ComplementaryImage[];
  accessories: AccessoryItem[];
  modelImage: ModelImage | null;
  aspectRatio: AspectRatio;
  productCategory?: ProductCategory;
  isProductOnlyShot?: boolean;
  isGhostMannequin?: boolean;
  isBackViewPose?: boolean;
  imageSize?: "1K" | "2K" | "4K";
}): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const ai = new GoogleGenAI({ apiKey });

  const contents = await buildVTONImageContentParts({
    prompt,
    garmentImages,
    complementaryImages,
    accessories,
    modelImage,
    productCategory,
    isProductOnlyShot,
    isGhostMannequin,
    isBackViewPose,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("Image Generation (Nano Banana 2)", tokens, imageSize);
  const responseContent = response.candidates?.[0]?.content;

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return { imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, cost, responseContent };
      }
    }
  }

  throw new Error("No image generated from Nano Banana 2");
}

/**
 * Multi-turn edit: sends the user's edit instruction to gemini-3.1-flash-image-preview
 * with the full conversation history from the original generation + any prior edits.
 */
export async function editVTONImage({
  apiKey,
  originalContentParts,
  imageGenResponseContent,
  editHistory,
  editInstruction,
  aspectRatio,
  imageSize = "2K",
}: {
  apiKey: string;
  originalContentParts: ContentPart[];
  imageGenResponseContent: unknown;
  editHistory?: EditHistoryEntry[];
  editInstruction: string;
  aspectRatio: AspectRatio;
  imageSize?: "1K" | "2K" | "4K";
}): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const ai = new GoogleGenAI({ apiKey });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    { role: "user", parts: originalContentParts },
    imageGenResponseContent,
  ];

  if (editHistory && editHistory.length > 0) {
    for (const entry of editHistory) {
      contents.push({ role: "user", parts: [{ text: entry.userInstruction }] });
      contents.push(entry.modelResponseContent);
    }
  }

  contents.push({ role: "user", parts: [{ text: editInstruction }] });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("Multi-Turn Edit (Nano Banana 2)", tokens, imageSize);
  const responseContent = response.candidates?.[0]?.content;

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return { imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, cost, responseContent };
      }
    }
  }

  throw new Error("No image generated from multi-turn edit");
}

/**
 * Pre-generation check: determine whether a human model is clearly visible in the source image.
 * If no human is detected, Model Swap should be skipped and the original image returned as-is.
 */
export async function checkHumanVisibility({
  apiKey,
  sourceImage,
}: {
  apiKey: string;
  sourceImage: File;
}): Promise<{ humanVisible: boolean; reason: string; cost?: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  parts.push({
    text: `You are an image analysis expert. Your task is to determine whether a HUMAN MODEL is clearly visible in this product photo.

A human model is "clearly visible" if you can see a recognizable human presence — face, upper body, torso, or substantial portion of a person wearing or displaying the product.

A human model is NOT visible if:
- The image is a flat-lay (garment laid flat on a surface)
- The image shows only a product close-up without any human body
- The image shows only the lower body (e.g., legs/feet wearing bottomwear or shoes) WITHOUT any visible face, torso, or upper body
- The image is a mannequin or ghost mannequin shot
- The image is a product-only shot on a hanger or display

Respond with EXACTLY two lines in this format:
HUMAN_VISIBLE: <YES or NO>
REASON: <one sentence explaining your assessment>

Do NOT include any other text.`,
  });

  parts.push({ text: "\n\nAnalyze this image:" });

  const base64 = await fileToBase64(sourceImage);
  parts.push({
    inlineData: {
      mimeType: sourceImage.type,
      data: base64,
    },
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: parts,
    });

    const tokens = extractTokenUsage(response);
    const cost = computeStepCost("gemini-3.1-pro-preview", "Human Visibility Check (Gemini 3.1 Pro)", tokens);

    const text = response.text?.trim() ?? "";
    const visibleLine = text.split("\n").find((l) => l.startsWith("HUMAN_VISIBLE:"));
    const reasonLine = text.split("\n").find((l) => l.startsWith("REASON:"));

    const humanVisible = visibleLine?.toUpperCase().includes("YES") ?? true;
    const reason = reasonLine?.replace(/^REASON:\s*/i, "").trim() ?? "";

    return { humanVisible, reason, cost };
  } catch {
    // On failure, default to assuming human is visible so generation proceeds
    return { humanVisible: true, reason: "Visibility check failed — proceeding with generation" };
  }
}

/**
 * Model Swap Step 1: Generate a prompt for model replacement
 */
export async function generateModelSwapPrompt({
  apiKey,
  gender,
  sourceImage,
  model,
  modelImage,
  backgroundMode,
  background,
  aspectRatio,
  additionalInfo,
  productInfo,
  previousMismatchFeedback,
}: {
  apiKey: string;
  gender: Gender;
  sourceImage: { file: File; preview: string };
  model: AIModel | null;
  modelImage: ModelImage | null;
  backgroundMode: ModelSwapBackgroundMode;
  background: BackgroundConfig;
  aspectRatio: AspectRatio;
  additionalInfo: string;
  productInfo?: string;
  previousMismatchFeedback?: string;
}): Promise<{ text: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  const genderLabel = gender === "male" ? "men's / masculine" : gender === "female" ? "women's / feminine" : "unisex / gender-neutral";

  const keepBackground = backgroundMode === "keep-same";

  parts.push({
    text: `You are an expert fashion photographer and prompt engineer specializing in COMPLETE MODEL REPLACEMENT in product photography. Your job is to analyze an existing product photo and create a detailed prompt that instructs an AI image generator to COMPLETELY REPLACE the entire human model — every body part from head to toe — with a NEW person, while preserving the clothing and pose.

TASK: COMPLETE MODEL REPLACEMENT (NOT a face swap)
The input is an existing product photo that already shows a model wearing clothing. Your prompt must instruct the image generator to:
1. REPLACE the ENTIRE human model — this means EVERY visible body part: face, neck, shoulders, arms, hands, fingers, torso, legs, feet. The COMPLETE person must be the new model.
2. PRESERVE the clothing EXACTLY as it appears — same garment, same fit, same drape, same wrinkles, same colors, patterns, and every construction detail
3. PRESERVE the exact same POSE — same body position, same arm placement, same leg stance, same head angle, same weight distribution
4. ${keepBackground ? "PRESERVE the original BACKGROUND exactly — same environment, same lighting conditions, same props, same colors, same depth of field" : "REPLACE the background with the new one described below"}
5. Maintain the same camera angle, framing, and composition as the original photo

GENDER CONTEXT: ${genderLabel} product

═══════════════════════════════════════════════════════════════
 CRITICAL: THIS IS A FULL-BODY MODEL REPLACEMENT, NOT A FACE SWAP
═══════════════════════════════════════════════════════════════
★★★ The #1 most common failure is replacing ONLY the face while keeping the original model's body. This produces a visible skin tone mismatch between face and body. ★★★

Your prompt MUST explicitly instruct the image generator to:
- Replace the ENTIRE PERSON, not just the face — every square inch of visible skin must belong to the new model
- The new model's SKIN TONE must be UNIFORM and CONSISTENT across ALL visible body parts: face, neck, décolletage, arms, hands, fingers, legs, feet — there must be ZERO skin tone mismatch
- The new model's BODY BUILD (musculature, frame, proportions) must be consistent with their reference photo across the entire body
- Hands and arms must match the new model's skin tone and build — NOT the original model's
- If legs/feet are visible, they must also belong to the new model with matching skin tone
- Think of this as photographing a COMPLETELY DIFFERENT PERSON in the same pose wearing the same outfit — not as editing or compositing

ACCURACY REQUIREMENTS:
- The clothing must remain PIXEL-PERFECT identical — do NOT change any garment attribute (sleeve length, neckline, color, pattern, fabric texture, fit, drape, or construction)
- The pose must be EXACTLY replicated — same stance, same body angle, same limb positions
- ${keepBackground ? "The background must remain IDENTICAL to the original photo" : ""}
- The clothing-to-body interaction must look natural — the garments should fit and drape realistically on the new model's body proportions

${modelImage ? "A reference photo of the NEW model is provided. The generated image must feature this EXACT person — same face, same skin tone (applied uniformly across the ENTIRE body), same hair, and same body proportions. Study the reference photo carefully for the model's skin tone, complexion, and body characteristics, then apply these consistently to every visible body part." : ""}
${model ? `AI Model to use: ${model.name} — ${model.description}. The entire body must reflect this model's appearance.` : ""}

Output ONLY the generation prompt text. The prompt should be 2-4 paragraphs, extremely descriptive, ensuring the COMPLETE model replacement is seamless with uniform skin tone across all visible body parts and the clothing remains perfectly preserved.`,
  });

  // Add the source product image
  parts.push({
    text: "\n\nHere is the ORIGINAL product photo. Analyze the pose, clothing, and composition carefully:",
  });
  const sourceBase64 = await fileToBase64(sourceImage.file);
  parts.push({
    inlineData: {
      mimeType: sourceImage.file.type,
      data: sourceBase64,
    },
  });

  // Add new model reference image
  if (modelImage) {
    parts.push({
      text: "\n\nHere is the reference photo of the NEW model. The generated image must feature this EXACT person:",
    });
    const modelBase64 = await fileToBase64(modelImage.file);
    parts.push({
      inlineData: {
        mimeType: modelImage.file.type,
        data: modelBase64,
      },
    });
  }

  // Background instructions
  let bgInstruction = "";
  if (keepBackground) {
    bgInstruction = "BACKGROUND: Keep the EXACT same background from the original product photo — same environment, lighting, colors, and atmosphere.";
  } else if (background.mode === "inspiration" && background.inspirationImage) {
    parts.push({
      text: "\n\nHere is the inspiration image for the NEW background:",
    });
    const bgBase64 = await fileToBase64(background.inspirationImage.file);
    parts.push({
      inlineData: {
        mimeType: background.inspirationImage.file.type,
        data: bgBase64,
      },
    });
    bgInstruction = "BACKGROUND: Replace the background using the provided inspiration image as reference.";
  } else if (background.textDescription) {
    bgInstruction = `BACKGROUND: Replace the background with: ${background.textDescription}`;
  } else {
    bgInstruction = keepBackground
      ? "BACKGROUND: Keep the original background from the product photo."
      : "BACKGROUND: Use a clean, professional e-commerce photography studio background.";
  }

  parts.push({
    text: `\n\n--- GENERATION PARAMETERS ---
Gender: ${genderLabel}
${model ? `New Model: ${model.name} — ${model.description}` : "New Model: Use the provided model reference image"}
${modelImage ? "Model Reference: PROVIDED (replace the ENTIRE person with this EXACT individual — face, body, skin tone, everything)" : ""}
${bgInstruction}
Aspect Ratio: ${aspectRatio}
${productInfo ? `Product Info: ${productInfo}` : ""}
${additionalInfo ? `Additional Instructions: ${additionalInfo}` : ""}
${previousMismatchFeedback ? `\n═══ CORRECTION FROM PREVIOUS ATTEMPT ═══\nA previous generation attempt was flagged by our quality-control system with these issues:\n${previousMismatchFeedback}\n\nYou MUST address ALL of the above issues in your prompt. Write explicit, forceful instructions that directly prevent each flagged problem. For example:\n- If "pose changed" was flagged: emphasize exact replication of every limb position, head angle, weight distribution, and body orientation from the original photo.\n- If "model size/framing changed" was flagged: emphasize that the new model must occupy the EXACT same proportion of the image frame — same crop, same distance from camera, same apparent size relative to the frame edges.\n- If "clothing mismatch" was flagged: emphasize pixel-perfect preservation of every garment detail — colors, patterns, fit, drape, construction.\nDo NOT just repeat generic instructions — specifically call out and correct the exact issues listed above.\n═══ END CORRECTION ═══` : ""}

CRITICAL RULES:
1. The clothing in the output must match the original product photo EXACTLY — every visual detail preserved
2. The pose must be IDENTICAL to the original photo
3. The ENTIRE human model is replaced — face, neck, arms, hands, legs, feet, ALL skin — must belong to the new model
4. SKIN TONE CONSISTENCY: The new model's skin tone must be UNIFORM across face, neck, arms, hands, and any other visible skin — NO mismatch between face and body
5. Professional e-commerce fashion photography quality
${keepBackground ? "6. The background must remain exactly as in the original photo" : "6. The background should match the specified new background"}

Now write the Complete Model Replacement image generation prompt. Remember: this is a FULL-BODY model replacement, NOT a face swap. Every visible body part must belong to the new model.`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: parts,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No prompt generated from Gemini 3.1 Pro");
  }

  const tokens = extractTokenUsage(response);
  const cost = computeStepCost("gemini-3.1-pro-preview", "Prompt Generation (Gemini 3.1 Pro)", tokens);

  return { text, cost };
}

/**
 * Model Swap Step 2: Generate the model-swapped image
 */
export async function buildModelSwapImageContentParts({
  prompt,
  sourceImage,
  modelImage,
  backgroundMode,
  background,
}: {
  prompt: string;
  sourceImage: { file: File; preview: string };
  modelImage: ModelImage | null;
  backgroundMode: ModelSwapBackgroundMode;
  background: BackgroundConfig;
}): Promise<ContentPart[]> {
  const keepBackground = backgroundMode === "keep-same";
  const parts: ContentPart[] = [];

  const sourceBase64 = await fileToBase64(sourceImage.file);
  parts.push({ inlineData: { mimeType: sourceImage.file.type, data: sourceBase64 } });

  if (modelImage) {
    const modelBase64 = await fileToBase64(modelImage.file);
    parts.push({ inlineData: { mimeType: modelImage.file.type, data: modelBase64 } });
  }

  if (!keepBackground && background.mode === "inspiration" && background.inspirationImage) {
    const bgBase64 = await fileToBase64(background.inspirationImage.file);
    parts.push({ inlineData: { mimeType: background.inspirationImage.file.type, data: bgBase64 } });
  }

  parts.push({
    text: `${prompt}\n\n` +
      `═══ CRITICAL: COMPLETE MODEL REPLACEMENT INSTRUCTIONS (NOT A FACE SWAP) ═══\n\n` +
      `1. The first reference image is the ORIGINAL product photo — preserve the clothing EXACTLY as it appears (same garment, fit, colors, patterns, textures, construction details, wrinkles, and drape).\n\n` +
      `2. REPLACE the ENTIRE HUMAN MODEL — not just the face. Every visible body part (face, neck, shoulders, arms, hands, fingers, torso, legs, feet) must belong to the NEW person shown in the model reference photo. Use their EXACT face, skin tone, hair color, hair style, body build, and proportions for the COMPLETE body.\n\n` +
      `3. ★★★ SKIN TONE UNIFORMITY (MOST CRITICAL) ★★★\n` +
      `   The new model's skin tone must be PERFECTLY CONSISTENT across ALL visible body parts:\n` +
      `   - Face and neck: new model's skin tone\n` +
      `   - Arms and hands: SAME skin tone as face (not the original model's)\n` +
      `   - Legs and feet (if visible): SAME skin tone as face\n` +
      `   - Décolletage/chest (if visible): SAME skin tone as face\n` +
      `   There must be ZERO visible skin tone difference between face and any other body part.\n` +
      `   If the new model has a different skin tone than the original, the ENTIRE body must reflect the new model's skin tone uniformly.\n\n` +
      `4. The new model must adopt the EXACT SAME POSE as the original photo — same body position, same arm placement, same leg stance, same head angle.\n\n` +
      `${keepBackground ? "5. Keep the background IDENTICAL to the original product photo — same environment, lighting, colors, props, and atmosphere.\n\n" : "5. Replace the background as described in the prompt.\n\n"}` +
      `6. The clothing-to-body interaction must look natural — the garments should fit and drape realistically on the new model's proportions.\n\n` +
      `7. Maintain the same camera angle, framing, and professional photography quality.\n\n` +
      `THINK OF IT THIS WAY: Imagine you photographed a COMPLETELY DIFFERENT PERSON wearing the exact same outfit in the exact same pose. The result should look like a fresh photograph of the new person — not like the old photo with the face pasted on.`,
  });

  return parts;
}

export async function generateModelSwapImage({
  apiKey,
  prompt,
  sourceImage,
  modelImage,
  backgroundMode,
  background,
  aspectRatio,
  imageSize = "2K",
}: {
  apiKey: string;
  prompt: string;
  sourceImage: { file: File; preview: string };
  modelImage: ModelImage | null;
  backgroundMode: ModelSwapBackgroundMode;
  background: BackgroundConfig;
  aspectRatio: AspectRatio;
  imageSize?: "1K" | "2K" | "4K";
}): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const ai = new GoogleGenAI({ apiKey });

  const contents = await buildModelSwapImageContentParts({
    prompt,
    sourceImage,
    modelImage,
    backgroundMode,
    background,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("Image Generation (Nano Banana 2)", tokens, imageSize);
  const responseContent = response.candidates?.[0]?.content;

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return { imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, cost, responseContent };
      }
    }
  }

  throw new Error("No image generated from Nano Banana 2");
}

/**
 * Multi-turn edit for model swap: sends the user's edit instruction to gemini-3.1-flash-image-preview
 * with the full conversation history from the original generation + any prior edits.
 */
export async function editModelSwapImage({
  apiKey,
  originalContentParts,
  imageGenResponseContent,
  editHistory,
  editInstruction,
  aspectRatio,
  imageSize = "2K",
}: {
  apiKey: string;
  originalContentParts: ContentPart[];
  imageGenResponseContent: unknown;
  editHistory?: EditHistoryEntry[];
  editInstruction: string;
  aspectRatio: AspectRatio;
  imageSize?: "1K" | "2K" | "4K";
}): Promise<{ imageData: string; cost: StepCost; responseContent: unknown }> {
  const ai = new GoogleGenAI({ apiKey });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    { role: "user", parts: originalContentParts },
    imageGenResponseContent,
  ];

  if (editHistory && editHistory.length > 0) {
    for (const entry of editHistory) {
      contents.push({ role: "user", parts: [{ text: entry.userInstruction }] });
      contents.push(entry.modelResponseContent);
    }
  }

  contents.push({ role: "user", parts: [{ text: editInstruction }] });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("Multi-Turn Edit (Nano Banana 2)", tokens, imageSize);
  const responseContent = response.candidates?.[0]?.content;

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return { imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, cost, responseContent };
      }
    }
  }

  throw new Error("No image generated from multi-turn edit");
}

/**
 * Post-generation validation: compare original product images against the generated output
 * using Gemini 3.1 Pro. In model-swap mode, also checks pose preservation and screen real-estate.
 */
export async function validateGeneratedImage({
  apiKey,
  originalImages,
  generatedImageData,
  productCategory = "clothing",
  validationMode = "vton",
}: {
  apiKey: string;
  originalImages: File[];
  generatedImageData: string;
  productCategory?: ProductCategory;
  validationMode?: "vton" | "model-swap" | "room-staging";
}): Promise<ValidationResult & { cost?: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const isFootwear = productCategory === "footwear";
  const productLabel = isFootwear ? "footwear" : validationMode === "room-staging" ? "home decor / furniture product" : "garment/clothing";
  const isModelSwap = validationMode === "model-swap";
  const isRoomStaging = validationMode === "room-staging";

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (isRoomStaging) {
    parts.push({
      text: `You are a quality-control inspector for AI-generated interior/product photography. Your task is to compare the ORIGINAL product reference images against an AI-GENERATED output image and determine whether the product in the output faithfully matches the original.

COMPARE THESE ASPECTS OF THE PRODUCT:
- Overall shape and proportions
- Pattern, design, and motif accuracy
- Color(s) and color placement
- Material appearance and texture (weave, grain, finish)
- Key details (fringe, border, edge treatment, construction)

ALSO CHECK:
- Is the product fully visible and not cut off inappropriately?
- Does the product look the right scale/proportion relative to the room?
- Are the colors accurate (not washed out, shifted, or oversaturated)?

IMPORTANT RULES:
- Focus ONLY on the product itself. Ignore differences in room setting, furniture, lighting mood, or props.
- Minor stylistic rendering differences (slight color temperature shift, soft ambient lighting effects) are acceptable.
- A warning should only be raised if there is a SUBSTANTIVE difference — e.g., wrong colors, missing/changed pattern, altered proportions, incorrect texture, missing details.

Respond with EXACTLY one line in this format:
MATCH: <yes or no>
REASON: <one sentence explaining why, or "Product matches well" if yes>

Do NOT include any other text.`,
    });
  } else if (isModelSwap) {
    parts.push({
      text: `You are a quality-control inspector for AI-generated fashion photography. Your task is to compare an ORIGINAL product photo against an AI-GENERATED output image produced by a MODEL SWAP operation. The model swap replaces the human model while preserving the clothing, pose, and composition.

CHECK THESE THREE ASPECTS:

1. CLOTHING MATCH — Does the primary ${productLabel} in the output faithfully match the original?
   - Overall silhouette and shape
   - Color(s) and color placement
   - Pattern, print, or graphic elements
   - Key construction details (neckline, closure, pockets, sole shape, branding marks, etc.)
   - Material appearance and texture
   - Minor stylistic rendering differences (slight color temperature shift, soft focus) are acceptable.
   - Flag only SUBSTANTIVE differences (wrong color, missing/changed pattern, altered silhouette, etc.)

2. POSE PRESERVATION — Is the model's pose in the generated image essentially the same as the original?
   - Body position and stance
   - Arm and hand placement
   - Leg stance and weight distribution
   - Head angle and tilt
   - Minor natural variations are acceptable. Flag only if the pose has NOTICEABLY changed (different arm position, different stance, turned a different direction, etc.)

3. SCREEN REAL-ESTATE — Does the human model occupy approximately the same proportion of the image frame?
   - Compare what percentage of the frame the model fills in both images
   - The model should be roughly the same size relative to the frame
   - Flag only if the model appears SIGNIFICANTLY larger or smaller (e.g., full-body became waist-up, or model shrank noticeably)

Respond with EXACTLY four lines in this format:
MATCH: <yes or no>
POSE: <preserved or changed>
SIZE: <consistent or changed>
REASON: <one or two sentences covering all three aspects>

Do NOT include any other text.`,
    });
  } else {
    parts.push({
      text: `You are a quality-control inspector for AI-generated fashion photography. Your task is to compare the ORIGINAL product reference images against an AI-GENERATED output image and determine whether the primary ${productLabel} in the output faithfully matches the original product.

COMPARE THESE ASPECTS OF THE PRIMARY PRODUCT:
- Overall silhouette and shape
- Color(s) and color placement
- Pattern, print, or graphic elements
- Key construction details (neckline, closure, pockets, sole shape, branding marks, etc.)
- Material appearance and texture

IMPORTANT RULES:
- Focus ONLY on the primary ${productLabel}. Ignore differences in background, model, pose, lighting, or complementary items.
- Minor stylistic rendering differences (slight color temperature shift, soft focus, artistic interpretation of folds/drape) are acceptable and should NOT trigger a warning.
- A warning should only be raised if there is a SUBSTANTIVE difference — e.g., wrong color, missing/changed pattern, altered silhouette, added/removed design elements, incorrect branding, wrong product type.

Respond with EXACTLY one line in this format:
MATCH: <yes or no>
REASON: <one sentence explaining why, or "Product matches well" if yes>

Do NOT include any other text.`,
    });
  }

  parts.push({
    text: `\n\nHere are the ORIGINAL product reference images (${originalImages.length}):`,
  });

  for (const file of originalImages) {
    const base64 = await fileToBase64(file);
    parts.push({
      inlineData: {
        mimeType: file.type,
        data: base64,
      },
    });
  }

  parts.push({
    text: `\n\nHere is the AI-GENERATED output image:`,
  });

  const [mimeType, base64Data] = parseDataUrl(generatedImageData);
  parts.push({
    inlineData: {
      mimeType,
      data: base64Data,
    },
  });

  if (isModelSwap) {
    parts.push({
      text: `\n\nNow compare the generated image against the original. Check: (1) clothing match, (2) pose preservation, (3) model screen real-estate consistency.`,
    });
  } else {
    parts.push({
      text: `\n\nNow compare the primary ${productLabel} in the generated image against the original reference images. Is it the same product?`,
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: parts,
    });

    const vTokens = extractTokenUsage(response);
    const vCost = computeStepCost("gemini-3.1-pro-preview", "Verification (Gemini 3.1 Pro)", vTokens);

    const text = response.text?.trim() ?? "";

    const matchLine = text.split("\n").find((l) => l.startsWith("MATCH:"));
    const reasonLine = text.split("\n").find((l) => l.startsWith("REASON:"));

    const isMatch = matchLine?.toLowerCase().includes("yes") ?? true;
    const reason = reasonLine?.replace(/^REASON:\s*/i, "").trim() ?? "";

    if (isModelSwap) {
      const poseLine = text.split("\n").find((l) => l.startsWith("POSE:"));
      const sizeLine = text.split("\n").find((l) => l.startsWith("SIZE:"));
      const posePreserved = poseLine?.toLowerCase().includes("preserved") ?? true;
      const sizeConsistent = sizeLine?.toLowerCase().includes("consistent") ?? true;

      if (isMatch && posePreserved && sizeConsistent) {
        return { status: "passed", message: reason || "Product, pose, and framing match well", cost: vCost };
      } else {
        const issues: string[] = [];
        if (!isMatch) issues.push("clothing mismatch");
        if (!posePreserved) issues.push("pose changed");
        if (!sizeConsistent) issues.push("model size/framing changed");
        const issuePrefix = `Issues: ${issues.join(", ")}. `;
        return { status: "warning", message: issuePrefix + (reason || "The output may differ from the original"), cost: vCost };
      }
    }

    if (isMatch) {
      return { status: "passed", message: reason || "Product matches well", cost: vCost };
    } else {
      return { status: "warning", message: reason || "The product in the output may differ from the original", cost: vCost };
    }
  } catch {
    return { status: "error", message: "Validation check failed" };
  }
}

function parseDataUrl(dataUrl: string): [string, string] {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return [match[1], match[2]];
  return ["image/png", dataUrl];
}

// ═══════════════════════════════════════════════════════════════
//  SWATCH — Generate fabric swatch image via Nano Banana 2
// ═══════════════════════════════════════════════════════════════

export interface SwatchGenerationResult {
  swatchDataUrl: string;
  dominantColors: string[];
  patternDescription: string;
  cost: StepCost;
}

export async function generateSwatchImage({
  apiKey,
  imageFile,
  shape,
  size,
}: {
  apiKey: string;
  imageFile: File;
  shape: SwatchShape;
  size: number;
}): Promise<SwatchGenerationResult> {
  const ai = new GoogleGenAI({ apiKey });

  const base64 = await fileToBase64(imageFile);

  const shapeInstruction =
    shape === "circle"
      ? "Crop the output into a perfect CIRCLE. The fabric fills the entire circular area with no background visible."
      : shape === "rounded"
        ? "Crop the output into a ROUNDED RECTANGLE with generous rounded corners (~12% radius). The fabric fills the entire shape."
        : "The output MUST be a perfect SQUARE filled edge-to-edge with fabric. No border, no margin, no background.";

  const prompt = `You are an expert textile analyst. Your task is to EXTRACT a fabric swatch directly FROM this garment photograph.

═══ CRITICAL: THIS IS A CROP/EXTRACT OPERATION, NOT A GENERATION TASK ═══

You must take an actual section of fabric directly from this photograph and present it as a clean swatch.
Do NOT recreate, reimagine, or generate new fabric. The output must be PIXEL-ACCURATE to the source photo — same exact colors, same exact pattern, same exact texture, same lighting as it appears in this image.

STEP-BY-STEP:
1. IDENTIFY the garment's primary fabric area in this image. Ignore: background, model's skin, buttons, zippers, labels, tags, seams, stitching, and pockets.
2. FIND the best region — where the fabric's pattern, texture, and colors are MOST CLEARLY VISIBLE:
   - For PATTERNED fabrics (stripes, checks, florals, plaids, prints): pick the area that shows a COMPLETE pattern repeat with ALL colors of the pattern visible.
   - For SOLID fabrics: pick a clean, flat area where the fabric weave/knit texture is clearly visible.
   - Prefer areas that are: flat (not heavily folded/creased), well-lit, free of obstructions, and show the true color of the fabric.
3. CROP that exact region from the photo and zoom in to fill the entire output image.
4. The output must look like a close-up photograph of that exact piece of fabric — preserving the original photo's colors, lighting, texture grain, and pattern exactly as captured by the camera.
5. ${shapeInstruction}

WHAT THE OUTPUT MUST LOOK LIKE:
- A tight close-up crop of the ACTUAL fabric from this photo
- The EXACT same colors as the garment in the photo (not brighter, not duller, not shifted)
- The EXACT same pattern/stripe spacing/texture as visible in the photo
- Fills the entire output image — no garment silhouette, no background, no skin, no construction details

WHAT TO AVOID:
- Do NOT generate or synthesize new fabric texture
- Do NOT alter the colors — they must match the source photo exactly
- Do NOT add any artificial lighting, shadows, or color grading
- Do NOT include buttons, seams, stitching, labels, or hardware
- Do NOT include any model skin or background

Also in your TEXT response, provide this JSON (no markdown fences):
{"dominantColors":["#hex1","#hex2"],"patternDescription":"brief description"}

List up to 6 dominant colors as hex codes matching the fabric's actual colors in the photo, and describe the pattern/texture briefly (e.g., "beige cotton with subtle vertical pinstripes", "navy herringbone wool", "red and green tartan check").`;

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      inlineData: {
        mimeType: imageFile.type || "image/jpeg",
        data: base64,
      },
    },
    { text: prompt },
  ];

  const imageSize = size <= 512 ? "512" as const : "1K" as const;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
        imageSize,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("Swatch Generation (Nano Banana 2)", tokens, imageSize);

  let swatchDataUrl = "";
  let dominantColors: string[] = [];
  let patternDescription = "Unknown pattern";

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.thought) continue;
      if (part.inlineData && part.inlineData.data) {
        swatchDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      } else if (part.text) {
        const jsonMatch = part.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            dominantColors = parsed.dominantColors || [];
            patternDescription = parsed.patternDescription || "Unknown pattern";
          } catch {
            // Text response wasn't valid JSON — that's fine
          }
        }
      }
    }
  }

  if (!swatchDataUrl) {
    throw new Error("No swatch image generated from Nano Banana 2");
  }

  return { swatchDataUrl, dominantColors, patternDescription, cost };
}

// ═══════════════════════════════════════════════════════════════
//  AI INFOGRAPHIC — Generate e-commerce infographic image via Nano Banana 2
// ═══════════════════════════════════════════════════════════════

export type InfographicStyle =
  | "modern-minimal"
  | "bold-lifestyle"
  | "premium-luxury"
  | "vibrant-pop"
  | "clean-technical";

const INFOGRAPHIC_STYLE_PROMPTS: Record<InfographicStyle, string> = {
  "modern-minimal": "Clean, minimalist design with ample whitespace, subtle typography, thin lines, muted accent colors, and a sophisticated editorial feel. Think Apple, Muji, or COS brand aesthetics.",
  "bold-lifestyle": "Bold, energetic lifestyle layout with dynamic compositions, vibrant accent colors, strong typography, lifestyle context, and aspirational mood. Think Nike, Zara, or H&M brand aesthetics.",
  "premium-luxury": "Premium, luxurious design with rich textures, gold/silver accents, elegant serif typography, dark or cream backgrounds, and high-end editorial feel. Think Gucci, Louis Vuitton, or Hermès brand aesthetics.",
  "vibrant-pop": "Playful, eye-catching design with bright gradients, rounded shapes, fun typography, colorful callouts, and a social-media-ready feel. Think Glossier, Fenty, or Skims brand aesthetics.",
  "clean-technical": "Technical, spec-focused layout with clean grids, callout lines pointing to product features, icon-style markers, specification tables, and a detailed engineering feel. Think Uniqlo, Patagonia, or Arc'teryx brand aesthetics.",
};

export async function generateAIInfographic({
  apiKey,
  baseImageData,
  productInfo,
  brandName,
  logoFile,
  style,
  customInstructions,
  aspectRatio = "3:4",
  imageSize = "2K",
}: {
  apiKey: string;
  baseImageData: string;
  productInfo: string;
  brandName?: string;
  logoFile?: File;
  style: InfographicStyle;
  customInstructions?: string;
  aspectRatio?: AspectRatio;
  imageSize?: "1K" | "2K" | "4K";
}): Promise<{ imageData: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  const [mimeType, base64Data] = parseDataUrl(baseImageData);
  contents.push({
    inlineData: {
      mimeType,
      data: base64Data,
    },
  });

  if (logoFile) {
    const logoBase64 = await fileToBase64(logoFile);
    contents.push({
      inlineData: {
        mimeType: logoFile.type,
        data: logoBase64,
      },
    });
  }

  const styleDesc = INFOGRAPHIC_STYLE_PROMPTS[style];

  contents.push({
    text: `Create a stunning, professional e-commerce product INFOGRAPHIC image using the provided product photograph as the hero image.

═══ DESIGN STYLE ═══
${styleDesc}

═══ PRODUCT INFORMATION TO HIGHLIGHT ═══
${productInfo || "No specific product info provided — analyze the product image and create compelling, generic feature callouts based on what you observe."}

${brandName ? `═══ BRAND ═══\nBrand Name: "${brandName}". Incorporate the brand name elegantly into the infographic design — in a header, corner logo text, or subtle watermark placement. Ensure it feels organic to the layout.` : ""}

${logoFile ? `═══ BRAND LOGO ═══\nA brand logo image is provided as the second reference image. Place this logo prominently but tastefully in the infographic — typically in a corner, header area, or as a watermark. Maintain the logo's original proportions and ensure it's clearly visible against the background.` : ""}

═══ INFOGRAPHIC DESIGN REQUIREMENTS ═══

1. HERO PRODUCT IMAGE: The provided product photo must be the centerpiece. Display it prominently — either as a large center element, or integrated into the layout with appropriate framing. The product must look premium and desirable.

2. FEATURE CALLOUTS: Extract key product features/USPs from the product information and present them as visually appealing callout elements. Use:
   - Text badges/labels with icons or emoji indicators
   - Callout lines/arrows pointing to specific product features on the image
   - Organized info sections (sidebar, bottom bar, or floating cards)
   - Each callout should be concise (2-5 words) with optional supporting text

3. TYPOGRAPHY: Use a hierarchy of fonts:
   - Product name/headline: Large, bold, attention-grabbing
   - Feature highlights: Medium, clear, scannable
   - Supporting details: Smaller, complementary
   All text must be sharp, legible, and professional.

4. COLOR SCHEME: Derive accent colors from the product itself for visual harmony. The color palette should complement the product, not clash with it.

5. LAYOUT COMPOSITION: The infographic should follow modern e-commerce design principles:
   - Clear visual hierarchy guiding the eye from product → features → brand
   - Professional spacing and alignment
   - No cluttered or overwhelming elements
   - Suitable for product listing pages, social media, or marketplace use

6. VISUAL ELEMENTS: Include subtle design elements that enhance the premium feel:
   - Geometric shapes, dividers, or background patterns
   - Gradient accents or color blocks
   - Shadow/depth effects for dimension
   - Professional borders or frames

7. OVERALL QUALITY: The output should look like it was designed by a professional graphic designer for a major e-commerce brand. It should be immediately ready for use on Amazon, Flipkart, Shopify, or social media product promotion.

${customInstructions ? `═══ ADDITIONAL INSTRUCTIONS ═══\n${customInstructions}` : ""}

CRITICAL: This must be a COMPLETE, FINISHED infographic image — not just the product photo with minor overlays. It should be a fully designed marketing asset with all text, callouts, branding, and design elements baked into the image. The final image should look like a professionally designed product listing image that an e-commerce brand would use to showcase their product.`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("AI Infographic (Nano Banana 2)", tokens, imageSize);

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return { imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, cost };
      }
    }
  }

  throw new Error("No infographic image generated from Nano Banana 2");
}

// ╔═══════════════════════════════════════════════════════════════════╗
// ║          SET PRODUCT — PROMPT & IMAGE GENERATION                  ║
// ╚═══════════════════════════════════════════════════════════════════╝

/**
 * Step 1: Generate a detailed prompt for a set product composite image
 */
export async function generateSetProductPrompt({
  apiKey,
  productCategory = "clothing",
  gender,
  garmentType,
  footwearType,
  fit,
  variants,
  layoutStyle,
  background,
  model,
  modelImage,
  aspectRatio,
  additionalInfo,
  productInfo,
}: {
  apiKey: string;
  productCategory?: ProductCategory;
  gender: Gender;
  garmentType: GarmentType;
  footwearType?: FootwearType;
  fit: FitType | null;
  variants: SetVariantFolder[];
  layoutStyle: SetLayoutStyle;
  background: BackgroundConfig;
  model: AIModel | null;
  modelImage: ModelImage | null;
  aspectRatio: AspectRatio;
  additionalInfo: string;
  productInfo?: string;
}): Promise<{ text: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  const isFootwear = productCategory === "footwear";
  const genderLabel = gender === "male" ? "men's / masculine" : gender === "female" ? "women's / feminine" : "unisex / gender-neutral";
  const productLabel = isFootwear
    ? (FOOTWEAR_TYPE_OPTIONS.find((o) => o.value === footwearType)?.label || footwearType || "footwear")
    : garmentType;
  const fitLabel = fit ? (FIT_OPTIONS.find((o) => o.value === fit)?.label || fit) : null;

  const layoutDesc: Record<SetLayoutStyle, string> = {
    "side-by-side": "All models are arranged standing SIDE BY SIDE in a horizontal row, evenly spaced, each clearly visible with no significant overlap. Like a lineup photo.",
    "overlapping": "Models are arranged with slight OVERLAP — each model partially behind the next, creating a sense of depth and layering. The front-most model is slightly larger/closer to camera.",
    "staggered": "Models are arranged at STAGGERED depths and heights — some slightly forward, some back, some higher, creating a dynamic, editorial group composition with visual interest.",
  };

  const variantDescriptions = variants.map((v, i) => `Variant ${i + 1}: "${v.name}" (${v.images.length} reference image${v.images.length !== 1 ? "s" : ""})`).join("\n");

  let systemPrompt = `You are an expert fashion photographer and prompt engineer specializing in SET PRODUCT / COMBO PACK photography.

YOUR TASK: Write a detailed image generation prompt for a SET PRODUCT composite photograph showing ${variants.length} variants of the same ${productLabel} worn by the SAME model (cloned/duplicated), arranged in a single professional e-commerce image.

GENDER CONTEXT: This is a ${genderLabel} product.

═══ COMPOSITION & LAYOUT ═══
${layoutDesc[layoutStyle]}
Number of models in the image: ${variants.length} (all the SAME person, same face, same body, same hair — only the garment changes)

═══ VARIANTS (LEFT TO RIGHT) ═══
${variantDescriptions}

═══ CRITICAL RULES ═══
1. ALL ${variants.length} models must be the EXACT SAME PERSON — same face, body type, hair, skin tone.
2. Each model wears a DIFFERENT variant of the ${productLabel} — match each garment to its respective reference images EXACTLY.
3. Clearly position the models as: ${variants.map((v, i) => `Position ${i + 1} (${i === 0 ? "leftmost" : i === variants.length - 1 ? "rightmost" : "middle"}): "${v.name}"`).join(", ")}
4. Each garment must match its reference images in color, pattern, texture, construction, and fit.
5. Unified lighting, consistent shadows, and a single cohesive background across ALL models.
6. Professional e-commerce quality — clean, well-lit, commercial photography standard.
7. Each model should have a slightly different but coordinated pose for visual variety (not all identical poses).
${fitLabel ? `8. All garments should be shown in ${fitLabel} fit.` : ""}

═══ PRODUCT TYPE ═══
${isFootwear ? `Footwear: ${productLabel}` : `Clothing: ${productLabel}`}
`;

  if (model) {
    systemPrompt += `\n═══ AI MODEL ═══\n${model.name}: ${model.description}\n`;
  }
  if (modelImage) {
    systemPrompt += `\n═══ MODEL REFERENCE ═══\nA custom model reference photo is provided. ALL ${variants.length} models in the set must be this EXACT person.\n`;
  }

  if (background.mode === "inspiration" && background.inspirationImage) {
    systemPrompt += `\n═══ BACKGROUND ═══\nUse the provided background inspiration image as reference for the environment/setting.\n`;
  } else if (background.textDescription) {
    systemPrompt += `\n═══ BACKGROUND ═══\n${background.textDescription}\n`;
  } else {
    systemPrompt += `\n═══ BACKGROUND ═══\nClean, professional studio background suitable for e-commerce product photography.\n`;
  }

  if (productInfo) {
    systemPrompt += `\n═══ PRODUCT INFO ═══\n${productInfo}\n`;
  }

  systemPrompt += `\n--- GENERATION PARAMETERS ---
Gender: ${genderLabel}
Product: ${productLabel}
${fitLabel ? `Fit: ${fitLabel}` : ""}
Layout: ${layoutStyle}
Variant Count: ${variants.length}
Aspect Ratio: ${aspectRatio}
${model ? `AI Model: ${model.name} — ${model.description}` : ""}
${modelImage ? "Custom Model Reference: PROVIDED" : ""}
${additionalInfo ? `Additional Instructions: ${additionalInfo}` : ""}

Write the SET PRODUCT image generation prompt now. 3-5 detailed paragraphs covering: overall composition, each variant's position and garment details, the model's appearance, poses, lighting, and background.`;

  parts.push({ text: systemPrompt });

  // Add model reference image
  if (modelImage) {
    const base64 = await fileToBase64(modelImage.file);
    parts.push({ inlineData: { mimeType: modelImage.file.type, data: base64 } });
  }

  // Add variant reference images with labels
  for (let i = 0; i < variants.length; i++) {
    parts.push({ text: `\n[VARIANT ${i + 1}: "${variants[i].name}" — Reference images below]` });
    for (const img of variants[i].images) {
      const base64 = await fileToBase64(img.file);
      parts.push({ inlineData: { mimeType: img.file.type, data: base64 } });
    }
  }

  // Add background inspiration image
  if (background.mode === "inspiration" && background.inspirationImage) {
    parts.push({ text: "\n[BACKGROUND INSPIRATION — Reference image below]" });
    const bgBase64 = await fileToBase64(background.inspirationImage.file);
    parts.push({ inlineData: { mimeType: background.inspirationImage.file.type, data: bgBase64 } });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: parts,
    config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeStepCost("gemini-3.1-pro-preview", "Set Product Prompt (Gemini 3.1 Pro)", tokens);

  const text = response.candidates?.[0]?.content?.parts
    ?.filter((p: { text?: string }) => p.text)
    .map((p: { text?: string }) => p.text)
    .join("\n") ?? "";

  if (!text) {
    throw new Error("No prompt text generated from Gemini 3.1 Pro");
  }

  return { text, cost };
}

/**
 * Step 2: Generate the set product composite image using Nano Banana 2
 */
export async function generateSetProductImage({
  apiKey,
  prompt,
  variants,
  modelImage,
  aspectRatio,
  imageSize = "2K",
}: {
  apiKey: string;
  prompt: string;
  variants: SetVariantFolder[];
  modelImage: ModelImage | null;
  aspectRatio: AspectRatio;
  imageSize?: "1K" | "2K" | "4K";
}): Promise<{ imageData: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Images first for better fidelity
  // Add variant images with labels
  for (let i = 0; i < variants.length; i++) {
    contents.push({ text: `[VARIANT ${i + 1}: "${variants[i].name}"]` });
    for (const img of variants[i].images) {
      const base64 = await fileToBase64(img.file);
      contents.push({ inlineData: { mimeType: img.file.type, data: base64 } });
    }
  }

  // Add model reference
  if (modelImage) {
    contents.push({ text: "[MODEL REFERENCE — All models must be this exact person]" });
    const modelBase64 = await fileToBase64(modelImage.file);
    contents.push({ inlineData: { mimeType: modelImage.file.type, data: modelBase64 } });
  }

  // Add the prompt text last (images-first approach for better fidelity)
  contents.push({
    text: `${prompt}

═══ CRITICAL SET PRODUCT INSTRUCTIONS ═══
1. Each variant's garment must EXACTLY match its corresponding reference images above.
2. Preserve original colors, patterns, textures, materials, and construction for each variant.
3. ALL models in the image must be the EXACT SAME person — same face, skin tone, hair, and body.
4. Do NOT use brand knowledge to modify any garment details — copy only what is in the reference photos.
5. The final image must be a single cohesive photograph showing all ${variants.length} variants together.`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("Set Product Image (Nano Banana 2)", tokens, imageSize);

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return { imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, cost };
      }
    }
  }

  throw new Error("No set product image generated from Nano Banana 2");
}

/* ================================================================== */
/*  UGC PIPELINE                                                       */
/* ================================================================== */

/**
 * Step 1: Use Gemini 3.1 Pro to generate a detailed UGC scene prompt.
 * The prompt instructs the image generator to produce a natural, smartphone-quality
 * photo of a real person wearing the product in the described scene.
 */
export async function generateUGCPrompt({
  apiKey,
  productCategory = "clothing",
  gender,
  garmentImages,
  garmentType,
  footwearType,
  complementaryImages,
  scene,
  aspectRatio,
  additionalInfo,
  productInfo,
}: {
  apiKey: string;
  productCategory?: ProductCategory;
  gender: Gender;
  garmentImages: GarmentImage[];
  garmentType: GarmentType;
  footwearType?: FootwearType;
  complementaryImages: ComplementaryImage[];
  scene: UGCScene;
  aspectRatio: AspectRatio;
  additionalInfo: string;
  productInfo?: string;
}): Promise<{ prompt: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const isFootwear = productCategory === "footwear";
  const isSelfie = scene.shotType === "selfie";
  const genderLabel = gender === "male" ? "men's / masculine" : gender === "female" ? "women's / feminine" : "unisex / gender-neutral";
  const productTypeLabel = isFootwear
    ? (FOOTWEAR_TYPE_OPTIONS.find((f) => f.value === footwearType)?.label || footwearType || "Footwear")
    : garmentType === "topwear" ? "Top Wear" : garmentType === "bottomwear" ? "Bottom Wear" : "One Piece";

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  parts.push({
    text: `You are an expert at writing prompts that produce hyper-realistic User Generated Content (UGC) photos for Instagram. The goal is to generate an image that looks like a REAL PERSON naturally photographed in a REAL PLACE — NOT a professional studio or e-commerce shot.

═══ SCENE DESCRIPTION ═══
${scene.name ? `Scene Name: "${scene.name}"` : ""}
Scene Details: "${scene.description}"
${scene.referenceImages.length > 0 ? "Reference images for the scene mood/setting are provided below. Analyze them to understand the visual tone, location vibe, and atmosphere the user wants." : ""}

═══ PRODUCT CONTEXT ═══
Product Category: ${isFootwear ? "Footwear" : "Clothing"}
Product Type: ${productTypeLabel} (${genderLabel})
${productInfo ? `Product Details: ${productInfo}` : ""}
Product reference images are provided below. The product must be reproduced EXACTLY — same colors, patterns, textures, construction, branding.

═══ SHOT TYPE: ${isSelfie ? "SELFIE" : "NORMAL (THIRD-PERSON)"} ═══
${isSelfie ? `This is a SELFIE shot taken with a front-facing smartphone camera.
- Slight wide-angle lens distortion typical of phone selfie cameras (closer objects appear slightly larger)
- One arm may be partially visible holding the phone, or the phone may be cropped just outside the frame
- Direct eye contact with camera
- Close framing: head, shoulders, and upper torso are prominent; the product must still be clearly visible
- The person may be slightly off-center, as selfies often are
- Background visible but with shallow depth of field typical of portrait mode or front camera` : `This is a NORMAL third-person photo, as if a friend or bystander casually snapped the picture.
- Standard smartphone rear camera perspective (slightly wider field of view, better quality than front camera)
- The person may or may not be looking at the camera — candid is preferred
- Full body or three-quarter framing showing the product clearly
- Natural, slightly imperfect composition (not perfectly centered or rule-of-thirds)
- The person could be walking, standing, sitting, leaning — whatever feels natural for the scene`}

═══ UGC AUTHENTICITY PRINCIPLES (CRITICAL) ═══

1. THE PERSON must look like an everyday real human being — NOT a professional model.
   - Based on the scene location and context, infer the appropriate ethnicity, age range (20s-30s typically), and natural appearance
   - For example: Gateway of India scene = a normal Mumbaikar; Shibuya Crossing = a local Japanese person; Central Park = a New Yorker of any background
   - Natural body type, natural skin with minor imperfections, natural hair
   - The person should look like they belong in the scene — a local or a tourist who naturally fits the vibe
   - Gender context: ${genderLabel} — the person should match this gender context

2. THE SETTING must look authentic to the described location.
   - Real landmarks, real architecture, real street textures, real vegetation, real signage
   - Natural lighting conditions appropriate for the described time of day
   - Real people or activity in the background (not an empty, staged environment)
   - Environmental details that make the location feel lived-in and genuine

3. THE PHOTOGRAPHY must look like an amateur smartphone photo:
   - Slightly imperfect composition — not perfectly framed like a professional photographer would
   - Smartphone camera characteristics: natural depth of field, slight lens softness at edges, auto-HDR look
   - Natural / available lighting ONLY — no studio lights, no rim lights, no artificial fill lights
   - Phone-camera color science: slightly warmer tones, auto white balance, slight saturation
   - Minor imperfections are WELCOME: slight motion blur, slightly off-level horizon, a finger shadow edge
   - The image should look like it was posted on Instagram with minimal editing (maybe a subtle filter at most)

4. THE MOOD should be candid and authentic:
   - The person looks natural, relaxed, and un-posed — like a real moment captured
   - Not stiff, not staged, not looking like they were told to "pose for the camera"
   - ${isSelfie ? "Selfie-specific: relaxed, friendly expression — the kind of selfie you'd post on your story" : "Candid: caught mid-action, mid-conversation, or in a natural resting pose"}

5. PRODUCT FIDELITY — While everything else should look casual and real:
   - The product (${productTypeLabel}) must be accurately reproduced from the reference images
   - Same garment/footwear, same details, same colors, same fit, same construction
   - The product should look natural on the person — not floating, not pasted on
   - The product should be clearly visible and identifiable in the shot, but not artificially highlighted

${isFootwear ? `FOOTWEAR-SPECIFIC: Refer to the footwear generically. Do NOT describe specific colors, patterns, or branding — the image generator has the actual photos. Include the instruction: "Reproduce the footwear EXACTLY as shown in the reference images."` : `CLOTHING-SPECIFIC: Describe how the garment should look on the person — the fit, drape, and how it interacts with the body and environment. Ensure all visible garment details from the reference images are preserved.`}

═══ OUTPUT FORMAT ═══
Write a 2-4 paragraph generation prompt that covers:
1. The scene and setting in vivid detail (location, time of day, atmosphere, background elements)
2. The person (appearance, ${isSelfie ? "selfie pose, expression, arm position" : "natural pose, body language, activity"})
3. How the product is being worn and how it looks in context
4. Camera/photography characteristics (smartphone quality, lighting, composition imperfections)
${isFootwear ? "\nRemember: Do NOT describe specific product colors, patterns, or branding in the prompt. Include an instruction to reproduce the footwear exactly from the reference images." : ""}

Output ONLY the generation prompt text. No preamble, no explanation.`,
  });

  // Product reference images
  for (const img of garmentImages) {
    const base64 = await fileToBase64(img.file);
    parts.push({ inlineData: { mimeType: img.file.type, data: base64 } });
  }

  // Complementary images
  for (const img of complementaryImages) {
    const base64 = await fileToBase64(img.file);
    parts.push({ inlineData: { mimeType: img.file.type, data: base64 } });
  }

  // Scene reference images
  for (const img of scene.referenceImages) {
    const base64 = await fileToBase64(img.file);
    parts.push({ inlineData: { mimeType: img.file.type, data: base64 } });
  }

  // Generation parameters
  parts.push({
    text: `
--- UGC GENERATION PARAMETERS ---
Product Category: ${isFootwear ? "Footwear" : "Clothing"}
Product Type: ${productTypeLabel}
Gender: ${genderLabel}
Scene: ${scene.name || "Custom"} — ${scene.description}
Shot Type: ${isSelfie ? "Selfie (front-facing camera)" : "Normal (third-person, rear camera)"}
Aspect Ratio: ${aspectRatio}
${productInfo ? `Product Info: ${productInfo}` : ""}
${additionalInfo ? `Additional Instructions: ${additionalInfo}` : ""}

CRITICAL REMINDERS:
- The person must look like a REAL everyday human, NOT a professional model
- The photo must look like a REAL smartphone photo, NOT a professional studio shot
- The product must be reproduced EXACTLY from the reference images
- The scene must feel authentic to the described location

Now write the UGC image generation prompt.`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: "user", parts }],
    config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeStepCost("gemini-3.1-pro-preview", "UGC Prompt (Gemini 3.1 Pro)", tokens);

  const text = response.text?.trim();
  if (!text) throw new Error("No UGC prompt generated from Gemini 3.1 Pro");
  return { prompt: text, cost };
}

/**
 * Step 2: Use Nano Banana 2 to generate the UGC image from the dynamic prompt.
 * Images-first approach (like footwear) since product fidelity from photos is critical.
 */
export async function generateUGCImage({
  apiKey,
  prompt,
  garmentImages,
  complementaryImages,
  sceneReferenceImages,
  aspectRatio,
  gender,
  productCategory = "clothing",
  isSelfie = false,
  imageSize = "2K",
}: {
  apiKey: string;
  prompt: string;
  garmentImages: GarmentImage[];
  complementaryImages: ComplementaryImage[];
  sceneReferenceImages?: File[];
  aspectRatio: AspectRatio;
  gender: Gender;
  productCategory?: ProductCategory;
  isSelfie?: boolean;
  imageSize?: "1K" | "2K" | "4K";
}): Promise<{ imageData: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const isFootwear = productCategory === "footwear";
  const genderLabel = gender === "male" ? "male" : gender === "female" ? "female" : "any gender";
  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Images first — product reference photos
  for (const img of garmentImages) {
    const base64 = await fileToBase64(img.file);
    contents.push({ inlineData: { mimeType: img.file.type, data: base64 } });
  }

  // Complementary images
  for (const img of complementaryImages) {
    const base64 = await fileToBase64(img.file);
    contents.push({ inlineData: { mimeType: img.file.type, data: base64 } });
  }

  // Scene reference images (mood/vibe)
  if (sceneReferenceImages && sceneReferenceImages.length > 0) {
    for (const file of sceneReferenceImages) {
      const base64 = await fileToBase64(file);
      contents.push({ inlineData: { mimeType: file.type, data: base64 } });
    }
  }

  // Dynamic prompt + enforcement instruction
  contents.push({
    text: `${prompt}\n\n` +
      `Reproduce the ${isFootwear ? "footwear" : "clothing/garment"} EXACTLY from the reference images above — same colors, patterns, textures, materials, construction, shape, and all visual details. ` +
      `Do not change, replace, or reinterpret any detail of the product. ` +
      (isFootwear ? `Do not use your knowledge of any brand to modify the logos or branding — copy only what is visible in the reference photos. ` : `Preserve every garment attribute: sleeve length, neckline, hemline, fabric texture, print, and construction details. `) +
      `The person in the image MUST be ${genderLabel} — this is a ${genderLabel} product and the wearer must match. ` +
      `The person must look like a REAL everyday human — not a professional model. ` +
      `The overall image must look like a natural smartphone photo — not a professional or studio shot. ` +
      (isSelfie ? `This is a selfie — front-facing smartphone camera perspective with slight wide-angle distortion. ` : `This is a candid third-person photo taken with a smartphone rear camera. `) +
      `The setting, lighting, and composition should all feel authentic and unstaged.`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("UGC Image (Nano Banana 2)", tokens, imageSize);

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return { imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, cost };
      }
    }
  }

  throw new Error("No UGC image generated from Nano Banana 2");
}

// ╔═══════════════════════════════════════════════════════════════╗
// ║               REPLICATE FAST — Prompt + Image                  ║
// ╚═══════════════════════════════════════════════════════════════╝

/**
 * Step 1: Use Gemini 3.1 Pro to generate a detailed replication prompt.
 * Receives input asset images + a reference output image and produces a
 * text prompt that describes how to compose the assets into the same
 * layout/structure as the reference.
 */
export async function generateReplicatePrompt({
  apiKey,
  assetImages,
  referenceOutput,
  additionalInfo,
}: {
  apiKey: string;
  assetImages: File[];
  referenceOutput: File;
  additionalInfo: string;
}): Promise<{ text: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  parts.push({
    text: `You are an expert graphic designer and prompt engineer specializing in image composition replication. Your task is to analyze a set of INPUT ASSET IMAGES and a REFERENCE OUTPUT IMAGE, then write a highly detailed prompt that instructs an AI image generator to create a NEW image that:

1. Uses the content from the INPUT ASSET IMAGES as the raw material
2. Arranges and composes them in EXACTLY the same layout, structure, and visual hierarchy as the REFERENCE OUTPUT IMAGE

═══════════════════════════════════════════════════════════════
CRITICAL RULES:
═══════════════════════════════════════════════════════════════

1. LAYOUT REPLICATION: The generated image must have the EXACT same visual structure as the reference output — same arrangement of elements, same proportional sizing, same positioning of text blocks, images, tables, and decorative elements.

2. CONTENT REPLACEMENT: Replace the content in the reference layout with the content from the input assets. For example:
   - If the reference has a size guide table with Regular Fit data, and the input assets include an Oversized Fit table, use the Oversized Fit data in the same table position
   - If the reference shows a model wearing a shirt, and the input assets include a different model/product photo, place that photo in the same position
   - If the reference has a brand logo, preserve it or use the logo from input assets

3. STYLE MATCHING: Match the visual style of the reference — same fonts (or closest match), same colors for headers/borders/backgrounds, same spacing, same visual treatment of images (sizing, cropping, positioning).

4. TEXT & DATA ACCURACY: Any text, numbers, measurements, or data from the input assets must be reproduced EXACTLY as they appear — no changes to values, units, or formatting.

5. VISUAL FIDELITY: The output should look like a professional, polished composition — not a rough collage. Edges should be clean, elements properly aligned, and the overall quality should match or exceed the reference.

6. BRAND ELEMENTS: If the input assets or reference contain brand logos, watermarks, or brand-specific elements (like brand name text), reproduce them faithfully.

═══════════════════════════════════════════════════════════════
YOUR OUTPUT:
═══════════════════════════════════════════════════════════════

Write a detailed image generation prompt (3-5 paragraphs) that describes:
- The exact layout structure (what goes where, sizes, positions)
- How each input asset maps to a position in the layout
- Visual style details (colors, fonts, borders, backgrounds)
- Any text content that should appear and its exact formatting
- The overall composition and aspect ratio

Be EXTREMELY specific about positions, sizes, and arrangements. The image generator needs pixel-level guidance to replicate the layout accurately.

Output ONLY the generation prompt text.`,
  });

  // Add input asset images
  parts.push({
    text: "\n\n═══ INPUT ASSET IMAGES (raw material to use in the composition) ═══",
  });
  for (let i = 0; i < assetImages.length; i++) {
    parts.push({
      text: `\nInput Asset ${i + 1}:`,
    });
    const base64 = await fileToBase64(assetImages[i]);
    parts.push({
      inlineData: { mimeType: assetImages[i].type, data: base64 },
    });
  }

  // Add reference output image
  parts.push({
    text: "\n\n═══ REFERENCE OUTPUT IMAGE (the layout/structure to replicate) ═══\nThe generated image must follow this EXACT layout and structure, but use the content from the input assets above:",
  });
  const refBase64 = await fileToBase64(referenceOutput);
  parts.push({
    inlineData: { mimeType: referenceOutput.type, data: refBase64 },
  });

  // Additional instructions
  if (additionalInfo) {
    parts.push({
      text: `\n\n═══ ADDITIONAL INSTRUCTIONS ═══\n${additionalInfo}`,
    });
  }

  parts.push({
    text: "\n\nNow write the detailed image generation prompt that will recreate this layout using the input assets.",
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: "user", parts }],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeStepCost("gemini-3.1-pro-preview", "Replicate Prompt (Gemini 3.1 Pro)", tokens);

  let text = "";
  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text && !part.thought) {
        text += part.text;
      }
    }
  }

  if (!text) {
    throw new Error("No prompt text generated for Replicate Fast");
  }

  return { text: text.trim(), cost };
}

/**
 * Step 2: Use Nano Banana 2 to generate the replicated image.
 * Sends all asset images, the reference output, and the generated prompt.
 */
export async function generateReplicateImage({
  apiKey,
  prompt,
  assetImages,
  referenceOutput,
  aspectRatio,
  imageSize = "2K",
}: {
  apiKey: string;
  prompt: string;
  assetImages: File[];
  referenceOutput: File;
  aspectRatio: AspectRatio;
  imageSize?: "1K" | "2K" | "4K";
}): Promise<{ imageData: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Reference output image FIRST — the layout the model needs to replicate
  contents.push({
    text: "REFERENCE LAYOUT IMAGE — the generated image must replicate this exact layout and structure:",
  });
  const refBase64 = await fileToBase64(referenceOutput);
  contents.push({
    inlineData: { mimeType: referenceOutput.type, data: refBase64 },
  });

  // Input asset images — the content to place into the layout
  for (let i = 0; i < assetImages.length; i++) {
    contents.push({
      text: `Input Asset ${i + 1} — use this content in the composition:`,
    });
    const base64 = await fileToBase64(assetImages[i]);
    contents.push({
      inlineData: { mimeType: assetImages[i].type, data: base64 },
    });
  }

  // The generated prompt with enforcement
  contents.push({
    text: `${prompt}\n\n` +
      `═══ CRITICAL REPLICATION INSTRUCTIONS ═══\n` +
      `1. The generated image MUST follow the EXACT same layout and structure as the reference layout image above.\n` +
      `2. Replace the content in the layout with the content from the input asset images.\n` +
      `3. All text, numbers, measurements, and data from the input assets must be reproduced EXACTLY — no changes.\n` +
      `4. Match the visual style: colors, fonts, borders, spacing, and overall design language of the reference.\n` +
      `5. The result should look like a professionally designed image, not a rough collage.\n` +
      `6. Preserve any brand logos, watermarks, or brand elements faithfully.\n` +
      `7. The layout structure (positions, sizes, proportions of elements) must be pixel-accurate to the reference.`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("Replicate Image (Nano Banana 2)", tokens, imageSize);

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return { imageData: part.inlineData.data, cost };
      }
    }
  }

  throw new Error("No replicated image generated from Nano Banana 2");
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT VIDEO — Prompt Generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generateVideoPrompt({
  apiKey,
  productCategory = "clothing",
  gender,
  productImages,
  productInfo,
  theme,
  themeKeywords,
  cameraMovement,
  cameraMovementDescription,
  modelMovement,
  modelMovementDescription,
  background,
  model,
  modelImage,
  aspectRatio,
  duration,
  totalDuration,
  negativePrompt,
  additionalInfo,
}: {
  apiKey: string;
  productCategory: ProductCategory;
  gender: Gender;
  productImages: { file: File; preview: string }[];
  productInfo: string;
  theme: string;
  themeKeywords: string;
  cameraMovement: string;
  cameraMovementDescription: string;
  modelMovement: string;
  modelMovementDescription: string;
  background: BackgroundConfig;
  model: AIModel | null;
  modelImage: ModelImage | null;
  aspectRatio: string;
  duration: number;
  /** Full video duration when extension is used (e.g. 16). Equals duration when no extension. */
  totalDuration?: number;
  negativePrompt: string;
  additionalInfo: string;
}): Promise<{ text: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });
  const fullDuration = totalDuration ?? duration;
  const isExtendedBase = fullDuration > duration;
  const isFootwear = productCategory === "footwear";
  const genderLabel = gender === "male" ? "men's" : gender === "female" ? "women's" : "unisex";
  const hasModel = model !== null || modelImage !== null;
  const orientationLabel = aspectRatio === "9:16" ? "vertical/portrait (ideal for social media Reels, Stories, TikTok)" : "horizontal/landscape (ideal for YouTube, website hero banners)";

  const systemPrompt = `You are a world-class Senior Director of Photography with 20+ years at top-tier fashion advertising studios (Condé Nast, LVMH campaigns, Nike/Adidas global launches). You craft video prompts that produce footage indistinguishable from $500K production shoots.

YOUR TASK: Write a hyper-detailed, production-grade video generation prompt for the Veo AI model. The output must look like it was shot by a professional crew with a RED V-RAPTOR or ARRI ALEXA 35 camera system — NOT like AI-generated content.

═══ PRODUCTION BRIEF ═══

PRODUCT: ${isFootwear ? "Footwear" : "Clothing"} (${genderLabel})
FORMAT: ${orientationLabel}
DURATION: ${duration} seconds
${isExtendedBase ? `IMPORTANT — THIS PROMPT COVERS ONLY THE FIRST ${duration} SECONDS: The full video will be ${fullDuration} seconds, but a SEPARATE extension prompt will handle seconds ${duration + 1}-${fullDuration}. You must write ONLY for the first ${duration} seconds. Do NOT try to describe actions, camera movements, or poses beyond the ${duration}-second mark. Do NOT include a "closing beat" or final pose — the video must feel like it's MID-FLOW at the ${duration}-second mark so the extension continues seamlessly. End the ${duration}-second clip in the MIDDLE of an action — walking, turning, or moving — never in a settled, static pose.` : ""}
${productInfo ? `PRODUCT DETAILS: ${productInfo}` : ""}

${isFootwear ? `═══ FOOTWEAR BRANDING & LOGO PRESERVATION (HIGHEST PRIORITY) ═══

★★★ THE #1 ISSUE WITH FOOTWEAR VIDEO GENERATION IS INACCURATE LOGOS AND TEXT ★★★

Study the reference product images with extreme care. Every logo, text element, wordmark, symbol, emblem, stripe pattern, or graphic mark on the footwear must be described in EXACT detail so the video generator reproduces them with 100% fidelity in every frame.

BRAND-BLIND APPROACH — NEVER identify the brand by name:
Describe every branding element PURELY as abstract visual shapes and graphics.
NEVER name the brand (no "Nike", "Adidas", "Puma", "New Balance", etc.).

For EACH visible branding element on the footwear, describe ALL of the following:
1. VISUAL SHAPE: Exact geometric form ("curved checkmark-shaped graphic", "three parallel diagonal stripes", "circular emblem with a leaping cat silhouette")
2. RENDERING STYLE: Embossed, debossed, printed, stitched, reflective, metallic, perforated, woven, rubberized, heat-pressed
3. EXACT COLOR(S): Precise color of the mark against the shoe surface
4. SIZE: Relative to the shoe surface area
5. PLACEMENT: Exact position on the shoe — which surface (lateral, medial, tongue, heel counter, toe box, midsole) and precise location
6. TEXT/WORDMARKS: Exact letterforms as you see them — describe each letter, font style (bold, italic, serif, sans-serif, all-caps), letter spacing, size, color. Do NOT identify the word as a brand — describe it as "text reading [exact letters]"
7. ORIENTATION: Angle, rotation, direction the mark faces

Include a PERSISTENT FIDELITY INSTRUCTION in the output prompt:
"Throughout every frame of the video, the footwear's logos, text, symbols, and graphic marks must remain EXACTLY as shown in the reference images — same shape, same color, same size, same placement. The video generator must NOT use its world knowledge of any brand to alter, reinterpret, or substitute any branding element. Copy only what is visible in the reference photos, frame by frame."

` : ""}CREATIVE DIRECTION:
- Theme: "${theme}" — ${themeKeywords}
- Camera Movement: ${cameraMovementDescription}${cameraMovement.includes(" + ") ? `\n- CAMERA CHOREOGRAPHY: The video uses multiple camera movements in sequence — transition between them naturally across the ${duration}-second duration. ${isExtendedBase ? `Use ONLY these camera movements for the first ${duration} seconds. Additional movements will be specified separately for the extension portion — do NOT anticipate or include them here.` : `Time the transitions evenly across the clip.`}` : ""}
${modelMovement ? `- Model Movement: ${modelMovementDescription}${modelMovement.includes(" + ") ? `\n- MODEL CHOREOGRAPHY: The model performs these movements in sequence throughout the ${duration}-second duration. Transition between them fluidly — each movement should flow naturally into the next. ${isExtendedBase ? `Use ONLY these model movements for the first ${duration} seconds. Additional movements will be specified separately for the extension — do NOT anticipate or include them here.` : `Time the transitions evenly across the clip.`}` : ""}` : ""}

${hasModel ? `TALENT DIRECTION:
${model ? `- Cast: ${model.name} — ${model.description}` : ""}
${modelImage ? "- Talent reference photo provided — match this EXACT person's appearance, skin tone, build, and features." : ""}

═══ LIVING PERFORMANCE (THE #1 PRIORITY — READ THIS BEFORE ANYTHING ELSE) ═══

CRITICAL FACE RULE — KEEP THE FACE ATTRACTIVE AND MINIMAL:
The model's face must ALWAYS look like a fashion campaign — composed, attractive, and photogenic.
DO NOT write extreme or exaggerated facial expressions. DO NOT describe wide eyes, open mouth, clenched jaw, furrowed brow, flared nostrils, or intense stares. These produce distorted, ghost-like faces in video generation.

FACE — keep it SIMPLE and ATTRACTIVE:
- The face should be CALM and PLEASANT throughout — like a model on a fashion set who looks good in every frame
- Allowed facial actions (SUBTLE ONLY): a gentle closed-lip smile, eyes looking in a specific direction, a slight head turn, a relaxed glance at the camera
- FORBIDDEN facial actions (these WILL produce ghost-like distortions): wide eyes, open mouth showing teeth, aggressive expressions, grimacing, squinting, furrowed brow, clenched jaw, flared nostrils, surprised look, intense stare
- Default face: relaxed, mouth gently closed or with a slight smile, eyes looking naturally ahead or toward the camera, brow smooth and relaxed

THE DYNAMISM COMES FROM THE BODY AND CLOTHING — NOT THE FACE:
All energy, movement, and action should be expressed through body movement, fabric motion, hair movement, and camera work. The face stays composed and editorial.

BODY — describe these as CONTINUOUS ACTIONS:
- Breathing: "chest rises with a visible inhale, shoulders drop on the exhale"
- Walking gait (if walking): "heel strikes the ground, weight rolls forward to the toe, arms swing naturally, hips sway with each step, fabric bounces with the stride rhythm"
- Hands: "fingers trail along the hem" / "she adjusts the cuff" / "his thumb hooks into his front pocket"
- Weight: "she shifts her weight to her left hip" / "he rocks forward onto the balls of his feet"
- Fabric response: "as she turns, the hem swings with momentum" / "fabric pulls taut across the shoulder as her arm rises"
- Hair: "hair sways with each step" / "a strand moves across her forehead"` : `TALENT/SUBJECT DIRECTION:
- Study the reference product images carefully.
- If the images show a real person wearing the product: feature that person in the video. Preserve their exact appearance, skin tone, hair, body type.
  FACE RULE: The face must stay CALM, ATTRACTIVE, and COMPOSED at all times — gentle smile or relaxed neutral expression. NEVER write extreme expressions (wide eyes, open mouth, grimacing, furrowed brow) — these produce ghost-like distortions. All energy comes from body movement, fabric motion, and camera work.
- If the images show only the product (flat lay, hanger, or isolated): create a compelling product-only hero video with dramatic lighting reveals, texture close-ups, and dynamic camera work.
- ABSOLUTELY NO "invisible model", "ghost mannequin", or floating clothing.`}

SCENE/ENVIRONMENT:
${background.mode === "inspiration" ? "Use the provided inspiration image as the scene reference — match its environment, lighting mood, color palette, and spatial depth." : background.textDescription ? background.textDescription : "Premium studio environment with professional lighting setup — think high-end e-commerce campaign."}

${negativePrompt ? `AVOID: ${negativePrompt}` : ""}
${additionalInfo ? `DIRECTOR'S NOTES: ${additionalInfo}` : ""}

═══ CINEMATOGRAPHY STANDARDS (CRITICAL) ═══

You MUST incorporate ALL of the following professional production elements into the prompt:

1. LIGHTING DESIGN (most important for realism):
   - Specify a professional lighting setup: key light, fill light, rim/hair light, and practicals
   - Describe light QUALITY: soft wraparound, hard directional, dappled, diffused, specular
   - Include light INTERACTION with the product: how fabric catches light, how texture is revealed by directional lighting, subtle sheen, shadow play in folds/pleats
   - Color temperature: warm (3200K tungsten), cool (5600K daylight), or mixed for cinematic tension
   - AVOID flat, even lighting — use contrast and depth

2. CAMERA SPECIFICATIONS:
   - Describe lens choice: 85mm f/1.4 for shallow DOF portraits, 35mm for environmental, 50mm for natural perspective, macro for texture
   - Depth of field: shallow bokeh for hero product shots, deeper for environmental context
   - Frame rate feel: smooth 24fps cinematic with REAL-TIME playback speed — NOT slow motion
   - SPEED RULE: All movement — walking, turning, gestures, fabric motion, hair — must play at NORMAL REAL-WORLD SPEED. A walking step should take the same time it takes in real life (~0.5s per step). Do NOT slow anything down unless the theme specifically calls for a brief slow-motion accent (max 1 second). The default is always 1x real-time speed.
   - Camera movement must feel physically REAL — as if on a dolly, Steadicam, gimbal, or crane. Include subtle imperfections: a gentle drift, organic easing, weight in the movement

3. COLOR SCIENCE & GRADING:
   - Specify a color grade direction: warm fashion tones, cool editorial, rich and saturated, desaturated moody, high-contrast film
   - Skin tones must look natural and flattering — never waxy, oversaturated, or grey
   - Product colors must be TRUE TO LIFE — fabric colors accurate and rich

4. TEXTURE & MATERIAL RENDERING:
   - Describe exactly how light reveals the product's material: the way silk catches a rim light, how cotton absorbs soft light, how leather shows micro-texture, how knits create shadow patterns
   - Include at least one moment where the camera lingers on fabric/material detail
${isFootwear ? `   - FOOTWEAR LOGOS & TEXT IN MOTION: Every logo, text, symbol, and graphic mark on the footwear must remain SHARP, LEGIBLE, and PIXEL-ACCURATE in every single frame. When the camera moves or the shoe rotates, the branding must track correctly with the shoe surface — no smearing, warping, fading, or morphing of any mark. Describe moments where lighting specifically highlights the branding elements.\n` : ""}

5. PRODUCTION DESIGN:
   - Set dressing, props (if any), and environmental context must feel curated — not random
   - Negative space and composition follow the rule of thirds or golden ratio
   - Background elements should have natural depth-of-field separation

6. PACING & EDITORIAL RHYTHM:
   - ${isExtendedBase ? `This is the FIRST ${duration} SECONDS of a longer ${fullDuration}-second video. Structure: OPENING HOOK (first 1-2s) → HERO MOMENT (middle) → END MID-ACTION (final second). Do NOT create a closing beat or settled pose — the video must feel like it's in the middle of movement at the ${duration}-second mark for seamless extension.` : `The ${duration}-second video must have a clear arc: OPENING HOOK (first 1-2s), HERO MOMENT (middle), CLOSING BEAT (final 1-2s)`}
   - Pacing must feel REAL-TIME and NATURAL — like watching a real person move at normal speed. NOT slow motion. Movement should feel brisk, purposeful, and alive.
   - Theme adjusts ENERGY, not speed: luxury = smooth and elegant at normal speed, street/sport = energetic and punchy at normal speed, editorial = precise and confident at normal speed
   - Every frame must be intentional — no dead time, no awkward pauses, no slow-motion drift

7. ANTI-AI DIRECTIVES (CRITICAL):
   - NO plastic/waxy skin — skin must have natural texture, pores, subtle imperfections
   - NO unnaturally smooth fabric — textiles must show weave, grain, natural drape
   - NO symmetrical or overly perfect compositions — slight asymmetry feels more real
   - NO floating or defying-gravity fabric — fabric must obey physics
   - Movement must have natural WEIGHT and MOMENTUM — bodies and fabric respond to gravity and inertia
   - Lighting must cast REAL shadows with appropriate softness and direction
   - NO FROZEN FACE: the model's face should show gentle, subtle shifts — a slight smile arriving, eyes glancing in a new direction, a small head turn. Keep it minimal and attractive.
   - NO EXTREME EXPRESSIONS: never describe wide eyes, open mouth with teeth showing, clenched jaw, furrowed brow, flared nostrils, grimacing, squinting, or aggressive/surprised looks. These produce ghost-like distortions.
   - NO MANNEQUIN BODY: the model must show visible breathing (chest/shoulder movement), at least one weight shift, and hands must be doing something specific (not hanging limp).

${theme.toLowerCase().includes("dynamic") || theme.toLowerCase().includes("action") || theme.toLowerCase().includes("sport") || theme.toLowerCase().includes("street") ? `8. DYNAMIC/ACTION THEME — SPECIAL RULES:
   The energy in this theme comes from BODY MOVEMENT, FABRIC DYNAMICS, and CAMERA ENERGY — NOT from the face.
   - FACE: Must remain CALM, COMPOSED, and ATTRACTIVE throughout — like a Nike or Adidas campaign model who looks effortlessly cool even mid-movement. Gentle smile or relaxed neutral. No grimacing, no wide eyes, no open mouth.
   - BODY: Explosive, athletic, weighted movement — muscles engage, feet strike with impact, arms swing with momentum, fabric stretches and pulls during movement, hair whips and bounces
   - FABRIC: The clothing is the star — show it responding dynamically to movement: swinging, bouncing, pulling taut, catching air, settling after each step
   - CAMERA: Handheld or gimbal feel with urgency — reactive framing, slight shake, as if chasing the action. NOT a smooth studio dolly.
   - LIGHTING: Contrasty and environmental — harsh directional light, natural shadows, NOT a flat 3-point studio setup
   - COLOR: Rich and slightly contrasty — NOT oversaturated or overly polished` : ""}

═══ OUTPUT FORMAT ═══

STRUCTURE RULE: In every paragraph, describe the MODEL'S BODY ACTIONS FIRST, then the camera and lighting. The face should be mentioned only briefly (calm, relaxed, gentle smile) — never describe extreme facial expressions.

FACE SAFETY CHECK — BEFORE WRITING EACH PARAGRAPH:
Ask yourself: "Would this facial description produce a normal, attractive face?" If the description includes ANY of these, DELETE IT and replace with "calm expression" or "gentle smile":
- Open mouth / teeth showing
- Wide eyes / staring
- Furrowed brow / grimacing
- Clenched jaw / flared nostrils
- Squinting / aggressive look
- Surprised expression

Write 3-5 dense paragraphs structured as: [BODY ACTION] → [FACE (brief, attractive)] → [CAMERA/LIGHTING] → [ENVIRONMENT].

Paragraph 1 — THE ARRIVAL (first 1-2s):
Describe the model's body in motion — a step, a turn, weight settling, hands positioned. Face: mention only a simple, attractive expression ("a relaxed, composed expression" or "a gentle closed-lip smile as her eyes find the camera"). THEN camera and lighting.

Paragraph 2 — THE JOURNEY (middle):
Body movement is the star — describe the gait, stride, fabric responding to movement, hands interacting with clothing, hair moving. Face: one brief, subtle shift at most ("her gaze shifts from the camera to her sleeve" or "a slight smile arrives"). THEN camera following.

Paragraph 3 — THE PRODUCT MOMENT:
A physical interaction between the model's hands and the garment — fingers on fabric, adjusting a collar, smoothing a hem. The model glances down at the garment briefly. THEN camera detail on the product.

Paragraph 4 — THE RESOLVE (final 1-2s):
The model settles into a professional, editorial closing pose that SHOWCASES THE PRIMARY GARMENT. This is not a random freeze — the final pose must feel intentional and product-focused, as if the model is presenting or drawing attention to the hero garment.
Study the product from the reference images (and any product info or additional instructions provided) to determine what the primary garment is, then choose a closing pose that highlights it:
- For TOPS (shirts, jackets, blouses): one hand adjusts the collar or lapel, or fingers rest on a button, or arms frame the torso — pose draws the eye to the upper body.
- For BOTTOMS (pants, skirts): a hand rests on the hip or touches the waistband, weight shifts to one leg to show the drape and fit — pose draws the eye to the lower body.
- For DRESSES / ONEPIECE: a slight turn with the fabric catching light, or hands gently hold the hem or smooth the fabric at the waist — pose shows the full silhouette.
- For OUTERWEAR (coats, jackets): a hand holds the lapel open or adjusts a cuff, or the model turns slightly to show the structure — pose highlights the garment's shape and construction.
Face: calm, warm, composed — a gentle smile directed at the camera. THEN closing camera position.

Include specific technical language throughout: focal lengths, f-stops, lighting rigs, color temperatures, camera rigs.
Do NOT name any brand. Do NOT use the words "AI", "generated", "invisible model", or "ghost mannequin".
${isFootwear ? `\nFOOTWEAR LOGO/TEXT FINAL CHECK — Before outputting, verify your prompt includes:
1. A detailed description of EVERY visible logo, text, symbol, and graphic mark on the footwear (described as abstract visual shapes, not brand names)
2. At least one moment where the camera highlights the branding (e.g. a light sweep across the logo, a close framing that shows the text clearly)
3. An explicit instruction that all branding must remain sharp, legible, and unchanged in every frame
4. The phrase: "Reproduce all logos, text, and branding marks EXACTLY as they appear in the reference images — do not alter, reinterpret, or substitute any detail."` : ""}
Output ONLY the prompt — no preamble, headers, or explanation.`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: systemPrompt },
  ];

  if (modelImage) {
    const b64 = await fileToBase64(modelImage.file);
    parts.push({ text: "\n[MODEL REFERENCE PHOTO — video must feature this exact person]" });
    parts.push({ inlineData: { mimeType: modelImage.file.type, data: b64 } });
  }

  for (const img of productImages) {
    const b64 = await fileToBase64(img.file);
    parts.push({ text: isFootwear
      ? `\n[PRODUCT REFERENCE IMAGE — Study ALL logos, text, symbols, and graphic marks on the footwear. Describe each one in full detail (shape, color, size, placement, rendering style) using the brand-blind approach.]`
      : `\n[PRODUCT REFERENCE IMAGE]` });
    parts.push({ inlineData: { mimeType: img.file.type, data: b64 } });
  }

  if (background.mode === "inspiration" && background.inspirationImage) {
    const b64 = await fileToBase64(background.inspirationImage.file);
    parts.push({ text: "\n[BACKGROUND/SCENE INSPIRATION IMAGE]" });
    parts.push({ inlineData: { mimeType: background.inspirationImage.file.type, data: b64 } });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: parts,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeStepCost("gemini-3.1-pro-preview", "Video Prompt (Gemini 3.1 Pro)", tokens);

  const rawText = response.text?.trim();
  if (!rawText) throw new Error("No video prompt generated");

  // Prepend a direct performance directive that Veo sees FIRST.
  // Video models prioritize early text — this ensures the human performance
  // is the primary rendering focus, not camera/lighting/scenery.
  const isDynamicTheme = /dynamic|action|sport|runway/i.test(theme);

  const hasModelMovement = modelMovement.length > 0;
  const movementDirective = hasModelMovement ? ` The model's body performs the following choreography: ${modelMovementDescription}.` : "";

  const dynamicClosing = isExtendedBase
    ? "The clip ends with the model still in active motion — mid-stride, mid-turn, or transitioning between movements — maintaining full energy and momentum. Do NOT settle into a final pose."
    : "The clip ends with the model settling into a strong, grounded stance that showcases the primary garment, with a calm, composed look toward the camera.";

  const standardClosing = isExtendedBase
    ? "The clip ends with the model still in gentle motion — mid-step, shifting weight, or adjusting the garment — maintaining natural flow. Do NOT settle into a final pose."
    : "The clip ends with the model settling into a polished, editorial pose that draws attention to the primary garment — with a warm, composed expression toward the camera.";

  const performancePrefix = hasModel
    ? isDynamicTheme
      ? `A real person in a fashion campaign video shot at NORMAL REAL-TIME SPEED (NOT slow motion) with a calm, composed, attractive face and dynamic athletic body movement. All motion plays at 1x real-world speed — walking, turning, gestures, and fabric movement look exactly as fast as they would in real life. The face stays relaxed and photogenic throughout — gentle closed-lip smile or relaxed neutral expression, smooth brow, eyes looking naturally ahead. The face NEVER grimaces, squints, shows teeth, opens the mouth wide, or makes extreme expressions. All energy comes from the body: powerful strides with real heel-to-toe footfalls, arms swinging with momentum, hips driving the movement, fabric bouncing and pulling with each step, hair moving naturally.${movementDirective} The clothing responds dynamically — stretching, swinging, catching air. The body moves with athletic confidence and physical weight. ${dynamicClosing}\n\n`
      : `A real person in a fashion campaign video shot at NORMAL REAL-TIME SPEED (NOT slow motion) with a calm, attractive face and natural body movement. All motion plays at 1x real-world speed — walking, turning, gestures, and fabric movement look exactly as fast as they would in real life. The face stays relaxed and photogenic throughout — gentle closed-lip smile or soft neutral expression, smooth brow, eyes looking naturally at the camera or glancing gently in a new direction. The face NEVER grimaces, squints, shows teeth, opens the mouth wide, or makes extreme expressions. The body breathes visibly — chest and shoulders rise and fall. Hands move with purpose — touching clothing, adjusting a sleeve, resting naturally.${movementDirective} When walking, the gait has real weight: heel-to-toe footfalls, natural arm swing, hip movement, hair and fabric moving with each step. ${standardClosing}\n\n`
    : "";

  const footwearBrandingPrefix = isFootwear
    ? `CRITICAL — FOOTWEAR BRANDING FIDELITY: The footwear shown in the reference images contains specific logos, text, symbols, and graphic marks that must be reproduced with 100% accuracy in EVERY frame of this video. Do NOT use world knowledge of any brand to alter, reinterpret, or substitute any branding element. Copy ONLY what is visible in the reference photos. All logos must remain sharp, correctly shaped, correctly colored, and correctly positioned on the shoe surface throughout all movement and camera angles. Text on the footwear must remain legible and unchanged. If the shoe rotates or the camera angle changes, the branding must track correctly with the shoe's 3D surface — no smearing, warping, fading, or morphing.\n\n`
    : "";

  const text = footwearBrandingPrefix + performancePrefix + rawText;

  return { text, cost };
}

// =============================================================================
// VIDEO EXTENSION PROMPT PIPELINE
// =============================================================================

export async function generateVideoExtensionPrompt({
  apiKey,
  basePrompt,
  extensionCameraMovement,
  extensionCameraMovementDescription,
  extensionModelMovement,
  extensionModelMovementDescription,
  theme,
  themeKeywords,
  duration,
  productCategory = "clothing",
  gender,
  productInfo,
  additionalInfo,
}: {
  apiKey: string;
  basePrompt: string;
  extensionCameraMovement: string;
  extensionCameraMovementDescription: string;
  extensionModelMovement: string;
  extensionModelMovementDescription: string;
  theme: string;
  themeKeywords: string;
  duration: number;
  productCategory: ProductCategory;
  gender: Gender;
  productInfo: string;
  additionalInfo: string;
}): Promise<{ text: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });
  const isFootwear = productCategory === "footwear";
  const genderLabel = gender === "male" ? "men's" : gender === "female" ? "women's" : "unisex";
  const isDynamicTheme = /dynamic|action|sport|runway/i.test(theme);

  const hasCameraMovements = extensionCameraMovement.length > 0;
  const hasModelMovements = extensionModelMovement.length > 0;

  const systemPrompt = `You are a world-class Senior Director of Photography. You are writing the SECOND HALF of a fashion product video that will be appended to an already-generated first half via video extension.

═══ CONTEXT ═══

The FIRST 8 SECONDS of this video have already been generated using the following prompt:

--- BEGIN BASE PROMPT ---
${basePrompt}
--- END BASE PROMPT ---

Your job: Write a prompt for the CONTINUATION that will be seamlessly appended. The extension is ${duration} seconds long.

PRODUCT: ${isFootwear ? "Footwear" : "Clothing"} (${genderLabel})
THEME: "${theme}" — ${themeKeywords}
${productInfo ? `PRODUCT DETAILS: ${productInfo}` : ""}
${additionalInfo ? `DIRECTOR'S NOTES: ${additionalInfo}` : ""}

${hasCameraMovements ? `CAMERA MOVEMENT FOR THIS EXTENSION: ${extensionCameraMovementDescription}
Use these camera movements for this portion of the video. They are DIFFERENT from the first half — this creates dynamic visual variety.` : `No specific camera movement assigned — continue with gentle, complementary camera work that feels natural after the base clip.`}

${hasModelMovements ? `MODEL MOVEMENT FOR THIS EXTENSION: ${extensionModelMovementDescription}
The model performs these movements during this portion of the video. They continue or evolve from the first half's movement sequence — transition fluidly from wherever the base clip ended.` : ""}

═══ CRITICAL RULES FOR EXTENSION PROMPTS ═══

1. SEAMLESS CONTINUATION: The extension picks up from the EXACT moment the base clip ends. Do NOT re-introduce the model or re-establish the scene. Start mid-action — as if the camera never stopped rolling. The model should already be in motion at the very first frame of this extension.

2. SAME EVERYTHING: Same person, same clothing, same lighting setup, same color grade, same scene/environment. Nothing changes except the camera movement and the model's evolving action.

3. ABSOLUTELY NO REPETITION OF THE FIRST HALF: This is the #1 problem with video extensions. Do NOT repeat, mirror, or re-do ANY action from the base clip. If the model walked forward in the first half, they should NOT walk forward again — they should be doing something DIFFERENT (turning, pausing, changing direction, interacting with the garment). If the camera panned left in the first half, it should NOT pan left again. Every second of this extension must show NEW visual content — new body positions, new camera angles, new interactions with the product. The viewer should never feel like they're watching the same footage twice.

4. THE EXTENSION MUST CONTAIN THE CLOSING BEAT: Since this is the FINAL portion of the full video, the last 1-2 seconds must settle into a professional, editorial closing pose that SHOWCASES THE PRIMARY GARMENT:
   - For TOPS: hand adjusts collar/lapel, fingers on a button, arms frame the torso
   - For BOTTOMS: hand on hip or waistband, weight shift to show drape and fit
   - For DRESSES/ONEPIECE: slight turn with fabric catching light, hands smooth fabric at waist
   - For OUTERWEAR: hand holds lapel open, adjusts a cuff, slight turn to show structure
   - For FOOTWEAR: a step that lands cleanly showcasing the product, or a standing pose with feet prominently placed
   End with a calm, warm expression directed at the camera.

5. FACE SAFETY (CRITICAL): The model's face must stay CALM, ATTRACTIVE, and COMPOSED. Gentle closed-lip smile or relaxed neutral. NEVER describe wide eyes, open mouth with teeth, furrowed brow, clenched jaw, grimacing, or any extreme expression. All energy comes from body movement, fabric motion, and camera work.

6. BODY CONTINUITY: If the model was walking in the base clip, they should still be in motion at the start of the extension. If they were posing, the extension starts from that pose. Match the energy and pace — but then EVOLVE into something new.

7. REAL-TIME SPEED (CRITICAL): All movement must play at NORMAL REAL-WORLD SPEED — NOT slow motion. Walking, turning, gestures, fabric movement, and camera motion should look exactly as fast as they would in real life. A walking step takes ~0.5 seconds. Do NOT slow anything down.

═══ OUTPUT FORMAT ═══

Write 2-3 dense paragraphs describing the continuation. Structure each paragraph as: [BODY ACTION] → [FACE (brief, attractive)] → [CAMERA/LIGHTING].

Paragraph 1: The continuation begins mid-action — the model is ALREADY moving as the clip starts. Describe a NEW action or evolution from where the base clip left off. ${hasCameraMovements ? "Introduce the new camera movement." : "The camera continues naturally."}
Paragraph 2: The model interacts with the garment in a way NOT seen in the first half. Show a DIFFERENT angle of the product, a DIFFERENT body position, or a DIFFERENT interaction. ${hasCameraMovements ? "The camera transitions to the specified movement." : "The camera continues naturally."}
Final paragraph: The closing beat — model settles into the product-showcasing pose with a warm, composed expression. Camera arrives at its final position.

ANTI-DUPLICATION CHECKLIST — before outputting, verify:
- Does the model perform any action that's identical to the first half? If yes, REWRITE.
- Does the camera move in the same direction/pattern as the first half? If yes, REWRITE.
- Does any moment look like it could be footage from the first 8 seconds? If yes, REWRITE.

Do NOT describe what happened in the first 8 seconds — only what happens NOW.
Do NOT name any brand. Do NOT use "AI", "generated", "extension", or "second half".
Output ONLY the prompt — no preamble, headers, or explanation.`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: systemPrompt },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: parts,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  const tokens = extractTokenUsage(response);
  const cost = computeStepCost("gemini-3.1-pro-preview", "Video Extension Prompt (Gemini 3.1 Pro)", tokens);

  const rawText = response.text?.trim();
  if (!rawText) throw new Error("No extension prompt generated");

  const performancePrefix = isDynamicTheme
    ? `A real person in a fashion campaign video with a calm, composed, attractive face and dynamic athletic body movement. The face stays relaxed and photogenic throughout. The face NEVER grimaces, squints, shows teeth, opens the mouth wide, or makes extreme expressions. All energy comes from the body. The clip ends with the model settling into a strong, grounded stance that showcases the primary garment, with a calm, composed look toward the camera.\n\n`
    : `A real person in a fashion campaign video with a calm, attractive face and natural body movement. The face stays relaxed and photogenic throughout. The face NEVER grimaces, squints, shows teeth, opens the mouth wide, or makes extreme expressions. The clip ends with the model settling into a polished, editorial pose that draws attention to the primary garment — with a warm, composed expression toward the camera.\n\n`;

  const footwearBrandingPrefix = isFootwear
    ? `CRITICAL — FOOTWEAR BRANDING FIDELITY: All logos, text, symbols, and graphic marks on the footwear must remain EXACTLY as in the reference images throughout this continuation — same shape, color, size, and placement. Do NOT alter, reinterpret, or substitute any branding element. Text must stay legible. Branding must track correctly with the shoe surface through all movement.\n\n`
    : "";

  const text = footwearBrandingPrefix + performancePrefix + rawText;

  return { text, cost };
}

// =============================================================================
// ROOM STAGING PIPELINE
// =============================================================================

/**
 * Room Staging Step 1: Generate a scene-focused prompt using Gemini 3.1 Pro.
 * The product reference images carry the detail; the prompt describes ROOM, LIGHTING, COMPOSITION.
 */
export async function generateRoomStagingPrompt({
  apiKey,
  category,
  productType,
  subType,
  productShape,
  productDimensions,
  productImages,
  productInfo,
  stylingProps,
  roomStyle,
  roomInspirationImage,
  roomDescription,
  background,
  shot,
  aspectRatio,
  additionalInfo,
  previousMismatchFeedback,
}: {
  apiKey: string;
  category: RoomStagingCategory;
  productType: string;
  subType: string;
  productShape: ProductShape;
  productDimensions: string;
  productImages: File[];
  productInfo: string;
  stylingProps: File[];
  roomStyle: RoomStyle | null;
  roomInspirationImage: ModelImage | null;
  roomDescription: string;
  background: BackgroundConfig;
  shot: RoomStagingShot;
  aspectRatio: AspectRatio;
  additionalInfo: string;
  previousMismatchFeedback?: string;
}): Promise<{ text: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const isProductOnly = !shot.requiresRoom;
  const categoryLabel = category === "home-decor" ? "Home Decor" : "Furniture";
  const productTypeLabel = productType.replace(/-/g, " ");
  const subTypeLabel = subType ? subType.replace(/-/g, " ") : "";

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  let systemPrompt = `You are an expert interior and product photographer specializing in ${categoryLabel.toLowerCase()} photography for e-commerce. Your job is to create a SCENE & COMPOSITION prompt for an AI image generator (Nano Banana 2).

CRITICAL CONTEXT: The image generator will receive the actual product reference photos SEPARATELY and is instructed to reproduce the product pixel-for-pixel from those photos. YOUR prompt should focus on the SCENE, PLACEMENT, LIGHTING, and COMPOSITION — NOT on re-describing the product in detail. If you describe the product too specifically in text, the image generator may follow your text description instead of the actual reference photos, causing fidelity loss.

PRODUCT: ${productTypeLabel}${subTypeLabel ? ` (${subTypeLabel})` : ""} — ${categoryLabel}
PRODUCT SHAPE: ${productShape}
${productDimensions ? `PRODUCT DIMENSIONS: ${productDimensions} — THIS IS THE REAL-WORLD SIZE. The product must appear at this EXACT scale relative to standard room furniture. For reference: a typical sofa seat is ~50cm deep, a standard doorway is ~200cm tall, a dining chair seat is ~45cm high. Use these benchmarks to ensure the product is rendered at CORRECT, REALISTIC proportions in the room.` : ""}
${productInfo ? `PRODUCT DETAILS: ${productInfo}` : ""}

SHOT TYPE: ${isProductOnly ? "PRODUCT-ONLY — Clean product shot, no room context. The product is the sole subject on a clean background." : "ROOM-STAGED — The product is placed in a styled interior room setting."}
SHOT: ${shot.name} — ${shot.description}
VIEW ANGLE: ${shot.viewAngle}
FRAMING: ${shot.framing}`;

  const isDimensionDiagram = shot.id === "rs-dimension-diagram";

  if (isProductOnly) {
    if (isDimensionDiagram && productDimensions) {
      systemPrompt += `

DIMENSION DIAGRAM SHOT — SPECIAL INSTRUCTIONS:
This is a PRODUCT DIMENSION DIAGRAM image for e-commerce. The product must be shown in a clean, professional flat-lay view with MEASUREMENT ANNOTATIONS drawn directly on the image.

REQUIREMENTS:
1. BACKGROUND: Clean white or very light grey background — no distractions, no room elements, no props.
2. PRODUCT: Show the full product from directly above (top-down / bird's-eye view). The entire product must be visible with some padding around it.
3. DIMENSION LINES: Draw clean, professional dimension/measurement lines on the image:
   - Use thin black or dark grey lines with small arrows or perpendicular end-caps at each end (standard technical drawing style)
   - Draw a HORIZONTAL line along the WIDTH of the product with the width measurement labeled
   - Draw a VERTICAL line along the LENGTH/HEIGHT of the product with the length measurement labeled
   - The dimension lines should be placed OUTSIDE the product edges (not overlapping the product surface) with small leader lines connecting to the product edges
4. MEASUREMENT TEXT: The text "${productDimensions}" must be clearly legible, using a clean sans-serif font. Split into individual dimensions along each axis (e.g., "75 cm" on the width line, "120 cm" on the length line).
5. LIGHTING: Even, shadow-free lighting — product colors must be accurate with no harsh shadows.
6. STYLE: Professional e-commerce dimension diagram — like what you'd see on a product page to communicate size. Clean, precise, informative.
7. The product pattern, colors, and details must match the reference images EXACTLY.
- Include: "Reproduce the product EXACTLY as shown in the reference images"`;
    } else {
      systemPrompt += `

PRODUCT-ONLY SHOT GUIDELINES:
- Describe the background (clean, gradient, textured surface, etc.)
- Describe the lighting setup (soft diffused, directional to reveal texture, rim light for edge definition)
- Describe the product placement and angle
- For texture-focused shots: emphasize raking light that reveals the weave, grain, or surface quality
- For flat-lay shots: describe the overhead camera position and even lighting
- The product must be the SOLE subject — no furniture, no room elements
- Include: "Reproduce the product EXACTLY as shown in the reference images"`;
    }
  } else {
    systemPrompt += `

ROOM-STAGED SHOT GUIDELINES:
${roomStyle ? `ROOM STYLE: ${roomStyle.name} — ${roomStyle.description}` : ""}
${roomDescription ? `ROOM DESCRIPTION: ${roomDescription}` : ""}

SCENE ELEMENTS CHECKLIST:
1. PRODUCT PLACEMENT — Where and how the product sits in the room (on floor, on wall, on table, draped over furniture, etc.). Consider its shape (${productShape}) and scale.${productDimensions ? `\n   ★★★ SCALE CRITICAL: The product is ${productDimensions}. It MUST appear at this EXACT real-world size relative to the room and furniture. A 75x120cm rug is SMALL — roughly the size of a doormat or bath mat — it should NOT fill a living room floor. Compare against standard furniture: a sofa is ~200cm wide, a coffee table is ~120cm wide, a doorway is ~200cm tall. Get the proportions RIGHT. ★★★` : ""}
2. SURROUNDING FURNITURE & DECOR — What other elements are in the scene to create context. Keep the product as the HERO.
3. CAMERA ANGLE & FRAMING — ${shot.viewAngle} view, ${shot.framing} framing. Describe the camera position and what's visible in the frame.
4. LIGHTING — Direction, quality (natural window light, warm lamp light, diffused overhead). For textured products like rugs and woven items, raking or side light reveals texture beautifully.
5. COMPOSITION — Rule of thirds, negative space, visual hierarchy with the product as focal point.
6. OVERALL MOOD — The atmosphere: cozy, modern, luxurious, bright and airy, warm and intimate, etc.
- Include: "Reproduce the product EXACTLY as shown in the reference images"`;
  }

  systemPrompt += `

PRODUCT REFERENCE RULE:
- Refer to the product generically as "the ${productTypeLabel} shown in the reference images"
- Do NOT describe specific colors, patterns, or construction details of the product
- The image generator will copy the product directly from the reference photos
- Focus your prompt on everything EXCEPT the product's visual details

Output ONLY the generation prompt text. ${isProductOnly ? "2-3" : "3-4"} paragraphs describing the scene, lighting, composition, and mood.`;

  parts.push({ text: systemPrompt });

  if (productImages.length > 0) {
    parts.push({ text: "\n\n[PRODUCT REFERENCE IMAGES — for the image generator to reproduce the product, NOT for you to describe]:" });
    for (const file of productImages) {
      const base64 = await fileToBase64(file);
      parts.push({ inlineData: { mimeType: file.type, data: base64 } });
    }
  }

  if (!isProductOnly && roomInspirationImage) {
    parts.push({ text: "\n\n[ROOM REFERENCE IMAGE — match this room style/mood]:" });
    const base64 = await fileToBase64(roomInspirationImage.file);
    parts.push({ inlineData: { mimeType: roomInspirationImage.file.type, data: base64 } });
  }

  if (stylingProps.length > 0) {
    parts.push({ text: "\n\n[STYLING PROP REFERENCES — include these items in the scene]:" });
    for (const file of stylingProps) {
      const base64 = await fileToBase64(file);
      parts.push({ inlineData: { mimeType: file.type, data: base64 } });
    }
  }

  if (background.inspirationImage) {
    parts.push({ text: "\n\n[ENVIRONMENT/LIGHTING INSPIRATION]:" });
    const base64 = await fileToBase64(background.inspirationImage.file);
    parts.push({ inlineData: { mimeType: background.inspirationImage.file.type, data: base64 } });
  }

  let paramsBlock = `\n\n--- GENERATION PARAMETERS ---
Product: ${productTypeLabel}${subTypeLabel ? ` / ${subTypeLabel}` : ""} (${categoryLabel})
Shape: ${productShape}
${productDimensions ? `Dimensions: ${productDimensions}` : ""}
Shot: ${shot.name} (${shot.viewAngle}, ${shot.framing})
${!isProductOnly && roomStyle ? `Room Style: ${roomStyle.name}` : ""}
${roomDescription ? `Room Description: ${roomDescription}` : ""}
${background.textDescription ? `Environment: ${background.textDescription}` : ""}
Aspect Ratio: ${aspectRatio}
${additionalInfo ? `Additional Instructions: ${additionalInfo}` : ""}
${previousMismatchFeedback ? `\n═══ CORRECTION FROM PREVIOUS ATTEMPT ═══\nA previous generation attempt was flagged by our quality-control system with these issues:\n${previousMismatchFeedback}\n\nYou MUST address ALL of the above issues in your new prompt. Write explicit, forceful instructions that directly prevent each flagged problem. For example:\n- If "wrong colors" was flagged: emphasize exact color reproduction from the reference images.\n- If "altered proportions" or scale issues were flagged: add very specific size instructions using the product dimensions and room furniture as scale benchmarks.\n- If "missing pattern" was flagged: emphasize that the product pattern must be reproduced with 100% fidelity from the reference photos.\n- If "incorrect texture" was flagged: describe the lighting setup to reveal the correct surface texture.\nDo NOT just repeat generic instructions — specifically call out and correct the exact issues listed above.\n═══ END CORRECTION ═══` : ""}

REMINDER: Focus on SCENE, PLACEMENT, LIGHTING, COMPOSITION. Do NOT describe product details — the image generator will copy the product from the reference photos.
${productDimensions ? `SCALE REMINDER: The product is ${productDimensions}. Explicitly state the product's size relative to nearby furniture in your prompt so the image generator gets the scale right.` : ""}
Include the sentence: "Reproduce the product EXACTLY as shown in the reference images."

Now write the ${isProductOnly ? "product photography" : "interior/room staging"} prompt:`;

  parts.push({ text: paramsBlock });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: parts,
    config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });

  const text = response.text?.trim();
  if (!text) throw new Error("No prompt generated");

  const tokens = extractTokenUsage(response);
  const cost = computeStepCost("gemini-3.1-pro-preview", "Prompt Generation (Gemini 3.1 Pro)", tokens);

  return { text, cost };
}

/**
 * Room Staging Step 2: Use Nano Banana 2 to generate the image.
 * Images-first architecture — product reference images first, room second, text last.
 */
export async function generateRoomStagingImage({
  apiKey,
  prompt,
  productImages,
  stylingProps,
  roomInspirationImage,
  background,
  aspectRatio,
  imageSize = "2K",
  isProductOnly = false,
}: {
  apiKey: string;
  prompt: string;
  productImages: File[];
  stylingProps: File[];
  roomInspirationImage: ModelImage | null;
  background: BackgroundConfig;
  aspectRatio: AspectRatio;
  imageSize?: "1K" | "2K" | "4K";
  isProductOnly?: boolean;
}): Promise<{ imageData: string; cost: StepCost }> {
  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  for (const file of productImages) {
    const base64 = await fileToBase64(file);
    contents.push({ inlineData: { mimeType: file.type, data: base64 } });
  }

  if (!isProductOnly && roomInspirationImage) {
    const base64 = await fileToBase64(roomInspirationImage.file);
    contents.push({ inlineData: { mimeType: roomInspirationImage.file.type, data: base64 } });
  }

  for (const file of stylingProps) {
    const base64 = await fileToBase64(file);
    contents.push({ inlineData: { mimeType: file.type, data: base64 } });
  }

  if (background.inspirationImage) {
    const base64 = await fileToBase64(background.inspirationImage.file);
    contents.push({ inlineData: { mimeType: background.inspirationImage.file.type, data: base64 } });
  }

  contents.push({
    text: `${prompt}

Keep the product exactly the same as in the reference images above. Preserve the original pattern, colors, texture, material, shape, construction, fringe, border, and any branding or labels exactly as they appear — do not change, replace, or reinterpret any detail of the product. Do not use your knowledge of any brand to modify any visual elements — copy only what is visible in the reference photos.${isProductOnly ? "\n\nThis is a PRODUCT-ONLY shot. No room setting, no furniture, no human model. The product is the sole subject." : `\n\nIMPORTANT: The product must be at REALISTIC real-world scale relative to the room furniture. Do NOT make the product fill the entire floor or dominate the room unnaturally. Standard reference: a sofa is ~200cm wide, a doorway is ~200cm tall, a dining chair seat is ~45cm high.`}`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio, imageSize },
    },
  });

  let imageData = "";
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData) {
      imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageData) throw new Error("No image generated");

  const tokens = extractTokenUsage(response);
  const cost = computeImageGenCost("Room Staging Image (Nano Banana 2)", tokens, imageSize);

  return { imageData, cost };
}
