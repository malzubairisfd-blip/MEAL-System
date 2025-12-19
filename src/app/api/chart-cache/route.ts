
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
    const cacheId = body.cacheId;
    
    if (!cacheId) {
        return NextResponse.json({ ok: false, error: 'Cache ID is required for updates.' }, { status: 400 });
    }

    const filePath = path.join(cacheDir, `${cacheId}.json`);
    let updatedData = {};

    try {
        const existingFileContent = await fs.readFile(filePath, 'utf-8');
        const existingData = JSON.parse(existingFileContent);
        
        updatedData = {
          ...existingData,
          chartImages: body.images || existingData.chartImages,
        };

    } catch (error) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            updatedData = { chartImages: body.images };
        } else {
            throw error;
        }
    }

    await fs.writeFile(filePath, JSON.stringify(updatedData));
    return NextResponse.json({ ok: true, cacheId });

  } catch (error: any) {
    console.error('Chart Cache POST Error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to write chart images to cache: ' + error.message }, { status: 500 });
  }
}
