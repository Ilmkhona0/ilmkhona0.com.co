"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import LoginMenu from "./components/LoginMenu";
import ThemeToggle from "./components/ThemeToggle";
import ShareButton from "./components/ShareButton";
import AdSlot from "./components/AdSlot";
import { FileGlyph } from "@/lib/fileIcon";

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

// Chat messages can be either plain text (Groq) or an image (Cloudflare Workers AI).
// For images, `content` is a data: URL the browser can render directly.
type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  kind?: "text" | "image";
};
type AiMode = "text" | "image";
type GenKind = "image" | "gif" | "video" | "shorts" | "audio";
type PanelSize = "sm" | "md" | "lg" | "xl";

// (Web Speech API types removed — we now use MediaRecorder + Groq Whisper.)

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

// Whether a file (by name) is allowed in a given section. Mirrors the server's
// per-folder validation so we can reject mismatches before uploading — important
// for whole-folder uploads that may contain mixed formats.
function isAllowedInFolder(folder: Folder, name: string): boolean {
  switch (folder) {
    case "files": return true;
    case "images": return isImageName(name);
    case "videos": return isVideoName(name);
    case "apps": return /\.(apk|ipa|exe|msi|dmg|app|deb|rpm|appimage)$/i.test(name);
    case "games": return /\.(exe|jar|apk|swf|love|nes|gb|gba|nds|zip)$/i.test(name);
    default: return true;
  }
}

// Resize handles for the preview window: 4 edges + 4 corners. sx/sy say which
// dimension(s) a handle changes and in which direction.
const LB_HANDLES: { d: string; sx: number; sy: number }[] = [
  { d: "n", sx: 0, sy: -1 }, { d: "s", sx: 0, sy: 1 },
  { d: "e", sx: 1, sy: 0 }, { d: "w", sx: -1, sy: 0 },
  { d: "ne", sx: 1, sy: -1 }, { d: "nw", sx: -1, sy: -1 },
  { d: "se", sx: 1, sy: 1 }, { d: "sw", sx: -1, sy: 1 },
];

