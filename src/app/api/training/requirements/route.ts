// src/app/api/training/requirements/route.ts
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';

const getBnfDbPath = () => path.join(process.cwd(), 'src', 'data', 'bnf-assessed.db');
const getEdDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db');
const getProjectsPath = () => path.join(process.cwd(), 'src', 'data', 'projects.json');


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    try {
        // Find project name from projects.json
        const projectsFile = await fs.readFile(getProjectsPath(), 'utf-8');
        const projects = JSON.parse(projectsFile);
        const project = projects.find((p: any) => p.projectId === projectId);
        
        // If project isn't in projects.json, we can't filter by name. Return empty.
        if (!project) {
            console.warn(`Project with ID ${projectId} not found in projects.json`);
            return NextResponse.json([]);
        }
        const projectName = project.projectName;

        // 1. Get BNF counts from bnf-assessed.db
        const bnfDb = new Database(getBnfDbPath(), { fileMustExist: true });
        const bnfStmt = bnfDb.prepare(`
            SELECT 
                hh_vill_name as villageName,
                COUNT(DISTINCT l_id) as bnfCount
            FROM assessed_data
            WHERE project_name = ? AND hh_vill_name IS NOT NULL
            GROUP BY hh_vill_name
        `);
        const bnfCounts: { villageName: string, bnfCount: number }[] = bnfStmt.all(projectName);
        bnfDb.close();

        // 2. Get ED counts from educators.db
        const edDb = new Database(getEdDbPath(), { fileMustExist: true });
        const edStmt = edDb.prepare(`
            SELECT 
                loc_name as villageName,
                COUNT(applicant_id) as edCount
            FROM educators
            WHERE project_id = ? 
              AND (training_qualification IS NULL OR training_attendance = 'حضرت التدريب')
              AND interview_attendance = 'حضرت المقابلة'
            GROUP BY loc_name
        `);
        const edCounts: { villageName: string, edCount: number }[] = edStmt.all(projectId);
        edDb.close();
        
        const edMap = new Map(edCounts.map(item => [item.villageName, item.edCount]));

        // 3. Combine and calculate
        const data = bnfCounts.map(bnfRow => {
            const villageName = bnfRow.villageName;
            const bnfCount = bnfRow.bnfCount;
            const edCount = edMap.get(villageName) || 0;
            const edReq = Math.round(bnfCount / 22);

            return {
                villageName,
                bnfCount,
                edCount,
                edReq
            };
        });

        return NextResponse.json(data);

    } catch (error: any) {
        // If a DB file doesn't exist, better-sqlite3 throws an error.
        // We can return an empty array to prevent a crash on the frontend.
        if (error.code === 'SQLITE_CANTOPEN' || error.code === 'ENOENT') {
            console.warn(`A database file was not found. Returning empty array for requirements.`);
            return NextResponse.json([]);
        }
        console.error("Database Error in /api/training/requirements:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
