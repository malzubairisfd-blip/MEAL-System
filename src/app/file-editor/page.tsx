
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { ClipboardPaste, Search, Plus, FolderPlus, File as FileIcon, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}


export default function FileEditor() {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [tree, setTree] = useState<any[]>([]);
  const [file, setFile] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>('src');
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);

  // State for creating new files/folders
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const [pageUrl, setPageUrl] = useState<string | null>(null);

  async function api(body: any) {
    const res = await fetch("/api/file-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    
    const text = await res.text();

    if (!res.ok) {
        // Try to parse the error text as JSON, otherwise use the text itself.
        try {
            const errorJson = JSON.parse(text);
            throw new Error(errorJson.error || `API request failed with status ${res.status}`);
        } catch {
            throw new Error(text || `API request failed with status ${res.status}`);
        }
    }
    
    // If the response is OK and the text is not empty, parse it.
    // Otherwise, return an empty object for success with no content (e.g., delete).
    return text ? JSON.parse(text) : {};
  }

  const loadTree = useCallback(async () => {
    try {
        setTree(await api({ action: "tree" }));
    } catch (e: any) {
        toast({ title: "Error", description: `Could not load file tree: ${e.message}`, variant: "destructive" });
    }
  }, [toast]);


  async function openFile(p: string) {
    try {
        const r = await api({ action: "read", filePath: p });
        setFile(p);
        setSelectedFolder(p.substring(0, p.lastIndexOf('/')));
        editorRef.current?.setValue(r.content || "");
        
        // Logic for the "Go to Page" button
        if (p.startsWith('app/') && p.endsWith('/page.tsx')) {
            let url = p.replace('app', '').replace('/page.tsx', '');
            if (url === '') url = '/'; // For the root page.tsx
            setPageUrl(url);
        } else {
            setPageUrl(null);
        }
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
    try {
        editorRef.current.setValue("");
        await api({ action: "empty", filePath: file });
        toast({ title: "File Emptied", description: `Emptied content of ${file}` });
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function del() {
    if (!file) return;
    if(!confirm(`Are you sure you want to delete ${file}?`)) return;
    try {
        await api({ action: "delete", filePath: file });
        toast({ title: "File Deleted", description: `${file} has been removed.` });
        setFile(null);
        setPageUrl(null);
        editorRef.current?.setValue("");
        loadTree();
    } catch (e: any) {
        toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
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

  const openCreateDialog = (type: 'file' | 'folder') => {
      if (!selectedFolder) {
          toast({ title: "No Folder Selected", description: "Please select a folder from the tree to create items in.", variant: "destructive" });
          return;
      }
      setNewItemType(type);
      setIsCreateDialogOpen(true);
  };
  
  const handleCreateItem = async () => {
    if (!newItemType || !newItemName || !selectedFolder) {
        toast({ title: "Error", description: "Please select a folder and provide a name.", variant: "destructive" });
        return;
    }
    try {
        await api({
            action: newItemType === 'file' ? 'createFile' : 'createFolder',
            filePath: selectedFolder,
            name: newItemName,
            content: '', // New file content is handled by saving the editor
        });
        toast({ title: "Success", description: `${newItemType} '${newItemName}' created in ${selectedFolder}.` });
        setIsCreateDialogOpen(false);
        setNewItemName('');
        await loadTree();
    } catch (e: any) {
        toast({ title: "Creation Failed", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const renderTree = (nodes: any[], level = 0) =>
    nodes.map((n) => (
      <div key={n.path} className="ml-3">
        {n.type === "file" ? (
          <div
            className={`flex justify-between items-center cursor-pointer hover:text-blue-400 ${
              n.path === file ? "text-blue-500 font-bold" : ""
            }`}
            onClick={() => openFile(n.path)}
          >
            <span className="flex items-center gap-1"><FileIcon className="h-4 w-4 inline-block" /> {n.name}</span>
            <span className="text-xs text-gray-500 pr-2">{formatBytes(n.size)}</span>
          </div>
        ) : (
          <div>
            <div
                className={`font-semibold cursor-pointer flex justify-between items-center ${selectedFolder === n.path ? 'text-amber-400' : ''}`}
                onClick={() => setSelectedFolder(n.path)}
            >
                <span className="flex items-center gap-1"><FolderPlus className="h-4 w-4 inline-block" /> {n.name}</span>
                <span className="text-xs text-gray-500 pr-2">{formatBytes(n.size)}</span>
            </div>
            {n.children && renderTree(n.children, level + 1)}
          </div>
        )}
      </div>
    ));

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      {/* LEFT PANEL */}
      <div className="w-72 border-r border-slate-800 p-2 flex flex-col">
        <div className="flex-shrink-0 space-y-2">
            <button
                className="mb-2 bg-green-600 w-full py-1"
                onClick={loadTree}
            >
                Refresh Tree
            </button>
             <div className="flex gap-2">
                <Button onClick={() => openCreateDialog('file')} className="flex-1" variant="outline" size="sm" disabled={!selectedFolder}>
                    <Plus className="h-4 w-4 mr-1"/> New File
                </Button>
                <Button onClick={() => openCreateDialog('folder')} className="flex-1" variant="outline" size="sm" disabled={!selectedFolder}>
                    <FolderPlus className="h-4 w-4 mr-1"/> New Folder
                </Button>
            </div>

            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                className="border border-slate-700 bg-slate-900 w-full mb-2 pl-8 pr-2 py-1"
                placeholder="Search file content..."
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
        </div>

        <div className="flex-1 overflow-y-auto mt-2">
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
      </div>

      {/* EDITOR */}
      <div className="flex-1 flex flex-col">
        {/* TOOLBAR */}
        <div className="p-2 border-b border-slate-800 flex gap-2 items-center">
          <Button onClick={() => save()} className="bg-blue-600 px-3 py-1" disabled={!file}>
            Save
          </Button>
          {pageUrl && (
            <Button asChild variant="secondary">
                <Link href={pageUrl} target="_blank">
                    <Eye className="mr-2 h-4 w-4" /> Go to Page
                </Link>
            </Button>
          )}
           <Button onClick={handlePaste} className="bg-teal-600 px-3 py-1 flex items-center gap-2" disabled={!file}>
            <ClipboardPaste className="h-4 w-4"/> Paste
          </Button>
          <Button onClick={empty} className="bg-yellow-600 px-3 py-1" disabled={!file}>
            Empty
          </Button>
          <Button onClick={del} className="bg-red-600 px-3 py-1" disabled={!file}>
            Delete
          </Button>
          <Button onClick={downloadFile} className="bg-green-600 px-3 py-1" disabled={!file}>
            Download
          </Button>
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
            disabled={!file}
          >
            Upload & Replace
          </button>
        </div>

        {/* MONACO */}
        <div className="flex-1">
          <MonacoEditor
            path={file || 'untitled'}
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

       <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New {newItemType}</DialogTitle>
                    <DialogDescription>
                        Creating in folder: <span className="font-mono">{selectedFolder}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-item-name">{newItemType === 'file' ? 'File' : 'Folder'} Name</Label>
                        <Input 
                            id="new-item-name" 
                            value={newItemName} 
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={newItemType === 'file' ? 'e.g., new-component.tsx' : 'e.g., new-folder'}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateItem}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

    </div>
  );
}
