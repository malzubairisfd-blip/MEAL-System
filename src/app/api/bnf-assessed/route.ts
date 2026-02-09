import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-assessed.db");

const DB_COLUMNS = [
  "id",
  "project_id",
  "project_name",
  "internalId",
  "data",
  "Generated_Cluster_ID",
  "Size",
  "Flag",
  "Max_PairScore",
  "pairScore",
  "nameScore",
  "husbandScore",
  "childrenScore",
  "idScore",
  "phoneScore",
  "locationScore",
  "groupDecision",
  "recordDecisions",
  "decisionReasons",
  "confidenceScore",
  "reasons",
  "pre_classified_result",
  "group_analysis",
  "avgPairScore",
  "avgFirstNameScore",
  "avgFamilyNameScore",
  "avgAdvancedNameScore",
  "avgTokenReorderScore",
  "avgWomanNameScore",
  "avgHusbandNameScore",
  "avgFinalScore",
  "womanName",
  "husbandName",
  "nationalId",
  "phone",
  "village",
  "subdistrict",
  "children",
  "beneficiaryId",
  "womanName_normalized",
  "husbandName_normalized",
  "children_normalized",
  "subdistrict_normalized",
  "village_normalized",
  "parts",
  "husbandParts",
  "s",
  "cluster_id",
  "dup_cluster_id2",
  "eq_clusters",
  "dup_flag2",
  "new_dup_flag1",
  "dup_flag",
  "cluster_size",
  "dup_cluster_size",
  "match_probability",
  "match_weight",
  "l_id",
  "l_benef_name",
  "l_hsbnd_name",
  "l_child_list",
  "l_phone_no",
  "l_id_card_no",
  "l_age_years",
  "l_mud_id",
  "gv_bnf_name",
  "gv_hsbnd_name",
  "gv_bnf_hsbnd_name",
  "gv_n_child_list",
  "gv_id_card_no",
  "gv_phone_no",
  "gv_age_years",
  "r_id",
  "r_benef_name",
  "r_husband_name",
  "r_child_list",
  "r_phone_no",
  "r_id_card_no",
  "r_age_years",
  "r_mud_id",
  "lr_eq_mud",
  "lr_eq_phone",
  "lr_age_diff",
  "lr_benef_name_jw_sim",
  "lr_husband_name_jw_sim",
  "lr_benef_name_jaccard",
  "lr_husband_name_jaccard",
  "lr_id_card_dist",
  "lr_child_jaccard",
  "dup_cluster_size_2",
  "dup_cluster_id",
  "dup_cluster_flag",
  "record_id",
  "benef_name",
  "husband_name",
  "child_list_str",
  "phone_no",
  "bnf_id_card_no",
  "age_years",
  "gov_name",
  "mud_name",
  "hh_ozla_name",
  "hh_vill_name",
  "dup_cluster_score",
  "hh_uuid_dup_cnt",
  "hh_uuid_rn",
  "hh_team_name",
  "hh_srvyr_name",
  "hh_srvyr_phone_no",
  "hh_mahlah",
  "hh_address",
  "hh_name",
  "hh_gender",
  "hh_is_swf",
  "hh_is_dislocated",
  "hh_is_dislocated_guest",
  "child_cnt",
  "child_m_cnt",
  "child_f_cnt",
  "bnf_id",
  "srvy_hh_id",
  "bnf_idx",
  "id_card_type",
  "bnf_relation",
  "bnf_relation_label",
  "bnf_relation_code",
  "n_child_list_str",
  "hh_deviceid",
  "hh_vill_id",
  "gov_no",
  "mud_no",
  "hh_ozla_no",
  "hh_srvyr_id",
  "hh_srvyr_team_id",
  "paper_form_date",
  "paper_form_no",
  "hh_qual_women_cnt",
  "bnf_child_cnt",
  "bnf_child_m_cnt",
  "bnf_child_f_cnt",
  "bnf_social_status",
  "bnf_qual_status",
  "bnf_qual_status_desc",
  "bnf_qual_is_preg",
  "bnf_qual_is_mother5",
  "bnf_qual_is_mother_handicaped",
  "bnf_is_handicaped",
  "bnf_is_dislocated",
  "hh_phone_no",
  "bnf_phone_no",
  "hh_is_new_instance",
  "hh_uuid",
  "hh_submission_time",
  "hh_submitted_by",
  "n_hh_name",
  "child_list2",
  "child_list_long",
  "bnf_1name",
  "bnf_2name",
  "bnf_3name",
  "bnf_4name",
  "bnf_5name",
  "hsbnd_1name",
  "hsbnd_2name",
  "hsbnd_3name",
  "hsbnd_4name",
  "hsbnd_5name",
  "proj_no",
  "id_card_no",
  "loc_id",
  "status",
  "notes",
  "flag_2",
  "cluster_min_score",
  "cluster_max_score",
  "cluster_score",
  "bnf_relations",
  "hsbnd_relations",
  "common_child",
  "common_child_cnt",
  "relation_score",
  "same_mud",
  "same_proj",
  "office_no",
  "ser",
  "benef_id",
  "is_active",
  "benef_class_desc",
  "term_reason",
  "is_dup_cluster",
  "dup_woman_id",
  "dup_benef_id",
  "reg_form_date",
  "old_bnf_name",
  "old_hsbnd_name",
  "curr_benef_name",
  "curr_husband_name",
  "calc_bnf_1name",
  "calc_bnf_2name",
  "calc_bnf_3name",
  "calc_bnf_4name",
  "calc_bnf_5name",
  "calc_hsbnd_1name",
  "calc_hsbnd_2name",
  "calc_hsbnd_3name",
  "calc_hsbnd_4name",
  "calc_hsbnd_5name",
  "cbnf_name",
  "chsbnd_name",
  "n_child_list",
  "b_1name",
  "b_2name",
  "b_3name",
  "b_4name",
  "b_5name",
  "h_1name",
  "h_2name",
  "h_3name",
  "h_4name",
  "h_5name",
  "child_list",
  "bnf_name_2",
  "hsbnd_name_2",
  "bnf_name2",
  "bnf_name2b",
  "bnf_name2c",
  "bnf_name3",
  "bnf_name3b",
  "bnf_name3c",
  "bnf_name3d",
  "bnf_name4",
  "bnf_name4c",
  "bnf_name4b",
  "bnf_f_name4",
  "bnf_f_name3",
  "bnf_f_name3c",
  "bnf_name_list",
  "hsbnd_name_list",
  "dup_cluster_id2_2",
  "c_max_weight",
  "c_min_weight",
  "c_id_max_weight",
  "c_id_min_weight",
  "c_max_pct",
  "c_min_pct",
  "c_id_max_pct",
  "c_id_min_pct",
  "c_min_proj",
  "c_max_proj",
  "c_proj2_cnt",
  "c_mud2_cnt",
  "c_id_min_proj",
  "c_id_max_proj",
  "c_id_proj2_cnt",
  "c_id_mud2_cnt",
];

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

