import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// --- HELPERS ---

// Convert English digits to Arabic (Eastern) digits
const toArabicDigits = (v: string | number) => {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
};

const getDbPath = () => path.join(process.cwd(), "src", "data", "educators.db");

/**
 * Applies font styling (size, color, weight) to the jsPDF instance
 */
function applyTextStyle(doc: jsPDF, styleObj: any) {
  const fontName = "Amiri";
  
  // Map boolean bold/italic to jsPDF font styles
  let style = "normal";
  if (styleObj?.bold && styleObj?.italic) style = "bolditalic";
  else if (styleObj?.bold) style = "bold";
  else if (styleObj?.italic) style = "italic";

  doc.setFont(fontName, style);
  doc.setFontSize(styleObj?.fontSize || 10);
  doc.setTextColor(styleObj?.textColor || "#000000");
}

/**
 * Draws a labelled box (e.g., "Project Name: X") used in the header
 */
function drawInfoBox(
  doc: jsPDF,
  label: string,
  value: string,
  xRight: number,
  y: number,
  style: any 
) {
  const padding = 2;
  const labelW = doc.getTextWidth(label) + padding * 2;
  const valueW = style.width || 60;
  
  // Calculate wrap for value text
  const valueLines = doc.splitTextToSize(value || "", valueW - 4);
  
  // Dynamic height based on content or setting
  const h = Math.max(style.height || 8, valueLines.length * 6);

  // 1. Label Background
  if (style.labelBgColor) {
    doc.setFillColor(style.labelBgColor);
    doc.rect(xRight - labelW, y, labelW, h, "F");
  }
  
  // 2. Value Background
  if (style.valueBgColor) {
    doc.setFillColor(style.valueBgColor);
    doc.rect(xRight - labelW - valueW, y, valueW, h, "F");
  }

  // 3. Borders
  doc.setLineWidth(0.1);
  doc.setDrawColor(0);
  doc.rect(xRight - labelW, y, labelW, h); // Label Border
  doc.rect(xRight - labelW - valueW, y, valueW, h); // Value Border

  // 4. Text
  applyTextStyle(doc, style);
  
  // Draw Label (Right aligned inside its box)
  doc.text(label, xRight - padding, y + (h/2) + 1, { align: "right", baseline: "middle" });
  
  // Draw Value (Right aligned inside its box, handling multiline)
  // Adjust Y for multiline text to look centered vertically if possible, or top aligned
  const textY = valueLines.length > 1 ? y + 4 : y + (h/2) + 1;
  doc.text(valueLines, xRight - labelW - 2, textY, { align: "right", baseline: valueLines.length > 1 ? "top" : "middle" });
}

/**
 * Draws the surrounding frame, title, page numbers, and footer signatures
 */
