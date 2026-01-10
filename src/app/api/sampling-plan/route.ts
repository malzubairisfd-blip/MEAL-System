// src/app/api/sampling-plan/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getPlansFile = () => path.join(getDataPath(), 'sampling-plans.json');

type SamplingPlan = {
    projectId: string;
    marginOfError: number;
    confidenceLevel: number;
    populationSize: number;
    responseDistribution: number;
    recommendedSampleSize: number;
}

async function getExistingPlans(): Promise<SamplingPlan[]> {
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
            return NextResponse.json({ error: "Sampling Plan not found" }, { status: 404 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: "Failed to read sampling plans file.", details: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await ensureDataFile();
        const newPlan = await req.json();

        if (!newPlan || !newPlan.projectId) {
            return NextResponse.json({ ok: false, error: "Invalid payload. Project ID is required." }, { status: 400 });
        }

        const existingPlans = await getExistingPlans();
        const index = existingPlans.findIndex((p: any) => p.projectId === newPlan.projectId);

        if (index !== -1) {
            existingPlans[index] = newPlan;
        } else {
            existingPlans.push(newPlan);
        }
        
        await fs.writeFile(getPlansFile(), JSON.stringify(existingPlans, null, 2), "utf8");
        
        return NextResponse.json({ ok: true, message: `Sampling plan for project ${newPlan.projectId} saved successfully.` });

    } catch (err: any) {
        console.error("[SAMPLING_PLAN_API_ERROR]", err);
        return NextResponse.json({ ok: false, error: "Failed to save sampling plan.", details: String(err) }, { status: 500 });
    }
}
