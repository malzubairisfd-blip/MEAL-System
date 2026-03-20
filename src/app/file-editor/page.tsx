

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { 
  ClipboardPaste, Search, Plus, FolderPlus, File as FileIcon, Eye, Edit, 
  Upload, RefreshCw, Trash2, Download, Save, AlertCircle, 
  CheckCircle2, Loader2, PanelLeft, PanelRight, ChevronLeft, ChevronRight, Menu,
  FileX
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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

function getLanguage(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx': return 'typescript';
    case 'js':
    case 'jsx': return 'javascript';
    case 'json': return 'json';
    case 'css': return 'css';
    case 'html': return 'html';
    case 'md': return 'markdown';
    default: return 'plaintext';
  }
}

export default function FileEditor() {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [tree, setTree] = useState<any[]>([]);
  const [file, setFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>('src');
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);

  // Layout States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarSide, setSidebarSide] = useState<'left' | 'right'>('left');

  // ZIP Upload States
  const [isZipProgressOpen, setIsZipProgressOpen] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipStatus, setZipStatus] = useState("");
  const [zipConflicts, setZipConflicts] = useState<string[]>([]);
  const [isZipConflictDialogOpen, setIsZipConflictDialogOpen] = useState(false);
  const [pendingZipFile, setPendingZipFile] = useState<File | null>(null);

  // State for creating new files/folders
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState("");

  // State for renaming
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<{ path: string; isFolder: boolean } | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const [pageUrl, setPageUrl] = useState<string | null>(null);

  async function api(body: any) {
    const res = await fetch("/api/file-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
        try {
            const errorJson = JSON.parse(text);
            throw new Error(errorJson.error || `API request failed with status ${res.status}`);
        } catch {
            throw new Error(text || `API request failed with status ${res.status}`);
        }
    }
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
    if (p === file) return;
    setIsLoadingFile(true);
    try {
        const r = await api({ action: "read", filePath: p });
        setFile(p);
        setFileContent(r.content || "");
        setSelectedFolder(p.includes('/') ? p.substring(0, p.lastIndexOf('/')) : null);
        
        if (p.startsWith('src/app/') && p.endsWith('/page.tsx')) {
            let url = p.replace('src/app', '').replace('/page.tsx', '');
            if (url === '') url = '/';
            setPageUrl(url);
        } else {
            setPageUrl(null);
        }
        
        if (window.innerWidth < 768) {
          setIsSidebarOpen(false);
        }
    } catch(e: any) {
        toast({ title: "Error", description: `Could not read file ${p}: ${e.message}`, variant: "destructive" });
    } finally {
        setIsLoadingFile(false);
    }
  }

  async function save() {
    if (!file) return;
    try {
        await api({ action: "save", filePath: file, content: fileContent });
        toast({ title: "File Saved", description: `Saved changes to ${file}` });
    } catch (e: any) {
        toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    }
  }

  async function clearFile() {
    if (!file) return;
    try {
        await api({ action: "empty", filePath: file });
        setFileContent("");
        toast({ title: "File Emptied", description: `${file} content has been cleared.` });
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function del() {
    if (!file) return;
    try {
        await api({ action: "delete", filePath: file });
        toast({ title: "File Deleted", description: `${file} has been removed.` });
        setFile(null);
        setFileContent("");
        setPageUrl(null);
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
      if (!file) {
        toast({ title: "No file selected", description: "Please select a file from the tree to download.", variant: "destructive" });
        return;
      }
      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.split('/').pop() || 'download.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

  const handlePaste = async () => {
    if (!editorRef.current) {
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
        }
    } catch (err) {
        toast({
            title: "Paste Failed",
            description: "Try Ctrl+V.",
            variant: "destructive",
        });
    }
  };

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
      if (!file) {
          toast({ title: "No file selected", description: "Select a file to overwrite.", variant: "destructive" });
          return;
      }
      const uploaded = e.target.files?.[0];
      if (!uploaded) return;
      try {
          const text = await uploaded.text();
          setFileContent(text);
          await api({ action: "save", filePath: file, content: text });
          toast({ title: "Content Replaced", description: `Updated ${file}.`});
      } catch (err: any) {
           toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      } finally {
          e.target.value = ""; 
      }
  }

  async function handleZipUploadInitiate(e: React.ChangeEvent<HTMLInputElement>) {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    if (!selectedFolder) {
      toast({ title: "No folder selected", description: "Select a target folder to unzip into.", variant: "destructive" });
      return;
    }

    setPendingZipFile(uploaded);
    setIsZipProgressOpen(true);
    setZipProgress(10);
    setZipStatus("Analyzing ZIP content...");

    const formData = new FormData();
    formData.append("file", uploaded);
    formData.append("action", "analyzeZip");
    formData.append("targetFolder", selectedFolder);

    try {
      const res = await fetch("/api/file-manager", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      if (data.conflicts.length > 0) {
        setZipConflicts(data.conflicts);
        setIsZipConflictDialogOpen(true);
        setZipProgress(30);
        setZipStatus("Conflicts detected. Awaiting decision.");
      } else {
        await executeZipUpload(uploaded, []);
      }
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
      setIsZipProgressOpen(false);
    } finally {
      e.target.value = "";
    }
  }

  async function executeZipUpload(file: File, skipFiles: string[]) {
    setZipProgress(50);
    setZipStatus("Updating project files...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("action", "uploadZip");
    formData.append("targetFolder", selectedFolder!);
    formData.append("skipFiles", JSON.stringify(skipFiles));

    try {
      const res = await fetch("/api/file-manager", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      
      setZipProgress(90);
      setZipStatus("Refreshing explorer...");
      await loadTree();
      setZipProgress(100);
      setZipStatus("Done!");
      
      setTimeout(() => {
        setIsZipProgressOpen(false);
        setPendingZipFile(null);
      }, 1000);
      
      toast({ title: "Success", description: "Project updated." });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      setIsZipProgressOpen(false);
    }
  }

  const handleCreateItem = async () => {
    if (!newItemType || !newItemName || !selectedFolder) return;
    try {
        await api({
            action: newItemType === 'file' ? 'createFile' : 'createFolder',
            filePath: selectedFolder,
            name: newItemName,
            content: '',
        });
        toast({ title: "Success", description: `${newItemType} created.` });
        setIsCreateDialogOpen(false);
        setNewItemName('');
        await loadTree();
    } catch (e: any) {
        toast({ title: "Creation Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleRename = async () => {
    if (!itemToRename || !renameInput.trim()) return;
    try {
      await api({ action: 'rename', oldPath: itemToRename.path, newName: renameInput.trim() });
      toast({ title: "Success", description: "Renamed." });
      setIsRenameDialogOpen(false);
      await loadTree();
    } catch (e: any) {
      toast({ title: "Rename Failed", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const renderTree = (nodes: any[]) =>
    nodes.map((n) => (
      <div key={n.path} className="ml-3 select-none">
        {n.type === "file" ? (
          <div
            className={cn(
              "group flex justify-between items-center py-0.5 px-2 rounded cursor-pointer transition-colors hover:bg-white/5 whitespace-nowrap",
              n.path === file ? "bg-primary/20 text-primary font-bold" : ""
            )}
            onClick={() => openFile(n.path)}
          >
            <span className="flex items-center gap-2 overflow-hidden mr-4">
              <FileIcon className="h-3.5 w-3.5 shrink-0 opacity-70" /> 
              <span className="text-sm">{n.name}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" 
                onClick={(e) => {
                  e.stopPropagation();
                  setItemToRename({ path: n.path, isFolder: false });
                  setRenameInput(n.name);
                  setIsRenameDialogOpen(true);
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <span className="text-[10px] opacity-40 shrink-0">{formatBytes(n.size)}</span>
            </div>
          </div>
        ) : (
          <div className="mb-1">
            <div
                className={cn(
                  "group flex justify-between items-center py-0.5 px-2 rounded cursor-pointer transition-colors hover:bg-white/5 whitespace-nowrap",
                  selectedFolder === n.path ? 'bg-accent/20 text-accent' : 'opacity-80'
                )}
                onClick={() => setSelectedFolder(n.path)}
            >
                <span className="flex items-center gap-2 overflow-hidden mr-4">
                  <FolderPlus className="h-3.5 w-3.5 shrink-0 opacity-70" /> 
                  <span className="text-sm font-medium">{n.name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToRename({ path: n.path, isFolder: true });
                      setRenameInput(n.name);
                      setIsRenameDialogOpen(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <span className="text-[10px] opacity-40 shrink-0">{formatBytes(n.size)}</span>
                </div>
            </div>
            {n.children && renderTree(n.children)}
          </div>
        )}
      </div>
    ));

  return (
    <div className={cn(
      "flex h-screen bg-background text-foreground font-body overflow-hidden",
      sidebarSide === 'right' ? 'flex-row-reverse' : 'flex-row'
    )}>
      {/* SIDEBAR PANEL */}
      <div className={cn(
        "w-80 border-border p-4 flex flex-col gap-4 bg-background transition-all duration-300 z-50",
        sidebarSide === 'left' ? 'border-r' : 'border-l',
        !isSidebarOpen && "hidden"
      )}>
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-headline font-bold text-accent">CodeNest</h1>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={loadTree} className="h-8 w-8 hover:bg-white/10">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setIsSidebarOpen(false)} className="h-8 w-8 hover:bg-white/10 md:hidden">
                  <ChevronLeft className={cn("h-4 w-4", sidebarSide === 'right' && "rotate-180")} />
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2">
                <Button onClick={() => { setNewItemType('file'); setIsCreateDialogOpen(true); }} className="flex-1 px-1" variant="secondary" size="sm" disabled={!selectedFolder}>
                    <Plus className="h-3.5 w-3.5 mr-1"/> File
                </Button>
                <Button onClick={() => { setNewItemType('folder'); setIsCreateDialogOpen(true); }} className="flex-1 px-1" variant="secondary" size="sm" disabled={!selectedFolder}>
                    <FolderPlus className="h-3.5 w-3.5 mr-1"/> Folder
                </Button>
                <Button onClick={() => zipInputRef.current?.click()} className="flex-1 px-1" variant="secondary" size="sm" disabled={!selectedFolder}>
                    <Upload className="h-3.5 w-3.5 mr-1"/> ZIP
                </Button>
            </div>

            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="bg-card/50 pl-8 pr-2 py-1 h-9 text-sm"
                  placeholder="Search code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                />
            </div>
        </div>

        <ScrollArea className="flex-1">
            {results.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-50">Results</span>
                  <Badge variant="outline" className="text-[10px]">{results.length}</Badge>
                </div>
                <div className="space-y-1">
                  {results.map((r, i) => (
                    <div
                        key={i}
                        className="text-[11px] p-2 bg-card/40 rounded cursor-pointer hover:bg-card hover:text-primary transition-all overflow-hidden"
                        onClick={() => openFile(r.file)}
                    >
                        <div className="font-bold truncate">{r.file}</div>
                        <div className="opacity-60 truncate">Line {r.line}: {r.text}</div>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-border my-4" />
              </div>
            )}
            <div className="pr-4">
              {renderTree(tree)}
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleZipUploadInitiate}
        />
      </div>

      {/* EDITOR PANEL */}
      <div className="flex-1 flex flex-col bg-card/20 min-w-0 overflow-hidden relative">
        {/* TOOLBAR */}
        <div className="h-14 px-4 border-b border-border flex items-center justify-between overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-3 shrink-0">
            <Button size="icon" variant="ghost" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="h-8 w-8 hover:bg-white/10">
               {isSidebarOpen ? (
                 sidebarSide === 'left' ? <PanelLeft className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />
               ) : (
                 <Menu className="h-4 w-4" />
               )}
            </Button>
            
            <div className="flex items-center gap-3 max-w-[200px] md:max-w-md overflow-hidden">
              {file ? (
                <>
                  <FileIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{file}</span>
                  {isLoadingFile && <Loader2 className="h-3 w-3 animate-spin opacity-50" />}
                </>
              ) : (
                <span className="text-sm opacity-50 italic">No file selected</span>
              )}
              {pageUrl && (
                <Link href={pageUrl} target="_blank" className="flex items-center text-[10px] font-bold uppercase tracking-tighter text-accent hover:underline ml-2">
                  <Eye className="h-3 w-3 mr-1" /> Preview
                </Link>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 items-center shrink-0 ml-4">
            <Button size="icon" variant="ghost" onClick={() => setSidebarSide(sidebarSide === 'left' ? 'right' : 'left')} className="h-8 w-8 hover:bg-white/10 hidden md:flex" title="Swap Sidebar Position">
              {sidebarSide === 'left' ? <PanelRight className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>

            {file && (
              <>
                <div className="flex gap-1 md:gap-2">
                  <Button size="sm" variant="outline" onClick={save} className="h-8 gap-2 px-2 md:px-3">
                    <Save className="h-3.5 w-3.5" /> <span className="hidden md:inline">Save</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePaste} className="h-8 gap-2 text-accent border-accent/30 hover:bg-accent/10 px-2 md:px-3">
                    <ClipboardPaste className="h-3.5 w-3.5" /> <span className="hidden md:inline">Paste</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearFile} className="h-8 gap-2 hover:text-destructive px-2 md:px-3" title="Clear Content">
                    <FileX className="h-3.5 w-3.5" /> <span className="hidden md:inline">Empty</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setItemToRename({ path: file, isFolder: false }); setRenameInput(file.split('/').pop() || ""); setIsRenameDialogOpen(true); }} className="h-8 gap-2 px-2 md:px-3">
                    <Edit className="h-3.5 w-3.5" /> <span className="hidden md:inline">Rename</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadFile} className="h-8 gap-2 hover:text-accent px-2 md:px-3">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={del} className="h-8 gap-2 px-2 md:px-3">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="w-px h-6 bg-border mx-1 hidden md:block" />
                <Button 
                  size="sm" 
                  className="bg-primary text-primary-foreground h-8 hidden md:flex"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Overwrite
                </Button>
              </>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {/* EDITOR */}
        <div className="flex-1 relative overflow-hidden">
          {!file && !isLoadingFile && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <div className="text-center p-8 border border-border rounded-xl bg-card shadow-2xl max-w-sm mx-4">
                <FileIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h2 className="text-lg font-bold mb-2">CodeNest Explorer</h2>
                <p className="text-sm text-muted-foreground mb-6">Select a file from the left to start editing. Files open immediately on click.</p>
                <Button variant="secondary" onClick={() => setIsSidebarOpen(true)} className="w-full gap-2">
                  <ChevronRight className="h-4 w-4" /> Open Sidebar
                </Button>
              </div>
            </div>
          )}
          
          {isLoadingFile && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          <MonacoEditor
            path={file || 'untitled'}
            language={file ? getLanguage(file) : 'plaintext'}
            value={fileContent}
            onChange={(val) => setFileContent(val || "")}
            theme="vs-dark"
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;
            }}
            options={{
              minimap: { enabled: false },
              automaticLayout: true,
              fontSize: 13,
              fontFamily: 'monospace',
              lineHeight: 20,
              padding: { top: 16 },
              wordWrap: "off",
              backgroundColor: '#1A1D21',
              scrollBeyondLastLine: false,
              renderWhitespace: "selection",
              scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10
              }
            }}
          />
        </div>
      </div>

       <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Create {newItemType}</DialogTitle>
                    <DialogDescription>Target: <span className="font-mono text-accent">{selectedFolder}</span></DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Enter name..." />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateItem}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
            <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Rename Item</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <Label htmlFor="new-name">New Name</Label>
                    <Input id="new-name" value={renameInput} onChange={(e) => setRenameInput(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleRename}>Rename</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* ZIP CONFLICT DIALOG */}
        <Dialog open={isZipConflictDialogOpen} onOpenChange={setIsZipConflictDialogOpen}>
            <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-accent mb-2">
                      <AlertCircle className="h-5 w-5" />
                      <DialogTitle>File Conflicts</DialogTitle>
                    </div>
                    <DialogDescription>
                        {zipConflicts.length} files already exist in <span className="font-mono text-accent">{selectedFolder}</span>.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-48 rounded border border-border p-2 bg-black/20 my-4">
                    {zipConflicts.map((c, i) => <div key={i} className="text-xs font-mono opacity-70 mb-1">â€¢ {c}</div>)}
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => { setIsZipConflictDialogOpen(false); executeZipUpload(pendingZipFile!, zipConflicts); }}>Skip Existing</Button>
                    <Button onClick={() => { setIsZipConflictDialogOpen(false); executeZipUpload(pendingZipFile!, []); }}>Replace All</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* ZIP PROGRESS DIALOG */}
        <Dialog open={isZipProgressOpen} onOpenChange={(open) => !open && setIsZipProgressOpen(false)}>
            <DialogContent className="bg-card border-border max-w-sm pointer-events-none" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      {zipProgress < 100 ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {zipStatus}
                    </DialogTitle>
                </DialogHeader>
                <div className="py-6 space-y-4">
                    <Progress value={zipProgress} className="h-2" />
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}