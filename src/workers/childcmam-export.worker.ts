// src/workers/childcmam-export.worker.ts

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
}

// ---------------- LOGO ----------------
function drawSFDLogo(doc: jsPDF) {
  const logoX = 15;
  const logoY = 8;
  doc.setFillColor(40, 60, 80);
  doc.rect(logoX, logoY, 6, 15, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("S", logoX + 3, logoY + 4, { align: "center" });
  doc.text("F", logoX + 3, logoY + 8, { align: "center" });
  doc.text("D", logoX + 3, logoY + 12, { align: "center" });

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

// ---------------- BORDER ----------------
function drawPageBorder(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setLineWidth(1.2);
  doc.rect(2, 2, w - 4, h - 4);
}

// ---------------- COVER PAGE ----------------
function drawCoverPage(doc: jsPDF, bnfs: any[], g: EducatorGroupInfo) {
  const w = doc.internal.pageSize.getWidth();
  const center = w / 2;
  const right = w - 10;

  drawPageBorder(doc);
  drawSFDLogo(doc);

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text("الجمهورية اليمنية", right, 8, { align: "right" });
  doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" });
  doc.text("فرع صنعاء", right, 18, { align: "right" });

  // Title boxes
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.rect(30, 30, w - 60, 16);
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", center, 40, { align: "center" });

  doc.setFontSize(14);
  doc.rect(30, 50, w - 60, 16);
  doc.text("كشف فرز حالات سوء التغذية للأطفال", center, 60, { align: "center" });

  // Instructions box
  const boxX = 25;
  const boxY = 80;
  const boxHeight = 110;
  const boxWidth = (w - 50) * 0.55;

  doc.setFillColor(245, 245, 245);
  doc.rect(boxX, boxY, boxWidth, boxHeight, "F");
  doc.setDrawColor(0, 0, 0);
  doc.rect(boxX, boxY, boxWidth, boxHeight);

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(14);
  doc.text("التعليمات", boxX + boxWidth - 2, boxY + 10, { align: "right" });

  doc.setFont("NotoNaskhArabic", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0);

  const instructions = [
    "في عمود هل يعاني الطفل من سوء تغذية يرجى اختيار: نعم / لا",
    "في حال كانت الإجابة لا يرجى كتابة قياس المواك في عمود قياس المواك",
    "في حال كان الطفل يعاني من سوء تغذية يرجى تعبئة جميع الأعمدة",
    "في عمود حالة الطفل حاليا يرجى اختيار: ١- سوء تغذية متوسط ٢- سوء تغذية حاد"
  ];

  let y = boxY + 20;
  const padding = 3;
  const maxWidth = boxWidth - 2 * padding;
  instructions.forEach(line => {
    doc.text(line, boxX + boxWidth - padding, y, { align: "right", maxWidth });
    y += 7;
  });

  // Right tables
  const tableX = boxX + boxWidth + 5;
  const tableWidth = (w - 50) - boxWidth - 5;
  const rowHeight = 10;
  const tableSpacing = 5;

  // Table 1: عدد الأطفال
  doc.setTextColor(0);
  doc.rect(tableX, boxY, tableWidth, rowHeight);
  doc.text("عدد الأطفال", tableX + tableWidth / 2, boxY + rowHeight / 2 + 3, { align: "center" });

  doc.rect(tableX, boxY + rowHeight, tableWidth, rowHeight);
  doc.text(String(bnfs.length), tableX + tableWidth / 2, boxY + rowHeight + rowHeight / 2 + 3, { align: "center" });

  // Table 2: عدد الحالات (empty)
  const table2Y = boxY + rowHeight * 2 + tableSpacing;
  doc.setTextColor(0);
  doc.rect(tableX, table2Y, tableWidth, rowHeight);
  doc.text("عدد الحالات", tableX + tableWidth / 2, table2Y + rowHeight / 2 + 3, { align: "center" });
  doc.rect(tableX, table2Y + rowHeight, tableWidth, rowHeight);

  // Educator info
  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(13);
  doc.text(`كود المثقفة: ${g.educatorCode}`, right, boxY + boxHeight, { align: "right" });
  doc.text(`اسم المثقفة: ${g.educatorName}`, right, boxY + boxHeight + 10, { align: "right" });
}

// ---------------- HEADER ----------------
function drawHeader(doc: jsPDF, page: number, totalPages: number, g: EducatorGroupInfo, startPageNumber: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - 10;
  const center = pageWidth / 2;

  drawSFDLogo(doc);
  drawPageBorder(doc);

  doc.setFont("NotoNaskhArabic", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("الجمهورية اليمنية", right, 8, { align: "right" });
  doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" });
  doc.text("فرع صنعاء", right, 18, { align: "right" });

  doc.text(`صفحة ${startPageNumber + page} من ${totalPages}`, right, 24, { align: "right" });

  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", center, 12, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("كشف فرز حالات سوء التغذية للأطفال", center, 18, { align: "center" });

  (doc as any).autoTable({
    startY: 28,
    head: [[
      "رقم الهاتف",
      "اسم المثقفة",
      "الكود",
      "القرية",
      "العزلة",
      "المديرية",
      "المحافظة"
    ]],
    body: [[
      g.educatorPhone,
      g.educatorName,
      g.educatorCode,
      g.village,
      g.uzla,
      g.district,
      g.governorate
    ]],
    theme: "grid",
    styles: {
      font: "NotoNaskhArabic",
      halign: "center",
      valign: "middle",
      fontSize: 9,
      lineColor: [0, 0, 0],
      textColor: 0,
      cellPadding: 3,
      minCellHeight: 8
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [240, 240, 240],
      lineColor: [0, 0, 0],
      textColor: 0,
      lineWidth: 0.1

    },
    margin: { right: 10, left: 10 }
  });

  return (doc as any).lastAutoTable?.finalY || 44;
}

// ---------------- FOOTER ----------------
function drawPageFooter(doc: jsPDF, educatorName: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const y = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`اسم المثقفة: ${educatorName}`, pageWidth - 15, y, { align: "right" });
  doc.rect(15, y - 5, 35, 20);
  doc.text("توقيع المثقفة", 32.5, y + 10, { align: "center" });
}

// ---------------- SUMMARY ----------------
function drawSummary(doc: jsPDF, bnfs: any[]) {
  const totalBeneficiaries = bnfs.length
  const discovered = bnfs.filter((b) => b.disc_date && b.disc_date !== "").length

  ;(doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 8,
    body: [["", "", discovered, "عدد الحالات المكتشفة", totalBeneficiaries, "اجمالي الأطفال"]],
    styles: {
      font: "NotoNaskhArabic",
      fontSize: 14,
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.9,
      textColor: 0,
      minCellHeight: 10
    },
    columnStyles: {
      1: { cellWidth: 50 },
      3: { fontStyle: "bold", fillColor: [240, 240, 240] },
      5: { fontStyle: "bold", fillColor: [240, 240, 240] }
    },
    margin: { left: 10, right: 10 }
  })
}

// ---------------- WORKER ----------------
self.onmessage = async (event) => {
  const { beneficiaries, fontBase64, sample } = event.data;
  if (!beneficiaries || !fontBase64) return postMessage({ type: "error", error: "Missing data or fonts." });

  const qualified = beneficiaries.filter((r: any) => r.cmam_qualify === "Qualified");
  const grouped: Record<string, any[]> = {};
  qualified.forEach((r: any) => {
    const key = `${r.ed_id}|${r.vill_name}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  const zip = new JSZip();
  const rowsPerPage = 7;

  for (const [groupKey, bnfs] of Object.entries(grouped)) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.addFileToVFS("Regular.ttf", fontBase64.regular);
    doc.addFileToVFS("Bold.ttf", fontBase64.bold);
    doc.addFont("Regular.ttf", "NotoNaskhArabic", "normal");
    doc.addFont("Bold.ttf", "NotoNaskhArabic", "bold");

    const first = bnfs[0];
    const g: EducatorGroupInfo = {
      educatorPhone: first.ed_phone || "",
      educatorName: first.ed_name || "",
      educatorCode: first.ed_id || "",
      village: first.vill_name || "",
      uzla: first.ozla_name || "",
      district: first.mud_name || "",
      governorate: first.gov_name || ""
    };

    // ---- Cover Page ----  
drawCoverPage(doc, bnfs, g);  

// ---- Content Pages ----  
const totalPages = Math.ceil(bnfs.length / rowsPerPage);  
const startPageNumber = 0; // page 1 starts after cover  

for (let i = 0; i < totalPages; i++) {  
  doc.addPage();  
  const startY = drawHeader(doc, i + 1, totalPages, g, startPageNumber);  

  const pageData = bnfs.slice(i * rowsPerPage, (i + 1) * rowsPerPage); 
      const body = pageData.map((r, idx) => [
        r.comments || "",
        r.near_health_center || "",
        r.disc_date || "",
        r.go_health_center || "",
        r.muac || "",
        r.child_cmam_type || "",
        r.child_has_cmam || "",
        r.new_child_age_mon || "",
        r.child_gender || "",
        r.child_name || "",
        r.bnf_name || "",
        r.child_id || "",
        r.benef_id || "",
        i * rowsPerPage + idx + 1
      ]);

      (doc as any).autoTable({
        startY: startY + 5,
        head: [[
              "ملاحظات",
              "اقرب مركز صحي للذهاب الية",
              "تاريخ اكتشاف الحالة",
              "هل يذهب الى المرفق الصحي",
              "قياس الموآك",
              "حالة الطفل حاليآ",
              "هل يعاني من سوء تغذية",
              "عمر الطفل",
              "جنس الطفل",
              "اسم الطفل",
              "اسم المستفيدة",
              "كود الطقل",
              "كود المستفيدة",
              "م"
        ]],
        body,
        theme: "grid",
        styles: {
          font: "NotoNaskhArabic",
          halign: "right",
          fontSize: 9,
          cellPadding: 3,
          minCellHeight: 15,
          lineColor: [0, 0, 0],
          textColor: 0,
          overflow: "linebreak"
        },
        headStyles: {
          halign: "center",
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        },
        margin: { left: 10, right: 10 }
      });

      drawPageFooter(doc, g.educatorName);
      if (i === totalPages - 1) drawSummary(doc, bnfs);
    }
    
    const safe = `${first.ed_name}-${first.vill_name}`.replace(/[\/\\?%*:|"<>]/g, "-")

    if (sample) {
      const buffer = doc.output("arraybuffer");
      self.postMessage({ type: "done-sample", data: buffer }, [buffer]);
      return;
    }

    zip.file(`${safe}.pdf`, doc.output("arraybuffer"))
  }

  const zipContent = await zip.generateAsync({ type: "arraybuffer" });
  self.postMessage({ type: "done-all", data: zipContent }, [zipContent]);
};