
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, ArrowLeft, Save, RotateCcw, Upload, Download, TestTube2, Search, Plus, Minus, Edit } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { computePairScore } from "@/workers/preprocess";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { loadCachedResult, loadEnrollmentDataFromCache } from "@/lib/cache";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center bg-editor-loading-background"><p>Loading Editor...</p></div> });

type Settings = any;
type SavedProgressFile = {
  key: string;
  name: string;
  size: string;
  date: string;
};

type AutoRule = {
  id: string;
  code: string;
  params: any;
  [key: string]: any; 
};

const PROGRESS_KEY_PREFIX = "progress-";

const embeddedFileContent: Record<string, string> = {
  "README.md": "gi# Firebase Studio\n\nThis is a NextJS starter in Firebase Studio.\n\nTo get started, take a look at src/app/page.tsx.\n# Beneficiary-Insights-System\n\n",
  "apphosting.yaml": "# Settings to manage and configure a Firebase App Hosting backend.\n# https://firebase.google.com/docs/app-hosting/configure\n\nrunConfig:\n  # Increase this value if you'd like to automatically spin up\n  # more instances in response to increased traffic.\n  maxInstances: 1\n",
  "components.json": "{\n  \"$schema\": \"https://ui.shadcn.com/schema.json\",\n  \"style\": \"default\",\n  \"rsc\": true,\n  \"tsx\": true,\n  \"tailwind\": {\n    \"config\": \"tailwind.config.ts\",\n    \"css\": \"src/app/globals.css\",\n    \"baseColor\": \"neutral\",\n    \"cssVariables\": true,\n    \"prefix\": \"\"\n  },\n  \"aliases\": {\n    \"components\": \"@/components\",\n    \"utils\": \"@/lib/utils\",\n    \"ui\": \"@/components/ui\",\n    \"lib\": \"@/lib\",\n    \"hooks\": \"@/hooks\"\n  },\n  \"iconLibrary\": \"lucide\"\n}\n",
  "next.config.js": "/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  /* config options here */\n  typescript: {\n    ignoreBuildErrors: true,\n  },\n  images: {\n    remotePatterns: [\n      {\n        protocol: 'https',\n        hostname: 'placehold.co',\n        port: '',\n        pathname: '/**',\n      },\n      {\n        protocol: 'https',\n        hostname: 'images.unsplash.com',\n        port: '',\n        pathname: '/**',\n      },\n      {\n        protocol: 'https',\n        hostname: 'picsum.photos',\n        port: '',\n        pathname: '/**',\n      },\n    ],\n  },\n};\n\nmodule.exports = nextConfig;\n",
  "package.json": "{\n  \"name\": \"nextn\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"dev\": \"next dev -p 9002\",\n    \"genkit:dev\": \"genkit start -- tsx src/ai/dev.ts\",\n    \"genkit:watch\": \"genkit start -- tsx --watch src/ai/dev.ts\",\n    \"build\": \"NODE_ENV=production next build\",\n    \"start\": \"next start\",\n    \"lint\": \"next lint\",\n    \"typecheck\": \"tsc --noEmit\"\n  },\n  \"dependencies\": {\n    \"@genkit-ai/google-genai\": \"^1.0.0\",\n    \"@hookform/resolvers\": \"^4.1.3\",\n    \"@monaco-editor/react\": \"^4.6.0\",\n    \"@pdf-lib/fontkit\": \"^1.1.1\",\n    \"@radix-ui/react-accordion\": \"^1.2.3\",\n    \"@radix-ui/react-alert-dialog\": \"^1.1.6\",\n    \"@radix-ui/react-avatar\": \"^1.1.3\",\n    \"@radix-ui/react-checkbox\": \"^1.1.4\",\n    \"@radix-ui/react-collapsible\": \"^1.1.11\",\n    \"@radix-ui/react-dialog\": \"^1.1.6\",\n    \"@radix-ui/react-dropdown-menu\": \"^2.1.6\",\n    \"@radix-ui/react-label\": \"^2.1.2\",\n    \"@radix-ui/react-menubar\": \"^1.1.6\",\n    \"@radix-ui/react-popover\": \"^1.1.6\",\n    \"@radix-ui/react-progress\": \"^1.1.2\",\n    \"@radix-ui/react-radio-group\": \"^1.2.3\",\n    \"@radix-ui/react-scroll-area\": \"^1.2.3\",\n    \"@radix-ui/react-select\": \"^2.1.6\",\n    \"@radix-ui/react-separator\": \"^1.1.2\",\n    \"@radix-ui/react-slider\": \"^1.2.3\",\n    \"@radix-ui/react-slot\": \"^1.2.3\",\n    \"@radix-ui/react-switch\": \"^1.1.3\",\n    \"@radix-ui/react-tabs\": \"^1.1.3\",\n    \"@radix-ui/react-toast\": \"^1.2.6\",\n    \"@radix-ui/react-tooltip\": \"^1.1.8\",\n    \"@tailwindcss/aspect-ratio\": \"^0.4.2\",\n    \"@tailwindcss/forms\": \"^0.5.7\",\n    \"@tailwindcss/typography\": \"^0.5.13\",\n    \"better-sqlite3\": \"^11.1.2\",\n    \"class-variance-authority\": \"^0.7.0\",\n    \"clsx\": \"^2.1.1\",\n    \"cmdk\": \"^1.0.0\",\n    \"date-fns\": \"^3.6.0\",\n    \"dayjs\": \"^1.11.11\",\n    \"docx\": \"^8.5.0\",\n    \"dotenv\": \"^16.5.0\",\n    \"echarts\": \"^5.5.0\",\n    \"echarts-for-react\": \"^3.0.2\",\n    \"embla-carousel-react\": \"^8.6.0\",\n    \"exceljs\": \"^4.4.0\",\n    \"file-saver\": \"^2.0.5\",\n    \"firebase\": \"^11.9.1\",\n    \"framer-motion\": \"^11.3.19\",\n    \"genkit\": \"^1.0.0\",\n    \"html-to-image\": \"^1.11.11\",\n    \"idb\": \"^8.0.0\",\n    \"jspdf\": \"2.5.1\",\n    \"jspdf-autotable\": \"3.8.2\",\n    \"jszip\": \"^3.10.1\",\n    \"leaflet\": \"^1.9.4\",\n    \"leaflet.heat\": \"^0.2.0\",\n    \"leaflet.markercluster\": \"^1.5.3\",\n    \"leaflet-image\": \"^0.4.0\",\n    \"lucide-react\": \"^0.475.0\",\n    \"next\": \"14.2.3\",\n    \"patch-package\": \"^8.0.0\",\n    \"pdf-lib\": \"^1.17.1\",\n    \"qrcode\": \"^1.5.3\",\n    \"react\": \"18.3.1\",\n    \"react-day-picker\": \"^9.0.5\",\n    \"react-dom\": \"18.3.1\",\n    \"react-hook-form\": \"^7.54.2\",\n    \"react-leaflet\": \"^4.2.1\",\n    \"recharts\": \"^2.15.1\",\n    \"talisman\": \"^1.1.4\",\n    \"tailwind-merge\": \"^2.4.0\",\n    \"tailwindcss-animate\": \"^1.0.7\",\n    \"xlsx\": \"^0.18.5\",\n    \"zod\": \"^3.24.2\"\n  },\n  \"devDependencies\": {\n    \"@types/better-sqlite3\": \"^7.6.11\",\n    \"@types/file-saver\": \"^2.0.7\",\n    \"@types/jspdf\": \"^2.0.0\",\n    \"@types/jszip\": \"^3.4.1\",\n    \"@types/leaflet\": \"^1.9.12\",\n    \"@types/leaflet.heat\": \"^0.2.4\",\n    \"@types/leaflet.markercluster\": \"^1.5.4\",\n    \"@types/node\": \"^20\",\n    \"@types/react\": \"^18.3.3\",\n    \"@types/react-dom\": \"^18.3.0\",\n    \"@types/recharts\": \"^1.8.29\",\n    \"genkit-cli\": \"^1.0.0\",\n    \"postcss\": \"^8\",\n    \"tailwindcss\": \"^3.4.1\",\n    \"typescript\": \"^5\"\n  }\n}\n",
};

