import type { PdpHeading, PdpShotOption } from "./types";

/**
 * The PDP Set shot catalog.
 *
 * Eleven preset options across three headings. Each carries an authored composition
 * brief in `promptSnippet`, which the enrichment step turns into a full image prompt.
 * The brief decides WHAT the image contains; the artistic style block (see
 * `pdp-style.ts`) decides HOW it is rendered, and is appended afterwards.
 *
 * Authoring rules followed throughout:
 * - Footwear only. Every brief assumes footwear and says so.
 * - No em dashes anywhere. The model echoes prompt punctuation into on-image copy, and
 *   em dashes are banned in generated callout text.
 * - Exact object counts are stated, because unstated counts produce duplicated shoes.
 * - Page level brand marks are never described here. They are composited from file after
 *   generation and the mark reservation directive reserves space for them.
 * - Text bearing options stay at or under five distinct text elements, which is the
 *   reliable ceiling for this model before duplication and edge clipping appear.
 */

export const PDP_HEADINGS: { value: PdpHeading; label: string; description: string }[] = [
  {
    value: "product-shot",
    label: "Product Shots",
    description: "The footwear on its own, with no human model.",
  },
  {
    value: "on-model",
    label: "Product Shots with Model",
    description: "The footwear worn, with the human model contextually placed.",
  },
  {
    value: "infographic",
    label: "Infographics",
    description: "Marketing assets with headlines, callouts and diagrams baked into the image.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  1) PRODUCT SHOTS, NO HUMAN MODEL
// ─────────────────────────────────────────────────────────────────────────────

const SINGLE: PdpShotOption = {
  id: "pdp-single",
  heading: "product-shot",
  label: "Single",
  icon: "👟",
  description: "One shoe, presented as the hero of the frame.",
  requiresModel: false,
  consumesCopy: false,
  bearsText: false,
  promptSnippet: `COMPOSITION: a single hero product photograph of EXACTLY ONE shoe from this pair. No second shoe appears anywhere in the frame, not even partially or out of focus.
- ORIENTATION: choose the angle that best reveals this specific footwear's character, reading it from the reference photographs. A three quarter front view showing the toe, the lateral side and the upper together is usually strongest, but favour whatever angle shows this design's most distinctive feature.
- SCALE: the shoe fills the frame generously and is unmistakably the subject. Leave clean, uncluttered margin around it.
- CRAFT: render it as a still life made by a specialist product photographer. Every material reads truthfully, matte where the reference is matte and glossy where it is glossy. Micro texture, grain, weave and moulded pattern are resolved crisply at true scale.
- GROUNDING: give the shoe a believable contact shadow or suspension shadow consistent with the single light source.
- There is NO text of any kind in this image.`,
};

const PAIR: PdpShotOption = {
  id: "pdp-pair",
  heading: "product-shot",
  label: "Pair",
  icon: "👞",
  description: "Both shoes of the pair, arranged as a composed still life.",
  requiresModel: false,
  consumesCopy: false,
  bearsText: false,
  promptSnippet: `COMPOSITION: a hero product photograph of EXACTLY TWO shoes, the left and the right of this one identical pair. Both shoes are the SAME product in the SAME colourway. No third shoe appears.
- ARRANGEMENT: compose them deliberately rather than lining them up flatly. One shoe presents its upper and profile while the other reveals a different aspect, its sole tread, its inner side or its heel, so the pair together tells the viewer more than one shoe could.
- The two shoes must be consistent with each other in scale, lighting and perspective, and must read as a genuine mirrored left and right rather than as two copies of the same foot.
- SCALE: the pair fills the frame generously with clean margin around the arrangement.
- CRAFT: render as a still life by a specialist product photographer. Materials read truthfully and micro texture resolves crisply at true scale.
- GROUNDING: both shoes share one light source, so their shadows fall in the same direction with matching softness.
- There is NO text of any kind in this image.`,
};

// ─────────────────────────────────────────────────────────────────────────────
//  2) PRODUCT SHOTS WITH HUMAN MODEL
// ─────────────────────────────────────────────────────────────────────────────

/** Shared by both single-model briefs. Wardrobe and fit fail the same way regardless of angle. */
const MODEL_SHARED_RULES = `- POSE: a natural, candid, unforced stance or stride suiting the footwear's character and the setting. Both feet clearly separated and fully visible, never overlapping, never cut off, never obscured by clothing or props.
- WARDROBE: simple, quiet clothing in muted tones that complements the footwear and never competes with it. The lower leg must be visible so the fit on the foot reads clearly. Trousers must not break over and hide the shoe.
- FIT: the footwear MUST sit on the feet at correct true scale and proportion, wrapping the foot the way real footwear does. Incorrect shoe scale is the most common failure in this kind of image, so verify the shoe reads neither oversized nor doll sized against the model's body.
- NO text, NO callouts, NO labels, NO badges, NO icons and NO graphic overlays of any kind. This is photography only.`;

const MODEL_CLASSIC: PdpShotOption = {
  id: "pdp-model-classic",
  heading: "on-model",
  label: "Model shot, classic",
  icon: "🧍",
  description: "A conventional full body lifestyle image, straight and clean, model placed in context.",
  requiresModel: true,
  consumesCopy: false,
  bearsText: false,
  promptSnippet: `COMPOSITION: a plain lifestyle photograph of EXACTLY ONE human model wearing this footwear, placed contextually within the setting rather than posed against a blank wall. This is a straight PDP photograph, not an information graphic.
- FRAMING: the frame shows the model head to feet, complete and uncropped, positioned squarely with comfortable headroom and floor beneath the feet.
- CAMERA: conventional and unobtrusive. Place it at roughly the model's chest to eye height, straight on or at a slight three quarter turn, with the sensor plane upright so verticals stay vertical. This shot should read as classic, well made catalogue photography.
- LENS AND DEPTH: a normal to short telephoto perspective from a natural working distance, so body proportions stay true with no wide angle distortion. Keep the whole figure acceptably sharp, including the footwear.
- The footwear must be clearly and completely visible and well lit, but it is not exaggerated here. Its prominence comes from being clean, sharp and unobstructed rather than from an unusual viewpoint.
${MODEL_SHARED_RULES}`,
};

const MODEL_DYNAMIC: PdpShotOption = {
  id: "pdp-model-dynamic",
  heading: "on-model",
  label: "Model shot, dynamic",
  icon: "📐",
  description: "Still full body, but a bold camera angle that brings the footwear close and makes it the subject.",
  requiresModel: true,
  consumesCopy: false,
  bearsText: false,
  promptSnippet: `COMPOSITION: a plain lifestyle photograph of EXACTLY ONE human model wearing this footwear, placed contextually within the setting, caught in a natural candid moment. This is a straight PDP photograph, not an information graphic.
- FRAMING: the model is shown head to feet, complete and uncropped, with the head clearly visible.
- THE FOOTWEAR IS THE SUBJECT AND SITS NEAREST THE VIEWER.
- HOW TO ACHIEVE THAT, and this is the important part: bring the feet close through the MODEL'S POSE, not through lens exaggeration. Put the model in a position that naturally carries the feet toward the camera while the body folds away behind them. Choose one and commit: perched on a low wall, railing, step or ledge with the knees bent and the legs folded forward; seated on the ground or an edge with one leg extended toward the lens; crouching; caught mid step-over or mid stride with the leading foot advanced. The shoes end up largest because they are genuinely closest, not because the image has been distorted.
- CAMERA: low and close, at or slightly below the height of the feet, angled a little upward along the body. Use a normal to moderately wide focal length. Keep the camera close to the shoes rather than reaching for an extreme wide lens.
- BOTH SHOES: where the pose allows, show both. The strongest version presents one shoe's SOLE and tread toward the camera while the other shows its upper and strap, so a single frame carries both faces of the product.
- FOCUS: the plane of sharpness sits ON THE FOOTWEAR. Let the torso and head fall gently softer with distance so the eye lands on the shoes first.
- ANATOMY IS NOT NEGOTIABLE. The person MUST remain correctly proportioned. NEVER elongate or stretch the legs, arms or torso. NEVER render the feet or shoes oversized relative to a real human body. NEVER apply fisheye, barrel or any lens warping. NEVER distort the face, hands or limbs because they are near the lens. If a pose cannot deliver foreground feet without distorting the body, choose a different pose rather than distorting the body.
${MODEL_SHARED_RULES}`,
};

const MODEL_COLLAGE: PdpShotOption = {
  id: "pdp-model-collage",
  heading: "on-model",
  label: "Model collage",
  icon: "🖼️",
  description: "One frame combining a full body shot with cropped detail shots. No text.",
  requiresModel: true,
  consumesCopy: false,
  bearsText: false,
  promptSnippet: `COMPOSITION: a single image frame containing a COLLAGE of between three and four separate photographs of the SAME human model wearing this footwear. This is pure photography, not an information graphic.
- CONTENT MIX: exactly one of the panels is a full body or seated three quarter photograph of the model. The remaining panels are tight cropped photographs, of the feet in the footwear, of the shoe against the ground mid stride, or of the lower leg and shoe together. The mix of one wide shot against several crops is the point of the layout.
- DYNAMIC ANGLES: every panel uses a deliberate, distinct camera angle that favours the footwear. Vary them across the collage: a low near ground view, a steep top down onto the shoes, a raking diagonal, a tight profile at shoe height. NEVER repeat the same angle twice, and NEVER let a panel settle into a flat eye level snapshot.
- FOCUS: in every panel the plane of sharpness sits ON the footwear, with everything else falling softer, so the shoes carry the eye through the whole collage.
- LAYOUT: arrange the panels however the artistic style directs. The style layer decides panel geometry, spacing, edge treatment and how panels relate. Favour an asymmetric arrangement with one dominant panel over an even grid.
- IDENTITY: the SAME person appears in every panel, with the same face, the same hair and the same clothing throughout. The same footwear in the same colourway appears in every panel.
- COHERENCE: all panels share one colour grade and one lighting logic so the collage reads as a single shoot rather than as assembled stock.
- COUNT: between three and four panels total. Never more than four, because panel count above four degrades the rendering of each.
- NO text, NO headline, NO labels, NO captions, NO numbers, NO callouts, NO badges, NO connectors and NO icons anywhere in this image.`,
};

// ─────────────────────────────────────────────────────────────────────────────
//  3) INFOGRAPHICS
// ─────────────────────────────────────────────────────────────────────────────

const INTERIOR_ANGLE: PdpShotOption = {
  id: "pdp-interior-angle",
  heading: "infographic",
  label: "Interior angle",
  icon: "🔍",
  description: "A close up of one feature, heel or top, chosen from the technical information.",
  requiresModel: false,
  consumesCopy: true,
  bearsText: true,
  promptSnippet: `COMPOSITION: an extreme close up feature study of EXACTLY ONE shoe, shot from a low interior angle so the camera looks along and into the footwear rather than down at it.
- FEATURE SELECTION: read the supplied product information and choose the SINGLE most technically interesting feature it describes. If the information emphasises cushioning, the footbed, the midsole or the outsole, frame the HEEL and midsole region. If it emphasises the upper, the strap, the lining or the collar, frame the TOP of the shoe. Commit fully to one choice and build the whole frame around it.
- CAMERA: sit the lens low and close, near the surface the shoe rests on, angled so the chosen feature dominates the frame. Use a macro perspective with shallow depth of field so the feature is razor sharp and the rest of the shoe falls away softly.
- MAGNIFIED INSET: include ONE circular magnified inset showing a tighter crop of the same feature, connected to its source point on the shoe by a single thin line ending in a small dot. The inset shows a real photographic magnification of that exact area, not an illustration.
- ON PRODUCT ANNOTATION: overlay ONE set of concentric thin arcs or a soft ring directly on the feature surface, indicating where the technology sits. It must sit in the product's own perspective plane, following the surface curvature.
- TEXT: exactly one short headline naming the feature, one supporting line of at most twelve words, and one short label for the inset. Three text elements total, no more.
- Derive all copy from the supplied product information. If the information is a long paragraph, reduce it first to short factual points and use only those.`,
};

const MODEL_INFOGRAPHIC: PdpShotOption = {
  id: "pdp-model-infographic",
  heading: "infographic",
  label: "Model infographic",
  icon: "📣",
  description: "A model collage carrying a headline and numbered callouts, with the setting following the product.",
  requiresModel: true,
  consumesCopy: true,
  bearsText: true,
  promptSnippet: `COMPOSITION: a marketing collage combining photography of a human model wearing this footwear with baked in headline and callout copy.
- PRIMARY PANEL: a large photograph of EXACTLY ONE model, seated or standing, wearing the footwear, occupying roughly the right half or upper two thirds of the frame. Directional light rakes across the scene producing a defined shadow edge.
- SUPPORTING STRIP: a row of exactly three tightly cropped photographs along the lower portion of the frame, each showing the feet in the footwear in a different everyday context. Same model, same footwear, same colourway throughout.
- HEADLINE: one short headline in the upper left, set in bold condensed uppercase, split across two lines with the second line in the accent colour.
- SUPPORTING LINE: one short sentence beneath the headline, sentence case, at most twelve words.
- NUMBERED CALLOUTS: exactly two callout chips placed over or beside the primary panel, each carrying a two digit number, a short bold label and a short description of at most eight words. Each chip carries one simple line icon.
- TILE LABELS: one short label under each of the three cropped photographs, at most four words each.
- IDENTITY: the SAME person and the SAME footwear appear in every panel.
- Derive all copy from the supplied product information, reducing long prose to short points first.`,
};

const TRUE_ZERO: PdpShotOption = {
  id: "pdp-true-zero",
  heading: "infographic",
  label: "True Zero",
  icon: "🌱",
  description: "The biodegradable story, told with a bold angle and a strong placement for the secondary mark.",
  requiresModel: false,
  consumesCopy: true,
  bearsText: true,
  requiresOptionalLogo: true,
  promptSnippet: `COMPOSITION: a bold, striking sustainability statement image built around this footwear's biodegradable construction.
- SUBJECT: EXACTLY ONE shoe, or EXACTLY ONE pair, shot from a dramatic and unexpected angle. Favour a steep low angle looking up, a near vertical top down, or a strongly tilted diagonal. This image should feel deliberately more graphic and more confident than a standard product shot.
- STORY: the composition must communicate returning to the earth. Suggest it through material, tone and staging rather than through explanation, for example an organic ground surface, soil or stone or raw fibre, a natural palette shifted toward earth greens and browns, or growth forms entering the frame. Keep it premium and restrained. NEVER render literal decay, damage, dirt on the product, rubbish, or a soiled shoe. The product itself stays pristine.
- PLACEMENT FOR THE SEAL: give the secondary mark a deliberately clean, flat, generous area of uniform tone to sit in, positioned as a strong compositional element in its own right rather than tucked into a corner as an afterthought. The mark itself is rendered there per the page level branding instruction below.
- TEXT: at most two text elements. One short bold statement about the biodegradable construction, and optionally one supporting line of at most ten words. Let the image carry the rest.
- Derive the claim wording from the supplied product information. NEVER invent an environmental claim, a certification, a percentage or a standard that the supplied information does not state.`,
};

/**
 * Compositional approaches for the waterproof and biodegradable image.
 *
 * A pool rather than one fixed construction because a catalogue of waterproof styles
 * should not be six versions of the same split frame. One is selected per PRODUCT, so it
 * is stable for that product and differs across the batch. See {@link pdpConstructionFor}.
 *
 * Every entry has to hold BOTH ideas in one frame. That is the whole problem the image
 * exists to solve: water and compostability read as contradictory, so showing water alone
 * and hoping is not enough.
 */
export const PDP_WATERPROOF_CONSTRUCTIONS: string[] = [
  "A SPLIT FRAME divided by one clean vertical seam. On one side, water: spray, droplets in flight, a wet dark surface with light catching the ripples. On the other, earth: dry soil, moss, stone, root and leaf. The footwear sits ACROSS the seam so a single shoe belongs to both worlds at once, lit by one light source that carries across the division.",
  "A TOP TO BOTTOM READ. In the upper half water beads and rolls off the upper in tight spherical droplets, caught mid roll, the surface visibly shedding rather than soaking. In the lower half the ground beneath is living soil with moss and fine growth. The eye travels down from repelled water to receptive earth, and the two halves meet without a hard edge.",
  "HALF SUBMERGED. The footwear stands in a shallow pool of clear still water, the waterline cutting cleanly across it, the submerged part sharply visible through the water and completely unaffected. Behind and around, a bank of wet stone, dark loam and low growth rises out of the pool.",
  "A SUSPENDED MOMENT. One large droplet hangs in the air a fraction above the upper, about to land, rendered with real refraction. The footwear rests on an organic surface that is unmistakably alive, soil with fine roots or moss. Everything is still. The image is about the instant before contact rather than the splash.",
  "SHEETING WATER. Water pours across the upper in a continuous sheet and runs off the edge in a clean curtain, mid motion, frozen sharp. Below and behind, the ground is raw earth and stone that the water is running into. Motion above, permanence below.",
  "TWO GROUNDS, ONE PRODUCT. The surface under the footwear transitions across the frame, from wet polished stone with standing water at one end to dry crumbling earth and moss at the other. The product bridges the transition. The change in ground is gradual and physical rather than a graphic device.",
];

const TRUE_ZERO_WATERPROOF: PdpShotOption = {
  id: "pdp-true-zero-waterproof",
  heading: "infographic",
  label: "True Zero + Waterproof",
  icon: "💧",
  description:
    "For footwear that is both waterproof and biodegradable. Holds the two ideas in one frame, with the TruZero seal present.",
  requiresModel: false,
  consumesCopy: true,
  bearsText: true,
  requiresOptionalLogo: true,
  // The construction line is appended per product at assembly time from
  // PDP_WATERPROOF_CONSTRUCTIONS. This snippet carries everything shared.
  promptSnippet: `COMPOSITION: a striking image for footwear that is BOTH waterproof AND biodegradable, holding both ideas in a single frame.
- THE TENSION IS THE POINT. A viewer reasonably wonders how something that repels water can also return to the earth, so the image must show BOTH truths together and let them sit side by side without apology. Showing water alone, or earth alone, fails this brief.
- SUBJECT: EXACTLY ONE shoe, or EXACTLY ONE pair. The product stays pristine throughout: water beads, sheets and runs off it, and it is NEVER waterlogged, stained, soggy, muddied, damaged or decaying. Biodegradable describes what it can become at the end of its life, never its current condition.
- WATER: render water as real physics. Droplets hold spherical form under surface tension, refract what is behind them, and cast small caustic highlights. Sheeting water follows the product's contours. Water in flight is motion frozen sharply, not a smear.
- EARTH: the organic side reads as living and clean. Damp soil, moss, stone, root, leaf. Rich and healthy, NEVER rubbish, rot, decay or filth.
- PLACEMENT FOR THE SEAL: give the secondary mark a deliberately clean, flat, generous area of uniform tone to sit in, positioned as a strong compositional element rather than tucked into a corner. The mark itself is rendered there per the page level branding instruction below.
- LIGHT: ONE light source across the whole frame. Both halves of the idea share it, which is what stops the image reading as two photographs stuck together.
- TEXT: at most two text elements. Use the supplied copy for this option to state, in a short line, HOW the two properties coexist. If no such copy was supplied, render NO explanatory line at all and let the imagery carry the idea alone. NEVER invent a mechanism, a material, a treatment, a certification or a percentage that the supplied information does not state. An unexplained image is acceptable; an invented environmental claim is not.`,
};

const FEATURE_CALLOUTS: PdpShotOption = {
  id: "pdp-feature-callouts",
  heading: "infographic",
  label: "Feature callouts",
  icon: "✨",
  description: "Both shoes shown with bold creative callouts and zoomed crops. Image led, not text heavy.",
  requiresModel: false,
  consumesCopy: true,
  bearsText: true,
  promptSnippet: `COMPOSITION: a feature board showing EXACTLY TWO shoes, the left and the right of this one identical pair, surrounded by callouts that explain what makes the footwear good.
- ARRANGEMENT: pose the pair so that between them they reveal the features being called out. One shoe shows its upper and profile, the other reveals its sole tread or inner construction.
- IMAGE LED STORYTELLING: this is the defining rule for this layout. At least half the callouts must SHOW rather than TELL, using a real magnified photographic crop of the exact area being described, presented as a shaped inset. Only the remainder use an icon and a label. A viewer should understand most of the value of this footwear with the text removed entirely.
- CALLOUTS: between three and six callouts, however many the supplied product information genuinely supports. Use more only when there are that many features worth naming; do not pad to fill the frame. Each attaches to the correct region of the correct shoe, unambiguously, and they are distributed across BOTH shoes rather than clustered on one.
- TEXT: each callout carries one short bold label of one to four words, and some additionally carry a supporting line of at most eight words. As the callout count rises, space them further apart and set them larger rather than smaller, so a fuller board still reads cleanly.
- CRAFT: the magnified crops must be genuine photographic magnifications of this exact product at true texture scale, never illustrations and never invented detail.
- Derive all copy from the supplied product information, reducing long prose to short points first.`,
};

const SOLE_CONSTRUCTION: PdpShotOption = {
  id: "pdp-sole-construction",
  heading: "infographic",
  label: "Sole construction",
  icon: "🧱",
  description: "An exploded layer stack of a single shoe, with one callout pinned per layer.",
  requiresModel: false,
  consumesCopy: true,
  bearsText: true,
  // The real brief is layer count specific and is produced by buildSoleConstructionSnippet()
  // at assembly time, keyed on this option's id. This value is the fallback used only if
  // that lookup is ever bypassed.
  promptSnippet: `COMPOSITION: a technical exploded diagram of EXACTLY ONE shoe, separated into distinct horizontal layers hovering in vertical alignment over the midfoot centre, with exactly one short callout pinned to each layer. The footbed layer is a SMOOTH, CONTINUOUS surface with NO slots, grooves, cutouts or recesses of any kind.`,
};

const SIZE_CHART: PdpShotOption = {
  id: "pdp-size-chart",
  heading: "infographic",
  label: "Size chart",
  icon: "📏",
  description: "The size table, rendered minimalistic and themed rather than dense and utilitarian.",
  requiresModel: false,
  consumesCopy: false,
  bearsText: true,
  promptSnippet: `COMPOSITION: a size guide built around EXACTLY ONE shoe and one size table. The brief here is restraint: this must read as a designed, minimalistic, textural piece rather than as a dense utility table.

THE TABLE (reproduce these values exactly, verbatim, with no additions, omissions or alterations):
Header row: "UK"  "US"  "EU"  "CM"
Row 1: "6"  "7"  "40"  "26.4"
Row 2: "7"  "8"  "41"  "27.2"
Row 3: "8"  "9"  "42"  "28.0"
Row 4: "9"  "10"  "43"  "28.8"
Row 5: "10"  "11"  "44"  "29.5"
Row 6: "11"  "12"  "45"  "30.4"

- TABLE RENDERING: treat the table as ONE structured block, not as many separate labels. Set it large, clean and generously spaced, in a single modern sans serif, with a clearly differentiated header row. Every figure must be crisp and unambiguous. Numbers are the one thing in this image that MUST be perfectly legible, so give them room.
- THE SHOE: EXACTLY ONE shoe, presented beside or beneath the table, angled to show its length clearly. Include ONE slim measurement indicator running along the shoe's length from heel to toe, a thin line with end markers, carrying the single short label "HEEL TO TOE".
- RESTRAINT: apart from the table and that one measurement label, use AT MOST two further text elements in the whole image. One short title, and optionally one short fit note of at most ten words. Do not add a how to measure paragraph, do not add fit advice columns, do not add a footnote.
- LET THE IMAGE CARRY IT: the measurement indicator on the shoe should communicate how to measure without a paragraph explaining it.
- TEXTURE AND THEME: the surface, ground and palette should feel material and considered, in keeping with the artistic style, rather than flat and clinical.`,
};

const COMPARISON: PdpShotOption = {
  id: "pdp-comparison",
  heading: "infographic",
  label: "Comparison",
  icon: "⚖️",
  description: "This footwear against a generic equivalent, across three or four rows.",
  requiresModel: false,
  consumesCopy: true,
  bearsText: true,
  promptSnippet: `COMPOSITION: a two column comparison contrasting this footwear against a generic, unbranded equivalent.

- THE TWO SUBJECTS: at the top of the frame, EXACTLY TWO shoes side by side. On one side, THIS product, rendered in full colour and full detail from the reference photographs. On the other side, a GENERIC equivalent shoe of the same broad category, rendered plainly in flat neutral grey with no branding, no pattern, no texture detail and no distinguishing design. The generic shoe MUST be visibly duller and simpler so the comparison reads instantly. NEVER put any real brand's product, name or mark on the generic side.
- COLUMN HEADERS: one filled header for this product carrying its name, and one outlined, unfilled header for the generic side carrying a plain descriptor such as "ORDINARY SLIDE" or "ORDINARY SHOE". The visual weight difference between a filled and an outlined header is doing deliberate work.
- ROWS: EXACTLY THREE OR FOUR comparison rows. Never more than four. Each row has a short attribute label on the left, then this product's entry marked with a filled tick, then the generic entry marked with an outlined cross or dash. Keep each entry to at most six words.
- ROW SELECTION: choose the three or four attributes from the supplied product information that most strongly differentiate this footwear. Pick the differences a buyer would actually care about, not the trivial ones.
- HONESTY: every claim about this product must come from the supplied product information. Statements about the generic side must be plain, factual and unexaggerated, describing the ordinary absence of a feature rather than disparaging anything.
- TEXT BUDGET: the row grid is one structured block. Beyond it, use at most one short headline and nothing else.`,
};

/** Option ids whose brief is completed per product from a construction pool. */
export const PDP_WATERPROOF_ID = TRUE_ZERO_WATERPROOF.id;

/**
 * Pick a construction for one product, stably.
 *
 * Hashed from the SKU rather than randomised, so the same product keeps the same
 * construction across a re-run or a retry while different products in one batch get
 * different ones. A retry that silently changed the whole composition would make the
 * operator's approve-or-discard decision meaningless.
 */
export function pdpConstructionFor(pool: string[], sku: string): string {
  let hash = 0;
  for (let i = 0; i < sku.length; i++) {
    hash = (hash * 31 + sku.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

export const PDP_CATALOG: PdpShotOption[] = [
  SINGLE,
  PAIR,
  MODEL_CLASSIC,
  MODEL_DYNAMIC,
  MODEL_COLLAGE,
  INTERIOR_ANGLE,
  MODEL_INFOGRAPHIC,
  TRUE_ZERO,
  TRUE_ZERO_WATERPROOF,
  FEATURE_CALLOUTS,
  SOLE_CONSTRUCTION,
  SIZE_CHART,
  COMPARISON,
];

export const PDP_CATALOG_BY_HEADING: Record<PdpHeading, PdpShotOption[]> = {
  "product-shot": PDP_CATALOG.filter((o) => o.heading === "product-shot"),
  "on-model": PDP_CATALOG.filter((o) => o.heading === "on-model"),
  infographic: PDP_CATALOG.filter((o) => o.heading === "infographic"),
};

/** Option id whose brief is built dynamically from the product's layer count. */
export const PDP_SOLE_CONSTRUCTION_ID = SOLE_CONSTRUCTION.id;

export function findPdpOption(id: string, custom: PdpShotOption[] = []): PdpShotOption | undefined {
  return PDP_CATALOG.find((o) => o.id === id) ?? custom.find((o) => o.id === id);
}

/**
 * Build a custom option from an operator's free text description. Custom options are
 * always treated as text bearing and copy consuming, because we cannot know from a
 * description whether the operator intends callouts, and over reserving is harmless
 * while under reserving would silently drop their sheet copy.
 */
export function buildCustomPdpOption(opts: {
  id: string;
  heading: PdpHeading;
  label: string;
  description: string;
}): PdpShotOption {
  return {
    id: opts.id,
    heading: opts.heading,
    label: opts.label,
    icon: "✦",
    description: opts.description,
    promptSnippet: `COMPOSITION: ${opts.description.trim()}`,
    requiresModel: opts.heading === "on-model",
    consumesCopy: opts.heading === "infographic",
    bearsText: opts.heading === "infographic",
    isCustom: true,
  };
}
