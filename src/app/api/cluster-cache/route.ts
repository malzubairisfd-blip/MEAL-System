
// A simple in-memory cache for storing clustering results between steps.
// This avoids hitting browser sessionStorage limits for large datasets.

let cache: { [key: string]: any } = {
    clusters: [],
    rows: [],
    originalHeaders: [],
    idColumnName: '',
    auditFindings: [],
    aiSummaries: {},
};

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // Merge new data into the cache instead of overwriting
    cache = { ...cache, ...data };
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET() {
  return Response.json(cache);
}

    