function drawPageFrame(
  doc: jsPDF,
  settings: any,
  project: any,
  hall: any,
  pageNumber: number
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // --- PAGE BORDER ---
  if (settings.borderColor) {
      doc.setLineWidth(0.5);
      doc.setDrawColor(settings.borderColor);
      doc.rect(5, 5, pageW - 10, pageH - 10);
  }

  // --- TITLE SECTION ---
  const tts = settings.titleStyle || {};
  const titleH = Number(tts.height) || 10;
  
  // Title Background
  if (tts.bgColor) {
      doc.setFillColor(tts.bgColor);
      doc.rect(45, 10, pageW - 90, titleH, "F");
  }
  
  // Title Text
  applyTextStyle(doc, tts);
  doc.text(settings.title, pageW / 2, 10 + (titleH / 2) + 1.5, { 
      align: "center", 
      baseline: "middle" 
  });

  // --- SFD LOGO (Manual Vector Drawing) ---
  const logoX = 15;
  const logoY = 8;
  doc.setFillColor(40, 60, 80); // SFD Blue
  doc.rect(logoX, logoY, 6, 15, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("S", logoX + 3, logoY + 4, { align: "center", baseline: "middle" });
  doc.text("F", logoX + 3, logoY + 8, { align: "center", baseline: "middle" });
  doc.text("D", logoX + 3, logoY + 12, { align: "center", baseline: "middle" });
  
  doc.setFont("Amiri", "normal");
  doc.setTextColor(40, 60, 80);
  doc.setFontSize(10);
  doc.text("الصندوق", logoX + 8, logoY + 4);
  doc.text("الاجتماعي", logoX + 8, logoY + 9);
  doc.text("للتنمية", logoX + 8, logoY + 14);
  doc.setFontSize(6);
    doc.text("Social Fund for Development", logoX, logoY + 17);

  // --- HEADER INFO BOXES ---
  const ibs = settings.infoBoxStyle || {};
  // Row 1
  drawInfoBox(doc, "رقم المشروع", toArabicDigits(project.projectId), pageW - 10, 36, ibs);
  drawInfoBox(doc, "رقم القاعة", toArabicDigits(hall.hallNo), 90, 26, ibs);
  // Row 2
  drawInfoBox(doc, "اسم المشروع", project.projectName || "غير محدد", pageW - 10, 36, ibs);
  drawInfoBox(doc, "اسم القاعة", hall.hallName || "غير محدد", 90, 36, ibs);

  // --- FOOTER SECTION ---
  const fts = settings.footerStyle || {};
  const footerY = pageH - 30;
  
  applyTextStyle(doc, fts);

  // Signature Lines
  doc.text("الاسم:", pageW - 15, footerY, { align: "right" });
  doc.line(pageW - 45, footerY + 1, pageW - 100, footerY + 1);
  
  doc.text("الصفة:", pageW - 15, footerY + 8, { align: "right" });
  doc.line(pageW - 45, footerY + 9, pageW - 100, footerY + 9);

  // Signature Boxes
  doc.setDrawColor(0);
  doc.setLineWidth(0.1);
  
  // Committee Signature Box
  doc.rect(60, footerY - 5, 35, 20);
  doc.setFontSize(9);
  doc.text("توقيع اللجنة", 77.5, footerY + 12, { align: "center" });

  // Directorate Stamp Box
  doc.rect(15, footerY - 5, 35, 20);
  doc.text("ختم المديرية", 32.5, footerY + 12, { align: "center" });

  // Page Number
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`صفحة ${toArabicDigits(pageNumber)}`, pageW / 2, pageH - 7, { align: "center" });
}

// --- API HANDLER ---

