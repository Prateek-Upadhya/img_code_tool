import type { PdpBackground, PdpStyle } from "./types";

/**
 * Artistic styles for the PDP Set mode.
 *
 * Each style is a complete design grammar rather than a scene: any image type can be
 * built in any of the three. They differ along four axes that actually transfer between
 * subjects, and are deliberately silent about everything else so they can host a hero
 * shot, a size chart or a construction diagram equally well.
 *
 * The resolved block is a MODIFIER LAYER. It is injected LATE in prompt assembly, after
 * the shot's own composition brief, so it conditions that brief rather than competing
 * with it. A background of "outdoor" under the ORBIT style does not produce an outdoor
 * ORBIT image, because ORBIT is placeless by definition; it produces the tint field and
 * the background choice is dropped. See {@link resolveBackgroundClause}.
 *
 * Style text avoids em dashes throughout. The image model tends to echo punctuation it
 * sees in the prompt into the on-image copy, and em dashes are banned in generated
 * callout text (see `pdp-directives.ts`).
 */

export interface PdpStyleGrammar {
  name: string;
  premise: string;
  world: string;
  light: string;
  subject: string;
  information: string;
  hierarchy: string;
  secondaryMark: string;
  register: string;
  signature: string;
  /**
   * Typographic personality for this style, plus a pool of concrete pairings.
   *
   * Typography is one of the four axes that make these styles genuinely distinct, so it
   * belongs to the style rather than to a global rule. `voice` describes the intent;
   * `pairings` gives real named faces so the model has something specific to render
   * instead of inventing a generic sans.
   *
   * One pairing is chosen per BATCH, not per image, so a set shares one typographic
   * identity while different runs look different. See `buildPdpStyleBlock`.
   */
  typography: {
    voice: string;
    pairings: string[];
  };
}

