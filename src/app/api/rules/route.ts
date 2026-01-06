// src/app/api/rules/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getRulesFile = () => path.join(getDataPath(), 'auto-rules.json');

function getExistingRules() {
    const RULES_FILE = getRulesFile();
    try {
        if (!fs.existsSync(RULES_FILE)) {
            fs.mkdirSync(getDataPath(), { recursive: true });
            fs.writeFileSync(RULES_FILE, "[]", "utf8");
            return [];
        }
        const raw = fs.readFileSync(RULES_FILE, 'utf-8');
        const rules = JSON.parse(raw);
        return Array.isArray(rules) ? rules : [];
    } catch (e) {
        console.error("Error reading or creating rules file:", e);
        // If parsing fails or any other error, start with a fresh array
        return [];
    }
}

export async function POST(req: Request) {
  const RULES_FILE = getRulesFile();
  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    let existingRules = getExistingRules();

    // Handle Deletion
    if (body.action === 'delete' && Array.isArray(body.ids)) {
        const idsToDelete = new Set(body.ids);
        const filteredRules = existingRules.filter((r: any) => !idsToDelete.has(r.id));
        fs.writeFileSync(RULES_FILE, JSON.stringify(filteredRules, null, 2), "utf8");
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
    
    fs.writeFileSync(RULES_FILE, JSON.stringify(existingRules, null, 2), "utf8");
    return NextResponse.json({ ok: true, message: `Rule ${newRule.id} saved.` });

  } catch (err: any) {
    console.error("[RULES_API_ERROR]", err);
    return NextResponse.json({ ok: false, error: "Failed to process rule request.", details: String(err) }, { status: 500 });
  }
}
