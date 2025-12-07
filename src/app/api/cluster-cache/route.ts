
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Gets a temporary directory that is shared across serverless function invocations.
const getTmpDir = () => path.join(os.tmpdir(), 'beneficiary-insights-cache');

async function ensureCacheDir() {
  const dir = getTmpDir();
  try {
    await fs.access(dir);
  } catch (e) {
    await fs.mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cacheDir = await ensureCacheDir();
    let cacheId = body.cacheId;
    
    if (cacheId && body.data) {
        // This is an update to an existing cache file
        const filePath = path.join(cacheDir, `${cacheId}.json`);
        try {
            const existingData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
            const updatedData = { ...existingData, ...body.data };
            await fs.writeFile(filePath, JSON.stringify(updatedData));
            return NextResponse.json({ ok: true, cacheId });
        } catch (error) {
            // If the file doesn't exist, treat it as a new cache creation
            if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                 // Fall through to create a new file
            } else {
                throw error; // Re-throw other errors
            }
        }
    }
    
    // This is a new cache creation
    cacheId = cacheId || `cache-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const filePath = path.join(cacheDir, `${cacheId}.json`);
    // The initial post now includes the data wrapper
    await fs.writeFile(filePath, JSON.stringify({ data: body }));

    return NextResponse.json({ ok: true, cacheId });

  } catch (error: any) {
    console.error('Cache POST Error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to write to cache: ' + error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cacheId = searchParams.get('id');

    if (!cacheId) {
      return NextResponse.json({ ok: false, error: 'Cache ID is required' }, { status: 400 });
    }

    const cacheDir = await ensureCacheDir();
    const filePath = path.join(cacheDir, `${cacheId}.json`);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // The entire file content is the response, which already includes the `data` wrapper
    return NextResponse.json(JSON.parse(fileContent));

  } catch (error: any) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ ok: false, error: 'Cache not found' }, { status: 404 });
    }
    console.error('Cache GET Error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to read from cache: ' + error.message }, { status: 500 });
  }
}
