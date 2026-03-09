
// src/app/api/bnf-cmam/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";
import dayjs from "dayjs";

// --- Database and Path setup ---
const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-cmam.db");
const getEducatorsDbPath = () => path.join(getDataPath(), 'educators.db');
const getProjectsDbPath = () => path.join(getDataPath(), 'projects.db');

// --- Schema Definition ---
const DB_COLUMNS_FOR_CREATION = `(
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

const columnDefs = DB_COLUMNS_FOR_CREATION.replace(/^\(|\)$/g, "").split(",").map(s => s.trim()).filter(Boolean);
const columnTypeMap = new Map<string, string>();
const DB_COLUMNS = columnDefs.map(def => {
    const parts = def.split(/\s+/);
    const name = parts[0].replace(/"/g, "");
    const type = parts[1] || 'TEXT';
    columnTypeMap.set(name, type);
    return name;
});

// --- Utility Functions ---
const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const sanitizeColumn = (col?: string) => (col ? col.replace(/[^a-zA-Z0-9_]/g, "") : "");

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS bnf_cmam ${DB_COLUMNS_FOR_CREATION};`);
  const tableCols = db.prepare("PRAGMA table_info(bnf_cmam)").all().map((c: any) => c.name);
  DB_COLUMNS.forEach(colName => {
    if (!tableCols.includes(colName)) {
      try {
        const type = columnTypeMap.get(colName) || 'TEXT';
        db.exec(`ALTER TABLE bnf_cmam ADD COLUMN "${colName}" ${type}`);
      } catch (error) {
        console.warn(`Could not add column ${colName}:`, error);
      }
    }
  });
  return db;
}

const normalizeName = (name: string): string => {
    return (name || '').trim().replace(/\s+/g, ' ');
}

