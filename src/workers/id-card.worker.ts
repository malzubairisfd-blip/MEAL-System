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
  projectId: string;
  cardExpiry: string;
  educatorName?: string;
}

// --- CONSTANTS ---
const CARD_WIDTH = 85.6;
const CARD_HEIGHT = 53.98;
const MARGIN = 4;
const BROWN_DARK = "#75634b";
const BROWN_MEDIUM = "#ab9475";
const BROWN_LIGHT = "#d4c5b2";
const TEXT_DARK = "#3a2d1a";
const TEXT_LIGHT = "#5b4a32";

// --- HELPERS (Copied from other workers for standalone use) ---
const ARABIC_CHARS: Record<string, string[]> = {
  'ا': ['\uFE8D', '\uFE8E', '\uFE8D', '\uFE8E'], 'أ': ['\uFE83', '\uFE84', '\uFE83', '\uFE84'],
  'ب': ['\uFE8F', '\uFE90', '\uFE92', '\uFE91'], 'ت': ['\uFE95', '\uFE96', '\uFE98', '\uFE97'],
  'ث': ['\uFE99', '\uFE9A', '\uFE9C', '\uFE9B'], 'ج': ['\uFE9D', '\uFE9E', '\uFEA0', '\uFE9F'],
  'ح': ['\uFEA1', '\uFEA2', '\uFEA4', '\uFEA3'], 'خ': ['\uFEA5', '\uFEA6', '\uFEA8', '\uFEA7'],
  'د': ['\uFEA9', '\uFEAA', '\uFEA9', '\uFEAA'], 'ذ': ['\uFEAB', '\uFEAC', '\uFEAB', '\uFEAC'],
  'ر': ['\uFEAD', '\uFEAE', '\uFEAD', '\uFEAE'], 'ز': ['\uFEAF', '\uFEB0', '\uFEAF', '\uFEB0'],
  'س': ['\uFEB1', '\uFEB2', '\uFEB4', '\uFEB3'], 'ش': ['\uFEB5', '\uFEB6', '\uFEB8', '\uFEB7'],
  'ص': ['\uFEB9', '\uFEBA', '\uFEBC', '\uFEBB'], 'ض': ['\uFEBD', '\uFEBE', '\uFEC0', '\uFEBF'],
  'ط': ['\uFEC1', '\uFEC2', '\uFEC4', '\uFEC3'], 'ظ': ['\uFEC5', '\uFEC6', '\uFEC8', '\uFEC7'],
  'ع': ['\uFEC9', '\uFECA', '\uFECC', '\uFECB'], 'غ': ['\uFECD', '\uFECE', '\uFED0', '\uFECF'],
  'ف': ['\uFED1', '\uFED2', '\uFED4', '\uFED3'], 'ق': ['\uFED5', '\uFED6', '\uFED8', '\uFED7'],
  'ك': ['\uFED9', '\uFEDA', '\uFEDC', '\uFEDB'], 'ل': ['\uFEDD', '\uFEDE', '\uFEE0', '\uFEDF'],
  'م': ['\uFEE1', '\uFEE2', '\uFEE4', '\uFEE3'], 'ن': ['\uFEE5', '\uFEE6', '\uFEE8', '\uFEE7'],
  'ه': ['\uFEE9', '\uFEEA', '\uFEEC', '\uFEEB'], 'و': ['\uFEED', '\uFEEE', '\uFEED', '\uFEEE'],
  'ي': ['\uFEF1', '\uFEF2', '\uFEF4', '\uFEF3'], 'ى': ['\uFEEF', '\uFEF0', '\uFEEF', '\uFEF0'],
  'ة': ['\uFE93', '\uFE94', '\uFE93', '\uFE94'], 'آ': ['\uFE81', '\uFE82', '\uFE81', '\uFE82'],
  'ؤ': ['\uFE85', '\uFE86', '\uFE85', '\uFE86'], 'إ': ['\uFE87', '\uFE88', '\uFE87', '\uFE88'],
  'ئ': ['\uFE89', '\uFE8A', '\uFE8C', '\uFE8B'], 'ء': ['\uFE80', '\uFE80', '\uFE80', '\uFE80']
};
const NON_CONN = ['ا','أ','إ','آ','د','ذ','ر','ز','و','ؤ','ء'];

