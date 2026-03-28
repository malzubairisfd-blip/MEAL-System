// src/workers/bnfreferralcmam-export.worker.ts
import jsPDF from "jspdf"
import "jspdf-autotable"
import JSZip from "jszip"

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

const ROWS_PER_PAGE = 8

function buildLocation(r: any) {
  return [r.GOV_NAME, r.MUD_NAME, r.OZLA_NAME].filter(Boolean).join(" - ")
}

function drawSFDLogo(doc: jsPDF) {
  const logoX = 15
  const logoY = 8

  doc.setFillColor(40, 60, 80)
  doc.rect(logoX, logoY, 6, 15, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)

  doc.text("S", logoX + 3, logoY + 4, { align: "center" })
  doc.text("F", logoX + 3, logoY + 8, { align: "center" })
  doc.text("D", logoX + 3, logoY + 12, { align: "center" })

  doc.setFont("NotoNaskhArabic", "normal")
  doc.setTextColor(40, 60, 80)
  doc.setFontSize(10)

  doc.text("الصندوق", logoX + 8, logoY + 4)
  doc.text("الاجتماعي", logoX + 8, logoY + 9)
  doc.text("للتنمية", logoX + 8, logoY + 14)

  doc.setFontSize(6)
  doc.text("Social Fund for Development", logoX, logoY + 17)
}

function drawPageBorder(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  doc.setLineWidth(1.2)
  doc.setDrawColor(0, 0, 0)
  doc.rect(1, 1, w - 5, h - 5)
}

// --- Cover Page ---
function drawCoverPage(
  doc: jsPDF,
  hc_name: string,
  hw_id: string,
  hw_name: string,
  hcBeneficiaries: any[]
) {
  const w = doc.internal.pageSize.getWidth()
  const right = w - 10
  const center = w / 2

  drawPageBorder(doc)
  drawSFDLogo(doc)

  doc.setFont("NotoNaskhArabic", "bold")
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)

  doc.text("الجمهورية اليمنية", right, 8, { align: "right" })
  doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" })
  doc.text("فرع صنعاء", right, 18, { align: "right" })

  // Title boxes
  doc.rect(30, 30, w - 60, 16)
  doc.setFontSize(16)
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", center, 40, { align: "center" })

  doc.rect(30, 50, w - 60, 16)
  doc.setFontSize(14)
  doc.text("كشف امتثال المستفيدات إلى المرفق الصحي", center, 60, { align: "center" })

  doc.setFont("NotoNaskhArabic", "bold")
  doc.setFontSize(13)
  doc.text("المرفق الصحي: " + hc_name, center, 72, { align: "center" })



  // ===== bottom section: instructions + right tables =====
  const boxX = 25
  const boxY = 80
  const boxHeight = 110
  const boxWidth = (w - 50) * 0.55   // left side instructions, narrower
  const tableX = boxX + boxWidth + 5   // 5mm gap
  const tableWidth = (w - 50) - boxWidth - 5

  // draw instructions box
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
    "في عمود هل حضرت المستفيدة إلى المرفق الصحي يرجى اختيار: نعم / لا",
    "في حال كانت الإجابة لا يرجى كتابة السبب في عمود حالة المتابعة / سبب عدم الحظور",
    "في عمود هل تعاني المستفيدة من سوء تغذية يرجى اختيار: نعم / لا",
    "في حال كانت الإجابة لا يرجى كتابة قياس المواك في عمود قياس المواك",
    "في حال كانت المستفيدة تعاني من سوء تغذية يرجى تعبئة جميع الأعمدة",
    "وفي عمود حالة المتابعة / سبب عدم الحضور يرجى اختيار أحد الخيارات التالية:",
    "مستمر بالمعالجة",
    "شفاء",
    "تخلف",
    "الوفاة",
    "عدم استجابة",
    "انتهاء فترة الدعم / تخريج من برنامج سوء التغذية"
  ]

  let y = boxY + 20
  const padding = 3
  const maxWidth = boxWidth * padding
  for (const line of instructions) {
    doc.text(line, boxX + boxWidth - padding, y, { align: "right", maxWidth })
    y += 7
  }

  // ===== right side tables =====
  doc.setFont("NotoNaskhArabic", "bold")
  doc.setFontSize(12)

  const rowHeight = 10
  const tableSpacing = 5

  // --- Table 1: عدد المستفيدات ---
  const totalBeneficiaries = hcBeneficiaries.length
  doc.rect(tableX, boxY, tableWidth, rowHeight) // header
  doc.text("عدد المستفيدات", tableX + tableWidth / 2, boxY + rowHeight / 2 + 3, { align: "center" })

  doc.rect(tableX, boxY + rowHeight, tableWidth, rowHeight) // value
  doc.text(String(totalBeneficiaries || ""), tableX + tableWidth / 2, boxY + rowHeight + rowHeight / 2 + 3, { align: "center" })

  // --- Table 2: عدد الحالات ---
  const table2Y = boxY + rowHeight * 2 + tableSpacing
  doc.rect(tableX, table2Y, tableWidth, rowHeight) // header
  doc.text("عدد الحالات", tableX + tableWidth / 2, table2Y + rowHeight / 2 + 3, { align: "center" })

  doc.rect(tableX, table2Y + rowHeight, tableWidth, rowHeight) // value empty

  // Health worker info

  doc.setFont("NotoNaskhArabic", "bold")
  doc.setFontSize(13)
  doc.text(`كود العامل الصحي: ${hw_id}`, right, boxY + boxHeight, { align: "right" })
  doc.text(`اسم العامل الصحي: ${hw_name}`, right, boxY + boxHeight + 10, { align: "right" })
}

