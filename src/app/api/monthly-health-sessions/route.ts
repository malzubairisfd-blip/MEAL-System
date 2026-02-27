// src/app/api/monthly-health-sessions/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "monthly-health-sessions.db");

const DB_COLUMNS_FOR_CREATION = `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT, project_name TEXT, ed_id TEXT, ec_id TEXT, ed_name TEXT, benef_id TEXT, bnf_name TEXT, bnf_vill TEXT, bnf_ozla TEXT, bnf_mud TEXT,
    ${Array.from({ length: 76 }, (_, i) => `
    bnf_appear_s${i + 1} INTEGER, date_of_general_s${i + 1} DATE, attending_s${i + 1} INTEGER, absent_s${i + 1} INTEGER, absence_code_s${i + 1} INTEGER, absence_reason_s${i + 1} TEXT, has_alternative_s${i + 1} INTEGER, date_of_alternative_s${i + 1} DATE
    `).join(',\n')},
    total_appear INTEGER, total_absence INTEGER, total_alternative INTEGER, data JSON
)`;

function initializeDatabase() {
    const db = new Database(getDbPath());
    db.exec(`CREATE TABLE IF NOT EXISTS monthly_sessions ${DB_COLUMNS_FOR_CREATION};`);
    return db;
}

export async function GET(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = initializeDatabase();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    let records;
    if (projectId && projectId !== 'all') {
      records = db.prepare("SELECT * FROM monthly_sessions WHERE project_id = ?").all(projectId);
    } else {
      records = db.prepare("SELECT * FROM monthly_sessions").all();
    }
    
    db.close();
    return NextResponse.json(records);
  } catch (error: any) {
    if (error.code === "SQLITE_CANTOPEN") return NextResponse.json([]);
    return NextResponse.json({ error: "Failed to fetch session data.", details: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const body = await req.json();
        const { action, records, projectId, uniqueIdCol } = body;

        if (action === 'save') {
             if (!projectId || !Array.isArray(records) || !uniqueIdCol) {
                return NextResponse.json({ error: "Missing parameters for save." }, { status: 400 });
            }

            const db = initializeDatabase();
            try {
                const checkStmt = db.prepare(`SELECT id FROM monthly_sessions WHERE ${uniqueIdCol} = ?`);
                const insertCols = Object.keys(records[0]).filter(k => k !== 'id');
                const insertPlaceholders = insertCols.map(c => `@${c}`).join(', ');
                const insertStmt = db.prepare(`INSERT INTO monthly_sessions (${insertCols.join(', ')}) VALUES (${insertPlaceholders})`);

                const updateCols = insertCols.filter(c => c !== uniqueIdCol);
                const updatePlaceholders = updateCols.map(c => `${c} = @${c}`).join(', ');
                const updateStmt = db.prepare(`UPDATE monthly_sessions SET ${updatePlaceholders} WHERE ${uniqueIdCol} = @${uniqueIdCol}`);
                
                let saved = 0;
                let updated = 0;

                const transaction = db.transaction(() => {
                    for (const record of records) {
                        const existing = checkStmt.get(record[uniqueIdCol]);
                        if (existing) {
                            updateStmt.run(record);
                            updated++;
                        } else {
                            insertStmt.run(record);
                            saved++;
                        }
                    }
                });

                transaction();
                return NextResponse.json({ saved, updated });
            } finally {
                db.close();
            }
        }
        
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("API Error (monthly-health-sessions):", error);
        return NextResponse.json({ error: "Failed to process request", details: error.message }, { status: 500 });
    }
}