export function fixArabic(text: string): string {
  if (!text) return "";
  let shaped = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (!ARABIC_CHARS[c]) { shaped += c; continue; }
    const p = chars[i-1], n = chars[i+1];
    const canP = p && ARABIC_CHARS[p] && !NON_CONN.includes(p);
    const canN = n && ARABIC_CHARS[n];
    let idx = 0;
    if (canP && canN) idx = 2; else if (canP) idx = 1; else if (canN) idx = 3;
    shaped += ARABIC_CHARS[c][idx];
  }
  return shaped.split("").reverse().join("");
}

export function arabicNumber(num: number | string) {
  return String(num).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

function drawText(doc: jsPDF, text: string, x: number, y: number, size: number, color: string, align: "left" | "center" | "right" = "right", isBold = false) {
  doc.setTextColor(color);
  doc.setFont("NotoNaskhArabic", isBold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.text(fixArabic(String(text || '')), x, y, { align, baseline: "middle" });
}

function drawDottedLine(doc: jsPDF, x: number, y: number, w: number) {
  doc.setLineWidth(0.2);
  doc.setDrawColor(BROWN_LIGHT);
  doc.setLineDash([0.5, 0.5], 0);
  doc.line(x, y, x + w, y);
  doc.setLineDash([], 0);
}

function drawSFDLogo(doc: jsPDF, x: number, y: number) {
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
  
  doc.setFont("NotoNaskhArabic", "normal");
  doc.setTextColor(40, 60, 80);
  doc.setFontSize(10);
  doc.text(fixArabic("الصندوق"), x + 8, y + 4, {align: 'left'});
  doc.text(fixArabic("الاجتماعي"), x + 8, y + 9, {align: 'left'});
  doc.text(fixArabic("للتنمية"), x + 8, y + 14, {align: 'left'});
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Social Fund for Development", x, y + 17, {align: 'left'});
}

// --- SIDE 1: FRONT OF CARD ---
export function drawCardFront(doc: jsPDF, data: IDCardData) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");
  
  // Header
  drawSFDLogo(doc, MARGIN, 4);
  drawText(doc, "الصندوق الاجتماعي للتنمية: (الامانه، صنعاء، مارب، الجوف والمحويت)", CARD_WIDTH - MARGIN, 6, 6.5, TEXT_DARK, "right");
  drawText(doc, "برنامج التحويلات النقدية المشروطة في التغذية", CARD_WIDTH - MARGIN, 11, 7.5, TEXT_DARK, "right", true);
  doc.setDrawColor(BROWN_LIGHT);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, 14, CARD_WIDTH - MARGIN, 14);

  // Title Box
  doc.setDrawColor(BROWN_DARK);
  doc.setLineWidth(0.5);
  doc.roundedRect(CARD_WIDTH / 2 - 20, 16, 40, 7, 1.5, 1.5);
  drawText(doc, "بطاقة مستفيدة", CARD_WIDTH / 2, 19.5, 10, TEXT_DARK, "center", true);

  // Photo Placeholder
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, 18, 24, 28, "FD");

  // Data Fields
  let y = 28;
  const fieldGap = 5.5;
  const labelX = CARD_WIDTH - MARGIN;
  const valueStartX = CARD_WIDTH - MARGIN - 23;
  const lineLength = 28;

  drawText(doc, "الاسم:", labelX, y, 9, TEXT_DARK, "right", true);
  drawText(doc, data.beneficiaryName, valueStartX, y, 8, TEXT_DARK, "right");
  drawDottedLine(doc, valueStartX - lineLength, y + 1.5, lineLength);
  
  y += fieldGap;
  drawText(doc, "القرية:", labelX - 58, y, 9, TEXT_DARK, "right", true);
  drawText(doc, data.village, labelX - 68, y, 8, TEXT_DARK, "right");
  drawDottedLine(doc, labelX - 68 - 15, y + 1.5, 15);
  
  drawText(doc, "العزلة:", labelX, y, 9, TEXT_DARK, "right", true);
  drawText(doc, data.uzla, valueStartX, y, 8, TEXT_DARK, "right");
  drawDottedLine(doc, valueStartX - lineLength, y + 1.5, lineLength);

  y += fieldGap;
  drawText(doc, "المديرية:", labelX, y, 9, TEXT_DARK, "right", true);
  drawText(doc, data.district, valueStartX, y, 8, TEXT_DARK, "right");
  drawDottedLine(doc, valueStartX - lineLength, y + 1.5, lineLength);

  y += fieldGap;
  drawText(doc, "رقم البطاقة:", labelX, y, 9, TEXT_DARK, "right", true);
  drawText(doc, arabicNumber(data.beneficiaryId), valueStartX, y, 9, TEXT_DARK, "right");
  drawDottedLine(doc, valueStartX - lineLength, y + 1.5, lineLength);

  y += fieldGap;
  drawText(doc, "تاريخ انتهاء البطاقة:", labelX, y, 9, TEXT_DARK, "right", true);
  drawText(doc, arabicNumber(data.cardExpiry), valueStartX, y, 9, TEXT_DARK, "right");
  drawDottedLine(doc, valueStartX - lineLength, y + 1.5, lineLength);

  // Extra numbers
  drawText(doc, arabicNumber(`${data.projectId}-${data.beneficiaryId}`), 16, 49, 9, TEXT_DARK, "center");
  drawText(doc, arabicNumber('91'), 28, 52, 9, TEXT_DARK, "center");
  drawText(doc, arabicNumber('1033'), CARD_WIDTH - 25, 52, 9, TEXT_DARK, "center");

  // Bottom swoosh
  doc.setFillColor(BROWN_DARK);
  doc.path([ { op: 'm', c: [CARD_WIDTH, 42] }, { op: 'c', c: [60, 30, 25, 50, -5, CARD_HEIGHT] }, { op: 'l', c: [CARD_WIDTH, CARD_HEIGHT] }, { op: 'h', c: [] } ]).fill();
  doc.setFillColor(BROWN_MEDIUM);
  doc.path([ { op: 'm', c: [CARD_WIDTH, 45] }, { op: 'c', c: [65, 33, 30, 52, -5, CARD_HEIGHT] }, { op: 'l', c: [CARD_WIDTH, CARD_HEIGHT] }, { op: 'h', c: [] } ]).fill();
}

