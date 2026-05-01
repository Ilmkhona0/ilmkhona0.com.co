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
};

const FOLDERS = ["images", "videos", "apps", "games", "files"] as const;
type Folder = (typeof FOLDERS)[number];

function MediaPlaceholder({ label, height = 140 }: { label: string; height?: number }) {
  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 8,
        background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
        color: "#e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        letterSpacing: 1,
        fontSize: 14,
        textAlign: "center",
        padding: 8,
      }}
    >
      {label}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

// File-type detection by extension
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

  // Real uploads, fetched per folder
  const [files, setFiles] = useState<Record<Folder, FileItem[]>>({
    images: [], videos: [], apps: [], games: [], files: [],
  });
  const [uploading, setUploading] = useState<Folder | null>(null);
  const fileInputs = useRef<Record<Folder, HTMLInputElement | null>>({
    images: null, videos: null, apps: null, games: null, files: null,
  });

  // Comments
  const [comments, setComments] = useState<Comment[]>([
    { id: "c1", author: "Alice", text: "Sample image looks great!", date: "2026-04-28T12:00:00Z", likes: 3, dislikes: 0, parentId: null },
    { id: "c2", author: "Bob",   text: "Nice collection.",          date: "2026-04-29T09:30:00Z", likes: 1, dislikes: 0, parentId: null },
    { id: "c3", author: "Bob",   text: "Thanks Alice!",              date: "2026-04-29T15:45:00Z", likes: 0, dislikes: 0, parentId: "c1" },
  ]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [commentText, setCommentText] = useState("");
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
  const [commentsOpen, setCommentsOpen] = useState(false);

  // Lightbox / preview modal
  type ViewerSize = "small" | "large" | "full";
  const [preview, setPreview] = useState<{ folder: Folder; item: FileItem } | null>(null);
  const [viewerSize, setViewerSize] = useState<ViewerSize>("large");
  function openPreview(folder: Folder, item: FileItem) {
    if (canPreview(item.name)) {
      setPreview({ folder, item });
      setViewerSize("large"); // reset to default each time we open
    } else {
      // Non-previewable (e.g. .exe, .apk) -> trigger download
      const a = document.createElement("a");
      a.href = item.url;
      a.download = item.name;
      a.click();
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
    } catch {
      // ignore
    }
    // load all folders in parallel
    FOLDERS.forEach(refreshFolder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshFolder(folder: Folder) {
    try {
      const res = await fetch(`/api/files/list?folder=${folder}`);
      if (!res.ok) return;
      const data = await res.json();
      setFiles((prev) => ({ ...prev, [folder]: Array.isArray(data.items) ? data.items : [] }));
    } catch {
      // ignore network errors so the UI still renders
    }
  }

  async function handleDelete(folder: Folder, item: FileItem) {
    if (!isAdmin) return;
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/upload?url=${encodeURIComponent(item.url)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Delete failed");
        return;
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
        alert(data.error || "Upload failed");
        return;
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

  function submitComment() {
    if (!user) return alert("Please log in to post a comment.");
    const text = commentText.trim();
    if (!text) return alert("Comment cannot be empty.");
    const newComment: Comment = {
      id: `c${Date.now()}`,
      author: user.username || user.name || user.email || "You",
      authorId: user.id,
      text,
      date: new Date().toISOString(),
      likes: 0, dislikes: 0, parentId: null,
    };
    setComments((prev) => [newComment, ...prev]);
    setCommentText("");
  }

  function submitReply(parentId: string) {
    if (!user) return alert("Please log in to reply.");
    const text = (replyText[parentId] || "").trim();
    if (!text) return;
    const newReply: Comment = {
      id: `c${Date.now()}`,
      author: user.username || user.name || user.email || "You",
      authorId: user.id,
      text,
      date: new Date().toISOString(),
      likes: 0, dislikes: 0, parentId,
    };
    setComments((prev) => [...prev, newReply]);
    setReplyText((prev) => ({ ...prev, [parentId]: "" }));
    setReplyOpen((prev) => ({ ...prev, [parentId]: false }));
    setShowReplies((prev) => ({ ...prev, [parentId]: true }));
  }

  function voteComment(commentId: string, type: "like" | "dislike") {
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
  }

  function removeComment(commentId: string) {
    if (!isAdmin) return;
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
  }

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesByParent: Record<string, Comment[]> = {};
  comments.forEach((c) => { if (c.parentId) (repliesByParent[c.parentId] ||= []).push(c); });

  // Reusable admin delete badge (absolute-positioned ✕)
  function DeleteBadge({ folder, item }: { folder: Folder; item: FileItem }) {
    if (!isAdmin) return null;
    return (
      <button
        className="delete-badge"
        onClick={(e) => { e.stopPropagation(); handleDelete(folder, item); }}
        title="Delete"
        aria-label="Delete file"
      >
        ✕
      </button>
    );
  }

  // Reusable admin upload card
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
        <div style={{ fontSize: 32, lineHeight: 1 }}>{isUp ? "…" : "+"}</div>
        <div style={{ marginTop: 6, fontWeight: 600 }}>{isUp ? "Uploading" : `Add ${folder.slice(0, -1)}`}</div>
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
          <button
            className={`vote-btn like ${myVote === "like" ? "active" : ""}`}
            onClick={() => voteComment(c.id, "like")}
            aria-pressed={myVote === "like"}
            title="Like"
          >👍 <span>{c.likes}</span></button>
          <button
            className={`vote-btn dislike ${myVote === "dislike" ? "active" : ""}`}
            onClick={() => voteComment(c.id, "dislike")}
            aria-pressed={myVote === "dislike"}
            title="Dislike"
          >👎 <span>{c.dislikes}</span></button>
          {!isReply && (
            <button className="reply-btn" onClick={() => setReplyOpen((p) => ({ ...p, [c.id]: !p[c.id] }))}>Reply</button>
          )}
          {isAdmin && (
            <button className="delete-btn" onClick={() => removeComment(c.id)}>Delete</button>
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
              <div className="replies">
                {repliesByParent[c.id].map((r) => renderCommentRow(r, true))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ilmkhona0">
      <header>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button aria-label="Toggle menu" onClick={() => setMobileMenuOpen((p) => !p)} className="hamburger">☰</button>
            <div className="site-title" style={{ fontWeight: 700, fontSize: 22 }}>ilmkhona0</div>
            <nav className="top-nav">
              <a href="#images">Images</a>
              <a href="#videos">Videos</a>
              <a href="#apps">Apps</a>
              <a href="#games">Games</a>
              <a href="#contact">Contact</a>
            </nav>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {user ? (
              <>
                <div className="username">{user.username || user.name || user.email}</div>
                {isAdmin && (
                  <Link href="/admin" style={{ background: "#111", color: "#fff", padding: "6px 10px", borderRadius: 6, textDecoration: "none" }}>Admin</Link>
                )}
                <button onClick={logout} style={{ background: "transparent", color: "#0a2342", border: "1px solid #0a2342", padding: "6px 10px", borderRadius: 6, fontWeight: 600 }}>Logout</button>
              </>
            ) : (
              <Link href="/auth" className="login-register">Login / Register</Link>
            )}
          </div>
        </div>
      </header>

      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`} style={{ left: mobileMenuOpen ? 0 : -250 }}>
        <a href="#images" onClick={() => setMobileMenuOpen(false)}>Images</a>
        <a href="#videos" onClick={() => setMobileMenuOpen(false)}>Videos</a>
        <a href="#apps" onClick={() => setMobileMenuOpen(false)}>Apps</a>
        <a href="#games" onClick={() => setMobileMenuOpen(false)}>Games</a>
        <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
      </aside>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Images */}
        <section id="images" style={sectionWrap}>
          <h2 style={sectionTitle}>Images</h2>
          <div className="row-scroll" style={rowScroll}>
            <AdminUploadCard folder="images" accept="image/*" />
            {files.images.length === 0 && !isAdmin && (
              <div className="card" style={cardStyle}>
                <MediaPlaceholder label="No images yet" />
              </div>
            )}
            {files.images.map((it) => (
              <div key={it.url} className="card clickable" style={{ ...cardStyle, position: "relative" }} onClick={() => openPreview("images", it)}>
                <DeleteBadge folder="images" item={it} />
                {isImageName(it.name) ? (
                  <img src={it.url} alt={it.name} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  <MediaPlaceholder label="IMG" />
                )}
                <div style={{ marginTop: 8, fontWeight: 600, wordBreak: "break-all" }}>{it.name}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Videos */}
        <section id="videos" style={sectionWrap}>
          <h2 style={sectionTitle}>Videos</h2>
          <div className="row-scroll" style={rowScroll}>
            <AdminUploadCard folder="videos" accept="video/*" />
            {files.videos.length === 0 && !isAdmin && (
              <div className="card" style={cardStyle}>
                <MediaPlaceholder label="No videos yet" height={160} />
              </div>
            )}
            {files.videos.map((it) => (
              <div key={it.url} className="card clickable" style={{ ...cardStyle, minWidth: 280, position: "relative" }} onClick={() => openPreview("videos", it)}>
                <DeleteBadge folder="videos" item={it} />
                {isVideoName(it.name) ? (
                  <video src={it.url} preload="metadata" style={{ width: "100%", height: 160, borderRadius: 8, background: "#000" }} />
                ) : (
                  <MediaPlaceholder label="VIDEO" height={160} />
                )}
                <div style={{ marginTop: 8, fontWeight: 600, wordBreak: "break-all" }}>{it.name}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Apps */}
        <section id="apps" style={sectionWrap}>
          <h2 style={sectionTitle}>Apps</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <AdminUploadCard folder="apps" />
            {files.apps.length === 0 && !isAdmin && (
              <div className="card" style={{ ...cardStyle, minWidth: 140, textAlign: "center", color: "#666" }}>No apps yet</div>
            )}
            {files.apps.map((it) => (
              <div key={it.url} className="card clickable" style={{ ...cardStyle, minWidth: 140, textAlign: "center", color: "#0a2342", position: "relative" }} onClick={() => openPreview("apps", it)}>
                <DeleteBadge folder="apps" item={it} />
                <div style={{ fontSize: 28 }}>📱</div>
                <div style={{ fontWeight: 700, marginTop: 6, wordBreak: "break-all" }}>{it.name}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Games */}
        <section id="games" style={sectionWrap}>
          <h2 style={sectionTitle}>Games</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <AdminUploadCard folder="games" />
            {files.games.length === 0 && !isAdmin && (
              <div className="card" style={{ ...cardStyle, minWidth: 140, color: "#666" }}>No games yet</div>
            )}
            {files.games.map((it) => (
              <div key={it.url} className="card clickable" style={{ ...cardStyle, minWidth: 220, color: "#1976d2", display: "flex", alignItems: "center", gap: 10, position: "relative" }} onClick={() => openPreview("games", it)}>
                <DeleteBadge folder="games" item={it} />
                <span style={{ fontSize: 18 }}>⬇</span>
                <strong style={{ wordBreak: "break-all" }}>{it.name}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* Files */}
        <section id="files" style={sectionWrap}>
          <h2 style={sectionTitle}>Files</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <AdminUploadCard folder="files" />
            {files.files.length === 0 && !isAdmin && (
              <div className="card" style={{ ...cardStyle, minWidth: 140, color: "#666" }}>No files yet</div>
            )}
            {files.files.map((it) => (
              <div key={it.url} className="card clickable" style={{ ...cardStyle, minWidth: 240, display: "flex", alignItems: "center", gap: 10, position: "relative" }} onClick={() => openPreview("files", it)}>
                <DeleteBadge folder="files" item={it} />
                <span style={{ fontSize: 18 }}>📄</span>
                <strong style={{ wordBreak: "break-all", flex: 1 }}>{it.name}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Us */}
        <section id="contact" style={sectionWrap}>
          <h2 style={sectionTitle}>Contact Us</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
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
          <div className="comments-list">
            {topLevel.map((c) => renderCommentRow(c, false))}
          </div>
        </div>
      </div>

      <footer>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px", color: "#fff", textAlign: "center" }}>
          © {new Date().getFullYear()} ilmkhona0. All rights reserved.
        </div>
      </footer>

      {/* Lightbox / preview modal */}
      {preview && (
        <div className="lightbox-backdrop" onClick={closePreview}>
          <div
            className={`lightbox-content size-${viewerSize}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-header">
              <span className="lightbox-title" title={preview.item.name}>{preview.item.name}</span>
              <div className="lightbox-toolbar">
                {/* Resize controls */}
                <div className="lightbox-size-group" role="group" aria-label="Window size">
                  <button
                    className={`lightbox-action lightbox-size ${viewerSize === "small" ? "is-active" : ""}`}
                    onClick={() => setViewerSize("small")}
                    title="Small"
                    aria-label="Small window"
                  >
                    <i className="fas fa-compress" />
                  </button>
                  <button
                    className={`lightbox-action lightbox-size ${viewerSize === "large" ? "is-active" : ""}`}
                    onClick={() => setViewerSize("large")}
                    title="Default"
                    aria-label="Default window"
                  >
                    <i className="fas fa-window-maximize" />
                  </button>
                  <button
                    className={`lightbox-action lightbox-size ${viewerSize === "full" ? "is-active" : ""}`}
                    onClick={() => setViewerSize("full")}
                    title="Full screen"
                    aria-label="Full screen"
                  >
                    <i className="fas fa-expand" />
                  </button>
                </div>

                {/* Download */}
                <a
                  href={preview.item.url}
                  download={preview.item.name}
                  target="_blank"
                  rel="noreferrer"
                  className="lightbox-action lightbox-download"
                  title="Download"
                >
                  <i className="fas fa-download" /> Download
                </a>

                {/* Admin-only delete (red trash) */}
                {isAdmin && (
                  <button
                    onClick={deleteFromViewer}
                    className="lightbox-action lightbox-delete"
                    title="Delete file (admin)"
                    aria-label="Delete file"
                  >
                    <i className="fas fa-trash" />
                  </button>
                )}

                {/* Close */}
                <button onClick={closePreview} className="lightbox-action" title="Close">
                  <i className="fas fa-times" />
                </button>
              </div>
            </div>
            <div className="lightbox-body">
              {isImageName(preview.item.name) && (
                <img
                  src={preview.item.url}
                  alt={preview.item.name}
                  style={{ maxWidth: "100%", maxHeight: "100%", display: "block", margin: "0 auto" }}
                />
              )}
              {isVideoName(preview.item.name) && (
                <video
                  src={preview.item.url}
                  controls
                  autoPlay
                  style={{ width: "100%", maxHeight: "100%", background: "#000" }}
                />
              )}
              {isAudioName(preview.item.name) && (
                <audio src={preview.item.url} controls style={{ width: "100%" }} />
              )}
              {isPdfName(preview.item.name) && (
                <iframe src={preview.item.url} style={{ width: "100%", height: "100%", border: "none" }} />
              )}
              {isTextName(preview.item.name) && (
                <iframe
                  src={preview.item.url}
                  style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                />
              )}
              {isOfficeName(preview.item.name) && (
                /^https?:\/\//i.test(preview.item.url) ? (
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.item.url)}`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                ) : (
                  <div style={{ padding: 16, color: "#666" }}>
                    Office documents can only be previewed when the file URL is publicly reachable
                    (i.e. served from Vercel Blob in production). Use the Download button instead.
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

const sectionWrap: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: "20px 24px",
  marginBottom: 20,
  boxShadow: "0 6px 24px rgba(33,150,243,0.08)",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 14px",
  color: "#0d47a1",
};

const rowScroll: React.CSSProperties = {
  display: "flex",
  gap: 12,
  overflowX: "auto",
  padding: "8px 0",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: 10,
  padding: 12,
  minWidth: 220,
};
