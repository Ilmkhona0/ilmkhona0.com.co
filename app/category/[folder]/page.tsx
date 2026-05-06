"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";

type FileItem = {
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  folder: string;
};

const FOLDERS = ["images", "videos", "apps", "games", "files"] as const;
type Folder = (typeof FOLDERS)[number];
type Sort = "date" | "name" | "size" | "type";
type Order = "asc" | "desc";

const ICON: Record<Folder, string> = {
  images: "fa-images",
  videos: "fa-video",
  apps: "fa-mobile-screen",
  games: "fa-gamepad",
  files: "fa-folder-open",
};

const TITLE: Record<Folder, string> = {
  images: "Images",
  videos: "Videos",
  apps: "Apps",
  games: "Games",
  files: "Files",
};

const ACCEPT: Record<Folder, string | undefined> = {
  images: "image/*",
  videos: "video/*",
  apps: ".apk,.exe,.msi,.dmg,.app,.deb,.rpm,.appimage,.ipa",
  games: ".exe,.jar,.apk,.swf,.zip,.love,.nes,.gb,.gba,.nds",
  files: undefined,
};

function isImageName(n: string) { return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n); }
function isVideoName(n: string) { return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(n); }
function isAudioName(n: string) { return /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(n); }
function isPdfName(n: string)   { return /\.pdf$/i.test(n); }
function isTextName(n: string)  {
  return /\.(txt|md|markdown|csv|tsv|log|json|jsonl|ndjson|xml|ya?ml|toml|ini|conf|cfg|env|html?|x?html|css|scss|sass|less|js|mjs|cjs|ts|tsx|jsx|vue|svelte|astro|py|pyw|rb|php|java|kt|kts|scala|groovy|c|h|cc|cpp|cxx|hpp|hxx|m|mm|cs|vb|fs|go|rs|swift|dart|lua|pl|pm|r|jl|sh|bash|zsh|fish|ps1|bat|cmd|sql|graphql|gql|proto|sol|tex|asm|s|nim|zig|hs|clj|cljs|ex|exs|erl|hrl|elm|ml|mli|pas|pp|d|coffee|patch|diff|gitignore|dockerignore|editorconfig|prettierrc|eslintrc|env|lock)$/i.test(n);
}
function isOfficeName(n: string){ return /\.(docx?|xlsx?|pptx?)$/i.test(n); }
function canPreview(n: string) {
  return isImageName(n) || isVideoName(n) || isAudioName(n) || isPdfName(n) || isTextName(n) || isOfficeName(n);
}

