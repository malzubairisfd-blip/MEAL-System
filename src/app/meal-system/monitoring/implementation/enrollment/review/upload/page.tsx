// src/app/meal-system/monitoring/implementation/enrollment/review/upload/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { openDB } from 'idb';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Upload, GitCompareArrows, Trash2, Plus, FileDown, Database, Save, Check, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

const ENROLLMENT_CACHE_DB_NAME = 'enrollment-review-cache-db';
const ENROLLMENT_CACHE_STORE_NAME = 'files';
const ENROLLMENT_CACHE_KEY = 'enrollmentData';

interface Project {
  projectId: string;
  projectName: string;
}

const LOCAL_STORAGE_MAPPING_PREFIX = "enrollment-review-mapping-v2-";

export default function EnrollmentReviewUploadPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [columns, setColumns] = useState<string[]>([]);
    const [uniqueIdFileCol, setUniqueIdFileCol] = useState('');
    
    const [loading, setLoading] = useState({ projects: true, caching: false, worker: false, saving: false });
    const [workerStatus, setWorkerStatus] = useState('idle');
    const [workerProgress, setWorkerProgress] = useState(0);

    const workerRef = useRef<Worker | null>(null);

    // Initialization
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects');
                if (res.ok) setProjects(await res.json());
            } catch (err: any) {
                toast({ title: 'Error loading projects', description: err.message, variant: 'destructive'});
            } finally {
                setLoading(p => ({...p, projects: false}));
            }
        };
        fetchProjects();

        const worker = new Worker(new URL('@/workers/enrollment-review.worker.ts', import.meta.url));
        workerRef.current = worker;
        worker.onmessage = (event) => {
            const { type, status, progress, error, data } = event.data;
            if (type === 'progress') {
                setWorkerStatus(status);
                setWorkerProgress(progress);
            } else if (type === 'done') {
                setWorkerStatus('done');
                setWorkerProgress(100);
                toast({ title: 'Analysis Complete', description: 'Data has been processed and results are cached.' });
            } else if (type === 'error') {
                setWorkerStatus('error');
                setLoading(p => ({...p, worker: false}));
                toast({ title: 'Worker Error', description: error, variant: 'destructive'});
            }
        };
        return () => worker.terminate();
    }, [toast]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setFile(e.target.files[0]);
        setSheets([]);
        setSelectedSheet('');
        setColumns([]);
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

    const handleSaveToCache = useCallback(async () => {
        if (!file || !selectedSheet || !selectedProjectId || !uniqueIdFileCol) {
            toast({ title: "Missing Information", description: "Please select a project, upload a file, choose a sheet, and select a unique ID column.", variant: "destructive" });
            return;
        }
        setLoading(p => ({ ...p, caching: true }));
        try {
            const project = projects.find(p => p.projectId === selectedProjectId);
            if (!project) throw new Error("Selected project not found.");
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[selectedSheet];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const dataToCache = jsonData.map(row => ({
                    ...row,
                    project_id: project.projectId,
                    project_name: project.projectName
                }));

                const db = await openDB(ENROLLMENT_CACHE_DB_NAME, 1, {
                    upgrade(db) {
                        if (!db.objectStoreNames.contains(ENROLLMENT_CACHE_STORE_NAME)) {
                            db.createObjectStore(ENROLLMENT_CACHE_STORE_NAME);
                        }
                    },
                });
                await db.put(ENROLLMENT_CACHE_STORE_NAME, dataToCache, ENROLLMENT_CACHE_KEY);
                toast({ title: "Data Saved to Cache", description: "Your file has been saved to the local browser cache and is ready for analysis." });
                setColumns(Object.keys(jsonData[0] || {}));
            };
            reader.readAsArrayBuffer(file);
        } catch (err: any) {
            toast({ title: "Error Caching Data", description: err.message, variant: 'destructive' });
        } finally {
            setLoading(p => ({ ...p, caching: false }));
        }
    }, [file, selectedSheet, selectedProjectId, uniqueIdFileCol, toast, projects]);

    const handleRunAnalysis = () => {
        if (!workerRef.current) return;
        setLoading(p => ({...p, worker: true}));
        setWorkerStatus('initializing');
        setWorkerProgress(0);
        workerRef.current.postMessage({ uniqueIdCol: uniqueIdFileCol });
    };

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
                    <CardTitle>1. Upload & Cache Data</CardTitle>
                    <CardDescription>Select your project and upload the enrollment file. This will save the data to your browser's local storage for processing.</CardDescription>
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
                                    <SelectContent>{Object.keys(rawFileData[0] || {}).map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                         )}
                     </div>
                     <Button onClick={handleSaveToCache} disabled={!file || !selectedSheet || !selectedProjectId || !uniqueIdFileCol || loading.caching}>
                         {loading.caching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                         Save to Cache
                     </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>2. Run Analysis</CardTitle>
                    <CardDescription>Once data is cached, run the background worker to perform normalization and advanced difference analysis.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleRunAnalysis} disabled={loading.worker || columns.length === 0}>
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

            {/* The rest of the UI will be added in subsequent steps */}
             <Card>
                 <CardHeader>
                     <CardTitle>3. Map and Save to Final Database</CardTitle>
                     <CardDescription>Map the processed columns from the cache to the final `enrollment-review.db` and save.</CardDescription>
                 </CardHeader>
                 <CardContent>
                     <p className="text-muted-foreground text-center p-8">Mapping and saving UI will be implemented here.</p>
                 </CardContent>
            </Card>

             <div className="flex justify-end gap-2">
                <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review/recommendation">Go to Recommendation</Link></Button>
                <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review/dashboard">Go to Dashboard</Link></Button>
                <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review/download">Go to Download</Link></Button>
             </div>
        </div>
    );
}
