// src/app/api/interviews/export/route.ts
import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// Arabic digits
const toArabicDigits = (v: string | number) =>
  String(v).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

const getDbPath = () =>
  path.join(process.cwd(), "src", "data", "educators.db");

// RTL table position calculator
function calculateRTLTableLayout(
  doc: jsPDF,
  columns: any[],
  marginRight = 15,
  defaultWidth = 22
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = columns.reduce(
    (sum, c) => sum + (c.width ?? defaultWidth),
    0
  );

  const marginLeft = Math.max(
    10,
    pageWidth - tableWidth - marginRight
  );

  return { tableWidth, marginLeft };
}

export async function POST(req: Request) {
    try {
        const { projectId, settings } = await req.json();

        // Fetch project details
        const projectsRes = await fetch('http://localhost:9002/api/projects');
        if (!projectsRes.ok) throw new Error('Failed to fetch projects');
        const projects = await projectsRes.json();
        const project = projects.find((p: any) => p.projectId === projectId);


        const db = new Database(getDbPath(), { fileMustExist: true });
        const applicants = db.prepare(
            `SELECT * FROM educators
             WHERE project_id = ?
             AND interview_hall_no IS NOT NULL
             ORDER BY interview_hall_no, total_score DESC`
        ).all(projectId);
        db.close();

        const doc = new jsPDF({
            orientation: settings.pageOrientation,
            unit: "mm",
            format: settings.pageSize,
        });

        const fontPath = path.join(process.cwd(), "public/fonts/Amiri-Regular.ttf");
        const fontBytes = fs.readFileSync(fontPath);
        doc.addFileToVFS("Amiri-Regular.ttf", fontBytes.toString("base64"));
        doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
        doc.setFont("Amiri");

        const grouped = applicants.reduce((acc: any, r: any) => {
            const hallNo = r.interview_hall_no || 'unassigned';
            acc[hallNo] ??= {
                hallName: r.interview_hall_name,
                hallNo: hallNo,
                rows: [],
            };
            acc[hallNo].rows.push(r);
            return acc;
        }, {});
        
        let isFirstGroup = true;

        for (const key in grouped) {
            if (!isFirstGroup) doc.addPage();
            isFirstGroup = false;

            const hall = grouped[key];
            const cols = [...settings.tableColumns].reverse();
            const head = [cols.map((c: any) => c.header)];
            const body = hall.rows.map((r: any, i: number) =>
                cols.map((c: any) =>
                    c.dataKey === "_index"
                        ? toArabicDigits(i + 1)
                        : toArabicDigits(r[c.dataKey] ?? "")
                )
            );

            const { tableWidth, marginLeft } = calculateRTLTableLayout(doc, cols, 15, 22);

            autoTable(doc, {
                head,
                body,
                startY: 55,
                theme: "grid",
                styles: {
                    font: "Amiri",
                    fontSize: 10,
                    halign: "right",
                    valign: "middle",
                },
                headStyles: {
                    fontStyle: "bold",
                    halign: "right",
                },
                columnStyles: Object.fromEntries(
                    cols.map((c: any, i: number) => [
                        i,
                        {
                            cellWidth: c.width,
                            halign: c.dataKey === "_index" ? "center" : "right",
                        },
                    ])
                ),
                 margin: {
                    top: 50,
                    bottom: 45,
                    right: 15,
                },
                didDrawPage: (data) => {
                    const pageWidth = doc.internal.pageSize.getWidth();

                    // --- 1. HEADER ---
                    doc.setFillColor(settings.titleBgColor);
                    doc.rect(10, 10, pageWidth - 20, 15, "F");
                    doc.setFontSize(14);
                    doc.setTextColor(settings.titleColor);
                    doc.text(settings.title, pageWidth / 2, 19, { align: "center" });

                    // --- 2. DRAW SFD LOGO (Top Left) ---
                    const logoX = 15;
                    const logoY = 10;
                    
                    doc.setFillColor(40, 60, 80); // Dark Blue/Grey
                    doc.rect(logoX, logoY, 8, 24, 'F'); 
                    
                    doc.setTextColor(255, 255, 255);
                    doc.setFont("helvetica", "bold");
                    doc.text("S", logoX + 4, logoY + 6, { align: 'center', baseline: 'middle' });
                    doc.text("F", logoX + 4, logoY + 14, { align: 'center', baseline: 'middle' });
                    doc.text("D", logoX + 4, logoY + 22, { align: 'center', baseline: 'middle' });

                    doc.setFont("Amiri", "normal");
                    doc.setTextColor(40, 60, 80);
                    doc.setFontSize(14);
                    doc.text("الصندوق", logoX + 10, logoY + 6);
                    doc.text("الاجتماعي", logoX + 10, logoY + 13);
                    doc.text("للتنمية", logoX + 10, logoY + 20);

                    doc.setFontSize(7);
                    doc.text("Social Fund for Development", logoX, logoY + 28);

                    // --- PROJECT & HALL INFO ---
                    doc.setFontSize(11);
                    doc.setTextColor("#000");

                    doc.text(
                        `${project?.projectName || ""} (رقم المشروع: ${toArabicDigits(projectId)})`,
                        pageWidth - 15,
                        35,
                        { align: "right" }
                    );

                    doc.text(
                        `${hall.hallName} (رقم القاعة: ${toArabicDigits(hall.hallNo)})`,
                        pageWidth - 15,
                        42,
                        { align: "right" }
                    );

                    // --- PAGE FOOTER ---
                    const pageHeight = doc.internal.pageSize.getHeight();
                    doc.setFontSize(10);
                    doc.text(
                        `صفحة ${toArabicDigits(data.pageNumber)}`,
                        pageWidth / 2,
                        pageHeight - 15,
                        { align: "center" }
                    );

                    // --- SIGNATURE FOOTER ---
                    const finalY = pageHeight - 40;
                    doc.setFontSize(10);
                    doc.text("الاسم: ____________________________", pageWidth - 15, finalY, { align: "right" });
                    doc.text("الصفة: ___________________________", pageWidth - 15, finalY + 10, { align: "right" });
                    doc.text("التوقيع: _______________________", pageWidth / 2 + 30, finalY, { align: "right" });
                    doc.text("التاريخ: ____ / ____ / ______", pageWidth / 2 + 30, finalY + 10, { align: "right" });
                    doc.rect(15, finalY - 5, 40, 20);
                    doc.text("ختم المديرية", 35, finalY + 5, { align: 'center' });
                },
            });
        }

        return new Response(doc.output("arraybuffer"), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "attachment; filename=export.pdf",
            },
        });
    } catch (e: any) {
        console.error("PDF Export Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
