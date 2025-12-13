
// src/app/api/ai/describe-cluster/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateClusterDescription } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClusterWithId = {
    clusterId: string;
    records: RecordRow[];
}

export async function POST(req: NextRequest) {
    try {
        const { clusters } = await req.json() as { clusters: ClusterWithId[] };

        if (!clusters || !Array.isArray(clusters) || clusters.length === 0) {
            return new NextResponse(JSON.stringify({ error: "Invalid cluster data provided." }), { 
                status: 400, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                
                for (const { clusterId, records } of clusters) {
                    try {
                        const result = await generateClusterDescription({ cluster: records });
                        const payload = {
                            clusterId,
                            description: result.description,
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
                    } catch (error: any) {
                         const errorPayload = {
                            clusterId,
                            error: `Failed to generate summary for cluster. ${error.message}`,
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorPayload)}\n\n`));
                    }
                }
                
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error("AI description streaming error:", error);
        return new NextResponse(JSON.stringify({ 
            error: "Failed to start AI summary stream.", 
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