// --- SIDE 2: BACK OF CARD ---
export function drawCardBack(doc: jsPDF) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, "F");

  // Top swoosh
  doc.setFillColor(BROWN_DARK);
  doc.path([ { op: 'm', c: [0, 25] }, { op: 'c', c: [30, 35, 60, 8, CARD_WIDTH, 0] }, { op: 'l', c: [0, 0] }, { op: 'h', c: [] } ]).fill();
  doc.setFillColor(BROWN_MEDIUM);
  doc.path([ { op: 'm', c: [0, 29] }, { op: 'c', c: [35, 39, 65, 12, CARD_WIDTH, 0] }, { op: 'l', c: [0, 0] }, { op: 'h', c: [] } ]).fill();
  
  // Title
  drawText(doc, "تعليمات هامة", CARD_WIDTH / 2, 32, 12, TEXT_DARK, "center", true);
  
  const y = 39;
  const lineHeight = 4.5;
  const x = CARD_WIDTH - MARGIN - 2;

  const rules = [
    "البطاقة مخصصة لأنشطة البرنامج ولا يجوز استخدامها لأغراض أخرى",
    "أي كشط او تعديل في بيانات البطاقة يلغيها",
    "يجب الحفاظ على هذه البطاقة وعدم مشاركتها مع الآخرين",
    "تحصل كل إمرأة امتثلت لشروط البرنامج على مبلغ 20 ألف ريال شهريا خلال مدة تنفيذ المشروع ولا يحق لها التنازل عنه للغير جزئيا أو كليا",
    "عند اجبار المستفيدة على دفع أو خصم مبلغ منها يتم ابلاغ إدارة البرنامج فورا",
    "للإبلاغ عن فقدان البطاقة أو تقديم شكوى أو استفسار يتم التواصل عبر أحد الوسائل المدونة أدناه"
  ];
  
  let currentY = y;
  rules.forEach(rule => {
      const lines = doc.splitTextToSize(fixArabic(rule), CARD_WIDTH - (MARGIN * 2) - 5);
      lines.forEach((line: string, i: number) => {
        if(i === 0) {
            doc.setFillColor(TEXT_DARK);
            doc.circle(x + 1.5, currentY, 0.5, 'F');
        }
        drawText(doc, line, x, currentY, 7.5, TEXT_LIGHT, "right");
        currentY += (lineHeight - 1);
      });
      currentY += 1.5;
  });

  // Footer
  doc.setFillColor(BROWN_DARK);
  doc.rect(0, CARD_HEIGHT - 8, CARD_WIDTH, 8, "F");
  drawText(doc, "الاتصال بالرقم المجاني 8009800 أو الرقم الثابت 513821 – 01", CARD_WIDTH / 2, CARD_HEIGHT - 4, 8, "#FFFFFF", "center", true);

  // Bottom right triangle decoration
  doc.setFillColor(BROWN_DARK);
  doc.path([ {op: 'm', c: [CARD_WIDTH, CARD_HEIGHT - 10]}, {op: 'l', c: [CARD_WIDTH - 10, CARD_HEIGHT]}, {op: 'l', c: [CARD_WIDTH, CARD_HEIGHT]}, {op: 'h', c: []} ]).fill();
}

