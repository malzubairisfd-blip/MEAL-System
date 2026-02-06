// src/app/api/bnf-assessed/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'bnf-assessed.db');

const DB_COLUMNS = [
    "id", "project_id", "project_name", "Generated_Cluster_ID", "Size", "Flag", "Max_PairScore", 
    "pairScore", "nameScore", "husbandScore", "childrenScore", "idScore", "phoneScore", 
    "locationScore", "groupDecision", "recordDecision", "decisionReason", "s", "cluster_id", 
    "dup_cluster_id2", "eq_clusters", "dup_flag2", "new_dup_flag1", "dup_flag", "cluster_size", 
    "dup_cluster_size", "match_probability", "match_weight", "l_id", "l_benef_name", "l_hsbnd_name", 
    "l_child_list", "l_phone_no", "l_id_card_no", "l_age_years", "l_mud_id", "gv_bnf_name", 
    "gv_hsbnd_name", "gv_bnf_hsbnd_name", "gv_n_child_list", "gv_id_card_no", "gv_phone_no", 
    "gv_age_years", "r_id", "r_benef_name", "r_husband_name", "r_child_list", "r_phone_no", 
    "r_id_card_no", "r_age_years", "r_mud_id", "lr_eq_mud", "lr_eq_phone", "lr_age_diff", 
    "lr_benef_name_jw_sim", "lr_husband_name_jw_sim", "lr_benef_name_jaccard", 
    "lr_husband_name_jaccard", "lr_id_card_dist", "lr_child_jaccard", "dup_cluster_size_2", 
    "dup_cluster_id", "dup_cluster_flag", "record_id", "benef_name", "husband_name", 
    "child_list_str", "phone_no", "bnf_id_card_no", "age_years", "gov_name", "mud_name", 
    "hh_ozla_name", "hh_vill_name", "dup_cluster_score", "hh_uuid_dup_cnt", "hh_uuid_rn", 
    "hh_team_name", "hh_srvyr_name", "hh_srvyr_phone_no", "hh_mahlah", "hh_address", 
    "hh_name", "hh_gender", "hh_is_swf", "hh_is_dislocated", "hh_is_dislocated_guest", 
    "child_cnt", "child_m_cnt", "child_f_cnt", "bnf_id", "srvy_hh_id", "bnf_idx", "id_card_type", 
    "bnf_relation", "bnf_relation_label", "bnf_relation_code", "n_child_list_str", "hh_deviceid", 
    "hh_vill_id", "gov_no", "mud_no", "hh_ozla_no", "hh_srvyr_id", "hh_srvyr_team_id", 
    "paper_form_date", "paper_form_no", "hh_qual_women_cnt", "bnf_child_cnt", "bnf_child_m_cnt", 
    "bnf_child_f_cnt", "bnf_social_status", "bnf_qual_status", "bnf_qual_status_desc", 
    "bnf_qual_is_preg", "bnf_qual_is_mother5", "bnf_qual_is_mother_handicaped", 
    "bnf_is_handicaped", "bnf_is_dislocated", "hh_phone_no", "bnf_phone_no", "hh_is_new_instance", 
    "hh_uuid", "hh_submission_time", "hh_submitted_by", "n_hh_name", "child_list2", 
    "child_list_long", "bnf_1name", "bnf_2name", "bnf_3name", "bnf_4name", "bnf_5name", 
    "hsbnd_1name", "hsbnd_2name", "hsbnd_3name", "hsbnd_4name", "hsbnd_5name", "proj_no", 
    "id_card_no", "loc_id", "status", "notes", "flag_2", "cluster_min_score", "cluster_max_score", 
    "cluster_score", "bnf_relations", "hsbnd_relations", "common_child", "common_child_cnt", 
    "relation_score", "same_mud", "same_proj", "office_no", "ser", "benef_id", "is_active", 
    "benef_class_desc", "term_reason", "is_dup_cluster", "dup_woman_id", "dup_benef_id", 
    "reg_form_date", "old_bnf_name", "old_hsbnd_name", "curr_benef_name", "curr_husband_name", 
    "calc_bnf_1name", "calc_bnf_2name", "calc_bnf_3name", "calc_bnf_4name", "calc_bnf_5name", 
    "calc_hsbnd_1name", "calc_hsbnd_2name", "calc_hsbnd_3name", "calc_hsbnd_4name", "calc_hsbnd_5name", 
    "cbnf_name", "chsbnd_name", "n_child_list", "b_1name", "b_2name", "b_3name", "b_4name", 
    "b_5name", "h_1name", "h_2name", "h_3name", "h_4name", "h_5name", "child_list", "bnf_name_2", 
    "hsbnd_name_2", "bnf_name2", "bnf_name2b", "bnf_name2c", "bnf_name3", "bnf_name3b", "bnf_name3c", 
    "bnf_name3d", "bnf_name4", "bnf_name4c", "bnf_name4b", 
    "bnf_f_name4", "bnf_f_name3", "bnf_f_name3c", "hsbnd_name2", "hsbnd_name2b", "hsbnd_name2c", 
    "hsbnd_name3", "hsbnd_name3b", "hsbnd_name3c", "hsbnd_name3d", "hsbnd_name4", "hsbnd_name4c", "hsbnd_name4b", 
    "hsbnd_f_name4", "hsbnd_f_name3", "hsbnd_f_name3c", "bnf_name_list", "hsbnd_name_list", 
    "dup_cluster_id2_2", "c_max_weight", "c_min_weight", "c_id_max_weight", "c_id_min_weight", 
    "c_max_pct", "c_min_pct", "c_id_max_pct", "c_id_min_pct", "c_min_proj", "c_max_proj", 
    "c_proj2_cnt", "c_mud2_cnt", "c_id_min_proj", "c_id_max_proj", "c_id_proj2_cnt", "c_id_mud2_cnt",
    'womanName',
    'husbandName',
    'nationalId',
    'phone',
    'village',
    'subdistrict',
    'children',
    'beneficiaryId',
    'avgPairScore',
    'avgFirstNameScore',
    'avgFamilyNameScore',
    'avgAdvancedNameScore',
    'avgTokenReorderScore',
    'reasons',
    'confidenceScore',
    'avgWomanNameScore',
    'avgHusbandNameScore',
    'avgFinalScore',
    "pre_classified_result", "group_analysis", "womanName_normalized", "husbandName_normalized", "children_normalized", 
    "subdistrict_normalized", "village_normalized", "parts", "husbandParts", "ED_NO", "ED_ID", "EC_ID", 
    "PC_ID", "ED_NAME", "EC_NAME", "PC_NAME", "SRVY_HH_ID_2", "CANDID_SER_NO", "WOMAN_ID", 
    "source_ID_2", "BENEF_ID_2", "BENEF_NO", "HH_NAME_2", "BNF_RELATION_2", "BENEF_NAME_3", 
    "HUSBAND_NAME_3", "IS_ACTIVE_2", "STATUS_2", "QUAL_STATUS", "STATUS_DESC", "QUAL_STATUS_DESC", 
    "VERIFY_STATUS", "VERIFY_NOTES", "VERIFY_REASON", "VERIFY_DATE", "REG_STATUS", "REG_FORM_DATE_2", 
    "REG_NOTES", "TOTAL_CHILD_COUNT", "MALE_CHILD_COUNT", "FEMALE_CHILD_COUNT", "LOC_ID_2", 
    "LOC_NAME", "ID_CARD_TYPE_2", "ID_CARD_TYPE_DESC", "ID_CARD_NO_2", "AGE_YEARS_2", "ADDRESS", 
    "PHONE_NO_2", "IS_TERMINATED", "TERM_DATE", "TERM_REASON_2", "TERM_NOTES", "NOTES_2", 
    "PC_FAC_ID", "EC_FAC_ID", "BENEF_CLASS", "BENEF_CLASS_DESC_2", "OLD_BNF_NAME_2", 
    "OLD_HSBND_NAME_2", "OLD_PHONE_NO", "OLD_ID_CARD_NO", "enrollment_modification_type", 
    "eligible_woman_modify_type", "eligible_woman_name_correction", 
    "eligible_woman_phone_correction", "eligible_woman_ID_correction", 
    "eligible_woman_husband_name_correction", "pregnancy_month", 
    "educational_level_of_the_targeted_woman", "new_bnf_name", 
    "the_corrected_part_of_the_targets_name", 
    "corrected_part_of_the_targets_namefirst_name", 
    "the_corrected_part_of_the_targets_namefathers_name", 
    "the_corrected_part_of_the_targets_namegrandfathers_name", 
    "corrected_part_of_the_targets_namefourth_name", "corrected_part_of_the_targets_nametitle", 
    "correcting_the_first_name", "correcting_the_fathers_name", 
    "correcting_the_grandfathers_name", "correcting_the_fourth_name", "correcting_the_title", 
    "bnf_1name_flag", "bnf_2name_flag", "bnf_3name_flag", "bnf_4name_flag", "bnf_5name_flag", 
    "bnf_1name_is_valid", "bnf_2name_is_valid", "bnf_3name_is_valid", "bnf_4name_is_valid", 
    "bnf_5name_is_valid", "bnf_1name_valid_note", "bnf_2name_valid_note", "bnf_3name_valid_note", 
    "bnf_4name_valid_note", "bnf_5name_valid_note", 
    "reference_under_which_the_name_was_corrected", 
    "reference_under_which_the_namepersonal_ID_card_correction_was_made", 
    "reference_under_which_the_namefamily_card_correction_was_made", 
    "reference_under_which_the_namepassport_correction_was_made", 
    "reference_under_which_the_name_correctionmarriage_contract_was_made", 
    "reference_under_which_the_nameelectoral_card_correction_was_made", 
    "reference_under_which_the_name_correctionquestionnaire_was_made", 
    "reference_used_to_correct_the_nameaccording_to_the_womans_statement", 
    "reference_under_which_the_nameseat_number_was_corrected", 
    "reference_under_which_the_name_correction_was_madeother_mentioned", 
    "another_reference_under_which_the_name_was_modified", 
    "the_corrected_part_of_the_husbands_name", "corrected_part_of_husbands_namefirst_name", 
    "corrected_part_of_husbands_namefathers_name", 
    "the_corrected_part_of_the_husbands_namegrandfathers_name", 
    "corrected_part_of_husbands_namefourth_name", "corrected_part_of_husbands_namesurname", 
    "new_hsbnd_name", "correcting_the_first_name_6", "correcting_the_fathers_name_8", 
    "correcting_the_grandfathers_name_10", "correcting_the_fourth_name_12", 
    "title_correction_14", "hsbnd_1name_flag", "hsbnd_2name_flag", "hsbnd_3name_flag", 
    "hsbnd_4name_flag", "hsbnd_5name_flag", "hsbnd_1name_is_valid", "hsbnd_2name_is_valid", 
    "hsbnd_3name_is_valid", "hsbnd_4name_is_valid", "hsbnd_5name_is_valid", "hsbnd_1name_valid_note", 
    "hsbnd_2name_valid_note", "hsbnd_3name_valid_note", 
    "hsbnd_4name_valid_note", "hsbnd_5name_valid_note", 
    "reference_under_which_the_name_was_corrected_16", 
    "reference_under_which_the_namepersonal_ID_card_correction_was_made_17", 
    "reference_under_which_the_namefamily_card_correction_was_made_18", 
    "reference_under_which_the_namepassport_correction_was_made_19", 
    "reference_under_which_the_name_correction_was_mademarriage_contract_20", 
    "reference_under_which_the_name_correction_was_madeelectoral_card_21", 
    "reference_under_which_the_name_correction_was_madeQuestionnaire_22", 
    "reference_used_to_correct_the_nameaccording_to_what_the_woman_stated23", 
    "reference_under_which_the_nameseat_number_was_corrected_24", 
    "reference_under_which_the_name_correction_was_madeother_mentions_25", 
    "another_reference_under_which_the_name_was_modified26", "telephone_number", 
    "ID_card_type_3", "other_determines", "ID_card_number", "day_of_signing_the_form", 
    "month", "the_reason_for_not_joining_the_project_is_stated", "other_things_to_mention", 
    "do_you_want_to_repackage_the_beneficiary_for_another_educator", 
    "please_select_the_alternative_educator", "the_name_of_the_new_intellectual", "comments",
    "internalId",
    "data"
];

