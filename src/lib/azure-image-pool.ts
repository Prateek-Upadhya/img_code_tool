/**
 * Server-only endpoint pool for Azure gpt-image-2.
 *
 * Each Azure gpt-image-2 deployment is rate-limited per region / subscription /
 * deployment (Microsoft documents a default of ~9 RPM, with GlobalStandard
 * Tier-1 at 6 RPM and DataZoneStandard at 2 RPM). To raise the effective rate
 * the user sees, we run several deployments in different regions and rotate
 * across them with a sliding-window limiter.
 *
 * This module keeps in-memory per-endpoint state (a trailing-60s timestamp
 * window + a cooldown clock). That is authoritative because the app runs as a
 * single long-lived Node process under pm2 (fork mode). NOTE: if pm2 is ever
 * switched to cluster mode (multiple workers), each worker keeps its own
 * counters and the effective limit becomes `n × workers` — at that point this
 * should move to a shared store (e.g. Redis/Upstash).
 *
 * Used exclusively by `src/app/api/azure-image/generate/route.ts`. Never import
 * this from client code — it reads server-only secrets from `process.env`.
 */

const WINDOW_MS = 60_000;
const DEFAULT_RPM = 5;
const DEFAULT_COOLDOWN_MS = 60_000;

export interface EndpointRecord {
  url: string;
  key: string;
  /** 1-based slot index, used for logging / the `_endpoint` response field. */
  index: number;
  /** Timestamps (ms) of accepted calls within the trailing window. */
  timestamps: number[];
  /** Wall-clock ms before which this endpoint is considered throttled. */
  cooldownUntil: number;
}

function loadRpm(): number {
  const raw = Number(process.env.AZURE_IMAGE_RPM_PER_ENDPOINT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RPM;
}

const RPM_PER_ENDPOINT = loadRpm();

/**
 * Build the endpoint list once at module init. Slots are read in order 1..4 and
 * an entry is kept only when BOTH its endpoint URL and key are set, so the pool
 * degrades gracefully to however many deployments are configured.
 */
function loadEndpoints(): EndpointRecord[] {
  const records: EndpointRecord[] = [];
  for (let slot = 1; slot <= 4; slot++) {
    const url = process.env[`AZURE_IMAGE_ENDPOINT_${slot}`];
    const key = process.env[`AZURE_IMAGE_KEY_${slot}`];
    if (url && key) {
      records.push({ url, key, index: slot, timestamps: [], cooldownUntil: 0 });
    }
  }
  return records;
}

const endpoints = loadEndpoints();

export function poolSize(): number {
  return endpoints.length;
}

export function isConfigured(): boolean {
  return endpoints.length > 0;
}

/** Drop timestamps that have aged out of the trailing window. */
function prune(ep: EndpointRecord, now: number): void {
  const cutoff = now - WINDOW_MS;
  if (ep.timestamps.length && ep.timestamps[0] <= cutoff) {
    ep.timestamps = ep.timestamps.filter((t) => t > cutoff);
  }
}

/** Remaining calls allowed on this endpoint right now (0 while cooling down). */
function availableCapacity(ep: EndpointRecord, now: number): number {
  if (now < ep.cooldownUntil) return 0;
  prune(ep, now);
  return RPM_PER_ENDPOINT - ep.timestamps.length;
}

/** Earliest wall-clock ms at which `ep` will regain at least one free slot. */
function nextFreeAt(ep: EndpointRecord, now: number): number {
  if (now < ep.cooldownUntil) return ep.cooldownUntil;
  // The oldest in-window timestamp frees a slot once it exits the window.
  if (ep.timestamps.length >= RPM_PER_ENDPOINT) {
    return ep.timestamps[0] + WINDOW_MS;
  }
  return now;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Reserve a call slot on the best available endpoint, waiting if every endpoint
 * is momentarily at capacity.
 *
 * Rotation falls out of capacity-based selection: an endpoint that has used its
 * `RPM_PER_ENDPOINT` budget in the trailing 60s reports 0 capacity, so the
 * picker moves to the next one. The chosen endpoint is charged immediately
 * (its timestamp is recorded) so concurrent callers see the reservation.
 *
 * `exclude` lets the 429-failover retry skip an endpoint that just throttled.
 */
export async function acquireEndpoint(
  signal?: AbortSignal,
  exclude?: Set<number>,
): Promise<EndpointRecord> {
  if (!endpoints.length) {
    throw new Error(
      "Azure image provider is not configured. Set AZURE_IMAGE_ENDPOINT_1 and AZURE_IMAGE_KEY_1.",
    );
  }

  // Pool of endpoints this call is allowed to use. If excluding everything
  // (all endpoints already throttled this attempt), fall back to the full set
  // so we still pick the soonest-recovering one rather than deadlocking.
  let candidates = endpoints.filter((ep) => !exclude?.has(ep.index));
  if (!candidates.length) candidates = endpoints;

  for (;;) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const now = Date.now();

    let best: EndpointRecord | null = null;
    let bestCap = 0;
    for (const ep of candidates) {
      const cap = availableCapacity(ep, now);
      if (cap > bestCap) {
        bestCap = cap;
        best = ep;
      }
    }

    if (best) {
      best.timestamps.push(now);
      const remaining = RPM_PER_ENDPOINT - best.timestamps.length;
      console.log(
        `[azure-image] routing to Azure deployment #${best.index} (${remaining}/${RPM_PER_ENDPOINT} left this minute)`,
      );
      return best;
    }

    // Everything is at capacity — wait until the soonest endpoint frees a slot.
    const soonest = Math.min(...candidates.map((ep) => nextFreeAt(ep, now)));
    const waitMs = Math.max(50, soonest - now);
    console.log(
      `[azure-image] all ${candidates.length} deployment(s) at capacity — waiting ${waitMs}ms`,
    );
    await sleep(waitMs, signal);
  }
}

/**
 * Mark an endpoint as throttled after an upstream 429/503. It is skipped until
 * `retryAfterMs` elapses. We do not refund the reserved timestamp — treating
 * the rejected call as "spent" keeps us conservative under real throttling.
 */
export function reportRateLimited(ep: EndpointRecord, retryAfterMs?: number): void {
  const cooldown = retryAfterMs && retryAfterMs > 0 ? retryAfterMs : DEFAULT_COOLDOWN_MS;
  ep.cooldownUntil = Date.now() + cooldown;
  console.warn(
    `[azure-image] deployment #${ep.index} throttled — cooling down ${Math.round(cooldown / 1000)}s`,
  );
}

/** Parse an HTTP `Retry-After` header (seconds or HTTP-date) into ms. */
export function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(headerValue);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}
