// src/app/api/logframe/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'logframes.db');
const getJsonPath = () => path.join(getDataPath(), 'logframes.json');

async function initializeDatabase() {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath());

    db.exec(`
        CREATE TABLE IF NOT EXISTS logframes (
            projectId TEXT PRIMARY KEY,
            goal TEXT,
            outcome TEXT,
            outputs TEXT
        );
    `);

    const result = db.prepare('SELECT COUNT(*) as count FROM logframes').get() as { count: number };
    const count = result.count;
    if (count === 0) {
        console.log('Seeding logframes database from logframes.json...');
        try {
            const jsonString = await fs.readFile(getJsonPath(), 'utf-8');
            const logframes = JSON.parse(jsonString);
            if (Array.isArray(logframes)) {
                const insert = db.prepare(`
                    INSERT OR IGNORE INTO logframes (projectId, goal, outcome, outputs)
                    VALUES (@projectId, @goal, @outcome, @outputs)
                `);
                const insertMany = db.transaction((items) => {
                    for (const item of items) {
                        insert.run({
                            ...item,
                            goal: JSON.stringify(item.goal || {}),
                            outcome: JSON.stringify(item.outcome || {}),
                            outputs: JSON.stringify(item.outputs || []),
                        });
                    }
                });
                insertMany(logframes);
            }
        } catch (error) {
            console.error("Failed to read or seed logframes.json:", error);
        }
    }
    return db;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        const db = await initializeDatabase();
        
        if (projectId) {
            const logframe = db.prepare('SELECT * FROM logframes WHERE projectId = ?').get(projectId);
            db.close();
            if (logframe) {
                return NextResponse.json({
                    ...logframe,
                    goal: JSON.parse(logframe.goal),
                    outcome: JSON.parse(logframe.outcome),
                    outputs: JSON.parse(logframe.outputs),
                });
            } else {
                return NextResponse.json({ ok: false, error: "Logframe not found" }, { status: 404 });
            }
        }
        
        const logframes = db.prepare('SELECT * FROM logframes').all();
        db.close();
        const parsedLogframes = logframes.map((lf: any) => ({
             ...lf,
             goal: JSON.parse(lf.goal),
             outcome: JSON.parse(lf.outcome),
             outputs: JSON.parse(lf.outputs),
        }));
        return NextResponse.json(parsedLogframes);
    } catch (err: any) {
        console.error("[LOGFRAME_API_GET_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to read logframes database.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const db = await initializeDatabase();
        const newLogframe = await req.json();

        if (!newLogframe || typeof newLogframe !== "object" || !newLogframe.projectId) {
            db.close();
            return NextResponse.json({ ok: false, error: "Invalid logframe payload" }, { status: 400 });
        }
        
        const stmt = db.prepare(`
            INSERT INTO logframes (projectId, goal, outcome, outputs)
            VALUES (@projectId, @goal, @outcome, @outputs)
            ON CONFLICT(projectId) DO UPDATE SET
                goal=excluded.goal,
                outcome=excluded.outcome,
                outputs=excluded.outputs
        `);

        stmt.run({
            projectId: newLogframe.projectId,
            goal: JSON.stringify(newLogframe.goal || {}),
            outcome: JSON.stringify(newLogframe.outcome || {}),
            outputs: JSON.stringify(newLogframe.outputs || []),
        });
        
        db.close();
        return NextResponse.json({ ok: true, message: `Logframe for project ${newLogframe.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[LOGFRAME_API_POST_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save logframe.", details: String(err) }, { status: 500 });
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
        const stmt = db.prepare(`DELETE FROM logframes WHERE projectId IN (${placeholders})`);
        
        const info = stmt.run(...projectIds);
        db.close();
        
        if (info.changes === 0) {
             return NextResponse.json({ ok: false, error: "No matching logframes found to delete" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, message: `Successfully deleted ${info.changes} logframe(s).` });

    } catch (err: any) {
        console.error("[LOGFRAME_API_DELETE_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to delete logframe(s).", details: String(err) }, { status: 500 });
    }
}
