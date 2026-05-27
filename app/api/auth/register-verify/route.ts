import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";

/**
 * POST /api/auth/register-verify
 * Body: { email, code }
 * Checks the emailed code; on success creates the account and clears the
 * pending record. The client then signs in with the same email + password.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").trim();
  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();
  const pending = await db.collection("email_verifications").findOne({ email });

  if (!pending) {
    return NextResponse.json({ error: "No pending verification — start sign up again." }, { status: 400 });
  }
  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    await db.collection("email_verifications").deleteOne({ email });
    return NextResponse.json({ error: "Code expired — start sign up again." }, { status: 400 });
  }
  if ((pending.attempts || 0) >= 6) {
    await db.collection("email_verifications").deleteOne({ email });
    return NextResponse.json({ error: "Too many attempts — start sign up again." }, { status: 429 });
  }

  const ok = await bcrypt.compare(code, pending.codeHash);
  if (!ok) {
    await db.collection("email_verifications").updateOne({ email }, { $inc: { attempts: 1 } });
    return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
  }

  // Create the account (guard against a race where it already exists).
  const exists = await db.collection("users").findOne({ email });
  if (!exists) {
    await db.collection("users").insertOne({
      email,
      username: pending.username,
      password: pending.passwordHash,
      createdAt: new Date(),
      provider: "credentials",
      emailVerified: new Date(),
    });
  }
  await db.collection("email_verifications").deleteOne({ email });

  return NextResponse.json({ ok: true });
}
