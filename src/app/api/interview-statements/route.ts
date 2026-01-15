
// src/app/api/interview-statements/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import "jspdf-autotable";
import fontkit from '@pdf-lib/fontkit';


interface Project {
  projectId: string;
  projectName: string;
  governorates: string[];
  districts: string[];
}

interface Applicant {
  _id: string;
  "المتقدم/ة رباعيا مع اللقب": string;
  hallName?: string | null;
  hallNumber?: string | null;
  phoneNumber?: string;
  [key: string]: any;
}

interface Hall {
  name: string;
  number: string;
}

const safeText = (v: any) => (v === null || v === undefined ? "" : String(v));

const statements = [
    {
      title: "كشف درجات ممثل الصندوق",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "درجة الفقر", "درجة الاستهداف", "ملاحظات", "توقيع ممثل الصندوق"],
      widths: [20, 40, 150, 50, 50, 90, 80],
    },
    {
      title: "كشف درجات ممثل الصحة",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "اللياقة الصحية", "القدرة على العمل", "ملاحظات صحية", "توقيع ممثل الصحة"],
      widths: [20, 40, 150, 50, 50, 90, 80],
    },
    {
      title: "كشف درجات ممثل المجلس المحلي",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "الإقامة الفعلية", "السمعة المجتمعية", "ملاحظات", "توقيع ممثل المجلس"],
      widths: [20, 40, 150, 50, 60, 80, 80],
    },
    {
      title: "كشف الحضور والغياب",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "حضرت", "غابت", "سبب الغياب", "التوقيع"],
      widths: [20, 40, 150, 40, 40, 110, 80],
    },
    {
      title: "كشف التواصل",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "رقم الهاتف", "تم التواصل", "لم يتم", "ملاحظات"],
      widths: [20, 40, 150, 80, 50, 50, 90],
    },
    {
      title: "كشف تعديلات البيانات",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "البيان قبل التعديل", "البيان بعد التعديل", "سبب التعديل", "توقيع اللجنة"],
      widths: [20, 40, 120, 100, 100, 80, 80],
    },
    {
      title: "كشف درجات المقابلة (FINAL DECISION)",
      cols: ["م", "رقم المتقدمة", "اسم المتقدمة", "درجة المؤهل", "درجة الهوية", "درجة الخبرة", "المجموع", "القرار", "ملاحظات"],
      widths: [20, 40, 120, 50, 50, 50, 50, 60, 90],
      footer: true,
    },
];

async function generateApplicantQR(applicant: Applicant) {
  const payload = [
    `ID:${String(applicant["_id"] ?? "")}`,
    `NAME:${String(applicant["المتقدم/ة رباعيا مع اللقب"] ?? "")}`,
    `PHONE:${String(applicant["phoneNumber"] ?? "")}`,
  ]
    .filter(Boolean)
    .join("|");

  if (!payload || payload.trim().length === 0) {
    return null;
  }

  return await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 120,
  });
}

export async function POST(req: Request) {
  try {
    const { projectId, halls } = await req.json();

    if (!projectId || !Array.isArray(halls) || halls.length === 0) {
      return NextResponse.json({ error: "Project ID and a list of halls are required." }, { status: 400 });
    }

    const db = new Database(path.join(process.cwd(), "src/data/educators.db"));
    const rows = db.prepare("SELECT data FROM educators").all();
    db.close();

    const allApplicants: Applicant[] = rows.map((r: any) => JSON.parse(r.data));
    const acceptedApplicants = allApplicants.filter(a => a['Acceptance Statement'] === 'مقبولة');

    const projectsRes = await fetch(new URL('/api/projects', req.url).toString());
    const projects: Project[] = await projectsRes.json();
    const project = projects.find((p: any) => p.projectId === projectId);
    
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    // @ts-ignore
    doc.registerFontkit(fontkit);
    doc.addFileToVFS("Amiri-Regular.ttf", fs.readFileSync(path.join(process.cwd(), "public/fonts/Amiri-Regular.ttf")).toString('base64'));
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    doc.setFont("Amiri");

    for (const hall of halls) {
        const hallApplicants = acceptedApplicants.filter(a => a.hallName === hall.name && String(a.hallNumber) === String(hall.number));
        if (hallApplicants.length === 0) continue;

        for (const stmt of statements) {
            doc.addPage();
            doc.setFont("Amiri");
            doc.setFontSize(12);

            const drawRight = (text: string, x: number, y: number) => {
                const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
                doc.text(text, doc.internal.pageSize.getWidth() - x - textWidth, y, { align: 'right' });
            };
            const drawCenter = (text: string, y: number, size = 16) => {
                doc.setFontSize(size);
                doc.text(text, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
            };

            drawRight(`اسم المشروع: ${project?.projectName || projectId}`, 15, 15);
            drawRight(`الجهة المنفذة: `, 15, 22);
            drawRight(`المحافظة / المديرية: ${project?.governorates[0] || ''} / ${project?.districts[0] || ''}`, 15, 29);
            doc.text(`اسم القاعة: ${hall.name}`, 15, 15);
            doc.text(`رقم القاعة: ${hall.number}`, 15, 22);
            doc.text(`تاريخ المقابلة: `, 15, 29);
            
            drawCenter(stmt.title, 45, 16);

            const body = hallApplicants.map((applicant, i) => {
                const baseData = [
                    i + 1,
                    safeText(applicant["_id"]),
                    safeText(applicant["المتقدم/ة رباعيا مع اللقب"]),
                ];
                if (stmt.title.includes("التواصل")) {
                    return [...baseData.slice(0,3), safeText(applicant["phoneNumber"]), '', '', ''];
                }
                return [...baseData, ...Array(stmt.cols.length - 3).fill('')];
            });

            (doc as any).autoTable({
                head: [stmt.cols],
                body: body,
                startY: 55,
                theme: 'grid',
                styles: { font: 'Amiri', halign: 'center', cellPadding: 2, fontSize: 8 },
                headStyles: { fillColor: [40, 116, 166], font: 'Amiri', fontStyle: 'bold' },
                columnStyles: { 2: { halign: 'right' } }
            });
            
            if(stmt.footer) {
                 const finalY = (doc as any).lastAutoTable.finalY + 25;
                 const roles = ["رئيس اللجنة", "ممثل الصندوق", "ممثل الصحة", "ممثل المجلس المحلي"];
                 const cellWidth = doc.internal.pageSize.getWidth() / roles.length;
                 roles.forEach((role, i) => {
                    const x = (cellWidth * i) + (cellWidth / 2);
                    doc.text(role, x, finalY, { align: 'center' });
                    doc.text("الاسم:", x, finalY + 7, { align: 'center' });
                    doc.text("التوقيع:", x, finalY + 14, { align: 'center' });
                    doc.text("التاريخ:", x, finalY + 21, { align: 'center' });
                 });
            }
        }
    }
    // Delete the initial blank page
    if (doc.internal.pages.length > 1) {
        doc.deletePage(1);
    }
    
    const pdfBytes = await doc.output('arraybuffer');

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=interview_statements_${projectId}.pdf`,
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
