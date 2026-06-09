import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { DYNAMIC_POSE_SEED_POOLS } from "./constants"
import type { PropBucket } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Pick one random element from a non-empty readonly array. */
function pickOne<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)]
}

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
 * When `opts.hasProp` is true (a prop/accessory or complementary garment is in
 * play), a `prop-interaction` cue is appended so the invented posture naturally
 * shows the model handling one of those items.
 *
 * @example
 * buildDynamicPoseSeed({ hasProp: true })
 * // → "VARIATION SEED → weight: weight on the camera-side leg…; gaze: eyes locked
 * //    confidently on the lens; head: chin lifted a touch…; arms: one hand slipped
 * //    into a pocket…; legs: legs in an easy, slightly staggered stance; energy:
 * //    confident and grounded…; prop-interaction: holding the bag's strap over one shoulder…"
 */
export function buildDynamicPoseSeed(opts?: { hasProp?: boolean }): string {
  const parts = [
    `weight: ${pickOne(DYNAMIC_POSE_SEED_POOLS.weightShift)}`,
    `gaze: ${pickOne(DYNAMIC_POSE_SEED_POOLS.gaze)}`,
    `head: ${pickOne(DYNAMIC_POSE_SEED_POOLS.headTilt)}`,
    `arms: ${pickOne(DYNAMIC_POSE_SEED_POOLS.armAction)}`,
    `legs: ${pickOne(DYNAMIC_POSE_SEED_POOLS.legAction)}`,
    `energy: ${pickOne(DYNAMIC_POSE_SEED_POOLS.energy)}`,
  ]
  if (opts?.hasProp) {
    parts.push(`prop-interaction: ${pickOne(DYNAMIC_POSE_SEED_POOLS.propInteraction)}`)
  }
  return `VARIATION SEED → ${parts.join("; ")}`
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
