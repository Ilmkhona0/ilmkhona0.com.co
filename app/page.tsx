"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import LoginMenu from "./components/LoginMenu";
import ThemeToggle from "./components/ThemeToggle";

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

type ChatMsg = { role: "user" | "assistant"; content: string };

const FOLDERS = ["images", "videos", "apps", "games", "files"] as const;
type Folder = (typeof FOLDERS)[number];

const PREVIEW_LIMIT = 6;

const SECTION_LABEL: Record<Folder, string> = {
  images: "Images", videos: "Videos", apps: "Apps", games: "Games", files: "Files",
};
const SECTION_ICON: Record<Folder, string> = {
  images: "fa-images", videos: "fa-video", apps: "fa-mobile-screen", games: "fa-gamepad", files: "fa-folder-open",
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
function isTextName(n: string)   {
  return /\.(txt|md|markdown|csv|tsv|log|json|jsonl|ndjson|xml|ya?ml|toml|ini|conf|cfg|env|html?|x?html|css|scss|sass|less|js|mjs|cjs|ts|tsx|jsx|vue|svelte|astro|py|pyw|rb|php|java|kt|kts|scala|groovy|c|h|cc|cpp|cxx|hpp|hxx|m|mm|cs|vb|fs|go|rs|swift|dart|lua|pl|pm|r|jl|sh|bash|zsh|fish|ps1|bat|cmd|sql|graphql|gql|proto|sol|tex|asm|s|nim|zig|hs|clj|cljs|ex|exs|erl|hrl|elm|ml|mli|pas|pp|d|coffee|patch|diff|gitignore|dockerignore|editorconfig|prettierrc|eslintrc|env|lock)$/i.test(n);
}
function isOfficeName(n: string) { return /\.(docx?|xlsx?|pptx?)$/i.test(n); }
function canPreview(n: string) {
  return isImageName(n) || isVideoName(n) || isAudioName(n) || isPdfName(n) || isTextName(n) || isOfficeName(n);
}

export default function HomePage() {
  const { data: session } = useSession();
  const user = session?.user;
  const isAdmin = !!user?.isAdmin;

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

  // Single FAB -> two-tab panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "ai">("comments");

  // AI chat state
  const [aiMessages, setAiMessages] = useState<ChatMsg[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);

  type ViewerSize = "small" | "large" | "full";
  const [preview, setPreview] = useState<{ folder: Folder; item: FileItem } | null>(null);
  const [viewerSize, setViewerSize] = useState<ViewerSize>("large");

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
    FOLDERS.forEach(refreshFolder);
    refreshComments();
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved AI chat history once the user is signed in.
  useEffect(() => {
    if (!user) { setAiMessages([]); return; }
    (async () => {
      try {
        const res = await fetch("/api/ai/history", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.messages)) setAiMessages(data.messages);
      } catch { /* ignore */ }
    })();
  }, [user]);

  // Auto-scroll AI messages.
  useEffect(() => {
    if (activeTab === "ai" && aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
    }
  }, [aiMessages, activeTab]);

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

  async function handleFilesPicked(folder: Folder, files: FileList) {
    if (!files.length) return;
    setUploading(folder);
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
                const data = await res.json().catch(() => ({}));
                failures.push(`${f.name}: ${data.error || res.status}`);
              }
            } catch (err) {
              failures.push(`${f.name}: ${err instanceof Error ? err.message : "network error"}`);
            }
          }
        })());
      }
      await Promise.all(workers);
      if (failures.length) alert(`Some uploads failed:\n${failures.join("\n")}`);
      await refreshFolder(folder);
    } finally {
      setUploading(null);
    }
  }

  function logout() {
    signOut({ callbackUrl: "/" });
  }

  const authorName = () =>
    user?.username || user?.name || user?.email || "You";

  async function submitComment() {
    if (!user) return alert("Please log in to post a comment.");
    const text = commentText.trim();
    if (!text) return alert("Comment cannot be empty.");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author: authorName(), authorId: user.id, parentId: null }),
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
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author: authorName(), authorId: user.id, parentId }),
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
      } catch { /* ignore */ }
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

  // ==== AI CHAT ====
  async function persistAi(messages: ChatMsg[]) {
    try {
      await fetch("/api/ai/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
    } catch { /* best-effort */ }
  }

  async function sendAi() {
    if (!user) {
      alert("Please log in to chat with the AI.");
      return;
    }
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    const next: ChatMsg[] = [...aiMessages, { role: "user", content: text }];
    setAiMessages(next);
    setAiInput("");
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      let after: ChatMsg[];
      if (!res.ok) {
        after = [...next, { role: "assistant", content: `⚠️ ${data?.error || "AI request failed"}` }];
      } else {
        after = [...next, { role: "assistant", content: data.reply || "(empty response)" }];
      }
      setAiMessages(after);
      persistAi(after);
    } catch (err) {
      const after: ChatMsg[] = [...next, { role: "assistant", content: `⚠️ ${err instanceof Error ? err.message : "Network error"}` }];
      setAiMessages(after);
      persistAi(after);
    } finally {
      setAiLoading(false);
    }
  }

  async function clearAi() {
    if (!confirm("Start a new chat? This deletes the current conversation.")) return;
    setAiMessages([]);
    try {
      await fetch("/api/ai/history", { method: "DELETE" });
    } catch { /* ignore */ }
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
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const fs = e.target.files;
            if (fs && fs.length) handleFilesPicked(folder, fs);
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
        <Link href={`/category/${folder}`} className="section-title-link" title={`Open ${SECTION_LABEL[folder]}`}>
          <h2 className="section-title">
            <i className={`fas ${SECTION_ICON[folder]}`} /> {SECTION_LABEL[folder]}
            {total > 0 && <span className="section-count">{total}</span>}
          </h2>
        </Link>
        {more && (
          <Link href={`/category/${folder}`} className="section-view-all">
            View all {total} <i className="fas fa-arrow-right" />
          </Link>
        )}
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
            <ThemeToggle />
            {user ? (
              <>
                <div className="user-chip" title={user.email || user.name || ""}>
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="user-avatar user-avatar-fallback" aria-hidden="true">
                      {(user.username || user.name || user.email || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="username">{user.username || user.name || user.email}</span>
                </div>
                {isAdmin && <Link href="/admin" className="admin-pill">Admin</Link>}
                <button onClick={logout} className="logout-pill">Logout</button>
              </>
            ) : (
              <LoginMenu />
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

      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-inner">
          <div className="hero-eyebrow">Welcome to</div>
          <h1 className="hero-title">ilmkhona0</h1>
          <p className="hero-sub">Images, videos, apps, games and files — curated and shared in one place.</p>

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
                  <div className="hero-search-status">No matches for &quot;{searchQ}&quot;.</div>
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
                          /\.(py|pyw|rb|php|java|kt|scala|c|h|cc|cpp|cxx|hpp|cs|vb|fs|go|rs|swift|dart|lua|pl|r|jl|js|mjs|cjs|ts|tsx|jsx|vue|svelte|sh|bash|ps1|bat|cmd|sql|graphql|sol|asm|nim|zig|hs|clj|ex|erl|elm|ml|coffee)$/i.test(it.name) ? "fa-file-code" :
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
            <a href="https://www.linkedin.com/in/ilmkhona/" target="_blank" rel="noreferrer" className="contact-link">
              <i className="fab fa-linkedin" /> <span><strong>LinkedIn:</strong> ilmkhona</span>
            </a>
          </div>
        </section>
      </main>

      {/* ===== Floating button + tabbed panel (Comments / AI Chat) ===== */}
      <button
        className="comments-fab"
        onClick={() => setPanelOpen((p) => !p)}
        aria-label={panelOpen ? "Close panel" : "Open Comments and AI"}
        title="Comments & AI"
      >
        <i className={panelOpen ? "fas fa-times" : "fas fa-comments"} />
      </button>

      <div className={`side-panel ${panelOpen ? "open" : ""}`}>
        <div className="side-panel-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "comments"}
            className={`side-tab ${activeTab === "comments" ? "is-active" : ""}`}
            onClick={() => setActiveTab("comments")}
          >
            <i className="fas fa-comment" /> Comments
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "ai"}
            className={`side-tab ${activeTab === "ai" ? "is-active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            <i className="fas fa-robot" /> AI Chat
          </button>
          <button onClick={() => setPanelOpen(false)} aria-label="Close" className="panel-close">✕</button>
        </div>

        <div className="side-panel-body">
          {activeTab === "comments" && (
            <>
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
                  Only registered users can post comments. Please <Link href="/auth">log in</Link>.
                </div>
              )}
              <div className="comments-list">{topLevel.map((c) => renderCommentRow(c, false))}</div>
            </>
          )}

          {activeTab === "ai" && (
            <div className="ai-chat">
              <div className="ai-chat-header">
                <div>
                  <strong>AI Instructor</strong>
                </div>
                {aiMessages.length > 0 && (
                  <button className="ai-clear" onClick={clearAi} title="New chat (deletes current conversation)">
                    <i className="fas fa-rotate-right" /> New chat
                  </button>
                )}
              </div>

              <div className="ai-chat-scroll" ref={aiScrollRef}>
                {!user && (
                  <div className="ai-chat-empty">
                    Please <Link href="/auth">log in</Link> to chat with the AI instructor.
                  </div>
                )}
                {user && aiMessages.length === 0 && (
                  <div className="ai-chat-empty">
                    👋 Hi {user.username || user.name || "there"}! Ask me anything — programming, study help, this site, or general questions.
                  </div>
                )}
                {aiMessages.map((m, i) => (
                  <div key={i} className={`ai-msg ${m.role}`}>
                    <div className="ai-msg-bubble">{m.content}</div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="ai-msg assistant">
                    <div className="ai-msg-bubble ai-typing">
                      <span /> <span /> <span />
                    </div>
                  </div>
                )}
              </div>

              <form
                className="ai-chat-form"
                onSubmit={(e) => { e.preventDefault(); sendAi(); }}
              >
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder={user ? "Ask the AI instructor..." : "Log in to chat"}
                  disabled={!user || aiLoading}
                />
                <button type="submit" disabled={!user || aiLoading || !aiInput.trim()}>
                  <i className="fas fa-paper-plane" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <footer>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px", color: "#fff", textAlign: "center" }}>
          © {new Date().getFullYear()} ilmkhona0. All rights reserved.
        </div>
      </footer>

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
