// src/app/api/purpose-and-scope/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'purpose_and_scope.db');
const getJsonPath = () => path.join(getDataPath(), 'scope-and-purpose.json');

async function initializeDatabase() {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath());

    db.exec(`
        CREATE TABLE IF NOT EXISTS purpose_and_scope (
            projectId TEXT PRIMARY KEY,
            monitoringActivities TEXT
        );
    `);
    
    const result = db.prepare('SELECT COUNT(*) as count FROM purpose_and_scope').get() as { count: number };
    const count = result.count;

    if (count === 0) {
        console.log('Seeding purpose_and_scope database from scope-and-purpose.json...');
        try {
            const jsonString = await fs.readFile(getJsonPath(), 'utf-8');
            const plans = JSON.parse(jsonString);
            if (Array.isArray(plans)) {
                const insert = db.prepare(`
                    INSERT OR IGNORE INTO purpose_and_scope (projectId, monitoringActivities)
                    VALUES (@projectId, @monitoringActivities)
                `);
                const insertMany = db.transaction((items) => {
                    for (const item of items) {
                        insert.run({
                            ...item,
                            monitoringActivities: JSON.stringify(item.monitoringActivities || []),
                        });
                    }
                });
                insertMany(plans);
            }
        } catch (error) {
            console.error("Failed to read or seed scope-and-purpose.json:", error);
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
            const plan = db.prepare('SELECT * FROM purpose_and_scope WHERE projectId = ?').get(projectId);
            db.close();
            if (plan) {
                return NextResponse.json({ ...plan, monitoringActivities: JSON.parse(plan.monitoringActivities) });
            } else {
                return NextResponse.json({ error: "Plan not found" }, { status: 404 });
            }
        }

        const plans = db.prepare('SELECT * FROM purpose_and_scope').all();
        db.close();
        return NextResponse.json(plans.map(p => ({ ...p, monitoringActivities: JSON.parse(p.monitoringActivities) })));
    } catch (err: any) {
        console.error("[PURPOSE_SCOPE_API_GET_ERROR]", err);
        return NextResponse.json({ error: "Failed to read monitoring plans database.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const db = await initializeDatabase();
        const newPlan = await req.json();

        if (!newPlan || !newPlan.projectId || !Array.isArray(newPlan.monitoringActivities)) {
            db.close();
            return NextResponse.json({ ok: false, error: "Invalid monitoring plan payload" }, { status: 400 });
        }
        
        const stmt = db.prepare(`
            INSERT INTO purpose_and_scope (projectId, monitoringActivities)
            VALUES (@projectId, @monitoringActivities)
            ON CONFLICT(projectId) DO UPDATE SET monitoringActivities=excluded.monitoringActivities
        `);

        stmt.run({
            projectId: newPlan.projectId,
            monitoringActivities: JSON.stringify(newPlan.monitoringActivities || []),
        });
        
        db.close();
        return NextResponse.json({ ok: true, message: `Monitoring plan for project ${newPlan.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[PURPOSE_SCOPE_API_POST_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save monitoring plan.", details: String(err) }, { status: 500 });
    }
}
