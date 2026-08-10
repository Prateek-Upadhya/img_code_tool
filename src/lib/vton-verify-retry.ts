/**
 * VTON verify-and-repair loop.
 *
 * Grades a generated image, and while it falls short of the pass mark, feeds the
 * inspector's specific findings back into a correction attempt — up to
 * `VTON_MAX_ATTEMPTS` renders in total, keeping whichever scored highest.
 *
 * Two repair strategies, chosen by how bad the score is:
 *   >= VTON_SURGICAL_RETRY_FLOOR  the composition is fundamentally right, so a
 *                                 surgical multi-turn edit fixes the named defect
 *                                 and preserves everything already working.
 *   <  VTON_SURGICAL_RETRY_FLOOR  the render is off in ways an edit cannot
 *                                 recover, so re-roll from a corrected prompt.
 *
 * The correction text combines the judge's image-specific finding (what was
 * expected, what came back) with a hand-written per-dimension directive from
 * `VTON_CORRECTION_PLAYBOOK`. Neither alone suffices: the playbook is generic,
 * and the judge's phrasing varies between calls.
 */

import {
  VTON_CORRECTION_PLAYBOOK,
  VTON_DIMENSION_LABELS,
  VTON_MAX_ATTEMPTS,
  VTON_SCORE_PASS_THRESHOLD,
  VTON_SURGICAL_RETRY_FLOOR,
} from "./gemini";
import type {
  EditHistoryEntry,
  StepCost,
  VtonAttemptRecord,
  VtonDefect,
  VtonScoreOutcome,
} from "./types";

/** Everything one render attempt produced, enough to judge it and to build on it. */
export interface AttemptProduct {
  imageData: string;
  prompt: string;
  /** Gemini response Content — required to replay multi-turn context on a surgical edit. */
  imageGenResponseContent: unknown;
  editHistory: EditHistoryEntry[];
  /** This attempt's own cost rows (prompt + image). */
  steps: StepCost[];
}

export interface VtonRepairHooks {
  resultId: string;
  /** Patch the store record (updateResult / updateBulkResult). */
  update: (patch: Record<string, unknown>) => void;
  judge: (imageData: string, attempt: number) => Promise<VtonScoreOutcome>;
  /** Full re-roll: fresh prompt carrying the correction report, then a fresh image. */
  reroll: (feedback: string) => Promise<AttemptProduct>;
  /**
   * Surgical multi-turn edit of an existing image. Null when unavailable — the
   * gpt-image-2 backend returns a REST blob rather than replayable Gemini
   * multi-turn content, so those results always re-roll.
   */
  surgical: ((changeRequest: string, from: AttemptProduct) => Promise<AttemptProduct>) | null;
  signal: AbortSignal;
}

interface AttemptState {
  product: AttemptProduct;
  record: VtonAttemptRecord;
  /** Defect set for this attempt, empty when the judge failed. */
  defects: VtonDefect[];
}

/**
 * Run the loop to completion. Never throws: every exit path finalizes the result
 * with the best image it has, because a graded-but-imperfect image is still
 * worth more to the user than an error card.
 */
