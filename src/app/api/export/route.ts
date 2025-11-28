import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function POST(req: Request) {
  try {
    const { clusters } = await req.json();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Clusters");

    // HEADER
    ws.addRow([
      "ClusterID",
      "Woman Name",
      "Husband Name",
      "National ID",
      "Phone",
      "Village",
      "Subdistrict",
      "Children",
    ]);

    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4B0082" } // Indigo
      };
      cell.alignment = { horizontal: "center" };
    });
    
    const colors = [
        "FFFFE4B5", "FFADD8E6", "FF90EE90", "FFFFB6C1", "FFE0FFFF", 
        "FFF0E68C", "FFDDA0DD", "FFB0E0E6", "FFC8A2C8", "FFF5DEB3"
    ];

    let clusterIdCounter = 1;
    clusters.forEach((cluster: any[], clusterIndex: number) => {
      const clusterColor = colors[clusterIndex % colors.length];
      cluster.forEach((r: any) => {
        const row = ws.addRow([
          `Cluster ${clusterIdCounter}`,
          r.womanName,
          r.husbandName,
          r.nationalId,
          r.phone,
          r.village,
          r.subdistrict,
          Array.isArray(r.children) ? r.children.join(", ") : r.children,
        ]);
        
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: clusterColor }
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          };
        });
      });
      clusterIdCounter++;
    });

    // Auto-fit columns
    ws.columns.forEach(column => {
        let max_width = 0;
        const column_letter = column.letter;
        column.eachCell({ includeEmpty: true }, cell => {
            if (cell.value) {
                const column_width = cell.value.toString().length;
                if (column_width > max_width) {
                    max_width = column_width;
                }
            }
        });
        if (max_width > 10) {
          column.width = max_width + 4;
        } else {
          column.width = 15;
        }
    });


    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=clustered-output.xlsx"
      }
    });
  } catch (error: any) {
    console.error('Failed to generate excel file', error);
    return new NextResponse(JSON.stringify({ error: "Failed to generate Excel file." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
