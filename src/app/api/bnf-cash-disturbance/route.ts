import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), "src/data");
const DB_PATH = path.join(DATA_DIR, "bnf-cash-distrubance.db");
const ENROLLMENT_DB = path.join(DATA_DIR, "enrollment-review.db");
const TABLE_NAME = "bnf_cash_distrubance";
const CYCLE_COUNT = 76;

const CYCLE_FIELDS: { name: string; type: "TEXT" | "INTEGER" }[] = [
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

const BASE_COLUMNS = [
  "project_id TEXT",
  "project_name TEXT",
  "benef_id TEXT",
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
  "total_pay_amt INTEGER",
  "total_cashed_cnt INTEGER",
  "total_cashed_amt INTEGER",
  "total_uncashed_cnt INTEGER",
  "total_uncashed_amt INTEGER",
  "final_comments TEXT",
  "data JSON",
];

const CYCLE_COLUMNS = Array.from({ length: CYCLE_COUNT }, (_, idx) =>
  CYCLE_FIELDS.map((field) => `${field.name}_s${idx + 1} ${field.type}`).join(", ")
).join(", ");

const TABLE_SCHEMA = `(
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  ${[...BASE_COLUMNS, CYCLE_COLUMNS, ...TOTAL_COLUMNS].join(",\n  ")}
)`;

const DEFAULT_COLUMNS = [
  "Id",
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
  ...Array.from({ length: CYCLE_COUNT }, (_, idx) =>
    CYCLE_FIELDS.map((field) => `${field.name}_s${idx + 1}`)
  ).flat(),
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
const VALID_COLUMNS = new Set(DEFAULT_COLUMNS.map((col) => col.toLowerCase()));

const ensureDirectory = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

const initializeDatabase = () => {
  const db = new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} ${TABLE_SCHEMA}`);
  return db;
};

const sanitizeColumn = (value?: string) => {
  if (!value) return "";
  return value.replace(/[^a-zA-Z0-9_]/g, "");
};

const normalizeValue = (value: any) => (value === null || value === undefined ? "" : value.toString().trim());

const parseMappingEntries = (mapping: Record<string, string>) => {
  return Object.entries(mapping || {})
    .map(([fileCol, dbCol]) => {
      const sanitized = sanitizeColumn(dbCol);
      return !sanitized ? null : { fileCol, dbCol: sanitized };
    })
    .filter((entry): entry is { fileCol: string; dbCol: string } => Boolean(entry));
};

const calculateTotals = (row: any) => {
  let totals = {
    total_pay_list: 0,
    total_pay_cyc_cnt: 0,
    total_pay_amt: 0,
    total_cashed_cnt: 0,
    total_cashed_amt: 0,
    total_uncashed_cnt: 0,
    total_uncashed_amt: 0,
    final_comments: "",
  };
  
  let hasTawrid = false;

  for (let cycle = 1; cycle <= CYCLE_COUNT; cycle++) {
    const suf = `s${cycle}`;
    
    const isPay = Number(row[`is_pay_list_${suf}`] ?? 0);
    const payCnt = Number(row[`pay_cyc_cnt_${suf}`] ?? 0);
    const payAmt = Number(row[`pay_amt_${suf}`] ?? 0);
    const isCashed = Number(row[`is_cashed_${suf}`] ?? 0);
    const cashedAmt = Number(row[`cashed_amt_${suf}`] ?? 0);
    const isUncashed = Number(row[`is_uncashed_${suf}`] ?? 0);
    const uncashedAmt = Number(row[`uncashed_amt_${suf}`] ?? 0);
    const recomValue = normalizeValue(row[`recom_${suf}`]);
    const uncashedReason = normalizeValue(row[`uncashed_reason_${suf}`]);
    const monthValue = normalizeValue(row[`pay_cyc_mon_list_${suf}`]);
    
    totals.total_pay_list += isPay;
    totals.total_pay_cyc_cnt += payCnt;
    totals.total_pay_amt += payAmt;
    totals.total_cashed_cnt += isCashed;
    totals.total_cashed_amt += cashedAmt;

    // final comments rule checking
    if (recomValue === "تورد الى حساب الممول" && !hasTawrid) {
      hasTawrid = true;
      totals.final_comments = `تم توريد مرتجع المستفيدة إلى حساب الممول في دفعة شهر ${monthValue} وذلك بسبب ${uncashedReason}`;
    }

    const recomAllowed = !recomValue || recomValue === "يعاد الصرف للحالة";
    
    if (!hasTawrid && recomAllowed) {
      totals.total_uncashed_cnt += isUncashed;
      totals.total_uncashed_amt += uncashedAmt;
    }
  }

  // Rules for zeroing out uncashed totals if everything was cashed
  if (totals.total_pay_list === totals.total_cashed_cnt || hasTawrid) {
    totals.total_uncashed_cnt = 0;
  }
  if (totals.total_pay_amt === totals.total_cashed_amt || hasTawrid) {
    totals.total_uncashed_amt = 0;
  }

  return totals;
};

// STEP 1: Saving from Enrollment Review Database
const seedEnrollment = (db: Database.Database, projectId: string, projectName: string) => {
  try {
    const enrollmentDb = new Database(ENROLLMENT_DB, { fileMustExist: true });
    const rows = enrollmentDb
      .prepare(
        `SELECT benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name
         FROM enrollment_review
         WHERE project_id = ?`
      )
      .all(projectId);
      
    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO ${TABLE_NAME}
       (project_id, project_name, benef_id, bnf_name, bnf_vill, bnf_ozla, bnf_mud, ed_id, ed_name)
       VALUES (@projectId, @projectName, @benef_id, @bnf_name, @bnf_vill, @bnf_ozla, @bnf_mud, @ed_id, @ed_name)`
    );
    
    const transaction = db.transaction((records: any[]) => {
      records.forEach((record) =>
        insertStmt.run({
          projectId,
          projectName,
          benef_id: record.benef_id,
          bnf_name: record.bnf_name,
          bnf_vill: record.bnf_vill,
          bnf_ozla: record.bnf_ozla,
          bnf_mud: record.bnf_mud,
          ed_id: record.ed_id,
          ed_name: record.ed_name,
        })
      );
    });
    transaction(rows);
  } catch (error) {
    // Silently continue if enrollment DB isn't available
  }
};

