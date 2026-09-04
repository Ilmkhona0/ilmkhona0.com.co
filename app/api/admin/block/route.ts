import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import clientPromise from "../../../../lib/mongodb";

/**
 * POST /api/admin/block
 *   body: { username?: string, email?: string }
 * Adds the user to the "blocked" collection so they can't log in,
 * register again, or post comments. Looks up the matching user
 * to capture both username AND email if only one is supplied.
 *
 * Admin-only via the NextAuth session. (This previously checked a "role" cookie
 * set by the old /api/auth/login route; that route is gone, nothing sets the
 * cookie, so every Block click was rejected as "Admin only".)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const username = (body.username || "").toString().trim() || undefined;
  const email = (body.email || "").toString().trim() || undefined;

  if (!username && !email) {
    return NextResponse.json(
      { error: "username or email required" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    // Look up the matching user so we capture both fields if available.
    const matched = await db.collection("users").findOne({
      $or: [
        ...(username ? [{ username }] : []),
        ...(email ? [{ email }] : []),
      ],
    });

    const finalUsername = matched?.username || username;
    const finalEmail = matched?.email || email;

    // Avoid duplicate entries: upsert on the unique pair we care about.
    await db.collection("blocked").updateOne(
      {
        $or: [
          ...(finalUsername ? [{ username: finalUsername }] : []),
          ...(finalEmail ? [{ email: finalEmail }] : []),
        ],
      },
      {
        $set: {
          username: finalUsername,
          email: finalEmail,
          blockedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      blocked: { username: finalUsername, email: finalEmail },
    });
  } catch (err) {
    console.error("POST /api/admin/block error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
