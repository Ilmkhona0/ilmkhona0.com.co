// Auth page: Google, GitHub, email log in, and a verified email Sign up
// (email + password → 6-digit code → account created).
"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [view, setView] = useState<"login" | "signup" | "verify">("login");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState<"google" | "github" | "email" | "signup" | "verify" | null>(null);
  const [showPw, setShowPw] = useState(false);

  // Sign-up fields are controlled so we can reuse them after the code step.
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [code, setCode] = useState("");

  function switchView(v: "login" | "signup") {
    setView(v); setError(""); setInfo("");
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading("email");
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value || "";
    const password = (form.elements.namedItem("password") as HTMLInputElement)?.value || "";
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setLoading(null);
    if (!res || res.error) { setError("Email or password is incorrect."); return; }
    router.push(res.url || callbackUrl);
    router.refresh();
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

        <button
          className="oauth-btn github"
          onClick={() => { setLoading("github"); signIn("github", { callbackUrl }); }}
          disabled={!!loading}
        >
          <i className="fab fa-github" />
          {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
        </button>

        <div className="auth-sep"><span>or with email</span></div>

        {view !== "verify" && (
          <div className="auth-mode-toggle" role="tablist">
            <button type="button" role="tab" aria-selected={view === "login"} className={view === "login" ? "is-active" : ""} onClick={() => switchView("login")}>Log in</button>
            <button type="button" role="tab" aria-selected={view === "signup"} className={view === "signup" ? "is-active" : ""} onClick={() => switchView("signup")}>Sign up</button>
          </div>
        )}

        {view === "login" && (
          <form onSubmit={handleLogin} className="auth-form">
            <label>Email</label>
            <input type="email" name="email" required autoComplete="email" placeholder="you@example.com" />
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

        <p className="auth-foot">
          {view === "login"
            ? "New here? Choose Sign up to create an account."
            : view === "signup"
              ? "We'll email you a code to confirm your address."
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