// --- Main API Handler ---
export async function POST(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const body = await req.json();
    const { action, projectId, records, uniqueIdCol, uniqueIds, mode, mapping, regDate, currDate } = body;

    switch (action) {
      case 'get_schema': {
        let dbInstance: Database.Database | null = null;
        try {
          dbInstance = initializeDatabase();
          const tableInfo = dbInstance.prepare("PRAGMA table_info(bnf_cmam)").all();
          const columns = tableInfo.map((c: any) => c.name);
          return NextResponse.json({ columns });
        } catch (error: any) {
            // If the DB can't be opened, it might not exist. Try creating it.
            if ((error as any).code === "SQLITE_CANTOPEN") {
                const dbFallback = initializeDatabase();
                const tableInfo = dbFallback.prepare("PRAGMA table_info(bnf_cmam)").all();
                const columns = tableInfo.map((c: any) => c.name);
                dbFallback.close();
                return NextResponse.json({ columns });
            }
            throw error; // Re-throw other errors
        } finally {
          if (dbInstance) dbInstance.close();
        }
      }

      case 'get_record_count': {
        let db: Database.Database | null = null;
        try {
          db = new Database(getDbPath(), { fileMustExist: true });
          const result = db.prepare('SELECT COUNT(*) as count FROM bnf_cmam WHERE project_id = ?').get(projectId) as { count: number };
          return NextResponse.json({ count: result?.count || 0 });
        } catch (error: any) {
          if ((error as any).code === 'SQLITE_CANTOPEN') return NextResponse.json({ count: 0 });
          throw error;
        } finally {
          db?.close();
        }
      }

      case 'check_duplicates': {
         if (!projectId || !uniqueIdCol || !Array.isArray(uniqueIds)) {
            return NextResponse.json({ error: "Missing parameters for duplicate check." }, { status: 400 });
        }
        let dbInstance: Database.Database | null = null;
        try {
            dbInstance = initializeDatabase();
            const sanitizedColumn = sanitizeColumn(uniqueIdCol);
            
            const existingIds = new Set<string>();
            const chunks = chunkArray(uniqueIds.map(String), 900);
            
            for (const chunk of chunks) {
            if (chunk.length === 0) continue;
            const placeholders = chunk.map(() => "?").join(",");
            const stmt = dbInstance.prepare(
                `SELECT "${sanitizedColumn}" FROM bnf_cmam WHERE project_id = ? AND "${sanitizedColumn}" IN (${placeholders})`
            );
            const results: any[] = stmt.all(projectId, ...chunk);
            results.forEach((row) => {
                const value = row[sanitizedColumn];
                if (value !== undefined && value !== null) {
                existingIds.add(String(value));
                }
            });
            }
            
            const tableTotalResult = dbInstance.prepare("SELECT COUNT(*) as total FROM bnf_cmam WHERE project_id = ?").get(projectId) as {total: number} | undefined;
            const totalInDb = tableTotalResult?.total || 0;

            return NextResponse.json({ count: existingIds.size, totalInDb, duplicateIds: Array.from(existingIds) });
        } catch (error: any) {
            if (error.code === "SQLITE_CANTOPEN") return NextResponse.json({ count: 0, totalInDb: 0, duplicateIds: [] });
            throw error;
        } finally {
            if (dbInstance) dbInstance.close();
        }
      }

      case 'save': {
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        const encoder = new TextEncoder();
        const send = (data: any) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        (async () => {
          let db: Database.Database | null = null;
          try {
            send({ type: 'progress', status: 'initializing', progress: 5, message: "Starting process..." });
            
            const projectDb = new Database(getProjectsDbPath(), { fileMustExist: true });
            const project = projectDb.prepare('SELECT projectName FROM projects WHERE projectId = ?').get(projectId) as { projectName: string };
            projectDb.close();
            if (!project) throw new Error("Project not found");

            let educatorPhoneMap = new Map<string, string>();
            try {
              const educatorsDb = new Database(getEducatorsDbPath(), { fileMustExist: true });
              educatorsDb.prepare('SELECT applicant_name, phone_no FROM educators WHERE project_id = ?').all(projectId).forEach((edu: any) => {
                  educatorPhoneMap.set(normalizeName(edu.applicant_name), edu.phone_no || '');
              });
              educatorsDb.close();
            } catch {
              send({ type: 'progress', status: 'enriching', progress: 10, message: "Educators database not found, skipping phone enrichment." });
            }

            db = initializeDatabase();
            
            send({ type: 'progress', status: 'processing_records', progress: 15, message: "Enriching and calculating data..." });

            const enrichedRecords = records.map((row: any) => {
              const mapped: { [key: string]: any } = { project_id: projectId, project_name: project.projectName };
              for (const [fileCol, dbCol] of Object.entries(mapping)) {
                  if (row.hasOwnProperty(fileCol)) mapped[dbCol as string] = row[fileCol];
              }
              if (mapped.ED_NAME) {
                  mapped.ed_phone = educatorPhoneMap.get(normalizeName(mapped.ED_NAME)) || null;
              }
              if (mapped.BENEF_CLASS_DESC === 'مستفيدة') {
                  const regDateObj = dayjs(regDate);
                  const currDateObj = dayjs(currDate);
                  if (regDateObj.isValid() && currDateObj.isValid()) {
                    mapped.reg_date = regDateObj.format('YYYY-MM-DD');
                    mapped.curr_date = currDateObj.format('YYYY-MM-DD');
                    const regCurrDays = currDateObj.diff(regDateObj, 'day');
                    const regCurrMonths = regCurrDays / 30.4375;
                    mapped.reg_curr_days = regCurrDays;
                    mapped.reg_curr_mon = regCurrMonths;
                    
                    const ageYears = Number(mapped.AGE_YEARS) || 0;
                    const bnfAgeMonths = ageYears * 12;
                    const newBnfAgeMonths = bnfAgeMonths + regCurrMonths;
                    const newBnfAgeYears = newBnfAgeMonths / 12;
                    
                    mapped.bnf_age_mon = bnfAgeMonths;
                    mapped.new_bnf_age_mon = newBnfAgeMonths;
                    mapped.new_bnf_age_years = newBnfAgeYears;
                    mapped.cmam_qualify = newBnfAgeYears <= 49 ? 'Qualified' : 'Disqualified';
                  }
              }
              return mapped;
            });
            
            send({ type: 'progress', status: 'saving', progress: 80, message: `Preparing to save ${enrichedRecords.length} records...` });
            let saved = 0, updated = 0, skipped = 0;

            const allRecordKeys = new Set(enrichedRecords.flatMap(r => Object.keys(r)));
            const insertCols = [...allRecordKeys].filter(col => DB_COLUMNS.includes(col) && col !== 'id');
            const updateCols = insertCols.filter(col => col !== 'id' && col !== uniqueIdCol && col !== 'project_id');

            const insertStmt = db.prepare(`INSERT INTO bnf_cmam (${insertCols.map(c => `"${c}"`).join(', ')}) VALUES (${insertCols.map(c => `@${c}`).join(', ')})`);
            const updateStmt = db.prepare(`UPDATE bnf_cmam SET ${updateCols.map(col => `"${col}" = @${col}`).join(', ')} WHERE project_id = @project_id AND "${uniqueIdCol}" = @uniqueValue`);
            const checkStmt = db.prepare(`SELECT id FROM bnf_cmam WHERE project_id = ? AND "${uniqueIdCol}" = ?`);

            const transaction = db.transaction(() => {
                for (const record of enrichedRecords) {
                    const uniqueValue = record[uniqueIdCol];
                    if (uniqueValue === undefined || uniqueValue === null) {
                        skipped++;
                        continue;
                    }
                    const existing = checkStmt.get(projectId, uniqueValue);

                    if (existing) {
                        if (mode === 'replace') {
                           const info = updateStmt.run({ ...record, project_id: projectId, uniqueValue: uniqueValue });
                           if (info.changes > 0) updated++;
                        } else {
                           skipped++;
                        }
                    } else {
                        insertStmt.run(record);
                        saved++;
                    }
                }
            });
            transaction();
            send({ type: 'done', message: 'Process complete.', stats: { saved, updated, skipped, total: enrichedRecords.length } });
          } catch(err: any) {
              send({ type: 'error', error: err.message });
          } finally {
              if (db) db.close();
              writer.close();
          }
        })();

        return new Response(stream.readable, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[BNF_CMAM_API_ERROR]", error);
    return NextResponse.json({ error: "Failed to process request.", details: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath(), { fileMustExist: true });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    let records;
    if (projectId && projectId !== 'all') {
      records = db.prepare("SELECT * FROM bnf_cmam WHERE project_id = ?").all(projectId);
    } else {
      records = db.prepare("SELECT * FROM bnf_cmam").all();
    }
    
    db.close();
    return NextResponse.json(records);
  } catch (error: any) {
    if (error.code === "SQLITE_CANTOPEN") return NextResponse.json([]);
    return NextResponse.json({ error: "Failed to fetch CMAM data.", details: error.message }, { status: 500 });
  }
}

    