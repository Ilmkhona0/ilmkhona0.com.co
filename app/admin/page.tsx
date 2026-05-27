"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = !!session?.user?.isAdmin;

  const [loginName, setLoginName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/admin/account", { cache: "no-store" });
        if (res.ok) {
          const d = await res.json();
          if (d.loginName) setLoginName(d.loginName);
        }
      } catch { /* ignore */ }
    })();
  }, [isAdmin]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPassword && newPassword !== confirmPassword) {
      setMsg({ type: "err", text: "New passwords do not match." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          loginName: loginName.trim(),
          newPassword: newPassword.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: d.error || "Update failed." });
      } else {
        setMsg({ type: "ok", text: "Saved. Use your new credentials next time you log in." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Update failed." });
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="admin-home">
        <div className="admin-home-card"><h1>Loading…</h1></div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-home">
        <div className="admin-home-card">
          <Link href="/" className="admin-home-back"><i className="fas fa-arrow-left" /> Site</Link>
          <h1>Admin only</h1>
          <p>Please <Link href="/auth">log in as admin</Link> to access settings.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-home">
      <div className="admin-home-card">
        <Link href="/" className="admin-home-back"><i className="fas fa-arrow-left" /> Site</Link>
        <h1>Admin settings</h1>
        <p>
          Change your admin login name and password. Your Google account
          (ilmkhona@gmail.com) always stays admin as a recovery option, so you can
          never lock yourself out.
        </p>

        <form onSubmit={save} className="admin-account-form">
          <label>Admin login (email)</label>
          <input
            type="text"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            placeholder="you@example.com"
            autoComplete="username"
          />

          <label>New password <span className="admin-account-hint">(leave blank to keep current)</span></label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />

          <label>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />

          <label>Current password <span className="admin-account-hint">(required to save)</span></label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {msg && (
            <p className={msg.type === "ok" ? "admin-account-ok" : "admin-account-err"}>{msg.text}</p>
          )}

          <button type="submit" className="auth-submit" disabled={saving || !currentPassword}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
