import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { promises as dns } from "dns";
import clientPromise from "@/lib/mongodb";
import { sendVerificationEmail, emailConfigured } from "@/lib/email";

function validFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
async function hasMx(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

/**
 * POST /api/auth/register-start
 * Body: { email, password, username? }
 * Validates the email is real, stores a pending registration with a hashed
 * 6-digit code, and emails the code. The account is NOT created yet.
 */
export async function POST(req: NextRequest) {
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Email verification isn't set up yet. Add RESEND_API_KEY to enable sign up." },
      { status: 501 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    username?: string;
  };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const username = (String(body.username || "").trim()) || email.split("@")[0];

  if (!validFormat(email) || !(await hasMx(email))) {
    return NextResponse.json({ error: "Please enter a real email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("users").findOne({ email });
  if (existing) {
    return NextResponse.json(
      { error: "That email is already registered — please log in instead." },
      { status: 409 }
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);
  const passwordHash = await bcrypt.hash(password, 10);

  await db.collection("email_verifications").updateOne(
    { email },
    {
      $set: {
        email,
        username,
        passwordHash,
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send the verification email." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
