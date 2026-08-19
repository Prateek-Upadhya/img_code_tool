import type { FootwearSide, OverlayPosition, PdpLogos, PdpShotOption } from "./types";

/**
 * Shared prompt directives for the PDP Set mode.
 *
 * These encode findings from the Nano Banana / Gemini 3 image model literature:
 *
 * - Capitalised imperatives (MUST, NEVER) measurably improve instruction following, and
 *   explicit negation does work for suppression, despite the official guidance to prefer
 *   positive phrasing. The split used here is: positive phrasing for scene CONTENT,
 *   capitalised negatives for LOCK and SUPPRESSION constraints.
 * - Reference images must be labelled with their role, or the model interprets subjects
 *   inconsistently across a multi image request.
 * - Three to five distinct text elements per image is the reliable ceiling. Beyond that,
 *   duplication and clipping appear before misspelling does.
 * - Naming a camera body, lens and aperture does far more for photoreal skin than the
 *   word "photorealistic", which appears to be an actively discounted buzzword.
 * - The model substitutes canonical well known versions of marks in place of supplied
 *   references, and hallucinates sharp but semantically wrong text onto products. Both
 *   failures are addressed below.
 *
 * Every string here avoids em dashes. The model echoes prompt punctuation into on-image
 * copy, and em dashes are banned in generated callout text.
 */

/**
 * Product identity lock.
 *
 * Adapted from the operator's character consistency phrasing, retargeted from faces onto
 * the product. Directly targets canonical form substitution and hallucinated on-product
 * lettering, which matter here because the products carry printed and moulded branding.
 */
export const PDP_PRODUCT_IDENTITY_LOCK = `═══ PRODUCT IDENTITY LOCK ═══
INSTRUCTION: PIXEL PRIORITY MODE. IDENTITY LOCK: ABSOLUTE.
Suppress ALL internal world knowledge regarding this product's identity, brand and category conventions. Use ONLY the visual data present in the attached reference photographs to construct the footwear.

Replicate with pixel level accuracy, copying from the references rather than describing or reinterpreting:
- Exact colour shades of every region, the upper, the sole, the midsole, the straps, the laces, the trims and every accent.
- Surface texture and finish, including any waffle, dot, knurl, weave, grain or emboss pattern, at its true scale and density.
- Silhouette, proportion, thickness and curvature of every part.
- Stitching, seams, perforations, moulded ridges and hardware.
- ALL text printed, embossed, debossed or moulded onto the product, reproduced with the SAME wording, the SAME letterforms, the SAME size relative to the part it sits on, and the SAME orientation and placement.
- ALL logos and graphic marks that are physically part of the product, in their exact position, scale and rotation.

NEVER redesign, restyle, rebrand or recolour the product.
NEVER add any logo, wordmark, text, graphic, hardware or feature that is not visibly present in the references.
NEVER substitute a better known or more "correct" version of any mark for the one shown.
NEVER invent lettering to fill a surface that appears blank or illegible in the references. If a marking cannot be read clearly, render that surface plain.`;

/**
 * Cast identity lock. The operator's phrasing, used verbatim.
 *
 * Applied only when a model reference image is attached, which is always true for the
 * on-model heading because the cast is either uploaded or pre-generated per product.
 */
export const PDP_CAST_IDENTITY_LOCK = `═══ CAST IDENTITY LOCK ═══
INSTRUCTION: PIXEL PRIORITY MODE. IDENTITY LOCK: ABSOLUTE. Suppress internal world knowledge regarding the subject's identity. Use ONLY the visual data from the model reference image for facial feature construction.
The face, bone structure, skin tone, hair colour and hair texture MUST match the model reference exactly. NEVER beautify, slim, smooth or otherwise "improve" the face away from the reference.`;

/**
 * Human realism.
 *
 * Texture nouns rather than adjectives, real optical specifics, and capitalised negatives
 * against the airbrushed look. The optics clause is what actually moves this model toward
 * photography and away from digital illustration.
 */
