/**
 * Server-only global concurrency gate for Gemini image generation
 * (`gemini-3.1-flash-image`).
 *
 * Every infographic image request from every browser tab funnels through the
 * single `/api/gemini/generate` route. This counting semaphore caps the number
 * of Gemini image calls running *concurrently across all tabs* at
 * `MAX_CONCURRENT`. Requests beyond the cap queue (FIFO) and are admitted as
 * running ones finish.
 *
 * The in-memory `active`/`queue` state is authoritative because the app runs as
 * a single long-lived Node process under pm2 (fork mode). NOTE: if pm2 is ever
 * switched to cluster mode (multiple workers), or the app is scaled to multiple
 * EC2 instances behind a load balancer, each process keeps its own counter and
 * the effective cap becomes `MAX_CONCURRENT × processes` — at that point this
 * must move to a shared store (e.g. Redis/Upstash). Mirrors the same caveat in
 * `src/lib/azure-image-pool.ts`.
 *
 * Never import this from client code — it is server coordination state.
 */

/**
 * Ceiling on concurrent Gemini image calls across all tabs.
 *
 * Sized for the VTON two-lane scheduler: 15 concurrent fresh generations plus 15
 * concurrent repair generations (see src/lib/two-lane-runner.ts and the
 * VTON_FRESH_CONCURRENCY / VTON_REPAIR_CONCURRENCY constants in
 * step-generate.tsx). A single tab at full tilt therefore offers exactly 30 and
 * never queues; a second tab queues behind it.
 *
 * MEMORY WARNING: this was previously 4, and the comment in
 * `/api/gemini/generate/route.ts` records that even four concurrent 2K/4K
 * requests once spiked the single pm2 Node heap into OOM territory (which is why
 * the response is shallow-copied rather than deep-cloned). Thirty in flight —
 * plus the ungated `gemini-3.1-pro-preview` judge calls that accompany them —
 * is a large multiple of that. If the host starts dropping connections under
 * bulk + 4K, this constant is the first thing to lower, and giving Node an
 * explicit `--max-old-space-size` for the instance is the first thing to add.
 */
const MAX_CONCURRENT = 30;

/** Number of slots currently handed out (in-flight requests). */
let active = 0;

interface Waiter {
  resolve: () => void;
  reject: (reason?: unknown) => void;
  signal?: AbortSignal;
  onAbort: () => void;
}

/** FIFO queue of requests waiting for a free slot. */
const queue: Waiter[] = [];

/**
 * Acquire a slot. Resolves immediately when fewer than `MAX_CONCURRENT` are in
 * flight; otherwise queues and resolves once a slot frees. If `signal` aborts
 * while queued, the waiter is removed and the promise rejects, so a cancelled /
 * disconnected tab never holds or claims a slot.
 */
export function acquireGeminiImageSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new Error("aborted"));
  }
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const waiter: Waiter = { resolve, reject, signal, onAbort: () => {} };
    waiter.onAbort = () => {
      const i = queue.indexOf(waiter);
      if (i >= 0) queue.splice(i, 1);
      reject(signal?.reason ?? new Error("aborted"));
    };
    signal?.addEventListener("abort", waiter.onAbort, { once: true });
    queue.push(waiter);
  });
}

/**
 * Release a previously acquired slot. If a request is queued, the freed slot is
 * handed directly to it (so `active` stays constant); otherwise `active` drops.
 * Must be called exactly once per successful `acquireGeminiImageSlot`.
 */
export function releaseGeminiImageSlot(): void {
  const next = queue.shift();
  if (next) {
    next.signal?.removeEventListener("abort", next.onAbort);
    next.resolve();
  } else if (active > 0) {
    active--;
  }
}

/** In-flight request count (for logging / debugging). */
export function geminiImageInFlight(): number {
  return active;
}

/** Number of requests currently queued for a slot (for logging / debugging). */
export function geminiImageQueued(): number {
  return queue.length;
}
