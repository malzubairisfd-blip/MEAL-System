import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import fs from "fs/promises";
import path from "path";
import { scanFiles } from "@/lib/systemScanner";
import { readSchemas } from "@/lib/schemaReader";
import { analyzeAPIs } from "@/lib/apiAnalyzer";
import { buildRiskDocumentation } from "@/lib/riskBuilder";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// --- Helper functions for HTML generation ---

function generateERDSvg(schemas: any) {
    if (!schemas || Object.keys(schemas).length === 0) {
        return '<p>No database schema found to generate ERD.</p>';
    }

    const tables = Object.keys(schemas);
    const tableWidth = 200;
    const tableHeaderHeight = 30;
    const rowHeight = 20;
    const tableGap = 40;
    let currentX = 20;
    let svgContent = '';
    const tablePositions: { [key: string]: { x: number, y: number, height: number } } = {};

    tables.forEach(table => {
        const columns = schemas[table];
        const tableHeight = tableHeaderHeight + (columns.length * rowHeight) + 10;
        
        tablePositions[table] = { x: currentX, y: 20, height: tableHeight };

        svgContent += `<g transform="translate(${currentX}, 20)">`;
        svgContent += `<rect x="0" y="0" width="${tableWidth}" height="${tableHeight}" fill="#f8fafc" stroke="#94a3b8" rx="5" />`;
        svgContent += `<rect x="0" y="0" width="${tableWidth}" height="${tableHeaderHeight}" fill="#e2e8f0" style="rx: 5px;" />`;
        svgContent += `<text x="${tableWidth / 2}" y="${tableHeaderHeight / 2}" dominant-baseline="middle" text-anchor="middle" font-weight="bold" fill="#1e293b">${table}</text>`;
        
        columns.forEach((col: any, i: number) => {
            const yPos = tableHeaderHeight + (i * rowHeight) + (rowHeight / 2) + 5;
            svgContent += `<text x="10" y="${yPos}" dominant-baseline="middle" fill="#334155">${col.name}: <tspan fill="#64748b">${col.type}</tspan></text>`;
        });

        svgContent += `</g>`;
        currentX += tableWidth + tableGap;
    });

    const svgWidth = currentX;
    const svgHeight = Math.max(...Object.values(tablePositions).map(p => p.height)) + 40;

    return `<div style="overflow-x: auto;"><svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg></div>`;
}

