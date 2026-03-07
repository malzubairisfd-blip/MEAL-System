// src/app/api/bnf-cmam/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-cmam.db");
const getProjectsDbPath = () => path.join(getDataPath(), 'projects.db');
const getEducatorsDbPath = () => path.join(getDataPath(), 'educators.db');

const DB_COLUMNS_FOR_CREATION = `(
    id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT, project_name TEXT, PROJ_NO TEXT, BATCH_NO TEXT,
    GOV_NO TEXT, MUD_NO TEXT, OZLA_NO TEXT, VILL_NO TEXT, MUD_LOC_ID TEXT, GOV_NAME TEXT, MUD_NAME TEXT,
    OZLA_NAME TEXT, VILL_NAME TEXT, ED_NO TEXT, ED_ID TEXT, EC_ID TEXT, PC_ID TEXT, ED_NAME TEXT, EC_NAME TEXT,
    PC_NAME TEXT, SRVY_HH_ID TEXT, CANDID_SER_NO TEXT, WOMAN_ID TEXT, ID TEXT, BENEF_ID TEXT, BENEF_NO TEXT,
    HH_NAME TEXT, BNF_RELATION TEXT, BENEF_NAME TEXT, HUSBAND_NAME TEXT, CHILD_LIST_STR TEXT, CHILD_LIST_LONG TEXT,
    BNF_SOCIAL_STATUS TEXT, SOCIAL_STATUS_DESC TEXT, IS_ACTIVE TEXT, STATUS TEXT, QUAL_STATUS TEXT, STATUS_DESC TEXT,
    QUAL_STATUS_DESC TEXT, VERIFY_STATUS TEXT, VERIFY_NOTES TEXT, VERIFY_REASON TEXT, VERIFY_DATE TEXT, REG_STATUS TEXT,
    REG_FORM_DATE TEXT, REG_NOTES TEXT, TOTAL_CHILD_COUNT TEXT, MALE_CHILD_COUNT TEXT, FEMALE_CHILD_COUNT TEXT,
    LOC_ID TEXT, LOC_NAME TEXT, ID_CARD_TYPE TEXT, ID_CARD_TYPE_DESC TEXT, ID_CARD_NO TEXT, AGE_YEARS TEXT,
    ADDRESS TEXT, PHONE_NO TEXT, IS_TERMINATED TEXT, TERM_DATE TEXT, TERM_REASON TEXT, TERM_NOTES TEXT,
    NOTES TEXT, PC_FAC_ID TEXT, EC_FAC_ID TEXT, BENEF_CLASS TEXT, BENEF_CLASS_DESC TEXT, OLD_BNF_NAME TEXT,
    OLD_HSBND_NAME TEXT, OLD_PHONE_NO TEXT, OLD_ID_CARD_NO TEXT, ed_phone TEXT, new_ed_id TEXT, new_ed_name TEXT,
    new_ed_phone TEXT, new_ec_id TEXT, new_ec_name TEXT, new_pc_id TEXT, new_pc_name TEXT, reg_date TEXT,
    curr_date TEXT, reg_curr_days REAL, reg_curr_mon REAL, bnf_age_mon REAL, new_bnf_age_mon REAL, new_bnf_age_years REAL,
    cmam_qualify TEXT, bnf_has_cmam TEXT, bnf_preg_lec TEXT, preg_mon TEXT, child_age TEXT, muac TEXT, go_health_center TEXT,
    disc_date TEXT, near_health_center TEXT, comments TEXT, hw_id TEXT, hw_name TEXT, hc_id TEXT, hc_name TEXT,
    attend_hc TEXT, conf_date TEXT, bnf_has_cmam_hc TEXT, hc_card_no TEXT, bnf_cmam_cond TEXT, bnf_preg_mon TEXT,
    bnf_child_age TEXT, hc_muac TEXT, exp_start_treat_date TEXT, exp_end_treat_date TEXT, not_attend_reason TEXT,
    bnf_attend_c1 TEXT, bnf_isprev_ref_c1 TEXT, date_attend_c1 TEXT,
    bnf_cmam_cond_c1 TEXT, bnf_preg_mon_c1 TEXT,
    bnf_child_age_c1 TEXT, hc_muac_c1 TEXT, cmam_result_c1 TEXT, not_attend_reason_c1 TEXT, cure_rate_c1 TEXT,
    positive_c1 TEXT, negative_c1 TEXT, next_cycle_c1 TEXT, bnf_isprev_ref_c2 TEXT, date_attend_c2 TEXT,
    bnf_cmam_cond_c2 TEXT, bnf_preg_mon_c2 TEXT,
    bnf_child_age_c2 TEXT, hc_muac_c2 TEXT, cmam_result_c2 TEXT, not_attend_reason_c2 TEXT, cure_rate_c2 TEXT,
    positive_c2 TEXT, negative_c2 TEXT, next_cycle_c2 TEXT, bnf_isprev_ref_c3 TEXT, date_attend_c3 TEXT,
    bnf_cmam_cond_c3 TEXT, bnf_preg_mon_c3 TEXT,
    bnf_child_age_c3 TEXT, hc_muac_c3 TEXT, cmam_result_c3 TEXT, not_attend_reason_c3 TEXT, cure_rate_c3 TEXT,
    positive_c3 TEXT, negative_c3 TEXT, next_cycle_c3 TEXT, data JSON
)`;

