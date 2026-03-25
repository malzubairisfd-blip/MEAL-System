
// This API route is deprecated.
// The logic has been moved to a client-side library at /src/lib/confirmationchildcmam-export.ts
// The page component now generates the PDF in the browser using html2pdf.js.

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    return NextResponse.json({ error: "This API route is deprecated. Use the client-side generation library." }, { status: 410 });
}
