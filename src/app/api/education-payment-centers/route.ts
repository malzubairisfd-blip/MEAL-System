// src/app/api/education-payment-centers/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";

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
    await ensureDataFile();
    const contentType = req.headers.get('content-type');

    if (contentType?.includes('multipart/form-data')) {
        try {
            const formData = await req.formData();
            const file = formData.get('file') as File | null;
            if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet);
            await fs.writeFile(getEpcFile(), JSON.stringify(data, null, 2), 'utf8');
            return NextResponse.json({ message: "Education and Payment Centers data saved successfully.", count: data.length });
        } catch (error: any) {
            return NextResponse.json({ error: "Failed to process and save file.", details: error.message }, { status: 500 });
        }
    }
    
    else if (contentType?.includes('application/json')) {
        try {
            const newCenter = await req.json();
            if (!newCenter || typeof newCenter !== "object") {
                return NextResponse.json({ error: "Invalid center payload" }, { status: 400 });
            }
            const existingCenters = await getExistingCenters();
            existingCenters.push(newCenter);
            await fs.writeFile(getEpcFile(), JSON.stringify(existingCenters, null, 2), "utf8");
            return NextResponse.json({ message: "Center saved successfully." });
        } catch (err: any) {
            return NextResponse.json({ error: "Failed to save center.", details: String(err) }, { status: 500 });
        }
    }

    return NextResponse.json({ error: "Unsupported Content-Type" }, { status: 415 });
}

export async function PUT(req: Request) {
    await ensureDataFile();
    try {
        const updatedCenter = await req.json();
        if (!updatedCenter || !updatedCenter.FAC_ID) {
            return NextResponse.json({ error: "Invalid payload, FAC_ID is required." }, { status: 400 });
        }
        let existingCenters = await getExistingCenters();
        const index = existingCenters.findIndex((c: any) => c.FAC_ID === updatedCenter.FAC_ID);

        if (index === -1) {
            return NextResponse.json({ error: "Center not found." }, { status: 404 });
        }
        existingCenters[index] = updatedCenter;
        await fs.writeFile(getEpcFile(), JSON.stringify(existingCenters, null, 2), 'utf8');
        return NextResponse.json({ message: "Center updated successfully." });
    } catch (err: any) {
        return NextResponse.json({ error: "Failed to update center.", details: String(err) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    await ensureDataFile();
    try {
        const { FAC_ID } = await req.json();
        if (!FAC_ID) {
            return NextResponse.json({ error: "FAC_ID is required for deletion." }, { status: 400 });
        }
        let existingCenters = await getExistingCenters();
        const updatedCenters = existingCenters.filter((c: any) => c.FAC_ID !== FAC_ID);
        if (updatedCenters.length === existingCenters.length) {
            return NextResponse.json({ error: "Center not found." }, { status: 404 });
        }
        await fs.writeFile(getEpcFile(), JSON.stringify(updatedCenters, null, 2), 'utf8');
        return NextResponse.json({ message: "Center deleted successfully." });
    } catch (err: any) {
        return NextResponse.json({ error: "Failed to delete center.", details: String(err) }, { status: 500 });
    }
}
