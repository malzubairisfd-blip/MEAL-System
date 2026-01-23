// src/app/api/projects/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';
import { fileURLToPath } from "url";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'projects.db');
const getJsonPath = () => path.join(getDataPath(), 'projects.json');

// Helper to initialize DB and seed if empty
async function initializeDatabase() {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath());

    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            projectId TEXT PRIMARY KEY,
            projectName TEXT,
            governorates TEXT,
            districts TEXT,
            subDistricts TEXT,
            villages INTEGER,
            startDateMonth TEXT,
            startDateYear TEXT,
            endDateMonth TEXT,
            endDateYear TEXT,
            beneficiaries INTEGER,
            budget REAL,
            status TEXT,
            summary TEXT
        );
    `);

    const result = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    const count = result.count;
    
    if (count === 0) {
        console.log('Seeding projects database from projects.json...');
        try {
            const jsonString = await fs.readFile(getJsonPath(), 'utf-8');
            const projects = JSON.parse(jsonString);
            if (Array.isArray(projects)) {
                const insert = db.prepare(`
                    INSERT OR IGNORE INTO projects (projectId, projectName, governorates, districts, subDistricts, villages, startDateMonth, startDateYear, endDateMonth, endDateYear, beneficiaries, budget, status, summary)
                    VALUES (@projectId, @projectName, @governorates, @districts, @subDistricts, @villages, @startDateMonth, @startDateYear, @endDateMonth, @endDateYear, @beneficiaries, @budget, @status, @summary)
                `);
                const insertMany = db.transaction((projs) => {
                    for (const proj of projs) {
                        insert.run({
                            ...proj,
                            governorates: JSON.stringify(proj.governorates || []),
                            districts: JSON.stringify(proj.districts || []),
                            subDistricts: JSON.stringify(proj.subDistricts || []),
                        });
                    }
                });
                insertMany(projects);
            }
        } catch (error) {
            console.error("Failed to read or seed projects.json:", error);
        }
    }
    return db;
}


export async function GET() {
    try {
        const db = await initializeDatabase();
        const projects = db.prepare('SELECT * FROM projects').all();
        db.close();

        // Parse the JSON strings back into arrays
        const parsedProjects = projects.map((p: any) => ({
            ...p,
            governorates: JSON.parse(p.governorates || '[]'),
            districts: JSON.parse(p.districts || '[]'),
            subDistricts: JSON.parse(p.subDistricts || '[]'),
        }));

        return NextResponse.json(parsedProjects);
    } catch (err: any) {
        console.error("[PROJECTS_API_GET_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to read projects database.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const db = await initializeDatabase();
        const newProject = await req.json();

        if (!newProject || typeof newProject !== "object" || !newProject.projectId) {
            db.close();
            return NextResponse.json({ ok: false, error: "Invalid project payload" }, { status: 400 });
        }

        const insert = db.prepare(`
            INSERT INTO projects (projectId, projectName, governorates, districts, subDistricts, villages, startDateMonth, startDateYear, endDateMonth, endDateYear, beneficiaries, budget, status, summary)
            VALUES (@projectId, @projectName, @governorates, @districts, @subDistricts, @villages, @startDateMonth, @startDateYear, @endDateMonth, @endDateYear, @beneficiaries, @budget, @status, @summary)
            ON CONFLICT(projectId) DO UPDATE SET
                projectName=excluded.projectName,
                governorates=excluded.governorates,
                districts=excluded.districts,
                subDistricts=excluded.subDistricts,
                villages=excluded.villages,
                startDateMonth=excluded.startDateMonth,
                startDateYear=excluded.startDateYear,
                endDateMonth=excluded.endDateMonth,
                endDateYear=excluded.endDateYear,
                beneficiaries=excluded.beneficiaries,
                budget=excluded.budget,
                status=excluded.status,
                summary=excluded.summary
        `);
        
        insert.run({
            ...newProject,
            governorates: JSON.stringify(newProject.governorates || []),
            districts: JSON.stringify(newProject.districts || []),
            subDistricts: JSON.stringify(newProject.subDistricts || []),
        });
        
        db.close();
        return NextResponse.json({ ok: true, message: `Project ${newProject.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[PROJECTS_API_POST_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save project.", details: String(err) }, { status: 500 });
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
        const stmt = db.prepare(`DELETE FROM projects WHERE projectId IN (${placeholders})`);
        
        const info = stmt.run(...projectIds);
        db.close();
        
        if (info.changes === 0) {
             return NextResponse.json({ ok: false, error: "No matching projects found to delete" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, message: `Successfully deleted ${info.changes} project(s).` });

    } catch (err: any) {
        console.error("[PROJECTS_API_DELETE_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to delete project(s).", details: String(err) }, { status: 500 });
    }
}