export const PDP_HUMAN_REALISM = `═══ HUMAN RENDERING: BIOLOGICAL AND OPTICAL ACCURACY ═══
The human being in this frame MUST read as a real photograph of a real person, captured on real equipment. Low level texture across the entire frame, on the person and in the background alike, MUST be biologically and physically plausible under the stated lighting.

SKIN: clean, healthy, real skin. Visible pores at true scale, fine lines around the eyes and mouth, faint peach fuzz catching the light along the jaw and forearm, natural colour variation across the cheeks, nose and neck, subtle subsurface scattering with warm translucency at the ear rims and nostrils, believable specular variation where skin is oilier at the forehead, nose and chin.
EYES: well defined iris fibres, a clean pupil edge, a single catchlight consistent with the key light direction, natural moisture along the lower lid, individually distinguishable lashes.
HAIR: individual strands resolving at the hairline, natural flyaways, believable root to tip variation, and shadow behaviour that matches the key light rather than sitting flat.
HANDS: anatomically correct. Exactly five fingers per hand, correct joint counts and proportions, natural nail beds, and a relaxed plausible grip or rest position.
BODY: correct anatomical proportion and weight distribution, natural fabric drape and contact where clothing meets the body.

OPTICS: capture as full frame digital photography with an 85mm prime at f/2.8, sensor plane parallel to the subject unless the composition states otherwise, natural depth of field falloff, and directional key light with soft fill so the face retains real modelling.

NEVER apply beauty retouching, skin smoothing or frequency separation.
NEVER render airbrushed, waxy, plastic or porcelain skin.
NEVER produce a digital sheen, an HDR glow or a uniformly lit flat face.
NEVER render a perfectly symmetrical face, perfectly uniform skin tone, or teeth and eyes that are unnaturally white.
NEVER produce extra or missing fingers, fused digits or malformed hands.`;

/**
 * On-image text rules.
 *
 * The element ceiling is the important constraint. This model degrades on layout before
 * it degrades on spelling, so capping element count prevents the duplication and edge
 * clipping that are the real observed failures in dense infographics.
 */
export const PDP_TEXT_RULES = `═══ ON IMAGE TEXT ═══
- Every piece of on-image copy MUST be wrapped in double quotes in the composition you author, so it renders verbatim. Spell every word correctly.
- Use AT MOST five distinct text elements in the whole image, and prefer three or four. Fewer, larger, well spaced elements render reliably. Many small elements produce duplicated and clipped text.
- Give each text element its own explicit typographic specification: weight, case, relative size and colour. Use one modern sans serif family across the whole image, in at most two weights.
- Keep each label short, ideally one to four words. Let the imagery carry the story and use text only to name what the image is already showing.
- NEVER use an em dash or an en dash in any on-image text. Use a comma, a colon or a full stop instead. This is absolute.
- NEVER render lorem ipsum, placeholder text, watermarks, captions, credits or a signature.
- NEVER repeat the same text element twice anywhere in the frame.
- Keep all text fully inside the frame with generous margin. NEVER let a glyph touch or cross the frame edge.`;

/**
 * Page level marks, rendered INTO the image as design components.
 *
 * Both marks are drawn by the generator from their attached reference files rather than
 * pasted over the finished render, so they sit in the composition's own light, surface
 * and perspective instead of looking stuck on. The safeguard against the model
 * substituting a canonical version of a known mark, or inventing lettering around it, is
 * the shape lock below plus the reference image itself.
 *
 * The two marks get different amounts of freedom:
 * - The BRAND mark has a fixed corner chosen by the operator, and sits directly on the
 *   background with nothing behind it. No white plate, no card, no panel.
 * - The OPTIONAL mark has no fixed position or size. It is composed into the image as a
 *   designed element that carries its meaning, for example a circular seal with its claim
 *   set around the rim, placed wherever the layout wants it.
 *
 * The distinction against {@link PDP_PRODUCT_IDENTITY_LOCK} still holds: branding
 * physically ON the shoe is part of the product and is replicated from the product
 * photographs, not from these files.
 */
