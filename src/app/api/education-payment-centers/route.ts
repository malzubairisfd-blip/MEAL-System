// src/app/api/education-payment-centers/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getEpcFile = () => path.join(getDataPath(), 'epc.json');

async function getExistingCenters() {
    const EPC_FILE = getEpcFile();
    try {
        await fs.access(EPC_FILE);
        const raw = await fs.readFile(EPC_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

async function ensureDataFile() {
    await fs.mkdir(getDataPath(), { recursive: true });
    try {
        await fs.access(getEpcFile());
    } catch {
        await fs.writeFile(getEpcFile(), "[]", "utf-8");
    }
}

export async function GET() {
    try {
        await ensureDataFile();
        const centers = await getExistingCenters();
        return NextResponse.json(centers);
    } catch (err: any) {
        return NextResponse.json({ error: "Failed to read centers file.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await ensureDataFile();
        const newCenter = await req.json();

        if (!newCenter || typeof newCenter !== "object") {
            return NextResponse.json({ error: "Invalid center payload" }, { status: 400 });
        }
        
        const existingCenters = await getExistingCenters();
        
        existingCenters.push(newCenter);
        
        await fs.writeFile(getEpcFile(), JSON.stringify(existingCenters, null, 2), "utf8");
        
        return NextResponse.json({ message: "Center saved successfully." });

    } catch (err: any) {
        console.error("[EPC_API_ERROR]", err);
        return NextResponse.json({ error: "Failed to save center.", details: String(err) }, { status: 500 });
    }
}
