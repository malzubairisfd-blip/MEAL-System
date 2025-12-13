import { generateClusterDescription } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Prevent caching

function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('AI timeout'));
    }, ms);

    promise
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    let clusters: RecordRow[][] = [];
    if (Array.isArray(body?.clusters)) {
      clusters = body.clusters;
    } else if (Array.isArray(body?.cluster)) {
      clusters = [body.cluster];
    }
    
    if (!clusters || clusters.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or empty cluster data provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        };

        const processCluster = async (cluster: RecordRow[]) => {
          const clusterKey = cluster
            .map(r => r._internalId || Math.random().toString(36))
            .sort()
            .join('-');
            
          try {
            const result = await withTimeout(
              generateClusterDescription({ cluster }),
              20000
            );
            send({
              clusterKey,
              description: result.description,
              status: 'success',
            });
          } catch (e: any) {
            console.error('AI summary error for cluster:', e);
            const isTimeout = e.message.includes('timeout');
            send({
              clusterKey,
              error: isTimeout
                ? 'AI summary generation timed out'
                : e.message || 'An unknown error occurred.',
              status: isTimeout ? 'timeout' : 'error',
            });
          }
        };

        // Process all clusters in parallel
        await Promise.all(clusters.map(processCluster));
        
        // Signal completion
        send({ done: true });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (e: any) {
    console.error('Describe cluster streaming API error:', e);
    return new Response(JSON.stringify({ error: 'AI service failure or invalid request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
