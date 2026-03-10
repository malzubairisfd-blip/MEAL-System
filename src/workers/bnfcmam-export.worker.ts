// src/workers/bnfcmam-export.worker.ts
import jsPDF from "jspdf";
import "jspdf-autotable";
import JSZip from "jszip";

// --- Types & Interfaces ---

interface EducatorGroupInfo {
    governorate: string;
    district: string;
    uzla: string;
    village: string;
    educatorCode: string;
    educatorName: string;
    educatorPhone: string;
}

// --- Helper Functions ---

function drawSFDLogo(doc: jsPDF, x: number, y: number) {
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

const drawHeader = (doc: jsPDF, page: number, totalPages: number, groupInfo: EducatorGroupInfo) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const rightX = pageWidth - 10;
    const centerX = pageWidth / 2;

    drawSFDLogo(doc, 10, 8);

    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("الجمهورية اليمنية", rightX, 8, { align: 'right' });
    doc.text("الصندوق الاجتماعي للتنمية", rightX, 13, { align: 'right' });
    doc.text("فرع صنعاء", rightX, 18, { align: 'right' });
    
    doc.setFontSize(10);
    doc.text(`صفحة ${page} من ${totalPages}`, rightX, 24, { align: 'right' });

    doc.setFontSize(13);
    doc.text("برنامج التحويلات النقدية المشروطة في التغذية", centerX, 12, { align: 'center' });
    doc.setFontSize(11);
    doc.text("كشف فرز حالات سوء التغذية للمستفيدات", centerX, 18, { align: 'center' });

    // Meta Info Table
    const metaTableBody = [
        [
            groupInfo.educatorCode, "كود المثقفة:",
            groupInfo.governorate, "المحافظة:"
        ],
        [
            groupInfo.educatorName, "اسم المثقفة:",
            groupInfo.district, "المديرية:"
        ],
        [
            groupInfo.educatorPhone, "رقم هاتف المثقفة:",
            groupInfo.uzla, "العزلة:"
        ],
        [
            "", "",
            groupInfo.village, "القرية / المدينة:"
        ]
    ];

    (doc as any).autoTable({
        startY: 28,
        body: metaTableBody,
        theme: 'plain',
        styles: { 
            font: 'NotoNaskhArabic', 
            halign: 'right', 
            fontSize: 9, 
            cellPadding: 0.5,
            textColor: [0, 0, 0]
        },
        columnStyles: {
            0: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
            1: { halign: 'right', cellWidth: 25 },
            2: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
            3: { halign: 'right', cellWidth: 25 },
        },
        margin: { right: 10 }
    });
};

const drawFooterSummary = (doc: jsPDF, bnfs: any[], educatorName: string) => {
    const lastY = (doc as any).lastAutoTable.finalY + 5;
    const pageWidth = doc.internal.pageSize.getWidth();

    const totalBeneficiaries = bnfs.length;
    const discoveredCases = bnfs.filter(b => b.bnf_cmam_cond && b.bnf_cmam_cond !== '').length;

    // Summary Table
    (doc as any).autoTable({
        startY: lastY,
        body: [
            [
                '', '', 
                discoveredCases, "عدد الحالات المكتشفة", 
                totalBeneficiaries, "اجمالي المستفيدات"
            ]
        ],
        theme: 'grid',
        styles: { font: 'NotoNaskhArabic', fontSize: 9, halign: 'center' },
        columnStyles: {
            1: { cellWidth: 80 }, // Spacer
            3: { fontStyle: 'bold', fillColor: [240, 240, 240] },
            5: { fontStyle: 'bold', fillColor: [240, 240, 240] }
        }
    });

    const legendY = (doc as any).lastAutoTable.finalY + 5;
    
    // Legend and Info
    const legendText = [
        "بيانات المثقفة",
        "عدد القرى: 1",
        `عدد المستفيدات: ${totalBeneficiaries}`,
        "عدد صفحات الكشف: " + Math.ceil(totalBeneficiaries / 15),
        "عمر الرضيع",
        "حالة المستفيدة: 1-حامل 2-مرضعة",
        "هل تعاني: 1-نعم 2-لا",
        "تذهب للمرفق: 1-نعم 2-لا"
    ];

    doc.setFontSize(8);
    let currentX = pageWidth - 15;
    legendText.forEach((text, i) => {
        doc.text(text, currentX, legendY + (i * 4), { align: 'right' });
    });

    // Signatures
    const sigY = legendY + 25;
    doc.setFontSize(10);
    doc.text("اسم المثقفة: " + educatorName, pageWidth - 15, sigY, { align: 'right' });
    doc.text("التوقيع: ...........................................", 50, sigY, { align: 'left' });
};

