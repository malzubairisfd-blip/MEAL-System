
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import type { AuditFinding } from "@/lib/auditEngine";
import { fullPairwiseBreakdown, type RecordRow } from "@/lib/fuzzyCluster";

type EnrichedRecord = RecordRow & {
    Cluster_ID?: number | null;
    ClusterSize?: number | null;
    Flag?: string | null;
    pairScore?: number;
};

// Main POST handler
export async function POST(req: Request) {
    try {
        const {
            enrichedData,
            clusters,
            allRecords,
            auditFindings,
            aiSummaries,
            originalHeaders,
        } = await req.json();

        if (!enrichedData || !clusters || !allRecords || !auditFindings || !originalHeaders) {
            return NextResponse.json({ error: "Missing required data for combined export." }, { status: 400 });
        }

        const wb = new ExcelJS.Workbook();
        wb.creator = "Beneficiary Insights";
        wb.created = new Date();

        createEnrichedDataSheet(wb, enrichedData, originalHeaders);
        createSummarySheet(wb, allRecords, clusters);
        createAllRecordsSheet(wb, allRecords, clusters);
        createClustersSheet(wb, clusters, aiSummaries);
        createAuditSheet(wb, auditFindings);

        const buffer = await wb.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": "attachment; filename=combined-beneficiary-report.xlsx",
            },
        });

    } catch (error: any) {
        console.error('Failed to generate combined export file', error);
        return NextResponse.json({ error: "Failed to generate Excel file: " + error.message }, { status: 500 });
    }
}

// --- Sheet Generation Functions ---

function createEnrichedDataSheet(wb: ExcelJS.Workbook, data: EnrichedRecord[], originalHeaders: string[]) {
    const ws = wb.addWorksheet("Enriched Data");
    ws.views = [{ rightToLeft: true }];

    const headers = [
        "Cluster_ID", "ClusterSize", "Flag", "pairScore", "nameScore",
        "husbandScore", "idScore", "phoneScore", "locationScore", "childrenScore",
        ...originalHeaders
    ];
    
    // Use a Set to avoid duplicate headers
    const uniqueHeaders = [...new Set(headers)];

    ws.columns = uniqueHeaders.map(h => ({
        header: h,
        key: h,
        width: ["womanName", "husbandName"].includes(h) ? 25 : 15
    }));
    
    ws.addRows(data);
    
    // Formatting
    ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: 'Arial' };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002060" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const scoreCell = row.getCell('pairScore');
        if (scoreCell.value === null || scoreCell.value === undefined) return;
        
        const score = Number(scoreCell.value);
        let fillColor: string | undefined;
        let fontColor = 'FF000000';

        if (score >= 0.9) { fillColor = 'FFFF0000'; fontColor = 'FFFFFFFF'; } 
        else if (score >= 0.8) { fillColor = 'FFFFC7CE'; } 
        else if (score >= 0.7) { fillColor = 'FFFFC000'; } 
        else if (score > 0) { fillColor = 'FFFFFF00'; }

        if (fillColor) {
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
                cell.font = { ...cell.font, bold: true, color: { argb: fontColor } };
                cell.alignment = { ...cell.alignment, horizontal: 'right' };
            });
        }
    });

    let lastClusterId: number | string | null = null;
    for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        const cid = row.getCell('Cluster_ID').value;
        if (cid !== null && cid !== lastClusterId) {
            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = { ...cell.border, top: { style: 'thick', color: { argb: 'FF002060' } } };
            });
        }
        lastClusterId = cid;
    }
}

