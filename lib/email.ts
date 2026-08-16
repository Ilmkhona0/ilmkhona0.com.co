// Transactional email via Resend's REST API (no SDK dependency — just fetch).
// Configure with two env vars:
//   RESEND_API_KEY  — from https://resend.com (free tier ~3,000/month)
//   EMAIL_FROM      — e.g. "ilmkhona0 <noreply@ilmkhona0.com.co>" once your
//                     domain is verified in Resend; falls back to Resend's
//                     onboarding sender for early testing.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim());
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email service not configured.");
  const from = process.env.EMAIL_FROM || "ilmkhona0 <onboarding@resend.dev>";

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your ilmkhona0 verification code: ${code}`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;color:#0a2342;line-height:1.5">
          <h2 style="margin:0 0 8px">Verify your email</h2>
          <p style="margin:0 0 12px">Enter this code on ilmkhona0 to finish creating your account:</p>
          <p style="font-size:30px;font-weight:800;letter-spacing:6px;margin:0 0 12px">${code}</p>
          <p style="color:#667;margin:0">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
        </div>`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Could not send the verification email (${res.status}). ${detail.slice(0, 200)}`);
  }
}

// Where the admin login approval code is sent. This is ALWAYS the owner's
// inbox regardless of what login name was typed, so only the owner can approve
// an admin sign-in. Override with ADMIN_2FA_EMAIL if the owner address changes.
export function adminNotifyEmail(): string {
  return (process.env.ADMIN_2FA_EMAIL || "ilmkhona@gmail.com").trim();
}

/**
 * Emails a 6-digit approval code to the site owner when someone enters the
 * correct admin password. The login only completes after this code is entered,
 * so a leaked password alone is not enough to get in.
 */
export async function sendAdminLoginCode(code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email service not configured.");
  const from = process.env.EMAIL_FROM || "ilmkhona0 <onboarding@resend.dev>";
  const to = adminNotifyEmail();

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Admin login approval code: ${code}`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;color:#0a2342;line-height:1.5">
          <h2 style="margin:0 0 8px">Someone is signing in as admin</h2>
          <p style="margin:0 0 12px">A correct admin password was entered on ilmkhona0. To approve this sign-in, enter this code on the login screen:</p>
          <p style="font-size:30px;font-weight:800;letter-spacing:6px;margin:0 0 12px">${code}</p>
          <p style="color:#b00;margin:0 0 12px"><strong>If this wasn't you, do NOT share this code — and change your admin password.</strong></p>
          <p style="color:#667;margin:0">This code expires in 10 minutes.</p>
        </div>`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Could not send the admin code (${res.status}). ${detail.slice(0, 200)}`);
  }
}