const ALL_COLUMNS = DB_COLUMNS_FOR_CREATION.match(/\b\w+\b/g)?.filter(c => c !== 'INTEGER' && c !== 'PRIMARY' && c !== 'KEY' && c !== 'AUTOINCREMENT' && c !== 'TEXT' && c !== 'REAL' && c !== 'JSON') || [];
const VALID_COLUMNS_SET = new Set(ALL_COLUMNS.map(c => c.toLowerCase()));

const sanitizeColumn = (col?: string) => (col ? col.replace(/[^a-zA-Z0-9_]/g, "") : "");

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS bnf_cmam ${DB_COLUMNS_FOR_CREATION};`);
  return db;
}

const sendProgress = (writer: WritableStreamDefaultWriter<Uint8Array>, payload: any) => {
    const encoder = new TextEncoder();
    writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
};

export async function GET(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase();
        const records = db.prepare("SELECT * FROM bnf_cmam").all();
        db.close();
        return NextResponse.json(records);
    } catch (err: any) {
        if (err.code === "SQLITE_CANTOPEN") return NextResponse.json([]);
        return NextResponse.json({ error: "Failed to fetch data", details: err?.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const body = await req.json();
        const { action } = body;

        if (action === "get_schema") {
            const db = initializeDatabase();
            const columns = db.prepare("PRAGMA table_info(bnf_cmam)").all().map((c: any) => c.name);
            db.close();
            return NextResponse.json({ columns });
        }

        if (action === "check_duplicates") {
            const { projectId, uniqueIds, uniqueIdCol } = body;
            const lookupColumn = sanitizeColumn(uniqueIdCol);
            if (!lookupColumn || !VALID_COLUMNS_SET.has(lookupColumn.toLowerCase())) {
                return NextResponse.json({ error: "Invalid unique column" }, { status: 400 });
            }
            let db: Database.Database | null = null;
            try {
                db = new Database(getDbPath(), { fileMustExist: true });
                const existingIds = new Set<string>();
                const stmt = db.prepare(`SELECT "${lookupColumn}" FROM bnf_cmam WHERE project_id = ?`);
                const rows = stmt.all(projectId) as any[];
                rows.forEach(row => existingIds.add(String(row[lookupColumn])));

                const duplicates = uniqueIds.filter((id: string) => existingIds.has(id));
                const totalInDb = db.prepare("SELECT COUNT(*) as total FROM bnf_cmam WHERE project_id = ?").get(projectId) as { total: number };
                return NextResponse.json({ count: duplicates.length, totalInDb: totalInDb.total, duplicateIds: duplicates });
            } catch (err: any) {
                if (err.code === 'SQLITE_CANTOPEN') return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
                throw err;
            } finally {
                if (db) db.close();
            }
        }
        
        if(action === "save") {
            // This is a long process, so we use a streaming response
             const stream = new TransformStream();
            const writer = stream.writable.getWriter();
            const response = new Response(stream.readable, {
                headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
            });
            
             (async () => {
                const { projectId, projectName, records, mapping, uniqueIdCol, regDate, currDate, mode } = body;
                const db = initializeDatabase();
                
                try {
                    // Step 1 - Handled by initializeDatabase
                    sendProgress(writer, { type: 'progress', status: 'saving', progress: 10, message: 'Saving initial records...' });

                    let educatorsMap = new Map();
                    try {
                        const educatorsDb = new Database(getEducatorsDbPath(), { fileMustExist: true });
                        const educators = educatorsDb.prepare('SELECT applicant_name, phone_no FROM educators WHERE project_id = ?').all(projectId);
                        educators.forEach((e: any) => educatorsMap.set(e.applicant_name, e.phone_no));
                        educatorsDb.close();
                    } catch { /* if educators.db doesn't exist, we just skip this enrichment */ }

                    const insertCols = Object.values(mapping).filter(col => ALL_COLUMNS.includes(col));
                    const insertPlaceholders = insertCols.map(c => `@${c}`).join(', ');
                    const insertStmt = db.prepare(`INSERT INTO bnf_cmam (${insertCols.join(', ')}) VALUES (${insertPlaceholders})`);
                    const updateStmt = db.prepare(`UPDATE bnf_cmam SET ${insertCols.map(c => `${c} = @${c}`).join(', ')} WHERE ${uniqueIdCol} = @${uniqueIdCol} AND project_id = @project_id`);
                    
                    const transaction = db.transaction((rows: any[], mode: 'skip' | 'replace') => {
                        let saved = 0, updated = 0, skipped = 0;
                        const checkStmt = db.prepare(`SELECT 1 FROM bnf_cmam WHERE ${uniqueIdCol} = ? AND project_id = ?`);

                        for (const row of rows) {
                            const payload: Record<string, any> = { project_id: projectId, project_name: projectName };
                            for (const [fileCol, dbCol] of Object.entries(mapping)) {
                                payload[dbCol as string] = row[fileCol as string] ?? null;
                            }
                            
                            const uniqueValue = payload[uniqueIdCol];
                            if(!uniqueValue) { skipped++; continue; }

                            const exists = checkStmt.get(uniqueValue, projectId);
                            if (exists) {
                                if (mode === 'replace') {
                                    updateStmt.run(payload);
                                    updated++;
                                } else { skipped++; }
                            } else {
                                insertStmt.run(payload);
                                saved++;
                            }
                        }
                        return { saved, updated, skipped };
                    });

                    const stats = transaction(records, mode);
                    sendProgress(writer, { type: 'progress', status: 'enriching_phones', progress: 40, message: 'Enriching educator phones...', stats });
                    
                    // Step 3 - Enrich phone numbers
                    const allCmamRecords = db.prepare('SELECT id, ED_NAME FROM bnf_cmam WHERE project_id = ?').all(projectId);
                    const updatePhoneStmt = db.prepare('UPDATE bnf_cmam SET ed_phone = ? WHERE id = ?');
                    db.transaction((cmamRecords: any[]) => {
                        cmamRecords.forEach(rec => {
                            if(rec.ED_NAME && educatorsMap.has(rec.ED_NAME)) {
                                updatePhoneStmt.run(educatorsMap.get(rec.ED_NAME), rec.id);
                            }
                        });
                    })(allCmamRecords);

                    sendProgress(writer, { type: 'progress', status: 'calculating_dates', progress: 60, message: 'Calculating dates...', stats });

                    // Steps 4, 5, 6
                    const recordsToUpdate = db.prepare("SELECT id, AGE_YEARS FROM bnf_cmam WHERE project_id = ? AND BENEF_CLASS_DESC = 'مستفيدة'").all(projectId);
                    const updateCalcStmt = db.prepare('UPDATE bnf_cmam SET reg_date=?, curr_date=?, reg_curr_days=?, reg_curr_mon=?, bnf_age_mon=?, new_bnf_age_mon=?, new_bnf_age_years=?, cmam_qualify=? WHERE id = ?');
                    
                    db.transaction((updateRecords: any[]) => {
                        for (const rec of updateRecords) {
                            const reg_date = new Date(regDate);
                            const curr_date = new Date(currDate);
                            const reg_curr_days = (curr_date.getTime() - reg_date.getTime()) / (1000 * 3600 * 24);
                            const reg_curr_mon = reg_curr_days / 30;
                            const bnf_age_mon = Number(rec.AGE_YEARS) * 12;
                            const new_bnf_age_mon = bnf_age_mon + reg_curr_mon;
                            const new_bnf_age_years = new_bnf_age_mon / 12;
                            const cmam_qualify = new_bnf_age_years <= 49 ? 'Qualified' : 'Disqualified';
                            updateCalcStmt.run(regDate, currDate, reg_curr_days, reg_curr_mon, bnf_age_mon, new_bnf_age_mon, new_bnf_age_years, cmam_qualify, rec.id);
                        }
                    })(recordsToUpdate);

                    sendProgress(writer, { type: 'progress', status: 'done', progress: 100, message: 'All steps complete!', stats });

                    const finalCounts = {
                        totalBeneficiaries: db.prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ?").get(projectId).count,
                        qualifiedBeneficiaries: db.prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ? AND BENEF_CLASS_DESC = 'مستفيدة'").get(projectId).count,
                        cmamQualified: db.prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ? AND cmam_qualify = 'Qualified'").get(projectId).count,
                        disqualifiedBeneficiaries: db.prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ? AND BENEF_CLASS_DESC != 'مستفيدة'").get(projectId).count,
                        cmamDisqualified: db.prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ? AND cmam_qualify = 'Disqualified'").get(projectId).count
                    };

                    sendProgress(writer, {type: 'done', message: 'Processing complete!', results: finalCounts });

                } catch (error: any) {
                    sendProgress(writer, { type: 'error', error: error.message });
                } finally {
                    db.close();
                    writer.close();
                }
            })();
            return response;
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: "Failed to process request.", details: error.message }, { status: 500 });
    }
}
