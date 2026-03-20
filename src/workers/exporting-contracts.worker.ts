// src/workers/exporting-contracts.worker.ts
import jsPDF from "jspdf";
import dayjs from "dayjs";

function arabicNumber(num: number | string) {
  return String(num).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
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

// Colors
const COLORS = {
  primaryBrown: "#6F3B35", // The dark maroon/brown
    primaryGold: "#C8AA68",  // The tan/gold accent
      textBlack: "#000000",
        textWhite: "#FFFFFF",
          photoPlaceholder: "#F0F0F0",
            borderGold: "#8B6F3E",   // Darker gold for borders
            };

// Layout constants
const MARGIN = 4;

// --- HELPER FUNCTIONS ---

/**
 * Draws a dotted line for form fields
  */
  const drawDottedLine = (doc: jsPDF, x1: number, y1: number, x2: number) => {
    doc.setDrawColor(0);
      doc.setLineWidth(0.5);
        doc.setLineDashPattern([1, 1], 0); // Dotted pattern
          doc.line(x1, y1, x2, y1);
            doc.setLineDashPattern([], 0); // Reset to solid
            };

            /**
             *  * Draw SFD logo placeholder (replace with actual logo image if available)
              */
              const drawLogo = (doc: jsPDF, x: number, y: number, size: number) => {
                  // The provided code is for a larger format, so we scale it down to fit the ID card.
                      // The 'size' parameter is not used as the logo has a fixed aspect ratio.
                          const scale = 0.5; // Scale down by 50% to fit
                              const rectW = 6 * scale;
                                  const rectH = 15 * scale;
                                      
                                          doc.setFillColor(40, 60, 80); // SFD Blue
                                              doc.rect(x, y, rectW, rectH, "F");
                                                  
                                                      doc.setTextColor(255, 255, 255);
                                                          doc.setFontSize(9 * scale);
                                                              doc.setFont("helvetica", "bold");
                                                                  doc.text("S", x + (3 * scale), y + (4 * scale), { align: "center", baseline: "middle" });
                                                                      doc.text("F", x + (3 * scale), y + (8 * scale), { align: "center", baseline: "middle" });
                                                                          doc.text("D", x + (3 * scale), y + (12 * scale), { align: "center", baseline: "middle" });
                                                                              
                                                                                  doc.setFont("NotoNaskhArabic", "normal");
                                                                                      doc.setTextColor(40, 60, 80);
                                                                                          doc.setFontSize(10 * scale);
                                                                                              const arabicTextX = x + rectW + 1;
                                                                                                  doc.text("الصندوق", arabicTextX, y + (4 * scale));
                                                                                                      doc.text("الاجتماعي", arabicTextX, y + (9 * scale));
                                                                                                          doc.text("للتنمية", arabicTextX, y + (14 * scale));
                                                                                                              
                                                                                                                  doc.setFontSize(6 * scale);
                                                                                                                      doc.setFont("helvetica", "normal");
                                                                                                                          doc.text("Social Fund for Development", x, y + rectH + (3 * scale));
                                                                                                                            }

function drawText(doc: jsPDF, text: string, x: number, y: number, size: number, align: "right" | "center" | "left" = "right", isBold = false) {
  doc.setFont("NotoNaskhArabic", isBold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
  doc.text(String(text || ""), x, y, { align, baseline: "middle" });
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const right = pageWidth - 10;
    const CONTENT_W = pageWidth - MARGIN_X * 2;
    
    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(9);
    doc.text("الجمهورية اليمنية", right, 8, { align: "right" });
    doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" });
    doc.text("فرع الامانه - صنعاء - مارب - الجوف - المحويت", right, 18, { align: "right" });
    drawText(doc, `رقم المشروع: ${project.projectId}`, right, 23, 9, 'right', true);
    doc.setLineWidth(0.5);
    doc.line(10, 28, pageWidth - 10, 28);


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

    const contractDay = getArabicDay(educator.contract_starting_date);
    const startDateFormatted = dayjs(educator.contract_starting_date).format('YYYY/MM/DD');
    const endDateFormatted = dayjs(educator.contract_end_date).format('YYYY/MM/DD');
    const issueDateFormatted = dayjs(educator.id_issue_date).format('YYYY/MM/DD');

    const introText = `أنه في يوم ${contractDay} الموافق ${arabicNumber(startDateFormatted)} بمدينة صنعاء تم بين كلٍ من:`;
    drawText(doc, introText, right, y, 11, "right");
    y += 8;
    
    const party1Text = `1) الصندوق الاجتماعي للتنمية – فرع صنعاء (هاتف: ${arabicNumber('513821')} ، فاكس ${arabicNumber('513803')}) الرقم المجاني للشكاوى والبلاغات (${arabicNumber('8009800')})، ويمثله: م. محمد حسن غمضان بصفته مدير الفرع ويسمى بهذا العقد الصندوق أوـ (الطرف الأول ) أو الصندوق.`;
    const p1Lines = doc.splitTextToSize(party1Text, CONTENT_W - 10);
    drawText(doc, p1Lines.join('\n'), right, y, 11, "right");
    y += p1Lines.length * 5 + 5;

    const party2Text = `2) الأخت/ ${educator.applicant_name} تحمل ${educator.id_card_type} رقم ${educator.id_no} صادرة من ${educator.id_issue_loc} بتاريخ ${issueDateFormatted} ويسمى لأغراض هذا العقد بـ (الطرف الثاني)`;
    const p2Lines = doc.splitTextToSize(party2Text, CONTENT_W - 10);
    drawText(doc, p2Lines.join('\n'), right, y, 11, "right");
    y += p2Lines.length * 5 + 5;


    const drawClause = (title: string, text: string) => {
        drawText(doc, title, right, y, 12, 'right', true);
        y+= 7;
        const lines = doc.splitTextToSize(text, CONTENT_W - 5);
        drawText(doc, lines.join('\n'), right, y, 11, 'right');
        y += lines.length * 5 + 5;
    }
    
    drawClause("البند الأول: موضوع العقـد", `في إطار الصندوق الاجتماعي للتنمية – فرع الأمانة، صنعاء، مارب، الجوف، المحويت -برنامج التحويلات النقدية المشروطة في التغذية وافق الطرف الثاني على العمل لدى الطرف الأول كمثقفة مجتمعية في القرى ${educator.working_village} في مديرية ${educator.mud_name} الممول من منحة ${funder}`);

    drawClause("البند الثاني: وصف العمل", `يتعهد الطرف الثاني بالقيام بمهامه ومسئولياته وفق ما هو محددٌ ومسندٌ له من الطرف الأول، بحسب وصف العمل المرفق بهذا العقد، والذي يعتبر جزء لايتجزأ منه، وأن يكون أداء الطرف الثاني بأقصى إنتاجيه وكفاءة ممكنة وبكل أمانة وإخلاص تجاه الطرف الأول وعمله ومصالحه، وكما هو مبينٌ تفصيلاً في البند السابع (7) من هذا العقد.`);

    drawClause("البند الثالث: مدة العقـد", `اتفق الطرفان على أن تكون مدة هذا العقد ${arabicNumber(educator.contract_duration_months)} أشهر تبدأ من تاريخ ${arabicNumber(startDateFormatted)} وتنتهي في ${arabicNumber(endDateFormatted)}، إن لم يتم الإشعار كتابيا عن إنهاء العقد من قبل أي من الطرفين، قبل انقضاء مدته ، أو لم يُنص تحديداً على تعديل أو حذف أو إضافة أي بند من بنوده. و يحق لأحد الطرفين اخطار الطرف الاخر بشكل كتابي بإنهاء العقد.`);
    
    drawClause("البند الرابع: الأجر الشهري: اتفق الطرفان على ما يلي:", `يتقاضى الطرف الثاني في نهاية كل شهر ميلادي إبتداءً من تاريخ مباشرته للعمل، و بالمقدار المحدد في العقد وفقاً لأيام العمل المنجزة والمهام المنجزة خلال الشهر والموافق عليها من قبل الطرف الأول. و وفق أحكام هذا العقد أجراً شهرياً صافيا ، مبلغ وقدره ( ${arabicNumber(100)} دولار ) ، مائة دولار موضحة على النحو التالي :\n1. ${arabicNumber(80)} دولار أجور الخدمات والمهام المنجزة خلال الشهر \n2. ${arabicNumber(20)} دولار أجور انتقال ومواصلات واتصالات وانترنت`);

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
