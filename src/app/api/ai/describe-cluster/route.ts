import { generateClusterDescription } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { cluster } = (await req.json()) as { cluster: RecordRow[] };

    if (!Array.isArray(cluster)) {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }

    const result = await generateClusterDescription({ cluster });

    return Response.json(result);

  } catch (e: any) |
    console.error(e);
    return Response.json(
      { error: 'AI service failure' },
      { status: 500 }
    );
  }
}
