
import { NextResponse } from "next/server";
import { fullPairwiseBreakdown } from "../../../lib/fuzzyCluster"; 
import type { RecordRow } from "../../../lib/fuzzyCluster";

export async function POST(req: Request) {
  try {
    const { cluster } = await req.json();
    if (!cluster || !Array.isArray(cluster)) {
      return NextResponse.json({ error: "Invalid cluster data" }, { status: 400 });
    }
    const pairs = fullPairwiseBreakdown(cluster as RecordRow[]);
    return NextResponse.json({ pairs });
  } catch(error: any) {
    console.error("Pairwise scoring error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
