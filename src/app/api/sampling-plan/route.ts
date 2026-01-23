// src/app/api/sampling-plan/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'sampling_plans.db');
const getJsonPath = () => path.join(getDataPath(), 'sampling-plans.json');

async function initializeDatabase() {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath());

    db.exec(`
        CREATE TABLE IF NOT EXISTS sampling_plans (
            projectId TEXT PRIMARY KEY,
            calculations TEXT
        );
    `);

    const result = db.prepare('SELECT COUNT(*) as count FROM sampling_plans').get() as { count: number };
    const count = result.count;
    if (count === 0) {
        console.log('Seeding sampling_plans database from sampling-plans.json...');
        try {
            const jsonString = await fs.readFile(getJsonPath(), 'utf-8');
            const plans = JSON.parse(jsonString);
            if (Array.isArray(plans)) {
                const insert = db.prepare(`
                    INSERT OR IGNORE INTO sampling_plans (projectId, calculations)
                    VALUES (@projectId, @calculations)
                `);
                const insertMany = db.transaction((items) => {
                    for (const item of items) {
                        insert.run({
                            ...item,
                            calculations: JSON.stringify(item.calculations || []),
                        });
                    }
                });
                insertMany(plans);
            }
        } catch (error) {
            console.error("Failed to read or seed sampling-plans.json:", error);
        }
    }
    return db;
}


export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    try {
        const db = await initializeDatabase();
        if (projectId) {
            const plan = db.prepare('SELECT * FROM sampling_plans WHERE projectId = ?').get(projectId);
            db.close();
            if (plan) {
                return NextResponse.json({ ...plan, calculations: JSON.parse(plan.calculations) });
            } else {
                return NextResponse.json({ error: "Sampling Plan not found" }, { status: 404 });
            }
        }

        const plans = db.prepare('SELECT * FROM sampling_plans').all();
        db.close();
        return NextResponse.json(plans.map(p => ({ ...p, calculations: JSON.parse(p.calculations) })));
    } catch (err: any) {
        console.error("[SAMPLING_PLAN_API_GET_ERROR]", err);
        return NextResponse.json({ error: "Failed to read sampling plans database.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const db = await initializeDatabase();
        const newPlan = await req.json();

        if (!newPlan || !newPlan.projectId) {
            db.close();
            return NextResponse.json({ ok: false, error: "Invalid payload. Project ID is required." }, { status: 400 });
        }

        const stmt = db.prepare(`
            INSERT INTO sampling_plans (projectId, calculations)
            VALUES (@projectId, @calculations)
            ON CONFLICT(projectId) DO UPDATE SET calculations=excluded.calculations
        `);
        
        stmt.run({
            projectId: newPlan.projectId,
            calculations: JSON.stringify(newPlan.calculations || []),
        });
        
        db.close();
        return NextResponse.json({ ok: true, message: `Sampling plan for project ${newPlan.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[SAMPLING_PLAN_API_POST_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save sampling plan.", details: String(err) }, { status: 500 });
    }
}
