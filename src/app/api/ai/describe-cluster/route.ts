
// src/app/api/ai/describe-cluster/route.ts
import { NextRequest, NextResponse } from "next/server";
import { describeClusterStream } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { cluster, clusterId } = await req.json() as { cluster: RecordRow[], clusterId: string };

        if (!cluster || !Array.isArray(cluster) || cluster.length === 0 || !clusterId) {
            return new Response(JSON.stringify({ error: "Invalid cluster data or clusterId provided." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const stream = await describeClusterStream({ cluster, clusterId });

        const readableStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                for await (const chunk of stream) {
                    const payload = {
                        clusterId: chunk.clusterId,
                        summary: chunk.summary,
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
                }
                controller.close();
            },
        });

        return new Response(readableStream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });

    } catch (error: any) {
        console.error("AI description stream error:", error);
        return new Response(JSON.stringify({ error: "Failed to generate AI summary stream.", details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
