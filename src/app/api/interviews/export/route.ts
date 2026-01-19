
import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

/* ------------------ Helpers ------------------ */
const toArabicDigits = (v: string | number) =>
  String(v).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

const getDbPath = () => path.join(process.cwd(), "src", "data", "educators.db");

/* RTL Info Box (label beside value) */
function drawInfoBox(doc: jsPDF, label: string, value: string, xRight: number, y: number) {
  doc.setFontSize(10);
  doc.setLineWidth(0.3);
  const padding = 2;

  const labelW = doc.getTextWidth(label) + padding * 2;
  const valueLines = doc.splitTextToSize(value || "", 55);
  const valueW = 60;
  const h = Math.max(8, valueLines.length * 5);

  doc.rect(xRight - labelW, y, labelW, h);
  doc.text(label, xRight - padding, y + 5, { align: "right" });

  doc.rect(xRight - labelW - valueW - 2, y, valueW, h);
  doc.text(valueLines, xRight - labelW - 4, y + 5, { align: "right" });
}

/* Draw header + footer + border (reusable) */
function drawPageFrame(doc: jsPDF, settings: any, project: any, hall: any, pageNumber: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  /* ================= PAGE BORDER ================= */
  doc.setLineWidth(1.5);
  doc.rect(5, 5, pageW - 10, pageH - 10);

  /* ================= TITLE ================= */
  doc.setFillColor(settings.titleBgColor);
  doc.rect(45, 10, pageW - 90, 10, "F");

  let titleFontStyle = 'normal';
  if (settings.titleBold && settings.titleItalic) titleFontStyle = 'bolditalic';
  else if (settings.titleBold) titleFontStyle = 'bold';
  else if (settings.titleItalic) titleFontStyle = 'italic';
  doc.setFont("Amiri", titleFontStyle);
  
  doc.setFontSize(settings.titleSize || 14);
  doc.setTextColor(settings.titleColor);
  doc.text(settings.title, pageW / 2, 16.5, { align: "center" });

  /* ================= LOGO (COMPACT FIX) ================= */
  const logoX = 15;
  const logoY = 8; // Moved up slightly

  doc.setFillColor(40, 60, 80);
  doc.rect(logoX, logoY, 6, 15, "F"); // Smaller rectangle

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); // Smaller font
  doc.setFont("helvetica", "bold");
  doc.text("S", logoX + 3, logoY + 4, { align: "center", baseline: "middle" });
  doc.text("F", logoX + 3, logoY + 8, { align: "center", baseline: "middle" });
  doc.text("D", logoX + 3, logoY + 12, { align: "center", baseline: "middle" });

  doc.setFont("Amiri", "normal");
  doc.setTextColor(40, 60, 80);
  doc.setFontSize(11); // Scaled down
  doc.text("الصندوق", logoX + 8, logoY + 4);
  doc.text("الاجتماعي", logoX + 8, logoY + 9);
  doc.text("للتنمية", logoX + 8, logoY + 14);

  doc.setFontSize(6);
  doc.text("Social Fund for Development", logoX, logoY + 17);

  /* ================= INFO BOXES ================= */
  drawInfoBox(doc, "رقم المشروع", toArabicDigits(project.projectId), pageW - 10, 26);
  drawInfoBox(doc, "اسم المشروع", project.projectName || "", pageW - 10, 36);
  drawInfoBox(doc, "رقم القاعة", toArabicDigits(hall.hallNo), 90, 26);
  drawInfoBox(doc, "اسم القاعة", hall.hallName || "", 90, 36);

  /* ================= FOOTER ================= */
  const y = pageH - 25;
  doc.setFontSize(10);
  doc.setTextColor("#000");

  doc.text("الاسم:", pageW - 15, y, { align: "right" });
  doc.line(pageW - 50, y + 1, pageW - 110, y + 1);

  doc.text("الصفة:", pageW - 15, y + 8, { align: "right" });
  doc.line(pageW - 50, y + 9, pageW - 110, y + 9);

  doc.rect(55, y - 5, 40, 20);
  doc.text("توقيع اللجنة", 75, y + 5, { align: "center" });

  doc.rect(10, y - 5, 40, 20);
  doc.text("ختم المديرية", 30, y + 5, { align: "center" });

  doc.text(`صفحة ${toArabicDigits(pageNumber)}`, pageW / 2, pageH - 10, { align: "center" });
}