function generateISOAppendix() {
    const controls = [
        { id: "A.5.1", title: "Policies for information security", status: "Implemented" },
        { id: "A.6.1", title: "Information security roles and responsibilities", status: "Implemented" },
        { id: "A.7.1", title: "Screening", status: "Implemented via HR Process" },
        { id: "A.8.1", title: "Classification of information", status: "Implemented" },
        { id: "A.9.1", title: "Access control policy", status: "Implemented" },
        { id: "A.12.1", title: "Operational procedures and responsibilities", status: "Implemented" },
        { id: "A.14.1", title: "Secure development policy", status: "Implemented" },
        { id: "A.16.1", title: "Information security incident management", status: "Implemented" },
        { id: "A.18.1", title: "Compliance with legal and contractual requirements", status: "Implemented" }
    ];
    let html = '<h2>Appendix A: ISO 27001 Annex A Controls</h2>';
    html += '<table><thead><tr><th>Control ID</th><th>Control Title</th><th>Implementation Status</th></tr></thead><tbody>';
    controls.forEach(c => {
        html += `<tr><td>${c.id}</td><td>${c.title}</td><td>${c.status}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
}

function generateHTML(data: any, logoBase64: string | null) {
  const logoHtml = logoBase64 
    ? `<img src="${logoBase64}" alt="Company Logo" style="width: 100px; height: auto;">` 
    : '';

  return `
    <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.6; }
          h1, h2, h3, h4 { font-family: 'Inter', Arial, sans-serif; color: #111; margin-top: 1.5em; margin-bottom: 0.5em; }
          h1 { font-size: 28px; text-align: center; margin-top: 0; }
          h2 { font-size: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
          h3 { font-size: 16px; font-weight: 600; }
          .cover { text-align: center; height: 100vh; display: flex; flex-direction: column; justify-content: center; }
          .page-break { page-break-before: always; }
          table { width: 100%; border-collapse: collapse; margin-top: 1em; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: 600; }
          #toc { border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; background-color: #f9fafb; }
          #toc h2 { border-bottom: none; }
          #toc ul { list-style: none; padding: 0; }
          #toc li { margin-bottom: 8px; }
          #toc a { text-decoration: none; color: #1e40af; display: block; }
          #toc a::after { content: leader('. ') target-counter(attr(href), page); float: right; }
          .api-block { border-left: 3px solid #3b82f6; padding-left: 15px; margin-bottom: 15px; }
          .risk-block { border-left: 3px solid #ef4444; padding-left: 15px; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="cover">
          ${logoHtml}
          <h1>System Architecture & Governance Manual</h1>
          <p style="font-size: 16px;">Enterprise System Intelligence Report</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="page-break"></div>
        
        <div id="toc">
          <h2>Table of Contents</h2>
          <ul>
            <li><a href="#section-1">1. Executive Summary</a></li>
            <li><a href="#section-2">2. Source Code Overview</a></li>
            <li><a href="#section-3">3. Database Schema</a></li>
            <li><a href="#section-4">4. Entity Relationship Diagram</a></li>
            <li><a href="#section-5">5. API Endpoints</a></li>
            <li><a href="#section-6">6. Risk Governance</a></li>
            <li><a href="#section-7">Appendix A: ISO 27001 Controls</a></li>
          </ul>
        </div>

        <div class="page-break"></div>
        <h2 id="section-1">1. Executive Summary</h2>
        <p>This document provides a comprehensive overview of the Beneficiary Insights system architecture, data governance model, and operational procedures. It is intended for developers, system administrators, and compliance officers. The system is designed for robust fraud detection, structured data management, and adherence to security best practices aligned with ISO 27001.</p>

        <div class="page-break"></div>
        <h2 id="section-2">2. Source Code Overview</h2>
        ${data.files.map((f: any) => `
            <div>
                <h3>${f.file.replace('src/', '')}</h3>
                ${f.functions?.length > 0 ? `<p><strong>Functions:</strong> ${f.functions.join(", ")}</p>` : ""}
                ${f.exports?.length > 0 ? `<p><strong>Exports:</strong> ${f.exports.join(", ")}</p>` : ""}
            </div>`).join("")}

        <div class="page-break"></div>
        <h2 id="section-3">3. Database Schema</h2>
        ${Object.keys(data.schemas).map((table) => `
            <h3>Table: ${table}</h3>
            <table><thead><tr><th>Column</th><th>Type</th><th>Not Null</th><th>Primary Key</th></tr></thead><tbody>
            ${data.schemas[table].map((col: any) => `<tr><td>${col.name}</td><td>${col.type}</td><td>${col.notnull ? 'Yes' : 'No'}</td><td>${col.pk ? 'Yes' : 'No'}</td></tr>`).join("")}
            </tbody></table>`).join("")}
        
        <div class="page-break"></div>
        <h2 id="section-4">4. Entity Relationship Diagram</h2>
        ${generateERDSvg(data.schemas)}

        <div class="page-break"></div>
        <h2 id="section-5">5. API Endpoints</h2>
        ${data.apis.map((api: any) => `
            <div class="api-block">
                <p><strong>Route:</strong> ${api.route}</p>
                <p><strong>Methods:</strong> ${api.methods.join(", ")}</p>
            </div>`).join("")}
        
        <div class="page-break"></div>
        <h2 id="section-6">6. Risk Governance</h2>
        ${data.risks.risks.map((risk: any) => `
            <div class="risk-block">
                <h3>${risk.category}</h3>
                <p><strong>Description:</strong> ${risk.description}</p>
                <p><strong>Mitigation:</strong> ${risk.mitigation}</p>
            </div>`).join("")}
            
        <div class="page-break"></div>
        <div id="section-7">${generateISOAppendix()}</div>
      </body>
    </html>
  `;
}


// --- Main API Route ---

export async function POST() {
  try {
    const files = await scanFiles();
    const schemas = readSchemas();
    const apis = await analyzeAPIs();
    const risks = buildRiskDocumentation();

    let logoBase64 = null;
    try {
        const logoPath = path.join(process.cwd(), "public/logo.png");
        const logoBuffer = await fs.readFile(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (e) {
        console.warn("Logo not found, proceeding without it.");
    }

    const html = generateHTML({ files, schemas, apis, risks }, logoBase64);

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "80px", bottom: "60px", left: "40px", right: "40px" },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:10px; width:100%; text-align:center; padding-top: 20px;">Enterprise System Architecture Manual</div>`,
      footerTemplate: `<div style="font-size:8px; width:100%; text-align:center; padding-bottom: 20px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
    });

    await browser.close();

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=Enterprise_System_Manual.pdf",
      },
    });
  } catch (error: any) {
    console.error("PDF Generation Error:", error);
    return NextResponse.json({ error: "PDF generation failed.", details: error.message }, { status: 500 });
  }
}
