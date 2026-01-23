// src/app/api/monitoring-plan/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'monitoring_plans.db');
const getJsonPath = () => path.join(getDataPath(), 'monitoring-plans.json');

async function initializeDatabase() {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath());
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS monitoring_plans (
            projectId TEXT PRIMARY KEY,
            indicators TEXT
        );
    `);
    
    const result = db.prepare('SELECT COUNT(*) as count FROM monitoring_plans').get() as { count: number };
    const count = result.count;
    if (count === 0) {
        console.log('Seeding monitoring_plans database from monitoring-plans.json...');
        try {
            const jsonString = await fs.readFile(getJsonPath(), 'utf-8');
            const plans = JSON.parse(jsonString);
            if (Array.isArray(plans)) {
                const insert = db.prepare(`
                    INSERT OR IGNORE INTO monitoring_plans (projectId, indicators)
                    VALUES (@projectId, @indicators)
                `);
                const insertMany = db.transaction((items) => {
                    for (const item of items) {
                        insert.run({
                            ...item,
                            indicators: JSON.stringify(item.indicators || []),
                        });
                    }
                });
                insertMany(plans);
            }
        } catch (error) {
            console.error("Failed to read or seed monitoring-plans.json:", error);
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
            const plan = db.prepare('SELECT * FROM monitoring_plans WHERE projectId = ?').get(projectId);
            db.close();
            if (plan) {
                return NextResponse.json({ ...plan, indicators: JSON.parse(plan.indicators) });
            } else {
                return NextResponse.json({ error: "M&E Plan not found" }, { status: 404 });
            }
        }

        const plans = db.prepare('SELECT * FROM monitoring_plans').all();
        db.close();
        return NextResponse.json(plans.map(p => ({ ...p, indicators: JSON.parse(p.indicators) })));
    } catch (err: any) {
        console.error("[MONITORING_PLAN_API_GET_ERROR]", err);
        return NextResponse.json({ error: "Failed to read M&E plans database.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const db = await initializeDatabase();
        const newPlan = await req.json();

        if (!newPlan || !newPlan.projectId || !Array.isArray(newPlan.indicators)) {
            db.close();
            return NextResponse.json({ ok: false, error: "Invalid M&E plan payload. Expected projectId and indicators array." }, { status: 400 });
        }

        const stmt = db.prepare(`
            INSERT INTO monitoring_plans (projectId, indicators)
            VALUES (@projectId, @indicators)
            ON CONFLICT(projectId) DO UPDATE SET indicators=excluded.indicators
        `);

        stmt.run({
            projectId: newPlan.projectId,
            indicators: JSON.stringify(newPlan.indicators || []),
        });
        
        db.close();
        return NextResponse.json({ ok: true, message: `M&E plan for project ${newPlan.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[MONITORING_PLAN_API_POST_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save M&E plan.", details: String(err) }, { status: 500 });
    }
}