// --- WORKER LOGIC ---
self.onmessage = async (event) => {
    const { beneficiaries, fontBase64, sample } = event.data;

    if (!beneficiaries || !fontBase64) {
        postMessage({ type: 'error', error: 'Missing data or fonts.' });
        return;
    }
    
    const qualifiedBnfs = beneficiaries.filter((r: any) => r.cmam_qualify === 'Qualified');

    try {
        const groupedByEducatorAndVillage: Record<string, any[]> = {};
        qualifiedBnfs.forEach((row: any) => {
            const groupKey = `${row.ED_ID || 'Unassigned'}|${row.VILL_NAME || 'Unassigned'}`;
            if (!groupedByEducatorAndVillage[groupKey]) groupedByEducatorAndVillage[groupKey] = [];
            groupedByEducatorAndVillage[groupKey].push(row);
        });

        const zip = new JSZip();
        const groups = Object.entries(groupedByEducatorAndVillage);

        for (const [groupKey, bnfs] of groups) {
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            doc.addFileToVFS("Regular.ttf", fontBase64.regular);
            doc.addFileToVFS("Bold.ttf", fontBase64.bold);
            doc.addFont("Regular.ttf", "NotoNaskhArabic", "normal");
            doc.addFont("Bold.ttf", "NotoNaskhArabic", "bold");
            
            const firstCell = bnfs[0];
            const groupInfo: EducatorGroupInfo = {
                governorate: firstCell.GOV_NAME || '', 
                district: firstCell.MUD_NAME || '',
                uzla: firstCell.OZLA_NAME || '', 
                village: firstCell.VILL_NAME || '',
                educatorCode: firstCell.ED_ID || '', 
                educatorName: firstCell.ED_NAME || '',
                educatorPhone: firstCell.ED_TEL || ''
            };
            
            const rowsPerPage = 15;
            const totalPages = Math.ceil(bnfs.length / rowsPerPage);

            for (let i = 0; i < totalPages; i++) {
                if (i > 0) doc.addPage();
                drawHeader(doc, i + 1, totalPages, groupInfo);
                const pageData = bnfs.slice(i * rowsPerPage, (i + 1) * rowsPerPage);

                const tableBody = pageData.map((r, idx) => ([
                    r.notes || '',
                    r.near_health_center || '',
                    r.conf_date || '',
                    r.go_health_center || '', // 1-Yes, 2-No
                    r.muac || '',
                    r.preg_mon || '',
                    r.bnf_status_code || '', // 1-Pregnant, 2-Lactating
                    r.bnf_cmam_cond || '',
                    r.BENEF_TEL || '',
                    r.BENEF_NAME || '',
                    r.BENEF_ID || '',
                    (i * rowsPerPage) + idx + 1
                ]));

                (doc as any).autoTable({
                    startY: 55,
                    head: [[
                        "ملاحظات", 
                        "اقرب مركز صحي للذهاب الية", 
                        "تاريخ اكتشاف الحالة", 
                        "هل تذهب الى المرفق الصحي", 
                        "قياس الموآك", 
                        "شهر الحمل", 
                        "حالة المستفيدة حاليا", 
                        "هل تعاني من سوء تغذيا", 
                        "رقم الهاتف", 
                        "اسم المستفيدة", 
                        "كود المستفيدة", 
                        "م"
                    ]],
                    body: tableBody,
                    theme: 'grid',
                    styles: { font: 'NotoNaskhArabic', halign: 'right', fontSize: 8, cellPadding: 2 },
                    headStyles: { halign: 'center', fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1 }
                });

                if (i === totalPages - 1) {
                    drawFooterSummary(doc, bnfs, groupInfo.educatorName);
                }
            }
            
            if (sample) {
                const pdfBuffer = doc.output("arraybuffer");
                self.postMessage({ type: 'done-sample', data: pdfBuffer }, [pdfBuffer]);
                return;
            }

            const safeName = groupKey.replace(/[/\\?%*:|"<>]/g, '-');
            zip.file(`${safeName}.pdf`, doc.output("arraybuffer"));
        }
        
        const zipContent = await zip.generateAsync({ type: "arraybuffer" });
        self.postMessage({ type: 'done-all', data: zipContent }, [zipContent]);

    } catch (error: any) {
        postMessage({ type: 'error', error: error.message });
    }
};