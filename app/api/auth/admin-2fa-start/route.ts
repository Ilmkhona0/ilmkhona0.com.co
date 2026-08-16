import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import { getAdminConfig } from "@/lib/adminConfig";
import { sendAdminLoginCode, emailConfigured } from "@/lib/email";

// Google login with this email is always trusted as admin. Kept in sync with
// auth.ts so the recovery owner can always trigger the 2FA flow too.
const RECOVERY_ADMIN_EMAIL = "ilmkhona@gmail.com";

const ADMIN_2FA_DOC_ID = "admin";

interface Admin2faDoc {
  _id: string;
  codeHash: string;
  attempts?: number;
  expiresAt: Date;
  createdAt?: Date;
}

/**
 * POST /api/auth/admin-2fa-start
 * Body: { email, password }
 *
 * Step 1 of admin login. Behaviour:
 *  - Non-admin email  -> { admin: false }  (client then does a normal sign-in)
 *  - Admin email, wrong password -> 401 (do not reveal, do not send a code)
 *  - Admin email, correct password -> generate a 6-digit code, store its hash,
 *    email it to the OWNER, return { admin: true, sent: true }
 *
 * The account is only signed in after the code is verified inside authorize()
 * in auth.ts. A leaked password alone is therefore not enough to get in.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const adminCfg = await getAdminConfig();
  const isAdminLogin =
    email === adminCfg.loginName.trim().toLowerCase() ||
    email === RECOVERY_ADMIN_EMAIL;

  // Not the admin — nothing to do here; let the normal login flow handle it.
  if (!isAdminLogin) {
    return NextResponse.json({ admin: false });
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Admin 2FA needs email. Add RESEND_API_KEY to enable admin login." },
      { status: 501 }
    );
  }

  const ok = adminCfg.passwordHash
    ? await bcrypt.compare(password, adminCfg.passwordHash)
    : false;
  if (!ok) {
    // Same generic message the login page shows for a bad password.
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);

  const client = await clientPromise;
  const db = client.db();
  await db.collection<Admin2faDoc>("admin_2fa").updateOne(
    { _id: ADMIN_2FA_DOC_ID },
    {
      $set: {
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  try {
    await sendAdminLoginCode(code);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send the admin code." },
      { status: 502 }
    );
  }

  return NextResponse.json({ admin: true, sent: true });
}
