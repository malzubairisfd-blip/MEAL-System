
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-assessed.db");

const DB_COLUMNS_FOR_CREATION = [
  "id INTEGER PRIMARY KEY AUTOINCREMENT", "project_id TEXT", "project_name TEXT", "internalId TEXT", "data JSON",
  "Generated_Cluster_ID TEXT", "Size REAL", "Flag TEXT", "Max_PairScore REAL", "pairScore REAL",
  "nameScore REAL", "husbandScore REAL", "childrenScore REAL", "idScore REAL", "phoneScore REAL",
  "locationScore REAL", "groupDecision TEXT", "recordDecisions TEXT", "decisionReasons TEXT",
  "confidenceScore REAL", "reasons TEXT", "pre_classified_result TEXT", "group_analysis TEXT",
  "avgPairScore REAL", "avgFirstNameScore REAL", "avgFamilyNameScore REAL", "avgAdvancedNameScore REAL",
  "avgTokenReorderScore REAL", "avgWomanNameScore REAL", "avgHusbandNameScore REAL", "avgFinalScore REAL",
  "womanName TEXT", "husbandName TEXT", "nationalId TEXT", "phone TEXT", "village TEXT", "subdistrict TEXT",
  "children TEXT", "beneficiaryId TEXT", "womanName_normalized TEXT", "husbandName_normalized TEXT",
  "children_normalized TEXT", "subdistrict_normalized TEXT", "village_normalized TEXT", "parts TEXT", "husbandParts TEXT",
  // Many other columns follow...
].join(", ");


const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

function initializeDatabase() {
  const db = new Database(getDbPath());
  db.exec(`CREATE TABLE IF NOT EXISTS assessed_data (${DB_COLUMNS_FOR_CREATION});`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_project_internal ON assessed_data (project_id, internalId);`);
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

    if (action === "get_schema") {
      let db: Database.Database | null = null;
      try {
        db = new Database(getDbPath(), { fileMustExist: true });
        const tableInfo = db.prepare("PRAGMA table_info(assessed_data)").all();
        const columns = tableInfo.map((c: any) => c.name);
        return NextResponse.json({ columns });
      } catch (error: any) {
        if (error.code === 'SQLITE_CANTOPEN') {
          const db = initializeDatabase();
          const tableInfo = db.prepare("PRAGMA table_info(assessed_data)").all();
          const columns = tableInfo.map((c: any) => c.name);
          db.close();
          return NextResponse.json({ columns });
        }
        throw error;
      } finally {
        if (db) db.close();
      }
    }

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
      if (!projectId || !Array.isArray(records) || !mode || !uniqueIdDbCol) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
      }
      const db = initializeDatabase();
      try {
        const tableCols = db.prepare("PRAGMA table_info(assessed_data)").all().map((c: any) => c.name);
        const sanitizedUniqueIdDbCol = sanitizeColumn(uniqueIdDbCol);

        if (!sanitizedUniqueIdDbCol || !tableCols.includes(sanitizedUniqueIdDbCol)) {
          return NextResponse.json({ error: "Invalid unique ID DB column" }, { status: 400 });
        }
        
        db.exec(`CREATE INDEX IF NOT EXISTS idx_${sanitizedUniqueIdDbCol} ON assessed_data (${sanitizedUniqueIdDbCol});`);

        let savedCount = 0;
        let skippedCount = 0;
        let updatedCount = 0;
        
        const allColumns = Array.from(
          new Set(records.flatMap((record: any) => Object.keys(record)))
        ).filter((col) => tableCols.includes(col) && col !== "id");

        const insertStmt =
          allColumns.length > 0
            ? db.prepare(
                `INSERT INTO assessed_data (${allColumns.join(", ")}) VALUES (${allColumns.map(() => "?").join(", ")})`
              )
            : null;

        const updateStmt =
          allColumns.length > 0
            ? db.prepare(
                `UPDATE assessed_data SET ${allColumns.filter(c => c !== sanitizedUniqueIdDbCol && c !== 'project_id').map((col) => `${col} = @${col}`).join(", ")} WHERE project_id = @project_id AND ${sanitizedUniqueIdDbCol} = @${sanitizedUniqueIdDbCol}`
              )
            : null;
            
        const checkStmt = db.prepare(`SELECT id FROM assessed_data WHERE project_id = ? AND ${sanitizedUniqueIdDbCol} = ?`);

        const transaction = db.transaction(() => {
          for (const record of records) {
             const uniqueValue = record[sanitizedUniqueIdDbCol];
             if (!uniqueValue) {
                 skippedCount++;
                 continue;
             }
             const existing = checkStmt.get(projectId, uniqueValue);

             if (mode === 'replace') {
                if (existing) {
                    const updateValues: {[key:string]: any} = {};
                     allColumns.forEach(col => {
                        updateValues[col] = record[col] !== undefined ? record[col] : null;
                    });
                    updateStmt?.run(updateValues);
                    updatedCount++;
                } else {
                    const insertValues = allColumns.map((col) => (record[col] !== undefined ? record[col] : null));
                    insertStmt?.run(...insertValues);
                    savedCount++;
                }
             } else { // mode === 'skip'
                if (!existing) {
                   const values = allColumns.map((col) => (record[col] !== undefined ? record[col] : null));
                   insertStmt?.run(...values);
                   savedCount++;
                } else {
                   skippedCount++;
                }
             }
          }
        });

        transaction();

        return NextResponse.json({
          saved: savedCount,
          skipped: skippedCount,
          updated: updatedCount,
          total: records.length,
          mode: mode,
        });
      } finally {
        db.close();
      }
    }
    
     if (action === "update") {
      if (!projectId || !Array.isArray(records)) {
        return NextResponse.json({ error: "Missing parameters for update" }, { status: 400 });
      }
      const db = initializeDatabase();
      try {
        const tableCols = db.prepare("PRAGMA table_info(assessed_data)").all().map((c: any) => c.name);

        let updatedCount = 0;
        const transaction = db.transaction((recordsToUpdate) => {
          for (const record of recordsToUpdate) {
            if(!record.internalId) continue;
            
            const colsToUpdate = Object.keys(record).filter(col => tableCols.includes(col) && col !== 'id' && col !== 'internalId' && col !== 'project_id');
            if(colsToUpdate.length === 0) continue;
            
            const setClause = colsToUpdate.map(col => `${col} = @${col}`).join(", ");
            const stmt = db.prepare(
                `UPDATE assessed_data SET ${setClause} WHERE project_id = @project_id AND internalId = @internalId`
              );
            
            const info = stmt.run({ ...record, project_id: projectId });
            if (info.changes > 0) {
                updatedCount++;
            }
          }
        });
        
        transaction(records);
        
        return NextResponse.json({ updated: updatedCount });

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
