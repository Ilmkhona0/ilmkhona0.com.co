
import { NextRequest, NextResponse } from "next/server";
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// POST: Add a comment or reply
export async function POST(req: NextRequest) {
  const data = await req.json();
  if (!data.message) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }
  try {
    const client = await clientPromise;
    const db = client.db();
    const comment = {
      message: data.message,
      date: new Date().toISOString(),
      parentId: data.parentId ? new ObjectId(data.parentId) : null,
      likes: 0,
      dislikes: 0
    };
    await db.collection('comments').insertOne(comment);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// GET: Fetch all comments with reply counts
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();
    // Fetch all comments
    const comments = await db.collection('comments').find({}).sort({ date: -1 }).toArray();
    // Add replyCount for each top-level comment
    const replyCounts = {};
    comments.forEach(c => {
      if (c.parentId) {
        const pid = c.parentId.toString();
        replyCounts[pid] = (replyCounts[pid] || 0) + 1;
      }
    });
    const commentsWithReplies = comments.map(c => ({
      ...c,
      _id: c._id.toString(),
      parentId: c.parentId ? c.parentId.toString() : null,
      replyCount: replyCounts[c._id?.toString()] || 0
    }));
    return NextResponse.json(commentsWithReplies);
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH: Like or dislike a comment
export async function PATCH(req: NextRequest) {
  const { commentId, action } = await req.json();
  if (!commentId || !['like','dislike'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    const client = await clientPromise;
    const db = client.db();
    const update = action === 'like' ? { $inc: { likes: 1 } } : { $inc: { dislikes: 1 } };
    await db.collection('comments').updateOne({ _id: new ObjectId(commentId) }, update);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
