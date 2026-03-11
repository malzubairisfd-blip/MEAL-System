// src/workers/confirmationbnfcmam-export.worker.ts
import jsPDF from "jspdf";
import "jspdf-autotable";
import JSZip from "jszip";

interface EducatorGroupInfo {
  governorate: string;
  district: string;
  uzla: string;
  village: string;
  educatorCode: string;
  educatorName: string;
  educatorPhone: string;
  hwname?: string;
  hwid?: string;
  hcname?: string;
  hcid?: string;
}

function drawSFDLogo(doc: jsPDF) {
  const logoX = 15;
  const logoY = 8;
  doc.setFillColor(40, 60, 80);
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

const drawHeader = (
  doc: jsPDF,
  page: number,
  totalPages: number,
  groupInfo: EducatorGroupInfo
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth - 10;
  const centerX = pageWidth / 2;

  drawSFDLogo(doc);

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("الجمهورية اليمنية", rightX, 8, { align: "right" });
  doc.text("الصندوق الاجتماعي للتنمية", rightX, 13, { align: "right" });
  doc.text("فرع صنعاء", rightX, 18, { align: "right" });

  doc.setFontSize(10);
  doc.text(`صفحة ${page} من ${totalPages}`, rightX, 24, { align: "right" });

  doc.setFontSize(13);
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", centerX, 12, { align: "center" });
  doc.setFontSize(11);
  doc.text("كشف تأكيد حالات سوء التغذية للمستفيدات من قبل العامل الصحي", centerX, 18, { align: "center" });
  
  (doc as any).autoTable({
    startY: 28,
    head: [
      [
        "رقم هاتف المثقفة",
        "اسم المثقفة",
        "كود المثقفة",
        "رقم هاتف العامل الصحي",
        "اسم العامل الصحي",
        "كود العامل الصحي",
        "اسم المرفق الصحي",
        "كود المرفق الصحي",
        "الموقع"
      ]
    ],
    body: [
      [
        groupInfo.educatorPhone,
        groupInfo.educatorName,
        groupInfo.educatorCode,
        "", // Health worker phone not available
        groupInfo.hwname,
        groupInfo.hwid,
        groupInfo.hcname,
        groupInfo.hcid,
        groupInfo.governorate
      ]
    ],
    theme: "grid",
    styles: {
      font: "NotoNaskhArabic",
      halign: "center",
      valign: "middle",
      fontSize: 9,
      cellPadding: 3,
      minCellHeight: 8
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [240, 240, 240],
      textColor: 0
    },
    margin: { right: 10, left: 10 }
  });

  return (doc as any).lastAutoTable?.finalY ?? 44;
};

const drawFooterSummary = (
  doc: jsPDF,
  bnfs: any[],
  groupInfo: EducatorGroupInfo,
  rowsPerPage: number
) => {
  const lastAutoTable = (doc as any).lastAutoTable;
  const lastY = (lastAutoTable?.finalY ?? 0) + 5;
  const pageWidth = doc.internal.pageSize.getWidth();

  const totalBeneficiaries = bnfs.length;
  const discoveredCases = bnfs.filter((b) => b.bnf_cmam_cond && b.bnf_cmam_cond !== "").length;

  (doc as any).autoTable({
    startY: lastY,
    body: [
      ["", "", discoveredCases, "عدد الحالات المكتشفة", totalBeneficiaries, "اجمالي المستفيدات"]
    ],
    theme: "grid",
    styles: {
      font: "NotoNaskhArabic",
      fontSize: 9,
      halign: "center",
      minCellHeight: 10
    },
    columnStyles: {
      1: { cellWidth: 50 },
      3: { fontStyle: "bold", fillColor: [240, 240, 240] },
      5: { fontStyle: "bold", fillColor: [240, 240, 240] }
    },
    margin: { left: 10, right: 10 }
  });

  const legendY = (doc as any).lastAutoTable.finalY + 5;
  const legendLine1 = [
    "بيانات المثقفة",
    "عدد القرى: 1",
    `عدد المستفيدات: ${totalBeneficiaries}`,
    "عدد صفحات الكشف: " + Math.ceil(totalBeneficiaries / rowsPerPage)
  ].join("     ");
  const legendLine2 = [
    "المتابعة (-1 مستمر بالمعالجة 2 - شفاء -3 تخلف -4 وفاة -5 عدم استجابة -6 إنتهاء فترة الدعم / تخريج من برنامج سوء التغذية -7 لم تحضر للمرفق الصحي)",
    "حالة المستفيدة: 1-حامل 2-مرضعة",
    "هل تعاني: 1-نعم 2-لا",
    "تذهب للمرفق: 1-نعم 2-لا"
  ].join("     ");

  doc.setFontSize(8);
  doc.text(legendLine1, pageWidth - 15, legendY, { align: "right" });
  doc.text(legendLine2, pageWidth - 15, legendY + 4, { align: "right" });

  const sigY = legendY + 25;
  doc.setFontSize(10);
  doc.text("اسم العامل الصحي: " + (groupInfo.hwname || ''), pageWidth - 15, sigY, { align: "right" });
  doc.text("........................................... التوقيع: ", 50, sigY, { align: "left" });
};

self.onmessage = async (event) => {
  const { beneficiaries, fontBase64, sample } = event.data;

  if (!beneficiaries || !fontBase64) {
    postMessage({ type: "error", error: "Missing data or fonts." });
    return;
  }

  const qualifiedBnfs = beneficiaries.filter((r: any) => r.bnf_has_cmam === "نعم");

  try {
    const groupedByEducatorAndVillage: Record<string, any[]> = {};
    qualifiedBnfs.forEach((row: any) => {
      const groupKey = `${row.hc_id || "Unassigned"}|${row.VILL_NAME || "Unassigned"}`;
      if (!groupedByEducatorAndVillage[groupKey]) groupedByEducatorAndVillage[groupKey] = [];
      groupedByEducatorAndVillage[groupKey].push(row);
    });

    const zip = new JSZip();
    const groups = Object.entries(groupedByEducatorAndVillage);
    const rowsPerPage = 8;

    for (const [groupKey, bnfs] of groups) {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.addFileToVFS("Regular.ttf", fontBase64.regular);
      doc.addFileToVFS("Bold.ttf", fontBase64.bold);
      doc.addFont("Regular.ttf", "NotoNaskhArabic", "normal");
      doc.addFont("Bold.ttf", "NotoNaskhArabic", "bold");

      const firstCell = bnfs[0];
      const groupInfo: EducatorGroupInfo = {
        educatorPhone: firstCell.ed_phone || firstCell.ED_TEL || "",
        educatorName: firstCell.ED_NAME || "",
        educatorCode: firstCell.ED_ID || "",
        hwname: firstCell.hw_name || "",
        hwid: firstCell.hw_id || "",
        hcname: firstCell.hc_name || "",
        hcid: firstCell.hc_id || "",
        governorate: firstCell.GOV_NAME || firstCell.MUD_NAME || firstCell.OZLA_NAME || firstCell.VILL_NAME || ""
      };

      const totalPages = Math.ceil(bnfs.length / rowsPerPage);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) doc.addPage();

        const headerEndY = drawHeader(doc, i + 1, totalPages, groupInfo);
        const tableStartY = headerEndY + 4;

        const pageData = bnfs.slice(i * rowsPerPage, (i + 1) * rowsPerPage);
        const tableBody = pageData.map((r, idx) => [
          r.notes || "",
          r.not_attend_reason || "",
          r.exp_end_treat_date || "",
          r.exp_start_treat_date || "",
          r.hc_muac || "",
          r.bnf_child_age || "",
          r.bnf_preg_mon || "",
          r.bnf_cmam_cond || "",
          r.hc_card_no || "",
          r.bnf_has_cmam_hc || "",
          r.attend_hc || "",
          r.conf_date || "",
          r.PHONE_NO || r.BENEF_TEL || "",
          r.BENEF_NAME || "",
          r.BENEF_ID || "",
          i * rowsPerPage + idx + 1
        ]);

        (doc as any).autoTable({
          startY: tableStartY,
          head: [
            [
              "ملاحظات",
              "في حال عدم الذهاب للمرفق الصحي يحدد السبب",
              "التاريخ المتوقع لانتهاء العلاج",
              "تاريخ بدء العلاج",
              "قياس الموآك",
              "عمر الرضيع",
              "شهر الحمل",
              "حالة المستفيدة حاليا",
              "اذا نعم، يرجى كتابة رقم الكرت/الرقم الحصري",
              "هل تعاني من سوء تغذية",
              "هل حضرت المستفيدة إلى المرفق الصحي",
              "تاريخ تاكيد الحالة",
              "رقم الهاتف",
              "اسم المستفيدة",
              "كود المستفيدة",
              "م"
            ]
          ],
          body: tableBody,
          theme: "grid",
          styles: {
            font: "NotoNaskhArabic",
            halign: "right",
            fontSize: 9,
            cellPadding: 3,
            minCellHeight: 15,
            overflow: "linebreak"
          },
          headStyles: {
            halign: "center",
            fillColor: [240, 240, 240],
            textColor: 0,
            fontStyle: "bold",
            lineWidth: 0.1
          },
          margin: { right: 10, left: 10 }
        });

        if (i === totalPages - 1) {
          drawFooterSummary(doc, bnfs, groupInfo, rowsPerPage);
        }
      }

      if (sample) {
        const pdfBuffer = doc.output("arraybuffer");
        self.postMessage({ type: "done-sample", data: pdfBuffer }, [pdfBuffer]);
        return;
      }

      const safeName = (groupInfo.hcname || groupKey).replace(/[/\\?%*:|"<>]/g, "-");
      zip.file(`${safeName}.pdf`, doc.output("arraybuffer"));
    }

    const zipContent = await zip.generateAsync({ type: "arraybuffer" });
    self.postMessage({ type: "done-all", data: zipContent }, [zipContent]);
  } catch (error: any) {
    postMessage({ type: "error", error: error.message });
  }
};
