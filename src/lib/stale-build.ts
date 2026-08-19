/**
 * Recognising a tab that outlived the build it loaded.
 *
 * `next build` replaces the contents of `.next`, so a tab left open across a redeploy can
 * hold references to lazily loaded chunks the server is no longer serving. The failure
 * surfaces as a `ChunkLoadError` at the moment something asks for the chunk, which in
 * practice is the moment the operator clicks the control that needs it.
 *
 * Deliberately NOT a client module. It is pure classification over a value, with no DOM
 * and no browser API, so it can be exercised directly from a route handler. The guard
 * component and the download handler both use it rather than each carrying their own
 * regular expression, which is how the two would otherwise drift apart.
 */

/** Wordings seen from webpack and Turbopack for a chunk that would not load. */
const CHUNK_ERROR = /ChunkLoadError|Loading chunk .* failed|Failed to load chunk/i;

export function isChunkLoadError(value: unknown): boolean {
  if (value instanceof Error) {
    // Webpack sets the name; Turbopack does not always, so the message is checked too.
    return value.name === "ChunkLoadError" || CHUNK_ERROR.test(value.message);
  }
  if (typeof value === "string") return CHUNK_ERROR.test(value);
  return false;
}

/**
 * What to tell the operator when a chunk fails.
 *
 * Says the results are safe, because the natural reading of a failed download is that the
 * run itself was lost. It was not: results live in IndexedDB and survive the reload.
 */
export const STALE_BUILD_MESSAGE =
  "This tab is running a build the server has replaced, so part of the app is missing. Reload the page and download again. Your results are stored and will still be here.";
