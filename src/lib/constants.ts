import { AccessoryCategory, AIInfographicStyle, AIModel, AspectRatio, BottomwearLength, FeatureMode, FitType, FootwearType, Gender, ImageGenModel, InfographicBackgroundStyle, InfographicTemplate, ModelSwapBackgroundMode, Pose, PoseFraming, ProductCategory, SetLayoutStyle, SleeveLength, SwatchShape, TopwearLength } from "./types";

export const PRODUCT_CATEGORY_OPTIONS: { value: ProductCategory; label: string; description: string }[] = [
  { value: "clothing", label: "Clothing", description: "Apparel, garments, and fashion items" },
  { value: "footwear", label: "Footwear", description: "Shoes, boots, sandals, and more" },
];

/**
 * Image-generation backends the user can pick from.
 * Currently surfaced only for Footwear VTON (single + bulk); everything else
 * is fixed to the Gemini backend.
 */
export const IMAGE_GEN_MODELS: { value: ImageGenModel; label: string; description: string }[] = [
  { value: "gemini", label: "Nano Banana 2", description: "Gemini 3.1 Flash Image — default, best overall fidelity" },
  { value: "gpt-image-2", label: "GPT-Image-2", description: "Azure OpenAI gpt-image-2 — alternative rendering style" },
];

export const GENDER_OPTIONS: { value: Gender; label: string; description: string }[] = [
  { value: "male", label: "Male", description: "Men's product" },
  { value: "female", label: "Female", description: "Women's product" },
  { value: "unisex", label: "Unisex", description: "Gender-neutral product" },
];

export const FOOTWEAR_TYPE_OPTIONS: { value: FootwearType; label: string; description: string }[] = [
  { value: "casual-shoes", label: "Casual Shoes", description: "Everyday casual footwear" },
  { value: "formal-shoes", label: "Formal Shoes", description: "Dress shoes, oxfords, derbys" },
  { value: "sneakers", label: "Sneakers", description: "Athletic-inspired casual shoes" },
  { value: "boots", label: "Boots", description: "Ankle, knee-high, Chelsea, etc." },
  { value: "sandals", label: "Sandals", description: "Sandals, flip-flops, slides" },
  { value: "loafers", label: "Loafers", description: "Loafers, moccasins, slip-ons" },
  { value: "heels", label: "Heels", description: "Heels, pumps, stilettos, wedges" },
  { value: "sports-shoes", label: "Sports Shoes", description: "Running, training, athletic" },
  { value: "slippers", label: "Slippers", description: "House slippers, mules" },
];

export const AI_MODELS: AIModel[] = [
  {
    id: "f-south-asian-1",
    name: "Priya",
    description: "South Asian female model, mid-20s, slim build",
    ethnicity: "South Asian",
    gender: "female",
    thumbnail: "👩🏽",
  },
  {
    id: "f-east-asian-1",
    name: "Mei",
    description: "East Asian female model, early 20s, petite build",
    ethnicity: "East Asian",
    gender: "female",
    thumbnail: "👩🏻",
  },
  {
    id: "f-caucasian-1",
    name: "Emma",
    description: "Caucasian female model, late 20s, athletic build",
    ethnicity: "Caucasian",
    gender: "female",
    thumbnail: "👩🏼",
  },
  {
    id: "f-african-1",
    name: "Amara",
    description: "African female model, mid-20s, tall and elegant",
    ethnicity: "African",
    gender: "female",
    thumbnail: "👩🏿",
  },
  {
    id: "f-latina-1",
    name: "Sofia",
    description: "Latina female model, late 20s, curvy build",
    ethnicity: "Latina",
    gender: "female",
    thumbnail: "👩🏽",
  },
  {
    id: "m-south-asian-1",
    name: "Arjun",
    description: "South Asian male model, late 20s, athletic build",
    ethnicity: "South Asian",
    gender: "male",
    thumbnail: "👨🏽",
  },
  {
    id: "m-east-asian-1",
    name: "Kenji",
    description: "East Asian male model, mid-20s, lean build",
    ethnicity: "East Asian",
    gender: "male",
    thumbnail: "👨🏻",
  },
  {
    id: "m-caucasian-1",
    name: "James",
    description: "Caucasian male model, early 30s, muscular build",
    ethnicity: "Caucasian",
    gender: "male",
    thumbnail: "👨🏼",
  },
  {
    id: "m-african-1",
    name: "Kwame",
    description: "African male model, late 20s, tall and athletic",
    ethnicity: "African",
    gender: "male",
    thumbnail: "👨🏿",
  },
  {
    id: "m-latina-1",
    name: "Carlos",
    description: "Latino male model, mid-20s, medium build",
    ethnicity: "Latino",
    gender: "male",
    thumbnail: "👨🏽",
  },
];

export const FRAMING_OPTIONS: { value: PoseFraming; label: string; shortLabel: string; description: string }[] = [
  { value: "full-body", label: "Full Body", shortLabel: "Full", description: "Head to toe, complete model visible" },
  { value: "three-quarter", label: "¾ Body", shortLabel: "¾", description: "Head to below knee (~75% of body)" },
  { value: "mid-thigh", label: "Mid-Thigh", shortLabel: "Mid", description: "Head to mid-thigh (cowboy shot)" },
  { value: "waist-up", label: "Waist-Up", shortLabel: "Waist", description: "Head to waist/hip area" },
  { value: "bust-up", label: "Close-Up", shortLabel: "Close", description: "Chest and above (detail shot)" },
  { value: "hip-down", label: "Lower Body", shortLabel: "Lower", description: "Hip to feet (lower body focus)" },
  { value: "knee-down", label: "Knee-Down", shortLabel: "Knee↓", description: "Knee to feet (hemline & footwear)" },
  { value: "waist-to-thigh", label: "Close-Up Shot", shortLabel: "Close-Up", description: "Waist to thigh (bottomwear detail crop)" },
  { value: "cropped-shot", label: "Cropped Shot", shortLabel: "Cropped", description: "Below chest to below knee (e-commerce bottom crop)" },
  { value: "product-only", label: "Product Only", shortLabel: "Product", description: "Just the footwear, no model" },
  { value: "feet-closeup", label: "Feet Close-Up", shortLabel: "Feet", description: "Close-up of feet wearing footwear" },
  { value: "ghost-mannequin", label: "Ghost Mannequin", shortLabel: "Ghost", description: "Garment shaped as if worn, no visible model" },
];