export async function GET() {
  await ensureDirectory();
  const db = initializeDatabase();
  const columns = db.prepare(`PRAGMA table_info(${TABLE_NAME})`).all().map((col: any) => col.name);
  db.close();
  return NextResponse.json({ columns });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;
  await ensureDirectory();

  if (action === "schema") {
    const db = initializeDatabase();
    const columns = db.prepare(`PRAGMA table_info(${TABLE_NAME})`).all().map((col: any) => col.name);
    db.close();
    return NextResponse.json({ columns });
  }

  if (action === "check_duplicates") {
    const { projectId, uniqueIds, uniqueIdCol } = body;
    if (!projectId || !Array.isArray(uniqueIds)) {
      return NextResponse.json({ error: "Missing duplicate parameters" }, { status: 400 });
    }
    const lookupColumn = sanitizeColumn(uniqueIdCol) || "benef_id";
    if (!VALID_COLUMNS.has(lookupColumn.toLowerCase())) {
      return NextResponse.json({ error: "Invalid unique column" }, { status: 400 });
    }
    const db = initializeDatabase();
    const placeholders = uniqueIds.map(() => "?").join(",");
    const stmt = db.prepare(
      `SELECT "${lookupColumn}" FROM ${TABLE_NAME} WHERE project_id = ? AND "${lookupColumn}" IN (${placeholders})`
    );
    const rows = stmt.all(projectId, ...uniqueIds);
    const existing = new Set(rows.map((row: any) => normalizeValue(row[lookupColumn])));
    const totalInDb = db
      .prepare(`SELECT COUNT(*) as total FROM ${TABLE_NAME} WHERE project_id = ?`)
      .get(projectId) as { total: number };
      
    db.close();
    return NextResponse.json({ 
      count: existing.size, 
      totalInDb: totalInDb?.total || 0, 
      duplicateIds: Array.from(existing) 
    });
  }

  if (action === "save") {
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
      uniqueFileIdColumn,
      uniqueDbColumn,
      mode = "replace",
      duplicateIds = [],
    } = body;

    if (!projectId || !paymentCycle || !uniqueFileIdColumn) {
      return NextResponse.json({ error: "Missing required save information" }, { status: 400 });
    }
    const lookupColumn = sanitizeColumn(uniqueDbColumn) || "benef_id";
    if (!VALID_COLUMNS.has(lookupColumn.toLowerCase())) {
      return NextResponse.json({ error: "Invalid lookup column" }, { status: 400 });
    }

    const cycleSuffix = `s${Number(paymentCycle)}`;
    const paymentEntries = parseMappingEntries(paymentMapping);
    const uncashedEntries = parseMappingEntries(uncashedMapping);
    const duplicateSet = new Set((duplicateIds || []).map((id: any) => normalizeValue(id)));

    const db = initializeDatabase();
    
    // Step 1: Execute Seed
    const existingCount = db.prepare(`SELECT COUNT(*) as cnt FROM ${TABLE_NAME} WHERE project_id = ?`).get(projectId) as { cnt: number };
    if (!existingCount || existingCount.cnt === 0) {
      seedEnrollment(db, projectId, projectName);
    }

    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO ${TABLE_NAME} (project_id, project_name, "${lookupColumn}") VALUES (?, ?, ?)`
    );

    // STEP 2, 3, 4: Payment Data processing
    const processRows = (rows: any[], entries: { fileCol: string; dbCol: string }[], isPayment: boolean) => {
      rows.forEach((row) => {
        const lookupValue = normalizeValue(row[uniqueFileIdColumn]);
        if (!lookupValue) return;
        
        // Skip duplicate logic
        if (mode === "skip" && duplicateSet.has(lookupValue)) {
          return; // skipping the duplicate
        }
        
        insertStmt.run(projectId, projectName || "", lookupValue);
        
        const updates: Record<string, any> = {
          project_id: projectId,
          project_name: projectName || "",
          benef_id: lookupValue,
        };
        
        if (isPayment) {
          updates[`is_pay_list_${cycleSuffix}`] = 1; // Step 2
          updates[`pay_cyc_cnt_${cycleSuffix}`] = paymentCycleCount || 0; // Step 3
          updates[`pay_cyc_mon_list_${cycleSuffix}`] = Array.isArray(paymentMonths) ? paymentMonths.join(", ") : paymentMonths; // Step 4
        }

        entries.forEach((entry) => {
          updates[entry.dbCol] = row[entry.fileCol];
        });

        const setClause = Object.keys(updates)
          .map((col) => `"${col}" = @${col}`)
          .join(", ");
          
        if (!setClause) return;
        
        const stmt = db.prepare(
          `UPDATE ${TABLE_NAME} SET ${setClause} WHERE project_id = @projectId AND "${lookupColumn}" = @lookupValue`
        );
        stmt.run({ ...updates, projectId, lookupValue });
      });
    };

    // Run Payment (Steps 2, 3, 4)
    processRows(paymentData, paymentEntries, true);
    
    // STEP 5: Run Uncashed logic
    processRows(uncashedData, uncashedEntries, false);

    // STEP 6: Mark Cashed Logic 
    // If it's in the pay list, and is NOT flagged as uncashed, then it is cashed.
    const markCashedStmt = db.prepare(
      `UPDATE ${TABLE_NAME}
       SET "is_cashed_${cycleSuffix}" = 1, 
           "cashed_amt_${cycleSuffix}" = COALESCE("pay_amt_${cycleSuffix}", 0)
       WHERE project_id = ? 
       AND COALESCE("is_pay_list_${cycleSuffix}", 0) = 1 
       AND COALESCE("is_uncashed_${cycleSuffix}", 0) <> 1`
    );
    markCashedStmt.run(projectId);

    // STEP 7: Calculate Totals
    const allRows = db.prepare(`SELECT * FROM ${TABLE_NAME} WHERE project_id = ?`).all(projectId);
    const updateTotalsStmt = db.prepare(
      `UPDATE ${TABLE_NAME}
       SET total_pay_list = @total_pay_list,
           total_pay_cyc_cnt = @total_pay_cyc_cnt,
           total_pay_amt = @total_pay_amt,
           total_cashed_cnt = @total_cashed_cnt,
           total_cashed_amt = @total_cashed_amt,
           total_uncashed_cnt = @total_uncashed_cnt,
           total_uncashed_amt = @total_uncashed_amt,
           final_comments = @final_comments
       WHERE Id = @Id`
    );
    
    const totalsTransaction = db.transaction((records: any[]) => {
      records.forEach((record) => {
        const totals = calculateTotals(record);
        updateTotalsStmt.run({
          ...totals,
          Id: record.Id,
        });
      });
    });
    totalsTransaction(allRows);

    const stats = {
      saved: mode === "replace" ? allRows.length : allRows.length - duplicateSet.size,
      updated: mode === "replace" ? duplicateSet.size : 0,
      skipped: mode === "skip" ? duplicateSet.size : 0,
      total: allRows.length,
    };

    db.close();
    
    return NextResponse.json({
      stats,
      message: "Data has been successfully synchronized to the database.",
    });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}