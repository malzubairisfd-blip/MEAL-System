// src/workers/childreferralcmam-export.worker.ts
import jsPDF from "jspdf"
import "jspdf-autotable"
import JSZip from "jszip"

interface EducatorGroupInfo {
  location: string;
  educatorCode: string;
  educatorName: string;
  educatorPhone: string;
  selectedCycle: string;
  selectedMonth: string;
  hwname: string;
  hwid: string;
  hcname: string;
  hcid: string;
}

const ROWS_PER_PAGE = 8

function buildLocation(r: any) {
  return [r.GOV_NAME, r.MUD_NAME, r.OZLA_NAME].filter(Boolean).join(" - ")
}

function drawSFDLogo(doc: jsPDF, logoBase64: string) {
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 10, 5, 20, 20);
  }
}

function drawPageBorder(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  doc.setLineWidth(1.2)
  doc.rect(5, 5, w - 10, h - 10)
}

function drawCoverPage(doc: jsPDF, hc_name: string, hw_id: string, hw_name: string, hcBeneficiaries: any[], logoBase64: string) {
  const w = doc.internal.pageSize.getWidth()
  const right = w - 10
  const center = w / 2

  drawPageBorder(doc)
  drawSFDLogo(doc, logoBase64)

  doc.setFont("NotoNaskhArabic", "bold")
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)

  doc.text("الجمهورية اليمنية", right, 8, { align: "right" })
  doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" })
  doc.text("فرع صنعاء", right, 18, { align: "right" })

  doc.rect(30, 30, w - 60, 16)
  doc.setFontSize(16)
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", center, 40, { align: "center" })

  doc.rect(30, 50, w - 60, 16)
  doc.setFontSize(14)
  doc.text("كشف امتثال الاطفال إلى المرفق الصحي", center, 60, { align: "center" })

  doc.setFont("NotoNaskhArabic", "bold")
  doc.setFontSize(13)
  doc.text("المرفق الصحي: " + hc_name, center, 72, { align: "center" })

  const boxX = 25, boxY = 80, boxHeight = 110, boxWidth = (w - 50) * 0.55
  const tableX = boxX + boxWidth + 5, tableWidth = (w - 50) - boxWidth - 5

  doc.setFillColor(245, 245, 245)
  doc.rect(boxX, boxY, boxWidth, boxHeight, "F")
  doc.setDrawColor(0, 0, 0)
  doc.rect(boxX, boxY, boxWidth, boxHeight)

  doc.setFont("NotoNaskhArabic", "bold")
  doc.setFontSize(14)
  doc.text("التعليمات", boxX + boxWidth - 2, boxY + 10, { align: "right" })

  doc.setFont("NotoNaskhArabic", "normal")
  doc.setFontSize(11)

  const instructions = [
    "في عمود هل حظر الطفل إلى المرفق الصحي يرجى اختيار: نعم / لا",
    "في حال كانت الإجابة لا يرجى كتابة السبب في عمود سبب عدم الحظور",
    "في عمود هل يعاني الطفل من سوء تغذية يرجى اختيار: نعم / لا",
    "في حال كانت الإجابة لا يرجى كتابة قياس المواك في عمود قياس المواك او الزد اسكور",
    "في عمود حالة الطفل يرجى اختيار: سوء تغذية متوسط / سوء تغذية حاد",
    "في حال كان القياس المستخدم هو الزد اسكور يرجى تعبئة قياس الطول والوزن ومن ثم كتابه قياس الزد اسكور في الأعمدة المحددة",
    "وفي عمود حالة المتابعة يرجى اختيار أحد الخيارات التالية:",
    "مستمر بالمعالجة", "شفاء", "تخلف", "الوفاة", "عدم استجابة", "انتهاء فترة الدعم / تخريج من برنامج سوء التغذية"
  ];
  let y = boxY + 20
  instructions.forEach(line => { doc.text(line, boxX + boxWidth - 3, y, { align: "right", maxWidth: boxWidth - 6 }); y += 7 });

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(12);
  const rowHeight = 10, tableSpacing = 5;
  const totalChildren = hcBeneficiaries.length;
  doc.rect(tableX, boxY, tableWidth, rowHeight);
  doc.text("عدد الأطفال", tableX + tableWidth / 2, boxY + rowHeight / 2 + 3, { align: "center" });
  doc.rect(tableX, boxY + rowHeight, tableWidth, rowHeight);
  doc.text(String(totalChildren || ""), tableX + tableWidth / 2, boxY + rowHeight + rowHeight / 2 + 3, { align: "center" });

  const table2Y = boxY + rowHeight * 2 + tableSpacing;
  doc.rect(tableX, table2Y, tableWidth, rowHeight);
  doc.text("عدد الحالات", tableX + tableWidth / 2, table2Y + rowHeight / 2 + 3, { align: "center" });
  doc.rect(tableX, table2Y + rowHeight, tableWidth, rowHeight);

  doc.setFontSize(13);
  doc.text(`كود العامل الصحي: ${hw_id}`, right, boxY + boxHeight, { align: "right" });
  doc.text(`اسم العامل الصحي: ${hw_name}`, right, boxY + boxHeight + 10, { align: "right" });
}

