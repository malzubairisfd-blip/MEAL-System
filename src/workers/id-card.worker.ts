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
  cardExpiry: string;
  educatorName?: string;
}

// --- CONSTANTS ---
const CARD_WIDTH = 85.6;
const CARD_HEIGHT = 53.98;
const PADDING = 4;

const COLORS = {
  DARK_BROWN: "#5F3D36",
  LIGHT_BROWN: "#8D6E63",
  GOLD: "#C7B27C",
  TEXT_DARK: "#222222",
  TEXT_GREY: "#555555",
  PLACEHOLDER: "#ECECEC",
  WHITE: "#FFFFFF"
};

// --- HELPER: DRAW ARABIC TEXT ---
function drawText(
  doc: jsPDF, 
  text: string, 
  x: number, 
  y: number, 
  size: number, 
  color: string, 
  align: "left" | "center" | "right" = "right", 
  isBold = false
) {
  doc.setTextColor(color);
  doc.setFont("NotoNaskhArabic", isBold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.text(String(text || ''), x, y, { align, baseline: "middle" });
}

// --- HELPER: DRAW DOTTED DATA ROW ---
function drawDataRow(doc: jsPDF, label: string, value: string, y: number, rightX: number, valueXLimit: number) {
    drawText(doc, label + ":", rightX, y, 8, COLORS.TEXT_DARK, "right", true);
    drawText(doc, value, valueXLimit, y, 10, COLORS.TEXT_DARK, "right", false);

    doc.setDrawColor(COLORS.TEXT_GREY);
    doc.setLineWidth(0.1);
    doc.setLineDash([0.5, 0.5], 0);

    doc.setFont("Amiri", "normal");
    doc.setFontSize(10);
    const valueWidth = doc.getTextWidth(value);
    
    doc.setFont("Amiri", "bold");
    doc.setFontSize(8);
    const labelWidth = doc.getTextWidth(label + ":");

    const lineStartX = valueXLimit - valueWidth - 2;
    const lineEndX = rightX - labelWidth - 2;

    if (lineEndX > lineStartX) {
      doc.line(lineStartX, y + 1, lineEndX, y + 1);
    }
    doc.setLineDash([], 0);
}

// --- SIDE 1: FRONT OF CARD ---
export function drawCardFront(doc: jsPDF, data: IDCardData) {
    doc.setFillColor(COLORS.WHITE);
    doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");

    doc.setFillColor(COLORS.DARK_BROWN);
    doc.path([
        { op: 'm', c: [0, CARD_HEIGHT] }, { op: 'l', c: [35, CARD_HEIGHT] },
        { op: 'c', c: [25, CARD_HEIGHT - 10, 10, CARD_HEIGHT - 25, 0, CARD_HEIGHT - 25] },
        { op: 'h', c: [] }
    ]).fill();

    doc.setFillColor(COLORS.GOLD);
    doc.path([
        { op: 'm', c: [0, CARD_HEIGHT - 20] },
        { op: 'c', c: [15, CARD_HEIGHT - 20, 30, CARD_HEIGHT - 5, 40, CARD_HEIGHT] },
        { op: 'l', c: [0, CARD_HEIGHT] }, { op: 'h', c: [] }
    ]).fill();

    const headerX = CARD_WIDTH - 5;
    drawText(doc, "(الصندوق الاجتماعي للتنمية): (الامانه، صنعاء، مارب، الجوف والمحويت)", headerX, 6, 6, COLORS.TEXT_DARK, "right", true);
    drawText(doc, "برنامج التحويلات النقدية المشروطة في التغذية", headerX, 9, 6, COLORS.TEXT_DARK, "right", false);

    doc.setDrawColor(COLORS.GOLD);
    doc.setLineWidth(0.5);
    doc.setFillColor(COLORS.WHITE);
    doc.roundedRect(CARD_WIDTH / 2 - 12, 13, 24, 6, 0.5, 0.5, "FD");
    drawText(doc, "بطاقة مستفيدة", CARD_WIDTH / 2, 16, 9, COLORS.TEXT_DARK, "center", true);

    const startY = 24;
    const lineHeight = 5;
    const rightMargin = CARD_WIDTH - 5;
    const valueColX = CARD_WIDTH - 25;

    drawDataRow(doc, "الاسم", data.beneficiaryName, startY, rightMargin, valueColX);

    const row2Y = startY + lineHeight;
    drawText(doc, "القرية:", rightMargin, row2Y, 8, COLORS.TEXT_DARK, "right", true);
    drawText(doc, data.village, rightMargin - 12, row2Y, 10, COLORS.TEXT_DARK, "right", false);
    drawText(doc, "العزلة:", rightMargin - 35, row2Y, 8, COLORS.TEXT_DARK, "right", true);
    drawText(doc, data.uzla, rightMargin - 45, row2Y, 10, COLORS.TEXT_DARK, "right", false);

    drawDataRow(doc, "المديرية", data.district, row2Y + lineHeight, rightMargin, valueColX);
    drawDataRow(doc, "رقم البطاقة", data.beneficiaryId, row2Y + (lineHeight * 2), rightMargin, valueColX);
    drawDataRow(doc, "تاريخ انتهاء البطاقة", data.cardExpiry, row2Y + (lineHeight * 3), rightMargin, valueColX);

    const photoX = 8, photoY = 22, photoW = 18, photoH = 20;
    doc.setFillColor(COLORS.PLACEHOLDER);
    doc.rect(photoX, photoY, photoW, photoH, "F");
    drawText(doc, `2-${data.beneficiaryId}`, photoX + (photoW/2), photoY + photoH + 4, 8, COLORS.TEXT_DARK, "center", true);

    drawText(doc, "1033", CARD_WIDTH - 10, CARD_HEIGHT - 4, 8, COLORS.TEXT_DARK, "right", true);
    drawText(doc, "91", 20, CARD_HEIGHT - 4, 8, COLORS.TEXT_DARK, "left", true);
}

// --- SIDE 2: BACK OF CARD ---
export function drawCardBack(doc: jsPDF) {
    doc.setFillColor(COLORS.DARK_BROWN);
    doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");

    doc.setFillColor(COLORS.GOLD);
    doc.path([
        { op: 'm', c: [0, 0] }, { op: 'l', c: [50, 0] },
        { op: 'c', c: [30, 15, 10, 25, 0, 30] }, { op: 'h', c: [] }
    ]).fill();

    drawText(doc, "تعليمات هامة", CARD_WIDTH - 10, 10, 12, COLORS.WHITE, "right", true);

    const rules = [
      "البطاقة مخصصة لأنشطة البرنامج ولا يجوز استخدامها لأغراض أخرى",
      "أي كشط أو تعديل في بيانات البطاقة يلغيها",
      "تحصل كل إمرأة امتثلت لشروط البرنامج على مبلغ 20 ألف ريال شهريا",
      "عند اجبار المستفيدة على دفع أو خصم مبلغ منها يتم ابلاغ إدارة البرنامج",
      "للإبلاغ عن فقدان البطاقة أو تقديم شكوى يتم التواصل عبر الوسائل أدناه"
    ];
    let currentY = 18; const gap = 4.5; const textX = CARD_WIDTH - 12;
    rules.forEach((rule) => {
        doc.setFillColor(COLORS.WHITE);
        doc.circle(textX + 3, currentY, 0.7, "F");
        drawText(doc, rule, textX, currentY, 6.5, COLORS.WHITE, "right", false);
        currentY += gap;
    });

    const footerH = 8; const footerY = CARD_HEIGHT - footerH;
    doc.setFillColor(COLORS.LIGHT_BROWN);
    doc.rect(0, footerY, CARD_WIDTH, footerH, "F");
    doc.setDrawColor(COLORS.GOLD);
    doc.setLineWidth(0.5);
    doc.line(0, footerY, CARD_WIDTH, footerY);
    drawText(doc, "الاتصال بالرقم المجاني 8009800 أو الرقم الثابت 513821 - 01", CARD_WIDTH / 2, footerY + (footerH/2), 7, COLORS.WHITE, "center", true);
    
    // Bottom right triangle
    doc.setFillColor(COLORS.GOLD);
    doc.path([ { op: 'm', c: [CARD_WIDTH, CARD_HEIGHT] }, { op: 'l', c: [CARD_WIDTH - 20, CARD_HEIGHT] }, { op: 'l', c: [CARD_WIDTH, CARD_HEIGHT - 10] }, { op: 'h', c: [] } ]).fill();
    drawText(doc, "2-126725", CARD_WIDTH - 11.5, CARD_HEIGHT - 3, 4, COLORS.WHITE, "center", false);
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
