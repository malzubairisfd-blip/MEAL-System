"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ReactFlow = dynamic(() => import("reactflow"), { ssr: false });

type AnalysisType = {
  files: any[];
  schemas: any;
  apis: any[];
  graph: {
    nodes: { id: string; label: string }[];
    edges: { source: string; target: string }[];
  };
  risks: {
    risks: {
      category: string;
      description: string;
      mitigation: string;
    }[];
  };
  generatedAt: string;
};

export default function SystemArchitecturePage() {
  const [data, setData] = useState<AnalysisType | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyzeSystem() {
    setLoading(true);
    const res = await fetch("/api/system-intelligence/analyze");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function downloadFile(url: string, filename: string) {
    const blob = await fetch(url, { method: "POST" }).then(r => r.blob());
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  useEffect(() => {
    analyzeSystem();
  }, []);

  const renderTree = () => {
    if (!data?.files) return null;

    return data.files.map((file, i) => (
      <details key={i} className="ml-4 border-l pl-4">
        <summary className="cursor-pointer font-medium text-blue-700">
          📄 {file.file}
        </summary>

        {file.functions?.length > 0 && (
          <div className="ml-4 mt-2">
            <strong>Functions:</strong>
            <ul className="list-disc ml-6">
              {file.functions.map((fn: string, idx: number) => (
                <li key={idx}>{fn}</li>
              ))}
            </ul>
          </div>
        )}

        {file.exports?.length > 0 && (
          <div className="ml-4 mt-2">
            <strong>Exports:</strong>
            <ul className="list-disc ml-6">
              {file.exports.map((ex: string, idx: number) => (
                <li key={idx}>{ex}</li>
              ))}
            </ul>
          </div>
        )}
      </details>
    ));
  };

  const renderSchemas = () => {
    if (!data?.schemas) return null;

    return Object.keys(data.schemas).map((table) => (
      <details key={table} className="ml-4 border-l pl-4">
        <summary className="font-semibold text-green-700">
          🗄 {table}
        </summary>
        <ul className="ml-6 list-disc">
          {data.schemas[table].map((col: any, i: number) => (
            <li key={i}>
              {col.name} ({col.type})
            </li>
          ))}
        </ul>
      </details>
    ));
  };

  const renderAPIs = () => {
    if (!data?.apis) return null;

    return data.apis.map((api, i) => (
      <div key={i} className="border p-3 rounded bg-gray-50">
        <strong>{api.route}</strong>
        <div className="mt-2">
          Methods:{" "}
          {api.methods.map((m: string, idx: number) => (
            <span
              key={idx}
              className="inline-block bg-blue-100 text-blue-700 px-2 py-1 mr-2 rounded text-sm"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    ));
  };

  const renderRisks = () => {
    if (!data?.risks?.risks) return null;

    return data.risks.risks.map((risk, i) => (
      <div key={i} className="border p-4 rounded bg-red-50">
        <h4 className="font-bold text-red-700">{risk.category}</h4>
        <p><strong>Description:</strong> {risk.description}</p>
        <p><strong>Mitigation:</strong> {risk.mitigation}</p>
      </div>
    ));
  };

  const graphNodes =
    data?.graph.nodes.map((n) => ({
      id: n.id,
      data: { label: n.label },
      position: {
        x: Math.random() * 600,
        y: Math.random() * 400,
      },
    })) || [];

  const graphEdges =
    data?.graph.edges.map((e, i) => ({
      id: "e" + i,
      source: e.source,
      target: e.target,
    })) || [];

  return (
    <div className="p-10 space-y-10 bg-white">
      <h1 className="text-4xl font-bold text-gray-800">
        Enterprise System Intelligence Center
      </h1>

      <div className="flex gap-4 flex-wrap">
        <button
          onClick={analyzeSystem}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Re-Analyze System
        </button>

        <button
          onClick={() =>
            downloadFile("/api/system-intelligence/export-word", "System_Manual.docx")
          }
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Download Word Manual
        </button>

        <button
          onClick={() =>
            downloadFile("/api/system-intelligence/export-pdf", "System_Manual.pdf")
          }
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Download PDF Manual
        </button>

        <button
          onClick={() =>
            downloadFile("/api/system-intelligence/analyze", "System_Report.json")
          }
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          Export JSON Report
        </button>
      </div>

      {loading && <div className="text-blue-600">Analyzing system...</div>}

      {data && (
        <>
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              📁 Source Code & Function Extraction
            </h2>
            {renderTree()}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              🗄 Database Schema Overview
            </h2>
            {renderSchemas()}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              🌐 API Endpoint Analyzer
            </h2>
            <div className="space-y-3">{renderAPIs()}</div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              🔗 Dependency Graph
            </h2>
            <div className="h-[500px] border rounded">
              <ReactFlow nodes={graphNodes} edges={graphEdges} />
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              ⚠ Risk Governance & Mitigation
            </h2>
            <div className="space-y-4">{renderRisks()}</div>
          </section>

          <section className="text-sm text-gray-500">
            Generated at: {new Date(data.generatedAt).toLocaleString()}
          </section>
        </>
      )}
    </div>
  );
}
