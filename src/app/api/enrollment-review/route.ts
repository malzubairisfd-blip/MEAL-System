// src/app/api/enrollment-review/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "enrollment-review.db");

// Corrected and de-duplicated schema
const DB_SCHEMA = `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    project_name TEXT,
    ed_id TEXT,
    ed_id_type TEXT,
    ed_name TEXT,
    office_no INTEGER,
    office_name TEXT,
    ed_bnf_cnt INTEGER,
    ed_vill_cnt INTEGER,
    ed_vill_list TEXT,
    ed_mud_name TEXT,
    def_vill_id INTEGER,
    def_vill_name TEXT,
    def_vill_full_name TEXT,
    benef_id TEXT,
    benef_no TEXT,
    woman_id TEXT,
    hh_id TEXT,
    bnf_name TEXT,
    hsbnd_name TEXT,
    hh_name TEXT,
    bnf_relation_desc TEXT,
    bnf_relation_code TEXT,
    bnf_age TEXT,
    bnf_qual_status TEXT,
    bnf_qual_status_desc TEXT,
    bnf_child_male_cnt TEXT,
    bnf_child_female_cnt TEXT,
    bnf_child_list TEXT,
    hh_phone_no TEXT,
    bnf_phone_no TEXT,
    bnf_address TEXT,
    bnf_mahal TEXT,
    bnf_vill_id TEXT,
    bnf_vill TEXT,
    bnf_ozla TEXT,
    bnf_mud TEXT,
    bnf_id_card_no TEXT,
    bnf_id_card_type TEXT,
    bnf_verify_status TEXT,
    bnf_id_card_type_desc TEXT,
    vill_ed_cnt TEXT,
    curr_bnf_1name TEXT,
    curr_bnf_2name TEXT,
    curr_bnf_3name TEXT,
    curr_bnf_4name TEXT,
    curr_bnf_5name TEXT,
    curr_hsbnd_1name TEXT,
    curr_hsbnd_2name TEXT,
    curr_hsbnd_3name TEXT,
    curr_hsbnd_4name TEXT,
    curr_hsbnd_5name TEXT,
    bnf_is_preg TEXT,
    enrollment_modification_type TEXT,
    eligible_woman_modify_type TEXT,
    eligible_woman_name_correction TEXT,
    eligible_woman_phone_correction TEXT,
    eligible_woman_ID_correction TEXT,
    eligible_woman_husband_name_correction TEXT,
    pregnancy_month TEXT,
    educational_level_of_the_targeted_woman TEXT,
    new_bnf_name TEXT,
    the_corrected_part_of_the_targets_name TEXT,
    corrected_part_of_the_targets_namefirst_name TEXT,
    the_corrected_part_of_the_targets_namefathers_name TEXT,
    the_corrected_part_of_the_targets_namegrandfathers_name TEXT,
    corrected_part_of_the_targets_namefourth_name TEXT,
    corrected_part_of_the_targets_nametitle TEXT,
    correcting_the_first_name TEXT,
    correcting_the_fathers_name TEXT,
    correcting_the_grandfathers_name TEXT,
    correcting_the_fourth_name TEXT,
    correcting_the_title TEXT,
    bnf_1name_flag TEXT,
    bnf_2name_flag TEXT,
    bnf_3name_flag TEXT,
    bnf_4name_flag TEXT,
    bnf_5name_flag TEXT,
    bnf_1name_is_valid TEXT,
    bnf_2name_is_valid TEXT,
    bnf_3name_is_valid TEXT,
    bnf_4name_is_valid TEXT,
    bnf_5name_is_valid TEXT,
    bnf_1name_valid_note TEXT,
    bnf_2name_valid_note TEXT,
    bnf_3name_valid_note TEXT,
    bnf_4name_valid_note TEXT,
    bnf_5name_valid_note TEXT,
    reference_under_which_the_name_was_corrected TEXT,
    reference_under_which_the_namepersonal_ID_card_correction_was_made TEXT,
    reference_under_which_the_namefamily_card_correction_was_made TEXT,
    reference_under_which_the_namepassport_correction_was_made TEXT,
    reference_under_which_the_name_correctionmarriage_contract_was_made TEXT,
    reference_under_which_the_nameelectoral_card_correction_was_made TEXT,
    reference_under_which_the_name_correctionquestionnaire_was_made TEXT,
    reference_used_to_correct_the_nameaccording_to_the_womans_statement TEXT,
    reference_under_which_the_nameseat_number_was_corrected TEXT,
    reference_under_which_the_name_correction_was_madeother_mentioned TEXT,
    another_reference_under_which_the_name_was_modified TEXT,
    the_corrected_part_of_the_husbands_name TEXT,
    corrected_part_of_husbands_namefirst_name TEXT,
    corrected_part_of_husbands_namefathers_name TEXT,
    the_corrected_part_of_the_husbands_namegrandfathers_name TEXT,
    corrected_part_of_husbands_namefourth_name TEXT,
    corrected_part_of_husbands_namesurname TEXT,
    new_hsbnd_name TEXT,
    correcting_the_first_name_6 TEXT,
    correcting_the_fathers_name_8 TEXT,
    correcting_the_grandfathers_name_10 TEXT,
    correcting_the_fourth_name_12 TEXT,
    title_correction_14 TEXT,
    hsbnd_1name_flag TEXT,
    hsbnd_2name_flag TEXT,
    hsbnd_3name_flag TEXT,
    hsbnd_4name_flag TEXT,
    hsbnd_5name_flag TEXT,
    hsbnd_1name_is_valid TEXT,
    hsbnd_2name_is_valid TEXT,
    hsbnd_3name_is_valid TEXT,
    hsbnd_4name_is_valid TEXT,
    hsbnd_5name_is_valid TEXT,
    hsbnd_1name_valid_note TEXT,
    hsbnd_2name_valid_note TEXT,
    hsbnd_3name_valid_note TEXT,
    hsbnd_4name_valid_note TEXT,
    hsbnd_5name_valid_note TEXT,
    reference_under_which_the_name_was_corrected_16 TEXT,
    reference_under_which_the_namepersonal_ID_card_correction_was_made_17 TEXT,
    reference_under_which_the_namefamily_card_correction_was_made_18 TEXT,
    reference_under_which_the_namepassport_correction_was_made_19 TEXT,
    reference_under_which_the_name_correction_was_mademarriage_contract_20 TEXT,
    reference_under_which_the_name_correction_was_madeelectoral_card_21 TEXT,
    reference_under_which_the_name_correction_was_madeQuestionnaire_22 TEXT,
    reference_used_to_correct_the_nameaccording_to_what_the_woman_stated23 TEXT,
    reference_under_which_the_nameseat_number_was_corrected_24 TEXT,
    reference_under_which_the_name_correction_was_madeother_mentions_25 TEXT,
    another_reference_under_which_the_name_was_modified26 TEXT,
    telephone_number TEXT,
    ID_card_type_3 TEXT,
    other_determines TEXT,
    ID_card_number TEXT,
    day_of_signing_the_form TEXT,
    month TEXT,
    the_reason_for_not_joining_the_project_is_stated TEXT,
    other_things_to_mention TEXT,
    do_you_want_to_repackage_the_beneficiary_for_another_educator TEXT,
    please_select_the_alternative_educator TEXT,
    the_name_of_the_new_intellectual TEXT,
    comments TEXT,
    unique_id TEXT,
    curr_bnf_1name_normalized TEXT,
    curr_bnf_2name_normalized TEXT,
    curr_bnf_3name_normalized TEXT,
    curr_bnf_4name_normalized TEXT,
    curr_bnf_5name_normalized TEXT,
    curr_hsbnd_1name_normalized TEXT,
    curr_hsbnd_2name_normalized TEXT,
    curr_hsbnd_3name_normalized TEXT,
    curr_hsbnd_4name_normalized TEXT,
    curr_hsbnd_5name_normalized TEXT,
    bnf_name_normalized TEXT,
    hsbnd_name_normalized TEXT,
    new_bnf_name_normalized TEXT,
    new_hsbnd_name_normalized TEXT,
    correcting_the_first_name_normalized TEXT,
    correcting_the_fathers_name_normalized TEXT,
    correcting_the_grandfathers_name_normalized TEXT,
    correcting_the_fourth_name_normalized TEXT,
    correcting_the_title_normalized TEXT,
    correcting_the_first_name_6_normalized TEXT,
    correcting_the_fathers_name_8_normalized TEXT,
    correcting_the_grandfathers_name_10_normalized TEXT,
    correcting_the_fourth_name_12_normalized TEXT,
    title_correction_14_normalized TEXT,
    diff_per_bnf1 REAL,
    diff_level_bnf1 TEXT,
    diff_per_bnf2 REAL,
    diff_level_bnf2 TEXT,
    diff_per_bnf3 REAL,
    diff_level_bnf3 TEXT,
    diff_per_bnf4 REAL,
    diff_level_bnf4 TEXT,
    diff_per_bnf5 REAL,
    diff_level_bnf5 TEXT,
    diff_per_bnf REAL,
    diff_level_bnf TEXT,
    diff_per_hus1 REAL,
    diff_level_hus1 TEXT,
    diff_per_hus2 REAL,
    diff_level_hus2 TEXT,
    diff_per_hus3 REAL,
    diff_level_hus3 TEXT,
    diff_per_hus4 REAL,
    diff_level_hus4 TEXT,
    diff_per_hus5 REAL,
    diff_level_hus5 TEXT,
    diff_per_hus REAL,
    diff_level_hus TEXT,
    enroll_bnf_sim_score REAL,
    enroll_hsbnd_sim_score REAL,
    enroll_cluster_id TEXT,
    branch_recommendation TEXT,
    HQ_recommendation TEXT,
    enroll_recom TEXT,
    weighted_damerau_score REAL,
    positional_similarity REAL,
    bigram_similarity REAL,
    lcs_ratio REAL,
    length_factor REAL,
    structural_integrity REAL,
    root_factor REAL,
    data JSON
)`;

