
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ExcelJS from "exceljs";
import { fullPairwiseBreakdown, type RecordRow } from "@/lib/fuzzyCluster";
import type { AuditFinding } from "@/lib/auditEngine";

const getTmpDir = () => path.join(os.tmpdir(), 'beneficiary-insights-cache');

type EnrichedRecord = RecordRow & {
    ClusterID?: number | null;
    Cluster_ID?: number | null;
    Cluster_Size?: number | null;
    Flag?: string | null;
    Max_PairScore?: number | null;
    pairScore?: number;
    nameScore?: number;
    husbandScore?: number;
    idScore?: number;
    phoneScore?: number;
    [key: string]: any; // Allow any other properties from the original file
};

async function getCachedData(cacheId: string) {
    const cacheDir = getTmpDir();
    const filePath = path.join(cacheDir, `${cacheId}.json`);
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        // The actual data is nested inside a 'data' property.
        return JSON.parse(fileContent).data;
    } catch (e) {
        throw new Error("Cache not found or expired. Please start from the upload step.");
    }
}

async function enrichData(cachedData: any): Promise<EnrichedRecord[]> {
    const { rows: allRecords, clusters } = cachedData;
    if (!allRecords || !clusters) {
        throw new Error("Invalid cache: missing rows or clusters.");
    }

    const recordMap = new Map<string, RecordRow>(allRecords.map((r: RecordRow) => [r._internalId!, r]));
    const enrichedRecords: EnrichedRecord[] = [];
    const clusterInfoMap = new Map<number, { maxScore: number, maxBeneficiaryId: number, size: number }>();

    // First pass: calculate max scores and sizes for each cluster
    clusters.forEach((cluster: RecordRow[], index: number) => {
        const clusterId = index + 1;
        const pairs = fullPairwiseBreakdown(cluster);
        const maxScore = pairs.reduce((max, p) => Math.max(max, p.score), 0);
        
        let maxBeneficiaryId = 0;
        cluster.forEach(r => {
             const beneficiaryId = Number(r.beneficiaryId);
             if (!isNaN(beneficiaryId) && beneficiaryId > maxBeneficiaryId) {
                maxBeneficiaryId = beneficiaryId;
             }
        });

        clusterInfoMap.set(clusterId, { maxScore, maxBeneficiaryId, size: cluster.length });
    });

    // Second pass: enrich each record
    allRecords.forEach((record: RecordRow) => {
        let enriched: EnrichedRecord = { ...record };
        let recordClusterId: number | null = null;
        let recordPairData: any = {};

        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            if (cluster.some((r: RecordRow) => r._internalId === record._internalId)) {
                recordClusterId = i + 1;
                const pairs = fullPairwiseBreakdown(cluster);
                const relevantPair = pairs.find(p => p.a._internalId === record._internalId || p.b._internalId === record._internalId);
                if (relevantPair) {
                    recordPairData = {
                        pairScore: relevantPair.score,
                        nameScore: relevantPair.breakdown.nameScore,
                        husbandScore: relevantPair.breakdown.husbandScore,
                        idScore: relevantPair.breakdown.idScore,
                        phoneScore: relevantPair.breakdown.phoneScore,
                    };
                } else {
                     recordPairData = {
                        pairScore: 0, nameScore: 0, husbandScore: 0, idScore: 0, phoneScore: 0
                    };
                }
                break;
            }
        }

        if (recordClusterId) {
            const clusterInfo = clusterInfoMap.get(recordClusterId)!;
            const flag = (score: number) => {
                if (score >= 0.9) return "m?";
                if (score >= 0.8) return "m";
                if (score >= 0.7) return "??";
                if (score > 0) return "?";
                return null;
            };

            enriched = {
                ...enriched,
                ...recordPairData,
                ClusterID: recordClusterId,
                Cluster_ID: clusterInfo.maxBeneficiaryId || recordClusterId,
                Cluster_Size: clusterInfo.size,
                Max_PairScore: clusterInfo.maxScore,
                Flag: flag(recordPairData.pairScore || 0),
            };
        }
        
        enrichedRecords.push(enriched);
    });
    
    return enrichedRecords;
}

function sortData(data: EnrichedRecord[]): EnrichedRecord[] {
    return data.sort((a, b) => {
        const clusterA = a.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
        const clusterB = b.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
        if (clusterA !== clusterB) {
            return clusterA - clusterB;
        }

        const scoreA = a.Max_PairScore ?? -1;
        const scoreB = b.Max_PairScore ?? -1;
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }
        
        return (a.beneficiaryId || "").localeCompare(b.beneficiaryId || "");
    });
}

