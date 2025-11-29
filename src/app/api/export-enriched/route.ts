
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

function getFlagForScore(scoreValue: any): string {
    if (scoreValue === undefined || scoreValue === null || scoreValue === "") return "";
    const score = Number(scoreValue);
    if (isNaN(score)) return "";

    if (score >= 0.9) return "m?";
    if (score >= 0.8) return "m";
    if (score >= 0.7) return "??";
    if (score > 0) return "?";
    return "";
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
        if (p._internalId) { // Use internal ID for robust mapping
            processedMap.set(String(p._internalId), p);
        }
    }
    
    let enrichedData = originalData.map((row: any, index: number) => {
        const internalId = `row_${index}`; // Reconstruct internal ID
        const match = processedMap.get(internalId);

        if (match) {
            return {
                ...row, // Original data first
                "Cluster ID": match.clusterId || "",
                "PairScore": match.pairScore !== undefined ? Number(match.pairScore) : "",
                "nameScore": match.nameScore !== undefined ? Number(match.nameScore) : "",
                "husbandScore": match.husbandScore !== undefined ? Number(match.husbandScore) : "",
                "idScore": match.idScore !== undefined ? Number(match.idScore) : "",
                "phoneScore": match.phoneScore !== undefined ? Number(match.phoneScore) : "",
                "locationScore": match.locationScore !== undefined ? Number(match.locationScore) : "",
                "childrenScore": match.childrenScore !== undefined ? Number(match.childrenScore) : "",
            };
        }
        return {
            ...row,
            "Cluster ID": "", "PairScore": "", "nameScore": "", "husbandScore": "", "idScore": "", "phoneScore": "", "locationScore": "", "childrenScore": "",
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
    const finalData = enrichedData.map(row => {
        const clusterId = row["Cluster ID"];
        return {
            ...row,
            "Cluster_ID": clusterId ? clusterMaxIdMap.get(clusterId) || "" : "",
            "Cluster Size": clusterId ? clusterSizeMap.get(clusterId) || "" : "",
            "Flag": getFlagForScore(row["PairScore"]),
        };
    });

    // --- Sorting ---
    finalData.sort((a: any, b: any) => {
        const idA = a["Cluster ID"] || Infinity;
        const idB = b["Cluster ID"] || Infinity;
        if (idA < idB) return -1;
        if (idA > idB) return 1;

        // If Cluster IDs are the same, sort by PairScore descending
        const scoreA = a["PairScore"] !== '' ? a["PairScore"] : -1;
        const scoreB = b["PairScore"] !== '' ? b["PairScore"] : -1;
        return scoreB - scoreA;
    });

    // --- Reorder and Define Headers ---
    const originalHeaders = Object.keys(originalData[0] || {});
    const newHeaders = [
        "Cluster ID", "Cluster_ID", "Cluster Size", "Flag",
        ...originalHeaders,
        "PairScore", "nameScore", "husbandScore", "idScore", "phoneScore", "locationScore", "childrenScore"
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
    
    let lastClusterId: number | null = null;
    let clusterStartIndex = -1;

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const currentClusterId = row.getCell('Cluster ID').value as number;

        // Start of a new cluster or end of sheet
        if (currentClusterId !== lastClusterId && lastClusterId !== null) {
            // Apply thick bottom border to the last row of the previous cluster
            const lastRowOfCluster = ws.getRow(rowNumber - 1);
            lastRowOfCluster.eachCell({ includeEmpty: true }, cell => {
                const currentBorder = cell.border || {};
                cell.border = { ...currentBorder, bottom: { style: 'thick', color: { argb: 'FF000000' } } };
            });
        }
        
        // Start of a new cluster
        if (currentClusterId !== lastClusterId) {
             clusterStartIndex = rowNumber;
             // Apply thick top border to the first row of the new cluster
             row.eachCell({ includeEmpty: true }, cell => {
                 const currentBorder = cell.border || {};
                 cell.border = { ...currentBorder, top: { style: 'thick', color: { argb: 'FF000000' } } };
             });
        }
        
        lastClusterId = currentClusterId;

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
        } else if(score > 0 || currentClusterId) { // Color all rows in a cluster
            fillColor = 'FFFFFF00'; // Yellow
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
            const currentBorder = cell.border || {
                top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            };
            
            // Apply side borders to all
            currentBorder.left = { style: 'thick', color: { argb: 'FF000000' } };
            currentBorder.right = { style: 'thick', color: { argb: 'FF000000' } };
            
            cell.border = currentBorder;

            if (fillColor) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            }
            cell.font = { bold: true, color: { argb: fontColor } };
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        });
    });

    // Handle the very last row of the sheet
    if (lastClusterId !== null) {
        const lastRow = ws.getRow(ws.rowCount);
         lastRow.eachCell({ includeEmpty: true }, cell => {
            const currentBorder = cell.border || {};
            cell.border = { ...currentBorder, bottom: { style: 'thick', color: { argb: 'FF000000' } } };
        });
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

    