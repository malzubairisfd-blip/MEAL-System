import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from '@pdf-lib/fontkit';
import Database from 'better-sqlite3';
import path from "path";

const getDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db');

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId")!;

  if (!projectId) {
      return NextResponse.json({ error: "projectId is required"}, { status: 400 });
  }

  try {
      const db = new Database(getDbPath(), { fileMustExist: true });
      const stmt = db.prepare('SELECT applicant_id, applicant_name, interview_hall_no, interview_hall_name FROM educators WHERE project_id = ? AND interview_hall_no IS NOT NULL ORDER BY interview_hall_no, applicant_id');
      const applicants = stmt.all(projectId);
      db.close();

      if (applicants.length === 0) {
          return NextResponse.json({ error: "No interview data found for this project." }, { status: 404 });
      }
      
      const halls: Record<string, { hallName: string; applicants: any[] }> = {};
      applicants.forEach((applicant: any) => {
          if (!halls[applicant.interview_hall_no]) {
              halls[applicant.interview_hall_no] = {
                  hallName: applicant.interview_hall_name,
                  applicants: []
              };
          }
          halls[applicant.interview_hall_no].applicants.push(applicant);
      });

      const pdfDoc = await PDFDocument.create();
      
      // Register fontkit
      pdfDoc.registerFontkit(fontkit);

      // Fetch a font that supports Arabic characters
      const fontUrl = 'https://fonts.gstatic.com/s/amiri/v26/J7aRnpd8CGxBHqUwcQ.ttf';
      const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
      
      // Embed the custom font with subsetting
      const arabicFont = await pdfDoc.embedFont(fontBytes, { subset: true });
      
      for (const hallNumber in halls) {
        const hall = halls[hallNumber];
        
        for (const title of [
          "كشف درجات ممثل الصندوق", "كشف درجات ممثل الصحة",
          "كشف درجات ممثل المجلس المحلي", "كشف الحضور والغياب",
          "كشف التواصل", "كشف تعديلات البيانات", "كشف درجات المقابلة",
        ]) {
          const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
          const { width, height } = page.getSize();
          
          const rtlX = width - 50;

          page.drawText(title, { x: rtlX - arabicFont.widthOfTextAtSize(title, 18), y: height - 50, size: 18, font: arabicFont, color: rgb(0, 0, 0) });
          const hallNameText = `القاعة: ${hall.hallName || `Hall ${hallNumber}`}`;
          page.drawText(hallNameText, { x: rtlX - arabicFont.widthOfTextAtSize(hallNameText, 14), y: height - 70, size: 14, font: arabicFont, color: rgb(0, 0, 0) });

          let y = height - 100;
          
          // Table Header
          page.drawText("م", { x: rtlX - 30, y: y, font: arabicFont, size: 10 });
          page.drawText("اسم المتقدم", { x: rtlX - 250, y: y, font: arabicFont, size: 10 });
          page.drawText("رقم المتقدم", { x: rtlX - 450, y: y, font: arabicFont, size: 10 });
          y -= 20;

          for (const [index, applicant] of hall.applicants.entries()) {
            if (y < 40) { // Add new page if content overflows
                const newPage = pdfDoc.addPage([595.28, 841.89]);
                newPage.drawText(title + " (تابع)", { x: rtlX - arabicFont.widthOfTextAtSize(title + " (تابع)", 18), y: height - 50, size: 18, font: arabicFont, color: rgb(0, 0, 0) });
                y = height - 100;
            }
            if(applicant) {
              const nameText = applicant.applicant_name || '';
              page.drawText(String(index + 1), { x: rtlX - 30, y, font: arabicFont, size: 10 });
              page.drawText(nameText, { x: rtlX - 250, y, font: arabicFont, size: 10 });
              page.drawText(String(applicant.applicant_id), { x: rtlX - 450, y, font: arabicFont, size: 10 });
              y -= 20;
            }
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      return new Response(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="interviews_${projectId}.pdf"`,
        },
      });

  } catch(error: any) {
      console.error("PDF Export Error:", error);
       if (error.code === 'SQLITE_CANTOPEN') {
           return NextResponse.json({ error: "Database not found. Please upload and save educator data first." }, { status: 404 });
       }
      return NextResponse.json({ error: `Failed to export PDF. ${error.message}`}, { status: 500 });
  }
}
