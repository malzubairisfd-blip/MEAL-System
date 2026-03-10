// src/app/api/health-centers/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "health-center.db");
const getProjectsDbPath = () => path.join(getDataPath(), 'projects.db');
const getLocationsDbPath = () => path.join(getDataPath(), 'locations.db');

const DB_SCHEMA = `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,
  project_name TEXT,
  hc_id TEXT,
  hc_name TEXT,
  gov_no TEXT,
  mud_no TEXT,
  ozla_no TEXT,
  vill_no TEXT,
  gov_name TEXT,
  mud_name TEXT,
  ozla_name TEXT,
  vill_name TEXT,
  loc_id TEXT,
  hw_id TEXT,
  hw_name TEXT,
  id_card_type TEXT,
  id_card_no TEXT,
  phone TEXT,
  data JSON
)`;

const DB_COLUMNS = DB_SCHEMA.replace(/[()]/g, "").split(',').map(s => s.trim().split(' ')[0]);

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS health_centers ${DB_SCHEMA};`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_hc_hw ON health_centers (hc_id, hw_id);`);
  return db;
}

const normalizeArabic = (s: string | null | undefined): string => {
    if (!s) return "";
    return String(s)
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/\s+/g, ' ')
        .trim();
};

export async function POST(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const body = await req.json();
        const { action, projectId, records, mapping, uniqueIdFileCol, uniqueIdDbCol, mode, recordsToUpdate } = body;

        if (action === "get_schema") {
            const db = initializeDatabase();
            const tableInfo = db.prepare("PRAGMA table_info(health_centers)").all();
            db.close();
            return NextResponse.json({ columns: tableInfo.map((c: any) => c.name) });
        }
        
        if (action === "check_duplicates") {
            const { hc_id, hw_id } = mapping;
            if (!projectId || !Array.isArray(records) || !hc_id || !hw_id) {
                return NextResponse.json({ error: "Missing parameters for duplicate check." }, { status: 400 });
            }
            const db = initializeDatabase();
            try {
                const checkStmt = db.prepare('SELECT hc_id, hw_id FROM health_centers WHERE project_id = ? AND hc_id = ? AND hw_id = ?');
                const existing = new Set<string>();
                records.forEach(record => {
                    const hcIdVal = record[hc_id];
                    const hwIdVal = record[hw_id];
                    if(hcIdVal && hwIdVal) {
                        const found = checkStmt.get(projectId, hcIdVal, hwIdVal);
                        if (found) {
                            existing.add(`${hcIdVal}-${hwIdVal}`);
                        }
                    }
                });
                const totalInDb = db.prepare('SELECT COUNT(*) as count FROM health_centers WHERE project_id = ?').get(projectId) as { count: number };
                return NextResponse.json({ count: existing.size, totalInDb: totalInDb.count, duplicateIds: Array.from(existing) });
            } finally {
                db.close();
            }
        }


        if (action === 'save') {
            if (!projectId || !Array.isArray(records) || !mapping || !mode) {
                return NextResponse.json({ error: "Missing parameters for save." }, { status: 400 });
            }

            const db = initializeDatabase();
            let locationsDb: Database.Database | null = null;
            let projectsDb: Database.Database | null = null;

            try {
                // Prepare location lookup
                locationsDb = new Database(getLocationsDbPath(), { fileMustExist: true });
                const allLocations = locationsDb.prepare('SELECT * FROM locations').all();
                const locationMap = new Map<string, any>();
                allLocations.forEach((loc: any) => {
                    const key = [loc.gov_name, loc.mud_name, loc.vill_name].map(n => normalizeArabic(n)).join('|');
                    if (key) locationMap.set(key, loc);
                });

                // Get project name
                projectsDb = new Database(getProjectsDbPath(), { fileMustExist: true });
                const project = projectsDb.prepare('SELECT projectName FROM projects WHERE projectId = ?').get(projectId) as {projectName: string};
                
                let saved = 0, updated = 0, skipped = 0;
                
                const checkStmt = db.prepare('SELECT id FROM health_centers WHERE project_id = ? AND hc_id = ? AND hw_id = ?');

                const transaction = db.transaction(() => {
                    for (const record of records) {
                        const mappedRecord: {[key: string]: any} = { project_id: projectId, project_name: project.projectName };
                        for(const [fileCol, dbCol] of Object.entries(mapping)) {
                            mappedRecord[dbCol as string] = record[fileCol as string];
                        }
                        
                        const locKey = [mappedRecord.gov_name, mappedRecord.mud_name, mappedRecord.vill_name].map(n => normalizeArabic(n)).join('|');
                        const locData = locationMap.get(locKey);
                        if(locData){
                            mappedRecord.gov_no = locData.gov_no;
                            mappedRecord.mud_no = locData.mud_no;
                            mappedRecord.ozla_no = locData.ozla_no;
                            mappedRecord.vill_no = locData.vill_no;
                            mappedRecord.loc_id = locData.vill_loc_id;
                        }
                        mappedRecord.data = JSON.stringify(record);

                        const existing = checkStmt.get(projectId, mappedRecord.hc_id, mappedRecord.hw_id);

                        if (existing) {
                            if (mode === 'replace') {
                                const updateCols = Object.keys(mappedRecord).filter(k => k !== 'id' && k !== 'project_id' && k !== 'hc_id' && k !== 'hw_id');
                                const setClause = updateCols.map(col => `${col} = @${col}`).join(', ');
                                const stmt = db.prepare(`UPDATE health_centers SET ${setClause} WHERE id = @id`);
                                stmt.run({ ...mappedRecord, id: existing.id });
                                updated++;
                            } else {
                                skipped++;
                            }
                        } else {
                            const insertCols = Object.keys(mappedRecord);
                            const stmt = db.prepare(`INSERT INTO health_centers (${insertCols.join(', ')}) VALUES (${insertCols.map(c => `@${c}`).join(', ')})`);
                            stmt.run(mappedRecord);
                            saved++;
                        }
                    }
                });

                transaction();
                
                return NextResponse.json({ saved, skipped, updated, total: records.length, mode });

            } finally {
                db.close();
                if (locationsDb) locationsDb.close();
                if (projectsDb) projectsDb.close();
            }
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ error: "API Error", details: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath(), { fileMustExist: true });
    try {
        const records = db.prepare("SELECT * FROM health_centers").all();
        return NextResponse.json(records);
    } finally {
        db.close();
    }
  } catch (error: any) {
    if (error.code === "SQLITE_CANTOPEN") return NextResponse.json([]);
    return NextResponse.json({ error: "Failed to fetch data.", details: error.message }, { status: 500 });
  }
}
