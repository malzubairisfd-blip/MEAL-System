import jsPDF from "jspdf";
import "jspdf-autotable";
import JSZip from "jszip";

interface EducatorGroupInfo {
  location: string;
  educatorCode: string;
  educatorName: string;
  selectedCycle: string;
  selectedMonth: string;
  hwname: string;
  hwid: string;
  hcname: string;
  hcid: string;
}

const ROWS_PER_PAGE = 8;

function buildLocation(r: any) {
  return [r.gov_name, r.mud_name, r.ozla_name].filter(Boolean).join(" - ");
}

function drawSFDLogo(doc: jsPDF) {
  const logoX = 15;
  const logoY = 8;
  doc.setFillColor(40, 60, 80);
  doc.rect(logoX, logoY, 6, 15, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("S", logoX + 3, logoY + 4, { align: "center" });
  doc.text("F", logoX + 3, logoY + 8, { align: "center" });
  doc.text("D", logoX + 3, logoY + 12, { align: "center" });
  doc.setFont("NotoNaskhArabic", "normal");
  doc.setTextColor(40, 60, 80);
  doc.setFontSize(10);
  doc.text("الصندوق", logoX + 8, logoY + 4);
  doc.text("الاجتماعي", logoX + 8, logoY + 9);
  doc.text("للتنمية", logoX + 8, logoY + 14);
  doc.setFontSize(6);
  doc.text("Social Fund for Development", logoX, logoY + 17);
}

function drawPageBorder(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setLineWidth(1.2);
  doc.setDrawColor(0, 0, 0);
  doc.rect(1, 1, w - 5, h - 5);
}

function drawCoverPage(
  doc: jsPDF,
  hc_name: string,
  hw_id: string,
  hw_name: string,
  hcBeneficiaries: any[],
  selectedCycle: string,
  selectedMonth: string
) {
  const w = doc.internal.pageSize.getWidth();
  const right = w - 10;
  const center = w / 2;

  drawPageBorder(doc);
  drawSFDLogo(doc);

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("الجمهورية اليمنية", right, 8, { align: "right" });
  doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" });
  doc.text("فرع صنعاء", right, 18, { align: "right" });

  doc.rect(30, 30, w - 60, 16);
  doc.setFontSize(16);
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", center, 40, { align: "center" });

  doc.rect(30, 50, w - 60, 16);
  doc.setFontSize(14);
  doc.text("كشف امتثال الأطفال إلى المرفق الصحي", center, 60, { align: "center" });

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(13);
  doc.text("المرفق الصحي: " + hc_name, center, 72, { align: "center" });

  const boxX = 25;
  const boxY = 80;
  const boxHeight = 110;
  const boxWidth = (w - 50) * 0.55;
  const tableX = boxX + boxWidth + 5;
  const tableWidth = (w - 50) - boxWidth - 5;

  doc.setFillColor(245, 245, 245);
  doc.rect(boxX, boxY, boxWidth, boxHeight, "F");
  doc.setDrawColor(0, 0, 0);
  doc.rect(boxX, boxY, boxWidth, boxHeight);
  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(14);
  doc.text("التعليمات", boxX + boxWidth - 2, boxY + 10, { align: "right" });
  doc.setFont("NotoNaskhArabic", "normal");
  doc.setFontSize(11);

  const instructions = [
    "في عمود هل حظر الطفل إلى المرفق الصحي يرجى اختيار: نعم / لا",
    "في حال كانت الإجابة لا يرجى كتابة السبب في عمود سبب عدم الحظور",
    "في عمود هل يعاني الطفل من سوء تغذية يرجى اختيار: نعم / لا",
    "في حال كانت الإجابة لا يرجى كتابة قياس المواك أو الزد اسكور",
    "في عمود حالة الطفل يرجى اختيار: سوء تغذية متوسط / سوء تغذية حاد",
    "في حال كان القياس المستخدم هو الزد اسكور يرجى تعبئة قياس الطول والوزن ومن ثم كتابة القياس في العمود المخصص",
    "وفي عمود حالة المتابعة يرجى اختيار أحد الخيارات التالية:",
    "مستمر بالمعالجة",
    "شفاء",
    "تخلف",
    "الوفاة",
    "عدم استجابة",
    "انتهاء فترة الدعم / تخريج من برنامج سوء التغذية",
  ];

  let y = boxY + 20;
  const padding = 3;
  const maxWidth = boxWidth - padding * 2;
  for (const line of instructions) {
    doc.text(line, boxX + boxWidth - padding, y, { align: "right", maxWidth });
    y += 7;
  }

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(12);
  const rowHeight = 10;
  const tableSpacing = 5;

  const totalBeneficiaries = hcBeneficiaries.length;
  doc.rect(tableX, boxY, tableWidth, rowHeight);
  doc.text("عدد الأطفال", tableX + tableWidth / 2, boxY + rowHeight / 2 + 3, { align: "center" });
  doc.rect(tableX, boxY + rowHeight, tableWidth, rowHeight);
  doc.text(String(totalBeneficiaries || ""), tableX + tableWidth / 2, boxY + rowHeight + rowHeight / 2 + 3, { align: "center" });

  const table2Y = boxY + rowHeight * 2 + tableSpacing;
  doc.rect(tableX, table2Y, tableWidth, rowHeight);
  doc.text("عدد الحالات", tableX + tableWidth / 2, table2Y + rowHeight / 2 + 3, { align: "center" });
  doc.rect(tableX, table2Y + rowHeight, tableWidth, rowHeight);

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(13);
  doc.text(`كود العامل الصحي: ${hw_id}`, right, boxY + boxHeight, { align: "right" });
  doc.text(`اسم العامل الصحي: ${hw_name}`, right, boxY + boxHeight + 10, { align: "right" });
  doc.text(`دورة المتابعة: ${selectedCycle} - ${selectedMonth}`, right, boxY + boxHeight + 20, { align: "right" });
}

function drawHeader(doc: jsPDF, page: number, totalPages: number, g: EducatorGroupInfo) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - 10;
  const center = pageWidth / 2;

  drawSFDLogo(doc);
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

  ;(doc as any).autoTable({
    startY: 28,
    head: [
      [
        "دورة المتابعة / الشهر",
        "اسم المثقفة",
        "كود المثقفة",
        "اسم العامل الصحي",
        "كود العامل الصحي",
        "اسم المرفق الصحي",
        "كود المرفق الصحي",
        "الموقع",
      ],
    ],
    body: [
      [
        `${g.selectedCycle} - ${g.selectedMonth}`,
        g.educatorName,
        g.educatorCode,
        g.hwname,
        g.hwid,
        g.hcname,
        g.hcid,
        g.location,
      ],
    ],
    theme: "grid",
    styles: {
      font: "NotoNaskhArabic",
      fontSize: 9,
      textColor: 0,
      cellPadding: 3,
      halign: "center",
      valign: "middle",
      lineColor: 0,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      fontStyle: "bold",
      halign: "center",
      lineColor: 0,
      lineWidth: 0.3,
    },
    margin: { left: 10, right: 10 },
  });

  return (doc as any).lastAutoTable.finalY;
}