// --- WORKER LOGIC ---
self.onmessage = async (event) => {
    const { beneficiaries, fontBase64, sample } = event.data;

    if (!beneficiaries || !fontBase64 || !fontBase64.regular || !fontBase64.bold) {
        postMessage({ type: 'error', error: 'Missing beneficiaries data or font files.' });
        return;
    }

    try {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CARD_WIDTH, CARD_HEIGHT] });
        doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontBase64.regular);
        doc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
        doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontBase64.bold);
        doc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");

        if (sample) {
            const bnf = beneficiaries[0]; // Just use the first one for the sample
            const data: IDCardData = {
                beneficiaryName: bnf.l_benef_name || '',
                governorate: bnf.gov_name || '',
                district: bnf.mud_name || '',
                uzla: bnf.hh_ozla_name || '',
                village: bnf.hh_vill_name || '',
                beneficiaryId: String(bnf.l_id || ''),
                projectId: String(bnf.project_id || ''),
                cardExpiry: bnf.card_expiry || "2025-01-31" // Fallback
            };
            drawCardFront(doc, data);
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
            const educatorDoc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CARD_WIDTH, CARD_HEIGHT] });
            educatorDoc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontBase64.regular);
            educatorDoc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
            educatorDoc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontBase64.bold);
            educatorDoc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");

            bnfs.forEach((bnf, index) => {
                if (index > 0) educatorDoc.addPage([CARD_WIDTH, CARD_HEIGHT], "landscape");
                
                const cardData: IDCardData = {
                    beneficiaryName: bnf.l_benef_name || '',
                    governorate: bnf.gov_name || '',
                    district: bnf.mud_name || '',
                    uzla: bnf.hh_ozla_name || '',
                    village: bnf.hh_vill_name || '',
                    beneficiaryId: String(bnf.l_id || ''),
                    projectId: String(bnf.project_id || ''),
                    cardExpiry: bnf.card_expiry || "2025-01-31" // Fallback
                };

                drawCardFront(educatorDoc, cardData);
                educatorDoc.addPage([CARD_WIDTH, CARD_HEIGHT], "landscape");
                drawCardBack(educatorDoc);
            });

            const safeName = educator.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, "_").trim();
            zip.file(`${safeName}_ID_Cards.pdf`, educatorDoc.output("arraybuffer"));
            
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
