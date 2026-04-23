import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 32 * 1024 * 1024;

function isAllowedRemoteUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "0.0.0.0" ||
      /^127\.\d+\.\d+\.\d+$/.test(host) ||
      /^(10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Server-side image fetch for bulk import (CDN CORS bypass). Same-origin only. */
export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !isAllowedRemoteUrl(url)) {
    return NextResponse.json({ error: "Invalid or disallowed URL" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; VTONBulkImport/1.0)",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream HTTP ${upstream.status}` },
        { status: 502 }
      );
    }

    const len = upstream.headers.get("content-length");
    if (len && Number(len) > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    let ct = upstream.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    if (!ct.startsWith("image/")) {
      ct = "application/octet-stream";
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
