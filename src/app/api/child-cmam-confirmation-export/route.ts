// src/app/api/child-cmam-confirmation-export/route.ts
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs/promises';
import Database from 'better-sqlite3';

interface EducatorGroupInfo {
  location: string;
  educatorCode: string;
  educatorName: string;
  educatorPhone: string;
  hwname: string;
  hwid: string;
  hcname: string;
  hcid: string;
}

const ROWS_PER_PAGE = 8;

function buildLocation(r: any) {
  return [r.GOV_NAME, r.MUD_NAME, r.OZLA_NAME].filter(Boolean).join(" - ");
}

const getStyles = (fontRegBase64: string, fontBoldBase64: string) => `
  @font-face { font-family: 'NotoNaskhArabic'; src: url(data:font/ttf;base64,${fontRegBase64}); font-weight: normal; }
  @font-face { font-family: 'NotoNaskhArabic'; src: url(data:font/ttf;base64,${fontBoldBase64}); font-weight: bold; }
  
  body {
    -webkit-print-color-adjust: exact;
  }
  .pdf-wrapper {
    font-family: 'NotoNaskhArabic', sans-serif;
    direction: rtl;
    text-align: right;
    color: #000;
  }
  
  .pdf-page {
    width: 297mm;
    height: 209mm;
    padding: 10mm;
    box-sizing: border-box;
    border: 2px solid black;
    position: relative;
    background: white;
    page-break-after: always;
    overflow: hidden;
  }

  .logo-box {
    position: absolute;
    top: 10mm;
    left: 15mm;
    width: 20mm;
    text-align: center;
  }

  .top-right-headers {
    position: absolute;
    top: 10mm;
    right: 15mm;
    font-weight: bold;
    font-size: 11px;
    line-height: 1.5;
  }

  .cover-title-container { margin-top: 30mm; text-align: center; }
  .cover-title-box { border: 1px solid black; padding: 8px; margin: 10px auto; width: 60%; font-size: 18px; font-weight: bold; }
  
  .cover-bottom-section { display: flex; justify-content: space-between; margin-top: 20mm; padding: 0 10mm; }
  .instructions-box { background-color: #f5f5f5; border: 1px solid black; padding: 10px; width: 55%; font-size: 12px; line-height: 1.6; }
  .instructions-title { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
  
  .stats-tables { width: 40%; }
  .stat-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  .stat-table td { border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; }
  .stat-table .header { background-color: white; }

  table.data-table { width: 100%; border-collapse: collapse; margin-top: 15mm; font-size: 10px; text-align: center; }
  table.data-table th, table.data-table td { border: 1px solid black; padding: 4px; word-wrap: break-word; }
  table.data-table th { background-color: #f0f0f0; font-weight: bold; font-size: 10px; }
  
  table.header-table { width: 100%; border-collapse: collapse; margin-top: 20mm; font-size: 11px; text-align: center; }
  table.header-table th, table.header-table td { border: 1px solid black; padding: 6px; }
  table.header-table th { background-color: #f0f0f0; font-weight: bold; }

  .footer { position: absolute; bottom: 10mm; left: 10mm; right: 10mm; display: flex; justify-content: space-between; align-items: flex-end; font-size: 13px; font-weight: bold; }
  .stamp-box { border: 1px solid black; width: 40px; height: 60px; display: flex; align-items: center; justify-content: center; }
`;

