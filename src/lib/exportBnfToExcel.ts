// src/lib/exportBnfToExcel.ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function exportBnfToExcel(records: any[], columns: string[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Beneficiaries');

  // Add headers
  worksheet.columns = columns.map(col => ({
    header: col.replace(/_/g, ' '),
    key: col,
    width: col.length > 20 ? 30 : 20,
  }));
  
  // Style header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF002060' }
  };
  headerRow.alignment = { horizontal: 'center' };

  // Add data
  worksheet.addRows(records);

  // Freeze first column and make it bold
  worksheet.views = [
    { state: 'frozen', xSplit: 1, ySplit: 1, activeCell: 'B2' }
  ];
  worksheet.getColumn(1).font = { bold: true };
  
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
  saveAs(new Blob([buffer]), 'beneficiaries_database.xlsx');
}
