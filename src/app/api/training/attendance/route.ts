// src/app/api/training/attendance/route.ts
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const getDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db');

export async function POST(request: Request) {
  const body = await request.json();
  const { attended, absent } = body; 

  if (!Array.isArray(attended) && !Array.isArray(absent)) {
      return NextResponse.json({ error: 'Invalid payload. "attended" and/or "absent" arrays are required.' }, { status: 400 });
  }

  let db;
  try {
      db = new Database(getDbPath(), { fileMustExist: true });

      const updateStmt = db.prepare(`UPDATE educators SET training_attendance = ? WHERE applicant_id = ?`);

      const transaction = db.transaction((attendedIds, absentIds) => {
        let changes = 0;
        if (Array.isArray(attendedIds) && attendedIds.length > 0) {
            for (const id of attendedIds) {
                const info = updateStmt.run('حضرت التدريب', id);
                changes += info.changes;
            }
        }
        if (Array.isArray(absentIds) && absentIds.length > 0) {
            for (const id of absentIds) {
                const info = updateStmt.run('غائبة من التدريب', id);
                changes += info.changes;
            }
        }
        return changes;
      });

      const totalChanges = transaction(attended, absent);

      return NextResponse.json({ success: true, message: `${totalChanges} attendance records updated.` });

  } catch (error: any) {
      console.error('Error in /api/training/attendance:', error);
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
