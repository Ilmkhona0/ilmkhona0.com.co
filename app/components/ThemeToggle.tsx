"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Read saved preference (or system preference) on first mount.
  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem("theme") as Theme | null);
    if (stored === "light" || stored === "dark") {
      apply(stored);
      return;
    }
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    apply(prefersDark ? "dark" : "light");
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch { /* ignore */ }
  }

  function toggle() { apply(theme === "dark" ? "light" : "dark"); }

  // Avoid flashing the wrong icon during hydration
  if (!mounted) {
    return (
      <button className="theme-toggle" aria-label="Theme toggle" disabled>
        <i className="fas fa-circle-half-stroke" />
      </button>
    );
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <i className={theme === "dark" ? "fas fa-sun" : "fas fa-moon"} />
    </button>
  );
}
