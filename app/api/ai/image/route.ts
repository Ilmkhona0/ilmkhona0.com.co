// app/api/ai/image/route.ts
//
// Generates an image from a text prompt via Cloudflare Workers AI.
// Model: @cf/black-forest-labs/flux-1-schnell  (free tier — ~10k neurons/day)
//
// Requires env vars (Vercel → Production):
//   CLOUDFLARE_ACCOUNT_ID  — found in https://dash.cloudflare.com → right sidebar
//   CLOUDFLARE_API_TOKEN   — create at My Profile → API Tokens → "Workers AI - Read"
//
// Optional env:
//   CLOUDFLARE_IMAGE_MODEL — override the default model id
//
// Only logged-in users may call it.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const DEFAULT_MODEL = "@cf/black-forest-labs/flux-1-schnell";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "You must be logged in to generate images." },
      { status: 401 }
    );
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json(
      {
        error:
          "Server is missing Cloudflare credentials. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to .env.local and Vercel env.",
      },
      { status: 500 }
    );
  }

  let body: { prompt?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (prompt.length > 2000) {
    return NextResponse.json(
      { error: "Prompt is too long (max 2000 characters)" },
      { status: 400 }
    );
  }

  const model = process.env.CLOUDFLARE_IMAGE_MODEL || DEFAULT_MODEL;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        prompt,
        // FLUX schnell accepts 1..8 steps; 4 is a good speed/quality balance.
        steps: 4,
      }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Cloudflare AI error ${r.status}: ${txt.slice(0, 400)}`,
        },
        { status: 502 }
      );
    }

    // FLUX-schnell returns JSON: { result: { image: "<base64>" }, success: true }
    // Other models (e.g. SDXL) return a raw binary PNG. Handle both.
    const contentType = r.headers.get("content-type") || "";
    let dataUrl: string;

    if (contentType.includes("application/json")) {
      const data = (await r.json()) as { result?: { image?: string }; success?: boolean; errors?: unknown };
      const b64 = data?.result?.image;
      if (!b64) {
        return NextResponse.json(
          { error: "Cloudflare AI returned no image" },
          { status: 502 }
        );
      }
      dataUrl = `data:image/png;base64,${b64}`;
    } else {
      const buf = await r.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      const mime = contentType.split(";")[0].trim() || "image/png";
      dataUrl = `data:${mime};base64,${b64}`;
    }

    return NextResponse.json({ url: dataUrl, prompt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      { status: 500 }
    );
  }
}