export async function runVerifyAndRepair(
  first: AttemptProduct,
  h: VtonRepairHooks,
): Promise<void> {
  const attempts: AttemptState[] = [];
  let current = first;
  let currentStrategy: VtonAttemptRecord["strategy"] = "initial";
  let lastCorrectionSent: string | undefined;

  for (let attempt = 1; attempt <= VTON_MAX_ATTEMPTS; attempt++) {
    if (h.signal.aborted) return finalize(attempts, h, lastCorrectionSent, true);

    h.update({
      validationStatus: attempts.length === 0 ? "validating" : "retrying",
      validationAttempt: attempt,
    });

    const verdict = await h.judge(current.imageData, attempt);
    if (verdict.cost) current.steps.push(verdict.cost);

    if (h.signal.aborted) {
      pushAttempt(attempts, current, currentStrategy, attempt, verdict);
      return finalize(attempts, h, lastCorrectionSent, true);
    }

    pushAttempt(attempts, current, currentStrategy, attempt, verdict);

    // The judge itself failed. Do NOT spend two more image generations chasing an
    // unknown score — keep the image and mark verification inconclusive.
    if (!verdict.ok) {
      return finalizeJudgeError(attempts, h, verdict.error, lastCorrectionSent);
    }

    if (verdict.score >= VTON_SCORE_PASS_THRESHOLD) {
      return finalize(attempts, h, lastCorrectionSent, false);
    }

    if (attempt === VTON_MAX_ATTEMPTS) {
      return finalize(attempts, h, lastCorrectionSent, false);
    }

    // ── Repair. The result's own `status` stays "completed" so the card keeps
    //    showing the current image while the next attempt runs.
    const records = attempts.map((a) => a.record);
    const useSurgical = verdict.score >= VTON_SURGICAL_RETRY_FLOOR && h.surgical !== null;
    const correction = useSurgical ? buildSurgicalRequest(records) : buildScoreFeedback(records);
    lastCorrectionSent = correction;

    h.update({
      validationStatus: "retrying",
      validationScore: verdict.score,
      validationAttempt: attempt + 1,
      validationDefects: verdict.defects,
      validationAttempts: records,
      validationCorrectionSent: correction,
      validationMessage: verdict.summary,
    });

    try {
      const next = useSurgical
        ? await h.surgical!(correction, current)
        : await h.reroll(correction);
      // The attempt we just moved off becomes a discard candidate; `finalize`
      // decides which one is actually kept.
      currentStrategy = useSurgical ? "surgical" : "reroll";
      current = next;
    } catch {
      // A failed repair does not consume another attempt and does not error the
      // card — we already have a scored image worth keeping.
      return finalize(attempts, h, lastCorrectionSent, false);
    }
  }

  finalize(attempts, h, lastCorrectionSent, false);
}

function pushAttempt(
  attempts: AttemptState[],
  product: AttemptProduct,
  strategy: VtonAttemptRecord["strategy"],
  attempt: number,
  verdict: VtonScoreOutcome,
): void {
  attempts.push({
    product,
    defects: verdict.ok ? verdict.defects : [],
    record: {
      attempt,
      strategy,
      score: verdict.ok ? verdict.score : null,
      summary: verdict.ok ? verdict.summary : `Inspection failed: ${verdict.error}`,
      defects: verdict.ok ? verdict.defects : [],
    },
  });
}

/** Highest score wins; a judge failure (null) never beats a real score. */
function bestIndex(attempts: AttemptState[]): number {
  let best = 0;
  for (let i = 1; i < attempts.length; i++) {
    const a = attempts[i].record.score;
    const b = attempts[best].record.score;
    if (a === null) continue;
    if (b === null || a > b) best = i;
  }
  return best;
}

function rollUpCosts(attempts: AttemptState[], keptIdx: number) {
  const kept = attempts[keptIdx].product.steps;
  const retrySteps = attempts.filter((_, i) => i !== keptIdx).flatMap((a) => a.product.steps);
  const totalCost =
    kept.reduce((s, c) => s + c.totalCost, 0) + retrySteps.reduce((s, c) => s + c.totalCost, 0);
  return {
    costBreakdown: {
      steps: [...kept],
      totalCost,
      retrySteps: retrySteps.length > 0 ? retrySteps : undefined,
    },
  };
}