function generateHTML(hcGroups: any, fontBase64: any, logoBase64: string): string {
  let html = `<div class="pdf-wrapper"><style>${getStyles(fontBase64.regular, fontBase64.bold)}</style>`;

  const hwGroups = hcGroups;
  const firstHW = Object.values(hwGroups)[0] as Record<string, any[]>;
  const firstED = Object.values(firstHW)[0] as any[];
  const firstRecord = firstED?.[0];
  const hcChild = Object.values(hwGroups).flatMap((hw: any) => Object.values(hw).flat());

  if (!firstRecord) return "";

  // COVER PAGE
  html += `
    <div class="pdf-page">
      <div class="logo-box"><img src="${logoBase64}" style="height: 20mm; width: auto;" alt="SFD Logo" /></div>
      <div class="top-right-headers">
        <div>الجمهورية اليمنية</div><div>الصندوق الاجتماعي للتنمية</div><div>فرع صنعاء</div>
      </div>
      <div class="cover-title-container">
        <div class="cover-title-box">برنامج التحويلات النقدية المشروطة في التغذية</div>
        <div class="cover-title-box" style="font-size: 16px;">كشف تأكيد حالات سوء التغذية للأطفال من قبل العامل الصحي</div>
        <div style="font-size: 15px; font-weight: bold; margin-top: 15px;">المرفق الصحي: ${firstRecord.hc_name || ""}</div>
      </div>
      <div class="cover-bottom-section">
        <div class="instructions-box">
          <div class="instructions-title">التعليمات</div>
          <ul style="margin: 0; padding-right: 20px;">
            <li>في عمود هل حظر الطفل إلى المرفق الصحي يرجى اختيار: نعم / لا</li>
            <li>في حال كانت الإجابة لا يرجى كتابة السبب في عمود حالة المتابعة / سبب عدم الحظور</li>
            <li>في عمود هل يعاني الطفل من سوء تغذية يرجى اختيار: نعم / لا</li>
            <li>في حال كانت الإجابة لا يرجى كتابة قياس المواك في عمود قياس المواك</li>
            <li>في عمود حالة الطفل يرجى اختيار: سوء تغذية متوسط / سوء تغذية حاد</li>
            <li>في عمود القياس المستخدم يرجى اختيار: المواك / الزد اسكور</li>
            <li>في حال كان القياس المستخدم هو الزد اسكور يرجى تعبئة قياس الطول والوزن ومن ثم كتابه قياس الزد اسكور في الأعمدة المحددة</li>
            <li>وفي عمود حالة المتابعة / سبب عدم الحضور يرجى اختيار أحد الخيارات التالية:</li>
            <ul style="list-style-type: circle; padding-right: 15px;">
              <li>مستمر بالمعالجة</li><li>شفاء</li><li>تخلف</li><li>الوفاة</li><li>عدم استجابة</li><li>انتهاء فترة الدعم / تخريج من برنامج سوء التغذية</li>
            </ul>
          </ul>
        </div>
        <div class="stats-tables">
          <table class="stat-table">
            <tr><td class="header">عدد الاطفال</td></tr>
            <tr><td>${hcChild.length || 0}</td></tr>
          </table>
          <table class="stat-table">
            <tr><td class="header">عدد الحالات</td></tr>
            <tr><td>&nbsp;</td></tr>
          </table>
          <div style="margin-top: 30px; font-size: 14px; font-weight: bold; text-align: left;">
            <div>كود العامل الصحي: ${firstRecord.hw_id || ""}</div>
            <div style="margin-top: 10px;">اسم العامل الصحي: ${firstRecord.hw_name || ""}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // DATA PAGES
  for (const hw of Object.keys(hwGroups)) {
    const edGroups = hwGroups[hw];
    for (const ed of Object.keys(edGroups)) {
      const childs = edGroups[ed];
      const first = childs[0];
      const g: EducatorGroupInfo = {
        educatorPhone: first.ed_phone || "", educatorName: first.ed_name || "",
        educatorCode: first.ed_id || "", hwname: first.hw_name || "",
        hwid: first.hw_id || "", hcname: first.hc_name || "",
        hcid: first.hc_id || "", location: buildLocation(first)
      };

      const totalPages = Math.ceil(childs.length / ROWS_PER_PAGE);

      for (let p = 0; p < totalPages; p++) {
        const slice = childs.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);

        html += `
          <div class="pdf-page">
            <div class="logo-box"><img src="${logoBase64}" style="height: 20mm; width: auto;" alt="SFD Logo" /></div>
            <div class="top-right-headers">
              <div>الجمهورية اليمنية</div>
              <div>الصندوق الاجتماعي للتنمية - فرع صنعاء</div>
              <div style="font-weight: normal; margin-top: 5px;">صفحة ${p + 1} من ${totalPages}</div>
            </div>
            <div style="text-align: center; font-weight: bold; font-size: 15px; padding-top: 5mm;">برنامج التحويلات النقدية المشروطة في التغذية</div>
            <div style="text-align: center; font-size: 13px; margin-top: 5px;">كشف تأكيد حالات سوء التغذية للأطفال من قبل العامل الصحي</div>
            <table class="header-table">
              <thead>
                <tr>
                  <th>الموقع</th><th>كود المرفق الصحي</th><th>اسم المرفق الصحي</th>
                  <th>كود العامل الصحي</th><th>اسم العامل الصحي</th><th>كود المثقفة</th>
                  <th>اسم المثقفة</th><th>رقم هاتف المثقفة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${g.location}</td><td>${g.hcid}</td><td>${g.hcname}</td>
                  <td>${g.hwid}</td><td>${g.hwname}</td><td>${g.educatorCode}</td>
                  <td>${g.educatorName}</td><td>${g.educatorPhone}</td>
                </tr>
              </tbody>
            </table>
            <table class="data-table">
              <thead>
                <tr>
                  <th>م</th><th>كود الطفل</th><th>كود الطفل</th><th>اسم الطفل</th><th>اسم الطفل</th>
                  <th>جنس الطفل</th><th>عمر الطفل</th><th>تاريخ التاكيد</th><th>هل حضر الطفل إلى المرفق</th>
                  <th>هل يعاني من سوء تغذية</th><th>رقم الكرت الحصري</th><th>نوع القياس المستخدم</th>
                  <th>قياس المواك</th><th>قياس الطول</th><th>قياس الوزن</th><th>قياس الزد اسكور</th>
                  <th>حالة الطفل حاليا</th><th>تاريخ بدء العلاج</th><th>التاريخ المتوقع لانتهاء العلاج</th>
                  <th>حالة المتابعة/سبب عدم الحظور</th>
                </tr>
              </thead>
              <tbody>
                ${slice.map((r: any, i: number) => `
                  <tr>
                    <td>${p * ROWS_PER_PAGE + i + 1}</td>
                    <td>${r.benef_id || ""}</td><td>${r.child_id || ""}</td>
                    <td>${r.bnf_name || ""}</td><td>${r.child_name || ""}</td>
                    <td>${r.child_gender || ""}</td><td>${r.new_child_age_mon || ""}</td>
                    <td>${r.conf_date || ""}</td><td>${r.attend_hc || ""}</td>
                    <td>${r.child_has_cmam_hc || ""}</td><td>${r.hc_card_no || ""}</td>
                    <td>${r.meas_type || ""}</td><td>${r.muac_hc || ""}</td>
                    <td>${r.zscore_h || ""}</td><td>${r.zscore_w || ""}</td>
                    <td>${r.zscore || ""}</td><td>${r.child_cmam_cond || ""}</td>
                    <td>${r.exp_start_treat_date || ""}</td><td>${r.exp_end_treat_date || ""}</td>
                    <td>${r.not_attend_reason || ""}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
        `;

        if (p === totalPages - 1) {
          const totalChild = childs.length;
          const discovered = childs.filter((b: any) => b.child_cmam_cond && b.child_cmam_cond !== "").length;
          html += `
            <table class="data-table" style="width: 50%; margin-right: auto; margin-left: 0; margin-top: 10px; font-size: 13px;">
              <tr>
                <td style="background-color: #f0f0f0; font-weight: bold;">اجمالي الاطفال</td><td>${totalChild}</td>
                <td style="background-color: #f0f0f0; font-weight: bold;">عدد الحالات المكتشفة</td><td>${discovered}</td>
              </tr>
            </table>
          `;
        }
        html += `
            <div class="footer">
              <div class="stamp-box">ختم<br>المركز</div>
              <div>التوقيع ................................</div>
              <div>اسم العامل الصحي: ${g.hwname}</div>
            </div>
          </div>
        `;
      }
    }
  }

  html += `</div>`;
  return html;
}

