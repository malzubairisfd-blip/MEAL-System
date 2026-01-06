// src/app/api/rules/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Use the 'public' directory for storing rules so they are fetchable by the client.
const getRulesPath = () => path.join(process.cwd(), 'public', 'rules');
const getRulesFile = () => path.join(getRulesPath(), 'auto-rules.json');

async function getExistingRules() {
    const RULES_FILE = getRulesFile();
    try {
        await fs.mkdir(getRulesPath(), { recursive: true });
        const raw = await fs.readFile(RULES_FILE, 'utf-8');
        const rules = JSON.parse(raw);
        return Array.isArray(rules) ? rules : [];
    } catch (e: any) {
        if (e.code === 'ENOENT') {
            return []; // File doesn't exist, return empty array
        }
        throw e; // Re-throw other errors
    }
}

export async function POST(req: Request) {
  const RULES_FILE = getRulesFile();
  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    let existingRules = await getExistingRules();

    // Handle Deletion
    if (body.action === 'delete' && Array.isArray(body.ids)) {
        const idsToDelete = new Set(body.ids);
        const filteredRules = existingRules.filter((r: any) => !idsToDelete.has(r.id));
        await fs.writeFile(RULES_FILE, JSON.stringify(filteredRules, null, 2), "utf8");
        return NextResponse.json({ ok: true, message: `Deleted ${idsToDelete.size} rule(s).` });
    }
    
    // Handle Addition: Expecting body to be the new rule { id, code }
    const newRule = body;
    if (!newRule.id || !newRule.code) {
        return NextResponse.json({ ok: false, error: "Invalid rule payload, missing id or code" }, { status: 400 });
    }

    if (!existingRules.some((r: any) => r.id === newRule.id)) {
        existingRules.push({
          ...newRule,
          createdAt: new Date().toISOString(),
          enabled: true,
        });
    }
    
    await fs.writeFile(RULES_FILE, JSON.stringify(existingRules, null, 2), "utf8");
    return NextResponse.json({ ok: true, message: `Rule ${newRule.id} saved.` });

  } catch (err: any) {
    console.error("[RULES_API_ERROR]", err);
    return NextResponse.json({ ok: false, error: "Failed to process rule request.", details: String(err) }, { status: 500 });
  }
}
