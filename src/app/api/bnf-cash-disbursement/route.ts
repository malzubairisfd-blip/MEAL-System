// src/app/api/bnf-cash-disbursement/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

// --- Database Setup ---
const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-cash-disbursement.db");
const getEnrollmentDbPath = () => path.join(getDataPath(), "enrollment-review.db");

const CYCLE_FIELDS: { name: string; type: string }[] = [
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

const CYCLE_COUNT = 76;
const cycleColumnEntries = Array.from({ length: CYCLE_COUNT }, (_, idx) => {
  const cycle = idx + 1;
  return CYCLE_FIELDS.map(field => `  "${field.name}_s${cycle}" ${field.type}`).join(",\n");
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

const ALL_COLUMNS = [
  "Id", "project_id", "project_name", "benef_id", "bnf_name", "bnf_vill", "bnf_ozla", "bnf_mud", "ed_id", "ed_name", "pc_id", "pc_name",
  ...cycleColumnEntries.map(e => e.trim().split(' ')[0].replace(/"/g, '')),
  "total_pay_list", "total_pay_cyc_cnt", "total_pay_amt", "total_cashed_cnt", "total_cashed_amt", "total_uncashed_cnt", "total_uncashed_amt", "final_comments", "data"
];
const VALID_COLUMNS_SET = new Set(ALL_COLUMNS);

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS bnf_cash_disbursement ${TABLE_SCHEMA};`);
  return db;
}

// --- Helper Functions ---
const sanitizeColumn = (col?: string) => (col ? col.replace(/[^a-zA-Z0-9_]/g, "") : "");
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};
const normalizeLookupValue = (value: any) => String(value ?? '').trim();
const getCycleColumn = (field: string, cycle: number) => `"${field}_s${cycle}"`;
const prepareMappingEntries = (mapping: Record<string, string>, allowedCols: Set<string>) => {
  const entries: { fileCol: string; dbCol: string; param: string }[] = [];
  let counter = 0;
  for (const [fileCol, dbColRaw] of Object.entries(mapping)) {
    const sanitized = sanitizeColumn(dbColRaw);
    if (sanitized && allowedCols.has(sanitized)) {
      entries.push({ fileCol, dbCol: `"${sanitized}"`, param: `@param_${counter++}` });
    }
  }
  return entries;
};


// --- API Handlers ---
export async function GET(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath(), { fileMustExist: true });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    let records;
    if (projectId && projectId !== "all") {
      records = db.prepare("SELECT * FROM bnf_cash_disbursement WHERE project_id = ?").all(projectId);
    } else {
      records = db.prepare("SELECT * FROM bnf_cash_disbursement").all();
    }
    db.close();
    return NextResponse.json(records);
  } catch (err: any) {
    if (err?.code === "SQLITE_CANTOPEN") return NextResponse.json([]);
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
            const tableInfo = db.prepare("PRAGMA table_info(bnf_cash_disbursement)").all();
            db.close();
            return NextResponse.json({ columns: tableInfo.map((col: any) => col.name) });
        }
        
        if (action === "check_duplicates") {
            const { projectId, uniqueIds, uniqueIdCol } = body;
            const lookupColumn = sanitizeColumn(uniqueIdCol);
            if (!projectId || !lookupColumn || !Array.isArray(uniqueIds)) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

            let db: Database.Database | null = null;
            try {
                db = new Database(getDbPath(), { fileMustExist: true });
                const existingIds = new Set<string>();
                const chunks = chunkArray(uniqueIds.map(String), 900);
                for (const chunk of chunks) {
                    const placeholders = chunk.map(() => "?").join(",");
                    const stmt = db.prepare(`SELECT "${lookupColumn}" FROM bnf_cash_disbursement WHERE project_id = ? AND "${lookupColumn}" IN (${placeholders})`);
                    stmt.all(projectId, ...chunk).forEach((row: any) => existingIds.add(String(row[lookupColumn])));
                }
                const totalInDb = db.prepare("SELECT COUNT(*) as total FROM bnf_cash_disbursement WHERE project_id = ?").get(projectId)?.total || 0;
                return NextResponse.json({ count: existingIds.size, totalInDb, duplicateIds: Array.from(existingIds) });
            } catch (error: any) {
                if (error.code === 'SQLITE_CANTOPEN') return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
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

            // Run the save logic asynchronously and stream progress
            (async () => {
                const { projectId, projectName, paymentCycle, paymentCycleCount, paymentMonths = [], paymentData = [], uncashedData = [], paymentMapping = {}, uncashedMapping = {}, uniqueFileColumn, uniqueDbColumn, mode, duplicateIds = [] } = body;
                const cycle = Number(paymentCycle);
                
                let sessionDb: Database.Database | null = null;
                try {
                    sessionDb = initializeDatabase();
                    
                    // STEP 1
                    send({ type: "progress", status: "FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE", progress: 10, message: "Seeding data..." });
                    const existingCount = sessionDb.prepare("SELECT COUNT(*) as count FROM bnf_cash_disbursement WHERE project_id = ?").get(projectId)?.count || 0;
                    if (existingCount === 0 && mode !== 'skip') {
                        try {
                           const enrollDb = new Database(getEnrollmentDbPath(), { fileMustExist: true });
                           const beneficiaries = enrollDb.prepare("SELECT benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name, pc_id, pc_name FROM enrollment_data WHERE project_id = ?").all(projectId);
                           const insertStmt = sessionDb.prepare(`INSERT OR IGNORE INTO bnf_cash_disbursement (project_id, project_name, benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name, pc_id, pc_name) VALUES (@project_id, @project_name, @benef_id, @bnf_name, @bnf_vill, @bnf_ozla, @bnf_mud, @ed_id, @ed_name, @pc_id, @pc_name)`);
                           sessionDb.transaction((bnfs: any[]) => bnfs.forEach(b => insertStmt.run({ ...b, project_id: projectId, project_name: projectName })))(beneficiaries);
                           enrollDb.close();
                        } catch { /* ignore if enroll DB not found */ }
                    }

                    // STEP 2, 3, 4
                    send({ type: "progress", status: "SECOND_STEP_SAVING_PAYMENT_CYCLE_LIST", progress: 25, message: "Processing payment list..." });
                    const cycleSuffix = `s${cycle}`;
                    const paymentEntries = prepareMappingEntries(paymentMapping, new Set([...ALL_COLUMNS]));
                    const updatePaymentStmt = sessionDb.prepare(`UPDATE bnf_cash_disbursement SET ${getCycleColumn("is_pay_list", cycle)} = 1, ${getCycleColumn("pay_cyc_cnt", cycle)} = @cycleCount, ${getCycleColumn("pay_cyc_mon_list", cycle)} = @cycleMonths, ${paymentEntries.map(e => `${e.dbCol} = ${e.param}`).join(', ')} WHERE "${sanitizeColumn(uniqueDbColumn)}" = @lookupValue AND project_id = @projectId`);
                    sessionDb.transaction((rows: any[]) => {
                        for(const row of rows) {
                           const lookupValue = normalizeLookupValue(row[uniqueFileColumn]);
                           if (!lookupValue || (mode === 'skip' && duplicateIds.includes(lookupValue))) continue;
                           const params: Record<string,any> = { projectId, lookupValue, cycleCount: paymentCycleCount, cycleMonths: paymentMonths.join(', ') };
                           paymentEntries.forEach(entry => params[entry.param.substring(1)] = row[entry.fileCol]);
                           updatePaymentStmt.run(params);
                        }
                    })(paymentData);
                    
                    // STEP 5
                    send({ type: "progress", status: "FIFTH_STEP_SAVING_UNCASHED_LIST", progress: 50, message: "Processing uncashed list..." });
                    const uncashedEntries = prepareMappingEntries(uncashedMapping, new Set([...ALL_COLUMNS]));
                    if (uncashedEntries.length > 0) {
                        const updateUncashedStmt = sessionDb.prepare(`UPDATE bnf_cash_disbursement SET ${uncashedEntries.map(e => `${e.dbCol} = ${e.param}`).join(', ')} WHERE "${sanitizeColumn(uniqueDbColumn)}" = @lookupValue AND project_id = @projectId`);
                         sessionDb.transaction((rows: any[]) => {
                            for(const row of rows) {
                               const lookupValue = normalizeLookupValue(row[uniqueFileColumn]);
                               if (!lookupValue || (mode === 'skip' && duplicateIds.includes(lookupValue))) continue;
                               const params: Record<string,any> = { projectId, lookupValue };
                               uncashedEntries.forEach(entry => params[entry.param.substring(1)] = row[entry.fileCol]);
                               updateUncashedStmt.run(params);
                            }
                        })(uncashedData);
                    }
                    
                    // STEP 6
                    send({ type: "progress", status: "SIXTH_STEP_SAVING_CASHED_DATA", progress: 75, message: "Calculating cashed data..." });
                    const isUncashedCol = getCycleColumn("is_uncashed", cycle);
                    sessionDb.prepare(`UPDATE bnf_cash_disbursement SET ${getCycleColumn("is_cashed", cycle)} = 1, ${getCycleColumn("cashed_amt", cycle)} = COALESCE(${getCycleColumn("pay_amt", cycle)}, 0) WHERE project_id = ? AND ${getCycleColumn("is_pay_list", cycle)} = 1 AND (${isUncashedCol} IS NULL OR ${isUncashedCol} = '')`).run(projectId);
                    
                    // STEP 7
                    send({ type: "progress", status: "SEVENTH_STEP_SAVING_TOTAL_VALUES", progress: 90, message: "Aggregating totals..." });
                    const allProjectRows = sessionDb.prepare('SELECT * FROM bnf_cash_disbursement WHERE project_id = ?').all(projectId);
                    const updateTotalsStmt = sessionDb.prepare(`UPDATE bnf_cash_disbursement SET total_pay_list = @total_pay_list, total_pay_cyc_cnt = @total_pay_cyc_cnt, total_pay_amt = @total_pay_amt, total_cashed_cnt = @total_cashed_cnt, total_cashed_amt = @total_cashed_amt, total_uncashed_cnt = @total_uncashed_cnt, total_uncashed_amt = @total_uncashed_amt, final_comments = @final_comments WHERE Id = @Id`);
                    sessionDb.transaction((rows: any[]) => {
                        for (const row of rows) {
                           let total_pay_list = 0, total_pay_cyc_cnt = 0, total_pay_amt = 0, total_cashed_cnt = 0, total_cashed_amt = 0, total_uncashed_cnt = 0, total_uncashed_amt = 0, final_comments = row.final_comments || "";
                           let hasTawrid = false;
                           for (let c = 1; c <= CYCLE_COUNT; c++) {
                               const suf = `_s${c}`;
                               if (row[`recom${suf}`] === 'تورد الى حساب الممول') hasTawrid = true;
                               total_pay_list += Number(row[`is_pay_list${suf}`] ?? 0);
                               total_pay_cyc_cnt += Number(row[`pay_cyc_cnt${suf}`] ?? 0);
                               total_pay_amt += Number(row[`pay_amt${suf}`] ?? 0);
                               total_cashed_cnt += Number(row[`is_cashed${suf}`] ?? 0);
                               total_cashed_amt += Number(row[`cashed_amt${suf}`] ?? 0);
                               const recomAllowed = !row[`recom${suf}`] || row[`recom${suf}`] === 'يعاد الصرف للحالة';
                               if(recomAllowed && !hasTawrid) {
                                   total_uncashed_cnt += Number(row[`is_uncashed${suf}`] ?? 0);
                                   total_uncashed_amt += Number(row[`uncashed_amt${suf}`] ?? 0);
                               }
                           }
                           if(hasTawrid) {
                               total_uncashed_cnt = 0;
                               total_uncashed_amt = 0;
                               const tawridCycle = Array.from({length: 76}, (_, i) => i+1).find(c => row[`recom_s${c}`] === 'تورد الى حساب الممول');
                               if(tawridCycle && !final_comments) {
                                  final_comments = `تم توريد مرتجع المستفيدة إلى حساب الممول في دفعة شهر ${row[`pay_cyc_mon_list_s${tawridCycle}`] || ''} وذلك بسبب ${row[`uncashed_reason_s${tawridCycle}`] || ''}`;
                               }
                           }
                           if (total_pay_list === total_cashed_cnt) { total_uncashed_cnt = 0; total_uncashed_amt = 0; }
                           updateTotalsStmt.run({Id: row.Id, total_pay_list, total_pay_cyc_cnt, total_pay_amt, total_cashed_cnt, total_cashed_amt, total_uncashed_cnt, total_uncashed_amt, final_comments });
                        }
                    })(allProjectRows);

                    const metrics = {
                        totalAppearance: allProjectRows.filter(r => r[`is_pay_list_s${cycle}`] === 1).length,
                        totalAttend: allProjectRows.reduce((sum, r) => sum + (r[`is_cashed_s${cycle}`] || 0), 0),
                        totalAbsence: allProjectRows.reduce((sum, r) => sum + (r[`is_uncashed_s${cycle}`] || 0), 0),
                        totalAlternative: 0,
                        totalPaymentAmount: allProjectRows.reduce((sum, r) => sum + (r[`pay_amt_s${cycle}`] || 0), 0),
                        totalCashedAmount: allProjectRows.reduce((sum, r) => sum + (r[`cashed_amt_s${cycle}`] || 0), 0),
                        totalUncashedAmount: allProjectRows.reduce((sum, r) => sum + (r[`uncashed_amt_s${cycle}`] || 0), 0)
                    };
                    
                    send({ type: "done", message: "Processing complete!", metrics });

                } catch(error: any) {
                    send({ type: "error", error: error.message });
                } finally {
                    if (sessionDb) sessionDb.close();
                    writer.close();
                }
            })();

            return new Response(stream.readable, {
                headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
            });
        }
        
        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    } catch (error: any) {
        console.error("[BNF_CASH_DISBURSEMENT_ERROR]", error);
        return NextResponse.json({ error: "Failed to process request", details: error.message }, { status: 500 });
    }
}