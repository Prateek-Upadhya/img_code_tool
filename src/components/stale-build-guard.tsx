"use client";

import { useEffect } from "react";

import { isChunkLoadError } from "@/lib/stale-build";

/**
 * Recover a tab that outlived the build it loaded.
 *
 * `next build` re-hashes every chunk and wipes the previous ones, so a tab left open
 * across a redeploy still holds references to filenames the server no longer has. Any
 * lazily loaded chunk then 404s the moment something asks for it, which in practice means
 * the moment the operator clicks the control that needs it. The symptom is a dead control
 * and a `ChunkLoadError` in the console, with nothing at all in the interface.
 *
 * The fix is simply to load the current build. Reloading fetches fresh HTML pointing at
 * chunk names that exist.
 *
 * Reloading in an error handler is a loop risk, so this reloads AT MOST ONCE per tab
 * session, guarded by a `sessionStorage` flag. If the reload does not help, the failure
 * surfaces normally on the second occurrence rather than trapping the tab in a cycle.
 */
const GUARD_KEY = "vton:stale-build-reloaded";

export function StaleBuildGuard() {
  useEffect(() => {
    const recover = (reason: unknown) => {
      if (!isChunkLoadError(reason)) return;
      // sessionStorage can throw in a locked down context, and a guard that breaks the
      // page it is meant to rescue is worse than no guard.
      try {
        if (sessionStorage.getItem(GUARD_KEY)) return;
        sessionStorage.setItem(GUARD_KEY, "1");
      } catch {
        return;
      }
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => recover(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => recover(event.reason);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
