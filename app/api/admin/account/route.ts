import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getAdminConfig, updateAdminConfig } from "@/lib/adminConfig";

/** GET /api/admin/account — return the current admin login name (admin only). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 401 });
  }
  const cfg = await getAdminConfig();
  return NextResponse.json({ loginName: cfg.loginName });
}

/**
 * POST /api/admin/account
 * Body: { currentPassword, loginName?, newPassword? }
 * Verifies the current password, then updates the login name and/or password.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    loginName?: string;
    newPassword?: string;
  };

  const currentPassword = body.currentPassword || "";
  const loginName = (body.loginName || "").trim();
  const newPassword = (body.newPassword || "").trim();

  // Require the current password for any change.
  const cfg = await getAdminConfig();
  const ok = await bcrypt.compare(currentPassword, cfg.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }

  if (!loginName && !newPassword) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  if (newPassword && newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters." },
      { status: 400 }
    );
  }

  await updateAdminConfig({
    loginName: loginName || undefined,
    newPassword: newPassword || undefined,
  });

  return NextResponse.json({ success: true, loginName: loginName || cfg.loginName });
}
