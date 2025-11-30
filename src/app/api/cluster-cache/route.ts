
let savedClusters: any[] = [];
let savedRows: any[] = [];

export async function POST(req: Request) {
  try {
    const { clusters, rows } = await req.json();
    if (clusters) savedClusters = clusters;
    if (rows) savedRows = rows;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET() {
  return Response.json({ clusters: savedClusters, rows: savedRows });
}
