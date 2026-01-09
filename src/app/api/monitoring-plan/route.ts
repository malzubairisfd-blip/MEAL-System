
// This file is deprecated. The logic has been moved to /api/purpose-and-scope/route.ts
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ error: "This endpoint is deprecated. Please use /api/purpose-and-scope." }, { status: 410 });
}

export async function POST() {
    return NextResponse.json({ error: "This endpoint is deprecated. Please use /api/purpose-and-scope." }, { status: 410 });
}