/**
 * The logo reference files are JPEGs, so the white field around a mark is opaque pixels
 * rather than transparency. Asked simply to "reproduce this image", the model paints the
 * white card along with the mark. This clause draws the distinction explicitly.
 */
const PDP_MARK_INK_ONLY = `INK ONLY: the reference image shows the mark as dark shapes on a plain white field. That white field is NOT part of the mark. It is only the paper the mark was supplied on. Reproduce ONLY the dark shapes. Whatever the composition already places behind the mark stays visible around and between those shapes.
NEVER draw the white field, a white box, a white rectangle, a light plate or any lighter patch behind or around the mark.`;

export function buildPdpMarkDirective(opts: {
  brandPlacementLabel?: string;
  /** Roughly how much of the canvas width the brand mark spans, 0 to 1. */
  brandScale?: number;
  optionalMarkPurpose?: string;
  /** Claim text rendered with the secondary mark, authored per shot option. */
  optionalMarkCaption?: string;
}): string {
  const parts: string[] = [];

  if (opts.brandPlacementLabel) {
    const pct = Math.round((opts.brandScale ?? 0.18) * 100);
    parts.push(`BRAND MARK:
Render the brand mark shown in the attached brand logo reference at ${opts.brandPlacementLabel} of the frame, spanning roughly ${pct} percent of the canvas width.
${PDP_MARK_INK_ONLY}
COLOUR: render the mark as a SINGLE FLAT COLOUR chosen so it reads clearly against whatever sits behind it at that position. On a light background use near black. On a dark background use white. Use ONLY black or white, never a mid tone, never a colour sampled from the scene, and never a gradient.
It MUST sit DIRECTLY on the background surface itself, as though printed or screened onto that surface. NEVER place it on a white box, a coloured plate, a rounded card, a panel, a sticker or any container. NEVER add a drop shadow, glow, outline or border around it.`);
  }

  if (opts.optionalMarkPurpose) {
    parts.push(`SECONDARY MARK:
Compose the mark shown in the attached secondary logo reference INTO this image as a designed component.
${PDP_MARK_INK_ONLY}
${opts.optionalMarkCaption?.trim()
      ? `ACCOMPANYING TEXT: this mark MUST be rendered together with the words "${opts.optionalMarkCaption.trim()}". Set that text as part of the same designed element, not floating separately elsewhere in the frame. Spell it exactly as given.`
      : "If the mark carries a claim, express it through the design of the element itself rather than adding invented wording."}
CONSTRUCTION: decide the position, size, colour and form yourself, choosing whatever serves this composition best. Do NOT default to a corner. Good forms include a circular seal or stamp with the mark at its centre and the text set in a ring around the rim, a rounded badge with the mark beside the text, or a bar or panel at the base of the frame carrying both. Pick ONE and commit to it.
COLOUR: this element may take a colour that suits its meaning and the palette, and the mark inside it is rendered in whatever single flat tone reads cleanly against that element.
It MUST read as a deliberate part of the design rather than something laid over the top.`);
  }

  if (parts.length === 0) {
    return `═══ PAGE LEVEL BRANDING ═══
Render NO brand wordmark, logo lockup, company name or corner seal anywhere in this image.
Branding that is physically part of the footwear itself, printed, embossed or moulded into the product, is NOT page level branding and MUST still be replicated exactly as described in the product identity lock.`;
  }

  return `═══ PAGE LEVEL BRANDING (render these into the image) ═══
${parts.join("\n\n")}

SHAPE LOCK, applies to every mark above:
Reproduce each mark's GEOMETRY exactly as it appears in its reference image: the same shapes, the same proportions, the same counts of every element, the same spacing, the same negative space inside and between the shapes. Copy the reference pixels rather than drawing from memory.
NEVER substitute a different or better known version of a mark. NEVER redraw, restyle, simplify, embellish, rotate or mirror it. NEVER add letters, words or symbols to a mark that does not have them, and NEVER drop any it does have.
Geometry is locked; COLOUR is not. Each mark is rendered as a single flat tone chosen for contrast, per its instruction above. Never render a mark with a gradient, a texture, a bevel or a highlight.`;
}