function createFormattedWorkbook(data: EnrichedRecord[], cachedData: any): ExcelJS.Workbook {
    const { rows: allRecords, clusters, auditFindings, aiSummaries, originalHeaders } = cachedData;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Beneficiary Insights";
    
    createEnrichedDataSheet(wb, data, originalHeaders);
    createSummarySheet(wb, allRecords, clusters);
    createClustersSheet(wb, clusters, aiSummaries);
    createAuditSheet(wb, auditFindings || []);

    return wb;
}

// ===============================================
// MAIN POST HANDLER
// ===============================================
export async function POST(req: Request) {
    try {
        const { cacheId } = await req.json();

        if (!cacheId) {
            return NextResponse.json({ error: "Cache ID is required." }, { status: 400 });
        }
        const cachedData = await getCachedData(cacheId);

        // 1. Enrich
        let enrichedData = await enrichData(cachedData);
        
        // 2. Sort
        let sortedData = sortData(enrichedData);
        
        // 3. Format and Generate Workbook
        const wb = createFormattedWorkbook(sortedData, cachedData);

        // 4. Send back the file
        const buffer = await wb.xlsx.writeBuffer();
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": "attachment; filename=beneficiary-report-complete.xlsx",
            },
        });

    } catch (error: any) {
        console.error('Failed during export process:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


// ===============================================
// EXCEL SHEET GENERATION FUNCTIONS
// ===============================================

function createEnrichedDataSheet(wb: ExcelJS.Workbook, data: EnrichedRecord[], originalHeaders: string[]) {
    const ws = wb.addWorksheet("Enriched Data");
    ws.views = [{ rightToLeft: true }];
    
    const enrichmentHeaders = [
        "Cluster_ID", "Cluster_Size", "Flag", "pairScore", "nameScore", "husbandScore", "idScore", "phoneScore"
    ];
    
    const finalHeaders = [
        ...enrichmentHeaders,
        ...originalHeaders
    ];

    ws.columns = finalHeaders.map(h => ({
      header: h,
      key: h,
      width: h === 'womanName' || h === 'husbandName' || originalHeaders.includes(h) ? 25 : 15
    }));

    ws.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { horizontal: 'center' };
    });
    
    ws.addRows(data);
    
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        
        const rowData = data[rowNumber - 2];
        if (!rowData || rowData.Max_PairScore === null || rowData.Max_PairScore === undefined) return;
        
        const score = Number(rowData.Max_PairScore);
        let fillColor: string | undefined;
        let fontColor = 'FF000000';

        if (score >= 0.9) { fillColor = 'FFFF0000'; fontColor = 'FFFFFFFF'; } 
        else if (score >= 0.8) { fillColor = 'FFFFC7CE'; fontColor = 'FF9C0006'; } 
        else if (score >= 0.7) { fillColor = 'FFFFC000'; } 
        else if (score > 0) { fillColor = 'FFFFFF00'; }

        if (fillColor) {
            row.eachCell({ includeEmpty: true }, (cell) => {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
                  if (score >= 0.9) {
                      cell.font = { ...cell.font, bold: true, color: { argb: fontColor } };
                  }
            });
        }
    });

    let lastClusterId: number | string | null = null;
    for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        const cid = row.getCell('Cluster_ID').value;
        if (cid !== null && cid !== lastClusterId && lastClusterId !== null) {
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
        ws.getRow(currentRow).height = 45;
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

function createClustersSheet(wb: ExcelJS.Workbook, clusters: RecordRow[][], aiSummaries: { [key: string]: string } = {}) {
    const ws = wb.addWorksheet("Cluster Details");
    ws.views = [{ rightToLeft: true }];

    const headers = ["Cluster ID", "Beneficiary ID", "AI Summary", "Score", "Woman Name", "Husband Name", "National ID", "Phone", "Children"];
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
        
        const clusterKey = cluster.map(r => r._internalId).sort().join('-');
        const aiSummary = aiSummaries[clusterKey] || 'N/A';
        
        const recordsForSheet = [...cluster].sort((a,b) => (String(a.beneficiaryId) || '').localeCompare(String(b.beneficiaryId) || ''));
        
        if (recordsForSheet.length === 0) return;

        const startRow = currentRowIndex;
        const endRow = startRow + recordsForSheet.length - 1;

        recordsForSheet.forEach((record, recordIndex) => {
             const pair = pairs.find(p => p.a._internalId === record._internalId || p.b._internalId === record._internalId);
             const score = pair ? pair.score.toFixed(4) : '';
             ws.addRow({
                BeneficiaryID: record.beneficiaryId,
                Score: score,
                WomanName: record.womanName,
                HusbandName: record.husbandName,
                NationalID: record.nationalId,
                Phone: record.phone,
                Children: (record.children || []).join(', ')
            });
        });
        
        ws.mergeCells(`A${startRow}:A${endRow}`);
        const clusterIdCell = ws.getCell(`A${startRow}`);
        clusterIdCell.value = clusterId;
        clusterIdCell.alignment = { vertical: 'middle', horizontal: 'center' };

        ws.mergeCells(`C${startRow}:C${endRow}`);
        const summaryCell = ws.getCell(`C${startRow}`);
        summaryCell.value = aiSummary;
        summaryCell.alignment = { vertical: 'top', horizontal: 'right', wrapText: true };
        
        for (let i = startRow; i <= endRow; i++) {
            ws.getRow(i).getCell('B').value = recordsForSheet[i - startRow].beneficiaryId; // Re-set beneficiary ID
            const border: Partial<ExcelJS.Borders> = {
                top: { style: 'thin', color: {argb: 'FFD9D9D9'} },
                left: { style: 'thin', color: {argb: 'FFD9D9D9'} },
                bottom: { style: 'thin', color: {argb: 'FFD9D9D9'} },
                right: { style: 'thin', color: {argb: 'FFD9D9D9'} },
            };
            ws.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
                 cell.border = border;
            });
        }

        // Add thick outer border
        for (let i = startRow; i <= endRow; i++) {
            ws.getRow(i).getCell(1).border.left = { style: 'thick', color: {argb: 'FF4F81BD'} };
            ws.getRow(i).getCell(headers.length).border.right = { style: 'thick', color: {argb: 'FF4F81BD'} };
        }
        ws.getRow(startRow).eachCell({ includeEmpty: true }, c => c.border.top = { style: 'thick', color: {argb: 'FF4F81BD'} });
        ws.getRow(endRow).eachCell({ includeEmpty: true }, c => c.border.bottom = { style: 'thick', color: {argb: 'FF4F81BD'} });
        
        currentRowIndex = endRow + 1;
    });
}

