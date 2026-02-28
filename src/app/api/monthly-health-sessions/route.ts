import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "monthly-health-sessions.db");
const getEnrollmentDbPath = () => path.join(getDataPath(), "enrollment-review.db");

const SESSION_BASE_COLUMNS = ["bnf_appear", "date_of_general", "attending", "absent", "absence_code", "absence_reason", "has_alternative", "date_of_alternative"];

const DB_COLUMNS_FOR_CREATION = `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT, project_name TEXT, ed_id TEXT, ec_id TEXT, ed_name TEXT, benef_id TEXT, bnf_name TEXT, bnf_vill TEXT, bnf_ozla TEXT, bnf_mud TEXT,
    ${Array.from({ length: 76 }, (_, i) => `
    bnf_appear_s${i + 1} INTEGER, date_of_general_s${i + 1} DATE, attending_s${i + 1} INTEGER, absent_s${i + 1} INTEGER, absence_code_s${i + 1} INTEGER, absence_reason_s${i + 1} TEXT, has_alternative_s${i + 1} INTEGER, date_of_alternative_s${i + 1} DATE
    `).join(",\n")},
    total_appear INTEGER, total_absence INTEGER, total_alternative INTEGER, data JSON
)`;

const allDbColumns = DB_COLUMNS_FOR_CREATION.replace(/[()]/g, "")
  .split(",")
  .map((s) => s.trim().split(/\s+/)[0])
  .filter(Boolean);

