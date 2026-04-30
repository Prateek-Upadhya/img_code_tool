"use client";

import { useMemo, useState, useCallback } from "react";

type Mode = "generations" | "edits";
type Quality = "low" | "medium" | "high";

interface AzureTestResponse {
  ok: boolean;
  status: number;
  statusText: string;
  elapsedMs: number;
  targetUrl: string;
  mode: Mode;
  contentType: string;
  parsed: {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { message?: string; code?: string; type?: string };
    [k: string]: unknown;
  } | null;
  rawBody?: string;
  error?: string;
  detail?: string;
}

const ASPECT_PRESETS: Array<{ label: string; size: string }> = [
  { label: "1:1 · 1024×1024", size: "1024x1024" },
  { label: "3:4 · 768×1024", size: "768x1024" },
  { label: "4:3 · 1024×768", size: "1024x768" },
  { label: "9:16 · 576×1024", size: "576x1024" },
  { label: "16:9 · 1024×576", size: "1024x576" },
  { label: "2:3 · 688×1024", size: "688x1024" },
  { label: "3:2 · 1024×688", size: "1024x688" },
];

const ENV_ENDPOINT = process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT ?? "";
const ENV_KEY = process.env.NEXT_PUBLIC_AZURE_OPENAI_KEY ?? "";

function maskKey(k: string): string {
  if (!k) return "(not set)";
  if (k.length <= 8) return "***";
  return `${k.slice(0, 4)}…${k.slice(-4)} (${k.length} chars)`;
}

