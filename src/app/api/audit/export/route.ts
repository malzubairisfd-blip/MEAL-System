// src/app/api/audit/export/route.ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import type { AuditFinding, RecordRow } from "@/lib/auditEngine";

export async function POST(req: Request) {
  try {
    const { findings = [] }: { findings: AuditFinding[] } = await req.json();

    if (findings.length === 0) {
      return NextResponse.json({ ok: false, error: "No findings to export" }, { status: 400 });
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("نتائج التدقيق");

    // Define columns
    ws.columns = [
      { header: "الخطورة", key: "severity", width: 12 },
      { header: "نوع النتيجة", key: "type", width: 30 },
      { header: "الوصف", key: "description", width: 50 },
      { header: "الزوجة المتأثرة", key: "womanName", width: 25 },
      { header: "الزوج المتأثر", key: "husbandName", width: 25 },
      { header: "الرقم القومي", key: "nationalId", width: 20 },
      { header: "الهاتف", key: "phone", width: 20 },
      { header: "القرية", key: "village", width: 20 },
    ];
    
    // Set RTL for the worksheet
    ws.views = [{ rightToLeft: true }];

    // Style header
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC00000" } }; // Dark Red
      cell.alignment = { horizontal: "center" };
    });

    // Add data rows
    for (const finding of findings) {
      if (finding.records.length > 0) {
        for (const record of finding.records) {
          const row = ws.addRow({
            severity: finding.severity,
            type: finding.type,
            description: finding.description,
            womanName: record.womanName,
            husbandName: record.husbandName,
            nationalId: record.nationalId,
            phone: record.phone,
            village: record.village,
          });
          // Apply styling based on severity
            const severityColor = finding.severity === 'high' ? 'FFFFC7CE' : finding.severity === 'medium' ? 'FFFFEB9C' : 'FFC6EFCE';
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severityColor } };
                cell.alignment = { horizontal: 'right' };
            });
        }
      } else {
        // Handle findings with no records
         const row = ws.addRow({
            severity: finding.severity,
            type: finding.type,
            description: finding.description,
        });
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { horizontal: 'right' };
        });
      }
       // Add a separator row
      ws.addRow([]).eachCell(cell => cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFDDDDDD'}});
    }
    
    // Auto-fit columns
    ws.columns.forEach(column => {
        let max_width = 0;
        column.eachCell!({ includeEmpty: true }, cell => {
            const column_width = cell.value ? cell.value.toString().length : 0;
            if (column_width > max_width) {
                max_width = column_width;
            }
        });
        column.width = Math.min(50, Math.max(12, max_width + 2));
    });


    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=audit-report-arabic.xlsx",
      },
    });
  } catch (error: any) {
    console.error("Failed to generate audit excel file", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to generate Excel file: " + error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
