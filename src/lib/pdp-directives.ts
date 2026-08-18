import type { PdpShotOption } from "./types";

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
 * Page level mark suppression.
 *
 * The brand wordmark and the optional secondary mark are composited from file after
 * generation, so the model must leave room rather than attempt them. This is the single
 * most reliable way to get an exact mark, and it matches the style brief's own rule that
 * marks are reproduced from file and never redrawn or typeset.
 *
 * The distinction against {@link PDP_PRODUCT_IDENTITY_LOCK} is critical and is restated
 * here: branding physically ON the shoe is part of the product and must be replicated;
 * branding ON THE PAGE is composited later and must not be drawn.
 */
export function buildPdpMarkReservation(opts: {
  brandPlacementLabel?: string;
  optionalPlacementLabel?: string;
}): string {
  const zones = [opts.brandPlacementLabel, opts.optionalPlacementLabel].filter(Boolean) as string[];
  if (zones.length === 0) {
    return `═══ PAGE LEVEL BRANDING ═══
NEVER draw a brand wordmark, a logo lockup, a company name, a corner seal or any page level graphic identity anywhere in this image.
Branding that is physically part of the footwear itself, printed, embossed or moulded into the product, is NOT page level branding and MUST still be replicated exactly as described in the product identity lock.`;
  }

  return `═══ PAGE LEVEL BRANDING ═══
Brand marks are added to this image AFTER generation by compositing the real logo files. Your job is to leave room for them, not to draw them.
Keep ${zones.join(" and ")} as a CLEAN, FLAT, UNCLUTTERED area: even in tone, free of product, text, callouts, texture detail and busy gradient, so a mark composited there will sit legibly.
NEVER draw a brand wordmark, a logo lockup, a company name, a corner seal or any page level graphic identity anywhere in this image.
Branding that is physically part of the footwear itself, printed, embossed or moulded into the product, is NOT page level branding and MUST still be replicated exactly as described in the product identity lock.`;
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
 * Cap on product reference images forwarded per generation.
 *
 * The API accepts far more, but structural accuracy degrades past roughly six references.
 * Product folders routinely hold more than this, so the generation path trims.
 */
export const PDP_MAX_PRODUCT_REFERENCES = 6;

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

/** Assembled once per generation and appended after the shot's composition brief. */
export function buildPdpGlobalDirectives(opts: {
  includeHuman: boolean;
  includeText: boolean;
  referenceLabels: string[];
  brandPlacementLabel?: string;
  optionalPlacementLabel?: string;
}): string {
  const blocks = [
    buildPdpReferenceManifest(opts.referenceLabels),
    PDP_PRODUCT_IDENTITY_LOCK,
    opts.includeHuman ? PDP_CAST_IDENTITY_LOCK : "",
    opts.includeHuman ? PDP_HUMAN_REALISM : "",
    opts.includeText ? PDP_TEXT_RULES : "",
    buildPdpMarkReservation({
      brandPlacementLabel: opts.brandPlacementLabel,
      optionalPlacementLabel: opts.optionalPlacementLabel,
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
