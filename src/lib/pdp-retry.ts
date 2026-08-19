/**
 * Call-level retry for the PDP Set pipeline.
 *
 * Deliberately NOT a client module. Nothing here touches a browser API: it is error
 * classification, arithmetic and `setTimeout`. Keeping it isomorphic means the retry rules
 * can be exercised directly rather than only through the UI.
 *
 * Distinct from the judge-driven re-roll in the generate step. That one re-rolls when an
 * image comes back and scores badly; this one handles the call never succeeding at all.
 * PDP was the only mode without it: the Infographic wizard auto-retries once with a
 * backoff, VTON has its own, and PDP sent a first failure straight to a permanent error
 * card. With a documented intermittent server-side `INVALID_ARGUMENT` on these models,
 * that turned a recoverable blip into a dead result.
 *
 * Two rules shape it:
 *
 * 1. **Only retry what might succeed next time.** A content refusal or a malformed request
 *    naming a field will fail identically on every attempt, so retrying it just burns
 *    money and time. A transport drop, a 5xx, or a bare INVALID_ARGUMENT with no field
 *    detail are all worth another go.
 * 2. **Jitter matters more than usual here.** Twenty workers run concurrently. Without
 *    jitter a burst of failures retries in lockstep and recreates the very spike that
 *    caused it.
 */

/** Attempts per call, including the first. */
export const PDP_CALL_MAX_ATTEMPTS = 3;

/** Base delays before attempts 2 and 3, in ms. Jitter is added on top. */
const BACKOFF_MS = [1_000, 3_000, 8_000];

/**
 * Errors that name a specific problem with the request itself. These are deterministic:
 * the same request will fail the same way every time, so retrying is pure waste.
 */
const NON_RETRYABLE_PATTERNS = [
  "unsupported mime",
  "invalid mime",
  "empty inlinedata",
  "empty mimetype",
  "provided image is not valid",
  "unable to process input image",
  "parts must not be empty",
  "api key",
  "permission",
  "allowlist",
  "persongeneration",
  "quota",
  "blocked",
  "safety",
  "prohibited",
  "recitation",
];

/**
 * Whether this failure is worth another attempt.
 *
 * A bare `INVALID_ARGUMENT` with no field detail IS retried, deliberately. Google has an
 * acknowledged, unresolved issue producing exactly that on Gemini 3 image models, where
 * identical payloads succeed on a later attempt. An INVALID_ARGUMENT that names a field is
 * a different animal and is not retried.
 */
export function isRetryablePdpFailure(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return false;

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes("cancelled") || message.includes("aborted")) return false;
  if (NON_RETRYABLE_PATTERNS.some((p) => message.includes(p))) return false;

  // "Failed to fetch" and friends: the request never landed, so nothing about it is known
  // to be wrong. Always worth another attempt.
  if (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("econnreset") ||
    message.includes("socket hang up")
  ) {
    return true;
  }

  if (/\b(500|502|503|504)\b/.test(message) || message.includes("internal error")) return true;

  // Bare INVALID_ARGUMENT with no field violations named.
  if (message.includes("invalid_argument") || message.includes("invalid argument")) {
    return !message.includes("field") && !message.includes("parameter");
  }

  // Unknown shape. Retry once rather than discarding paid-for work on a guess.
  return true;
}

function delayWithJitter(attempt: number): number {
  const base = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)];
  // Full jitter across the window, so concurrent workers spread rather than re-spike.
  return Math.round(base * (0.5 + Math.random()));
}

export interface PdpRetryOutcome {
  /** 1-based attempt that succeeded. */
  attempts: number;
}

/**
 * Run `fn`, retrying retryable failures with jittered backoff.
 *
 * `onRetry` reports each retry so the UI can show that a result needed more than one go,
 * and so a run that only survived on retries is visibly different from a clean one.
 * Rethrows the LAST error when every attempt fails.
 */
export async function withPdpRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    signal?: AbortSignal;
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  } = {}
): Promise<{ value: T; outcome: PdpRetryOutcome }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PDP_CALL_MAX_ATTEMPTS; attempt++) {
    if (opts.signal?.aborted) throw new Error("Cancelled");
    try {
      const value = await fn(attempt);
      return { value, outcome: { attempts: attempt } };
    } catch (error) {
      lastError = error;
      const isLast = attempt === PDP_CALL_MAX_ATTEMPTS;
      if (isLast || !isRetryablePdpFailure(error) || opts.signal?.aborted) break;

      const wait = delayWithJitter(attempt);
      opts.onRetry?.(attempt, error, wait);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  throw lastError;
}

/**
 * Adaptive worker count for a run.
 *
 * The configured ceiling is optimistic on purpose: it is fast when the deployment can take
 * it. But this repo documents OOM and connection resets at four concurrent 2K requests in
 * a single Node process, so when transport-level failures start arriving the run steps
 * down rather than continuing to hammer a wall.
 *
 * It never steps back up mid-run. Recovering into the same ceiling is how a batch thrashes,
 * and the operator would rather a run finish slowly than oscillate.
 */
export class PdpConcurrencyGovernor {
  private readonly ladder: number[];
  private index = 0;
  private transportFailures = 0;

  constructor(ceiling: number, private readonly onStepDown?: (next: number) => void) {
    // Distinct, descending, never below 4.
    this.ladder = [...new Set([ceiling, Math.max(4, Math.floor(ceiling / 2)), 6, 4])]
      .filter((n) => n <= ceiling)
      .sort((a, b) => b - a);
  }

  get current(): number {
    return this.ladder[this.index] ?? this.ladder[this.ladder.length - 1];
  }

  get hasSteppedDown(): boolean {
    return this.index > 0;
  }

  /**
   * Report a failure. Only transport-level ones count toward stepping down: a content
   * refusal says nothing about how much load the server can take.
   */
  report(error: unknown): void {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const isTransport =
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("load failed") ||
      message.includes("econnreset") ||
      message.includes("socket hang up") ||
      /\b(502|503|504)\b/.test(message);
    if (!isTransport) return;

    this.transportFailures += 1;
    // Three is enough to distinguish a pattern from one unlucky request.
    if (this.transportFailures >= 3 && this.index < this.ladder.length - 1) {
      this.index += 1;
      this.transportFailures = 0;
      this.onStepDown?.(this.current);
    }
  }
}
