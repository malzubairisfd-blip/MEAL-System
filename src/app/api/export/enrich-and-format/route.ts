
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ExcelJS from "exceljs";
import { fullPairwiseBreakdown } from "@/lib/scoring-server";
import type { AuditFinding } from "@/lib/auditEngine";
import type { RecordRow } from "@/lib/types";
import { generateArabicClusterSummary } from '@/lib/arabicClusterSummary';
import { calculateClusterConfidence } from '@/lib/clusterConfidence';


const getTmpDir = () => path.join(os.tmpdir(), 'beneficiary-insights-cache');

type EnrichedRecord = RecordRow & {
    ClusterID?: number | null; // Internal sequential ID
    Generated_Cluster_ID?: number | null; // The one for display, avoids conflict
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
    'تصنيف المجموعة المبدئي'?: string;
    'نتائج تحليل المجموعة'?: string;
    [key: string]: any;
};

function getDecisionAndNote(finalScorePct: number) {
  let decision = "إحتمالية تكرار";
  let expertNote = "قد يكون هنالك إحتمالية لوجود تكرار نتيجة لتطابق بعض اجزاء من الاسم للمستفيدة او الزوج. يوصى بالتحقق المكتبي من المجموعة.";

  if (finalScorePct >= 85) {
    decision = "تكرار مؤكد";
    expertNote =
      "يوجد تطابق شامل في الأسماء والنسب مع احتمالية عالية أن السجلات تعود لنفس المستفيد. يوصى بمراجعه السجلات وابقاء الحاله التي تحتوي على اكثر دقة وشمولية في البيانات وتصنيف الحالات الأخرى في المجموعه بانها تكرار/ازدواج.";
  } else if (finalScorePct >= 70) {
    decision = "اشتباه تكرار مؤكد";
    expertNote =
      "يوجد تشابه مرتفع في الأسماء والنسب مع احتمالية مرتفعة أن السجلات تعود لنفس المستفيد. يوصى بمراجعه السجلات وفي حال كان هنالك حالات تكرار يتم إبقاء الحاله التي تحتوي على اكثر دقة وشمولية في البيانات وتصنيف الحالات الأخرى في المجموعه بانها تكرار/ازدواج او يتم تعليق المجموعه للتحقق الميداني.";
  } else if (finalScorePct >= 60) {
    decision = "اشتباه تكرار";
    expertNote =
      "يوجد تشابه جزئي، وقد يكون ناتجًا عن تشابه أسماء شائع في المنطقة. يوصى بالتحقق المكتبي والميداني من المجموعة.";
  }
  return { decision, expertNote };
}

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
    const { rows: allRecords, clusters, originalHeaders } = cachedData;
    if (!allRecords || !clusters) {
        throw new Error("Invalid cache: missing rows or clusters.");
    }

    const enrichedRecords: EnrichedRecord[] = [];
    const recordClusterMap = new Map<string, number>();
    const clusterInfoMap = new Map<number, { maxScore: number; maxBeneficiaryId: number; size: number; decision: string; expertNote: string; }>();

    clusters.forEach((clusterObj: { records: RecordRow[] }, index: number) => {
        const clusterId = index + 1;
        const clusterRecords = clusterObj.records;
        if (!clusterRecords || clusterRecords.length === 0) return;

        clusterRecords.forEach(r => recordClusterMap.set(r._internalId!, clusterId));

        const pairs = fullPairwiseBreakdown(clusterRecords);
        const maxScore = pairs.reduce((max, p) => Math.max(max, p.score), 0);
        
        let maxBeneficiaryId = 0;
        clusterRecords.forEach(r => {
             const beneficiaryId = Number(r.beneficiaryId);
             if (!isNaN(beneficiaryId) && beneficiaryId > maxBeneficiaryId) {
                maxBeneficiaryId = beneficiaryId;
             }
        });
        
        const womanNameScores = pairs.map((p: any) => p.breakdown.nameScore || 0);
        const husbandNameScores = pairs.map((p: any) => p.breakdown.husbandScore || 0);
        const avgWomanNameScore = womanNameScores.length > 0 ? womanNameScores.reduce((a: number, b: number) => a + b, 0) / womanNameScores.length : 0;
        const avgHusbandNameScore = husbandNameScores.length > 0 ? husbandNameScores.reduce((a: number, b: number) => a + b, 0) / husbandNameScores.length : 0;
        const avgFinalScore = (avgWomanNameScore + avgHusbandNameScore) / 2;
        const finalScorePct = Math.round(avgFinalScore * 100);

        const { decision, expertNote } = getDecisionAndNote(finalScorePct);

        clusterInfoMap.set(clusterId, { maxScore, maxBeneficiaryId, size: clusterRecords.length, decision, expertNote });
    });

    allRecords.forEach((record: RecordRow) => {
        let enriched: EnrichedRecord = { 
            ...record,
            womanName_normalized: normalizeArabic(record.womanName || ''),
            husbandName_normalized: normalizeArabic(record.husbandName || ''),
        };
        
        const recordClusterId = recordClusterMap.get(record._internalId!);

        if (recordClusterId) {
            const clusterInfo = clusterInfoMap.get(recordClusterId)!;
            
            const clusterRecords = clusters[recordClusterId - 1].records;
            
            let totalPairScore = 0;
            let totalNameScore = 0;
            let totalHusbandScore = 0;
            let totalIdScore = 0;
            let totalPhoneScore = 0;
            let comparisonCount = 0;
            
            if (clusterRecords.length > 1) {
                for (let i = 0; i < clusterRecords.length; i++) {
                    if (clusterRecords[i]._internalId === record._internalId) continue;
                    
                    const result = fullPairwiseBreakdown([record, clusterRecords[i]])[0];
                    if (result) {
                        totalPairScore += result.score;
                        totalNameScore += result.breakdown.nameScore || 0;
                        totalHusbandScore += result.breakdown.husbandScore || 0;
                        totalIdScore += result.breakdown.idScore || 0;
                        totalPhoneScore += result.breakdown.phoneScore || 0;
                        comparisonCount++;
                    }
                }
            }
           
            const avgPairScore = comparisonCount > 0 ? totalPairScore / comparisonCount : 0;
            const avgNameScore = comparisonCount > 0 ? totalNameScore / comparisonCount : 0;
            const avgHusbandScore = comparisonCount > 0 ? totalHusbandScore / comparisonCount : 0;
            const avgIdScore = comparisonCount > 0 ? totalIdScore / comparisonCount : 0;
            const avgPhoneScore = comparisonCount > 0 ? totalPhoneScore / comparisonCount : 0;

            const flag = (score: number) => {
                if (score >= 0.9) return "m?";
                if (score >= 0.8) return "m";
                if (score >= 0.7) return "??";
                if (score > 0) return "?";
                return null;
            };

            enriched = {
                ...enriched,
                pairScore: avgPairScore,
                nameScore: avgNameScore,
                husbandScore: avgHusbandScore,
                idScore: avgIdScore,
                phoneScore: avgPhoneScore,
                ClusterID: recordClusterId, // internal sequential ID
                Generated_Cluster_ID: clusterInfo.maxBeneficiaryId || recordClusterId,
                Cluster_Size: clusterInfo.size,
                Max_PairScore: clusterInfo.maxScore,
                'تصنيف المجموعة المبدئي': clusterInfo.decision,
                'نتائج تحليل المجموعة': clusterInfo.expertNote,
                Flag: flag(avgPairScore),
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

        const clusterA = a.Generated_Cluster_ID ?? Number.MAX_SAFE_INTEGER;
        const clusterB = b.Generated_Cluster_ID ?? Number.MAX_SAFE_INTEGER;
        if (clusterA !== clusterB) {
            return clusterA - clusterB;
        }
        
        return (String(a.beneficiaryId) || "").localeCompare(String(b.beneficiaryId) || "");
    });
}

function createFormattedWorkbook(data: EnrichedRecord[], cachedData: any): ExcelJS.Workbook {
    const { rows: allRecords, clusters, auditFindings, originalHeaders, chartImages, processedDataForReport } = cachedData;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Beneficiary Insights";
    
    if (chartImages && processedDataForReport) {
        createDashboardReportSheet(wb, allRecords, clusters, auditFindings || [], chartImages, processedDataForReport);
    }
    createEnrichedDataSheet(wb, data, originalHeaders);
    createSummarySheet(wb, allRecords, clusters, auditFindings || []);
    createClustersSheet(wb, clusters);
    if (auditFindings && auditFindings.length > 0) {
        createAuditSheet(wb, auditFindings, clusters);
    }

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
    
    const allOriginalHeaders = new Set<string>(originalHeaders || []);
    data.forEach(record => {
      Object.keys(record).forEach(key => {
         if (!key.startsWith('_') && key !== 'ClusterID' && key !== 'Generated_Cluster_ID') {
           allOriginalHeaders.add(key);
         }
      });
    });

    // Check if a 'cluster_id' column already exists in the original data.
    const hasOriginalClusterId = originalHeaders.some(h => h.toLowerCase() === 'cluster_id');

    let enrichmentHeaders = [
        "Cluster_Size", "Flag", "pairScore", "Max_PairScore", "nameScore", "husbandScore", "idScore", "phoneScore", "تصنيف المجموعة المبدئي", "نتائج تحليل المجموعة"
    ];
    
    // Use Generated_Cluster_ID if the original file has cluster_id, otherwise use Cluster_ID
    const clusterIdColumnName = hasOriginalClusterId ? "Generated_Cluster_ID" : "Cluster_ID";
    enrichmentHeaders.unshift(clusterIdColumnName);


    const headersToExclude = ['ClusterID', 'Generated_Cluster_ID', 'womanName_normalized', 'husbandName_normalized', 'pairScore', 'nameScore', 'husbandScore', 'idScore', 'phoneScore', 'Max_PairScore', 'Cluster_Size', 'Flag', 'تصنيف المجموعة المبدئي', 'نتائج تحليل المجموعة'];
    const finalOriginalHeaders = Array.from(allOriginalHeaders).filter(h => !headersToExclude.includes(h) && !h.startsWith('_'));
    
    const finalHeaders = [ ...enrichmentHeaders, ...finalOriginalHeaders ];
    
    ws.columns = finalHeaders.map(h => ({
      header: h,
      key: h,
      width: h === 'womanName' || h === 'husbandName' ? 25 : (h === 'نتائج تحليل المجموعة' ? 50 : 15)
    }));

    ws.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { horizontal: 'center' };
    });
    
    // Map data correctly for writing rows
    const dataForSheet = data.map(record => {
        const newRecord: any = { ...record };
        if (hasOriginalClusterId) {
            newRecord['Generated_Cluster_ID'] = record.Generated_Cluster_ID;
        } else {
            newRecord['Cluster_ID'] = record.Generated_Cluster_ID;
        }
        return newRecord;
    });

    ws.addRows(dataForSheet);
    
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
        const cid = row.getCell(clusterIdColumnName).value;
        if (cid !== null && cid !== lastClusterId && lastClusterId !== null) {
            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = { ...cell.border, top: { style: 'thick', color: { argb: 'FF002060' } } };
            });
        }
        lastClusterId = cid;
    }
}

