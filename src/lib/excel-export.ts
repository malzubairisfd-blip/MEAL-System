import ExcelJS from "exceljs";

export async function generateExcel(applicants: any[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Interview Results");

  sheet.columns = [
    { header: "م", key: "i", width: 5 },
    { header: "رقم المتقدمة", key: "id", width: 20 },
    { header: "الاسم", key: "name", width: 30 },
    { header: "الهاتف", key: "phone", width: 20 },
    { header: "القرار", key: "decision", width: 15 },
  ];

  applicants.forEach((a, i) => {
    sheet.addRow({
      i: i + 1,
      id: a._id,
      name: a["المتقدم/ة رباعيا مع اللقب"],
      phone: a.phoneNumber || "",
      decision: a["Acceptance Statement"],
    });
  });

  return workbook.xlsx.writeBuffer();
}
