import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * Comment schema (collection: "comments")
 *   _id:        ObjectId
 *   text:       string
 *   author:     string         // username displayed
 *   authorId?:  string         // (optional) stable user id if known
 *   parentId:   ObjectId|null  // null = top-level
 *   date:       string (ISO)
 *   likes:      number
 *   dislikes:   number
 */

type CommentDoc = {
  _id: ObjectId;
  text?: string;
  message?: string; // legacy field, kept for back-compat reads
  author?: string;
  authorId?: string;
  parentId: ObjectId | null;
  date: string;
  likes: number;
  dislikes: number;
};

function isAdminReq(req: NextRequest): boolean {
  return req.cookies.get("role")?.value === "admin";
}

// ---------- GET: list ----------
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();
    const docs = (await db
      .collection<CommentDoc>("comments")
      .find({})
      .sort({ date: -1 })
      .toArray()) as CommentDoc[];

    const comments = docs.map((c) => ({
      id: c._id.toString(),
      text: c.text ?? c.message ?? "", // tolerate old rows
      author: c.author ?? "Anonymous",
      authorId: c.authorId,
      parentId: c.parentId ? c.parentId.toString() : null,
      date: c.date,
      likes: c.likes ?? 0,
      dislikes: c.dislikes ?? 0,
    }));
    return NextResponse.json(comments);
  } catch (err) {
    console.error("GET /api/comments error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ---------- POST: create comment or reply ----------
export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => ({}));
  const text = (data.text || "").toString().trim();
  const author = (data.author || "").toString().trim();
  const authorId = data.authorId ? data.authorId.toString() : undefined;
  const parentId = data.parentId ? data.parentId.toString() : null;

  if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });
  if (!author) return NextResponse.json({ error: "Author required" }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db();

    // Block check: refuse comment from blocked users
    if (author) {
      const blocked = await db.collection("blocked").findOne({
        $or: [{ username: author }, { email: author }],
      });
      if (blocked) {
        return NextResponse.json(
          { error: "You are blocked from posting." },
          { status: 403 }
        );
      }
    }

    const doc = {
      text,
      author,
      authorId,
      parentId: parentId ? new ObjectId(parentId) : null,
      date: new Date().toISOString(),
      likes: 0,
      dislikes: 0,
    };
    const result = await db.collection("comments").insertOne(doc);
    return NextResponse.json({ id: result.insertedId.toString(), ...doc, parentId });
  } catch (err) {
    console.error("POST /api/comments error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ---------- PATCH: like / dislike ----------
export async function PATCH(req: NextRequest) {
  const { commentId, action } = await req.json().catch(() => ({} as { commentId?: string; action?: string }));
  if (!commentId || !["like", "dislike"].includes(action || "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const client = await clientPromise;
    const db = client.db();
    const update = action === "like" ? { $inc: { likes: 1 } } : { $inc: { dislikes: 1 } };
    await db
      .collection("comments")
      .updateOne({ _id: new ObjectId(commentId) }, update);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/comments error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ---------- DELETE: admin removes a comment + cascades to replies ----------
export async function DELETE(req: NextRequest) {
  if (!isAdminReq(req)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db();
    const oid = new ObjectId(id);
    // Cascade: parent + every reply pointing at this parent
    await db.collection("comments").deleteMany({
      $or: [{ _id: oid }, { parentId: oid }],
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/comments error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
