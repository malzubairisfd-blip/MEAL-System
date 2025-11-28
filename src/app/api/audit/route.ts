// app/api/audit/route.ts
import { NextResponse } from "next/server";
import { runAudit, RecordRow } from "../../../lib/auditEngine";

export async function POST(req: Request) {
  try {
    const body: { rows: RecordRow[] } = await req.json();
    const findings = runAudit(body.rows);
    return NextResponse.json({ ok: true, findings });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
