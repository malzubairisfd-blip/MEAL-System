
// src/app/api/interview-statements/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import QRCode from "qrcode";
import { PDFDocument, rgb, PageSizes } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { generateExcel } from "@/lib/excel-export";

/* ---------- HELPERS ---------- */

const fontPath = path.join(process.cwd(), "public/fonts/Amiri-Regular.ttf");

function drawPageNumber(page: any, font: any, pageNo: number) {
  page.drawText(`صفحة ${pageNo}`, {
    x: page.getWidth() / 2 - 30,
    y: 25,
    size: 9,
    font,
  });
}

function drawSignatures(page: any, font: any) {
  const roles = [
    "رئيس اللجنة",
    "ممثل الصندوق",
    "ممثل الصحة",
    "ممثل المجلس المحلي",
  ];

  const y = 90;
  const w = page.getWidth() / 4;

  roles.forEach((r, i) => {
    page.drawText(r, { x: i * w + 30, y: y + 30, size: 10, font });
    page.drawText("الاسم:", { x: i * w + 30, y: y + 15, size: 9, font });
    page.drawText("التوقيع:", { x: i * w + 30, y: y, size: 9, font });
  });
}

async function generateApplicantQR(applicant: any) {
  // Build SAFE string payload
  const payload = [
    `ID:${String(applicant["_id"] ?? "")}`,
    `NAME:${String(applicant["applicantName"] ?? "")}`,
    `PHONE:${String(applicant["phoneNumber"] ?? "")}`,
  ]
    .filter(Boolean)
    .join("|");

  if (!payload || payload.trim().length === 0) {
    return null; // ❗ DO NOT generate QR
  }

  return await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 120,
  });
}

const STATEMENTS_CONFIG = [
    {
      title: "كشف درجات ممثل الصندوق",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "درجة الفقر", "درجة الاستهداف", "ملاحظات", "توقيع ممثل الصندوق"],
    },
    {
      title: "كشف درجات ممثل الصحة",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "اللياقة الصحية", "القدرة على العمل", "ملاحظات صحية", "توقيع ممثل الصحة"],
    },
    {
      title: "كشف درجات ممثل المجلس المحلي",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "الإقامة الفعلية", "السمعة المجتمعية", "ملاحظات", "توقيع ممثل المجلس"],
    },
    {
      title: "كشف الحضور والغياب",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "حضرت", "غابت", "سبب الغياب", "التوقيع"],
    },
    {
      title: "كشف التواصل",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "رقم الهاتف", "تم التواصل", "لم يتم", "ملاحظات"],
    },
    {
      title: "كشف تعديلات البيانات",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "البيان قبل التعديل", "البيان بعد التعديل", "سبب التعديل", "توقيع اللجنة"],
    },
    {
      title: "كشف القرار النهائي",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "درجة المؤهل", "درجة الهوية", "درجة الخبرة", "المجموع", "القرار", "ملاحظات"],
      footer: true,
    },
];


const safeText = (v: any) => (v === null || v === undefined ? "" : String(v));


/* ---------- API ---------- */

export async function POST(req: Request) {
  try {
    const { projectId, hall } = await req.json();

    if (!projectId || !hall) {
      return NextResponse.json({ error: "Project ID and Hall information are required." }, { status: 400 });
    }

    const db = new Database(path.join(process.cwd(), "src/data/educators.db"));
    const rows = db.prepare("SELECT data FROM educators").all();
    db.close();

    const allApplicants = rows.map((r: any) => JSON.parse(r.data));
    const hallApplicants = allApplicants.filter(
      (a: any) => a['Acceptance Statement'] === 'مقبولة' && a.hallName === hall.name && String(a.hallNumber) === String(hall.number)
    );

    if (hallApplicants.length === 0) {
      return NextResponse.json({ error: `No accepted applicants found for hall "${hall.name}"` }, { status: 404 });
    }

    const projectsRes = await fetch(new URL('/api/projects', req.url));
    const projects = await projectsRes.json();
    const project = projects.find((p: any) => p.projectId === projectId);


    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fs.readFileSync(fontPath));

    for (const stmt of STATEMENTS_CONFIG) {
        const page = pdfDoc.addPage(PageSizes.A4);
        page.setRotation(degrees(90));
        const { width, height } = page.getSize();
    
        const drawRight = (text: string, x: number, y: number, size = 10) => {
            page.drawText(text, { x: width - x - font.widthOfTextAtSize(text, size), y, size, font, color: rgb(0,0,0) });
        };
    
        drawRight(`اسم المشروع: ${project?.projectName || projectId}`, 20, height - 30);
        doc.text(`اسم القاعة: ${hall.name} (رقم ${hall.number})`, 20, height - 30);

        page.drawText(stmt.title, { x: (width - font.widthOfTextAtSize(stmt.title, 16)) / 2, y: height - 60, size: 16, font });
        
        const body = hallApplicants.map((applicant, i) => {
            const baseData = [
                i + 1,
                safeText(applicant["_id"]),
                safeText(applicant["applicantName"]),
            ];
            if (stmt.title.includes("التواصل")) {
                return [...baseData.slice(0,3), safeText(applicant["phoneNumber"]), '', '', ''];
            }
            return [...baseData, ...Array(stmt.cols.length - 3).fill('')];
        });

        (pdfDoc as any).autoTable({
            head: [stmt.cols],
            body: body,
            startY: 70,
            theme: 'grid',
            styles: { font: 'Amiri', halign: 'center', cellPadding: 2, fontSize: 8 },
            headStyles: { fillColor: [40, 116, 166], font: 'Amiri', fontStyle: 'bold' },
            columnStyles: { 2: { halign: 'right' } }
        });
        
        if(stmt.footer) {
             const finalY = (pdfDoc as any).lastAutoTable.finalY + 25;
             const roles = ["رئيس اللجنة", "ممثل الصندوق", "ممثل الصحة", "ممثل المجلس المحلي"];
             const cellWidth = width / roles.length;
             roles.forEach((role, i) => {
                const x = (cellWidth * i) + (cellWidth / 2);
                page.drawText(role, { x, y: finalY, size: 10, font, align: 'center'});
                page.drawText("الاسم:", { x, y: finalY + 7, size: 9, font, align: 'center'});
                page.drawText("التوقيع:", { x, y: finalY + 14, size: 9, font, align: 'center'});
                page.drawText("التاريخ:", { x, y: finalY + 21, size: 9, font, align: 'center'});
             });
        }
    }

    const bytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=interview_statements_${hall.name}.pdf`,
      },
    });

  } catch (error: any) {
    console.error("PDF EXPORT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", message: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
