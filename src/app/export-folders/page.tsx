"use client";

import { useEffect, useState } from "react";

type Node = {
  type: "folder" | "file";
  name: string;
  path: string;
  children?: Node[];
};

export default function ExportFoldersPage() {
  const [tree, setTree] = useState<Node[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  async function api(body: any) {
    return fetch("/api/file-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }

  async function loadTree() {
    setTree(await api({ action: "tree" }));
  }

  async function exportSelected() {
    const folders = Object.keys(selected).filter((k) => selected[k]);
    if (!folders.length) {
      alert("Select at least one folder");
      return;
    }

    setWorking(true);
    setProgress(0);
    setStatus("Preparing export...");

    let finalText = "";
    let processedFiles = 0;

    for (const folder of folders) {
      setStatus(`Reading ${folder} ...`);

      const res = await fetch("/api/export-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      }).then((r) => r.json());

      const filesCount = res.totalFiles || 1;
      processedFiles += filesCount;

      finalText +=
        "\n\n############################################\n" +
        `FOLDER: ${folder}\n` +
        "############################################\n\n" +
        res.content;

      setProgress((p) => Math.min(100, p + 100 / folders.length));
    }

    setStatus("Generating file...");

    const blob = new Blob([finalText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "project-export.txt";
    a.click();

    URL.revokeObjectURL(url);

    setStatus("Done");
    setWorking(false);
    setProgress(100);
  }

  const renderTree = (nodes: Node[]) =>
    nodes.map((n) => (
      <div key={n.path} className="ml-4">
        {n.type === "folder" ? (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!selected[n.path]}
                onChange={(e) =>
                  setSelected((s) => ({
                    ...s,
                    [n.path]: e.target.checked,
                  }))
                }
              />
              📁 {n.name}
            </label>
            {n.children && renderTree(n.children)}
          </>
        ) : (
          <div className="ml-6 text-sm text-gray-400">
            📄 {n.name}
          </div>
        )}
      </div>
    ));

  useEffect(() => {
    loadTree();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">
        Export Folder Code (TXT)
      </h1>

      <div className="border border-slate-800 p-4 rounded bg-slate-900 max-h-[60vh] overflow-auto">
        {renderTree(tree)}
      </div>

      {/* PROGRESS BAR */}
      {working && (
        <div className="mt-4">
          <div className="text-sm mb-1">{status}</div>
          <div className="w-full bg-slate-800 rounded h-3">
            <div
              className="bg-blue-600 h-3 rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={exportSelected}
        disabled={working}
        className="mt-4 bg-blue-600 px-6 py-2 rounded disabled:opacity-50"
      >
        {working ? "Processing..." : "Generate TXT & Download"}
      </button>
    </div>
  );
}