export default function HomePage() {
  const { data: session } = useSession();
  const user = session?.user;
  const isAdmin = !!user?.isAdmin;

  // The drawer is controlled ONLY by the hamburger / ✕ button. A page load,
  // navigation, backdrop click or menu-link click must never change it, so the
  // open/closed state is persisted and restored instead of resetting to false.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRestored = useRef(false);
  useEffect(() => {
    try {
      setMobileMenuOpen(localStorage.getItem("menuOpen") === "1");
    } catch { /* ignore */ }
    menuRestored.current = true;
  }, []);
  useEffect(() => {
    if (!menuRestored.current) return; // don't clobber the saved value on first paint
    try {
      localStorage.setItem("menuOpen", mobileMenuOpen ? "1" : "0");
    } catch { /* ignore */ }
  }, [mobileMenuOpen]);

  // ---- Drag-to-resize the sidebar drawer ----
  // The drawer is anchored to the left edge, so its width is simply how far
  // right the cursor is. Width is fed to CSS as the --sidebar-w custom property
  // (the stylesheet sets width with !important, which an inline width could not
  // beat) and remembered between visits.
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const latestSidebarW = useRef<number | null>(null);

  const SIDEBAR_MIN = 200;
  function sidebarMax() {
    return Math.min(520, Math.max(SIDEBAR_MIN, window.innerWidth - 60));
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sidebarWidth");
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n)) {
        setSidebarWidth(n);
        latestSidebarW.current = n;
      }
    } catch { /* ignore */ }
  }, []);

  function onSidebarResizeDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    setSidebarResizing(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onSidebarResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!sidebarResizing) return;
    const w = Math.round(Math.max(SIDEBAR_MIN, Math.min(sidebarMax(), e.clientX)));
    latestSidebarW.current = w;
    setSidebarWidth(w);
  }
  function onSidebarResizeUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!sidebarResizing) return;
    setSidebarResizing(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    try {
      if (latestSidebarW.current) localStorage.setItem("sidebarWidth", String(latestSidebarW.current));
    } catch { /* ignore */ }
  }
  // Double-click the handle to go back to the default width.
  function resetSidebarWidth() {
    setSidebarWidth(null);
    latestSidebarW.current = null;
    try { localStorage.removeItem("sidebarWidth"); } catch { /* ignore */ }
  }

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
  const folderInputs = useRef<Record<Folder, HTMLInputElement | null>>({
    images: null, videos: null, apps: null, games: null, files: null,
  });

  const [comments, setComments] = useState<Comment[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [commentText, setCommentText] = useState("");
  // In-flight guards. Posting a comment takes a moment (network + DB), and
  // without these a second click before the request resolves inserted the same
  // comment twice.
  const [postingComment, setPostingComment] = useState(false);
  const postingRef = useRef(false);
  const [postingReply, setPostingReply] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});

  // Single FAB -> two-tab panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "ai">("comments");

  // Resizable panel — "sm" is the original 380×560 size; +/- grow/shrink within
  // sm → md → lg → xl. Default to the original on first visit.
  const [panelSize, setPanelSize] = useState<PanelSize>("sm");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("panelSize")) as
      PanelSize | null;
    if (saved === "sm" || saved === "md" || saved === "lg" || saved === "xl") setPanelSize(saved);
  }, []);
  // The panel is anchored bottom-right beneath the sticky header (z-index 1000,
  // which paints over the panel). Cap the height so growing/dragging can never
  // push the tab bar up underneath the header where it would be covered.
  function maxPanelHeight() {
    const headerH =
      (document.querySelector(".site-header") as HTMLElement | null)?.offsetHeight ?? 66;
    return Math.max(300, window.innerHeight - headerH - 96);
  }

  function changePanelSize(delta: 1 | -1) {
    if (typeof window === "undefined") return;
    // Base = current custom dims, or the panel's current rendered size.
    const el = document.querySelector(".side-panel") as HTMLElement | null;
    const base =
      panelDims ??
      (el
        ? { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }
        : { w: 380, h: 560 });
    // Each click grows/shrinks by 20%, clamped to min/max.
    const factor = delta === 1 ? 1.2 : 1 / 1.2;
    const maxW = Math.min(window.innerWidth - 24, 1100);
    const maxH = maxPanelHeight();
    const w = Math.max(300, Math.min(maxW, Math.round(base.w * factor)));
    const h = Math.max(360, Math.min(maxH, Math.round(base.h * factor)));
    const next = { w, h };
    setPanelDims(next);
    latestDims.current = next;
    try {
      localStorage.setItem("panelDims", JSON.stringify(next));
      localStorage.removeItem("panelSize");
    } catch { /* ignore */ }
  }

  // ---- Free-form drag resize (mouse + touch via Pointer Events) ----
  // Dragging a handle (corner = both axes, top edge = height, left edge = width)
  // stores explicit pixel dimensions that override the discrete size classes.
  // The +/- buttons step the current size by 20%. Dims are clamped + persisted.
  const [panelDims, setPanelDims] = useState<{ w: number; h: number } | null>(null);
  const resizeStart = useRef<{ x: number; y: number; w: number; h: number; dir: "both" | "x" | "y" } | null>(null);
  const latestDims = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("panelDims");
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d.w === "number" && typeof d.h === "number") {
          setPanelDims(d);
          latestDims.current = d;
        }
      }
    } catch { /* ignore */ }
  }, []);

  function onResizePointerDown(e: React.PointerEvent<HTMLDivElement>, dir: "both" | "x" | "y") {
    e.preventDefault();
    const panel = e.currentTarget.parentElement as HTMLElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    resizeStart.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height, dir };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = resizeStart.current;
    if (!s) return;
    // The panel is anchored to the bottom-right, so dragging the handle up/left
    // enlarges it (positive delta). dir restricts which axis changes:
    //   "both" = corner, "x" = left edge (width), "y" = top edge (height).
    const dx = s.x - e.clientX;
    const dy = s.y - e.clientY;
    const maxW = Math.min(window.innerWidth - 24, 1100);
    const maxH = maxPanelHeight();
    const w = s.dir === "y" ? s.w : Math.max(300, Math.min(maxW, s.w + dx));
    const h = s.dir === "x" ? s.h : Math.max(360, Math.min(maxH, s.h + dy));
    const next = { w, h };
    latestDims.current = next;
    setPanelDims(next);
  }
  function onResizePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeStart.current) return;
    resizeStart.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    try {
      if (latestDims.current) localStorage.setItem("panelDims", JSON.stringify(latestDims.current));
    } catch { /* ignore */ }
  }

  // AI chat state
  const [aiMessages, setAiMessages] = useState<ChatMsg[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  // What kind of generation the user just requested; the NEXT user message
  // becomes the prompt for that generation. null = regular text chat.
  const [pendingGen, setPendingGen] = useState<GenKind | null>(null);
  // Voice features
  const [voiceListening, setVoiceListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);
  const aiInputRef = useRef<HTMLInputElement | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement | null>(null);
  // Voice recording state — MediaRecorder + audio stream so we can stop cleanly.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);

  // File uploads queued for the next AI message. Each item is shown above the
  // input as a removable chip. When the user sends, they go to the AI for
  // analysis (Gemini for images, parsers for docs — wired up next step).
  type UploadedFile = {
    name: string;
    size: number;
    type: string;
    dataUrl: string; // base64 data URL so we can preview / send
  };
  const [aiAttachments, setAiAttachments] = useState<UploadedFile[]>([]);

  async function handleFilePicked(fl: FileList | null) {
    if (!fl || !fl.length) return;
    const MAX_BYTES = 20 * 1024 * 1024; // 20 MB per file — keep request size reasonable
    const accepted: UploadedFile[] = [];
    for (const f of Array.from(fl)) {
      if (f.size > MAX_BYTES) {
        alert(`"${f.name}" is too big (max 20 MB).`);
        continue;
      }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
      accepted.push({ name: f.name, size: f.size, type: f.type || "application/octet-stream", dataUrl });
    }
    setAiAttachments((prev) => [...prev, ...accepted]);
  }

  function removeAttachment(idx: number) {
    setAiAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function humanFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function fileIconClass(type: string, name: string) {
    if (type.startsWith("image/")) return "fa-file-image";
    if (type.startsWith("video/")) return "fa-file-video";
    if (type.startsWith("audio/")) return "fa-file-audio";
    if (type === "application/pdf" || /\.pdf$/i.test(name)) return "fa-file-pdf";
    if (/word|\.docx?$/i.test(type + " " + name)) return "fa-file-word";
    if (/excel|sheet|\.xlsx?$|\.csv$/i.test(type + " " + name)) return "fa-file-excel";
    if (/presentation|\.pptx?$/i.test(type + " " + name)) return "fa-file-powerpoint";
    if (/^text\//.test(type) || /\.(txt|md|json|js|ts|tsx|jsx|html|css)$/i.test(name)) return "fa-file-lines";
    return "fa-file";
  }

  // Click "/generate image" etc. → the AI asks what to generate, and the
  // user's next message becomes the generation prompt.
  const KIND_LABEL: Record<GenKind, string> = {
    image: "image",
    gif: "GIF",
    video: "video",
    shorts: "short video",
    audio: "audio clip",
  };
  function startGenerate(kind: GenKind) {
    if (!user) { alert("Please log in to use AI tools."); return; }
    setPendingGen(kind);
    setAiMessages((prev) => [...prev, {
      role: "assistant",
      kind: "text",
      content: `What ${KIND_LABEL[kind]} should I generate? Describe it in one sentence — e.g. "${
        kind === "image" || kind === "gif" ? "a peaceful mountain village at sunset" :
        kind === "video" || kind === "shorts" ? "a 5-second clip of waves crashing on a beach" :
        "calm rain sounds with distant thunder"
      }".`,
    }]);
    setTimeout(() => aiInputRef.current?.focus(), 0);
  }

  type ViewerSize = "small" | "large" | "full";
  const [preview, setPreview] = useState<{ folder: Folder; item: FileItem } | null>(null);
  const [viewerSize, setViewerSize] = useState<ViewerSize>("large");

  // Free-form drag resize for the file preview window (mouse + touch). Custom
  // pixel dims override the small/default/full presets; the preset buttons and
  // opening a new file reset it.
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
    // The window is centered, so dragging an edge moves both sides — multiply by
    // 2 so the grabbed edge tracks the cursor. sx/sy select the edge/axis.
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
      setLightboxDims(null);
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

  async function handleFilesPicked(folder: Folder, files: FileList | File[]) {
    const all = Array.from(files);
    if (!all.length) return;
    // Reject any file whose format doesn't belong in this section (matters most
    // for whole-folder uploads that may contain mixed formats).
    const valid = all.filter((f) => isAllowedInFolder(folder, f.name));
    const rejected = all.filter((f) => !isAllowedInFolder(folder, f.name));
    if (rejected.length) {
      alert(
        `${rejected.length} file(s) skipped — not allowed in "${SECTION_LABEL[folder]}":\n` +
        rejected.slice(0, 12).map((f) => f.name).join("\n") +
        (rejected.length > 12 ? `\n…and ${rejected.length - 12} more` : "") +
        `\n\nPut those in the matching section (e.g. PDFs / PowerPoint → Files).`
      );
    }
    if (!valid.length) return;
    setUploading(folder);
    const failures: string[] = [];
    try {
      const queue = valid;
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
            // Preserve subfolder paths when a whole folder was selected.
            const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
            if (rel) fd.append("customName", rel);
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
    // The ref blocks a second click in the same tick (before React re-renders
    // with the disabled button); the state drives the disabled/"Posting…" UI.
    if (postingRef.current) return;
    const text = commentText.trim();
    if (!text) return alert("Comment cannot be empty.");
    postingRef.current = true;
    setPostingComment(true);
    // Clear immediately so a fast second click has nothing left to send.
    setCommentText("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author: authorName(), authorId: user.id, parentId: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCommentText(text); // put it back so the user doesn't lose their words
        return alert(data.error || "Failed to post comment");
      }
      await refreshComments();
    } catch (err) {
      setCommentText(text);
      alert(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      postingRef.current = false;
      setPostingComment(false);
    }
  }

  async function submitReply(parentId: string) {
    if (!user) return alert("Please log in to reply.");
    if (postingReply) return; // a reply is already in flight — ignore double clicks
    const text = (replyText[parentId] || "").trim();
    if (!text) return;
    setPostingReply(parentId);
    setReplyText((prev) => ({ ...prev, [parentId]: "" }));
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author: authorName(), authorId: user.id, parentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReplyText((prev) => ({ ...prev, [parentId]: text }));
        return alert(data.error || "Failed to post reply");
      }
      setReplyOpen((prev) => ({ ...prev, [parentId]: false }));
      setShowReplies((prev) => ({ ...prev, [parentId]: true }));
      await refreshComments();
    } catch (err) {
      setReplyText((prev) => ({ ...prev, [parentId]: text }));
      alert(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setPostingReply(null);
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
    // Allow sending with just attachments (no text) so users can drop a file
    // and ask "what is this?" by attaching alone.
    if ((!text && aiAttachments.length === 0) || aiLoading) return;

    // Show each attachment as its own message above the text.
    const attachmentMsgs: ChatMsg[] = aiAttachments.map((f) => ({
      role: "user",
      kind: f.type.startsWith("image/") ? "image" : "text",
      content: f.type.startsWith("image/")
        ? f.dataUrl
        : `📎 Uploaded file: ${f.name} (${humanFileSize(f.size)})`,
    }));
    const userMsg: ChatMsg | null = text
      ? { role: "user", content: text, kind: "text" }
      : null;
    const next: ChatMsg[] = [
      ...aiMessages,
      ...attachmentMsgs,
      ...(userMsg ? [userMsg] : []),
    ];
    setAiMessages(next);
    setAiInput("");
    // Clear queued attachments — they've now been added to the conversation.
    const hadAttachments = aiAttachments.length > 0;
    setAiAttachments([]);
    setAiLoading(true);
    // Remember the pending generation kind for this turn, then clear it so the
    // next user message goes back to regular chat.
    const gen = pendingGen;
    setPendingGen(null);
    try {
      let after: ChatMsg[];

      if (gen === "image") {
        // ---- Cloudflare Workers AI image generation ----
        const res = await fetch("/api/ai/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.url) {
          after = [...next, {
            role: "assistant",
            content: `⚠️ ${data?.error || "Image generation failed"}`,
            kind: "text",
          }];
        } else {
          after = [...next, {
            role: "assistant",
            content: data.url,
            kind: "image",
          }];
        }
      } else if (gen) {
        // GIF, video, shorts, audio — not yet wired up. Helpful "coming soon".
        const label = KIND_LABEL[gen];
        after = [...next, {
          role: "assistant",
          content:
            `🚧 ${label} generation isn't live yet — your prompt "${text}" has been noted. ` +
            `I'll wire this up next (likely via fal.ai for video/GIF and ElevenLabs for audio). ` +
            `For now, try /generate image — that one is fully working via Cloudflare Workers AI.`,
          kind: "text",
        }];
      } else if (hadAttachments) {
        // File analysis isn't wired up to a vision/parser API yet. Acknowledge
        // the upload inline so the UX feels complete; the next sequence step
        // is wiring this to Gemini (images) + pdf-parse/mammoth (docs).
        after = [...next, {
          role: "assistant",
          content:
            `📎 Got your file${aiAttachments.length > 1 ? "s" : ""}. ` +
            `Full content analysis is coming next — I'll wire it up to Gemini Vision (images) and local parsers (PDF/Word/Excel) ` +
            `in the next step. For now you can chat normally; the file stays in the conversation.`,
          kind: "text",
        }];
      } else {
        // ---- Regular Groq text chat ----
        const textHistory = next.filter((m) => (m.kind ?? "text") === "text");
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: textHistory }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          after = [...next, {
            role: "assistant",
            content: `⚠️ ${data?.error || "AI request failed"}`,
            kind: "text",
          }];
        } else {
          after = [...next, {
            role: "assistant",
            content: data.reply || "(empty response)",
            kind: "text",
          }];
        }
      }
      setAiMessages(after);
      persistAi(after);
    } catch (err) {
      const after: ChatMsg[] = [...next, {
        role: "assistant",
        content: `⚠️ ${err instanceof Error ? err.message : "Network error"}`,
        kind: "text",
      }];
      setAiMessages(after);
      persistAi(after);
    } finally {
      setAiLoading(false);
    }
  }

  // ============ VOICE: text-to-speech (read aloud) ============
  function speakMessage(text: string, idx: number) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Your browser does not support speech synthesis.");
      return;
    }
    // If clicking the same message that's already speaking → stop it.
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel(); // stop any previous utterance
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.onend = () => setSpeakingIdx((curr) => (curr === idx ? null : curr));
    u.onerror = () => setSpeakingIdx((curr) => (curr === idx ? null : curr));
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(u);
  }

  // ============ VOICE: record audio → send to Groq Whisper ============
  // Why this approach: MediaRecorder works in every modern browser, requests
  // a clear mic permission prompt, and Groq Whisper is far more accurate than
  // the browser's built-in Web Speech API (which is Chromium-only and flaky).
  function stopMediaTracks() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }

  async function toggleVoiceInput() {
    if (typeof window === "undefined") return;

    // Stop recording → send to Whisper.
    if (voiceListening && mediaRecorderRef.current) {
      const rec = mediaRecorderRef.current;
      try { rec.stop(); } catch { /* ignore */ }
      return;
    }

    // Start recording.
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Your browser doesn't support audio recording. Try Chrome, Edge, Firefox, or Safari.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/denied|NotAllowed/i.test(msg)) {
        alert(
          "Microphone permission denied. Click the lock icon in the address bar → Site settings → Microphone → Allow, then try again."
        );
      } else {
        alert(`Could not access microphone: ${msg}`);
      }
      return;
    }
    mediaStreamRef.current = stream;
    audioChunksRef.current = [];

    // Pick a mime type the browser actually supports for recording. Whisper
    // accepts webm/ogg/mp3/m4a/wav etc., so any of these is fine.
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"];
    let mime = "";
    for (const m of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) { mime = m; break; }
    }
    let rec: MediaRecorder;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (err) {
      stopMediaTracks();
      alert("Could not start recording: " + (err instanceof Error ? err.message : "unknown error"));
      return;
    }
    mediaRecorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      setVoiceListening(false);
      stopMediaTracks();
      const blob = new Blob(audioChunksRef.current, { type: mime || "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      if (blob.size < 1000) {
        // Probably an accidental tap — don't bother the API.
        return;
      }
      // Send to Groq Whisper.
      setVoiceTranscribing(true);
      try {
        const fd = new FormData();
        fd.append("audio", blob, "recording.webm");
        const r = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          alert(`Transcription failed: ${data?.error || `HTTP ${r.status}`}`);
        } else if (data?.text) {
          // Append to existing input rather than overwriting, so users can
          // dictate in chunks.
          setAiInput((prev) => (prev ? (prev + " " + data.text).trim() : data.text));
          setTimeout(() => aiInputRef.current?.focus(), 0);
        }
      } catch (err) {
        alert("Transcription network error: " + (err instanceof Error ? err.message : ""));
      } finally {
        setVoiceTranscribing(false);
      }
    };

    setVoiceListening(true);
    rec.start();
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
      <div className="card admin-upload-card">
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
        <input
          ref={(el) => { folderInputs.current[folder] = el; }}
          type="file"
          multiple
          style={{ display: "none" }}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => {
            const fs = e.target.files;
            if (fs && fs.length) handleFilesPicked(folder, fs);
            e.target.value = "";
          }}
        />
        <i className={`fas ${isUp ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} style={{ fontSize: 28, color: "#1976d2" }} />
        <div style={{ marginTop: 8, fontWeight: 600, color: "#0d47a1" }}>{isUp ? "Uploading…" : `Add ${SECTION_LABEL[folder].slice(0, -1)}`}</div>
        <div className="admin-upload-actions">
          <button type="button" onClick={() => fileInputs.current[folder]?.click()} disabled={isUp}>
            <i className="fas fa-file-circle-plus" /> Files
          </button>
          <button type="button" onClick={() => folderInputs.current[folder]?.click()} disabled={isUp}>
            <i className="fas fa-folder-tree" /> Folder
          </button>
        </div>
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
          {/* Font Awesome icons, NOT the 👍/👎 emoji. An emoji paints its own
              colour from the emoji font, so `color:` can never make it black —
              that is why these stayed yellow. Outline icon = not voted,
              solid icon = voted, exactly like a social feed. */}
          <button
            className={`vote-btn like ${myVote === "like" ? "active" : ""}`}
            onClick={() => voteComment(c.id, "like")}
            aria-pressed={myVote === "like"}
            aria-label="Like"
            title="Like"
          >
            <i className={`${myVote === "like" ? "fas" : "far"} fa-thumbs-up`} />
            <span>{c.likes}</span>
          </button>
          <button
            className={`vote-btn dislike ${myVote === "dislike" ? "active" : ""}`}
            onClick={() => voteComment(c.id, "dislike")}
            aria-pressed={myVote === "dislike"}
            aria-label="Dislike"
            title="Dislike"
          >
            <i className={`${myVote === "dislike" ? "fas" : "far"} fa-thumbs-down`} />
            <span>{c.dislikes}</span>
          </button>
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
              <button
                onClick={() => submitReply(c.id)}
                disabled={!user || postingReply === c.id || !(replyText[c.id] || "").trim()}
              >
                {postingReply === c.id ? "Posting…" : "Post reply"}
              </button>
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
          <div className="header-actions">
            <ThemeToggle />
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
                {isAdmin && <span className="admin-pill" title="You are signed in as admin">Admin</span>}
                <button onClick={logout} className="logout-pill logout-icon" aria-label="Log out" title="Log out">
                  <i className="fas fa-right-from-bracket" />
                </button>
              </>
            ) : (
              <LoginMenu />
            )}
          </div>
        </div>
      </header>

      {/* Dim/blur only — closing is the hamburger's ✕ job, so no click handler. */}
      <div
        className={`sidebar-backdrop ${mobileMenuOpen ? "is-visible" : ""}`}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${mobileMenuOpen ? "open" : ""} ${sidebarResizing ? "is-resizing" : ""}`}
        style={sidebarWidth ? ({ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties) : undefined}
      >
        <div className="sidebar-section-label">Browse</div>
        {FOLDERS.map((f) => (
          <Link key={f} href={`/category/${f}`}>
            <i className={`fas ${SECTION_ICON[f]}`} /> {SECTION_LABEL[f]}
          </Link>
        ))}
        <a href="#contact">
          <i className="fas fa-envelope" /> Contact
        </a>
        <ShareButton className="sidebar-link" label="Share this site" />
        {isAdmin && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section-label">Admin</div>
            <Link href="/admin">
              <i className="fas fa-shield-halved" /> Admin
            </Link>
          </>
        )}

        <div className="sidebar-divider" />
        <div className="sidebar-section-label">Account</div>
        {user ? (
          <button
            type="button"
            className="sidebar-link sidebar-logout"
            onClick={() => logout()}
          >
            <i className="fas fa-right-from-bracket" /> Log out
          </button>
        ) : (
          <Link href="/auth">
            <i className="fas fa-right-to-bracket" /> Log in
          </Link>
        )}
      </aside>

      {/* Drag handle on the drawer's right edge. Kept as a sibling rather than a
          child so it can't scroll away with the drawer's content. */}
      {mobileMenuOpen && (
        <div
          className={`sidebar-resize ${sidebarResizing ? "is-active" : ""}`}
          style={sidebarWidth ? ({ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties) : undefined}
          onPointerDown={onSidebarResizeDown}
          onPointerMove={onSidebarResizeMove}
          onPointerUp={onSidebarResizeUp}
          onPointerCancel={onSidebarResizeUp}
          onDoubleClick={resetSidebarWidth}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize the menu (double-click to reset)"
          title="Drag to resize · double-click to reset"
        />
      )}

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
        {/* Top banner ad — AdSense unit "Home top banner" (created 2026-08-17).
            Shows nothing until NEXT_PUBLIC_ADSENSE_CLIENT is set and AdSense has
            approved the site (currently "Getting ready"). */}
        <div style={{ margin: "8px auto 20px", maxWidth: 970, textAlign: "center" }}>
          <AdSlot slot="5588020515" />
        </div>

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
                        <FileGlyph name={it.name} folder={folder} />
                      </div>
                    )}
                  </div>
                  <div className="preview-card-name">{it.name.split("/").pop()}</div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* In-feed ad above the Contact section — AdSense unit "Home in-feed"
            (created 2026-08-17). */}
        <div style={{ margin: "10px auto 24px", maxWidth: 970, textAlign: "center" }}>
          <AdSlot slot="3890282698" />
        </div>

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
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <Link href="/privacy" className="contact-link" style={{ opacity: 0.85 }}>
              <i className="fas fa-shield-halved" /> <span>Privacy Policy</span>
            </Link>
          </div>
        </section>
      </main>

      {/* ===== Floating button + tabbed panel (Comments / AI Chat) ===== */}
      <button
        className={`comments-fab ${panelOpen ? "is-open" : ""}`}
        onClick={() => setPanelOpen((p) => !p)}
        aria-label={panelOpen ? "Close panel" : "Open Comments and AI"}
        title="Comments & AI"
      >
        <i className={panelOpen ? "fas fa-times" : "fas fa-comments"} />
      </button>

      <div
        className={`side-panel ${panelDims ? "size-custom" : `size-${panelSize}`} ${panelOpen ? "open" : ""}`}
        style={panelDims ? { width: panelDims.w, height: panelDims.h } : undefined}
      >
        <div
          className="side-panel-resize corner"
          onPointerDown={(e) => onResizePointerDown(e, "both")}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          role="separator"
          aria-label="Drag to resize width and height"
          title="Drag to resize (both)"
        />
        <div
          className="side-panel-resize edge-top"
          onPointerDown={(e) => onResizePointerDown(e, "y")}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          role="separator"
          aria-label="Drag to resize height"
          title="Drag to resize height"
        />
        <div
          className="side-panel-resize edge-left"
          onPointerDown={(e) => onResizePointerDown(e, "x")}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          role="separator"
          aria-label="Drag to resize width"
          title="Drag to resize width"
        />
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
          <div className="side-panel-size-controls" aria-label="Resize panel">
            <button
              type="button"
              className="panel-size-btn"
              onClick={() => changePanelSize(-1)}
              title="Smaller (−20%)"
              aria-label="Shrink panel by 20%"
            >
              <i className="fas fa-minus" />
            </button>
            <button
              type="button"
              className="panel-size-btn"
              onClick={() => changePanelSize(1)}
              title="Larger (+20%)"
              aria-label="Grow panel by 20%"
            >
              <i className="fas fa-plus" />
            </button>
          </div>
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
                    <button
                      onClick={submitComment}
                      className="submit-btn"
                      disabled={postingComment || !commentText.trim()}
                    >
                      {postingComment ? "Posting…" : "Submit"}
                    </button>
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

              {user && (
                <div className="ai-quick-actions" aria-label="Quick AI commands">
                  {/* Line 1: image */}
                  <button
                    type="button"
                    className="ai-quick-row"
                    onClick={() => startGenerate("image")}
                    disabled={aiLoading}
                  >
                    <span className="ai-quick-cmd">/generate image</span>
                    <span className="ai-quick-hint">Picture from a description</span>
                  </button>

                  {/* Line 2: video / gif / shorts grouped — each a separate click */}
                  <div className="ai-quick-row ai-quick-row-group">
                    <span className="ai-quick-cmd">/generate</span>
                    {(["video", "gif", "shorts"] as GenKind[]).map((k, i) => (
                      <span key={k} style={{ display: "contents" }}>
                        {i > 0 && <span className="ai-quick-sep">·</span>}
                        <button
                          type="button"
                          className="ai-quick-chip"
                          onClick={() => startGenerate(k)}
                          disabled={aiLoading}
                        >
                          {k}
                        </button>
                      </span>
                    ))}
                    <span className="ai-quick-hint">Short moving visual (coming soon)</span>
                  </div>

                  {/* Line 3: audio */}
                  <button
                    type="button"
                    className="ai-quick-row"
                    onClick={() => startGenerate("audio")}
                    disabled={aiLoading}
                  >
                    <span className="ai-quick-cmd">/generate audio</span>
                    <span className="ai-quick-hint">Voice or music clip (coming soon)</span>
                  </button>
                </div>
              )}

              {pendingGen && (
                <div className="ai-mode-banner">
                  <span><i className="fas fa-wand-magic-sparkles" /> Generating: {KIND_LABEL[pendingGen]}</span>
                  <button
                    type="button"
                    className="ai-mode-banner-cancel"
                    onClick={() => setPendingGen(null)}
                    aria-label="Cancel"
                    title="Cancel — go back to chat"
                  >
                    ✕
                  </button>
                </div>
              )}

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
                    {m.kind === "image" ? (
                      <div className="ai-msg-bubble ai-msg-image">
                        <img src={m.content} alt="Generated image" />
                        <a
                          href={m.content}
                          download={`ilmkhona0-${Date.now()}.png`}
                          className="ai-image-download"
                          title="Download image"
                        >
                          <i className="fas fa-download" /> Download
                        </a>
                      </div>
                    ) : (
                      <div className="ai-msg-bubble">
                        {m.content}
                        {m.role === "assistant" && (
                          <button
                            type="button"
                            className={`ai-speak-btn ${speakingIdx === i ? "is-speaking" : ""}`}
                            onClick={() => speakMessage(m.content, i)}
                            aria-label={speakingIdx === i ? "Stop reading" : "Read aloud"}
                            title={speakingIdx === i ? "Stop reading" : "Read aloud"}
                          >
                            <i className={`fas ${speakingIdx === i ? "fa-volume-xmark" : "fa-volume-high"}`} />
                          </button>
                        )}
                      </div>
                    )}
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

              {aiAttachments.length > 0 && (
                <div className="ai-attachments-row" aria-label="Pending uploads">
                  {aiAttachments.map((f, idx) => (
                    <div key={idx} className="ai-attachment-chip">
                      {f.type.startsWith("image/") ? (
                        <img className="ai-attachment-thumb" src={f.dataUrl} alt={f.name} />
                      ) : (
                        <i className={`fas ${fileIconClass(f.type, f.name)} ai-attachment-icon`} />
                      )}
                      <div className="ai-attachment-meta">
                        <span className="ai-attachment-name" title={f.name}>{f.name}</span>
                        <span className="ai-attachment-size">{humanFileSize(f.size)}</span>
                      </div>
                      <button
                        type="button"
                        className="ai-attachment-remove"
                        onClick={() => removeAttachment(idx)}
                        aria-label="Remove attachment"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                className="ai-chat-form"
                onSubmit={(e) => { e.preventDefault(); sendAi(); }}
              >
                <input
                  ref={aiFileInputRef}
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    handleFilePicked(e.target.files);
                    e.target.value = ""; // allow re-selecting same file
                  }}
                />
                <button
                  type="button"
                  className="ai-attach-btn"
                  onClick={() => aiFileInputRef.current?.click()}
                  disabled={!user || aiLoading}
                  aria-label="Attach files"
                  title="Attach files (image, PDF, Word, Excel, PowerPoint, audio…)"
                >
                  <i className="fas fa-plus" />
                </button>
                <button
                  type="button"
                  className={`ai-mic-btn ${voiceListening ? "is-listening" : ""} ${voiceTranscribing ? "is-transcribing" : ""}`}
                  onClick={toggleVoiceInput}
                  disabled={!user || aiLoading || voiceTranscribing}
                  aria-label={
                    voiceTranscribing ? "Transcribing…" :
                    voiceListening ? "Stop recording" : "Record voice message"
                  }
                  title={
                    voiceTranscribing ? "Transcribing your voice…" :
                    voiceListening ? "Click to stop and transcribe" :
                    "Click to start recording. Click again to stop."
                  }
                >
                  <i className={`fas ${
                    voiceTranscribing ? "fa-spinner fa-spin" :
                    voiceListening ? "fa-stop" : "fa-microphone"
                  }`} />
                </button>
                <input
                  ref={aiInputRef}
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder={
                    !user
                      ? "Log in to chat"
                      : voiceTranscribing
                      ? "Transcribing your voice…"
                      : voiceListening
                      ? "Recording… click stop when done"
                      : pendingGen
                      ? `Describe the ${KIND_LABEL[pendingGen]} to generate...`
                      : aiAttachments.length > 0
                      ? "Add a question about your files (optional) and send"
                      : "Ask the AI instructor..."
                  }
                  disabled={!user || aiLoading}
                />
                <button
                  type="submit"
                  disabled={!user || aiLoading || (!aiInput.trim() && aiAttachments.length === 0)}
                >
                  <i className={pendingGen ? "fas fa-wand-magic-sparkles" : "fas fa-paper-plane"} />
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
          <div
            className={`lightbox-content ${lightboxDims ? "size-custom" : `size-${viewerSize}`}`}
            style={lightboxDims ? { width: lightboxDims.w, height: lightboxDims.h, maxHeight: "none" } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-header">
              <span className="lightbox-title" title={preview.item.name}>{preview.item.name}</span>
              <div className="lightbox-toolbar">
                <div className="lightbox-size-group" role="group" aria-label="Window size">
                  <button className={`lightbox-action lightbox-size ${viewerSize === "small" && !lightboxDims ? "is-active" : ""}`} onClick={() => { setViewerSize("small"); setLightboxDims(null); }} title="Small"><i className="fas fa-compress" /></button>
                  <button className={`lightbox-action lightbox-size ${viewerSize === "large" && !lightboxDims ? "is-active" : ""}`} onClick={() => { setViewerSize("large"); setLightboxDims(null); }} title="Default"><i className="fas fa-window-maximize" /></button>
                  <button className={`lightbox-action lightbox-size ${viewerSize === "full" && !lightboxDims ? "is-active" : ""}`} onClick={() => { setViewerSize("full"); setLightboxDims(null); }} title="Full screen"><i className="fas fa-expand" /></button>
                </div>
                <ShareButton className="lightbox-action lightbox-share" fileUrl={preview.item.url} fileName={preview.item.name.split("/").pop()} fileSize={preview.item.size} text={preview.item.name.split("/").pop()} />
                <a href={preview.item.url} download={preview.item.name} target="_blank" rel="noreferrer" className="lightbox-action lightbox-download" title="Download" aria-label="Download">
                  <i className="fas fa-download" />
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
    </div>
  );
}
