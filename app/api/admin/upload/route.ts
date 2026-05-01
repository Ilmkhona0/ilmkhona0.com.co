import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/admin/upload?url=<file-url>
 * Removes a file from Vercel Blob (production) or from public/uploads (local dev).
 */
export async function DELETE(req: NextRequest) {
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
 * File upload route.
 *
 * Strategy:
 * - If BLOB_READ_WRITE_TOKEN is set (production OR local with `vercel env pull`),
 *   we upload to Vercel Blob — works on Vercel's read-only filesystem.
 * - Otherwise (plain local dev), fall back to writing into /public/uploads/.
 *
 * Setup for production:
 *   1. Vercel dashboard -> ilmkhona0.com -> Storage tab -> Create -> Blob.
 *   2. `npm install @vercel/blob` in your project.
 *   3. (Optional, for local) `npx vercel link` then `npx vercel env pull .env.local`
 *      so BLOB_READ_WRITE_TOKEN appears locally too.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    // ---- Validate file type per folder ----
    const lowerName = file.name.toLowerCase();
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
        /\.(exe|jar|apk|swf|love|nes|gb|gba|nds)$/i.test(lowerName) ||
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
      const key = `${safeFolder}/${Date.now()}-${file.name}`;
      const blob = await put(key, file, {
        access: "public",
        addRandomSuffix: false,
      });
      return NextResponse.json({
        success: true,
        url: blob.url,
        pathname: blob.pathname,
        storage: "blob",
      });
    }

    // --- Path B: local filesystem fallback (dev only) ---
    if (process.env.VERCEL) {
      // Running on Vercel without a Blob token configured = no place to write.
      return NextResponse.json(
        {
          error:
            "Blob storage not configured. Enable Vercel Blob in the dashboard and set BLOB_READ_WRITE_TOKEN.",
        },
        { status: 501 }
      );
    }

    const { writeFile, mkdir } = await import("fs/promises");
    const { join } = await import("path");

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const dir = join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });
    const path = join(dir, file.name);
    await writeFile(path, buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/${folder}/${file.name}`,
      storage: "fs",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
