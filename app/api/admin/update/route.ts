import { NextResponse } from "next/server";
export async function PUT(req: any) {
// MongoDB disabled
return NextResponse.json({ message: 'Database disabled for deployment' });

}