// API utility
async function api(body: any) {
    const res = await fetch("/api/file-manager", {
        method: "POST",
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`API Error: ${res.statusText}`);
    }
    return res.json();
}

const FileEditor = () => {
    const [tree, setTree] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState('');
    const [files, setFiles] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState('');
    const [code, setCode] = useState('');
    const [action, setAction] = useState<'edit' | 'empty' | 'delete' | null>(null);
    const [newFileName, setNewFileName] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    
    const { toast } = useToast();
    const editorRef = useRef<any>(null);

    const flattenFolders = (nodes: any[], pathPrefix = ''): any[] => {
        let folderList: any[] = [];
        nodes.forEach(node => {
            if (node.type === 'folder') {
                const currentPath = node.path;
                folderList.push({ name: currentPath, path: currentPath });
                if (node.children) {
                    folderList = folderList.concat(flattenFolders(node.children, currentPath));
                }
            }
        });
        return folderList;
    };

    const fetchTree = useCallback(async () => {
        try {
            const data = await api({ action: "tree" });
            setTree(data);
            setFolders(flattenFolders(data));
        } catch (error: any) {
            toast({ title: "Error fetching files", description: error.message, variant: "destructive" });
        }
    }, [toast]);

    useEffect(() => {
        fetchTree();
    }, [fetchTree]);

    const handleFolderChange = (path: string) => {
        setSelectedFolder(path);
        setSelectedFile('');
        setCode('');
        setAction(null);
        
        const findFolder = (nodes: any[]): any => {
            for (const node of nodes) {
                if (node.path === path) return node;
                if (node.children) {
                    const found = findFolder(node.children);
                    if (found) return found;
                }
            }
            return null;
        };
        const folder = findFolder(tree);
        setFiles(folder ? folder.children.filter((c: any) => c.type === 'file') : []);
    };
    
    const loadFileContent = (path: string) => {
        if (!path) return;
        setSelectedFile(path);
        const content = embeddedFileContent[path] || `// Content for ${path} not found.`;
        setCode(content);
        if (action === 'edit' || action === 'empty') {
            setTimeout(() => editorRef.current?.setValue(content || ""), 0);
        }
    };
    
    const handleEdit = () => {
      if(!selectedFile) return toast({ title: "No file selected", variant: "destructive" });
      setAction('edit');
      loadFileContent(selectedFile);
    };

    const handleEmpty = () => {
      if(!selectedFile) return toast({ title: "No file selected", variant: "destructive" });
      setCode('');
      setAction('empty');
      setTimeout(() => editorRef.current?.setValue(""), 0);
    };

    const handleDelete = async () => {
      if(!selectedFile) return toast({ title: "No file selected", variant: "destructive" });
      setAction('delete');
      // Simulated delete
      toast({ title: 'File Marked for Deletion', description: "Click 'Save New File' to confirm deletion and optionally create a new file." });
    };
    
    const handleSave = async () => {
        const content = editorRef.current?.getValue() || "";
        let finalAction = action;
        let filePath = selectedFile;
        
        if (isCreatingNew) {
            if (!newFileName) return toast({ title: "File name required", variant: "destructive" });
            finalAction = 'createFile';
            filePath = selectedFolder;
        }

        if(!finalAction || !filePath) return toast({ title: "No action to perform", variant: "destructive" });
        
        toast({ title: "Action Simulated", description: `In a real app, '${filePath}' would be saved/updated.` });
        
        setAction(null);
        setIsCreatingNew(false);
        setNewFileName('');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!selectedFile) {
            toast({ title: "No Destination File", description: "Select a file to overwrite.", variant: "destructive" });
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            toast({ title: "File Content Replaced", description: `Content of "${selectedFile}" replaced. Click Save to confirm.`});
            setCode(content);
            setAction('edit');
            setTimeout(() => editorRef.current?.setValue(content || ""), 0);
        };
        reader.readAsText(file);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>File Editor</CardTitle>
                <CardDescription>Browse, view, and edit project files directly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className='pb-2'><CardTitle className="text-base">Select Folder</CardTitle></CardHeader>
                        <CardContent>
                           <ScrollArea className="h-40 border rounded-md">
                            <RadioGroup onValueChange={handleFolderChange} value={selectedFolder} className="p-4">
                                {folders.map(f => (
                                    <div key={f.path} className="flex items-center space-x-2">
                                        <RadioGroupItem value={f.path} id={f.path} />
                                        <Label htmlFor={f.path} className="font-normal">{f.name}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                           </ScrollArea>
                        </CardContent>
                    </Card>
                    <div className="space-y-2">
                        <Label>Select File</Label>
                         <Select onValueChange={loadFileContent} value={selectedFile} disabled={!selectedFolder}>
                            <SelectTrigger><SelectValue placeholder="Select a file..." /></SelectTrigger>
                            <SelectContent>
                               {files.map(f => <SelectItem key={f.path} value={f.path}>{f.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <div className="flex gap-2 pt-2">
                            <Button onClick={handleEmpty} variant="outline" disabled={!selectedFile}>Empty File</Button>
                            <Button onClick={handleEdit} variant="outline" disabled={!selectedFile}>Edit File</Button>
                            <Button onClick={handleDelete} variant="destructive" disabled={!selectedFile}>Delete File</Button>
                        </div>
                    </div>
                 </div>
                 
                 <Card>
                    <CardHeader>
                        <CardTitle>Upload and Replace File Content</CardTitle>
                        <CardDescription>Upload a file to replace the content of the selected file above. This action is immediate and will save automatically.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center w-full">
                            <Label htmlFor="file-upload-replace" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                </div>
                                <Input id="file-upload-replace" type="file" className="hidden" onChange={handleFileUpload} />
                            </Label>
                        </div>
                    </CardContent>
                </Card>

                {(action === 'edit' || action === 'empty') && (
                    <div className="space-y-4">
                        <div className="h-96 w-full border rounded-md">
                            <MonacoEditor
                                language={selectedFile.endsWith('.tsx') || selectedFile.endsWith('.ts') ? 'typescript' : 'javascript'}
                                theme="vs-dark"
                                defaultValue={code}
                                onMount={(editor, monaco) => {
                                    editorRef.current = editor;
                                }}
                            />
                        </div>
                        <Button onClick={handleSave}>Save Changes</Button>
                    </div>
                )}

                {action === 'delete' && (
                    <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                        <p>Do you want to add a new file to this folder?</p>
                        <div className="flex gap-4">
                            <Button onClick={() => setIsCreatingNew(true)}>Yes</Button>
                            <Button onClick={() => setAction(null)} variant="secondary">No</Button>
                        </div>
                        {isCreatingNew && (
                            <div className="space-y-4 pt-4">
                                <Input placeholder="New file name (e.g., my-file.ts)" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} />
                                <div className="h-96 w-full border rounded-md">
                                    <MonacoEditor
                                        language={newFileName.endsWith('.tsx') || newFileName.endsWith('.ts') ? 'typescript' : 'javascript'}
                                        theme="vs-dark"
                                        defaultValue=""
                                        onMount={(editor) => { editorRef.current = editor; }}
                                    />
                                </div>
                                <Button onClick={handleSave}>Save New File</Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


export default function MealSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testA, setTestA] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
  const [testB, setTestB] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();
  
  const [savedProgressFiles, setSavedProgressFiles] = useState<SavedProgressFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  
  const [rawCachedDataObject, setRawCachedDataObject] = useState<any>(null);
  const [filteredCachedDataString, setFilteredCachedDataString] = useState('');
  const [cacheSearchQuery, setCacheSearchQuery] = useState('');
  const [cacheLoading, setCacheLoading] = useState(false);

  const [enrollmentCachedData, setEnrollmentCachedData] = useState<any>(null);
  const [filteredEnrollmentCacheString, setFilteredEnrollmentCacheString] = useState('');
  const [enrollmentCacheSearchQuery, setEnrollmentCacheSearchQuery] = useState('');
  const [enrollmentCacheLoading, setEnrollmentCacheLoading] = useState(false);
  
  const [autoRules, setAutoRules] = useState<AutoRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  
  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await fetch('/api/rules', { cache: 'no-store' });
      if (res.ok) {
        const rules = await res.json();
        setAutoRules(Array.isArray(rules) ? rules : []);
      } else {
        setAutoRules([]);
      }
    } catch (error) {
      setAutoRules([]);
      console.error("Failed to fetch auto-rules:", error);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleDeleteRules = async () => {
    if (selectedRules.length === 0) return;
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: selectedRules }),
      });
      if (!res.ok) throw new Error('Failed to delete rules');
      toast({ title: "Rules Deleted", description: `Successfully deleted ${selectedRules.length} rule(s).` });
      setSelectedRules([]);
      fetchRules(); // Refresh the list
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: 'destructive' });
    }
  };

  const handleSelectRule = (id: string, checked: boolean | 'indeterminate') => {
    if (typeof checked !== 'boolean') return;
    setSelectedRules(prev => {
      if (checked) {
        return [...prev, id];
      } else {
        return prev.filter(ruleId => ruleId !== id);
      }
    });
  };

  const loadCache = useCallback(async () => {
    setCacheLoading(true);
    setCacheSearchQuery('');
    const data = await loadCachedResult();
    setRawCachedDataObject(data);
    if (data) {
      setFilteredCachedDataString(JSON.stringify(data, null, 2));
    } else {
      setFilteredCachedDataString("No cached data found.");
    }
    setCacheLoading(false);
  }, []);

  const handleDownloadCache = () => {
      if (!filteredCachedDataString || filteredCachedDataString === "No cached data found.") {
          toast({
              title: "No data to download",
              description: "Please load the cache data first.",
              variant: "destructive",
          });
          return;
      }

      const blob = new Blob([filteredCachedDataString], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "beneficiary_insights_cache.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };
  
    const loadEnrollmentCache = useCallback(async () => {
        setEnrollmentCacheLoading(true);
        setEnrollmentCacheSearchQuery('');
        try {
            const data = await loadEnrollmentDataFromCache();
            setEnrollmentCachedData(data);
            if (data) {
              setFilteredEnrollmentCacheString(JSON.stringify(data, null, 2));
            } else {
              setFilteredEnrollmentCacheString("No enrollment cache data found.");
            }
        } catch (error) {
            setFilteredEnrollmentCacheString("Failed to load cache data.");
            toast({ title: "Error", description: "Failed to load enrollment cache.", variant: "destructive" });
        } finally {
            setEnrollmentCacheLoading(false);
        }
    }, [toast]);
    
    const handleDownloadEnrollmentCache = () => {
        if (!filteredEnrollmentCacheString || filteredEnrollmentCacheString === "No enrollment cache data found.") {
            toast({
                title: "No data to download",
                description: "Please load the enrollment cache data first.",
                variant: "destructive",
            });
            return;
        }
        const blob = new Blob([filteredEnrollmentCacheString], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "enrollment_review_cache.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        if (!enrollmentCachedData) return;
        if (!enrollmentCacheSearchQuery.trim()) {
            setFilteredEnrollmentCacheString(JSON.stringify(enrollmentCachedData, null, 2));
            return;
        }
        try {
            const query = enrollmentCacheSearchQuery.toLowerCase();
            const filteredData = enrollmentCachedData.filter((record: any) => {
                return Object.values(record).some(val => 
                    String(val).toLowerCase().includes(query)
                );
            });
            setFilteredEnrollmentCacheString(JSON.stringify(filteredData, null, 2));
        } catch (e) {
            setFilteredEnrollmentCacheString("Error while filtering data.");
        }
    }, [enrollmentCacheSearchQuery, enrollmentCachedData]);
  
  useEffect(() => {
    if (!rawCachedDataObject) return;

    if (!cacheSearchQuery.trim()) {
        setFilteredCachedDataString(JSON.stringify(rawCachedDataObject, null, 2));
        return;
    }

    try {
        const query = cacheSearchQuery.toLowerCase();
        
        const deepFilter = (obj: any): any => {
            if (!obj) return null;

            if (Array.isArray(obj)) {
                const filteredArray = obj.map(deepFilter).filter(item => item !== null && (typeof item !== 'object' || Object.keys(item).length > 0));
                return filteredArray.length > 0 ? filteredArray : null;
            }

            if (typeof obj === 'object') {
                const isMatch = Object.values(obj).some(val => String(val).toLowerCase().includes(query));
                if (isMatch) return obj;

                const newObj: any = {};
                for (const key in obj) {
                    const result = deepFilter(obj[key]);
                    if (result !== null) {
                        newObj[key] = result;
                    }
                }
                return Object.keys(newObj).length > 0 ? newObj : null;
            }
            
            return null;
        };
        
        const filtered = deepFilter({rows: rawCachedDataObject.rows, clusters: rawCachedDataObject.clusters});
        setFilteredCachedDataString(JSON.stringify(filtered, null, 2));

    } catch (e) {
        setFilteredCachedDataString("Error while filtering data.");
    }

  }, [cacheSearchQuery, rawCachedDataObject]);

  const loadSavedProgress = useCallback(() => {
    if (typeof window === 'undefined') return;
    const files: SavedProgressFile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PROGRESS_KEY_PREFIX)) {
        try {
            const parts = key.substring(PROGRESS_KEY_PREFIX.length).split('-');
            const date = new Date(parseInt(parts[parts.length-1])).toLocaleDateString();
            const size = (parseInt(parts[parts.length-2]) / (1024*1024)).toFixed(2) + ' MB';
            const name = parts.slice(0, -2).join('-');
            files.push({ key, name, size, date });
        } catch {
             // Fallback for old key format
             files.push({ key, name: key.substring(PROGRESS_KEY_PREFIX.length), size: 'N/A', date: 'N/A' });
        }
      }
    }
    setSavedProgressFiles(files);
  }, []);

  useEffect(() => {
    loadSavedProgress();
  }, [loadSavedProgress]);


  const handleDeleteSelected = () => {
    if (selectedFiles.length === 0) return;
    selectedFiles.forEach(key => localStorage.removeItem(key));
    toast({ title: `Deleted ${selectedFiles.length} saved progress file(s).`});
    setSelectedFiles([]);
    loadSavedProgress();
  };

  const handleDeleteAll = () => {
    if (confirm("Are you sure you want to delete all saved progress data? This cannot be undone.")) {
        savedProgressFiles.forEach(file => localStorage.removeItem(file.key));
        toast({ title: "All saved progress has been deleted." });
        setSelectedFiles([]);
        loadSavedProgress();
    }
  };
  
  const handleSelectFile = (key: string, isSelected: boolean | 'indeterminate') => {
      if (typeof isSelected !== 'boolean') return;
      if (isSelected) {
          setSelectedFiles(prev => [...prev, key]);
      } else {
          setSelectedFiles(prev => prev.filter(k => k !== key));
      }
  };


  const getDefaultSettings = () => ({
    thresholds: {
      minPair: 0.62,
      minInternal: 0.54,
      blockChunkSize: 3000
    },
    finalScoreWeights: {
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.10,
      husbandScore: 0.12,
      idScore: 0.08,
      phoneScore: 0.05,
      childrenScore: 0.04,
      locationScore: 0.04
    },
    rules: {
      enableNameRootEngine: true,
      enableTribalLineage: true,
      enableMaternalLineage: true,
      enablePolygamyRules: true
    }
  });


  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          // Merge fetched settings with defaults to ensure all keys exist
          const defaults = getDefaultSettings();
          const mergedSettings = {
              ...defaults,
              ...j.settings,
              thresholds: { ...defaults.thresholds, ...j.settings.thresholds },
              finalScoreWeights: { ...defaults.finalScoreWeights, ...j.settings.finalScoreWeights },
              rules: { ...defaults.rules, ...j.settings.rules },
          };
          setSettings(mergedSettings);
        } else {
          // If missing, load defaults
          setSettings(getDefaultSettings());
          toast({ title: t('settings.toasts.defaultsLoaded.title'), description: t('settings.toasts.defaultsLoaded.description'), variant: "default" });
        }
      })
      .catch(() => {
        setSettings(getDefaultSettings());
        toast({ title: t('settings.toasts.loadError.title'), description: t('settings.toasts.loadError.description'), variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [toast, t]);


  function update(path: string, value: any) {
    if (!settings) return;
    const clone = JSON.parse(JSON.stringify(settings));
    const parts = path.split(".");
    let cur: any = clone;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] ?? {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    setSettings(clone);
  }
  
  function handleNumericChange(path: string, change: number) {
      if (!settings) return;
      const parts = path.split(".");
      let cur: any = settings;
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur[parts[i]];
      }
      const currentValue = cur[parts[parts.length - 1]] || 0;
      const newValue = Math.max(0, Math.min(1, parseFloat((currentValue + change).toFixed(2))));
      update(path, newValue);
  }

  function handleWeightChange(key: string, change: number) {
    handleNumericChange(`finalScoreWeights.${key}`, change);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || t('settings.toasts.saveFailed'));
      toast({ title: t('settings.toasts.saveSuccess.title'), description: t('settings.toasts.saveSuccess.description') });
    } catch (err: any) {
      toast({ title: t('settings.toasts.saveFailed'), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    if (confirm(t('settings.toasts.resetConfirm'))) {
      setSettings(getDefaultSettings());
      toast({ title: t('settings.toasts.resetSuccess.title'), description: t('settings.toasts.resetSuccess.description') });
    }
  }

  function exportJSON() {
    if (!settings) return;
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clustering-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file: File | null) {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result));
        // Simple validation
        if (parsed.thresholds && parsed.rules && parsed.finalScoreWeights) {
          setSettings(parsed);
          toast({ title: t('settings.toasts.importSuccess.title'), description: t('settings.toasts.importSuccess.description') });
        } else {
          throw new Error("Invalid settings file structure.");
        }
      } catch (err: any) {
        toast({ title: t('settings.toasts.importFailed'), description: err.message, variant: "destructive" });
      }
    };
    r.readAsText(file);
  }

  function runTestScoring() {
    if (!settings) { toast({ title: "Settings not loaded", variant: "destructive" }); return; }
    // This is a simplified test; it won't have access to the full worker context.
    // We create a minimal version of `computePairScore` on the client.
    const res = computePairScore(testA, testB, settings);
    setLastResult({ source: 'Client Test', ...res });
  }
  
  if (loading || !settings) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading settings...</span></div>);
  }

  return (
    <div className="space-y-8">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">MEAL System Settings</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to MEAL System
                    </Link>
                </Button>
            </div>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <section className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                <CardTitle className="text-2xl">{t('settings.title')}</CardTitle>
                                <CardDescription>{t('settings.description')}</CardDescription>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                               
                                <Button onClick={exportJSON} variant="outline"><Download className="mr-2" />{t('settings.buttons.export')}</Button>
                                <Button asChild variant="outline">
                                    <Label>
                                    <Upload className="mr-2" />
                                    {t('settings.buttons.import')}
                                    <input type="file" accept="application/json" className="hidden" onChange={(e) => importJSON(e.target.files?.[0] ?? null)} />
                                    </Label>
                                </Button>
                                <Button onClick={resetDefaults} variant="destructive"><RotateCcw className="mr-2" />{t('settings.buttons.reset')}</Button>
                                <Button onClick={save} disabled={saving}>
                                    {saving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                                    {saving ? t('settings.buttons.saving') : t('settings.buttons.save')}
                                </Button>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('settings.thresholds.title')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                        <div>
                            <div className="grid grid-cols-12 items-center gap-4">
                            <Label htmlFor="minPair" className="col-span-12 sm:col-span-3 flex items-center">{t('settings.thresholds.minPair')}: <b className="mx-1">{settings.thresholds.minPair}</b></Label>
                            <Slider dir="ltr" id="minPair" min={0} max={1} step={0.01} value={[settings.thresholds.minPair]} onValueChange={(v)=>update("thresholds.minPair", v[0])} className="col-span-12 sm:col-span-6" />
                            <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minPair', -0.01)}><Minus className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minPair', 0.01)}><Plus className="h-4 w-4" /></Button>
                            </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 pl-1">{t('settings.thresholds.minPairDescription')}</p>
                        </div>
                        <div>
                            <div className="grid grid-cols-12 items-center gap-4">
                            <Label htmlFor="minInternal" className="col-span-12 sm:col-span-3 flex items-center">{t('settings.thresholds.minInternal')}: <b className="mx-1">{settings.thresholds.minInternal}</b></Label>
                            <Slider dir="ltr" id="minInternal" min={0} max={1} step={0.01} value={[settings.thresholds.minInternal]} onValueChange={(v)=>update("thresholds.minInternal", v[0])} className="col-span-12 sm:col-span-6" />
                            <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minInternal', -0.01)}><Minus className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minInternal', 0.01)}><Plus className="h-4 w-4" /></Button>
                            </div>
                            </div>
                             <p className="text-xs text-muted-foreground mt-1 pl-1">{t('settings.thresholds.minInternalDescription')}</p>
                        </div>
                        <div>
                            <Label htmlFor="blockChunkSize">{t('settings.thresholds.blockChunkSize')}</Label>
                            <Input id="blockChunkSize" type="number" value={settings.thresholds.blockChunkSize} onChange={(e)=>update("thresholds.blockChunkSize", parseInt(e.target.value||"0"))}/>
                            <p className="text-xs text-muted-foreground mt-1">{t('settings.thresholds.blockChunkSizeDescription')}</p>
                        </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>{t('settings.weights.title')}</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(settings.finalScoreWeights).map(([k, v]: [string, any]) => (
                            <div key={k} className="flex flex-col gap-2 p-3 border rounded-md">
                               <div className="flex justify-between items-center">
                                 <Label htmlFor={`fsw-${k}`} className="capitalize flex items-center">{t(`settings.weights.${k}`)}</Label>
                               </div>
                               <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, -0.01)}><Minus className="h-4 w-4" /></Button>
                                    <Input type="number" step="0.01" value={v || ''} onChange={(e)=>update(`finalScoreWeights.${k}`, parseFloat(e.target.value) || 0)} className="w-24 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, 0.01)}><Plus className="h-4 w-4" /></Button>
                               </div>
                                <Slider dir="ltr" id={`fsw-${k}`} min={0} max={1} step={0.01} value={[v]} onValueChange={(val)=>update(`finalScoreWeights.${k}`, val[0])} />
                                <p className="text-xs text-muted-foreground mt-1">{t(`settings.weights.${k}Description`)}</p>
                            </div>
                        ))}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>{t('settings.rules.title')}</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(settings.rules).map(([k, v]: [string, any]) => (
                            <div key={k} className="flex items-start justify-between p-3 rounded-lg border">
                              <div className="flex flex-col gap-1 flex-1 ltr:mr-4 rtl:ml-4">
                                <Label htmlFor={`r-${k}`} className="capitalize flex items-center">{t(`settings.rules.${k}`)}</Label>
                                <p className="text-xs text-muted-foreground">{t(`settings.rules.${k}Description`)}</p>
                              </div>
                              <Switch id={`r-${k}`} checked={v} onCheckedChange={(val)=>update(`rules.${k}`, val)} />
                            </div>
                        ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                            <CardTitle>Learned Rules</CardTitle>
                            <CardDescription>
                                These rules were automatically generated by the system based on your feedback.
                            </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="destructive" size="sm" onClick={handleDeleteRules} disabled={selectedRules.length === 0}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Selected ({selectedRules.length})
                                </Button>
                            </div>
                        </div>
                        </CardHeader>
                        <CardContent>
                        {rulesLoading ? (
                            <div className="flex items-center justify-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : autoRules.length > 0 ? (
                            <ScrollArea className="h-64 border rounded-md">
                            <div className="p-4 space-y-2">
                                {autoRules.map((rule) => (
                                <div key={rule.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted">
                                    <Checkbox
                                    id={`rule-${rule.id}`}
                                    checked={selectedRules.includes(rule.id)}
                                    onCheckedChange={(checked) => handleSelectRule(rule.id, checked)}
                                    className="mt-1"
                                    />
                                    <div className="flex-1">
                                    <label htmlFor={`rule-${rule.id}`} className="font-mono text-xs font-semibold">{rule.id}</label>
                                    <pre className="text-xs font-mono mt-1 p-2 bg-background rounded text-muted-foreground whitespace-pre-wrap">
                                        {rule.code}
                                    </pre>
                                    </div>
                                </div>
                                ))}
                            </div>
                            </ScrollArea>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">No rules have been learned yet. Use the "Data Correction" feature on the Upload page to teach the system.</p>
                        )}
                        </CardContent>
                    </Card>
                    <FileEditor />
                </section>

                <aside className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>{t('settings.testScoring.title')}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                        <div className="space-y-2 p-3 border rounded-md">
                            <h4 className="font-medium">{t('settings.testScoring.recordA')}</h4>
                            <Label>{t('settings.fieldNames.womanName')}</Label>
                            <Input value={testA.womanName} onChange={e=>setTestA({...testA, womanName: e.target.value})}/>
                            <Label>{t('settings.fieldNames.husbandName')}</Label>
                            <Input value={testA.husbandName} onChange={e=>setTestA({...testA, husbandName: e.target.value})}/>
                            <Label>{t('settings.fieldNames.nationalId')}</Label>
                            <Input value={testA.nationalId} onChange={e=>setTestA({...testA, nationalId: e.target.value})}/>
                            <Label>{t('settings.fieldNames.phone')}</Label>
                            <Input value={testA.phone} onChange={e=>setTestA({...testA, phone: e.target.value})}/>
                        </div>

                        <div className="space-y-2 p-3 border rounded-md">
                            <h4 className="font-medium">{t('settings.testScoring.recordB')}</h4>
                            <Label>{t('settings.fieldNames.womanName')}</Label>
                            <Input value={testB.womanName} onChange={e=>setTestB({...testB, womanName: e.target.value})}/>
                            <Label>{t('settings.fieldNames.husbandName')}</Label>
                            <Input value={testB.husbandName} onChange={e=>setTestB({...testB, husbandName: e.target.value})}/>
                            <Label>{t('settings.fieldNames.nationalId')}</Label>
                            <Input value={testB.nationalId} onChange={e=>setTestB({...testB, nationalId: e.target.value})}/>
                            <Label>{t('settings.fieldNames.phone')}</Label>
                            <Input value={testB.phone} onChange={e=>setTestB({...testB, phone: e.target.value})}/>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={runTestScoring}>{t('settings.testScoring.runTest')}</Button>
                            <Button onClick={() => { setTestA({womanName:"",husbandName:"",nationalId:"",phone:""}); setTestB({womanName:"",husbandName:"",nationalId:"",phone:""}); setLastResult(null); }} variant="outline">{t('settings.testScoring.clear')}</Button>
                        </div>

                        {lastResult && (
                            <div className="mt-3 bg-muted p-3 rounded-lg">
                            <div className="font-bold text-lg">Source: {lastResult.source}</div>
                               {lastResult.score !== undefined && lastResult.score !== null ? (
                                <>
                                  <div className="font-bold text-lg">{t('settings.testScoring.score')}: {lastResult.score.toFixed(4)}</div>
                                  <div className="text-sm mt-2">{t('settings.testScoring.compareToMinPair')}: <b>{settings.thresholds.minPair}</b></div>
                                </>
                               ) : <div className="font-bold text-lg">No Match</div> }
                              <details className="mt-2 text-sm">
                                  <summary className="cursor-pointer font-medium">{t('settings.testScoring.viewBreakdown')}</summary>
                                  <pre className="text-xs mt-2 bg-background p-2 rounded">{JSON.stringify(lastResult.breakdown, null, 2)}</pre>
                              </details>
                            </div>
                        )}
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Manage Saved Progress</CardTitle>
                            <CardDescription>Manage or delete saved clustering progress files to free up space or remove old data.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {savedProgressFiles.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No saved progress found.</p>
                            ) : (
                                <>
                                    <div className="flex justify-end gap-2 mb-4">
                                         <Button variant="outline" size="sm" onClick={handleDeleteAll}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete All
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedFiles.length === 0}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Selected ({selectedFiles.length})
                                        </Button>
                                    </div>
                                    <ScrollArea className="h-48 rounded-md border">
                                        <div className="p-4 space-y-2">
                                            {savedProgressFiles.map((file) => (
                                                <div key={file.key} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                                    <div className="flex items-center gap-3">
                                                        <Checkbox
                                                            id={file.key}
                                                            checked={selectedFiles.includes(file.key)}
                                                            onCheckedChange={(checked) => handleSelectFile(file.key, checked)}
                                                        />
                                                        <div className="grid gap-0.5">
                                                            <label htmlFor={file.key} className="text-sm font-medium leading-none truncate max-w-[200px]" title={file.name}>
                                                                {file.name}
                                                            </label>
                                                            <p className="text-xs text-muted-foreground">
                                                                {file.size} - {file.date}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('settings.cache.title')}</CardTitle>
                            <CardDescription>{t('settings.cache.description')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <Button onClick={loadCache} disabled={cacheLoading} className="flex-1">
                                        {cacheLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {t('settings.cache.button')}
                                    </Button>
                                     <Button onClick={handleDownloadCache} variant="outline" disabled={!rawCachedDataObject}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download .txt
                                    </Button>
                                </div>
                                {rawCachedDataObject && (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder="Search cached data..."
                                            className="pl-10"
                                            value={cacheSearchQuery}
                                            onChange={(e) => setCacheSearchQuery(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                            {rawCachedDataObject && (
                                <Textarea
                                    readOnly
                                    className="mt-4 h-64 font-mono text-xs"
                                    value={filteredCachedDataString}
                                    placeholder={t('settings.cache.loading')}
                                />
                            )}
                        </CardContent>
                    </Card>

                     <Card>
                      <CardHeader>
                        <CardTitle>Enrollment Cache Viewer</CardTitle>
                        <CardDescription>Inspect the data cached by the Enrollment Review worker.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button onClick={loadEnrollmentCache} disabled={enrollmentCacheLoading} className="flex-1">
                              {enrollmentCacheLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Load Enrollment Cache
                            </Button>
                            <Button onClick={handleDownloadEnrollmentCache} variant="outline" disabled={!enrollmentCachedData}>
                              <Download className="mr-2 h-4 w-4" />
                              Download .txt
                            </Button>
                          </div>
                          {enrollmentCachedData && (
                            <div className="relative">
                              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="text"
                                placeholder="Search cached data..."
                                className="pl-10"
                                value={enrollmentCacheSearchQuery}
                                onChange={(e) => setEnrollmentCacheSearchQuery(e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                        {enrollmentCachedData && (
                          <Textarea
                            readOnly
                            className="mt-4 h-64 font-mono text-xs"
                            value={filteredEnrollmentCacheString}
                            placeholder={"Loading data..."}
                          />
                        )}
                      </CardContent>
                    </Card>

                </aside>
            </main>
        </div>
    );
}
