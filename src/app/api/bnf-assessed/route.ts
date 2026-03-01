
// src/app/api/bnf-assessed/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-assessed.db");


const DB_COLUMNS_FOR_CREATION = `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    project_name TEXT,
    Generated_Cluster_ID TEXT,
    Size INTEGER,
    Flag TEXT,
    Max_PairScore REAL,
    pairScore REAL,
    nameScore REAL,
    husbandScore REAL,
    childrenScore REAL,
    idScore REAL,
    phoneScore REAL,
    locationScore REAL,
    groupDecision TEXT,
    recordDecisions TEXT,
    decisionReasons TEXT,
    s TEXT,
    cluster_id TEXT,
    dup_cluster_id2 TEXT,
    eq_clusters TEXT,
    dup_flag2 TEXT,
    new_dup_flag1 TEXT,
    dup_flag TEXT,
    cluster_size INTEGER,
    dup_cluster_size INTEGER,
    match_probability REAL,
    match_weight REAL,
    l_id TEXT,
    l_benef_name TEXT,
    l_hsbnd_name TEXT,
    l_child_list TEXT,
    l_phone_no TEXT,
    l_id_card_no TEXT,
    l_age_years INTEGER,
    l_mud_id TEXT,
    gv_bnf_name TEXT,
    gv_hsbnd_name TEXT,
    gv_bnf_hsbnd_name TEXT,
    gv_n_child_list TEXT,
    gv_id_card_no TEXT,
    gv_phone_no TEXT,
    gv_age_years INTEGER,
    r_id TEXT,
    r_benef_name TEXT,
    r_husband_name TEXT,
    r_child_list TEXT,
    r_phone_no TEXT,
    r_id_card_no TEXT,
    r_age_years INTEGER,
    r_mud_id TEXT,
    lr_eq_mud TEXT,
    lr_eq_phone TEXT,
    lr_age_diff INTEGER,
    lr_benef_name_jw_sim REAL,
    lr_husband_name_jw_sim REAL,
    lr_benef_name_jaccard REAL,
    lr_husband_name_jaccard REAL,
    lr_id_card_dist REAL,
    lr_child_jaccard REAL,
    dup_cluster_size_2 INTEGER,
    dup_cluster_id TEXT,
    dup_cluster_flag TEXT,
    record_id TEXT,
    benef_name TEXT,
    husband_name TEXT,
    child_list_str TEXT,
    phone_no TEXT,
    bnf_id_card_no TEXT,
    age_years INTEGER,
    gov_name TEXT,
    mud_name TEXT,
    hh_ozla_name TEXT,
    hh_vill_name TEXT,
    dup_cluster_score REAL,
    hh_uuid_dup_cnt INTEGER,
    hh_uuid_rn TEXT,
    hh_team_name TEXT,
    hh_srvyr_name TEXT,
    hh_srvyr_phone_no TEXT,
    hh_mahlah TEXT,
    hh_address TEXT,
    hh_name TEXT,
    hh_gender TEXT,
    hh_is_swf TEXT,
    hh_is_dislocated TEXT,
    hh_is_dislocated_guest TEXT,
    child_cnt INTEGER,
    child_m_cnt INTEGER,
    child_f_cnt INTEGER,
    bnf_id TEXT,
    srvy_hh_id TEXT,
    bnf_idx INTEGER,
    id_card_type TEXT,
    bnf_relation TEXT,
    bnf_relation_label TEXT,
    bnf_relation_code TEXT,
    n_child_list_str TEXT,
    hh_deviceid TEXT,
    hh_vill_id TEXT,
    gov_no TEXT,
    mud_no TEXT,
    hh_ozla_no TEXT,
    hh_srvyr_id TEXT,
    hh_srvyr_team_id TEXT,
    paper_form_date TEXT,
    paper_form_no TEXT,
    hh_qual_women_cnt INTEGER,
    bnf_child_cnt INTEGER,
    bnf_child_m_cnt INTEGER,
    bnf_child_f_cnt INTEGER,
    bnf_social_status TEXT,
    bnf_qual_status TEXT,
    bnf_qual_status_desc TEXT,
    bnf_qual_is_preg TEXT,
    bnf_qual_is_mother5 TEXT,
    bnf_qual_is_mother_handicaped TEXT,
    bnf_is_handicaped TEXT,
    bnf_is_dislocated TEXT,
    hh_phone_no TEXT,
    bnf_phone_no TEXT,
    hh_is_new_instance TEXT,
    hh_uuid TEXT,
    hh_submission_time TEXT,
    hh_submitted_by TEXT,
    n_hh_name TEXT,
    child_list2 TEXT,
    child_list_long TEXT,
    bnf_1name TEXT,
    bnf_2name TEXT,
    bnf_3name TEXT,
    bnf_4name TEXT,
    bnf_5name TEXT,
    hsbnd_1name TEXT,
    hsbnd_2name TEXT,
    hsbnd_3name TEXT,
    hsbnd_4name TEXT,
    hsbnd_5name TEXT,
    proj_no TEXT,
    id_card_no TEXT,
    loc_id TEXT,
    status TEXT,
    notes TEXT,
    flag_2 TEXT,
    cluster_min_score REAL,
    cluster_max_score REAL,
    cluster_score REAL,
    bnf_relations TEXT,
    hsbnd_relations TEXT,
    common_child TEXT,
    common_child_cnt INTEGER,
    relation_score REAL,
    same_mud TEXT,
    same_proj TEXT,
    office_no TEXT,
    ser TEXT,
    benef_id TEXT,
    is_active TEXT,
    benef_class_desc TEXT,
    term_reason TEXT,
    is_dup_cluster TEXT,
    dup_woman_id TEXT,
    dup_benef_id TEXT,
    reg_form_date TEXT,
    old_bnf_name TEXT,
    old_hsbnd_name TEXT,
    curr_benef_name TEXT,
    curr_husband_name TEXT,
    calc_bnf_1name TEXT,
    calc_bnf_2name TEXT,
    calc_bnf_3name TEXT,
    calc_bnf_4name TEXT,
    calc_bnf_5name TEXT,
    calc_hsbnd_1name TEXT,
    calc_hsbnd_2name TEXT,
    calc_hsbnd_3name TEXT,
    calc_hsbnd_4name TEXT,
    calc_hsbnd_5name TEXT,
    cbnf_name TEXT,
    chsbnd_name TEXT,
    n_child_list TEXT,
    b_1name TEXT,
    b_2name TEXT,
    b_3name TEXT,
    b_4name TEXT,
    b_5name TEXT,
    h_1name TEXT,
    h_2name TEXT,
    h_3name TEXT,
    h_4name TEXT,
    h_5name TEXT,
    child_list TEXT,
    bnf_name_2 TEXT,
    hsbnd_name_2 TEXT,
    bnf_name2 TEXT,
    bnf_name2b TEXT,
    bnf_name2c TEXT,
    bnf_name3 TEXT,
    bnf_name3b TEXT,
    bnf_name3c TEXT,
    bnf_name3d TEXT,
    bnf_name4 TEXT,
    bnf_name4c TEXT,
    bnf_name4b TEXT,
    bnf_f_name4 TEXT,
    bnf_f_name3 TEXT,
    bnf_f_name3c TEXT,
    hsbnd_name2 TEXT,
    hsbnd_name2b TEXT,
    hsbnd_name2c TEXT,
    hsbnd_name3 TEXT,
    hsbnd_name3b TEXT,
    hsbnd_name3c TEXT,
    hsbnd_name3d TEXT,
    hsbnd_name4 TEXT,
    hsbnd_name4c TEXT,
    hsbnd_name4b TEXT,
    hsbnd_f_name4 TEXT,
    hsbnd_f_name3 TEXT,
    hsbnd_f_name3c TEXT,
    bnf_name_list TEXT,
    hsbnd_name_list TEXT,
    dup_cluster_id2_2 TEXT,
    c_max_weight REAL,
    c_min_weight REAL,
    c_id_max_weight REAL,
    c_id_min_weight REAL,
    c_max_pct REAL,
    c_min_pct REAL,
    c_id_max_pct REAL,
    c_id_min_pct REAL,
    c_min_proj REAL,
    c_max_proj REAL,
    c_proj2_cnt INTEGER,
    c_mud2_cnt INTEGER,
    c_id_min_proj REAL,
    c_id_max_proj REAL,
    c_id_proj2_cnt INTEGER,
    c_id_mud2_cnt INTEGER,
    womanName TEXT,
    husbandName TEXT,
    nationalId INTEGER,
    phone INTEGER,
    village TEXT,
    subdistrict TEXT,
    children TEXT,
    beneficiaryId TEXT,
    avgPairScore REAL,
    avgFirstNameScore REAL,
    avgFamilyNameScore REAL,
    avgAdvancedNameScore REAL,
    avgTokenReorderScore REAL,
    reasons TEXT,
    confidenceScore REAL,
    avgWomanNameScore REAL,
    avgHusbandNameScore REAL,
    avgFinalScore REAL,
    pre_classified_result TEXT,
    group_analysis TEXT,
    womanName_normalized TEXT,
    husbandName_normalized TEXT,
    children_normalized TEXT,
    subdistrict_normalized TEXT,
    village_normalized TEXT,
    parts TEXT,
    husbandParts TEXT,
    ED_NO TEXT,
    ED_ID TEXT,
    EC_ID TEXT,
    PC_ID TEXT,
    ED_NAME TEXT,
    EC_NAME TEXT,
    PC_NAME TEXT,
    SRVY_HH_ID_2 TEXT,
    CANDID_SER_NO TEXT,
    WOMAN_ID TEXT,
    source_ID_2 TEXT,
    BENEF_ID_2 TEXT,
    BENEF_NO TEXT,
    HH_NAME_2 TEXT,
    BNF_RELATION_2 TEXT,
    BENEF_NAME_3 TEXT,
    HUSBAND_NAME_3 TEXT,
    IS_ACTIVE_2 TEXT,
    STATUS_2 TEXT,
    QUAL_STATUS TEXT,
    STATUS_DESC TEXT,
    QUAL_STATUS_DESC TEXT,
    VERIFY_STATUS TEXT,
    VERIFY_NOTES TEXT,
    VERIFY_REASON TEXT,
    VERIFY_DATE TEXT,
    REG_STATUS TEXT,
    REG_FORM_DATE_2 TEXT,
    REG_NOTES TEXT,
    TOTAL_CHILD_COUNT INTEGER,
    MALE_CHILD_COUNT INTEGER,
    FEMALE_CHILD_COUNT INTEGER,
    LOC_ID_2 TEXT,
    LOC_NAME TEXT,
    ID_CARD_TYPE_2 TEXT,
    ID_CARD_TYPE_DESC TEXT,
    ID_CARD_NO_2 TEXT,
    AGE_YEARS_2 INTEGER,
    ADDRESS TEXT,
    PHONE_NO_2 TEXT,
    IS_TERMINATED TEXT,
    TERM_DATE TEXT,
    TERM_REASON_2 TEXT,
    TERM_NOTES TEXT,
    NOTES_2 TEXT,
    PC_FAC_ID TEXT,
    EC_FAC_ID TEXT,
    BENEF_CLASS TEXT,
    BENEF_CLASS_DESC_2 TEXT,
    OLD_BNF_NAME_2 TEXT,
    OLD_HSBND_NAME_2 TEXT,
    OLD_PHONE_NO TEXT,
    OLD_ID_CARD_NO TEXT,
    enrollment_modification_type TEXT,
    eligible_woman_modify_type TEXT,
    eligible_woman_name_correction TEXT,
    eligible_woman_phone_correction TEXT,
    eligible_woman_ID_correction TEXT,
    eligible_woman_husband_name_correction TEXT,
    pregnancy_month INTEGER,
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
    diff_per__bnf1 REAL,
    diff_level_bnf1 TEXT,
    diff_per__bnf2 REAL,
    diff_level_bnf2 TEXT,
    diff_per__bnf3 REAL,
    diff_level_bnf3 TEXT,
    diff_per__bnf4 REAL,
    diff_level__bnf4 TEXT,
    diff_per__bnf5 REAL,
    diff_level__bnf5 TEXT,
    diff_per__bnf REAL,
    diff_level__bnf TEXT,
    diff_per__hus1 REAL,
    diff_level__hus1 TEXT,
    diff_per__hus2 REAL,
    diff_level__hus2 TEXT,
    diff_per__hus3 REAL,
    diff_level__hus3 TEXT,
    diff_per__hus4 REAL,
    diff_level__hus4 TEXT,
    diff_per__hus5 REAL,
    diff_level__hus5 TEXT,
    diff_per__hus REAL,
    diff_level__hus TEXT,
    enroll_sim_score TEXT,
    enroll_cluster_id TEXT,
    branch_recommendation TEXT,
    HQ_recommendation TEXT,
    enroll_recom TEXT,
    weighted_damerau_score REAL,
    positional_similarity REAL,
    bigram_similarity REAL,
    lcs_ratio REAL,
    length_factor REAL,
    structural_integrity TEXT,
    root_factor TEXT,
    internalId TEXT,
    data JSON
)`;

