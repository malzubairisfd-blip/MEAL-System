
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
                "PairScore": match.pairScore?.toFixed(4) || "",
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

    const finalData = enrichedData.map(row => {
        const clusterId = row["Cluster ID"];
        const newClusterIdValue = clusterId ? clusterMaxIdMap.get(clusterId) || "" : "";
        return {
            "Cluster ID": row["Cluster ID"],
            "Cluster_ID": newClusterIdValue,
            ...row, // The original row already contains "Cluster ID", so we need to order keys carefully
        };
    }).map(({"Cluster ID": _, ...rest}) => ({ // Remove original "Cluster ID" to re-insert at the start
        "Cluster ID": rest["Cluster ID"],
        "Cluster_ID": rest["Cluster_ID"],
        ...Object.fromEntries(Object.entries(rest).filter(([key]) => key !== "Cluster ID" && key !== "Cluster_ID"))
    }));


    // --- Sorting ---
    finalData.sort((a: any, b: any) => {
        const idA = a["Cluster ID"] || Infinity;
        const idB = b["Cluster ID"] || Infinity;
        if (idA === Infinity && idB === Infinity) return 0;
        return idA - idB;
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

    const clusterColors = ['FFFFD966', 'FFA9D18E', 'FF9BC2E6', 'FFF4B084', 'FFC5C5C5', 'FFFFAEC9'];
    let lastClusterId: any = null;
    let colorIndex = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const clusterIdCell = row.getCell('Cluster ID');
        const currentClusterId = clusterIdCell.value;

        let fillColor = undefined;
        if (currentClusterId && currentClusterId !== lastClusterId) {
            colorIndex = (colorIndex + 1) % clusterColors.length;
            lastClusterId = currentClusterId;
        }
        
        if (currentClusterId) {
            fillColor = clusterColors[colorIndex];
        } else {
             lastClusterId = null;
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            if (fillColor) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
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