const getDataPath = () => path.join(process.cwd(), 'src/data');
const getDbPath = () => path.join(getDataPath(), 'child-cmam.db');

export async function POST(req: Request) {
    let browser = null;
    try {
        const { projectId, isSample } = await req.json();

        // 1. Fetch data
        const db = new Database(getDbPath(), { fileMustExist: true });
        const records = db.prepare("SELECT * FROM child_cmam WHERE project_id = ?").all(projectId);
        db.close();

        if (records.length === 0) {
            return NextResponse.json({ error: "No records found" }, { status: 404 });
        }

        const qualified = records.filter((r: any) => r.child_has_cmam === "نعم");
        if (qualified.length === 0) {
            return NextResponse.json({ error: "No qualified children for export." }, { status: 404 });
        }

        // 2. Group data
        const groups: Record<string, Record<string, Record<string, any[]>>> = {};
        for (const r of qualified) {
            const hc = r.hc_id || 'UNKNOWN_HC';
            const hw = r.hw_name || 'UNKNOWN_HW';
            const ed = r.ed_id || 'UNKNOWN_ED';
            if (!groups[hc]) groups[hc] = {};
            if (!groups[hc][hw]) groups[hc][hw] = {};
            if (!groups[hc][hw][ed]) groups[hc][hw][ed] = [];
            groups[hc][hw][ed].push(r);
        }

        // 3. Load assets
        const [fontRegularBase64, fontBoldBase64, logoBuffer] = await Promise.all([
            fs.readFile(path.join(process.cwd(), "public/fonts/NotoNaskhArabic-Regular.ttf"), "base64"),
            fs.readFile(path.join(process.cwd(), "public/fonts/NotoNaskhArabic-Bold.ttf"), "base64"),
            fs.readFile(path.join(process.cwd(), "public/sfd-logo.png"))
        ]);
        const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        const fontBase64 = { regular: fontRegularBase64, bold: fontBoldBase64 };

        // 4. Launch Puppeteer
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });
        const page = await browser.newPage();
        
        const zip = new JSZip();
        const dataToProcess = isSample ? Object.keys(groups).slice(0, 1) : Object.keys(groups);

        for (const hc of dataToProcess) {
            const htmlString = generateHTML(groups[hc], fontBase64, logoBase64);
            await page.setContent(htmlString, { waitUntil: 'networkidle0' });
            
            const pdfBuffer = await page.pdf({ format: 'A4', landscape: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
            
            if (isSample) {
                return new NextResponse(pdfBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="CMAM_Confirmation_Sample.pdf"` } });
            }
            
            const firstRecord = groups[hc][Object.keys(groups[hc])[0]][Object.keys(groups[hc][Object.keys(groups[hc])[0]])[0]][0];
            const safeName = `${firstRecord.hc_id}-${firstRecord.hc_name}`.replace(/[\/\\?%*:|"<>]/g, "-");
            zip.file(`${safeName}.pdf`, pdfBuffer);
        }
        
        const zipBlob = await zip.generateAsync({ type: "nodebuffer" });
        return new NextResponse(zipBlob, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="CMAM_Confirmations.zip"` } });
        
    } catch (err: any) {
        console.error("PDF Export Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        if (browser) await browser.close();
    }
}