export const PDP_STYLE_GRAMMARS: Record<PdpStyle, PdpStyleGrammar> = {
  orbit: {
    name: "ORBIT",
    premise: "Information orbits a floating subject in a placeless field.",
    world:
      "Abstract and non literal. One tint across the whole field, no location, no story, no horizon line. A field rather than a place. State the exact field colour as a concrete hex value.",
    light:
      "Even and ambient, with a soft radial lift directly behind the subject. Light describes form and does nothing else. No visible lamps, windows or environmental light sources.",
    subject:
      "The footwear floats free with no ground contact, arranged along a single clean diagonal. Deep offset shadows sit well below the product to imply suspension rather than resting.",
    information:
      "Detached. Callouts sit at the edges of the frame in uniform badges of identical shape and size, each reaching back to the product by a thin straight connector. Facts circle the object rather than touching it.",
    hierarchy:
      "Scale and isolation. The footwear is simply the biggest and sharpest thing in frame, and generous emptiness does the rest of the work.",
    secondaryMark:
      "A large architectural device built into the layout, anchoring one edge of the composition as a structural block of flat colour.",
    register: "Calm, premium, catalogue. Timeless rather than current. The image reads as a specification.",
    signature:
      "Uniform badges at the corners, thin connectors returning to the centre, a flat architectural device anchoring the base edge.",
    typography: {
      voice:
        "Precise and specification like. Type behaves as instrumentation: even, disciplined, engineered. Labels sit in small caps with open letter spacing; figures and measurements are set in a face with tabular, evenly spaced numerals so columns align optically. Nothing is decorative, everything is exact.",
      pairings: [
        "a wide geometric grotesque for the display level, paired with a neutral neo grotesque for labels, and a technical monospaced face reserved for any figures or measurements",
        "an extended engineered sans for the display level, paired with a compact humanist sans for labels, with numerals set in a tabular monospaced face",
        "a precise Swiss neo grotesque used across display and labels at clearly separated weights, with a squared technical mono for figures",
      ],
    },
  },
  scene: {
    name: "SCENE",
    premise: "A real place sets the mood, and evidence replaces illustration.",
    world:
      "Literal and photographic, and genuinely furnished. A specific real place that implies a specific use, built up with real depth: a foreground element the camera looks past, a considered middle ground where the product sits, and a periphery with texture, props and life belonging to that place. Aim for the richness of a styled editorial set rather than an empty backdrop. The one rule that holds against all of it is a protected clean zone around the product itself, where nothing competes. Rich and layered, never cluttered: every element must be there for a reason, and elegance comes from what is arranged rather than from what is absent.",
    light:
      "Environmental and directional, belonging to the location itself. The light carries a time of day and a weather condition, so it carries the mood. Name the light direction and reuse it for every shadow in frame.",
    subject:
      "The footwear sits or floats within the real scene, always inside the protected clean zone, so the environment frames it and never fights it.",
    information:
      "Mixed register, deliberately alternating. Some callouts SHOW, using a real magnified photographic crop of the product itself. Others TELL, using a small icon. Adjacent callouts never share the same form.",
    hierarchy:
      "Contrast between a richly furnished periphery and a clean centre. The environment is allowed to be full and detailed precisely because the centre stays protected; that tension is the style. The product remains the brightest and sharpest thing in frame, and depth of field separates it from everything around it.",
    secondaryMark: "Small and incidental, like a stamp pressed onto the page. Present but never announced.",
    register: "Editorial lifestyle. Aspirational, warm and current. The image reads as a magazine feature.",
    signature:
      "Photographic macro previews used as callouts, a clean centre inside a textured world, a small corner seal.",
    typography: {
      voice:
        "Editorial and magazine led. This is the style where type carries the most personality. A high contrast display face sets the headline at genuine masthead scale, often mixing two weights or two colours across its lines, and a quieter text face carries everything else. Labels may take small caps with generous tracking. The pairing should feel art directed, like a printed feature spread.",
      pairings: [
        "a high contrast fashion serif for the headline set large, paired with a clean humanist sans for supporting copy and labels",
        "a condensed editorial grotesque for the headline in heavy weight, paired with an old style serif for supporting copy, giving the spread a magazine feel",
        "an elegant transitional serif with pronounced thick and thin strokes for the headline, paired with a geometric sans in light weight for labels",
        "a bold contemporary display sans for the headline, paired with a warm humanist serif for supporting copy so the two genuinely contrast",
      ],
    },
  },
  atelier: {
    name: "ATELIER",
    premise: "Light stages the subject, and information is physically attached to it.",
    world:
      "Architectural and graphic. A plain crafted surface used as a stage, valued for its material and texture rather than for being anywhere in particular. Name the material and state its colour as a concrete hex value.",
    light:
      "Shaped and directional, a hard edged zone of illumination acting as a built in spotlight. Light does the hierarchy work, so the beam edge must be crisp and deliberate.",
    subject:
      "An ordered sequence with progressive transformation. Each element is turned or offset a little further than the one before it, so the set reads as a system rather than as a group.",
    information:
      "Attached, never floating. Labels clip physically onto the thing they name and sit in its plane, following its perspective. There are NO connectors and NO leader lines anywhere, because none are needed.",
    hierarchy:
      "Illumination. What matters is lit and what supports it sits in shade. Scale is secondary to light.",
    secondaryMark: "Hangs off the structure as a physical object, like a tag left on a finished product.",
    register: "Crafted, tactile, boutique. The image reads as a maker's presentation.",
    signature:
      "A shaped light zone, a progressive sequence, tabs clipped to edges, a connecting spine ending in a hanging tag.",
    typography: {
      voice:
        "Crafted and tactile, as though letterpressed onto the surface it sits on. Type has visible character and a maker's hand: real serifs, generous small caps, unhurried spacing. Labels on the clipped tabs read like stamped or embossed marks rather than printed captions.",
      pairings: [
        "an old style humanist serif for the display level, paired with a small caps grotesque for the clipped tab labels",
        "a characterful slab serif for the display level, paired with a quiet humanist sans for supporting copy, with tab labels in spaced small caps",
        "a letterpress inspired transitional serif across display and copy at clearly separated weights, with tab labels in an engraved style small caps",
      ],
    },
  },
};

