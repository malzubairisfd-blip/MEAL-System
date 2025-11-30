
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
    const { originalData = [], processedRecords = [], idColumnName = '' } = await req.json();

    if (originalData.length === 0 || processedRecords.length === 0 || !idColumnName) {
      return NextResponse.json({ ok: false, error: "Missing required data for export" }, { status: 400 });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Beneficiary Insights";
    wb.created = new Date();

    const ws = wb.addWorksheet("Enriched Data");
    ws.views = [{ rightToLeft: true }];

    // --- Data Merging ---
    const processedMap = new Map<string, ProcessedRecord>();
    for (const p of processedRecords) {
        if (p._internalId) {
            processedMap.set(String(p._internalId), p);
        }
    }
    
    let enrichedData = originalData.map((row: any, index: number) => {
        const internalId = `row_${index}`;
        const match = processedMap.get(internalId);

        if (match) {
            return {
                ...row, // Original data first
                "Cluster ID": match.clusterId !== undefined ? match.clusterId : null,
                "PairScore": match.pairScore !== undefined ? Number(match.pairScore) : null,
                "nameScore": match.nameScore !== undefined ? Number(match.nameScore) : null,
                "husbandScore": match.husbandScore !== undefined ? Number(match.husbandScore) : null,
                "idScore": match.idScore !== undefined ? Number(match.idScore) : null,
                "phoneScore": match.phoneScore !== undefined ? Number(match.phoneScore) : null,
                "locationScore": match.locationScore !== undefined ? Number(match.locationScore) : null,
                "childrenScore": match.childrenScore !== undefined ? Number(match.childrenScore) : null,
            };
        }
        return {
            ...row,
            "Cluster ID": null, "PairScore": null, "nameScore": null, "husbandScore": null, "idScore": null, "phoneScore": null, "locationScore": null, "childrenScore": null,
        };
    });

    // --- MAXIFS and COUNTIF Logic ---
    const clusterMaxIdMap = new Map<number, number>();
    const clusterSizeMap = new Map<number, number>();

    for (const row of enrichedData) {
        const clusterId = row["Cluster ID"];
        if (clusterId) {
            // COUNTIF
            clusterSizeMap.set(clusterId, (clusterSizeMap.get(clusterId) || 0) + 1);
            
            // MAXIFS
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
    let finalData = enrichedData.map(row => {
        const clusterId = row["Cluster ID"];
        let clusterSize: number | null = null;
        let finalClusterId: number | null = null;
        if (clusterId) {
          clusterSize = clusterSizeMap.get(clusterId) || null;
          finalClusterId = clusterMaxIdMap.get(clusterId) || null;
        }

        return {
            ...row,
            "Cluster_ID": finalClusterId,
            "Cluster Size": clusterSize,
            "Flag": getFlagForScore(row["PairScore"]),
        };
    });

    // --- Sorting ---
    finalData.sort((a: any, b: any) => {
        const clusterA = a["Cluster_ID"] === null ? Infinity : a["Cluster_ID"];
        const clusterB = b["Cluster_ID"] === null ? Infinity : b["Cluster_ID"];

        if (clusterA !== clusterB) {
            return clusterA - clusterB;
        }

        const scoreA = a["PairScore"] === null ? -1 : a["PairScore"];
        const scoreB = b["PairScore"] === null ? -1 : b["PairScore"];
        return scoreB - scoreA;
    });


    // --- Reorder and Define Headers ---
    const originalHeaders = Object.keys(originalData[0] || {});
    const newHeaders = [
        "Cluster ID", "Cluster_ID", "Cluster Size", "Flag",
        "PairScore", "nameScore", "husbandScore", "idScore", "phoneScore", "locationScore", "childrenScore",
        ...originalHeaders
    ];
    
    const reorderedData = finalData.map(row => {
        const newRow: {[key: string]: any} = {};
        for (const header of newHeaders) {
            newRow[header] = row[header];
        }
        return newRow;
    });

    ws.columns = newHeaders.map(h => ({ header: h, key: h, width: 15 }));
    ws.addRows(reorderedData);


    // --- Formatting ---
    ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: 'Arial' };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002060" } }; // Dark Blue
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        // Apply formatting based on score
        const pairScoreCell = row.getCell('PairScore');
        const score = pairScoreCell.value ? Number(pairScoreCell.value) : -1;
        
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

        // Determine if it's the start of a new cluster
        const isNewClusterStart = currentClusterId !== null && currentClusterId !== lastClusterId;
        if (isNewClusterStart) {
             currentRow.eachCell({ includeEmpty: true }, cell => {
                cell.border = { ...cell.border, top: { style: 'thick' } };
            });
        }
        
        // Determine if it's the end of a cluster
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
