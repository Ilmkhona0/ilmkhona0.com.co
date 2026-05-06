"use client";

import { useState } from "react";
import Link from "next/link";

const FOLDERS = ["images", "videos", "apps", "games", "files"] as const;
type Folder = (typeof FOLDERS)[number];

const FOLDER_HINT: Record<Folder, string> = {
  images: "PNG, JPG, GIF, WebP, SVG…",
  videos: "MP4, WebM, MOV, MKV…",
  apps:   "EXE, MSI, APK, DMG, AppImage…",
  games:  "EXE, JAR, APK, ZIP, NES, GB…",
  files:  "Anything that isn't an image or video — PDF, ZIP, DOCX, etc.",
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState<Folder>("images");
  const [customName, setCustomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!file) { setError("Please select a file."); return; }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      if (customName.trim()) fd.append("customName", customName.trim());
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setResult({ url: data.url, name: data.name || file.name });
      setFile(null);
      setCustomName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const fullUrl = result
    ? (result.url.startsWith("http") ? result.url : (typeof window !== "undefined" ? window.location.origin + result.url : result.url))
    : "";

  async function copyUrl() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      alert("Copy failed — please copy the URL manually.");
    }
  }

  return (
    <div className="ilmkhona0 upload-page">
      <header className="upload-header">
        <Link href="/admin" className="upload-back"><i className="fas fa-arrow-left" /> Admin</Link>
        <h1><i className="fas fa-cloud-arrow-up" /> Upload File</h1>
      </header>

      <main className="upload-card-wrap">
        <form onSubmit={handleUpload} className="upload-card">
          <label className="upload-label">Folder</label>
          <div className="upload-folder-row">
            {FOLDERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFolder(f)}
                className={`upload-folder-pill ${folder === f ? "is-active" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>
          <p className="upload-folder-hint">{FOLDER_HINT[folder]}</p>

          <label className="upload-label">File</label>
          <label className={`upload-dropzone ${file ? "has-file" : ""}`}>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />
            {file ? (
              <div className="upload-file-info">
                <i className="fas fa-file" />
                <span>{file.name}</span>
                <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
              </div>
            ) : (
              <div className="upload-dropzone-empty">
                <i className="fas fa-cloud-arrow-up" />
                <span>Click to choose a file</span>
              </div>
            )}
          </label>

          <label className="upload-label">Custom name (optional)</label>
          <input
            className="upload-input"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={file?.name || "e.g. my-photo"}
          />
          <p className="upload-folder-hint">If you leave the extension off, the original one is kept.</p>

          <div className="upload-submit-row">
            <button type="submit" disabled={busy || !file} className="upload-submit-btn">
              {busy ? <><i className="fas fa-spinner fa-spin" /> Uploading…</> : <><i className="fas fa-cloud-arrow-up" /> Upload</>}
            </button>
          </div>

          {error && <div className="upload-error"><i className="fas fa-circle-exclamation" /> {error}</div>}
        </form>

        {result && (
          <div className="upload-result">
            <div className="upload-result-head">
              <i className="fas fa-circle-check" />
              <span>Uploaded as <strong>{result.name}</strong></span>
            </div>
            <div className="upload-result-url">
              <code>{fullUrl}</code>
              <button onClick={copyUrl} className="upload-copy-btn">
                <i className={`fas ${copied ? "fa-check" : "fa-copy"}`} /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="upload-result-actions">
              <a href={fullUrl} target="_blank" rel="noreferrer" className="upload-link-btn">
                <i className="fas fa-up-right-from-square" /> Open
              </a>
              <Link href="/admin/files" className="upload-link-btn">
                <i className="fas fa-folder-tree" /> Manage files
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
