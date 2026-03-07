//src/app/api/bnf-cmam/route.ts

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-cmam.db");
const getProjectsDbPath = () => path.join(getDataPath(), "projects.db");
const getEducatorsDbPath = () => path.join(getDataPath(), "educators.db");

const TABLE_SCHEMA = `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,
  project_name TEXT,
  PROJ_NO TEXT,
  BATCH_NO TEXT,
  GOV_NO TEXT,
  MUD_NO TEXT,
  OZLA_NO TEXT,
  VILL_NO TEXT,
  MUD_LOC_ID TEXT,
  GOV_NAME TEXT,
  MUD_NAME TEXT,
  OZLA_NAME TEXT,
  VILL_NAME TEXT,
  ED_NO TEXT,
  ED_ID TEXT,
  EC_ID TEXT,
  PC_ID TEXT,
  ED_NAME TEXT,
  EC_NAME TEXT,
  PC_NAME TEXT,
  SRVY_HH_ID TEXT,
  CANDID_SER_NO TEXT,
  WOMAN_ID TEXT,
  ID TEXT,
  BENEF_ID TEXT,
  BENEF_NO TEXT,
  HH_NAME TEXT,
  BNF_RELATION TEXT,
  BENEF_NAME TEXT,
  HUSBAND_NAME TEXT,
  CHILD_LIST_STR TEXT,
  CHILD_LIST_LONG TEXT,
  BNF_SOCIAL_STATUS TEXT,
  SOCIAL_STATUS_DESC TEXT,
  IS_ACTIVE TEXT,
  STATUS TEXT,
  QUAL_STATUS TEXT,
  STATUS_DESC TEXT,
  QUAL_STATUS_DESC TEXT,
  VERIFY_STATUS TEXT,
  VERIFY_NOTES TEXT,
  VERIFY_REASON TEXT,
  VERIFY_DATE TEXT,
  REG_STATUS TEXT,
  REG_FORM_DATE TEXT,
  REG_NOTES TEXT,
  TOTAL_CHILD_COUNT TEXT,
  MALE_CHILD_COUNT TEXT,
  FEMALE_CHILD_COUNT TEXT,
  LOC_ID TEXT,
  LOC_NAME TEXT,
  ID_CARD_TYPE TEXT,
  ID_CARD_TYPE_DESC TEXT,
  ID_CARD_NO TEXT,
  AGE_YEARS TEXT,
  ADDRESS TEXT,
  PHONE_NO TEXT,
  IS_TERMINATED TEXT,
  TERM_DATE TEXT,
  TERM_REASON TEXT,
  TERM_NOTES TEXT,
  NOTES TEXT,
  PC_FAC_ID TEXT,
  EC_FAC_ID TEXT,
  BENEF_CLASS TEXT,
  BENEF_CLASS_DESC TEXT,
  OLD_BNF_NAME TEXT,
  OLD_HSBND_NAME TEXT,
  OLD_PHONE_NO TEXT,
  OLD_ID_CARD_NO TEXT,
  ed_phone TEXT,
  new_ed_id TEXT,
  new_ed_name TEXT,
  new_ed_phone TEXT,
  new_ec_id TEXT,
  new_ec_name TEXT,
  new_pc_id TEXT,
  new_pc_name TEXT,
  reg_date TEXT,
  curr_date TEXT,
  reg_curr_days TEXT,
  reg_curr_mon TEXT,
  bnf_age_mon TEXT,
  new_bnf_age_mon TEXT,
  new_bnf_age_years TEXT,
  cmam_qualify TEXT,
  bnf_has_cmam TEXT,
  bnf_preg_lec TEXT,
  preg_mon TEXT,
  child_age TEXT,
  muac TEXT,
  go_health_center TEXT,
  disc_date TEXT,
  near_health_center TEXT,
  comments TEXT,
  hw_id TEXT,
  hw_name TEXT,
  hc_id TEXT,
  hc_name TEXT,
  attend_hc TEXT,
  conf_date TEXT,
  bnf_has_cmam_hc TEXT,
  hc_card_no TEXT,
  bnf_cmam_cond TEXT,
  bnf_preg_mon TEXT,
  bnf_child_age TEXT,
  hc_muac TEXT,
  exp_start_treat_date TEXT,
  exp_end_treat_date TEXT,
  not_attend_reason TEXT,
  bnf_attend_c1 TEXT,
  bnf_isprev_ref_c1 TEXT,
  date_attend_c1 TEXT,
  bnf_cmam_cond_c1 TEXT,
  bnf_preg_mon_c1 TEXT,
  bnf_child_age_c1 TEXT,
  hc_muac_c1 TEXT,
  cmam_result_c1 TEXT,
  not_attend_reason_c1 TEXT,
  cure_rate_c1 TEXT,
  positive_c1 TEXT,
  negative_c1 TEXT,
  next_cycle_c1 TEXT,
  bnf_isprev_ref_c2 TEXT,
  date_attend_c2 TEXT,
  bnf_cmam_cond_c2 TEXT,
  bnf_preg_mon_c2 TEXT,
  bnf_child_age_c2 TEXT,
  hc_muac_c2 TEXT,
  cmam_result_c2 TEXT,
  not_attend_reason_c2 TEXT,
  cure_rate_c2 TEXT,
  positive_c2 TEXT,
  negative_c2 TEXT,
  next_cycle_c2 TEXT,
  bnf_isprev_ref_c3 TEXT,
  date_attend_c3 TEXT,
  bnf_cmam_cond_c3 TEXT,
  bnf_preg_mon_c3 TEXT,
  bnf_child_age_c3 TEXT,
  hc_muac_c3 TEXT,
  cmam_result_c3 TEXT,
  not_attend_reason_c3 TEXT,
  cure_rate_c3 TEXT,
  positive_c3 TEXT,
  negative_c3 TEXT,
  next_cycle_c3 TEXT,
  data JSON
)`;

