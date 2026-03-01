import { NextResponse } from "next/server";
import { scanFiles } from "@/lib/systemScanner";
import { readSchemas } from "@/lib/schemaReader";
import { analyzeAPIs } from "@/lib/apiAnalyzer";
import { buildDependencyGraph } from "@/lib/dependencyGraph";
import { buildRiskDocumentation } from "@/lib/riskBuilder";

export async function GET() {
  const files = await scanFiles();
  const schemas = readSchemas();
  const apis = await analyzeAPIs();
  const graph = buildDependencyGraph(files);
  const risks = buildRiskDocumentation();

  return NextResponse.json({
    files,
    schemas,
    apis,
    graph,
    risks,
    generatedAt: new Date(),
  });
}
