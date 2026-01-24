// src/app/api/education-payment-centers/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';
import * as XLSX from "xlsx";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'ec_pc.db');

const DB_COLUMNS = [
    "id", "project_id", "project_name", "proj_no", "mud_no", "mud_name",
    "ozla_no", "ozla_name", "vill_no", "vill_name", "fac_id", "fac_name",
    "loc_id", "loc_full_name", "is_ec", "is_pc", "pc_id", "notes",
    "pc_name2", "is_pc2", "pc_loc2", "same_ozla", "same_ec_pc",
    "pc_ec_cnt", "pc_ed_cnt", "ec_ed_cnt", "pc_bnf_cnt", "ec_bnf_cnt"
];

function initializeDatabase(recreate: boolean = false) {
    const db = new Database(getDbPath());
    if (recreate) {
        db.exec('DROP TABLE IF EXISTS ec_pc_data');
    }

    const createTableStmt = `
        CREATE TABLE IF NOT EXISTS ec_pc_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT,
          project_name TEXT,
          proj_no REAL,
          mud_no REAL,
          mud_name TEXT,
          ozla_no REAL,
          ozla_name TEXT,
          vill_no REAL,
          vill_name TEXT,
          fac_id TEXT UNIQUE,
          fac_name TEXT,
          loc_id REAL,
          loc_full_name TEXT,
          is_ec REAL,
          is_pc REAL,
          pc_id TEXT,
          notes TEXT,
          pc_name2 TEXT,
          is_pc2 REAL,
          pc_loc2 REAL,
          same_ozla REAL,
          same_ec_pc REAL,
          pc_ec_cnt REAL,
          pc_ed_cnt REAL,
          ec_ed_cnt REAL,
          pc_bnf_cnt REAL,
          ec_bnf_cnt REAL
        );
    `;
    db.exec(createTableStmt);
    
    return db;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const facId = searchParams.get('FAC_ID');
    const projectId = searchParams.get('projectId');
    
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = new Database(getDbPath(), { fileMustExist: true });
        
        let data;
        if (facId) {
            data = db.prepare('SELECT * FROM ec_pc_data WHERE fac_id = ?').get(facId);
            if (!data) {
                db.close();
                return NextResponse.json({ error: "Center not found" }, { status: 404 });
            }
        } else if (projectId && projectId !== 'all') {
            data = db.prepare('SELECT * FROM ec_pc_data WHERE project_id = ?').all(projectId);
        } else {
            data = db.prepare('SELECT * FROM ec_pc_data').all();
        }
        
        db.close();
        return NextResponse.json(data);

    } catch (error: any) {
        if (error.code === 'SQLITE_CANTOPEN') {
            return NextResponse.json([]);
        }
        console.error("[EPC_DB_API_GET_ERROR]", error);
        return NextResponse.json({ error: "Failed to fetch EPC data.", details: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    const init = searchParams.get('init') === 'true';
    const contentType = req.headers.get('content-type');

    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase(init);

        let results: any[] = [];

        if (contentType?.includes('multipart/form-data')) {
            const formData = await req.formData();
            const file = formData.get('file') as File | null;
            if (!file) {
                db.close();
                return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
            }
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            results = XLSX.utils.sheet_to_json(sheet);
        } else if (contentType?.includes('application/json')) {
            const body = await req.json();
            results = Array.isArray(body) ? body : [body];
        } else {
             db.close();
             return NextResponse.json({ error: "Unsupported Content-Type" }, { status: 415 });
        }

        if (!Array.isArray(results) || results.length === 0) {
            db.close();
            return NextResponse.json({ message: "No records to insert." }, { status: 200 });
        }
        
        const columns = Object.keys(results[0]).filter(col => DB_COLUMNS.includes(col));
        if (columns.length === 0) {
            db.close();
            return NextResponse.json({ message: "No valid columns to insert." }, { status: 400 });
        }
        
        const columnsString = columns.join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        const insert = db.prepare(`INSERT OR REPLACE INTO ec_pc_data (${columnsString}) VALUES (${placeholders})`);
        
        const insertMany = db.transaction((records) => {
            for (const record of records) {
                const values = columns.map(col => record[col] ?? null);
                insert.run(...values);
            }
        });

        insertMany(results);
        db.close();

        return NextResponse.json({ message: "Education/Payment Center data saved successfully.", count: results.length });

    } catch (error: any) {
        console.error("[EPC_DB_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to save EPC data to SQLite.", details: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const recordToUpdate = await req.json();
        if (!recordToUpdate || !recordToUpdate.fac_id) {
            return NextResponse.json({ error: "Invalid payload, fac_id is required." }, { status: 400 });
        }
        
        const db = new Database(getDbPath());

        const columnsToUpdate = Object.keys(recordToUpdate).filter(col => DB_COLUMNS.includes(col) && col !== 'id' && col !== 'fac_id');
        if (columnsToUpdate.length === 0) {
            db.close();
            return NextResponse.json({ message: "No fields to update." });
        }

        const setClause = columnsToUpdate.map(col => `${col} = ?`).join(', ');
        const values = [...columnsToUpdate.map(col => recordToUpdate[col]), recordToUpdate.fac_id];

        const stmt = db.prepare(`UPDATE ec_pc_data SET ${setClause} WHERE fac_id = ?`);
        const info = stmt.run(...values);
        
        db.close();

        if (info.changes === 0) {
             return NextResponse.json({ error: "Center not found." }, { status: 404 });
        }

        return NextResponse.json({ message: "Center updated successfully." });

    } catch (error: any) {
        console.error("[EPC_DB_PUT_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to update EPC data.", details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { FAC_ID } = await req.json();
        if (!FAC_ID) {
            return NextResponse.json({ error: "FAC_ID is required for deletion." }, { status: 400 });
        }

        const db = new Database(getDbPath());
        const stmt = db.prepare('DELETE FROM ec_pc_data WHERE fac_id = ?');
        const info = stmt.run(FAC_ID);
        db.close();

        if (info.changes === 0) {
            return NextResponse.json({ error: "Center not found." }, { status: 404 });
        }

        return NextResponse.json({ message: "Center deleted successfully." });
    } catch (err: any) {
        console.error("[EPC_DB_DELETE_API_ERROR]", err);
        return NextResponse.json({ error: "Failed to delete center.", details: String(err) }, { status: 500 });
    }
}
