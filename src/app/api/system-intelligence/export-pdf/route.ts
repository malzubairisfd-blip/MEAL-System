
import { NextResponse } from "next/server";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFRenderer,
} from "@react-pdf/renderer";
import React from "react";
import { scanFiles } from "@/lib/systemScanner";
import { readSchemas } from "@/lib/schemaReader";
import { analyzeAPIs } from "@/lib/apiAnalyzer";
import { buildRiskDocumentation } from "@/lib/riskBuilder";
import { renderToStream } from "@react-pdf/renderer";

export async function POST() {
  const files = await scanFiles();
  const schemas = readSchemas();
  const apis = await analyzeAPIs();
  const risks = buildRiskDocumentation();

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10 },
    title: { fontSize: 20, marginBottom: 20 },
    sectionTitle: { fontSize: 14, marginTop: 20, marginBottom: 10 },
    text: { marginBottom: 4 },
    footer: {
      position: "absolute",
      bottom: 20,
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: 8,
    },
  });

  const MyDocument = React.createElement(Document, null,
    // Cover Page
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, "System Architecture & Governance Manual"),
      React.createElement(Text, { style: styles.text }, "Enterprise System Intelligence Report"),
      React.createElement(Text, { style: styles.text }, `Generated: ${new Date().toLocaleString()}`),
      React.createElement(Text, { style: styles.footer, fixed: true }, "Confidential - Page 1")
    ),

    // Source Code
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.sectionTitle }, "Source Code Overview"),
      ...files.map((f, i) =>
        React.createElement(View, { key: i },
          React.createElement(Text, { style: styles.text }, `File: ${f.file}`),
          f.functions?.length > 0 && React.createElement(Text, { style: styles.text }, `Functions: ${f.functions.join(", ")}`)
        )
      ),
      React.createElement(Text, {
        style: styles.footer,
        render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`,
        fixed: true,
      })
    ),

    // Database Schema
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.sectionTitle }, "Database Schema"),
      ...Object.keys(schemas).map((table, i) =>
        React.createElement(View, { key: i },
          React.createElement(Text, { style: styles.text }, `Table: ${table}`),
          ...(schemas[table].map((col: any, idx: number) =>
            React.createElement(Text, { key: idx, style: styles.text }, `- ${col.name} (${col.type})`)
          ))
        )
      ),
      React.createElement(Text, {
        style: styles.footer,
        render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`,
        fixed: true,
      })
    ),

    // API Endpoints
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.sectionTitle }, "API Endpoints"),
      ...apis.map((api, i) =>
        React.createElement(View, { key: i },
          React.createElement(Text, { style: styles.text }, `Route: ${api.route}`),
          React.createElement(Text, { style: styles.text }, `Methods: ${api.methods.join(", ")}`)
        )
      ),
      React.createElement(Text, {
        style: styles.footer,
        render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`,
        fixed: true,
      })
    ),

    // Risk Governance
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.sectionTitle }, "Risk Governance"),
      ...risks.risks.map((risk, i) =>
        React.createElement(View, { key: i },
          React.createElement(Text, { style: styles.text }, risk.category),
          React.createElement(Text, { style: styles.text }, `Description: ${risk.description}`),
          React.createElement(Text, { style: styles.text }, `Mitigation: ${risk.mitigation}`)
        )
      ),
      React.createElement(Text, {
        style: styles.footer,
        render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`,
        fixed: true,
      })
    )
  );

  const stream = await renderToStream(MyDocument as React.ReactElement);

  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        "attachment; filename=Enterprise_System_Manual.pdf",
    },
  });
}