const columnDefs = DB_COLUMNS_FOR_CREATION.replace(/^\(|\)$/g, "") // remove parentheses
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const columnTypeMap = new Map<string, string>();
const DB_COLUMNS = columnDefs.map(def => {
    const parts = def.split(/\s+/);
    const name = parts[0].replace(/"/g, "");
    const type = parts[1] || 'TEXT';
    columnTypeMap.set(name, type);
    return name;
});


const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS assessed_data ${DB_COLUMNS_FOR_CREATION};`);
  
  // --- Dynamic Column Addition ---
  const tableCols = db.prepare("PRAGMA table_info(assessed_data)").all().map((c: any) => c.name);
  
  DB_COLUMNS.forEach(colName => {
    if (!tableCols.includes(colName)) {
      try {
        const type = columnTypeMap.get(colName) || 'TEXT'; // Get type or default to TEXT
        db.exec(`ALTER TABLE assessed_data ADD COLUMN "${colName}" ${type}`);
        console.log(`Added missing column: ${colName} with type ${type}`);
      } catch (error) {
        // This might fail if another process adds the column concurrently, which is fine.
        console.warn(`Could not add column ${colName}:`, error);
      }
    }
  });

  try {
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_project_internal ON assessed_data (project_id, internalId);`);
  } catch (error) {
      console.warn('Could not create unique index, it might already exist.', error);
  }

  return db;
}


