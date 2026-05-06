"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type FileItem = {
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  folder: string;
};

const FOLDERS = ["all", "images", "videos", "apps", "games", "files"] as const;
type FolderFilter = (typeof FOLDERS)[number];
type Sort = "date" | "name" | "size" | "type";
type Order = "asc" | "desc";

function formatBytes(b: number) {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

export default function AdminFilesPage() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<FolderFilter>("all");
  const [sort, setSort] = useState<Sort>("date");
  const [order, setOrder] = useState<Order>("desc");
  const [q, setQ] = useState("");
  const [renamingUrl, setRenamingUrl] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ilm_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setIsAdmin(!!parsed.isAdmin);
      }
    } catch { /* ignore */ }
  }, []);

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

  async function handleDelete(it: FileItem) {
    if (!confirm(`Delete "${it.name}"?`)) return;
    const res = await fetch(`/api/admin/upload?url=${encodeURIComponent(it.url)}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Delete failed"); return;
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
      body: JSON.stringify({ url: it.url, newName, folder: it.folder }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Rename failed"); return;
    }
    await refresh();
  }

  if (!isAdmin) {
    return (
      <div className="ilmkhona0">
        <div className="admin-files-empty">
          <h1>Admin only</h1>
          <p>Please <Link href="/auth">log in as admin</Link> to manage files.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ilmkhona0 admin-files-page">
      <header className="admin-files-header">
        <Link href="/admin" className="admin-files-back"><i className="fas fa-arrow-left" /> Admin</Link>
        <h1 className="admin-files-title"><i className="fas fa-folder-tree" /> Manage Files</h1>
        <Link href="/admin/upload" className="admin-files-upload-btn"><i className="fas fa-cloud-arrow-up" /> Upload</Link>
      </header>

      <div className="admin-files-toolbar">
        <div className="cat-search">
          <i className="fas fa-search" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files..." />
          {q && <button onClick={() => setQ("")} className="cat-search-clear">✕</button>}
        </div>

        <div className="admin-files-filters">
          <label className="cat-sort-label">Folder</label>
          <select value={folder} onChange={(e) => setFolder(e.target.value as FolderFilter)} className="cat-select">
            {FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>

          <label className="cat-sort-label">Sort</label>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="cat-select">
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
          </select>
          <button onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))} className="cat-order-btn" title={order}>
            <i className={`fas ${order === "asc" ? "fa-arrow-up-short-wide" : "fa-arrow-down-wide-short"}`} />
          </button>
        </div>
      </div>

      <div className="admin-files-table-wrap">
        <table className="admin-files-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Folder</th>
              <th>Size</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="admin-files-empty-row">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="admin-files-empty-row">No files found.</td></tr>
            )}
            {items.map((it) => (
              <tr key={it.url}>
                <td className="admin-files-thumb-cell">
                  {/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(it.name) ? (
                    <img src={it.url} alt="" className="admin-files-thumb" />
                  ) : /\.(mp4|webm|mov|avi|mkv)$/i.test(it.name) ? (
                    <i className="fas fa-video admin-files-icon" />
                  ) : /\.pdf$/i.test(it.name) ? (
                    <i className="fas fa-file-pdf admin-files-icon" />
                  ) : /\.(exe|msi)$/i.test(it.name) ? (
                    <i className="fas fa-window-maximize admin-files-icon" />
                  ) : /\.apk$/i.test(it.name) ? (
                    <i className="fab fa-android admin-files-icon" />
                  ) : (
                    <i className="fas fa-file admin-files-icon" />
                  )}
                </td>
                <td className="admin-files-name-cell">
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
                    <a href={it.url} target="_blank" rel="noreferrer" title={it.name}>{it.name}</a>
                  )}
                </td>
                <td><span className={`admin-files-folder-tag tag-${it.folder}`}>{it.folder}</span></td>
                <td>{formatBytes(it.size)}</td>
                <td>{formatDate(it.uploadedAt)}</td>
                <td className="admin-files-actions-cell">
                  <a href={it.url} download={it.name} className="admin-files-action" title="Download">
                    <i className="fas fa-download" />
                  </a>
                  <button
                    className="admin-files-action"
                    onClick={() => { setRenamingUrl(it.url); setRenameValue(it.name); }}
                    title="Rename"
                  >
                    <i className="fas fa-pen" />
                  </button>
                  <button className="admin-files-action danger" onClick={() => handleDelete(it)} title="Delete">
                    <i className="fas fa-trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
