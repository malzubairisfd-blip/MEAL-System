// src/app/api/training/qualify/route.ts
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const getDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db');

export async function POST(request: Request) {
  const body = await request.json();
  const { applicants } = body; // Expects array of { applicant_id, contract_type }

  if (!Array.isArray(applicants) || applicants.length === 0) {
      return NextResponse.json({ error: 'Invalid payload. "applicants" array is required.' }, { status: 400 });
  }

  let db;
  try {
      db = new Database(getDbPath(), { fileMustExist: true });

      const updateStmt = db.prepare(`
        UPDATE educators 
        SET 
            training_qualification = 'مؤهلة للتدريب', 
            contract_type = ? 
        WHERE 
            applicant_id = ?
      `);

      const transaction = db.transaction((apps) => {
        let changes = 0;
        for (const app of apps) {
            if (app.applicant_id && app.contract_type) {
                const info = updateStmt.run(app.contract_type, app.applicant_id);
                changes += info.changes;
            }
        }
        return changes;
      });

      const totalChanges = transaction(applicants);

      return NextResponse.json({ success: true, message: `${totalChanges} records updated.` });

  } catch (error: any) {
      console.error('Error in /api/training/qualify:', error);
      if (error.code === 'SQLITE_CANTOPEN') {
        return NextResponse.json({ error: "Educators database not found." }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
      if (db) {
        db.close();
      }
  }
}
