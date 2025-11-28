import { NextResponse } from "next/server";
import { runClustering } from "../../../lib/fuzzyCluster";
import type { RecordRow } from "../../../lib/fuzzyCluster";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows: RecordRow[] = body.rows || [];
    const opts = body.opts || {};
    const result = await runClustering(rows, opts);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("Clustering error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