// --- Header ---
function drawHeader(doc: jsPDF, page: number, totalPages: number, g: EducatorGroupInfo) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const right = pageWidth - 10
  const center = pageWidth / 2

  drawSFDLogo(doc)
  drawPageBorder(doc)

  doc.setFont("NotoNaskhArabic", "bold")
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)

  doc.text("الجمهورية اليمنية", right, 8, { align: "right" })
  doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" })
  doc.text("فرع صنعاء", right, 18, { align: "right" })

  doc.setFontSize(10)
  doc.text(`صفحة ${page} من ${totalPages}`, right, 24, { align: "right" })

  doc.setFontSize(13)
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", center, 12, { align: "center" })

  doc.setFontSize(11)
  doc.text("كشف امتثال المستفيدات إلى المرفق الصحي", center, 18, { align: "center" })

  const HEADERS = [[
    "دورة المتابعة / الشهر",
    "اسم المثقفة",
    "كود المثقفة",
    "اسم العامل الصحي",
    "كود العامل الصحي",
    "اسم المرفق الصحي",
    "كود المرفق الصحي",
    "الموقع"
  ]]

  ;(doc as any).autoTable({
    startY: 28,
    head: HEADERS,
    body: [[
      `${g.selectedCycle} - ${g.selectedMonth}`,
      g.educatorName,
      g.educatorCode,
      g.hwname,
      g.hwid,
      g.hcname,
      g.hcid,
      g.location
    ]],
    tableWidth: "auto",
    theme: "grid",
    styles: {
      font: "NotoNaskhArabic",
      fontSize: 9,
      textColor: [0, 0, 0],
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      overflow: "visible",
      halign: "center"
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center"
    },
    columnStyles: {
      7: { cellWidth: 80, halign: "center" }
    },
    margin: { left: 10, right: 10 }
  })

  return (doc as any).lastAutoTable.finalY
}

// --- Footer ---
function drawPageFooter(doc: jsPDF, hwname: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const footerY = doc.internal.pageSize.getHeight() - 25

  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)

  doc.text("اسم العامل الصحي " + hwname, pageWidth - 15, footerY, { align: "right" })
  doc.text("................................ التوقيع", 60, footerY)

  doc.rect(15, footerY - 5, 35, 20)
  doc.text("ختم المركز", 32.5, footerY + 12, { align: "center" })
}

