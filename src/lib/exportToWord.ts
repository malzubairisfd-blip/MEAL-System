
// src/lib/exportToWord.ts
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Numbering, Indent, UnderlineType } from "docx";
import { saveAs } from "file-saver";

interface MonitoringActivity {
  mainActivityId: string;
  mainActivityTitle: string;
  monitoredSubActivities: string[];
  personResponsible: string;
  monitoringTools: string;
  monitoringFrequency: string;
  purposeAndScope: string;
  estimatedBudget: number;
}

interface MonitoringPlan {
  projectId: string;
  monitoringActivities: MonitoringActivity[];
}

export async function generateWordDocument(plan: MonitoringPlan) {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullet-points",
          levels: [
            {
              level: 0,
              format: "bullet",
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
        {
          reference: "numbered-list",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720, right: 720, bottom: 720, left: 720,
          },
        },
      },
      children: [
        new Paragraph({
          text: "Monitoring & Evaluation Plan",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: `Project ID: ${plan.projectId}`, alignment: AlignmentType.CENTER, style: "IntenseQuote" }),
        ...plan.monitoringActivities.flatMap((activity, index) => [
          new Paragraph({
            children: [
              new TextRun({
                text: `Main Activity ${index + 1}: ${activity.mainActivityTitle}`,
                bold: true,
                underline: {
                  type: UnderlineType.SINGLE,
                  color: "auto",
                },
                size: 28, // 14pt
              }),
            ],
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: `Activities to be Monitored (${activity.monitoredSubActivities?.length || 0})`,
            heading: HeadingLevel.HEADING_3,
          }),
          ...(activity.monitoredSubActivities?.map(sub =>
            new Paragraph({
              text: sub,
              numbering: { reference: "numbered-list", level: 0 },
            })
          ) || [new Paragraph({ text: "No sub-activities selected.", style: "ListParagraph" })]),
          
          new Paragraph({ text: "Person Responsible for Monitoring", heading: HeadingLevel.HEADING_3 }),
          ...(activity.personResponsible.split('\n').map(line => new Paragraph({ text: line.replace(/^- /, ''), numbering: { reference: 'bullet-points', level: 0 } }))),

          new Paragraph({ text: "Monitoring Tools & Frequency", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ children: [new TextRun({ text: "Tools Used:", bold: true })] }),
          new Paragraph({ text: activity.monitoringTools, style: "ListParagraph" }),
          new Paragraph({ children: [new TextRun({ text: "Frequency:", bold: true })] }),
          new Paragraph({ text: activity.monitoringFrequency, style: "ListParagraph" }),

          new Paragraph({ text: "Purpose and Scope", heading: HeadingLevel.HEADING_3 }),
          ...(activity.purposeAndScope.split('\n').map(line => new Paragraph({ text: line.replace(/^- /, ''), numbering: { reference: 'bullet-points', level: 0 } }))),
        ]),
      ],
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `M&E_Plan_${plan.projectId}.docx`);
}
