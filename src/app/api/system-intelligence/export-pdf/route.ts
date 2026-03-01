import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { scanFiles } from "@/lib/systemScanner";
import { readSchemas } from "@/lib/schemaReader";
import { analyzeAPIs } from "@/lib/apiAnalyzer";
import { buildRiskDocumentation } from "@/lib/riskBuilder";

export async function POST() {
  const files = await scanFiles();
  const schemas = readSchemas();
  const apis = await analyzeAPIs();
  const risks = buildRiskDocumentation();

  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const logoPath = path.join(process.cwd(), "public/logo.png");

  /*
  =====================================================
  COVER PAGE
  =====================================================
  */

  // Since we cannot generate images, we will just add a text placeholder for the logo
  doc.fontSize(10).text("[Project Logo]", doc.page.width / 2 - 60, 120, { width: 120, align: 'center' });


  doc.moveDown(8);
  doc
    .fontSize(24)
    .text("System Architecture & Governance Manual", {
      align: "center",
    });

  doc.moveDown();
  doc
    .fontSize(14)
    .text("Enterprise System Intelligence Report", {
      align: "center",
    });

  doc.moveDown(2);
  doc
    .fontSize(10)
    .text(`Generated: ${new Date().toLocaleString()}`, {
      align: "center",
    });

  doc.addPage();

  /*
  =====================================================
  TABLE OF CONTENTS
  =====================================================
  */

  const tocEntries: { title: string; page: number }[] = [];

  const addSection = (title: string) => {
    tocEntries.push({ title, page: doc.bufferedPageRange().count + 1 });
    doc.fontSize(18).text(title, { underline: true });
    doc.moveDown();
  };

  doc.fontSize(20).text("Table of Contents", { align: "left" });
  doc.moveDown(2);

  const tocPageIndex = doc.bufferedPageRange().count;
  doc.addPage();

  /*
  =====================================================
  EXECUTIVE SUMMARY
  =====================================================
  */

  addSection("1. Executive Summary");

  doc
    .fontSize(11)
    .text(
      "This system ensures fraud detection, structured data governance, and ISO 27001-aligned security architecture."
    );

  doc.addPage();

  /*
  =====================================================
  SOURCE CODE OVERVIEW
  =====================================================
  */

  addSection("2. Source Code Overview");

  files.forEach((f) => {
    doc.fontSize(12).text(`File: ${f.file}`);
    if (f.functions?.length) {
      doc.fontSize(10).text(`Functions: ${f.functions.join(", ")}`);
    }
    doc.moveDown();
  });

  doc.addPage();

  /*
  =====================================================
  DATABASE SCHEMA
  =====================================================
  */

  addSection("3. Database Schema");

  Object.keys(schemas).forEach((table) => {
    doc.fontSize(13).text(`Table: ${table}`);
    schemas[table].forEach((col: any) => {
      doc.fontSize(10).text(` - ${col.name} (${col.type})`);
    });
    doc.moveDown();
  });

  doc.addPage();

  /*
  =====================================================
  ER DIAGRAM PAGE
  =====================================================
  */

  addSection("4. Entity Relationship Diagram");

  let y = doc.y + 20;
  Object.keys(schemas).forEach((table, i) => {
    doc.rect(100, y, 400, 25).stroke();
    doc.text(table, 110, y + 7);

    y += 40;
  });

  doc.moveDown(2);
  doc.fontSize(10).text("Entities derived from SQLite schema tables.");

  doc.addPage();

  /*
  =====================================================
  API ENDPOINTS
  =====================================================
  */

  addSection("5. API Endpoints");

  apis.forEach((api) => {
    doc.fontSize(12).text(`Route: ${api.route}`);
    doc.fontSize(10).text(`Methods: ${api.methods.join(", ")}`);
    doc.moveDown();
  });

  doc.addPage();

  /*
  =====================================================
  RISK GOVERNANCE
  =====================================================
  */

  addSection("6. Risk Governance");

  risks.risks.forEach((risk) => {
    doc.fontSize(12).text(risk.category);
    doc.fontSize(10).text(`Description: ${risk.description}`);
    doc.fontSize(10).text(`Mitigation: ${risk.mitigation}`);
    doc.moveDown();
  });
  
    // This is a placeholder, as generating the TOC properly requires knowing page numbers in advance
    // which is complex. This just lists the sections.
    doc.switchToPage(tocPageIndex);
    doc.fontSize(12).text('Table of Contents');
    doc.moveDown();
    tocEntries.forEach(entry => {
        doc.fontSize(10).text(`${entry.title} .................... Page ${entry.page}`);
    });


  /*
  =====================================================
  PAGINATION FOOTER
  =====================================================
  */

  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).text(
      `Page ${i + 1} of ${range.count}`,
      0,
      doc.page.height - 40,
      { align: "center" }
    );
  }

  doc.end();

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Enterprise_System_Manual.pdf",
    },
  });
}