/**
 * Rules that hold in all three styles. These are constants, not knobs.
 *
 * The brief's two mark rules, composited from file and reproduced never typeset, are
 * enforced in `pdp-directives.ts` as a shape lock on marks the generator renders from
 * their reference files, rather than being restated here.
 */
export const PDP_STYLE_CONSTANTS = `SHARED RULES (these hold in every style):
- Tune the background against the product. If the footwear is pale, separate it from the ground by VALUE. If it is saturated, separate it by HUE. Identify every major colour region of the footwear first, the upper, the sole, the straps, the trims, and choose a ground that separates all of them at once.
- The footwear MUST be the brightest and sharpest thing in frame.
- Do not invent a headline unless the composition brief above explicitly asks for one.
- Every label must remain legible at one hundred percent zoom. Where a layout carries several labels, hold that legibility by spacing them further apart and giving the frame more margin, not by shrinking the type.
- Define ONE light source and reuse its direction for the product lighting, every contact shadow, and any gradient in the background, so the whole frame stays physically consistent.`;

/**
 * How the operator's background choice is folded into each style.
 *
 * ORBIT returns null: it is placeless by definition, so honouring "outdoor" there would
 * produce a self contradictory prompt. Dropping the choice is the intended behaviour and
 * the UI says so rather than silently disabling the control.
 */
export function resolveBackgroundClause(style: PdpStyle, background: PdpBackground): string | null {
  if (style === "orbit") return null;

  if (style === "scene") {
    switch (background) {
      case "outdoor":
        return "SETTING: a real outdoor location chosen to suit this footwear's use case and character. Natural daylight belonging to that place. Keep the centre of the frame clear so the product never competes with the environment.";
      case "indoor-funky":
        return "SETTING: a real interior space, bright and playful, with a small number of tasteful elements floating in the air around the footwear. The floating elements must feel calm and attractive rather than chaotic, and must never crowd the product or obscure any part of it.";
      default:
        return "SETTING: infer a specific real place from the product itself, its design, its materials and the supplied product information. Choose somewhere this footwear would plausibly and attractively be used.";
    }
  }

  // ATELIER reads the choice as a material and surface cue rather than as a place.
  switch (background) {
    case "outdoor":
      return "STAGE SURFACE: a crafted surface that has plainly lived outdoors, weathered stone, sun bleached timber or oxidised metal, lit as a studio stage rather than shown as a location.";
    case "indoor-funky":
      return "STAGE SURFACE: a bright crafted surface in a saturated tone, with a small number of playful solid shapes or props arranged as part of the staging.";
    default:
      return "STAGE SURFACE: a crafted surface whose material echoes the footwear's own materials, chosen from the product images and the supplied product information.";
  }
}

/**
 * Prohibition emitted in place of the INFORMATION axis for a text-free image.
 *
 * Each style's grammar describes how callouts behave, because most images in a PDP set
 * carry them. Injecting that grammar unconditionally meant the style layer reintroduced
 * callouts onto shots whose own brief had excluded them, which is exactly what went wrong
 * with the on-model photography: the brief said "no text of any kind" and the style
 * quietly overruled it. So for a text-free image the axis is not merely omitted, it is
 * inverted.
 */
const PDP_NO_INFORMATION_CLAUSE = `INFORMATION: none. This image is pure photography and carries NO information graphics whatsoever.
Render NO callouts, NO badges, NO chips, NO pills, NO connectors, NO leader lines, NO pointers, NO arrows, NO icons, NO numbered markers, NO magnified inset circles, NO labels, NO captions and NO text of any kind anywhere in the frame.
The signature elements of this style that exist to carry information are SUSPENDED for this image. Express the style through space, light, subject treatment, palette and mood alone.`;

