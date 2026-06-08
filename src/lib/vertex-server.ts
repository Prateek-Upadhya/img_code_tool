import { GoogleGenAI } from "@google/genai";
import type { GoogleAuthOptions } from "google-auth-library";

/**
 * Server-only Vertex AI client.
 *
 * SECURITY: This module must only be imported from route handlers (server). It
 * resolves Google Cloud service-account credentials, which must stay on the
 * server. Vertex auth options (project/location/googleAuthOptions) are ignored
 * on browser runtimes by the SDK, so this code is inherently server-side.
 *
 * The browser talks to our own route handlers (e.g. /api/gemini/generate,
 * /api/veo/*), which in turn call this client. No Gemini/Vertex credential is
 * ever shipped to the client — replacing the previous NEXT_PUBLIC_GEMINI_API_KEY
 * model where users could read the key straight out of the page.
 *
 * Authentication resolution order (Application Default Credentials friendly):
 *   1. GOOGLE_APPLICATION_CREDENTIALS_JSON — full service-account JSON in an env
 *      var (best for serverless / Vercel where you can't ship a key file).
 *   2. GOOGLE_APPLICATION_CREDENTIALS — filesystem path to a key file (picked up
 *      automatically by the auth library / ADC; no explicit handling needed).
 *   3. ADC — `gcloud auth application-default login` for local dev, or the
 *      attached service account in a GCP runtime. This is the default and the
 *      recommended local-dev path (no key material at rest).
 */

let cached: GoogleGenAI | null = null;

function resolveAuthOptions(): GoogleAuthOptions | undefined {
  const inlineJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (inlineJson) {
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(inlineJson);
    } catch {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS_JSON is set but is not valid JSON.",
      );
    }
    return {
      credentials: credentials as GoogleAuthOptions["credentials"],
      projectId: (credentials.project_id as string) || undefined,
    };
  }
  // GOOGLE_APPLICATION_CREDENTIALS (key-file path) and `gcloud` ADC are both
  // discovered automatically by google-auth-library — return undefined so the
  // SDK falls back to Application Default Credentials.
  return undefined;
}

/**
 * Returns a singleton GoogleGenAI client configured for the Vertex AI backend.
 * Throws (server-side only) if the project is not configured.
 */
export function getVertexClient(): GoogleGenAI {
  if (cached) return cached;

  const project =
    process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location =
    process.env.GCP_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || "global";

  if (!project) {
    throw new Error(
      "Vertex AI is not configured: set GCP_PROJECT_ID (and GCP_LOCATION) in your server environment.",
    );
  }

  cached = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: resolveAuthOptions(),
  });
  return cached;
}
