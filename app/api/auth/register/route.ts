
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import clientPromise from '../../../../lib/mongodb';
import type { MongoClient } from 'mongodb';

export async function POST(req: NextRequest) {
  const data = await req.json();
  try {
    const client: MongoClient = await clientPromise;
    const db = client.db();

    // BLOCK CHECK: refuse re-registration with a blocked email or username.
    if (data.email || data.username) {
      const blockClauses: Record<string, string>[] = [];
      if (data.email) blockClauses.push({ email: data.email }, { username: data.email });
      if (data.username) blockClauses.push({ username: data.username }, { email: data.username });
      const blocked = await db.collection("blocked").findOne({ $or: blockClauses });
      if (blocked) {
        return NextResponse.json(
          { error: "This account has been blocked from the site." },
          { status: 403 }
        );
      }
    }

    // Check if user already exists (by email or username)
    const exists = await db.collection('users').findOne({ $or: [ { email: data.email }, { username: data.username } ] });
    if (exists) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }
    await db.collection('users').insertOne(data);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
