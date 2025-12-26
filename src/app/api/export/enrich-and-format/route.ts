// This file is now deprecated.
// All export logic has been moved to a client-side Web Worker for performance.
// See src/app/export/page.tsx and src/workers/export.worker.ts

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    return NextResponse.json({ 
        ok: false, 
        error: "This endpoint is deprecated. Excel generation now happens on the client." 
    }, { status: 410 });
}
