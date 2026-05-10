// app/api/ai/chat/route.ts
//
// Proxies chat messages to Groq Cloud (OpenAI-compatible API).
// Requires GROQ_API_KEY. Only logged-in users may call it.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SYSTEM_PROMPT = `You are "ilmkhona0 AI Instructor", a helpful, patient teacher embedded inside the ilmkhona0 site.
You answer in plain language, give examples, and ask follow-up questions when the user is unclear.
If the user asks about the site itself (images, videos, apps, games, files, downloads), point them to the relevant section.
Keep answers concise unless the user asks for depth.`;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "You must be logged in to chat with the AI." },
      { status: 401 }
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing GROQ_API_KEY. Add it to .env.local and Vercel env." },
      { status: 500 }
    );
  }

  let body: { messages?: ChatMessage[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  // Sanity-cap history at 20 messages and ~4 KB each
  const history = incoming
    .slice(-20)
    .filter((m): m is ChatMessage =>
      !!m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (history.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const payload = {
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    temperature: 0.4,
    stream: false,
  };

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return NextResponse.json(
        { error: `Groq error ${r.status}: ${txt.slice(0, 400)}` },
        { status: 502 }
      );
    }

    const data = await r.json();
    const reply: string =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I couldn't generate a response.";
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      { status: 500 }
    );
  }
}
