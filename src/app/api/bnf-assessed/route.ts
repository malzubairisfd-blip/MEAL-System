
// src/app/api/bnf-assessed/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'bnf-assessed.db');

const DB_COLUMNS = ["id", "project_id", "project_name", "Generated_Cluster_ID", "Size", "Flag", "Max_PairScore", "pairScore", "nameScore", "husbandScore", "childrenScore", "idScore", "phoneScore", "locationScore", "groupDecision", "recordDecisions", "decisionReasons", "s", "cluster_id", "dup_cluster_id2", "eq_clusters", "dup_flag2", "new_dup_flag1", "dup_flag", "cluster_size", "dup_cluster_size", "match_probability", "match_weight", "l_id", "l_benef_name", "l_hsbnd_name", "l_child_list", "l_phone_no", "l_id_card_no", "l_age_years", "l_mud_id", "gv_bnf_name", "gv_hsbnd_name", "gv_bnf_hsbnd_name", "gv_n_child_list", "gv_id_card_no", "gv_phone_no", "gv_age_years", "r_id", "r_benef_name", "r_husband_name", "r_child_list", "r_phone_no", "r_id_card_no", "r_age_years", "r_mud_id", "lr_eq_mud", "lr_eq_phone", "lr_age_diff", "lr_benef_name_jw_sim", "lr_husband_name_jw_sim", "lr_benef_name_jaccard", "lr_husband_name_jaccard", "lr_id_card_dist", "lr_child_jaccard", "dup_cluster_size_2", "dup_cluster_id", "dup_cluster_flag", "record_id", "benef_name", "husband_name", "child_list_str", "phone_no", "bnf_id_card_no", "age_years", "gov_name", "mud_name", "hh_ozla_name", "hh_vill_name", "dup_cluster_score", "hh_uuid_dup_cnt", "hh_uuid_rn", "hh_team_name", "hh_srvyr_name", "hh_srvyr_phone_no", "hh_mahlah", "hh_address", "hh_name", "hh_gender", "hh_is_swf", "hh_is_dislocated", "hh_is_dislocated_guest", "child_cnt", "child_m_cnt", "child_f_cnt", "bnf_id", "srvy_hh_id", "bnf_idx", "id_card_type", "bnf_relation", "bnf_relation_label", "bnf_relation_code", "n_child_list_str", "hh_deviceid", "hh_vill_id", "gov_no", "mud_no", "hh_ozla_no", "hh_srvyr_id", "hh_srvyr_team_id", "paper_form_date", "paper_form_no", "hh_qual_women_cnt", "bnf_child_cnt", "bnf_child_m_cnt", "bnf_child_f_cnt", "bnf_social_status", "bnf_qual_status", "bnf_qual_status_desc", "bnf_qual_is_preg", "bnf_qual_is_mother5", "bnf_qual_is_mother_handicaped", "bnf_is_handicaped", "bnf_is_dislocated", "hh_phone_no", "bnf_phone_no", "hh_is_new_instance", "hh_uuid", "hh_submission_time", "hh_submitted_by", "n_hh_name", "child_list2", "child_list_long", "bnf_1name", "bnf_2name", "bnf_3name", "bnf_4name", "bnf_5name", "hsbnd_1name", "hsbnd_2name", "hsbnd_3name", "hsbnd_4name", "hsbnd_5name", "proj_no", "id_card_no", "loc_id", "status", "notes", "flag_2", "cluster_min_score", "cluster_max_score", "cluster_score", "bnf_relations", "hsbnd_relations", "common_child", "common_child_cnt", "relation_score", "same_mud", "same_proj", "office_no", "ser", "benef_id", "is_active", "benef_class_desc", "term_reason", "is_dup_cluster", "dup_woman_id", "dup_benef_id", "reg_form_date", "old_bnf_name", "old_hsbnd_name", "curr_benef_name", "curr_husband_name", "calc_bnf_1name", "calc_bnf_2name", "calc_bnf_3name", "calc_bnf_4name", "calc_bnf_5name", "calc_hsbnd_1name", "calc_hsbnd_2name", "calc_hsbnd_3name", "calc_hsbnd_4name", "calc_hsbnd_5name", "cbnf_name", "chsbnd_name", "n_child_list", "b_1name", "b_2name", "b_3name", "b_4name", "b_5name", "h_1name", "h_2name", "h_3name", "h_4name", "h_5name", "child_list", "bnf_name_2", "hsbnd_name_2", "bnf_name2", "bnf_name2b", "bnf_name2c", "bnf_name3", "bnf_name3b", "bnf_name3c", "bnf_name3d", "bnf_name4", "bnf_name4c", "bnf_name4b", "bnf_f_name4", "bnf_f_name3", "bnf_f_name3c", "hsbnd_name2", "hsbnd_name2b", "hsbnd_name2c", "hsbnd_name3", "hsbnd_name3b", "hsbnd_name3c", "hsbnd_name3d", "hsbnd_name4", "hsbnd_name4c", "hsbnd_name4b", "hsbnd_f_name4", "hsbnd_f_name3", "hsbnd_f_name3c", "bnf_name_list", "hsbnd_name_list", "dup_cluster_id2_2", "c_max_weight", "c_min_weight", "c_id_max_weight", "c_id_min_weight", "c_max_pct", "c_min_pct", "c_id_max_pct", "c_id_min_pct", "c_min_proj", "c_max_proj", "c_proj2_cnt", "c_mud2_cnt", "c_id_min_proj", "c_id_max_proj", "c_id_proj2_cnt", "c_id_mud2_cnt", 'womanName', 'husbandName', 'nationalId', 'phone', 'village', 'subdistrict', 'children', 'beneficiaryId', 'avgPairScore', 'avgFirstNameScore', 'avgFamilyNameScore', 'avgAdvancedNameScore', 'avgTokenReorderScore', 'reasons', 'confidenceScore', 'avgWomanNameScore', 'avgHusbandNameScore', 'avgFinalScore', "pre_classified_result", "group_analysis", "womanName_normalized", "husbandName_normalized", "children_normalized", "subdistrict_normalized", "village_normalized", "parts", "husbandParts", 'diff_per__bnf1', 'diff_per__bnf2', 'diff_per__bnf3', 'diff_per__bnf4', 'diff_per__bnf5', 'diff_per__bnf', 'diff_per__hus1', 'diff_per__hus2', 'diff_per__hus3', 'diff_per__hus4', 'diff_per__hus5', 'diff_per__hus', "internalId", "data"];

