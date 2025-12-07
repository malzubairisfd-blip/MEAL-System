// src/app/api/settings/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";

// Note: In a real serverless environment, you'd use a shared storage like a bucket.
// For this environment, we use a temporary directory.
import path from "path";
import os from "os";

const getTmpDir = () => path.join(os.tmpdir(), 'beneficiary-insights-cache');
const getSettingsPath = () => path.join(getTmpDir(), 'settings.json');

async function ensureCacheDir() {
  const dir = getTmpDir();
  try {
    await fs.access(dir);
  } catch (e) {
    await fs.mkdir(dir, { recursive: true });
  }
  return dir;
}

async function initializeSettingsIfNeeded() {
    const SETTINGS_PATH = getSettingsPath();
    try {
        await fs.access(SETTINGS_PATH);
    } catch {
        // File doesn't exist, create it with defaults
        const defaultSettings = {
            minPair: 0.52,
            minInternal: 0.65,
            blockChunkSize: 5000,
            weights: { womanName: 0.45, husbandName: 0.25, household: 0.1, nationalId: 0.1, phone: 0.05, village: 0.05 },
            rules: {
                enableArabicNormalizer: true,
                enableNameRootEngine: true,
                enableTribalLineage: true,
                enableMaternalLineage: true,
                enableOrderFreeMatching: true,
                enablePolygamyRules: true,
                enableIncestBlocking: true
            }
        };
        await fs.writeFile(SETTINGS_PATH, JSON.stringify(defaultSettings, null, 2), "utf8");
    }
}


export const runtime = "nodejs";

export async function GET() {
  await ensureCacheDir();
  await initializeSettingsIfNeeded();
  const SETTINGS_PATH = getSettingsPath();
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const settings = JSON.parse(raw);
    return NextResponse.json({ ok: true, settings });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Missing or unreadable settings.json", details: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureCacheDir();
  await initializeSettingsIfNeeded();
  const SETTINGS_PATH = getSettingsPath();
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    // Sanitize numeric thresholds
    body.minPair = Number(body.minPair) || 0.5;
    body.minInternal = Number(body.minInternal) || 0.6;
    body.blockChunkSize = Number(body.blockChunkSize) || 1200;

    // Ensure weights exist
    body.weights = body.weights || {};
    const defaultWeights: { [key: string]: number } = { womanName: 0.45, husbandName: 0.25, household: 0.1, nationalId: 0.1, phone: 0.05, village: 0.05 };
    for (const k of Object.keys(defaultWeights)) {
      body.weights[k] = typeof body.weights[k] === "number" ? Number(body.weights[k]) : defaultWeights[k];
    }

    // Ensure rules exist
    body.rules = body.rules || {};
    const defaultRules: Record<string, boolean> = {
      enableArabicNormalizer: true,
      enableNameRootEngine: true,
      enableTribalLineage: true,
      enableMaternalLineage: true,
      enableOrderFreeMatching: true,
      enablePolygamyRules: true,
      enableIncestBlocking: true
    };
    for (const k of Object.keys(defaultRules)) {
      body.rules[k] = typeof body.rules[k] === "boolean" ? body.rules[k] : defaultRules[k];
    }

    await fs.writeFile(SETTINGS_PATH, JSON.stringify(body, null, 2), "utf8");
    return NextResponse.json({ ok: true, settings: body });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Failed to save settings", details: String(err) }, { status: 500 });
  }
}