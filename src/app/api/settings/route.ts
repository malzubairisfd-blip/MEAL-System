
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
        minPair: 0.62,
        minInternal: 0.54,
        blockChunkSize: 3000
      },
      finalScoreWeights: {
        firstNameScore: 0.15,
        familyNameScore: 0.25,
        advancedNameScore: 0.12,
        tokenReorderScore: 0.10,
        husbandScore: 0.12,
        idScore: 0.08,
        phoneScore: 0.05,
        childrenScore: 0.06,
        locationScore: 0.04
      },
      rules: {
          enableNameRootEngine: true,
          enableTribalLineage: true,
          enableMaternalLineage: true,
          enablePolygamyRules: true,
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
    
    // Create a new settings object by deep merging defaults with body
    const newSettings = {
        ...defaults,
        ...body,
        thresholds: { ...defaults.thresholds, ...(body.thresholds || {}) },
        finalScoreWeights: { ...defaults.finalScoreWeights, ...(body.finalScoreWeights || {}) },
        rules: { ...defaults.rules, ...(body.rules || {}) },
    };

    // Sanitize numeric thresholds
    newSettings.thresholds.minPair = Number(newSettings.thresholds.minPair) || defaults.thresholds.minPair;
    newSettings.thresholds.minInternal = Number(newSettings.thresholds.minInternal) || defaults.thresholds.minInternal;
    newSettings.thresholds.blockChunkSize = Number(newSettings.thresholds.blockChunkSize) || defaults.thresholds.blockChunkSize;

    // Ensure final score weights exist and are numbers
    for (const k of Object.keys(defaults.finalScoreWeights)) {
      newSettings.finalScoreWeights[k as keyof typeof defaults.finalScoreWeights] = 
        typeof newSettings.finalScoreWeights[k as keyof typeof defaults.finalScoreWeights] === "number" 
        ? Number(newSettings.finalScoreWeights[k as keyof typeof defaults.finalScoreWeights]) 
        : defaults.finalScoreWeights[k as keyof typeof defaults.finalScoreWeights];
    }
    
    // Ensure rules exist and are booleans
    for (const k of Object.keys(defaults.rules)) {
        newSettings.rules[k as keyof typeof defaults.rules] = 
        typeof newSettings.rules[k as keyof typeof defaults.rules] === "boolean" 
        ? newSettings.rules[k as keyof typeof defaults.rules] 
        : defaults.rules[k as keyof typeof defaults.rules];
    }

    await fs.writeFile(SETTINGS_PATH, JSON.stringify(newSettings, null, 2), "utf8");
    return NextResponse.json({ ok: true, settings: newSettings });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Failed to save settings", details: String(err) }, { status: 500 });
  }
}