function formatBytes(b: number) {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

export default function CategoryPage({ params }: { params: Promise<{ folder: string }> }) {
  const { folder: rawFolder } = use(params);
  const folder = (FOLDERS.includes(rawFolder as Folder) ? rawFolder : "files") as Folder;

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<{ username?: string; name?: string; email?: string } | null>(null);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  const [order, setOrder] = useState<Order>("desc");

  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = useState<FileItem | null>(null);
  const [renamingUrl, setRenamingUrl] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ilm_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUser(parsed);
        setIsAdmin(!!parsed.isAdmin);
      }
    } catch { /* ignore */ }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, sort, order, q]);

  async function refresh() {
    setLoading(true);
    try {
      const url = new URL("/api/files/list", window.location.origin);
      url.searchParams.set("folder", folder);
      url.searchParams.set("sort", sort);
      url.searchParams.set("order", order);
      if (q) url.searchParams.set("q", q);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) { setItems([]); return; }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(files: FileList) {
    if (!files.length) return;
    setUploading(true);
    const failures: string[] = [];
    try {
      const queue = Array.from(files);
      const concurrency = Math.min(4, queue.length);
      const workers: Promise<void>[] = [];
      for (let i = 0; i < concurrency; i++) {
        workers.push((async () => {
          while (queue.length) {
            const f = queue.shift();
            if (!f) break;
            const fd = new FormData();
            fd.append("file", f);
            fd.append("folder", folder);
            try {
              const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
              if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                failures.push(`${f.name}: ${d.error || res.status}`);
              }
            } catch (err) {
              failures.push(`${f.name}: ${err instanceof Error ? err.message : "network error"}`);
            }
          }
        })());
      }
      await Promise.all(workers);
      if (failures.length) alert(`Some uploads failed:\n${failures.join("\n")}`);
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(it: FileItem) {
    if (!isAdmin) return;
    if (!confirm(`Delete "${it.name}"?`)) return;
    const res = await fetch(`/api/admin/upload?url=${encodeURIComponent(it.url)}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Delete failed");
      return;
    }
    await refresh();
  }

  async function commitRename(it: FileItem) {
    const newName = renameValue.trim();
    setRenamingUrl(null);
    if (!newName || newName === it.name) return;
    const res = await fetch("/api/admin/upload", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: it.url, newName, folder }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Rename failed");
      return;
    }
    await refresh();
  }

  function logout() {
    sessionStorage.removeItem("ilm_user");
    setUser(null);
    setIsAdmin(false);
  }

  const empty = !loading && items.length === 0;

  // header gradient varies by folder for visual distinction
  const headerGradient = useMemo(() => {
    const grads: Record<Folder, string> = {
      images: "linear-gradient(135deg,#6366f1 0%,#22d3ee 100%)",
      videos: "linear-gradient(135deg,#ec4899 0%,#f59e0b 100%)",
      apps:   "linear-gradient(135deg,#10b981 0%,#3b82f6 100%)",
      games:  "linear-gradient(135deg,#a855f7 0%,#ef4444 100%)",
      files:  "linear-gradient(135deg,#0ea5e9 0%,#1e3a8a 100%)",
    };
    return grads[folder];
  }, [folder]);

  return (
    <div className="ilmkhona0 cat-page">
      <header className="cat-header" style={{ background: headerGradient }}>
        <div className="cat-header-inner">
          <Link href="/" className="cat-back">
            <i className="fas fa-arrow-left" /> Home
          </Link>
          <div className="cat-title-block">
            <i className={`fas ${ICON[folder]} cat-title-icon`} />
            <h1 className="cat-title">{TITLE[folder]}</h1>
            <span className="cat-count">{items.length}</span>
          </div>
          <div className="cat-user-block">
            {user ? (
              <>
                <span className="username" style={{ color: "#fff" }}>{user.username || user.name || user.email}</span>
                {isAdmin && <Link href="/admin" className="cat-admin-link">Admin</Link>}
                <button onClick={logout} className="cat-logout">Logout</button>
              </>
            ) : (
              <Link href="/auth" className="cat-admin-link">Login</Link>
            )}
          </div>
        </div>
      </header>

      <div className="cat-toolbar">
        <div className="cat-search">
          <i className="fas fa-search" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${TITLE[folder].toLowerCase()}...`}
          />
          {q && <button onClick={() => setQ("")} className="cat-search-clear" aria-label="clear">✕</button>}
        </div>

        <div className="cat-sort-group">
          <label className="cat-sort-label">Sort</label>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="cat-select">
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
          </select>
          <button
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="cat-order-btn"
            title={order === "asc" ? "Ascending" : "Descending"}
          >
            <i className={`fas ${order === "asc" ? "fa-arrow-up-short-wide" : "fa-arrow-down-wide-short"}`} />
          </button>
        </div>

        {isAdmin && (
          <button
            className="cat-upload-btn"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            <i className="fas fa-cloud-arrow-up" /> {uploading ? "Uploading..." : `Upload ${TITLE[folder].slice(0, -1)}`}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT[folder]}
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const fs = e.target.files;
                if (fs && fs.length) handleUpload(fs);
                e.target.value = "";
              }}
            />
          </button>
        )}
      </div>

      <main className="cat-grid-wrap">
        {loading && <div className="cat-loading">Loading…</div>}
        {empty && (
          <div className="cat-empty">
            <i className={`fas ${ICON[folder]}`} />
            <p>No {TITLE[folder].toLowerCase()} yet.</p>
            {isAdmin && <p style={{ opacity: .7, fontSize: 14 }}>Click the Upload button to add the first one.</p>}
          </div>
        )}
        <div className="cat-grid">
          {items.map((it) => (
            <article key={it.url} className="cat-card">
              <div
                className="cat-card-media"
                onClick={() => {
                  if (canPreview(it.name)) {
                    setPreview(it);
                  } else {
                    const a = document.createElement("a");
                    a.href = it.url;
                    a.download = it.name;
                    a.click();
                  }
                }}
              >
                {isImageName(it.name) ? (
                  <img src={it.url} alt={it.name} loading="lazy" />
                ) : isVideoName(it.name) ? (
                  <video src={it.url} preload="metadata" />
                ) : (
                  <div className="cat-card-glyph">
                    <i className={`fas ${
                      isAudioName(it.name) ? "fa-music" :
                      isPdfName(it.name) ? "fa-file-pdf" :
                      isOfficeName(it.name) ? "fa-file-word" :
                      /\.(py|pyw|rb|php|java|kt|scala|c|h|cc|cpp|cxx|hpp|cs|vb|fs|go|rs|swift|dart|lua|pl|r|jl|js|mjs|cjs|ts|tsx|jsx|vue|svelte|sh|bash|ps1|bat|cmd|sql|graphql|sol|asm|nim|zig|hs|clj|ex|erl|elm|ml|coffee)$/i.test(it.name) ? "fa-file-code" :
                      isTextName(it.name) ? "fa-file-lines" :
                      /\.(exe|msi|app|dmg)$/i.test(it.name) ? "fa-window-maximize" :
                      /\.apk$/i.test(it.name) ? "fa-mobile-screen" :
                      /\.(zip|rar|7z|tar|gz)$/i.test(it.name) ? "fa-file-zipper" :
                      "fa-file"
                    }`} />
                  </div>
                )}
              </div>
              <div className="cat-card-body">
                {renamingUrl === it.url ? (
                  <input
                    autoFocus
                    className="cat-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(it)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(it);
                      if (e.key === "Escape") setRenamingUrl(null);
                    }}
                  />
                ) : (
                  <h3 className="cat-card-title" title={it.name}>{it.name}</h3>
                )}
                <div className="cat-card-meta">
                  <span><i className="far fa-clock" /> {formatDate(it.uploadedAt)}</span>
                  <span><i className="fas fa-database" /> {formatBytes(it.size)}</span>
                </div>
                <div className="cat-card-actions">
                  <a href={it.url} download={it.name} className="cat-action cat-action-primary" title="Download">
                    <i className="fas fa-download" />
                  </a>
                  {canPreview(it.name) && (
                    <button className="cat-action" onClick={() => setPreview(it)} title="Preview">
                      <i className="fas fa-eye" />
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        className="cat-action"
                        onClick={() => { setRenamingUrl(it.url); setRenameValue(it.name); }}
                        title="Rename"
                      >
                        <i className="fas fa-pen" />
                      </button>
                      <button className="cat-action cat-action-danger" onClick={() => handleDelete(it)} title="Delete">
                        <i className="fas fa-trash" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* Lightbox preview */}
      {preview && (
        <div className="lightbox-backdrop" onClick={() => setPreview(null)}>
          <div className="lightbox-content size-large" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <span className="lightbox-title">{preview.name}</span>
              <div className="lightbox-toolbar">
                <a href={preview.url} download={preview.name} className="lightbox-action lightbox-download">
                  <i className="fas fa-download" /> Download
                </a>
                <button onClick={() => setPreview(null)} className="lightbox-action">
                  <i className="fas fa-times" />
                </button>
              </div>
            </div>
            <div className="lightbox-body">
              {isImageName(preview.name) && <img src={preview.url} alt={preview.name} style={{ maxWidth: "100%", maxHeight: "100%" }} />}
              {isVideoName(preview.name) && <video src={preview.url} controls autoPlay style={{ width: "100%", maxHeight: "100%", background: "#000" }} />}
              {isAudioName(preview.name) && <audio src={preview.url} controls style={{ width: "100%" }} />}
              {isPdfName(preview.name) && <iframe src={preview.url} style={{ width: "100%", height: "100%", border: "none" }} />}
              {isTextName(preview.name) && <iframe src={preview.url} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />}
              {isOfficeName(preview.name) && /^https?:\/\//i.test(preview.url) && (
                <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.url)}`} style={{ width: "100%", height: "100%", border: "none" }} />
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="cat-footer">© {new Date().getFullYear()} ilmkhona0</footer>
    </div>
  );
}
