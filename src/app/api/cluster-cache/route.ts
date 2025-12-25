// This file is no longer used by the application and can be safely deleted or ignored.
// Caching is now handled on the client-side using IndexedDB.

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  return NextResponse.json({ ok: true, message: 'This endpoint is deprecated.' });
}

export async function GET(req: Request) {
    return NextResponse.json({ ok: false, error: 'This endpoint is deprecated.' }, { status: 410 });
}