function createSummarySheet(wb: ExcelJS.Workbook, allRecords: RecordRow[], clusters: {records: RecordRow[]}[], auditFindings: AuditFinding[]) {
    const ws = wb.addWorksheet("Review Summary");
    ws.views = [{ rightToLeft: true }];
    
    ws.columns = [ { width: 5 }, { width: 25 }, { width: 5 }, { width: 25 }, { width: 5 }];

    ws.mergeCells('B2:D2');
    const titleCell = ws.getCell('B2');
    titleCell.value = "تقرير مراجعة المجموعات";
    titleCell.font = { size: 24, bold: true, name: 'Calibri' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 40;

    const totalRecords = allRecords.length;
    const clusteredRecordsCount = clusters.reduce((acc, c) => acc + c.records.length, 0);
    const numClusters = clusters.length;
    const unclusteredCount = totalRecords - clusteredRecordsCount;
    const avgClusterSize = numClusters > 0 ? (clusteredRecordsCount / numClusters) : 0;
    const clusteredPercentage = totalRecords > 0 ? (clusteredRecordsCount / totalRecords) : 0;

    const summaryStats = [
        [{ title: "إجمالي السجلات المعالجة", value: totalRecords, icon: "👥" }, { title: "عدد المجموعات", value: numClusters, icon: "📁" }],
        [{ title: "السجلات المجمعة", value: clusteredRecordsCount, icon: "🔗" }, { title: "السجلات غير المجمعة", value: unclusteredCount, icon: "👤" }],
        [{ title: "متوسط حجم المجموعة", value: avgClusterSize.toFixed(2), icon: "📊" }, { title: "نسبة السجلات المجمعة", value: `${(clusteredPercentage * 100).toFixed(1)}%`, icon: "📈" }]
    ];
    
    let summaryCurrentRow = 4;
    summaryStats.forEach(rowItems => {
        ws.getRow(summaryCurrentRow).height = 45;
        rowItems.forEach((stat, colIndex) => {
            const startColNum = colIndex === 0 ? 2 : 4;
            ws.mergeCells(summaryCurrentRow, startColNum, summaryCurrentRow + 3, startColNum);
            const cardCell = ws.getCell(summaryCurrentRow, startColNum);
            cardCell.value = { richText: [ { text: `${stat.icon}`, font: { size: 36, name: 'Segoe UI Emoji' } }, { text: `\n${stat.title}\n`, font: { size: 14 } }, { text: `${stat.value}`, font: { size: 24, bold: true } } ] };
            cardCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cardCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2FF' } };
            cardCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        summaryCurrentRow += 5;
    });


    // --- Decision Counts ---
    let decisionCurrentRow = summaryCurrentRow + 1; // Start after the summary stats
    ws.getRow(decisionCurrentRow).height = 15; // Spacer row

    const decisionCounts = {
        'تكرار مؤكد': 0,
        'اشتباه تكرار مؤكد': 0,
        'اشتباه تكرار': 0,
        'إحتمالية تكرار': 0
    };

    clusters.forEach(clusterObj => {
        const pairs = fullPairwiseBreakdown(clusterObj.records);
        const womanNameScores = pairs.map((p: any) => p.breakdown.nameScore || 0);
        const husbandNameScores = pairs.map((p: any) => p.breakdown.husbandScore || 0);
        const avgWomanNameScore = womanNameScores.length > 0 ? womanNameScores.reduce((a: number, b: number) => a + b, 0) / womanNameScores.length : 0;
        const avgHusbandNameScore = husbandNameScores.length > 0 ? husbandNameScores.reduce((a: number, b: number) => a + b, 0) / husbandNameScores.length : 0;
        const avgFinalScore = (avgWomanNameScore + avgHusbandNameScore) / 2;
        const finalScorePct = Math.round(avgFinalScore * 100);

        const { decision } = getDecisionAndNote(finalScorePct);
        if (decision in decisionCounts) {
            decisionCounts[decision as keyof typeof decisionCounts]++;
        }
    });
    
    const decisionStats = [
        [{ title: "تكرار مؤكد", value: decisionCounts['تكرار مؤكد'], icon: "🚨" }, { title: "اشتباه تكرار مؤكد", value: decisionCounts['اشتباه تكرار مؤكد'], icon: "⚠️" }],
        [{ title: "اشتباه تكرار", value: decisionCounts['اشتباه تكرار'], icon: "🔍" }, { title: "إحتمالية تكرار", value: decisionCounts['إحتمالية تكرار'], icon: "💡" }],
    ];

    decisionCurrentRow++;
    decisionStats.forEach(rowItems => {
        ws.getRow(decisionCurrentRow).height = 45;
        rowItems.forEach((stat, colIndex) => {
            if (!stat) return;
            const startColNum = colIndex === 0 ? 2 : 4;
            ws.mergeCells(decisionCurrentRow, startColNum, decisionCurrentRow + 3, startColNum);
            const cardCell = ws.getCell(decisionCurrentRow, startColNum);
            cardCell.value = { richText: [ { text: `${stat.icon}`, font: { size: 36, name: 'Segoe UI Emoji' } }, { text: `\n${stat.title}\n`, font: { size: 14 } }, { text: `${stat.value}`, font: { size: 24, bold: true } } ] };
            cardCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cardCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; // Light gray
            cardCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        decisionCurrentRow += 5;
    });

    let auditCurrentRow = decisionCurrentRow + 1; // Add space
    ws.getRow(auditCurrentRow - 1).height = 15; // Spacer row

    // --- Audit Summary Data ---
    if (auditFindings.length > 0) {
        ws.mergeCells(`B${auditCurrentRow}:D${auditCurrentRow}`);
        const auditTitleCell = ws.getCell(`B${auditCurrentRow}`);
        auditTitleCell.value = "ملخص نتائج التدقيق";
        auditTitleCell.font = { size: 18, bold: true, name: 'Calibri' };
        auditTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(auditCurrentRow).height = 30;
        auditCurrentRow++;
        
        const findingCounts: Record<string, number> = {
          TOTAL_UNIQUE_RECORDS: new Set(auditFindings.flatMap(f => f.records.map(r => r._internalId))).size,
          WOMAN_MULTIPLE_HUSBANDS: 0,
          MULTIPLE_NATIONAL_IDS: 0,
          DUPLICATE_ID: 0,
          DUPLICATE_COUPLE: 0,
          HIGH_SIMILARITY: 0
        };

        auditFindings.forEach(f => {
            if (f.type in findingCounts) {
                 findingCounts[f.type] += new Set(f.records.map(r => r._internalId)).size;
            }
        });

        const auditSummaryCards = [
            [{ title: "السجلات المدققة الفريدة", key: 'TOTAL_UNIQUE_RECORDS', icon: '🛡️' }, { title: "ازدواجية الزوجين", key: 'DUPLICATE_COUPLE', icon: '👨‍👩‍👧‍👦' }],
            [{ title: "تعدد الأزواج", key: 'WOMAN_MULTIPLE_HUSBANDS', icon: '🙍‍♀️' }, { title: "تعدد أرقام الهوية", key: 'MULTIPLE_NATIONAL_IDS', icon: '💳' }],
            [{ title: "ازدواجية الرقم القومي", key: 'DUPLICATE_ID', icon: '🧾' }, { title: "تشابه عالي", key: 'HIGH_SIMILARITY', icon: '✨' }]
        ];
        
        auditSummaryCards.forEach((rowItems) => {
            ws.getRow(auditCurrentRow).height = 45;
            rowItems.forEach((stat, colIndex) => {
                if (!stat) return;
                const startColNum = colIndex === 0 ? 2 : 4;
                ws.mergeCells(auditCurrentRow, startColNum, auditCurrentRow + 3, startColNum);
                const cardCell = ws.getCell(auditCurrentRow, startColNum);
                
                const count = findingCounts[stat.key];

                cardCell.value = { richText: [ { text: `${stat.icon}`, font: { size: 36, name: 'Segoe UI Emoji' } }, { text: `\n${stat.title}\n`, font: { size: 14 } }, { text: `${count}`, font: { size: 24, bold: true } } ] };
                cardCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cardCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                cardCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            auditCurrentRow += 5;
        });
    }
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

        const summaryText = generateArabicClusterSummary(clusterObjectForSummary, clusterRecords)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]*>?/gm, '')
          .trim();

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

                const key = ((ws.columns[colNumber - 1].key || '').replace(/\s/g, ''));
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
    const ws = wb.addWorksheet("نتائج التدقيق");
    ws.views = [{ rightToLeft: true }];
    
    const recordToClusterIdMap = new Map<string, number>();
    clusters.forEach((clusterObj, index) => {
        clusterObj.records.forEach(record => {
            recordToClusterIdMap.set(record._internalId!, index + 1);
        });
    });

    const headers = [
      { header: "الخطورة", key: "severity", width: 12 },
      { header: "نوع النتيجة", key: "type", width: 40 },
      { header: "الوصف", key: "description", width: 50 },
      { header: "معرف المجموعة", key: "clusterId", width: 15 },
      { header: "معرف المستفيد", key: "beneficiaryId", width: 20 },
      { header: "اسم الزوجة", key: "womanName", width: 25 },
      { header: "اسم الزوج", key: "husbandName", width: 25 },
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

    const severityOrder = { high: 1, medium: 2, low: 3 };
    const severityTranslations: Record<string, string> = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
    const typeTranslations: Record<string, string> = {
        "DUPLICATE_ID": "تكرار الرقم القومي",
        "DUPLICATE_COUPLE": "ازدواجية الزوجين",
        "WOMAN_MULTIPLE_HUSBANDS": "زوجة لديها عدة أزواج",
        "HUSBAND_TOO_MANY_WIVES": "زوج لديه أكثر من 4 زوجات",
        "MULTIPLE_NATIONAL_IDS": "زوجة لديها عدة أرقام قومية",
        "HIGH_SIMILARITY": "تشابه عالي بين السجلات"
    };

    const descriptionTranslations: Record<string, (finding: AuditFinding, record: RecordRow) => string> = {
        "DUPLICATE_ID": () => `الرقم القومي مكرر داخل المجموعة.`,
        "DUPLICATE_COUPLE": () => `تطابق تام لاسم الزوجة والزوج.`,
        "WOMAN_MULTIPLE_HUSBANDS": (f) => `الزوجة مسجلة مع عدة أزواج: ${[...new Set(f.records.map(rec => rec.husbandName))].join(', ')}`,
        "HUSBAND_TOO_MANY_WIVES": (f) => `الزوج مسجل مع ${new Set(f.records.map(rec => rec.womanName)).size} زوجات، وهو ما يتجاوز الحد المسموح به.`,
        "MULTIPLE_NATIONAL_IDS": (f, r) => `الزوجة '${r.womanName}' مرتبطة بعدة أرقام قومية: ${[...new Set(f.records.filter(rec => rec.womanName === r.womanName).map(rec=>rec.nationalId))].join(', ')}`,
        "HIGH_SIMILARITY": (f) => `يوجد تشابه عالي في البيانات بين السجلات داخل هذه المجموعة.`,
    };

    // --- Beneficiary ID Consolidation Logic ---
    const beneficiaryFindings = new Map<string, any>();
    findings.forEach(finding => {
        finding.records.forEach(record => {
            const beneficiaryId = record.beneficiaryId;
            if (!beneficiaryId) return;

            const existing = beneficiaryFindings.get(beneficiaryId);
            const translatedDescription = descriptionTranslations[finding.type] ? descriptionTranslations[finding.type](finding, record) : finding.description;

            if (existing) {
                if (severityOrder[finding.severity] < severityOrder[existing.severityValue]) {
                    existing.severity = finding.severity;
                    existing.severityValue = finding.severity;
                }
                existing.types.add(finding.type);
                existing.descriptions.add(translatedDescription);
            } else {
                beneficiaryFindings.set(beneficiaryId, {
                    ...record,
                    severity: finding.severity,
                    severityValue: finding.severity,
                    types: new Set([finding.type]),
                    descriptions: new Set([translatedDescription]),
                    clusterId: recordToClusterIdMap.get(record._internalId!) || 'N/A'
                });
            }
        });
    });

    let consolidatedData = Array.from(beneficiaryFindings.values()).map(f => ({
        ...f,
        type: Array.from(f.types).join(' + '),
        description: Array.from(f.descriptions).join(' + ')
    }));

    // --- Cluster-level Consolidation ---
    const clusterGroups = new Map<string, any[]>();
    consolidatedData.forEach(record => {
        const clusterId = record.clusterId;
        if (!clusterGroups.has(clusterId)) {
            clusterGroups.set(clusterId, []);
        }
        clusterGroups.get(clusterId)!.push(record);
    });

    let finalData: any[] = [];
    clusterGroups.forEach((records, clusterId) => {
        if (records.length === 0) return;

        let highestSeverityValue: 'high' | 'medium' | 'low' = 'low';
        const combinedTypes = new Set<string>();
        const combinedDescriptions = new Set<string>();

        records.forEach(record => {
            if (severityOrder[record.severityValue] < severityOrder[highestSeverityValue]) {
                highestSeverityValue = record.severityValue;
            }
            record.type.split(' + ').forEach((t: string) => combinedTypes.add(t));
            record.description.split(' + ').forEach((d: string) => combinedDescriptions.add(d));
        });

        const unifiedType = Array.from(combinedTypes).map(t => typeTranslations[t] || t.replace(/_/g, ' ')).join(' + ');
        const unifiedDescription = Array.from(combinedDescriptions).join(' + ');
        const unifiedSeverity = severityTranslations[highestSeverityValue] || highestSeverityValue;
        
        const unifiedRecords = records.map(record => ({
            ...record,
            severity: unifiedSeverity,
            severityValue: highestSeverityValue,
            type: unifiedType,
            description: unifiedDescription,
        }));
        finalData.push(...unifiedRecords);
    });
    
    // --- Sorting Logic ---
    finalData.sort((a, b) => {
        const severityComparison = severityOrder[a.severityValue] - severityOrder[b.severityValue];
        if (severityComparison !== 0) return severityComparison;
        
        const clusterIdA = a.clusterId === 'N/A' ? Infinity : a.clusterId;
        const clusterIdB = b.clusterId === 'N/A' ? Infinity : b.clusterId;
        if (clusterIdA !== clusterIdB) return clusterIdA - clusterIdB;

        return String(a.beneficiaryId || '').localeCompare(String(b.beneficiaryId || ''));
    });

    // --- Add Rows to Sheet ---
    let lastClusterId: string | number | null = null;
    finalData.forEach((data, index) => {
        const row = ws.addRow({
            severity: data.severity,
            type: data.type,
            description: data.description,
            clusterId: data.clusterId,
            beneficiaryId: data.beneficiaryId,
            womanName: data.womanName,
            husbandName: data.husbandName,
            nationalId: data.nationalId,
            phone: data.phone,
        });

        // Add thick border for new cluster groups
        if (index > 0 && data.clusterId !== lastClusterId) {
           row.eachCell({ includeEmpty: true }, cell => {
                cell.border = { ...cell.border, top: { style: 'thick', color: { argb: 'FF4F81BD' } } };
           });
        }
        lastClusterId = data.clusterId;

        const severityColor = data.severityValue === 'high' ? 'FFFFC7CE' : data.severityValue === 'medium' ? 'FFFFEB9C' : 'FFC6EFCE';
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severityColor } };
            const key = headers[colNumber - 1].key;

            if (['severity', 'clusterId', 'beneficiaryId', 'nationalId', 'phone'].includes(key)) {
                cell.alignment = { ...cell.alignment, vertical: 'middle', horizontal: 'center', wrapText: true };
            } else if (['type', 'description', 'womanName', 'husbandName'].includes(key)) {
                cell.alignment = { ...cell.alignment, vertical: 'middle', horizontal: 'right', wrapText: true };
            }
        });
    });
}
function createDashboardReportSheet(wb: ExcelJS.Workbook, allRecords: RecordRow[], clusters: {records: RecordRow[]}[], auditFindings: AuditFinding[], chartImages: Record<string, string>, processedData: any) {
    const ws = wb.addWorksheet("Dashboard Report");
    ws.views = [{ rightToLeft: true }];
    
    // Define column widths roughly based on the image proportions
    ws.columns = [
        { width: 2 },  // A
        { width: 18 }, // B
        { width: 13 }, // C
        { width: 18 }, // D
        { width: 13 }, // E
        { width: 18 }, // F
        { width: 13 }, // G
        { width: 18 }, // H
        { width: 13 }, // I
    ];


    ws.mergeCells('B2:I2');
    const titleCell = ws.getCell('B2');
    titleCell.value = "Analysis Dashboard Report";
    titleCell.font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FF002060' } };
    titleCell.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 30;

    const kf = processedData.keyFigures;
    const keyFiguresData = [
        { title: 'Team Leaders', value: kf.teamLeaders, cell: 'H4' },
        { title: 'Surveyors', value: kf.surveyors, cell: 'F4' },
        { title: 'Registration Days', value: kf.registrationDays, cell: 'D4' },
        { title: 'Villages Targeted', value: kf.villages, cell: 'B4' },
    ];
    
    keyFiguresData.forEach(item => {
        ws.mergeCells(`${item.cell}:${String.fromCharCode(item.cell.charCodeAt(0) + 1)}4`);
        const titleCell = ws.getCell(item.cell);
        titleCell.value = item.title;
        titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        ws.mergeCells(`${item.cell.replace('4', '5')}:${String.fromCharCode(item.cell.charCodeAt(0) + 1)}5`);
        const valueCell = ws.getCell(item.cell.replace('4', '5'));
        valueCell.value = item.value;
        valueCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF002060' } };
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
        valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(5).height = 30;
    });

    const addImage = (base64: string, tl_col: number, tl_row: number, br_col: number, br_row: number) => {
        if (!base64 || !base64.startsWith('data:image/png;base64,')) return;

        const imageId = wb.addImage({
            base64: base64.split(',')[1],
            extension: 'png',
        });
        
        ws.addImage(imageId, {
            tl: { col: tl_col, row: tl_row },
            br: { col: br_col, row: br_row },
            editAs: 'oneCell'
        });
    };
    
    // Add images in a two-column grid layout
    let currentRow = 6;
    const chartHeight = 20; // 20 rows per chart
    
    // Column 1
    addImage(chartImages.byDayChart, 1, currentRow, 4.5, currentRow + chartHeight);
    currentRow += chartHeight + 1;
    addImage(chartImages.genderVisual, 1, currentRow, 4.5, currentRow + chartHeight);
    currentRow += chartHeight + 1;
    addImage(chartImages.bubbleStats, 1, currentRow, 4.5, currentRow + chartHeight);

    // Column 2
    currentRow = 6; // Reset for second column
    addImage(chartImages.byVillageChart, 5, currentRow, 8.5, currentRow + chartHeight);
    currentRow += chartHeight + 1;
    addImage(chartImages.womenDonut, 5, currentRow, 8.5, currentRow + chartHeight);
    currentRow += chartHeight + 1;
    addImage(chartImages.map, 5, currentRow, 8.5, currentRow + chartHeight);
}
