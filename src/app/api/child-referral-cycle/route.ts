// src/app/api/child-referral-cycle/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getJsonPath = () => path.join(getDataPath(), 'child-referral-cycle.json');

async function getExistingData() {
    try {
        await fs.access(getJsonPath());
        const raw = await fs.readFile(getJsonPath(), 'utf-8');
        return JSON.parse(raw);
    } catch {
        return { projectId: "", projectName: "", followUpCycle: 1, followUpMonth: "" };
    }
}

async function ensureDataFile() {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        await fs.access(getJsonPath());
    } catch {
        await fs.writeFile(getJsonPath(), JSON.stringify({ projectId: "", projectName: "", followUpCycle: 1, followUpMonth: "" }), "utf-8");
    }
}

export async function GET() {
    await ensureDataFile();
    const data = await getExistingData();
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    await ensureDataFile();
    try {
        const body = await req.json();
        const existingData = await getExistingData();
        const updatedData = { ...existingData, ...body };
        await fs.writeFile(getJsonPath(), JSON.stringify(updatedData, null, 2), "utf8");
        return NextResponse.json({ ok: true, message: "Configuration saved." });
    } catch (error: any) {
        return NextResponse.json({ error: "Failed to save configuration.", details: error.message }, { status: 500 });
    }
}
