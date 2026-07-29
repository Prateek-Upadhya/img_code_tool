import type { CustomPose, CustomPoseShotKind } from "@/lib/types";

/**
 * Shot-kind accessors for {@link CustomPose}.
 *
 * `isModelShot` predates the Infographic shot kind and is still the storage for the
 * Model/Product choice, so it cannot answer "does this output contain a human model?"
 * on its own — for an infographic that answer comes from the analysis step, not the user.
 * Every semantic read should go through these helpers; only the Shot Type toggle itself
 * writes the raw fields.
 */

/** The pose's shot kind, defaulting legacy poses (no `shotKind`) from `isModelShot`. */
export function customPoseShotKind(pose: CustomPose): CustomPoseShotKind {
  return pose.shotKind ?? (pose.isModelShot ? "model" : "product");
}

export function customPoseIsInfographic(pose: CustomPose): boolean {
  return customPoseShotKind(pose) === "infographic";
}

/**
 * Whether this pose's output includes a human model — i.e. whether an AI model must be
 * configured and a model reference forwarded to the image generator.
 *
 * For infographics the decision belongs to the Step-1 analysis (`plan.includesModel`).
 * Before analysis has run there is no answer yet, so this returns `false`: that keeps the
 * "select an AI model" warnings from mis-firing on a pose that may well turn out to be
 * product-only. Generation is separately hard-gated on an approved plan, so an
 * un-analyzed infographic can never reach the image model on this default.
 */
export function customPoseNeedsModel(pose: CustomPose): boolean {
  if (customPoseIsInfographic(pose)) {
    return pose.infographic?.plan?.includesModel ?? false;
  }
  return pose.isModelShot;
}

/** Inverse of {@link customPoseNeedsModel} — the `isProductOnlyShot` flag used across generation. */
export function customPoseIsProductOnly(pose: CustomPose): boolean {
  return !customPoseNeedsModel(pose);
}

/**
 * True when this pose is ready to generate. Non-infographic poses are always ready;
 * an infographic needs a reference image and an approved analysis plan.
 */
export function customPoseIsReadyToGenerate(pose: CustomPose): boolean {
  if (!customPoseIsInfographic(pose)) return true;
  return (
    pose.referenceImages.length > 0 &&
    pose.infographic?.plan?.approved === true
  );
}

/** Human-readable label for the Shot Type, used in badges and warnings. */
export function customPoseShotKindLabel(pose: CustomPose): string {
  switch (customPoseShotKind(pose)) {
    case "infographic":
      return "Infographic";
    case "product":
      return "Product";
    default:
      return "Model";
  }
}