function initializeDatabase(recreate: boolean = false) {
    const db = new Database(getDbPath());
    if (recreate) {
        db.exec('DROP TABLE IF EXISTS assessed_data');
    }

    const columnsWithTypes = DB_COLUMNS.map(col => {
        if (col === 'id') return `${col} INTEGER PRIMARY KEY AUTOINCREMENT`;
        if (['INTEGER', 'Size', 'cluster_size', 'dup_cluster_size', 'l_age_years', 'gv_age_years', 'r_age_years', 'lr_age_diff', 'dup_cluster_size_2', 'age_years', 'hh_uuid_dup_cnt', 'child_cnt', 'child_m_cnt', 'child_f_cnt', 'bnf_idx', 'hh_qual_women_cnt', 'bnf_child_cnt', 'bnf_child_m_cnt', 'bnf_child_f_cnt', 'common_child_cnt', 'c_proj2_cnt', 'c_mud2_cnt', 'c_id_proj2_cnt', 'c_id_mud2_cnt', 'nationalId', 'phone', 'TOTAL_CHILD_COUNT', 'MALE_CHILD_COUNT', 'FEMALE_CHILD_COUNT', 'AGE_YEARS_2', 'pregnancy_month'].includes(col)) return `${col} INTEGER`;
        if (['REAL', 'Max_PairScore', 'pairScore', 'nameScore', 'husbandScore', 'childrenScore', 'idScore', 'phoneScore', 'locationScore', 'match_probability', 'match_weight', 'lr_benef_name_jw_sim', 'lr_husband_name_jw_sim', 'lr_benef_name_jaccard', 'lr_husband_name_jaccard', 'lr_id_card_dist', 'lr_child_jaccard', 'dup_cluster_score', 'cluster_min_score', 'cluster_max_score', 'cluster_score', 'relation_score', 'c_max_weight', 'c_min_weight', 'c_id_max_weight', 'c_id_min_weight', 'c_max_pct', 'c_min_pct', 'c_id_max_pct', 'c_id_min_pct', 'c_min_proj', 'c_max_proj', 'c_id_min_proj', 'c_id_max_proj', 'avgPairScore', 'avgFirstNameScore', 'avgFamilyNameScore', 'avgAdvancedNameScore', 'avgTokenReorderScore', 'confidenceScore', 'avgWomanNameScore', 'avgHusbandNameScore', 'avgFinalScore'].includes(col)) return `${col} REAL`;
        if (col === 'data') return `${col} JSON`;
        return `${col} TEXT`;
    }).join(',\n    ');

    const createTableStmt = `CREATE TABLE IF NOT EXISTS assessed_data (${columnsWithTypes});`;
    db.exec(createTableStmt);
    
    return db;
}


