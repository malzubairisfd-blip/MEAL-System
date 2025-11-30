
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

// This endpoint is now simplified and can be deprecated or used for a simple summary.
// The main logic is moved to /api/review/export
export async function POST(req: Request) {
  try {
    const { clusters = [], allRecords: originalData = [] } = await req.json();

    const wb = new ExcelJS.Workbook();
    wb.creator = "Beneficiary Insights";
    wb.created = new Date();

    // --- SUMMARY SHEET ---
    const wsSummary = wb.addWorksheet("ملخص");
    wsSummary.views = [{ rightToLeft: true }];
    wsSummary.addRow(["تقرير تحليل رؤى المستفيدين"]);
    wsSummary.getCell('A1').font = { size: 18, bold: true };
    wsSummary.mergeCells('A1:D1');
    wsSummary.getCell('A1').alignment = { horizontal: 'center' };
    wsSummary.addRow([]); // Spacer

    const clusteredRecordsCount = clusters.flat().length;
    wsSummary.addRow(["المقياس", "القيمة"]);
    wsSummary.getRow(3).font = { bold: true };
    wsSummary.addRow(["إجمالي السجلات المعالجة", originalData.length]);
    wsSummary.addRow(["السجلات المجمعة", clusteredRecordsCount]);
    wsSummary.addRow(["السجلات غير المجمعة", originalData.length - clusteredRecordsCount]);
    wsSummary.addRow(["عدد المجموعات التي تم العثور عليها", clusters.length]);
    wsSummary.addRow(["متوسط حجم المجموعة", clusters.length > 0 ? (clusteredRecordsCount / clusters.length).toFixed(2) : 0]);
    wsSummary.columns = [{ key: 'metric', width: 30 }, { key: 'value', width: 15 }];
    wsSummary.eachRow((row, rowNumber) => {
        if (rowNumber > 2) {
            row.getCell(1).font = { bold: true };
            row.eachCell(c => {
              c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              c.alignment = { horizontal: 'right' };
            });
        }
    });

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=summary-sheet.xlsx"
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