const validColumnsSet = new Set(allDbColumns);

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS monthly_sessions ${DB_COLUMNS_FOR_CREATION};`);
  return db;
}

const sanitizeColumn = (col?: string) => (col ? col.replace(/[^a-zA-Z0-9_]/g, "") : "");

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

type MappingEntry = {
  fileCol: string;
  dbCol: string;
  param: string;
};

const prepareMappingEntries = (mapping: Record<string, string> | undefined, allowedCols: Set<string>, excludedCols: Set<string>) => {
  const entries: MappingEntry[] = [];
  if (!mapping) return entries;
  let counter = 0;
  for (const [fileCol, dbColRaw] of Object.entries(mapping)) {
    if (!fileCol) continue;
    const sanitizedDbCol = sanitizeColumn(dbColRaw);
    if (!sanitizedDbCol) continue;
    if (!allowedCols.has(sanitizedDbCol)) continue;
    if (excludedCols.has(sanitizedDbCol)) continue;
    if (!validColumnsSet.has(sanitizedDbCol)) continue;
    entries.push({
      fileCol,
      dbCol: sanitizedDbCol,
      param: `param_${counter++}`,
    });
  }
  return entries;
};

const normalizeLookupValue = (value: any) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;
  try {
    await fs.mkdir(getDataPath(), { recursive: true });

    if (action === "get_schema") {
      const db = initializeDatabase();
      const tableInfo = db.prepare("PRAGMA table_info(monthly_sessions)").all();
      const columns = tableInfo.map((c: any) => c.name);
      db.close();
      return NextResponse.json({ columns });
    }

    if (action === "check_duplicates") {
      const { projectId, uniqueIds, uniqueIdCol } = body;
      if (!projectId || !uniqueIdCol || !Array.isArray(uniqueIds)) {
        return NextResponse.json({ error: "Missing parameters for duplicate check." }, { status: 400 });
      }
      const sanitizedColumn = sanitizeColumn(uniqueIdCol);
      if (!sanitizedColumn || !validColumnsSet.has(sanitizedColumn)) {
        return NextResponse.json({ error: "Invalid uniqueId column." }, { status: 400 });
      }
      let db: Database.Database | null = null;
      try {
        db = new Database(getDbPath(), { fileMustExist: true });
        const existingIds = new Set<string>();
        const chunks = chunkArray(uniqueIds, 900);
        for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          const placeholders = chunk.map(() => "?").join(",");
          const stmt = db.prepare(`SELECT "${sanitizedColumn}" FROM monthly_sessions WHERE project_id = ? AND "${sanitizedColumn}" IN (${placeholders})`);
          const results: any[] = stmt.all(projectId, ...chunk);
          results.forEach((row) => {
            const value = row[sanitizedColumn];
            if (value !== undefined && value !== null) {
              existingIds.add(String(value));
            }
          });
        }
        const tableTotalResult = db.prepare("SELECT COUNT(*) as total FROM monthly_sessions WHERE project_id = ?").get(projectId) as { total: number } | undefined;
        const totalInDb = tableTotalResult?.total || 0;
        return NextResponse.json({ count: existingIds.size, totalInDb, duplicateIds: Array.from(existingIds) });
      } catch (error: any) {
        if (error.code === "SQLITE_CANTOPEN") return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
        throw error;
      } finally {
        if (db) db.close();
      }
    }

    if (action === "save") {
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();
      const send = (data: any) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      (async () => {
        const {
          projectId,
          sessionNumber: rawSessionNumber,
          sessionDate,
          appearanceData,
          appearanceMapping,
          absenceData,
          absenceMapping,
          mode,
          duplicateIds = [],
          fileLookupColumn,
          dbLookupColumn,
        } = body;

        const sanitizedSessionNumber = Number(rawSessionNumber);
        if (!projectId || !sanitizedSessionNumber || sanitizedSessionNumber < 1 || sanitizedSessionNumber > 100) {
          send({ type: "error", error: "Missing or invalid project/session parameters." });
          writer.close();
          return;
        }

        const sanitizedLookupColumn = sanitizeColumn(dbLookupColumn || "");
        if (!sanitizedLookupColumn || !validColumnsSet.has(sanitizedLookupColumn)) {
          send({ type: "error", error: "Invalid lookup column." });
          writer.close();
          return;
        }

        const lookupKey = typeof fileLookupColumn === "string" ? fileLookupColumn.trim() : "";
        if (!lookupKey) {
          send({ type: "error", error: "Missing file lookup column." });
          writer.close();
          return;
        }

        const sessionDateValue = typeof sessionDate === "string" ? sessionDate.trim() : "";
        const duplicatesSet = new Set<string>(
          Array.isArray(duplicateIds)
            ? duplicateIds.map((id: any) => String(id ?? "").trim()).filter(Boolean)
            : []
        );

        const stats = { saved: 0, updated: 0, skipped: 0, total: 0 };
        const sessionSuffix = (base: string) => sanitizeColumn(`${base}_s${sanitizedSessionNumber}`);
        const sessionColumns = SESSION_BASE_COLUMNS.map((base) => sessionSuffix(base));
        const sessionColumnSet = new Set(sessionColumns);
        const bnfAppearColumn = sessionSuffix("bnf_appear");
        const generalDateColumn = sessionSuffix("date_of_general");
        const absenceCodeColumn = sessionSuffix("absence_code");
        const absentColumn = sessionSuffix("absent");
        const attendingColumn = sessionSuffix("attending");
        const alternativeColumn = sessionSuffix("date_of_alternative");

        let sessionDb: Database.Database | null = null;
        let enrollmentDb: Database.Database | null = null;

        try {
          sessionDb = initializeDatabase();

          send({ type: "progress", status: "FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE", progress: 10, message: "Initializing databases...", stats });

          const existingProjectRecordsStmt = sessionDb.prepare("SELECT COUNT(*) as count FROM monthly_sessions WHERE project_id = ?");
          const existingProjectRecords = existingProjectRecordsStmt.get(projectId) as { count: number } | undefined;
          const totalRecordsInDb = existingProjectRecords?.count || 0;

          if (totalRecordsInDb === 0 && mode !== "skip") {
            try {
              enrollmentDb = new Database(getEnrollmentDbPath(), { fileMustExist: true });
              const beneficiaries = enrollmentDb
                .prepare(
                  `
                  SELECT benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name, ec_id, project_name
                  FROM enrollment_data WHERE project_id = ?
                `
                )
                .all(projectId);

              const insertStmt = sessionDb.prepare(`
                INSERT OR IGNORE INTO monthly_sessions (project_id, project_name, benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name, ec_id)
                VALUES (@project_id, @project_name, @benef_id, @bnf_name, @bnf_vill, @bnf_ozla, @bnf_mud, @ed_id, @ed_name, @ec_id)
              `);

              const insertMany = sessionDb.transaction((bnfs: any[]) => {
                for (const bnf of bnfs) {
                  const info = insertStmt.run({ ...bnf, project_id: projectId });
                  stats.saved += info.changes;
                }
              });

              insertMany(beneficiaries);
              send({
                type: "progress",
                status: "FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE",
                progress: 20,
                message: `Seeded ${stats.saved} base records.`,
                stats,
              });
            } catch (seedError: any) {
              send({
                type: "progress",
                status: "FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE",
                progress: 20,
                message: "Enrollment DB not available. Skipping seeding.",
                stats,
              });
            }
          } else {
            send({
              type: "progress",
              status: "FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE",
              progress: 20,
              message: "Project already seeded or skipping seeding.",
              stats,
            });
          }

          const appearanceRows = Array.isArray(appearanceData) ? appearanceData : [];
          const absenceRows = Array.isArray(absenceData) ? absenceData : [];
          stats.total = appearanceRows.length + absenceRows.length;

          if (mode === "skip" && duplicatesSet.size > 0 && duplicatesSet.size === totalRecordsInDb && totalRecordsInDb > 0) {
            send({
              type: "progress",
              status: "SECOND_STEP_SAVING_BENEFICIARY_APPEARANCE",
              progress: 35,
              message: "All records already exist. No updates required.",
              stats,
            });
            const metrics = sessionDb
              .prepare(
                `
                SELECT
                  COUNT(CASE WHEN "${bnfAppearColumn}" = 1 THEN 1 END) AS totalAppearance,
                  SUM(CASE WHEN "${attendingColumn}" IS NOT NULL THEN COALESCE("${attendingColumn}", 0) ELSE 0 END) AS totalAttend,
                  SUM(CASE WHEN "${absentColumn}" IS NOT NULL THEN COALESCE("${absentColumn}", 0) ELSE 0 END) AS totalAbsence,
                  SUM(CASE WHEN "${alternativeColumn}" IS NOT NULL AND TRIM("${alternativeColumn}") != '' THEN 1 ELSE 0 END) AS totalAlternative
                FROM monthly_sessions
                WHERE project_id = @projectId
              `
              )
              .get({ projectId });
            send({
              type: "done",
              message: "No new records to process.",
              stats,
              metrics: {
                totalAppearance: metrics.totalAppearance || 0,
                totalAttend: metrics.totalAttend || 0,
                totalAbsence: metrics.totalAbsence || 0,
                totalAlternative: metrics.totalAlternative || 0,
              },
            });
            return;
          }

          send({
            type: "progress",
            status: "SECOND_STEP_SAVING_BENEFICIARY_APPEARANCE",
            progress: 30,
            message: "Processing appearance data...",
            stats,
          });

          const appearanceMappingEntries = prepareMappingEntries(appearanceMapping, sessionColumnSet, new Set([generalDateColumn, sanitizedLookupColumn, bnfAppearColumn]));
          const appearanceSetParts = [`"${bnfAppearColumn}" = 1`, ...appearanceMappingEntries.map((entry) => `"${entry.dbCol}" = @${entry.param}`)];
          const appearanceStmt = sessionDb.prepare(
            `UPDATE monthly_sessions SET ${appearanceSetParts.join(", ")} WHERE project_id = @projectId AND "${sanitizedLookupColumn}" = @lookupValue`
          );

          if (appearanceRows.length > 0) {
            const appearanceTransaction = sessionDb.transaction((rows: any[]) => {
              for (const row of rows) {
                const lookupValue = normalizeLookupValue(row[lookupKey]);
                if (!lookupValue) continue;
                if (mode === "skip" && duplicatesSet.has(lookupValue)) {
                  stats.skipped++;
                  continue;
                }
                const params: Record<string, any> = { projectId, lookupValue };
                appearanceMappingEntries.forEach((entry) => {
                  params[entry.param] = row[entry.fileCol] ?? null;
                });
                const info = appearanceStmt.run(params);
                stats.updated += info.changes;
              }
            });
            appearanceTransaction(appearanceRows);
          }

          send({
            type: "progress",
            status: "SECOND_STEP_SAVING_BENEFICIARY_APPEARANCE",
            progress: 40,
            message: "Appearance data processed.",
            stats,
          });

          send({
            type: "progress",
            status: "THIRD_STEP_SAVING_GENERAL_SESSIONS_DATE",
            progress: 50,
            message: sessionDateValue ? "Recording session date." : "Session date missing. Skipping date update.",
            stats,
          });

          if (sessionDateValue) {
            const generalDateStmt = sessionDb.prepare(
              `UPDATE monthly_sessions SET "${generalDateColumn}" = ? WHERE project_id = ? AND "${bnfAppearColumn}" = 1`
            );
            const info = generalDateStmt.run(sessionDateValue, projectId);
            stats.updated += info.changes;
          }

          send({
            type: "progress",
            status: "FOURTH_STEP_SAVING_BENEFICIARY_ABSENCE",
            progress: 60,
            message: "Processing absence data...",
            stats,
          });

          const absenceMappingEntries = prepareMappingEntries(absenceMapping, sessionColumnSet, new Set([generalDateColumn, sanitizedLookupColumn, bnfAppearColumn]));
          const absenceSetParts = absenceMappingEntries.map((entry) => `"${entry.dbCol}" = @${entry.param}`);
          if (absenceMappingEntries.length > 0 && absenceRows.length > 0) {
            const absenceStmt = sessionDb.prepare(
              `UPDATE monthly_sessions SET ${absenceSetParts.join(", ")} WHERE project_id = @projectId AND "${sanitizedLookupColumn}" = @lookupValue`
            );
            const absenceTransaction = sessionDb.transaction((rows: any[]) => {
              for (const row of rows) {
                const lookupValue = normalizeLookupValue(row[lookupKey]);
                if (!lookupValue) continue;
                if (mode === "skip" && duplicatesSet.has(lookupValue)) {
                  stats.skipped++;
                  continue;
                }
                const params: Record<string, any> = { projectId, lookupValue };
                absenceMappingEntries.forEach((entry) => {
                  params[entry.param] = row[entry.fileCol] ?? null;
                });
                const info = absenceStmt.run(params);
                stats.updated += info.changes;
              }
            });
            absenceTransaction(absenceRows);
          }

          send({
            type: "progress",
            status: "FIFTH_STEP_SAVING_ABSENTEES",
            progress: 80,
            message: "Marking absentees.",
            stats,
          });

          const markAbsenteesStmt = sessionDb.prepare(
            `UPDATE monthly_sessions SET "${absentColumn}" = 1 WHERE project_id = ? AND "${absenceCodeColumn}" IS NOT NULL AND "${absenceCodeColumn}" != ''`
          );
          const absInfo = markAbsenteesStmt.run(projectId);
          stats.updated += absInfo.changes;

          send({
            type: "progress",
            status: "SIXTH_STEP_SAVING_ATTENDANCE",
            progress: 90,
            message: "Adjusting attendance after absence data.",
            stats,
          });

          const resetAttendanceStmt = sessionDb.prepare(
            `UPDATE monthly_sessions SET "${attendingColumn}" = 0 WHERE project_id = ? AND "${absentColumn}" = 1`
          );
          const resetInfo = resetAttendanceStmt.run(projectId);
          stats.updated += resetInfo.changes;

          const setAttendanceStmt = sessionDb.prepare(
            `UPDATE monthly_sessions SET "${attendingColumn}" = 1 WHERE project_id = ? AND "${bnfAppearColumn}" = 1 AND ("${attendingColumn}" IS NULL OR "${attendingColumn}" != 0)`
          );
          const setInfo = setAttendanceStmt.run(projectId);
          stats.updated += setInfo.changes;

          const metrics = sessionDb
            .prepare(
              `
              SELECT
                COUNT(CASE WHEN "${bnfAppearColumn}" = 1 THEN 1 END) AS totalAppearance,
                SUM(CASE WHEN "${attendingColumn}" IS NOT NULL THEN COALESCE("${attendingColumn}", 0) ELSE 0 END) AS totalAttend,
                SUM(CASE WHEN "${absentColumn}" IS NOT NULL THEN COALESCE("${absentColumn}", 0) ELSE 0 END) AS totalAbsence,
                SUM(CASE WHEN "${alternativeColumn}" IS NOT NULL AND TRIM("${alternativeColumn}") != '' THEN 1 ELSE 0 END) AS totalAlternative
              FROM monthly_sessions
              WHERE project_id = @projectId
            `
            )
            .get({ projectId });

          send({
            type: "done",
            message: "Processing complete!",
            stats,
            metrics: {
              totalAppearance: metrics.totalAppearance || 0,
              totalAttend: metrics.totalAttend || 0,
              totalAbsence: metrics.totalAbsence || 0,
              totalAlternative: metrics.totalAlternative || 0,
            },
          });
        } catch (error: any) {
          send({ type: "error", error: error.message || "An unknown error occurred" });
        } finally {
          if (sessionDb) sessionDb.close();
          if (enrollmentDb) enrollmentDb.close();
          writer.close();
        }
      })();

      return new Response(stream.readable, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[MONTHLY_SESSIONS_API_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process request.", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = initializeDatabase();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    let records;
    if (projectId && projectId !== "all") {
      records = db.prepare("SELECT * FROM monthly_sessions WHERE project_id = ?").all(projectId);
    } else {
      records = db.prepare("SELECT * FROM monthly_sessions").all();
    }
    db.close();
    return NextResponse.json(records);
  } catch (err: any) {
    if (err?.code === "SQLITE_CANTOPEN") {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: "Failed to fetch session data", details: err?.message }, { status: 500 });
  }
}