function initializeDatabase() {
    const db = new Database(getDbPath());
    
    // Dynamically create columns definition from the master list
    const columnsDef = DB_COLUMNS.map(colName => {
        if (colName === 'id') return 'id INTEGER PRIMARY KEY AUTOINCREMENT';
        
        const upperCaseCol = colName.toUpperCase();
        if (upperCaseCol.includes('SCORE') || upperCaseCol.includes('AVG') || upperCaseCol.includes('REAL') || upperCaseCol.includes('WEIGHT') || upperCaseCol.includes('PCT') || upperCaseCol.includes('SIM')) return `${colName} REAL`;
        if (upperCaseCol.includes('SIZE') || upperCaseCol.includes('INTEGER') || upperCaseCol.includes('CNT')) return `${colName} INTEGER`;

        // Default to TEXT
        return `${colName} TEXT`;
    }).join(', \n');

    const createTableStmt = `CREATE TABLE IF NOT EXISTS assessed_data (${columnsDef});`;
    db.exec(createTableStmt);
    
    return db;
}


export async function POST(req: Request) {
    const body = await req.json();
    const { action, projectId, records, uniqueIdCol, uniqueIds, mode, uniqueIdDbCol, columnName, columnType } = body;

    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        
        if (action === 'check_duplicates') {
            if (!projectId || !uniqueIdCol || !Array.isArray(uniqueIds)) {
                 return NextResponse.json({ error: "Missing parameters for duplicate check" }, { status: 400 });
            }
            try {
                const db = new Database(getDbPath(), { fileMustExist: true });
                const tableCols = db.prepare('PRAGMA table_info(assessed_data)').all().map((c: any) => c.name);
                if (!tableCols.includes(uniqueIdCol)) {
                    db.close();
                    return NextResponse.json({ error: `Invalid unique ID column: ${uniqueIdCol}` }, { status: 400 });
                }
                const placeholders = uniqueIds.map(() => '?').join(',');
                const stmt = db.prepare(`SELECT COUNT(*) as count FROM assessed_data WHERE project_id = ? AND ${uniqueIdCol} IN (${placeholders})`);
                const result = stmt.get(projectId, ...uniqueIds);
                db.close();
                return NextResponse.json({ count: result.count });
            } catch (error: any) {
                 if (error.code === 'SQLITE_CANTOPEN') {
                    // DB doesn't exist, so no duplicates.
                    return NextResponse.json({ count: 0 });
                }
                throw error;
            }
        } else if (action === 'add_column') {
            if (!columnName || !columnType) {
                return NextResponse.json({ error: "Missing columnName or columnType" }, { status: 400 });
            }

            const sanitizedColumnName = columnName.replace(/[^a-zA-Z0-9_]/g, '');
            if (sanitizedColumnName !== columnName || sanitizedColumnName.length === 0) {
                return NextResponse.json({ error: "Invalid column name. Only alphanumeric characters and underscores are allowed." }, { status: 400 });
            }

            const allowedTypes = ['TEXT', 'INTEGER', 'REAL', 'JSON'];
            if (!allowedTypes.includes(columnType.toUpperCase())) {
                return NextResponse.json({ error: `Invalid column type. Must be one of: ${allowedTypes.join(', ')}` }, { status: 400 });
            }

            const db = new Database(getDbPath());
            try {
                db.exec(`ALTER TABLE assessed_data ADD COLUMN "${sanitizedColumnName}" ${columnType.toUpperCase()}`);
                db.close();
                return NextResponse.json({ message: `Column '${sanitizedColumnName}' added successfully.` });
            } catch (dbError: any) {
                db.close();
                return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 });
            }
        } else if (action === 'save') {
             if (!projectId || !Array.isArray(records) || !mode) {
                return NextResponse.json({ error: "Missing parameters for save action" }, { status: 400 });
             }

             const db = initializeDatabase();
             const tableCols = db.prepare('PRAGMA table_info(assessed_data)').all().map((c: any) => c.name);

            let recordsToInsert = records;
            let skippedCount = 0;

            if (mode === 'replace') {
                if (!uniqueIdDbCol) {
                    db.close();
                    return NextResponse.json({ error: "uniqueIdDbCol is required for replace mode" }, { status: 400 });
                }
                const idsToDelete = records.map(r => r[uniqueIdDbCol]).filter(Boolean);
                if (idsToDelete.length > 0) {
                    const placeholders = idsToDelete.map(() => '?').join(',');
                    const deleteStmt = db.prepare(`DELETE FROM assessed_data WHERE project_id = ? AND ${uniqueIdDbCol} IN (${placeholders})`);
                    deleteStmt.run(projectId, ...idsToDelete);
                }
            } else if (mode === 'skip') {
                if (!uniqueIdDbCol) {
                    db.close();
                    return NextResponse.json({ error: "Invalid unique ID column for skip mode" }, { status: 400 });
                }
                 try {
                    const getExistingIdsStmt = db.prepare(`SELECT ${uniqueIdDbCol} FROM assessed_data WHERE project_id = ?`);
                    const existingIds = new Set(getExistingIdsStmt.all(projectId).map((r: any) => String(r[uniqueIdDbCol])));
                    recordsToInsert = records.filter((r:any) => !existingIds.has(String(r[uniqueIdDbCol])));
                    skippedCount = records.length - recordsToInsert.length;
                 } catch (e: any) {
                    // Ignore if table doesn't exist yet, just insert all.
                 }
            }
             
             const columnsInPayload = Object.keys(records[0] || {});
             const insertColumns = columnsInPayload.filter(col => tableCols.includes(col) && col !== 'id');

             if (insertColumns.length > 0) {
                 const columnsString = insertColumns.join(', ');
                 const placeholders = insertColumns.map(() => '?').join(', ');
                 const insert = db.prepare(`INSERT INTO assessed_data (${columnsString}) VALUES (${placeholders})`);
                 
                 const insertMany = db.transaction((recs) => {
                     for (const record of recs) {
                         const values = insertColumns.map(col => record[col] ?? null);
                         insert.run(...values);
                     }
                 });

                if (recordsToInsert.length > 0) {
                    insertMany(recordsToInsert);
                }
            }
             
             db.close();
             return NextResponse.json({ message: "Data saved successfully.", saved: recordsToInsert.length, skipped: skippedCount, total: records.length });
        }

        // Default behavior for other POSTs (if any) or fall through
        return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });


    } catch (error: any) {
        console.error("[BNF_ASSESSED_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to process request.", details: error.message }, { status: 500 });
    }
}


