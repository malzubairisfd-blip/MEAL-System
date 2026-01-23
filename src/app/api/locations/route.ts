// src/app/api/locations/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'locations.db');
const getJsonPath = () => path.join(getDataPath(), 'loc.json');

async function initializeDatabase() {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = new Database(getDbPath());

    db.exec(`
        CREATE TABLE IF NOT EXISTS locations (
            vill_loc_id INTEGER PRIMARY KEY,
            loc_level INTEGER,
            loc_name TEXT,
            gov_no INTEGER,
            mud_no INTEGER,
            ozla_no INTEGER,
            vill_no INTEGER,
            gov_loc_id INTEGER,
            mud_loc_id INTEGER,
            ozla_loc_id INTEGER,
            gov_name TEXT,
            mud_name TEXT,
            ozla_name TEXT,
            vill_name TEXT,
            loc_full_name TEXT,
            loc_id_key INTEGER,
            list_name TEXT,
            name INTEGER,
            label TEXT,
            is_center INTEGER
        );
    `);

    const result = db.prepare('SELECT COUNT(*) as count FROM locations').get() as { count: number };
    const count = result.count;
    if (count === 0) {
        console.log('Seeding locations database from loc.json...');
        try {
            const jsonString = await fs.readFile(getJsonPath(), 'utf-8');
            const locations = JSON.parse(jsonString);
            if (Array.isArray(locations)) {
                 const columns = [
                    "vill_loc_id", "loc_level", "loc_name", "gov_no", "mud_no", "ozla_no", 
                    "vill_no", "gov_loc_id", "mud_loc_id", "ozla_loc_id", "gov_name", 
                    "mud_name", "ozla_name", "vill_name", "loc_full_name", "loc_id_key", 
                    "list_name", "name", "label", "is_center"
                ];
                const insert = db.prepare(`
                    INSERT OR IGNORE INTO locations (${columns.join(', ')})
                    VALUES (${columns.map(c => `@${c}`).join(', ')})
                `);
                const insertMany = db.transaction((items) => {
                    for (const item of items) {
                        const runData: {[k: string]: any} = {};
                        for (const col of columns) {
                            runData[col] = item[col];
                        }
                        insert.run(runData);
                    }
                });
                insertMany(locations);
            }
        } catch (error) {
            console.error("Failed to read or seed loc.json:", error);
        }
    }
    return db;
}


export async function GET() {
    try {
        const db = await initializeDatabase();
        const locations = db.prepare('SELECT * FROM locations').all();
        db.close();
        return NextResponse.json(locations);
    } catch (error: any) {
        if (error.code === 'SQLITE_CANTOPEN') {
            return NextResponse.json([]);
        }
        console.error("[LOCATIONS_API_GET_ERROR]", error);
        return NextResponse.json({ error: "Failed to fetch locations.", details: error.message }, { status: 500 });
    }
}
