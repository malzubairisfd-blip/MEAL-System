
// src/app/api/ai/describe-cluster/route.ts
import { generateClusterDescription } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let clusters: RecordRow[][];

  try {
    const body = await req.json();
    if (Array.isArray(body?.clusters)) {
      clusters = body.clusters;
    } else if (Array.isArray(body?.cluster)) {
      clusters = [body.cluster];
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid or empty cluster data provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (clusters.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or empty cluster data provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const send = (data: any) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  // 🔥 CRITICAL: send heartbeat immediately
  send({ status: 'connected' });

  (async () => {
    try {
      for (const cluster of clusters) {
        const clusterKey = cluster.map(r => r._internalId || Math.random().toString(36)).sort().join('-');

        try {
            // ⏱ Timeout protection
            const result = await Promise.race([
                generateClusterDescription({ cluster }),
                new Promise<{ description: string }>((_, reject) =>
                    setTimeout(() => reject(new Error('AI timeout')), 20000)
                ),
            ]);

            send({
              clusterKey: clusterKey,
              description: result.description,
            });
        } catch (err: any) {
            console.error('AI error for cluster:', err);
            send({ clusterKey: clusterKey, error: `AI summary failed for this cluster: ${err.message}` });
        }
      }
      send({ done: true });
    } catch (err: any) {
      console.error('Streaming error:', err);
      send({ error: 'A critical error occurred during the AI summary process.' });
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}


// src/app/api/bnf-assessed/download/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDbPath_bnf_download = () => path.join(process.cwd(), 'src/data', 'bnf-assessed.db');

export async function GET_bnf_download(req: Request) {
    const dbPath = getDbPath_bnf_download();
    try {
        const fileBuffer = await fs.readFile(dbPath);
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/x-sqlite3',
                'Content-Disposition': 'attachment; filename="bnf-assessed.db"',
            },
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ error: "Database file not found. Please save data first." }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to download database file.", details: error.message }, { status: 500 });
    }
}
