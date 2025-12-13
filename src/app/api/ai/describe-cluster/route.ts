
import { generateClusterDescription } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // دعم الحالتين:
    // { cluster: [...] }
    // { clusters: [ [...], [...] ] }

    let clusters: RecordRow[][] = [];

    if (Array.isArray(body?.clusters)) {
      clusters = body.clusters;
    } else if (Array.isArray(body?.cluster)) {
      clusters = [body.cluster];
    } else {
      return Response.json(
        { error: 'Invalid cluster data provided' },
        { status: 400 }
      );
    }

    const results: Record<string, string> = {};

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const key =
        cluster
          .map(r => r._internalId || Math.random().toString(36))
          .sort()
          .join('-');

      try {
        const res = await generateClusterDescription({ cluster });
        results[key] = res.description;
      } catch (err) {
        console.error('AI error for cluster:', err);
        results[key] = 'تعذر توليد ملخص لهذه المجموعة.';
      }
    }

    return Response.json({
      ok: true,
      results
    });

  } catch (e: any) {
    console.error('Describe cluster API error:', e);
    return Response.json(
      { error: 'AI service failure' },
      { status: 500 }
    );
  }
}