function drawHeader(doc: jsPDF, page: number, totalPages: number, g: EducatorGroupInfo, logoBase64: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - 10, center = pageWidth / 2;
  
  drawSFDLogo(doc, logoBase64);
  drawPageBorder(doc);

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  doc.text("الجمهورية اليمنية", right, 8, { align: "right" });
  doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" });
  doc.text("فرع صنعاء", right, 18, { align: "right" });
  doc.setFontSize(10);
  doc.text(`صفحة ${page} من ${totalPages}`, right, 24, { align: "right" });
  doc.setFontSize(13);
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", center, 12, { align: "center" });
  doc.setFontSize(11);
  doc.text("كشف امتثال الأطفال إلى المرفق الصحي", center, 18, { align: "center" });

  (doc as any).autoTable({
    startY: 28,
    head: [["دورة المتابعة / الشهر", "اسم المثقفة", "كود المثقفة", "اسم العامل الصحي", "كود العامل الصحي", "اسم المرفق الصحي", "كود المرفق الصحي", "الموقع"]],
    body: [[`${g.selectedCycle} - ${g.selectedMonth}`, g.educatorName, g.educatorCode, g.hwname, g.hwid, g.hcname, g.hcid, g.location]],
    theme: "grid",
    styles: { font: "NotoNaskhArabic", fontSize: 9, cellPadding: 3, halign: "center", valign: "middle" },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    margin: { left: 10, right: 10 }
  });

  return (doc as any).lastAutoTable.finalY;
}

function drawPageFooter(doc: jsPDF, hwname: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const footerY = doc.internal.pageSize.getHeight() - 25;
  doc.setFontSize(12);
  doc.text("اسم العامل الصحي " + hwname, pageWidth - 15, footerY, { align: "right" });
  doc.text("................................ التوقيع", 60, footerY);
  doc.rect(15, footerY - 5, 35, 20);
  doc.text("ختم المركز", 32.5, footerY + 12, { align: "center" });
}

function drawSummary(doc: jsPDF, children: any[]) {
  const totalChildren = children.length;
  const discovered = children.filter((c) => c.child_cmam_cond).length;
  (doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 8,
    body: [["", "", discovered, "عدد الحالات الممتثلة", totalChildren, "اجمالي الأطفال"]],
    styles: { font: "NotoNaskhArabic", fontSize: 14, halign: "center", minCellHeight: 10 },
    columnStyles: { 3: { fontStyle: "bold" }, 5: { fontStyle: "bold" } },
    margin: { left: 10, right: 10 }
  });
}

