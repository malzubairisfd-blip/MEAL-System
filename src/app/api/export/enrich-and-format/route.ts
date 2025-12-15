
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ExcelJS from "exceljs";
import { fullPairwiseBreakdown } from "@/lib/fuzzyCluster";
import type { AuditFinding } from "@/lib/auditEngine";
import type { RecordRow } from "@/lib/types";
import { generateArabicClusterSummary } from '@/lib/arabicClusterSummary';
import { calculateClusterConfidence } from '@/lib/clusterConfidence';


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
    womanName_normalized?: string;
    husbandName_normalized?: string;
    [key: string]: any;
};

function normalizeArabic(s: string): string {
  if (!s) return "";
  s = s.normalize("NFKC");
  s = s.replace(/يحيي/g, "يحي");
  s = s.replace(/يحيى/g, "يحي");
  s = s.replace(/عبد /g, "عبد");
  s = s.replace(/[ًٌٍََُِّْـء]/g, "");
  s = s.replace(/[أإآ]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ؤ/g, "و");
  s = s.replace(/ئ/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/[^ء-ي0-9 ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
}


async function getCachedData(cacheId: string) {
    const cacheDir = getTmpDir();
    const filePath = path.join(cacheDir, `${cacheId}.json`);

    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (!parsed.rows || !parsed.clusters) {
            throw new Error("Cache corrupted: rows or clusters missing.");
        }
        return parsed;
    } catch (e: any) {
        if (e.code === 'ENOENT') {
             throw new Error(`Cache file not found for ID: ${cacheId}. Please re-upload your file.`);
        }
        throw new Error(`Cache not found or expired. Please re-upload your file. Details: ${e.message}`);
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

    clusters.forEach((clusterObj: { records: RecordRow[] }, index: number) => {
        const clusterId = index + 1;
        const clusterRecords = clusterObj.records;
        const pairs = fullPairwiseBreakdown(clusterRecords);
        const maxScore = pairs.reduce((max, p) => Math.max(max, p.score), 0);
        
        let maxBeneficiaryId = 0;
        clusterRecords.forEach(r => {
             const beneficiaryId = Number(r.beneficiaryId);
             if (!isNaN(beneficiaryId) && beneficiaryId > maxBeneficiaryId) {
                maxBeneficiaryId = beneficiaryId;
             }
        });

        clusterInfoMap.set(clusterId, { maxScore, maxBeneficiaryId, size: clusterRecords.length });
    });

    allRecords.forEach((record: RecordRow) => {
        let enriched: EnrichedRecord = { 
            ...record,
            womanName_normalized: normalizeArabic(record.womanName || ''),
            husbandName_normalized: normalizeArabic(record.husbandName || ''),
        };
        let recordClusterId: number | null = null;
        let recordPairData: any = {};

        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i].records;
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
        const scoreA = a.Max_PairScore ?? -1;
        const scoreB = b.Max_PairScore ?? -1;
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }

        const clusterA = a.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
        const clusterB = b.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
        if (clusterA !== clusterB) {
            return clusterA - clusterB;
        }
        
        return (String(a.beneficiaryId) || "").localeCompare(String(b.beneficiaryId) || "");
    });
}

