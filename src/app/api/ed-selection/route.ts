// src/app/api/ed-selection/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getEdSelectionFile = () => path.join(getDataPath(), 'ed-selection.json');

async function ensureDataFile() {
    await fs.mkdir(getDataPath(), { recursive: true });
    try {
        await fs.access(getEdSelectionFile());
    } catch {
        await fs.writeFile(getEdSelectionFile(), "[]", "utf-8");
    }
}

export async function POST(req: Request) {
    await ensureDataFile();
    try {
        const body = await req.json();
        
        // In a real app, you might want to append to or manage existing data.
        // For this example, we'll just overwrite with the latest results.
        await fs.writeFile(getEdSelectionFile(), JSON.stringify(body, null, 2), 'utf8');

        return NextResponse.json({ message: "Educator selection data saved successfully." });

    } catch (error: any) {
        console.error("[ED_SELECTION_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to save educator selection data.", details: error.message }, { status: 500 });
    }
}
