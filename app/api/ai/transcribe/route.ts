// app/api/ai/transcribe/route.ts
//
// Transcribes uploaded audio to text using Groq's Whisper model.
// Free tier: very generous (uses your existing GROQ_API_KEY).
// Why not the browser's Web Speech API? It only works in Chrome/Edge, often
// fails silently if mic permissions are misconfigured, and accuracy varies wildly.
// Whisper-large-v3-turbo is far more reliable and works across all browsers.
//
// Request: multipart/form-data with field "audio" containing an audio file.
// Response: { text: "transcribed string" }

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "You must be logged in to use voice transcription." },
      { status: 401 }
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing GROQ_API_KEY." },
      { status: 500 }
    );
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with an 'audio' field." },
      { status: 400 }
    );
  }

  const file = incoming.get("audio");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "No audio file received." },
      { status: 400 }
    );
  }
  // Hard cap so a stuck recorder can't ship a huge blob.
  const MAX = 25 * 1024 * 1024;
  if (file.size > MAX) {
    return NextResponse.json(
      { error: `Audio too large (${(file.size / 1024 / 1024).toFixed(1)} MB, max 25 MB).` },
      { status: 413 }
    );
  }
  if (file.size < 1000) {
    return NextResponse.json(
      { error: "Audio is too short — speak for at least a second." },
      { status: 400 }
    );
  }

  // Repackage for Groq's OpenAI-compatible endpoint.
  const fd = new FormData();
  fd.append("file", file, "recording.webm");
  fd.append("model", MODEL);
  fd.append("response_format", "json");
  // Optional language hint can be sent via "language" — skip for auto-detect.
  const lang = (incoming.get("language") as string | null) || "";
  if (lang) fd.append("language", lang);

  try {
    const r = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return NextResponse.json(
        { error: `Groq Whisper error ${r.status}: ${txt.slice(0, 400)}` },
        { status: 502 }
      );
    }
    const data = (await r.json()) as { text?: string };
    return NextResponse.json({ text: (data.text || "").trim() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      { status: 500 }
    );
  }
}
