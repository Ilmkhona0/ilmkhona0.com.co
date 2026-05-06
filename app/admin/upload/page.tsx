"use client";

import { useRef, useState } from "react";
import Link from "next/link";

const FOLDERS = ["images", "videos", "apps", "games", "files"] as const;
type Folder = (typeof FOLDERS)[number];

const FOLDER_HINT: Record<Folder, string> = {
  images: "PNG, JPG, GIF, WebP, SVG…",
  videos: "MP4, WebM, MOV, MKV…",
  apps:   "EXE, MSI, APK, DMG, AppImage…",
  games:  "EXE, JAR, APK, ZIP, NES, GB…",
  files:  "Anything else — PDFs, ZIPs, source code (.py .js .java .c .cpp .php .rb .go .rs …), whole folders, etc.",
};

const FOLDER_ACCEPT: Record<Folder, string | undefined> = {
  images: "image/*",
  videos: "video/*",
  apps:   ".apk,.ipa,.exe,.msi,.dmg,.app,.deb,.rpm,.appimage",
  games:  ".exe,.jar,.apk,.swf,.zip,.love,.nes,.gb,.gba,.nds",
  files:  undefined,
};

type Status = "pending" | "uploading" | "done" | "error";
type Row = {
  id: string;
  file: File;
  /** Path-with-slashes to upload as. For folder uploads this is webkitRelativePath. */
  outputName?: string;
  status: Status;
  url?: string;
  name?: string;
  error?: string;
};

function fmtBytes(b: number) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

// FileWithPath: browsers add this property when webkitdirectory is set on the input.
type FileWithPath = File & { webkitRelativePath?: string };

