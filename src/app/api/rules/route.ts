// src/app/api/rules/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'auto_rules.db');
const getJsonPath = () => path.join(getDataPath(), 'auto-rules.json');

async function initializeDatabase() {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath());

    db.exec(`
        CREATE TABLE IF NOT EXISTS auto_rules (
            id TEXT PRIMARY KEY,
            code TEXT,
            params TEXT,
            createdAt TEXT,
            enabled INTEGER
        );
    `);

    const result = db.prepare('SELECT COUNT(*) as count FROM auto_rules').get() as { count: number };
    const count = result.count;
    if (count === 0) {
        console.log('Seeding auto_rules database from auto-rules.json...');
        try {
            const jsonString = await fs.readFile(getJsonPath(), 'utf-8');
            const rules = JSON.parse(jsonString);
            if (Array.isArray(rules)) {
                const insert = db.prepare(`
                    INSERT OR IGNORE INTO auto_rules (id, code, params, createdAt, enabled)
                    VALUES (@id, @code, @params, @createdAt, @enabled)
                `);
                const insertMany = db.transaction((items) => {
                    for (const item of items) {
                        insert.run({
                            ...item,
                            params: JSON.stringify(item.params || {}),
                            enabled: item.enabled ? 1 : 0,
                        });
                    }
                });
                insertMany(rules);
            }
        } catch (error) {
            console.error("Failed to read or seed auto-rules.json:", error);
        }
    }
    return db;
}


export async function GET() {
    try {
        const db = await initializeDatabase();
        const rules = db.prepare('SELECT * FROM auto_rules').all();
        db.close();
        const parsedRules = rules.map(r => ({
            ...r,
            params: JSON.parse(r.params),
            enabled: r.enabled === 1,
        }));
        return NextResponse.json(parsedRules);
    } catch (err: any) {
        console.error("[RULES_API_GET_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to read rules database.", details: String(err) }, { status: 500 });
    }
}


export async function POST(req: Request) {
  try {
    const db = await initializeDatabase();
    const body = await req.json();

    if (!body || typeof body !== "object") {
      db.close();
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    if (body.action === 'delete' && Array.isArray(body.ids)) {
        if (body.ids.length === 0) {
            db.close();
            return NextResponse.json({ ok: true, message: "No rules to delete." });
        }
        const placeholders = body.ids.map(() => '?').join(',');
        const stmt = db.prepare(`DELETE FROM auto_rules WHERE id IN (${placeholders})`);
        const info = stmt.run(...body.ids);
        db.close();
        return NextResponse.json({ ok: true, message: `Deleted ${info.changes} rule(s).` });
    }
    
    const newRule = body;
    if (!newRule.id || !newRule.code) {
        db.close();
        return NextResponse.json({ ok: false, error: "Invalid rule payload, missing id or code" }, { status: 400 });
    }

    const stmt = db.prepare(`
        INSERT INTO auto_rules (id, code, params, createdAt, enabled)
        VALUES (@id, @code, @params, @createdAt, @enabled)
        ON CONFLICT(id) DO UPDATE SET
            code=excluded.code,
            params=excluded.params,
            createdAt=excluded.createdAt,
            enabled=excluded.enabled
    `);

    stmt.run({
        id: newRule.id,
        code: newRule.code,
        params: JSON.stringify(newRule.params || {}),
        createdAt: newRule.createdAt || new Date().toISOString(),
        enabled: newRule.enabled === false ? 0 : 1,
    });
    
    db.close();
    return NextResponse.json({ ok: true, message: `Rule ${newRule.id} saved.` });

  } catch (err: any) {
    console.error("[RULES_API_POST_ERROR]", err);
    return NextResponse.json({ ok: false, error: "Failed to process rule request.", details: String(err) }, { status: 500 });
  }
}
