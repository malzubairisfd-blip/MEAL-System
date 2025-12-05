import { generateClusterDescription } from '@/ai/flows/llm-powered-audit-assistant';
import type { RecordRow } from "@/lib/fuzzyCluster";

export const dynamic = 'force-dynamic'; // Defaults to auto

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to create a TransformStream for streaming data
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
        for (let i = 0; i < clusters.length; i += BATCH_SIZE) {
            const batch = clusters.slice(i, i + BATCH_SIZE);

            const promises = batch.map(async (cluster) => {
                const clusterKey = cluster.map(r => r._internalId).sort().join('-');
                try {
                    const result = await generateClusterDescription({ cluster });
                    return { clusterKey, description: result.description, status: 'fulfilled' };
                } catch (error: any) {
                    console.error(`Failed to generate summary for cluster ${clusterKey}:`, error);
                    return { clusterKey, error: error.message, status: 'rejected' };
                }
            });
            
            const results = await Promise.allSettled(promises);

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
                    send({ clusterKey: result.value.clusterKey, description: result.value.description });
                } else if(result.status === 'fulfilled' && result.value.status === 'rejected') {
                     send({ clusterKey: result.value.clusterKey, error: result.value.error });
                } else if (result.status === 'rejected') {
                     // This case handles errors in the promise logic itself, not the AI call
                     send({ clusterKey: 'unknown', error: result.reason?.message || 'An unknown processing error occurred.' });
                }
            });

            if (i + BATCH_SIZE < clusters.length) {
                await delay(BATCH_DELAY_MS);
            }
        }
        close();
    })();


    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Batch Describe Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), { status: 500 });
  }
}