const generatePdfForGroup = (doc: jsPDF, group: { bnfs: any[], g: EducatorGroupInfo }, fontBase64: any) => {
    const { bnfs, g } = group;
    const totalPages = Math.ceil(bnfs.length / ROWS_PER_PAGE);

    for (let p = 0; p < totalPages; p++) {
        if (p > 0) doc.addPage();
        const headerY = drawHeader(doc, p + 1, totalPages, g, fontBase64.logo);
        const slice = bnfs.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
        
        let body: any[][], head: any[][];

        if (g.meas_type === 'المواك') {
            head = [["سبب عدم الحظور", "نتبجة المتابعة", "حالة الطفل حاليا", "قياس المواك", "هل يعاني من سوء تغذية", "رقم الكرت الحصري", "تاريخ الامتثال", "هل امتثل الطفل إلى المرفق", "عمر الطفل", "جنس الطفل", "اسم الطفل", "اسم الأم", "كود الطفل", "كود الأم", "م"]];
            body = slice.map((r: any, i: number) => [
                r[`not_attend_reason_c${g.selectedCycle}`] || "", r[`cmam_result_c${g.selectedCycle}`] || "", r[`child_cmam_cond_c${g.selectedCycle}`] || "",
                r[`muac_c${g.selectedCycle}`] || "", r[`child_has_cmam_c${g.selectedCycle}`] || "", r.hc_card_no || "", r[`date_attend_c${g.selectedCycle}`] || "",
                r[`child_attend_c${g.selectedCycle}`] || "", r[`child_age_c${g.selectedCycle}`] || "", r.child_gender || "", r.child_name || "",
                r.bnf_name || "", r.child_id || "", r.benef_id || "", p * ROWS_PER_PAGE + i + 1
            ]);
        } else { // الزد اسكور
            head = [["سبب عدم الحظور", "نتيجة المتابعة", "حالة الطفل حاليا", "قياس الزد اسكور", "قياس الوزن", "قياس الطول", "نوع القياس المستخدم", "هل يعاني من سوء تغذية", "رقم الكرت الحصري", "تاريخ الامتثال", "هل امتثل الطفل إلى المرفق", "عمر الطفل", "جنس الطفل", "اسم الطفل", "اسم الأم", "كود الطفل", "كود الأم", "م"]];
            body = slice.map((r: any, i: number) => [
                r[`not_attend_reason_c${g.selectedCycle}`] || "", r[`cmam_result_c${g.selectedCycle}`] || "", r[`child_cmam_cond_c${g.selectedCycle}`] || "",
                r[`zscore_c${g.selectedCycle}`] || "", r[`zscore_w_c${g.selectedCycle}`] || "", r[`zscore_h_c${g.selectedCycle}`] || "", r.meas_type || "",
                r[`child_has_cmam_c${g.selectedCycle}`] || "", r.hc_card_no || "", r[`date_attend_c${g.selectedCycle}`] || "",
                r[`child_attend_c${g.selectedCycle}`] || "", r[`child_age_c${g.selectedCycle}`] || "", r.child_gender || "", r.child_name || "",
                r.bnf_name || "", r.child_id || "", r.benef_id || "", p * ROWS_PER_PAGE + i + 1
            ]);
        }

        (doc as any).autoTable({ startY: headerY + 5, head, body, theme: "grid", styles: { font: "NotoNaskhArabic", halign: "center" }, headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" }, margin: { left: 6, right: 6 } });
        drawPageFooter(doc, g.hwname);
        if (p === totalPages - 1) drawSummary(doc, bnfs);
    }
};

self.onmessage = async (event: MessageEvent) => {
  const { beneficiaries, fontBase64, selectedCycle, selectedMonth } = event.data;
  if (!beneficiaries?.length || !fontBase64 || !selectedCycle) {
    postMessage({ type: "error", error: "Missing data or fonts or cycle." });
    return;
  }
  const cycle = Number(selectedCycle);

  const filterCondition = (r: any) => {
    if (cycle === 1) return r.next_cycle_c1 === 'Qualified' || r.next_cycle_c1 === 'Last Month Qualification';
    if (cycle === 2) return r.next_cycle_c2 === 'Qualified' || r.next_cycle_c2 === 'Last Month Qualification';
    if (cycle === 3) return r.next_cycle_c3 === 'Qualified' || r.next_cycle_c3 === 'Last Month Qualification';
    return false;
  };
  
  const qualifiedMuac = beneficiaries.filter((r: any) => r.child_has_cmam === "نعم" && r.meas_type === 'المواك' && filterCondition(r));
  const qualifiedZScore = beneficiaries.filter((r: any) => r.child_has_cmam === "نعم" && r.meas_type === 'الزد اسكور' && filterCondition(r));

  const zip = new JSZip();

  const processGroup = async (groupType: 'muac' | 'zscore', data: any[]) => {
    const groups: Record<string, { bnfs: any[], g: EducatorGroupInfo }> = {};
    data.forEach(r => {
        const key = `${r.hc_id}|${r.hw_name}|${r.ed_id}`;
        if(!groups[key]) {
            groups[key] = {
                bnfs: [],
                g: {
                    selectedCycle: String(selectedCycle), selectedMonth: selectedMonth || '',
                    educatorName: r.ED_NAME || "", educatorCode: r.ED_ID || "",
                    hwname: r.hw_name || "", hwid: r.hw_id || "",
                    hcname: r.hc_name || "", hcid: r.hc_id || "",
                    location: buildLocation(r),
                    meas_type: r.meas_type
                }
            };
        }
        groups[key].bnfs.push(r);
    });

    for(const key in groups) {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.addFileToVFS("Regular.ttf", fontBase64.regular);
      doc.addFileToVFS("Bold.ttf", fontBase64.bold);
      doc.addFont("Regular.ttf", "NotoNaskhArabic", "normal");
      doc.addFont("Bold.ttf", "NotoNaskhArabic", "bold");
      
      const firstRecord = groups[key].bnfs[0];
      drawCoverPage(doc, firstRecord.hc_name, firstRecord.hw_id, firstRecord.hw_name, groups[key].bnfs, fontBase64.logo);
      generatePdfForGroup(doc, groups[key], fontBase64);
      
      const safeName = `${groupType}_${key.replace(/\|/g, '-')}`.replace(/[\/\\?%*:|"<>]/g, "-");
      zip.file(`${safeName}.pdf`, await doc.output("arraybuffer"));
    }
  };

  await processGroup('muac', qualifiedMuac);
  await processGroup('zscore', qualifiedZScore);

  const zipData = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 5 } });
  self.postMessage({ type: "done-all", data: zipData }, [zipData]);
};
