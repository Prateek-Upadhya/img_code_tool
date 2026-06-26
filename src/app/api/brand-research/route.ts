import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient } from "@/lib/vertex-server";

// Web-grounded brand research can take a few seconds.
export const maxDuration = 120;

/**
 * Server-side brand research for AI Model Creation.
 *
 * Given a brand name, runs Gemini 3.1 Pro with the Google Search grounding tool
 * to look up the brand's identity and the visual direction its creative
 * directors are known for, then distils it into a compact (≤100-word) set of
 * highly-actionable visual directives that the model-generation pipeline injects
 * into every generation. Returns `{ directives }`.
 */
export async function POST(request: NextRequest) {
  try {
    const { brandName } = (await request.json()) as { brandName?: string };

    if (!brandName || !brandName.trim()) {
      return NextResponse.json({ error: "`brandName` is required" }, { status: 400 });
    }

    const ai = getGoogleClient("vertex");

    const prompt = `You are a fashion brand strategist briefing a photographer. Research the fashion brand "${brandName.trim()}" — its brand identity, aesthetic codes, and the visual direction its creative directors are known for (mood, casting, styling attitude, color/lighting language, the type of human model and overall look they favour).

Distil your findings into a single, highly-effective set of VISUAL DIRECTIVES for generating on-brand human fashion models. Constraints:
- MAXIMUM 100 words.
- Concrete and photographic (casting vibe, model attitude/energy, grooming/hair feel, complexion direction, overall mood) — NOT marketing fluff.
- Do NOT mention wardrobe, clothing, background, footwear, or lighting (those are fixed elsewhere).
- Output ONLY the directives as flowing prose or tight bullet points. No preamble, no citations, no headings.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ text: prompt }],
      config: {
        // Google Search grounding so the directives reflect the real brand.
        tools: [{ googleSearch: {} }],
        abortSignal: request.signal,
      },
    });

    const directives = (response.text ?? "").trim();
    if (!directives) {
      return NextResponse.json(
        { error: "No brand directives could be generated" },
        { status: 502 },
      );
    }

    return NextResponse.json({ directives });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "Request cancelled" }, { status: 499 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("Brand research error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
