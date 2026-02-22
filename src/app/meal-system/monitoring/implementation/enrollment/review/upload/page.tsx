// src/app/meal-system/monitoring/implementation/enrollment/review/upload/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { saveEnrollmentDataToCache, loadEnrollmentDataFromCache } from '@/lib/cache';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Upload, GitCompareArrows, Trash2, Plus, FileDown, Database, Save, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

interface Project {
  projectId: string;
  projectName: string;
}

const LOCAL_STORAGE_MAPPING_PREFIX = "enrollment-review-mapping-v2-";

const SummaryCard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
);

export default function EnrollmentReviewUploadPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [columns, setColumns] = useState<string[]>([]);
    const [rawFileData, setRawFileData] = useState<any[]>([]);
    const [uniqueIdFileCol, setUniqueIdFileCol] = useState('');
    const [enrichedColumns, setEnrichedColumns] = useState<string[]>([]);
    
    const [loading, setLoading] = useState({ projects: true, caching: false, worker: false, saving: false, dbSchema: true });
    const [workerStatus, setWorkerStatus] = useState('idle');
    const [workerProgress, setWorkerProgress] = useState(0);

    const workerRef = useRef<Worker | null>(null);

    // New state for DB saving logic
    const [dbColumns, setDbColumns] = useState<string[]>([]);
    const [dbColumnMapping, setDbColumnMapping] = useState<Map<string, string>>(new Map());
    const [uniqueIdDbCol, setUniqueIdDbCol] = useState('');
    const [manualDbMapping, setManualDbMapping] = useState({ ui: "", db: "" });
    const [saveStats, setSaveStats] = useState({ saved: 0, skipped: 0, updated: 0, total: 0 });
    const [duplicateInfo, setDuplicateInfo] = useState({ isOpen: false, count: 0, totalInFile: 0, records: [] as any[] });

    // Initialization
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [projRes, dbSchemaRes] = await Promise.all([
                    fetch('/api/projects'),
                    fetch('/api/enrollment-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_schema' })})
                ]);
                if (projRes.ok) setProjects(await projRes.json());
                if (dbSchemaRes.ok) {
                    const schema = await dbSchemaRes.json();
                    setDbColumns(schema.columns || []);
                }
            } catch (err: any) {
                toast({ title: 'Error loading initial data', description: err.message, variant: 'destructive'});
            } finally {
                setLoading(p => ({...p, projects: false, dbSchema: false}));
            }
        };
        fetchInitialData();

        const worker = new Worker(new URL('@/workers/enrollment-review.worker.ts', import.meta.url));
        workerRef.current = worker;
        worker.onmessage = async (event) => {
            const { type, status, progress, error, data } = event.data;
            if (type === 'progress') {
                setWorkerStatus(status);
                setWorkerProgress(progress);
            } else if (type === 'done') {
                setWorkerStatus('done');
                setWorkerProgress(100);
                toast({ title: 'Analysis Complete', description: `Successfully processed ${data.processedCount} records.` });
                setLoading(p => ({...p, worker: false}));
                
                // Load the enriched columns for mapping
                const finalData = await loadEnrollmentDataFromCache();
                if (finalData && finalData.length > 0) {
                    setEnrichedColumns(Object.keys(finalData[0]));
                }

            } else if (type === 'error') {
                setWorkerStatus('error');
                setLoading(p => ({...p, worker: false}));
                toast({ title: 'Worker Error', description: error, variant: 'destructive'});
            }
        };
        return () => worker.terminate();
    }, [toast]);
    
     useEffect(() => {
        const autoSaveToCache = async () => {
            if (rawFileData.length > 0 && selectedProjectId && uniqueIdFileCol) {
                setLoading(p => ({ ...p, caching: true }));
                try {
                    const project = projects.find(p => p.projectId === selectedProjectId);
                    if (!project) throw new Error("Selected project not found.");
                    
                    const dataToCache = rawFileData.map(row => ({
                        ...row,
                        project_id: project.projectId,
                        project_name: project.projectName
                    }));
                    
                    await saveEnrollmentDataToCache(dataToCache);
                    toast({ title: "Data Ready", description: "File data has been automatically cached and is ready for analysis." });
                } catch (err: any) {
                    toast({ title: "Error Caching Data", description: err.message, variant: 'destructive' });
                } finally {
                    setLoading(p => ({ ...p, caching: false }));
                }
            }
        };
        autoSaveToCache();
    }, [rawFileData, selectedProjectId, uniqueIdFileCol, projects, toast]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setFile(e.target.files[0]);
        setSheets([]);
        setSelectedSheet('');
        setColumns([]);
        setRawFileData([]);
        setUniqueIdFileCol('');
      }
    };

    useEffect(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target!.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            setSheets(workbook.SheetNames);
            if (workbook.SheetNames.length > 0) {
                setSelectedSheet(workbook.SheetNames[0]);
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file]);

    useEffect(() => {
        if (!file || !selectedSheet) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[selectedSheet];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                setRawFileData(jsonData);
                setColumns(Object.keys(jsonData[0] || {}));
            } catch (err: any) {
                toast({ title: "Error reading sheet", description: err.message, variant: 'destructive'});
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file, selectedSheet, toast]);

    const handleRunAnalysis = () => {
        if (!workerRef.current) return;
        if (!uniqueIdFileCol) {
            toast({ title: "Unique ID Required", description: "Please select the unique ID column before running analysis.", variant: "destructive" });
            return;
        }
        setLoading(p => ({...p, worker: true}));
        setWorkerStatus('initializing');
        setWorkerProgress(0);
        workerRef.current.postMessage({ uniqueIdCol: uniqueIdFileCol });
    };

    // --- Mapping and Saving Logic ---
    const unmappedUiColumns = useMemo(() => {
        const sourceCols = enrichedColumns.length > 0 ? enrichedColumns : columns;
        const usedCols = new Set([...Array.from(dbColumnMapping.keys()), uniqueIdFileCol]);
        return sourceCols.filter(c => !usedCols.has(c));
    }, [columns, enrichedColumns, dbColumnMapping, uniqueIdFileCol]);

    const unmappedDbColumns = useMemo(() => {
        const usedDbCols = new Set([...dbColumnMapping.values(), uniqueIdDbCol]);
        return dbColumns.filter((c) => !usedDbCols.has(c));
    }, [dbColumns, dbColumnMapping, uniqueIdDbCol]);

     const handleAutoMatch = useCallback(async () => {
        const sourceColumns = enrichedColumns.length > 0 ? enrichedColumns : columns;
        const newMapping = new Map<string, string>();
        const usedDbCols = new Set<string>();

        sourceColumns.forEach((uiCol) => {
            const matchedDbCol = dbColumns.find(dbCol =>
                dbCol.toLowerCase().replace(/_/g, "") === uiCol.toLowerCase().replace(/_/g, "") &&
                !usedDbCols.has(dbCol)
            );
            if (matchedDbCol) {
                newMapping.set(uiCol, matchedDbCol);
                usedDbCols.add(matchedDbCol);
            }
        });
        setDbColumnMapping(newMapping);
        toast({ title: "Auto-match Complete", description: `Matched ${newMapping.size} columns.` });
    }, [dbColumns, columns, enrichedColumns, toast]);

    const handleAddDbMapping = () => {
        if (manualDbMapping.ui && manualDbMapping.db) {
            setDbColumnMapping(prev => new Map(prev).set(manualDbMapping.ui, manualDbMapping.db));
            setManualDbMapping({ ui: '', db: '' });
        }
    };

    const handleDeleteDbMapping = (key: string) => {
        setDbColumnMapping(prev => { const n = new Map(prev); n.delete(key); return n; });
    };

    const executeSave = useCallback(async (mode: "skip" | "replace") => {
        setDuplicateInfo(d => ({ ...d, isOpen: false }));
        setLoading(p => ({ ...p, saving: true }));
        setWorkerStatus("saving");
        let totalSaved = 0, totalSkipped = 0, totalUpdated = 0;
        try {
            const cachedRecords = await loadEnrollmentDataFromCache();
            if (!cachedRecords) throw new Error("No cached data to save.");
            
            const totalToProcess = cachedRecords.length;
            const CHUNK_SIZE = 500;
            
            for (let i = 0; i < totalToProcess; i += CHUNK_SIZE) {
                const chunk = cachedRecords.slice(i, i + CHUNK_SIZE);
                const payloadRecords = chunk.map(record => {
                    const newRecord: Record<string, any> = { project_id: selectedProjectId };
                    for (const [uiCol, dbCol] of dbColumnMapping.entries()) {
                         if (record.hasOwnProperty(uiCol)) newRecord[dbCol] = record[uiCol];
                    }
                    if (uniqueIdDbCol && record.hasOwnProperty(uniqueIdFileCol)) {
                        newRecord[uniqueIdDbCol] = record[uniqueIdFileCol];
                    }
                    return newRecord;
                });
                
                const res = await fetch('/api/enrollment-review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: "save", projectId: selectedProjectId, records: payloadRecords, mode, uniqueIdCol: uniqueIdDbCol })
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.details || 'Failed to save a chunk of data.');
                
                totalSaved += result.saved || 0;
                totalSkipped += result.skipped || 0;
                totalUpdated += result.updated || 0;
                
                setSaveStats({ saved: totalSaved, skipped: totalSkipped, updated: totalUpdated, total: totalToProcess });
                setWorkerProgress(Math.round(((i + chunk.length) / totalToProcess) * 100));
            }
             toast({ title: "Save Complete", description: `Saved: ${totalSaved}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}` });
             setWorkerStatus('done');
        } catch (err: any) {
            toast({ title: "Save Error", description: err.message, variant: 'destructive'});
            setWorkerStatus('error');
        } finally {
             setLoading(p => ({ ...p, saving: false }));
        }
    }, [selectedProjectId, dbColumnMapping, uniqueIdDbCol, uniqueIdFileCol, toast]);


    const handleSaveToDatabase = useCallback(async () => {
        if (!uniqueIdDbCol) {
            toast({ title: "Incomplete Mapping", description: "Please map the unique ID column for the database.", variant: "destructive" });
            return;
        }
        
        setLoading(p => ({ ...p, saving: true }));
        setWorkerStatus('checking_duplicates');
        try {
            const cachedRecords = await loadEnrollmentDataFromCache();
            if (!cachedRecords) throw new Error("No cached data to check.");
            
            const uniqueIds = cachedRecords.map(r => r[uniqueIdFileCol]).filter(Boolean);
            const res = await fetch('/api/enrollment-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check_duplicates', projectId: selectedProjectId, uniqueIdCol: uniqueIdDbCol, uniqueIds })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.details || 'Failed to check for duplicates.');

            if (result.count > 0) {
                setDuplicateInfo({ isOpen: true, count: result.count, totalInFile: cachedRecords.length, records: cachedRecords });
            } else {
                await executeSave('skip');
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: 'destructive'});
        } finally {
            setLoading(p => ({ ...p, saving: false }));
            setWorkerStatus('idle');
        }
    }, [uniqueIdDbCol, uniqueIdFileCol, selectedProjectId, toast, executeSave]);


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Enrollment Review: Upload & Process</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/enrollment/review">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Review Hub
                    </Link>
                </Button>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>1. Upload & Configure Data</CardTitle>
                    <CardDescription>Select your project, upload the enrollment file, and choose the unique identifier column. The data will be cached automatically.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                             <Label>Select Project</Label>
                              <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects || loading.caching}>
                                <SelectTrigger><SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} /></SelectTrigger>
                                <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                            </Select>
                         </div>
                          <div className="space-y-2">
                             <Label>Upload File</Label>
                             <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" disabled={loading.caching}/>
                         </div>
                         {sheets.length > 0 && (
                            <div className="space-y-2">
                                <Label>Select Sheet</Label>
                                <Select value={selectedSheet} onValueChange={setSelectedSheet}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{sheets.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                            </div>
                         )}
                         {file && selectedSheet && (
                             <div className="space-y-2">
                                <Label>Select Unique ID Column</Label>
                                <Select value={uniqueIdFileCol} onValueChange={setUniqueIdFileCol}>
                                    <SelectTrigger><SelectValue placeholder="Select unique ID..."/></SelectTrigger>
                                    <SelectContent>{columns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                         )}
                     </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>2. Run Analysis</CardTitle>
                    <CardDescription>Once data is cached, run the background worker to perform normalization and advanced difference analysis.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleRunAnalysis} disabled={loading.worker || loading.caching || rawFileData.length === 0}>
                        {loading.worker ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                        {workerStatus === 'done' ? 'Analysis Complete' : (loading.worker ? 'Analyzing...' : 'Run Analysis')}
                    </Button>
                     {loading.worker && (
                        <div className="mt-4 space-y-2">
                            <Progress value={workerProgress}/>
                            <p className="text-sm text-center text-muted-foreground">{workerStatus} ({workerProgress}%)</p>
                        </div>
                    )}
                </CardContent>
            </Card>

             <Card>
                 <CardHeader>
                     <CardTitle>3. Map and Save to Final Database</CardTitle>
                     <CardDescription>Map the processed columns from the cache to the final `enrollment-review.db` and save.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                     <div className="flex justify-end"><Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4"/>Auto-match</Button></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                        <div className="space-y-2">
                          <Label className="font-semibold">Unique ID (from Cache/File)</Label>
                          <Select value={uniqueIdFileCol} onValueChange={setUniqueIdFileCol}>
                            <SelectTrigger><SelectValue placeholder="Select file column..." /></SelectTrigger>
                            <SelectContent>{columns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-semibold">Unique ID (in Database)</Label>
                          <Select value={uniqueIdDbCol} onValueChange={setUniqueIdDbCol} disabled={loading.dbSchema}>
                            <SelectTrigger><SelectValue placeholder={loading.dbSchema ? "Loading schema..." : "Select DB column..."} /></SelectTrigger>
                            <SelectContent>{dbColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                          <Label>Other Columns (from Cache/File)</Label>
                           <Select value={manualDbMapping.ui} onValueChange={v => setManualDbMapping(m => ({ ...m, ui: v }))}><SelectTrigger><SelectValue placeholder="Select source..."/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedUiColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select>
                        </div>
                         <div className="space-y-2">
                          <Label>Other Columns (in Database)</Label>
                          <Select value={manualDbMapping.db} onValueChange={v => setManualDbMapping(m => ({ ...m, db: v }))} disabled={loading.dbSchema}>
                            <SelectTrigger><SelectValue placeholder={loading.dbSchema ? "Loading..." : "Select destination..."}/></SelectTrigger>
                            <SelectContent><ScrollArea className="h-60">{unmappedDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleAddDbMapping}>Add Mapping</Button>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Current Mappings</h4>
                        <ScrollArea className="h-40 border rounded-md">
                            <Table><TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>Database Field</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                            <TableBody>
                              <TableRow className="bg-blue-50 dark:bg-blue-900/20"><TableCell>{uniqueIdFileCol}</TableCell><TableCell>{uniqueIdDbCol}</TableCell><TableCell></TableCell></TableRow>
                              {Array.from(dbColumnMapping.entries()).map(([ui, db]) => <TableRow key={ui}><TableCell>{ui}</TableCell><TableCell>{db}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={()=>handleDeleteDbMapping(ui)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}
                            </TableBody></Table>
                        </ScrollArea>
                      </div>
                    <div className="flex flex-col items-center gap-4">
                      <Button onClick={handleSaveToDatabase} disabled={loading.saving || !uniqueIdFileCol || !uniqueIdDbCol || !selectedProjectId} size="lg">
                          {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                          Save to Database
                      </Button>
                      {loading.saving && (
                          <div className="w-full max-w-md text-center">
                              <Progress value={workerProgress} />
                              <p className="text-sm mt-1 text-muted-foreground">{workerStatus} ({workerProgress}%)</p>
                              <p className="text-xs mt-1">{saveStats.saved} saved, {saveStats.updated} updated, {saveStats.skipped} skipped of {saveStats.total}</p>
                          </div>
                      )}
                    </div>
                 </CardContent>
            </Card>
            
            <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo(prev => ({ ...prev, isOpen }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                        <AlertDialogDescription>
                            Found {duplicateInfo.count} records in your file that already exist in the database based on the selected Unique ID.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="outline" onClick={() => executeSave("skip")}>Skip Duplicates</Button>
                        <AlertDialogAction onClick={() => executeSave("replace")}>Replace Existing</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


             <div className="flex justify-end gap-2">
                <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review/recommendation">Go to Recommendation</Link></Button>
                <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review/dashboard">Go to Dashboard</Link></Button>
                <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review/download">Go to Download</Link></Button>
             </div>
        </div>
    );
}
