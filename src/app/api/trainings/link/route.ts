import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from 'better-sqlite3';

const getDataPath = () => path.join(process.cwd(), 'src', 'data');
const getDbPath = () => path.join(getDataPath(), 'educators.db');

async function ensureDb() {
    await fs.mkdir(getDataPath(), { recursive: true });
}

export async function POST(req: Request) {
  try {
      await ensureDb();
      const db = new Database(getDbPath());

      const body = await req.json();
      const { projectId, hallNumber, hallName, applicantIds } = body;

      if (!projectId || !hallNumber || !hallName || !Array.isArray(applicantIds) || applicantIds.length === 0) {
          return NextResponse.json({ error: "Invalid request body. projectId, hallNumber, hallName, and a non-empty array of applicantIds are required." }, { status: 400 });
      }

      const updateStmt = db.prepare(
        'UPDATE educators SET training_hall_no = ?, training_hall_name = ? WHERE applicant_id = ? AND project_id = ?'
      );

      const updateMany = db.transaction((applicants) => {
        for (const applicantId of applicants) {
          updateStmt.run(hallNumber, hallName, applicantId, projectId);
        }
      });

      updateMany(applicantIds);
      
      db.close();
      return NextResponse.json({ ok: true, message: `${applicantIds.length} applicants assigned to training hall ${hallName}.` });
  } catch (error: any) {
      console.error("Training Link API Error:", error);
      return NextResponse.json({ error: "Failed to link applicants to training hall.", details: error.message }, { status: 500 });
  }
}
