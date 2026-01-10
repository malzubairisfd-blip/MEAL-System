// src/app/api/me-plan/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getPlansFile = () => path.join(getDataPath(), 'me-plan.json');

async function getExistingPlans() {
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
    
    try {
        await ensureDataFile();
        const plans = await getExistingPlans();
        
        if (!projectId) {
            return NextResponse.json(plans);
        }

        const plan = plans.find((p: any) => p.projectId === projectId);

        if (plan) {
            return NextResponse.json(plan);
        } else {
            return NextResponse.json({ error: "M&E Plan not found" }, { status: 404 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: "Failed to read M&E plans file.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await ensureDataFile();
        const newPlan = await req.json();

        // The payload now contains projectId and a list of indicators
        if (!newPlan || !newPlan.projectId || !Array.isArray(newPlan.indicators)) {
            return NextResponse.json({ ok: false, error: "Invalid M&E plan payload. Expected projectId and indicators array." }, { status: 400 });
        }

        const existingPlans = await getExistingPlans();
        const index = existingPlans.findIndex((p: any) => p.projectId === newPlan.projectId);

        if (index !== -1) {
            // Update existing plan's indicators
            existingPlans[index].indicators = newPlan.indicators;
        } else {
            // Add new plan
            existingPlans.push({
                projectId: newPlan.projectId,
                indicators: newPlan.indicators
            });
        }
        
        await fs.writeFile(getPlansFile(), JSON.stringify(existingPlans, null, 2), "utf8");
        
        return NextResponse.json({ ok: true, message: `M&E plan for project ${newPlan.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[ME_PLAN_API_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save M&E plan.", details: String(err) }, { status: 500 });
    }
}
