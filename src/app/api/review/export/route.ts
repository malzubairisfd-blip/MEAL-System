
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { fullPairwiseBreakdown, type RecordRow } from "../../../../lib/fuzzyCluster";

export async function POST(req: Request) {
  try {
    const { clusters = [], allRecords = [], aiSummaries = {} } = await req.json();

    const wb = new ExcelJS.Workbook();
    wb.creator = "Beneficiary Insights";
    wb.created = new Date();
    wb.lastModifiedBy = "Beneficiary Insights";

    // --- Sheet 1: Summary ---
    createSummarySheet(wb, allRecords, clusters);

    // --- Sheet 2: All Records ---
    createAllRecordsSheet(wb, allRecords, clusters);

    // --- Sheet 3: Clusters ---
    createClustersSheet(wb, clusters, aiSummaries);

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=review-export.xlsx",
      },
    });

  } catch (error: any) {
    console.error('Failed to generate review export file', error);
    return NextResponse.json({ error: "Failed to generate Excel file: " + error.message }, { status: 500 });
  }
}

function createSummarySheet(wb: ExcelJS.Workbook, allRecords: RecordRow[], clusters: RecordRow[][]) {
    const ws = wb.addWorksheet("ملخص");
    ws.views = [{ rightToLeft: true }];
    
    // --- Set column widths ---
    ws.columns = [
        { width: 5 }, { width: 25 }, { width: 5 }, { width: 5 }, { width: 25 }, { width: 5 }
    ];

    // --- Title ---
    ws.mergeCells('B2:E2');
    const titleCell = ws.getCell('B2');
    titleCell.value = "تقرير مراجعة المجموعات";
    titleCell.font = { size: 24, bold: true, name: 'Calibri', family: 2 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 40;

    // --- Stats Calculation ---
    const totalRecords = allRecords.length;
    const clusteredRecordsCount = clusters.flat().length;
    const unclusteredRecordsCount = totalRecords - clusteredRecordsCount;
    const numClusters = clusters.length;
    const avgClusterSize = numClusters > 0 ? (clusteredRecordsCount / numClusters) : 0;

    // --- Define Card Data ---
    const statsData = [
        [
            { title: "إجمالي السجلات المعالجة", value: totalRecords, icon: "👥" },
            { title: "عدد المجموعات", value: numClusters, icon: "📂" },
        ],
        [
            { title: "السجلات المجمعة", value: clusteredRecordsCount, icon: "🔗" },
            { title: "السجلات غير المجمعة", value: unclusteredRecordsCount, icon: "👤" },
        ],
        [
            { title: "متوسط حجم المجموعة", value: avgClusterSize.toFixed(2), icon: "📊" },
            null // Placeholder for empty cell
        ]
    ];
    
    // --- Create Cards ---
    let currentRow = 4;
    statsData.forEach(rowItems => {
        rowItems.forEach((stat, colIndex) => {
            if (!stat) return;
            
            const startCol = colIndex === 0 ? 'B' : 'E';
            
            const startColNum = colIndex === 0 ? 2 : 5; // B is 2, E is 5
            const endColNum = startColNum + 1; // Merge 2 columns
            const endRow = currentRow + 3;

            ws.mergeCells(currentRow, startColNum, endRow, endColNum);
            const cardCell = ws.getCell(startCol + currentRow);
            
            cardCell.value = {
                richText: [
                    { text: `${stat.icon}\n`, font: { size: 36, name: 'Segoe UI Emoji', color: { argb: 'FF00529B' } } },
                    { text: `${stat.title}\n`, font: { size: 14, name: 'Calibri', color: { argb: 'FF002060' } } },
                    { text: `${stat.value}`, font: { size: 24, bold: true, name: 'Calibri' } },
                ]
            };

            cardCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cardCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2FF' } }; // Light Blue
            cardCell.border = {
                top: { style: 'thin', color: { argb: 'FFB0C4DE' } },
                left: { style: 'thin', color: { argb: 'FFB0C4DE' } },
                bottom: { style: 'thin', color: { argb: 'FFB0C4DE' } },
                right: { style: 'thin', color: { argb: 'FFB0C4DE' } },
            };
        });
        currentRow += 5;
    });
}


function createAllRecordsSheet(wb: ExcelJS.Workbook, allRecords: RecordRow[], clusters: RecordRow[][]) {
  const ws = wb.addWorksheet("جميع السجلات");
  ws.views = [{ rightToLeft: true }];
  
  const recordToClusterIdMap = new Map<string, number>();
  clusters.forEach((cluster, index) => {
    cluster.forEach(record => {
      recordToClusterIdMap.set(record._internalId!, index + 1);
    });
  });

  const headers = Object.keys(allRecords[0] || {}).filter(h => h !== '_internalId');
  ws.columns = [
    { header: "معرف المجموعة", key: "clusterId", width: 15 },
    ...headers.map(h => ({ header: h, key: h, width: 25 })),
  ];
  
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }};
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } }; // Blue
  headerRow.alignment = { horizontal: 'center' };


  allRecords.forEach(record => {
    const clusterId = recordToClusterIdMap.get(record._internalId!) || '';
    ws.addRow({ ...record, clusterId });
  });
}


