import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const maxDuration = 60;

interface DownloadRequestBody {
  apiKey: string;
  videoUri: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DownloadRequestBody = await request.json();
    const { apiKey, videoUri } = body;

    if (!apiKey || !videoUri) {
      return NextResponse.json(
        { error: "API key and video URI are required" },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const tempPath = join(tmpdir(), `veo-${Date.now()}.mp4`);

    await ai.files.download({
      file: videoUri,
      downloadPath: tempPath,
    });

    const buffer = await readFile(tempPath);
    const base64 = buffer.toString("base64");

    await unlink(tempPath).catch(() => {});

    return NextResponse.json({
      videoBase64: base64,
      mimeType: "video/mp4",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error downloading video";
    console.error("Video download error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
