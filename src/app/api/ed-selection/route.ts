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
