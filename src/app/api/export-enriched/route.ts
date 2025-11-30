
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function POST(req: Request) {
  try {
    const { finalData = [], originalHeaders = [] } = await req.json();

    if (finalData.length === 0) {
      return NextResponse.json(
        { error: "Enriched data is empty. Cannot generate report." },
        { status: 400 }
      );
    }
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Enriched Data");
    ws.views = [{ rightToLeft: true }];

    const finalHeaders = [
      "Cluster_ID", "ClusterSize", "Flag", "pairScore", "nameScore",
      "husbandScore", "idScore", "phoneScore", "locationScore", "childrenScore",
      ...originalHeaders.filter((h: string) => ![
        "womanName", "husbandName", "nationalId", "phone", "village", "subdistrict", "children", "beneficiaryId"
      ].includes(h)),
       "womanName", "husbandName", "nationalId", "phone", "village", "subdistrict", "children",
    ];

    ws.columns = finalHeaders.map((h: string) => ({
      header: h,
      key: h,
      width: ["womanName", "husbandName"].includes(h) ? 25 : 15,
    }));
    
    ws.addRows(finalData);

    // --- Formatting ---
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF002060" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" },
      };
    });

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const pairScoreCell = row.getCell("pairScore");
      if (pairScoreCell.value === null || pairScoreCell.value === undefined) return;
      const score = Number(pairScoreCell.value);

      let fillColor: string | undefined;
      let fontColor = "FF000000";

      if (score >= 0.9) {
        fillColor = "FFFF0000"; fontColor = "FFFFFFFF";
      } else if (score >= 0.8) {
        fillColor = "FFFFC7CE";
      } else if (score >= 0.7) {
        fillColor = "FFFFC000";
      } else if (score > 0) {
        fillColor = "FFFFFF00";
      }

      if (fillColor) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
          cell.font = { ...cell.font, bold: true, color: { argb: fontColor } };
        });
      }
       row.alignment = { ...row.alignment, horizontal: 'right' };
    });

    let lastClusterId: number | string | null = null;
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const currentClusterId = row.getCell("Cluster_ID").value;
      if (currentClusterId !== null && currentClusterId !== lastClusterId) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = { ...cell.border, top: { style: "thick" } };
        });
      }
      lastClusterId = currentClusterId;
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="enriched-data-report.xlsx"',
      },
    });

  } catch (error: any) {
    console.error("Failed to generate enriched excel file:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel file: " + error.message },
      { status: 500 }
    );
  }
}
