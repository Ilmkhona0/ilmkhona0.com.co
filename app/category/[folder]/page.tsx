"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import ShareButton from "../../components/ShareButton";
import { FileGlyph } from "@/lib/fileIcon";

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

/** Split a filename into base + extension. The extension is locked on rename —
 *  admins can change the name but never the file format. */
function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot > 0) return { base: name.slice(0, dot), ext: name.slice(dot) };
  return { base: name, ext: "" };
}

/** Split a (possibly path-prefixed) name into its directory and leaf parts. */
function splitPath(name: string): { dir: string; leaf: string } {
  const slash = name.lastIndexOf("/");
  if (slash >= 0) return { dir: name.slice(0, slash + 1), leaf: name.slice(slash + 1) };
  return { dir: "", leaf: name };
}

// Resize handles for the preview window: 4 edges + 4 corners.
const LB_HANDLES: { d: string; sx: number; sy: number }[] = [
  { d: "n", sx: 0, sy: -1 }, { d: "s", sx: 0, sy: 1 },
  { d: "e", sx: 1, sy: 0 }, { d: "w", sx: -1, sy: 0 },
  { d: "ne", sx: 1, sy: -1 }, { d: "nw", sx: -1, sy: -1 },
  { d: "se", sx: 1, sy: 1 }, { d: "sw", sx: -1, sy: 1 },
];

