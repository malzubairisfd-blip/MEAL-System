
// src/app/api/rules/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Use the 'public' directory for storing rules so they are fetchable by the client.
const getRulesPath = () => path.join(process.cwd(), 'public', 'rules', 'auto-rules.json');

export async function GET() {
  const RULES_PATH = getRulesPath();
  try {
    const raw = await fs.readFile(RULES_PATH, "utf8");
    const rules = JSON.parse(raw);
    return NextResponse.json({ ok: true, rules });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // File doesn't exist, return empty array
      return NextResponse.json({ ok: true, rules: [] });
    }
    return NextResponse.json({ ok: false, error: "Missing or unreadable auto-rules.json" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const RULES_PATH = getRulesPath();
  try {
    const newRule = await req.json();

    if (!newRule || typeof newRule !== "object" || !newRule.id) {
      return NextResponse.json({ ok: false, error: "Invalid rule payload" }, { status: 400 });
    }

    let existingRules = [];
    try {
        const raw = await fs.readFile(RULES_PATH, 'utf-8');
        existingRules = JSON.parse(raw);
        if (!Array.isArray(existingRules)) existingRules = [];
    } catch (e: any) {
        if (e.code !== 'ENOENT') throw e; // Re-throw if it's not a "file not found" error
        // If file doesn't exist, we start with an empty array.
    }
    
    // Add new rule if it doesn't exist
    if (!existingRules.some((r: any) => r.id === newRule.id)) {
        existingRules.push(newRule);
    }
    
    await fs.writeFile(RULES_PATH, JSON.stringify(existingRules, null, 2), "utf8");
    return NextResponse.json({ ok: true, message: `Rule ${newRule.id} saved.` });

  } catch (err: any) {
    console.error("[RULES_API_ERROR]", err);
    return NextResponse.json({ ok: false, error: "Failed to save rule.", details: String(err) }, { status: 500 });
  }
}