function createFormattedWorkbook(data: EnrichedRecord[], cachedData: any): ExcelJS.Workbook {
    const { rows: allRecords, clusters, auditFindings, originalHeaders } = cachedData;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Beneficiary Insights";
    
    createEnrichedDataSheet(wb, data, originalHeaders);
    createSummarySheet(wb, allRecords, clusters);
    createAuditSummarySheet(wb, auditFindings || []);
    createClustersSheet(wb, clusters);
    createAuditSheet(wb, auditFindings || [], clusters);

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

        let enrichedData = await enrichData(cachedData);
        
        let sortedData = sortData(enrichedData);
        
        const wb = createFormattedWorkbook(sortedData, cachedData);

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
        "Cluster_ID", "Cluster_Size", "Flag", "pairScore", "Max_PairScore", "nameScore", "husbandScore", "idScore", "phoneScore"
    ];
    
    const normalizedHeaders = [ "womanName_normalized", "husbandName_normalized" ];

    const finalHeaders = [ ...enrichmentHeaders, ...originalHeaders, ...normalizedHeaders ];

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

        if (score >= 0.9) { fillColor = 'FFFF0000'; } 
        else if (score >= 0.8) { fillColor = 'FFFFC7CE'; } 
        else if (score >= 0.7) { fillColor = 'FFFFC000'; } 
        else if (score > 0) { fillColor = 'FFFFFF00'; }

        if (fillColor) {
            row.eachCell({ includeEmpty: true }, (cell) => {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
                  if (score >= 0.9) {
                      cell.font = { ...cell.font, bold: true, color: { argb: 'FFFFFFFF' } };
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

function createSummarySheet(wb: ExcelJS.Workbook, allRecords: RecordRow[], clusters: {records: RecordRow[]}[]) {
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
    const clusteredRecordsCount = clusters.reduce((acc, c) => acc + c.records.length, 0);
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

function createClustersSheet(wb: ExcelJS.Workbook, clusters: {records: RecordRow[], reasons: string[]}[]) {
    const ws = wb.addWorksheet("Cluster Details");
    ws.views = [{ rightToLeft: true }];

    const headers = ["Cluster ID", "AI Summary", "Beneficiary ID", "Score", "Woman Name", "Husband Name", "National ID", "Phone", "Children"];
    ws.columns = headers.map(h => ({ 
        header: h, 
        key: h.replace(/\s/g, ''), 
        width: h === 'AI Summary' ? 50 : (h === 'Woman Name' || h === 'Husband Name' ? 25 : 15)
    }));
    
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    headerRow.alignment = { horizontal: 'center' };

    let currentRowIndex = 2;
    clusters.forEach((clusterObj, index) => {
        const clusterRecords = clusterObj.records;
        const clusterId = index + 1;
        const pairs = fullPairwiseBreakdown(clusterRecords);
        if (pairs.length === 0 && clusterRecords.length < 2) return;

        const recordsForSheet = [...clusterRecords].sort((a,b) => (String(a.beneficiaryId) || '').localeCompare(String(b.beneficiaryId) || ''));
        if (recordsForSheet.length === 0) return;

        const womanNameScores = pairs.map((p: any) => p.breakdown.nameScore || 0);
        const husbandNameScores = pairs.map((p: any) => p.breakdown.husbandScore || 0);
        const avgWomanNameScore = womanNameScores.length > 0 ? womanNameScores.reduce((a: number, b: number) => a + b, 0) / womanNameScores.length : 0;
        const avgHusbandNameScore = husbandNameScores.length > 0 ? husbandNameScores.reduce((a: number, b: number) => a + b, 0) / husbandNameScores.length : 0;
        const avgFinalScore = (avgWomanNameScore + avgHusbandNameScore) / 2;
        const confidence = calculateClusterConfidence(avgWomanNameScore, avgHusbandNameScore);
        
        const clusterObjectForSummary = {
            records: clusterRecords,
            reasons: clusterObj.reasons || [],
            avgWomanNameScore,
            avgHusbandNameScore,
            avgFinalScore,
            confidence,
        };

        const summaryResult = generateArabicClusterSummary(clusterObjectForSummary, clusterRecords);
        const summaryText = summaryResult.replace(/<br\s*\/?>/gi, '\r\n').replace(/<[^>]*>?/gm, '').trim();

        const startRow = currentRowIndex;
        const endRow = startRow + recordsForSheet.length - 1;

        let rowHeight = 40; // Default
        const clusterSize = recordsForSheet.length;
        if (clusterSize === 2) rowHeight = 142;
        if (clusterSize === 3) rowHeight = 95;
        if (clusterSize === 4) rowHeight = 76;

        recordsForSheet.forEach((record, recordIndex) => {
             const pair = pairs.find(p => p.a._internalId === record._internalId || p.b._internalId === record._internalId);
             const score = pair ? pair.score.toFixed(4) : '';
             const childrenText = Array.isArray(record.children) ? record.children.join(', ') : record.children || '';
             
             let rowData: any = {
                BeneficiaryID: record.beneficiaryId,
                Score: score,
                WomanName: record.womanName,
                HusbandName: record.husbandName,
                NationalID: record.nationalId,
                Phone: record.phone,
                Children: childrenText
            };
            
            if (recordIndex === 0) {
                rowData['AISummary'] = summaryText;
            }

            ws.addRow(rowData);
        });
        
        ws.mergeCells(`A${startRow}:A${endRow}`);
        const clusterIdCell = ws.getCell(`A${startRow}`);
        clusterIdCell.value = clusterId;
        clusterIdCell.alignment = { vertical: 'top', horizontal: 'center' };
        
        ws.mergeCells(`B${startRow}:B${endRow}`);
        const summaryCell = ws.getCell(`B${startRow}`);
        summaryCell.alignment = { vertical: 'top', horizontal: 'right', wrapText: true };


        for (let i = startRow; i <= endRow; i++) {
            const row = ws.getRow(i);
            row.height = rowHeight;
            row.getCell('C').value = recordsForSheet[i - startRow].beneficiaryId;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const border: Partial<ExcelJS.Borders> = {};
                if (i === startRow) border.top = { style: 'thick', color: {argb: 'FF4F81BD'} };
                if (i === endRow) border.bottom = { style: 'thick', color: {argb: 'FF4F81BD'} };
                
                cell.border = { ...cell.border, ...border };

                const key = (ws.columns[colNumber - 1].key || '').replace(/\s/g, '');
                if (['ClusterID', 'BeneficiaryID', 'Score', 'NationalID', 'Phone', 'Children'].includes(key)) {
                    cell.alignment = { ...cell.alignment, vertical: 'middle', horizontal: 'center' };
                } else if (['WomanName', 'HusbandName'].includes(key)) {
                    cell.alignment = { ...cell.alignment, vertical: 'middle', horizontal: 'right' };
                }
            });
        }
        
        currentRowIndex = endRow + 1;
    });
}


function createAuditSheet(wb: ExcelJS.Workbook, findings: AuditFinding[], clusters: {records: RecordRow[]}[]) {
    const ws = wb.addWorksheet("Audit Findings");
    ws.views = [{ rightToLeft: true }];
    
    const recordToClusterIdMap = new Map<string, number>();
    clusters.forEach((clusterObj, index) => {
        clusterObj.records.forEach(record => {
            recordToClusterIdMap.set(record._internalId!, index + 1);
        });
    });

    const headers = [
      { header: "Severity", key: "severity", width: 12 },
      { header: "Finding Type", key: "type", width: 30 },
      { header: "Description", key: "description", width: 50 },
      { header: "Cluster ID", key: "clusterId", width: 15 },
      { header: "Beneficiary ID", key: "beneficiaryId", width: 20 },
      { header: "Woman Name", key: "womanName", width: 25 },
      { header: "Husband Name", key: "husbandName", width: 25 },
      { header: "National ID", key: "nationalId", width: 20 },
      { header: "Phone", key: "phone", width: 20 },
    ];
    ws.columns = headers;
    
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC00000" } };
      cell.alignment = { horizontal: "center" };
    });

    const severityOrder = { high: 1, medium: 2, low: 3 };
    const sortedFindings = [...findings].sort((a, b) => {
      return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
    });

    let lastFindingType = '';
    sortedFindings.forEach(finding => {
        if (lastFindingType && lastFindingType !== finding.type) {
            ws.addRow([]).eachCell(cell => {
                cell.border = { top: { style: 'thin', color: { argb: 'FF808080' } } };
            });
        }
        lastFindingType = finding.type;

        finding.records.forEach(record => {
            const clusterId = recordToClusterIdMap.get(record._internalId!) || 'N/A';
            const row = ws.addRow({
                severity: finding.severity,
                type: finding.type.replace(/_/g, ' '),
                description: finding.description,
                clusterId: clusterId,
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
    });
}

function createAuditSummarySheet(wb: ExcelJS.Workbook, findings: AuditFinding[]) {
    const ws = wb.addWorksheet("Audit Summary");
    ws.views = [{ rightToLeft: true }];
    
    ws.columns = [ { width: 5 }, { width: 25 }, { width: 5 }, { width: 5 }, { width: 25 }, { width: 5 }];

    ws.mergeCells('B2:E2');
    const titleCell = ws.getCell('B2');
    titleCell.value = "ملخص نتائج التدقيق";
    titleCell.font = { size: 24, bold: true, name: 'Calibri' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 40;

    const findingCounts: Record<string, number> = {
      WOMAN_MULTIPLE_HUSBANDS: 0,
      MULTIPLE_NATIONAL_IDS: 0,
      DUPLICATE_ID: 0,
      DUPLICATE_COUPLE: 0,
      HIGH_SIMILARITY: 0
    };

    const uniqueFindings = new Set<string>();
    findings.forEach(f => {
        // Create a unique key for each finding to avoid double counting records within the same finding
        const findingKey = `${f.type}-${f.description}`;
        if (!uniqueFindings.has(findingKey)) {
            if (f.type in findingCounts) {
                findingCounts[f.type] += 1;
            }
            uniqueFindings.add(findingKey);
        }
    });

    const summaryCards = [
        [{ title: "Multiple Husbands", key: 'WOMAN_MULTIPLE_HUSBANDS', icon: '🙍‍♀️' }, { title: "Multiple IDs", key: 'MULTIPLE_NATIONAL_IDS', icon: '💳' }],
        [{ title: "Duplicate ID", key: 'DUPLICATE_ID', icon: '🧾' }, { title: "Duplicate Couple", key: 'DUPLICATE_COUPLE', icon: '👨‍👩‍👧‍👦' }],
        [{ title: "High Similarity", key: 'HIGH_SIMILARITY', icon: '✨' }, null]
    ];
    
    let currentRow = 4;
    summaryCards.forEach((rowItems) => {
        ws.getRow(currentRow).height = 45;
        rowItems.forEach((stat, colIndex) => {
            if (!stat) return;
            const startColNum = colIndex === 0 ? 2 : 5;
            ws.mergeCells(currentRow, startColNum, currentRow + 3, startColNum + 1);
            const cardCell = ws.getCell(currentRow, startColNum);
            cardCell.value = { richText: [ { text: `${stat.icon}\n`, font: { size: 36, name: 'Segoe UI Emoji' } }, { text: `${stat.title}`, font: { size: 14 } }, { text: `${findingCounts[stat.key]}`, font: { size: 24, bold: true } } ] };
            cardCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cardCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            cardCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        currentRow += 5;
    });
}
