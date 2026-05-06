"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

type User = {
  id?: string;
  username?: string;
  name?: string;
  email?: string;
  isAdmin?: boolean;
};

type Comment = {
  id: string;
  author: string;
  authorId?: string;
  text: string;
  date: string;
  likes: number;
  dislikes: number;
  parentId?: string | null;
};

type Vote = "like" | "dislike" | null;

type FileItem = {
  name: string;
  url: string;
  size?: number;
  uploadedAt?: string;
  folder?: string;
};

const FOLDERS = ["images", "videos", "apps", "games", "files"] as const;
type Folder = (typeof FOLDERS)[number];

// Number of items shown on the homepage per section. The full list lives at /category/<folder>.
const PREVIEW_LIMIT = 6;

const SECTION_LABEL: Record<Folder, string> = {
  images: "Images",
  videos: "Videos",
  apps: "Apps",
  games: "Games",
  files: "Files",
};

const SECTION_ICON: Record<Folder, string> = {
  images: "fa-images",
  videos: "fa-video",
  apps: "fa-mobile-screen",
  games: "fa-gamepad",
  files: "fa-folder-open",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return iso; }
}

function isImageName(n: string)  { return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n); }
function isVideoName(n: string)  { return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(n); }
function isAudioName(n: string)  { return /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(n); }
function isPdfName(n: string)    { return /\.pdf$/i.test(n); }
function isTextName(n: string)   { return /\.(txt|md|csv|log|json|xml|html?|css|js|ts|tsx|jsx|py|java|c|cpp|cs)$/i.test(n); }
function isOfficeName(n: string) { return /\.(docx?|xlsx?|pptx?)$/i.test(n); }
function canPreview(n: string) {
  return isImageName(n) || isVideoName(n) || isAudioName(n) || isPdfName(n) || isTextName(n) || isOfficeName(n);
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [files, setFiles] = useState<Record<Folder, FileItem[]>>({
    images: [], videos: [], apps: [], games: [], files: [],
  });
  const [counts, setCounts] = useState<Record<Folder, number>>({
    images: 0, videos: 0, apps: 0, games: 0, files: 0,
  });
  const [uploading, setUploading] = useState<Folder | null>(null);
  const fileInputs = useRef<Record<Folder, HTMLInputElement | null>>({
    images: null, videos: null, apps: null, games: null, files: null,
  });

  const [comments, setComments] = useState<Comment[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [commentText, setCommentText] = useState("");
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
  const [commentsOpen, setCommentsOpen] = useState(false);

  type ViewerSize = "small" | "large" | "full";
  const [preview, setPreview] = useState<{ folder: Folder; item: FileItem } | null>(null);
  const [viewerSize, setViewerSize] = useState<ViewerSize>("large");

  // Hero search
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const q = searchQ.trim();
    if (!q) { setSearchResults([]); setSearchOpen(false); return; }
    setSearchLoading(true);
    setSearchOpen(true);
    const t = setTimeout(async () => {
      try {
        const url = new URL("/api/files/list", window.location.origin);
        url.searchParams.set("folder", "all");
        url.searchParams.set("q", q);
        url.searchParams.set("limit", "12");
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) { setSearchResults([]); return; }
        const data = await res.json();
        setSearchResults(Array.isArray(data.items) ? data.items : []);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ]);

  function openPreview(folder: Folder, item: FileItem) {
    if (canPreview(item.name)) {
      setPreview({ folder, item });
      setViewerSize("large");
    } else {
      const a = document.createElement("a");
      a.href = item.url; a.download = item.name; a.click();
    }
  }
  function closePreview() { setPreview(null); }
  async function deleteFromViewer() {
    if (!preview || !isAdmin) return;
    await handleDelete(preview.folder, preview.item);
    closePreview();
  }

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ilm_user");
      if (raw) {
        const parsed: User = JSON.parse(raw);
        setUser(parsed);
        setIsAdmin(!!parsed.isAdmin);
      }
    } catch { /* ignore */ }
    FOLDERS.forEach(refreshFolder);
    refreshComments();
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshComments() {
    try {
      const res = await fetch("/api/comments", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setComments(data);
    } catch { /* ignore */ }
  }

  async function refreshFolder(folder: Folder) {
    try {
      const res = await fetch(`/api/files/list?folder=${folder}&sort=date&order=desc&limit=${PREVIEW_LIMIT}`);
      if (!res.ok) return;
      const data = await res.json();
      const items: FileItem[] = Array.isArray(data.items) ? data.items : [];
      setFiles((prev) => ({ ...prev, [folder]: items }));
      setCounts((prev) => ({ ...prev, [folder]: typeof data.total === "number" ? data.total : items.length }));
    } catch { /* ignore */ }
  }

  async function handleDelete(folder: Folder, item: FileItem) {
    if (!isAdmin) return;
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/upload?url=${encodeURIComponent(item.url)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Delete failed"); return;
      }
      await refreshFolder(folder);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleFilePicked(folder: Folder, file: File) {
    setUploading(folder);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Upload failed"); return;
      }
      await refreshFolder(folder);
    } finally {
      setUploading(null);
    }
  }

  function logout() {
    sessionStorage.removeItem("ilm_user");
    setUser(null);
    setIsAdmin(false);
  }

  async function submitComment() {
    if (!user) return alert("Please log in to post a comment.");
    const text = commentText.trim();
    if (!text) return alert("Comment cannot be empty.");
    const author = user.username || user.name || user.email || "You";
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author, authorId: user.id, parentId: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || "Failed to post comment");
      }
      setCommentText("");
      await refreshComments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to post comment");
    }
  }

  async function submitReply(parentId: string) {
    if (!user) return alert("Please log in to reply.");
    const text = (replyText[parentId] || "").trim();
    if (!text) return;
    const author = user.username || user.name || user.email || "You";
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author, authorId: user.id, parentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || "Failed to post reply");
      }
      setReplyText((prev) => ({ ...prev, [parentId]: "" }));
      setReplyOpen((prev) => ({ ...prev, [parentId]: false }));
      setShowReplies((prev) => ({ ...prev, [parentId]: true }));
      await refreshComments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to post reply");
    }
  }

  async function voteComment(commentId: string, type: "like" | "dislike") {
    if (!user) return alert("Please log in to vote.");
    const current = votes[commentId] || null;
    const next: Vote = current === type ? null : type;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        let likes = c.likes, dislikes = c.dislikes;
        if (current === "like") likes = Math.max(0, likes - 1);
        if (current === "dislike") dislikes = Math.max(0, dislikes - 1);
        if (next === "like") likes += 1;
        if (next === "dislike") dislikes += 1;
        return { ...c, likes, dislikes };
      })
    );
    setVotes((prev) => ({ ...prev, [commentId]: next }));
    if (next) {
      try {
        await fetch("/api/comments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId, action: next }),
        });
      } catch { /* leave optimistic */ }
    }
  }

  async function removeComment(commentId: string) {
    if (!isAdmin) return;
    if (!confirm("Delete this comment and any replies?")) return;
    try {
      const res = await fetch(`/api/comments?id=${encodeURIComponent(commentId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || "Failed to delete");
      }
      await refreshComments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function blockAuthor(c: Comment) {
    if (!isAdmin) return;
    if (!confirm(`Block "${c.author}"?`)) return;
    try {
      const res = await fetch("/api/admin/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.author, email: c.author }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || "Failed to block user");
      }
      alert(`Blocked ${c.author}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to block user");
    }
  }

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesByParent: Record<string, Comment[]> = {};
  comments.forEach((c) => { if (c.parentId) (repliesByParent[c.parentId] ||= []).push(c); });

  function DeleteBadge({ folder, item }: { folder: Folder; item: FileItem }) {
    if (!isAdmin) return null;
    return (
      <button
        className="delete-badge"
        onClick={(e) => { e.stopPropagation(); handleDelete(folder, item); }}
        title="Delete"
        aria-label="Delete file"
      >✕</button>
    );
  }

  function AdminUploadCard({ folder, accept }: { folder: Folder; accept?: string }) {
    if (!isAdmin) return null;
    const isUp = uploading === folder;
    return (
      <div
        className="card admin-upload-card"
        onClick={() => fileInputs.current[folder]?.click()}
        title="Click to upload"
      >
        <input
          ref={(el) => { fileInputs.current[folder] = el; }}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFilePicked(folder, f);
            e.target.value = "";
          }}
        />
        <i className={`fas ${isUp ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} style={{ fontSize: 28, color: "#1976d2" }} />
        <div style={{ marginTop: 8, fontWeight: 600, color: "#0d47a1" }}>{isUp ? "Uploading…" : `Add ${SECTION_LABEL[folder].slice(0, -1)}`}</div>
      </div>
    );
  }

  function SectionHeader({ folder }: { folder: Folder }) {
    const total = counts[folder];
    const more = total > files[folder].length;
    return (
      <div className="section-header">
        <h2 className="section-title">
          <i className={`fas ${SECTION_ICON[folder]}`} /> {SECTION_LABEL[folder]}
          {total > 0 && <span className="section-count">{total}</span>}
        </h2>
        <Link href={`/category/${folder}`} className="section-view-all">
          {more ? `View all ${total}` : "Open"} <i className="fas fa-arrow-right" />
        </Link>
      </div>
    );
  }

  function renderCommentRow(c: Comment, isReply = false) {
    const myVote = votes[c.id] || null;
    return (
      <div key={c.id} className={`comment-row ${isReply ? "is-reply" : ""}`}>
        <div className="comment-head">
          <strong>{c.author}</strong>
          <span className="comment-date">{formatDate(c.date)}</span>
        </div>
        <div className="comment-text">{c.text}</div>
        <div className="comment-actions">
          <button className={`vote-btn like ${myVote === "like" ? "active" : ""}`} onClick={() => voteComment(c.id, "like")} aria-pressed={myVote === "like"}>👍 <span>{c.likes}</span></button>
          <button className={`vote-btn dislike ${myVote === "dislike" ? "active" : ""}`} onClick={() => voteComment(c.id, "dislike")} aria-pressed={myVote === "dislike"}>👎 <span>{c.dislikes}</span></button>
          {!isReply && <button className="reply-btn" onClick={() => setReplyOpen((p) => ({ ...p, [c.id]: !p[c.id] }))}>Reply</button>}
          {isAdmin && (
            <>
              <button className="delete-btn" onClick={() => removeComment(c.id)}>Delete</button>
              <button className="block-btn" onClick={() => blockAuthor(c)} title="Block this user from the site">Block</button>
            </>
          )}
        </div>
        {!isReply && replyOpen[c.id] && (
          <div className="reply-form">
            <textarea
              value={replyText[c.id] || ""}
              onChange={(e) => setReplyText((p) => ({ ...p, [c.id]: e.target.value }))}
              placeholder={user ? "Write a reply..." : "Log in to reply"}
              disabled={!user}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
              <button onClick={() => setReplyOpen((p) => ({ ...p, [c.id]: false }))}>Cancel</button>
              <button onClick={() => submitReply(c.id)} disabled={!user}>Post reply</button>
            </div>
          </div>
        )}
        {!isReply && repliesByParent[c.id]?.length > 0 && (
          <div className="reply-thread">
            <button className="show-replies" onClick={() => setShowReplies((p) => ({ ...p, [c.id]: !p[c.id] }))}>
              {showReplies[c.id]
                ? `Hide ${repliesByParent[c.id].length} repl${repliesByParent[c.id].length === 1 ? "y" : "ies"}`
                : `Show ${repliesByParent[c.id].length} repl${repliesByParent[c.id].length === 1 ? "y" : "ies"}`}
            </button>
            {showReplies[c.id] && (
              <div className="replies">{repliesByParent[c.id].map((r) => renderCommentRow(r, true))}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ilmkhona0">
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="site-header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((p) => !p)}
              className={`hamburger ${mobileMenuOpen ? "is-open" : ""}`}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
            <div className="site-title">ilmkhona0</div>
            <nav className="top-nav">
              {FOLDERS.map((f) => (
                <Link key={f} href={`/category/${f}`}>{SECTION_LABEL[f]}</Link>
              ))}
              <a href="#contact">Contact</a>
            </nav>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {user ? (
              <>
                <div className="username">{user.username || user.name || user.email}</div>
                {isAdmin && <Link href="/admin" className="admin-pill">Admin</Link>}
                <button onClick={logout} className="logout-pill">Logout</button>
              </>
            ) : (
              <Link href="/auth" className="login-register">Login / Register</Link>
            )}
          </div>
        </div>
      </header>

      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        {FOLDERS.map((f) => (
          <Link key={f} href={`/category/${f}`} onClick={() => setMobileMenuOpen(false)}>
            <i className={`fas ${SECTION_ICON[f]}`} /> {SECTION_LABEL[f]}
          </Link>
        ))}
        <a href="#contact" onClick={() => setMobileMenuOpen(false)}>
          <i className="fas fa-envelope" /> Contact
        </a>
        {isAdmin && (
          <>
            <div className="sidebar-divider" />
            <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
              <i className="fas fa-shield-halved" /> Admin
            </Link>
            <Link href="/admin/files" onClick={() => setMobileMenuOpen(false)}>
              <i className="fas fa-folder-tree" /> Manage files
            </Link>
            <Link href="/admin/upload" onClick={() => setMobileMenuOpen(false)}>
              <i className="fas fa-cloud-arrow-up" /> Upload
            </Link>
          </>
        )}
      </aside>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-inner">
          <div className="hero-eyebrow">Welcome to</div>
          <h1 className="hero-title">ilmkhona0</h1>
          <p className="hero-sub">Images, videos, apps, games and files — curated and shared in one place.</p>

          {/* Global search */}
          <div className="hero-search">
            <i className="fas fa-search" />
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => { if (searchQ.trim()) setSearchOpen(true); }}
              onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
              placeholder="Search images, videos, apps, games, files..."
            />
            {searchQ && (
              <button onClick={() => setSearchQ("")} className="hero-search-clear" aria-label="clear">✕</button>
            )}
            {searchOpen && (
              <div className="hero-search-results">
                {searchLoading && <div className="hero-search-status">Searching…</div>}
                {!searchLoading && searchResults.length === 0 && searchQ.trim() && (
                  <div className="hero-search-status">No matches for "{searchQ}".</div>
                )}
                {!searchLoading && searchResults.map((it) => (
                  <Link
                    key={it.url}
                    href={`/category/${it.folder || "files"}`}
                    className="hero-search-result"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <i className={`fas ${SECTION_ICON[(it.folder as Folder) || "files"]}`} />
                    <div>
                      <div className="hero-search-result-name">{it.name}</div>
                      <div className="hero-search-result-folder">{it.folder}</div>
                    </div>
                    <i className="fas fa-arrow-right hero-search-result-arrow" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="hero-stats">
            {FOLDERS.map((f) => (
              <Link key={f} href={`/category/${f}`} className="hero-stat">
                <i className={`fas ${SECTION_ICON[f]}`} />
                <div>
                  <div className="hero-stat-num">{counts[f]}</div>
                  <div className="hero-stat-label">{SECTION_LABEL[f]}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <main className="home-main">
        {FOLDERS.map((folder) => (
          <section key={folder} id={folder} className="home-section">
            <SectionHeader folder={folder} />
            <div className="row-scroll">
              <AdminUploadCard
                folder={folder}
                accept={
                  folder === "images" ? "image/*"
                  : folder === "videos" ? "video/*"
                  : undefined
                }
              />
              {files[folder].length === 0 && !isAdmin && (
                <div className="card empty-card">No {SECTION_LABEL[folder].toLowerCase()} yet</div>
              )}
              {files[folder].map((it) => (
                <div
                  key={it.url}
                  className="card preview-card"
                  onClick={() => openPreview(folder, it)}
                >
                  <DeleteBadge folder={folder} item={it} />
                  <div className="preview-card-media">
                    {isImageName(it.name) ? (
                      <img src={it.url} alt={it.name} loading="lazy" />
                    ) : isVideoName(it.name) ? (
                      <video src={it.url} preload="metadata" />
                    ) : (
                      <div className="preview-card-glyph">
                        <i className={`fas ${
                          isAudioName(it.name) ? "fa-music" :
                          isPdfName(it.name) ? "fa-file-pdf" :
                          isOfficeName(it.name) ? "fa-file-word" :
                          isTextName(it.name) ? "fa-file-lines" :
                          /\.(exe|msi|app|dmg)$/i.test(it.name) ? "fa-window-maximize" :
                          /\.apk$/i.test(it.name) ? "fa-mobile-screen" :
                          /\.(zip|rar|7z)$/i.test(it.name) ? "fa-file-zipper" :
                          "fa-file"
                        }`} />
                      </div>
                    )}
                  </div>
                  <div className="preview-card-name">{it.name}</div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Contact */}
        <section id="contact" className="home-section">
          <div className="section-header">
            <h2 className="section-title"><i className="fas fa-envelope" /> Contact</h2>
          </div>
          <div className="contact-row">
            <a href="https://github.com/ilmkhona0" target="_blank" rel="noreferrer" className="contact-link">
              <i className="fab fa-github" /> <span><strong>GitHub:</strong> ilmkhona0</span>
            </a>
            <a href="mailto:ilmkhona@gmail.com" className="contact-link">
              <i className="fas fa-envelope" /> <span><strong>Email:</strong> ilmkhona@gmail.com</span>
            </a>
            <a href="https://wa.me/" target="_blank" rel="noreferrer" className="contact-link">
              <i className="fab fa-whatsapp" /> <span><strong>WhatsApp:</strong> ilmkhona0</span>
            </a>
          </div>
        </section>
      </main>

      <button className="comments-fab" onClick={() => setCommentsOpen((p) => !p)} aria-label={commentsOpen ? "Close comments" : "Open comments"} title="Comments">
        <i className={commentsOpen ? "fas fa-times" : "fas fa-comment"} />
      </button>

      <div className={`comments-panel ${commentsOpen ? "open" : ""}`}>
        <div className="comments-panel-header">
          <span style={{ fontWeight: 700 }}>Comments</span>
          <button onClick={() => setCommentsOpen(false)} aria-label="Close" className="panel-close">✕</button>
        </div>
        <div className="comments-panel-body">
          {user ? (
            <div className="comment-form">
              <label className="comment-form-label">Your Comment</label>
              <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..." />
              <div style={{ marginTop: 8 }}>
                <button onClick={submitComment} className="submit-btn">Submit</button>
              </div>
            </div>
          ) : (
            <div style={{ color: "#666", padding: 8 }}>
              Only registered users can post comments. Please <Link href="/auth">register or log in</Link>.
            </div>
          )}
          <div className="comments-list">{topLevel.map((c) => renderCommentRow(c, false))}</div>
        </div>
      </div>

      <footer>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px", color: "#fff", textAlign: "center" }}>
          © {new Date().getFullYear()} ilmkhona0. All rights reserved.
        </div>
      </footer>

      {/* Lightbox preview */}
      {preview && (
        <div className="lightbox-backdrop" onClick={closePreview}>
          <div className={`lightbox-content size-${viewerSize}`} onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <span className="lightbox-title" title={preview.item.name}>{preview.item.name}</span>
              <div className="lightbox-toolbar">
                <div className="lightbox-size-group" role="group" aria-label="Window size">
                  <button className={`lightbox-action lightbox-size ${viewerSize === "small" ? "is-active" : ""}`} onClick={() => setViewerSize("small")} title="Small"><i className="fas fa-compress" /></button>
                  <button className={`lightbox-action lightbox-size ${viewerSize === "large" ? "is-active" : ""}`} onClick={() => setViewerSize("large")} title="Default"><i className="fas fa-window-maximize" /></button>
                  <button className={`lightbox-action lightbox-size ${viewerSize === "full" ? "is-active" : ""}`} onClick={() => setViewerSize("full")} title="Full screen"><i className="fas fa-expand" /></button>
                </div>
                <a href={preview.item.url} download={preview.item.name} target="_blank" rel="noreferrer" className="lightbox-action lightbox-download" title="Download">
                  <i className="fas fa-download" /> Download
                </a>
                {isAdmin && (
                  <button onClick={deleteFromViewer} className="lightbox-action lightbox-delete" title="Delete">
                    <i className="fas fa-trash" />
                  </button>
                )}
                <button onClick={closePreview} className="lightbox-action" title="Close">
                  <i className="fas fa-times" />
                </button>
              </div>
            </div>
            <div className="lightbox-body">
              {isImageName(preview.item.name) && <img src={preview.item.url} alt={preview.item.name} style={{ maxWidth: "100%", maxHeight: "100%", display: "block", margin: "0 auto" }} />}
              {isVideoName(preview.item.name) && <video src={preview.item.url} controls autoPlay style={{ width: "100%", maxHeight: "100%", background: "#000" }} />}
              {isAudioName(preview.item.name) && <audio src={preview.item.url} controls style={{ width: "100%" }} />}
              {isPdfName(preview.item.name) && <iframe src={preview.item.url} style={{ width: "100%", height: "100%", border: "none" }} />}
              {isTextName(preview.item.name) && <iframe src={preview.item.url} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />}
              {isOfficeName(preview.item.name) && (
                /^https?:\/\//i.test(preview.item.url) ? (
                  <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.item.url)}`} style={{ width: "100%", height: "100%", border: "none" }} />
                ) : (
                  <div style={{ padding: 16, color: "#666" }}>
                    Office documents can only be previewed when the file URL is publicly reachable.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
