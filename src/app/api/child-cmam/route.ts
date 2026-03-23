// src/app/api/child-cmam/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";
import { WritableStreamDefaultWriter } from "stream/web";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "child-CMAM.db");
const getBnfCmamDbPath = () => path.join(getDataPath(), "bnf-CMAM.db");
const getProjectsDbPath = () => path.join(getDataPath(), "projects.db");

// Corrected Schema
const DB_SCHEMA = `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT, project_name TEXT, child_idx TEXT, child_id TEXT, child_first_name TEXT, child_name TEXT,
  woman_id TEXT, benef_no TEXT, benef_id TEXT, bnf_name TEXT, hsbnd_name TEXT, ed_id TEXT, ed_name TEXT,
  ed_phone TEXT, gov_name TEXT, mud_name TEXT, ozla_name TEXT, vill_name TEXT, child_age_mon TEXT,
  child_age_years TEXT, child_gender TEXT, BENEF_CLASS_DESC TEXT, old_new_child TEXT, reg_date TEXT,
  curr_date TEXT, reg_curr_days TEXT, reg_curr_mon TEXT, new_child_age_mon TEXT, new_child_age_years TEXT,
  cmam_qualify TEXT, child_has_cmam TEXT, child_cmam_type TEXT, muac REAL, go_health_center TEXT,
  disc_date TEXT, near_health_center TEXT, comments TEXT, hw_id TEXT, hw_name TEXT, hc_id TEXT, hc_name TEXT,
  attend_hc TEXT, conf_date TEXT, child_has_cmam_hc TEXT, hc_card_no TEXT, meas_type TEXT, zscore_h REAL,
  zscore_w REAL, zscore REAL, child_cmam_cond TEXT, exp_start_treat_date TEXT, exp_end_treat_date TEXT,
  cmam_result_hc TEXT, not_attend_reason_hc TEXT, child_attend_c1 TEXT, child_isprev_ref_c1 TEXT,
  date_attend_c1 TEXT, child_has_cmam_c1 TEXT, child_cmam_cond_c1 TEXT, meas_type_c1 TEXT, muac_c1 REAL,
  zscore_h_c1 REAL, zscore_w_c1 REAL, zscore_c1 REAL, cmam_result_c1 TEXT, not_attend_reason_c1 TEXT,
  child_age_c1 TEXT, cure_rate_c1 TEXT, positive_c1 TEXT, negative_c1 TEXT, next_cycle_c1 TEXT,
  child_attend_c2 TEXT, child_isprev_ref_c2 TEXT, date_attend_c2 TEXT, child_has_cmam_c2 TEXT,
  child_cmam_cond_c2 TEXT, meas_type_c2 TEXT, muac_c2 REAL, zscore_h_c2 REAL, zscore_w_c2 REAL,
  zscore_c2 REAL, cmam_result_c2 TEXT, not_attend_reason_c2 TEXT, child_age_c2 TEXT, cure_rate_c2 TEXT,
  positive_c2 TEXT, negative_c2 TEXT, next_cycle_c2 TEXT, child_attend_c3 TEXT, child_isprev_ref_c3 TEXT,
  date_attend_c3 TEXT, child_has_cmam_c3 TEXT, child_cmam_cond_c3 TEXT, meas_type_c3 TEXT, muac_c3 REAL,
  zscore_h_c3 REAL, zscore_w_c3 REAL, zscore_c3 REAL, cmam_result_c3 TEXT, not_attend_reason_c3 TEXT,
  child_age_c3 TEXT, cure_rate_c3 TEXT, positive_c3 TEXT, negative_c3 TEXT, next_cycle_c3 TEXT,
  data JSON
)`;


