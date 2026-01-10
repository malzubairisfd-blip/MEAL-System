
// src/lib/exportSamplingPlanToExcel.ts
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Logframe } from "./logframe";

type ActivityCalculation = {
    activityId: string;
    populationSize: number;
    confidenceLevel: number;
    marginOfError: number;
    responseDistribution: number;
    recommendedSampleSize: number;
};

type SamplingPlan = {
    projectId: string;
    calculations: ActivityCalculation[];
};

export function exportSamplingPlanToExcel(logframe: Logframe, samplingPlan: SamplingPlan) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sampling Plan");
    ws.views = [{ rightToLeft: true }];

    ws.columns = [
        { header: "Goal", key: "goal", width: 40 },
        { header: "Outcome", key: "outcome", width: 40 },
        { header: "Output", key: "output", width: 40 },
        { header: "Activity", key: "activity", width: 50 },
        { header: "Population Size", key: "populationSize", width: 15 },
        { header: "Confidence Level", key: "confidenceLevel", width: 15 },
        { header: "Margin of Error", key: "marginOfError", width: 15 },
        { header: "Recommended Sample Size", key: "recommendedSampleSize", width: 20 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    headerRow.alignment = { horizontal: 'center' };

    let isFirstRow = true;

    logframe.outputs.forEach(output => {
        output.activities.forEach(activity => {
            const calc = samplingPlan.calculations.find(c => c.activityId === activity.description);
            
            ws.addRow({
                goal: isFirstRow ? logframe.goal.description : "",
                outcome: isFirstRow ? logframe.outcome.description : "",
                output: activity.description,
                activity: activity.description,
                populationSize: calc?.populationSize,
                confidenceLevel: calc ? `${calc.confidenceLevel}%` : "",
                marginOfError: calc ? `${calc.marginOfError}%` : "",
                recommendedSampleSize: calc?.recommendedSampleSize,
            });
            isFirstRow = false;
        });
    });

    // Merging cells for Goal and Outcome to span all rows
    if (ws.rowCount > 1) {
        ws.mergeCells(`A2:A${ws.rowCount}`);
        ws.getCell('A2').alignment = { vertical: 'top', wrapText: true };
        
        ws.mergeCells(`B2:B${ws.rowCount}`);
        ws.getCell('B2').alignment = { vertical: 'top', wrapText: true };
    }

    // Apply borders
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    wb.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer]), `Sampling_Plan_${logframe.projectId}.xlsx`);
    });
}
