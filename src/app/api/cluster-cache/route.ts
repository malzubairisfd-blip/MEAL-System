
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
        // File exists, so we read, merge, and update it
        const existingFileContent = await fs.readFile(filePath, 'utf-8');
        const existingData = JSON.parse(existingFileContent);
        
        // Deep merge logic: This assumes the data is flat at the top level
        updatedData = {
          ...existingData,
          ...body, // body contains the new chunks to merge in
          // Specifically handle array and object appends
          rows: [...(existingData.rows || []), ...(body.rows || [])],
          clusters: [...(existingData.clusters || []), ...(body.clusters || [])],
          aiSummaries: {...(existingData.aiSummaries || {}), ...(body.aiSummaries || {})},
          auditFindings: body.auditFindings || existingData.auditFindings, // Overwrite audit findings
          originalHeaders: body.originalHeaders || existingData.originalHeaders // Overwrite headers
        };
        // Remove the cacheId from the data itself
        delete (updatedData as any).cacheId;


    } catch (error) {
        // File doesn't exist, create it from scratch.
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            updatedData = body;
            delete (updatedData as any).cacheId;
        } else {
            throw error; // Re-throw other errors (e.g., parsing errors)
        }
    }

    await fs.writeFile(filePath, JSON.stringify(updatedData));
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
    
    // The entire file content is the response
    return NextResponse.json(JSON.parse(fileContent));

  } catch (error: any) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ ok: false, error: 'Cache not found' }, { status: 404 });
    }
    console.error('Cache GET Error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to read from cache: ' + error.message }, { status: 500 });
  }
}

    