/**
 * Label every reference image with its role.
 *
 * Without explicit labelling the model interprets subjects inconsistently when several
 * references are attached. Labels are emitted in the same order the image parts are
 * appended to the request.
 */
export function buildPdpReferenceManifest(labels: string[]): string {
  if (labels.length === 0) return "";
  const lines = labels.map((label, i) => `- Image ${i + 1}: ${label}`).join("\n");
  return `═══ REFERENCE IMAGES ═══
The attached images are, in order:
${lines}
Use each image ONLY for the role named above.`;
}

/**
 * Composition-side awareness of the marks.
 *
 * Fed to the enrichment step rather than the render step. The marks are drawn by the
 * generator, but the composition still has to expect them: if the chosen corner ends up
 * carrying the product, a busy texture or a tonal transition, the mark lands on top of it
 * and stops reading. This asks the art direction to plan the space, which is the
 * reservation idea from the compositor era applied to a mark the model draws itself.
 */
export function buildPdpMarkAwarenessClause(opts: {
  brandPlacementLabel?: string;
  hasOptionalMark?: boolean;
}): string {
  if (!opts.brandPlacementLabel && !opts.hasOptionalMark) return "";

  const lines: string[] = [];
  if (opts.brandPlacementLabel) {
    lines.push(
      `A brand mark will be rendered at ${opts.brandPlacementLabel} of the finished frame. Compose so that area is calm and tonally even: no product, no callout, no busy texture and no tonal transition running through it, and enough contrast there for a flat black or flat white mark to read cleanly. State in your composition what sits behind that area and whether it is light or dark.`
    );
  }
  if (opts.hasOptionalMark) {
    lines.push(
      `A secondary mark will also be composed into the frame as a designed element such as a seal or badge. Leave it somewhere sensible to live and say where, so it does not collide with the product or the callouts.`
    );
  }

  return `═══ MARKS THE COMPOSITION MUST ALLOW FOR ═══
${lines.join("\n")}`;
}

/** Human readable role for one tagged product photograph. */
export function footwearSideLabel(side: FootwearSide | undefined, sku: string): string {
  switch (side) {
    case "sole":
      return `the SOLE of style ${sku}, its bottom and outsole tread`;
    case "medial":
      return `the MEDIAL SIDE of style ${sku}, the inner side that faces the opposite foot`;
    case "lateral":
      return `the LATERAL SIDE of style ${sku}, the outer side that faces away from the opposite foot`;
    default:
      return `an additional angle of style ${sku}`;
  }
}

/**
 * Authoritative positional-label clause, emitted only when at least one image is tagged.
 *
 * Mirrors the clause `buildVTONImageContentParts` already uses for footwear. Without it
 * the model happily mirrors a logo from the lateral photograph onto the medial side of
 * the rendered shoe, which is the single most common footwear fidelity failure.
 */
export function buildPdpSideLabelClause(sides: (FootwearSide | undefined)[]): string {
  if (!sides.some(Boolean)) return "";
  const hasSole = sides.includes("sole");
  return `═══ POSITIONAL SIDE LABELS: AUTHORITATIVE ═══
Some reference images above are named as a specific physical side of the footwear. Those names are the source of truth for where things sit on the product.
- MEDIAL SIDE is the inner side, the one facing the opposite foot.
- LATERAL SIDE is the outer side, the one facing away from the opposite foot.
Any branding, stripe, logo, panel or marking visible on a LATERAL SIDE image MUST appear on the OUTER side of the rendered shoe, and anything on a MEDIAL SIDE image MUST appear on the INNER side.
NEVER mirror, swap or move a side specific detail from one side to the other. NEVER claim a detail exists on a side that no reference shows.${hasSole
    ? `\nThe SOLE image defines the bottom and outsole ONLY: its tread pattern, its geometry and any markings moulded into it. Use it wherever the composition shows the underside of the shoe.`
    : ""}`;
}