export const POSES: Pose[] = [
  // ╔═══════════════════════════════════════════════════════════╗
  // ║                    FRONT VIEW POSES                       ║
  // ╚═══════════════════════════════════════════════════════════╝

  // --- Front · Full Body (head to toe) ---
  {
    id: "front-standing-full",
    name: "Front Standing",
    description: "Standing facing camera with a relaxed, easy posture — weight shifted slightly to one side, shoulders naturally dropped, arms hanging loosely or one hand gently resting at the side. Subtle asymmetry in stance that feels real-person candid, not stiff or posed. Full body head to toe",
    icon: "🧍",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "front-hand-on-hip-full",
    name: "Hand on Hip",
    description: "One hand resting lightly on the hip with a confident but relaxed energy — not rigid or forced. Slight lean into the hip, the other arm loose at the side or lightly touching the thigh. Natural, approachable confidence. Full body head to toe",
    icon: "💃",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "front-crossed-arms-full",
    name: "Crossed Arms",
    description: "Arms loosely crossed in a relaxed, self-assured manner — not tensed or tightly pressed. Shoulders relaxed, slight tilt of the head, weight on one leg for a natural feel. Full body head to toe",
    icon: "🤞",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "front-walking-full",
    name: "Walking (Front)",
    description: "Mid-stride walking naturally towards the camera — not marching, but a relaxed, unhurried pace with a subtle arm swing, one foot ahead of the other. Genuine candid movement energy. Full body visible",
    icon: "🚶‍♀️",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "front-contrapposto-full",
    name: "Contrapposto",
    description: "Weight resting on one leg with a gentle S-curve through the body — hip tilted, opposite shoulder slightly dropped, creating an effortless, classical elegance. Feels natural and lived-in, not overly posed. Full body front view",
    icon: "🎭",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "front-hands-in-pockets-full",
    name: "Hands in Pockets",
    description: "Thumbs or hands casually tucked into pockets, shoulders relaxed, weight slightly shifted — the easy, low-effort stance of someone pausing mid-walk. Genuinely casual and unstaged. Full body head to toe",
    icon: "🤷",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- Front · ¾ Body (head to below knee) ---
  {
    id: "front-standing-3q",
    name: "Front Standing",
    description: "Standing facing camera with a relaxed stance, weight slightly shifted, arms naturally at sides — effortless and approachable. Framed from head to below knee",
    icon: "🧍",
    viewAngle: "front",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "front-hand-on-hip-3q",
    name: "Hand on Hip",
    description: "One hand placed lightly on the hip with relaxed confidence, body weight on one leg, subtle head tilt. Framed from head to below knee",
    icon: "💃",
    viewAngle: "front",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "front-walking-3q",
    name: "Walking (Front)",
    description: "Walking naturally towards camera with an easy, unhurried stride — arms swinging gently, one foot ahead. Framed from head to below knee",
    icon: "🚶‍♀️",
    viewAngle: "front",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- Front · Mid-Thigh (head to upper mid-thigh — tight cowboy shot, lower boundary closer to waist than knee) ---
  {
    id: "front-standing-mid",
    name: "Front Standing",
    description: "Standing facing camera with a relaxed, natural stance. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. The consistent upper-thigh crop keeps attention on the torso and hip silhouette",
    icon: "🧍",
    viewAngle: "front",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "front-hand-on-hip-mid",
    name: "Hand on Hip",
    description: "Confident hand on hip, weight shifted to one leg. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. The crop line remains identical to other mid-thigh shots for catalog consistency",
    icon: "💃",
    viewAngle: "front",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "front-crossed-arms-mid",
    name: "Crossed Arms",
    description: "Arms crossed in a clean editorial pose. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. Ideal for showcasing the topwear fit across the shoulders, chest, and waist",
    icon: "🤞",
    viewAngle: "front",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "onepiece"],
  },
  {
    id: "front-seated-stool-mid",
    name: "Seated on Stool",
    description: "Model seated on a simple wooden stool facing the camera — upright torso, relaxed shoulders, hands resting naturally on thighs or lightly gripping the stool edge. The topwear is fully visible and unobstructed. The seated posture adds variety while keeping the garment the hero. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease. Knees are never visible. The wooden stool is minimal and unobtrusive",
    icon: "🪑",
    viewAngle: "front",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "onepiece"],
  },
  {
    id: "front-lifestyle-interaction-mid",
    name: "Lifestyle Interaction",
    description: "Natural, candid lifestyle pose where the model is interacting with ONE element of the surrounding environment in a way that complements the garment's style, fashion segment, and the scene's mood — for example: leaning the upper back or shoulder against a wall, hand resting on a stair railing, fingers lightly grazing a window pane, leaning a forearm on a counter or window ledge, casually adjusting a sleeve cuff near a doorway, or thumb tucked into a belt loop while leaning into a column. The interaction must feel candid and unposed, never staged. The model's posture, weight distribution, and gaze should harmonise with the garment's fashion segment (formal, casual, streetwear, ethnic, luxury, sportswear, bohemian, minimalist) and the background's mood. STRICT MID-THIGH FRAMING — the frame is head to upper mid-thigh, the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are NEVER visible. Only the sliver of the environmental anchor that fits inside this upper-torso-to-upper-thigh window is visible (e.g. the wall surface adjacent to the upper torso, the upper portion of a railing, the edge of a window frame); never show full architectural elements that would imply a wider crop (no whole window, no entire stair flight, no full railing, no full doorway).",
    icon: "🌿",
    viewAngle: "front",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- Front · Waist-Up (head to waist/hip) ---
  {
    id: "front-standing-waist",
    name: "Front Standing",
    description: "Standing facing camera, cropped at waist showing upper body",
    icon: "🧍",
    viewAngle: "front",
    framing: "waist-up",
    garmentRelevance: ["topwear", "onepiece"],
  },
  {
    id: "front-hand-on-hip-waist",
    name: "Hand on Hip",
    description: "Hand on hip, waist-up crop focusing on upper body silhouette",
    icon: "💃",
    viewAngle: "front",
    framing: "waist-up",
    garmentRelevance: ["topwear", "onepiece"],
  },
  {
    id: "front-crossed-arms-waist",
    name: "Crossed Arms",
    description: "Arms crossed, waist-up crop highlighting neckline and sleeves",
    icon: "🤞",
    viewAngle: "front",
    framing: "waist-up",
    garmentRelevance: ["topwear"],
  },
  {
    id: "front-casual-waist",
    name: "Casual Pose",
    description: "Relaxed casual upper body pose, waist-up framing",
    icon: "😊",
    viewAngle: "front",
    framing: "waist-up",
    garmentRelevance: ["topwear", "onepiece"],
  },

  // --- Front · Bust-Up / Close-Up (chest and above) ---
  {
    id: "front-closeup-bust",
    name: "Front Close-Up",
    description: "Close-up from chest upward showing neckline, collar, and fabric texture detail",
    icon: "🔍",
    viewAngle: "front",
    framing: "bust-up",
    garmentRelevance: ["topwear", "onepiece"],
  },
  {
    id: "front-neckline-bust",
    name: "Neckline Detail",
    description: "Headless crop shot from lower chin to just above the belly — the face is NOT visible (cropped out above the chin). Focus on neckline shape, collar construction, fabric texture, and upper garment detail. This is a 'headless' e-commerce detail shot",
    icon: "✨",
    viewAngle: "front",
    framing: "bust-up",
    garmentRelevance: ["topwear", "onepiece"],
  },

  // --- Front · Hip-Down / Lower Body (hip to feet) ---
  {
    id: "front-standing-hip-down",
    name: "Front Standing",
    description: "Lower body focus from hip to feet, front view showing waistband, pockets, and full leg",
    icon: "👖",
    viewAngle: "front",
    framing: "hip-down",
    garmentRelevance: ["bottomwear", "onepiece"],
  },
  {
    id: "front-walking-hip-down",
    name: "Walking (Front)",
    description: "Walking stride from hip to feet, showing drape, movement, and leg silhouette",
    icon: "🚶",
    viewAngle: "front",
    framing: "hip-down",
    garmentRelevance: ["bottomwear"],
  },
  {
    id: "front-pockets-hip-down",
    name: "Hands in Pockets",
    description: "Hands in pockets, hip to feet view showing pocket depth, fit through hip and thigh",
    icon: "🤷",
    viewAngle: "front",
    framing: "hip-down",
    garmentRelevance: ["bottomwear"],
  },
  {
    id: "front-wide-stance-hip-down",
    name: "Wide Stance",
    description: "Feet apart, hip to feet view showing inner leg seams, fit, and full garment width",
    icon: "🦵",
    viewAngle: "front",
    framing: "hip-down",
    garmentRelevance: ["bottomwear"],
  },

  // --- Front · Knee-Down (knee to feet) ---
  {
    id: "front-standing-knee-down",
    name: "Front Knee-Down",
    description: "Knee to feet detail showing hemline, ankle fit, break, and footwear pairing",
    icon: "🦶",
    viewAngle: "front",
    framing: "knee-down",
    garmentRelevance: ["bottomwear"],
  },

  // --- Front · Close-Up Shot (waist to thigh — bottomwear detail crop) ---
  {
    id: "front-closeup-bottomwear",
    name: "Close-Up Shot",
    description: "E-commerce detail crop: upper edge just above the waistband, lower edge just above the knees. Only the bottomwear garment and immediate surrounding skin are visible — no head, chest, stomach, knees, or legs",
    icon: "🔍",
    viewAngle: "front",
    framing: "waist-to-thigh",
    garmentRelevance: ["bottomwear"],
  },

  // --- Front · Cropped Shot (below chest to below knee — e-commerce bottom crop) ---
  {
    id: "front-cropped-shot",
    name: "Cropped Shot",
    description: "E-commerce bottomwear crop: the frame starts below the chest (lower ribcage/upper abdomen) and ends just below the knees. The abdomen, waist, hips, full thighs, and knees are visible. Head, face, upper chest, lower legs, and feet are completely out of frame. A natural standing pose with the bottomwear as the hero product",
    icon: "✂️",
    viewAngle: "front",
    framing: "cropped-shot",
    garmentRelevance: ["bottomwear"],
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║              THREE-QUARTER FRONT VIEW POSES               ║
  // ╚═══════════════════════════════════════════════════════════╝

  // --- ¾ Front · Full Body ---
  {
    id: "tqf-standing-full",
    name: "¾ Front Standing",
    description: "Angled front view with a relaxed, natural stance — weight gently on one leg, torso slightly turned, arms hanging loosely. Shows front and side of garment with real-person ease. Full body head to toe",
    icon: "🚶",
    viewAngle: "three-quarter-front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "tqf-walking-full",
    name: "¾ Front Walking",
    description: "Walking at an easy angle towards camera with a natural, unhurried stride — subtle arm movement, genuine mid-step energy. Full body visible showing garment in motion",
    icon: "🚶‍♀️",
    viewAngle: "three-quarter-front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "tqf-seated-full",
    name: "¾ Front Seated",
    description: "Seated comfortably at angle — leaning slightly back or forward in a natural sitting posture, one hand on the knee or armrest, legs positioned casually. Full body visible",
    icon: "🪑",
    viewAngle: "three-quarter-front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "tqf-leaning-full",
    name: "¾ Front Leaning",
    description: "Leaning casually against a wall or surface at an angle — one shoulder back, arms relaxed, crossed at the ankle or one knee slightly bent. Effortless cool. Full body visible",
    icon: "🧱",
    viewAngle: "three-quarter-front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "tqf-seated-stool-full",
    name: "¾ Front Seated on Stool",
    description: "Full-body shot of the model seated on a wooden stool, the body rotated 45° clockwise about the vertical axis so the model faces diagonally toward the camera (three-quarter front) — the front and one side of the garment are both visible. Upright relaxed torso, shoulders square to the diagonal, one hand resting naturally on the thigh and the other lightly gripping the front edge of the seat; feet planted on the floor or one foot resting on a stool stretcher, knees and lower legs fully in frame. Framed head to toe with a small margin of floor below the feet; the garment (top, bottom, and footwear) is fully visible and unobstructed and remains the hero of the shot. THE WOODEN STOOL — render this EXACT stool every time, identical in every output: a four-legged backless stool with a seat 30 cm above the floor; the seat is a perfectly round disc 32 cm in diameter and 4 cm thick with a gently rounded (eased) top edge; the four legs are solid turned wood, 4 cm square at the top tapering to 3 cm at the floor, splayed outward at a consistent 8° rake on all four sides; the legs are joined by four flat horizontal stretchers forming a square ring set 12 cm above the floor (a simple box-stretcher — no H-stretcher, no foot ring); joinery is clean mortise-and-tenon with NO visible hardware, screws, brackets, nails, or glue lines. Wood: solid medium walnut, a warm mid-brown (approx. hex #6F4E37) with subtle natural tonal variation; straight, even, open grain running lengthwise along each leg and radially across the round seat, with a few faint darker grain streaks but NO knots, cracks, paint, stain blotches, or distress marks. Finish: smooth satin (low-sheen) clear lacquer — soft light reflection, not glossy and not raw matte. The stool is minimal, clean, and unobtrusive and must NOT change shape, proportion, leg count, color, grain, or finish between generations.",
    icon: "🪑",
    viewAngle: "three-quarter-front",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- ¾ Front · ¾ Body ---
  {
    id: "tqf-standing-3q",
    name: "¾ Front Standing",
    description: "Angled front view with weight shifted to one leg, shoulders relaxed and naturally dropped — body turned slightly to reveal depth. Framed from head to below knee",
    icon: "🚶",
    viewAngle: "three-quarter-front",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "tqf-walking-3q",
    name: "¾ Front Walking",
    description: "Walking at angle with a relaxed, candid stride — natural arm swing, genuine movement. Framed from head to below knee",
    icon: "🚶‍♀️",
    viewAngle: "three-quarter-front",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "tqf-stool-seated-3q",
    name: "Seated on Stool",
    description: "Model seated on a simple wooden stool at a three-quarter angle — relaxed, natural sitting posture with subtle variation on every generation (e.g., one ankle crossed behind the other, hands resting on thigh or lightly on the stool edge, slight forward lean or leaning back). The topwear must be clearly and fully visible — the model's torso is upright and unobstructed. The pose should feel candid and effortless, as if the model just sat down mid-conversation. The wooden stool is minimal and unobtrusive. Framed from head to below knee",
    icon: "🪑",
    viewAngle: "three-quarter-front",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- ¾ Front · Mid-Thigh (head to upper mid-thigh — tight cowboy shot, lower boundary closer to waist than knee) ---
  {
    id: "tqf-standing-mid",
    name: "¾ Front Standing",
    description: "Angled front view with weight gently shifted, torso slightly turned to reveal depth. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. Shows front and side garment silhouette with a compact crop",
    icon: "🚶",
    viewAngle: "three-quarter-front",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "tqf-walking-mid",
    name: "¾ Front Walking",
    description: "Walking at a relaxed angle towards camera with subtle arm movement. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. Captures garment movement while maintaining tight consistent framing",
    icon: "🚶‍♀️",
    viewAngle: "three-quarter-front",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- ¾ Front · Waist-Up ---
  {
    id: "tqf-standing-waist",
    name: "¾ Front Standing",
    description: "Angled front view, waist-up crop showing upper body and partial side",
    icon: "🚶",
    viewAngle: "three-quarter-front",
    framing: "waist-up",
    garmentRelevance: ["topwear", "onepiece"],
  },
  {
    id: "tqf-seated-waist",
    name: "¾ Front Seated",
    description: "Seated at angle, waist-up crop showing how top drapes while seated",
    icon: "🪑",
    viewAngle: "three-quarter-front",
    framing: "waist-up",
    garmentRelevance: ["topwear", "onepiece"],
  },

  // --- ¾ Front · Hip-Down ---
  {
    id: "tqf-standing-hip-down",
    name: "¾ Front Standing",
    description: "Angled front view, hip to feet showing lower garment with dimensional depth",
    icon: "👖",
    viewAngle: "three-quarter-front",
    framing: "hip-down",
    garmentRelevance: ["bottomwear", "onepiece"],
  },

  // --- ¾ Front · Close-Up Shot (waist to thigh — bottomwear detail crop) ---
  {
    id: "tqf-closeup-bottomwear",
    name: "Close-Up Shot",
    description: "Angled front detail crop: upper edge just above the waistband, lower edge just above the knees. Only the bottomwear garment and immediate surrounding skin visible from a three-quarter front angle",
    icon: "🔍",
    viewAngle: "three-quarter-front",
    framing: "waist-to-thigh",
    garmentRelevance: ["bottomwear"],
  },

  // --- ¾ Front · Cropped Shot (below chest to below knee — e-commerce bottom crop) ---
  {
    id: "tqf-cropped-shot",
    name: "Cropped Shot",
    description: "Angled front e-commerce bottomwear crop: the frame starts below the chest (lower ribcage/upper abdomen) and ends just below the knees. The abdomen, waist, hips, full thighs, and knees are visible from a three-quarter front angle. Head, face, upper chest, lower legs, and feet are completely out of frame",
    icon: "✂️",
    viewAngle: "three-quarter-front",
    framing: "cropped-shot",
    garmentRelevance: ["bottomwear"],
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║                    SIDE VIEW POSES                        ║
  // ╚═══════════════════════════════════════════════════════════╝

  // --- Side · Full Body ---
  {
    id: "side-profile-left-full",
    name: "Left Profile",
    description: "Left profile with the model's body rotated about 75–80 degrees about the vertical axis so the LEFT side of the body faces the camera-left edge of the frame (the viewer's left, the 9 o'clock position) — but the chest is opened ~10–15 degrees back toward the camera so the front of the garment is gently visible (this is a flattering soft-profile, NOT a hard 90° silhouette). The model's nose, jawline, and the toes of the leading foot all point toward the 9 o'clock direction. Both shoulders are visible but the camera-side shoulder is closer to the lens. The gaze is OFF-CAMERA, looking out into the 9 o'clock direction (away from the camera) — the model is NOT looking at the lens. The model stands relaxed and grounded with weight on one leg, head to toe in frame. The orientation is ABSOLUTE: do NOT mirror, flip, or reverse — left = camera-left = 9 o'clock.",
    icon: "👤",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "side-profile-right-full",
    name: "Right Profile",
    description: "Right profile with the model's body rotated about 75–80 degrees about the vertical axis so the RIGHT side of the body faces the camera-right edge of the frame (the viewer's right, the 3 o'clock position) — but the chest is opened ~10–15 degrees back toward the camera so the front of the garment is gently visible (this is a flattering soft-profile, NOT a hard 90° silhouette). The model's nose, jawline, and the toes of the leading foot all point toward the 3 o'clock direction. Both shoulders are visible but the camera-side shoulder is closer to the lens. The gaze is OFF-CAMERA, looking out into the 3 o'clock direction (away from the camera) — the model is NOT looking at the lens. The model stands relaxed and grounded with weight on one leg, head to toe in frame. The orientation is ABSOLUTE: do NOT mirror, flip, or reverse — right = camera-right = 3 o'clock.",
    icon: "👤",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "side-walking-full",
    name: "Walking (Side)",
    description: "Natural mid-stride side view with genuine walking momentum — slight forward lean, arms in a relaxed swing, one leg pushing off the ground. Fabric flows with the movement. Full silhouette",
    icon: "🚶‍♂️",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "side-leaning-full",
    name: "Leaning (Side)",
    description: "Leaning casually against a surface in profile — back or shoulder resting against a wall, arms relaxed, ankles possibly crossed. Easy, unhurried body language",
    icon: "🧱",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- Side · ¾ Body ---
  {
    id: "side-profile-3q",
    name: "Side Profile",
    description: "Side profile from head to below knee, showing upper and mid-body silhouette",
    icon: "👤",
    viewAngle: "side",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "side-walking-3q",
    name: "Walking (Side)",
    description: "Side walking stride, head to below knee, showing movement in profile",
    icon: "🚶‍♂️",
    viewAngle: "side",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- Side · Mid-Thigh (head to upper mid-thigh — tight cowboy shot, lower boundary closer to waist than knee) ---
  {
    id: "side-profile-mid",
    name: "Side Profile",
    description: "Full side profile with a natural standing posture. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. Shows the garment's side silhouette, sleeve drape, and how the hem sits at the hip",
    icon: "👤",
    viewAngle: "side",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "side-walking-mid",
    name: "Walking (Side)",
    description: "Side walking stride with natural arm swing. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. Captures how the garment moves in profile with a compact consistent crop",
    icon: "🚶‍♂️",
    viewAngle: "side",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- Side · Waist-Up ---
  {
    id: "side-profile-waist",
    name: "Side Profile",
    description: "Side profile waist-up, showing sleeve shape, garment structure, and side drape",
    icon: "👤",
    viewAngle: "side",
    framing: "waist-up",
    garmentRelevance: ["topwear", "onepiece"],
  },

  // --- Side · Hip-Down ---
  {
    id: "side-profile-hip-down",
    name: "Side Profile",
    description: "Side profile hip to feet, showing leg silhouette, drape, and side seam detail",
    icon: "👖",
    viewAngle: "side",
    framing: "hip-down",
    garmentRelevance: ["bottomwear", "onepiece"],
  },
  {
    id: "side-walking-hip-down",
    name: "Walking (Side)",
    description: "Side walking stride, hip to feet, showing leg movement and fabric flow",
    icon: "🚶‍♂️",
    viewAngle: "side",
    framing: "hip-down",
    garmentRelevance: ["bottomwear"],
  },

  // --- Side · Knee-Down ---
  {
    id: "side-profile-knee-down",
    name: "Side Knee-Down",
    description: "Side view knee to feet, showing pant break, ankle taper, and hem detail",
    icon: "🦶",
    viewAngle: "side",
    framing: "knee-down",
    garmentRelevance: ["bottomwear"],
  },

  // --- Side · Close-Up Shot (waist to thigh — bottomwear detail crop) ---
  {
    id: "side-closeup-bottomwear",
    name: "Close-Up Shot",
    description: "Side view detail crop: upper edge just above the waistband, lower edge just above the knees. Only the bottomwear garment and surrounding skin visible in profile",
    icon: "🔍",
    viewAngle: "side",
    framing: "waist-to-thigh",
    garmentRelevance: ["bottomwear"],
  },

  // --- Side · Cropped Shot (below chest to below knee — e-commerce bottom crop) ---
  {
    id: "side-cropped-shot",
    name: "Cropped Shot",
    description: "Side profile e-commerce bottomwear crop: the frame starts below the chest (lower ribcage/upper abdomen) and ends just below the knees. The abdomen, waist, hips, full thighs, and knees are visible in profile. Head, face, upper chest, lower legs, and feet are completely out of frame",
    icon: "✂️",
    viewAngle: "side",
    framing: "cropped-shot",
    garmentRelevance: ["bottomwear"],
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║              THREE-QUARTER BACK VIEW POSES                ║
  // ╚═══════════════════════════════════════════════════════════╝

  // --- ¾ Back · Full Body ---
  {
    id: "tqb-standing-full",
    name: "¾ Back Standing",
    description: "Angled away from camera showing back and side, full body head to toe",
    icon: "↩️",
    viewAngle: "three-quarter-back",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "tqb-walking-full",
    name: "¾ Back Walking",
    description: "Walking at angle away from camera, full body showing back garment in motion",
    icon: "🚶",
    viewAngle: "three-quarter-back",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- ¾ Back · ¾ Body ---
  {
    id: "tqb-standing-3q",
    name: "¾ Back Standing",
    description: "Angled away, framed from head to below knee showing back detail",
    icon: "↩️",
    viewAngle: "three-quarter-back",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- ¾ Back · Mid-Thigh (head to upper mid-thigh — tight cowboy shot, lower boundary closer to waist than knee) ---
  {
    id: "tqb-standing-mid",
    name: "¾ Back Standing",
    description: "Angled away from camera showing back and side. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. Shows back yoke, shoulder construction, and rear hip silhouette in a compact crop",
    icon: "↩️",
    viewAngle: "three-quarter-back",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- ¾ Back · Waist-Up ---
  {
    id: "tqb-standing-waist",
    name: "¾ Back Standing",
    description: "Angled away, waist-up crop showing back yoke, shoulder seams, and upper garment",
    icon: "↩️",
    viewAngle: "three-quarter-back",
    framing: "waist-up",
    garmentRelevance: ["topwear", "onepiece"],
  },

  // --- ¾ Back · Hip-Down ---
  {
    id: "tqb-standing-hip-down",
    name: "¾ Back Standing",
    description: "Angled away, hip to feet showing back pockets, rear fit, and leg silhouette",
    icon: "👖",
    viewAngle: "three-quarter-back",
    framing: "hip-down",
    garmentRelevance: ["bottomwear", "onepiece"],
  },

  // --- ¾ Back · Close-Up Shot (waist to thigh — bottomwear detail crop) ---
  {
    id: "tqb-closeup-bottomwear",
    name: "Close-Up Shot",
    description: "Angled rear detail crop: upper edge just above the waistband, lower edge just above the knees. Only the bottomwear garment and surrounding skin visible from a three-quarter back angle, showing back pockets and rear fit",
    icon: "🔍",
    viewAngle: "three-quarter-back",
    framing: "waist-to-thigh",
    garmentRelevance: ["bottomwear"],
  },

  // --- ¾ Back · Cropped Shot (below chest to below knee — e-commerce bottom crop) ---
  {
    id: "tqb-cropped-shot",
    name: "Cropped Shot",
    description: "Angled rear e-commerce bottomwear crop: the frame starts below the chest (lower ribcage/upper abdomen) and ends just below the knees. The abdomen, waist, hips, rear, full thighs, and knees are visible from a three-quarter back angle. Head, face, upper chest, lower legs, and feet are completely out of frame",
    icon: "✂️",
    viewAngle: "three-quarter-back",
    framing: "cropped-shot",
    garmentRelevance: ["bottomwear"],
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║                    BACK VIEW POSES                        ║
  // ╚═══════════════════════════════════════════════════════════╝

  // --- Back · Full Body ---
  {
    id: "back-standing-full",
    name: "Back Standing",
    description: "Standing with back to camera in a natural posture — weight on one leg, slight asymmetry in the shoulders, arms hanging loosely. Not rigid; the relaxed stance of someone who just turned around. Full rear view head to toe",
    icon: "🔙",
    viewAngle: "back",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "back-over-shoulder-full",
    name: "Over-the-Shoulder",
    description: "Back to camera with head turned naturally to glance over one shoulder — a candid, warm expression, not stiffly twisted. Body relaxed, weight shifted. Full body visible",
    icon: "↪️",
    viewAngle: "back",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "back-walking-full",
    name: "Walking Away",
    description: "Walking away from camera at a natural, easy pace — relaxed arm swing, one foot mid-step, slight torso rotation from the walking movement. Full back of outfit head to toe",
    icon: "🚶‍♀️",
    viewAngle: "back",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "back-seated-full",
    name: "Seated (Back)",
    description: "Seated comfortably with back to camera — natural sitting posture, perhaps leaning slightly forward or back, showing how garment drapes and fits from behind while at rest",
    icon: "🪑",
    viewAngle: "back",
    framing: "full-body",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- Back · ¾ Body ---
  {
    id: "back-standing-3q",
    name: "Back Standing",
    description: "Back to camera, framed from head to below knee showing rear garment detail",
    icon: "🔙",
    viewAngle: "back",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "back-walking-3q",
    name: "Walking Away",
    description: "Walking away, framed from head to below knee",
    icon: "🚶‍♀️",
    viewAngle: "back",
    framing: "three-quarter",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- Back · Mid-Thigh (head to upper mid-thigh — tight cowboy shot, lower boundary closer to waist than knee) ---
  {
    id: "back-standing-mid",
    name: "Back Standing",
    description: "Back to camera in a natural posture with weight on one leg, slight shoulder asymmetry. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. Shows back yoke, rear garment fit, and hip silhouette from behind",
    icon: "🔙",
    viewAngle: "back",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },
  {
    id: "back-over-shoulder-mid",
    name: "Over-Shoulder",
    description: "Back to camera with head turned naturally to glance over one shoulder. Framed from head to upper mid-thigh — the bottom edge cuts off roughly one-third down the thigh from the hip crease, well above the knee. Knees are never visible. Adds personality while keeping the rear garment detail in focus",
    icon: "↪️",
    viewAngle: "back",
    framing: "mid-thigh",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
  },

  // --- Back · Waist-Up ---
  {
    id: "back-standing-waist",
    name: "Back Standing",
    description: "Back to camera, waist-up showing back yoke, shoulder seams, and back closure",
    icon: "🔙",
    viewAngle: "back",
    framing: "waist-up",
    garmentRelevance: ["topwear", "onepiece"],
  },
  {
    id: "back-over-shoulder-waist",
    name: "Over-Shoulder",
    description: "Looking over shoulder, waist-up showing back neckline and upper back detail",
    icon: "↪️",
    viewAngle: "back",
    framing: "waist-up",
    garmentRelevance: ["topwear", "onepiece"],
  },

  // --- Back · Hip-Down ---
  {
    id: "back-standing-hip-down",
    name: "Back Standing",
    description: "Back to camera, hip to feet showing back pockets, rear seams, and hemline",
    icon: "👖",
    viewAngle: "back",
    framing: "hip-down",
    garmentRelevance: ["bottomwear", "onepiece"],
  },
  {
    id: "back-walking-hip-down",
    name: "Walking Away",
    description: "Walking away, hip to feet showing rear fit, movement, and leg drape",
    icon: "🚶‍♀️",
    viewAngle: "back",
    framing: "hip-down",
    garmentRelevance: ["bottomwear"],
  },

  // --- Back · Knee-Down ---
  {
    id: "back-standing-knee-down",
    name: "Back Knee-Down",
    description: "Back view knee to feet, showing rear hemline, calf fit, and heel-to-hem detail",
    icon: "🦶",
    viewAngle: "back",
    framing: "knee-down",
    garmentRelevance: ["bottomwear"],
  },

  // --- Back · Close-Up Shot (waist to thigh — bottomwear detail crop) ---
  {
    id: "back-closeup-bottomwear",
    name: "Close-Up Shot",
    description: "Rear detail crop: upper edge just above the waistband, lower edge just above the knees. Only the bottomwear garment and surrounding skin visible from behind, showing back pockets, rear yoke, and seat fit",
    icon: "🔍",
    viewAngle: "back",
    framing: "waist-to-thigh",
    garmentRelevance: ["bottomwear"],
  },

  // --- Back · Cropped Shot (below chest to below knee — e-commerce bottom crop) ---
  {
    id: "back-cropped-shot",
    name: "Cropped Shot",
    description: "Rear e-commerce bottomwear crop: the frame starts below the chest (lower ribcage/upper abdomen from behind) and ends just below the knees. The lower back, waist, hips, rear, full thighs, and knees are visible from behind. Head, face, upper back, lower legs, and feet are completely out of frame",
    icon: "✂️",
    viewAngle: "back",
    framing: "cropped-shot",
    garmentRelevance: ["bottomwear"],
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║                  GHOST MANNEQUIN POSES                    ║
  // ║   No visible model — garment shaped as if worn by an      ║
  // ║   invisible person (invisible/ghost mannequin technique)   ║
  // ╚═══════════════════════════════════════════════════════════╝

  // --- Ghost · Front View (full garment) ---
  {
    id: "ghost-front-full",
    name: "Ghost Front Full",
    description: "Front view of the garment shaped as if worn by an invisible person, full garment visible from neckline to hem, no visible model or mannequin",
    icon: "👻",
    viewAngle: "ghost",
    framing: "ghost-mannequin",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
    requiresModel: false,
  },
  {
    id: "ghost-front-closeup",
    name: "Ghost Front Close-Up",
    description: "Front close-up of the garment on an invisible form, emphasizing neckline, collar, button placket, and upper construction details",
    icon: "🔍",
    viewAngle: "ghost",
    framing: "ghost-mannequin",
    garmentRelevance: ["topwear", "onepiece"],
    requiresModel: false,
  },

  // --- Ghost · Back View ---
  {
    id: "ghost-back-full",
    name: "Ghost Back Full",
    description: "Back view of the garment shaped as if worn by an invisible person, showing back panel, yoke, rear construction, and hemline",
    icon: "👻",
    viewAngle: "ghost",
    framing: "ghost-mannequin",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
    requiresModel: false,
  },

  // --- Ghost · Three-Quarter Front View ---
  {
    id: "ghost-3q-front",
    name: "Ghost ¾ Front",
    description: "Three-quarter front angle of the garment on an invisible form, showing depth, drape, and 3D silhouette from neckline to hem",
    icon: "👻",
    viewAngle: "ghost",
    framing: "ghost-mannequin",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
    requiresModel: false,
  },

  // --- Ghost · Side View ---
  {
    id: "ghost-side-full",
    name: "Ghost Side Full",
    description: "Side profile of the garment shaped as if worn by an invisible person, emphasizing silhouette, fabric drape, side seams, and overall fit profile",
    icon: "👻",
    viewAngle: "ghost",
    framing: "ghost-mannequin",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
    requiresModel: false,
  },

  // --- Ghost · Hollow Neck (interior construction visible) ---
  {
    id: "ghost-hollow-neck",
    name: "Ghost Hollow Neck",
    description: "Ghost mannequin shot with hollow neck/chest area exposed — shows inner neckline, collar construction, inner labels, and seamwork that is normally hidden when worn",
    icon: "👻",
    viewAngle: "ghost",
    framing: "ghost-mannequin",
    garmentRelevance: ["topwear", "onepiece"],
    requiresModel: false,
  },

  // --- Ghost · Flat Lay (styled flat surface arrangement) ---
  {
    id: "ghost-flat-lay",
    name: "Ghost Flat Lay",
    description: "Flat lay arrangement of the garment on a clean surface, neatly styled with sleeves folded or spread, showing the entire garment laid flat in a professional e-commerce format",
    icon: "📦",
    viewAngle: "ghost",
    framing: "ghost-mannequin",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
    requiresModel: false,
  },

  // --- Ghost · Floating/Levitating ---
  {
    id: "ghost-floating",
    name: "Ghost Floating",
    description: "Garment appears to float mid-air as if worn by an invisible person in a natural standing pose, casting a subtle shadow below — dramatic product-focused shot",
    icon: "✨",
    viewAngle: "ghost",
    framing: "ghost-mannequin",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
    requiresModel: false,
  },

  // --- Ghost · Detail/Texture Focus ---
  {
    id: "ghost-detail-texture",
    name: "Ghost Detail Focus",
    description: "Extreme close-up of fabric texture, stitching, and material quality on the ghost-mannequin form — macro-style detail shot showcasing garment craftsmanship",
    icon: "🧵",
    viewAngle: "ghost",
    framing: "ghost-mannequin",
    garmentRelevance: ["topwear", "bottomwear", "onepiece"],
    requiresModel: false,
  },
];

// ╔═══════════════════════════════════════════════════════════════╗
// ║                     FOOTWEAR POSES                            ║
// ╚═══════════════════════════════════════════════════════════════╝

const ALL_FOOTWEAR_TYPES: FootwearType[] = [
  "casual-shoes", "formal-shoes", "sneakers", "boots", "sandals",
  "loafers", "heels", "sports-shoes", "slippers",
];

export const FOOTWEAR_POSES: Pose[] = [
  // ╔═══════════════════════════════════════════════════════════╗
  // ║       PRODUCT-ONLY SHOTS — No Human Model                  ║
  // ║       Just the footwear, isolated product photography       ║
  // ╚═══════════════════════════════════════════════════════════╝

  // --- Front · Product Only ---
  {
    id: "fw-front-product",
    name: "Front View (Single)",
    description: "Single shoe facing camera directly — hero shot showing toe box, vamp, tongue, and lacing",
    icon: "👟",
    viewAngle: "front",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-front-pair-product",
    name: "Front View (Pair)",
    description: "Both shoes side by side facing camera — symmetric, balanced product display",
    icon: "👞",
    viewAngle: "front",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-front-low-product",
    name: "Front Low Angle",
    description: "Camera at ground level looking slightly up at the shoe front — dramatic, imposing product view",
    icon: "📐",
    viewAngle: "front",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },

  // --- ¾ Front (~45° from front) · Product Only ---
  {
    id: "fw-tqf-product",
    name: "45° Front-Right (Single)",
    description: "Single shoe angled ~45° to the right — classic e-commerce hero shot showing toe, lateral side, and upper in one frame",
    icon: "🔄",
    viewAngle: "three-quarter-front",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-tqf-left-product",
    name: "45° Front-Left (Single)",
    description: "Single shoe angled ~45° to the left — showing toe, medial side, and inner construction",
    icon: "🔄",
    viewAngle: "three-quarter-front",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-tqf-pair-product",
    name: "45° Front (Pair)",
    description: "Both shoes at a ~45° angle — dynamic pair display with depth and dimension",
    icon: "👞",
    viewAngle: "three-quarter-front",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-tqf-stacked-product",
    name: "Stacked / Leaning",
    description: "One shoe leaning against the other at an angle — editorial, lifestyle product photography",
    icon: "🏔️",
    viewAngle: "three-quarter-front",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },

  // --- Side (90° profile) · Product Only ---
  {
    id: "fw-side-lateral-left-product",
    name: "Lateral Profile — Pointing Left",
    description:
      "A single shoe only — no pair. True 90-degree side profile with the toe box pointing explicitly toward the LEFT edge of the frame (viewer's left / 9 o'clock position) and the heel anchored toward the RIGHT side (3 o'clock position). Full lateral silhouette showing midsole, outsole, heel counter, and side branding. Do NOT mirror, flip, or reverse the orientation under any circumstances — maintain this exact left-facing direction. Show exactly one shoe, never two.",
    icon: "⬅️",
    viewAngle: "side",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-side-lateral-right-product",
    name: "Lateral Profile — Pointing Right",
    description:
      "A single shoe only — no pair. True 90-degree side profile with the toe box pointing explicitly toward the RIGHT edge of the frame (viewer's right / 3 o'clock position) and the heel anchored toward the LEFT side (9 o'clock position). Full lateral silhouette showing midsole, outsole, heel counter, and side branding. Do NOT mirror, flip, or reverse the orientation under any circumstances — maintain this exact right-facing direction. Show exactly one shoe, never two.",
    icon: "➡️",
    viewAngle: "side",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-side-medial-product",
    name: "Side Profile — Medial (Inner)",
    description: "Inner side profile at 90° — medial arch, inner panel construction, and lining details",
    icon: "👤",
    viewAngle: "side",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-side-pair-product",
    name: "Side Profile (Pair)",
    description: "Both shoes in side profile, one behind the other — layered depth composition",
    icon: "👞",
    viewAngle: "side",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },

  // --- ¾ Back (~135° from front) · Product Only ---
  {
    id: "fw-tqb-product",
    name: "45° Back-Right (Single)",
    description: "Single shoe angled ~45° from the rear-right — heel counter, back tab, and partial lateral side visible",
    icon: "↩️",
    viewAngle: "three-quarter-back",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-tqb-left-product",
    name: "45° Back-Left (Single)",
    description: "Single shoe angled ~45° from the rear-left — heel counter, back branding, and partial medial side",
    icon: "↩️",
    viewAngle: "three-quarter-back",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-tqb-pair-product",
    name: "45° Back (Pair)",
    description: "Both shoes from angled rear — showing heel counters, back tabs, and rear branding together",
    icon: "👞",
    viewAngle: "three-quarter-back",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },

  // --- Back (180°) · Product Only ---
  {
    id: "fw-back-product",
    name: "Back / Heel View (Single)",
    description: "Straight-on rear view — heel counter, pull tab, back branding, Achilles notch, and sole rear",
    icon: "🔙",
    viewAngle: "back",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-back-pair-product",
    name: "Back / Heel View (Pair)",
    description: "Both shoes from directly behind — symmetric heel counter and back branding display",
    icon: "👞",
    viewAngle: "back",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },

  // --- Top-Down · Product Only ---
  {
    id: "fw-topdown-product",
    name: "Top-Down (Single)",
    description: "Bird's eye view looking straight down — tongue, lacing system, insole, and collar shape",
    icon: "⬇️",
    viewAngle: "top-down",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-topdown-pair-product",
    name: "Top-Down (Pair)",
    description: "Bird's eye view of both shoes from above — full pair layout showing tongue, lacing, and branding",
    icon: "⬇️",
    viewAngle: "top-down",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },

  // --- Bottom / Sole · Product Only ---
  {
    id: "fw-bottom-product",
    name: "Sole View (Single)",
    description: "Upturned single shoe — outsole tread pattern, branding on sole, flex grooves, and construction",
    icon: "🦶",
    viewAngle: "bottom",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },
  {
    id: "fw-bottom-pair-product",
    name: "Sole View (Pair)",
    description: "Both soles visible — side-by-side outsole display showing full tread pattern and sole branding",
    icon: "🦶",
    viewAngle: "bottom",
    framing: "product-only",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
    requiresModel: false,
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║       ON-MODEL SHOTS — Human Model Wearing Footwear        ║
  // ╚═══════════════════════════════════════════════════════════╝

  // --- Front · On-Model ---
  {
    id: "fw-front-standing-full",
    name: "Front Standing",
    description: "Model standing facing camera, full body head to toe, footwear visible at bottom",
    icon: "🧍",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-front-walking-full",
    name: "Walking (Front)",
    description: "Walking towards camera with natural stride, footwear in motion, full body",
    icon: "🚶‍♀️",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-front-hip-down",
    name: "Lower Body (Front)",
    description: "Hip to feet, front view — footwear is hero, outfit pairing from waist down",
    icon: "👇",
    viewAngle: "front",
    framing: "hip-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-front-knee-down",
    name: "Knee-Down (Front)",
    description: "Knee to feet, front view — footwear as hero with pant hem interaction visible",
    icon: "🦶",
    viewAngle: "front",
    framing: "knee-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-front-seated-knee-down",
    name: "Seated (Front)",
    description: "Model seated, knee-down framing, footwear resting on floor with relaxed pose",
    icon: "🪑",
    viewAngle: "front",
    framing: "knee-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-front-feet-closeup",
    name: "Feet Close-Up (Front)",
    description: "Extreme close-up of feet wearing the footwear — toe box, lacing, and upper detail",
    icon: "👣",
    viewAngle: "front",
    framing: "feet-closeup",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },

  // --- ¾ Front · On-Model ---
  {
    id: "fw-tqf-standing-full",
    name: "¾ Front Standing",
    description: "Angled front view, full body head to toe, footwear prominently visible",
    icon: "🚶",
    viewAngle: "three-quarter-front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-tqf-knee-down",
    name: "¾ Front Knee-Down",
    description: "Angled front, knee to feet — footwear detail with dimensional depth",
    icon: "🦶",
    viewAngle: "three-quarter-front",
    framing: "knee-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-tqf-feet-closeup",
    name: "Feet Close-Up (¾ Front)",
    description: "Angled close-up of feet wearing the footwear — depth, toe box, and upper detail",
    icon: "👣",
    viewAngle: "three-quarter-front",
    framing: "feet-closeup",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },

  // --- Side · On-Model ---
  {
    id: "fw-side-walking-full",
    name: "Walking (Side)",
    description: "Side-profile walking stride, full body — footwear silhouette in motion",
    icon: "🚶‍♂️",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-side-standing-full",
    name: "Standing (Side)",
    description: "Side-profile standing pose, full body — complete outfit with footwear silhouette",
    icon: "🧍",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-side-hip-down",
    name: "Lower Body (Side)",
    description: "Hip to feet, side view — footwear lateral silhouette with outfit context",
    icon: "👇",
    viewAngle: "side",
    framing: "hip-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-side-knee-down",
    name: "Knee-Down (Side)",
    description: "Knee to feet, side view — lateral silhouette with pant drape and shoe profile",
    icon: "🦶",
    viewAngle: "side",
    framing: "knee-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-side-feet-closeup",
    name: "Feet Close-Up (Side)",
    description: "Extreme close-up, side profile — silhouette, branding, and sole edge detail",
    icon: "👣",
    viewAngle: "side",
    framing: "feet-closeup",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },

  // --- ¾ Back · On-Model ---
  {
    id: "fw-tqb-standing-full",
    name: "¾ Back Standing",
    description: "Angled rear view, full body — heel counter and back branding visible in outfit context",
    icon: "↩️",
    viewAngle: "three-quarter-back",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-tqb-knee-down",
    name: "¾ Back Knee-Down",
    description: "Angled rear, knee to feet — heel counter, back tab, and pant-to-shoe transition",
    icon: "🦶",
    viewAngle: "three-quarter-back",
    framing: "knee-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },

  // --- Back · On-Model ---
  {
    id: "fw-back-standing-full",
    name: "Back Standing",
    description: "Model with back to camera, full body — rear of outfit with heel view at bottom",
    icon: "🔙",
    viewAngle: "back",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-back-walking-full",
    name: "Walking Away",
    description: "Walking away from camera, full body — heels visible, showing rear silhouette in motion",
    icon: "🚶‍♀️",
    viewAngle: "back",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-back-knee-down",
    name: "Back Knee-Down",
    description: "Knee to feet from behind — heel counters, back branding, and Achilles area detail",
    icon: "🦶",
    viewAngle: "back",
    framing: "knee-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║       STAIRS / STEPS — On-Model                            ║
  // ╚═══════════════════════════════════════════════════════════╝

  {
    id: "fw-stairs-ascending-front",
    name: "Ascending Stairs (Front)",
    description: "Model walking up stairs towards camera, full body — toe flex, sole bend, and upper crease visible on the leading foot",
    icon: "🪜",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-ascending-side",
    name: "Ascending Stairs (Side)",
    description: "Side profile of model climbing stairs — full lateral silhouette with heel lift on trailing foot and toe push on leading foot",
    icon: "🪜",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-ascending-tqf",
    name: "Ascending Stairs (¾ Front)",
    description: "Three-quarter front view climbing stairs — dynamic angle showing toe box, lateral side, and sole flex simultaneously",
    icon: "🪜",
    viewAngle: "three-quarter-front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-descending-front",
    name: "Descending Stairs (Front)",
    description: "Model walking down stairs towards camera, full body — heel strike visible, showing outsole tread and heel counter",
    icon: "⬇️",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-descending-side",
    name: "Descending Stairs (Side)",
    description: "Side profile descending stairs — full silhouette with heel landing on lower step and ball of foot on upper step",
    icon: "⬇️",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-descending-tqb",
    name: "Descending Stairs (¾ Back)",
    description: "Three-quarter rear view going down stairs — heel counters, back tab, and sole tread visible in a natural descent motion",
    icon: "⬇️",
    viewAngle: "three-quarter-back",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-standing-front",
    name: "Standing on Steps (Front)",
    description: "Model standing on a stair step facing camera, weight on one foot, casual lean — elevated position gives clear footwear display",
    icon: "🪜",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-standing-side",
    name: "Standing on Steps (Side)",
    description: "Model paused on steps in side profile, one foot on a higher step — arch support, heel height, and lateral silhouette highlighted",
    icon: "🪜",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-knee-down-front",
    name: "Stairs Knee-Down (Front)",
    description: "Knee to feet on stairs, front view — close focus on footwear placement across step edges, toe box and sole bend detail",
    icon: "🪜",
    viewAngle: "front",
    framing: "knee-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-knee-down-side",
    name: "Stairs Knee-Down (Side)",
    description: "Knee to feet on stairs, side view — close-up of foot positioned on step edge showing arch, sole flex, and heel lift",
    icon: "🪜",
    viewAngle: "side",
    framing: "knee-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-stairs-feet-closeup",
    name: "Stairs Feet Close-Up",
    description: "Extreme close-up of feet on stair edge — toe overhang, sole bend, crease lines, and step texture interaction",
    icon: "👣",
    viewAngle: "three-quarter-front",
    framing: "feet-closeup",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║       SPORTS / ACTION — On-Model                           ║
  // ╚═══════════════════════════════════════════════════════════╝

  {
    id: "fw-sport-running-side",
    name: "Running (Side)",
    description: "Model in mid-stride running pose, side profile — heel-to-toe transition, midsole compression, and dynamic foot plant visible",
    icon: "🏃",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-sport-running-front",
    name: "Running (Front)",
    description: "Model running towards camera, full body — frontal toe-off, upper flex, and lacing tension on display",
    icon: "🏃",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-sport-running-tqf",
    name: "Running (¾ Front)",
    description: "Three-quarter front view of running stride — dynamic angle capturing toe box, lateral upper, and ground contact",
    icon: "🏃",
    viewAngle: "three-quarter-front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-sport-sprinting-side",
    name: "Sprinting (Side)",
    description: "Explosive sprint posture, side profile — forefoot drive, extreme sole flex, heel fully off ground",
    icon: "💨",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ["sneakers", "sports-shoes"],
  },
  {
    id: "fw-sport-jumping-front",
    name: "Jumping (Front)",
    description: "Model captured mid-jump facing camera — both feet off ground, sole tread, cushioning compression, and upper support visible",
    icon: "⬆️",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["sneakers", "sports-shoes", "casual-shoes"],
  },
  {
    id: "fw-sport-jumping-side",
    name: "Jumping (Side)",
    description: "Side-profile mid-air jump — full lateral silhouette airborne, showing midsole flex and shoe structure under load",
    icon: "⬆️",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ["sneakers", "sports-shoes", "casual-shoes"],
  },
  {
    id: "fw-sport-landing-front",
    name: "Landing (Front)",
    description: "Model landing from a jump, front view — heel impact moment with visible sole compression and cushion response",
    icon: "⬇️",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["sneakers", "sports-shoes", "casual-shoes"],
  },
  {
    id: "fw-sport-lunging-side",
    name: "Lunging (Side)",
    description: "Deep forward lunge, side profile — leading foot flat with full sole contact, trailing foot on toe showing sole flex",
    icon: "🏋️",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ["sneakers", "sports-shoes"],
  },
  {
    id: "fw-sport-lunging-front",
    name: "Lunging (Front)",
    description: "Forward lunge facing camera — wide stance showing both shoes from front, toe box flex on lead foot and heel lift on rear",
    icon: "🏋️",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["sneakers", "sports-shoes"],
  },
  {
    id: "fw-sport-lateral-cut",
    name: "Lateral Cut / Side Shuffle",
    description: "Model in aggressive lateral movement — outer foot planted, inner foot lifting, showing outsole grip and lateral support",
    icon: "↔️",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["sneakers", "sports-shoes"],
  },
  {
    id: "fw-sport-kicking-side",
    name: "Kicking (Side)",
    description: "Model mid-kick with leg extended, side profile — toe box impact area, upper flexibility, and dynamic foot extension",
    icon: "⚽",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ["sneakers", "sports-shoes", "casual-shoes"],
  },
  {
    id: "fw-sport-stretching-side",
    name: "Stretching (Side)",
    description: "Athletic stretch pose, side profile — one foot grounded flat and one extended, showing flexibility and grip of both shoes",
    icon: "🧘",
    viewAngle: "side",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-sport-crouching-front",
    name: "Crouching / Ready Stance",
    description: "Low athletic crouch facing camera — feet wide, weight on balls of feet, outsole tread and forefoot grip visible",
    icon: "🏋️",
    viewAngle: "front",
    framing: "full-body",
    garmentRelevance: ["sneakers", "sports-shoes"],
  },
  {
    id: "fw-sport-jogging-tqf",
    name: "Jogging (¾ Front)",
    description: "Relaxed jogging stride at three-quarter angle — natural foot roll, mid-sole cushion, and upper breathability in motion",
    icon: "🏃",
    viewAngle: "three-quarter-front",
    framing: "full-body",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-sport-running-knee-down",
    name: "Running Knee-Down",
    description: "Knee to feet of a running stride, side view — heel-to-toe transition detail, midsole flex, and outsole traction up close",
    icon: "🏃",
    viewAngle: "side",
    framing: "knee-down",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
  {
    id: "fw-sport-feet-action-closeup",
    name: "Action Feet Close-Up",
    description: "Extreme close-up of feet during athletic movement — tread grip on surface, sole compression, upper crease, and lace tension",
    icon: "👣",
    viewAngle: "side",
    framing: "feet-closeup",
    garmentRelevance: ALL_FOOTWEAR_TYPES,
  },
];

// --- Accessory Categories ---

export const ACCESSORY_CATEGORIES: {
  value: AccessoryCategory;
  label: string;
  icon: string;
  description: string;
}[] = [
  { value: "necklace", label: "Necklace", icon: "📿", description: "Chain, choker, pendant necklace" },
  { value: "pendant", label: "Pendant", icon: "💎", description: "Pendant or locket" },
  { value: "earrings", label: "Earrings", icon: "✨", description: "Studs, hoops, danglers, drops" },
  { value: "watch", label: "Watch", icon: "⌚", description: "Wristwatch or smartwatch" },
  { value: "bracelet", label: "Bracelet", icon: "📎", description: "Bracelet, bangle, or cuff" },
  { value: "ring", label: "Ring", icon: "💍", description: "Finger ring or band" },
  { value: "sunglasses", label: "Sunglasses", icon: "🕶️", description: "Sunglasses or eyewear" },
  { value: "shoes", label: "Shoes", icon: "👟", description: "Sneakers, heels, boots, sandals" },
  { value: "belt", label: "Belt", icon: "🪢", description: "Leather, fabric, or chain belt" },
  { value: "hat", label: "Hat / Cap", icon: "🧢", description: "Hat, cap, beanie, fedora" },
  { value: "scarf", label: "Scarf", icon: "🧣", description: "Scarf, stole, or wrap" },
  { value: "handbag", label: "Handbag", icon: "👜", description: "Handbag, tote, or sling" },
  { value: "clutch", label: "Clutch", icon: "👝", description: "Clutch or evening bag" },
  { value: "tie", label: "Tie / Bow Tie", icon: "👔", description: "Necktie or bow tie" },
  { value: "brooch", label: "Brooch / Pin", icon: "📌", description: "Brooch, lapel pin, or badge" },
  { value: "cufflinks", label: "Cufflinks", icon: "🔗", description: "Cufflinks or sleeve buttons" },
  { value: "anklet", label: "Anklet", icon: "🦶", description: "Ankle chain or anklet" },
  { value: "hair-accessory", label: "Hair Accessory", icon: "🎀", description: "Headband, clips, scrunchie, tiara" },
];

export const ASPECT_RATIOS: { value: AspectRatio; label: string; description: string }[] = [
  { value: "1:1", label: "1:1", description: "Square" },
  { value: "2:3", label: "2:3", description: "Portrait" },
  { value: "3:2", label: "3:2", description: "Landscape" },
  { value: "3:4", label: "3:4", description: "Classic Portrait" },
  { value: "4:3", label: "4:3", description: "Classic Landscape" },
  { value: "4:5", label: "4:5", description: "Instagram Portrait" },
  { value: "9:16", label: "9:16", description: "Story / Reel" },
  { value: "16:9", label: "16:9", description: "Widescreen" },
];

export const FIT_OPTIONS: { value: FitType; label: string; description: string }[] = [
  { value: "slim", label: "Slim Fit", description: "Close to the body, streamlined silhouette" },
  { value: "regular", label: "Regular Fit", description: "Standard comfortable fit, not too tight or loose" },
  { value: "relaxed", label: "Relaxed Fit", description: "Slightly looser than regular, easy and casual" },
  { value: "oversized", label: "Oversized", description: "Intentionally large and roomy, streetwear vibe" },
  { value: "tailored", label: "Tailored Fit", description: "Precisely fitted, structured and sharp lines" },
  { value: "loose", label: "Loose Fit", description: "Very roomy with lots of drape and flow" },
  { value: "bodycon", label: "Bodycon", description: "Figure-hugging, contours closely to the body" },
  { value: "boxy", label: "Boxy", description: "Wide and straight, minimal waist definition" },
];

/**
 * Sleeve length options for topwear / onepiece. `null` (Auto-Detect AI) is the default and is
 * represented in the UI as the absence of a selection — not as an entry in this list.
 *
 * `promptLabel` and `anatomicalAnchor` are the verbatim phrases injected into the Gemini 3 Pro
 * meta-prompt and forwarded into the Gemini 3 Flash Image generation prompt — they describe the
 * sleeve hem in concrete anatomical terms so the image generator has a deterministic landmark.
 */
export const SLEEVE_LENGTH_OPTIONS: {
  value: SleeveLength;
  label: string;
  description: string;
  promptLabel: string;
  anatomicalAnchor: string;
}[] = [
  {
    value: "full",
    label: "Full Sleeve",
    description: "Sleeve extends down to the wrist",
    promptLabel: "full sleeve (long sleeve)",
    anatomicalAnchor: "the sleeve hem ends exactly at the wrist bone (the ulnar styloid), fully covering the forearm from shoulder to wrist",
  },
  {
    value: "three-quarter",
    label: "3/4 Sleeve",
    description: "Sleeve ends mid-forearm, between elbow and wrist",
    promptLabel: "three-quarter sleeve (3/4 sleeve)",
    anatomicalAnchor: "the sleeve hem ends roughly mid-forearm — approximately halfway between the elbow crease and the wrist — leaving the lower forearm and wrist exposed",
  },
  {
    value: "half",
    label: "Half Sleeve",
    description: "Short sleeve ending around mid-bicep",
    promptLabel: "half sleeve (short sleeve)",
    anatomicalAnchor: "the sleeve hem ends roughly mid-bicep — approximately halfway between the shoulder cap and the elbow — leaving the entire forearm and the lower bicep exposed",
  },
  {
    value: "sleeveless",
    label: "Sleeveless",
    description: "No sleeve — bare shoulder, arm fully exposed",
    promptLabel: "sleeveless (no sleeve)",
    anatomicalAnchor: "there is NO sleeve at all — the armhole opening sits at the shoulder cap and the entire arm (shoulder, bicep, forearm, wrist) is bare and visible",
  },
];

/**
 * Body / hemline length options for topwear (and upper portion of onepiece).
 * `null` (Auto-Detect AI) is the default; absent from this list.
 *
 * Each option anchors the hemline to a specific anatomical landmark to give Nano Banana 2 a
 * deterministic crop point that does not drift between generations.
 */
export const TOPWEAR_LENGTH_OPTIONS: {
  value: TopwearLength;
  label: string;
  description: string;
  promptLabel: string;
  anatomicalAnchor: string;
}[] = [
  {
    value: "full",
    label: "Full (till shin)",
    description: "Long top — hem reaches the shin (tunic / kurta / maxi-top)",
    promptLabel: "full length top (shin-length tunic / maxi)",
    anatomicalAnchor: "the hemline of the top falls all the way down to the shin — roughly halfway between the knee and the ankle — covering the hips, thighs, and knees entirely",
  },
  {
    value: "three-quarter",
    label: "3/4 (till knee)",
    description: "Knee-length top — hem reaches the knee",
    promptLabel: "three-quarter length top (knee-length)",
    anatomicalAnchor: "the hemline of the top falls to the knee — covering the hips and thighs entirely and ending at the kneecap",
  },
  {
    value: "mid-thigh",
    label: "Mid-thigh",
    description: "Long shirt / longline — hem ends mid-thigh",
    promptLabel: "mid-thigh length top (longline)",
    anatomicalAnchor: "the hemline of the top falls to mid-thigh — roughly halfway between the hip crease and the knee — covering the hips and the upper half of the thighs",
  },
  {
    value: "half",
    label: "Half (till waist)",
    description: "Regular waist-length top — hem ends at the natural waist",
    promptLabel: "half length top (regular waist-length)",
    anatomicalAnchor: "the hemline of the top falls at the natural waist — at or just above the navel — and does NOT extend over the hips",
  },
];

/**
 * Outseam length options for bottomwear (and lower portion of onepiece / jumpsuit).
 * `null` (Auto-Detect AI) is the default; absent from this list.
 */
export const BOTTOMWEAR_LENGTH_OPTIONS: {
  value: BottomwearLength;
  label: string;
  description: string;
  promptLabel: string;
  anatomicalAnchor: string;
}[] = [
  {
    value: "full",
    label: "Full Length",
    description: "Hem reaches the ankle (regular pants / trousers / jeans)",
    promptLabel: "full length bottomwear (ankle-length)",
    anatomicalAnchor: "the leg hem of the bottomwear ends at the ankle — covering the entire leg from waistband to ankle bone",
  },
  {
    value: "three-quarter",
    label: "3/4 Length",
    description: "Capri / cropped — hem ends mid-calf, below the knee",
    promptLabel: "three-quarter length bottomwear (capri / cropped)",
    anatomicalAnchor: "the leg hem of the bottomwear ends mid-calf — clearly below the knee but well above the ankle — exposing the lower calf and ankle",
  },
  {
    value: "shorts",
    label: "Shorts",
    description: "Hem ends at or above mid-thigh",
    promptLabel: "shorts (short bottomwear)",
    anatomicalAnchor: "the leg hem of the bottomwear ends at or above mid-thigh — leaving the knees and the entire lower leg fully exposed",
  },
];

// --- Infographic Constants ---

export const BADGE_STYLES: { value: import("./types").BadgeStyle; label: string; description: string }[] = [
  { value: "rounded", label: "Rounded", description: "Rounded corners badge" },
  { value: "pill", label: "Pill", description: "Fully rounded pill shape" },
  { value: "square", label: "Square", description: "Sharp corners badge" },
  { value: "ribbon", label: "Ribbon", description: "Ribbon-style banner" },
  { value: "outline", label: "Outline", description: "Border only, no fill" },
  { value: "minimal", label: "Minimal", description: "Text only, no background" },
];

export const OVERLAY_POSITIONS: { value: import("./types").OverlayPosition; label: string }[] = [
  { value: "top-left", label: "Top Left" },
  { value: "top-center", label: "Top Center" },
  { value: "top-right", label: "Top Right" },
  { value: "middle-left", label: "Middle Left" },
  { value: "middle-center", label: "Center" },
  { value: "middle-right", label: "Middle Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-center", label: "Bottom Center" },
  { value: "bottom-right", label: "Bottom Right" },
];

export const PRESET_USPS: { text: string; icon: string }[] = [
  { text: "Pure Cotton", icon: "🌿" },
  { text: "100% Organic", icon: "🌱" },
  { text: "Sustainable", icon: "♻️" },
  { text: "Handcrafted", icon: "✋" },
  { text: "Premium Quality", icon: "⭐" },
  { text: "Wrinkle Free", icon: "✨" },
  { text: "Dirt Clean", icon: "🧼" },
  { text: "Water Resistant", icon: "💧" },
  { text: "UV Protection", icon: "☀️" },
  { text: "Breathable", icon: "🌬️" },
  { text: "Easy Care", icon: "👌" },
  { text: "Made in India", icon: "🇮🇳" },
  { text: "Vegan", icon: "🌿" },
  { text: "Anti-Bacterial", icon: "🛡️" },
  { text: "Skin Friendly", icon: "💆" },
  { text: "Limited Edition", icon: "💎" },
  { text: "New Arrival", icon: "🆕" },
  { text: "Best Seller", icon: "🔥" },
];

export const PRESET_COLORS = [
  "#000000", "#FFFFFF", "#1a1a2e", "#16213e", "#0f3460",
  "#533483", "#e94560", "#f97316", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#6366f1",
  "#d4af37", "#c0c0c0", "#b87333",
];

export const WIZARD_STEPS = [
  { step: 1, title: "Garments", description: "Upload your garment images" },
  { step: 2, title: "Styling", description: "Background & model selection" },
  { step: 3, title: "Output", description: "Aspect ratio & poses" },
  { step: 4, title: "Details", description: "Additional info & API key" },
  { step: 5, title: "Generate", description: "Review & generate" },
] as const;

export const MODEL_SWAP_WIZARD_STEPS = [
  { step: 1, title: "Products", description: "Upload your product images" },
  { step: 2, title: "Styling", description: "Background & new model" },
  { step: 3, title: "Output", description: "Aspect ratio settings" },
  { step: 4, title: "Details", description: "Additional instructions" },
  { step: 5, title: "Generate", description: "Review & generate" },
] as const;

export const FEATURE_MODE_OPTIONS: { value: FeatureMode; label: string; icon: string; description: string }[] = [
  { value: "vton", label: "Virtual Try-On", icon: "👕", description: "Put garments on AI models" },
  { value: "model-swap", label: "Model Swap", icon: "🔄", description: "Replace the model in existing product photos" },
  { value: "room-staging", label: "Room Staging", icon: "🛋️", description: "AI interior product photography" },
  { value: "swatch", label: "Swatch", icon: "🎨", description: "Extract fabric swatches from garment images" },
  { value: "replicate", label: "Replicate Fast", icon: "📋", description: "Recreate images from assets using a reference layout" },
  { value: "product-video", label: "Product Video", icon: "🎬", description: "Generate AI product videos for e-commerce" },
];

export const MODEL_SWAP_BG_OPTIONS: { value: ModelSwapBackgroundMode; label: string; icon: string; description: string }[] = [
  { value: "keep-same", label: "Keep Same Background", icon: "🖼️", description: "Preserve the original background from the product image" },
  { value: "new-background", label: "New Background", icon: "🎨", description: "Replace the background with a new one" },
];

export const SWATCH_WIZARD_STEPS = [
  { step: 1, title: "Upload", description: "Upload garment images" },
  { step: 2, title: "Configure", description: "Swatch settings & API key" },
  { step: 3, title: "Generate", description: "Extract swatches" },
] as const;

export const SWATCH_SHAPE_OPTIONS: { value: SwatchShape; label: string; icon: string }[] = [
  { value: "square", label: "Square", icon: "⬜" },
  { value: "circle", label: "Circle", icon: "⭕" },
  { value: "rounded", label: "Rounded", icon: "🔲" },
];

export const SWATCH_SIZE_OPTIONS = [128, 256, 512, 1024] as const;

// --- Replicate Fast Constants ---

export const REPLICATE_WIZARD_STEPS = [
  { step: 1, title: "Assets", description: "Upload input assets & reference output" },
  { step: 2, title: "Configure", description: "Settings & API key" },
  { step: 3, title: "Generate", description: "Generate replicated image" },
] as const;

// --- AI Infographic Constants ---

// --- Set Product Constants ---

export const SET_LAYOUT_OPTIONS: { value: SetLayoutStyle; label: string; description: string }[] = [
  { value: "side-by-side", label: "Side by Side", description: "Models lined up next to each other" },
  { value: "overlapping", label: "Overlapping", description: "Models slightly overlapping for depth" },
  { value: "staggered", label: "Staggered", description: "Models at varying depths and heights" },
];

export const SET_VARIANT_LIMIT = { min: 2, max: 5 };

export const SET_SUGGESTED_ASPECT_RATIOS: Record<number, AspectRatio> = {
  2: "3:2",
  3: "16:9",
  4: "16:9",
  5: "16:9",
};

export const AI_INFOGRAPHIC_STYLES: { value: AIInfographicStyle; label: string; icon: string; description: string }[] = [
  { value: "modern-minimal", label: "Modern Minimal", icon: "✨", description: "Clean lines, whitespace, editorial feel" },
  { value: "bold-lifestyle", label: "Bold Lifestyle", icon: "🔥", description: "Energetic, vibrant, aspirational" },
  { value: "premium-luxury", label: "Premium Luxury", icon: "💎", description: "Elegant, rich textures, high-end" },
  { value: "vibrant-pop", label: "Vibrant Pop", icon: "🎨", description: "Playful, colorful, social-ready" },
  { value: "clean-technical", label: "Clean Technical", icon: "📐", description: "Spec-focused, detailed callouts" },
];

// --- UGC Constants ---

export const UGC_SHOT_TYPE_OPTIONS: { value: import("./types").UGCShotType; label: string; icon: string; description: string }[] = [
  { value: "normal", label: "Normal Shot", icon: "📸", description: "Third-person candid photo — as if a friend took the picture" },
  { value: "selfie", label: "Selfie Shot", icon: "🤳", description: "First-person selfie — front camera, arm visible or cropped" },
];

export const UGC_SCENE_PRESETS: { name: string; description: string }[] = [
  // Everyday Life
  { name: "Street Cafe", description: "Sitting at a cozy outdoor cafe table on a vibrant city street, casual candid moment with a coffee cup, warm afternoon light" },
  { name: "City Commute", description: "Walking on a busy city sidewalk, casual stride, urban buildings and traffic in the background, morning light" },
  { name: "Metro Commute", description: "Standing inside or just outside a metro station, urban transit setting, natural crowd movement" },
  { name: "College Campus", description: "Walking through a university campus with friends, backpack, green lawns and old buildings, casual student life" },
  { name: "Grocery Run", description: "Walking out of a neighborhood grocery store or supermarket carrying a bag, casual everyday errand moment, natural daylight" },
  { name: "Morning Jog", description: "Jogging on a tree-lined park path early in the morning, earphones in, soft golden morning light, slight motion blur" },
  { name: "Work From Cafe", description: "Sitting at a cafe table with a laptop open, typing casually, latte on the side, cozy interior with warm ambient light" },
  { name: "Auto Rickshaw", description: "Stepping out of or standing beside a yellow-green auto rickshaw on a busy Indian street, candid urban moment" },

  // Outdoors & Nature
  { name: "Beach Sunset", description: "Walking on a sandy beach during golden hour, warm natural light, ocean waves and horizon in the background" },
  { name: "Mountain Trail", description: "Hiking on a mountain trail with scenic views, trekking gear, lush greenery or rugged terrain in background" },
  { name: "Park Hangout", description: "Relaxing on a park bench surrounded by lush green trees, casual weekend afternoon vibe, dappled sunlight" },
  { name: "Riverside Walk", description: "Walking along a river promenade or ghat, calm water reflecting evening sky, gentle breeze, peaceful setting" },
  { name: "Poolside Chill", description: "Lounging on a sunbed near a swimming pool, sunglasses on, tropical plants around, bright sunny day" },
  { name: "Rainy Day", description: "Walking in light rain on a city street, holding an umbrella or getting pleasantly wet, reflections on wet pavement, moody overcast light" },
  { name: "Sunrise Balcony", description: "Standing on an apartment balcony holding a cup of tea, soft sunrise light, city or mountain view in background" },

  // Social & Hangouts
  { name: "Rooftop Vibes", description: "Standing on a rooftop terrace with city skyline behind, evening warm lighting, casual hangout with friends" },
  { name: "Night Out", description: "Walking on a well-lit city street at night, neon signs and street lights, casual evening out vibe" },
  { name: "Weekend Market", description: "Browsing through a colorful local street market or flea market, vibrant stalls and crowd in background" },
  { name: "House Party", description: "Standing in a living room at a casual house party, fairy lights in background, holding a drink, warm ambient lighting" },
  { name: "Concert Crowd", description: "Standing in an outdoor music concert or festival crowd, stage lights in background, energetic atmosphere, evening" },
  { name: "Brunch Date", description: "Sitting at a brunch table with friends, colorful food and drinks on the table, bright airy restaurant interior" },
  { name: "Movie Night", description: "Walking out of a cinema or multiplex, holding popcorn, bright marquee lights behind, casual evening out" },

  // Iconic Locations — India
  { name: "Mumbai Gateway", description: "Standing near Gateway of India in Mumbai, busy tourist area with pigeons and crowds, natural daylight" },
  { name: "Temple Visit", description: "Standing in the courtyard of a traditional Indian temple, ornate architecture, warm afternoon light, culturally authentic setting" },
  { name: "Jaipur Hawa Mahal", description: "Standing on the street in front of Hawa Mahal in Jaipur, pink sandstone facade behind, bustling Rajasthani market, bright daylight" },
  { name: "Delhi CP Walk", description: "Walking through Connaught Place in New Delhi, white Georgian-style columns and curved arcade, busy shopping crowd" },
  { name: "Goa Beach Shack", description: "Sitting at a rustic beach shack in Goa, sand beneath feet, ocean visible, colorful decor, relaxed tropical vibe" },
  { name: "Varanasi Ghats", description: "Standing on the ancient ghats of Varanasi overlooking the Ganges, boats on the river, evening diyas and lanterns" },
  { name: "Bangalore Cubbon", description: "Walking through Cubbon Park in Bangalore, lush green canopy, joggers and cyclists around, pleasant morning light" },
  { name: "Kerala Backwaters", description: "Standing on the deck of a traditional houseboat in Kerala backwaters, palm trees lining the canal, serene greenery" },

  // Iconic Locations — International
  { name: "NYC Times Square", description: "Standing on a sidewalk in Times Square, New York, giant billboards and bright neon lights, busy crowd, urban energy" },
  { name: "Paris Eiffel", description: "Standing on Champ de Mars with the Eiffel Tower in the background, casual tourist moment, soft Parisian afternoon light" },
  { name: "Tokyo Shibuya", description: "Crossing the famous Shibuya scramble crossing in Tokyo, neon signs, dense crowd, dynamic urban energy" },
  { name: "London Bridge", description: "Walking along the Thames near Tower Bridge in London, iconic bridge in background, overcast British light" },
  { name: "Dubai Marina", description: "Walking along the Dubai Marina promenade, gleaming skyscrapers and yachts behind, warm evening golden hour" },
  { name: "Bali Rice Fields", description: "Standing in front of lush green terraced rice paddies in Bali, tropical sunshine, palm trees, serene countryside" },

  // Lifestyle & Vibes
  { name: "Gym Exit", description: "Walking out of a gym entrance with a gym bag slung over shoulder, slightly sweaty, post-workout glow, urban sidewalk" },
  { name: "Book Store", description: "Browsing shelves in a cozy independent bookstore, warm interior lighting, books stacked around, quiet intellectual vibe" },
  { name: "Street Art Wall", description: "Standing casually in front of a colorful graffiti or street art mural, vibrant wall as backdrop, urban creative vibe" },
  { name: "Airport Terminal", description: "Walking through an airport terminal pulling a carry-on suitcase, large glass windows, travel lifestyle moment" },
  { name: "Scooter Ride", description: "Standing beside or sitting on a parked scooter/bike on a tree-lined road, helmet in hand, casual ride-out moment" },
  { name: "Train Journey", description: "Sitting by the window of a moving train, countryside or city blurring past, golden afternoon light streaming in, reflective candid moment" },
  { name: "Flower Market", description: "Browsing a vibrant flower market, colorful blooms everywhere, baskets and garlands, warm morning light, lively atmosphere" },
  { name: "Chai Stall", description: "Standing at a roadside chai stall holding a cutting chai glass, busy street behind, authentic Indian street-side moment" },
];

// --- Product Video Constants ---

export const VIDEO_WIZARD_STEPS = [
  { step: 1, title: "Products", description: "Upload product images" },
  { step: 2, title: "Styling", description: "Theme, background & model" },
  { step: 3, title: "Settings", description: "Video settings & API key" },
  { step: 4, title: "Generate", description: "Generate product videos" },
] as const;

type VideoThemeOption = { value: import("./types").VideoTheme; label: string; icon: string; description: string; keywords: string };
type VideoThemeGroup = { category: import("./types").VideoThemeCategory; label: string; options: VideoThemeOption[] };

export const VIDEO_THEME_GROUPS: VideoThemeGroup[] = [
  {
    category: "editorial",
    label: "Editorial / High-Fashion",
    options: [
      { value: "luxe-editorial", label: "Luxe Editorial", icon: "💎", description: "High-end fashion editorial", keywords: "dramatic lighting, shallow depth of field, luxury feel, cinematic color grading" },
      { value: "fashion-runway", label: "Fashion Runway", icon: "👗", description: "Catwalk-inspired", keywords: "dramatic walk, fashion show lighting, dynamic movement, runway ambiance" },
      { value: "haute-couture", label: "Haute Couture", icon: "👑", description: "Ornate, high-contrast", keywords: "ornate backdrops, dramatic silhouettes, high-contrast lighting, couture craftsmanship, artistic composition" },
      { value: "vogue-cover", label: "Vogue Cover", icon: "📸", description: "Magazine-editorial", keywords: "tight framing, bold color blocking, magazine-editorial feel, striking pose, high-fashion confidence" },
      { value: "backstage-bts", label: "Backstage BTS", icon: "🎬", description: "Raw, candid backstage", keywords: "raw candid energy, documentary lighting, behind-the-scenes, unpolished authenticity, motion blur" },
    ],
  },
  {
    category: "urban",
    label: "Urban / Street",
    options: [
      { value: "street-style", label: "Street Style", icon: "🏙️", description: "Urban outdoor setting", keywords: "natural light, city backdrop, casual energy, handheld feel" },
      { value: "streetwear-hype", label: "Streetwear Hype", icon: "🔥", description: "Bold graphics, sneaker culture", keywords: "bold graphics, graffiti walls, sneaker culture energy, hype beast aesthetic, high contrast urban" },
      { value: "night-city", label: "Night City", icon: "🌃", description: "Neon-lit urban night", keywords: "neon lights, wet streets, moody urban night, reflections, cinematic noir feel" },
      { value: "rooftop-vibes", label: "Rooftop Vibes", icon: "🌆", description: "Golden hour skyline", keywords: "golden hour skyline, open sky, elevated urban setting, warm backlight, city panorama" },
      { value: "subway-transit", label: "Subway / Transit", icon: "🚇", description: "Commute energy, city life", keywords: "motion blur, commute energy, candid city life, platform and train aesthetics, underground ambiance" },
    ],
  },
  {
    category: "lifestyle",
    label: "Lifestyle / Casual",
    options: [
      { value: "lifestyle", label: "Lifestyle", icon: "☀️", description: "Aspirational daily life", keywords: "warm tones, natural environment, relatable, soft golden hour" },
      { value: "coffee-shop", label: "Coffee Shop", icon: "☕", description: "Warm cozy interior", keywords: "warm interior, soft ambient light, cozy relaxed mood, wooden textures, latte art warmth" },
      { value: "weekend-outing", label: "Weekend Outing", icon: "🌳", description: "Park, boardwalk, casual", keywords: "park, boardwalk, farmers market, relaxed Saturday feel, natural sunlight, casual joy" },
      { value: "home-lounge", label: "Home / Lounge", icon: "🛋️", description: "At-home comfort", keywords: "minimal interior, warm tones, at-home comfort, soft fabrics, cozy morning light" },
      { value: "beach-coastal", label: "Beach / Coastal", icon: "🏖️", description: "Sand, waves, breezy", keywords: "sand, waves, breezy coastal light, ocean backdrop, sun-kissed skin, windswept hair" },
    ],
  },
  {
    category: "studio",
    label: "Studio / Minimal",
    options: [
      { value: "studio-clean", label: "Studio Clean", icon: "⬜", description: "Minimal studio background", keywords: "clean white or grey backdrop, product-focused, professional studio lighting" },
      { value: "studio-dramatic", label: "Studio Dramatic", icon: "🖤", description: "Dark, moody studio", keywords: "dark backdrop, single-source dramatic lighting, moody shadows, chiaroscuro, high contrast" },
      { value: "color-block", label: "Color Block", icon: "🎨", description: "Bold solid-color backdrop", keywords: "solid bold-color backdrop, pop-art inspired, vivid saturation, graphic contrast, modern punch" },
      { value: "infinity-cove", label: "Infinity Cove", icon: "🔲", description: "Seamless cyclorama", keywords: "seamless white or grey cyclorama, professional catalog feel, even lighting, no shadows, product clarity" },
    ],
  },
  {
    category: "seasonal",
    label: "Seasonal / Occasion",
    options: [
      { value: "seasonal-collection", label: "Seasonal Collection", icon: "🍂", description: "Seasonal/holiday context", keywords: "seasonal colors, themed props, festive mood, atmospheric" },
      { value: "festive-party", label: "Festive / Party", icon: "🎉", description: "Celebration, evening glamour", keywords: "sparkle, shimmer, celebration mood, evening glamour, bokeh lights, champagne tones" },
      { value: "resort-vacation", label: "Resort / Vacation", icon: "🌴", description: "Tropical, poolside luxury", keywords: "tropical, poolside, luxury travel, turquoise water, palm fronds, resort architecture" },
      { value: "monsoon-rainy", label: "Monsoon / Rainy", icon: "🌧️", description: "Overcast, dramatic rain", keywords: "overcast, wet surfaces, dramatic rain moods, reflections on pavement, moody atmospheric" },
      { value: "winter-layering", label: "Winter Layering", icon: "🧣", description: "Cozy cold-weather", keywords: "cozy textures, layered outfits, cold-weather ambiance, frost, warm breath, winter light" },
    ],
  },
  {
    category: "dynamic",
    label: "Dynamic / Sport",
    options: [
      { value: "dynamic-action", label: "Dynamic Action", icon: "⚡", description: "Movement-focused", keywords: "athletic motion, powerful strides, fabric in motion, dynamic body movement, energetic camera work, contrasty lighting" },
      { value: "gym-fitness", label: "Gym / Fitness", icon: "💪", description: "Athletic, gym setting", keywords: "gym floor, weights backdrop, athletic energy, sweat glistening, performance fabric in action" },
      { value: "outdoor-adventure", label: "Outdoor Adventure", icon: "🏔️", description: "Trail, mountains, active", keywords: "trail, mountains, active outdoor lifestyle, rugged terrain, adventure spirit, natural drama" },
      { value: "dance-movement", label: "Dance / Movement", icon: "💃", description: "Fluid body choreography", keywords: "choreographed motion, studio or stage, fluid body movement, graceful fabric flow, rhythm and expression" },
    ],
  },
  {
    category: "product-focused",
    label: "Product-Focused",
    options: [
      { value: "product-showcase", label: "Product Showcase", icon: "🔄", description: "360-degree product highlight", keywords: "turntable motion, detail close-ups, fabric texture reveal, steady rotation" },
      { value: "flat-lay-to-model", label: "Flat Lay to Model", icon: "📋", description: "Flat-lay transitions to worn", keywords: "starts as flat-lay arrangement, transitions to on-model reveal, creative transformation, laydown to lifestyle" },
      { value: "detail-macro", label: "Detail Macro", icon: "🔬", description: "Extreme fabric close-ups", keywords: "extreme close-ups, fabric texture, stitching detail, hardware and buttons, material quality reveal" },
    ],
  },
];

export const VIDEO_THEME_OPTIONS: VideoThemeOption[] = VIDEO_THEME_GROUPS.flatMap((g) => g.options);

type CameraMovementOption = { value: import("./types").CameraMovement; label: string; icon: string; description: string };
type CameraMovementGroup = { category: import("./types").CameraMovementCategory; label: string; options: CameraMovementOption[] };

export const VIDEO_CAMERA_MOVEMENT_GROUPS: CameraMovementGroup[] = [
  {
    category: "static-locked",
    label: "Static / Locked",
    options: [
      { value: "static", label: "Static", icon: "📌", description: "Camera stays fixed in place" },
      { value: "locked-tripod", label: "Locked Tripod", icon: "📹", description: "Rock-steady tripod, zero movement" },
      { value: "subtle-sway", label: "Subtle Sway", icon: "🌊", description: "Barely perceptible micro-movements, handheld feel" },
    ],
  },
  {
    category: "pan",
    label: "Pan (Horizontal Rotation)",
    options: [
      { value: "slow-pan-left", label: "Smooth Pan Left", icon: "⬅️", description: "Camera pans steadily from right to left at a natural pace" },
      { value: "slow-pan-right", label: "Smooth Pan Right", icon: "➡️", description: "Camera pans steadily from left to right at a natural pace" },
      { value: "whip-pan", label: "Whip Pan", icon: "💨", description: "Fast horizontal swipe transition" },
      { value: "arc-pan", label: "Arc Pan", icon: "↩️", description: "Curved horizontal pan following subject contour" },
    ],
  },
  {
    category: "tilt",
    label: "Tilt (Vertical Rotation)",
    options: [
      { value: "tilt-up", label: "Tilt Up", icon: "⬆️", description: "Camera tilts upward from feet to head" },
      { value: "tilt-down", label: "Tilt Down", icon: "⬇️", description: "Camera tilts downward from head to feet" },
      { value: "dutch-tilt", label: "Dutch Tilt", icon: "↗️", description: "Angled canted frame for dynamic tension" },
      { value: "reveal-tilt", label: "Reveal Tilt", icon: "👟", description: "Starts on detail (shoes/hem), tilts up to reveal full outfit" },
    ],
  },
  {
    category: "dolly-slider",
    label: "Dolly / Slider",
    options: [
      { value: "dolly-in", label: "Dolly In", icon: "🔍", description: "Camera moves closer to the subject" },
      { value: "dolly-out", label: "Dolly Out", icon: "🔎", description: "Camera pulls away from the subject" },
      { value: "lateral-slide", label: "Lateral Slide", icon: "↔️", description: "Camera slides horizontally parallel to subject" },
      { value: "push-pull", label: "Push-Pull", icon: "🔃", description: "Dolly in then out (or vice versa) in one move" },
    ],
  },
  {
    category: "crane-jib",
    label: "Crane / Jib",
    options: [
      { value: "crane-up", label: "Crane Up", icon: "🏗️", description: "Camera rises upward on a crane" },
      { value: "crane-down", label: "Crane Down", icon: "⏬", description: "Camera descends downward on a crane" },
      { value: "boom-sweep", label: "Boom Sweep", icon: "🦅", description: "Crane with lateral arc, bird's-eye sweeping motion" },
    ],
  },
  {
    category: "orbit-circular",
    label: "Orbit / Circular",
    options: [
      { value: "orbit", label: "Orbit 360°", icon: "🔄", description: "Camera circles fully around the subject" },
      { value: "half-orbit", label: "Half Orbit", icon: "↪️", description: "180-degree arc around the subject" },
      { value: "spiral-rise", label: "Spiral Rise", icon: "🌀", description: "Orbit combined with crane up simultaneously" },
    ],
  },
  {
    category: "zoom-lens",
    label: "Zoom (Lens)",
    options: [
      { value: "zoom-in", label: "Zoom In", icon: "🔭", description: "Lens zooms into the subject" },
      { value: "zoom-out", label: "Zoom Out", icon: "🌐", description: "Lens zooms out from the subject" },
      { value: "snap-zoom", label: "Snap Zoom", icon: "⚡", description: "Fast, punchy zoom for emphasis" },
      { value: "vertigo-dolly-zoom", label: "Vertigo / Dolly Zoom", icon: "🌀", description: "Dolly in + zoom out simultaneously (Hitchcock effect)" },
    ],
  },
  {
    category: "tracking-follow",
    label: "Tracking / Follow",
    options: [
      { value: "tracking", label: "Tracking", icon: "🎯", description: "Camera follows the subject as they move" },
      { value: "lead-track", label: "Lead Track", icon: "🏃", description: "Camera moves ahead of subject, facing them" },
      { value: "side-track", label: "Side Track", icon: "👤", description: "Camera moves alongside subject, profile view" },
      { value: "low-angle-track", label: "Low-Angle Track", icon: "⬇️", description: "Tracking from a low vantage point" },
    ],
  },
];

export const VIDEO_CAMERA_MOVEMENT_OPTIONS: CameraMovementOption[] = VIDEO_CAMERA_MOVEMENT_GROUPS.flatMap((g) => g.options);

type ModelMovementOption = { value: import("./types").ModelMovement; label: string; icon: string; description: string; footwearOnly?: boolean };
type ModelMovementGroup = { category: import("./types").ModelMovementCategory; label: string; footwearOnly?: boolean; options: ModelMovementOption[] };

export const VIDEO_MODEL_MOVEMENT_GROUPS: ModelMovementGroup[] = [
  {
    category: "standing",
    label: "Standing / Stationary",
    options: [
      { value: "confident-stand", label: "Confident Stand", icon: "🧍", description: "Strong stance with subtle weight shift and minor adjustments" },
      { value: "hip-shift", label: "Hip Shift", icon: "💃", description: "Shifts weight hip-to-hip, hand on hip" },
      { value: "hair-touch", label: "Hair Touch / Adjust", icon: "💇", description: "Standing, casually touching hair or adjusting clothing" },
      { value: "slow-turn", label: "Smooth Turn", icon: "🔄", description: "Standing in place, steady 180 or 360 rotation at natural speed" },
      { value: "power-pose", label: "Power Pose", icon: "⚡", description: "Strong wide stance, arms at sides or on hips, editorial attitude" },
    ],
  },
  {
    category: "walking",
    label: "Walking / Locomotion",
    options: [
      { value: "casual-walk", label: "Casual Walk", icon: "🚶", description: "Relaxed natural stride" },
      { value: "runway-walk", label: "Runway Walk", icon: "👠", description: "Confident exaggerated heel-toe catwalk stride" },
      { value: "walk-and-stop", label: "Walk & Stop", icon: "🛑", description: "Walks toward camera then stops in a pose" },
      { value: "walk-past", label: "Walk Past", icon: "➡️", description: "Model walks across frame from side to side" },
      { value: "approach-and-turn", label: "Approach & Turn", icon: "↩️", description: "Walks toward camera, stops, turns, walks away" },
    ],
  },
  {
    category: "dynamic-athletic",
    label: "Dynamic / Athletic",
    options: [
      { value: "light-jog", label: "Light Jog", icon: "🏃", description: "Gentle running motion" },
      { value: "jump-leap", label: "Jump / Leap", icon: "🦘", description: "Single jump or mid-air freeze moment" },
      { value: "dance-move", label: "Dance Move", icon: "🕺", description: "Rhythmic, choreographed body movement" },
      { value: "spin", label: "Spin", icon: "🌀", description: "Full spin with fabric flowing outward" },
      { value: "squat-lunge", label: "Squat / Lunge", icon: "🏋️", description: "Athletic pose for activewear showcase" },
    ],
  },
  {
    category: "transitions",
    label: "Transitions / Sequences",
    options: [
      { value: "stand-to-walk", label: "Stand to Walk", icon: "🚶", description: "Begins standing, transitions into walking" },
      { value: "walk-to-pose", label: "Walk to Pose", icon: "🎭", description: "Walking that settles into a final editorial pose" },
      { value: "sit-to-stand", label: "Sit to Stand", icon: "🪑", description: "Seated, then stands up to reveal full outfit" },
      { value: "lean-and-push-off", label: "Lean & Push Off", icon: "🏗️", description: "Leaning on a surface, then pushes off and walks" },
    ],
  },
  {
    category: "upper-body",
    label: "Upper Body / Detail",
    options: [
      { value: "arms-crossed", label: "Arms Crossed", icon: "🤝", description: "Folding arms to show sleeve and cuff details" },
      { value: "jacket-open", label: "Jacket Open", icon: "🧥", description: "Hands pulling open jacket/blazer to show inner garment" },
      { value: "collar-adjust", label: "Collar Adjust", icon: "👔", description: "Adjusting collar or neckline detail" },
      { value: "cuff-roll", label: "Cuff Roll", icon: "🔧", description: "Rolling up sleeves to show forearm and fabric" },
      { value: "pocket-hands", label: "Pocket Hands", icon: "🤲", description: "Putting hands in and out of pockets" },
    ],
  },
  {
    category: "footwear-specific",
    label: "Footwear-Specific",
    footwearOnly: true,
    options: [
      { value: "step-forward", label: "Step Forward", icon: "👟", description: "Single deliberate step showcasing the shoe", footwearOnly: true },
      { value: "cross-step", label: "Cross Step", icon: "🦶", description: "Crossing one foot over the other", footwearOnly: true },
      { value: "heel-toe-rock", label: "Heel-Toe Rock", icon: "🔃", description: "Rocking from heel to toe to show sole flex", footwearOnly: true },
      { value: "kick-up", label: "Kick Up", icon: "🦵", description: "Casual backward kick to show sole", footwearOnly: true },
      { value: "lace-up-close", label: "Lace-Up Close", icon: "🎀", description: "Bending down to adjust laces (detail shot)", footwearOnly: true },
    ],
  },
];

export const VIDEO_MODEL_MOVEMENT_OPTIONS: ModelMovementOption[] = VIDEO_MODEL_MOVEMENT_GROUPS.flatMap((g) => g.options);

export const MAX_MODEL_MOVEMENTS: Record<import("./types").VideoDuration, number> = {
  4: 1,
  6: 2,
  8: 2,
  12: 3,
  16: 4,
};

export const VIDEO_ASPECT_RATIO_OPTIONS: { value: import("./types").VideoAspectRatio; label: string; description: string }[] = [
  { value: "16:9", label: "16:9", description: "Landscape" },
  { value: "9:16", label: "9:16", description: "Portrait / Reel" },
];

export const VIDEO_RESOLUTION_OPTIONS: { value: import("./types").VideoResolution; label: string; description: string }[] = [
  { value: "720p", label: "720p", description: "HD" },
  { value: "1080p", label: "1080p", description: "Full HD" },
];

export const VIDEO_DURATION_OPTIONS: { value: import("./types").VideoDuration; label: string; description: string }[] = [
  { value: 4, label: "4s", description: "Quick clip" },
  { value: 6, label: "6s", description: "Standard" },
  { value: 8, label: "8s", description: "Extended" },
  { value: 12, label: "12s", description: "8s + 4s extension" },
  { value: 16, label: "16s", description: "8s + 8s extension" },
];

export const MAX_CAMERA_MOVEMENTS: Record<import("./types").VideoDuration, number> = {
  4: 2,
  6: 2,
  8: 2,
  12: 3,
  16: 4,
};

export const VEO_MODEL_OPTIONS: { value: import("./types").VeoModel; label: string; description: string; pricePerSecond: string }[] = [
  { value: "veo-3.1-generate-preview", label: "Standard", description: "Higher quality, slower", pricePerSecond: "$0.40/s" },
  { value: "veo-3.1-fast-generate-preview", label: "Fast", description: "Quick generation, lower cost", pricePerSecond: "$0.15/s" },
];

// --- Room Staging Constants ---

export const ROOM_STAGING_WIZARD_STEPS = [
  { step: 1, title: "Products", description: "Upload product images" },
  { step: 2, title: "Scene", description: "Room setting & environment" },
  { step: 3, title: "Shots", description: "Shot types & aspect ratio" },
  { step: 4, title: "Details", description: "Additional info & API key" },
  { step: 5, title: "Generate", description: "Review & generate" },
] as const;

export const ROOM_STAGING_CATEGORY_OPTIONS: { value: import("./types").RoomStagingCategory; label: string; description: string }[] = [
  { value: "home-decor", label: "Home Decor", description: "Rugs, curtains, cushions, wall art, and more" },
  { value: "furniture", label: "Furniture", description: "Sofas, tables, beds, storage, and outdoor" },
];

export const HOME_DECOR_TYPE_OPTIONS: { value: import("./types").HomeDecorType; label: string; description: string }[] = [
  { value: "rugs-carpets", label: "Rugs & Carpets", description: "Hand-knotted, flatweave, dhurrie, and more" },
  { value: "curtains-drapes", label: "Curtains & Drapes", description: "Sheer, blackout, linen, velvet" },
  { value: "cushions-pillows", label: "Cushions & Pillows", description: "Throw pillows, floor cushions, bolsters" },
  { value: "wall-art", label: "Wall Art & Decor", description: "Prints, canvas, tapestry, macrame" },
  { value: "throws-blankets", label: "Throws & Blankets", description: "Knit throws, woven blankets, quilts" },
  { value: "table-linen", label: "Table Linen", description: "Tablecloths, runners, placemats" },
  { value: "lighting", label: "Lighting", description: "Table lamps, floor lamps, pendants" },
];

export const FURNITURE_TYPE_OPTIONS: { value: import("./types").FurnitureType; label: string; description: string }[] = [
  { value: "sofas-seating", label: "Sofas & Seating", description: "Sofas, armchairs, accent chairs, ottomans" },
  { value: "tables", label: "Tables", description: "Coffee, dining, side, console tables" },
  { value: "beds-bedroom", label: "Beds & Bedroom", description: "Bed frames, headboards, nightstands" },
  { value: "storage", label: "Storage", description: "Bookshelves, cabinets, sideboards" },
  { value: "outdoor", label: "Outdoor", description: "Patio sets, garden chairs, planters" },
];

export const HOME_DECOR_SUBTYPE_OPTIONS: Record<import("./types").HomeDecorType, { value: import("./types").HomeDecorSubType; label: string }[]> = {
  "rugs-carpets": [
    { value: "hand-knotted", label: "Hand-Knotted" },
    { value: "hand-tufted", label: "Hand-Tufted" },
    { value: "flatweave", label: "Flatweave" },
    { value: "dhurrie", label: "Dhurrie" },
    { value: "shag", label: "Shag" },
    { value: "kilim", label: "Kilim" },
    { value: "overdyed", label: "Overdyed" },
    { value: "patchwork", label: "Patchwork" },
    { value: "braided", label: "Braided" },
    { value: "jute-natural", label: "Jute / Natural Fiber" },
  ],
  "curtains-drapes": [
    { value: "sheer", label: "Sheer" },
    { value: "blackout", label: "Blackout" },
    { value: "linen-curtain", label: "Linen" },
    { value: "velvet-curtain", label: "Velvet" },
    { value: "embroidered-curtain", label: "Embroidered" },
    { value: "printed-curtain", label: "Printed" },
    { value: "layered", label: "Layered" },
  ],
  "cushions-pillows": [
    { value: "throw-pillow", label: "Throw Pillow" },
    { value: "floor-cushion", label: "Floor Cushion" },
    { value: "bolster", label: "Bolster" },
    { value: "lumbar", label: "Lumbar" },
    { value: "decorative-pillow", label: "Decorative" },
    { value: "outdoor-cushion", label: "Outdoor Cushion" },
  ],
  "wall-art": [
    { value: "framed-print", label: "Framed Print" },
    { value: "canvas", label: "Canvas" },
    { value: "tapestry", label: "Tapestry" },
    { value: "wall-hanging", label: "Wall Hanging" },
    { value: "macrame", label: "Macrame" },
    { value: "mirror", label: "Mirror" },
    { value: "metal-wall-art", label: "Metal Wall Art" },
  ],
  "throws-blankets": [
    { value: "knit-throw", label: "Knit Throw" },
    { value: "woven-blanket", label: "Woven Blanket" },
    { value: "quilted-throw", label: "Quilted Throw" },
    { value: "faux-fur", label: "Faux Fur" },
    { value: "cotton-throw", label: "Cotton" },
    { value: "wool-throw", label: "Wool" },
  ],
  "table-linen": [
    { value: "tablecloth", label: "Tablecloth" },
    { value: "table-runner", label: "Table Runner" },
    { value: "placemats", label: "Placemats" },
    { value: "napkins", label: "Napkins" },
    { value: "coasters", label: "Coasters" },
  ],
  "lighting": [
    { value: "table-lamp", label: "Table Lamp" },
    { value: "floor-lamp", label: "Floor Lamp" },
    { value: "pendant-light", label: "Pendant Light" },
    { value: "chandelier", label: "Chandelier" },
    { value: "wall-sconce", label: "Wall Sconce" },
    { value: "lantern", label: "Lantern" },
  ],
};

export const FURNITURE_SUBTYPE_OPTIONS: Record<import("./types").FurnitureType, { value: import("./types").FurnitureSubType; label: string }[]> = {
  "sofas-seating": [
    { value: "sofa", label: "Sofa" },
    { value: "sectional", label: "Sectional" },
    { value: "armchair", label: "Armchair" },
    { value: "accent-chair", label: "Accent Chair" },
    { value: "recliner", label: "Recliner" },
    { value: "loveseat", label: "Loveseat" },
    { value: "bench", label: "Bench" },
    { value: "ottoman", label: "Ottoman" },
    { value: "pouf", label: "Pouf" },
  ],
  "tables": [
    { value: "coffee-table", label: "Coffee Table" },
    { value: "dining-table", label: "Dining Table" },
    { value: "side-table", label: "Side Table" },
    { value: "console-table", label: "Console Table" },
    { value: "desk", label: "Desk" },
    { value: "nesting-tables", label: "Nesting Tables" },
  ],
  "beds-bedroom": [
    { value: "bed-frame", label: "Bed Frame" },
    { value: "headboard", label: "Headboard" },
    { value: "nightstand", label: "Nightstand" },
    { value: "dresser", label: "Dresser" },
    { value: "wardrobe", label: "Wardrobe" },
    { value: "vanity", label: "Vanity" },
  ],
  "storage": [
    { value: "bookshelf", label: "Bookshelf" },
    { value: "cabinet", label: "Cabinet" },
    { value: "sideboard", label: "Sideboard" },
    { value: "tv-unit", label: "TV Unit" },
    { value: "shoe-rack", label: "Shoe Rack" },
    { value: "chest", label: "Chest" },
  ],
  "outdoor": [
    { value: "patio-set", label: "Patio Set" },
    { value: "garden-chair", label: "Garden Chair" },
    { value: "outdoor-table", label: "Outdoor Table" },
    { value: "hanging-chair", label: "Hanging Chair" },
    { value: "daybed", label: "Daybed" },
    { value: "planter", label: "Planter" },
  ],
};

export const PRODUCT_SHAPE_OPTIONS: { value: import("./types").ProductShape; label: string; icon: string }[] = [
  { value: "rectangular", label: "Rectangular", icon: "▬" },
  { value: "round", label: "Round", icon: "●" },
  { value: "runner", label: "Runner", icon: "═" },
  { value: "square", label: "Square", icon: "■" },
  { value: "oval", label: "Oval", icon: "⬭" },
  { value: "irregular", label: "Irregular / Organic", icon: "◇" },
];

export const ROOM_STYLES: import("./types").RoomStyle[] = [
  { id: "modern-minimal", name: "Modern Minimalist", description: "Clean lines, neutral palette, minimal furniture, abundant natural light, open space with white or light grey walls", thumbnail: "🏠" },
  { id: "bohemian", name: "Bohemian / Eclectic", description: "Layered textiles, warm earthy tones, plants, vintage furniture, global patterns, relaxed and collected atmosphere", thumbnail: "🌿" },
  { id: "indian-haveli", name: "Traditional Indian Haveli", description: "Ornate wooden furniture, arched doorways, brass accents, rich jewel tones, handcrafted details, warm ambient lighting", thumbnail: "🏛️" },
  { id: "scandinavian", name: "Scandinavian", description: "Light wood, white and pale tones, hygge warmth, functional furniture, cozy textiles, soft diffused natural light", thumbnail: "❄️" },
  { id: "mid-century", name: "Mid-Century Modern", description: "Retro furniture with clean lines, warm wood tones, statement pieces, geometric patterns, subdued palette", thumbnail: "🪑" },
  { id: "luxury-contemporary", name: "Luxury Contemporary", description: "High-end finishes, marble and gold accents, plush seating, dramatic lighting, sophisticated neutral palette", thumbnail: "💎" },
  { id: "rustic-farmhouse", name: "Rustic Farmhouse", description: "Reclaimed wood, shiplap walls, vintage accents, warm whites and natural tones, cozy country atmosphere", thumbnail: "🌾" },
  { id: "mediterranean", name: "Mediterranean Villa", description: "Terracotta tiles, whitewashed walls, wrought iron, arched windows, warm sunlight, olive and blue accents", thumbnail: "☀️" },
  { id: "japanese-zen", name: "Japanese Zen", description: "Minimal furniture close to ground, natural materials, neutral tones, sliding panels, serene and balanced composition", thumbnail: "🎋" },
  { id: "industrial-loft", name: "Industrial Loft", description: "Exposed brick, metal pipes, concrete floors, oversized windows, raw materials, Edison bulbs, high ceilings", thumbnail: "🏭" },
];

export const ROOM_STAGING_SHOTS: import("./types").RoomStagingShot[] = [
  // Product-Only Shots
  { id: "rs-flat-lay-full", name: "Flat Lay Full", description: "Top-down shot of the full product on a clean background, entire product visible", icon: "⬇️", viewAngle: "top-down", framing: "flat-lay", requiresRoom: false },
  { id: "rs-detail-closeup", name: "Detail Close-Up", description: "Extreme close-up showing texture, weave, grain, or material quality", icon: "🔍", viewAngle: "top-down", framing: "detail-closeup", requiresRoom: false },
  { id: "rs-corner-detail", name: "Corner / Edge Detail", description: "Close-up of finishing — fringe, binding, stitching, joinery, edge treatment", icon: "📐", viewAngle: "three-quarter-front", framing: "detail-closeup", requiresRoom: false },
  { id: "rs-back-view", name: "Back / Underside View", description: "Back or underside showing construction, labels, weave backing, or maker's marks", icon: "🔄", viewAngle: "back", framing: "product-only", requiresRoom: false },
  { id: "rs-rolled-display", name: "Rolled / Folded Display", description: "Product rolled or folded showing cross-section and surface simultaneously", icon: "📜", viewAngle: "three-quarter-front", framing: "product-only", requiresRoom: false },
  { id: "rs-draped-display", name: "Draped / Hung Display", description: "Product hung vertically or draped to show full pattern and drape quality", icon: "🪧", viewAngle: "front", framing: "product-only", requiresRoom: false },
  { id: "rs-scale-reference", name: "Scale Reference", description: "Product with a common object nearby for size context", icon: "📏", viewAngle: "top-down", framing: "product-only", requiresRoom: false },
  { id: "rs-dimension-diagram", name: "Dimension Diagram", description: "Product shown with dimension lines and measurements (length x width) annotated on the image", icon: "📐", viewAngle: "top-down", framing: "flat-lay", requiresRoom: false },

  // Room-Staged Shots
  { id: "rs-room-wide", name: "Full Room Wide", description: "Wide establishing shot showing the entire product in full room context", icon: "🏠", viewAngle: "front", framing: "room-wide", requiresRoom: true },
  { id: "rs-room-overhead", name: "Room Overhead", description: "Bird's-eye view of the product with surrounding furniture visible", icon: "🛸", viewAngle: "top-down", framing: "room-overhead", requiresRoom: true },
  { id: "rs-room-three-quarter", name: "Room Three-Quarter", description: "Angled view showing product placement with room depth and context", icon: "📐", viewAngle: "three-quarter-front", framing: "room-wide", requiresRoom: true },
  { id: "rs-corner-vignette", name: "Corner Vignette", description: "Styled corner with the product as hero, surrounded by complementary decor", icon: "🖼️", viewAngle: "three-quarter-front", framing: "room-vignette", requiresRoom: true },
  { id: "rs-lifestyle-setting", name: "Lifestyle Setting", description: "Product in realistic use — rug under furniture, lamp on table, art on wall", icon: "🛋️", viewAngle: "front", framing: "room-wide", requiresRoom: true },
  { id: "rs-closeup-in-situ", name: "Close-Up In Situ", description: "Detail of product pattern or texture with a hint of room context visible", icon: "✨", viewAngle: "top-down", framing: "room-vignette", requiresRoom: true },
  { id: "rs-texture-with-props", name: "Texture with Props", description: "Product surface with lifestyle props (book, cup, plant) for warmth and scale", icon: "☕", viewAngle: "top-down", framing: "room-vignette", requiresRoom: true },
  { id: "rs-window-light", name: "Window Light Scene", description: "Natural window light emphasizing the product's texture and color accuracy", icon: "🪟", viewAngle: "three-quarter-front", framing: "room-wide", requiresRoom: true },
  { id: "rs-evening-ambient", name: "Evening / Ambient Scene", description: "Warm artificial lighting creating a cozy mood with the product featured", icon: "🕯️", viewAngle: "front", framing: "room-vignette", requiresRoom: true },
  { id: "rs-bedroom-setting", name: "Bedroom Setting", description: "Product placed in a bedroom context — at foot of bed, beside bed, or on wall", icon: "🛏️", viewAngle: "front", framing: "room-wide", requiresRoom: true },
  { id: "rs-dining-setting", name: "Dining Setting", description: "Product in a dining room — under table, on table, or as wall backdrop", icon: "🍽️", viewAngle: "three-quarter-front", framing: "room-wide", requiresRoom: true },
  { id: "rs-entryway", name: "Entryway Setting", description: "Product at entrance or foyer, welcoming and first-impression focused", icon: "🚪", viewAngle: "front", framing: "room-wide", requiresRoom: true },
];

// ╔═══════════════════════════════════════════════════════════════════╗
// ║                  BULK INFOGRAPHIC FEATURE                          ║
// ╚═══════════════════════════════════════════════════════════════════╝

export const INFOGRAPHIC_WIZARD_STEPS = [
  { step: 1, title: "Products", description: "Upload products, info & brand logo" },
  { step: 2, title: "Background", description: "Choose the infographic background style" },
  { step: 3, title: "Template", description: "Template, aspect ratio & styling" },
  { step: 4, title: "Generate", description: "Generate & refine infographics" },
] as const;

/**
 * Product categories surfaced in the infographic wizard.
 * Footwear is the only active category in v1; clothing is planned for a later iteration.
 */
export const INFOGRAPHIC_CATEGORY_OPTIONS: { value: ProductCategory; label: string; icon: string; description: string; comingSoon?: boolean }[] = [
  { value: "footwear", label: "Footwear", icon: "👟", description: "Shoes, boots, sneakers, sandals — floating & sole-construction layouts" },
  { value: "clothing", label: "Clothing", icon: "👕", description: "Apparel infographics — coming soon", comingSoon: true },
];

export const INFOGRAPHIC_BACKGROUND_OPTIONS: { value: InfographicBackgroundStyle; label: string; icon: string; description: string }[] = [
  { value: "solid-uniform", label: "Solid Uniform", icon: "⬛", description: "A flat, even color that contrasts the footwear — no gradients or texture" },
  { value: "solid-textured", label: "Solid Textured", icon: "🌫️", description: "A contrasting solid color with subtle gradients & texture that complement the material" },
  { value: "dreamy", label: "Dreamy", icon: "☁️", description: "Soft, ethereal levitation-photography backdrop with gentle bloom and depth" },
  { value: "themed", label: "Themed", icon: "🎨", description: "A contextual background derived from the product's material, use-case and story" },
];

export const INFOGRAPHIC_TEMPLATE_OPTIONS: { value: InfographicTemplate; label: string; icon: string; description: string }[] = [
  { value: "minimalistic", label: "Minimalistic", icon: "✨", description: "The pair floating in clean space — one shoe shows the sole, the other top & side, with minimal callouts" },
  { value: "sole-construction", label: "Sole Construction", icon: "🧱", description: "A single shoe shown as an exploded sole-construction stack; layers derived from the feature points" },
];

export const INFOGRAPHIC_IMAGE_SIZE_OPTIONS: { value: "1K" | "2K" | "4K"; label: string; description: string }[] = [
  { value: "1K", label: "1K", description: "Fast drafts" },
  { value: "2K", label: "2K", description: "Recommended — crisp e-commerce quality" },
  { value: "4K", label: "4K", description: "Highest detail — print-ready" },
];

/**
 * Rich, reusable background prompt fragments stitched into the Gemini 3.1 Pro enrichment
 * instruction. Authored against Nano Banana best practices: positive phrasing, explicit
 * shadow/gradient direction sync, no design artifacts.
 */
export const INFOGRAPHIC_BACKGROUND_SNIPPETS: Record<InfographicBackgroundStyle, string> = {
  "solid-uniform": `BACKGROUND — SOLID UNIFORM:
Render a single, perfectly even, flat solid-color background. The background must be completely uniform edge to edge: no gradient, no vignette, no texture, no pattern, no geometric shapes, no rings, no decorative artifacts of any kind.

COLOR SELECTION (critical — do this carefully):
- First identify EVERY major color region of the footwear, not just the dominant upper: the upper, the SOLE / outsole / midsole, the laces, and any trims or accents.
- Choose ONE background color whose hue and value SIMULTANEOUSLY contrast ALL of those colors, so both the lightest and the darkest parts of the shoe clearly separate from the backdrop.
- If the footwear contains DARK elements (e.g. a black sole or dark upper), do NOT pick a dark or deep background shade — it would blend with those dark parts. If it contains NEAR-WHITE elements, avoid near-white / very pale backgrounds for the same reason.
- Prefer a clean, light-to-mid, gently saturated hue that sets off both extremes at once. Example: a white-and-black shoe → a soft LIGHT BLUE (or a similar soft pastel — light teal, soft lilac, pale warm grey) that contrasts both the white upper and the black sole. A predominantly bright/saturated shoe → a calm neutral mid-tone that lets the product's colors stay the hero.
State the exact background color as a concrete hex value in the composition so it is reproducible.`,
  "solid-textured": `BACKGROUND — SOLID TEXTURED:
Render a solid-color background enriched with a SUBTLE gradient and a fine, tasteful texture. Use your world knowledge to ANALYSE and COMPREHEND the footwear's design, materials, style and overall theme from the reference photo(s), then invent a texture that COMPLEMENTS that style and theme. Do NOT default to any one fixed texture — let the chosen texture vary naturally so it suits this specific shoe and so sibling variations can differ. Keep it refined and understated: it enriches the backdrop without ever becoming a design, logo, pattern, geometric shape, ring or artifact — only a clean, complementary textured solid backdrop.

COLOR SELECTION (critical — do this carefully):
- First identify EVERY major color region of the footwear, not just the dominant upper: the upper, the SOLE / outsole / midsole, the laces, and any trims or accents.
- Choose a base background color whose hue and value SIMULTANEOUSLY contrast ALL of those colors, so both the lightest and the darkest parts of the shoe clearly separate from the backdrop.
- If the footwear contains DARK elements (e.g. a black sole or dark upper), do NOT pick a dark or deep background shade — keep the base light-to-mid so the dark parts stand out. If it contains NEAR-WHITE elements, avoid near-white / very pale backgrounds.
- Prefer a clean, gently saturated light-to-mid hue that sets off both extremes at once. Example: a white-and-black shoe → a soft LIGHT BLUE (or a similar soft pastel) that contrasts both the white upper and the black sole. Keep the gradient and texture within this same hue family so the base color's contrast role is preserved.
CRITICAL: the gradient must be gentle and directional — state its bright-to-dark direction explicitly and keep it in sync with the product's lighting and contact-shadow direction (same single light source). State the base background color as a concrete hex value and the gradient direction.`,
  dreamy: `BACKGROUND — DREAMY:
Render a soft, ethereal, dreamy backdrop typical of high-end floating / levitation product photography. Use gentle atmospheric depth, soft bloom, a delicate haze, and softly diffused light falloff that makes the footwear feel weightless and suspended. Keep colors harmonious and muted so the product remains the hero; the dreamy atmosphere must never introduce hard shapes, patterns, text, or distracting artifacts. State the dominant background tones as concrete hex values and the light direction so contact shadows stay consistent.`,
  themed: `BACKGROUND — THEMED:
Invent a fitting, contextual themed background derived from the product information, the footwear's material, its intended use-case, and its story (e.g. a rugged textured surface for trail shoes, a clean athletic environment for running shoes, a refined surface for formal shoes). The theme must stay subtle, premium and uncluttered — it sets mood and context without competing with the product or its callouts, and never adds readable text, logos, busy patterns, or artifacts. Reserve clean negative space for the callouts. Keep the theme's tones chosen so they contrast ALL major footwear colors (upper AND sole) — if the footwear has dark elements like a black sole, keep the themed tones light-to-mid rather than dark so those parts stay separated. State the chosen theme, its dominant colors as concrete hex values, and the light direction.`,
};

/**
 * Rich, reusable template/composition prompt fragments stitched into the enrichment
 * instruction. Each describes footwear placement/orientation, callout style and the
 * expected number/arrangement of elements.
 */
export const INFOGRAPHIC_TEMPLATE_SNIPPETS: Record<InfographicTemplate, string> = {
  minimalistic: `TEMPLATE — MINIMALISTIC (FLOATING PAIR):
Compose a clean, minimalistic infographic showing the PAIR of footwear (exactly two shoes — the same product) suspended in floating-photography style against the chosen background, with plenty of clean negative space.
- ORIENTATION: one shoe of the pair MUST be angled so its full SOLE / outsole tread is clearly and prominently visible (any flattering angle, but the sole must read unmistakably); the other shoe shows its TOP and SIDE (the upper and profile). The two shoes are arranged in a balanced, elegant composition.
- GROUNDING: add a HIGHLY SUBTLE contact shadow beneath each shoe so they feel grounded yet weightless. The shadow direction, softness and the background gradient direction must all derive from the SAME single light source and stay in sync.
- CALLOUTS: place a few minimalistic callouts (typically 3–5) with thin leader lines and small, highly contextual, minimalistic icons chosen to suit the shoe's style. DISTRIBUTE the callouts EQUALLY across BOTH shoes so each shoe carries a roughly equal share (e.g. for 4 callouts, two point to the sole-facing shoe and two to the upper-facing shoe); never cluster them all on one shoe. Each callout label must be short (1–4 words). Associate each label with the correct region of the shoe it describes.
- COPY: derive the callout text from the product information. If the product info is already bullet points, use them directly; if it is a long paragraph, FIRST summarise it into concise bullet points, then use only those bullets.
- FEEL: premium, editorial, uncluttered — reference the look of clean floating-product infographics with NO decorative background rings or artifacts.`,
  "sole-construction": `TEMPLATE — SOLE CONSTRUCTION (EXPLODED STACK):
Compose a minimalistic infographic showing a SINGLE shoe from the product (exactly one shoe) rendered as an exploded SOLE-CONSTRUCTION diagram: the shoe separated into distinct horizontal layers, stacked and slightly separated vertically to reveal the construction.
- LAYERS (FIXED — always exactly THREE): render the exploded stack as exactly three distinct horizontal layers, separated vertically top-to-bottom: (1) the UPPER element alone — the tongue for laced footwear, or the single strap for sandals/slides/strap styles, choosing whichever actually matches the reference shoe; (2) the FOOTBED / insole; (3) a THIN SOLE layer (the outsole) kept visibly slim relative to the others. Always exactly three layers regardless of how many materials the product info lists.
- ORIENTATION: present the shoe and its exploded layers at a consistent, legible angle so each layer reads clearly and separately.
- GROUNDING: add a highly subtle contact shadow under the stack; shadow and background gradient direction share one light source.
- CALLOUTS: place exactly one minimalistic callout next to each of the three layers (three total) with a thin leader line and a small contextual icon; each label short (1–4 words) and associated with the exact layer it describes.
- COPY: derive callout text from the product info; if it is a long paragraph, summarise to bullets first, then use those bullets.
- FEEL: clean, technical, premium — no decorative background rings or artifacts.`,
};

/**
 * Shared Nano-Banana prompting principles injected into both the enrichment system prompt
 * and the image-generation header. Derived from official Google docs + community guidance.
 */
export const INFOGRAPHIC_PROMPTING_PRINCIPLES = `IMAGE-MODEL PROMPTING PRINCIPLES (follow precisely):
- Describe the final scene as a coherent narrative, not a keyword list. Use POSITIVE phrasing (state what to render) rather than "do not" wherever possible.
- For every piece of on-image text (headings, callout labels, bullets), wrap the EXACT words in double quotes so they render verbatim. Keep each text element short (≈1–4 words). Use a single legible modern sans-serif, consistent sizing and even spacing. Spell every word correctly.
- Keep the total amount of on-image text modest; prefer several short labels over dense paragraphs.
- Treat the attached product photo(s) as the ABSOLUTE source of truth for the footwear's identity: replicate silhouette, proportions, materials, stitching, colorway, sole pattern and existing logos with pixel-level accuracy. Do NOT redesign, rebrand, recolor, or add any logo/text/hardware that is not in the reference. Suppress any internal world-knowledge about what this product "should" look like.
- State exact object counts ("exactly one pair / exactly one shoe") to avoid duplicated or extra objects.
- Define ONE light source and reuse its direction for the product lighting, the contact shadow, and any background gradient so they all stay in sync.
- Reserve clean negative space for callouts; no background rings, frames, watermarks, busy patterns, or decorative artifacts.`;