function finalize(
  attempts: AttemptState[],
  h: VtonRepairHooks,
  correctionSent: string | undefined,
  aborted: boolean,
): void {
  if (attempts.length === 0) {
    h.update({
      validationStatus: "skipped",
      validationMessage: "Verification cancelled",
      validationAttempt: undefined,
    });
    return;
  }

  const keptIdx = bestIndex(attempts);
  const kept = attempts[keptIdx];
  const score = kept.record.score;
  const records = attempts.map((a) => a.record);

  const passed = score !== null && score >= VTON_SCORE_PASS_THRESHOLD;
  const suffix = aborted ? " (verification stopped)" : "";
  const prefix = !passed && attempts.length > 1 ? `Best of ${attempts.length} attempts. ` : "";

  h.update({
    // Restore the kept attempt's artefacts so a later manual multi-turn edit
    // replays a context that actually matches the image on screen.
    imageData: kept.product.imageData,
    prompt: kept.product.prompt,
    imageGenResponseContent: kept.product.imageGenResponseContent,
    editHistory: kept.product.editHistory,
    validationStatus: score === null ? "error" : passed ? "passed" : "warning",
    validationScore: score ?? undefined,
    validationMessage: prefix + kept.record.summary + suffix,
    validationDefects: kept.defects,
    validationAttempts: records,
    validationAttempt: undefined,
    validationCorrectionSent: correctionSent,
    ...rollUpCosts(attempts, keptIdx),
  });
}

function finalizeJudgeError(
  attempts: AttemptState[],
  h: VtonRepairHooks,
  error: string,
  correctionSent: string | undefined,
): void {
  // Prefer any earlier attempt that DID score; only fall back to the ungraded one.
  const graded = attempts.filter((a) => a.record.score !== null);
  if (graded.length > 0) {
    finalize(attempts, h, correctionSent, false);
    return;
  }
  const keptIdx = attempts.length - 1;
  h.update({
    validationStatus: "error",
    validationMessage: `Quality inspection could not be completed: ${error}`,
    validationAttempts: attempts.map((a) => a.record),
    validationAttempt: undefined,
    ...rollUpCosts(attempts, keptIdx),
  });
}

// ═══════════════════════════════════════════════════════════════
//  Feedback builders — defect records -> model-facing correction
// ═══════════════════════════════════════════════════════════════

function describeDefect(d: VtonDefect, includeDirective: boolean): string {
  const label = VTON_DIMENSION_LABELS[d.dimension];
  const lines = [`  · ${label} (${d.dimension}) — scored ${d.score}/100, severity ${d.severity}.`];
  if (d.expected) lines.push(`    Expected: ${d.expected}`);
  if (d.observed) lines.push(`    Observed: ${d.observed}`);
  if (d.region) lines.push(`    Where: ${d.region}`);
  if (d.fix) lines.push(`    Required fix: ${d.fix}`);
  if (includeDirective) lines.push(`    Directive: ${VTON_CORRECTION_PLAYBOOK[d.dimension]}`);
  return lines.join("\n");
}

function failing(record: VtonAttemptRecord): VtonDefect[] {
  return record.defects
    .filter((d) => d.applicable && d.score < VTON_SCORE_PASS_THRESHOLD)
    .sort((a, b) => a.score - b.score);
}

function passing(record: VtonAttemptRecord): VtonDefect[] {
  return record.defects.filter((d) => d.applicable && d.score >= VTON_SCORE_PASS_THRESHOLD);
}

/**
 * Cumulative correction report for a full re-roll.
 *
 * Diffs the latest attempt against all prior ones so the prompt can say three
 * distinct things: what is STILL wrong after we already tried to fix it (worth
 * escalating), what the last correction BROKE that was previously fine, and what
 * must be HELD. Without the HOLD list a retry happily fixes the colour by
 * re-cropping the shot.
 */
