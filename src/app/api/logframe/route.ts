
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getLogframesFile = () => path.join(getDataPath(), 'logframes.json');

async function getExistingLogframes() {
    const LOGFRAMES_FILE = getLogframesFile();
    try {
        await fs.access(LOGFRAMES_FILE);
        const raw = await fs.readFile(LOGFRAMES_FILE, 'utf-8');
        const logframes = JSON.parse(raw);
        return Array.isArray(logframes) ? logframes : [];
    } catch (e) {
        return [];
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        
        const logframes = await getExistingLogframes();
        
        if (projectId) {
            const logframe = logframes.find(lf => lf.projectId === projectId);
            if (logframe) {
                return NextResponse.json(logframe);
            } else {
                return NextResponse.json({ ok: false, error: "Logframe not found" }, { status: 404 });
            }
        }
        
        return NextResponse.json(logframes);
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: "Failed to read logframes file.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const LOGFRAMES_FILE = getLogframesFile();
    try {
        const newLogframe = await req.json();

        if (!newLogframe || typeof newLogframe !== "object" || !newLogframe.projectId) {
            return NextResponse.json({ ok: false, error: "Invalid logframe payload" }, { status: 400 });
        }
        
        const existingLogframes = await getExistingLogframes();
        
        const index = existingLogframes.findIndex(lf => lf.projectId === newLogframe.projectId);

        if (index !== -1) {
            // Update existing logframe
            existingLogframes[index] = newLogframe;
        } else {
            // Add new logframe
            existingLogframes.push(newLogframe);
        }
        
        await fs.mkdir(getDataPath(), { recursive: true });
        await fs.writeFile(LOGFRAMES_FILE, JSON.stringify(existingLogframes, null, 2), "utf8");
        
        return NextResponse.json({ ok: true, message: `Logframe for project ${newLogframe.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[LOGFRAME_API_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save logframe.", details: String(err) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const LOGFRAMES_FILE = getLogframesFile();
    try {
        const { projectId } = await req.json();

        if (!projectId) {
            return NextResponse.json({ ok: false, error: "projectId is required" }, { status: 400 });
        }
        
        const existingLogframes = await getExistingLogframes();
        const updatedLogframes = existingLogframes.filter(lf => lf.projectId !== projectId);
        
        if (updatedLogframes.length === existingLogframes.length) {
             return NextResponse.json({ ok: false, error: "Logframe not found" }, { status: 404 });
        }

        await fs.writeFile(LOGFRAMES_FILE, JSON.stringify(updatedLogframes, null, 2), "utf8");
        
        return NextResponse.json({ ok: true, message: `Logframe for project ${projectId} deleted successfully.` });

    } catch (err: any) {
        console.error("[LOGFRAME_API_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to delete logframe.", details: String(err) }, { status: 500 });
    }
}
