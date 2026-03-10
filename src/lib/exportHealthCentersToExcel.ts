// src/lib/exportHealthCentersToExcel.ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function exportHealthCentersToExcel(records: any[], columns: string[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Health_Centers');

  worksheet.columns = columns.map(col => ({
    header: col.replace(/_/g, ' '),
    key: col,
    width: col.length > 20 ? 30 : 20,
  }));
  
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
  headerRow.alignment = { horizontal: 'center' };

  worksheet.addRows(records);

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), 'health_centers_database.xlsx');
}
