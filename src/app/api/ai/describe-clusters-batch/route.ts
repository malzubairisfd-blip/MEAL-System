
import { generateClusterDescription } from '@/ai/flows/llm-powered-audit-assistant';
import type { RecordRow } from "@/lib/fuzzyCluster";

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createStreamingResponse() {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const send = (data: object) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };
  
  const close = () => {
    writer.close();
  };

  return { stream, writer, send, close };
}

export async function POST(req: Request) {
  try {
    const { clusters } = (await req.json()) as { clusters: RecordRow[][] };
    if (!clusters || !Array.isArray(clusters)) {
      return new Response(JSON.stringify({ error: 'Invalid cluster data provided.' }), { status: 400 });
    }

    const { stream, send, close } = createStreamingResponse();
    
    // Process clusters in batches without blocking the main thread
    (async () => {
      try {
        for (let i = 0; i < clusters.length; i += BATCH_SIZE) {
            const batch = clusters.slice(i, i + BATCH_SIZE);

            const promises = batch.map(async (cluster) => {
                const clusterKey = cluster.map(r => r._internalId).sort().join('-');
                try {
                    const result = await generateClusterDescription({ cluster });
                    return { clusterKey, description: result.description, status: 'fulfilled' as const };
                } catch (error: any) {
                    console.error(`Failed to generate summary for cluster ${clusterKey}:`, error);
                    return { clusterKey, error: error.message || 'Unknown AI error', status: 'rejected' as const };
                }
            });
            
            const settledResults = await Promise.allSettled(promises);

            for (const result of settledResults) {
              if (result.status === 'fulfilled') {
                send(result.value);
              } else {
                // This case handles errors in the promise logic itself, not the AI call
                console.error('Batch processing promise failed:', result.reason);
                send({ clusterKey: 'unknown', error: result.reason?.message || 'An unknown processing error occurred.' });
              }
            }

            if (i + BATCH_SIZE < clusters.length) {
                await delay(BATCH_DELAY_MS);
            }
        }
      } catch (e: any) {
        console.error("Error within async batch processing:", e);
        send({ clusterKey: 'batch_error', error: e.message || 'A critical error occurred while processing batches.' });
      } finally {
        close();
      }
    })();


    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Batch Describe API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred in the API route.' }), { status: 500 });
  }
}
