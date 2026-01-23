// src/app/api/project-plan/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'project_plans.db');
const getJsonPath = () => path.join(getDataPath(), 'project-plans.json');

async function initializeDatabase() {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath());

    db.exec(`
        CREATE TABLE IF NOT EXISTS project_plans (
            projectId TEXT PRIMARY KEY,
            tasks TEXT
        );
    `);

    const result = db.prepare('SELECT COUNT(*) as count FROM project_plans').get() as { count: number };
    const count = result.count;
    if (count === 0) {
        console.log('Seeding project_plans database from project-plans.json...');
        try {
            const jsonString = await fs.readFile(getJsonPath(), 'utf-8');
            const plans = JSON.parse(jsonString);
            if (Array.isArray(plans)) {
                const insert = db.prepare(`
                    INSERT OR IGNORE INTO project_plans (projectId, tasks)
                    VALUES (@projectId, @tasks)
                `);
                const insertMany = db.transaction((items) => {
                    for (const item of items) {
                        insert.run({
                            ...item,
                            tasks: JSON.stringify(item.tasks || []),
                        });
                    }
                });
                insertMany(plans);
            }
        } catch (error) {
            console.error("Failed to read or seed project-plans.json:", error);
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
            const plan = db.prepare('SELECT * FROM project_plans WHERE projectId = ?').get(projectId);
            db.close();
            if (plan) {
                return NextResponse.json({ ...plan, tasks: JSON.parse(plan.tasks) });
            } else {
                return NextResponse.json({ error: "Plan not found" }, { status: 404 });
            }
        } else {
            const plans = db.prepare('SELECT * FROM project_plans').all();
            db.close();
            return NextResponse.json(plans.map(p => ({ ...p, tasks: JSON.parse(p.tasks) })));
        }
    } catch (err: any) {
        console.error("[PROJECT_PLAN_API_GET_ERROR]", err);
        return NextResponse.json({ error: "Failed to read plans database.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const db = await initializeDatabase();
        const newPlan = await req.json();

        if (!newPlan || !newPlan.projectId || !Array.isArray(newPlan.tasks)) {
            db.close();
            return NextResponse.json({ ok: false, error: "Invalid plan payload" }, { status: 400 });
        }

        const stmt = db.prepare(`
            INSERT INTO project_plans (projectId, tasks) 
            VALUES (@projectId, @tasks)
            ON CONFLICT(projectId) DO UPDATE SET tasks=excluded.tasks
        `);
        
        stmt.run({
            projectId: newPlan.projectId,
            tasks: JSON.stringify(newPlan.tasks),
        });

        db.close();
        return NextResponse.json({ ok: true, message: `Plan for project ${newPlan.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[PROJECT_PLAN_API_POST_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save project plan.", details: String(err) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { projectIds } = await req.json();

        if (!projectIds || !Array.isArray(projectIds)) {
            return NextResponse.json({ ok: false, error: "projectIds array is required" }, { status: 400 });
        }
        
        const db = await initializeDatabase();
        const placeholders = projectIds.map(() => '?').join(',');
        const stmt = db.prepare(`DELETE FROM project_plans WHERE projectId IN (${placeholders})`);
        
        const info = stmt.run(...projectIds);
        db.close();

        if (info.changes === 0) {
            return NextResponse.json({ ok: false, error: "No matching project plans found to delete" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, message: `Successfully deleted ${info.changes} project plan(s).` });
    } catch (err: any) {
        console.error("[PROJECT_PLAN_API_DELETE_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to delete project plan(s).", details: String(err) }, { status: 500 });
    }
}
