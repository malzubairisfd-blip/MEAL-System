// src/app/api/project-plan/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { GanttTask } from "@/types/gantt";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getPlansFile = () => path.join(getDataPath(), 'project-plans.json');

type ProjectPlan = {
    projectId: string;
    tasks: GanttTask[];
}

async function getExistingPlans(): Promise<ProjectPlan[]> {
    const PLANS_FILE = getPlansFile();
    try {
        await fs.access(PLANS_FILE);
        const raw = await fs.readFile(PLANS_FILE, 'utf-8');
        const plans = JSON.parse(raw);
        return Array.isArray(plans) ? plans : [];
    } catch (e) {
        return [];
    }
}

async function ensureDataFile() {
    await fs.mkdir(getDataPath(), { recursive: true });
    try {
        await fs.access(getPlansFile());
    } catch {
        await fs.writeFile(getPlansFile(), "[]", "utf-8");
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    try {
        await ensureDataFile();
        const plans = await getExistingPlans();
        const plan = plans.find(p => p.projectId === projectId);

        if (plan) {
            return NextResponse.json(plan);
        } else {
            return NextResponse.json({ error: "Plan not found" }, { status: 404 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: "Failed to read plans file.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await ensureDataFile();
        const newPlan: ProjectPlan = await req.json();

        if (!newPlan || !newPlan.projectId || !Array.isArray(newPlan.tasks)) {
            return NextResponse.json({ ok: false, error: "Invalid plan payload" }, { status: 400 });
        }

        const existingPlans = await getExistingPlans();
        const index = existingPlans.findIndex(p => p.projectId === newPlan.projectId);

        if (index !== -1) {
            // Update existing plan
            existingPlans[index] = newPlan;
        } else {
            // Add new plan
            existingPlans.push(newPlan);
        }
        
        await fs.writeFile(getPlansFile(), JSON.stringify(existingPlans, null, 2), "utf8");
        
        return NextResponse.json({ ok: true, message: `Plan for project ${newPlan.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[PROJECT_PLAN_API_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save project plan.", details: String(err) }, { status: 500 });
    }
}
