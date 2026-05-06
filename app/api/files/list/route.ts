import { NextRequest, NextResponse } from "next/server";

/**
 * Lists uploaded files for a given "folder" (images / videos / apps / games / files / all).
 *
 * Dual-mode strategy:
 * - If BLOB_READ_WRITE_TOKEN is set, list from Vercel Blob.
 * - Otherwise, walk public/uploads/<folder>/ on the local filesystem.
 *
 * Supported query params:
 *   folder=<images|videos|apps|games|files|all>   (default "uploads")
 *   sort=<name|size|date|type>                    (default "date")
 *   order=<asc|desc>                              (default "desc")
 *   q=<search query>                              (optional, fuzzy/substring match)
 *   limit=<number>                                (optional, page size)
 *   offset=<number>                               (optional)
 *
 * Response: { items: [...], total, storage }
 */

type FileRow = { name: string; url: string; size: number; uploadedAt: string; folder: string };

const ALL_FOLDERS = ["images", "videos", "apps", "games", "files"] as const;

function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

/** Loose match: substring OR every char of q appears in name in order (fuzzy). */
function matches(name: string, q: string): boolean {
  if (!q) return true;
  const n = name.toLowerCase();
  const needle = q.toLowerCase();
  if (n.includes(needle)) return true;
  // fuzzy fallback
  let i = 0;
  for (const ch of n) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

function sortItems(items: FileRow[], sort: string, order: string): FileRow[] {
  const dir = order === "asc" ? 1 : -1;
  const sorted = [...items];
  switch (sort) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name) * dir);
      break;
    case "size":
      sorted.sort((a, b) => (a.size - b.size) * dir);
      break;
    case "type":
      sorted.sort((a, b) => extOf(a.name).localeCompare(extOf(b.name)) * dir);
      break;
    case "date":
    default:
      sorted.sort((a, b) => (new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()) * dir);
      break;
  }
  return sorted;
}

async function listFolder(folder: string): Promise<{ items: FileRow[]; storage: string }> {
  // --- Path A: Vercel Blob ---
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: `${folder}/` });
    const items: FileRow[] = blobs.map((b) => ({
      name: b.pathname.replace(`${folder}/`, ""),
      url: b.url,
      size: b.size,
      uploadedAt: typeof b.uploadedAt === "string" ? b.uploadedAt : new Date(b.uploadedAt).toISOString(),
      folder,
    }));
    return { items, storage: "blob" };
  }

  // --- Path B: local fs (dev) ---
  if (process.env.VERCEL) return { items: [], storage: "none" };

  const { readdir, stat } = await import("fs/promises");
  const { join, relative, sep } = await import("path");
  const root = join(process.cwd(), "public", "uploads", folder);

  // Recursive walker so folder uploads (with subdirectories) show up.
  async function walk(dir: string, acc: FileRow[]): Promise<FileRow[]> {
    let entries: string[] = [];
    try { entries = await readdir(dir); } catch { return acc; }
    for (const entry of entries) {
      const full = join(dir, entry);
      let s;
      try { s = await stat(full); } catch { continue; }
      if (s.isDirectory()) {
        await walk(full, acc);
      } else {
        const rel = relative(root, full).split(sep).join("/");
        acc.push({
          name: rel,
          url: `/uploads/${folder}/${rel}`,
          size: s.size,
          uploadedAt: s.mtime.toISOString(),
          folder,
        });
      }
    }
    return acc;
  }

  try {
    const items = await walk(root, []);
    return { items, storage: "fs" };
  } catch {
    return { items: [], storage: "fs" };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawFolder = (searchParams.get("folder") || "uploads").replace(/[^a-z0-9_-]/gi, "");
  const sort = (searchParams.get("sort") || "date").toLowerCase();
  const order = (searchParams.get("order") || "desc").toLowerCase();
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.max(0, parseInt(searchParams.get("limit") || "0", 10) || 0);
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

  try {
    let combined: FileRow[] = [];
    let storage = "fs";

    if (rawFolder === "all") {
      const results = await Promise.all(ALL_FOLDERS.map((f) => listFolder(f)));
      results.forEach((r) => {
        combined.push(...r.items);
        storage = r.storage;
      });
    } else {
      const r = await listFolder(rawFolder);
      combined = r.items;
      storage = r.storage;
    }

    // search filter
    if (q) combined = combined.filter((it) => matches(it.name, q));

    // sort
    combined = sortItems(combined, sort, order);

    const total = combined.length;
    if (limit > 0) combined = combined.slice(offset, offset + limit);

    return NextResponse.json({ items: combined, total, storage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
