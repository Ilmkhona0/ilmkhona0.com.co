// Auth page: Google, GitHub, email log in, and a verified email Sign up
// (email + password → 6-digit code → account created).
"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, getProviders } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [view, setView] = useState<"login" | "signup" | "verify" | "admin2fa">("login");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState<"google" | "github" | "email" | "signup" | "verify" | "admin2fa" | null>(null);
  const [showPw, setShowPw] = useState(false);

  // Sign-up fields are controlled so we can reuse them after the code step.
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [code, setCode] = useState("");

  // Admin credentials held between the password step and the 2FA code step.
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Which OAuth providers are actually configured on the server. A button is
  // only shown for a provider that exists, so a half-configured GitHub/Google
  // can never crash the login page with a "Configuration" error.
  const [providers, setProviders] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    getProviders().then((p) => setProviders(p ?? {})).catch(() => setProviders({}));
  }, []);

  // Fix: clicking "Continue with Google", then cancelling or pressing Back left
  // every button disabled until a page refresh. Browsers restore this page from
  // the back/forward cache with `loading` still set, and the buttons are
  // disabled while loading. `pageshow` fires on those cached returns, so we
  // clear the flag and re-enable the buttons — no refresh needed.
  useEffect(() => {
    const reset = () => setLoading(null);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  // If an OAuth provider sent us back with an error (e.g. the user cancelled),
  // show a friendly message instead of a silent, stuck page.
  useEffect(() => {
    if (params.get("error")) {
      setError("Sign-in didn't complete. Please try again.");
      setLoading(null);
    }
  }, [params]);

  function switchView(v: "login" | "signup") {
    setView(v); setError(""); setInfo("");
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setInfo("");
    setLoading("email");
    const form = e.currentTarget;
    // May be an email OR a username — the server handles both. Don't force
    // lowercase here so mixed-case usernames still match.
    const email = ((form.elements.namedItem("email") as HTMLInputElement)?.value || "").trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement)?.value || "";
    try {
      // Is this the admin account? Admin sign-in needs an emailed 6-digit code.
      const pre = await fetch("/api/auth/admin-2fa-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await pre.json().catch(() => ({}));

      if (data.admin === false) {
        // Normal user — sign in with just email + password.
        const res = await signIn("credentials", { email, password, redirect: false, callbackUrl });
        setLoading(null);
        if (!res || res.error) { setError("Email or password is incorrect."); return; }
        router.push(res.url || callbackUrl);
        router.refresh();
        return;
      }

      if (pre.ok && data.sent) {
        // Admin password was correct — a code was emailed to the owner.
        setAdminEmail(email);
        setAdminPassword(password);
        setCode("");
        setView("admin2fa");
        setInfo("A 6-digit approval code was emailed to the site owner. Enter it to finish signing in.");
        setLoading(null);
        return;
      }

      // Wrong admin password, or email not configured, etc.
      setError(data.error || "Email or password is incorrect.");
      setLoading(null);
    } catch {
      setError("Network error. Please try again.");
      setLoading(null);
    }
  }

  async function handleAdmin2fa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading("admin2fa");
    const res = await signIn("credentials", {
      email: adminEmail,
      password: adminPassword,
      code,
      redirect: false,
      callbackUrl,
    });
    setLoading(null);
    if (!res || res.error) { setError("Incorrect or expired code. Please try again."); return; }
    router.push(res.url || callbackUrl);
    router.refresh();
  }

  async function resendAdminCode() {
    setError(""); setInfo("");
    setLoading("admin2fa");
    try {
      const res = await fetch("/api/auth/admin-2fa-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sent) setError(data.error || "Could not resend the code.");
      else setInfo("A new code was emailed to the site owner.");
    } finally {
      setLoading(null);
    }
  }

  async function handleSignupStart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setInfo("");
    setLoading("signup");
    try {
      const res = await fetch("/api/auth/register-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: suEmail.trim().toLowerCase(), password: suPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not start sign up."); return; }
      setView("verify");
      setInfo(`We emailed a 6-digit code to ${suEmail.trim().toLowerCase()}. Enter it below to finish.`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading("verify");
    try {
      const res = await fetch("/api/auth/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: suEmail.trim().toLowerCase(), code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Verification failed."); setLoading(null); return; }
      // Account created — sign in with the credentials they just chose.
      const signRes = await signIn("credentials", {
        email: suEmail.trim().toLowerCase(),
        password: suPassword,
        redirect: false,
        callbackUrl,
      });
      setLoading(null);
      if (!signRes || signRes.error) {
        setError("Account created — please log in.");
        setView("login");
        return;
      }
      router.push(signRes.url || callbackUrl);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(null);
    }
  }

  async function resendCode() {
    setError(""); setInfo("");
    setLoading("signup");
    try {
      const res = await fetch("/api/auth/register-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: suEmail.trim().toLowerCase(), password: suPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Could not resend the code.");
      else setInfo(`New code sent to ${suEmail.trim().toLowerCase()}.`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">Welcome to ilmkhona0</h1>
        <p className="auth-sub">Sign in to comment, chat with the AI instructor, and more.</p>

        {Boolean(providers?.google) && (
        <button
          className="oauth-btn google"
          onClick={() => { setLoading("google"); signIn("google", { callbackUrl }); }}
          disabled={!!loading}
        >
          <span className="g-logo" aria-hidden="true">
            <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.7 35.7 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
          </span>
          {loading === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
        )}

        {Boolean(providers?.github) && (
        <button
          className="oauth-btn github"
          onClick={() => { setLoading("github"); signIn("github", { callbackUrl }); }}
          disabled={!!loading}
        >
          <i className="fab fa-github" />
          {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
        </button>
        )}

        <div className="auth-sep"><span>or with email</span></div>

        {(view === "login" || view === "signup") && (
          <div className="auth-mode-toggle" role="tablist">
            <button type="button" role="tab" aria-selected={view === "login"} className={view === "login" ? "is-active" : ""} onClick={() => switchView("login")}>Log in</button>
            <button type="button" role="tab" aria-selected={view === "signup"} className={view === "signup" ? "is-active" : ""} onClick={() => switchView("signup")}>Sign up</button>
          </div>
        )}

        {view === "login" && (
          <form onSubmit={handleLogin} className="auth-form">
            <label>Email or username</label>
            <input type="text" name="email" required autoComplete="username" placeholder="you@example.com or your username" />
            <label>Password</label>
            <div className="pw-field">
              <input type={showPw ? "text" : "password"} name="password" required autoComplete="current-password" placeholder="Your password" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                <i className={`fas ${showPw ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
            <button type="submit" className="auth-submit" disabled={!!loading}>{loading === "email" ? "Working…" : "Log in"}</button>
          </form>
        )}

        {view === "signup" && (
          <form onSubmit={handleSignupStart} className="auth-form">
            <label>Email</label>
            <input type="email" required autoComplete="email" placeholder="you@example.com" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} />
            <label>Password</label>
            <div className="pw-field">
              <input type={showPw ? "text" : "password"} required autoComplete="new-password" placeholder="At least 6 characters" value={suPassword} onChange={(e) => setSuPassword(e.target.value)} />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                <i className={`fas ${showPw ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
            <button type="submit" className="auth-submit" disabled={!!loading}>{loading === "signup" ? "Sending code…" : "Create account"}</button>
          </form>
        )}

        {view === "verify" && (
          <form onSubmit={handleVerify} className="auth-form">
            <label>Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button type="submit" className="auth-submit" disabled={!!loading || code.length < 6}>
              {loading === "verify" ? "Verifying…" : "Verify & create account"}
            </button>
            <div className="auth-verify-actions">
              <button type="button" onClick={resendCode} disabled={!!loading}>Resend code</button>
              <button type="button" onClick={() => switchView("signup")} disabled={!!loading}>Change email</button>
            </div>
          </form>
        )}

        {view === "admin2fa" && (
          <form onSubmit={handleAdmin2fa} className="auth-form">
            <label>Admin approval code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button type="submit" className="auth-submit" disabled={!!loading || code.length < 6}>
              {loading === "admin2fa" ? "Verifying…" : "Approve & sign in"}
            </button>
            <div className="auth-verify-actions">
              <button type="button" onClick={resendAdminCode} disabled={!!loading}>Resend code</button>
              <button
                type="button"
                onClick={() => { setView("login"); setError(""); setInfo(""); setCode(""); }}
                disabled={!!loading}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <p className="auth-foot">
          {view === "login"
            ? "New here? Choose Sign up to create an account."
            : view === "signup"
              ? "We'll email you a code to confirm your address."
              : view === "admin2fa"
                ? "Admin sign-in needs a code emailed to the site owner."
                : "Enter the code from your email to finish."}
        </p>

        {info && <p className="auth-info">{info}</p>}
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="auth-shell"><div className="auth-card">Loading…</div></div>}>
      <AuthInner />
    </Suspense>
  );
}
