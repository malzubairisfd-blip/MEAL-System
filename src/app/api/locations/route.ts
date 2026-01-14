// src/app/api/locations/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getLocFile = () => path.join(getDataPath(), 'loc.json');

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        await fs.mkdir(getDataPath(), { recursive: true });
        await fs.writeFile(getLocFile(), JSON.stringify(data, null, 2), 'utf8');

        return NextResponse.json({ message: "Location data saved successfully.", count: data.length });

    } catch (error: any) {
        console.error("[LOCATIONS_API_ERROR]", error);
        return NextResponse.json({ error: "Failed to process and save file.", details: error.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        const filePath = getLocFile();
        await fs.access(filePath);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        return NextResponse.json(data);
    } catch (error) {
        // If file doesn't exist, return empty array
        return NextResponse.json([]);
    }
}