/**
 * Build the frozen art direction block.
 *
 * Resolved ONCE per batch and quoted verbatim into every generation, so the whole set
 * shares one direction. These models expose no seed, so a single reused block is the
 * only mechanism that keeps a set coherent across many independent calls.
 *
 * `bearsText` decides whether the style's information grammar applies at all. See
 * {@link PDP_NO_INFORMATION_CLAUSE}.
 */
export function buildPdpStyleBlock(
  style: PdpStyle,
  background: PdpBackground,
  bearsText: boolean = true,
  /**
   * Selects the typographic pairing from the style's pool.
   *
   * Chosen ONCE PER PRODUCT, not per image, so every image of one product shares a
   * typographic identity while different products in a catalogue differ. When a product
   * has a story the pre-pass picks the pairing that suits it; without one the index falls
   * back to a per-run value. Wraps, so any integer is valid.
   */
  typographyIndex: number = 0,
  /**
   * True when this option carries a human model and a product story is in play.
   *
   * A lifestyle image with no world is not a lifestyle image, so on those shots the story
   * is allowed to place the scene even under a style that is otherwise placeless. Left
   * false everywhere else, which keeps staged product shots and table-driven infographics
   * exactly as they were.
   */
  storySetsScene: boolean = false
): string {
  const g = PDP_STYLE_GRAMMARS[style];
  const bg = resolveBackgroundClause(style, background);
  const pairing = g.typography.pairings[Math.abs(typographyIndex) % g.typography.pairings.length];

  return `═══ ARTISTIC STYLE: ${g.name} ═══
This is a MODIFIER LAYER applied ON TOP of the composition brief above. It does not replace that brief and it does not change what the image contains. It decides HOW everything above is rendered: the quality of the space, the behaviour of light, ${bearsText ? "the way information attaches, " : ""}the palette and the typographic feel. Where the brief and this layer both speak to something, the brief decides WHAT and this layer decides HOW.

PREMISE: ${g.premise}
WORLD: ${g.world}
LIGHT: ${g.light}
SUBJECT TREATMENT: ${g.subject}
${bearsText ? `INFORMATION: ${g.information}` : PDP_NO_INFORMATION_CLAUSE}
HIERARCHY: ${g.hierarchy}
${bearsText ? `SECONDARY MARK TREATMENT: ${g.secondaryMark}\n` : ""}${bearsText ? `TYPOGRAPHIC VOICE: ${g.typography.voice}\nTYPEFACES FOR THIS SET: ${pairing}. Use this same pairing consistently across the whole image.\n` : ""}REGISTER: ${g.register}
SIGNATURE ELEMENTS: ${bearsText ? g.signature : "expressed only through space, light and subject treatment, since this image carries no information graphics."}
${bg
      ? `\n${bg}${storySetsScene ? `\nSETTING TAKES PRECEDENCE FROM THE STORY: this image carries a human model and the product story decides where it happens. Where the story implies a location, build that location instead of the background described immediately above. Everything else in this style layer, its light, its palette, its texture and its typographic feel, still governs how that location is rendered.` : ""}`
      : storySetsScene
      ? `\nSETTING: this style is placeless by default, but this image carries a human model and a product story, and a person standing in an empty tint field is not a lifestyle image. Build the world the story implies. Hold everything else this style asks for: the same quality of light, the same restraint, the same palette discipline and the same treatment of the subject. The result should read as this style visiting a real place, NOT as a different style.`
      : `\nSETTING: none. This style is placeless by definition. Render no location, no horizon, no environment and no props. Any background preference stated elsewhere MUST be ignored in favour of the single tint field described above.`}

${PDP_STYLE_CONSTANTS}`;
}

/** Short human readable summary for the review panel on the generate step. */
export function describePdpStyle(style: PdpStyle, background: PdpBackground): string {
  const g = PDP_STYLE_GRAMMARS[style];
  const bg = resolveBackgroundClause(style, background);
  return bg ? `${g.name} · ${g.premise}` : `${g.name} · placeless, background choice not applied`;
}
