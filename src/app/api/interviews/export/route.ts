// src/app/api/interviews/export/route.ts
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import QRCode from 'qrcode';
import Database from 'better-sqlite3';
import { fixArabic, arabicNumber } from "@/lib/arabic-fixer";

const getDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db');

// Main function to generate the final PDF
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId")!;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
        return NextResponse.json({ error: `Database not found at ${dbPath}. Please upload educator data first.` }, { status: 404 });
    }
    
    const db = new Database(dbPath, { fileMustExist: true });
    const stmt = db.prepare(
        'SELECT applicant_id, applicant_name, interview_hall_no, interview_hall_name, total_score FROM educators WHERE project_id = ? AND interview_hall_no IS NOT NULL ORDER BY interview_hall_no, total_score DESC'
    );
    const applicants = stmt.all(projectId);
    db.close();

    if (applicants.length === 0) {
      return NextResponse.json({ error: "No applicants with assigned interview halls found for this project." }, { status: 404 });
    }

    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    
    const fontPath = path.join(process.cwd(), "public/fonts/Amiri-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    doc.addFileToVFS("Amiri-Regular.ttf", fontBytes.toString('base64'));
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    doc.setFont("Amiri");

    const halls: Record<string, { hallName: string; applicants: any[] }> = {};
    applicants.forEach((applicant: any) => {
        const hallNumber = applicant.interview_hall_no;
        if (!halls[hallNumber]) {
            halls[hallNumber] = { hallName: applicant.interview_hall_name, applicants: [] };
        }
        halls[hallNumber].applicants.push(applicant);
    });

    let isFirstPageOfDoc = true;
    for (const hallNumber in halls) {
        if (!isFirstPageOfDoc) {
            doc.addPage();
        }
        isFirstPageOfDoc = false;

        const hallData = halls[hallNumber];
        await generateHallPages(doc, hallData.applicants, { school: hallData.hallName, room: hallNumber });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="interview_statements_${projectId}.pdf"`,
        },
    });

  } catch (error: any) {
    console.error("PDF Export Error:", error);
    return NextResponse.json({ error: `Failed to export PDF: ${error.message}` }, { status: 500 });
  }
}

async function generateHallPages(doc: jsPDF, data: any[], meta: { school: string, room: string }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const ROW_HEIGHT = 10;
  let pageNo = 1;
  let y = 0;

  const drawHeaderFooter = (pageNumber: number) => {
    // Signature Headers
    const sigHeaders = ["رئيس المجموعة", "ممثل الصحة", "ممثل الصندوق", "ممثل المجلس المحلي"];
    const sigColWidth = (pageWidth - 30) / 4;
    doc.setFontSize(9);
    sigHeaders.forEach((header, i) => {
        const x = pageWidth - margin - (i * sigColWidth);
        doc.text(fixArabic(header), x, 15, { align: "right" });
        doc.text(fixArabic("الاسم:"), x, 22, { align: "right" });
        doc.text(fixArabic("التوقيع:"), x, 29, { align: "right" });
    });

    // Page Number
    doc.text(fixArabic(`صفحة ${arabicNumber(pageNumber)}`), pageWidth / 2, 40, { align: "center" });

    // Sub-headers
    doc.setFontSize(11);
    doc.text(fixArabic("برنامج التحويلات النقدية"), pageWidth - margin, 55, { align: "right" });
    doc.text(fixArabic(meta.school), pageWidth - margin, 62, { align: "right" });
    doc.text(fixArabic(`رقم القاعة: ${meta.room}`), pageWidth - margin, 69, { align: "right" });

    // Main Title
    doc.setFontSize(14);
    doc.text(fixArabic("كشف درجات ممثلي المجلس المحلي"), pageWidth / 2, 85, { align: "center" });

    // Table Header
    doc.setFontSize(10);
    doc.text(fixArabic("م"), pageWidth - 20, 100, { align: "right" });
    doc.text(fixArabic("اسم المتقدمة"), pageWidth - 40, 100, { align: "right" });
    doc.text(fixArabic("التوقيع"), 50, 100, { align: "left" });
    
    y = 110;
  };

  drawHeaderFooter(pageNo);

  for (let i = 0; i < data.length; i++) {
    if (y > pageHeight - 30) {
        doc.addPage();
        pageNo++;
        drawHeaderFooter(pageNo);
    }
    
    const row = data[i];

    // QR Code
    const qrDataUrl = await QRCode.toDataURL(String(row.applicant_id));
    doc.addImage(qrDataUrl, 'PNG', 10, y - 8, 10, 10);
    
    // Number
    doc.text(String(i + 1), pageWidth - 20, y, { align: "right" });

    // Name
    doc.text(fixArabic(row.applicant_name), pageWidth - 40, y, { align: "right" });

    // Signature line placeholder
    doc.line(50, y, 100, y);

    y += ROW_HEIGHT;
  }
}