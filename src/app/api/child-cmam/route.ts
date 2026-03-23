import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";
import dayjs from "dayjs";
import { WritableStreamDefaultWriter } from "stream/web";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "child-CMAM.db");
const getBnfCmamDbPath = () => path.join(getDataPath(), "bnf-CMAM.db");
const getProjectsDbPath = () => path.join(getDataPath(), "projects.db");

const DB_SCHEMA = `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,
  project_name TEXT,
  child_idx TEXT,
  child_id TEXT,
  child_first_name TEXT,
  child_name TEXT,
  woman_id TEXT,
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
  reg_curr_days TEXT,
  reg_curr_mon TEXT,
  new_child_age_mon TEXT,
  new_child_age_years TEXT,
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
  muac_hc REAL,
  zscore_h REAL,
  zscore_w REAL,
  zscore REAL,
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
  zscore_h_c1 REAL,
  zscore_w_c1 REAL,
  zscore_c1 REAL,
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
  meas_type_c2 TEXT,
  muac_c2 REAL,
  zscore_h_c2 REAL,
  zscore_w_c2 REAL,
  zscore_c2 REAL,
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
  zscore_h_c3 REAL,
  zscore_w_c3 REAL,
  zscore_c3 REAL,
  cmam_result_c3 TEXT,
  not_attend_reason_c3 TEXT,
  child_age_c3 TEXT,
  cure_rate_c3 TEXT,
  positive_c3 TEXT,
  negative_c3 TEXT,
  next_cycle_c3 TEXT,
  data JSON
)`;

const columnDefs = DB_SCHEMA.replace(/[()]/g, "").split(",").map((s) =>
  s.trim().split(/\s+/)[0].replace(/"/g, "")
);
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

const parseDate = (value?: string) => {
  if (!value) return null;
  const date = dayjs(value);
  return date.isValid() ? date : null;
};

const normalizeBenefNoValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "";
  const stringValue = String(value).trim();
  return stringValue.replace(/\.0+$/, "");
};

