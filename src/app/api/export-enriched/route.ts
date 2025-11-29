
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
        // Use the beneficiaryId which was mapped from the user's selected column
        if (p.beneficiaryId) {
            processedMap.set(String(p.beneficiaryId), p);
        }
    }
    
    const enrichedData = originalData.map((row: any) => {
        const lookupValue = String(row[idColumnName]);
        const match = processedMap.get(lookupValue);

        if (match) {
            return {
                "Cluster ID": match.clusterId || "",
                "PairScore": match.pairScore?.toFixed(4) || "",
                "nameScore": match.nameScore?.toFixed(4) || "",
                "husbandScore": match.husbandScore?.toFixed(4) || "",
                "idScore": match.idScore?.toFixed(4) || "",
                "phoneScore": match.phoneScore?.toFixed(4) || "",
                ...row, // Original data
                "womanName_processed": match.womanName,
                "husbandName_processed": match.husbandName,
                "children_processed": (match.children || []).join(', '),
                "nationalId_processed": match.nationalId,
                "phone_processed": match.phone,
                "village_processed": match.village,
                "subdistrict_processed": match.subdistrict,
            };
        }
        // Return original row with empty placeholders if no match
        return {
            "Cluster ID": "", "PairScore": "", "nameScore": "", "husbandScore": "", "idScore": "", "phoneScore": "",
            ...row,
             "womanName_processed": "", "husbandName_processed": "", "children_processed": "", "nationalId_processed": "", "phone_processed": "", "village_processed": "", "subdistrict_processed": "",
        };
    });

    // --- Sorting ---
    enrichedData.sort((a: any, b: any) => {
        const idA = a["Cluster ID"] || Infinity;
        const idB = b["Cluster ID"] || Infinity;
        if (idA === Infinity && idB === Infinity) return 0;
        return idA - idB;
    });

    // --- Headers ---
    if (enrichedData.length > 0) {
        const headers = Object.keys(enrichedData[0]);
        ws.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
    }

    // --- Add Sorted and Enriched Data ---
    ws.addRows(enrichedData);


    // --- Formatting ---
    // Style header
    ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: 'Arial' };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002060" } }; // Dark Blue
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Style data rows and apply conditional formatting for clusters
    const clusterColors = ['FFFFD966', 'FFA9D18E', 'FF9BC2E6', 'FFF4B084', 'FFC5C5C5', 'FFFFAEC9'];
    let lastClusterId = null;
    let colorIndex = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const clusterIdCell = row.getCell('Cluster ID');
        const currentClusterId = clusterIdCell.value;

        let fillColor = undefined;
        if (currentClusterId) {
            if (currentClusterId !== lastClusterId) {
                colorIndex = (colorIndex + 1) % clusterColors.length;
                lastClusterId = currentClusterId;
            }
            fillColor = clusterColors[colorIndex];
        } else {
             lastClusterId = null; // Reset for unclustered rows
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            if (fillColor) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            }
        });
    });

    // Auto-fit columns
    ws.columns.forEach(column => {
        let max_width = 15; // minimum width
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