function createClustersSheet(wb: ExcelJS.Workbook, clusters: RecordRow[][], aiSummaries: { [key: number]: string }) {
    const ws = wb.addWorksheet("تفاصيل المجموعات");
    ws.views = [{ rightToLeft: true }];

    const headers = [
        "معرف المجموعة", "ملخص الذكاء الاصطناعي", "الدرجة", "اسم المرأة", "اسم الزوج", "الرقم القومي", "الهاتف", "الأطفال"
    ];
    ws.columns = headers.map(h => ({ header: h, key: h.replace(/\s/g, ''), width: h === 'ملخص الذكاء الاصطناعي' ? 60 : 25 }));
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }; // Darker Blue
    headerRow.alignment = { horizontal: 'center' };

    let currentRowIndex = 2; // Start after header
    clusters.forEach((cluster, index) => {
        const clusterId = index + 1;
        const pairs = fullPairwiseBreakdown(cluster);
        if (pairs.length === 0 && cluster.length < 2) return;
        
        const clusterRowCount = Math.max(1, pairs.length > 0 ? pairs.length * 2 : cluster.length);
        const startRow = currentRowIndex;
        const endRow = startRow + clusterRowCount - 1;
        
        const aiSummary = aiSummaries[clusterId] || '';

        if (pairs.length > 0) {
             pairs.forEach(pair => {
                ws.addRow({
                    'الدرجة': pair.score.toFixed(4),
                    'اسمالمرأة': pair.a.womanName, 'اسمالزوج': pair.a.husbandName, 'الرقمالقومي': pair.a.nationalId, 'الهاتف': pair.a.phone, 'الأطفال': (pair.a.children || []).join(', '),
                });
                 ws.addRow({
                    'اسمالمرأة': pair.b.womanName, 'اسمالزوج': pair.b.husbandName, 'الرقمالقومي': pair.b.nationalId, 'الهاتف': pair.b.phone, 'الأطفال': (pair.b.children || []).join(', '),
                });
            });
        } else {
            cluster.forEach(record => {
                 ws.addRow({
                    'اسمالمرأة': record.womanName, 'اسمالزوج': record.husbandName, 'الرقمالقومي': record.nationalId, 'الهاتف': record.phone, 'الأطفال': (record.children || []).join(', '),
                });
            });
        }
        
        // Merge cells for Cluster ID and AI Summary
        if (clusterRowCount > 0) {
            ws.mergeCells(`A${startRow}:A${endRow}`);
            const clusterIdCell = ws.getCell(`A${startRow}`);
            clusterIdCell.value = clusterId;
            clusterIdCell.alignment = { vertical: 'middle', horizontal: 'center' };

            ws.mergeCells(`B${startRow}:B${endRow}`);
            const summaryCell = ws.getCell(`B${startRow}`);
            summaryCell.value = aiSummary;
            summaryCell.alignment = { vertical: 'top', horizontal: 'right', wrapText: true };
        }

        for (let i = startRow; i <= endRow; i++) {
            const row = ws.getRow(i);
            const scoreCell = row.getCell('الدرجة');
            const score = parseFloat(scoreCell.value as string);
             if (score) {
                scoreCell.font = { bold: true };
                if (score > 0.9) scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
                else if (score > 0.8) scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
            }

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const border: Partial<ExcelJS.Borders> = {};
                if (i === startRow) border.top = { style: 'thick', color: { argb: 'FF4F81BD' } };
                if (i === endRow) border.bottom = { style: 'thick', color: { argb: 'FF4F81BD' } };
                if (colNumber === 1) border.left = { style: 'thick', color: { argb: 'FF4F81BD' } };
                if (colNumber === ws.columns.length) border.right = { style: 'thick', color: { argb: 'FF4F81BD' } };
                if (i < endRow && !border.bottom) border.bottom = { style: 'thin', color: { argb: 'FFD9D9D9' }};
                if (colNumber > 1 && !border.left) border.left = {style: 'thin', color: { argb: 'FFD9D9D9' }};
                cell.border = { ...cell.border, ...border };
            });
        }
        
        currentRowIndex = endRow + 1;
    });
}
