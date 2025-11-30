
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import type { RecordRow } from "../../../lib/fuzzyCluster";

type ProcessedRecord = RecordRow & {
    clusterId?: number;
    pairScore?: number;
    nameScore?: number;
    husbandScore?: number;
    idScore?: number;
    phoneScore?: number;
    locationScore?: number;
    childrenScore?: number;
}

function getFlagForScore(scoreValue: any): string | null {
    if (scoreValue === undefined || scoreValue === null) return null;
    const score = Number(scoreValue);
    if (isNaN(score) || score <= 0) return null;

    if (score >= 0.9) return "m?";
    if (score >= 0.8) return "m";
    if (score >= 0.7) return "??";
    if (score > 0) return "?";
    return null;
}


export async function POST(req: Request) {
  try {
    const { processedRecords = [], originalHeaders = [], idColumnName = '' } = await req.json();

    if (processedRecords.length === 0 || !idColumnName) {
      return NextResponse.json({ ok: false, error: "Missing required data for export" }, { status: 400 });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Beneficiary Insights";
    wb.created = new Date();

    const ws = wb.addWorksheet("Enriched Data");
    ws.views = [{ rightToLeft: true }];
    
    // --- MAXIFS and COUNTIF Logic ---
    const clusterMaxIdMap = new Map<number, number>();
    const clusterSizeMap = new Map<number, number>();

    for (const row of processedRecords) {
        const clusterId = row["clusterId"];
        if (clusterId) {
            // COUNTIF
            clusterSizeMap.set(clusterId, (clusterSizeMap.get(clusterId) || 0) + 1);
            
            // MAXIFS
            // Reconstruct the original row to get the beneficiaryId based on the original header name
            const beneficiaryId = Number(row[idColumnName]);
            if (!isNaN(beneficiaryId)) {
                const currentMax = clusterMaxIdMap.get(clusterId) || 0;
                if (beneficiaryId > currentMax) {
                    clusterMaxIdMap.set(clusterId, beneficiaryId);
                }
            }
        }
    }

    // --- Add Helper Columns ---
    let finalData = processedRecords.map((row: ProcessedRecord) => {
        const clusterId = row["clusterId"];
        let clusterSize: number | null = null;
        let finalClusterId: number | null = null;
        if (clusterId) {
          clusterSize = clusterSizeMap.get(clusterId) || null;
          finalClusterId = clusterMaxIdMap.get(clusterId) || null;
        }

        const reconstructedRow: any = {};
        for(const header of originalHeaders) {
            // Find the mapped field name
            const mappedField = Object.keys(row).find(k => row[k] === row[header]);
            reconstructedRow[header] = row[header];
        }

        return {
            ...row, // Contains all original data and scores
            "Cluster_ID": finalClusterId,
            "Cluster Size": clusterSize,
            "Flag": getFlagForScore(row["pairScore"]),
        };
    });

    // --- Sorting ---
    finalData.sort((a: any, b: any) => {
        const clusterA = a["Cluster_ID"] === null ? Infinity : a["Cluster_ID"];
        const clusterB = b["Cluster_ID"] === null ? Infinity : b["Cluster_ID"];

        if (clusterA !== clusterB) {
            return clusterA - clusterB;
        }

        const scoreA = a["pairScore"] === null ? -1 : a["pairScore"];
        const scoreB = b["pairScore"] === null ? -1 : b["pairScore"];
        return scoreB - scoreA;
    });


    // --- Reorder and Define Headers ---
    const newHeaders = [
        "Cluster ID", "Cluster_ID", "Cluster Size", "Flag",
        "PairScore", "nameScore", "husbandScore", "idScore", "phoneScore", "locationScore", "childrenScore",
        ...originalHeaders
    ];
    
    // Create a set of the new headers for faster lookup
    const newHeaderSet = new Set(newHeaders);
    
    // Filter out original headers that are already in the new headers section (to avoid duplication)
    const filteredOriginalHeaders = originalHeaders.filter((h: string) => !newHeaderSet.has(h));
    
    const finalHeaders = [
      "Cluster_ID", "Cluster Size", "Flag",
      "PairScore", "nameScore", "husbandScore", "idScore", "phoneScore", "locationScore", "childrenScore",
      ...filteredOriginalHeaders
    ];


    ws.columns = finalHeaders.map(h => ({ header: h, key: h, width: 15 }));
    ws.addRows(finalData);


    // --- Formatting ---
    ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: 'Arial' };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002060" } }; // Dark Blue
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const pairScoreCell = row.getCell('PairScore');
        const score = (pairScoreCell.value !== null && pairScoreCell.value !== undefined) ? Number(pairScoreCell.value) : -1;
        
        let fillColor: string | undefined;
        let fontColor = 'FF000000'; // Default black

        if (score >= 0.9) {
            fillColor = 'FFFF0000'; // Red
            fontColor = 'FFFFFFFF'; // White
        } else if (score >= 0.8) {
            fillColor = 'FFFFC7CE'; // Light Red
        } else if (score >= 0.7) {
            fillColor = 'FFFFC000'; // Orange
        } else if (score > 0) {
            fillColor = 'FFFFFF00'; // Yellow
        }

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (fillColor) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            }
            cell.font = { ...cell.font, bold: true, color: { argb: fontColor } };
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        });
    });

    // --- Border Logic ---
    let lastClusterId: number | string | null = null;
    for (let i = 2; i <= ws.rowCount; i++) { // Start from row 2
        const currentRow = ws.getRow(i);
        const currentClusterId = currentRow.getCell('Cluster_ID').value;

        const isNewClusterStart = currentClusterId !== null && currentClusterId !== lastClusterId;
        if (isNewClusterStart) {
             currentRow.eachCell({ includeEmpty: true }, cell => {
                cell.border = { ...cell.border, top: { style: 'thick' } };
            });
        }
        
        const nextRow = ws.getRow(i + 1);
        const nextClusterId = nextRow ? nextRow.getCell('Cluster_ID').value : null;
        const isClusterEnd = currentClusterId !== null && currentClusterId !== nextClusterId;
        if (isClusterEnd) {
             currentRow.eachCell({ includeEmpty: true }, cell => {
                cell.border = { ...cell.border, bottom: { style: 'thick' } };
            });
        }
        
        lastClusterId = currentClusterId;
    }


    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=enriched-report.xlsx",
      },
    });

  } catch (error: any) {
    console.error('Failed to generate enriched excel file', error);
    return new NextResponse(JSON.stringify({ error: "Failed to generate Excel file: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