export default function AzureImageTestPage() {
  const [mode, setMode] = useState<Mode>("edits");
  const [prompt, setPrompt] = useState<string>(
    "A clean studio product photograph of the footwear shown in image 1, on a seamless light grey background, soft diffused lighting, shallow depth of field, commercial e-commerce style."
  );
  const [size, setSize] = useState<string>("1024x1024");
  const [quality, setQuality] = useState<Quality>("medium");
  const [n, setN] = useState<number>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [endpointOverride, setEndpointOverride] = useState<string>("");
  const [keyOverride, setKeyOverride] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<AzureTestResponse | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const filePreviews = useMemo(
    () => files.map((f) => ({ name: f.name, size: f.size, url: URL.createObjectURL(f) })),
    [files]
  );

  const handleFiles = useCallback((fl: FileList | null) => {
    if (!fl) return;
    setFiles(Array.from(fl));
  }, []);

  const resultImages = useMemo(() => {
    if (!response?.parsed?.data) return [] as string[];
    return response.parsed.data
      .map((d) => {
        if (d.b64_json) return `data:image/png;base64,${d.b64_json}`;
        if (d.url) return d.url;
        return null;
      })
      .filter((v): v is string => Boolean(v));
  }, [response]);

  const onSubmit = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    setErrorText(null);
    try {
      const form = new FormData();
      form.set("prompt", prompt);
      form.set("mode", mode);
      form.set("size", size);
      form.set("quality", quality);
      form.set("n", String(n));
      if (endpointOverride.trim()) form.set("endpoint", endpointOverride.trim());
      if (keyOverride.trim()) form.set("apiKey", keyOverride.trim());
      for (const f of files) form.append("image", f, f.name);

      const res = await fetch("/api/azure-image-test", { method: "POST", body: form });
      const json = (await res.json()) as AzureTestResponse;
      setResponse(json);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [prompt, mode, size, quality, n, files, endpointOverride, keyOverride]);

  const verdict = (() => {
    if (!response) return null;
    if (response.ok && resultImages.length > 0) {
      return { tone: "ok", text: "Success — endpoint + credentials work, image returned." };
    }
    if (response.ok) {
      return { tone: "warn", text: "HTTP 200 but no image in response.data — check payload below." };
    }
    return {
      tone: "err",
      text: `Failed with HTTP ${response.status} ${response.statusText}. See payload below.`,
    };
  })();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-mono">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Azure gpt-image-2 — connectivity test</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Standalone sanity check for <code>NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT</code> and <code>NEXT_PUBLIC_AZURE_OPENAI_KEY</code>.
            Requests are proxied through <code>/api/azure-image-test</code> to avoid browser CORS.
          </p>
        </header>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-2 text-sm">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Env (server-visible)</div>
          <div>
            <span className="text-neutral-400">Endpoint:</span>{" "}
            <span className="break-all">{ENV_ENDPOINT || "(not set)"}</span>
          </div>
          <div>
            <span className="text-neutral-400">Key:</span> <span>{maskKey(ENV_KEY)}</span>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Mode</div>
            <div className="flex gap-2">
              {(["edits", "generations"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 text-sm border transition-colors ${
                    mode === m
                      ? "bg-orange-600 border-orange-500 text-white"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  /{m}
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              {mode === "edits"
                ? "Multipart form with image[]. This is what the real footwear VTON flow will use."
                : "JSON body, text-to-image only. Useful to isolate auth issues from multipart handling."}
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-3 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Size</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-sm"
              >
                {ASPECT_PRESETS.map((p) => (
                  <option key={p.size} value={p.size}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Quality</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-sm"
              >
                <option value="low">low (≈ 1K)</option>
                <option value="medium">medium (≈ 2K)</option>
                <option value="high">high (≈ 4K)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">n</label>
              <input
                type="number"
                min={1}
                max={4}
                value={n}
                onChange={(e) => setN(Math.max(1, Math.min(4, Number(e.target.value) || 1)))}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-sm"
              />
            </div>
          </div>

          {mode === "edits" && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                Reference image(s) — required for /edits
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-700 file:px-3 file:py-1.5 file:text-neutral-100 hover:file:bg-neutral-600"
              />
              {filePreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {filePreviews.map((p) => (
                    <div key={p.name} className="rounded-md border border-neutral-800 p-1">
                      <img src={p.url} alt={p.name} className="h-24 w-full object-cover rounded" />
                      <div className="text-[10px] text-neutral-500 truncate mt-1">
                        {p.name} · {(p.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-neutral-400">Override endpoint / key (optional)</summary>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={endpointOverride}
                onChange={(e) => setEndpointOverride(e.target.value)}
                placeholder="https://...cognitiveservices.azure.com/openai/deployments/<name>/images/edits?api-version=2025-04-01-preview"
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-xs"
              />
              <input
                type="password"
                value={keyOverride}
                onChange={(e) => setKeyOverride(e.target.value)}
                placeholder="azure api key override"
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-xs"
              />
            </div>
          </details>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading || !prompt.trim() || (mode === "edits" && files.length === 0)}
              className="rounded-md bg-orange-600 hover:bg-orange-500 disabled:bg-neutral-700 disabled:text-neutral-400 px-4 py-2 text-sm font-medium transition-colors"
            >
              {loading ? "Calling Azure…" : "Send test request"}
            </button>
            {errorText && <span className="text-sm text-red-400">{errorText}</span>}
          </div>
        </section>

        {verdict && (
          <section
            className={`rounded-xl border p-4 text-sm ${
              verdict.tone === "ok"
                ? "border-emerald-700 bg-emerald-950 text-emerald-200"
                : verdict.tone === "warn"
                  ? "border-amber-700 bg-amber-950 text-amber-200"
                  : "border-red-700 bg-red-950 text-red-200"
            }`}
          >
            {verdict.text}
          </section>
        )}

        {resultImages.length > 0 && (
          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Generated images</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {resultImages.map((src, i) => (
                <img key={i} src={src} alt={`result-${i}`} className="w-full rounded-md border border-neutral-800" />
              ))}
            </div>
          </section>
        )}

        {response && (
          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-3 text-sm">
            <div className="text-xs uppercase tracking-wider text-neutral-500">Response metadata</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-4">
              <div><span className="text-neutral-400">Status:</span> {response.status} {response.statusText}</div>
              <div><span className="text-neutral-400">Elapsed:</span> {response.elapsedMs} ms</div>
              <div className="md:col-span-2 break-all">
                <span className="text-neutral-400">Target URL:</span> {response.targetUrl}
              </div>
              <div><span className="text-neutral-400">Content-Type:</span> {response.contentType}</div>
              <div><span className="text-neutral-400">Mode:</span> /{response.mode}</div>
            </div>
            <details open>
              <summary className="cursor-pointer text-neutral-400 text-xs uppercase tracking-wider">Body</summary>
              <pre className="mt-2 max-h-[480px] overflow-auto rounded-md bg-neutral-950 p-3 text-[11px] leading-snug border border-neutral-800">
{JSON.stringify(
  response.parsed ?? response.rawBody ?? { error: response.error, detail: response.detail },
  (key, value) => (key === "b64_json" && typeof value === "string" ? `<${value.length} chars of base64 omitted>` : value),
  2,
)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </div>
  );
}
