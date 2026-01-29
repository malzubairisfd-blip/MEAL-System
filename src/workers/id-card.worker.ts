// src/workers/id-card.worker.ts
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
  cardExpiry: string; // e.g. "31-1-2024"
  educatorName?: string; // Used for grouping
}

// --- CONSTANTS ---
// Standard ID-1 Card Size (Credit Card)
const CARD_WIDTH = 85.6;
const CARD_HEIGHT = 53.98;
const MARGIN = 3;

// --- COLORS (Brown and Gold theme) ---
const COLORS = {
  BROWN_DARK: "#5F3D36",
  BROWN_MEDIUM: "#A0522D",
  BROWN_LIGHT: "#D2691E",
  GOLD_DARK: "#D4AF37",
  GOLD_MEDIUM: "#FFD700",
  GOLD_LIGHT: "#F0E68C",
  TEXT_DARK: "#000000",
  TEXT_GRAY: "#333333",
  RED_WARNING: "#cc0000",
  WHITE: "#FFFFFF",
  PLACEHOLDER: "#E0E0E0",
};

// --- HELPER: DRAW ARABIC TEXT ---
function drawText(doc: jsPDF, text: string, x: number, y: number, size: number, color: string, align: "left" | "center" | "right" = "right", isBold = false) {
  doc.setTextColor(color);
  doc.setFont("NotoNaskhArabic", isBold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.text(String(text || ''), x, y, { align, baseline: "middle" });
}

// --- HELPER: DRAW BROWN AND GOLD DECORATIVE BORDER ---
function drawDecorativeBorder(doc: jsPDF) {
  doc.setDrawColor(COLORS.BROWN_DARK);
  doc.setLineWidth(1.5);
  doc.roundedRect(2, 2, CARD_WIDTH - 4, CARD_HEIGHT - 4, 3, 3, "S");
  
  doc.setDrawColor(COLORS.GOLD_DARK);
  doc.setLineWidth(0.8);
  doc.roundedRect(4, 4, CARD_WIDTH - 8, CARD_HEIGHT - 8, 2, 2, "S");
  
  const cornerSize = 6;
  
  doc.setFillColor(COLORS.GOLD_MEDIUM);
  doc.rect(4, 4, cornerSize, 2, "F");
  doc.rect(4, 4, 2, cornerSize, "F");
  
  doc.rect(CARD_WIDTH - 4 - cornerSize, 4, cornerSize, 2, "F");
  doc.rect(CARD_WIDTH - 4 - 2, 4, 2, cornerSize, "F");
  
  doc.rect(4, CARD_HEIGHT - 4 - 2, cornerSize, 2, "F");
  doc.rect(4, CARD_HEIGHT - 4 - cornerSize, 2, cornerSize, "F");
  
  doc.rect(CARD_WIDTH - 4 - cornerSize, CARD_HEIGHT - 4 - 2, cornerSize, 2, "F");
  doc.rect(CARD_WIDTH - 4 - 2, CARD_HEIGHT - 4 - cornerSize, 2, cornerSize, "F");
  
  doc.setDrawColor(COLORS.GOLD_LIGHT);
  doc.setLineWidth(0.3);
  
  for (let x = 10; x < CARD_WIDTH - 10; x += 4) {
    doc.line(x, 6, x + 2, 6);
  }
  
  for (let x = 10; x < CARD_WIDTH - 10; x += 4) {
    doc.line(x, CARD_HEIGHT - 6, x + 2, CARD_HEIGHT - 6);
  }
}

// --- HELPER: DRAW GOLD "R" MARKER WITH DECORATIVE SHAPE ---
function drawGoldRMarker(doc: jsPDF) {
  doc.setFillColor(COLORS.GOLD_MEDIUM);
  doc.circle(CARD_WIDTH - 8, 8, 4, "F");
  
  doc.setDrawColor(COLORS.BROWN_DARK);
  doc.setLineWidth(0.5);
  doc.circle(CARD_WIDTH - 8, 8, 4, "S");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("R", CARD_WIDTH - 8, 8, { align: "center", baseline: "middle" });
  
  doc.setFont("NotoNaskhArabic", "normal");
}

// --- HELPER: DRAW GOLD "ت" MARKER WITH DECORATIVE SHAPE ---
function drawGoldTMarker(doc: jsPDF) {
  doc.setFillColor(COLORS.GOLD_MEDIUM);
  doc.roundedRect(CARD_WIDTH - 12, 4, 8, 8, 1, 1, "F");
  
  doc.setDrawColor(COLORS.BROWN_DARK);
  doc.setLineWidth(0.5);
  doc.roundedRect(CARD_WIDTH - 12, 4, 8, 8, 1, 1, "S");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("NotoNaskhArabic", "bold");
  doc.text("ت", CARD_WIDTH - 8, 8, { align: "center", baseline: "middle" });
}

// --- HELPER: DRAW BROWN HEADER BAR WITH GOLD ACCENTS ---
function drawHeaderBar(doc: jsPDF) {
  doc.setFillColor(COLORS.BROWN_MEDIUM);
  doc.rect(6, 12, CARD_WIDTH - 12, 10, "F");
  
  doc.setDrawColor(COLORS.GOLD_MEDIUM);
  doc.setLineWidth(0.8);
  doc.line(6, 12, CARD_WIDTH - 6, 12);
  doc.line(6, 22, CARD_WIDTH - 6, 22);
  
  doc.setFillColor(COLORS.GOLD_LIGHT);
  for (let x = 10; x < CARD_WIDTH - 10; x += 5) {
    doc.circle(x, 17, 0.5, "F");
  }
}

// --- HELPER: DRAW GOLD BACKGROUND PATTERNS ---
function drawBackgroundPatterns(doc: jsPDF) {
  doc.setFillColor(COLORS.GOLD_LIGHT);
  doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
  
  for (let y = 0; y < CARD_HEIGHT; y += 8) {
    for (let x = 0; x < CARD_WIDTH; x += 8) {
      doc.line(x, y, x + 4, y + 4);
    }
  }
  
  doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
}

// --- SIDE 1: FRONT OF CARD (With brown and gold shapes) ---
export function drawCardFront(doc: jsPDF, data: IDCardData) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");
  
  drawBackgroundPatterns(doc);
  drawDecorativeBorder(doc);
  drawGoldRMarker(doc);
  drawHeaderBar(doc);
  
  doc.setTextColor(255, 255, 255);
  drawText(doc, "الصندوق الاجتماعي للتنمية:  (الامانه، صنعاء، مارب، الجوف والمحويت )", 
           CARD_WIDTH / 2, 17, 6, COLORS.WHITE, "center", true);
  
  drawText(doc, "برنامج التحويلات النقدية المشروطة في التغذية", 
           CARD_WIDTH / 2, 21, 6, COLORS.WHITE, "center");
  
  drawText(doc, "بطاقة مستفيدة", CARD_WIDTH / 2, 30, 12, COLORS.GOLD_DARK, "center", true);
  
  doc.setDrawColor(COLORS.GOLD_MEDIUM);
  doc.setLineWidth(0.5);
  doc.line(CARD_WIDTH / 2 - 20, 33, CARD_WIDTH / 2 + 20, 33);
  
  doc.setFillColor(COLORS.GOLD_LIGHT);
  doc.circle(CARD_WIDTH / 2, 38, 3, "F");
  drawText(doc, "ا", CARD_WIDTH / 2, 38, 8, COLORS.BROWN_DARK, "center", true);
  
  const startY = 45;
  const rowH = 5;
  const labelX = CARD_WIDTH - MARGIN - 5;
  
  const drawField = (label: string, value: string, y: number) => {
    drawText(doc, label + ":", labelX, y, 7, COLORS.BROWN_DARK, "right");
    const valueXLimit = labelX - 40;
    
    doc.setDrawColor(COLORS.GOLD_MEDIUM);
    doc.setLineWidth(0.1);
    
    doc.setFont("NotoNaskhArabic", "normal");
    doc.setFontSize(7);
    const valueWidth = doc.getTextWidth(value);
    
    const lineStartX = valueXLimit - valueWidth - 2;
    const lineEndX = labelX - doc.getTextWidth(label + ":") - 2;

    if (lineEndX > lineStartX) {
        for (let x = lineStartX; x < lineEndX; x += 1.5) {
            doc.line(x, y + 0.5, x + 0.8, y + 0.5);
        }
    }
    
    drawText(doc, value, (lineStartX + lineEndX)/2, y, 7, COLORS.BROWN_DARK, "center", true);
  };
  
  drawField("الاسم", data.beneficiaryName, startY);
  drawField("القرية", data.village, startY + rowH);
  drawField("العزلة", data.uzla, startY + (rowH * 2));
  drawField("المديرية", data.district, startY + (rowH * 3));
  drawField("رقم البطاقة", data.beneficiaryId, startY + (rowH * 4));
  drawField("تاريخ انتهاء البطاقة", data.cardExpiry, startY + (rowH * 5));
  
  const bottomY = startY + (rowH * 6) + 4;
  
  doc.setFillColor(COLORS.GOLD_LIGHT);
  doc.roundedRect(CARD_WIDTH - 15, bottomY - 2, 12, 6, 1, 1, "F");
  doc.setDrawColor(COLORS.BROWN_DARK);
  doc.roundedRect(CARD_WIDTH - 15, bottomY - 2, 12, 6, 1, 1, "S");
  drawText(doc, data.beneficiaryId, CARD_WIDTH - 9, bottomY, 8, COLORS.BROWN_DARK, "center", true);
  
  doc.setFillColor(COLORS.GOLD_LIGHT);
  doc.roundedRect(CARD_WIDTH - 30, bottomY - 2, 12, 6, 1, 1, "F");
  doc.setDrawColor(COLORS.BROWN_DARK);
  doc.roundedRect(CARD_WIDTH - 30, bottomY - 2, 12, 6, 1, 1, "S");
  drawText(doc, data.cardExpiry, CARD_WIDTH - 24, bottomY, 7, COLORS.RED_WARNING, "center", true);
  
  drawText(doc, "91 1033", CARD_WIDTH - 45, bottomY, 7, COLORS.GOLD_DARK, "right", true);
  drawText(doc, `2-${data.beneficiaryId}`, CARD_WIDTH - 60, bottomY, 7, COLORS.BROWN_DARK, "right", true);
  
  doc.setDrawColor(COLORS.GOLD_MEDIUM);
  doc.setLineWidth(0.5);
  doc.line(10, CARD_HEIGHT - 8, CARD_WIDTH - 10, CARD_HEIGHT - 8);
}

