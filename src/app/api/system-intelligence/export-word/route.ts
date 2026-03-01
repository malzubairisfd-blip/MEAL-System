import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";
import { scanFiles } from "@/lib/systemScanner";
import { readSchemas } from "@/lib/schemaReader";
import { analyzeAPIs } from "@/lib/apiAnalyzer";
import { buildRiskDocumentation } from "@/lib/riskBuilder";

export async function POST() {
  const files = await scanFiles();
  const schemas = readSchemas();
  const apis = await analyzeAPIs();
  const risks = buildRiskDocumentation();

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: "System Architecture & Governance Manual",
      heading: HeadingLevel.TITLE,
    })
  );

  children.push(
    new Paragraph({
      text: "Executive Summary",
      heading: HeadingLevel.HEADING_1,
    })
  );

  children.push(
    new Paragraph(
      "This system ensures fraud detection, structured governance, and ISO 27001 aligned architecture."
    )
  );

  children.push(
    new Paragraph({
      text: "Source Code Overview",
      heading: HeadingLevel.HEADING_1,
    })
  );

  files.forEach((f) => {
    children.push(new Paragraph({ text: `File: ${f.file}`, heading: HeadingLevel.HEADING_2 }));
    if (f.functions?.length) {
      children.push(new Paragraph(`Functions: ${f.functions.join(", ")}`));
    }
  });

  children.push(
    new Paragraph({
      text: "Database Schema",
      heading: HeadingLevel.HEADING_1,
    })
  );

  Object.keys(schemas).forEach((table) => {
    children.push(new Paragraph({ text: `Table: ${table}`, heading: HeadingLevel.HEADING_2 }));
    schemas[table].forEach((col: any) => {
      children.push(new Paragraph(`- ${col.name} (${col.type})`));
    });
  });

  children.push(
    new Paragraph({
      text: "API Endpoints",
      heading: HeadingLevel.HEADING_1,
    })
  );

  apis.forEach((api) => {
    children.push(new Paragraph({ text: `Route: ${api.route}`, heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph(`Methods: ${api.methods.join(", ")}`));
  });

  children.push(
    new Paragraph({
      text: "Risk Governance",
      heading: HeadingLevel.HEADING_1,
    })
  );

  risks.risks.forEach((risk) => {
    children.push(new Paragraph({ text: risk.category, heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph(`Description: ${risk.description}`));
    children.push(new Paragraph(`Mitigation: ${risk.mitigation}`));
  });

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=System_Manual.docx",
    },
  });
}
