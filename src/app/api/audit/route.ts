import { runAudit } from "@/lib/auditEngine";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { rows } = await req.json();
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid rows data" }, { status: 400 });
    }
    const findings = runAudit(rows);
    return NextResponse.json({ findings });
  } catch (error: any) {
    console.error("Audit error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