export async function POST(req: Request) {
  await fs.mkdir(getDataPath(), { recursive: true });
  const body = await req.json();
  const { action } = body;

  try {
    if (action === "get_schema") {
      return NextResponse.json({
        columns: DB_COLUMNS,
        schema: DB_COLUMNS,
      });
    }

    if (action === "check_duplicates") {
      const { projectId, records, benefNoCol, childIdxCol } = body;
      if (!projectId || !Array.isArray(records) || !benefNoCol || !childIdxCol) {
        return NextResponse.json(
          { error: "Missing parameters for duplicate check." },
          { status: 400 }
        );
      }

      let db: Database.Database | null = null;
      try {
        db = initializeDatabase();

        const totalInDb = (
          db.prepare(
            "SELECT COUNT(*) as count FROM child_cmam WHERE project_id = ?"
          ).get(projectId) as { count: number }
        ).count;

        const uniqueIds = records
          .map((r: any) => `${normalizeBenefNoValue(r[benefNoCol])}${String(r[childIdxCol] ?? "")}`)
          .filter(Boolean);

        if (uniqueIds.length === 0) {
          return NextResponse.json({
            count: 0,
            totalInDb: totalInDb,
            duplicateIds: [],
          });
        }

        const placeholders = uniqueIds.map(() => "?").join(",");
        const stmt = db.prepare(
          `SELECT child_id FROM child_cmam WHERE project_id = ? AND child_id IN (${placeholders})`
        );
        const existingRows = stmt.all(projectId, ...uniqueIds);
        const duplicateIds = existingRows.map((r: any) => r.child_id);

        return NextResponse.json({
          count: duplicateIds.length,
          totalInDb,
          duplicateIds,
        });
      } catch (e: any) {
        throw e;
      } finally {
        if (db) db.close();
      }
    }

    if (action === "save") {
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      (async () => {
        const {
          projectId,
          records,
          mapping,
          benefNoCol,
          childIdxCol,
          mode,
          duplicateIds = [],
        } = body;
        const uniqueIdCol = "child_id";
        const duplicateIdSet = new Set(duplicateIds);

        let childDb: Database.Database | null = null;
        let bnfCmamDb: Database.Database | null = null;
        let projectsDb: Database.Database | null = null;

        try {
          sendProgress(writer, {
            type: "progress",
            status: "STEP_ONE",
            progress: 10,
            message: "Ensuring schema...",
          });

          childDb = initializeDatabase();
          bnfCmamDb = new Database(getBnfCmamDbPath(), { fileMustExist: true });
          projectsDb = new Database(getProjectsDbPath(), { fileMustExist: true });

          const bnfMap = new Map(
            bnfCmamDb
              .prepare("SELECT * FROM bnf_cmam WHERE project_id = ?")
              .all(projectId)
              .map((b: any) => [String(b.WOMAN_ID), b])
          );
          const project = projectsDb
            .prepare("SELECT projectName FROM projects WHERE projectId = ?")
            .get(projectId);

          sendProgress(writer, {
            type: "progress",
            status: "STEP_TWO",
            progress: 30,
            message: "Mapping records...",
          });

          const processedRecords = records.map((row: any) => {
            const mapped: Record<string, any> = {
              project_id: projectId,
              project_name: project?.projectName || "",
            };
            for (const [uiCol, dbCol] of Object.entries(mapping)) {
              if (row[uiCol] !== undefined) {
                const rawValue = row[uiCol];
                mapped[dbCol] =
                  dbCol === "benef_no" ? normalizeBenefNoValue(rawValue) : rawValue;
              }
            }
            const benefNo = normalizeBenefNoValue(row[benefNoCol]);
            const childIdx = String(row[childIdxCol] ?? "");
            const benefRecord = bnfMap.get(benefNo);

            if (benefRecord) {
              mapped.benef_id = benefRecord.BENEF_ID;
              mapped.bnf_name = benefRecord.BENEF_NAME;
              mapped.hsbnd_name = benefRecord.HUSBAND_NAME;
              mapped.ed_id = benefRecord.ED_ID;
              mapped.ed_name = benefRecord.ED_NAME;
              mapped.ed_phone = benefRecord.ed_phone;
              mapped.gov_name = benefRecord.GOV_NAME;
              mapped.mud_name = benefRecord.MUD_NAME;
              mapped.ozla_name = benefRecord.OZLA_NAME;
              mapped.vill_name = benefRecord.VILL_NAME;
              mapped.BENEF_CLASS_DESC = benefRecord.BENEF_CLASS_DESC;
              mapped.reg_date = benefRecord.reg_date;
              mapped.curr_date = benefRecord.curr_date;

              const regDate = parseDate(mapped.reg_date);
              const currDate = parseDate(mapped.curr_date);

              if (regDate && currDate && benefRecord.BENEF_CLASS_DESC === "مستفيدة") {
                const diffDays = currDate.diff(regDate, "day");
                const diffMonths = diffDays / 30;
                mapped.reg_curr_days = diffDays.toString();
                mapped.reg_curr_mon = diffMonths.toString();
                mapped.new_child_age_mon =
                  Number(mapped.child_age_mon) + diffMonths || diffMonths;
                mapped.new_child_age_years =
                  Number(mapped.new_child_age_mon) / 12 || 0;
                mapped.cmam_qualify =
                  mapped.new_child_age_years < 5 ? "Qualified" : "Disqualified";
              }
            }

            mapped.child_id = `${benefNo}${childIdx}`;
            mapped.benef_no = benefNo; // Ensure benef_no itself is normalized
            mapped.old_new_child = "old";
            mapped.data = JSON.stringify(row);
            return mapped;
          });

          sendProgress(writer, {
            type: "progress",
            status: "STEP_THREE",
            progress: 65,
            message: "Preparing database statements...",
          });

          const insertCols = DB_COLUMNS.filter((c) => c !== "id");
          const insertPlaceholders = insertCols.map((c) => `@${c}`).join(", ");
          const updateAssignments = insertCols
            .filter((c) => c !== uniqueIdCol)
            .map((c) => `"${c}" = @${c}`)
            .join(", ");

          const insertStmt = childDb.prepare(
            `INSERT INTO child_cmam (${insertCols.map((c) => `"${c}"`).join(", ")}) VALUES (${insertPlaceholders})`
          );
          const updateStmt = childDb.prepare(
            `UPDATE child_cmam SET ${updateAssignments} WHERE "${uniqueIdCol}" = @${uniqueIdCol}`
          );

          const stats = { saved: 0, updated: 0, skipped: 0 };

          sendProgress(writer, {
            type: "progress",
            status: "STEP_FOUR",
            progress: 80,
            message: "Committing records...",
          });

          const transaction = childDb.transaction(() => {
            for (const record of processedRecords) {
              const uid = record[uniqueIdCol];
              if (mode === "skip" && duplicateIdSet.has(uid)) {
                stats.skipped++;
                continue;
              }

              const payload: Record<string, any> = {};
              insertCols.forEach((col) => {
                payload[col] = record[col] ?? null;
              });

              if (duplicateIdSet.has(uid)) {
                const info = updateStmt.run(payload);
                stats.updated += info.changes > 0 ? 1 : 0;
              } else {
                const info = insertStmt.run(payload);
                stats.saved += info.changes > 0 ? 1 : 0;
              }
            }
          });

          transaction();

          sendProgress(writer, {
            type: "progress",
            status: "STEP_FIVE",
            progress: 95,
            message: "Finalizing...",
            stats,
          });

          const results = {
            totalChildren: processedRecords.length,
            qualifiedBeneficiaries: processedRecords.filter(
              (r) => r.BENEF_CLASS_DESC === "مستفيدة"
            ).length,
            cmamQualified: processedRecords.filter(
              (r) => r.cmam_qualify === "Qualified"
            ).length,
            disqualifiedBeneficiaries: processedRecords.filter(
              (r) => r.BENEF_CLASS_DESC !== "مستفيدة"
            ).length,
            cmamDisqualified: processedRecords.filter(
              (r) => r.cmam_qualify === "Disqualified"
            ).length,
          };

          sendProgress(writer, {
            type: "done",
            status: "done",
            progress: 100,
            stats,
            results,
          });
        } catch (err: any) {
          sendProgress(writer, { type: "error", error: err.message });
        } finally {
          childDb?.close();
          bnfCmamDb?.close();
          projectsDb?.close();
          writer.close();
        }
      })();

      return new Response(stream.readable, {
        headers: { "Content-Type": "text/event-stream" },
      });
    }

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
