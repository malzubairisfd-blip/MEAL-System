// src/workers/childcmam-export.worker.ts
import jsPDF from "jspdf";
import "jspdf-autotable";
import JSZip from "jszip";

// --- Types & Interfaces ---

interface CmamData {
    serial: number;
    childName: string;
    beneficiaryName: string;
    beneficiaryId: string;
    beneficiaryCode: string;
    childGender: string;
    childAge: string;
    muac: string;
    chronicDisease: string;
    nutritionStatus: string;
    detectionDate: string;
    nearestHealthCenter: string;
    notes: string;
}

interface EducatorGroupInfo {
    governorate: string;
    district: string;
    uzla: string;
    village: string;
    centerCode: string;
    centerName: string;
    healthUnit: string;
    educatorName: string;
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
    const rightX = doc.internal.pageSize.getWidth() - 10;

    drawSFDLogo(doc, 10, 8);
    
    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0,0,0);
    doc.text("الجمهورية اليمنية", rightX, 8, { align: 'right' });
    doc.text("الصندوق الاجتماعي للتنمية فرع صنعاء", rightX, 12, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`صفحة ${page} من ${totalPages}`, rightX, 18, { align: 'right' });

    doc.setFontSize(12);
    doc.text("برنامج التحويلات النقدية المشروطة في التغذية", doc.internal.pageSize.getWidth() / 2, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text("كشف فرز حالات سوء التغذية للأطفال", doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    const infoBoxes = [
        [{label: "المحافظة:", value: groupInfo.governorate}, {label: "كود المركز:", value: groupInfo.centerCode}],
        [{label: "المديرية:", value: groupInfo.district}, {label: "اسم المركز:", value: groupInfo.centerName}],
        [{label: "العزلة:", value: groupInfo.uzla}, {label: "الوحدة الصحية:", value: groupInfo.healthUnit}],
        [{label: "القرية/المحلة:", value: groupInfo.village}, {label: "اسم المثقفة:", value: groupInfo.educatorName}]
    ];

    let currentY = 22;
    infoBoxes.forEach(row => {
        const columns = row.map(cell => ({ title: cell.label, dataKey: cell.label}));
        const body = [row.map(cell => cell.value)];
        
        (doc as any).autoTable({
            startY: currentY,
            body: body,
            columns: columns,
            theme: 'grid',
            styles: { font: 'NotoNaskhArabic', halign: 'right', fontSize: 8, cellPadding: 1 },
            head: [columns.map(c => c.title)],
            headStyles: { fontStyle: 'bold' }
        });
        currentY = (doc as any).lastAutoTable.finalY;
    });

};

const drawFooter = (doc: jsPDF, educatorName: string) => {
    const signatureY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(10);
    doc.setFont("NotoNaskhArabic", "normal");
    doc.text("اسم المثقفة:", doc.internal.pageSize.getWidth() - 10, signatureY, { align: 'right' });
    doc.text(educatorName, doc.internal.pageSize.getWidth() - 30, signatureY, { align: 'right' });
    doc.text("التوقيع:", doc.internal.pageSize.getWidth() - 100, signatureY, { align: 'right' });
    doc.line(doc.internal.pageSize.getWidth() - 150, signatureY + 1, doc.internal.pageSize.getWidth() - 120, signatureY + 1);
};


// --- WORKER LOGIC ---
self.onmessage = async (event) => {
    const { beneficiaries, fontBase64, sample } = event.data;

    if (!beneficiaries || !fontBase64 || !fontBase64.regular || !fontBase64.bold) {
        postMessage({ type: 'error', error: 'Missing beneficiaries data or font files.' });
        return;
    }

    try {
        if (sample) {
             const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
             doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontBase64.regular);
             doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontBase64.bold);
             doc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
             doc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");
             
             const bnf = beneficiaries[0];
             const groupInfo: EducatorGroupInfo = {
                governorate: bnf.GOV_NAME || '', district: bnf.MUD_NAME || '',
                uzla: bnf.OZLA_NAME || '', village: bnf.VILL_NAME || '',
                centerCode: bnf.hc_id || '', centerName: bnf.hc_name || '',
                healthUnit: '', educatorName: bnf.ED_NAME || ''
             };
             drawHeader(doc, 1, 1, groupInfo);

             const body = beneficiaries.slice(0, 1).map((r: any, i: number) => ([
                i + 1, r.CHILD_LIST_STR || '', r.BENEF_NAME || '', r.BENEF_NO || '', r.BENEF_ID || '', 
                '', r.child_age || '', r.muac || '', '', r.bnf_cmam_cond || '', 
                r.conf_date || '', r.near_health_center || '', r.comments || ''
            ]));

            (doc as any).autoTable({
                startY: 50,
                head: [["م", "اسم الطفل", "اسم المستفيدة", "رقم المستفيدة", "كود المستفيدة", "جنس الطفل", "عمر الطفل", "قياس الذراع", "هل يعاني الطفل من امراض مزمنة", "الحالة التغذوية", "تاريخ الكشف الحالة", "اقرب مركز صحي", "ملاحظات"]],
                body: body,
                theme: 'grid',
                styles: { font: 'NotoNaskhArabic', halign: 'right', fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
                headStyles: { halign: 'center', fillColor: [74, 107, 165], textColor: 255, fontStyle: 'bold' }
            });
            drawFooter(doc, groupInfo.educatorName);
            
            const pdfBuffer = doc.output("arraybuffer");
            self.postMessage({ type: 'done-sample', data: pdfBuffer }, [pdfBuffer]);
            return;
        }

        const groupedByEducatorAndVillage: Record<string, any[]> = {};
        beneficiaries.forEach((row: any) => {
            const groupKey = `${row.ED_ID || 'Unassigned'}|${row.VILL_NAME || 'Unassigned'}`;
            if (!groupedByEducatorAndVillage[groupKey]) groupedByEducatorAndVillage[groupKey] = [];
            groupedByEducatorAndVillage[groupKey].push(row);
        });

        const zip = new JSZip();
        const totalGroups = Object.keys(groupedByEducatorAndVillage).length;
        let groupsProcessed = 0;

        for (const [groupKey, bnfs] of Object.entries(groupedByEducatorAndVillage)) {
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontBase64.regular);
            doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", fontBase64.bold);
            doc.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskhArabic", "normal");
            doc.addFont("NotoNaskhArabic-Bold.ttf", "NotoNaskhArabic", "bold");
            
            const groupInfo: EducatorGroupInfo = {
                governorate: bnfs[0].GOV_NAME || '', district: bnfs[0].MUD_NAME || '',
                uzla: bnfs[0].OZLA_NAME || '', village: bnfs[0].VILL_NAME || '',
                centerCode: bnfs[0].hc_id || '', centerName: bnfs[0].hc_name || '',
                healthUnit: '', educatorName: bnfs[0].ED_NAME || ''
            };
            
            const rowsPerPage = 15;
            const totalPages = Math.ceil(bnfs.length / rowsPerPage);

            for (let i = 0; i < totalPages; i++) {
                if (i > 0) doc.addPage();
                drawHeader(doc, i + 1, totalPages, groupInfo);
                const pageData = bnfs.slice(i * rowsPerPage, (i + 1) * rowsPerPage);

                 const body = pageData.map((r, idx) => ([
                    (i * rowsPerPage) + idx + 1,
                    r.CHILD_LIST_STR || '', 
                    r.BENEF_NAME || '', r.BENEF_NO || '', r.BENEF_ID || '', 
                    '',
                    r.child_age || '', r.muac || '', '',
                    r.bnf_cmam_cond || '', 
                    r.conf_date || '', r.near_health_center || '', r.comments || ''
                ]));
                
                (doc as any).autoTable({
                    startY: 50,
                    head: [["م", "اسم الطفل", "اسم المستفيدة", "رقم المستفيدة", "كود المستفيدة", "جنس الطفل", "عمر الطفل", "قياس الذراع", "هل يعاني الطفل من امراض مزمنة", "الحالة التغذوية", "تاريخ الكشف الحالة", "اقرب مركز صحي", "ملاحظات"]],
                    body: body,
                    theme: 'grid',
                    styles: { font: 'NotoNaskhArabic', halign: 'right', fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
                    headStyles: { halign: 'center', fillColor: [74, 107, 165], textColor: 255, fontStyle: 'bold' }
                });

                if (i === totalPages - 1) { // On the last page for this group
                    const totalInVillage = bnfs.length;
                    const discoveredInVillage = bnfs.filter(r => r.bnf_cmam_cond).length;
                    const lastAutoTableY = (doc as any).lastAutoTable.finalY;

                    (doc as any).autoTable({
                        startY: lastAutoTableY + 2,
                        body: [
                            [
                                { content: '', colSpan: 5, styles: { cellPadding: 1 } },
                                { content: discoveredInVillage, styles: { halign: 'center', fontStyle: 'bold' } },
                                { content: 'عدد الحالات المكتشفة', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                                { content: totalInVillage, styles: { halign: 'center', fontStyle: 'bold' } },
                                { content: 'اجمالي المستفيدات', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                            ],
                            [
                                { content: 'الملاحظات', colSpan: 13, styles: { cellPadding: { top: 4, bottom: 8 } } }
                            ]
                        ],
                        theme: 'grid',
                        styles: { font: 'NotoNaskhArabic', fontSize: 9, halign: 'right' }
                    });

                    drawFooter(doc, groupInfo.educatorName);
                }
            }
            
            const safeName = groupKey.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, "_").trim();
            zip.file(`${safeName}_Child_CMAM_Statement.pdf`, doc.output("arraybuffer"));
            
            groupsProcessed++;
            postMessage({
                type: 'progress',
                status: `Generating PDFs for ${safeName}...`,
                progress: Math.round((groupsProcessed / totalGroups) * 100),
                current: groupsProcessed,
                total: totalGroups
            });
        }
        
        postMessage({ type: 'progress', status: 'Zipping files...', progress: 99 });
        const zipContent = await zip.generateAsync({ type: "arraybuffer" });

        self.postMessage({ type: 'done-all', data: zipContent }, [zipContent]);

    } catch (error: any) {
        postMessage({ type: 'error', error: error.message });
    }
};
