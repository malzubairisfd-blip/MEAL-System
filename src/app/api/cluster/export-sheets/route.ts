
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { fullPairwiseBreakdown } from "../../../../lib/fuzzyCluster";
import type { RecordRow } from "../../../../lib/fuzzyCluster";

export async function POST(req: Request) {
  try {
    const { clusters = [], unclustered = [], originalData = [], originalColumns = [] } = await req.json();

    // --- Summary & Stats Sheet ---
    const summaryWb = new ExcelJS.Workbook();
    const wsSummary = summaryWb.addWorksheet("Summary");
    wsSummary.views = [{ rightToLeft: true }];
    wsSummary.addRow(["المقياس", "القيمة"]);
    wsSummary.getRow(1).font = { bold: true };

    const clusteredRecordsCount = clusters.flat().length;
    wsSummary.addRow(["إجمالي السجلات المعالجة", originalData.length]);
    wsSummary.addRow(["السجلات المجمعة", clusteredRecordsCount]);
    wsSummary.addRow(["السجلات غير المجمعة", originalData.length - clusteredRecordsCount]);
    wsSummary.addRow(["عدد المجموعات التي تم العثور عليها", clusters.length]);

    // Cluster size distribution
    const sizeDist = clusters.reduce((acc: any, c: any) => {
        const size = c.length;
        acc[size] = (acc[size] || 0) + 1;
        return acc;
    }, {});
    wsSummary.addRow([]);
    wsSummary.addRow(["توزيع حجم المجموعة"]);
    wsSummary.getRow(wsSummary.rowCount).font = { bold: true };
    for (const size in sizeDist) {
        wsSummary.addRow([`مجموعات من ${size} سجلات`, sizeDist[size]]);
    }
    wsSummary.columns = [{ width: 30 }, { width: 15 }];


    // --- Graph Edges Sheet ---
    const graphWb = new ExcelJS.Workbook();
    const wsEdges = graphWb.addWorksheet("Graph Edges");
    wsEdges.views = [{ rightToLeft: true }];
    const scoreColumnsArabic = ["الدرجة", "درجة الاسم", "درجة الزوج", "درجة الهوية", "درجة الهاتف", "درجة الموقع", "درجة الأطفال"];
    const edgeHeader = ["معرف السجل أ", "معرف السجل ب", ...scoreColumnsArabic];
    wsEdges.addRow(edgeHeader);
    wsEdges.getRow(1).font = { bold: true };

    const allRecords: RecordRow[] = [...clusters.flat(), ...unclustered];
    const allPairs = fullPairwiseBreakdown(allRecords);

    for (const p of allPairs) {
        if(p.score < 0.60) continue; // Only show significant edges
         wsEdges.addRow([
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
    }
    wsEdges.columns = edgeHeader.map(h => ({ header: h, key: h, width: 20 }));

    const summaryBuffer = await summaryWb.xlsx.writeBuffer();
    const graphBuffer = await graphWb.xlsx.writeBuffer();

    return NextResponse.json({
      summary: Buffer.from(summaryBuffer).toString('base64'),
      graph: Buffer.from(graphBuffer).toString('base64'),
    });

  } catch (error: any) {
    console.error('Failed to generate excel sheets', error);
    return new NextResponse(JSON.stringify({ error: "Failed to generate Excel sheets: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

    