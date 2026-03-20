// src/workers/exporting-contracts.worker.ts
import jsPDF from "jspdf";
import dayjs from "dayjs";

function arabicNumber(num: number | string) {
  if (num === null || num === undefined) return '';
  return String(num).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

function excelSerialToDate(serial: number): Date {
  if (serial > 60) {
    serial -= 1; // Adjust for Excel's leap year bug in 1900
  }
  return new Date(1899, 11, 30 + serial);
}

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
  id_type: string;
  id_no: string;
  id_issue_location: string;
  id_issue_date: string;
  working_village: string;
  mud_name: string;
}

interface Project {
    projectId: string;
    projectName: string;
}

const MARGIN_X = 10;

function drawSFDLogo(doc: jsPDF) {
  const logoX = 15;
  const logoY = 8;
  const scale = 1.2; // Enlarged logo
  const rectW = 6 * scale;
  const rectH = 15 * scale;
  
  doc.setFillColor(40, 60, 80); // SFD Blue
  doc.rect(logoX, logoY, rectW, rectH, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9 * scale);
  doc.setFont("helvetica", "bold");
  doc.text("S", logoX + (3 * scale), logoY + (4 * scale), { align: "center", baseline: "middle" });
  doc.text("F", logoX + (3 * scale), logoY + (8 * scale), { align: "center", baseline: "middle" });
  doc.text("D", logoX + (3 * scale), logoY + (12 * scale), { align: "center", baseline: "middle" });
  
  doc.setFont("NotoNaskhArabic", "normal");
  doc.setTextColor(40, 60, 80);
  doc.setFontSize(10 * scale);
  const arabicTextX = x + rectW + 1;
  doc.text("الصندوق", arabicTextX, y + (4 * scale));
  doc.text("الاجتماعي", arabicTextX, y + (9 * scale));
  doc.text("للتنمية", arabicTextX, y + (14 * scale));
  
  doc.setFontSize(6 * scale);
  doc.setFont("helvetica", "normal");
  doc.text("Social Fund for Development", logoX, y + rectH + (3 * scale));
}

function drawPageBorder(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setLineWidth(0.5);
  doc.setDrawColor(0,0,0);
  doc.rect(5, 5, w - 10, h - 10);
}

