import jsPDF from "jspdf";
import JSZip from "jszip";

// --- TYPES ---
export interface IDCardData {
  beneficiaryName: string;
  governorate: string;
  district: string;
  uzla: string;
  village: string;
  beneficiaryId: string;
  cardExpiry: string; // e.g. "2024-12-31"
  educatorName?: string; // Used for grouping
}

// --- CONSTANTS ---
// Standard ID-1 Card Size (Credit Card)
const CARD_WIDTH = 85.6;
const CARD_HEIGHT = 53.98;
const MARGIN = 3;

// --- COLORS (Based on SFD Nutrition Theme) ---
const COLORS = {
  TEAL_DARK: "#006450",   // Main Header Background
  TEAL_LIGHT: "#008f73",  // Lighter Curve
  TEXT_DARK: "#1a1a1a",
  TEXT_GRAY: "#4a4a4a",
  RED_WARNING: "#cc0000"
};

// --- HELPER: DRAW ARABIC TEXT ---
function drawText(doc: jsPDF, text: string, x: number, y: number, size: number, color: string, align: "left" | "center" | "right" = "right", isBold = false) {
  doc.setTextColor(color);
  doc.setFont("Amiri", isBold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.text(String(text || ''), x, y, { align, baseline: "middle" });
}

// --- HELPER: DRAW THE "SWOOSH" HEADER ---
function drawHeaderCurve(doc: jsPDF) {
  // Background fill (White)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");

  // We use a custom shape for the wave to match the file exactly
  doc.setFillColor(COLORS.TEAL_DARK);
  doc.path([
    { op: 'm', c: [0, 0] },
    { op: 'l', c: [CARD_WIDTH, 0] },
    { op: 'l', c: [CARD_WIDTH, 12] },
    { op: 'c', c: [60, 18, 20, 8, 0, 14] }, // The Curve Control Points
    { op: 'h', c: [] } // Close path
  ]).fill();
}

// --- SIDE 1: FRONT OF CARD ---
export function drawCardFront(doc: jsPDF, data: IDCardData) {
  drawHeaderCurve(doc);

  // Header Text (White)
  drawText(doc, "الصندوق الاجتماعي للتنمية", CARD_WIDTH / 2, 4, 7, "#FFFFFF", "center", true);
  drawText(doc, "برنامج التحويلات النقدية المشروطة في التغذية", CARD_WIDTH / 2, 7.5, 6, "#FFFFFF", "center");

  // Card Title Box
  doc.setFillColor(240, 240, 240);
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(CARD_WIDTH - 28, 14, 25, 5, 1, 1, "FD");
  drawText(doc, "بطاقة مستفيدة", CARD_WIDTH - 15.5, 16.5, 8, COLORS.TEAL_DARK, "center", true);

  // Data Fields
  const startY = 22;
  const rowH = 4.5;
  const labelX = CARD_WIDTH - MARGIN;
  const valX = CARD_WIDTH - 22;
  
  const drawRow = (label: string, value: string, y: number) => {
    drawText(doc, label + ":", labelX, y, 7, COLORS.TEXT_GRAY, "right");
    drawText(doc, value, valX, y, 7, COLORS.TEXT_DARK, "right", true);
  };

  drawRow("الاسم", data.beneficiaryName, startY);
  drawRow("المحافظة/المديرية", `${data.governorate} / ${data.district}`, startY + rowH);
  drawRow("العزلة/القرية", `${data.uzla} / ${data.village}`, startY + (rowH * 2));
  
  // ID and Expiry Boxes
  const boxY = startY + (rowH * 3) + 1;
  doc.setDrawColor(COLORS.TEAL_DARK);
  doc.setLineWidth(0.3);
  doc.rect(CARD_WIDTH - 35, boxY, 32, 8);
  drawText(doc, "رقم البطاقة", CARD_WIDTH - 19, boxY + 2.5, 6, COLORS.TEAL_DARK, "center");
  drawText(doc, data.beneficiaryId, CARD_WIDTH - 19, boxY + 6, 9, "#000000", "center", true);
  
  doc.rect(CARD_WIDTH - 65, boxY, 28, 8);
  drawText(doc, "تاريخ الانتهاء", CARD_WIDTH - 51, boxY + 2.5, 6, COLORS.RED_WARNING, "center");
  drawText(doc, data.cardExpiry, CARD_WIDTH - 51, boxY + 6, 8, "#000000", "center");

  // Photo Placeholder
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.1);
  doc.rect(3, 16, 22, 26);
  drawText(doc, "صورة", 14, 29, 6, "#cccccc", "center");
  drawText(doc, "المستفيدة", 14, 32, 6, "#cccccc", "center");

  // Footer Bar
  doc.setFillColor(COLORS.TEAL_DARK);
  doc.rect(0, CARD_HEIGHT - 3, CARD_WIDTH, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5);
  doc.text("Social Fund for Development - Nutrition CCT Program", CARD_WIDTH / 2, CARD_HEIGHT - 1.5, { align: "center", baseline: "middle" });
}