export default function UploadPage() {
  const [folder, setFolder] = useState<Folder>("images");
  const [rows, setRows] = useState<Row[]>([]);
  const [customName, setCustomName] = useState("");
  const [busy, setBusy] = useState(false);

  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  function addFiles(fileList: FileList | null, asFolder: boolean) {
    if (!fileList || !fileList.length) return;
    const next: Row[] = Array.from(fileList).map((file) => {
      const fwp = file as FileWithPath;
      const rel = asFolder && fwp.webkitRelativePath ? fwp.webkitRelativePath : "";
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        outputName: rel || undefined,
        status: "pending" as Status,
      };
    });
    setRows((prev) => [...prev, ...next]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function clearDone() {
    setRows((prev) => prev.filter((r) => r.status !== "done"));
  }

  function clearAll() {
    setRows([]);
    setCustomName("");
  }

  async function uploadOne(row: Row, useCustomName: boolean): Promise<Row> {
    const fd = new FormData();
    fd.append("file", row.file);
    fd.append("folder", folder);
    // Priority: per-row outputName (folder upload) → single-file customName → none
    if (row.outputName) {
      fd.append("customName", row.outputName);
    } else if (useCustomName && customName.trim()) {
      fd.append("customName", customName.trim());
    }
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ...row, status: "error", error: data.error || `Upload failed (${res.status})` };
      }
      return { ...row, status: "done", url: data.url, name: data.name || row.outputName || row.file.name };
    } catch (err) {
      return { ...row, status: "error", error: err instanceof Error ? err.message : "Upload failed" };
    }
  }

  async function uploadAll(e: React.FormEvent) {
    e.preventDefault();
    const pending = rows.filter((r) => r.status === "pending" || r.status === "error");
    if (!pending.length) return;
    setBusy(true);

    setRows((prev) =>
      prev.map((r) => (r.status === "pending" || r.status === "error" ? { ...r, status: "uploading", error: undefined } : r))
    );

    const useCustomName = pending.length === 1 && !pending[0].outputName;
    const queue = [...pending];
    const concurrency = Math.min(4, queue.length);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push((async () => {
        while (queue.length) {
          const next = queue.shift();
          if (!next) break;
          const result = await uploadOne(next, useCustomName);
          setRows((prev) => prev.map((r) => (r.id === next.id ? result : r)));
        }
      })());
    }
    await Promise.all(workers);

    setBusy(false);
    if (useCustomName) setCustomName("");
  }

  const pendingCount = rows.filter((r) => r.status === "pending" || r.status === "error").length;
  const doneCount = rows.filter((r) => r.status === "done").length;
  const totalSize = rows.reduce((s, r) => s + r.file.size, 0);
  const hasFolderUpload = rows.some((r) => !!r.outputName);

  return (
    <div className="ilmkhona0 upload-page">
      <header className="upload-header">
        <Link href="/admin" className="upload-back"><i className="fas fa-arrow-left" /> Admin</Link>
        <h1><i className="fas fa-cloud-arrow-up" /> Upload Files</h1>
      </header>

      <main className="upload-card-wrap">
        <form onSubmit={uploadAll} className="upload-card">
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

          <label className="upload-label">What to upload</label>

          {/* Hidden inputs */}
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept={FOLDER_ACCEPT[folder]}
            style={{ display: "none" }}
            onChange={(e) => { addFiles(e.target.files, false); e.target.value = ""; }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => { addFiles(e.target.files, true); e.target.value = ""; }}
            // webkitdirectory + directory enable folder selection in Chromium / Safari / Firefox
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          />

          <div className="upload-pickers">
            <button
              type="button"
              className="upload-picker-btn"
              onClick={() => filesInputRef.current?.click()}
            >
              <i className="fas fa-file-circle-plus" />
              <strong>Choose files</strong>
              <span>One or many — Ctrl/Cmd-click to multi-select.</span>
            </button>
            <button
              type="button"
              className="upload-picker-btn"
              onClick={() => folderInputRef.current?.click()}
            >
              <i className="fas fa-folder-tree" />
              <strong>Choose a whole folder</strong>
              <span>Subfolders are preserved as paths in storage.</span>
            </button>
          </div>

          {/* Selected file list */}
          {rows.length > 0 && (
            <div className="upload-rows">
              <div className="upload-rows-summary">
                <span>
                  <strong>{rows.length}</strong> file{rows.length === 1 ? "" : "s"} · {fmtBytes(totalSize)}
                  {hasFolderUpload && <> · <span style={{ color: "var(--brand-700)" }}>folder structure preserved</span></>}
                </span>
                <span className="upload-rows-actions">
                  {doneCount > 0 && (
                    <button type="button" onClick={clearDone} className="upload-clear-done">
                      Clear {doneCount} uploaded
                    </button>
                  )}
                  {!busy && rows.length > 0 && (
                    <button type="button" onClick={clearAll} className="upload-clear-done">
                      Clear all
                    </button>
                  )}
                </span>
              </div>
              <div className="upload-rows-scroll">
                {rows.map((r) => (
                  <div key={r.id} className={`upload-row status-${r.status}`}>
                    <i className={`fas ${
                      r.status === "uploading" ? "fa-spinner fa-spin" :
                      r.status === "done" ? "fa-circle-check" :
                      r.status === "error" ? "fa-circle-exclamation" :
                      r.outputName ? "fa-folder-tree" : "fa-file"
                    }`} />
                    <div className="upload-row-info">
                      <div className="upload-row-name" title={r.outputName || r.file.name}>
                        {r.name || r.outputName || r.file.name}
                      </div>
                      <div className="upload-row-meta">
                        {fmtBytes(r.file.size)}
                        {r.status === "done" && r.url && (
                          <> · <a href={r.url} target="_blank" rel="noreferrer">view</a></>
                        )}
                        {r.status === "error" && r.error && <> · <span className="upload-row-error">{r.error}</span></>}
                      </div>
                    </div>
                    {r.status !== "uploading" && (
                      <button
                        type="button"
                        className="upload-row-remove"
                        onClick={() => removeRow(r.id)}
                        title="Remove from list"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom name only when uploading a single non-folder file */}
          {rows.length === 1 && !rows[0].outputName && rows[0].status !== "done" && (
            <>
              <label className="upload-label">Custom name (optional)</label>
              <input
                className="upload-input"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={rows[0].file.name}
              />
              <p className="upload-folder-hint">
                Single-file uploads only. To organise multiple files, use a folder upload (paths are preserved automatically).
              </p>
            </>
          )}

          <div className="upload-submit-row">
            <button
              type="submit"
              disabled={busy || pendingCount === 0}
              className="upload-submit-btn"
            >
              {busy ? (
                <><i className="fas fa-spinner fa-spin" /> Uploading {pendingCount}…</>
              ) : pendingCount > 0 ? (
                <><i className="fas fa-cloud-arrow-up" /> Upload {pendingCount} file{pendingCount === 1 ? "" : "s"}</>
              ) : (
                <><i className="fas fa-cloud-arrow-up" /> Upload</>
              )}
            </button>

            {doneCount > 0 && !busy && (
              <Link href="/admin/files" className="upload-link-btn">
                <i className="fas fa-folder-tree" /> Manage files
              </Link>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
