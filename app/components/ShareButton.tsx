"use client";

import { useEffect, useRef, useState } from "react";

// Above this size we don't pull the file into memory to share it — link only.
const FILE_SHARE_MAX = 50 * 1024 * 1024; // 50 MB

/**
 * Share button.
 *
 * Two modes:
 *  - Site share (no fileUrl): one click → native share sheet for the page URL,
 *    falling back to copying the link. Renders a plain <button>.
 *  - File share (fileUrl given): click opens a small menu offering "Share file"
 *    (the actual image/PDF/etc. via the Web Share API, when supported and small
 *    enough) and "Share link". On unsupported devices only the link is offered.
 */
export default function ShareButton({
  className,
  label,
  url,
  text,
  fileUrl,
  fileName,
  fileSize,
}: {
  className?: string;
  label?: string;
  url?: string;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const isFileContext = !!fileUrl;

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function absolute(u: string) {
    if (typeof window === "undefined") return u;
    return /^https?:\/\//i.test(u) ? u : window.location.origin + (u.startsWith("/") ? u : `/${u}`);
  }

  async function shareLink() {
    const link = absolute(
      url || fileUrl || (typeof window !== "undefined" ? window.location.origin : "https://ilmkhona0.com.co")
    );
    const data = {
      title: text || "ilmkhona0",
      text: text
        ? `Check out "${text}" on ilmkhona0.`
        : "Check out ilmkhona0 — images, videos, apps, games and files in one place.",
      url: link,
    };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share(data); setMenuOpen(false); return; } catch { /* cancelled/failed */ }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link to share:", link);
    }
    setMenuOpen(false);
  }

  async function shareFile() {
    if (!fileUrl) return shareLink();
    setBusy(true);
    try {
      const res = await fetch(absolute(fileUrl));
      const blob = await res.blob();
      const file = new File([blob], fileName || "file", { type: blob.type || "application/octet-stream" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] }) && typeof navigator.share === "function") {
        await navigator.share({ files: [file], title: fileName, text: text || fileName });
      } else {
        await shareLink();
      }
    } catch {
      await shareLink();
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  function canShareFiles() {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    return !!nav.canShare && typeof navigator.share === "function";
  }
  const tooBig = typeof fileSize === "number" && fileSize > FILE_SHARE_MAX;
  const fileShareAvailable = isFileContext && canShareFiles() && !tooBig;

  // Site context — plain button, preserves the original layout (header/sidebar).
  if (!isFileContext) {
    return (
      <button
        type="button"
        onClick={shareLink}
        className={className}
        aria-label="Share"
        title={copied ? "Link copied!" : "Share"}
      >
        <i className={`fas ${copied ? "fa-check" : "fa-share-nodes"}`} />
        {label ? <span>{copied ? " Copied!" : ` ${label}`}</span> : null}
      </button>
    );
  }

  // File context — button + dropdown menu.
  return (
    <div className="share-wrap" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className={className}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Share"
        title="Share"
        disabled={busy}
      >
        <i className={`fas ${busy ? "fa-spinner fa-spin" : "fa-share-nodes"}`} />
        {label ? <span>{` ${label}`}</span> : null}
      </button>
      {menuOpen && (
        <div className="share-menu" role="menu">
          {fileShareAvailable && (
            <button type="button" role="menuitem" onClick={shareFile}>
              <i className="fas fa-file-arrow-up" /> Share file
            </button>
          )}
          <button type="button" role="menuitem" onClick={shareLink}>
            <i className="fas fa-link" /> Share link
          </button>
          {!fileShareAvailable && (
            <div className="share-menu-note">
              {tooBig
                ? "File is large — link only."
                : "This device can only share the link."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
