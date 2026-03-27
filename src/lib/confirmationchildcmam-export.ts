"use client";

export interface EducatorGroupInfo {
  location: string;
  educatorCode: string;
  educatorName: string;
  educatorPhone: string;
  hwname: string;
  hwid: string;
  hcname: string;
  hcid: string;
}

const ROWS_PER_PAGE = 6;

function buildLocation(r: any) {
  return [r.gov_name, r.mud_name, r.ozla_name].filter(Boolean).join(" - ");
}

const getStyles = (fontRegBase64: string, fontBoldBase64: string) => `
  @font-face { font-family: 'NotoNaskhArabic'; src: url(data:font/ttf;base64,${fontRegBase64}); font-weight: normal; }
  @font-face { font-family: 'NotoNaskhArabic'; src: url(data:font/ttf;base64,${fontBoldBase64}); font-weight: bold; }
  
  .pdf-wrapper {
    font-family: 'NotoNaskhArabic', sans-serif;
    direction: rtl;
    text-align: right;
    color: #000;
    width: 297mm;
    background: white;
  }
  
  .pdf-page {
    width: 297mm;
    height: 209mm;
    padding: 8mm;
    box-sizing: border-box;
    border: 4px solid black;
    position: relative;
    background: white;
    page-break-after: always;
    page-break-inside: avoid;
    overflow: hidden;
  }

  .logo-box { position: absolute; top: 5mm; left: 15mm; width: 30mm; text-align: center; }
  .top-right-headers { position: absolute; top: 5mm; right: 15mm; font-weight: bold; font-size: 12px; line-height: 1.5; }

  .cover-title-container { margin-top: 30mm; text-align: center; }
  .cover-title-box { border: 1px solid black; padding: 10px; margin: 10px auto; width: 60%; font-size: 20px; font-weight: bold; }
  
  .cover-bottom-section { display: flex; justify-content: space-between; margin-top: 15mm; padding: 0 10mm; gap: 20px; }
  
  .instructions-box { 
    background-color: #f9f9f9; 
    border: 1px solid black; 
    padding: 15px; 
    width: 55%; 
    font-size: 13px; 
    line-height: 1.6; 
    text-align: right; /* Explicit Right Align */
  }
  .instructions-title { font-weight: bold; font-size: 15px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  
  .stats-tables { width: 40%; }
  .stat-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  .stat-table td { border: 1px solid black; padding: 10px; text-align: center; font-weight: bold; font-size: 14px; }

  /* INCREASED FONT SIZES HERE */
  table.data-table { width: 100%; border-collapse: collapse; margin-top: 5mm; text-align: center; table-layout: fixed; }
  table.data-table th { background-color: #f0f0f0; font-weight: bold; font-size: 11px; border: 1px solid black; padding: 6px 2px; }
  table.data-table td { border: 1px solid black; padding: 6px 2px; font-size: 11px; text-align: center; word-wrap: break-word; }
  
  table.header-table { width: 100%; border-collapse: collapse; margin-top: 10mm; font-size: 11px; text-align: center; }
  table.header-table th, table.header-table td { border: 1px solid black; padding: 6px; }
  table.header-table th { background-color: #f0f0f0; font-weight: bold; text-align: center; }

  /* FOOTER STYLING */
  .footer { 
    position: absolute; 
    bottom: 5mm; 
    left: 5mm; 
    right: 5mm; 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    font-size: 14px; 
    font-weight: bold; 
  }
  .footer-right { width: 33%; text-align: right; }
  .footer-center { width: 33%; text-align: center; }
  .footer-left { width: 33%; text-align: left; display: flex; align-items: center; justify-content: flex-start; }

  .stamp-box { 
    border: 2px solid black; 
    width: 120px;  /* Increased Size */
    height: 80px; /* Increased Size */
    display: flex; 
    align-items: left; 
    justify-content: center; 
    text-align: center;
    font-size: 12px;
  }
`;

