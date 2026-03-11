// src/workers/confirmationbnfcmam-export.worker.ts

import jsPDF from "jspdf"
import "jspdf-autotable"
import JSZip from "jszip"

interface EducatorGroupInfo {
  location: string
  educatorCode: string
  educatorName: string
  educatorPhone: string
  hwname: string
  hwid: string
  hcname: string
  hcid: string
}

const ROWS_PER_PAGE = 8

function buildLocation(r: any) {
  return [r.GOV_NAME, r.MUD_NAME, r.OZLA_NAME, r.VILL_NAME].filter(Boolean).join(" - ")
}

// رسم شعار الصندوق
function drawSFDLogo(doc: jsPDF) {
  const x = 15
  const y = 8

  doc.setFillColor(40, 60, 80)
  doc.rect(x, y, 6, 15, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)

  doc.text("S", x + 3, y + 4, { align: "center" })
  doc.text("F", x + 3, y + 8, { align: "center" })
  doc.text("D", x + 3, y + 12, { align: "center" })

  doc.setFont("NotoNaskhArabic", "normal")
  doc.setTextColor(40, 60, 80)
  doc.setFontSize(10)

  doc.text("الصندوق", x + 8, y + 4)
  doc.text("الاجتماعي", x + 8, y + 9)
  doc.text("للتنمية", x + 8, y + 14)
}

// رسم رأس الصفحة
function drawHeader(doc: jsPDF, page: number, totalPages: number, g: EducatorGroupInfo) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const right = pageWidth - 10
  const center = pageWidth / 2

  drawSFDLogo(doc)

  doc.setFont("NotoNaskhArabic", "bold")
  doc.setFontSize(9)
  doc.text("الجمهورية اليمنية", right, 8, { align: "right" }, {textColor: [0, 0, 0]})
  doc.text("الصندوق الاجتماعي للتنمية", right, 13, { align: "right" }, {textColor: [0, 0, 0]})
  doc.text("فرع صنعاء", right, 18, { align: "right" }, {textColor: [0, 0, 0]})

  doc.setFontSize(10)
  doc.text(`صفحة ${page} من ${totalPages}`, right, 24, { align: "right" }, {textColor: [0, 0, 0]})

  doc.setFontSize(13)
  doc.text("برنامج التحويلات النقدية المشروطة في التغذية", center, 12, { align: "center" }, {textColor: [0, 0, 0]})

  doc.setFontSize(11)
  doc.text("كشف تأكيد حالات سوء التغذية للمستفيدات من قبل العامل الصحي", center, 18, { align: "center" })

  const HEADERS = [[
    "رقم هاتف المثقفة",
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
      g.educatorPhone,
      g.educatorName,
      g.educatorCode,
      g.hwname,
      g.hwid,
      g.hcname,
      g.hcid,
      g.location
    ]],
    tableWidth: "auto",
    styles: {
      font: "NotoNaskhArabic",
      fontSize: 9,
      textColor: [0, 0, 0],
      cellPadding: 3,
      lineColor: [0, 0, 0],
overflow:"visible",
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center"
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      halign: "center",
      textColor: [0, 0, 0],
    },
    columnStyles: {
      7: { cellWidth: 80, halign: "center" }
    },
    theme: "grid",
    margin: { left: 10, right: 10 }
  })

  return (doc as any).lastAutoTable.finalY
}

