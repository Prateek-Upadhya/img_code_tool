/**
 * Sizes the VTON scheduler's lanes to the transport the browser actually has.
 *
 * THE PROBLEM
 * -----------
 * `two-lane-runner.ts` was sized for 15 concurrent fresh generations plus 15
 * concurrent repairs, and every one of those workers issues its `fetch` to the
 * SAME origin. Over HTTP/1.1 a browser opens ~6 connections per origin, so at
 * most 6 of the 30 are ever really in flight; the other 24 sit in the browser's
 * own connection queue.
 *
 * That queue is invisible to us and it is the whole bug. A worker writes
 * `status: "generating-prompt"` and *then* calls `fetch`, so a request still
 * waiting for a free socket renders as a card that has been "Generating
 * prompt…" for minutes. The work is not stuck — it has not started.
 *
 * THE FIX
 * -------
 * Ask for only as much concurrency as the transport can carry. Total throughput
 * is unchanged (it was always capped at ~6 either way); what changes is WHERE
 * the excess waits. Queued items now sit in our own scheduler as `pending`,
 * which the UI renders honestly, instead of in the browser's socket pool
 * wearing an in-progress badge.
 *
 * HTTP/2 and HTTP/3 multiplex over a single connection, so there the original
 * 15+15 is genuinely reachable and is kept.
 *
 * NOTE: `next dev` and `next start` both serve plain HTTP/1.1 — there is no
 * HTTP/2 option in `next.config.ts`. Only a terminating proxy (nginx/ALB with
 * `http2 on`) in front of the app produces `h2`.
 */

export interface LaneSizes {
  /** Concurrent fresh generations (prompt → image). */
  fresh: number;
  /** Concurrent repair pipelines (judge → correct → re-render). */
  repair: number;
}

/** Multiplexed transport: one connection carries all streams. */
const MULTIPLEXED_LANES: LaneSizes = { fresh: 15, repair: 15 };

/**
 * HTTP/1.1: ~6 sockets per origin. 3 + 3 saturates that budget exactly, so every
 * request we issue gets a socket immediately and nothing waits invisibly.
 */
const SERIAL_LANES: LaneSizes = { fresh: 3, repair: 3 };

/**
 * `nextHopProtocol` of the most recent same-origin resource, or `undefined` when
 * it cannot be determined (server render, empty buffer, or an entry that has no
 * timing visibility).
 *
 * Reads the buffer backwards: the newest same-origin entry reflects the
 * connection our API calls will actually reuse. Cross-origin entries are skipped
 * because they report `""` without a `Timing-Allow-Origin` header, and because
 * their protocol says nothing about ours.
 */
export function observedOriginProtocol(): string | undefined {
  if (typeof performance === "undefined" || typeof location === "undefined") {
    return undefined;
  }
  let entries: PerformanceResourceTiming[];
  try {
    entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  } catch {
    return undefined;
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!entry.name.startsWith(location.origin)) continue;
    if (entry.nextHopProtocol) return entry.nextHopProtocol;
  }
  return undefined;
}

/**
 * Lane sizes for the current transport.
 *
 * Called once per run rather than memoized at module scope: the protocol is not
 * known until the page has fetched something, and a long-lived tab could in
 * principle be reloaded behind a different proxy.
 *
 * Unknown protocol falls back to the conservative pair — over-subscribing is the
 * failure mode that produces stuck-looking cards, so an unknown transport is
 * treated as the constrained one.
 */
export function vtonLaneSizes(): LaneSizes {
  const protocol = observedOriginProtocol();
  const multiplexed = protocol === "h2" || protocol === "h3" || protocol === "h2c";
  return multiplexed ? MULTIPLEXED_LANES : SERIAL_LANES;
}
