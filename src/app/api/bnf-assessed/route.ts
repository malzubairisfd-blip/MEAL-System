// src/app/api/bnf-assessed/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'bnf-assessed.db');

// Function to initialize the database and create tables if they don't exist
function initializeDatabase() {
    const db = new Database(getDbPath());
    
    // Drop the table if it exists to ensure it's empty
    db.exec('DROP TABLE IF EXISTS assessments');

    // Create a table for the assessment results
    const createTableStmt = `
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projectName TEXT,
            processedAt TEXT,
            assessmentId TEXT UNIQUE,
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
            return NextResponse.json({ error: "Invalid payload: projectName and a 'results' array are required." }, { status: 400 });
        }

        // Use a transaction for performance and data integrity when inserting many rows
        const insert = db.prepare('INSERT OR REPLACE INTO assessments (projectName, processedAt, assessmentId, data) VALUES (?, ?, ?, ?)');
        const insertMany = db.transaction((records) => {
            for (const record of records) {
                // Assuming each record has a unique identifier, e.g., '_id' or 'assessmentId'
                const uniqueId = record['_id'] || record['assessmentId'] || `gen_${Date.now()}_${Math.random()}`;
                // The 'data' column will store the entire record object as a JSON string
                insert.run(projectName, processedAt, uniqueId, JSON.stringify(record));
            }
        });

        insertMany(results);
        
        db.close();

        return NextResponse.json({ message: "Beneficiary assessment data saved to SQLite database successfully." });

    } catch (error: any) {
        console.error("[BNF_ASSESSED_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to save beneficiary assessment data to SQLite.", details: error.message }, { status: 500 });
    }
}
