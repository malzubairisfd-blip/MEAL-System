// src/app/api/interview-statements/route.ts
import { NextResponse } from "next/server";
import path from "path";
import Database from 'better-sqlite3';
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { promises as fs } from 'fs';

// Helper to load a font file
async function loadFont(fontPath: string) {
    const fontBytes = await fs.readFile(fontPath);
    return fontBytes;
}

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'educators.db');

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
        return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    try {
        const db = new Database(getDbPath());
        const stmt = db.prepare('SELECT data FROM educators');
        const rows = stmt.all();
        db.close();

        const allApplicants = rows.map((row: any) => JSON.parse(row.data));
        const assignedApplicants = allApplicants.filter(a => a['Acceptance Statement'] === 'مقبولة' && a.hallName && a.hallNumber);

        if (assignedApplicants.length === 0) {
            return NextResponse.json({ error: "No assigned applicants found for this project." }, { status: 404 });
        }
        
        // Group applicants by hall
        const halls: { [key: string]: { name: string; number: string, applicants: any[] } } = {};
        assignedApplicants.forEach(applicant => {
            const hallKey = `${applicant.hallName}-${applicant.hallNumber}`;
            if (!halls[hallKey]) {
                halls[hallKey] = {
                    name: applicant.hallName,
                    number: applicant.hallNumber,
                    applicants: []
                };
            }
            halls[hallKey].applicants.push(applicant);
        });

        // --- PDF Generation ---
        const pdfDoc = await PDFDocument.create();
        
        // Embed the Amiri font
        const amiriFontBytes = await loadFont(path.join(process.cwd(), 'public/fonts/Amiri-Regular.ttf'));
        const amiriFont = await pdfDoc.embedFont(amiriFontBytes);

        for (const hallKey in halls) {
            const hall = halls[hallKey];

            const titles = [
                "كشف درجات ممثل الصندوق", "كشف درجات ممثل الصحة", "كشف درجات ممثل المجلس المحلي",
                "كشف الحضور والغياب", "كشف التواصل", "كشف تعديلات البيانات", "كشف درجات المقابلة",
            ];

            for (const title of titles) {
                const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
                const { width, height } = page.getSize();

                const drawTextRight = (text: string, x: number, y: number, size: number) => {
                  const textWidth = amiriFont.widthOfTextAtSize(text, size);
                  page.drawText(text, {
                    x: width - x - textWidth,
                    y,
                    size,
                    font: amiriFont,
                    color: rgb(0, 0, 0),
                  });
                };
                
                // Header
                drawTextRight(`المشروع: ${projectId}`, 50, height - 50, 12);
                drawTextRight(`قاعة المقابلة: ${hall.name} (رقم ${hall.number})`, 50, height - 70, 12);
                
                const titleWidth = amiriFont.widthOfTextAtSize(title, 18);
                page.drawText(title, { x: (width - titleWidth) / 2, y: height - 100, size: 18, font: amiriFont, color: rgb(0.1, 0.1, 0.1) });

                // Table Header
                let y = height - 140;
                const headers = ["الرقم", "اسم المتقدم/ة", "رقم الهاتف", "التوقيع"];
                const colWidths = [50, 250, 100, 100];
                let x = 50;

                headers.forEach((header, i) => {
                    drawTextRight(header, x, y, 10);
                    x += colWidths[i];
                });
                y -= 5;
                page.drawLine({
                    start: { x: 50, y: y },
                    end: { x: width - 50, y: y },
                    thickness: 1,
                    color: rgb(0, 0, 0),
                });
                y -= 15;


                // Table Rows
                hall.applicants.forEach((applicant, index) => {
                    if (y < 50) { // Add new page if content overflows
                        const newPage = pdfDoc.addPage([595.28, 841.89]);
                        y = height - 50;
                        // You can re-draw headers on new page if desired
                    }

                    let col_x = 50;
                    drawTextRight(String(index + 1), col_x, y, 10);
                    col_x += colWidths[0];
                    drawTextRight(applicant["المتقدم/ة رباعيا مع اللقب"], col_x, y, 10);
                    col_x += colWidths[1];
                    drawTextRight(String(applicant["رقم تلفون المتقدم/ة"]), col_x, y, 10);
                    
                    y -= 20;
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        return new Response(pdfBytes, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="interview_statements_${projectId}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error("[PDF_GENERATION_ERROR]", error);
        return NextResponse.json({ error: "Failed to generate PDF.", details: error.message }, { status: