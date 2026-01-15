// src/app/api/ed-selection/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'educators.db');

// Function to initialize the database and create tables if they don't exist
function initializeDatabase() {
    const db = new Database(getDbPath());
    
    // Create a table for the results, using the keys from one of the result objects
    // This is a dynamic way to create the table schema based on the processed data structure
    const createTableStmt = `
        CREATE TABLE IF NOT EXISTS educators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projectName TEXT,
            processedAt TEXT,
            applicantId TEXT UNIQUE,
            data TEXT
        );
    `;
    db.exec(createTableStmt);
    
    return db;
}


export async function POST(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase();
        
        const body = await req.json();
        const { projectName, processedAt, results } = body;

        if (!projectName || !Array.isArray(results)) {
            return NextResponse.json({ error: "Invalid payload: projectName and results array are required." }, { status: 400 });
        }

        // Use a transaction for performance and data integrity when inserting many rows
        const insert = db.prepare('INSERT OR REPLACE INTO educators (projectName, processedAt, applicantId, data) VALUES (?, ?, ?, ?)');
        const insertMany = db.transaction((records) => {
            for (const record of records) {
                // The 'data' column will store the entire record object as a JSON string
                insert.run(projectName, processedAt, record['_id'], JSON.stringify(record));
            }
        });

        insertMany(results);
        
        db.close();

        return NextResponse.json({ message: "Educator selection data saved to SQLite database successfully." });

    } catch (error: any) {
        console.error("[ED_SELECTION_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to save educator selection data to SQLite.", details: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase();
        
        const stmt = db.prepare('SELECT data FROM educators');
        const rows = stmt.all();
        
        db.close();

        const results = rows.map((row: any) => JSON.parse(row.data));

        return NextResponse.json(results);

    } catch (error: any) {
        console.error("[ED_SELECTION_API_GET_ERROR]", error);
        // If the DB file doesn't exist, better-sqlite3 throws an error.
        // We can treat this as "no records found" and return an empty array.
        if (error.code === 'SQLITE_CANTOPEN') {
            return NextResponse.json([]);
        }
        return NextResponse.json({ error: "Failed to fetch educator selection data.", details: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { applicantIds, hallName, hallNumber } = await req.json();

        if (!Array.isArray(applicantIds) || applicantIds.length === 0 || !hallName || !hallNumber) {
            return NextResponse.json({ error: "Invalid payload: applicantIds array, hallName, and hallNumber are required." }, { status: 400 });
        }
        
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = initializeDatabase();

        const getStmt = db.prepare('SELECT data FROM educators WHERE applicantId = ?');
        const updateStmt = db.prepare('UPDATE educators SET data = ? WHERE applicantId = ?');

        const updateMany = db.transaction(() => {
            for (const applicantId of applicantIds) {
                const row = getStmt.get(applicantId) as { data: string } | undefined;
                if (row) {
                    const applicantData = JSON.parse(row.data);
                    applicantData['hallName'] = hallName;
                    applicantData['hallNumber'] = hallNumber;
                    updateStmt.run(JSON.stringify(applicantData), applicantId);
                }
            }
        });

        updateMany();
        db.close();
        
        return NextResponse.json({ message: "Applicants successfully assigned to hall." });

    } catch (error: any) {
        console.error("[ED_SELECTION_API_PUT_ERROR]", error);
        return NextResponse.json({ error: "Failed to update applicant hall assignments.", details: error.message }, { status: 500 });
    }
}