function createAuditSheet(wb: ExcelJS.Workbook, findings: AuditFinding[]) {
    const ws = wb.addWorksheet("Audit Findings");
    ws.views = [{ rightToLeft: true }];
    
    const headers = [
      { header: "الخطورة", key: "severity", width: 12 },
      { header: "نوع النتيجة", key: "type", width: 30 },
      { header: "الوصف", key: "description", width: 50 },
      { header: "معرف المستفيد", key: "beneficiaryId", width: 20 },
      { header: "المرأة المتأثرة", key: "womanName", width: 25 },
      { header: "الزوج المتأثر", key: "husbandName", width: 25 },
      { header: "الرقم القومي", key: "nationalId", width: 20 },
      { header: "الهاتف", key: "phone", width: 20 },
    ];
    ws.columns = headers;
    
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC00000" } };
      cell.alignment = { horizontal: "center" };
    });

    const findingGroups = new Map<string, {finding: AuditFinding, records: RecordRow[]}>();

    findings.forEach(finding => {
        const key = `${finding.type}-${finding.description}`;
        if (!findingGroups.has(key)) {
            findingGroups.set(key, { finding, records: [] });
        }
        finding.records.forEach(r => findingGroups.get(key)!.records.push(r));
    });

    let currentRowIndex = 2;
    findingGroups.forEach(({ finding, records }) => {
        if (records.length === 0) return;

        const startRow = currentRowIndex;
        const endRow = startRow + records.length - 1;
        
        records.forEach(record => {
            const row = ws.addRow({
                severity: finding.severity,
                type: finding.type,
                description: finding.description,
                beneficiaryId: record.beneficiaryId,
                womanName: record.womanName,
                husbandName: record.husbandName,
                nationalId: record.nationalId,
                phone: record.phone
            });
            const severityColor = finding.severity === 'high' ? 'FFFFC7CE' : finding.severity === 'medium' ? 'FFFFEB9C' : 'FFC6EFCE';
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severityColor } };
                cell.alignment = { horizontal: 'right' };
            });
        });
        
        // Add thick outer border
        for (let i = startRow; i <= endRow; i++) {
            ws.getRow(i).getCell(1).border = { ...ws.getRow(i).getCell(1).border, left: { style: 'thick', color: {argb: 'FFC00000'} } };
            ws.getRow(i).getCell(headers.length).border = { ...ws.getRow(i).getCell(headers.length).border, right: { style: 'thick', color: {argb: 'FFC00000'} } };
        }
        ws.getRow(startRow).eachCell({ includeEmpty: true }, c => c.border = {...c.border, top: { style: 'thick', color: {argb: 'FFC00000'} } });
        ws.getRow(endRow).eachCell({ includeEmpty: true }, c => c.border = {...c.border, bottom: { style: 'thick', color: {argb: 'FFC00000'} } });
        
        currentRowIndex = endRow + 1;
    });
}
