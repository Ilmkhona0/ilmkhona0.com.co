import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Admin gate for every handler in this file.
 *
 * These endpoints upload, rename and delete files. The client only shows the
 * matching buttons to admins, but hiding a button does not protect the endpoint
 * behind it — anyone who knew the URL could call these directly. Every handler
 * now verifies the NextAuth session server-side before touching storage.
 *
 * Returns a 401 response to send back, or null when the caller is an admin.
 */
async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 401 });
  }
  return null;
}

/**
 * DELETE /api/admin/upload?url=<file-url>
 * Removes a file from Vercel Blob (production) or from public/uploads (local dev).
 */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    if (process.env.BLOB_READ_WRITE_TOKEN && /^https?:\/\//i.test(url)) {
      const { del } = await import("@vercel/blob");
      await del(url);
      return NextResponse.json({ success: true });
    }

    if (process.env.VERCEL) {
      return NextResponse.json(
        { error: "Cannot delete on Vercel without Blob storage configured." },
        { status: 501 }
      );
    }

    // Local fs path: /uploads/<folder>/<name>
    const m = url.match(/\/uploads\/([^/]+)\/(.+)$/);
    if (!m) {
      return NextResponse.json({ error: "invalid local url" }, { status: 400 });
    }
    const [, folder, name] = m;
    const { unlink } = await import("fs/promises");
    const { join } = await import("path");
    await unlink(join(process.cwd(), "public", "uploads", folder, name));
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/upload
 * Body: { url: <current url>, newName: <new file name>, folder: <folder> }
 * Renames an uploaded file. On Blob this is implemented as copy-then-delete;
 * on local fs it's a real rename.
 */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    newName?: string;
    folder?: string;
  };
  const url = body.url || "";
  let newName = (body.newName || "").trim();
  const folder = (body.folder || "").replace(/[^a-z0-9_-]/gi, "");

  if (!url || !newName || !folder) {
    return NextResponse.json({ error: "url, newName, and folder required" }, { status: 400 });
  }

  // sanitise filename: keep dots and hyphens, collapse spaces
  newName = newName.replace(/[\\/]/g, "").replace(/\s+/g, " ").trim();
  if (!newName) {
    return NextResponse.json({ error: "invalid newName" }, { status: 400 });
  }

  try {
    // --- Path A: Vercel Blob (copy + delete; Blob has no rename primitive) ---
    if (process.env.BLOB_READ_WRITE_TOKEN && /^https?:\/\//i.test(url)) {
      const { put, del } = await import("@vercel/blob");
      const fetched = await fetch(url);
      if (!fetched.ok) {
        return NextResponse.json({ error: "could not fetch original blob" }, { status: 500 });
      }
      const buf = await fetched.arrayBuffer();
      const newKey = `${folder}/${newName}`;

      const isBinaryDistributable =
        folder === "apps" ||
        folder === "games" ||
        /\.(exe|msi|apk|ipa|dmg|app|deb|rpm|appimage|jar|zip|7z|rar|tar|gz)$/i.test(newName);

      const safeAscii = newName.replace(/[^\x20-\x7E]/g, "_");
      const blob = await put(newKey, buf, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        ...(isBinaryDistributable && {
          contentDisposition: `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(newName)}`,
        }),
      });
      await del(url);
      return NextResponse.json({ success: true, url: blob.url, name: newName, storage: "blob" });
    }

    if (process.env.VERCEL) {
      return NextResponse.json(
        { error: "Cannot rename on Vercel without Blob storage configured." },
        { status: 501 }
      );
    }

    // --- Path B: local filesystem ---
    const m = url.match(/\/uploads\/([^/]+)\/(.+)$/);
    if (!m) return NextResponse.json({ error: "invalid local url" }, { status: 400 });
    const [, oldFolder, oldName] = m;
    const { rename } = await import("fs/promises");
    const { join } = await import("path");
    const fromPath = join(process.cwd(), "public", "uploads", oldFolder, oldName);
    const toPath = join(process.cwd(), "public", "uploads", folder, newName);
    await rename(fromPath, toPath);
    return NextResponse.json({
      success: true,
      url: `/uploads/${folder}/${newName}`,
      name: newName,
      storage: "fs",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * File upload route.
 *
 * Strategy:
 * - If BLOB_READ_WRITE_TOKEN is set (production OR local with `vercel env pull`),
 *   we upload to Vercel Blob — works on Vercel's read-only filesystem.
 * - Otherwise (plain local dev), fall back to writing into /public/uploads/.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "uploads";
    const customName = ((formData.get("customName") as string) || "").trim();

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    // Decide final name (custom-rename keeps original extension if user omits it).
    // customName may contain forward slashes for folder uploads — we keep them but
    // strictly sanitise each path segment to prevent directory traversal.
    const origName = file.name;
    let finalName = origName;
    if (customName) {
      // Folder uploads pass the whole relative path (e.g. "myrepo/src/main.py").
      // For path-style names we don't append the ext — the path already has the file at the end.
      const looksLikePath = /[/\\]/.test(customName);
      if (looksLikePath) {
        finalName = customName
          .replace(/\\/g, "/")            // normalise backslashes
          .split("/")
          .map((seg) => seg.trim())
          .filter((seg) => seg && seg !== "." && seg !== "..")
          .join("/");
        if (!finalName) finalName = origName;
      } else {
        const origExtMatch = /\.[a-z0-9]+$/i.exec(origName);
        const ext = origExtMatch ? origExtMatch[0] : "";
        finalName = /\.[a-z0-9]+$/i.test(customName) ? customName : customName + ext;
        finalName = finalName.replace(/[\\/]/g, "").replace(/\s+/g, " ").trim();
        if (!finalName) finalName = origName;
      }
    }

    // ---- Validate file type per folder ----
    const lowerName = finalName.toLowerCase();
    const mime = file.type || "";
    const okForFolder: Record<string, boolean> = {
      images:
        mime.startsWith("image/") ||
        /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName),
      videos:
        mime.startsWith("video/") ||
        /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(lowerName),
      apps:
        /\.(apk|ipa|exe|msi|dmg|app|deb|rpm|appimage)$/i.test(lowerName) ||
        mime === "application/octet-stream" ||
        mime === "application/vnd.android.package-archive",
      games:
        /\.(exe|jar|apk|swf|love|nes|gb|gba|nds|zip)$/i.test(lowerName) ||
        mime === "application/octet-stream",
      files:
        // anything that's NOT an image or video belongs in /files
        !mime.startsWith("image/") && !mime.startsWith("video/"),
    };
    if (folder in okForFolder && !okForFolder[folder]) {
      return NextResponse.json(
        {
          error: `File type "${mime || "unknown"}" is not allowed in folder "${folder}". Pick a different section.`,
        },
        { status: 415 }
      );
    }

    // --- Path A: Vercel Blob (preferred) ---
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "");
      const key = `${safeFolder}/${finalName}`;

      // Force the browser to download (rather than try to render or navigate)
      // for binary distributables. Images / videos / inline-previewable files
      // remain inline so they can show in the lightbox.
      const isBinaryDistributable =
        safeFolder === "apps" ||
        safeFolder === "games" ||
        /\.(exe|msi|apk|ipa|dmg|app|deb|rpm|appimage|jar|zip|7z|rar|tar|gz)$/i.test(finalName);

      // RFC 6266: quoted ASCII fallback + UTF-8 form for non-ASCII names.
      const safeAscii = finalName.replace(/[^\x20-\x7E]/g, "_");
      const blob = await put(key, file, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        ...(isBinaryDistributable && {
          contentDisposition: `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(finalName)}`,
        }),
      });
      return NextResponse.json({
        success: true,
        url: blob.url,
        pathname: blob.pathname,
        name: finalName,
        storage: "blob",
      });
    }

    // --- Path B: local filesystem fallback (dev only) ---
    if (process.env.VERCEL) {
      return NextResponse.json(
        {
          error:
            "Blob storage not configured. Enable Vercel Blob in the dashboard and set BLOB_READ_WRITE_TOKEN.",
        },
        { status: 501 }
      );
    }

    const { writeFile, mkdir } = await import("fs/promises");
    const { join, dirname } = await import("path");

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // finalName may contain "/" for folder uploads. Walk into subdirectories.
    const fullPath = join(process.cwd(), "public", "uploads", folder, finalName);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/${folder}/${finalName}`,
      name: finalName,
      storage: "fs",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
