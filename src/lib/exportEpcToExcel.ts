// src/lib/exportEpcToExcel.ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function exportEpcToExcel(records: any[], columns: string[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Education_Payment_Centers');

  // Add headers
  worksheet.columns = columns.map(col => ({
    header: col.replace(/_/g, ' '),
    key: col,
    width: col.length > 20 ? 30 : (col.length < 10 ? 12 : 20),
  }));
  
  // Style header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF002060' } // Dark blue
  };
  headerRow.alignment = { horizontal: 'center' };

  // Add data
  worksheet.addRows(records);

  // Freeze top row
  worksheet.views = [
    { state: 'frozen', ySplit: 1, activeCell: 'A2' }
  ];
  
  // Add borders to all cells
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

  // Write to buffer and save
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), 'education_payment_centers.xlsx');
}
