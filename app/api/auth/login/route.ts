import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import clientPromise from '../../../../lib/mongodb';
import type { MongoClient } from 'mongodb';

export async function POST(req: NextRequest) {
  const { email, username, password } = await req.json();

  // ADMIN LOGIN (allow username or email)
  const isAdmin =
    ((email && email === "ilmkhona0") || (username && username === "ilmkhona0") || (email && email === "ilmkhona@gmail.com")) &&
    password === "MySecret123";
  if (isAdmin) {
    const res = NextResponse.json({ role: "admin" });
    res.cookies.set("role", "admin", {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    res.cookies.set("session", "admin-session-token", {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }


  // USER LOGIN: check by username or email
  try {
    const client = await clientPromise as MongoClient;
    if (!client) throw new Error("MongoClient not initialized");
    const db = client.db();

    // BLOCK CHECK: refuse if email or username is on the blocked list
    const blockClauses: Record<string, string>[] = [];
    if (email) {
      blockClauses.push({ email }, { username: email });
    }
    if (username) {
      blockClauses.push({ username }, { email: username });
    }
    if (blockClauses.length > 0) {
      const blocked = await db.collection("blocked").findOne({ $or: blockClauses });
      if (blocked) {
        return NextResponse.json(
          { error: "This account has been blocked." },
          { status: 403 }
        );
      }
    }

    const user = await db.collection('users').findOne({
      $or: [
        { email, password },
        { username, password },
        { username: email, password },
        { email: username, password }
      ]
    });
    if (user) {
      const res = NextResponse.json({ role: "user", username: user.username });
      res.cookies.set("role", "user", {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      res.cookies.set("session", `user-session-token-${user.username}` , {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return res;
    }
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json(
    { error: "Invalid credentials" },
    { status: 401 }
  );
}