export async function POST(req: Request) {
  try {
    const { projectId, settings } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing Project ID" }, { status: 400 });
    }

    // 1. DATA FETCHING
    const dbPath = getDbPath();
    const db = new Database(dbPath, { fileMustExist: true });

    // Fetch Project Info
    const projectRow = db.prepare('SELECT project_name FROM educators WHERE project_id = ? LIMIT 1').get(projectId) as any;
    const project = {
        projectId,
        projectName: projectRow?.project_name || "Unknown Project"
    };

    // Fetch Applicants (Grouped later)
    // We select * to allow dynamic column mapping based on settings
    const applicants = db.prepare(
        'SELECT * FROM educators WHERE project_id = ? AND interview_hall_no IS NOT NULL ORDER BY interview_hall_no, total_score DESC'
    ).all(projectId) as any[];

    db.close();

    if (applicants.length === 0) {
        return NextResponse.json({ error: "No applicants found for this project." }, { status: 404 });
    }

    // 2. PDF INITIALIZATION
    const doc = new jsPDF({ 
      orientation: settings.pageOrientation, 
      unit: "mm", 
      format: settings.pageSize 
    });

    // 3. FONT LOADING (Robust Path Handling)
    const fontNames = [
        { name: "Regular", style: "normal" },
        { name: "Bold", style: "bold" },
        { name: "Italic", style: "italic" },
        { name: "BoldItalic", style: "bolditalic" }
    ];

    fontNames.forEach(f => {
        const fontPath = path.join(process.cwd(), `public/fonts/Amiri-${f.name}.ttf`);
        if (fs.existsSync(fontPath)) {
            const fontBytes = fs.readFileSync(fontPath);
            doc.addFileToVFS(`Amiri-${f.name}.ttf`, fontBytes.toString('base64'));
            doc.addFont(`Amiri-${f.name}.ttf`, "Amiri", f.style);
        }
    });
    doc.setFont("Amiri", "normal"); // Default

    // 4. GROUPING DATA (By Hall)
    const groups: Record<string, any> = {};
    applicants.forEach(app => {
        const id = app.interview_hall_no || "Unassigned";
        if (!groups[id]) {
            groups[id] = { 
                hallNo: id, 
                hallName: app.interview_hall_name, 
                items: [] 
            };
        }
        groups[id].items.push(app);
    });

    // 5. GENERATE PAGES
    let isFirstGroup = true;

    for (const groupID in groups) {
        if (!isFirstGroup) doc.addPage();
        isFirstGroup = false;

        const group = groups[groupID];
        
        // --- RTL COLUMN MAPPING ---
        // Reverse columns so first UI column appears on the RIGHT
        const rtlColumns = [...settings.tableColumns].reverse();

        // 1. Prepare Header Row with Specific Styles
        const headRow = rtlColumns.map((col: any) => ({
            content: col.header,
            styles: {
                fillColor: col.headerStyle?.bgColor || "#2F80B5",
                textColor: col.headerStyle?.textColor || "#FFFFFF",
                fontSize: col.headerStyle?.fontSize || 10,
                fontStyle: col.headerStyle?.bold ? "bold" : "normal",
                halign: col.headerStyle?.halign || "center",
                valign: col.headerStyle?.valign || "middle"
            }
        }));

        // 2. Prepare Body Rows
        const bodyRows = group.items.map((row: any, index: number) => 
            rtlColumns.map((col: any) => {
                let value = row[col.dataKey];
                
                // Special handling for index
                if (col.dataKey === '_index') value = index + 1;
                
                // Null safety
                if (value === null || value === undefined) value = "";

                // Convert numbers to Arabic digits
                return toArabicDigits(value);
            })
        );

        // 3. Prepare Column Specific Styles (Width + Body Style)
        // autoTable uses column index (0, 1, 2) as keys
        const columnStylesMap: any = {};
        rtlColumns.forEach((col: any, idx: number) => {
            columnStylesMap[idx] = {
                cellWidth: Number(col.width), // Important: pass number
                // Body styles applied per column
                fillColor: col.bodyStyle?.bgColor || false, // 'false' implies transparent/default
                textColor: col.bodyStyle?.textColor || "#000000",
                fontSize: col.bodyStyle?.fontSize || 10,
                fontStyle: col.bodyStyle?.bold ? "bold" : "normal",
                halign: col.bodyStyle?.halign || "right", // Default right for Arabic
                valign: col.bodyStyle?.valign || "middle"
            };
        });

        // Calculate Table Placement
        const pageW = doc.internal.pageSize.getWidth();
        const tableWidth = rtlColumns.reduce((sum: number, col: any) => sum + Number(col.width), 0);
        // Anchor table to the right side
        const startX = pageW - tableWidth - 10; 

        autoTable(doc, {
            // Header configuration
            head: [headRow],
            
            // Body Data
            body: bodyRows,
            
            // Positioning
            startY: Number(settings.headerHeight) || 60,
            tableWidth: tableWidth,
            margin: { left: startX, right: 10 },
            
            // Global Styles (Fallbacks)
            theme: 'grid',
            styles: {
                font: 'Amiri',
                lineColor: "#444444",
                lineWidth: 0.1,
                minCellHeight: Number(settings.rowHeight) || 8,
                overflow: 'linebreak'
            },
            
            // FIX: Added top: 60 to margin so table doesn't overlap header on new pages
            margin: { top: 60, left: startX, bottom: 45 },

            // Column Specifics
            columnStyles: columnStylesMap,

            // Frame & Decoration
            didDrawPage: (data) => {
                drawPageFrame(doc, settings, project, group, data.pageNumber);
            }
        });
    }

    // 6. RETURN PDF
    const buffer = doc.output('arraybuffer');
    return new Response(buffer, {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${settings.templateName}.pdf"`
        }
    });

  } catch (error: any) {
    console.error("PDF Export Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
