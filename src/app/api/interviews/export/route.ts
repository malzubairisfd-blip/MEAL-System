import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const getInterviewsDbPath = () => path.join(process.cwd(), 'src', 'data', 'interviews.json');
const getEducatorsDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db.json');


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId")!;

  if (!projectId) {
      return NextResponse.json({ error: "projectId is required"}, { status: 400 });
  }

  try {
      const [interviewsContent, educatorsContent] = await Promise.all([
          fs.readFile(getInterviewsDbPath(), "utf8").catch(() => '{}'),
          fs.readFile(getEducatorsDbPath(), "utf8").catch(() => '{}')
      ]);

      const interviews = JSON.parse(interviewsContent);
      const educators = JSON.parse(educatorsContent);
      
      const projectInterviews = interviews[projectId];
      const projectEducators = educators[projectId]?.accepted || [];

      if (!projectInterviews || !projectInterviews.halls || projectInterviews.halls.length === 0) {
          return NextResponse.json({ error: "No interview data found for this project." }, { status: 404 });
      }
      
      const pdfDoc = await PDFDocument.create();
      
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const hall of projectInterviews.halls) {
        const hallApplicants = hall.applicants.map((id: number) => 
            projectEducators.find((a: any) => a.applicantId === id)
        ).filter(Boolean);

        for (const title of [
          "كشف درجات ممثل الصندوق",
          "كشف درجات ممثل الصحة",
          "كشف درجات ممثل المجلس المحلي",
          "كشف الحضور والغياب",
          "كشف التواصل",
          "كشف تعديلات البيانات",
          "كشف درجات المقابلة",
        ]) {
          const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
          const { width, height } = page.getSize();
          
          page.drawText(title, { x: 50, y: height - 50, size: 18, font, color: rgb(0, 0, 0) });
          page.drawText(`القاعة: ${hall.hallName || hall.hallNumber}`, { x: 50, y: height - 70, size: 14, font, color: rgb(0, 0, 0) });

          let y = height - 100;
          
          // Table Header
          page.drawText("م", { x: 50, y: y, font, size: 10 });
          page.drawText("اسم المتقدم", { x: 80, y: y, font, size: 10 });
          page.drawText("رقم المتقدم", { x: 250, y: y, font, size: 10 });
          y -= 20;

          for (const [index, applicant] of hallApplicants.entries()) {
            if (y < 40) { // Add new page if content overflows
                const newPage = pdfDoc.addPage([595.28, 841.89]);
                newPage.drawText(title + " (تابع)", { x: 50, y: height - 50, size: 18, font, color: rgb(0, 0, 0) });
                y = height - 100;
            }
            if(applicant) {
              page.drawText(String(index + 1), { x: 50, y, font, size: 10 });
              page.drawText(applicant.name, { x: 80, y, font, size: 10 });
              page.drawText(String(applicant.applicantId), { x: 250, y, font, size: 10 });
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
      return NextResponse.json({ error: `Failed to export PDF. ${error.message}`}, { status: 500 });
  }
}
