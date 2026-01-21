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
): number {
  const padding = 2;
  const trimmedValue = (value || "").trim();

  // Apply general style first (bold, italic, font size)
  applyTextStyle(doc, { ...style, textColor: style.textColor || '#000000' });
  
  const labelW = doc.getTextWidth(label) + padding * 2;
  const valueW = style.width || 60;
  
  const valueLines = doc.splitTextToSize(trimmedValue, valueW - (padding * 2));
  const textDimensions = doc.getTextDimensions(valueLines);
  const h = Math.max(style.height || 8, textDimensions.h + padding * 2.5);

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
  const labelY = y + h / 2;
  
  // Set label text color before drawing
  doc.setTextColor(style.labelTextColor || style.textColor || '#000000');
  doc.text(label, xRight - padding, labelY, { align: "right", baseline: "middle" });
  
  // Set value text color before drawing
  doc.setTextColor(style.textColor || '#000000');
  
  // Draw value text line by line for vertical centering
  const valueYStart = y + (h - textDimensions.h) / 2;
  doc.text(valueLines, xRight - labelW - padding, valueYStart, { align: "right", baseline: "top" });

  return labelW + valueW;
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
      doc.setLineWidth(settings.borderWidth || 0.5);
      doc.setDrawColor(settings.borderColor);
      doc.rect(5, 5, pageW - 10, pageH - 10);
  }

  // --- CUSTOM HEADER TEXT (TOP RIGHT) ---
  applyTextStyle(doc, { textColor: '#000000', fontSize: 7, bold: true });
  const textLines = [
      "رئاسة الوزراء",
      "الصندوق الاجتماعي للتنممية فرع",
      "(صنعاء، الامانة، المحويت، الجوف، مارب)"
  ];
  const padding = 2;
  const headerY = 8;
  doc.text(textLines, pageW - 10, headerY + padding, {
      align: "right",
      baseline: "top"
  });


  // --- TITLE SECTION ---
  const tts = settings.titleStyle || {};
  const titleY = 10;
  const titleH = Number(tts.height) || 10;
  
  if (tts.bgColor) {
      doc.setFillColor(tts.bgColor);
      doc.rect(45, titleY, pageW - 90, titleH, "F");
  }
  
  applyTextStyle(doc, tts);
  doc.text(settings.title, pageW / 2, titleY + (titleH / 2) + 1.5, { 
      align: "center", 
      baseline: "middle" 
  });

  // --- SFD LOGO (Manual Vector Drawing) ---
  const logoX = 15;
  const logoY = 8;
  doc.setFillColor(40, 60, 80); 
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
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Social Fund for Development", logoX, logoY + 17);

  // --- HEADER INFO BOXES ---
  const ibs = settings.infoBoxStyle || {};
  drawInfoBox(doc, "رقم المشروع", toArabicDigits(project.projectId), pageW - 10, 28, ibs);
  drawInfoBox(doc, "رقم القاعة", toArabicDigits(hall.hallNo), 90, 28, ibs);
  drawInfoBox(doc, "اسم المشروع", project.projectName || "غير محدد", pageW - 10, 38, ibs);
  drawInfoBox(doc, "اسم القاعة", hall.hallName || "غير محدد", 90, 38, ibs);


  // --- FOOTER SECTION ---
  const fts = settings.footerStyle || {};
  const footerY = pageH - (Number(settings.footerMargin) || 40);
  
  applyTextStyle(doc, fts);

  // Signature Lines
  if (fts.showNameLine !== false) {
    doc.text("الاسم:", pageW - 15, footerY, { align: "right" });
    doc.line(pageW - 45, footerY + 1, pageW - 100, footerY + 1);
  }
  
  if (fts.showPositionLine !== false) {
    doc.text("الصفة:", pageW - 15, footerY + 8, { align: "right" });
    doc.line(pageW - 45, footerY + 9, pageW - 100, footerY + 9);
  }

  // Conditional Signature Boxes
  doc.setDrawColor(0);
  doc.setLineWidth(0.1);
  doc.setFontSize(9);
      
  if (fts.showSignatureBox !== false) {
      doc.rect(60, footerY - 5, 35, 20);
      doc.text("توقيع اللجنة", 77.5, footerY + 12, { align: "center" });
  }

  if (fts.showDirectorateStampBox !== false) {
      doc.rect(15, footerY - 5, 35, 20);
      doc.text("ختم المديرية", 32.5, footerY + 12, { align: "center" });
  }


  // Page Number
  if (fts.showPageNumber !== false) {
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`صفحة ${toArabicDigits(pageNumber)}`, pageW / 2, pageH - 7, { align: "center" });
  }
}

// --- API HANDLER ---

export async function POST(req: Request) {
  try {
    const { projectId, settings, type } = await req.json();

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

    let applicants;
    let hallNoKey: string, hallNameKey: string;

    if (type === 'training') {
        applicants = db.prepare(
            'SELECT * FROM educators WHERE project_id = ? AND training_qualification = ? AND training_hall_no IS NOT NULL ORDER BY training_hall_no, grand_total_score DESC'
        ).all(projectId, 'مؤهلة للتدريب') as any[];
        hallNoKey = 'training_hall_no';
        hallNameKey = 'training_hall_name';
    } else { // Default to interview
        applicants = db.prepare(
            'SELECT * FROM educators WHERE project_id = ? AND interview_hall_no IS NOT NULL ORDER BY interview_hall_no, total_score DESC'
        ).all(projectId) as any[];
        hallNoKey = 'interview_hall_no';
        hallNameKey = 'interview_hall_name';
    }

    db.close();

    if (applicants.length === 0) {
        return NextResponse.json({ error: "No applicants found for this project and statement type." }, { status: 404 });
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
        const id = app[hallNoKey] || "Unassigned";
        if (!groups[id]) {
            groups[id] = { 
                hallNo: id, 
                hallName: app[hallNameKey], 
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
        const addEmptyRows = settings.addEmptyRows === true;
        const bodyRows: any[][] = [];
        group.items.forEach((row: any, index: number) => {
            const rowData = rtlColumns.map((col: any) => {
                let value = row[col.dataKey];
                if (col.dataKey === '_index') value = index + 1;
                if (value === null || value === undefined) value = "";
                return toArabicDigits(value);
            });
            bodyRows.push(rowData);
            if (addEmptyRows) {
                // Add an empty row after every item, including the last.
                bodyRows.push(Array(rtlColumns.length).fill(""));
            }
        });

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
            rowPageBreak: "avoid",
            
            // Header configuration
            head: [headRow],
            
            // Body Data
            body: bodyRows,
            
            // Positioning
            startY: Number(settings.headerHeight) || 60,
            tableWidth: tableWidth,
            margin: { top: Number(settings.headerHeight) || 60, left: startX, right: 10, bottom: Number(settings.footerMargin) || 40 },
            
            // Global Styles (Fallbacks)
            theme: 'grid',
            styles: {
                font: 'Amiri',
                lineColor: "#444444",
                lineWidth: 0.1,
                minCellHeight: Number(settings.rowHeight) || 8,
                overflow: 'linebreak'
            },
            
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