function initializeDatabase() {
  const db = new Database(getDbPath());
  const columnsDef = DB_COLUMNS.map((colName) => {
    if (colName === "id") return "id INTEGER PRIMARY KEY AUTOINCREMENT";
    const upperCaseCol = colName.toUpperCase();
    if (
      upperCaseCol.includes("SCORE") ||
      upperCaseCol.includes("AVG") ||
      upperCaseCol.includes("REAL") ||
      upperCaseCol.includes("WEIGHT") ||
      upperCaseCol.includes("PCT") ||
      upperCaseCol.includes("SIM")
    ) {
      return `${colName} REAL`;
    }
    if (upperCaseCol.includes("SIZE") || upperCaseCol.includes("INTEGER") || upperCaseCol.includes("CNT")) {
      return `${colName} INTEGER`;
    }
    return `${colName} TEXT`;
  });
  db.exec(`CREATE TABLE IF NOT EXISTS assessed_data (${columnsDef.join(", ")});`);
  return db;
}

const sanitizeColumn = (col?: string) => (col ? col.replace(/[^a-zA-Z0-9_]/g, "") : "");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action,
      projectId,
      records,
      uniqueIdCol,
      uniqueIds,
      mode,
      uniqueIdDbCol,
      columnName,
      columnType,
    } = body;
    await fs.mkdir(getDataPath(), { recursive: true });

    if (action === "check_duplicates") {
      if (!projectId || !uniqueIdCol || !Array.isArray(uniqueIds)) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
      }
      let db: Database.Database | null = null;
      try {
        db = new Database(getDbPath(), { fileMustExist: true });
        const tableCols = db.prepare("PRAGMA table_info(assessed_data)").all().map((c: any) => c.name);
        const sanitizedColumn = sanitizeColumn(uniqueIdCol);
        if (!tableCols.includes(sanitizedColumn)) {
          return NextResponse.json({ error: `Invalid column ${uniqueIdCol}` }, { status: 400 });
        }
        const chunks = chunkArray(uniqueIds, 900);
        let totalCount = 0;
        for (const chunk of chunks) {
          if (!chunk.length) continue;
          const placeholders = chunk.map(() => "?").join(",");
          const stmt = db.prepare(
            `SELECT COUNT(*) as count FROM assessed_data WHERE project_id = ? AND ${sanitizedColumn} IN (${placeholders})`
          );
          const result: any = stmt.get(projectId, ...chunk);
          totalCount += result.count;
        }
        return NextResponse.json({ count: totalCount });
      } catch (error: any) {
        if (error.code === "SQLITE_CANTOPEN") return NextResponse.json({ count: 0 });
        throw error;
      } finally {
        if (db) db.close();
      }
    }

    if (action === "add_column") {
      if (!columnName || !columnType) {
        return NextResponse.json({ error: "Missing columnName or columnType" }, { status: 400 });
      }
      const sanitizedColumnName = columnName.replace(/[^a-zA-Z0-9_]/g, "");
      if (!sanitizedColumnName) {
        return NextResponse.json({ error: "Invalid column name" }, { status: 400 });
      }
      if (!["TEXT", "INTEGER", "REAL", "JSON"].includes(columnType.toUpperCase())) {
        return NextResponse.json({ error: "Invalid column type" }, { status: 400 });
      }
      const db = new Database(getDbPath());
      try {
        db.exec(`ALTER TABLE assessed_data ADD COLUMN "${sanitizedColumnName}" ${columnType.toUpperCase()}`);
        return NextResponse.json({ message: "Column added" });
      } finally {
        db.close();
      }
    }

    if (action === "save") {
      if (!projectId || !Array.isArray(records) || !mode) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
      }
      const db = initializeDatabase();
      try {
        const tableCols = db.prepare("PRAGMA table_info(assessed_data)").all().map((c: any) => c.name);
        const sanitizedUniqueIdDbCol = sanitizeColumn(uniqueIdDbCol);
        if (!sanitizedUniqueIdDbCol || !tableCols.includes(sanitizedUniqueIdDbCol)) {
          return NextResponse.json({ error: "Invalid unique ID column" }, { status: 400 });
        }
        let recordsToInsert = records;
        let skippedCount = 0;
        let insertedCount = 0;

        const transaction = db.transaction(() => {
          if (mode === "replace") {
            const idsToDelete = records
              .map((r) => r[sanitizedUniqueIdDbCol])
              .filter(Boolean);
            if (idsToDelete.length > 0) {
              const deleteChunks = chunkArray(idsToDelete, 900);
              for (const chunk of deleteChunks) {
                const placeholders = chunk.map(() => "?").join(",");
                db.prepare(
                  `DELETE FROM assessed_data WHERE project_id = ? AND ${sanitizedUniqueIdDbCol} IN (${placeholders})`
                ).run(projectId, ...chunk);
              }
            }
          } else if (mode === "skip") {
            const batchIds = records
              .map((r) => r[sanitizedUniqueIdDbCol])
              .filter(Boolean);
            const existingIds = new Set<string>();
            const checkChunks = chunkArray(batchIds, 900);
            for (const chunk of checkChunks) {
              if (!chunk.length) continue;
              const placeholders = chunk.map(() => "?").join(",");
              const rows: any = db
                .prepare(
                  `SELECT ${sanitizedUniqueIdDbCol} FROM assessed_data WHERE project_id = ? AND ${sanitizedUniqueIdDbCol} IN (${placeholders})`
                )
                .all(projectId, ...chunk);
              rows.forEach((row: any) => existingIds.add(String(row[sanitizedUniqueIdDbCol])));
            }
            recordsToInsert = records.filter((r: any) => !existingIds.has(String(r[sanitizedUniqueIdDbCol])));
            skippedCount = records.length - recordsToInsert.length;
          }

          if (recordsToInsert.length > 0) {
            const insertCols = Object.keys(recordsToInsert[0]).filter(
              (col) => tableCols.includes(col) && col !== "id"
            );
            if (insertCols.length > 0) {
              const placeholders = insertCols.map(() => "?").join(", ");
              const insert = db.prepare(
                `INSERT INTO assessed_data (${insertCols.join(", ")}) VALUES (${placeholders})`
              );
              for (const record of recordsToInsert) {
                insert.run(...insertCols.map((col) => record[col] ?? null));
                insertedCount += 1;
              }
            }
          }
        });

        transaction();

        return NextResponse.json({
          saved: insertedCount,
          skipped: skippedCount,
          total: records.length,
        });
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

export async function GET() {
  try {
    const db = new Database(getDbPath(), { fileMustExist: true });
    const rows = db.prepare("SELECT * FROM assessed_data").all();
    db.close();
    return NextResponse.json(rows);
  } catch (error: any) {
    if (error.code === "SQLITE_CANTOPEN") {
      return NextResponse.json([]);
    }
    console.error("[BNF_ASSESSED_API_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch assessed data.", details: error.message },
      { status: 500 }
    );
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