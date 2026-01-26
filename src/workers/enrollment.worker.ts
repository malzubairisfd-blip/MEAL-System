// src/workers/enrollment.worker.ts
import jsPDF from "jspdf";
import JSZip from "jszip";

// --- TYPES ---
export interface EnrollmentData {
  beneficiaryId: string;
  phone: string;
  idNumber: string;
  idType: string;
  governorate: string;
  district: string;
  uzla: string;
  village: string;
  fullName: string;
  husbandName: string;
  maritalStatus: string;
  qualificationCriteria: string;
  childCountMale: number;
  childCountFemale: number;
  childNames: string;
  educatorName: string;
}

// --- CONSTANTS ---
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 10;
const MARGIN_Y = 10;
const CONTENT_W = PAGE_W - (MARGIN_X * 2);

// Colors
const COLOR_BLUE_HEADER = "#2e74b5";
const COLOR_TEXT = "#000000";
const COLOR_GRAY_BG = "#f0f0f0";

// --- HELPERS ---
function drawText(doc: jsPDF, text: string, x: number, y: number, size: number, align: "right" | "center" | "left" = "right", isBold = false) {
  doc.setFont("Amiri", isBold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
  doc.text(String(text || ""), x, y, { align, baseline: "middle" });
}

function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number, fillColor?: string) {
  doc.setLineWidth(0.1);
  doc.setDrawColor(0);
  if (fillColor) {
    doc.setFillColor(fillColor);
    doc.rect(x, y, w, h, "FD");
  } else {
    doc.rect(x, y, w, h);
  }
}

