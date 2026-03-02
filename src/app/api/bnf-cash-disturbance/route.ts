// src/app/api/bnf-cash-disturbance/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-cash-distrubance.db");
const getEnrollmentDbPath = () => path.join(getDataPath(), "enrollment-review.db");

const CYCLE_COUNT = 76;
const cycleFields = [
  { name: "is_pay_list", type: "INTEGER" },
  { name: "pay_cyc_cnt", type: "INTEGER" },
  { name: "pay_cyc_mon_list", type: "TEXT" },
  { name: "pay_amt", type: "INTEGER" },
  { name: "is_cashed", type: "INTEGER" },
  { name: "cashed_amt", type: "INTEGER" },
  { name: "is_uncashed", type: "INTEGER" },
  { name: "uncashed_amt", type: "INTEGER" },
  { name: "uncashed_code", type: "INTEGER" },
  { name: "uncashed_reason", type: "TEXT" },
  { name: "recom", type: "TEXT" },
];
const cycleColumnEntries = Array.from({ length: CYCLE_COUNT }, (_, idx) => {
  const cycle = idx + 1;
  return cycleFields.map((field) => `  ${field.name}_s${cycle} ${field.type}`).join(",\n");
});
const TABLE_SCHEMA = `(
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,
  project_name TEXT,
  benef_id TEXT,
  bnf_name TEXT,
  bnf_vill TEXT,
  bnf_ozla TEXT,
  bnf_mud TEXT,
  ed_id TEXT,
  ed_name TEXT,
  pc_id TEXT,
  pc_name TEXT,
${cycleColumnEntries.join(",\n")},
  total_pay_list INTEGER,
  total_pay_cyc_cnt INTEGER,
  total_pay_amt INTEGER,
  total_cashed_cnt INTEGER,
  total_cashed_amt INTEGER,
  total_uncashed_cnt INTEGER,
  total_uncashed_amt INTEGER,
  final_comments TEXT,
  data JSON
)`;
const BASE_COLUMNS = [
  "project_id",
  "project_name",
  "benef_id",
  "bnf_name",
  "bnf_vill",
  "bnf_ozla",
  "bnf_mud",
  "ed_id",
  "ed_name",
  "pc_id",
  "pc_name",
  "total_pay_list",
  "total_pay_cyc_cnt",
  "total_pay_amt",
  "total_cashed_cnt",
  "total_cashed_amt",
  "total_uncashed_cnt",
  "total_uncashed_amt",
  "final_comments",
  "data",
];
const cycleColumnNames = Array.from({ length: CYCLE_COUNT }, (_, idx) => {
  const cycle = idx + 1;
  return cycleFields.map((field) => `${field.name}_s${cycle}`);
}).flat();
const ALL_COLUMNS = ["Id", ...BASE_COLUMNS, ...cycleColumnNames];
const VALID_COLUMNS_SET = new Set(ALL_COLUMNS);
const sanitizeColumn = (col?: string) => (col ? col.replace(/[^a-zA-Z0-9_]/g, "") : "");
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};
const normalizeLookupValue = (value: any) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};
const getCycleColumn = (field: string, cycle: number) => `${field}_s${cycle}`;
const prepareMappingEntries = (mapping: Record<string, string> = {}, allowed: Set<string>) => {
  const entries: { fileCol: string; dbCol: string; param: string }[] = [];
  let counter = 0;
  for (const [fileCol, dbColRaw] of Object.entries(mapping)) {
    const sanitized = sanitizeColumn(dbColRaw);
    if (!sanitized) continue;
    if (!allowed.has(sanitized)) continue;
    entries.push({ fileCol, dbCol: sanitized, param: `param_${counter++}` });
  }
  return entries;
};
function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS bnf_cash_distrubance ${TABLE_SCHEMA};`);
  return db;
}

export async function GET(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = initializeDatabase();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    let records;
    if (projectId && projectId !== "all") {
      records = db.prepare("SELECT * FROM bnf_cash_distrubance WHERE project_id = ?").all(projectId);
    } else {
      records = db.prepare("SELECT * FROM bnf_cash_distrubance").all();
    }
    db.close();
    return NextResponse.json(records);
  } catch (err: any) {
    if (err?.code === "SQLITE_CANTOPEN") {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: "Failed to fetch data", details: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    if (action === "schema") {
      const db = initializeDatabase();
      const tableInfo = db.prepare("PRAGMA table_info(bnf_cash_distrubance)").all();
      db.close();
      return NextResponse.json({ columns: tableInfo.map((col: any) => col.name) });
    }
    if (action === "check_duplicates") {
      const { projectId, uniqueIds, uniqueIdCol } = body;
      if (!projectId || !uniqueIdCol || !Array.isArray(uniqueIds)) {
        return NextResponse.json({ error: "Missing parameters for duplicate check." }, { status: 400 });
      }
      const lookupColumn = sanitizeColumn(uniqueIdCol);
      if (!lookupColumn || !VALID_COLUMNS_SET.has(lookupColumn)) {
        return NextResponse.json({ error: "Invalid lookup column" }, { status: 400 });
      }
      let db: Database.Database | null = null;
      try {
        db = new Database(getDbPath(), { fileMustExist: true });
        const existingIds = new Set<string>();
        const chunks = chunkArray(uniqueIds, 900);
        for (const chunk of chunks) {
          if (!chunk.length) continue;
          const placeholders = chunk.map(() => "?").join(",");
          const stmt = db.prepare(
            `SELECT "${lookupColumn}" FROM bnf_cash_distrubance WHERE project_id = ? AND "${lookupColumn}" IN (${placeholders})`
          );
          const results: any[] = stmt.all(projectId, ...chunk);
          results.forEach((row) => {
            const value = row[lookupColumn];
            if (value !== undefined && value !== null) {
              existingIds.add(String(value));
            }
          });
        }
        const totalInDb = db.prepare("SELECT COUNT(*) as total FROM bnf_cash_distrubance WHERE project_id = ?").get(projectId)?.total || 0;
        return NextResponse.json({ count: existingIds.size, totalInDb, duplicateIds: Array.from(existingIds) });
      } catch (error: any) {
        if (error.code === "SQLITE_CANTOPEN") return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
        throw error;
      } finally {
        if (db) db.close();
      }
    }
    if (action === "update_record") {
      const { id, payload } = body;
      if (!id || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid payload for update." }, { status: 400 });
      }
      const db = initializeDatabase();
      const entries = [];
      const values: any[] = [];
      for (const [col, value] of Object.entries(payload)) {
        const sanitized = sanitizeColumn(col);
        if (!sanitized || sanitized === "Id" || sanitized === "id") continue;
        if (!VALID_COLUMNS_SET.has(sanitized)) continue;
        entries.push(`"${sanitized}" = ?`);
        values.push(value);
      }
      if (!entries.length) {
        db.close();
        return NextResponse.json({ error: "No valid columns to update." }, { status: 400 });
      }
      const stmt = db.prepare(`UPDATE bnf_cash_distrubance SET ${entries.join(", ")} WHERE Id = ?`);
      stmt.run(...values, id);
      db.close();
      return NextResponse.json({ success: true });
    }
    if (action === "delete_record") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: "Missing id for deletion." }, { status: 400 });
      }
      const db = initializeDatabase();
      db.prepare("DELETE FROM bnf_cash_distrubance WHERE Id = ?").run(id);
      db.close();
      return NextResponse.json({ success: true });
    }
    if (action === "save") {
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();
      const send = (data: any) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      (async () => {
        const {
          projectId,
          projectName,
          paymentCycle,
          paymentCycleCount,
          paymentMonths = [],
          paymentData = [],
          uncashedData = [],
          paymentMapping = {},
          uncashedMapping = {},
          uniqueFileColumn,
          uniqueDbColumn,
          mode,
          duplicateIds = [],
        } = body;
        const cycleNumber = Number(paymentCycle);
        if (!projectId || !cycleNumber || cycleNumber < 1 || cycleNumber > CYCLE_COUNT) {
          send({ type: "error", error: "Missing project or invalid cycle." });
          writer.close();
          return;
        }
        const lookupColumn = sanitizeColumn(uniqueDbColumn);
        if (!lookupColumn || !VALID_COLUMNS_SET.has(lookupColumn)) {
          send({ type: "error", error: "Invalid lookup column." });
          writer.close();
          return;
        }
        const lookupFileColumn = typeof uniqueFileColumn === "string" ? uniqueFileColumn : "";
        if (!lookupFileColumn) {
          send({ type: "error", error: "Missing lookup column from uploaded file." });
          writer.close();
          return;
        }
        const duplicatesSet = new Set<string>(Array.isArray(duplicateIds) ? duplicateIds.map((id: any) => String(id ?? "").trim()).filter(Boolean) : []);
        const stats = { saved: 0, updated: 0, skipped: 0, total: (Array.isArray(paymentData) ? paymentData.length : 0) + (Array.isArray(uncashedData) ? uncashedData.length : 0) };
        let sessionDb: Database.Database | null = null;
        let enrollmentDb: Database.Database | null = null;
        try {
          sessionDb = initializeDatabase();
          send({
            type: "progress",
            status: "FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE",
            progress: 10,
            message: "Preparing enrollment base data",
            stats,
          });
          const existingProjectRecords = sessionDb.prepare("SELECT COUNT(*) as count FROM bnf_cash_distrubance WHERE project_id = ?").get(projectId)?.count || 0;
          if (existingProjectRecords === 0 && mode !== "skip") {
            try {
              enrollmentDb = new Database(getEnrollmentDbPath(), { fileMustExist: true });
              const beneficiaries = enrollmentDb
                .prepare(`
                  SELECT benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name, project_name 
                  FROM enrollment_data WHERE project_id = ?
                `)
                .all(projectId);
              const insertStmt = sessionDb.prepare(`
                INSERT OR IGNORE INTO bnf_cash_distrubance (project_id, project_name, benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name)
                VALUES (@project_id, @project_name, @benef_id, @bnf_name, @bnf_vill, @bnf_ozla, @bnf_mud, @ed_id, @ed_name)
              `);
              const seedTransaction = sessionDb.transaction((records: any[]) => {
                for (const record of records) {
                  const info = insertStmt.run({
                    project_id: projectId,
                    project_name: projectName || record.project_name,
                    benef_id: record.benef_id,
                    bnf_name: record.bnf_name,
                    bnf_vill: record.bnf_vill,
                    bnf_ozla: record.bnf_ozla,
                    bnf_mud: record.bnf_mud,
                    ed_id: record.ed_id,
                    ed_name: record.ed_name,
                  });
                  stats.saved += info.changes;
                }
              });
              seedTransaction(beneficiaries);
              send({
                type: "progress",
                status: "FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE",
                progress: 20,
                message: `Seeded ${stats.saved} base records.`,
                stats,
              });
            } catch (_) {
              send({
                type: "progress",
                status: "FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE",
                progress: 20,
                message: "Enrollment database unavailable. Skipping seeding.",
                stats,
              });
            }
          } else {
            send({
              type: "progress",
              status: "FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE",
              progress: 20,
              message: "Existing project records found or skip mode active.",
              stats,
            });
          }
          const cycleSuffix = `s${cycleNumber}`;
          const paymentEntries = prepareMappingEntries(paymentMapping, new Set([...BASE_COLUMNS, ...cycleColumnNames, "pc_id", "pc_name", "project_id", "project_name"]));
          const uncashedEntries = prepareMappingEntries(uncashedMapping, new Set([...BASE_COLUMNS, ...cycleColumnNames, "pc_id", "pc_name", "project_id", "project_name"]));
          const isPayListCol = getCycleColumn("is_pay_list", cycleNumber);
          const payCycCntCol = getCycleColumn("pay_cyc_cnt", cycleNumber);
          const payCycMonCol = getCycleColumn("pay_cyc_mon_list", cycleNumber);
          const payAmtCol = getCycleColumn("pay_amt", cycleNumber);
          const isCashedCol = getCycleColumn("is_cashed", cycleNumber);
          const cashedAmtCol = getCycleColumn("cashed_amt", cycleNumber);
          const isUncashedCol = getCycleColumn("is_uncashed", cycleNumber);
          const cycleMonthsValue = Array.isArray(paymentMonths) ? paymentMonths.join(", ") : "";
          send({
            type: "progress",
            status: "SECOND_STEP_SAVING_PAYMENT_CYCLE_LIST",
            progress: 30,
            message: "Processing payment list rows.",
            stats,
          });
          const paymentStmt = sessionDb.prepare(
            `UPDATE bnf_cash_distrubance SET "project_id" = @projectId, "project_name" = @projectName, "${isPayListCol}" = 1, "${payCycCntCol}" = @cycleCount, "${payCycMonCol}" = @cycleMonths${paymentEntries
              .map((entry) => `, "${entry.dbCol}" = @${entry.param}`)
              .join("")} WHERE "${lookupColumn}" = @lookupValue AND project_id = @projectId`
          );
          const paymentTransaction = sessionDb.transaction((rows: any[]) => {
            for (const row of rows) {
              const rawLookup = normalizeLookupValue(row[lookupFileColumn]);
              if (!rawLookup) continue;
              if (mode === "skip" && duplicatesSet.has(rawLookup)) {
                stats.skipped++;
                continue;
              }
              const params: Record<string, any> = {
                projectId,
                projectName: projectName || "",
                cycleCount: paymentCycleCount ?? 0,
                cycleMonths: cycleMonthsValue,
                lookupValue: rawLookup,
              };
              paymentEntries.forEach((entry) => {
                params[entry.param] = row[entry.fileCol] ?? null;
              });
              const info = paymentStmt.run(params);
              stats.updated += info.changes;
            }
          });
          paymentTransaction(paymentData);
          send({
            type: "progress",
            status: "THIRD_STEP_SAVING_PAYMENT_CYCLE_COUNT",
            progress: 40,
            message: "Payment list data saved.",
            stats,
          });
          send({
            type: "progress",
            status: "FOURTH_STEP_SAVING_PAYMENT_CYCLE_MONTHS",
            progress: 50,
            message: "Payment cycle months recorded.",
            stats,
          });
          send({
            type: "progress",
            status: "FIFTH_STEP_SAVING_UNCASHED_LIST",
            progress: 60,
            message: "Processing uncashed list rows.",
            stats,
          });
          if (uncashedEntries.length > 0) {
            const uncashedStmt = sessionDb.prepare(
              `UPDATE bnf_cash_distrubance SET "project_id" = @projectId, "project_name" = @projectName${uncashedEntries
                .map((entry) => `, "${entry.dbCol}" = @${entry.param}`)
                .join("")} WHERE "${lookupColumn}" = @lookupValue AND project_id = @projectId`
            );
            const uncashedTransaction = sessionDb.transaction((rows: any[]) => {
              for (const row of rows) {
                const rawLookup = normalizeLookupValue(row[lookupFileColumn]);
                if (!rawLookup) continue;
                if (mode === "skip" && duplicatesSet.has(rawLookup)) {
                  stats.skipped++;
                  continue;
                }
                const params: Record<string, any> = { projectId, projectName: projectName || "", lookupValue: rawLookup };
                uncashedEntries.forEach((entry) => {
                  params[entry.param] = row[entry.fileCol] ?? null;
                });
                const info = uncashedStmt.run(params);
                stats.updated += info.changes;
              }
            });
            uncashedTransaction(uncashedData);
          }
          send({
            type: "progress",
            status: "SIXTH_STEP_SAVING_CASHED_DATA",
            progress: 75,
            message: "Synchronizing cashed data.",
            stats,
          });
          const markCashedStmt = sessionDb.prepare(
            `UPDATE bnf_cash_distrubance SET "${isCashedCol}" = 1, "${cashedAmtCol}" = COALESCE("${payAmtCol}", 0)
             WHERE project_id = ? AND "${isPayListCol}" = 1 AND "${isUncashedCol}" IS NOT NULL AND "${isUncashedCol}" != ''`
          );
          const cashedInfo = markCashedStmt.run(projectId);
          stats.updated += cashedInfo.changes;
          const allRows = sessionDb.prepare("SELECT * FROM bnf_cash_distrubance WHERE project_id = ?").all(projectId);
          const totalsStmt = sessionDb.prepare(
            `UPDATE bnf_cash_distrubance SET total_pay_list = @total_pay_list, total_pay_cyc_cnt = @total_pay_cyc_cnt, total_pay_amt = @total_pay_amt,
             total_cashed_cnt = @total_cashed_cnt, total_cashed_amt = @total_cashed_amt, total_uncashed_cnt = @total_uncashed_cnt,
             total_uncashed_amt = @total_uncashed_amt, final_comments = @final_comments WHERE Id = @Id`
          );
          const totalsTransaction = sessionDb.transaction((records: any[]) => {
            for (const row of records) {
              let totalPayList = 0;
              let totalPayCycCnt = 0;
              let totalPayAmt = 0;
              let totalCashedCnt = 0;
              let totalCashedAmt = 0;
              let totalUncashedCnt = 0;
              let totalUncashedAmt = 0;
              let finalComments = row.final_comments || "";
              let hasTawrid = false;
              for (let cycle = 1; cycle <= CYCLE_COUNT; cycle++) {
                const suf = `s${cycle}`;
                const recomValue = normalizeLookupValue(row[`recom_${suf}`]);
                const recomAllowed = !recomValue || recomValue === "يعاد الصرف للحالة";
                if (recomValue === "تورد الى حساب الممول") {
                  hasTawrid = true;
                  if (!finalComments) {
                    const monthValue = row[`pay_cyc_mon_list_${suf}`] || "";
                    const reasonValue = row[`uncashed_reason_${suf}`] || "";
                    finalComments = `تم توريد مرتجع المستفيدة إلى حساب الممول في دفعة شهر ${monthValue} وذلك بسبب ${reasonValue}`;
                  }
                }
                const isPayValue = Number(row[`is_pay_list_${suf}`] ?? 0);
                const payCntValue = Number(row[`pay_cyc_cnt_${suf}`] ?? 0);
                const payAmtValue = Number(row[`pay_amt_${suf}`] ?? 0);
                const isCashedValue = Number(row[`is_cashed_${suf}`] ?? 0);
                const cashedAmtValue = Number(row[`cashed_amt_${suf}`] ?? 0);
                const isUncashedValue = Number(row[`is_uncashed_${suf}`] ?? 0);
                const uncashedAmtValue = Number(row[`uncashed_amt_${suf}`] ?? 0);
                totalPayList += isPayValue;
                totalPayCycCnt += payCntValue;
                totalPayAmt += payAmtValue;
                totalCashedCnt += isCashedValue;
                totalCashedAmt += cashedAmtValue;
                if (!hasTawrid && recomAllowed) {
                  totalUncashedCnt += isUncashedValue;
                  totalUncashedAmt += uncashedAmtValue;
                }
              }
              if (totalPayList === totalCashedCnt) {
                totalUncashedCnt = 0;
                totalUncashedAmt = 0;
              }
              if (hasTawrid) {
                totalUncashedCnt = 0;
                totalUncashedAmt = 0;
              }
              totalsStmt.run({
                total_pay_list: totalPayList,
                total_pay_cyc_cnt: totalPayCycCnt,
                total_pay_amt: totalPayAmt,
                total_cashed_cnt: totalCashedCnt,
                total_cashed_amt: totalCashedAmt,
                total_uncashed_cnt: totalUncashedCnt,
                total_uncashed_amt: totalUncashedAmt,
                final_comments: finalComments,
                Id: row.Id,
              });
            }
          });
          totalsTransaction(allRows);
          stats.updated += allRows.length;
          send({
            type: "progress",
            status: "SEVENTH_STEP_SAVING_TOTAL_VALUES",
            progress: 95,
            message: "Aggregating totals.",
            stats,
          });
          const metrics = {
            paymentCycles: Array.from({ length: CYCLE_COUNT }, (_, idx) => idx + 1).filter((cycle) => {
              const column = getCycleColumn("is_pay_list", cycle);
              return allRows.some((row) => Number(row[column] ?? 0) === 1);
            }).length,
            totalBeneficiariesInList: allRows.filter((row) => Number(row.total_pay_list ?? 0) > 0).length,
            totalBeneficiariesCashed: allRows.filter((row) => Number(row.total_cashed_cnt ?? 0) > 0).length,
            totalBeneficiariesUncashed: allRows.filter((row) => Number(row.total_uncashed_cnt ?? 0) > 0).length,
            totalPaymentAmount: allRows.reduce((acc, row) => acc + Number(row.total_pay_amt ?? 0), 0),
            totalCashedAmount: allRows.reduce((acc, row) => acc + Number(row.total_cashed_amt ?? 0), 0),
            totalUncashedAmount: allRows.reduce((acc, row) => acc + Number(row.total_uncashed_amt ?? 0), 0),
          };
          send({
            type: "done",
            message: "Processing complete!",
            stats,
            metrics,
          });
        } catch (error: any) {
          send({ type: "error", error: error.message || "Unknown error occurred" });
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
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    console.error("[BNF_CASH_DISTURBANCE_ERROR]", error);
    return NextResponse.json({ error: "Failed to process request", details: error.message }, { status: 500 });
  }
}