/**
 * Cap on product reference images forwarded per generation.
 *
 * The API accepts far more, but structural accuracy degrades past roughly six references.
 * Product folders routinely hold more than this, so the generation path trims.
 */
export const PDP_MAX_PRODUCT_REFERENCES = 6;

/**
 * Choose which product photographs to forward, newest-first within priority tiers.
 *
 * A plain `slice(0, max)` silently discards tagged images when a folder holds more than
 * the cap, which in the worst case throws away the only photograph of the sole and leaves
 * the sole-construction infographic inventing an outsole. Tagged images therefore come
 * first, in the order sole, medial, lateral, and untagged ones fill whatever remains.
 * Original relative order is preserved inside each tier.
 */
export function selectPdpReferences<T extends { footwearSide?: FootwearSide }>(
  images: T[],
  max: number = PDP_MAX_PRODUCT_REFERENCES
): T[] {
  if (images.length <= max) return images;
  const rank = (side: FootwearSide | undefined): number =>
    side === "sole" ? 0 : side === "medial" ? 1 : side === "lateral" ? 2 : 3;

  return images
    .map((img, i) => ({ img, i }))
    .sort((a, b) => rank(a.img.footwearSide) - rank(b.img.footwearSide) || a.i - b.i)
    .slice(0, max)
    // Restore upload order so the manifest reads naturally.
    .sort((a, b) => a.i - b.i)
    .map((e) => e.img);
}

/**
 * Minimum render size for an option that bears text. Small type degrades before anything
 * else does, so text bearing options are floored at 2K regardless of the batch setting.
 */
export function resolvePdpImageSize(
  option: PdpShotOption,
  requested: "1K" | "2K" | "4K"
): "1K" | "2K" | "4K" {
  if (option.bearsText && requested === "1K") return "2K";
  return requested;
}

/**
 * Whether this option should carry the optional secondary mark.
 *
 * True Zero declares the mark mandatory, so it is always drawn there when one exists,
 * regardless of the per option toggles.
 */
export function shouldDrawOptionalLogo(option: PdpShotOption, logos: PdpLogos): boolean {
  if (!logos.optionalLogo) return false;
  if (option.requiresOptionalLogo) return true;
  return logos.optionalEnabledFor.includes(option.id);
}

/** Human readable placement, used in the brand mark clause. */
export function placementLabel(position: OverlayPosition): string {
  return position.replace(/-/g, " ").replace("center", "centre");
}

/** Assembled once per generation and appended after the shot's composition brief. */
export function buildPdpGlobalDirectives(opts: {
  includeHuman: boolean;
  includeText: boolean;
  referenceLabels: string[];
  /** Side tags of the forwarded product photographs, in the same order. */
  referenceSides?: (FootwearSide | undefined)[];
  brandPlacementLabel?: string;
  brandScale?: number;
  optionalMarkPurpose?: string;
  optionalMarkCaption?: string;
}): string {
  const blocks = [
    buildPdpReferenceManifest(opts.referenceLabels),
    buildPdpSideLabelClause(opts.referenceSides ?? []),
    PDP_PRODUCT_IDENTITY_LOCK,
    opts.includeHuman ? PDP_CAST_IDENTITY_LOCK : "",
    opts.includeHuman ? PDP_HUMAN_REALISM : "",
    opts.includeText ? PDP_TEXT_RULES : "",
    buildPdpMarkDirective({
      brandPlacementLabel: opts.brandPlacementLabel,
      brandScale: opts.brandScale,
      optionalMarkPurpose: opts.optionalMarkPurpose,
      optionalMarkCaption: opts.optionalMarkCaption,
    }),
  ];
  return blocks.filter(Boolean).join("\n\n");
}

/**
 * Strip em dashes and en dashes from copy the operator supplies, before it reaches the
 * prompt. The model reliably echoes punctuation it is shown, so the ban is enforced at
 * the input boundary as well as being stated as a rule.
 */
export function stripDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ");
}