export async function GET(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = new Database(getDbPath(), { fileMustExist: true });
        
        const stmt = db.prepare('SELECT * FROM assessed_data');
        const rows = stmt.all();
        
        db.close();

        return NextResponse.json(rows);

    } catch (error: any) {
        if (error.code === 'SQLITE_CANTOPEN') {
            // If the database doesn't exist, return an empty array, which is expected.
            return NextResponse.json([]);
        }
        console.error("[BNF_ASSESSED_API_GET_ERROR]", error);
        return NextResponse.json({ error: "Failed to fetch assessed data.", details: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const recordsToUpdate = await req.json();
        if (!Array.isArray(recordsToUpdate) || recordsToUpdate.length === 0) {
            return NextResponse.json({ error: "Invalid payload. Expected an array of records to update." }, { status: 400 });
        }
        
        const db = new Database(getDbPath());
        const tableCols = db.prepare('PRAGMA table_info(assessed_data)').all().map((c: any) => c.name);

        const updateRecord = (record: any) => {
            if (!record.id) return; 
            
            const columnsToUpdate = Object.keys(record).filter(col => tableCols.includes(col) && col !== 'id');
            if (columnsToUpdate.length === 0) return;

            const setClause = columnsToUpdate.map(col => `${col} = ?`).join(', ');
            const values = columnsToUpdate.map(col => record[col]);
            values.push(record.id);

            const stmt = db.prepare(`UPDATE assessed_data SET ${setClause} WHERE id = ?`);
            stmt.run(...values);
        };
        
        const updateMany = db.transaction((records) => {
            for (const record of records) {
                updateRecord(record);
            }
        });

        updateMany(recordsToUpdate);
        db.close();

        return NextResponse.json({ message: `${recordsToUpdate.length} beneficiary records updated successfully.` });

    } catch (error: any) {
        console.error("[BNF_ASSESSED_PUT_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to update beneficiary data.", details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "Invalid payload. Expected an array of record IDs to delete." }, { status: 400 });
        }
        
        const db = new Database(getDbPath());
        
        const placeholders = ids.map(() => '?').join(',');
        const stmt = db.prepare(`DELETE FROM assessed_data WHERE id IN (${placeholders})`);
        
        const transaction = db.transaction((idArray) => {
            const info = stmt.run(...idArray);
            return info.changes;
        });

        const changes = transaction(ids);
        db.close();

        if (changes === 0) {
            return NextResponse.json({ message: "No matching records found to delete." }, { status: 404 });
        }

        return NextResponse.json({ message: `${changes} records deleted successfully.` });

    } catch (error: any) {
        console.error("[BNF_ASSESSED_DELETE_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to delete records.", details: error.message }, { status: 500 });
    }
}