export default function CategoryPage({ params }: { params: Promise<{ folder: string }> }) {
  const { folder: rawFolder } = use(params);
  const folder = (FOLDERS.includes(rawFolder as Folder) ? rawFolder : "files") as Folder;

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Use the real NextAuth session (same source the home page uses) so the
  // header reflects the actual login state. The previous sessionStorage-based
  // check never got populated by Google/credential login, which is why folder
  // pages always showed "Login" even when signed in.
  const { data: session } = useSession();
  const user = session?.user;
  const isAdmin = !!user?.isAdmin;

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  const [order, setOrder] = useState<Order>("desc");

  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = useState<FileItem | null>(null);
  const [renamingUrl, setRenamingUrl] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Current sub-folder being viewed within this category (path with trailing /).
  const [subPath, setSubPath] = useState("");

  // Multi-select (admin) for bulk delete.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Free-form drag resize for the preview window (mouse + touch).
  const [lightboxDims, setLightboxDims] = useState<{ w: number; h: number } | null>(null);
  const lbResizeStart = useRef<{ x: number; y: number; w: number; h: number; sx: number; sy: number } | null>(null);
  function onLbResizeDown(e: React.PointerEvent<HTMLDivElement>, sx: number, sy: number) {
    e.preventDefault();
    e.stopPropagation();
    const box = e.currentTarget.parentElement as HTMLElement | null;
    if (!box) return;
    const r = box.getBoundingClientRect();
    lbResizeStart.current = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, sx, sy };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onLbResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = lbResizeStart.current;
    if (!s) return;
    // Centered modal: ×2 so the grabbed edge tracks the cursor; sx/sy pick edge.
    const dx = (e.clientX - s.x) * 2 * s.sx;
    const dy = (e.clientY - s.y) * 2 * s.sy;
    const w = Math.max(300, Math.min(window.innerWidth - 32, s.w + dx));
    const h = Math.max(240, Math.min(window.innerHeight - 32, s.h + dy));
    setLightboxDims({ w, h });
  }
  function onLbResizeUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!lbResizeStart.current) return;
    lbResizeStart.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  useEffect(() => {
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

  // Delete a whole folder = every file whose name sits under that folder path.
  async function handleDeleteFolder(folderName: string) {
    if (!isAdmin) return;
    const prefix = subPath + folderName + "/";
    const inside = items.filter((it) => it.name.startsWith(prefix));
    if (!inside.length) return;
    if (!confirm(`Delete folder "${folderName}" and all ${inside.length} file(s) inside? This cannot be undone.`)) return;
    for (const it of inside) {
      await fetch(`/api/admin/upload?url=${encodeURIComponent(it.url)}`, { method: "DELETE" });
    }
    await refresh();
  }

  function toggleSelect(url: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(url)) n.delete(url); else n.add(url);
      return n;
    });
  }
  function exitSelect() { setSelectMode(false); setSelected(new Set()); }
  async function bulkDelete() {
    if (!isAdmin || !selected.size) return;
    if (!confirm(`Delete ${selected.size} selected file(s)? This cannot be undone.`)) return;
    for (const url of selected) {
      await fetch(`/api/admin/upload?url=${encodeURIComponent(url)}`, { method: "DELETE" });
    }
    setSelected(new Set());
    setSelectMode(false);
    await refresh();
  }

  async function commitRename(it: FileItem) {
    const typed = renameValue.trim();
    setRenamingUrl(null);
    // Keep the folder path AND the extension — only the leaf base name changes.
    const { dir, leaf } = splitPath(it.name);
    const { ext } = splitName(leaf);
    const newBase = splitName(splitPath(typed).leaf).base || typed;
    if (!newBase) return;
    const newName = dir + newBase + ext;
    if (newName === it.name) return;
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
    signOut({ callbackUrl: "/" });
  }

  const empty = !loading && items.length === 0;

  // --- Folder grouping: turn path-named uploads into navigable folders ---
  const searching = q.trim().length > 0;
  const subFolders: string[] = [];
  const filesHere: FileItem[] = [];
  const seenFolders = new Set<string>();
  for (const it of items) {
    if (searching) { filesHere.push(it); continue; }
    if (!it.name.startsWith(subPath)) continue;
    const rest = it.name.slice(subPath.length);
    const slash = rest.indexOf("/");
    if (slash >= 0) {
      const f = rest.slice(0, slash);
      if (!seenFolders.has(f)) { seenFolders.add(f); subFolders.push(f); }
    } else {
      filesHere.push(it);
    }
  }
  const crumbs = subPath ? subPath.split("/").filter(Boolean) : [];

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
            <ShareButton className="cat-share" />
            {user ? (
              <>
                <div className={`user-chip ${isAdmin ? "" : "avatar-only"}`} title={user.email || user.name || ""}>
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="user-avatar user-avatar-fallback" aria-hidden="true">
                      {(user.username || user.name || user.email || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                  {/* Only the admin keeps the full name; regular users show just the avatar. */}
                  {isAdmin && (
                    <span className="username">{user.username || user.name || user.email}</span>
                  )}
                </div>
                {isAdmin && <span className="cat-admin-link" title="You are signed in as admin">Admin</span>}
                <button onClick={logout} className="cat-logout cat-logout-icon" aria-label="Log out" title="Log out">
                  <i className="fas fa-right-from-bracket" />
                </button>
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
            className="cat-select-toggle"
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          >
            <i className={`fas ${selectMode ? "fa-xmark" : "fa-square-check"}`} /> {selectMode ? "Cancel" : "Select"}
          </button>
        )}

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

      {selectMode && (
        <div className="cat-bulkbar">
          <span>{selected.size} selected</span>
          <button onClick={() => setSelected(new Set(filesHere.map((f) => f.url)))}>Select all</button>
          <button onClick={() => setSelected(new Set())}>Clear</button>
          <button className="cat-bulk-delete" onClick={bulkDelete} disabled={!selected.size}>
            <i className="fas fa-trash" /> Delete selected
          </button>
          <button onClick={exitSelect}>Done</button>
        </div>
      )}

      <main className="cat-grid-wrap">
        {loading && <div className="cat-loading">Loading…</div>}
        {empty && (
          <div className="cat-empty">
            <i className={`fas ${ICON[folder]}`} />
            <p>No {TITLE[folder].toLowerCase()} yet.</p>
            {isAdmin && <p style={{ opacity: .7, fontSize: 14 }}>Click the Upload button to add the first one.</p>}
          </div>
        )}
        {!searching && crumbs.length > 0 && (
          <div className="cat-breadcrumb">
            <button onClick={() => setSubPath("")}><i className="fas fa-house" /> {TITLE[folder]}</button>
            {crumbs.map((seg, i) => {
              const target = crumbs.slice(0, i + 1).join("/") + "/";
              return (
                <span key={target}>
                  <i className="fas fa-chevron-right cat-breadcrumb-sep" />
                  <button onClick={() => setSubPath(target)}>{seg}</button>
                </span>
              );
            })}
          </div>
        )}
        <div className="cat-grid">
          {!searching && subFolders.map((f) => (
            <article
              key={`dir-${f}`}
              className="cat-card cat-folder-card"
              onClick={() => setSubPath(subPath + f + "/")}
              title={`Open ${f}`}
            >
              {isAdmin && (
                <button
                  type="button"
                  className="cat-folder-delete"
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f); }}
                  title="Delete folder"
                  aria-label="Delete folder"
                >
                  <i className="fas fa-trash" />
                </button>
              )}
              <div className="cat-card-media cat-folder-media">
                <i className="fas fa-folder" />
              </div>
              <div className="cat-card-body">
                <h3 className="cat-card-title" title={f}>{f}</h3>
                <div className="cat-card-meta"><span><i className="fas fa-folder-open" /> Folder</span></div>
              </div>
            </article>
          ))}
          {filesHere.map((it) => (
            <article key={it.url} className={`cat-card ${selected.has(it.url) ? "is-selected" : ""}`}>
              {selectMode && (
                <button
                  type="button"
                  className={`cat-select-check ${selected.has(it.url) ? "is-on" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggleSelect(it.url); }}
                  aria-label={selected.has(it.url) ? "Deselect" : "Select"}
                >
                  <i className="fas fa-check" />
                </button>
              )}
              <div
                className="cat-card-media"
                onClick={() => {
                  if (selectMode) { toggleSelect(it.url); return; }
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
                    <FileGlyph name={it.name} folder={folder} />
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
                  <h3 className="cat-card-title" title={it.name}>{searching ? it.name : splitPath(it.name).leaf}</h3>
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
                        onClick={() => { setRenamingUrl(it.url); setRenameValue(splitName(splitPath(it.name).leaf).base); }}
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
          <div
            className={`lightbox-content ${lightboxDims ? "size-custom" : "size-large"}`}
            style={lightboxDims ? { width: lightboxDims.w, height: lightboxDims.h, maxHeight: "none" } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-header">
              <span className="lightbox-title">{preview.name}</span>
              <div className="lightbox-toolbar">
                <ShareButton className="lightbox-action lightbox-share" fileUrl={preview.url} fileName={splitPath(preview.name).leaf} fileSize={preview.size} text={splitPath(preview.name).leaf} />
                <a href={preview.url} download={preview.name} className="lightbox-action lightbox-download" title="Download" aria-label="Download">
                  <i className="fas fa-download" />
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
            {LB_HANDLES.map((hd) => (
              <div
                key={hd.d}
                className={`lightbox-resize lr-${hd.d}`}
                onPointerDown={(e) => onLbResizeDown(e, hd.sx, hd.sy)}
                onPointerMove={onLbResizeMove}
                onPointerUp={onLbResizeUp}
                role="separator"
                aria-label="Drag to resize preview"
              />
            ))}
          </div>
        </div>
      )}

      <footer className="cat-footer">© {new Date().getFullYear()} ilmkhona0</footer>
    </div>
  );
}
