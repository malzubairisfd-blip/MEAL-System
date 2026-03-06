// app/api/ed-cash-disbursement/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "ed-cash-disbursement.db");
const getEducatorsDbPath = () => path.join(getDataPath(), "educators.db");


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
  ed_id TEXT,
  ed_name TEXT,
  ed_id_type TEXT,
  ed_idNum REAL,
  ed_phone TEXT,
  ed_vill TEXT,
  ed_ozla TEXT,
  ed_mud TEXT,
  bnf_cnt REAL,
  bnf_active REAL,
  pc_id TEXT,
  pc_name TEXT,
  total_bnf REAL,
  total_active REAL,
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
  "ed_id",
  "ed_name",
  "ed_id_type",
  "ed_idNum",
  "ed_phone",
  "ed_vill",
  "ed_ozla",
  "ed_mud",
  "bnf_cnt",
  "bnf_active",
  "pc_id",
  "pc_name",
  "total_bnf",
  "total_active",
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
const VALID_COLUMNS_SET = new Set(ALL_COLUMNS.map((col) => col.toLowerCase()));

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

const prepareMappingEntries = (mapping: Record<string, string> = {}, allowed: Set<string>, excluded: Set<string>) => {
  const entries: { fileCol: string; dbCol: string; param: string }[] = [];
  if (!mapping) return entries;
  let counter = 0;
  for (const [fileCol, dbColRaw] of Object.entries(mapping)) {
    if (!fileCol) continue;
    const sanitizedDbCol = sanitizeColumn(dbColRaw);
    if (!sanitizedDbCol) continue;
    if (excluded.has(sanitizedDbCol)) continue;
    if (!allowed.has(sanitizedDbCol.toLowerCase())) continue; // case-insensitive check
    entries.push({ fileCol, dbCol: sanitizedDbCol, param: `param_${counter++}` });
  }
  return entries;
};

