"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";

export default function LoginMenu() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"google" | "github" | "email" | null>(null);
  const [showPw, setShowPw] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + ESC.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function handleEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading("email");

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value || "";
    const password = (form.elements.namedItem("password") as HTMLInputElement)?.value || "";

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(null);
    if (!res || res.error) {
      setError("Email or password is incorrect.");
      return;
    }
    setOpen(false);
    // Refresh so the new session shows in the header.
    window.location.reload();
  }

  return (
    <div className="login-menu-wrap" ref={wrapRef}>
      <button
        className="login-register"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {open ? "Close" : "Login"}
      </button>

      {open && (
        <div className="login-menu" role="dialog" aria-label="Login">
          <h3 className="login-menu-title">Welcome to ilmkhona0</h3>
          <p className="login-menu-sub">Log in to comment, chat with the AI, and more.</p>

          <button
            className="oauth-btn google"
            onClick={() => { setLoading("google"); signIn("google", { callbackUrl: "/" }); }}
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
            onClick={() => { setLoading("github"); signIn("github", { callbackUrl: "/" }); }}
            disabled={!!loading}
          >
            <i className="fab fa-github" />
            {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
          </button>

          <div className="auth-sep"><span>or with email</span></div>

          <form onSubmit={handleEmail} className="auth-form">
            <label>Email</label>
            <input type="email" name="email" required autoComplete="email" placeholder="you@example.com" />

            <label>Password</label>
            <div className="pw-field">
              <input type={showPw ? "text" : "password"} name="password" required autoComplete="current-password" placeholder="At least 6 characters" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} title={showPw ? "Hide password" : "Show password"}>
                <i className={`fas ${showPw ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>

            <button type="submit" className="auth-submit" disabled={!!loading}>
              {loading === "email" ? "Working…" : "Continue"}
            </button>
          </form>

          <p className="login-menu-foot">
            New here? <a href="/auth" className="login-menu-link">Create an account</a>
          </p>

          {error && <p className="auth-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