// رسم تذييل الصفحة
function drawFooter(doc: jsPDF, bnfs: any[], hwname: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const totalBeneficiaries = bnfs.length
  const discovered = bnfs.filter((b) => b.bnf_cmam_cond && b.bnf_cmam_cond !== "").length

  ;(doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 8,
    body: [[
      "", "",
      discovered,
      "عدد الحالات المكتشفة",
      totalBeneficiaries,
      "اجمالي المستفيدات"
    ]],
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

  const legendY = (doc as any).lastAutoTable.finalY + 5
  const legendLine1 = [
    "بيانات المثقفة",
    "عدد القرى: 1",
    `عدد المستفيدات: ${totalBeneficiaries}`,
    "عدد صفحات الكشف: " + Math.ceil(totalBeneficiaries / ROWS_PER_PAGE)
  ].join("     ")
  const legendLine2 = [
    "المتابعة (-1 مستمر بالمعالجة 2 - شفاء -3 تخلف -4 وفاة -5 عدم استجابة -6 إنتهاء فترة الدعم / تخريج من برنامج سوء التغذية -7 لم تحضر للمرفق الصحي)",
    "حالة المستفيدة: 1-حامل 2-مرضعة",
    "هل تعاني: 1-نعم 2-لا",
    "تذهب للمرفق: 1-نعم 2-لا"
  ].join("     ")

  doc.setFontSize(10)
  doc.text(legendLine1, pageWidth - 15, legendY, { align: "right" })
  doc.text(legendLine2, pageWidth - 15, legendY + 4, { align: "right" })

  const sigY = legendY + 20
  doc.setFontSize(12)
  doc.text("اسم العامل الصحي " + hwname, pageWidth - 15, sigY, { align: "right" })
  doc.text("................................ التوقيع", 40, sigY)
}

// Worker handler
self.onmessage = async (event: MessageEvent) => {
  const { beneficiaries, fontBase64 } = event.data
  if (!beneficiaries?.length) {
    postMessage({ type: "error", error: "No beneficiaries" })
    return
  }

  const qualified = beneficiaries.filter((r: any) => r.bnf_has_cmam === "نعم")
  const groups: Record<string, any[]> = {}

  for (const r of qualified) {
    const key = r.hc_id + "|" + r.VILL_NAME
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  }

  const zip = new JSZip()

  for (const key in groups) {
    const bnfs = groups[key]
    const first = bnfs[0]
    const g: EducatorGroupInfo = {
      educatorPhone: first.ed_phone || "",
      educatorName: first.ED_NAME || "",
      educatorCode: first.ED_ID || "",
      hwname: first.hw_name || "",
      hwid: first.hw_id || "",
      hcname: first.hc_name || "",
      hcid: first.hc_id || "",
      location: buildLocation(first)
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

    doc.addFileToVFS("Regular.ttf", fontBase64.regular)
    doc.addFileToVFS("Bold.ttf", fontBase64.bold)
    doc.addFont("Regular.ttf", "NotoNaskhArabic", "normal")
    doc.addFont("Bold.ttf", "NotoNaskhArabic", "bold")

    const pages = Math.ceil(bnfs.length / ROWS_PER_PAGE)
    for (let p = 0; p < pages; p++) {
      if (p > 0) doc.addPage()
      const headerY = drawHeader(doc, p + 1, pages, g)

      const slice = bnfs.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE)
      const body = slice.map((r: any, i: number) => [
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
        r.PHONE_NO || "",
        r.BENEF_NAME || "",
        r.BENEF_ID || "",
        p * ROWS_PER_PAGE + i + 1
      ])

;(doc as any).autoTable({
        startY: headerY + 5,
        head: [[
          "سبب عدم الذهاب للمرفق الصحي",
          "التاريخ المتوقع لانتهاء العلاج",
          "تاريخ بدء العلاج",
          "قياس MUAC",
          "عمر الرضيع",
          "شهر الحمل",
          "حالة المستفيدة حاليا",
          "رقم الكرت الحصري",
          "هل تعاني من سوء تغذية",
          "هل حضرت المستفيدة إلى المرفق",
          "تاريخ التاكيد",
          "رقم الهاتف",
          "اسم المستفيدة",
          "كود المستفيدة",
          "م"
        ]],
        body,
        tableWidth: "auto",
        theme: "grid",
        styles: {
          font: "NotoNaskhArabic",
          fontSize: 10,
          textColor: [0, 0, 0],
          fillColor: [255, 255, 255],
          cellPadding: 2,
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          halign: "center",
          overflow: "linebreak"
        },
        headStyles: {
          fillColor: [240, 240, 240],
          fontSize: 9,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          lineColor: [0, 0, 0],
          lineWidth: 0.2
        },
        margin: { left: 3, right: 3 }
      })

      if (p === pages - 1) {
        drawFooter(doc, bnfs, g.hwname)
      }
    }

    const safe = (g.hcname || "HC").replace(/[\/\\?%*:|"<>]/g, "-")
    zip.file(`${safe}.pdf`, doc.output("arraybuffer"))
  }

  const zipData = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 5 }
  })

  self.postMessage({ type: "done-all", data: zipData }, [zipData])
}