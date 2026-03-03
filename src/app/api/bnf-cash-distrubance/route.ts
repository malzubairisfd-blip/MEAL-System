
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), "src/data");
const DB_PATH = path.join(DATA_DIR, "bnf-cash-distrubance.db");
const ENROLLMENT_DB_PATH = path.join(DATA_DIR, "enrollment-review.db");
const PROJECTS_DB_PATH = path.join(DATA_DIR, "projects.db");
const TABLE_NAME = "bnf_cash_distrubance";
const CYCLE_COUNT = 76;

const CYCLE_FIELDS: { name: string; type: "TEXT" | "INTEGER" | "REAL" }[] = [
  { name: "is_pay_list", type: "INTEGER" },
  { name: "pay_cyc_cnt", type: "INTEGER" },
  { name: "pay_cyc_mon_list", type: "TEXT" },
  { name: "pay_amt", type: "REAL" },
  { name: "is_cashed", type: "INTEGER" },
  { name: "cashed_amt", type: "REAL" },
  { name: "is_uncashed", type: "INTEGER" },
  { name: "uncashed_amt", type: "REAL" },
  { name: "uncashed_code", type: "INTEGER" },
  { name: "uncashed_reason", type: "TEXT" },
  { name: "recom", type: "TEXT" },
];

const BASE_COLUMNS = [
  "project_id TEXT",
  "project_name TEXT",
  "benef_id TEXT UNIQUE",
  "bnf_name TEXT",
  "bnf_vill TEXT",
  "bnf_ozla TEXT",
  "bnf_mud TEXT",
  "ed_id TEXT",
  "ed_name TEXT",
  "pc_id TEXT",
  "pc_name TEXT",
];

const TOTAL_COLUMNS = [
  "total_pay_list INTEGER",
  "total_pay_cyc_cnt INTEGER",
  "total_pay_amt REAL",
  "total_cashed_cnt INTEGER",
  "total_cashed_amt REAL",
  "total_uncashed_cnt INTEGER",
  "total_uncashed_amt REAL",
  "final_comments TEXT",
  "data JSON",
];

const CYCLE_COLUMNS = Array.from({ length: CYCLE_COUNT }, (_, idx) =>
  CYCLE_FIELDS.map((field) => `"${field.name}_s${idx + 1}" ${field.type}`).join(",\n  ")
).join(",\n  ");

const TABLE_SCHEMA = `(
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  ${[...BASE_COLUMNS, CYCLE_COLUMNS, ...TOTAL_COLUMNS].join(",\n  ")}
)`;

const ALL_DB_COLUMNS = [
    "Id", ...BASE_COLUMNS.map(c => c.split(' ')[0]), 
    ...Array.from({ length: CYCLE_COUNT }, (_, i) => CYCLE_FIELDS.map(f => `${f.name}_s${i+1}`)).flat(),
    ...TOTAL_COLUMNS.map(c => c.split(' ')[0])
];
const VALID_COLUMNS_SET = new Set(ALL_DB_COLUMNS);


// --- UTILITY FUNCTIONS ---

const ensureDirectory = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

const initializeDatabase = () => {
  const db = new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} ${TABLE_SCHEMA}`);
  // Add unique index on benef_id and project_id for faster lookups
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_project_benef ON ${TABLE_NAME} (project_id, benef_id)`);
  return db;
};

const sanitizeColumn = (value?: string) => (value ? value.replace(/[^a-zA-Z0-9_]/g, "") : "");
const normalizeValue = (value: any) => (value === null || value === undefined ? "" : String(value).trim());

