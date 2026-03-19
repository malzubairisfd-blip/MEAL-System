// src/workers/exporting-contracts.worker.ts
import jsPDF from "jspdf";
import dayjs from "dayjs";

// --- START OF ARABIC FIXER UTILITY ---
// This utility is placed directly in the worker to handle Arabic text shaping and RTL rendering.

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
const NON_CONN = ['ا','أ','إ','آ','د','ذ','ر','ز','و','ؤ','ء', 'ة', 'ى'];

function fixArabic(text: string): string {
  if (!text) return "";
  let shaped = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (!ARABIC_CHARS[c]) { shaped += c; continue; }
    const prev = chars[i-1];
    const next = chars[i+1];
    const canConnectPrev = prev && ARABIC_CHARS[prev] && !NON_CONN.includes(prev);
    const canConnectNext = next && ARABIC_CHARS[next];
    
    let idx = 0; // Isolated
    if (canConnectPrev && canConnectNext) idx = 2; // Medial
    else if (canConnectPrev) idx = 1; // Final
    else if (canConnectNext) idx = 3; // Initial

    shaped += ARABIC_CHARS[c][idx];
  }
  return shaped.split("").reverse().join("");
}

function arabicNumber(num: number | string) {
  return String(num).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

// --- END OF ARABIC FIXER UTILITY ---


// --- Types & Interfaces ---
interface Educator {
  applicant_id: number;
  ed_id: string;
  applicant_name: string;
  contract_type: string;
  contract_starting_date: string;
  contract_end_date: string;
  contract_duration_months: number;
  project_id: string;
  id_card_type: string;
  id_no: string;
  id_issue_loc: string;
  id_issue_date: string;
  working_village: string;
  mud_name: string;
}

interface Project {
    projectId: string;
    projectName: string;
}

// --- CONSTANTS & CONFIGURATION ---
const CARD_WIDTH = 210;
const CARD_HEIGHT = 297;
const MARGIN_X = 10;

// --- HELPER FUNCTIONS ---
function drawText(doc: jsPDF, text: string, x: number, y: number, size: number, align: "right" | "center" | "left" = "right", isBold = false) {
  doc.setFont("NotoNaskhArabic", isBold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
  doc.text(fixArabic(String(text || "")), x, y, { align, baseline: "middle" });
}

function drawSFDLogo(doc: jsPDF) {
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
    
    doc.setFont("NotoNaskhArabic", "normal");
    doc.setTextColor(40, 60, 80);
    doc.setFontSize(10);
    doc.text(fixArabic("الصندوق"), logoX + 8, logoY + 4);
    doc.text(fixArabic("الاجتماعي"), logoX + 8, logoY + 9);
    doc.text(fixArabic("للتنمية"), logoX + 8, logoY + 14);
    
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text("Social Fund for Development", logoX, logoY + 17);
}

const getArabicDay = (dateString: string) => {
    if (!dateString) return '';
    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayIndex = dayjs(dateString).day();
    return arabicDays[dayIndex];
};


// --- MAIN PDF GENERATION LOGIC ---
const generateContractPdf = (doc: jsPDF, educator: Educator, project: Project, funder: string): ArrayBuffer => {
    
    // Header
    drawSFDLogo(doc);
    const pageWidth = doc.internal.pageSize.getWidth();
    const right = pageWidth - 10;
    const CONTENT_W = pageWidth - MARGIN_X * 2;
    
    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(9);
    doc.text(fixArabic("الجمهورية اليمنية"), right, 8, { align: "right" });
    doc.text(fixArabic("الصندوق الاجتماعي للتنمية"), right, 13, { align: "right" });
    doc.text(fixArabic("فرع الامانه - صنعاء - مارب - الجوف - المحويت"), right, 18, { align: "right" });
    drawText(doc, `رقم المشروع: ${project.projectId}`, right, 23, 9, 'right', true);
    doc.setLineWidth(0.5);
    doc.line(10, 28, pageWidth - 10, 28);


    // Title
    let y = 40;
    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(16);
    doc.setLineHeightFactor(1.5);
    const title = "عـقـد عمل مؤقت (نقد مقابل العمل في الخدمات الاجتماعية في التغذية)";
    doc.text(fixArabic(title), pageWidth / 2, y, { align: 'center'});
    
    // Body
    y += 20;
    doc.setFontSize(11);
    doc.setFont("NotoNaskhArabic", "normal");

    const contractDay = getArabicDay(educator.contract_starting_date);
    const startDateFormatted = dayjs(educator.contract_starting_date).format('YYYY/MM/DD');
    const endDateFormatted = dayjs(educator.contract_end_date).format('YYYY/MM/DD');
    const issueDateFormatted = dayjs(educator.id_issue_date).format('YYYY/MM/DD');

    const introText = `أنه في يوم ${contractDay} الموافق ${arabicNumber(startDateFormatted)} بمدينة صنعاء تم بين كلٍ من:`;
    drawText(doc, introText, right, y, 11, "right");
    y += 8;
    
    const party1Text = `1) الصندوق الاجتماعي للتنمية – فرع صنعاء (هاتف: ${arabicNumber('513821')} ، فاكس ${arabicNumber('513803')}) الرقم المجاني للشكاوى والبلاغات (${arabicNumber('8009800')})، ويمثله: م. محمد حسن غمضان بصفته مدير الفرع ويسمى بهذا العقد الصندوق أوـ (الطرف الأول ) أو الصندوق.`;
    const p1Lines = doc.splitTextToSize(fixArabic(party1Text), CONTENT_W - 10);
    doc.text(p1Lines, right, y, { align: 'right' });
    y += p1Lines.length * 5;

    const party2Text = `2) الأخت/ ${educator.applicant_name} تحمل ${educator.id_card_type} رقم ${educator.id_no} صادرة من ${educator.id_issue_loc} بتاريخ ${issueDateFormatted} ويسمى لأغراض هذا العقد بـ (الطرف الثاني)`;
    const p2Lines = doc.splitTextToSize(fixArabic(party2Text), CONTENT_W - 10);
    doc.text(p2Lines, right, y, { align: 'right' });
    y += p2Lines.length * 5 + 5;


    const drawClause = (title: string, text: string) => {
        drawText(doc, title, right, y, 12, 'right', true);
        y+= 7;
        const lines = doc.splitTextToSize(fixArabic(text), CONTENT_W - 5);
        doc.text(lines, right, y, { align: 'right' });
        y += lines.length * 5 + 5;
    }
    
    drawClause("البند الأول: موضوع العقـد", `في إطار الصندوق الاجتماعي للتنمية – فرع الأمانة، صنعاء، مارب، الجوف، المحويت -برنامج التحويلات النقدية المشروطة في التغذية وافق الطرف الثاني على العمل لدى الطرف الأول كمثقفة مجتمعية في القرى ${educator.working_village} في مديرية ${educator.mud_name} الممول من منحة ${funder}`);

    drawClause("البند الثاني: وصف العمل", `يتعهد الطرف الثاني بالقيام بمهامه ومسئولياته وفق ما هو محددٌ ومسندٌ له من الطرف الأول، بحسب وصف العمل المرفق بهذا العقد، والذي يعتبر جزء لايتجزأ منه، وأن يكون أداء الطرف الثاني بأقصى إنتاجيه وكفاءة ممكنة وبكل أمانة وإخلاص تجاه الطرف الأول وعمله ومصالحه، وكما هو مبينٌ تفصيلاً في البند السابع (7) من هذا العقد.`);

    drawClause("البند الثالث: مدة العقـد", `اتفق الطرفان على أن تكون مدة هذا العقد ${arabicNumber(educator.contract_duration_months)} أشهر تبدأ من تاريخ ${arabicNumber(startDateFormatted)} وتنتهي في ${arabicNumber(endDateFormatted)}، إن لم يتم الإشعار كتابيا عن إنهاء العقد من قبل أي من الطرفين، قبل انقضاء مدته ، أو لم يُنص تحديداً على تعديل أو حذف أو إضافة أي بند من بنوده. و يحق لأحد الطرفين اخطار الطرف الاخر بشكل كتابي بإنهاء العقد.`);
    
    drawClause("البند الرابع: الأجر الشهري: اتفق الطرفان على ما يلي:", `يتقاضى الطرف الثاني في نهاية كل شهر ميلادي إبتداءً من تاريخ مباشرته للعمل، و بالمقدار المحدد في العقد وفقاً لأيام العمل المنجزة والمهام المنجزة خلال الشهر والموافق عليها من قبل الطرف الأول. و وفق أحكام هذا العقد أجراً شهرياً صافيا ، مبلغ وقدره ( ${arabicNumber(100)} دولار ) ، مائة دولار موضحة على النحو التالي :\n1. ${arabicNumber(80)} دولار أجور الخدمات والمهام المنجزة خلال الشهر\n2. ${arabicNumber(20)} دولار أجور انتقال ومواصلات واتصالات وانترنت`);

    drawClause("البند الخامس : أيام وساعات العمل", `اتفق الطرفان بأن أيام العمل الرسمية هي خمس أيام عمل (من الأحد إلى الخميس ) ،أو (من السبت إلى الأربعاء) يعقبهما يومي راحة مدفوعي الأجر، وأن ساعات العمل اليومية هي (6) ساعات ، ما يساوي(30) ساعة عمل أسبوعياً ، باستثناء شهر رمضان والتي ستُحدد فيه ساعات العمل حسب تعليمات وتوجيهات الطرف الأول. ويمكن للمثقفة تنفيذ الأنشطة دون التقيد بالأيام الرسمية للعمل باعتبارها أنشطة مجتمعية`);

    // --- Footer ---
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.5);
    drawText(doc, "التوقيع", pageWidth / 2, footerY, 12, 'center');
    doc.line(10, footerY + 2, pageWidth - 10, footerY + 2);

    const footerBoxY = footerY + 5;
    doc.rect(10, footerBoxY, pageWidth - 20, 10);
    doc.setTextColor(0,0,0);
    doc.setFontSize(9);
    drawText(doc, `عقد عمل مؤقت مثقفة مجتمعية – ${project?.projectName || ''}`, pageWidth - 15, footerBoxY + 6, 9, 'right');
    doc.text(`1/1`, 15, footerBoxY + 6, { align: 'left'});

    return doc.output('arraybuffer');
};


self.onmessage = async (event: MessageEvent) => {
    const { educator, project, funder, fontCache } = event.data;
    try {
        if (!educator || !project || !funder || !fontCache) {
            throw new Error("Missing data for contract generation.");
        }
        
        const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontCache.regular);
        doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontCache.bold);
        doc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
        doc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");
        
        const pdfBuffer = generateContractPdf(doc, educator, project, funder);

        self.postMessage({ type: 'done', pdfBuffer }, [pdfBuffer]);

    } catch (e: any) {
        self.postMessage({ type: 'error', error: e.message });
    }
};
