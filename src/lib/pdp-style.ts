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
  },
  scene: {
    name: "SCENE",
    premise: "A real place sets the mood, and evidence replaces illustration.",
    world:
      "Literal and photographic. A specific real place that implies a specific use, carrying a deliberately protected clean zone at its centre where nothing competes with the product.",
    light:
      "Environmental and directional, belonging to the location itself. The light carries a time of day and a weather condition, so it carries the mood. Name the light direction and reuse it for every shadow in frame.",
    subject:
      "The footwear sits or floats within the real scene, always inside the protected clean zone, so the environment frames it and never fights it.",
    information:
      "Mixed register, deliberately alternating. Some callouts SHOW, using a real magnified photographic crop of the product itself. Others TELL, using a small icon. Adjacent callouts never share the same form.",
    hierarchy:
      "Contrast between a busy periphery and a clean centre. The environment surrounds and frames rather than competing.",
    secondaryMark: "Small and incidental, like a stamp pressed onto the page. Present but never announced.",
    register: "Editorial lifestyle. Aspirational, warm and current. The image reads as a magazine feature.",
    signature:
      "Photographic macro previews used as callouts, a clean centre inside a textured world, a small corner seal.",
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
  },
};

/**
 * Rules that hold in all three styles. These are constants, not knobs.
 *
 * The two brand mark rules from the style brief are deliberately absent here: marks are
 * composited from file after generation (see `pdp-logo-composite.ts`), so instead of
 * asking the model to reproduce them faithfully, the prompt asks it not to draw them at
 * all and to reserve clean space instead. That is enforced in `pdp-directives.ts`.
 */
export const PDP_STYLE_CONSTANTS = `SHARED RULES (these hold in every style):
- Tune the background against the product. If the footwear is pale, separate it from the ground by VALUE. If it is saturated, separate it by HUE. Identify every major colour region of the footwear first, the upper, the sole, the straps, the trims, and choose a ground that separates all of them at once.
- The footwear MUST be the brightest and sharpest thing in frame.
- Do not invent a headline unless the composition brief above explicitly asks for one.
- Every label must remain legible at one hundred percent zoom. Prefer fewer, larger labels over many small ones.
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
 * Build the frozen art direction block.
 *
 * Resolved ONCE per batch and quoted verbatim into every generation, so the whole set
 * shares one direction. These models expose no seed, so a single reused block is the
 * only mechanism that keeps a set coherent across many independent calls.
 */
export function buildPdpStyleBlock(style: PdpStyle, background: PdpBackground): string {
  const g = PDP_STYLE_GRAMMARS[style];
  const bg = resolveBackgroundClause(style, background);

  return `═══ ARTISTIC STYLE: ${g.name} ═══
This is a MODIFIER LAYER applied ON TOP of the composition brief above. It does not replace that brief and it does not change what the image contains. It decides HOW everything above is rendered: the quality of the space, the behaviour of light, the way information attaches, the palette and the typographic feel. Where the brief and this layer both speak to something, the brief decides WHAT and this layer decides HOW.

PREMISE: ${g.premise}
WORLD: ${g.world}
LIGHT: ${g.light}
SUBJECT TREATMENT: ${g.subject}
INFORMATION: ${g.information}
HIERARCHY: ${g.hierarchy}
SECONDARY MARK TREATMENT: ${g.secondaryMark}
REGISTER: ${g.register}
SIGNATURE ELEMENTS: ${g.signature}
${bg ? `\n${bg}` : `\nSETTING: none. This style is placeless by definition. Render no location, no horizon, no environment and no props. Any background preference stated elsewhere MUST be ignored in favour of the single tint field described above.`}

${PDP_STYLE_CONSTANTS}`;
}

/** Short human readable summary for the review panel on the generate step. */
export function describePdpStyle(style: PdpStyle, background: PdpBackground): string {
  const g = PDP_STYLE_GRAMMARS[style];
  const bg = resolveBackgroundClause(style, background);
  return bg ? `${g.name} · ${g.premise}` : `${g.name} · placeless, background choice not applied`;
}