// --- DRAW LOGO (SFD) ---
function drawSFDLogo(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(40, 100, 80);
  doc.rect(x, y, 15, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("SFD", x + 7.5, y + 10, { align: "center", baseline: "middle" });
  
  doc.setTextColor(0);
  doc.setFontSize(7);
  doc.text("الصندوق", x + 16, y + 5);
  doc.text("الاجتماعي", x + 16, y + 10);
  doc.text("للتنمية", x + 16, y + 15);
  doc.text("Social Fund for Development", x, y + 24, { align: "left" });
}

// --- MAIN GENERATOR ---
export function drawEnrollmentForm(doc: jsPDF, data: EnrollmentData) {
  let y = MARGIN_Y;

  // 1. HEADER SECTION
  drawText(doc, "الجمهورية اليمنية", PAGE_W - MARGIN_X, y + 5, 10, "right", true);
  drawText(doc, "رئاسة مجلس الوزراء", PAGE_W - MARGIN_X, y + 10, 10, "right", true);
  drawText(doc, "الصندوق الاجتماعي للتنمية", PAGE_W - MARGIN_X, y + 15, 10, "right", true);

  drawSFDLogo(doc, MARGIN_X, y);

  doc.setFillColor(230, 230, 230);
  doc.roundedRect(PAGE_W / 2 - 60, y + 20, 120, 8, 2, 2, "F");
  drawText(doc, "استمارة التحاق بمشروع التحويلات النقدية المشروطة في التغذية", PAGE_W / 2, y + 24, 12, "center", true);

  y += 35;

  drawText(doc, `المحافظة : ${data.governorate}`, PAGE_W - MARGIN_X, y, 10, "right", true);
  drawText(doc, `المديرية : ${data.district}`, PAGE_W - 80, y, 10, "right", true);
  
  drawText(doc, `رقم المستهدفة : ${data.beneficiaryId}`, MARGIN_X + 60, y, 10, "right", true);
  drawText(doc, `رقم التلفون : ${data.phone}`, MARGIN_X + 30, y + 6, "right", 10, true);

  y += 12;

  doc.setFillColor(COLOR_BLUE_HEADER);
  doc.rect(MARGIN_X, y, CONTENT_W, 7, "F");
  doc.setTextColor(255, 255, 255);
  drawText(doc, "أولاً : بيانات المرأة المستهدفة حسب قاعدة البيانات", PAGE_W - MARGIN_X - 2, y + 3.5, 10, "right", true);
  doc.setTextColor(0);

  y += 10;

  drawText(doc, "الاسم خماسياً :", PAGE_W - MARGIN_X, y, 10, "right");
  drawText(doc, data.fullName, PAGE_W - MARGIN_X - 25, y, 10, "right", true);
  y += 7;

  drawText(doc, `العزلة : ${data.uzla}`, PAGE_W - MARGIN_X, y, 10, "right");
  drawText(doc, `القرية / المحلة : ${data.village}`, PAGE_W - 80, y, 10, "right");
  drawText(doc, `نوع الهوية : ${data.idType}`, PAGE_W - 130, y, 10, "right");
  drawText(doc, `رقمها : ${data.idNumber}`, PAGE_W - 170, y, 10, "right");
  y += 7;

  drawText(doc, "اسم زوج المستهدفة :", PAGE_W - MARGIN_X, y, 10, "right");
  drawText(doc, data.husbandName, PAGE_W - MARGIN_X - 35, y, 10, "right", true);
  y += 7;

  drawText(doc, `الحالة الاجتماعية : ${data.maritalStatus}`, PAGE_W - MARGIN_X, y, 10, "right");
  y += 7;
  
  drawText(doc, "حالة تأهل المرأة المستهدفة :", PAGE_W - MARGIN_X, y, 10, "right");
  drawText(doc, data.qualificationCriteria, PAGE_W - MARGIN_X - 45, y, 10, "right", true);
  
  drawText(doc, "شهر الحمل [   ]", PAGE_W - 120, y, 10, "right");
  
  drawText(doc, `عدد الأطفال ذكور : ${data.childCountMale}`, PAGE_W - 150, y, 10, "right");
  drawText(doc, `إناث : ${data.childCountFemale}`, PAGE_W - 180, y, 10, "right");
  y += 7;

  drawText(doc, "أسماء أطفال المستهدفة الأقل من 5 سنوات وذوي الإعاقة من 5-17 سنة :", PAGE_W - MARGIN_X, y, 10, "right");
  y += 5;
  drawBox(doc, MARGIN_X, y, CONTENT_W, 12);
  drawText(doc, data.childNames, PAGE_W - MARGIN_X - 2, y + 4, 9, "right");
  y += 15;

  drawText(doc, "المستوى التعليمي للمرأة المستهدفة :", PAGE_W - MARGIN_X, y, 10, "right");
  const eduOptions = ["تقرأ وتكتب", "أساسي", "ثانوي", "جامعي", "لا تقرأ ولا تكتب"];
  let eduX = PAGE_W - 70;
  eduOptions.forEach(opt => {
    drawBox(doc, eduX, y - 2, 4, 4);
    drawText(doc, opt, eduX - 2, y, 9, "right");
    eduX -= 30;
  });
  y += 10;

  doc.setFillColor(COLOR_BLUE_HEADER);
  doc.rect(MARGIN_X, y, CONTENT_W, 7, "F");
  doc.setTextColor(255, 255, 255);
  drawText(doc, "ثانياً : المنافع التي ستحصل عليها المرأة المستهدفة من المشروع", PAGE_W - MARGIN_X - 2, y + 3.5, 10, "right", true);
  doc.setTextColor(0);
  y += 10;

  const benefitText = "تحصل كل امرأة مستهدفة استوفت المعايير (حامل أو أم لطفل أقل من خمس سنوات أو أم لطفل ذو إعاقة من 5-17 سنة) والتزمت بالشروط، على مساعدة نقدية بواقع عشرون ألف ريال شهرياً ولمدة ستة أشهر.";
  const splitBenefit = doc.splitTextToSize(benefitText, CONTENT_W);
  doc.text(splitBenefit, PAGE_W - MARGIN_X, y, { align: "right" });
  y += 15;

  doc.setFillColor(COLOR_BLUE_HEADER);
  doc.rect(MARGIN_X, y, CONTENT_W, 7, "F");
  doc.setTextColor(255, 255, 255);
  drawText(doc, "ثالثاً : حرمان المرأة المستهدفة من المنافع", PAGE_W - MARGIN_X - 2, y + 3.5, 10, "right", true);
  doc.setTextColor(0);
  y += 10;

  const rules = [
    "1. إذا انتقلت خارج منطقة المشروع",
    "2. إذا ثبت أنها أدلت ببيانات مضللة أو قدمت وثائق مزورة",
    "3. إذا ثبت انتحالها لشخصية امرأة أخرى",
    "4. عدم حصولها على بطاقة هوية شخصية",
    "5. في حال الوفاة (لا سمح الله)"
  ];
  
  let ruleY = y;
  drawText(doc, rules[0], PAGE_W - MARGIN_X, ruleY, 9, "right");
  drawText(doc, rules[1], PAGE_W / 2, ruleY, 9, "right");
  ruleY += 6;
  drawText(doc, rules[2], PAGE_W - MARGIN_X, ruleY, 9, "right");
  drawText(doc, rules[3], PAGE_W / 2, ruleY, 9, "right");
  ruleY += 6;
  drawText(doc, rules[4], PAGE_W - MARGIN_X, ruleY, 9, "right");
  
  y = ruleY + 10;

  doc.setFillColor(COLOR_BLUE_HEADER);
  doc.rect(MARGIN_X, y, CONTENT_W, 7, "F");
  doc.setTextColor(255, 255, 255);
  drawText(doc, "رابعاً : توقيع أو بصمة المرأة المؤهلة بالعلم والموافقة وصحة البيانات", PAGE_W - MARGIN_X - 2, y + 3.5, 10, "right", true);
  doc.setTextColor(0);
  y += 10;

  const disclaimer = "أقر أنا الموقعة أدناه بأن البيانات الواردة في الاستمارة صحيحة وأني موافقة على شروط المشروع والالتحاق به وأن رقم التلفون المدون هو ملكية خاصة لي أو لأحد أفراد الأسرة المقربين.";
  const splitDisc = doc.splitTextToSize(disclaimer, CONTENT_W);
  doc.text(splitDisc, PAGE_W - MARGIN_X, y, { align: "right" });
  y += 15;

  drawText(doc, "البصمة / التوقيع : ............................", PAGE_W - MARGIN_X, y, 10, "right");
  drawText(doc, "التاريخ :      /      /     202", PAGE_W / 2, y, 10, "center");
  
  y += 10;
  drawBox(doc, MARGIN_X, y, CONTENT_W, 15);
  drawText(doc, "اسم وتوقيع المثقفة المجتمعية المسئولة عن تعبئة البيانات", PAGE_W - MARGIN_X - 2, y + 4, 9, "right", true);
  drawText(doc, `اسم المثقفة : ${data.educatorName}`, PAGE_W - MARGIN_X - 2, y + 10, 10, "right");
  drawText(doc, "التوقيع : .....................", PAGE_W / 2, y + 10, 10, "center");
  
  y += 20;

  doc.setFillColor(COLOR_BLUE_HEADER);
  doc.rect(MARGIN_X, y, CONTENT_W, 7, "F");
  doc.setTextColor(255, 255, 255);
  drawText(doc, "خامساً : في حال عدم أخذ البصمة أو التوقيع يذكر السبب", PAGE_W - MARGIN_X - 2, y + 3.5, 10, "right", true);
  doc.setTextColor(0);
  y += 10;

  const reasons = [
    "1. انتقال دائم خارج المديرية", "2. سفر مؤقت", "3. الوفاة (لا سمح الله)",
    "4. عدم القبول بالمنافع", "5. عدم العثور على المرأة", "6. أخرى (تذكر) ....................."
  ];
  
  let rY = y;
  drawText(doc, reasons[0], PAGE_W - MARGIN_X, rY, 8, "right");
  drawText(doc, reasons[1], PAGE_W - 70, rY, 8, "right");
  drawText(doc, reasons[2], PAGE_W - 130, rY, 8, "right");
  rY += 6;
  drawText(doc, reasons[3], PAGE_W - MARGIN_X, rY, 8, "right");
  drawText(doc, reasons[4], PAGE_W - 70, rY, 8, "right");
  drawText(doc, reasons[5], PAGE_W - 130, rY, 8, "right");
  
  y = rY + 10;

  doc.setFillColor(COLOR_BLUE_HEADER);
  doc.rect(MARGIN_X, y, CONTENT_W, 7, "F");
  doc.setTextColor(255, 255, 255);
  drawText(doc, "سادساً : تصحيح البيانات", PAGE_W - MARGIN_X - 2, y + 3.5, 10, "right", true);
  doc.setTextColor(0);
  y += 10;

  drawText(doc, "يجب تصحيح اسم المرأة المستهدفة أو زوجها في حال كان هناك خطأ في الاسم الأول أو الأب أو الجد أو اللقب.", PAGE_W - MARGIN_X, y, 9, "right");
  y += 8;

  const corrH = 8;
  const labels = ["تصحيح الاسم الأول", "اسم الأب", "اسم الجد", "اللقب", "رقم التلفون", "مرجعية التصحيح"];
  
  labels.forEach((label, idx) => {
    const isLeft = idx % 2 !== 0;
    const currentX = isLeft ? MARGIN_X : MARGIN_X + (CONTENT_W/2);
    const currentY = y + (Math.floor(idx/2) * corrH);
    drawBox(doc, currentX, currentY, CONTENT_W/2, corrH);
    drawText(doc, label + ":", currentX + (CONTENT_W/2) - 2, currentY + (corrH/2), 9, "right");
    doc.setLineDashPattern([1, 1], 0);
    doc.line(currentX + 5, currentY + corrH - 2, currentX + (CONTENT_W/2) - 30, currentY + corrH - 2);
    doc.setLineDashPattern([], 0);
  });

  y += (Math.ceil(labels.length/2) * corrH) + 5;
  doc.setFontSize(8);
  doc.text("يحق للصندوق الاجتماعي للتنمية مشاركة البيانات مع الجهات ذات العلاقة لأغراض التحقق والتأكد من استلام المساعدات", PAGE_W / 2, PAGE_H - 10, { align: "center" });
}

// Main worker logic
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
            const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
            doc.addFileToVFS("Amiri-Regular.ttf", fontBase64);
            doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
            doc.addFont("Amiri-Regular.ttf", "Amiri", "bold");

            bnfs.forEach((bnf, index) => {
                if (index > 0) doc.addPage();
                
                const data: EnrollmentData = {
                  beneficiaryId: String(bnf.l_id || ''),
                  phone: String(bnf.l_phone_no || ''),
                  idNumber: String(bnf.l_id_card_no || ''),
                  idType: String(bnf.id_card_type || ''),
                  governorate: String(bnf.gov_name || ''),
                  district: String(bnf.mud_name || ''),
                  uzla: String(bnf.hh_ozla_name || ''),
                  village: String(bnf.hh_vill_name || ''),
                  fullName: String(bnf.l_benef_name || ''),
                  husbandName: String(bnf.l_hsbnd_name || ''),
                  maritalStatus: String(bnf.bnf_social_status || ''),
                  qualificationCriteria: String(bnf.bnf_qual_status_desc || ''),
                  childCountMale: Number(bnf.child_m_cnt) || 0,
                  childCountFemale: Number(bnf.child_f_cnt) || 0,
                  childNames: String(bnf.l_child_list || ''),
                  educatorName: educator
                };

                drawEnrollmentForm(doc, data);
            });

            const safeName = educator.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, "_").trim();
            zip.file(`${safeName}_Enrollment_Forms.pdf`, doc.output("arraybuffer"));
            
            educatorsProcessed++;
            postMessage({
                type: 'progress',
                status: `Generating PDF for ${safeName}...`,
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