/* ------------------ API ------------------ */
export async function POST(req: Request) {
  try {
    const { projectId, settings } = await req.json();

    const projectsRes = await fetch("http://localhost:9002/api/projects");
    const projects = await projectsRes.json();
    const project = projects.find((p: any) => p.projectId === projectId);

    const db = new Database(getDbPath(), { fileMustExist: true });
    const rows = db.prepare(
      `SELECT * FROM educators WHERE project_id = ? AND interview_hall_no IS NOT NULL ORDER BY interview_hall_no, total_score DESC`
    ).all(projectId);
    db.close();

    const doc = new jsPDF({
      orientation: settings.pageOrientation,
      unit: "mm",
      format: settings.pageSize,
    });

    const fontPath = path.join(process.cwd(), "public/fonts/Amiri-Regular.ttf");
    const fontB64 = fs.readFileSync(fontPath).toString("base64");
    doc.addFileToVFS("Amiri.ttf", fontB64);
    doc.addFont("Amiri.ttf", "Amiri", "normal");
    doc.addFont("Amiri.ttf", "Amiri", "bold");
    doc.addFont("Amiri.ttf", "Amiri", "italic");
    doc.addFont("Amiri.ttf", "Amiri", "bolditalic");
    doc.setFont("Amiri");

    const grouped = rows.reduce((acc: any, r: any) => {
      acc[r.interview_hall_no] ??= {
        hallNo: r.interview_hall_no,
        hallName: r.interview_hall_name,
        rows: [],
      };
      acc[r.interview_hall_no].rows.push(r);
      return acc;
    }, {});

    let first = true;

    for (const key in grouped) {
      if (!first) doc.addPage();
      first = false;

      const hall = grouped[key];
      const cols = [...settings.tableColumns].reverse();

      const head = [
        cols.map(c => {
            let fontStyle = 'normal';
            if (c.headerBold && c.headerItalic) fontStyle = 'bolditalic';
            else if (c.headerBold) fontStyle = 'bold';
            else if (c.headerItalic) fontStyle = 'italic';

            return {
                content: c.header,
                styles: {
                    fillColor: c.headerBgColor,
                    textColor: c.headerTextColor,
                    fontStyle: fontStyle,
                    fontSize: c.headerTextSize,
                    halign: 'right',
                },
            };
        }),
      ];

      const body = hall.rows.map((r: any, i: number) =>
        cols.map(c => {
          let fontStyle = 'normal';
          if (c.cellBold && c.cellItalic) fontStyle = 'bolditalic';
          else if (c.cellBold) fontStyle = 'bold';
          else if (c.cellItalic) fontStyle = 'italic';
          
          return {
            content: c.dataKey === "_index" ? toArabicDigits(i + 1) : toArabicDigits(r[c.dataKey] ?? ""),
            styles: {
              fillColor: c.cellBgColor,
              textColor: c.cellTextColor,
              fontStyle: fontStyle,
              fontSize: c.cellTextSize,
              halign: 'right',
            }
          };
        })
      );
      
      const columnStyles: { [key: number]: any } = {};
      cols.forEach((c, i) => {
          columnStyles[i] = { cellWidth: c.width };
      });


      (doc as any).autoTable({
        startY: 60,
        head: head,
        body: body,
        theme: "grid",
        styles: { font: "Amiri", valign: "middle", lineWidth: 0.4 },
        headStyles: { lineWidth: 0.6 },
        tableLineWidth: 1.2,
        columnStyles: columnStyles,
        didDrawPage: (data: any) => {
          drawPageFrame(doc, settings, project, hall, data.pageNumber);
        },
      });
    }

    return new Response(doc.output("arraybuffer"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${settings.templateName}.pdf`,
      },
    });
  } catch (e: any) {
    console.error("PDF ERROR:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

