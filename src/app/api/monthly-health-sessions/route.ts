
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

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS monthly_sessions ${DB_COLUMNS_FOR_CREATION};`);
  return db;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;

  if (action === 'get_schema') {
      try {
        const db = initializeDatabase();
        const tableInfo = db.prepare("PRAGMA table_info(monthly_sessions)").all();
        const columns = tableInfo.map((c: any) => c.name);
        db.close();
        return NextResponse.json({ columns });
      } catch (error: any) {
        return NextResponse.json({ error: "Failed to get schema", details: error.message }, { status: 500 });
      }
  }


  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const send = (data: any) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  (async () => {
    try {
      const {
        projectId, sessionNumber, sessionDate,
        appearanceData, appearanceMapping, absenceData, absenceMapping
      } = body;

      if (!projectId || !sessionNumber || !sessionDate || !appearanceData || !appearanceMapping) {
        throw new Error("Missing required parameters for processing.");
      }

      send({ type: 'progress', status: 'FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE', progress: 10, message: "Initializing databases..." });
      
      const sessionDb = initializeDatabase();
      let enrollmentDb: Database.Database | null = null;
      
      try {
        enrollmentDb = new Database(getEnrollmentDbPath(), { fileMustExist: true });
        const beneficiaries = enrollmentDb.prepare(`
          SELECT benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name 
          FROM enrollment_data 
          WHERE project_id = ?
        `).all(projectId);

        const insertStmt = sessionDb.prepare(`
          INSERT OR IGNORE INTO monthly_sessions (project_id, project_name, benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        sessionDb.transaction(() => {
          beneficiaries.forEach((bnf: any) => {
            insertStmt.run(projectId, bnf.project_name, bnf.benef_id, bnf.bnf_name, bnf.bnf_vill, bnf.bnf_ozla, bnf.bnf_mud, bnf.ed_id, bnf.ed_name);
          });
        })();

        send({ type: 'progress', status: 'FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE', progress: 20, message: `Loaded ${beneficiaries.length} base records.` });

      } catch (e: any) {
        if (e.code === 'SQLITE_CANTOPEN') {
           send({ type: 'progress', status: 'FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE', progress: 20, message: 'Enrollment DB not found, skipping initial population.' });
        } else {
            throw e;
        }
      } finally {
          if (enrollmentDb) enrollmentDb.close();
      }

      send({ type: 'progress', status: 'SECOND_STEP_SAVING_BENEFICIARY_APPEARANCE', progress: 30, message: "Processing appearance data..." });
      const appearCol = `bnf_appear_s${sessionNumber}`;
      const dateCol = `date_of_general_s${sessionNumber}`;
      
      const updateAppearanceStmt = sessionDb.prepare(`UPDATE monthly_sessions SET ${appearCol} = 1, ${dateCol} = ? WHERE benef_id = ?`);
      
      sessionDb.transaction(() => {
          appearanceData.forEach((row: any) => {
              const benefId = row[appearanceMapping.benef_id];
              if (benefId) {
                  updateAppearanceStmt.run(sessionDate, benefId);
              }
          });
      })();
      
      send({ type: 'progress', status: 'THIRD_STEP_SAVING_GENERAL_SESSIONS_DATE', progress: 50, message: "Appearance data processed." });

      if (absenceData && absenceMapping) {
          send({ type: 'progress', status: 'FOURTH_STEP_SAVING_BENEFICIARY_ABSENCE', progress: 60, message: "Processing absence data..." });
          const absenceColsToUpdate = Object.keys(absenceMapping).filter(col => col !== 'benef_id');
          const setClause = absenceColsToUpdate.map(dbCol => `${absenceMapping[dbCol]} = ?`).join(', ');
          
          if(setClause) {
              const updateAbsenceStmt = sessionDb.prepare(`UPDATE monthly_sessions SET ${setClause} WHERE benef_id = ?`);
              sessionDb.transaction(() => {
                  absenceData.forEach((row: any) => {
                      const benefId = row[absenceMapping.benef_id];
                      if(benefId) {
                          const values = absenceColsToUpdate.map(fileCol => row[fileCol] ?? null);
                          updateAbsenceStmt.run(...values, benefId);
                      }
                  });
              })();
          }
      }

      send({ type: 'progress', status: 'FIFTH_STEP_SAVING_ABSENTEES', progress: 80, message: "Marking absentees..." });
      const absentCol = `absent_s${sessionNumber}`;
      const absenceCodeCol = `absence_code_s${sessionNumber}`;
      sessionDb.prepare(`UPDATE monthly_sessions SET ${absentCol} = 1 WHERE ${absenceCodeCol} IS NOT NULL AND ${absenceCodeCol} != ''`).run();

      send({ type: 'progress', status: 'SIXTH_STEP_SAVING_ATTENDANCE', progress: 90, message: "Finalizing attendance..." });
      const attendingCol = `attending_s${sessionNumber}`;
      sessionDb.prepare(`UPDATE monthly_sessions SET ${attendingCol} = 0 WHERE ${absentCol} = 1`).run();
      sessionDb.prepare(`UPDATE monthly_sessions SET ${attendingCol} = 1 WHERE ${appearCol} = 1 AND (${attendingCol} IS NULL OR ${attendingCol} != 0)`).run();
      
      send({ type: 'done', message: "Processing complete!" });

    } catch (e: any) {
      send({ type: 'error', error: e.message || 'An unknown error occurred' });
    } finally {
      writer.close();
    }
  })();
  
  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}

export async function GET(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase();
        const records = db.prepare("SELECT * FROM monthly_sessions").all();
        db.close();
        return NextResponse.json(records);
    } catch (err: any) {
        if (err.code === 'SQLITE_CANTOPEN') {
            return NextResponse.json([]);
        }
        return NextResponse.json({ error: "Failed to fetch session data", details: err.message }, { status: 500 });
    }
}
