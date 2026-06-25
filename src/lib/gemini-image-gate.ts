/**
 * Server-only global concurrency gate for Gemini image generation
 * (`gemini-3.1-flash-image-preview`).
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

const MAX_CONCURRENT = 4;

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
