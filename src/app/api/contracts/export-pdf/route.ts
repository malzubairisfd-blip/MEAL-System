import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import dayjs from "dayjs";

export const runtime = "nodejs";

// Helper to convert Excel serial date to a readable string
function excelSerialToDate(serial: number) {
    if (typeof serial !== 'number' || isNaN(serial)) return serial;
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
    if (serial > 59) {
        date.setDate(date.getDate() - 1);
    }
    return dayjs(date).format('YYYY-MM-DD');
}

// Arabic number conversion
function arabicNumber(num: number | string) {
  if (num === null || num === undefined) return '';
  return String(num).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

// HTML generator with dynamic base URL for fonts
function generateHTML(educator: any, project: any, funder: string, baseUrl: string) {
  const issueDate = excelSerialToDate(educator.id_issue_date);
  const startDate = educator.contract_starting_date ? dayjs(educator.contract_starting_date).format('YYYY-MM-DD') : '........';
  const endDate = educator.contract_end_date ? dayjs(educator.contract_end_date).format('YYYY-MM-DD') : '........';
  const today = dayjs().format('YYYY-MM-DD');
  const dayOfWeek = dayjs().format('dddd');

  // Dynamically constructed font paths!
  const fontPathRegular = `${baseUrl}/fonts/NotoNaskhArabic-Regular.ttf`;
  const fontPathBold = `${baseUrl}/fonts/NotoNaskhArabic-Bold.ttf`;

  return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <style>
      @font-face {
        font-family: 'Noto Naskh Arabic';
        font-style: normal;
        font-weight: 400;
        src: url('${fontPathRegular}') format('truetype');
      }
      @font-face {
        font-family: 'Noto Naskh Arabic';
        font-style: normal;
        font-weight: 700;
        src: url('${fontPathBold}') format('truetype');
      }

      body {
        font-family: 'Noto Naskh Arabic', serif;
        direction: rtl;
        line-height: 1.9;
        margin: 0;
      }

      @page { size: A4; margin: 0; }

      .page {
        width: 210mm;
        height: 297mm;
        padding: 12mm;
        box-sizing: border-box;
        page-break-after: always;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .border {
        border: 0.6mm solid #000;
        height: 100%;
        padding: 10mm 8mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .header { display: flex; justify-content: space-between; align-items: flex-start; }
      .header-right { font-size: 11px; line-height: 1.6; }

      .logo { display: flex; flex-direction: column; align-items: center; }
      .logo svg { width: 12mm; height: 35mm; }
      .logo-text { font-size: 7px; margin-top: 2mm; }

      .title { text-align: center; font-size: 15px; font-weight: bold; margin: 10mm 0 6mm 0; }
      .section { font-size: 12px; text-align: justify; line-height: 2; margin-bottom: 3mm; }
      .bold { font-weight: bold; margin-top: 3mm; }

      .footer { text-align: center; margin-top: 6mm; font-size: 12px; }

      .bottom {
        position: absolute;
        bottom: 12mm;
        left: 12mm;
        right: 12mm;
        border-top: 0.3mm solid #999;
        padding-top: 2mm;
        display: flex;
        justify-content: space-between;
        font-size: 10px;
      }

      .page-number::after {
        content: "1/1";
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="border">
        <div>
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

          <div class="title">(عقد عمل مؤقت) نقد مقابل العمل في الخدمات الاجتماعية في التغذية</div>

          <div class="section">
            إنه في يوم ${dayOfWeek || "........"} الموافق ${today || "........"} بمدينة صنعاء تم بين كل من:
          </div>

          <div class="section">
            ١- الصندوق الاجتماعي للتنمية – فرع صنعاء (هاتف: ٥١٣٨٢١، فاكس: ٥١٣٨٠٣، الرقم المجاني للشكاوى والبلاغات ٨٠٠٩٨٠٠)، ويمثله: م. محمد حسن غمضان بصفته مدير الفرع ويسمى بهذا العقد الصندوق أو الطرف الأول.
          </div>

          <div class="section">
            ٢- الأخت/ ${educator.applicant_name} تحمل بطاقة شخصية رقم ${educator.id_no} صادرة من ${educator.id_issue_location} بتاريخ ${issueDate} ويسمى لأغراض هذا العقد الطرف الثاني.
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
            اتفق الطرفان على أن تكون مدة هذا العقد ${arabicNumber(educator.contract_duration_months)} أشهر تبدأ من تاريخ ${startDate} وتنتهي في ${endDate}.
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
        </div>
        
        <div>
          <div class="footer">التوقيع</div>
          <div class="bottom">
              <div class="page-number"></div>
              <div>عقد عمل مؤقت مثقفة مجتمعية – ${project.projectName}</div>
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

// POST route to generate PDF
export async function POST(req: Request) {
  try {
    // 1. EXTRACT DYNAMIC URL FROM HEADERS
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto")?.split(',')[0] || (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${protocol}://${host}`;

    const { educator, project, funder } = await req.json();

    // 2. PASS BASE URL TO HTML GENERATOR
    const htmlContent = generateHTML(educator, project, funder, baseUrl);

    // 3. LAUNCH SERVERLESS PUPPETEER
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Set content and wait for network (forces font downloading before PDF snapshot)
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      printBackground: true
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="contract_${educator.applicant_name}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF Generation Error:", err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}