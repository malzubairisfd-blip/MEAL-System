
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
    "bnf_name3d", "bnf_name4", "bnf_name4c", "bnf_name4b", "bnf_f_name4", "bnf_f_name3", 
    "bnf_f_name3c", "hsbnd_name2", "hsbnd_name2b", "hsbnd_name2c", "hsbnd_name3", "hsbnd_name3b", 
    "hsbnd_name3c", "hsbnd_name3d", "hsbnd_name4", "hsbnd_name4c", "hsbnd_name4b", "hsbnd_f_name4", 
    "hsbnd_f_name3", "hsbnd_f_name3c", "bnf_name_list", "hsbnd_name_list", "dup_cluster_id2_2", 
    "c_max_weight", "c_min_weight", "c_id_max_weight", "c_id_min_weight", "c_max_pct", "c_min_pct", 
    "c_id_max_pct", "c_id_min_pct", "c_min_proj", "c_max_proj", "c_proj2_cnt", "c_mud2_cnt", 
    "c_id_min_proj", "c_id_max_proj", "c_id_proj2_cnt", "c_id_mud2_cnt",
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


// Function to initialize the database and create tables if they don't exist
function initializeDatabase(recreate: boolean = false) {
    const db = new Database(getDbPath());
    
    if (recreate) {
        db.exec('DROP TABLE IF EXISTS assessed_data');
    }

    const createTableStmt = `
        CREATE TABLE IF NOT EXISTS assessed_data (
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
    recordDecision TEXT,
    decisionReason TEXT,
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
    internalId TEXT,
    data JSON
);
    `;
    db.exec(createTableStmt);
    
    return db;
}


export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    const init = searchParams.get('init') === 'true';

    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase(init);
        
        const body = await req.json();
        const { projectId, projectName, results } = body;

        if (!Array.isArray(results) || results.length === 0) {
            return NextResponse.json({ message: "No records to insert." }, { status: 200 });
        }
        
        const columnsInPayload = Object.keys(results[0] || {});
        const insertColumns = columnsInPayload.filter(col => DB_COLUMNS.includes(col));

        if (insertColumns.length === 0) {
            db.close();
            return NextResponse.json({ message: "No valid columns to insert." }, { status: 400 });
        }
        
        const columnsString = insertColumns.join(', ');
        const placeholders = insertColumns.map(() => '?').join(', ');
        const insert = db.prepare(`INSERT INTO assessed_data (${columnsString}) VALUES (${placeholders})`);
        
        const insertMany = db.transaction((records) => {
            for (const record of records) {
                // Server-side fallback for project info
                if (!record.project_id && projectId) record.project_id = projectId;
                if (!record.project_name && projectName) record.project_name = projectName;
                
                const values = insertColumns.map(col => record[col] ?? null);
                insert.run(...values);
            }
        });

        insertMany(results);
        
        db.close();

        return NextResponse.json({ message: "Beneficiary assessment data saved to SQLite database successfully." });

    } catch (error: any) {
        console.error("[BNF_ASSESSED_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to save beneficiary assessment data to SQLite.", details: error.message }, { status: 500 });
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
