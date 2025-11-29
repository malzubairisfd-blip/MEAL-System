
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

    // --- Data Merging (XLOOKUP Logic) ---
    const processedMap = new Map<string, ProcessedRecord>();
    for (const p of processedRecords) {
        if (p.beneficiaryId) {
            processedMap.set(String(p.beneficiaryId), p);
        }
    }
    
    let enrichedData = originalData.map((row: any) => {
        const lookupValue = String(row[idColumnName]);
        const match = processedMap.get(lookupValue);

        if (match) {
            return {
                "Cluster ID": match.clusterId || "",
                ...row, // Original data
                "PairScore": match.pairScore ? Number(match.pairScore) : "", // Ensure it's a number
                "nameScore": match.nameScore?.toFixed(4) || "",
                "husbandScore": match.husbandScore?.toFixed(4) || "",
                "idScore": match.idScore?.toFixed(4) || "",
                "phoneScore": match.phoneScore?.toFixed(4) || "",
                "womanName_processed": match.womanName,
                "husbandName_processed": match.husbandName,
                "children_processed": (match.children || []).join(', '),
                "nationalId_processed": match.nationalId,
                "phone_processed": match.phone,
                "village_processed": match.village,
                "subdistrict_processed": match.subdistrict,
            };
        }
        return {
            "Cluster ID": "",
            ...row,
             "PairScore": "", "nameScore": "", "husbandScore": "", "idScore": "", "phoneScore": "",
             "womanName_processed": "", "husbandName_processed": "", "children_processed": "", "nationalId_processed": "", "phone_processed": "", "village_processed": "", "subdistrict_processed": "",
        };
    });

    // --- MAXIFS Logic for Cluster_ID ---
    const clusterMaxIdMap = new Map<number, number>();
    for (const row of enrichedData) {
        const clusterId = row["Cluster ID"];
        const beneficiaryId = Number(row[idColumnName]);

        if (clusterId && !isNaN(beneficiaryId)) {
            const currentMax = clusterMaxIdMap.get(clusterId) || 0;
            if (beneficiaryId > currentMax) {
                clusterMaxIdMap.set(clusterId, beneficiaryId);
            }
        }
    }

    // --- COUNTIF logic for Cluster Size ---
    const clusterSizeMap = new Map<number, number>();
    for (const row of enrichedData) {
        const clusterId = row["Cluster ID"];
        if (clusterId) {
            clusterSizeMap.set(clusterId, (clusterSizeMap.get(clusterId) || 0) + 1);
        }
    }

    const finalData = enrichedData.map(row => {
        const clusterId = row["Cluster ID"];
        const newClusterIdValue = clusterId ? clusterMaxIdMap.get(clusterId) || "" : "";
        return {
            "Original Cluster ID": row["Cluster ID"],
            "Cluster_ID": newClusterIdValue,
            ...row,
        };
    }).map(({"Cluster ID": _, ...rest}) => ({ 
        "Cluster ID": rest["Original Cluster ID"],
        "Cluster_ID": rest["Cluster_ID"],
        "Cluster Size": rest["Cluster ID"] ? clusterSizeMap.get(rest["Cluster ID"]) || 0 : "",
        "Flag": getFlagForScore(rest["PairScore"]),
        ...Object.fromEntries(Object.entries(rest).filter(([key]) => key !== "Original Cluster ID" && key !== "Cluster_ID"))
    }));


    // --- Sorting ---
    finalData.sort((a: any, b: any) => {
        const idA = a["Cluster ID"] || Infinity;
        const idB = b["Cluster ID"] || Infinity;
        if (idA < idB) return -1;
        if (idA > idB) return 1;

        // If Cluster IDs are the same, sort by PairScore descending
        const scoreA = a["PairScore"] || -1;
        const scoreB = b["PairScore"] || -1;
        return scoreB - scoreA;
    });

    // --- Headers ---
    if (finalData.length > 0) {
        const headers = Object.keys(finalData[0]);
        ws.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
    }

    // --- Add Sorted and Enriched Data ---
    ws.addRows(finalData);


    // --- Formatting ---
    ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: 'Arial' };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002060" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const pairScoreCell = row.getCell('PairScore');
        const score = pairScoreCell.value ? Number(pairScoreCell.value) : -1;

        let fillColor: string | undefined;
        let font: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF000000' } }; // Default: bold black

        if (score >= 0.9) {
            fillColor = 'FFFF0000'; // Red
            font.color = { argb: 'FFFFFFFF' }; // White text
        } else if (score >= 0.8) {
            fillColor = 'FFFFC7CE'; // Light Red (FFC7CE)
        } else if (score >= 0.7) {
            fillColor = 'FFFFC000'; // Orange
        } else if(score > 0) {
            fillColor = 'FFFFFF00'; // Yellow
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            if (fillColor) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            }
            // Apply font styles based on the score condition
             if (score >= 0.8 || (score >= 0.7 && score < 0.8) || (score < 0.7 && score > 0)) {
                cell.font = font;
             }
             if (score >= 0.9) {
                cell.font = font; // This applies the white text color for >= 90
             }
        });
    });

    ws.columns.forEach(column => {
        let max_width = 15;
        if (column.eachCell) {
            column.eachCell({ includeEmpty: true }, cell => {
                const column_width = cell.value ? String(cell.value).length : 0;
                if (column_width > max_width) {
                    max_width = column_width;
                }
            });
        }
        column.width = Math.min(50, max_width + 2);
    });

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

    