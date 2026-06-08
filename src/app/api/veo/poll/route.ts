import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getVertexClient } from "@/lib/vertex-server";

export const maxDuration = 60;

interface DownloadRequestBody {
  videoUri: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DownloadRequestBody = await request.json();
    const { videoUri } = body;

    if (!videoUri) {
      return NextResponse.json(
        { error: "Video URI is required" },
        { status: 400 }
      );
    }

    const ai = getVertexClient();

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