export function generateHTML(childrenForHc: any[], fontBase64: { regular: string, bold: string }, logoBase64: string): string {
  let html = `<div class="pdf-wrapper"><style>${getStyles(fontBase64.regular, fontBase64.bold)}</style>`;
  
  const hwGroups: Record<string, Record<string, any[]>> = {};
  for (const r of childrenForHc) {
    const hw = r.hw_name || 'UNKNOWN_HW';
    const ed = r.ed_id || 'UNKNOWN_ED';
    if (!hwGroups[hw]) hwGroups[hw] = {};
    if (!hwGroups[hw][ed]) hwGroups[hw][ed] = [];
    hwGroups[hw][ed].push(r);
  }

  // Cover Page Logic
  const firstRecord = childrenForHc[0];
  if (!firstRecord) return "";

  html += `
    <div class="pdf-page">
      <div class="logo-box"><img src="${logoBase64}" style="height: 22mm; width: auto;" /></div>
      <div class="top-right-headers">
        <div>الجمهورية اليمنية</div>
        <div>الصندوق الاجتماعي للتنمية</div>
        <div>فرع صنعاء</div>
      </div>

      <div class="cover-title-container">
        <div class="cover-title-box">برنامج التحويلات النقدية المشروطة في التغذية</div>
        <div class="cover-title-box" style="font-size: 18px; margin-top: 5px;">كشف تأكيد حالات سوء التغذية للأطفال من قبل العامل الصحي</div>
        <div style="font-size: 16px; font-weight: bold; margin-top: 15px;">المرفق الصحي: ${firstRecord.hc_name || ""}</div>
      </div>

      <div class="cover-bottom-section">
        <div class="instructions-box">
          <div class="instructions-title">التعليمات:</div>
          <ul style="margin: 0; padding-right: 20px; list-style-type: disc;">
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
            <tr><td style="background:#f0f0f0">إجمالي عدد الأطفال المرفوعين</td></tr>
            <tr><td>${childrenForHc.length}</td></tr>
          </table>
          <div style="margin-top: 20px; font-size: 14px; font-weight: bold;">
            <div>كود العامل الصحي: ${firstRecord.hw_id || ""}</div>
            <div style="margin-top: 8px;">اسم العامل الصحي: ${firstRecord.hw_name || ""}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Data Pages
  for (const hw of Object.keys(hwGroups)) {
    for (const ed of Object.keys(hwGroups[hw])) {
      const childs = hwGroups[hw][ed];
      const totalPages = Math.ceil(childs.length / ROWS_PER_PAGE);

      for (let p = 0; p < totalPages; p++) {
        const slice = childs.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
        const first = slice[0];

        html += `
          <div class="pdf-page">
            <div class="logo-box"><img src="${logoBase64}" style="height: 18mm; width: auto;" /></div>
            <div class="top-right-headers">
            <div style="text-align: right; font-weight: bold; font-si1e: 12px; padding-top: 0mm;">الجمهورية اليمنية</div>
            <div style="text-align: right;  font-weight: bold; font-size: 12px; margin-top: 1px;">الصندوق الاجتماعي للتنمية</div>
            <div style="text-align: right;  font-weight: bold; font-size: 12px; margin-top: 2px;">صفحة ${p + 1} من ${totalPages}</div>
          </div>
          
            <div style="text-align: center; font-weight: bold; font-size: 15px; padding-top: 0mm;">برنامج التحويلات النقدية المشروطة في التغذية</div>
            <div style="text-align: center;  font-weight: bold; font-size: 15px; margin-top: 1px;">كشف تأكيد حالات سوء التغذية للأطفال من قبل العامل الصحي</div>

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
                  <td>${buildLocation(first)}</td><td>${first.hc_id}</td><td>${first.hc_name}</td>
                  <td>${first.hw_id}</td><td>${first.hw_name}</td><td>${first.ed_id}</td>
                  <td>${first.ed_name}</td><td>${first.ed_phone}</td>
                </tr>
              </tbody>
            </table>
            
            <table class="data-table">
              <thead>
                <tr>
                  <th>م</th><th>كود المستفيدة</th><th>كود الطفل</th><th>اسم المستفيدة</th><th>اسم الطفل</th>
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
          // SUMMARY TABLE CENTERED
          html += `
            <div style="display: flex; justify-content: center; margin-top: 15px;">
              <table style="width: 60%; border-collapse: collapse; text-align: center; font-size: 15px; border: 2px solid black;">
                <tr>
                  <td style="background-color: #f0f0f0; font-weight: bold; border: 1px solid black; padding: 10px;">إجمالي الأطفال في الكشف</td>
                  <td style="border: 1px solid black; padding: 10px; width: 80px;">${childs.length}</td>
                  <td style="background-color: #f0f0f0; font-weight: bold; border: 1px solid black; padding: 10px;">إجمالي الحالات المكتشفة</td>
                  <td style="border: 1px solid black; padding: 10px; width: 80px;">.......</td>
                </tr>
              </table>
            </div>
          `;
        }

        html += `
            <div class="footer">
              <div class="footer-right">اسم العامل الصحي: ${first.hw_name}</div>
              <div class="footer-center">التوقيع: ........................................</div>
              <div class="footer-left">
                <div class="stamp-box">ختم المرفق الصحي</div>
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  html += `</div>`;
  return html;
}
