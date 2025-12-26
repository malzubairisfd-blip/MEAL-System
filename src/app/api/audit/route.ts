

import { NextResponse } from "next/server";

// This server-side route is no longer used for the main audit logic.
// The audit is now performed client-side in `/lib/auditEngine.ts`.
// This file is kept to prevent breaking changes if any other part of the system still references it,
// but it will simply return an empty array. For a full cleanup, this route could be deleted.

export const runtime = "nodejs"; // prevent edge runtime

export async function POST(req: Request) {
  try {
    // Return a successful but empty response to indicate the endpoint is deprecated
    // and logic has moved.
    return NextResponse.json({
      ok: true,
      issues: [],
      count: 0,
      message: "This audit endpoint is deprecated. Logic has moved to the client-side."
    });

  } catch (err: any) {
    console.error("Audit API Error (Deprecated):", err);
    return NextResponse.json({ ok: false, error: err.message || "Internal Server Error." }, { status: 500 });
  }
}
