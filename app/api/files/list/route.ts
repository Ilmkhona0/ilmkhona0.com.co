import { NextRequest, NextResponse } from "next/server";

/**
 * Lists uploaded files for a given "folder" (images / videos / apps / games / files).
 *
 * Same dual-mode strategy as the upload route:
 * - If BLOB_READ_WRITE_TOKEN is set, list from Vercel Blob.
 * - Otherwise, walk public/uploads/<folder>/ on the local filesystem.
 *
 * Response:
 *   { items: [{ name, url, size?, uploadedAt? }, ...] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folder = (searchParams.get("folder") || "uploads").replace(/[^a-z0-9_-]/gi, "");

  try {
    // --- Path A: Vercel Blob ---
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: `${folder}/` });
      const items = blobs.map((b) => ({
        name: b.pathname.replace(`${folder}/`, ""),
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt,
      }));
      return NextResponse.json({ items, storage: "blob" });
    }

    // --- Path B: local filesystem ---
    if (process.env.VERCEL) {
      return NextResponse.json({ items: [], storage: "none" });
    }

    const { readdir, stat } = await import("fs/promises");
    const { join } = await import("path");

    const dir = join(process.cwd(), "public", "uploads", folder);
    let names: string[] = [];
    try {
      names = await readdir(dir);
    } catch {
      // folder doesn't exist yet -> empty list
      return NextResponse.json({ items: [], storage: "fs" });
    }

    const items = await Promise.all(
      names.map(async (name) => {
        const full = join(dir, name);
        let size = 0;
        let uploadedAt: string | undefined;
        try {
          const s = await stat(full);
          size = s.size;
          uploadedAt = s.mtime.toISOString();
        } catch {
          // ignore
        }
        return {
          name,
          url: `/uploads/${folder}/${name}`,
          size,
          uploadedAt,
        };
      })
    );

    return NextResponse.json({ items, storage: "fs" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
