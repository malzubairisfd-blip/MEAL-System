import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getEducatorsDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db.json');

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
        return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    try {
        const filePath = getEducatorsDbPath();
        const fileContent = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        const projectApplicants = data[projectId]?.accepted || [];
        
        return NextResponse.json(projectApplicants);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
             return NextResponse.json([]);
        }
        console.error("Failed to read educators DB:", error);
        return NextResponse.json({ error: "Failed to read educator data." }, { status: 500 });
    }
}
