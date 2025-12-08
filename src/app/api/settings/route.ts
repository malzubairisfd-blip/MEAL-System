
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
      thresholds: {
        minPair: 0.40,
        minInternal: 0.52,
        blockChunkSize: 6500
      },
      fieldWeights: {
        womanName: 0.60,
        husbandName: 0.25,
        nationalId: 0.07,
        phone: 0.03,
        household: 0.03,
        village: 0.02
      },
      finalScore: {
        firstNameScore: 0.20,
        familyNameScore: 0.28,
        advancedNameScore: 0.18,
        tokenReorderScore: 0.17,
        husbandScore: 0.12,
        idScore: 0.025,
        phoneScore: 0.01,
        childrenScore: 0.005,
        locationScore: 0.005
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
    body.thresholds = body.thresholds || {};
    body.thresholds.minPair = Number(body.thresholds.minPair) || defaults.thresholds.minPair;
    body.thresholds.minInternal = Number(body.thresholds.minInternal) || defaults.thresholds.minInternal;
    body.thresholds.blockChunkSize = Number(body.thresholds.blockChunkSize) || defaults.thresholds.blockChunkSize;

    // Ensure field weights exist
    body.fieldWeights = body.fieldWeights || {};
    for (const k of Object.keys(defaults.fieldWeights)) {
      body.fieldWeights[k] = typeof body.fieldWeights[k] === "number" ? Number(body.fieldWeights[k]) : defaults.fieldWeights[k as keyof typeof defaults.fieldWeights];
    }
    
    // Ensure final score weights exist
    body.finalScore = body.finalScore || {};
    for (const k of Object.keys(defaults.finalScore)) {
      body.finalScore[k] = typeof body.finalScore[k] === "number" ? Number(body.finalScore[k]) : defaults.finalScore[k as keyof typeof defaults.finalScore];
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
