// src/app/api/projects/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getProjectsFile = () => path.join(getDataPath(), 'projects.json');

async function getExistingProjects() {
    const PROJECTS_FILE = getProjectsFile();
    try {
        await fs.access(PROJECTS_FILE);
        const raw = await fs.readFile(PROJECTS_FILE, 'utf-8');
        const projects = JSON.parse(raw);
        return Array.isArray(projects) ? projects : [];
    } catch (e) {
        // If file doesn't exist or is invalid, return empty array
        return [];
    }
}

export async function GET() {
    try {
        const projects = await getExistingProjects();
        return NextResponse.json(projects);
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: "Failed to read projects file.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const PROJECTS_FILE = getProjectsFile();
    try {
        const newProject = await req.json();

        if (!newProject || typeof newProject !== "object") {
            return NextResponse.json({ ok: false, error: "Invalid project payload" }, { status: 400 });
        }
        
        const existingProjects = await getExistingProjects();
        
        // Basic validation: Check if a project with the same ID already exists
        if (existingProjects.some(p => p.projectId === newProject.projectId)) {
            return NextResponse.json({ ok: false, error: `Project with ID ${newProject.projectId} already exists.` }, { status: 409 });
        }

        existingProjects.push(newProject);
        
        await fs.mkdir(getDataPath(), { recursive: true });
        await fs.writeFile(PROJECTS_FILE, JSON.stringify(existingProjects, null, 2), "utf8");
        
        return NextResponse.json({ ok: true, message: `Project ${newProject.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[PROJECTS_API_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save project.", details: String(err) }, { status: 500 });
    }
}
