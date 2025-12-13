
// src/app/api/ai/describe-cluster/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateClusterDescription } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { cluster } = await req.json() as { cluster: RecordRow[] };

        if (!cluster || !Array.isArray(cluster) || cluster.length === 0) {
            return new NextResponse(JSON.stringify({ error: "Invalid cluster data provided." }), { 
                status: 400, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        // Call the new async function
        const result = await generateClusterDescription({ cluster });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("AI description error:", error);
        // Ensure a JSON error response is always sent
        return new NextResponse(JSON.stringify({ 
            error: "Failed to generate AI summary.", 
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
