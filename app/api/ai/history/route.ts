// app/api/ai/history/route.ts
//
// Persists each user's AI chat thread in MongoDB.
//   GET    -> { messages: [{role, content}] }
//   POST   -> body: { messages: [...] }  (replaces the whole thread)
//   DELETE -> wipes the user's thread (used by "New chat")
//
// Collection: ai_chats   { userId, messages, updatedAt }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import clientPromise from "@/lib/mongodb";

type ChatMessage = { role: "user" | "assistant"; content: string };

function uid(session: { user?: { id?: string; email?: string | null } } | null): string | null {
  if (!session?.user) return null;
  return session.user.id || session.user.email || null;
}

export async function GET() {
  const session = await auth();
  const id = uid(session);
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const client = await clientPromise;
    const db = client.db();
    const doc = await db.collection("ai_chats").findOne({ userId: id });
    return NextResponse.json({
      messages: Array.isArray(doc?.messages) ? doc.messages : [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "DB error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const id = uid(session);
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { messages?: ChatMessage[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-200) // keep at most 200 messages per user
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  try {
    const client = await clientPromise;
    const db = client.db();
    await db.collection("ai_chats").updateOne(
      { userId: id },
      { $set: { userId: id, messages, updatedAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "DB error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await auth();
  const id = uid(session);
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const client = await clientPromise;
    const db = client.db();
    await db.collection("ai_chats").deleteOne({ userId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "DB error" },
      { status: 500 }
    );
  }
}