export function buildScoreFeedback(records: VtonAttemptRecord[]): string {
  if (records.length === 0) return "";
  const latest = records[records.length - 1];
  const previous = records.length > 1 ? records[records.length - 2] : undefined;

  const history = records
    .map((r) => (r.score === null ? "n/a" : String(r.score)))
    .join(" → ");
  const head = `Attempt ${records.length + 1} of ${VTON_MAX_ATTEMPTS}. Score history: ${history} (pass mark ${VTON_SCORE_PASS_THRESHOLD}).`;

  const prevScore = new Map(previous?.defects.map((d) => [d.dimension, d.score]) ?? []);
  const prevFailed = new Set(previous ? failing(previous).map((d) => d.dimension) : []);

  const nowFailing = failing(latest);
  const stillFailing = nowFailing.filter((d) => prevFailed.has(d.dimension));
  const newlyBroken = nowFailing.filter(
    (d) => !prevFailed.has(d.dimension) && prevScore.has(d.dimension),
  );
  const firstTime = nowFailing.filter(
    (d) => !prevFailed.has(d.dimension) && !prevScore.has(d.dimension),
  );

  const sections: string[] = [head];

  if (stillFailing.length > 0) {
    const body = stillFailing
      .map((d) => {
        const before = prevScore.get(d.dimension);
        const trend = before !== undefined ? ` (was ${before}, now ${d.score})` : "";
        return `${describeDefect(d, true)}\n    ESCALATE: this dimension has now failed more than once${trend}. Be markedly more explicit and more measurable than the previous attempt was.`;
      })
      .join("\n");
    sections.push(`STILL FAILING after correction:\n${body}`);
  }

  if (newlyBroken.length > 0) {
    const body = newlyBroken
      .map((d) => {
        const before = prevScore.get(d.dimension);
        const trend = before !== undefined ? ` (was ${before}, now ${d.score})` : "";
        return `${describeDefect(d, true)}\n    REGRESSION: the last correction broke this${trend}. Fix the original defect WITHOUT sacrificing this one.`;
      })
      .join("\n");
    sections.push(`NEWLY BROKEN by the last correction:\n${body}`);
  }

  if (firstTime.length > 0) {
    sections.push(
      `FAILING:\n${firstTime.map((d) => describeDefect(d, true)).join("\n")}`,
    );
  }

  const hold = passing(latest);
  if (hold.length > 0) {
    sections.push(
      `HOLD — already correct, carry through unchanged:\n  ${hold
        .map((d) => `${VTON_DIMENSION_LABELS[d.dimension]} (${d.score})`)
        .join(", ")}`,
    );
  }

  return sections.join("\n\n");
}

/**
 * Change request for the surgical multi-turn edit path. Deliberately narrower
 * than the re-roll report: `contextualRetryVTONImage`'s own instruction step
 * already wraps this in "change only what is named", so this needs to be a
 * precise defect list plus an explicit preservation clause.
 */
export function buildSurgicalRequest(records: VtonAttemptRecord[]): string {
  if (records.length === 0) return "";
  const latest = records[records.length - 1];
  const defects = failing(latest);
  if (defects.length === 0) return "";

  const numbered = defects
    .map((d, i) => {
      const bits = [`${i + 1}. ${VTON_DIMENSION_LABELS[d.dimension]} — ${d.fix || d.observed || "correct this defect"}`];
      if (d.expected) bits.push(`   Expected: ${d.expected}`);
      if (d.observed && d.fix) bits.push(`   Currently: ${d.observed}`);
      if (d.region) bits.push(`   Where: ${d.region}`);
      return bits.join("\n");
    })
    .join("\n");

  const score = latest.score ?? 0;
  const held = passing(latest)
    .map((d) => VTON_DIMENSION_LABELS[d.dimension].toLowerCase())
    .join(", ");

  return `Our quality-control inspector scored this render ${score}/100 against a pass mark of ${VTON_SCORE_PASS_THRESHOLD}.
Correct ONLY the defects listed below. Change nothing else about the image.

${numbered}

Everything not named above must stay pixel-identical: the model's identity and pose, the framing and crop, the background and every object in it, the lighting and shadows, and every part of the garment that is already correct.${held ? `\n\nThese are already correct and must not regress: ${held}.` : ""}`;
}