const findFileColumn = (mapping: Record<string, string>, targetDbCol: string) => {
    for (const [fileCol, dbCol] of Object.entries(mapping)) {
        if (dbCol === targetDbCol) return fileCol;
    }
    return '';
};

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS ed_cash_disbursement ${TABLE_SCHEMA};`);
  return db;
}

const sendProgress = (writer: WritableStreamDefaultWriter<Uint8Array>, payload: any) => {
  const encoder = new TextEncoder();
  writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
};

const seedEducators = (db: Database.Database, projectId: string, projectName: string) => {
    try {
        const educatorsDb = new Database(getEducatorsDbPath(), { fileMustExist: true });
        const rows = educatorsDb
          .prepare(
            `SELECT applicant_name, phone_no, id_no, loc_name, ozla_name, mud_name 
             FROM educators WHERE project_id = ?`
          )
          .all(projectId);

        const insertStmt = db.prepare(
            `INSERT OR IGNORE INTO ed_cash_disbursement
            (project_id, project_name, ed_name, ed_idNum, ed_phone, ed_vill, ed_ozla, ed_mud)
            VALUES (@projectId, @projectName, @ed_name, @ed_phone, @ed_idNum, @ed_vill, @ed_ozla, @ed_mud)`
        );

        const transaction = db.transaction((records: any[]) => {
            for (const record of records) {
                insertStmt.run({
                    projectId,
                    projectName,
                    ed_name: record.applicant_name,
                    ed_phone: record.phone_no,
                    ed_idNum: record.id_no,
                    ed_vill: record.loc_name,
                    ed_ozla: record.ozla_name,
                    ed_mud: record.mud_name,
                });
            }
        });
        transaction(rows);
        educatorsDb.close();
    } catch (e) {
        console.warn("Could not seed from educators.db, it might not exist.", e);
        // Graceful fallback if educators db doesn't exist
    }
};


export async function GET(req: Request) {
  try {
      await fs.mkdir(getDataPath(), { recursive: true });
      const db = initializeDatabase();
      const { searchParams } = new URL(req.url);
      const projectId = searchParams.get("projectId");
      
      const records = projectId && projectId !== "all"
        ? db.prepare("SELECT * FROM ed_cash_disbursement WHERE project_id = ?").all(projectId)
        : db.prepare("SELECT * FROM ed_cash_disbursement").all();
        
      db.close();
      return NextResponse.json(records);
  } catch (err: any) {
    if (err.code === "SQLITE_CANTOPEN") return NextResponse.json([]);
    return NextResponse.json({ error: "Failed to fetch session data", details: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;
  try {
    await fs.mkdir(getDataPath(), { recursive: true });

    if (action === "schema") {
        const db = initializeDatabase();
        const columns = db.prepare("PRAGMA table_info(ed_cash_disbursement)").all().map((col: any) => col.name);
        db.close();
        return NextResponse.json({ columns });
    }

    if (action === "check_duplicates") {
      const { projectId, uniqueIds, uniqueIdCol } = body;
      if (!projectId || !Array.isArray(uniqueIds)) {
        return NextResponse.json({ error: "Missing duplicate parameters" }, { status: 400 });
      }
      const lookupColumn = sanitizeColumn(uniqueIdCol) || "ed_name";
      if (!VALID_COLUMNS_SET.has(lookupColumn.toLowerCase())) {
        return NextResponse.json({ error: "Invalid unique column" }, { status: 400 });
      }
      
      let db: Database.Database | null = null;
      try {
        db = initializeDatabase();
        const chunks = chunkArray(uniqueIds, 900);
        const existing = new Set<string>();
        
        for (const chunk of chunks) {
          if (!chunk.length) continue;
          const placeholders = chunk.map(() => "?").join(",");
          const stmt = db.prepare(
            `SELECT "${lookupColumn}" FROM ed_cash_disbursement WHERE project_id = ? AND "${lookupColumn}" IN (${placeholders})`
          );
          const rows = stmt.all(projectId, ...chunk) as any[];
          rows.forEach((row) => {
            const value = row[lookupColumn];
            if (value !== undefined && value !== null) existing.add(String(value));
          });
        }
        
        const totalInDbResult = db
          .prepare("SELECT COUNT(*) as total FROM ed_cash_disbursement WHERE project_id = ?")
          .get(projectId) as { total: number } | undefined;
          
        const totalInDb = totalInDbResult?.total || 0;
        
        return NextResponse.json({ count: existing.size, totalInDb, duplicateIds: Array.from(existing) });
      } catch(err: any) {
        if(err.code === 'SQLITE_CANTOPEN') return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
        throw err;
      } finally {
        if (db) db.close();
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
          projectId, projectName, paymentCycle, paymentCycleCount,
          paymentMonths = [], paymentData = [], uncashedData = [],
          paymentMapping = {}, uncashedMapping = {},
          uniqueFileColumn, uniqueDbColumn,
          mode = "replace", duplicateIds = [],
        } = body;

        const cycleNumber = Number(paymentCycle);
        if (!projectId || !cycleNumber || cycleNumber < 1 || cycleNumber > CYCLE_COUNT) {
          sendProgress(writer, { type: "error", error: "Missing project or invalid cycle." });
          writer.close();
          return;
        }
        
        const lookupColumn = sanitizeColumn(uniqueDbColumn) || "ed_name";
        if (!lookupColumn || !VALID_COLUMNS_SET.has(lookupColumn.toLowerCase())) {
          sendProgress(writer, { type: "error", error: `Invalid DB lookup column: "${lookupColumn}"` });
          writer.close();
          return;
        }
        
        const lookupFileColumn = typeof uniqueFileColumn === "string" ? uniqueFileColumn : "";
        if (!lookupFileColumn) {
          sendProgress(writer, { type: "error", error: "Missing lookup column from uploaded file." });
          writer.close();
          return;
        }

        const duplicatesSet = new Set(
          Array.isArray(duplicateIds) ? duplicateIds.map((id: any) => normalizeLookupValue(id)).filter(Boolean) : []
        );
        
        const stats = {
          saved: 0, updated: 0, skipped: 0,
          total: (Array.isArray(paymentData) ? paymentData.length : 0) + (Array.isArray(uncashedData) ? uncashedData.length : 0),
        };

        const allowedColumns = new Set(ALL_COLUMNS.map(c => c.toLowerCase()));
        const excludedBase = new Set([lookupColumn, 'project_id', 'project_name'].map(c=>c.toLowerCase()));
        const paymentEntries = prepareMappingEntries(paymentMapping, allowedColumns, excludedBase);
        const uncashedEntries = prepareMappingEntries(uncashedMapping, allowedColumns, excludedBase);

        let sessionDb: Database.Database | null = null;
        try {
          sessionDb = initializeDatabase();
          
          // STEP 1: LOAD FROM Educstors
          sendProgress(writer, { type: "progress", status: "STEP_ONE", progress: 10, message: "Preparing educators base data", stats });
          
          const existingProjectRecordsResult = sessionDb.prepare("SELECT COUNT(*) as count FROM ed_cash_disbursement WHERE project_id = ?").get(projectId) as {count: number}|undefined;
          
          if ((existingProjectRecordsResult?.count || 0) === 0 && mode !== "skip") {
            seedEducators(sessionDb, projectId, projectName || "");
          }
          
          // STEP 2, 3, 4: SAVING PAYMENT CYCLE LIST, COUNT, MONTHS
          sendProgress(writer, { type: "progress", status: "STEP_TWO", progress: 30, message: "Saving Payment Cycle List, Count, and Months", stats });
          if(paymentEntries.length > 0 && paymentData.length > 0) {
              const payStmt = sessionDb.prepare(
                `UPDATE ed_cash_disbursement SET 
                  project_id = @projectId, project_name = @projectName,
                  "${getCycleColumn("is_pay_list", cycleNumber)}" = 1,
                  "${getCycleColumn("pay_cyc_cnt", cycleNumber)}" = @cycleCount,
                  "${getCycleColumn("pay_cyc_mon_list", cycleNumber)}" = @cycleMonths
                  ${paymentEntries.map((entry) => `, "${entry.dbCol}" = @${entry.param}`).join("")} 
                WHERE "${lookupColumn}" = @lookupValue AND project_id = @projectId`
              );
              
              const payTransaction = sessionDb.transaction((rows: any[]) => {
                for (const row of rows) {
                  const lookupValue = normalizeLookupValue(row[lookupFileColumn]);
                  if (!lookupValue) continue;
                  
                  if (mode === "skip" && duplicatesSet.has(lookupValue)) {
                    stats.skipped++;
                    continue;
                  }
                  
                  const params: Record<string, any> = {
                    projectId, projectName: projectName || "",
                    cycleCount: paymentCycleCount,
                    cycleMonths: Array.isArray(paymentMonths) ? paymentMonths.join(", ") : paymentMonths,
                    lookupValue,
                  };
                  paymentEntries.forEach((entry) => { params[entry.param] = row[entry.fileCol] ?? null; });
                  const info = payStmt.run(params);
                  stats.updated += info.changes;
                }
              });
              payTransaction(paymentData);
          }

          // STEP 5: SAVING UNCASHED LIST
          sendProgress(writer, { type: "progress", status: "STEP_FIVE", progress: 50, message: "Saving Uncashed List", stats });
          if (uncashedEntries.length > 0 && uncashedData.length > 0) {
              const uncashedStmt = sessionDb.prepare(
                `UPDATE ed_cash_disbursement SET project_id = @projectId, project_name = @projectName
                 ${uncashedEntries.map((entry) => `, "${entry.dbCol}" = @${entry.param}`).join("")} 
                 WHERE "${lookupColumn}" = @lookupValue AND project_id = @projectId`
              );
              const uncashedTransaction = sessionDb.transaction((rows: any[]) => {
                for (const row of rows) {
                  const lookupValue = normalizeLookupValue(row[lookupFileColumn]);
                  if (!lookupValue) continue;
                  if (mode === "skip" && duplicatesSet.has(lookupValue)) continue;
                  
                  const params: Record<string, any> = { projectId, projectName: projectName || "", lookupValue };
                  uncashedEntries.forEach((entry) => { params[entry.param] = row[entry.fileCol] ?? null; });
                  uncashedStmt.run(params);
                }
              });
              uncashedTransaction(uncashedData);
          }
          
          const uncashedAmtFileCol = findFileColumn(uncashedMapping, getCycleColumn("uncashed_amt", cycleNumber));
          if (uncashedAmtFileCol) {
            const conditionalUpdateStmt = sessionDb.prepare(
              `UPDATE ed_cash_disbursement 
               SET "${getCycleColumn("is_uncashed", cycleNumber)}" = 1,
                   "${getCycleColumn("is_cashed", cycleNumber)}" = 0
               WHERE project_id = @projectId AND "${lookupColumn}" = @lookupValue`
            );
            const conditionalTx = sessionDb.transaction((rows: any[]) => {
              for (const row of rows) {
                const uncashedAmtValue = row[uncashedAmtFileCol];
                if (uncashedAmtValue !== null && uncashedAmtValue !== undefined && String(uncashedAmtValue).trim() !== '') {
                  const lookupValue = normalizeLookupValue(row[lookupFileColumn]);
                  if (lookupValue) {
                    conditionalUpdateStmt.run({ projectId, lookupValue });
                  }
                }
              }
            });
            conditionalTx(uncashedData);
          }


          // STEP 6: SAVING CASHED DATA
          sendProgress(writer, { type: "progress", status: "STEP_SIX", progress: 70, message: "Saving Cashed Data", stats });
          
          const markCashedStmt = sessionDb.prepare(
            `UPDATE ed_cash_disbursement SET 
               "${getCycleColumn("is_cashed", cycleNumber)}" = 1,
               "${getCycleColumn("cashed_amt", cycleNumber)}" = "${getCycleColumn("pay_amt", cycleNumber)}"
             WHERE project_id = @projectId
               AND "${getCycleColumn("is_pay_list", cycleNumber)}" = 1
               AND COALESCE("${getCycleColumn("is_uncashed", cycleNumber)}", 0) != 1
            `
          );
          markCashedStmt.run({ projectId });
          
          // Ensure cashed_amt is 0 for uncashed records, even if they were in the pay list
          const zeroUncashedStmt = sessionDb.prepare(
            `UPDATE ed_cash_disbursement SET
                "${getCycleColumn("cashed_amt", cycleNumber)}" = 0
             WHERE project_id = @projectId
                AND "${getCycleColumn("is_uncashed", cycleNumber)}" = 1
            `
          );
          zeroUncashedStmt.run({ projectId });

          // STEP 7: SAVING TOTAL VALUES
          sendProgress(writer, { type: "progress", status: "STEP_SEVEN", progress: 85, message: "Calculating Total Values", stats });
          const rows = sessionDb.prepare("SELECT * FROM ed_cash_disbursement WHERE project_id = ?").all(projectId);
          
          const calculateTotals = (record: any) => {
              let total_pay_list = 0;
              let total_pay_cyc_cnt = 0;
              let total_pay_amt = 0;
              let total_cashed_cnt = 0;
              let total_cashed_amt = 0;
              let total_uncashed_cnt = 0;
              let total_uncashed_amt = 0;
              let final_comments = '';

              for (let i = 1; i <= CYCLE_COUNT; i++) {
                  total_pay_list += Number(record[`is_pay_list_s${i}`] || 0);
                  total_pay_cyc_cnt += Number(record[`pay_cyc_cnt_s${i}`] || 0);
                  total_pay_amt += Number(record[`pay_amt_s${i}`] || 0);
                  total_cashed_cnt += Number(record[`is_cashed_s${i}`] || 0);
                  total_cashed_amt += Number(record[`cashed_amt_s${i}`] || 0);
                  
                  const recom = (record[`recom_s${i}`] || '').toString().trim();
                  const uncashed = Number(record[`is_uncashed_s${i}`] || 0);
                  const uncashedAmt = Number(record[`uncashed_amt_s${i}`] || 0);
                  
                  const recomAllowed = !recom || recom === "يعاد الصرف للحالة";
                  const recomBlocked = recom === "تورد الى حساب الممول" || recom === "تورد لحساب الممول";

                  if (uncashed === 1 && recomAllowed && !recomBlocked) {
                      total_uncashed_cnt += 1;
                      total_uncashed_amt += uncashedAmt;
                  }
                  
                  if (recomBlocked) {
                     final_comments = `تم توريد مرتجع المثقفة إلى حساب الممول في دفعة شهر ${record[`pay_cyc_mon_list_s${i}`] || ''} وذلك بسبب ${record[`uncashed_reason_s${i}`] || ''}`;
                  }
              }
              
              if (total_pay_list === total_cashed_cnt) total_uncashed_cnt = 0;
              if (total_pay_amt === total_cashed_amt) total_uncashed_amt = 0;

              return { total_pay_list, total_pay_cyc_cnt, total_pay_amt, total_cashed_cnt, total_cashed_amt, total_uncashed_cnt, total_uncashed_amt, final_comments };
          };

          const updateTotals = sessionDb.prepare(
            `UPDATE ed_cash_disbursement SET 
               total_pay_list = @total_pay_list, total_pay_cyc_cnt = @total_pay_cyc_cnt,
               total_pay_amt = @total_pay_amt, total_cashed_cnt = @total_cashed_cnt,
               total_cashed_amt = @total_cashed_amt, total_uncashed_cnt = @total_uncashed_cnt,
               total_uncashed_amt = @total_uncashed_amt, final_comments = @final_comments
             WHERE Id = @Id`
          );
          
          const totalsTx = sessionDb.transaction((records: any[]) => {
            records.forEach((record) => {
              updateTotals.run({ ...calculateTotals(record), Id: record.Id });
            });
          });
          totalsTx(rows);

          sendProgress(writer, { type: "done", stats, message: "Processing complete!" });

        } catch (error: any) {
          sendProgress(writer, { type: "error", error: error.message || "Unknown error occurred" });
        } finally {
          if (sessionDb) sessionDb.close();
          writer.close();
        }
      })();

      return response;
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    console.error("[ed_CASH_API_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process request.", details: error.message },
      { status: 500 }
    )
  }
}