const ALL_COLUMNS =
  TABLE_SCHEMA.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g)
    ?.filter(
      (word) =>
        !["id", "primary", "autoincrement", "integer", "text", "real", "json", "key"].includes(word.toLowerCase())
    )
    .map((word) => word.toUpperCase()) || [];

const VALID_COLUMNS_SET = new Set(ALL_COLUMNS.map((column) => column.toLowerCase()));

const sanitizeColumn = (value?: string) => (value ? value.replace(/[^a-zA-Z0-9_]/g, "") : "");

const ensureDirectory = () => fs.mkdir(getDataPath(), { recursive: true });

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS bnf_cmam ${TABLE_SCHEMA};`);
  return db;
}

const sendProgress = (writer: WritableStreamDefaultWriter<Uint8Array>, payload: any) => {
  const encoder = new TextEncoder();
  writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
};

const normalizeMapping = (mapping: Record<string, string>) => {
  const sanitized: Record<string, string> = {};
  for (const [fileCol, dbColRaw] of Object.entries(mapping || {})) {
    const normalized = sanitizeColumn(dbColRaw);
    if (!normalized) continue;
    if (!VALID_COLUMNS_SET.has(normalized.toLowerCase())) continue;
    sanitized[fileCol] = normalized;
  }
  return sanitized;
};

const fetchProjectNameFromDb = (projectId: string) => {
  try {
    const projectsDb = new Database(getProjectsDbPath(), { fileMustExist: true });
    const project = projectsDb.prepare("SELECT project_name FROM projects WHERE project_id = ?").get(projectId);
    projectsDb.close();
    return project?.project_name || "";
  } catch {
    return "";
  }
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const ensureBenefClassFilter = "BENEF_CLASS_DESC = 'مستفيدة'";

export async function GET(req: Request) {
  try {
    await ensureDirectory();
    const db = initializeDatabase();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const records =
      projectId && projectId !== "all"
        ? db.prepare("SELECT * FROM bnf_cmam WHERE project_id = ?").all(projectId)
        : db.prepare("SELECT * FROM bnf_cmam").all();
    db.close();
    return NextResponse.json(records);
  } catch (error: any) {
    if (error?.code === "SQLITE_CANTOPEN") {
      return NextResponse.json([]);
    }
    console.error("[BNF_CMAM_API_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch bnf-cmam data.", details: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDirectory();
    const body = await req.json();
    const { action } = body;
    if (action === "get_schema") {
        try {
            const db = initializeDatabase();
    
            let columns = db
                .prepare("PRAGMA table_info(bnf_cmam)")
                .all()
                .map((c: any) => c.name);
    
            db.close();
    
            // If DB exists but table info returned empty
            if (!columns || columns.length === 0) {
                columns = ALL_COLUMNS;
            }
    
            return NextResponse.json({ columns });
    
        } catch (err) {
            // If DB file does not exist yet
            return NextResponse.json({ columns: ALL_COLUMNS });
        }
    }

    if (action === "check_duplicates") {
      const { projectId, uniqueIds, uniqueIdCol } = body;
      if (!projectId) {
        return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
      }
      const lookupColumn = sanitizeColumn(uniqueIdCol) || "BENEF_ID";
      if (!VALID_COLUMNS_SET.has(lookupColumn.toLowerCase())) {
        return NextResponse.json({ error: "Invalid lookup column" }, { status: 400 });
      }
      const idsToCheck = Array.isArray(uniqueIds) ? uniqueIds.filter((id) => id !== null && id !== undefined) : [];
      const db = initializeDatabase();
      const totalExisting =
        (db.prepare("SELECT COUNT(*) as total FROM bnf_cmam WHERE project_id = ?").get(projectId) as { total: number }).total ||
        0;
      if (totalExisting === 0) {
        db.close();
        return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
      }
      try {
        const existingIds = new Set<string>();
        const stmt = db.prepare(`SELECT "${lookupColumn}" FROM bnf_cmam WHERE project_id = ?`);
        const rows = stmt.all(projectId) as any[];
        rows.forEach((row) => {
          const value = row[lookupColumn];
          if (value !== undefined && value !== null) {
            existingIds.add(String(value));
          }
        });
        const duplicates = idsToCheck.filter((id: string) => existingIds.has(String(id)));
        db.close();
        return NextResponse.json({ count: duplicates.length, totalInDb: totalExisting, duplicateIds: duplicates });
      } catch (error: any) {
        db.close();
        if (error.code === "SQLITE_CANTOPEN") {
          return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
        }
        return NextResponse.json({ error: "Duplicate check failed", details: error.message }, { status: 500 });
      }
    }

    if (action === "save") {
      const stream = new TransformStream<Uint8Array, Uint8Array>();
      const writer = stream.writable.getWriter();
      const response = new Response(stream.readable, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });

      (async () => {
        const {
          projectId,
          projectName,
          records = [],
          mapping = {},
          uniqueIdCol = "BENEF_ID",
          regDate,
          currDate,
          mode = "replace",
        } = body;

        if (!projectId) {
          sendProgress(writer, { type: "error", error: "Project not selected." });
          writer.close();
          return;
        }

        const sanitizedUnique = sanitizeColumn(uniqueIdCol) || "BENEF_ID";
        if (!VALID_COLUMNS_SET.has(sanitizedUnique.toLowerCase())) {
          sendProgress(writer, { type: "error", error: "Invalid unique column." });
          writer.close();
          return;
        }

        const normalizedMapping = normalizeMapping(mapping);
        if (!Object.values(normalizedMapping).includes(sanitizedUnique)) {
          sendProgress(writer, { type: "error", error: "Unique column not mapped." });
          writer.close();
          return;
        }

        const finalProjectName = projectName || fetchProjectNameFromDb(projectId) || "";

        const db = initializeDatabase();
        try {
          sendProgress(writer, {
            type: "progress",
            status: "STEP_ONE",
            progress: 10,
            message: "Step One: Ensuring database table and schema.",
            stats: { saved: 0, updated: 0, skipped: 0, total: records.length },
          });

          const mappedColumns = Array.from(new Set(Object.values(normalizedMapping)));
          const insertColumns = Array.from(new Set([...mappedColumns, "project_id", "project_name"]));
          const placeholders = insertColumns.map((col) => `@${col}`).join(", ");
          const insertStmt = db.prepare(
            `INSERT INTO bnf_cmam (${insertColumns.join(", ")}) VALUES (${placeholders})`
          );

          const updateColumns = mappedColumns.filter(
            (col) => col !== sanitizedUnique && col !== "project_id" && col !== "project_name"
          );
          const updateStmt =
            updateColumns.length > 0
              ? db.prepare(
                  `UPDATE bnf_cmam SET ${updateColumns.map((col) => `"${col}" = @${col}`).join(
                    ", "
                  )} WHERE "${sanitizedUnique}" = @${sanitizedUnique} AND project_id = @project_id`
                )
              : null;

          const checkStmt = db.prepare(`SELECT 1 FROM bnf_cmam WHERE "${sanitizedUnique}" = ? AND project_id = ?`);
          const stats = { saved: 0, updated: 0, skipped: 0, total: records.length };

          const transaction = db.transaction((rows: any[], txMode: "skip" | "replace") => {
            for (const row of rows) {
              const payload: Record<string, any> = {
                project_id: projectId,
                project_name: finalProjectName,
              };
              for (const [fileCol, dbCol] of Object.entries(normalizedMapping)) {
                payload[dbCol] = row[fileCol] ?? null;
              }
              const uniqueValue = payload[sanitizedUnique];
              if (!uniqueValue) {
                stats.skipped++;
                continue;
              }
              const exists = checkStmt.get(uniqueValue, projectId);
              if (exists) {
                if (txMode === "replace" && updateStmt) {
                  updateStmt.run(payload);
                  stats.updated++;
                } else {
                  stats.skipped++;
                }
              } else {
                insertStmt.run(payload);
                stats.saved++;
              }
            }
          });

          transaction(records, mode === "skip" ? "skip" : "replace");

          sendProgress(writer, {
            type: "progress",
            status: "STEP_TWO",
            progress: 35,
            message: "Step Two: Saved mapped columns and project info.",
            stats,
          });

          const educatorsMap = new Map<string, string>();
          try {
            const educatorsDb = new Database(getEducatorsDbPath(), { fileMustExist: true });
            const educators = educatorsDb
              .prepare("SELECT applicant_name, phone_no FROM educators WHERE project_id = ?")
              .all(projectId);
            educators.forEach((row: any) => educatorsMap.set(row.applicant_name, row.phone_no));
            educatorsDb.close();
          } catch {
            /* ignore missing educators database */
          }

          const edRecords = db.prepare("SELECT id, ED_NAME FROM bnf_cmam WHERE project_id = ?").all(projectId);
          const updatePhoneStmt = db.prepare("UPDATE bnf_cmam SET ed_phone = ? WHERE id = ?");
          db.transaction((rowsToUpdate: any[]) => {
            rowsToUpdate.forEach((record) => {
              if (!record.ED_NAME) return;
              const phone = educatorsMap.get(record.ED_NAME);
              if (phone) {
                updatePhoneStmt.run(phone, record.id);
              }
            });
          })(edRecords);

          sendProgress(writer, {
            type: "progress",
            status: "STEP_THREE",
            progress: 55,
            message: "Step Three: Synced educator phone numbers.",
            stats,
          });

          const regDateParsed = parseDate(regDate);
          const currDateParsed = parseDate(currDate);
          if (regDateParsed && currDateParsed) {
            const regRecords = db
              .prepare(`SELECT id FROM bnf_cmam WHERE project_id = ? AND ${ensureBenefClassFilter}`)
              .all(projectId);
            const updateDateStmt = db.prepare(
              "UPDATE bnf_cmam SET reg_date = ?, curr_date = ?, reg_curr_days = ?, reg_curr_mon = ? WHERE id = ?"
            );
            db.transaction((rowsToUpdate: any[]) => {
              rowsToUpdate.forEach((record) => {
                const diffMs = currDateParsed.getTime() - regDateParsed.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                const diffMonths = diffDays / 30;
                updateDateStmt.run(
                  regDate,
                  currDate,
                  diffDays.toFixed(2),
                  diffMonths.toFixed(2),
                  record.id
                );
              });
            })(regRecords);
          }

          sendProgress(writer, {
            type: "progress",
            status: "STEP_FOUR",
            progress: 70,
            message: "Step Four: Calculated registration and current dates.",
            stats,
          });

          const ageRecords = db
            .prepare(`SELECT id, AGE_YEARS, reg_curr_mon FROM bnf_cmam WHERE project_id = ? AND ${ensureBenefClassFilter}`)
            .all(projectId);
          const updateAgeStmt = db.prepare(
            "UPDATE bnf_cmam SET bnf_age_mon = ?, new_bnf_age_mon = ?, new_bnf_age_years = ? WHERE id = ?"
          );
          db.transaction((rowsToUpdate: any[]) => {
            rowsToUpdate.forEach((record) => {
              const ageYears = Number(record.AGE_YEARS || 0);
              const regMonths = Number(record.reg_curr_mon || 0);
              const baseAgeMon = ageYears * 12;
              const newAgeMon = baseAgeMon + regMonths;
              const newAgeYears = newAgeMon / 12;
              updateAgeStmt.run(baseAgeMon.toFixed(2), newAgeMon.toFixed(2), newAgeYears.toFixed(2), record.id);
            });
          })(ageRecords);

          sendProgress(writer, {
            type: "progress",
            status: "STEP_FIVE",
            progress: 85,
            message: "Step Five: Computed beneficiary ages.",
            stats,
          });

          const qualRecords = db
            .prepare(`SELECT id, new_bnf_age_years FROM bnf_cmam WHERE project_id = ? AND ${ensureBenefClassFilter}`)
            .all(projectId);
          const updateQualStmt = db.prepare("UPDATE bnf_cmam SET cmam_qualify = ? WHERE id = ?");
          db.transaction((rowsToUpdate: any[]) => {
            rowsToUpdate.forEach((record) => {
              const newAge = Number(record.new_bnf_age_years || 0);
              const status = newAge <= 49 ? "Qualified" : "Disqualified";
              updateQualStmt.run(status, record.id);
            });
          })(qualRecords);

          sendProgress(writer, {
            type: "progress",
            status: "STEP_SIX",
            progress: 95,
            message: "Step Six: Assigned CMAM qualification.",
            stats,
          });

          const finalCounts = {
            totalBeneficiaries:
              db.prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ?").get(projectId).count,
            qualifiedBeneficiaries:
              db
                .prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ? AND BENEF_CLASS_DESC = 'مستفيدة'")
                .get(projectId).count,
            cmamQualified:
              db
                .prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ? AND cmam_qualify = 'Qualified'")
                .get(projectId).count,
            disqualifiedBeneficiaries:
              db
                .prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ? AND BENEF_CLASS_DESC != 'مستفيدة'")
                .get(projectId).count,
            cmamDisqualified:
              db
                .prepare("SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ? AND cmam_qualify = 'Disqualified'")
                .get(projectId).count,
          };

          sendProgress(writer, {
            type: "done",
            message: "Processing complete!",
            stats,
            results: finalCounts,
          });
        } catch (error: any) {
          sendProgress(writer, { type: "error", error: error.message || "Unknown error" });
        } finally {
          db.close();
          writer.close();
        }
      })();

      return response;
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[BNF_CMAM_API_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process bnf-cmam request.", details: error.message },
      { status: 500 }
    );
  }
}

    