function createSummarySheet(wb: ExcelJS.Workbook, allRecords: RecordRow[], clusters: RecordRow[][]) {
    const ws = wb.addWorksheet("Review Summary");
    ws.views = [{ rightToLeft: true }];
    
    ws.columns = [ { width: 5 }, { width: 25 }, { width: 5 }, { width: 5 }, { width: 25 }, { width: 5 }];

    ws.mergeCells('B2:E2');
    const titleCell = ws.getCell('B2');
    titleCell.value = "تقرير مراجعة المجموعات";
    titleCell.font = { size: 24, bold: true, name: 'Calibri' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 40;

    const totalRecords = allRecords.length;
    const clusteredRecordsCount = clusters.flat().length;
    const numClusters = clusters.length;
    const statsData = [
        [{ title: "إجمالي السجلات المعالجة", value: totalRecords, icon: "👥" }, { title: "عدد المجموعات", value: numClusters, icon: "📂" }],
        [{ title: "السجلات المجمعة", value: clusteredRecordsCount, icon: "🔗" }, { title: "السجلات غير المجمعة", value: totalRecords - clusteredRecordsCount, icon: "👤" }],
        [{ title: "متوسط حجم المجموعة", value: numClusters > 0 ? (clusteredRecordsCount / numClusters).toFixed(2) : 0, icon: "📊" }, null]
    ];
    
    let currentRow = 4;
    statsData.forEach(rowItems => {
        rowItems.forEach((stat, colIndex) => {
            if (!stat) return;
            const startColNum = colIndex === 0 ? 2 : 5;
            ws.mergeCells(currentRow, startColNum, currentRow + 3, startColNum + 1);
            const cardCell = ws.getCell(currentRow, startColNum);
            cardCell.value = { richText: [ { text: `${stat.icon}\n`, font: { size: 36, name: 'Segoe UI Emoji' } }, { text: `${stat.title}\n`, font: { size: 14 } }, { text: `${stat.value}`, font: { size: 24, bold: true } } ] };
            cardCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cardCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2FF' } };
            cardCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        currentRow += 5;
    });
}


function createAllRecordsSheet(wb: ExcelJS.Workbook, allRecords: RecordRow[], clusters: RecordRow[][]) {
  const ws = wb.addWorksheet("All Records");
  ws.views = [{ rightToLeft: true }];
  
  const recordToClusterIdMap = new Map<string, number>();
  clusters.forEach((cluster, index) => {
    cluster.forEach(record => recordToClusterIdMap.set(record._internalId!, index + 1));
  });

  const headers = Object.keys(allRecords[0] || {}).filter(h => h !== '_internalId');
  ws.columns = [ { header: "Cluster ID", key: "clusterId", width: 15 }, ...headers.map(h => ({ header: h, key: h, width: 25 }))];
  
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }};
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
  headerRow.alignment = { horizontal: 'center' };

  allRecords.forEach(record => {
    const clusterId = recordToClusterIdMap.get(record._internalId!) || '';
    ws.addRow({ ...record, clusterId });
  });
}


function createClustersSheet(wb: ExcelJS.Workbook, clusters: RecordRow[][], aiSummaries: { [key: number]: string }) {
    const ws = wb.addWorksheet("Cluster Details");
    ws.views = [{ rightToLeft: true }];

    const headers = ["Cluster ID", "AI Summary", "Score", "Woman Name", "Husband Name", "National ID", "Phone", "Children"];
    ws.columns = headers.map(h => ({ header: h, key: h.replace(/\s/g, ''), width: h === 'AI Summary' ? 60 : 25 }));
    
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    headerRow.alignment = { horizontal: 'center' };

    let currentRowIndex = 2;
    clusters.forEach((cluster, index) => {
        const clusterId = index + 1;
        const pairs = fullPairwiseBreakdown(cluster);
        if (pairs.length === 0 && cluster.length < 2) return;
        
        const clusterRowCount = Math.max(1, pairs.length * 2);
        const startRow = currentRowIndex;
        const endRow = startRow + clusterRowCount - 1;
        
        if (pairs.length > 0) {
            pairs.forEach(pair => {
                ws.addRow({ Score: pair.score.toFixed(4), WomanName: pair.a.womanName, HusbandName: pair.a.husbandName, NationalID: pair.a.nationalId, Phone: pair.a.phone, Children: (pair.a.children || []).join(', ') });
                ws.addRow({ Score: '', WomanName: pair.b.womanName, HusbandName: pair.b.husbandName, NationalID: pair.b.nationalId, Phone: pair.b.phone, Children: (pair.b.children || []).join(', ') });
            });
        } else {
             cluster.forEach(record => {
                ws.addRow({ Score: '', WomanName: record.womanName, HusbandName: record.husbandName, NationalID: record.nationalId, Phone: record.phone, Children: (record.children || []).join(', ') });
            });
        }
        
        ws.mergeCells(`A${startRow}:A${endRow}`);
        const clusterIdCell = ws.getCell(`A${startRow}`);
        clusterIdCell.value = clusterId;
        clusterIdCell.alignment = { vertical: 'middle', horizontal: 'center' };

        ws.mergeCells(`B${startRow}:B${endRow}`);
        const summaryCell = ws.getCell(`B${startRow}`);
        summaryCell.value = aiSummaries[clusterId] || '';
        summaryCell.alignment = { vertical: 'top', horizontal: 'right', wrapText: true };
        
        for (let i = startRow; i <= endRow; i++) {
            const row = ws.getRow(i);
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const border: Partial<ExcelJS.Borders> = {};
                if (i === startRow) border.top = { style: 'thick', color: { argb: 'FF4F81BD' } };
                if (i === endRow) border.bottom = { style: 'thick', color: { argb: 'FF4F81BD' } };
                if (colNumber === 1) border.left = { style: 'thick', color: { argb: 'FF4F81BD' } };
                if (colNumber === ws.columns.length) border.right = { style: 'thick', color: { argb: 'FF4F81BD' } };
                cell.border = { ...cell.border, ...border };
            });
        }
        
        currentRowIndex = endRow + 1;
    });
}

function createAuditSheet(wb: ExcelJS.Workbook, findings: AuditFinding[]) {
    const ws = wb.addWorksheet("Audit Findings");
    ws.views = [{ rightToLeft: true }];
    
    ws.columns = [
      { header: "Severity", key: "severity", width: 12 },
      { header: "Finding Type", key: "type", width: 30 },
      { header: "Description", key: "description", width: 50 },
      { header: "Affected Woman", key: "womanName", width: 25 },
      { header: "Affected Husband", key: "husbandName", width: 25 },
      { header: "National ID", key: "nationalId", width: 20 },
      { header: "Phone", key: "phone", width: 20 },
      { header: "Village", key: "village", width: 20 },
    ];
    
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC00000" } };
      cell.alignment = { horizontal: "center" };
    });

    for (const finding of findings) {
        for (const record of finding.records) {
            const row = ws.addRow({
                severity: finding.severity,
                type: finding.type,
                description: finding.description,
                ...record
            });
            const severityColor = finding.severity === 'high' ? 'FFFFC7CE' : finding.severity === 'medium' ? 'FFFFEB9C' : 'FFC6EFCE';
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severityColor } };
                cell.alignment = { horizontal: 'right' };
            });
        }
        ws.addRow([]).eachCell(cell => cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFDDDDDD'}});
    }
}

    