const sanitizeColumn = (col?: string) => (col ? col.replace(/[^a-zA-Z0-9_]/g, "") : "");
const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};


function initializeDatabase() {
    const db = new Database(getDbPath());
    db.exec(`CREATE TABLE IF NOT EXISTS enrollment_data ${DB_SCHEMA}`);
    return db;
}

export async function POST(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const body = await req.json();
        const { action, projectId, records, uniqueIdCol, uniqueIds, mode } = body;

        if (action === "get_schema") {
            let db: Database.Database | null = null;
            try {
                db = initializeDatabase();
                const tableInfo = db.prepare("PRAGMA table_info(enrollment_data)").all();
                const columns = tableInfo.map((c: any) => c.name);
                return NextResponse.json({ columns });
            } catch (error: any) {
                if (error.code === 'SQLITE_CANTOPEN') {
                  const db = initializeDatabase();
                  const tableInfo = db.prepare("PRAGMA table_info(enrollment_data)").all();
                  const columns = tableInfo.map((c: any) => c.name);
                  db.close();
                  return NextResponse.json({ columns });
                }
                throw error;
            } finally {
                if (db) db.close();
            }
        }

        if (action === "check_duplicates") {
            if (!projectId || !uniqueIdCol || !Array.isArray(uniqueIds)) {
                return NextResponse.json({ error: "Missing parameters for duplicate check." }, { status: 400 });
            }
            let db: Database.Database | null = null;
            try {
                db = new Database(getDbPath(), { fileMustExist: true });
                const sanitizedColumn = sanitizeColumn(uniqueIdCol);
                const tableCols = db.prepare("PRAGMA table_info(enrollment_data)").all().map((c: any) => c.name);
                if (!tableCols.includes(sanitizedColumn)) {
                    return NextResponse.json({ error: `Invalid column: ${uniqueIdCol}` }, { status: 400 });
                }

                let totalCount = 0;
                const chunks = chunkArray(uniqueIds, 900);
                for(const chunk of chunks) {
                    if (chunk.length === 0) continue;
                    const placeholders = chunk.map(() => "?").join(",");
                    const stmt = db.prepare(`SELECT COUNT(*) as count FROM enrollment_data WHERE project_id = ? AND ${sanitizedColumn} IN (${placeholders})`);
                    const result: any = stmt.get(projectId, ...chunk);
                    totalCount += result.count;
                }
                return NextResponse.json({ count: totalCount });
            } catch (error: any) {
                if (error.code === 'SQLITE_CANTOPEN') return NextResponse.json({ count: 0 });
                throw error;
            } finally {
                if (db) db.close();
            }
        }
        
        if (action === "save") {
             if (!projectId || !Array.isArray(records) || !mode || !uniqueIdCol) {
                return NextResponse.json({ error: "Missing parameters for save operation." }, { status: 400 });
            }
            const db = initializeDatabase();
            try {
                 const tableCols = db.prepare("PRAGMA table_info(enrollment_data)").all().map((c: any) => c.name);
                 const sanitizedIdCol = sanitizeColumn(uniqueIdCol);
                 if(!sanitizedIdCol || !tableCols.includes(sanitizedIdCol)) throw new Error("Invalid unique ID column");

                let saved = 0, skipped = 0, updated = 0;
                
                const allRecordKeys = new Set(records.flatMap(r => Object.keys(r)));
                const insertCols = [...allRecordKeys].filter(col => tableCols.includes(col) && col !== 'id');
                const updateCols = insertCols.filter(col => col !== 'id' && col !== sanitizedIdCol);

                const insertStmt = db.prepare(`INSERT INTO enrollment_data (${insertCols.join(", ")}) VALUES (${insertCols.map(c => `@${c}`).join(", ")})`);
                const updateStmt = db.prepare(`UPDATE enrollment_data SET ${updateCols.map(col => `${col} = @${col}`).join(", ")} WHERE project_id = @project_id AND ${sanitizedIdCol} = @${sanitizedIdCol}`);
                const checkStmt = db.prepare(`SELECT id FROM enrollment_data WHERE project_id = ? AND ${sanitizedIdCol} = ?`);

                const transaction = db.transaction(() => {
                    for(const record of records) {
                        const uniqueValue = record[sanitizedIdCol];
                        if (uniqueValue === undefined || uniqueValue === null) {
                            skipped++; continue;
                        }
                        const existing = checkStmt.get(projectId, uniqueValue);

                        const fullRecord = {...record, project_id: projectId};

                        if(existing) {
                            if(mode === 'replace') {
                                const info = updateStmt.run(fullRecord);
                                if(info.changes > 0) updated++;
                            } else {
                                skipped++;
                            }
                        } else {
                           insertStmt.run(fullRecord);
                           saved++;
                        }
                    }
                });
                
                transaction();

                return NextResponse.json({ saved, skipped, updated, total: records.length, mode });

            } finally {
                if(db) db.close();
            }
        }


        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("[ENROLLMENT_API_ERROR]", error);
        return NextResponse.json({ error: "An unexpected error occurred.", details: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = new Database(getDbPath(), { fileMustExist: true });
        const records = db.prepare("SELECT * FROM enrollment_data").all();
        db.close();
        return NextResponse.json(records);
    } catch (error: any) {
        if (error.code === "SQLITE_CANTOPEN") return NextResponse.json([]); // No DB yet, return empty
        console.error("[ENROLLMENT_API_GET_ERROR]", error);
        return NextResponse.json({ error: "Failed to fetch enrollment data.", details: error.message }, { status: 500 });
    }
}
