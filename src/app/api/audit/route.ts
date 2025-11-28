// app/api/audit/route.ts
import { NextResponse } from "next/server";
import { runAudit } from "../../../lib/auditEngine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows = body.rows || [];
    const findings = runAudit(rows);

    return NextResponse.json({ ok: true, findings });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