// --- SIDE 2: BACK OF CARD (With brown and gold shapes) ---
export function drawCardBack(doc: jsPDF) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");
  
  drawBackgroundPatterns(doc);
  drawDecorativeBorder(doc);
  drawGoldTMarker(doc);
  
  doc.setFillColor(COLORS.BROWN_MEDIUM);
  doc.rect(6, 8, CARD_WIDTH - 12, 6, "F");
  
  doc.setDrawColor(COLORS.GOLD_MEDIUM);
  doc.setLineWidth(0.5);
  doc.rect(6, 8, CARD_WIDTH - 12, 6, "S");
  
  drawText(doc, "تعليمات هامة", CARD_WIDTH / 2, 11, 10, COLORS.GOLD_MEDIUM, "center", true);
  
  const startY = 20;
  const step = 4.5;
  const x = CARD_WIDTH - MARGIN - 5;
  
  doc.setFillColor(COLORS.GOLD_MEDIUM);
  
  const instructions = [
    "• البطاقة مخصصة لأنشطة البرنامج ولا يجوز  استخدامها لأغراض أخرى",
    "• أي كشط او تعديل في بيانات البطاقة يلغيها",
    "• تحصل كل امرأة امتثلت لشروط  البرنامج على مبلغ  20 ألف ريال شهريا خلال مدة تنفيذ المشروع ولايحق  لها  التنازل  عنه للغير جزئيا أو كليا",
    "• عند اجبار المستفيدة على دفع او خصم مبلغ منها  يتم ابلاغ   إدارة البرنامج  فورا",
    "• للابلاغ  عن فقدان البطاقة أو تقديم شكوى او استفسار  يتم التواصل  عبر أحد الوسائل المذكورة أدناه"
  ];
  
  instructions.forEach((instruction, i) => {
    drawText(doc, instruction, x, startY + (i * step), 6, COLORS.BROWN_DARK, "right");
  });
  
  const separatorY = startY + (instructions.length * step) + 3;
  doc.setDrawColor(COLORS.GOLD_MEDIUM);
  doc.setLineWidth(0.8);
  doc.line(10, separatorY, CARD_WIDTH - 10, separatorY);
  
  doc.setFillColor(COLORS.GOLD_LIGHT);
  for (let x_pos = 15; x_pos < CARD_WIDTH - 15; x_pos += 6) {
    doc.circle(x_pos, separatorY, 0.5, "F");
  }
  
  const contactY = separatorY + 8;
  
  doc.setFillColor(COLORS.GOLD_LIGHT);
  doc.roundedRect(10, contactY - 3, CARD_WIDTH - 20, 8, 2, 2, "F");
  
  doc.setDrawColor(COLORS.BROWN_DARK);
  doc.setLineWidth(0.5);
  doc.roundedRect(10, contactY - 3, CARD_WIDTH - 20, 8, 2, 2, "S");
  
  drawText(doc, "الاتصال بالرقم  المجاني 8009800  او الرقم الثابت  513821 – 01", 
           CARD_WIDTH / 2, contactY + 1, 8, COLORS.BROWN_DARK, "center", true);
  
  const cornerSize = 4;
  doc.setFillColor(COLORS.GOLD_MEDIUM);
  
  doc.triangle(6, CARD_HEIGHT - 6, 6, CARD_HEIGHT - 6 - cornerSize, 6 + cornerSize, CARD_HEIGHT - 6, "F");
  doc.triangle(CARD_WIDTH - 6, CARD_HEIGHT - 6, CARD_WIDTH - 6, CARD_HEIGHT - 6 - cornerSize, CARD_WIDTH - 6 - cornerSize, CARD_HEIGHT - 6, "F");
}

