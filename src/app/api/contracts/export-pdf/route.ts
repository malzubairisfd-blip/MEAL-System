// src/app/api/contracts/export-pdf/route.ts
import puppeteer from "puppeteer";
import dayjs from "dayjs";

// Helper to convert Excel serial date to a readable string
function excelSerialToDate(serial: number) {
    if (typeof serial !== 'number') return serial; // Return as is if not a number
    // Excel's epoch starts on 1899-12-30. JavaScript's is 1970-01-01.
    // Excel also incorrectly thinks 1900 was a leap year.
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
    if (serial > 59) {
        date.setDate(date.getDate() - 1);
    }
    return dayjs(date).format('YYYY-MM-DD');
}

export async function POST(req: Request) {
  try {
    const { educator, project, funder } = await req.json();

    const html = generateHTML(educator, project, funder);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0mm",
        bottom: "0mm",
        left: "0mm",
        right: "0mm"
      }
    });

    await browser.close();

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contract_${educator.applicant_name}.pdf"`,
      },
    });

  } catch (e: any) {
    console.error("PDF Generation Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

function arabicNumber(num: number | string) {
  if (num === undefined || num === null) return "";
  return String(num).replace(/\d/g, (d: string) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

function generateHTML(educator: any, project: any, funder: string) {
    const issueDate = excelSerialToDate(educator.id_issue_date);
    const startDate = dayjs(educator.contract_starting_date).format('YYYY-MM-DD');
    const endDate = dayjs(educator.contract_end_date).format('YYYY-MM-DD');
    const today = dayjs().format('YYYY-MM-DD');
    
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
/* Using a more common font and importing from Google Fonts for reliability */
@import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&display=swap');

body {
  font-family: 'Noto Naskh Arabic', serif;
  direction: rtl;
  line-height: 1.9;
  margin: 0;
  background-color: white;
  color: black;
}

@page {
  size: A4;
  margin: 0;
}

.page {
  width: 210mm;
  height: 297mm;
  padding: 5mm;
  box-sizing: border-box;
}

.border {
  border: 0.6mm solid #000;
  height: 100%;
  padding: 10mm 8mm;
  box-sizing: border-box;
  position: relative;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 5mm;
}

.header-right {
  font-size: 11px;
  line-height: 1.6;
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo svg {
  width: 15mm;
  height: auto;
}

.logo-text {
  font-size: 7px;
  margin-top: 2mm;
}

.title {
  text-align: center;
  font-size: 15px;
  font-weight: bold;
  margin: 10mm 0 6mm 0;
}

.section {
  font-size: 12px;
  text-align: justify;
  line-height: 2;
  margin-bottom: 3mm;
}

.bold {
  font-weight: bold;
  margin-top: 3mm;
}

.footer {
  text-align: center;
  margin-top: 12mm;
  font-size: 12px;
}

.bottom {
  position: absolute;
  bottom: 10mm;
  left: 8mm;
  right: 8mm;
  border-top: 0.3mm solid #999;
  padding-top: 2mm;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
}
</style>
</head>

<body>
<div class="page">
<div class="border">

<div class="header">
    <div class="header-right">
    الجمهورية اليمنية<br>
    الصندوق الاجتماعي للتنمية<br>
    فرع الأمانة - صنعاء - مارب - الجوف - المحويت<br>
    رقم المشروع: ${arabicNumber(project.projectId)}
    </div>

    <div class="logo">
        <svg viewBox="0 0 40 120">
          <rect x="0" y="0" width="40" height="120" fill="#2c3e50"/>
          <text x="20" y="30" fill="white" font-size="20" text-anchor="middle" font-weight="bold">S</text>
          <text x="20" y="65" fill="white" font-size="20" text-anchor="middle" font-weight="bold">F</text>
          <text x="20" y="100" fill="white" font-size="20" text-anchor="middle" font-weight="bold">D</text>
        </svg>
        <div class="logo-text">Social Fund for Development</div>
    </div>
</div>

<div class="title">
(عقد عمل مؤقت) نقد مقابل العمل في الخدمات الاجتماعية في التغذية
</div>

<div class="section">
إنه في يوم ${arabicNumber(dayjs(today).format('DD'))} الموافق ${today} بمدينة صنعاء تم بين كل من:
</div>

<div class="section">
١- الصندوق الاجتماعي للتنمية – فرع صنعاء (هاتف: ٥١٣٨٢١، فاكس: ٥١٣٨٠٣، الرقم المجاني للشكاوى والبلاغات ٨٠٠٩٨٠٠)، ويمثله: م. محمد حسن غمضان بصفته مدير الفرع ويسمى بهذا العقد الصندوق أو الطرف الأول.
</div>

<div class="section">
٢- الأخت/ ${educator.applicant_name} تحمل بطاقة شخصية رقم ${arabicNumber(educator.id_no)} صادرة من ${educator.id_issue_location} بتاريخ ${issueDate} ويسمى لأغراض هذا العقد الطرف الثاني.
</div>

<div class="section bold">البند الأول: موضوع العقد</div>
<div class="section">
في إطار الصندوق الاجتماعي للتنمية – فرع الأمانة – صنعاء، مارب، الجوف، المحويت برنامج التحويلات النقدية المشروطة في التغذية وافق الطرف الثاني على العمل لدى الطرف الأول كمثقفة مجتمعية في القرى ${educator.working_village} في مديرية ${educator.mud_name} الممول من ${funder}.
</div>

<div class="section bold">البند الثاني: وصف العمل</div>
<div class="section">
يتعهد الطرف الثاني بالقيام بمهامه ومسؤولياته وفق ما هو محدد ومسند له من الطرف الأول، بحسب وصف العمل المرفق بهذا العقد والذي يعتبر جزء لا يتجزأ منه، وأن يكون أداء الطرف الثاني بأقصى إنتاجية وكفاءة ممكنة وبكل أمانة وإخلاص تجاه الطرف الأول وعمله ومصالحه، وكما هو مبين تفصيلاً في البند السابع (7) من هذا العقد.
</div>

<div class="section bold">البند الثالث: مدة العقد</div>
<div class="section">
اتفق الطرفان على أن تكون مدة هذا العقد ${arabicNumber(educator.contract_duration_months)} أشهر تبدأ من تاريخ ${startDate} وتنتهي في ${endDate}، إن لم يتم الإشعار كتابياً عن إنهاء العقد من قبل أي من الطرفين قبل انقضاء مدته.
</div>

<div class="section bold">البند الرابع: الأجر الشهري</div>
<div class="section">
يتقاضى الطرف الثاني في نهاية كل شهر ميلادي أجراً صافياً مبلغ وقدره (١٠٠ دولار) مائة دولار موضحة على النحو التالي:<br>
١- ٨٠ دولار أجور الخدمات والمهام المنجزة خلال الشهر<br>
٢- ٢٠ دولار أجور انتقال ومواصلات واتصالات وإنترنت
</div>

<div class="section bold">البند الخامس: أيام وساعات العمل</div>
<div class="section">
اتفق الطرفان بأن أيام العمل الرسمية هي خمسة أيام عمل (من الأحد إلى الخميس) أو (من السبت إلى الأربعاء) يعقبها يومي راحة مدفوعي الأجر، وأن ساعات العمل اليومية هي (٦) ساعات أي ما يعادل (٣٠) ساعة أسبوعياً، باستثناء شهر رمضان حيث تحدد ساعات العمل حسب تعليمات الطرف الأول.
</div>

<div class="footer">التوقيع</div>

<div class="bottom">
    <div>1/1</div>
    <div>عقد عمل مؤقت مثقفة مجتمعية – ${project.projectName}</div>
</div>

</div>
</div>
</body>
</html>
`;
}
