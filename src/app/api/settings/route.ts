
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

function getDefaultSettings() {
    return {
        minPair: 0.52,
        minInternal: 0.65,
        blockChunkSize: 5000,
        weights: { womanName: 0.45, husbandName: 0.25, household: 0.1, nationalId: 0.1, phone: 0.05, village: 0.05 },
        finalScoreWeights: {
            firstNameScore: 0.15,
            familyNameScore: 0.25,
            advancedNameScore: 0.12,
            tokenReorderScore: 0.10,
            husbandScore: 0.12,
            idScore: 0.08,
            phoneScore: 0.05,
            childrenScore: 0.04,
            locationScore: 0.04,
        },
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
}


async function initializeSettingsIfNeeded() {
    const SETTINGS_PATH = getSettingsPath();
    try {
        await fs.access(SETTINGS_PATH);
    } catch {
        // File doesn't exist, create it with defaults
        const defaultSettings = getDefaultSettings();
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
    const defaults = getDefaultSettings();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    // Sanitize numeric thresholds
    body.minPair = Number(body.minPair) || defaults.minPair;
    body.minInternal = Number(body.minInternal) || defaults.minInternal;
    body.blockChunkSize = Number(body.blockChunkSize) || defaults.blockChunkSize;

    // Ensure weights exist
    body.weights = body.weights || {};
    for (const k of Object.keys(defaults.weights)) {
      body.weights[k] = typeof body.weights[k] === "number" ? Number(body.weights[k]) : defaults.weights[k as keyof typeof defaults.weights];
    }
    
    // Ensure final score weights exist
    body.finalScoreWeights = body.finalScoreWeights || {};
    for (const k of Object.keys(defaults.finalScoreWeights)) {
      body.finalScoreWeights[k] = typeof body.finalScoreWeights[k] === "number" ? Number(body.finalScoreWeights[k]) : defaults.finalScoreWeights[k as keyof typeof defaults.finalScoreWeights];
    }


    // Ensure rules exist
    body.rules = body.rules || {};
    for (const k of Object.keys(defaults.rules)) {
      body.rules[k] = typeof body.rules[k] === "boolean" ? body.rules[k] : defaults.rules[k as keyof typeof defaults.rules];
    }

    await fs.writeFile(SETTINGS_PATH, JSON.stringify(body, null, 2), "utf8");
    return NextResponse.json({ ok: true, settings: body });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Failed to save settings", details: String(err) }, { status: 500 });
  }
}
