// src/app/api/bnf-assessed/download/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDbPath = () => path.join(process.cwd(), 'src/data', 'bnf-assessed.db');

export async function GET(req: Request) {
    const dbPath = getDbPath();
    try {
        const fileBuffer = await fs.readFile(dbPath);
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/x-sqlite3',
                'Content-Disposition': 'attachment; filename="bnf-assessed.db"',
            },
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ error: "Database file not found. Please save data first." }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to download database file.", details: error.message }, { status: 500 });
    }
}
