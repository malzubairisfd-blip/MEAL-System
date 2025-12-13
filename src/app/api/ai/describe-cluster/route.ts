import { generateClusterDescription } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clusters = body?.clusters as RecordRow[][];

    if (!clusters || !Array.isArray(clusters)) {
      return Response.json(
        { error: 'Invalid cluster data provided' },
        { status: 400 }
      );
    }

    const results: Record<string, string> = {};

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const key = cluster.map(r => r._internalId).sort().join('-');

      try {
        const res = await generateClusterDescription({ cluster });
        results[key] = res.description;
      } catch (innerErr) {
        console.error('Cluster AI error:', innerErr);
        results[key] = 'تعذر توليد ملخص لهذه المجموعة.';
      }
    }

    return Response.json({ ok: true, results });

  } catch (e: any) {
    console.error('Describe cluster API error:', e);
    return Response.json(
      { error: 'AI service failure' },
      { status: 500 }
    );
  }
}
