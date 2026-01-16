import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import fontkit from '@pdf-lib/fontkit'
import QRCode from 'qrcode';
import Database from 'better-sqlite3';
import path from "path";
import fs from "fs";
import { fixArabicPDFText } from "@/lib/arabic-fixer";

const getDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db');

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId")!;

  if (!projectId) {
      return NextResponse.json({ error: "projectId is required"}, { status: 400 });
  }

  try {
      const db = new Database(getDbPath(), { fileMustExist: true });
      const stmt = db.prepare('SELECT applicant_id, applicant_name, interview_hall_no, interview_hall_name, total_score FROM educators WHERE project_id = ? AND interview_hall_no IS NOT NULL ORDER BY interview_hall_no, applicant_id');
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
      
      // Using jsPDF as per the user's provided examples.
      const pdf = new jsPDF();
      
      // IMPORTANT: The user's code relies on a custom font being available.
      // We assume 'public/fonts/Amiri-Regular.ttf' exists.
      const fontPath = path.join(process.cwd(), "public/fonts/Amiri-Regular.ttf");
      const fontBytes = fs.readFileSync(fontPath);
      pdf.addFileToVFS("Amiri-Regular.ttf", fontBytes.toString('base64'));
      pdf.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      pdf.setFont("Amiri");

      let isFirstPage = true;

      for (const hallNumber in halls) {
        const hall = halls[hallNumber];
        
        if (!isFirstPage) {
            pdf.addPage();
        }
        isFirstPage = false;
        
        const { width, height } = pdf.internal.pageSize;
        let y = 40;

        // Title
        pdf.setFontSize(18);
        const title = fixArabicPDFText(`كشف درجات مقابلة: ${hall.hallName || `Hall ${hallNumber}`}`);
        pdf.text(title, width - 20, y, { align: "right" });
        y += 30;

        for (const [index, applicant] of hall.applicants.entries()) {
            if (y > height - 60) {
                pdf.addPage();
                y = 40;
            }

            // QR Code
            const qrDataUrl = await QRCode.toDataURL(String(applicant.applicant_id));
            pdf.addImage(qrDataUrl, 'PNG', 20, y - 12, 25, 25);
            
            // Name
            pdf.setFontSize(12);
            const nameText = fixArabicPDFText(`${index + 1}. ${applicant.applicant_name}`);
            pdf.text(nameText, width - 20, y, { align: 'right' });
            y += 15;

            // Score
            pdf.setFontSize(11);
            const scoreText = fixArabicPDFText(`الدرجة: ${applicant.total_score || 'N/A'}`);
            pdf.text(scoreText, width - 20, y, { align: 'right' });
            y += 25; // Extra space between entries
        }
      }

      const pdfBytes = pdf.output('arraybuffer');
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
