
// src/app/api/monthly-health-sessions/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "monthly-health-sessions.db");
const getEnrollmentDbPath = () => path.join(getDataPath(), "enrollment-review.db");


const DB_COLUMNS_FOR_CREATION = `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT, project_name TEXT, ed_id TEXT, ec_id TEXT, ed_name TEXT, benef_id TEXT, bnf_name TEXT, bnf_vill TEXT, bnf_ozla TEXT, bnf_mud TEXT,
    ${Array.from({ length: 76 }, (_, i) => `
    bnf_appear_s${i + 1} INTEGER, date_of_general_s${i + 1} DATE, attending_s${i + 1} INTEGER, absent_s${i + 1} INTEGER, absence_code_s${i + 1} INTEGER, absence_reason_s${i + 1} TEXT, has_alternative_s${i + 1} INTEGER, date_of_alternative_s${i + 1} DATE
    `).join(',\n')},
    total_appear INTEGER, total_absence INTEGER, total_alternative INTEGER, data JSON
)`;

const allDbColumns = DB_COLUMNS_FOR_CREATION.replace(/[()]/g, "")
  .split(",")
  .map((s) => s.trim().split(/\s+/)[0])
  .filter(Boolean);
const validColumnsSet = new Set(allDbColumns);

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS monthly_sessions ${DB_COLUMNS_FOR_CREATION};`);
  return db;
}

const sanitizeColumn = (col?: string) => (col ? col.replace(/[^a-zA-Z0-9_]/g, "") : "");

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};


export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;

  try {
     await fs.mkdir(getDataPath(), { recursive: true });

    if (action === 'get_schema') {
        const db = initializeDatabase();
        const tableInfo = db.prepare("PRAGMA table_info(monthly_sessions)").all();
        const columns = tableInfo.map((c: any) => c.name);
        db.close();
        return NextResponse.json({ columns });
    }

    if (action === "check_duplicates") {
      const { projectId, uniqueIds, uniqueIdCol } = body;
      if (!projectId || !uniqueIdCol || !Array.isArray(uniqueIds)) {
        return NextResponse.json({ error: "Missing parameters for duplicate check." }, { status: 400 });
      }
      let db: Database.Database | null = null;
      try {
        db = new Database(getDbPath(), { fileMustExist: true });
        const sanitizedColumn = sanitizeColumn(uniqueIdCol);
        
        let existingIds = new Set();
        const chunks = chunkArray(uniqueIds, 900);
        
        for (const chunk of chunks) {
            if (chunk.length === 0) continue;
            const placeholders = chunk.map(() => "?").join(",");
            const stmt = db.prepare(
                `SELECT "${sanitizedColumn}" FROM monthly_sessions WHERE project_id = ? AND "${sanitizedColumn}" IN (${placeholders})`
            );
            const results: any[] = stmt.all(projectId, ...chunk);
            results.forEach(row => existingIds.add(String(row[sanitizedColumn])));
        }
        
        const tableTotalResult = db.prepare("SELECT COUNT(*) as total FROM monthly_sessions WHERE project_id = ?").get(projectId) as {total: number} | undefined;
        const totalInDb = tableTotalResult?.total || 0;

        return NextResponse.json({ count: existingIds.size, totalInDb, duplicateIds: Array.from(existingIds) });

      } catch (error: any) {
        if (error.code === "SQLITE_CANTOPEN") return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
        throw error;
      } finally {
        if (db) db.close();
      }
    }


    if (action === "save") {
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        const encoder = new TextEncoder();
        const send = (data: any) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        (async () => {
            const { projectId, sessionNumber, sessionDate, appearanceData, appearanceMapping, absenceData, absenceMapping, mode, duplicateIds = [] } = body;
            const duplicateIdsSet = new Set(duplicateIds.map(String));

            let stats = { saved: 0, updated: 0, skipped: 0, total: 0 };

            if (!projectId || !sessionNumber || !sessionDate) {
                 send({ type: 'error', error: "Missing required parameters." });
                 writer.close();
                 return;
            }

            let sessionDb: Database.Database | null = null;
            let enrollmentDb: Database.Database | null = null;

            try {
                sessionDb = initializeDatabase();
                
                send({ type: 'progress', status: 'FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE', progress: 10, message: "Initializing databases...", stats });
                const existingProjectRecordsStmt = sessionDb.prepare('SELECT COUNT(*) as count FROM monthly_sessions WHERE project_id = ?');
                const existingProjectRecords = existingProjectRecordsStmt.get(projectId) as {count: number};

                if (existingProjectRecords.count === 0 && mode !== 'skip') {
                    try {
                        enrollmentDb = new Database(getEnrollmentDbPath(), { fileMustExist: true });
                        const beneficiaries = enrollmentDb.prepare(`
                            SELECT benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name, project_name 
                            FROM enrollment_data WHERE project_id = ?
                        `).all(projectId);
                        
                        const insertStmt = sessionDb.prepare(`
                            INSERT OR IGNORE INTO monthly_sessions (project_id, project_name, benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name)
                            VALUES (@project_id, @project_name, @benef_id, @bnf_name, @bnf_vill, @bnf_ozla, @bnf_mud, @ed_id, @ed_name)
                        `);
                        
                        const insertMany = sessionDb.transaction((bnfs) => {
                            for (const bnf of bnfs) {
                               const info = insertStmt.run({...bnf, project_id: projectId});
                               stats.saved += info.changes;
                            }
                        });
                        
                        insertMany(beneficiaries);
                        send({ type: 'progress', status: 'FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE', progress: 20, message: `Seeded ${stats.saved} base records.`, stats });
                    } catch (e: any) {
                         send({ type: 'progress', status: 'FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE', progress: 20, message: `Enrollment DB not found. Skipping seeding.`, stats });
                    }
                } else {
                     send({ type: 'progress', status: 'FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE', progress: 20, message: `Project already seeded or skipping.`, stats });
                }

                send({ type: 'progress', status: 'SECOND_STEP_SAVING_BENEFICIARY_APPEARANCE', progress: 30, message: "Processing appearance data...", stats });
                stats.total = (appearanceData?.length || 0) + (absenceData?.length || 0);

                if (appearanceData && appearanceMapping && appearanceData.length > 0) {
                  const appearCol = `bnf_appear_s${sessionNumber}`;
                  const dateCol = `date_of_general_s${sessionNumber}`;

                  if (!validColumnsSet.has(appearCol) || !validColumnsSet.has(dateCol)) {
                    throw new Error('Invalid session number resulted in invalid column names.');
                  }

                  const updateStmt = sessionDb.prepare(`UPDATE monthly_sessions SET "${appearCol}" = 1, "${dateCol}" = ? WHERE benef_id = ? AND project_id = ?`);
                  
                  const transaction = sessionDb.transaction((rows) => {
                      for (const row of rows) {
                          const benefId = row[appearanceMapping.benef_id];
                          if (benefId) {
                            if (mode === 'skip' && duplicateIdsSet.has(String(benefId))) {
                                stats.skipped++;
                                continue;
                            }
                            const info = updateStmt.run(sessionDate, benefId, projectId);
                            stats.updated += info.changes;
                          }
                      }
                  });
                  transaction(appearanceData);
                }
                send({ type: 'progress', status: 'THIRD_STEP_SAVING_GENERAL_SESSIONS_DATE', progress: 50, message: "Appearance data processed.", stats });

                if (absenceData && absenceMapping && absenceData.length > 0) {
                    send({ type: 'progress', status: 'FOURTH_STEP_SAVING_BENEFICIARY_ABSENCE', progress: 60, message: "Processing absence data...", stats });
                    const colsToUpdate = Object.keys(absenceMapping).filter(fileCol => absenceMapping[fileCol] && fileCol !== 'benef_id');
                    
                    const setClause = colsToUpdate.map(fileCol => {
                        const dbCol = absenceMapping[fileCol];
                        if (!validColumnsSet.has(dbCol)) {
                            throw new Error(`Mapping contains an invalid database column: ${dbCol}`);
                        }
                        return `"${dbCol}" = @${fileCol}`;
                    }).join(', ');


                    if (setClause) {
                        const updateStmt = sessionDb.prepare(`UPDATE monthly_sessions SET ${setClause} WHERE benef_id = @benef_id AND project_id = @project_id`);
                        const transaction = sessionDb.transaction((rows) => {
                            for (const row of rows) {
                                const benefId = row[absenceMapping.benef_id];
                                if(!benefId) continue;
                                 if (mode === 'skip' && duplicateIdsSet.has(String(benefId))) {
                                    stats.skipped++;
                                    continue;
                                }
                                const payload: Record<string, any> = { benef_id: benefId, project_id: projectId };
                                colsToUpdate.forEach(fileCol => payload[fileCol] = row[fileCol] ?? null);
                                const info = updateStmt.run(payload);
                                if (info.changes > 0) stats.updated += info.changes;
                                else stats.skipped++;
                            }
                        });
                        transaction(absenceData);
                    }
                }
                
                send({ type: 'progress', status: 'FIFTH_STEP_SAVING_ABSENTEES', progress: 80, message: "Marking absentees...", stats });
                sessionDb.prepare(`UPDATE monthly_sessions SET "absent_s${sessionNumber}" = 1 WHERE project_id = ? AND "absence_code_s${sessionNumber}" IS NOT NULL AND "absence_code_s${sessionNumber}" != ''`).run(projectId);
                
                send({ type: 'progress', status: 'SIXTH_STEP_SAVING_ATTENDANCE', progress: 90, message: "Finalizing attendance...", stats });
                sessionDb.prepare(`UPDATE monthly_sessions SET "attending_s${sessionNumber}" = 0 WHERE project_id = ? AND "absent_s${sessionNumber}" = 1`).run(projectId);
                sessionDb.prepare(`UPDATE monthly_sessions SET "attending_s${sessionNumber}" = 1 WHERE project_id = ? AND "bnf_appear_s${sessionNumber}" = 1 AND ("attending_s${sessionNumber}" IS NULL OR "attending_s${sessionNumber}" != 0)`).run(projectId);
                
                send({ type: 'done', message: "Processing complete!", stats });

            } catch (e: any) {
                send({ type: 'error', error: e.message || 'An unknown error occurred' });
            } finally {
                if (sessionDb) sessionDb.close();
                if (enrollmentDb) enrollmentDb.close();
                writer.close();
            }
        })();

        return new Response(stream.readable, {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch(error: any) {
     console.error("[MONTHLY_SESSIONS_API_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process request.", details: error.message },
      { status: 500 }
    );
  }
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
    } catch (err: any) {
        if ((err as any).code === 'SQLITE_CANTOPEN') {
            return NextResponse.json([]);
        }
        return NextResponse.json({ error: "Failed to fetch session data", details: (err as any).message }, { status: 500 });
    }
}