// --- WORKER LOGIC ---
self.onmessage = async (event) => {
    const { beneficiaries, fontBase64, sample } = event.data;

    if (!beneficiaries || !fontBase64 || !fontBase64.regular || !fontBase64.bold) {
        postMessage({ type: 'error', error: 'Missing beneficiaries data or font files.' });
        return;
    }

    try {
        if (sample) {
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CARD_WIDTH, CARD_HEIGHT] });
            doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontBase64.regular);
            doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontBase64.bold);
            doc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
            doc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");

            const bnf = beneficiaries[0];
            const cardData: IDCardData = {
                beneficiaryName: bnf.l_benef_name || '', governorate: bnf.gov_name || '', district: bnf.mud_name || '',
                uzla: bnf.hh_ozla_name || '', village: bnf.hh_vill_name || '', beneficiaryId: String(bnf.l_id || ''),
                cardExpiry: bnf.expiry_date || "2024-01-31"
            };
            drawCardFront(doc, cardData);
            doc.addPage([CARD_WIDTH, CARD_HEIGHT], "landscape");
            drawCardBack(doc);
            const pdfBuffer = doc.output("arraybuffer");
            self.postMessage({ type: 'done-sample', data: pdfBuffer }, [pdfBuffer]);
            return;
        }
        
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
            doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontBase64.regular);
            doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontBase64.bold);
            doc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
            doc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");

            bnfs.forEach((bnf, index) => {
                if (index > 0) doc.addPage([CARD_WIDTH, CARD_HEIGHT], "landscape");
                
                const cardData: IDCardData = {
                    beneficiaryName: bnf.l_benef_name || '', governorate: bnf.gov_name || '', district: bnf.mud_name || '',
                    uzla: bnf.hh_ozla_name || '', village: bnf.hh_vill_name || '', beneficiaryId: String(bnf.l_id || ''),
                    cardExpiry: bnf.expiry_date || "2024-01-31",
                    educatorName: educator
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
        
        postMessage({ type: 'progress', status: 'Zipping files...', progress: 99 });
        const zipContent = await zip.generateAsync({ type: "arraybuffer" });

        self.postMessage({ type: 'done-all', data: zipContent }, [zipContent]);

    } catch (error: any) {
        postMessage({ type: 'error', error: error.message });
    }
};