const sanitizeColumn = (col?: string) => (col ? col.replace(/[^a-zA-Z0-9_]/g, "") : "");

export async function POST(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const body = await req.json();
    const { action, projectId, records, uniqueIdCol, uniqueIds, mode } = body;

    if (action === "get_schema") {
      let dbInstance: Database.Database | null = null;
      try {
        dbInstance = initializeDatabase();
        const tableInfo = dbInstance.prepare("PRAGMA table_info(assessed_data)").all();
        const columns = tableInfo.map((c: any) => c.name);
        return NextResponse.json({ columns });
      } catch (error: any) {
        if (error.code === "SQLITE_CANTOPEN") {
          const dbFallback = initializeDatabase();
          const tableInfo = dbFallback.prepare("PRAGMA table_info(assessed_data)").all();
          const columns = tableInfo.map((c: any) => c.name);
          dbFallback.close();
          return NextResponse.json({ columns });
        }
        throw error;
      } finally {
        if (dbInstance) dbInstance.close();
      }
    }

    if (action === "check_duplicates") {
      if (!projectId || !uniqueIdCol || !Array.isArray(uniqueIds)) {
        return NextResponse.json({ error: "Missing parameters for duplicate check." }, { status: 400 });
      }
      let dbInstance: Database.Database | null = null;
      try {
        dbInstance = new Database(getDbPath(), { fileMustExist: true });
        const sanitizedColumn = sanitizeColumn(uniqueIdCol);
        const tableCols = dbInstance.prepare("PRAGMA table_info(assessed_data)").all().map((c: any) => c.name);
        if (!tableCols.includes(sanitizedColumn)) {
          return NextResponse.json({ error: `Invalid column: ${uniqueIdCol}` }, { status: 400 });
        }

        const existingIds = new Set<string>();
        const chunks = chunkArray(uniqueIds.map(String), 900);
        
        for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          const placeholders = chunk.map(() => "?").join(",");
          const stmt = dbInstance.prepare(
            `SELECT "${sanitizedColumn}" FROM assessed_data WHERE project_id = ? AND "${sanitizedColumn}" IN (${placeholders})`
          );
          const results: any[] = stmt.all(projectId, ...chunk);
          results.forEach((row) => {
            const value = row[sanitizedColumn];
            if (value !== undefined && value !== null) {
              existingIds.add(String(value));
            }
          });
        }
        
        const tableTotalResult = dbInstance.prepare("SELECT COUNT(*) as total FROM assessed_data WHERE project_id = ?").get(projectId) as {total: number} | undefined;
        const totalInDb = tableTotalResult?.total || 0;

        return NextResponse.json({ count: existingIds.size, totalInDb, duplicateIds: Array.from(existingIds) });
      } catch (error: any) {
        if (error.code === "SQLITE_CANTOPEN") return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
        throw error;
      } finally {
        if (dbInstance) dbInstance.close();
      }
    }

    if (action === "save") {
      if (!projectId || !Array.isArray(records) || !mode || !uniqueIdCol) {
        return NextResponse.json({ error: "Missing parameters for save." }, { status: 400 });
      }

      const db = initializeDatabase();
      try {
        const tableCols = db.prepare("PRAGMA table_info(assessed_data)").all().map((c: any) => c.name);
        const sanitizedIdCol = sanitizeColumn(uniqueIdCol);
        if (!sanitizedIdCol || !tableCols.includes(sanitizedIdCol)) throw new Error("Invalid unique ID column");

        let saved = 0;
        let skipped = 0;
        let updated = 0;

        const allRecordKeys = new Set(records.flatMap((r) => Object.keys(r)));
        const insertCols = [...allRecordKeys].filter((col) => tableCols.includes(col) && col !== "id");
        const updateCols = insertCols.filter((col) => col !== "id" && col !== sanitizedIdCol && col !== "project_id");

        const insertStmt = db.prepare(
          `INSERT INTO assessed_data (${insertCols.join(", ")}) VALUES (${insertCols.map((c) => `@${c}`).join(", ")})`
        );
        const updateStmt = db.prepare(
          `UPDATE assessed_data SET ${updateCols.map((col) => `${col} = @${col}`).join(", ")} WHERE project_id = @project_id AND ${sanitizedIdCol} = @${sanitizedIdCol}`
        );
        const checkStmt = db.prepare(`SELECT id FROM assessed_data WHERE project_id = ? AND ${sanitizedIdCol} = ?`);

        const transaction = db.transaction(() => {
          for (const record of records) {
            const uniqueValue = record[sanitizedIdCol];
            if (uniqueValue === undefined || uniqueValue === null) {
              skipped++;
              continue;
            }

            const existing = checkStmt.get(projectId, String(uniqueValue));
            
            const fullRecord: Record<string, any> = { project_id: projectId };
            insertCols.forEach((col) => {
              fullRecord[col] = record.hasOwnProperty(col) ? record[col] : null;
            });
            fullRecord[sanitizedIdCol] = String(uniqueValue);


            if (existing) {
              if (mode === "replace") {
                const updatePayload: Record<string, any> = { project_id: projectId, [sanitizedIdCol]: String(uniqueValue) };
                 updateCols.forEach(col => {
                    updatePayload[col] = record.hasOwnProperty(col) ? record[col] : null;
                });
                const info = updateStmt.run(updatePayload);
                if (info.changes > 0) updated++;
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
        if (db) db.close();
      }
    }

    if (action === "update") {
      if (!projectId || !Array.isArray(records)) {
        return NextResponse.json({ error: "Missing parameters for update" }, { status: 400 });
      }
      const db = initializeDatabase();
      try {
        const tableCols = db.prepare("PRAGMA table_info(assessed_data)").all().map((c: any) => c.name);

        let updatedCount = 0;
        const transaction = db.transaction((recordsToUpdate) => {
          for (const record of recordsToUpdate) {
            if(!record.beneficiaryId) continue;
            
            const colsToUpdate = Object.keys(record).filter(col => tableCols.includes(col) && col !== 'id' && col !== 'beneficiaryId' && col !== 'project_id');
            if(colsToUpdate.length === 0) continue;
            
            const setClause = colsToUpdate.map(col => `${col} = @${col}`).join(", ");
            const stmt = db.prepare(
                `UPDATE assessed_data SET ${setClause} WHERE project_id = @project_id AND beneficiaryId = @beneficiaryId`
              );
            
            const info = stmt.run({ ...record, project_id: projectId });
            if (info.changes > 0) {
                updatedCount++;
            }
          }
        });
        
        transaction(records);
        
        return NextResponse.json({ updated: updatedCount });

      } finally {
        db.close();
      }
    }


    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[BNF_ASSESSED_API_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process request.", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath(), { fileMustExist: true });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    let records;
    if (projectId && projectId !== 'all') {
      records = db.prepare("SELECT * FROM assessed_data WHERE project_id = ?").all(projectId);
    } else {
      records = db.prepare("SELECT * FROM assessed_data").all();
    }
    
    db.close();
    return NextResponse.json(records);
  } catch (error: any) {
    if (error.code === "SQLITE_CANTOPEN") return NextResponse.json([]);
    return NextResponse.json({ error: "Failed to fetch assessed data.", details: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const recordsToUpdate = await req.json();
    if (!Array.isArray(recordsToUpdate) || recordsToUpdate.length === 0) {
      return NextResponse.json({ error: "Expected an array of records" }, { status: 400 });
    }
    const db = new Database(getDbPath());
    try {
      const tableCols = db.prepare("PRAGMA table_info(assessed_data)").all().map((c: any) => c.name);
      db.transaction((records) => {
        for (const record of records) {
          if (!record.id) continue;
          const colsToUpdate = Object.keys(record).filter((col) => tableCols.includes(col) && col !== "id");
          if (!colsToUpdate.length) continue;
          const setClause = colsToUpdate.map((col) => `${col} = ?`).join(", ");
          const values = colsToUpdate.map((col) => record[col]);
          values.push(record.id);
          db.prepare(`UPDATE assessed_data SET ${setClause} WHERE id = ?`).run(...values);
        }
      })(recordsToUpdate);
      return NextResponse.json({ message: "Updated successfully" });
    } finally {
      db.close();
    }
  } catch (error: any) {
    console.error("[BNF_ASSESSED_PUT_API_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update beneficiary data.", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: "Expected ids array" }, { status: 400 });
    }
    const db = new Database(getDbPath());
    try {
      const chunks = chunkArray(ids, 900);
      let deleted = 0;
      for (const chunk of chunks) {
        const placeholders = chunk.map(() => "?").join(",");
        const info = db.prepare(`DELETE FROM assessed_data WHERE id IN (${placeholders})`).run(...chunk);
        deleted += info.changes;
      }
      return NextResponse.json({ message: "Deleted successfully", count: deleted });
    } finally {
      db.close();
    }
  } catch (error: any) {
    console.error("[BNF_ASSESSED_DELETE_API_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete records.", details: error.message },
      { status: 500 }
    );
  }
}