// --- Summary ---
function drawSummary(doc: jsPDF, bnfs: any[]) {
  const totalBeneficiaries = bnfs.length
  const discovered = bnfs.filter((b) => b.bnf_cmam_cond && b.bnf_cmam_cond !== "").length

  ;(doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 8,
    body: [["", "", discovered, "عدد الحالات المكتشفة", totalBeneficiaries, "اجمالي المستفيدات"]],
    styles: {
      font: "NotoNaskhArabic",
      fontSize: 14,
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.9,
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

// --- Worker ---
self.onmessage = async (event: MessageEvent) => {
  const { beneficiaries, fontBase64, selectedCycle, selectedMonth } = event.data;
  if (!beneficiaries?.length || !fontBase64 || !selectedCycle) {
    postMessage({ type: "error", error: "Missing data, fonts, or cycle." });
    return;
  }

  const cycle = Number(selectedCycle);

  const qualified = beneficiaries
    .filter((r: any) => {
      if (cycle === 1) return r.bnf_has_cmam === "نعم" && (r.next_cycle_c1 === 'Qualified' || r.next_cycle_c1 === null);
      if (cycle === 2) return r.next_cycle_c2 === 'Qualified';
      if (cycle === 3) return r.next_cycle_c3 === 'Qualified';
      return false;
    })
    .sort((a: any, b: any) => {
      const edCompare = String(a.ED_ID).localeCompare(String(b.ED_ID), "ar")
      if (edCompare !== 0) return edCompare
      return String(a.hw_name).localeCompare(String(b.hw_name), "ar")
    })

  const groups: Record<string, Record<string, Record<string, any[]>>> = {}

  for (const r of qualified) {
    const hc = r.hc_id || 'UNKNOWN_HC';
    const hw = r.hw_name || 'UNKNOWN_HW';
    const ed = r.ED_ID || 'UNKNOWN_ED';
    if (!groups[hc]) groups[hc] = {}
    if (!groups[hc][hw]) groups[hc][hw] = {}
    if (!groups[hc][hw][ed]) groups[hc][hw][ed] = []
    groups[hc][hw][ed].push(r)
  }

  const zip = new JSZip()

  for (const hc of Object.keys(groups)) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

    doc.addFileToVFS("Regular.ttf", fontBase64.regular)
    doc.addFileToVFS("Bold.ttf", fontBase64.bold)
    doc.addFont("Regular.ttf", "NotoNaskhArabic", "normal")
    doc.addFont("Bold.ttf", "NotoNaskhArabic", "bold")

    const hwGroups = groups[hc]
    const firstHW = Object.values(hwGroups)[0] as Record<string, any[]>
    const firstED = Object.values(firstHW)[0] as any[]
    const firstRecord = firstED?.[0]
    if (!firstRecord) continue

    const hcBeneficiaries = Object.values(hwGroups).flatMap(hw => Object.values(hw).flat())

    drawCoverPage(doc, firstRecord.hc_name || "", firstRecord.hw_id || "", firstRecord.hw_name || "", hcBeneficiaries)
    
    let startPageNumber = 1;

    for (const hw of Object.keys(hwGroups)) {
      const edGroups = hwGroups[hw]
      for (const ed of Object.keys(edGroups)) {
        const bnfs = edGroups[ed]
        const first = bnfs[0]

        const g: EducatorGroupInfo = {
          selectedCycle: String(selectedCycle),
          selectedMonth: selectedMonth || '',
          educatorName: first.ED_NAME || "",
          educatorCode: first.ED_ID || "",
          educatorPhone: first.ed_phone || '',
          hwname: first.hw_name || "",
          hwid: first.hw_id || "",
          hcname: first.hc_name || "",
          hcid: first.hc_id || "",
          location: buildLocation(first)
        }

        const totalPages = Math.ceil(bnfs.length / ROWS_PER_PAGE)

        for (let p = 0; p < totalPages; p++) {
          doc.addPage()
          const headerY = drawHeader(doc, p + 1, totalPages, g, startPageNumber)
          startPageNumber++;
          const slice = bnfs.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE)

          const body = slice.map((r: any, i: number) => [
            r[`not_attend_reason_c${cycle}`] || "",
            r[`cmam_result_c${cycle}`] || "",
            r[`hc_muac_c${cycle}`] || "",
            r[`bnf_child_age_c${cycle}`] || "",
            r[`bnf_preg_mon_c${cycle}`] || "",
            r[`bnf_cmam_cond_c${cycle}`] || "",
            r.hc_card_no || "",
            r[`date_attend_c${cycle}`] || "",
            r[`bnf_isprev_ref_c${cycle}`] || "",
            r[`bnf_attend_c${cycle}`] || "",
            r.PHONE_NO || "",
            r.BENEF_NAME || "",
            r.BENEF_ID || "",
            p * ROWS_PER_PAGE + i + 1
          ])

          ;(doc as any).autoTable({
            startY: headerY + 5,
            head: [[
              "سبب عدم الحظور", "نتبجة المتابعة", "قياس MUAC", "عمر الرضيع", "شهر الحمل", "حالة المستفيدة حاليا",
              "رقم الكرت الحصري", "تاريخ امتثال المستفيدة", "هل المستفيدة لاتزال تعاني من سوء تغذية", "هل امتثلت المستفيدة إلى المرفق",
              "رقم الهاتف", "اسم المستفيدة", "كود المستفيدة", "م"
            ]],
            body,
            tableWidth: "auto",
            theme: "grid",
            styles: {
              font: "NotoNaskhArabic", fontSize: 10, textColor: [0, 0, 0], fillColor: [255, 255, 255],
              cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, halign: "center", overflow: "linebreak"
            },
            headStyles: {
              fillColor: [240, 240, 240], fontSize: 9, textColor: [0, 0, 0], fontStyle: "bold",
              halign: "center", lineColor: [0, 0, 0], lineWidth: 0.2
            },
            margin: { left: 6, right: 6 }
          })

          drawPageFooter(doc, g.hwname)

          if (p === totalPages - 1) drawSummary(doc, bnfs)
        }
      }
    }

    const safe = `${firstRecord.hc_id}-${firstRecord.hc_name}`.replace(/[\/\\?%*:|"<>]/g, "-")
    zip.file(`${safe}.pdf`, doc.output("arraybuffer"))
  }

  const zipData = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 5 } })
  self.postMessage({ type: "done-all", data: zipData }, [zipData])
}
