/**
 * Two-lane concurrency scheduler for VTON generation.
 *
 * WHY NOT A PLAIN WORKER POOL
 * ---------------------------
 * A VTON result's pipeline is: prompt -> image -> judge -> (repair -> judge)*.
 * Running that whole chain inside one worker means a result needing three
 * attempts occupies its worker for minutes, so a pool sized for N fresh
 * generations quickly degrades to a pool of mostly-repairing workers and fresh
 * throughput collapses. Sizing the pool larger to compensate just makes the
 * collapse slower and the peak memory worse.
 *
 * Nor can a worker hold a "generation permit" and then *acquire* a "repair
 * permit": that couples the two lanes, so a burst of repairs starves fresh work
 * exactly when the run is already behind.
 *
 * THE FIX: the hand-off is a queue PUSH, not an acquire.
 *
 *   FRESH LANE   N workers walking an index cursor over a static item list.
 *                Each runs prompt -> image, calls `enqueue(...)`, and moves on.
 *                It never awaits anything in the repair lane.
 *
 *   REPAIR LANE  M workers draining a dynamic FIFO queue fed by the fresh lane.
 *                Blocks while the queue is empty, exits once the fresh lane is
 *                done AND the queue has drained.
 *
 * Because a fresh worker never waits on a repair worker, starvation and deadlock
 * are structurally impossible rather than merely unlikely.
 *
 * The judge call for attempt 1 belongs in the REPAIR lane, not the fresh lane —
 * it is a 15-30s Pro request carrying hi-res references plus a full generated
 * image. Running it inline would spend ~a third of every fresh worker's
 * wall-time grading, yielding ~9-10 sustained generations where 15 were asked for.
 */

/** A unit of follow-up work handed from the fresh lane to the repair lane. */
export type FollowUpTask = {
  /** Result id — used only for diagnostics and abandon handling. */
  id: string;
  run: () => Promise<void>;
};

export interface TwoLaneOptions<T> {
  items: T[];
  /** Concurrent fresh generations. */
  freshWorkers: number;
  /** Concurrent repair pipelines. */
  followUpWorkers: number;
  /**
   * Runs one item in the fresh lane. Call `enqueue` to hand follow-up work to
   * the repair lane; it returns immediately.
   */
  runFresh: (item: T, enqueue: (task: FollowUpTask) => void) => Promise<void>;
  /**
   * Called for every task still queued when the signal aborts, so the caller can
   * finalize a result rather than leaving its badge spinning forever.
   */
  onAbandon?: (task: FollowUpTask) => void;
  signal?: AbortSignal;
}

/**
 * Resolves only once BOTH lanes have drained — so a caller's `finally` block
 * flips `isGenerating` off at the genuinely-done moment, not while verification
 * is still in flight.
 */
export async function runTwoLanes<T>(o: TwoLaneOptions<T>): Promise<void> {
  const queue: FollowUpTask[] = [];
  let cursor = 0;
  let freshDone = false;

  // A single re-created promise used as a broadcast wake-up: resolving it
  // releases every waiting repair worker at once, and `resetNotify` immediately
  // installs a fresh one for the next wait.
  let notify!: Promise<void>;
  let notifyResolve!: () => void;
  const resetNotify = () => {
    notify = new Promise<void>((r) => {
      notifyResolve = r;
    });
  };
  resetNotify();
  const wake = () => {
    const resolve = notifyResolve;
    resetNotify();
    resolve();
  };

  const enqueue = (task: FollowUpTask) => {
    queue.push(task);
    wake();
  };

  // Without this, workers parked on `notify` when the user hits Stop would sleep
  // until a task happened to arrive — which, post-abort, it never would.
  const onAbort = () => wake();
  o.signal?.addEventListener("abort", onAbort, { once: true });

  const freshWorker = async () => {
    while (!o.signal?.aborted) {
      const i = cursor++;
      if (i >= o.items.length) return;
      await o.runFresh(o.items[i], enqueue);
    }
  };

  const followWorker = async () => {
    for (;;) {
      const task = queue.shift();
      if (task) {
        // Post-abort we still drain the queue, but hand each task to `onAbandon`
        // instead of running it — that finalizes the result without firing more
        // network calls.
        if (o.signal?.aborted) {
          o.onAbandon?.(task);
          continue;
        }
        await task.run();
        continue;
      }
      if (freshDone || o.signal?.aborted) return;
      await notify;
    }
  };

  try {
    const fresh = Array.from(
      { length: Math.max(1, Math.min(o.freshWorkers, o.items.length || 1)) },
      freshWorker,
    );
    const follow = Array.from({ length: Math.max(1, o.followUpWorkers) }, followWorker);

    await Promise.all(fresh);
    // Production has stopped; wake the repair workers so any of them parked on an
    // empty queue can observe `freshDone` and exit.
    freshDone = true;
    wake();
    await Promise.all(follow);
  } finally {
    o.signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Flat worker pool — a sliding window, unlike the fixed-size
 * `for (batch) await Promise.all(batch)` batching it replaces. Batching idles
 * every finished slot until the slowest member of the batch returns; this keeps
 * all `workers` slots busy until the list is exhausted.
 *
 * Used by the manual "Regenerate Mismatched" paths, where each item already owns
 * its full verify-and-repair cycle and there is no second lane to feed.
 */
export async function runPool<T>(
  items: T[],
  workers: number,
  fn: (item: T) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (!signal?.aborted) {
      const i = cursor++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(workers, items.length || 1)) }, worker),
  );
}
