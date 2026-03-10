// src/workers/cmam-export.worker.ts
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

const drawHeader = (doc: jsPDF, page: number, totalPages: number, groupInfo: EducatorGroupInfo) => {
    // Fonts must be added to the doc instance before use
    const rightX = doc.internal.pageSize.getWidth() - 10;
    const leftX = 10;

    // Top Right: Government Info
    doc.setFont("NotoNaskhArabic", "bold");
    doc.setFontSize(8);
    doc.text("الجمهورية اليمنية", rightX, 8, { align: 'right' });
    doc.text("الصندوق الاجتماعي للتنمية فرع صنعاء", rightX, 12, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`صفحة ${page} من ${totalPages}`, rightX, 18, { align: 'right' });

    // Top Center: Title
    doc.setFontSize(12);
    doc.text("برنامج التحويلات النقدية المشروطة في التغذية", doc.internal.pageSize.getWidth() / 2, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text("كشف فرز حالات سوء التغذية للأطفال", doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    // Top Left: Logo Placeholder
    doc.setDrawColor(0);
    doc.rect(leftX, 8, 20, 10);
    doc.text("SFD Logo", leftX + 10, 14, { align: 'center' });

    // Info Boxes
    const startY = 22;
    const boxWidth = (doc.internal.pageSize.getWidth() - 20) / 4 - 2;
    
    const infoBoxes = [
        { label: "المحافظة:", value: groupInfo.governorate },
        { label: "كود المركز:", value: groupInfo.centerCode },
        { label: "المديرية:", value: groupInfo.district },
        { label: "اسم المركز:", value: groupInfo.centerName },
        { label: "العزلة:", value: groupInfo.uzla },
        { label: "الوحدة الصحية:", value: groupInfo.healthUnit },
        { label: "القرية/المحلة:", value: groupInfo.village },
        { label: "اسم المثقفة:", value: groupInfo.educatorName }
    ];

    let currentX = rightX;
    infoBoxes.forEach((box, i) => {
        if (i % 2 === 0 && i > 0) currentX = rightX; // Reset to right side
        if (i > 0) currentX -= boxWidth + 2;

        const valueWidth = boxWidth * 0.6;
        const labelWidth = boxWidth * 0.4;

        (doc as any).autoTable({
            startY: startY + Math.floor(i/2) * 6,
            margin: { right: rightX - currentX - valueWidth - labelWidth, left: 10 },
            body: [[{ content: box.value, styles: { halign: 'right' } }, { content: box.label, styles: { halign: 'right', fontStyle: 'bold' } }]],
            columnStyles: { 0: { cellWidth: valueWidth }, 1: { cellWidth: labelWidth } },
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.5, font: 'NotoNaskhArabic' }
        });
    });
};

const drawFooter = (doc: jsPDF, totalChildren: number, discoveredCases: number, educatorName: string) => {
    const startY = doc.internal.pageSize.getHeight() - 30;
    
    (doc as any).autoTable({
        startY,
        margin: { left: 10, right: 10 },
        body: [
            [{ content: `اجمالي الاطفال: ${totalChildren}`, styles: { halign: 'right' } }, { content: `عدد الحالات المكتشفة: ${discoveredCases}`, styles: { halign: 'right' } }]
        ],
        theme: 'plain',
        styles: { fontSize: 9, font: 'NotoNaskhArabic' }
    });

    const signatureY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(10);
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
             
             const groupInfo: EducatorGroupInfo = {
                governorate: beneficiaries[0].GOV_NAME || '', district: beneficiaries[0].MUD_NAME || '',
                uzla: beneficiaries[0].OZLA_NAME || '', village: beneficiaries[0].VILL_NAME || '',
                centerCode: beneficiaries[0].hc_id || '', centerName: beneficiaries[0].hc_name || '',
                healthUnit: '', educatorName: beneficiaries[0].ED_NAME || ''
             };
             drawHeader(doc, 1, 1, groupInfo);

             const body = beneficiaries.map((r: any, i: number) => ([
                i + 1, r.CHILD_LIST_STR || '', r.BENEF_NAME || '', r.BENEF_NO || '', r.BENEF_ID || '', 
                '', r.child_age || '', r.muac || '', '', r.bnf_cmam_cond || '', 
                r.conf_date || '', r.near_health_center || '', r.comments || ''
            ]));

            (doc as any).autoTable({
                startY: 40,
                head: [["م", "اسم الطفل", "اسم المستفيدة", "رقم المستفيدة", "كود المستفيدة", "جنس الطفل", "عمر الطفل", "قياس الذراع", "هل يعاني الطفل من امراض مزمنة", "الحالة التغذوية", "تاريخ الكشف الحالة", "اقرب مركز صحي", "ملاحظات"]],
                body: body,
                theme: 'grid',
                styles: { font: 'NotoNaskhArabic', halign: 'center', fontSize: 8, cellPadding: 1.5 },
                headStyles: { fillColor: [74, 107, 165], textColor: 255, fontStyle: 'bold' }
            });
            drawFooter(doc, beneficiaries.length, beneficiaries.length, groupInfo.educatorName);
            
            const pdfBuffer = doc.output("arraybuffer");
            self.postMessage({ type: 'done-sample', data: pdfBuffer }, [pdfBuffer]);
            return;
        }

        const groupedByEducator: Record<string, any[]> = {};
        beneficiaries.forEach((row: any) => {
            const eduKey = `${row.ED_ID || 'Unassigned'}_${row.VILL_NAME || 'Unassigned'}`;
            if (!groupedByEducator[eduKey]) groupedByEducator[eduKey] = [];
            groupedByEducator[eduKey].push(row);
        });

        const zip = new JSZip();
        const totalGroups = Object.keys(groupedByEducator).length;
        let groupsProcessed = 0;

        for (const [groupKey, bnfs] of Object.entries(groupedByEducator)) {
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
            
            // Assuming 20 rows per page including header
            const rowsPerPage = 15;
            const totalPages = Math.ceil(bnfs.length / rowsPerPage);

            for (let i = 0; i < totalPages; i++) {
                if (i > 0) doc.addPage();
                drawHeader(doc, i + 1, totalPages, groupInfo);
                const pageData = bnfs.slice(i * rowsPerPage, (i + 1) * rowsPerPage);

                 const body = pageData.map((r, idx) => ([
                    (i * rowsPerPage) + idx + 1,
                    // Child name parsing logic needed here if not a direct column
                    // For now, using CHILD_LIST_STR as a placeholder
                    r.CHILD_LIST_STR || '', 
                    r.BENEF_NAME || '', r.BENEF_NO || '', r.BENEF_ID || '', 
                    '', // Placeholder for gender
                    r.child_age || '', r.muac || '', '', // Placeholder for chronic disease
                    r.bnf_cmam_cond || '', 
                    r.conf_date || '', r.near_health_center || '', r.comments || ''
                ]));
                
                (doc as any).autoTable({
                    startY: 40,
                    head: [["م", "اسم الطفل", "اسم المستفيدة", "رقم المستفيدة", "كود المستفيدة", "جنس الطفل", "عمر الطفل", "قياس الذراع", "هل يعاني الطفل من امراض مزمنة", "الحالة التغذوية", "تاريخ الكشف الحالة", "اقرب مركز صحي", "ملاحظات"]],
                    body: body,
                    theme: 'grid',
                    styles: { font: 'NotoNaskhArabic', halign: 'center', fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
                    headStyles: { fillColor: [74, 107, 165], textColor: 255, fontStyle: 'bold' }
                });
                drawFooter(doc, bnfs.length, bnfs.length, groupInfo.educatorName);
            }
            
            const safeName = groupKey.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, "_").trim();
            zip.file(`${safeName}_CMAM_Statement.pdf`, doc.output("arraybuffer"));
            
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