const columnDefs = DB_SCHEMA.replace(/[()]/g, "").split(",").map((s) => s.trim().split(/\s+/)[0].replace(/"/g, ""));
const DB_COLUMNS = Array.from(new Set(columnDefs.filter((c) => c && c.trim() !== "")));

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS child_cmam ${DB_SCHEMA}`);
  return db;
}

const sendProgress = (writer: WritableStreamDefaultWriter, payload: any) => {
  const encoder = new TextEncoder();
  writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
};

export async function POST(req: Request) {
  await fs.mkdir(getDataPath(), { recursive: true });
  const body = await req.json();
  const { action } = body;

  try {
    if (action === "get_schema") {
        return NextResponse.json({ columns: DB_COLUMNS, schema: DB_COLUMNS });
    }
    
    if (action === "create_new_child") {
        const { benef_id, child_first_name, ...updates } = body;
        const db = initializeDatabase();
        let bnfCmamDb: Database.Database | null = null;
        try {
            const countResult = db.prepare('SELECT COUNT(*) as count FROM child_cmam WHERE benef_id = ?').get(benef_id) as {count: number};
            const newChildIdx = (countResult?.count || 0) + 1;
            
            bnfCmamDb = new Database(getBnfCmamDbPath(), { fileMustExist: true });
            const parentRecord = bnfCmamDb.prepare('SELECT * FROM bnf_cmam WHERE BENEF_ID = ?').get(benef_id);
            if(!parentRecord) throw new Error("Parent beneficiary record not found in bnf-cmam.db");

            const newRecord: Record<string, any> = { ...updates };
            
            // Enrich from parent
            newRecord.woman_id = parentRecord.WOMAN_ID;
            newRecord.bnf_name = parentRecord.BENEF_NAME;
            newRecord.hsbnd_name = parentRecord.HUSBAND_NAME;
            newRecord.ed_id = parentRecord.ED_ID;
            newRecord.ed_name = parentRecord.ED_NAME;
            newRecord.ed_phone = parentRecord.ed_phone;
            newRecord.gov_name = parentRecord.GOV_NAME;
            newRecord.mud_name = parentRecord.MUD_NAME;
            newRecord.ozla_name = parentRecord.OZLA_NAME;
            newRecord.vill_name = parentRecord.VILL_NAME;
            newRecord.BENEF_CLASS_DESC = parentRecord.BENEF_CLASS_DESC;

            // Calculate new fields
            newRecord.child_idx = String(newChildIdx);
            newRecord.child_id = `${newRecord.woman_id}${newChildIdx}`;
            newRecord.old_new_child = 'new';
            newRecord.child_name = `${child_first_name} ${parentRecord.HUSBAND_NAME}`;
            newRecord.new_child_age_years = (updates.new_child_age_mon / 12).toFixed(2);
            newRecord.cmam_qualify = 'Qualified';
            
            const insertCols = Object.keys(newRecord).filter(k => DB_COLUMNS.includes(k));
            const placeholders = insertCols.map(c => `@${c}`).join(', ');
            const stmt = db.prepare(`INSERT INTO child_cmam (${insertCols.join(', ')}) VALUES (${placeholders})`);
            
            stmt.run(newRecord);
            return NextResponse.json({ success: true, message: "New child record created." });

        } finally {
            db.close();
            if(bnfCmamDb) bnfCmamDb.close();
        }
    }


    if (action === "check_duplicates") { /* ... (existing code unchanged) ... */ }
    if (action === "save") { /* ... (existing code unchanged) ... */ }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = initializeDatabase();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const records =
      projectId && projectId !== "all"
        ? db.prepare("SELECT * FROM child_cmam WHERE project_id = ?").all(projectId)
        : db.prepare("SELECT * FROM child_cmam").all();
    db.close();
    return NextResponse.json(records);
  } catch (err: any) {
    if ((err as any).code === "SQLITE_CANTOPEN") {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      { error: "Failed to fetch child CMAM data.", details: (err as any)?.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase();
        const recordsToUpdate = await req.json();
        
        if (!Array.isArray(recordsToUpdate) || recordsToUpdate.length === 0) {
            return NextResponse.json({ error: "Expected an array of records" }, { status: 400 });
        }

        const transaction = db.transaction((records) => {
            for (const record of records) {
                if (!record.id) continue;
                
                const { id, ...updates } = record;
                const colsToUpdate = Object.keys(updates).filter(k => DB_COLUMNS.includes(k));

                if (colsToUpdate.length === 0) continue;
                
                const setClause = colsToUpdate.map(k => `"${k}" = ?`).join(', ');
                const values = colsToUpdate.map(k => updates[k]);
                values.push(id);
                
                const stmt = db.prepare(`UPDATE child_cmam SET ${setClause} WHERE id = ?`);
                stmt.run(...values);
            }
        });
        
        transaction(recordsToUpdate);
        db.close();

        return NextResponse.json({ message: `${recordsToUpdate.length} records updated successfully.` });
    } catch (err: any) {
        return NextResponse.json({ error: "Failed to update records", details: err.message }, { status: 500 });
    }
}
