
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
};

async function getCachedData(cacheId: string) {
    const cacheDir = getTmpDir();
    const filePath = path.join(cacheDir, `${cacheId}.json`);
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
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
        const scoreA = a.Max_PairScore ?? -1;
        const scoreB = b.Max_PairScore ?? -1;
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }
        const clusterA = a.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
        const clusterB = b.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
        return clusterA - clusterB;
    });
}

function createFormattedWorkbook(data: EnrichedRecord[], cachedData: any): ExcelJS.Workbook {
    const { rows: allRecords, clusters, auditFindings, aiSummaries, originalHeaders } = cachedData;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Beneficiary Insights";
    
    createEnrichedDataSheet(wb, data, originalHeaders);
    createSummarySheet(wb, allRecords, clusters);
    createAllRecordsSheet(wb, allRecords, clusters);
    createClustersSheet(wb, clusters, aiSummaries);
    createAuditSheet(wb, auditFindings || []);

    return wb;
}

// ===============================================
// MAIN POST HANDLER
// ===============================================
export async function POST(req: Request) {
    try {
        const { step, cacheId, enrichedData: initialData } = await req.json();

        if (!cacheId) {
            return NextResponse.json({ error: "Cache ID is required." }, { status: 400 });
        }
        const cachedData = await getCachedData(cacheId);

        let enrichedData = initialData;

        if (step === 'enrich') {
            enrichedData = await enrichData(cachedData);
            return NextResponse.json({ enrichedData });
        }
        
        if (step === 'sort' || step === 'format') {
             if (!enrichedData) throw new Error("Enriched data not provided for sorting/formatting.");
             enrichedData = sortData(enrichedData);
             // In this simplified flow, sort and format are combined before download
             return NextResponse.json({ enrichedData });
        }

        if (step === 'download') {
            if (!enrichedData) throw new Error("Enriched data not provided for download.");
            
            // The final data sent from the client is already sorted.
            // We just need to format it and create the workbook.
            const wb = createFormattedWorkbook(enrichedData, cachedData);

            const buffer = await wb.xlsx.writeBuffer();
            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": "attachment; filename=formatted-beneficiary-report.xlsx",
                },
            });
        }

        return NextResponse.json({ error: "Invalid step provided." }, { status: 400 });

    } catch (error: any) {
        console.error('Failed during export step:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


// ===============================================
// EXCEL SHEET GENERATION FUNCTIONS
// ===============================================

function createEnrichedDataSheet(wb: ExcelJS.Workbook, data: EnrichedRecord[], originalHeaders: string[]) {
    const ws = wb.addWorksheet("Enriched Data");
    ws.views = [{ rightToLeft: true }];
    
    const newHeadersPrefix = ["Cluster_ID", "Cluster_Size", "Flag", "Max_PairScore", "pairScore", "nameScore", "husbandScore", "idScore", "phoneScore"];
    const newHeadersSuffix = ["womanName", "husbandName", "children", "nationalId", "phone", "village", "subdistrict"];
    const headersToExclude = new Set(newHeadersSuffix);
    const middleHeaders = originalHeaders.filter((h: string) => !headersToExclude.has(h));
    
    // Construct final headers, removing Max_PairScore as it's for sorting only
    const finalHeaders = [
        "Cluster_ID", "Cluster_Size", "Flag", /* "Max_PairScore" is removed */ "pairScore", "nameScore", "husbandScore", "idScore", "phoneScore",
        ...middleHeaders,
        ...newHeadersSuffix
    ];
    
    ws.columns = finalHeaders.map(h => ({ header: h, key: h, width: 20 }));

    ws.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { horizontal: 'center' };
    });

    ws.addRows(data);
    
    // Conditional formatting and borders
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const maxScoreCell = row.getCell('Max_PairScore');
        if (maxScoreCell.value === null || maxScoreCell.value === undefined) return;
        
        const score = Number(maxScoreCell.value);
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
        
        // Use a set to track unique beneficiary IDs within this cluster
        const seenBeneficiaryIds = new Set();
        
        const clusterKey = cluster.map(r => r._internalId).sort().join('-');
        const aiSummary = aiSummaries[clusterKey] || 'N/A';
        
        const recordsForSheet = cluster.filter(record => {
            if (seenBeneficiaryIds.has(record.beneficiaryId)) {
                return false;
            }
            seenBeneficiaryIds.add(record.beneficiaryId);
            return true;
        });

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
            ws.getRow(i).getCell('B').value = recordsForSheet[i - startRow].beneficiaryId; // Re-set beneficiary ID in the correct cell
            ws.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
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
      { header: "Beneficiary ID", key: "beneficiaryId", width: 20 },
      { header: "Affected Woman", key: "womanName", width: 25 },
      { header: "Affected Husband", key: "husbandName", width: 25 },
      { header: "National ID", key: "nationalId", width: 20 },
      { header: "Phone", key: "phone", width: 20 },
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
                beneficiaryId: record.beneficiaryId,
                ...record
            });
            const severityColor = finding.severity === 'high' ? 'FFFFC7CE' : finding.severity === 'medium' ? 'FFFFEB9C' : 'FFC6EFCE';
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severityColor } };
                cell.alignment = { horizontal: 'right' };
            });
        }
    }
}
