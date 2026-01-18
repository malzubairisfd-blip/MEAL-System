// src/app/api/interviews/export/route.ts
import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import Database from 'better-sqlite3';

// Helper for Arabic Numbers
const toArabicDigits = (v: string | number) =>
    String(v).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

const getDbPath = () => path.join(process.cwd(), 'src', 'data', 'educators.db');

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { projectId, settings } = body;

        if (!projectId || !settings) {
            return NextResponse.json({ error: "projectId and settings are required" }, { status: 400 });
        }

        const dbPath = getDbPath();
        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: `Database not found at ${dbPath}. Please upload educator data first.` }, { status: 404 });
        }
        
        const db = new Database(dbPath, { fileMustExist: true });
        const stmt = db.prepare(
            'SELECT * FROM educators WHERE project_id = ? AND interview_hall_no IS NOT NULL ORDER BY interview_hall_no, total_score DESC'
        );
        const applicants = stmt.all(projectId);
        db.close();

        if (applicants.length === 0) {
            return NextResponse.json({ error: "No applicants with assigned interview halls found for this project." }, { status: 404 });
        }

        const doc = new jsPDF({ orientation: settings.pageOrientation, unit: 'mm', format: settings.pageSize });
        
        // Correct Font Embedding
        const fontPath = path.join(process.cwd(), "public/fonts/Amiri-Regular.ttf");
        if (!fs.existsSync(fontPath)) {
            throw new Error("Amiri font not found at public/fonts/Amiri-Regular.ttf");
        }
        const fontBytes = fs.readFileSync(fontPath);
        doc.addFileToVFS("Amiri-Regular.ttf", fontBytes.toString('base64'));
        doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
        doc.setFont("Amiri");

        // Fetch project details for the header
        const projectsRes = await fetch(new URL('/api/projects', req.url));
        const projects = await projectsRes.json();
        const project = projects.find((p: any) => p.projectId === projectId);


        // Dynamic & Organized Content
        const groupedByHall: Record<string, { hallName: string; hallNo: string; applicants: any[] }> = applicants.reduce((acc: any, app: any) => {
            const hallNumKey = app[settings.headerHallNoDynamic || 'interview_hall_no'] || 'unassigned';
            if (!acc[hallNumKey]) {
                acc[hallNumKey] = {
                    hallName: settings.headerHallNameType === 'manual' 
                        ? settings.headerHallNameManual 
                        : (app[settings.headerHallNameDynamic || 'interview_hall_name'] || 'N/A'),
                    hallNo: settings.headerHallNoType === 'manual' 
                        ? settings.headerHallNoManual 
                        : hallNumKey,
                    applicants: []
                };
            }
            acc[hallNumKey].applicants.push(app);
            return acc;
        }, {});
        
        let isFirstPage = true;
        for (const hallKey in groupedByHall) {
            const hallData = groupedByHall[hallKey];
            if (!isFirstPage) {
                doc.addPage();
            }
            isFirstPage = false;

            const head = [settings.tableColumns.map((c: any) => c.header)];
            const body = hallData.applicants.map((row: any, rowIndex: number) => 
                settings.tableColumns.map((col: any) => {
                    if (col.dataKey === '_index') return toArabicDigits(rowIndex + 1);
                    // Arabic Text Shaping will be handled by jsPDF with the right font
                    return toArabicDigits(row[col.dataKey] ?? '');
                })
            );
            
            autoTable(doc, {
                head, 
                body,
                startY: 55,
                theme: 'grid',
                styles: {
                    font: 'Amiri',
                    fontStyle: 'normal',
                    fontSize: 10,
                    valign: 'middle',
                    lineWidth: settings.tableInnerBorder ? settings.tableBorderThickness : 0,
                    lineColor: settings.tableBorderColor,
                },
                headStyles: {
                    fillColor: settings.tableColumns[0]?.headerBgColor || '#F2F2F2',
                    textColor: settings.tableColumns[0]?.headerColor || '#000000',
                    fontStyle: settings.tableColumns[0]?.headerBold ? 'bold' : 'normal',
                    halign: 'center'
                },
                columnStyles: Object.fromEntries(
                    settings.tableColumns.map((c: any, i: number) => [i, {
                        cellWidth: c.width,
                        fontStyle: c.textBold ? 'bold' : 'normal',
                        textColor: c.textColor || '#000000',
                        fontSize: c.textSize || 10,
                        halign: c.dataKey === '_index' ? 'center' : 'right',
                    }])
                ),
                didDrawPage: (data) => {
                    // Header
                    doc.setFont('Amiri', settings.titleBold ? 'bold' : 'normal');
                    doc.setFillColor(settings.titleBgColor);
                    doc.rect(10, 10, doc.internal.pageSize.getWidth() - 20, 15, 'F');
                    doc.setTextColor(settings.titleColor);
                    doc.setFontSize(16);
                    doc.text(settings.title, doc.internal.pageSize.getWidth() / 2, 19, { align: 'center' });

                    doc.setFont("Amiri", "normal");
                    doc.setTextColor('#000000');
                    doc.setFontSize(11);
                    const pageWidth = doc.internal.pageSize.getWidth();

                    const projectText = `${project?.projectName || ''} (Project: ${projectId})`;
                    const hallText = `${hallData.hallName} (Hall No: ${hallData.hallNo})`;
                    
                    doc.text(projectText, pageWidth - 15, 35, { align: 'right' });
                    doc.text(hallText, pageWidth - 15, 42, { align: 'right' });

                    if (settings.pageBorder) {
                        doc.setDrawColor(settings.pageBorderColor);
                        doc.setLineWidth(settings.pageBorderThickness);
                        doc.rect(5, 5, doc.internal.pageSize.getWidth() - 10, doc.internal.pageSize.getHeight() - 10);
                    }

                    // Footer
                     const finalY = doc.internal.pageSize.getHeight() - 20;
                     doc.setFontSize(10);
                     doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.getWidth() / 2, finalY, { align: 'center' });
                },
                margin: { top: 50, bottom: 30, left: 10, right: 10 },
                tableWidth: settings.fitColumns ? 'auto' : 'wrap',
            });
        }

        const pdfBytes = doc.output('arraybuffer');
        return new Response(pdfBytes, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${settings.templateName}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error("PDF Export Error:", error);
        return NextResponse.json({ error: `Failed to export PDF: ${error.message}` }, { status: 500 });
    }
}
