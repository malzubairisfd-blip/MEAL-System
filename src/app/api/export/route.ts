
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { fullPairwiseBreakdown } from "../../../lib/fuzzyCluster";
import type { RecordRow } from "../../../lib/fuzzyCluster";

export async function POST(req: Request) {
  try {
    const { clusters = [], unclustered = [], originalData = [], originalColumns = [], edgesUsed = [] } = await req.json();

    const wb = new ExcelJS.Workbook();
    wb.creator = "Beneficiary Insights";
    wb.created = new Date();

    // --- SUMMARY SHEET ---
    const wsSummary = wb.addWorksheet("Summary");
    wsSummary.addRow(["Beneficiary Insights Analysis Report"]);
    wsSummary.getCell('A1').font = { size: 18, bold: true };
    wsSummary.mergeCells('A1:D1');
    wsSummary.addRow([]); // Spacer

    wsSummary.addRow(["Metric", "Value"]);
    wsSummary.getRow(3).font = { bold: true };
    wsSummary.addRow(["Total Records Processed", originalData.length]);
    wsSummary.addRow(["Clustered Records", clusters.flat().length]);
    wsSummary.addRow(["Unclustered Records", unclustered.length]);
    wsSummary.addRow(["Number of Clusters Found", clusters.length]);
    wsSummary.addRow(["Average Cluster Size", clusters.length > 0 ? (clusters.flat().length / clusters.length).toFixed(2) : 0]);
    wsSummary.columns = [{ key: 'metric', width: 30 }, { key: 'value', width: 15 }];
    wsSummary.eachRow((row, rowNumber) => {
        if (rowNumber > 2) {
            row.getCell(1).font = { bold: true };
            row.eachCell(c => c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
        }
    });


    // --- CLUSTERED DATA SHEET ---
    const wsClustered = wb.addWorksheet("Clustered Data");
    
    const scoreColumns = [
      "PairScore", "nameScore", "husbandScore", "idScore", "phoneScore", "locationScore", "childrenScore"
    ];
    
    const clusteredHeader = ["ClusterID", "InternalID", ...originalColumns, ...scoreColumns];
    wsClustered.addRow(clusteredHeader);

    wsClustered.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B0082" } }; // Indigo
      cell.alignment = { horizontal: "center" };
    });
    
    const colors = [
        "FFFFE4B5", "FFADD8E6", "FF90EE90", "FFFFB6C1", "FFE0FFFF", 
        "FFF0E68C", "FFDDA0DD", "FFB0E0E6", "FFC8A2C8", "FFF5DEB3"
    ];

    let clusterIdCounter = 1;
    for (const [clusterIndex, cluster] of clusters.entries()) {
      const pairs = fullPairwiseBreakdown(cluster as RecordRow[]);
      const pairScores = new Map<string, any>();
      for (const p of pairs) {
          const key1 = `${p.a._internalId}|${p.b._internalId}`;
          const key2 = `${p.b._internalId}|${p.a._internalId}`;
          const scores = {
            PairScore: p.score.toFixed(4),
            nameScore: p.breakdown.nameScore.toFixed(4),
            husbandScore: p.breakdown.husbandScore.toFixed(4),
            idScore: p.breakdown.idScore.toFixed(4),
            phoneScore: p.breakdown.phoneScore.toFixed(4),
            locationScore: p.breakdown.locationScore.toFixed(4),
            childrenScore: p.breakdown.childrenScore.toFixed(4),
          };
          pairScores.set(key1, scores);
          pairScores.set(key2, scores);
      }

      const clusterColor = colors[clusterIndex % colors.length];
      
      for (const record of cluster) {
        const recordIndex = parseInt((record._internalId || 'row_-1').split('_')[1]);
        if (recordIndex === -1 || recordIndex >= originalData.length) continue;
        const originalRecord = originalData[recordIndex];

        let scores: any = {};
        // Find a pair for this record to display scores
        const otherRecord = cluster.find(r => r._internalId !== record._internalId);
        if (otherRecord) {
            const pairKey = `${record._internalId}|${otherRecord._internalId}`;
            scores = pairScores.get(pairKey) || {};
        }

        const rowValues = [
          `Cluster ${clusterIdCounter}`,
          record._internalId,
          ...originalColumns.map((col: string) => originalRecord[col]),
          ...scoreColumns.map(sc => scores[sc] || "")
        ];

        const row = wsClustered.addRow(rowValues);
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: clusterColor } };
          cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });
      }
      if (cluster.length > 0) {
        wsClustered.addRow([]).eachCell(cell => cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFDDDDDD'}});
      }
      clusterIdCounter++;
    }

    // --- UNCLUSTERED DATA SHEET ---
    const wsUnclustered = wb.addWorksheet("Unclustered Data");
    wsUnclustered.addRow(["InternalID", ...originalColumns]);

    wsUnclustered.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008080" } }; // Teal
      cell.alignment = { horizontal: "center" };
    });

    for (const record of unclustered) {
      const recordIndex = parseInt((record._internalId || 'row_-1').split('_')[1]);
       if (recordIndex === -1 || recordIndex >= originalData.length) continue;
      const originalRecord = originalData[recordIndex];
      const rowValues = [record._internalId, ...originalColumns.map((col: string) => originalRecord[col])];
      const row = wsUnclustered.addRow(rowValues);
       row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });
    }

    // --- GRAPH EDGES SHEET ---
    const wsEdges = wb.addWorksheet("Graph Edges");
    const edgeHeader = ["Record_A_ID", "Record_B_ID", "Score", "nameScore", "husbandScore", "idScore", "phoneScore", "locationScore", "childrenScore"];
    wsEdges.addRow(edgeHeader);
    wsEdges.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F4F4F" } };
    });

    const allRecords: RecordRow[] = [...clusters.flat(), ...unclustered];
    const allPairs = fullPairwiseBreakdown(allRecords);

    for (const p of allPairs) {
        if(p.score < 0.60) continue; // Only show significant edges
         const row = wsEdges.addRow([
            p.a._internalId,
            p.b._internalId,
            p.score.toFixed(4),
            p.breakdown.nameScore.toFixed(4),
            p.breakdown.husbandScore.toFixed(4),
            p.breakdown.idScore.toFixed(4),
            p.breakdown.phoneScore.toFixed(4),
            p.breakdown.locationScore.toFixed(4),
            p.breakdown.childrenScore.toFixed(4),
        ]);
        row.eachCell(c => c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
    }

    // Auto-fit columns for all sheets
    [wsSummary, wsClustered, wsUnclustered, wsEdges].forEach(ws => {
        ws.columns.forEach(column => {
            if (!column.key && column.header) {
                // Ensure key is set for auto-sizing to work reliably
                column.key = Array.isArray(column.header) ? column.header.join('_') : column.header;
            }
            if (!column.key) return; // Skip if no key

            let max_width = 0;
            column.eachCell!({ includeEmpty: true }, cell => {
                const column_width = cell.value ? cell.value.toString().length : 0;
                if (column_width > max_width) {
                    max_width = column_width;
                }
            });
            // Also consider the header width
            const headerWidth = Array.isArray(column.header) ? column.header.join('').length : (column.header || '').length;
            max_width = Math.max(max_width, headerWidth);
            column.width = Math.min(50, Math.max(12, max_width + 2));
        });
    });

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=beneficiary-analysis-report.xlsx"
      }
    });
  } catch (error: any) {
    console.error('Failed to generate excel file', error);
    return new NextResponse(JSON.stringify({ error: "Failed to generate Excel file: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