export async function POST(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase(false);
        const body = await req.json();
        const { action, ...payload } = body;

        switch (action) {
            case 'check_duplicates': {
                const { uniqueIdCol, uniqueIds } = payload;
                if (!uniqueIdCol || !Array.isArray(uniqueIds) || uniqueIds.length === 0) {
                    db.close();
                    return NextResponse.json({ count: 0 });
                }
                
                try {
                    const placeholders = uniqueIds.map(() => '?').join(',');
                    const stmt = db.prepare(`SELECT COUNT(DISTINCT ${uniqueIdCol}) as count FROM assessed_data WHERE ${uniqueIdCol} IN (${placeholders})`);
                    const result = stmt.get(...uniqueIds);
                    db.close();
                    return NextResponse.json({ count: result.count });
                } catch (dbError: any) {
                    db.close();
                    if (dbError.code === 'SQLITE_ERROR' && (dbError.message.includes('no such table') || dbError.message.includes('no such column'))) {
                       return NextResponse.json({ count: 0 });
                    }
                    throw dbError;
                }
            }

            case 'save': {
                const { records, mode, uniqueIdDbCol } = payload;
                if (!records || records.length === 0) {
                    db.close();
                    return NextResponse.json({ saved: 0, skipped: 0, message: "No records to save." });
                }

                // Deduplicate incoming records, keeping the last one for each unique ID.
                const uniqueRecordsMap = new Map();
                records.forEach((record: any) => {
                    const uniqueId = record[uniqueIdDbCol];
                    if (uniqueId) {
                        uniqueRecordsMap.set(String(uniqueId), record);
                    }
                });
                const uniqueRecords = Array.from(uniqueRecordsMap.values());
                const uniqueIds = Array.from(uniqueRecordsMap.keys());
                
                let savedCount = 0;
                let skippedCount = 0;
                
                const columnsInPayload = Object.keys(records[0] || {});
                const insertColumns = columnsInPayload.filter(col => DB_COLUMNS.includes(col));
                
                if (insertColumns.length === 0) {
                     db.close();
                     return NextResponse.json({ message: "No valid columns to insert." }, { status: 400 });
                }

                const colsString = insertColumns.join(', ');
                const placeholders = insertColumns.map(() => '?').join(', ');
                const insertStmt = db.prepare(`INSERT INTO assessed_data (${colsString}) VALUES (${placeholders})`);

                if (mode === 'replace') {
                    db.transaction(() => {
                        if (uniqueIds.length > 0) {
                            const deletePlaceholders = uniqueIds.map(() => '?').join(',');
                            db.prepare(`DELETE FROM assessed_data WHERE ${uniqueIdDbCol} IN (${deletePlaceholders})`).run(...uniqueIds);
                        }
                        for (const record of uniqueRecords) {
                            const values = insertColumns.map(col => record[col] ?? null);
                            insertStmt.run(...values);
                            savedCount++;
                        }
                    })();
                } else { // 'skip' mode
                    const existingIds = new Set();
                    if (uniqueIds.length > 0) {
                        const selectPlaceholders = uniqueIds.map(() => '?').join(',');
                        const existingRows = db.prepare(`SELECT DISTINCT ${uniqueIdDbCol} FROM assessed_data WHERE ${uniqueIdDbCol} IN (${selectPlaceholders})`).all(...uniqueIds);
                        existingRows.forEach((row: any) => existingIds.add(String(row[uniqueIdDbCol])));
                    }

                    db.transaction(() => {
                        for (const record of uniqueRecords) {
                            const recordId = String(record[uniqueIdDbCol]);
                            if (recordId && existingIds.has(recordId)) {
                                skippedCount++;
                            } else {
                                const values = insertColumns.map(col => record[col] ?? null);
                                insertStmt.run(...values);
                                savedCount++;
                            }
                        }
                    })();
                }
                
                db.close();
                return NextResponse.json({ saved: savedCount, skipped: skippedCount, message: `Saved ${savedCount}, skipped ${skippedCount} duplicates.` });
            }
            
            default:
                db.close();
                return NextResponse.json({ error: 'Invalid action provided.' }, { status: 400 });
        }
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

        const updateRecord = (record: any) => {
            if (!record.id) return; 
            
            const columnsToUpdate = Object.keys(record).filter(col => DB_COLUMNS.includes(col) && col !== 'id');
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
            return NextResponse.json({ error: "Invalid payload. Expected an array of 'ids' to delete." }, { status: 400 });
        }
        
        const db = new Database(getDbPath());

        const placeholders = ids.map(() => '?').join(',');
        const stmt = db.prepare(`DELETE FROM assessed_data WHERE id IN (${placeholders})`);
        
        const info = stmt.run(...ids);
        db.close();

        return NextResponse.json({ message: `${info.changes} records deleted successfully.` });

    } catch (error: any) {
        console.error("[BNF_ASSESSED_DELETE_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to delete beneficiary data.", details: error.message }, { status: 500 });
    }
}