function drawText(doc: jsPDF, text: string, x: number, y: number, size: number, align: "right" | "center" | "left" = "right", isBold = false) {
  const fixedText = text; // Arabic shaping will be handled by the font
  doc.setFont("NotoNaskhArabic", isBold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
  doc.text(fixedText, x, y, { align, baseline: 'middle', lang: 'ar' });
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
    drawLogo(doc, 10, 8, 8);
    drawPageBorder(doc);
    const pageWidth = doc.internal.pageSize.getWidth();
    const right = pageWidth - MARGIN_X;
    const CONTENT_W = pageWidth - MARGIN_X * 2;
    
    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(9);
    doc.text("الجمهورية اليمنية", right, 8, { align: "right" });
    doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" });
    doc.text("فرع الامانه - صنعاء - مارب - الجوف - المحويت", right, 18, { align: "right" });
    drawText(doc, `رقم المشروع: ${arabicNumber(project.projectId)}`, right, 23, 9, 'right', true);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, 28, pageWidth - MARGIN_X, 28);


    // Title
    let y = 40;
    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(16);
    doc.setLineHeightFactor(1.5);
    const title = "عـقـد عمل مؤقت (نقد مقابل العمل في الخدمات الاجتماعية في التغذية)";
    drawText(doc, title, pageWidth / 2, y, 16, 'center', true);
    
    // Body
    y += 20;
    doc.setFontSize(11);
    doc.setFont("NotoNaskhArabic", "normal");
    
    const startDateFormatted = dayjs(educator.contract_starting_date).format('YYYY/MM/DD');
    const contractDay = getArabicDay(educator.contract_starting_date);
    const endDateFormatted = dayjs(educator.contract_end_date).format('YYYY/MM/DD');
    const issueDate = typeof educator.id_issue_date === 'number' ? excelSerialToDate(educator.id_issue_date) : new Date(educator.id_issue_date);
    const issueDateFormatted = dayjs(issueDate).format('YYYY/MM/DD');

    const introText = `أنه في يوم ${contractDay} الموافق ${arabicNumber(startDateFormatted)} بمدينة صنعاء تم بين كلٍ من:`;
    drawText(doc, introText, right, y, 11, "right");
    y += 8;
    
    const party1Text = `1) الصندوق الاجتماعي للتنمية – فرع صنعاء (هاتف: ${arabicNumber('513821')} ، فاكس ${arabicNumber('513803')})  الرقم المجاني للشكاوى والبلاغات (${arabicNumber('8009800')})، ويمثله: م. محمد حسن غمضان بصفته مدير الفرع ويسمى بهذا العقد الصندوق أوـ (الطرف الأول ) أو الصندوق.`;
    const p1Lines = doc.splitTextToSize(party1Text, CONTENT_W);
    drawText(doc, p1Lines, right, y, 11, "right");
    y += p1Lines.length * 5 + 5;

    const party2Text = `2) الأخت/ ${educator.applicant_name} تحمل ${educator.id_type} رقم ${educator.id_no} صادرة من ${educator.id_issue_location} بتاريخ ${issueDateFormatted} ويسمى لأغراض هذا العقد بـ (الطرف الثاني)`;
    const p2Lines = doc.splitTextToSize(party2Text, CONTENT_W);
    drawText(doc, p2Lines, right, y, 11, "right");
    y += p2Lines.length * 5 + 5;


    const drawClause = (title: string, text: string) => {
        const titleLines = doc.splitTextToSize(title, CONTENT_W);
        drawText(doc, titleLines, right, y, 12, 'right', true);
        y += titleLines.length * 5 + 2;

        const textLines = doc.splitTextToSize(text, CONTENT_W);
        drawText(doc, textLines, right, y, 11, 'right');
        y += textLines.length * 5 + 5;
    }
    
    drawClause("البند الأول: موضوع العقـد", `في إطار الصندوق الاجتماعي للتنمية – فرع الأمانة، صنعاء، مارب، الجوف، المحويت -برنامج التحويلات النقدية المشروطة في التغذية وافق الطرف الثاني على العمل لدى الطرف الأول كمثقفة مجتمعية في القرى ${educator.working_village} في مديرية ${educator.mud_name} الممول من ${funder}`);

    drawClause("البند الثاني: وصف العمل", `يتعهد الطرف الثاني بالقيام بمهامه ومسئولياته وفق ما هو محددٌ ومسندٌ له من الطرف الأول، بحسب وصف العمل المرفق بهذا العقد، والذي يعتبر جزء لايتجزأ منه، وأن يكون أداء الطرف الثاني بأقصى إنتاجيه وكفاءة ممكنة وبكل أمانة وإخلاص  تجاه الطرف الأول وعمله ومصالحه، وكما هو مبينٌ تفصيلاً في البند السابع (7) من هذا العقد.`);

    drawClause("البند الثالث: مدة العقـد", `اتفق الطرفان على أن تكون مدة هذا العقد ${arabicNumber(educator.contract_duration_months)} أشهر تبدأ من تاريخ ${arabicNumber(startDateFormatted)} وتنتهي في ${arabicNumber(endDateFormatted)}، إن لم يتم الإشعار كتابيا عن إنهاء العقد من قبل أي من الطرفين، قبل انقضاء مدته ، أو لم يُنص تحديداً على تعديل أو حذف أو إضافة أي بند من بنوده. و يحق لأحد الطرفين اخطار الطرف الاخر بشكل كتابي بإنهاء العقد.`);
    
    drawClause("البند الرابع: الأجر الشهري: اتفق الطرفان على ما يلي", `يتقاضى الطرف الثاني في نهاية كل شهر ميلادي إبتداءً من تاريخ مباشرته للعمل، و بالمقدار المحدد في العقد وفقاً لأيام العمل المنجزة والمهام المنجزة خلال الشهر والموافق عليها من قبل الطرف الأول. و وفق أحكام هذا العقد أجراً شهرياً  صافيا ، مبلغ وقدره ( ${arabicNumber(100)} دولار ) ، مائة دولار موضحة على النحو التالي :\n${arabicNumber(80)} دولار أجور الخدمات والمهام المنجزة خلال الشهر \n${arabicNumber(20)} دولار  أجور انتقال ومواصلات واتصالات وانترنت`);

    drawClause("البند الخامس : أيام وساعات العمل", `اتفق الطرفان بأن أيام العمل الرسمية هي خمس أيام عمل (من الأحد إلى الخميس ) ،أو (من السبت إلى الأربعاء)  يعقبهما يومي راحة مدفوعي الأجر، وأن  ساعات العمل اليومية هي (${arabicNumber(6)}) ساعات ، ما يساوي(${arabicNumber(30)}) ساعة عمل أسبوعياً ، باستثناء شهر رمضان والتي ستُحدد فيه ساعات العمل حسب تعليمات وتوجيهات الطرف الأول. ويمكن للمثقفة تنفيذ الأنشطة دون التقيد بالأيام الرسمية للعمل باعتبارها أنشطة مجتمعية`);

    // --- Footer ---
    const footerY = doc.internal.pageSize.getHeight() - 20;
    
    drawText(doc, "التوقيع", pageWidth / 2, footerY - 5, 12, 'center', true);

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, footerY, pageWidth - MARGIN_X, footerY);
    
    const boxY = footerY + 2;
    doc.rect(MARGIN_X, boxY, CONTENT_W, 10);
    
    doc.setTextColor(0,0,0);
    doc.setFontSize(9);
    drawText(doc, `عقد عمل مؤقت مثقفة مجتمعية – ${project?.projectName || ''}`, pageWidth - 15, boxY + 6, 9, 'right');
    doc.text(`1/1`, 15, boxY + 6, { align: 'left'});

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
