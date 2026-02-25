
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import clientPromise from '../../../../lib/mongodb';
import type { MongoClient } from 'mongodb';

// Fetch all content for homepage (images, videos, files, contact)
export async function GET() {
  try {
    const client: MongoClient = await clientPromise;
    const db = client.db();
    const content = await db.collection('content').find({}).sort({ date: -1 }).toArray();
    return NextResponse.json(content);
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// Accepts: { type: 'image'|'video'|'file'|'contact', data: {...} }
export async function POST(req: NextRequest) {
  const { type, data } = await req.json();
  if (!type || !data) {
    return NextResponse.json({ error: 'Type and data required' }, { status: 400 });
  }
  try {
    const client: MongoClient = await clientPromise;
    const db = client.db();
    // Store in a generic 'content' collection
    await db.collection('content').insertOne({ type, ...data, date: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// For editing content (by _id)
export async function PUT(req: NextRequest) {
  const { _id, type, data } = await req.json();
  if (!_id || !type || !data) {
    return NextResponse.json({ error: 'ID, type, and data required' }, { status: 400 });
  }
  try {
    const client: MongoClient = await clientPromise;
    const db = client.db();
    await db.collection('content').updateOne({ _id }, { $set: { ...data, type } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