function drawPageFooter(doc: jsPDF, hwname: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const footerY = doc.internal.pageSize.getHeight() - 25;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("اسم العامل الصحي " + hwname, pageWidth - 15, footerY, { align: "right" });
  doc.text("................................ التوقيع", 60, footerY);
  doc.rect(15, footerY - 5, 35, 20);
  doc.text("ختم المركز", 32.5, footerY + 12, { align: "center" });
}

function drawSummary(doc: jsPDF, bnfs: any[]) {
  const totalBeneficiaries = bnfs.length;
  const discovered = bnfs.filter((b) => b.child_cmam_cond && b.child_cmam_cond !== "").length;

  ;(doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 8,
    body: [["", "", discovered, "عدد الحالات الممتثلة", totalBeneficiaries, "اجمالي الأطفال"]],
    styles: {
      font: "NotoNaskhArabic",
      fontSize: 14,
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.9,
      minCellHeight: 10,
    },
    columnStyles: {
      1: { cellWidth: 50 },
      3: { fontStyle: "bold", fillColor: [240, 240, 240] },
      5: { fontStyle: "bold", fillColor: [240, 240, 240] },
    },
    margin: { left: 10, right: 10 },
  });
}

self.onmessage = async (event: MessageEvent) => {
  const { beneficiaries, fontBase64, selectedCycle, selectedMonth } = event.data;
  if (!beneficiaries?.length) {
    postMessage({ type: "error", error: "No beneficiaries" });
    return;
  }

  const cycle = Number(selectedCycle);

  const workerConfigs = [
    {
      measType: "المواك",
      columns: [
        "not_attend_reason",
        "cmam_result",
        "child_cmam_cond",
        "muac",
        "meas_type",
        "child_has_cmam",
        "hc_card_no",
        "date_attend",
        "child_attend",
        "child_age",
        "child_gender",
        "child_name",
        "bnf_name",
        "child_id",
        "benef_id",
      ],
      headers: [
        "سبب عدم الحضور",
        "نتيجة المتابعة",
        "حالة الطفل حاليا",
        "قياس المواك",
        "نوع القياس المستخدم",
        "هل يعاني من سوء تغذية",
        "رقم الكرت الحصري",
        "تاريخ الامتثال",
        "هل امتثل الطفل إلى المرفق",
        "عمر الطفل",
        "جنس الطفل",
        "اسم الطفل",
        "اسم الأم",
        "كود الطفل",
        "كود المستفيد",
        "م",
      ],
      filter: (r: any) => {
        const nextCycleValue = r[`next_cycle_c${cycle}`];
        return (
          r.child_has_cmam === "نعم" &&
          ["Qualified", "Last Month Qualification"].includes(nextCycleValue) &&
          r.meas_type === "المواك"
        );
      },
    },
    {
      measType: "الزد اسكور",
      columns: [
        "not_attend_reason",
        "cmam_result",
        "child_cmam_cond",
        "zscore",
        "zscore_w",
        "zscore_h",
        "meas_type",
        "child_has_cmam",
        "hc_card_no",
        "date_attend",
        "child_attend",
        "child_age",
        "child_gender",
        "child_name",
        "bnf_name",
        "child_id",
        "benef_id",
      ],
      headers: [
        "سبب عدم الحضور",
        "نتيجة المتابعة",
        "حالة الطفل حاليا",
        "قياس الزد اسكور",
        "قياس الوزن",
        "قياس الطول",
        "نوع القياس المستخدم",
        "هل يعاني من سوء تغذية",
        "رقم الكرت الحصري",
        "تاريخ الامتثال",
        "هل امتثل الطفل إلى المرفق",
        "عمر الطفل",
        "جنس الطفل",
        "اسم الطفل",
        "اسم الأم",
        "كود الطفل",
        "كود المستفيد",
        "م",
      ],
      filter: (r: any) => {
        const nextCycleValue = r[`next_cycle_c${cycle}`];
        return (
          r.child_has_cmam === "نعم" &&
          ["Qualified", "Last Month Qualification"].includes(nextCycleValue) &&
          r.meas_type === "الزد اسكور"
        );
      },
    },
  ];

  const zip = new JSZip();

  for (const config of workerConfigs) {
    const filtered = beneficiaries
      .filter(config.filter)
      .sort((a: any, b: any) => {
        const edCompare = String(a.ed_id).localeCompare(String(b.ed_id), "ar");
        if (edCompare !== 0) return edCompare;
        return String(a.hw_name).localeCompare(String(b.hw_name), "ar");
      });

    if (!filtered.length) continue;

    const grouped: Record<string, Record<string, Record<string, any[]>>> = {};
    for (const row of filtered) {
      const hc = row.hc_id || "unknown-hc";
      const hw = row.hw_name || "unknown-hw";
      const ed = row.ed_id || "unknown-ed";
      if (!grouped[hc]) grouped[hc] = {};
      if (!grouped[hc][hw]) grouped[hc][hw] = {};
      if (!grouped[hc][hw][ed]) grouped[hc][hw][ed] = [];
      grouped[hc][hw][ed].push(row);
    }

    for (const hc of Object.keys(grouped)) {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.addFileToVFS("Regular.ttf", fontBase64.regular);
      doc.addFileToVFS("Bold.ttf", fontBase64.bold);
      doc.addFont("Regular.ttf", "NotoNaskhArabic", "normal");
      doc.addFont("Bold.ttf", "NotoNaskhArabic", "bold");

      const hwGroups = grouped[hc];
      const firstHW = Object.values(hwGroups)[0] as Record<string, any[]>;
      const firstED = Object.values(firstHW)[0] as any[];
      const firstRecord = firstED?.[0];
      if (!firstRecord) continue;

      const hcBeneficiaries = Object.values(hwGroups).flatMap((hw) => Object.values(hw).flat());
      drawCoverPage(
        doc,
        firstRecord.hc_name || "",
        firstRecord.hw_id || "",
        firstRecord.hw_name || "",
        hcBeneficiaries,
        `${selectedCycle}`,
        selectedMonth
      );

      doc.addPage();

      for (const hw of Object.keys(hwGroups)) {
        const edGroups = hwGroups[hw];
        for (const ed of Object.keys(edGroups)) {
          const bnfs = edGroups[ed];
          const first = bnfs[0];

          const g: EducatorGroupInfo = {
            selectedCycle: `${selectedCycle}`,
            selectedMonth,
            educatorName: first.ed_name || "",
            educatorCode: first.ed_id || "",
            hwname: first.hw_name || "",
            hwid: first.hw_id || "",
            hcname: first.hc_name || "",
            hcid: first.hc_id || "",
            location: buildLocation(first),
          };

          const totalPages = Math.ceil(bnfs.length / ROWS_PER_PAGE);

          for (let p = 0; p < totalPages; p++) {
            if (!(p === 0 && hw === Object.keys(hwGroups)[0] && ed === Object.keys(edGroups)[0])) {
              doc.addPage();
            }

            const headerY = drawHeader(doc, p + 1, totalPages, g);
            const slice = bnfs.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);

            const body = slice.map((r: any, index: number) => [
              ...config.columns.map((column) => r[`${column}_c${cycle}`] ?? r[column] ?? ""),
              p * ROWS_PER_PAGE + index + 1,
            ]);

            ;(doc as any).autoTable({
              startY: headerY + 5,
              head: [config.headers],
              body,
              theme: "grid",
              tableWidth: "auto",
              styles: {
                font: "NotoNaskhArabic",
                fontSize: 10,
                textColor: [0, 0, 0],
                cellPadding: 3,
                lineColor: [0, 0, 0],
                lineWidth: 0.3,
                halign: "center",
                overflow: "linebreak",
              },
              headStyles: {
                fillColor: [240, 240, 240],
                fontStyle: "bold",
                halign: "center",
                lineColor: [0, 0, 0],
                lineWidth: 0.3,
              },
              margin: { left: 6, right: 6 },
            });

            drawPageFooter(doc, g.hwname);

            if (p === totalPages - 1) drawSummary(doc, bnfs);
          }
        }
      }

      const safeName = `${firstRecord.hc_id}-${firstRecord.hc_name}-${config.measType}`.replace(/[\/\\?%*:|"<>]/g, "-");
      zip.file(`${safeName}.pdf`, doc.output("arraybuffer"));
    }
  }

  const zipData = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 5 },
  });

  postMessage({ type: "done-all", data: zipData }, [zipData]);
};