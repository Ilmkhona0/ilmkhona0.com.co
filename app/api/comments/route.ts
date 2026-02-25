import { NextRequest, NextResponse } from "next/server";
import clientPromise from '../../../lib/mongodb';

export async function POST(req: NextRequest) {
  const data = await req.json();
  if (!data.message) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }
  try {
    const client = await clientPromise;
    const db = client.db();
    const comment = { message: data.message, date: new Date().toISOString() };
    await db.collection('comments').insertOne(comment);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();
    const comments = await db.collection('comments').find({}).sort({ date: -1 }).toArray();
    return NextResponse.json(comments);
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
