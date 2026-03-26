
"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { 
  ClipboardPaste, Search, Plus, FolderPlus, File as FileIcon, Eye, Edit, 
  Upload, RefreshCw, Trash2, Download, Save, AlertCircle, 
  CheckCircle2, Loader2, PanelLeft, PanelRight, ChevronLeft, ChevronRight, Menu,
  FileX, Home, ArrowRightLeft, FolderOpen, FileUp, Archive, ChevronDown
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  const folderUploadInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [tree, setTree] = useState<any[]>([]);
  const [file, setFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>('src');
  const [folderSearch, setFolderSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");

  // New state for collapsible folders
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Selection state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

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

  // State for moving
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [moveDestination, setMoveDestination] = useState<string | null>(null);
  const [moveConflicts, setMoveConflicts] = useState<string[]>([]);
  const [isMoveConflictDialogOpen, setIsMoveConflictDialogOpen] = useState(false);

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

  // Collapse all folders by default when the tree is loaded
  const getAllFolderPaths = useCallback((nodes: any[]): string[] => {
    let paths: string[] = [];
    nodes.forEach(node => {
      if (node.type === 'folder') {
        paths.push(node.path);
        if (node.children) {
          paths = [...paths, ...getAllFolderPaths(node.children)];
        }
      }
    });
    return paths;
  }, []);

  useEffect(() => {
    if (tree.length > 0 && !folderSearch && !fileSearch) {
      setCollapsedFolders(new Set(getAllFolderPaths(tree)));
    }
  }, [tree, folderSearch, fileSearch, getAllFolderPaths]);

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

  async function deletePath(p: string) {
    try {
        await api({ action: "delete", filePath: p });
        toast({ title: "Deleted", description: `${p} has been removed.` });
        if (p === file) {
            setFile(null);
            setFileContent("");
            setPageUrl(null);
        }
        setSelectedPaths(prev => {
            const next = new Set(prev);
            next.delete(p);
            return next;
        });
        loadTree();
    } catch (e: any) {
        toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
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
    if (selectedFolder === null) {
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
    formData.append("targetFolder", selectedFolder === '.' ? '' : selectedFolder);

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
    formData.append("targetFolder", selectedFolder === '.' ? '' : (selectedFolder || ''));
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

  async function handleFolderUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    if (selectedFolder === null) {
      toast({ title: "No folder selected", description: "Select a folder to upload into.", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", uploaded);
    formData.append("action", "uploadFile");
    formData.append("targetFolder", selectedFolder === '.' ? '' : selectedFolder);

    try {
      const res = await fetch("/api/file-manager", { method: "POST", body: formData });
      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Upload failed");
      }
      toast({ title: "Success", description: `${uploaded.name} uploaded successfully.` });
      await loadTree();
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      e.target.value = "";
    }
  }

  const handleCreateItem = async () => {
    if (!newItemType || !newItemName || selectedFolder === null) return;
    try {
        await api({
            action: newItemType === 'file' ? 'createFile' : 'createFolder',
            filePath: selectedFolder === '.' ? '' : selectedFolder,
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

  const checkMoveConflicts = async () => {
    if (selectedPaths.size === 0 || moveDestination === null) return;
    
    // Identify top-level move items
    const sortedPaths = Array.from(selectedPaths).sort((a, b) => a.length - b.length);
    const topLevelMoves: string[] = [];
    for (const p of sortedPaths) {
        if (!topLevelMoves.some(existing => p.startsWith(existing + '/'))) {
            topLevelMoves.push(p);
        }
    }

    const itemsToCheck = topLevelMoves.map(p => ({ source: p, destination: moveDestination }));
    
    try {
      const res = await api({ action: 'checkConflicts', items: itemsToCheck });
      if (res.conflicts && res.conflicts.length > 0) {
        setMoveConflicts(res.conflicts);
        setIsMoveConflictDialogOpen(true);
      } else {
        await executeMove(topLevelMoves, false);
      }
    } catch (e: any) {
      toast({ title: "Check Failed", description: e.message, variant: "destructive" });
    }
  };

  const executeMove = async (pathsToMove: string[], force: boolean) => {
    setIsLoadingFile(true);
    let successCount = 0;
    let skipCount = 0;

    try {
        for (const sourcePath of pathsToMove) {
            const res = await api({ 
                action: 'move', 
                sourcePath, 
                destinationDir: moveDestination === '.' ? '' : moveDestination,
                force
            });
            if (res.ok) successCount++;
            else if (res.conflict) skipCount++;
        }
        toast({ 
          title: "Move Complete", 
          description: `Moved ${successCount} item(s)${skipCount > 0 ? `, skipped ${skipCount} conflict(s)` : ''}.` 
        });
        setSelectedPaths(new Set());
        setIsMoveDialogOpen(false);
        setIsMoveConflictDialogOpen(false);
        await loadTree();
    } catch (e: any) {
        toast({ title: "Move Failed", description: e.message, variant: "destructive" });
    } finally {
        setIsLoadingFile(false);
    }
  };

  const togglePathSelection = (p: string, isFolder: boolean) => {
    setSelectedPaths(prev => {
        const next = new Set(prev);
        const isChecking = !next.has(p);

        if (isFolder && isChecking) {
            // Find all children recursively and select them
            const findDescendants = (nodes: any[], parentPath: string): string[] => {
                let paths: string[] = [];
                for (const node of nodes) {
                    if (node.path === parentPath) {
                        const collect = (children: any[]) => {
                            for (const child of children) {
                                paths.push(child.path);
                                if (child.children) collect(child.children);
                            }
                        };
                        if (node.children) collect(node.children);
                        break;
                    }
                    if (node.children) {
                        const res = findDescendants(node.children, parentPath);
                        if (res.length > 0) {
                            paths = res;
                            break;
                        }
                    }
                }
                return paths;
            };

            const descendants = findDescendants(tree, p);
            next.add(p);
            descendants.forEach(dp => next.add(dp));
        } else {
            // Single toggle (either a file, or a folder being unchecked)
            if (isChecking) next.add(p);
            else next.delete(p);
        }
        return next;
    });
  };

  const getAllFolders = (nodes: any[]): string[] => {
    let folders: string[] = [];
    nodes.forEach(node => {
        if (node.type === 'folder') {
            folders.push(node.path);
            if (node.children) {
                folders = [...folders, ...getAllFolders(node.children)];
            }
        }
    });
    return folders;
  };

  const folderList = useMemo(() => {
    const list = getAllFolders(tree);
    return ['.', ...list]; // '.' represents the project root
  }, [tree]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const toggleFolder = (path: string) => {
    setCollapsedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const filteredTree = useMemo(() => {
    const folderQuery = folderSearch.trim().toLowerCase();
    const fileQuery = fileSearch.trim().toLowerCase();

    if (!folderQuery && !fileQuery) {
      return tree;
    }

    function filterNodes(nodes: any[]): any[] {
      const result: any[] = [];
      for (const node of nodes) {
        if (node.type === 'folder') {
          const children = node.children ? filterNodes(node.children) : [];
          if (children.length > 0) {
            result.push({ ...node, children });
          }
        } else { // file
          const fileMatch = !fileQuery || node.name.toLowerCase().includes(fileQuery);
          const pathMatch = !folderQuery || node.path.toLowerCase().includes(folderQuery);
          if (fileMatch && pathMatch) {
            result.push(node);
          }
        }
      }
      return result;
    }

    return filterNodes(tree);
  }, [tree, folderSearch, fileSearch]);

  const renderTree = useCallback((nodes: any[]) => {
      return nodes.map((n) => {
        const isCollapsed = !folderSearch && !fileSearch && collapsedFolders.has(n.path);
        const hasChildren = n.children && n.children.length > 0;
  
        return (
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
                  <Checkbox 
                    checked={selectedPaths.has(n.path)} 
                    onCheckedChange={() => togglePathSelection(n.path, false)} 
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5"
                  />
                  <FileIcon className="h-3.5 w-3.5 shrink-0 opacity-70" /> 
                  <span className="text-sm">{n.name}</span>
                </span>
                <div className="flex items-center gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToRename({ path: n.path, isFolder: false });
                      setRenameInput(n.name);
                      setIsRenameDialogOpen(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive" 
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePath(n.path);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <span className="text-[10px] opacity-40 shrink-0 ml-1">{formatBytes(n.size)}</span>
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
                      <Checkbox 
                        checked={selectedPaths.has(n.path)} 
                        onCheckedChange={() => togglePathSelection(n.path, true)} 
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 border-accent/50 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFolder(n.path);
                        }}
                      >
                        {hasChildren ? (isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <span className="w-4"/>}
                      </Button>
                      <FolderPlus className="h-3.5 w-3.5 shrink-0 opacity-70" /> 
                      <span className="text-sm font-medium">{n.name}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToRename({ path: n.path, isFolder: true });
                          setRenameInput(n.name);
                          setIsRenameDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive" 
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePath(n.path);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <span className="text-[10px] opacity-40 shrink-0 ml-1">{formatBytes(n.size)}</span>
                    </div>
                </div>
                {!isCollapsed && n.children && renderTree(n.children)}
              </div>
            )}
          </div>
        );
      });
  }, [folderSearch, fileSearch, collapsedFolders, file, selectedFolder, selectedPaths, togglePathSelection, deletePath, openFile]);


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
            
            {selectedPaths.size > 0 ? (
                <div className="flex flex-col gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-accent">{selectedPaths.size} Selected</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setSelectedPaths(new Set())}>Deselect All</Button>
                    </div>
                    <div className="flex gap-2">
                        <Button className="flex-1 h-8 text-xs bg-accent text-accent-foreground" onClick={() => setIsMoveDialogOpen(true)}>
                            <ArrowRightLeft className="h-3 w-3 mr-1" /> Move
                        </Button>
                        <Button className="flex-1 h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
                            if(confirm(`Delete ${selectedPaths.size} items?`)) {
                                selectedPaths.forEach(p => deletePath(p));
                            }
                        }}>
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => { setNewItemType('file'); setIsCreateDialogOpen(true); }} className="flex-1 min-w-[70px] px-1" variant="secondary" size="sm" disabled={selectedFolder === null}>
                        <Plus className="h-3.5 w-3.5 mr-1"/> File
                    </Button>
                    <Button onClick={() => { setNewItemType('folder'); setIsCreateDialogOpen(true); }} className="flex-1 min-w-[70px] px-1" variant="secondary" size="sm" disabled={selectedFolder === null}>
                        <FolderPlus className="h-3.5 w-3.5 mr-1"/> Folder
                    </Button>
                    <Button onClick={() => folderUploadInputRef.current?.click()} className="flex-1 min-w-[70px] px-1" variant="secondary" size="sm" disabled={selectedFolder === null}>
                        <FileUp className="h-3.5 w-3.5 mr-1"/> Upload
                    </Button>
                    <Button onClick={() => zipInputRef.current?.click()} className="flex-1 min-w-[70px] px-1" variant="secondary" size="sm" disabled={selectedFolder === null}>
                        <Archive className="h-3.5 w-3.5 mr-1"/> ZIP
                    </Button>
                </div>
            )}

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <FolderOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="bg-card/50 pl-8 pr-2 py-1 h-9 text-sm"
                      placeholder="Search folders..."
                      value={folderSearch}
                      onChange={(e) => setFolderSearch(e.target.value)}
                    />
                </div>
                <div className="relative flex-1">
                    <FileIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="bg-card/50 pl-8 pr-2 py-1 h-9 text-sm"
                      placeholder="Search files..."
                      value={fileSearch}
                      onChange={(e) => setFileSearch(e.target.value)}
                    />
                </div>
            </div>
        </div>

        <ScrollArea className="flex-1">
            <div className="pr-4">
              <div
                className={cn(
                  "group flex justify-between items-center py-0.5 px-2 rounded cursor-pointer transition-colors hover:bg-white/5 whitespace-nowrap mb-1",
                  selectedFolder === '.' ? 'bg-accent/20 text-accent' : 'opacity-80'
                )}
                onClick={() => setSelectedFolder('.')}
              >
                <span className="flex items-center gap-2 overflow-hidden mr-4">
                  <Checkbox 
                    checked={selectedPaths.has('.')} 
                    onCheckedChange={() => togglePathSelection('.', true)} 
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 border-accent/50 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
                  />
                  <Home className="h-3.5 w-3.5 shrink-0 opacity-70" /> 
                  <span className="text-sm font-medium">Project Root</span>
                </span>
              </div>
              {renderTree(filteredTree)}
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
        <input
          ref={folderUploadInputRef}
          type="file"
          className="hidden"
          onChange={handleFolderUpload}
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
                  <Button size="sm" variant="destructive" onClick={() => deletePath(file)} className="h-8 gap-2 px-2 md:px-3">
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
                    <DialogDescription>Target: <span className="font-mono text-accent">{selectedFolder === '.' ? 'Root' : selectedFolder}</span></DialogDescription>
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

        {/* MOVE DIALOG */}
        <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-accent" /> Move {selectedPaths.size} Item(s)
                    </DialogTitle>
                    <DialogDescription>Choose a destination folder for the selected items.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ScrollArea className="h-64 border border-border rounded-md bg-black/20 p-2">
                        <div className="space-y-1">
                            {folderList.map(folder => (
                                <div 
                                    key={folder}
                                    className={cn(
                                        "flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-white/5 transition-colors",
                                        moveDestination === folder && "bg-accent/20 text-accent font-bold"
                                    )}
                                    onClick={() => setMoveDestination(folder)}
                                >
                                    {folder === '.' ? <Home className="h-4 w-4 opacity-70" /> : <FolderOpen className="h-4 w-4 opacity-70" />}
                                    <span className="text-sm">{folder === '.' ? 'Project Root' : folder}</span>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>Cancel</Button>
                    <Button onClick={checkMoveConflicts} disabled={moveDestination === null}>Move Here</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* MOVE CONFLICT DIALOG */}
        <Dialog open={isMoveConflictDialogOpen} onOpenChange={setIsMoveConflictDialogOpen}>
            <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-accent mb-2">
                      <AlertCircle className="h-5 w-5" />
                      <DialogTitle>Move Conflicts</DialogTitle>
                    </div>
                    <DialogDescription>
                        {moveConflicts.length} items already exist in <span className="font-mono text-accent">{moveDestination === '.' ? 'Root' : moveDestination}</span>.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-48 rounded border border-border p-2 bg-black/20 my-4">
                    {moveConflicts.map((c, i) => <div key={i} className="text-xs font-mono opacity-70 mb-1">• {c.split('/').pop()}</div>)}
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => { 
                      const sortedPaths = Array.from(selectedPaths).sort((a, b) => a.length - b.length);
                      const topLevelMoves = [];
                      for (const p of sortedPaths) {
                          if (!topLevelMoves.some(existing => p.startsWith(existing + '/'))) {
                              topLevelMoves.push(p);
                          }
                      }
                      const nonConflicting = topLevelMoves.filter(p => !moveConflicts.includes(p));
                      executeMove(nonConflicting, false);
                    }}>Skip Existing</Button>
                    <Button onClick={() => {
                      const sortedPaths = Array.from(selectedPaths).sort((a, b) => a.length - b.length);
                      const topLevelMoves = [];
                      for (const p of sortedPaths) {
                          if (!topLevelMoves.some(existing => p.startsWith(existing + '/'))) {
                              topLevelMoves.push(p);
                          }
                      }
                      executeMove(topLevelMoves, true);
                    }}>Replace All</Button>
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
                        {zipConflicts.length} files already exist in <span className="font-mono text-accent">{selectedFolder === '.' ? 'Root' : selectedFolder}</span>.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-48 rounded border border-border p-2 bg-black/20 my-4">
                    {zipConflicts.map((c, i) => <div key={i} className="text-xs font-mono opacity-70 mb-1">• {c}</div>)}
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
