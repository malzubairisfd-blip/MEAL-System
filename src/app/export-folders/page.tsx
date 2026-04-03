"use client";

import { useEffect, useState, useCallback } from "react";

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

  const api = useCallback(async (body: any) => {
    return fetch("/api/file-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }, []);

  const loadTree = useCallback(async () => {
    try {
      setTree(await api({ action: "tree" }));
    } catch (e) {
      console.error("Failed to load file tree", e);
    }
  }, [api]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleSelectFolder = (path: string, checked: boolean) => {
    const newSelected = { ...selected };

    const applySelection = (node: Node, shouldBeSelected: boolean) => {
      if (node.type === "folder") {
        newSelected[node.path] = shouldBeSelected;
        if (node.children) node.children.forEach((child) => applySelection(child, shouldBeSelected));
      }
    };

    const findAndApply = (nodes: Node[], targetPath: string): boolean => {
      for (const node of nodes) {
        if (node.path === targetPath) {
          applySelection(node, checked);
          return true;
        }
        if (node.children && findAndApply(node.children, targetPath)) return true;
      }
      return false;
    };

    findAndApply(tree, path);
    setSelected(newSelected);
  };

  async function exportSelected() {
    const folders = Object.keys(selected).filter((k) => selected[k]);
    if (!folders.length) {
      alert("Select at least one folder");
      return;
    }

    const topLevelFolders = folders.filter((folder) => {
      const parentPath = folder.substring(0, folder.lastIndexOf("/"));
      return !parentPath || !folders.includes(parentPath);
    });

    setWorking(true);
    setProgress(0);
    setStatus("Preparing export...");

    let finalText = "";

    for (const folder of topLevelFolders) {
      setStatus(`Reading ${folder} ...`);

      const res = await fetch("/api/export-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      }).then((r) => r.json());

      finalText +=
        "\n\n############################################\n" +
        `FOLDER: ${folder}\n` +
        "############################################\n\n" +
        (res.content || "[No files in this folder]");
      
      setProgress((p) => Math.min(100, p + 100 / topLevelFolders.length));
    }

    setStatus("Generating file...");

    const blob = new Blob([finalText], { type: "text/plain;charset=utf-8" });
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
                onChange={(e) => handleSelectFolder(n.path, e.target.checked)}
              />
              📁 {n.name}
            </label>
            {n.children && renderTree(n.children)}
          </>
        ) : (
          <div className="ml-6 text-sm text-gray-400">📄 {n.name}</div>
        )}
      </div>
    ));

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Export Folder Code (TXT)</h1>

      <div className="border border-slate-800 p-4 rounded bg-slate-900 max-h-[60vh] overflow-auto">
        {renderTree(tree)}
      </div>

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