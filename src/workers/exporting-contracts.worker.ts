// src/workers/exporting-contracts.worker.ts
import jsPDF from "jspdf";
import dayjs from "dayjs";

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
  id_no: string; // Corrected from id_card_no
  id_issue_loc: string;
  id_issue_date: string;
  working_village: string;
  mud_name: string;
}

interface Project {
    projectId: string;
    projectName: string;
}

// --- Constants & Configuration ---
const CARD_WIDTH = 210;
const CARD_HEIGHT = 297;
const MARGIN_X = 10;

// --- Helper Functions ---
function drawText(doc: jsPDF, text: string, x: number, y: number, size: number, align: "right" | "center" | "left" = "right", isBold = false) {
  doc.setFont("NotoNaskhArabic", isBold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
  doc.text(String(text || ""), x, y, { align, baseline: "middle" });
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
    doc.text("الصندوق", logoX + 8, logoY + 4);
    doc.text("الاجتماعي", logoX + 8, logoY + 9);
    doc.text("للتنمية", logoX + 8, logoY + 14);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Social Fund for Development", logoX, logoY + 17);
}

const getArabicDay = (dateString: string) => {
    if (!dateString) return '';
    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayIndex = dayjs(dateString).day();
    return arabicDays[dayIndex];
};


// --- Main PDF Generation Logic ---
const generateContractPdf = (educator: Educator, project: Project, funder: string): ArrayBuffer => {
    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    
    // Header
    drawSFDLogo(doc);
    const pageWidth = doc.internal.pageSize.getWidth();
    const right = pageWidth - 10;
    const CONTENT_W = pageWidth - MARGIN_X * 2;
    
    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(9);
    doc.text("الجمهورية اليمنية", right, 8, { align: "right" });
    doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" });
    doc.text("فرع الامانه - صنعاء - مارب - الجوف - المحويت", right, 18, { align: "right" });
    doc.text(`رقم المشروع: ${project.projectId}`, right, 23, { align: 'right' });
    doc.setLineWidth(0.5);
    doc.line(10, 28, pageWidth - 10, 28);


    // Title
    let y = 40;
    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(16);
    doc.setLineHeightFactor(1.5);
    doc.text("عـقـد عمل مؤقت (نقد مقابل العمل في الخدمات الاجتماعية في التغذية)", pageWidth / 2, y, { align: 'center'});
    
    // Body
    y += 20;
    doc.setFontSize(11);
    doc.setFont("NotoNaskhArabic", "normal");

    const contractDay = getArabicDay(educator.contract_starting_date);
    const startDateFormatted = dayjs(educator.contract_starting_date).format('YYYY/MM/DD');
    const endDateFormatted = dayjs(educator.contract_end_date).format('YYYY/MM/DD');
    const issueDateFormatted = dayjs(educator.id_issue_date).format('YYYY/MM/DD');

    const introText = `أنه في يوم ${contractDay}  الموافق ${startDateFormatted}  بمدينة صنعاء تم بين كلٍ من:`;
    doc.text(introText, right, y, { align: 'right' });
    y += 8;
    
    const party1Text = `1)     الصندوق الاجتماعي للتنمية – فرع صنعاء (هاتف: 513821 ، فاكس513803 )  الرقم المجاني للشكاوى والبلاغات (8009800)، ويمثله: م. محمد حسن غمضان بصفته مدير الفرع ويسمى بهذا العقد الصندوق أوـ (الطرف الأول ) أو الصندوق.`;
    doc.text(party1Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
    y += 12;

    const party2Text = `2)     الأخت/ ${educator.applicant_name} تحمل ${educator.id_card_type} رقم ${educator.id_no} صادرة من ${educator.id_issue_loc} بتاريخ  ${issueDateFormatted} ويسمى لأغراض هذا العقد بـ (الطرف الثاني) `;
    doc.text(party2Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
    y += 12;

    const clause1Title = "البند الأول: موضوع العقـد";
    doc.setFont("NotoNaskhArabic", "bold");
    doc.text(clause1Title, right, y, { align: 'right' });
    y+= 6;
    doc.setFont("NotoNaskhArabic", "normal");
    const clause1Text = `في إطار الصندوق الاجتماعي للتنمية – فرع الأمانة، صنعاء، مارب، الجوف، المحويت  -برنامج التحويلات النقدية المشروطة في التغذية  وافق الطرف الثاني على العمل لدى الطرف الأول كمثقفة مجتمعية في القرى ${educator.working_village} في مديرية  ${educator.mud_name}  الممول من منحة ${funder}`;
    doc.text(clause1Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
    y += 12;

    const clause2Title = "البند الثاني: وصف العمل";
    doc.setFont("NotoNaskhArabic", "bold");
    doc.text(clause2Title, right, y, { align: 'right' });
    y+= 6;
    doc.setFont("NotoNaskhArabic", "normal");
    const clause2Text = `يتعهد الطرف الثاني بالقيام بمهامه ومسئولياته وفق ما هو محددٌ ومسندٌ له من الطرف الأول، بحسب وصف العمل المرفق بهذا العقد، والذي يعتبر جزء لايتجزأ منه، وأن يكون أداء الطرف الثاني بأقصى إنتاجيه وكفاءة ممكنة وبكل أمانة وإخلاص  تجاه الطرف الأول وعمله ومصالحه، وكما هو مبينٌ تفصيلاً في البند السابع (7) من هذا العقد.`;
    doc.text(clause2Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
    y += 20;

    const clause3Title = "البند الثالث: مدة العقـد";
    doc.setFont("NotoNaskhArabic", "bold");
    doc.text(clause3Title, right, y, { align: 'right' });
    y+= 6;
    doc.setFont("NotoNaskhArabic", "normal");
    const clause3Text = `اتفق الطرفان على أن تكون مدة هذا العقد ${educator.contract_duration_months} أشهر تبدأ من تاريخ ${startDateFormatted} وتنتهي في ${endDateFormatted}، إن لم يتم الإشعار كتابيا عن إنهاء العقد من قبل أي من الطرفين، قبل انقضاء مدته ، أو لم يُنص تحديداً على تعديل أو حذف أو إضافة أي بند من بنوده. و يحق لأحد الطرفين اخطار الطرف الاخر بشكل كتابي بإنهاء العقد.`;
    doc.text(clause3Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
    y += 20;
    
    const clause4Title = "البند الرابع: الأجر الشهري: اتفق الطرفان على ما يلي:";
    doc.setFont("NotoNaskhArabic", "bold");
    doc.text(clause4Title, right, y, { align: 'right' });
    y+= 6;
    doc.setFont("NotoNaskhArabic", "normal");
    const clause4Text = `يتقاضى الطرف الثاني في نهاية كل شهر ميلادي إبتداءً من تاريخ مباشرته للعمل، و بالمقدار المحدد في العقد وفقاً لأيام العمل المنجزة والمهام المنجزة خلال الشهر والموافق عليها من قبل الطرف الأول. و وفق أحكام هذا العقد أجراً شهرياً  صافيا ، مبلغ وقدره (   100دولار  ) ،  مائة دولار موضحة على النحو التالي :`;
    const clause4List = `1.      80 دولار أجور الخدمات والمهام المنجزة خلال الشهر \n2.      20 دولار  أجور انتقال ومواصلات واتصالات وانترنت`;
    doc.text(clause4Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });
    y += 12;
    doc.text(clause4List, right, y, { align: 'right' });
    y += 16;
    
    const clause5Title = "البند الخامس : أيام وساعات العمل";
    doc.setFont("NotoNaskhArabic", "bold");
    doc.text(clause5Title, right, y, { align: 'right' });
    y+= 6;
    doc.setFont("NotoNaskhArabic", "normal");
    const clause5Text = `اتفق الطرفان بأن أيام العمل الرسمية هي خمس أيام عمل (من الأحد إلى الخميس ) ،أو (من السبت إلى الأربعاء)  يعقبهما يومي راحة مدفوعي الأجر، وأن  ساعات العمل اليومية هي (6) ساعات ، ما يساوي(30) ساعة عمل أسبوعياً ، باستثناء شهر رمضان والتي ستُحدد فيه ساعات العمل حسب تعليمات وتوجيهات الطرف الأول. ويمكن للمثقفة تنفيذ الأنشطة دون التقيد بالأيام الرسمية للعمل باعتبارها أنشطة مجتمعية`;
    doc.text(clause5Text, right, y, { align: 'right', maxWidth: CONTENT_W - 10 });

    // --- Footer ---
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setTextColor(150, 150, 150);
    doc.text("التوقيع", pageWidth / 2, footerY, { align: 'center'});
    doc.setDrawColor(0,0,0);
    doc.setLineWidth(0.5);
    doc.line(10, footerY + 2, pageWidth - 10, footerY + 2);

    const footerBoxY = footerY + 5;
    doc.rect(10, footerBoxY, pageWidth - 20, 10);
    doc.setTextColor(0,0,0);
    doc.setFontSize(9);
    doc.text(`عقد عمل مؤقت مثقفة مجتمعية – ${project?.projectName || ''}`, pageWidth - 15, footerBoxY + 6, { align: 'right'});
    doc.text(`1/1`, 15, footerBoxY + 6, { align: 'left'});

    return doc.output('arraybuffer');
};


self.onmessage = (event: MessageEvent) => {
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
        
        const pdfBuffer = generateContractPdf(educator, project, funder);

        self.postMessage({ type: 'done', pdfBuffer }, [pdfBuffer]);

    } catch (e: any) {
        self.postMessage({ type: 'error', error: e.message });
    }
};
