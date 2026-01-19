
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getTemplatesFile = () => path.join(getDataPath(), 'pdf-templates.json');

async function getExistingTemplates() {
    const TEMPLATES_FILE = getTemplatesFile();
    try {
        await fs.access(TEMPLATES_FILE);
        const raw = await fs.readFile(TEMPLATES_FILE, 'utf-8');
        const templates = JSON.parse(raw);
        return Array.isArray(templates) ? templates : [];
    } catch (e) {
        return [];
    }
}

async function ensureDataFile() {
    const DATA_PATH = getDataPath();
    const TEMPLATES_FILE = getTemplatesFile();
    try {
        await fs.access(DATA_PATH);
    } catch {
        await fs.mkdir(DATA_PATH, { recursive: true });
    }
    try {
        await fs.access(TEMPLATES_FILE);
    } catch {
        await fs.writeFile(TEMPLATES_FILE, "[]", "utf-8");
    }
}

export async function GET() {
    await ensureDataFile();
    const templates = await getExistingTemplates();
    return NextResponse.json(templates);
}

export async function POST(req: Request) {
    await ensureDataFile();
    try {
        const body = await req.json();
        if (!Array.isArray(body)) {
            return NextResponse.json({ error: "Invalid payload, expected an array of templates." }, { status: 400 });
        }
        await fs.writeFile(getTemplatesFile(), JSON.stringify(body, null, 2), "utf8");
        return NextResponse.json({ ok: true, message: "Templates saved successfully." });
    } catch (error: any) {
        return NextResponse.json({ error: "Failed to save templates.", details: error.message }, { status: 500 });
    }
}
