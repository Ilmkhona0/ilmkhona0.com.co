import { NextResponse } from "next/server";

// /api/admin/update was removed. Returns 410 Gone for any caller.
export async function GET() {
  return NextResponse.json({ error: "Endpoint removed" }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ error: "Endpoint removed" }, { status: 410 });
}
export async function PUT() {
  return NextResponse.json({ error: "Endpoint removed" }, { status: 410 });
}
