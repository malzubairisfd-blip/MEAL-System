
import { NextResponse } from 'next/server';
import { generateClusterDescription, type ClusterDescriptionInput } from '@/ai/flows/llm-powered-audit-assistant';

export async function POST(req: Request) {
  try {
    const { cluster } = await req.json();

    if (!cluster || !Array.isArray(cluster)) {
      return NextResponse.json({ error: 'Invalid cluster data provided.' }, { status: 400 });
    }

    const input: ClusterDescriptionInput = { cluster };
    const result = await generateClusterDescription(input);

    return NextResponse.json({ description: result.description });
  } catch (error: any) {
    console.error('Error generating cluster description:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
