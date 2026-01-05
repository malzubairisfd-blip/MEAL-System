
// src/app/api/learn/route.ts
import { NextResponse } from "next/server";
import { learnFromFailure } from "@/workers/cluster.worker";
import type { RecordRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const failureCluster: RecordRow[] = body.cluster;

    if (!Array.isArray(failureCluster) || failureCluster.length < 2) {
      return NextResponse.json(
        { ok: false, error: "A cluster must contain at least two records." },
        { status: 400 }
      );
    }
    
    // This is a simplified, synchronous call for the API context.
    // In a real scenario, this might be a more complex interaction if rules
    // needed to be persisted to a database.
    const newRuleId = learnFromFailure(failureCluster);

    if (newRuleId) {
        return NextResponse.json({ 
            ok: true, 
            message: `Successfully learned a new rule (${newRuleId}) from the provided cluster. Please re-run the clustering process to apply it.`
        });
    } else {
        return NextResponse.json({
            ok: false,
            error: "Could not derive a new rule from the provided records. The pattern might be too ambiguous or already covered."
        }, { status: 400 });
    }

  } catch (err: any) {
    console.error("[LEARN_API_ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to process the learning request.", details: err.message },
      { status: 500 }
    );
  }
}
