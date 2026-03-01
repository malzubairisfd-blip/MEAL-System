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

  const MyDocument = (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          System Architecture & Governance Manual
        </Text>
        <Text style={styles.text}>
          Enterprise System Intelligence Report
        </Text>
        <Text style={styles.text}>
          Generated: {new Date().toLocaleString()}
        </Text>

        <Text style={styles.footer} fixed>
          Confidential - Page 1
        </Text>
      </Page>

      {/* Source Code */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Source Code Overview</Text>

        {files.map((f, i) => (
          <View key={i}>
            <Text style={styles.text}>File: {f.file}</Text>
            {f.functions?.length > 0 && (
              <Text style={styles.text}>
                Functions: {f.functions.join(", ")}
              </Text>
            )}
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* Database Schema */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Database Schema</Text>

        {Object.keys(schemas).map((table, i) => (
          <View key={i}>
            <Text style={styles.text}>Table: {table}</Text>
            {schemas[table].map((col: any, idx: number) => (
              <Text key={idx} style={styles.text}>
                - {col.name} ({col.type})
              </Text>
            ))}
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* API Endpoints */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>API Endpoints</Text>

        {apis.map((api, i) => (
          <View key={i}>
            <Text style={styles.text}>Route: {api.route}</Text>
            <Text style={styles.text}>
              Methods: {api.methods.join(", ")}
            </Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* Risk Governance */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Risk Governance</Text>

        {risks.risks.map((risk, i) => (
          <View key={i}>
            <Text style={styles.text}>{risk.category}</Text>
            <Text style={styles.text}>
              Description: {risk.description}
            </Text>
            <Text style={styles.text}>
              Mitigation: {risk.mitigation}
            </Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );

  const stream = await renderToStream(MyDocument);

  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        "attachment; filename=Enterprise_System_Manual.pdf",
    },
  });
}
