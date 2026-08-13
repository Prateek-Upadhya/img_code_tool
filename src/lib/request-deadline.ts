/**
 * Per-request deadlines for the browser → `/api/*` proxy calls.
 *
 * WHY THIS EXISTS
 * ---------------
 * Nothing in this stack used to bound a request. The browser clients
 * (`gemini-client.ts`, `text-client.ts`) passed only the Stop button's
 * `AbortSignal`, and the server-side `GoogleGenAI` clients were constructed
 * without `httpOptions.timeout`. A VTON card writes its status BEFORE it calls
 * (`status: "generating-prompt"` / `"generating-image"` in `step-generate.tsx`)
 * and that status is cleared only by an explicit later write — the post-run
 * sweep deliberately rescues only `pending` / `validating` / `retrying`. So a
 * call that never settles pinned the badge on "Generating prompt…" or
 * "Generating image…" forever, and an image call additionally pinned one of the
 * `gemini-image-gate` slots for the life of the process.
 *
 * A deadline turns that silent hang into a thrown error, which drops straight
 * into the auto-retry-once-then-error branch the orchestrators already have.
 *
 * Deadlines are sized per call type rather than shared, because the three calls
 * have very different honest latencies: a meta-prompt with reference images, a
 * 2K/4K render, and a judge pass over one generated image plus its references.
 */

/**
 * Wall-clock budget per call type, in milliseconds.
 *
 * Set comfortably above normal latency but well under the 600s undici ceiling on
 * `/api/azure-text/generate`, so a wedged call is cut long before that route's
 * 3-attempt retry loop can stack multiple 10-minute waits behind one card.
 */
export const VTON_TIMEOUT_MS = {
  /** Meta-prompt generation (gemini-3.1-pro-preview). */
  prompt: 180_000,
  /** Image generation (gemini-3.1-flash-image). */
  image: 240_000,
  /** Quality inspection — `scoreVTONImage`, a Pro call over a generated image. */
  judge: 120_000,
  /**
   * Meta-prompt generation via `/api/azure-text/generate`.
   *
   * Deliberately far looser than `prompt`. That route's own comment records that
   * gpt-5.4-pro "regularly takes longer than 300s on large VTON meta-prompts",
   * which is why it runs on a dedicated undici `Agent` with 600s header/body
   * timeouts — cutting it at 180s would kill calls that were going to succeed.
   *
   * The win here is not a short deadline, it is a BOUNDED one: the route retries
   * up to 3 times (`MAX_ATTEMPTS`, backoff 2s/8s), so an unbounded client could
   * wait ~30 minutes on a wedged upstream. 540s lands inside the first attempt's
   * window, capping the worst case at one attempt instead of three.
   */
  promptAzure: 540_000,
} as const;

/**
 * Composes the caller's abort signal with a deadline.
 *
 * The two abort for different reasons and that difference is load-bearing: the
 * user's signal aborts with an `AbortError`, which every call site already reads
 * as "cancelled by user", while the deadline aborts with a `TimeoutError`, which
 * {@link isTimeoutError} turns into a diagnostic error message instead. Passing
 * one merged signal keeps both behaviours without threading a second signal
 * through every call site.
 *
 * `AbortSignal.any` is used rather than a hand-rolled `AbortController` + timer
 * because it cleans up its own timer and listeners once any input fires or the
 * result is collected; the hand-rolled version leaks a pending timer for every
 * request that completes normally.
 */
export function withDeadline(
  signal: AbortSignal | undefined,
  ms: number,
): AbortSignal {
  const deadline = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}

/** True when a rejection came from {@link withDeadline}'s deadline, not the user. */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

/**
 * Rewrites a deadline abort into a human-readable error naming the budget that
 * was exceeded. Anything else is rethrown untouched, so a user cancellation and
 * a genuine transport failure keep reaching their existing handlers unchanged.
 */
export function rethrowWithDeadlineContext(
  error: unknown,
  label: string,
  ms: number,
): never {
  if (isTimeoutError(error)) {
    throw new Error(`${label} timed out after ${Math.round(ms / 1000)}s`);
  }
  throw error;
}