// --- SIDE 2: BACK OF CARD ---
export function drawCardBack(doc: jsPDF) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");

  doc.setFillColor(COLORS.TEAL_DARK);
  doc.rect(0, 0, CARD_WIDTH, 8, "F");
  drawText(doc, "تعليمات هامة", CARD_WIDTH / 2, 4, 9, "#FFFFFF", "center", true);

  const startY = 14;
  const step = 4.5;
  const x = CARD_WIDTH - MARGIN;
  const rules = [
    "• البطاقة مخصصة لأنشطة البرنامج ولا يجوز استخدامها لأغراض أخرى.",
    "• أي كشط أو تعديل في بيانات البطاقة يلغيها.",
    "• يجب إبراز البطاقة عند استلام المستحقات النقدية.",
    "• في حال فقدان البطاقة يرجى إبلاغ ضابط التيسير فوراً."
  ];
  rules.forEach((rule, i) => drawText(doc, rule, x, startY + (i * step), 6, COLORS.TEXT_DARK, "right"));

  const footY = CARD_HEIGHT - 15;
  doc.setDrawColor(COLORS.TEAL_LIGHT);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, footY, CARD_WIDTH - MARGIN, footY);
  drawText(doc, "للشكاوى والاستفسارات:", CARD_WIDTH / 2, footY + 4, 7, COLORS.TEAL_DARK, "center", true);
  drawText(doc, "الرقم المجاني: 8009800", CARD_WIDTH / 2, footY + 9, 9, "#000000", "center", true);
}


// --- WORKER LOGIC ---
self.onmessage = async (event) => {
    const { beneficiaries, fontBase64 } = event.data;

    if (!beneficiaries || !fontBase64) {
        postMessage({ type: 'error', error: 'Missing beneficiaries data or font.' });
        return;
    }

    try {
        const grouped: Record<string, any[]> = {};
        beneficiaries.forEach((row: any) => {
            const edu = row.ED_NAME || "Unassigned_Educator";
            if (!grouped[edu]) grouped[edu] = [];
            grouped[edu].push(row);
        });

        const zip = new JSZip();
        const totalEducators = Object.keys(grouped).length;
        let educatorsProcessed = 0;

        for (const [educator, bnfs] of Object.entries(grouped)) {
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CARD_WIDTH, CARD_HEIGHT] });
            doc.addFileToVFS("Amiri-Regular.ttf", fontBase64);
            doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
            doc.addFont("Amiri-Regular.ttf", "Amiri", "bold");

            bnfs.forEach((bnf, index) => {
                if (index > 0) doc.addPage([CARD_WIDTH, CARD_HEIGHT], "landscape");
                
                const cardData: IDCardData = {
                  beneficiaryName: bnf.l_benef_name || '',
                  governorate: bnf.gov_name || '',
                  district: bnf.mud_name || '',
                  uzla: bnf.hh_ozla_name || '',
                  village: bnf.hh_vill_name || '',
                  beneficiaryId: String(bnf.l_id || ''),
                  cardExpiry: bnf.expiry_date || "2025-01-01"
                };

                drawCardFront(doc, cardData);
                doc.addPage([CARD_WIDTH, CARD_HEIGHT], "landscape");
                drawCardBack(doc);
            });

            const safeName = educator.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, "_").trim();
            zip.file(`${safeName}_ID_Cards.pdf`, doc.output("arraybuffer"));
            
            educatorsProcessed++;
            postMessage({
                type: 'progress',
                status: `Generating PDFs for ${safeName}...`,
                progress: Math.round((educatorsProcessed / totalEducators) * 100),
                current: educatorsProcessed,
                total: totalEducators
            });
        }
        
        postMessage({ type: 'progress', status: 'Zipping files...', progress: 99, current: totalEducators, total: totalEducators });
        const zipContent = await zip.generateAsync({ type: "arraybuffer" });

        self.postMessage({ type: 'done', data: zipContent }, [zipContent]);

    } catch (error: any) {
        postMessage({ type: 'error', error: error.message });
    }
};
