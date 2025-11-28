let savedClusters: any[] = [];

export async function POST(req: Request) {
  try {
    const { clusters } = await req.json();
    savedClusters = clusters;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET() {
  return Response.json({ clusters: savedClusters });
}
