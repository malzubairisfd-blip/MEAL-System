"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/hooks/use-toast";
import { ClipboardPaste, Search } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

export default function FileEditor() {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [tree, setTree] = useState<any[]>([]);
  const [file, setFile] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);

  async function api(body: any) {
    const res = await fetch("/api/file-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'API request failed');
    }
    return data;
  }

  async function loadTree() {
    try {
        setTree(await api({ action: "tree" }));
    } catch (e: any) {
        toast({ title: "Error", description: `Could not load file tree: ${e.message}`, variant: "destructive" });
    }
  }

  async function openFile(p: string) {
    try {
        const r = await api({ action: "read", filePath: p });
        setFile(p);
        editorRef.current?.setValue(r.content || "");
    } catch(e: any) {
        toast({ title: "Error", description: `Could not read file ${p}: ${e.message}`, variant: "destructive" });
    }
  }

  async function save(content?: string) {
    if (!file || !editorRef.current) return;
    try {
        const value = content ?? editorRef.current.getValue();
        await api({ action: "save", filePath: file, content: value });
        toast({ title: "File Saved", description: `Saved changes to ${file}` });
    } catch (e: any) {
        toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    }
  }

  async function empty() {
    if (!file || !editorRef.current) return;
    if (window.confirm(`Are you sure you want to empty the content of ${file}?`)) {
        try {
            editorRef.current.setValue("");
            await api({ action: "empty", filePath: file });
            toast({ title: "File Emptied", description: `Emptied content of ${file}` });
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        }
    }
  }

  async function del() {
    if (!file) return;
    if (window.confirm(`Are you sure you want to delete ${file}? This action cannot be undone.`)) {
        try {
            await api({ action: "delete", filePath: file });
            toast({ title: "File Deleted", description: `${file} has been removed.` });
            setFile(null);
            editorRef.current?.setValue("");
            loadTree();
        } catch (e: any) {
            toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
        }
    }
  }

  async function runSearch() {
    if (!search.trim()) return;
    try {
        setResults(await api({ action: "search", content: search }));
    } catch(e: any) {
        toast({ title: "Search Failed", description: e.message, variant: "destructive" });
    }
  }
  
  async function downloadFile() {
      if (!file || !editorRef.current) {
        toast({ title: "No file selected", description: "Please select a file from the tree to download.", variant: "destructive" });
        return;
      }
      const content = editorRef.current.getValue();
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.split('/').pop() || 'download.txt'; // Get filename from path
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

  const handlePaste = async () => {
    if (!editorRef.current || !monacoRef.current) {
        toast({ title: "Editor not ready", description: "Please load a file first.", variant: "destructive" });
        return;
    }
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            const editor = editorRef.current;
            const position = editor.getPosition();
            editor.executeEdits("clipboard-paste", [
                {
                    range: new monacoRef.current.Selection(
                        position.lineNumber,
                        position.column,
                        position.lineNumber,
                        position.column
                    ),
                    text: text,
                    forceMoveMarkers: true,
                },
            ]);
            toast({ title: "Pasted from clipboard" });
        } else {
            toast({ title: "Clipboard is empty" });
        }
    } catch (err) {
        console.error("Paste failed:", err);
        toast({
            title: "Paste Failed",
            description: "Could not read from clipboard. Your browser might have blocked this action for security reasons. Try Ctrl+V or Cmd+V.",
            variant: "destructive",
        });
    }
  };

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!file || !editorRef.current) {
            toast({ title: "No file selected", description: "Please select a file from the tree to overwrite.", variant: "destructive" });
            e.target.value = ""; // Reset input
            return;
        }

        const uploaded = e.target.files?.[0];
        if (!uploaded) return;

        try {
            const text = await uploaded.text();
            editorRef.current.setValue(text);
            await save(text); 
            toast({ title: "Content Replaced", description: `The content of ${file} has been updated and saved.`});
        } catch (err: any) {
             toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
        } finally {
            e.target.value = ""; 
        }
    }

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const renderTree = (nodes: any[]) =>
    nodes.map((n) => (
      <div key={n.path} className="ml-3">
        {n.type === "file" ? (
          <div
            className={`cursor-pointer hover:text-blue-400 ${
              n.path === file ? "text-blue-500 font-bold" : ""
            }`}
            onClick={() => openFile(n.path)}
          >
            📄 {n.name}
          </div>
        ) : (
          <div>
            <div className="font-semibold">📁 {n.name}</div>
            {renderTree(n.children || [])}
          </div>
        )}
      </div>
    ));

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      {/* LEFT PANEL */}
      <div className="w-72 border-r border-slate-800 p-2 overflow-auto">
        <button
          className="mb-2 bg-green-600 w-full py-1"
          onClick={loadTree}
        >
          Refresh
        </button>

        <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="border border-slate-700 bg-slate-900 w-full mb-2 pl-8 pr-2 py-1"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
        </div>

        <button
          className="bg-blue-600 w-full mb-2 py-1"
          onClick={runSearch}
        >
          Search
        </button>

        {results.map((r, i) => (
          <div
            key={i}
            className="text-xs cursor-pointer hover:text-blue-400"
            onClick={() => openFile(r.file)}
          >
            {r.file}:{r.line}
          </div>
        ))}

        {renderTree(tree)}
      </div>

      {/* EDITOR */}
      <div className="flex-1 flex flex-col">
        {/* TOOLBAR */}
        <div className="p-2 border-b border-slate-800 flex gap-2 items-center">
          <button onClick={() => save()} className="bg-blue-600 px-3 py-1">
            Save
          </button>
           <button onClick={handlePaste} className="bg-teal-600 px-3 py-1 flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4"/> Paste
          </button>
          <button onClick={empty} className="bg-yellow-600 px-3 py-1">
            Empty
          </button>
          <button onClick={del} className="bg-red-600 px-3 py-1">
            Delete
          </button>
          <button onClick={downloadFile} className="bg-green-600 px-3 py-1">
            Download
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ts,.tsx,.js,.json,.txt,.md,.css"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-purple-600 px-3 py-1 ml-auto"
          >
            Upload & Replace
          </button>
        </div>

        {/* MONACO */}
        <div className="flex-1">
          <MonacoEditor
            defaultLanguage="typescript"
            theme="vs-dark"
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;

              monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: false,
              });

              setTimeout(() => {
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                  noSemanticValidation: false,
                  noSyntaxValidation: false,
                });
              }, 1000);

              monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ESNext,
                jsx: monaco.languages.typescript.JsxEmit.React,
                module: monaco.languages.typescript.ModuleKind.ESNext,
                moduleResolution:
                  monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                strict: true,
                esModuleInterop: true,
              });
            }}
            options={{
              minimap: { enabled: false },
              automaticLayout: true,
              fontSize: 14,
              wordWrap: "on",
              largeFileOptimizations: true,
              renderValidationDecorations: "off",
            }}
          />
        </div>
      </div>
    </div>
  );
}
    