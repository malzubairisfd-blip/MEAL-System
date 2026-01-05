
import { NextResponse } from "next/server";
import { computePairScore } from "@/workers/scoring.worker";
import type { RecordRow } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { cluster } = await req.json();

    if (!cluster || !Array.isArray(cluster) || cluster.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Invalid cluster data provided." },
        { status: 400 }
      );
    }

    const pairs = [];
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        const recordA = cluster[i];
        const recordB = cluster[j];

        // We pass empty settings because the settings are only used for rules,
        // and the core scoring logic has defaults.
        const result = computePairScore(recordA, recordB, {});
        
        pairs.push({
          a: recordA,
          b: recordB,
          score: result.score,
          breakdown: result.breakdown,
        });
      }
    }
    
    // Sort pairs by score, descending
    pairs.sort((a,b) => b.score - a.score);

    return NextResponse.json({ ok: true, pairs });

  } catch (err: any) {
    console.error("Pairwise API error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to process pairwise request.", details: err.message },
      { status: 500 }
    );
  }
}