// --- API ROUTE HANDLERS ---

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    await ensureDirectory();
    try {
        const db = initializeDatabase();
        let data;
        if (projectId) {
            data = db.prepare(`SELECT * FROM ${TABLE_NAME} WHERE project_id = ?`).all(projectId);
        } else {
            data = db.prepare(`SELECT * FROM ${TABLE_NAME}`).all();
        }
        db.close();
        return NextResponse.json(data);
    } catch(err) {
        if((err as any).code === 'SQLITE_CANTOPEN') return NextResponse.json([]);
        return NextResponse.json({ error: (err as Error).message }, { status: 500});
    }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;
  await ensureDirectory();

  if (action === "get_schema") {
    return NextResponse.json({ columns: ALL_DB_COLUMNS });
  }

  if (action === "check_duplicates") {
      const { projectId, uniqueIds, uniqueIdCol } = body;
      if (!projectId || !Array.isArray(uniqueIds) || !uniqueIdCol) {
          return NextResponse.json({ error: "Missing parameters for duplicate check" }, { status: 400 });
      }
      const lookupColumn = sanitizeColumn(uniqueIdCol);
      if (!VALID_COLUMNS_SET.has(lookupColumn)) {
          return NextResponse.json({ error: "Invalid unique column for checking duplicates" }, { status: 400 });
      }
      try {
          const db = initializeDatabase();
          const placeholders = uniqueIds.map(() => "?").join(",");
          const stmt = db.prepare(`SELECT "${lookupColumn}" FROM ${TABLE_NAME} WHERE project_id = ? AND "${lookupColumn}" IN (${placeholders})`);
          const rows = stmt.all(projectId, ...uniqueIds);
          const existingIds = new Set(rows.map((row: any) => normalizeValue(row[lookupColumn])));
          const totalInDb = (db.prepare(`SELECT COUNT(*) as total FROM ${TABLE_NAME} WHERE project_id = ?`).get(projectId) as { total: number })?.total || 0;
          db.close();
          return NextResponse.json({
              count: existingIds.size,
              totalInDb,
              duplicateIds: Array.from(existingIds)
          });
      } catch (error: any) {
          if (error.code === 'SQLITE_CANTOPEN') { // DB doesn't exist yet
              return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
          }
          return NextResponse.json({ error: "DB error on duplicate check", details: error.message }, { status: 500 });
      }
  }

  if (action === "save") {
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();
      const send = (data: any) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      
      handleSaveAction(body, send).finally(() => writer.close());

      return new NextResponse(stream.readable, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

// --- SAVE ACTION LOGIC ---

async function handleSaveAction(body: any, send: (data: any) => void) {
    let db: Database.Database | null = null;
    let enrollmentDb: Database.Database | null = null;

    try {
        const {
            projectId, projectName, paymentCycle, paymentCycleCount, paymentMonths,
            paymentData = [], uncashedData = [], paymentMapping, uncashedMapping,
            uniqueFileIdColumn, uniqueDbColumn, mode, duplicateIds = [],
        } = body;

        db = initializeDatabase();

        // Step 1: Seed from Enrollment DB
        const existingCount = (db.prepare(`SELECT COUNT(*) as cnt FROM ${TABLE_NAME} WHERE project_id = ?`).get(projectId) as { cnt: number }).cnt;
        if (existingCount === 0) {
            send({ type: 'progress', status: 'FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE', progress: 10, message: 'Seeding base data...' });
            try {
                enrollmentDb = new Database(ENROLLMENT_DB_PATH, { fileMustExist: true });
                const rows = enrollmentDb.prepare(`SELECT benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name, pc_id, pc_name FROM enrollment_data WHERE project_id = ?`).all(projectId);
                const insertStmt = db.prepare(`INSERT OR IGNORE INTO ${TABLE_NAME} (project_id, project_name, benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name, pc_id, pc_name) VALUES (@projectId, @projectName, @benef_id, @bnf_name, @bnf_vill, @bnf_ozla, @bnf_mud, @ed_id, @ed_name, @pc_id, @pc_name)`);
                const transaction = db.transaction((records: any[]) => { records.forEach(record => insertStmt.run({ projectId, projectName, ...record })); });
                transaction(rows);
            } catch (seedError) {
                // Silently fail if enrollment DB doesn't exist.
            }
        }
        
        const cycleSuffix = `_s${paymentCycle}`;
        const duplicateSet = new Set<string>((duplicateIds || []).map(normalizeValue));

        // Step 2-5: Process uploaded data
        const processChunk = (chunk: any[], mapping: Record<string, string>, isPayment: boolean) => {
            const updateClauses = Object.values(mapping).map(dbCol => `"${sanitizeColumn(dbCol)}" = @${sanitizeColumn(dbCol)}`).join(', ');
            if (!updateClauses) return;
            const updateStmt = db!.prepare(`UPDATE ${TABLE_NAME} SET ${updateClauses} WHERE project_id = @projectId AND "${uniqueDbColumn}" = @lookupValue`);
            
            const insertStmt = db!.prepare(`INSERT OR IGNORE INTO ${TABLE_NAME} (project_id, project_name, "${uniqueDbColumn}") VALUES (@projectId, @projectName, @lookupValue)`);
            
            const transaction = db!.transaction((items) => {
              for (const item of items) {
                const lookupValue = normalizeValue(item[uniqueFileIdColumn]);
                if (!lookupValue || (mode === 'skip' && duplicateSet.has(lookupValue))) continue;
                
                // Ensure record exists before updating
                insertStmt.run({projectId, projectName, lookupValue});

                const params: Record<string, any> = { projectId, lookupValue };
                for (const [fileCol, dbCol] of Object.entries(mapping)) {
                  params[sanitizeColumn(dbCol)] = item[fileCol];
                }
                updateStmt.run(params);
              }
            });
            transaction(chunk);
        };
        
        send({ type: 'progress', status: 'SECOND_STEP_SAVING_PAYMENT_CYCLE_LIST', progress: 25, message: 'Processing payment data...' });
        processChunk(paymentData, paymentMapping, true);

        send({ type: 'progress', status: 'FIFTH_STEP_SAVING_UNCASHED_LIST', progress: 40, message: 'Processing uncashed data...' });
        processChunk(uncashedData, uncashedMapping, false);
        
        db.transaction(() => {
            send({ type: 'progress', status: 'THIRD_STEP_SAVING_GENERAL_PAYMENT_CYCLE_COUNT', progress: 55, message: 'Updating cycle counts...' });
            db!.prepare(`UPDATE ${TABLE_NAME} SET "pay_cyc_cnt${cycleSuffix}" = ? WHERE project_id = ? AND "is_pay_list${cycleSuffix}" = 1`).run(paymentCycleCount, projectId);

            send({ type: 'progress', status: 'FOURTH_SAVING_PAYMENT_CYCLE_MONTHS', progress: 65, message: 'Updating cycle months...' });
            db!.prepare(`UPDATE ${TABLE_NAME} SET "pay_cyc_mon_list${cycleSuffix}" = ? WHERE project_id = ? AND "is_pay_list${cycleSuffix}" = 1`).run(paymentMonths.join(', '), projectId);

            send({ type: 'progress', status: 'SIXTH_STEP_SAVING_CASHED_DATA', progress: 75, message: 'Calculating cashed data...' });
            db!.prepare(`UPDATE ${TABLE_NAME} SET "is_cashed${cycleSuffix}" = 1, "cashed_amt${cycleSuffix}" = COALESCE("pay_amt${cycleSuffix}", 0) WHERE project_id = ? AND "is_pay_list${cycleSuffix}" = 1 AND COALESCE("is_uncashed${cycleSuffix}", 0) = 0`).run(projectId);
        })();

        // Step 7: Calculate totals
        send({ type: 'progress', status: 'SEVENTH_STEP_SAVING_TOTAL_VALUES', progress: 85, message: 'Aggregating totals...' });
        const allProjectRecords = db.prepare(`SELECT * FROM ${TABLE_NAME} WHERE project_id = ?`).all(projectId);
        const updateTotalsStmt = db.prepare(`UPDATE ${TABLE_NAME} SET total_pay_list = @total_pay_list, total_pay_cyc_cnt = @total_pay_cyc_cnt, total_pay_amt = @total_pay_amt, total_cashed_cnt = @total_cashed_cnt, total_cashed_amt = @total_cashed_amt, total_uncashed_cnt = @total_uncashed_cnt, total_uncashed_amt = @total_uncashed_amt, final_comments = @final_comments WHERE Id = @Id`);
        
        const totalsTransaction = db.transaction((records) => {
            for (const record of records) {
                calculateAndSaveTotalsForRow(record);
            }
        });

        function calculateAndSaveTotalsForRow(row: any) {
            let total_pay_list = 0, total_pay_cyc_cnt = 0, total_pay_amt = 0;
            let total_cashed_cnt = 0, total_cashed_amt = 0;
            let total_uncashed_cnt = 0, total_uncashed_amt = 0;
            let final_comments = "";
            let hasTawrid = false;

            for (let i = 1; i <= CYCLE_COUNT; i++) {
                const s = `_s${i}`;
                total_pay_list += Number(row[`is_pay_list${s}`] || 0);
                total_pay_cyc_cnt += Number(row[`pay_cyc_cnt${s}`] || 0);
                total_pay_amt += Number(row[`pay_amt${s}`] || 0);
                total_cashed_cnt += Number(row[`is_cashed${s}`] || 0);
                total_cashed_amt += Number(row[`cashed_amt${s}`] || 0);
                
                const recom = row[`recom${s}`];
                if (recom === 'تورد الى حساب الممول') {
                    hasTawrid = true;
                    if (!final_comments) {
                        final_comments = `تم توريد مرتجع المستفيدة إلى حساب الممول في دفعة شهر ${row[`pay_cyc_mon_list${s}`]} وذلك بسبب ${row[`uncashed_reason${s}`]}`;
                    }
                }
            }

            if (!hasTawrid) {
                for (let i = 1; i <= CYCLE_COUNT; i++) {
                    const s = `_s${i}`;
                    const recom = row[`recom${s}`];
                    if (recom === "يعاد الصرف للحالة" || !recom) {
                        total_uncashed_cnt += Number(row[`is_uncashed${s}`] || 0);
                        total_uncashed_amt += Number(row[`uncashed_amt${s}`] || 0);
                    }
                }
            }
            if (total_pay_list === total_cashed_cnt) total_uncashed_cnt = 0;
            if (total_pay_amt === total_cashed_amt) total_uncashed_amt = 0;
            
            updateTotalsStmt.run({ ...row, total_pay_list, total_pay_cyc_cnt, total_pay_amt, total_cashed_cnt, total_cashed_amt, total_uncashed_cnt, total_uncashed_amt, final_comments });
        }
        totalsTransaction(allProjectRecords);
        
        const finalStats = { saved: allProjectRecords.length - duplicateSet.size, updated: mode === 'replace' ? duplicateSet.size : 0, skipped: mode === 'skip' ? duplicateSet.size : 0, total: allProjectRecords.length };

        send({ type: 'done', message: 'Processing complete!', stats: finalStats, metrics: {} });
    } catch (error: any) {
        send({ type: 'error', error: error.message || 'An unknown error occurred during save.' });
    } finally {
        if (db) db.close();
        if (enrollmentDb) enrollmentDb.close();
    }
}
