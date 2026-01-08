// src/lib/exportGanttToPDF.ts
import { GanttTask } from "@/types/gantt";
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

export async function exportGanttToPDF(
  tasks: GanttTask[],
  projectStart: string,
  projectEnd: string
) {
  const ganttElement = document.querySelector('.gantt-chart-container') as HTMLElement;
  if (!ganttElement) {
    console.error("Gantt chart element not found for PDF export.");
    return;
  }

  try {
    const dataUrl = await toPng(ganttElement, {
      cacheBust: true,
      pixelRatio: 2,
      style: {
        backgroundColor: '#020617', // slate-900
      }
    });
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [ganttElement.offsetWidth, ganttElement.offsetHeight]
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, ganttElement.offsetWidth, ganttElement.offsetHeight);
    pdf.save('gantt-chart.pdf');
    
  } catch (error) {
    console.error('oops, something went wrong!', error);
  }
}
