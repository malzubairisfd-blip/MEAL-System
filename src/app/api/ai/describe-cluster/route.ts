
// src/app/api/ai/describe-cluster/route.ts
import { NextRequest, NextResponse } from "next/server";
import { describeCluster } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from "@/lib/types";

export async function POST(req: NextRequest) {
    try {
        const { cluster } = await req.json() as { cluster: RecordRow[] };

        if (!cluster || !Array.isArray(cluster) || cluster.length === 0) {
            return NextResponse.json({ error: "Invalid cluster data provided." }, { status: 400 });
        }

        const result = await describeCluster(cluster);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("AI description error:", error);
        return NextResponse.json({ error: "Failed to generate AI summary.", details: error.message }, { status: 500 });
    }
}
