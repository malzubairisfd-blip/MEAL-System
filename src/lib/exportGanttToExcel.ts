// lib/exportGanttToExcel.ts
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { GanttTask } from "@/types/gantt";
import { buildDayRange } from "./ganttTimeline";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export function exportGanttToExcel(
  tasks: GanttTask[],
  projectStart: string,
  projectEnd: string
) {
  const days = buildDayRange(projectStart, projectEnd);

  const header = [
    "الرمز",
    "اسم النشاط",
    "نسبة الإنجاز",
    ...days.map(d => dayjs(d).format("DD/MM")),
  ];

  const rows: any[][] = [header];

  const flatTasks: { task: any; level: number }[] = [];

  const flattenTasks = (tasksToFlatten: GanttTask[], level: number) => {
    tasksToFlatten.forEach(t => {
      flatTasks.push({ task: t, level: level });
      if (t.hasSubTasks === "yes" && t.subTasks) {
        t.subTasks.forEach(st => {
          flatTasks.push({ task: st, level: level + 1 });
           if (st.hasSubOfSubTasks === "yes" && st.subOfSubTasks) {
            st.subOfSubTasks.forEach(sst => {
              flatTasks.push({ task: sst, level: level + 2 });
            });
          }
        });
      }
    });
  };

  flattenTasks(tasks, 0);

  flatTasks.forEach(({ task, level }) => {
    const row = [
      "", // Placeholder for code
      " ".repeat(level * 4) + task.title,
      (task.progress ?? 0) / 100,
    ];

    days.forEach(day => {
      const inRange =
        dayjs(day).isSameOrAfter(task.start, "day") &&
        dayjs(day).isSameOrBefore(task.end, "day");

      row.push(inRange ? "■" : "");
    });

    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // RTL
  ws["!dir"] = "rtl";

  // COLUMN WIDTHS
  ws["!cols"] = [
    { wch: 10 }, // code
    { wch: 60 }, // task text
    { wch: 14 }, // progress
    ...days.map(() => ({ wch: 4 })), // timeline
  ];

  // STYLING
  Object.keys(ws).forEach(cell => {
    if (cell.startsWith("!")) return;

    const col = XLSX.utils.decode_cell(cell).c;
    const isTimeline = col >= 3;

    ws[cell].s = {
      alignment: {
        horizontal: isTimeline ? "center" : "right",
        vertical: "center",
        wrapText: true,
      },
      font: {
        name: "Arial",
        sz: 11,
        color: { rgb: "FFFFFF" },
      },
      fill: {
        fgColor: {
          rgb: ws[cell].v === "■" ? "4B0082" : "1E40AF", 
        },
      },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  });

  // HEADER STYLE
  header.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    ws[cell].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "020617" } },
    };
  });

  // PERCENT FORMAT
  for (let r = 1; r < rows.length; r++) {
    const cell = ws[`C${r + 1}`];
    if (cell) {
      cell.t = "n";
      cell.z = "0%";
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الخطة الزمنية");

  const buffer = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
    cellStyles: true,
  });

  saveAs(
    new Blob([buffer], { type: "application/octet-stream" }),
    "Project_Gantt_Timeline.xlsx"
  );
}
