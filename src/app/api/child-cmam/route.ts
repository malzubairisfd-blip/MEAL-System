// src/app/api/child-cmam/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "child-CMAM.db");

const DB_SCHEMA = `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,
  project_name TEXT,
  child_idx TEXT,
  child_id TEXT,
  child_first_name TEXT,
  child_name TEXT,
  benef_no TEXT,
  benef_id TEXT,
  bnf_name TEXT,
  hsbnd_name TEXT,
  ed_id TEXT,
  ed_name TEXT,
  ed_phone TEXT,
  gov_name TEXT,
  mud_name TEXT,
  ozla_name TEXT,
  vill_name TEXT,
  child_age_mon TEXT,
  child_age_years TEXT,
  child_gender TEXT,
  BENEF_CLASS_DESC TEXT,
  old_new_child TEXT,
  reg_date TEXT,
  curr_date TEXT,
  reg_curr_days REAL,
  reg_curr_mon REAL,
  new_child_age_mon REAL,
  new_child_age_years REAL,
  cmam_qualify TEXT,
  child_has_cmam TEXT,
  child_cmam_type TEXT,
  muac REAL,
  disc_date TEXT,
  near_health_center TEXT,
  comments TEXT,
  hw_id TEXT,
  hw_name TEXT,
  hc_id TEXT,
  hc_name TEXT,
  attend_hc TEXT,
  conf_date TEXT,
  child_has_cmam_hc TEXT,
  hc_card_no TEXT,
  meas_type TEXT,
  "z-score_h" REAL,
  "z-score_w" REAL,
  "z-score" REAL,
  child_cmam_cond TEXT,
  exp_start_treat_date TEXT,
  exp_end_treat_date TEXT,
  cmam_result_hc TEXT,
  not_attend_reason_hc TEXT,
  child_attend_c1 TEXT,
  child_isprev_ref_c1 TEXT,
  date_attend_c1 TEXT,
  child_has_cmam_c1 TEXT,
  child_cmam_cond_c1 TEXT,
  meas_type_c1 TEXT,
  muac_c1 REAL,
  "z-score_h_c1" REAL,
  "z-score_w_c1" REAL,
  "z-score_c1" REAL,
  cmam_result_c1 TEXT,
  not_attend_reason_c1 TEXT,
  child_age_c1 TEXT,
  cure_rate_c1 TEXT,
  positive_c1 TEXT,
  negative_c1 TEXT,
  next_cycle_c1 TEXT,
  child_attend_c2 TEXT,
  child_isprev_ref_c2 TEXT,
  date_attend_c2 TEXT,
  child_has_cmam_c2 TEXT,
  child_cmam_cond_c2 TEXT,
  meas_type_c2 REAL,
  muac_c2 REAL,
  "z-score_h_c2" REAL,
  "z-score_w_c2" REAL,
  "z-score_c2" REAL,
  cmam_result_c2 TEXT,
  not_attend_reason_c2 TEXT,
  child_age_c2 TEXT,
  cure_rate_c2 TEXT,
  positive_c2 TEXT,
  negative_c2 TEXT,
  next_cycle_c2 TEXT,
  child_attend_c3 TEXT,
  child_isprev_ref_c3 TEXT,
  date_attend_c3 TEXT,
  child_has_cmam_c3 TEXT,
  child_cmam_cond_c3 TEXT,
  meas_type_c3 TEXT,
  muac_c3 REAL,
  "z-score_h_c3" REAL,
  "z-score_w_c3" REAL,
  "z-score_c3" REAL,
  cmam_result_c3 TEXT,
  not_attend_reason_c3 TEXT,
  child_age_c3 TEXT,
  cure_rate_c3 TEXT,
  positive_c3 TEXT,
  negative_c3 TEXT,
  next_cycle_c3 TEXT,
  data JSON
)`;

const columnDefs = DB_SCHEMA.replace(/^\(|\)$/g, "").split(",").map(s => s.trim().split(/\s+/)[0].replace(/"/g, ""));

function initializeDatabase() {
    const db = new Database(getDbPath());
    db.exec(`CREATE TABLE IF NOT EXISTS child_cmam ${DB_SCHEMA}`);
    return db;
}

export async function POST(req: Request) {
    await fs.mkdir(getDataPath(), { recursive: true });
    const body = await req.json();
    const { action } = body;

    try {
        if (action === 'get_schema') {
            const db = initializeDatabase();
            const tableInfo = db.prepare("PRAGMA table_info(child_cmam)").all();
            db.close();
            return NextResponse.json({ columns: tableInfo.map((c: any) => c.name) });
        }

        if (action === 'check_duplicates') {
            const { projectId, uniqueIds, uniqueIdCol } = body;
            if (!projectId || !Array.isArray(uniqueIds) || !uniqueIdCol) {
                return NextResponse.json({ error: "Missing parameters for duplicate check." }, { status: 400 });
            }
            const db = initializeDatabase();
            try {
                const totalInDb = (db.prepare('SELECT COUNT(*) as count FROM child_cmam WHERE project_id = ?').get(projectId) as { count: number }).count;
                const placeholders = uniqueIds.map(() => '?').join(',');
                const stmt = db.prepare(`SELECT "${uniqueIdCol}" FROM child_cmam WHERE project_id = ? AND "${uniqueIdCol}" IN (${placeholders})`);
                const existingRows = stmt.all(projectId, ...uniqueIds);
                const existingIds = new Set(existingRows.map((r: any) => r[uniqueIdCol]));
                const duplicateIds = uniqueIds.filter(id => existingIds.has(id));
                return NextResponse.json({ count: duplicateIds.length, totalInDb, duplicateIds });
            } finally {
                db.close();
            }
        }
        
       if (action === 'save') {
            const { projectId, records, mode, uniqueIdCol } = body;
            if (!projectId || !Array.isArray(records) || !mode || !uniqueIdCol) {
                return NextResponse.json({ error: "Missing parameters for save." }, { status: 400 });
            }
            const db = initializeDatabase();
            try {
                const insertCols = columnDefs.filter(c => c !== 'id');
                const placeholders = insertCols.map(c => `@${c}`).join(', ');
                const insertStmt = db.prepare(`INSERT INTO child_cmam (${insertCols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`);

                const updateCols = insertCols.filter(c => c !== uniqueIdCol && c !== 'project_id');
                const updateStmt = db.prepare(`UPDATE child_cmam SET ${updateCols.map(c => `"${c}" = @${c}`).join(', ')} WHERE "${uniqueIdCol}" = @${uniqueIdCol} AND project_id = @project_id`);

                const checkStmt = db.prepare(`SELECT id FROM child_cmam WHERE "${uniqueIdCol}" = ? AND project_id = ?`);
                
                let saved = 0, updated = 0, skipped = 0;
                
                const transaction = db.transaction(() => {
                    for (const record of records) {
                        const uniqueVal = record[uniqueIdCol];
                        if (uniqueVal === null || uniqueVal === undefined) {
                            skipped++; continue;
                        }
                        const existing = checkStmt.get(uniqueVal, projectId);

                        if (existing) {
                            if (mode === 'replace') {
                                const info = updateStmt.run(record);
                                if (info.changes > 0) updated++; else skipped++;
                            } else {
                                skipped++;
                            }
                        } else {
                            const info = insertStmt.run(record);
                            if (info.changes > 0) saved++;
                        }
                    }
                });
                
                transaction();
                
                return NextResponse.json({ saved, updated, skipped, total: records.length });

            } finally {
                db.close();
            }
        }
        
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch(err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}