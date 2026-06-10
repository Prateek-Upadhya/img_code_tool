import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { DYNAMIC_POSE_SEED_POOLS } from "./constants"
import type { PoseFraming, PropBucket } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Pick one random element from a non-empty readonly array. */
export function pickOne<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Framings where the model's HEAD/FACE is in frame, so gaze + head-tilt cues are
 * meaningful. Lower-body crops (hip-down, knee-down, cropped-shot, waist-to-thigh)
 * are absent — their head is cropped out, so seeding a gaze/head cue would be
 * wasted (or actively misleading) text.
 */
const DYNAMIC_FRAMINGS_WITH_FACE: ReadonlySet<PoseFraming> = new Set<PoseFraming>([
  "full-body",
  "three-quarter",
  "mid-thigh",
  "waist-up",
  "bust-up",
])

/**
 * Framings where enough of the LEGS / lower body is in frame for leg + foot
 * placement and stance width to read. `waist-up` and `bust-up` are absent (no
 * legs in frame), so a leg cue there would describe something the viewer can't
 * see.
 */
const DYNAMIC_FRAMINGS_WITH_LEGS: ReadonlySet<PoseFraming> = new Set<PoseFraming>([
  "full-body",
  "three-quarter",
  "mid-thigh",
  "hip-down",
  "knee-down",
  "cropped-shot",
  "waist-to-thigh",
])

/**
 * Composes a FRESH, single-line VARIATION SEED string for one Dynamic-pose
 * generation by sampling one phrase from each relevant pool in
 * {@link DYNAMIC_POSE_SEED_POOLS}.
 *
 * Call this ONCE per generation / per retry (it uses `Math.random`, so every
 * call re-randomises) and pass the result as `dynamicSeed` into
 * `generateVTONPrompt`. The meta-prompter translates each cue into vivid
 * body-language prose while the `DYNAMIC_POSE_DIRECTIVE` keeps the orientation
 * and framing locked.
 *
 * FRAMING-AWARE: the cues are tailored to what is actually visible in the crop.
 * `opts.framing` gates the gaze/head cues (kept only when the face is in frame)
 * and the leg cue (kept only when the legs are in frame). For a lower-body crop
 * the seed therefore varies weight / stance / leg-placement WITHOUT inventing a
 * gaze or head angle for a head that isn't shown; for a waist-up crop it varies
 * the upper body without a leg cue. When `framing` is omitted every pool is
 * sampled (back-compatible behaviour).
 *
 * POSTURE-ONLY: this seed never references a prop or accessory. Prop-driven
 * posture variation is sampled separately ({@link buildPropInteractionCue}) by
 * the PROP directive in gemini.ts, and only when the user actually supplied a
 * prop — so a no-prop Dynamic pose can never hallucinate an accessory.
 *
 * @example
 * buildDynamicPoseSeed({ framing: "cropped-shot" })
 * // → "VARIATION SEED → weight: weight on the camera-side leg…; arms: one hand
 * //    slipped into a pocket…; legs: feet hip-width apart…; energy: confident…"
 */
export function buildDynamicPoseSeed(opts?: { framing?: PoseFraming }): string {
  const framing = opts?.framing
  const showFace = !framing || DYNAMIC_FRAMINGS_WITH_FACE.has(framing)
  const showLegs = !framing || DYNAMIC_FRAMINGS_WITH_LEGS.has(framing)

  const parts: string[] = [`weight: ${pickOne(DYNAMIC_POSE_SEED_POOLS.weightShift)}`]
  if (showFace) {
    parts.push(`gaze: ${pickOne(DYNAMIC_POSE_SEED_POOLS.gaze)}`)
    parts.push(`head: ${pickOne(DYNAMIC_POSE_SEED_POOLS.headTilt)}`)
  }
  parts.push(`arms: ${pickOne(DYNAMIC_POSE_SEED_POOLS.armAction)}`)
  if (showLegs) {
    parts.push(`legs: ${pickOne(DYNAMIC_POSE_SEED_POOLS.legAction)}`)
  }
  parts.push(`energy: ${pickOne(DYNAMIC_POSE_SEED_POOLS.energy)}`)
  return `VARIATION SEED → ${parts.join("; ")}`
}

/**
 * Samples ONE object-agnostic prop-interaction posture cue for a Dynamic pose
 * that has a real prop in play. Kept separate from {@link buildDynamicPoseSeed}
 * so prop-driven posture variation lives exclusively with the prop snippet and
 * never leaks into a no-prop generation. Returns a bare phrase (no label).
 */
export function buildPropInteractionCue(): string {
  return pickOne(DYNAMIC_POSE_SEED_POOLS.propInteraction)
}

/**
 * Draws ONE image uniformly at random from a {@link PropBucket}, or returns
 * `null` when the bucket holds no images.
 *
 * Uses `Math.random` (this only ever runs in the browser at generation time, so
 * cryptographic randomness is unnecessary). Callers are expected to CACHE the
 * result per product so the same draw is reused across all of that product's
 * poses (see `materializeAccessories` / the `bucketPickCacheRef` in
 * `step-generate.tsx`); calling this repeatedly re-randomises every time.
 */
export function pickBucketImage(
  bucket: PropBucket
): { file: File; preview: string } | null {
  if (bucket.images.length === 0) return null
  return pickOne(bucket.images)
}
