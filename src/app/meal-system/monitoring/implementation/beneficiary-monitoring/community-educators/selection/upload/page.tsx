// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection/upload/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Users, UserCheck, UserX, Save, FileDown, GitCompareArrows, Database, ClipboardList } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface Project {
  projectId: string;
  projectName: string;
}

const DB_COLUMNS = [
  's', 'office_no', 'project_id', 'project_name', 'applicant_id', 'ed_id',
  'applicant_name', 'applicant_familyname', 'applicant_husbandname',
  'phone_no1', 'phone_no2', 'phone_no',
  'gov_loc_id', 'mud_loc_id', 'ozla_loc_id', 'loc_id',
  'gov_name', 'mud_name', 'ozla_name', 'loc_name', 'mahla_name', 'zoon_no',
  'social_status', 'birth_date', 'age_years', 'age_days', 'age_rank',
  'id_type', 'id_no', 'id_issue_date', 'id_issue_location',
  'applicant_qualification', 'qualification_major', 'graduation_date',
  'diploma_starting_date', 'diploma_end_date', 'diploma_duration_years', 'diploma_duration_days', 'institution_name',
  'duplicated_cluster_id', 'duplicated_applicants',
  'age_per_village_ranking',
  'qualification_score', 'id_score', 'previous_experience_score', 'total_score',
  'applcants_relationship', 'interview_hall_no', 'interview_hall_name',
  'acceptance_results', 'disqualification_reason',
  'interview_qualification', 'interview_attendance',
  'sfd_marks', 'health_marks', 'local_community_marks', 'interview_total_marks', 'grand_total_score', 'grand_score_rank',
  'training_qualification', 'training_hall_no', 'training_hall_name', 'training_attendance',
  'is_active', 'contract_type', 'working_village', 'contract_starting_date', 'contract_end_date', 'contract_duration_months', 'is_spare',
  'disqualified_reasons', 'is_registered_in_assessment', 'if_no_reason',
  'bnf_full_name', 'bnf_age', 'bnf_id_type', 'bnf_id_no', 'bnf_ozla_name', 'bnf_vill_name', 'qual_status', 'bnf_husband', 'male_cnt', 'female_cnt', 'child_names', 'bnf_id',
  'notes',
  'ec_id', 'ec_name', 'ec_name2', 'ec_loc_id', 'ec_loc_name',
  'pc_id', 'pc_name',
  'row_no',
  'same_ozla', 'x', 'ed_bnf_cnt', 'pc_ed_cnt', 'ec_ed_cnt', 'pc_bnf_cnt', 'ec_bnf_cnt'
];


const REQUIRED_MAPPING_FIELDS = ["applicant_id"];
const LOCAL_STORAGE_MAPPING_PREFIX = "educator-mapping-";


const SummaryCard = ({ icon, title, value }: { icon: React.ReactNode, title: string, value: string | number }) => (
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

export default function EducatorUploadPage() {
    const { toast } = useToast();
    const router = useRouter();

    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [columns, setColumns] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
    const [manualMapping, setManualMapping] = useState({ ui: '', db: '' });
    const [locations, setLocations] = useState<any[]>([]);
    
    const [recipientsDate, setRecipientsDate] = useState({ day: '', month: '', year: '' });
    
    const [workerStatus, setWorkerStatus] = useState('idle');
    const [progressInfo, setProgressInfo] = useState({ status: "idle", progress: 0 });
    const [results, setResults] = useState<any | null>(null);

    const [duplicateDialog, setDuplicateDialog] = useState({ isOpen: false, duplicates: [], nonDuplicates: [] });
    const [saveStats, setSaveStats] = useState({ saved: 0, skipped: 0, total: 0 });

    const rawRowsRef = useRef<any[]>([]);
    const workerRef = useRef<Worker | null>(null);

    const unmappedUiColumns = useMemo(() => columns.filter(col => !Array.from(columnMapping.keys()).includes(col)), [columns, columnMapping]);
    const unmappedDbColumns = useMemo(() => {
        const mappedDbCols = new Set(columnMapping.values());
        return DB_COLUMNS.filter(col => !mappedDbCols.has(col));
    }, [columnMapping]);

    const isMappingComplete = useMemo(() => {
        const mappedDbCols = new Set(columnMapping.values());
        return REQUIRED_MAPPING_FIELDS.every(field => mappedDbCols.has(field));
    }, [columnMapping]);

    // Save mapping to localStorage whenever it changes
    useEffect(() => {
        if (columns.length > 0 && columnMapping.size > 0) {
            const storageKey = `${LOCAL_STORAGE_MAPPING_PREFIX}${columns.join(',')}`;
            localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(columnMapping)));
        }
    }, [columnMapping, columns]);

    const executeSave = useCallback(async (recordsToSave: any[], isOverwrite: boolean, project: Project) => {
        setWorkerStatus('saving');
        setProgressInfo({ status: 'saving', progress: 0 });
        const CHUNK_SIZE = 100;
        const totalToSave = recordsToSave.length;
        const totalInFile = rawRowsRef.current.length;

        try {
            for (let i = 0; i < totalToSave; i += CHUNK_SIZE) {
                const chunk = recordsToSave.slice(i, i + CHUNK_SIZE);
                
                const isFirstChunk = i === 0;
                const url = isFirstChunk && isOverwrite ? '/api/ed-selection?init=true' : '/api/ed-selection';

                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectName: project.projectName, results: chunk })
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "A server error occurred while saving.");
                }
                const progress = Math.round(((i + chunk.length) / totalToSave) * 100);
                setProgressInfo({ status: 'saving', progress });
            }

            toast({ title: "Save Successful", description: `${totalToSave} educator records saved for ${project.projectName}.` });
            setSaveStats({ saved: totalToSave, skipped: totalInFile - totalToSave, total: totalInFile });
            setWorkerStatus('done');

        } catch (error: any) {
            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
            setWorkerStatus('error');
        }
    }, [toast]);

    const handleSaveToDatabase = useCallback(async (processedRecords: any[], projectIdForSave: string) => {
        setProgressInfo({ status: "validating", progress: 0 });
        try {
            const existingRes = await fetch('/api/ed-selection');
            if (!existingRes.ok) throw new Error("Could not fetch existing records from database.");
            const existingRecords = await existingRes.json();
            
            const applicantIdColumn = 'applicant_id';
            const existingApplicantIds = new Set(existingRecords.map((r: any) => String(r[applicantIdColumn])));
            
            const duplicates: any[] = [];
            const nonDuplicates: any[] = [];

            processedRecords.forEach((row: any) => {
                const newId = row[applicantIdColumn];
                if (newId && existingApplicantIds.has(String(newId))) {
                    duplicates.push(row);
                } else {
                    nonDuplicates.push(row);
                }
            });

            const project = projects.find(p => p.projectId === projectIdForSave);
            if (!project) throw new Error("Selected project not found.");

            if (duplicates.length > 0) {
                setDuplicateDialog({ isOpen: true, duplicates, nonDuplicates });
            } else {
                await executeSave(processedRecords, false, project);
            }

        } catch (error: any) {
            toast({ title: "Validation Failed", description: error.message, variant: "destructive" });
             setWorkerStatus('error');
        }
    }, [projects, toast, executeSave]);


    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [projRes, locRes] = await Promise.all([
                    fetch('/api/projects'),
                    fetch('/api/locations')
                ]);
                if (projRes.ok) {
                    const data = await projRes.json();
                    setProjects(Array.isArray(data) ? data : []);
                }
                if (locRes.ok) {
                    setLocations(await locRes.json());
                }
            } catch (error) {
                toast({ title: "Error", description: "Could not load initial data.", variant: "destructive" });
            }
        };
        fetchInitialData();
    }, [toast]);

    useEffect(() => {
        const worker = new Worker(new URL('@/workers/ed-selection.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        
        const handleMessage = (event: MessageEvent) => {
            const { type, status, progress, data, error } = event.data;
            if (type === 'progress') {
                setWorkerStatus(status);
                setProgressInfo({ status, progress });
            } else if (type === 'done') {
                setResults(data);
                setWorkerStatus('processed');
                setProgressInfo({ status: 'processed', progress: 100 });
                toast({ title: "Processing Complete!", description: `Processed ${data.totalApplicants} applicants. Ready to save.` });
                handleSaveToDatabase(data.results, data.selectedProjectId);
            } else if (type === 'error') {
                setWorkerStatus('error');
                setProgressInfo({ status: 'error', progress: 0 });
                toast({ title: "Processing Error", description: error, variant: "destructive" });
            }
        };

        worker.onmessage = handleMessage;

        return () => {
          if (workerRef.current) {
            workerRef.current.terminate();
          }
        };

    }, [toast, handleSaveToDatabase]);
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setSheets([]);
        setSelectedSheet('');
        setColumns([]);
        rawRowsRef.current = [];
        setResults(null);
        setWorkerStatus('idle');
    };

    useEffect(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const buffer = e.target?.result;
            const wb = XLSX.read(buffer, { type: 'array' });
            setSheets(wb.SheetNames);
            if (wb.SheetNames.length > 0) {
              setSelectedSheet(wb.SheetNames[0]);
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file]);

    useEffect(() => {
        if (!file || !selectedSheet) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const buffer = e.target?.result;
            const wb = XLSX.read(buffer, { type: 'array' });
            const sheet = wb.Sheets[selectedSheet];
            const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
            
            rawRowsRef.current = json;
            const detectedColumns = Object.keys(json[0] || {});
            setColumns(detectedColumns);

            // Load saved mapping from local storage
            const storageKey = `${LOCAL_STORAGE_MAPPING_PREFIX}${detectedColumns.join(',')}`;
            const savedMapping = localStorage.getItem(storageKey);
            if(savedMapping) {
                try {
                    const parsed = JSON.parse(savedMapping);
                    setColumnMapping(new Map(Object.entries(parsed)));
                    toast({ title: "Mapping Loaded", description: "Restored your column mappings for this file structure." });
                } catch {
                    // Parsing failed, start fresh
                    setColumnMapping(new Map());
                }
            } else {
                setColumnMapping(new Map());
            }

        };
        reader.readAsArrayBuffer(file);
    }, [file, selectedSheet, toast]);

    const handleAutoMatch = () => {
      const newMapping = new Map<string, string>();
      const usedDbCols = new Set<string>();

      columns.forEach(uiCol => {
          const matchedDbCol = DB_COLUMNS.find(dbCol => dbCol.toLowerCase() === uiCol.toLowerCase() && !usedDbCols.has(dbCol));
          if(matchedDbCol) {
              newMapping.set(uiCol, matchedDbCol);
              usedDbCols.add(matchedDbCol);
          }
      });
      setColumnMapping(newMapping);
      toast({ title: "Auto-match Complete", description: `${newMapping.size} columns were matched automatically.`});
    };

    const handleAddManualMapping = () => {
      if (!manualMapping.ui || !manualMapping.db) {
          toast({ title: "Incomplete Selection", description: "Please select both a source and a destination column.", variant: "destructive" });
          return;
      }
      const newMapping = new Map(columnMapping);
      newMapping.set(manualMapping.ui, manualMapping.db);
      setColumnMapping(newMapping);
      setManualMapping({ ui: '', db: '' });
    };

    const startProcessing = () => {
        if (!workerRef.current || !isMappingComplete || !recipientsDate.year || !recipientsDate.month || !recipientsDate.day || !selectedProjectId) {
            toast({ title: "Incomplete Information", description: "Please select a project, provide a full recipients date, and complete all required mappings (especially Applicant ID).", variant: "destructive" });
            return;
        }

        setWorkerStatus('processing');
        setProgressInfo({ status: 'processing', progress: 1 });
        setResults(null);
        setSaveStats({ saved: 0, skipped: 0, total: 0 });
        
        const mappedData = rawRowsRef.current.map(row => {
          const newRow: any = {};
          for (const [uiCol, dbCol] of columnMapping.entries()) {
            newRow[dbCol] = row[uiCol];
          }
          return newRow;
        });

        workerRef.current.postMessage({
            rows: mappedData,
            recipientsDate: `${recipientsDate.year}-${recipientsDate.month}-${recipientsDate.day}`,
            projects: projects,
            locations: locations,
            selectedProjectId: selectedProjectId,
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Community Educators Selection</CardTitle>
                    <CardDescription>Upload applicant data to score, rank, and select community educators based on predefined criteria.</CardDescription>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader><CardTitle>1. Select Project & Upload Data</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                     <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                            <Label>Project</Label>
                            <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                                <SelectTrigger><SelectValue placeholder="Select a project..." /></SelectTrigger>
                                <SelectContent>{projects.map(p => (<SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                         <div className='space-y-2'>
                           <Label>Recipients Date</Label>
                           <div className="grid grid-cols-3 gap-2">
                                <Select value={recipientsDate.day} onValueChange={(v) => setRecipientsDate(d => ({ ...d, day: v }))}><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger><SelectContent>{Array.from({length: 31}, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d).padStart(2,'0')}>{d}</SelectItem>)}</SelectContent></Select>
                                <Select value={recipientsDate.month} onValueChange={(v) => setRecipientsDate(d => ({ ...d, month: v }))}><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{Array.from({length: 12}, (_, i) => i + 1).map(m => <SelectItem key={m} value={String(m).padStart(2,'0')}>{m}</SelectItem>)}</SelectContent></Select>
                                <Select value={recipientsDate.year} onValueChange={(v) => setRecipientsDate(d => ({ ...d, year: v }))}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{Array.from({length: 10}, (_, i) => new Date().getFullYear() - 5 + i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                           </div>
                        </div>
                    </div>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                       <div className='space-y-2'>
                           <Label>Upload File</Label>
                           <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />
                       </div>
                        {sheets.length > 0 && (
                            <div className='space-y-2'>
                                <Label>Select Sheet</Label>
                                <Select value={selectedSheet} onValueChange={setSelectedSheet}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {columns.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>2. Map Columns</CardTitle>
                        <CardDescription>Match source columns from your sheet to the destination columns in the database. `applicant_id` is required.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4" />Auto-match Columns</Button>
                        
                        {unmappedUiColumns.length > 0 && (
                            <Card className="p-4 bg-muted">
                                <CardTitle className="text-md mb-2">Manual Mapping</CardTitle>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="space-y-2">
                                        <Label>Remaining Source Column</Label>
                                        <Select value={manualMapping.ui} onValueChange={v => setManualMapping(m => ({ ...m, ui: v}))}>
                                            <SelectTrigger><SelectValue placeholder="Select Source..." /></SelectTrigger>
                                            <SelectContent><ScrollArea className="h-60">{unmappedUiColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                                        </Select>
                                    </div>
                                     <div className="space-y-2">
                                        <Label>Destination DB Column</Label>
                                        <Select value={manualMapping.db} onValueChange={v => setManualMapping(m => ({ ...m, db: v}))}>
                                            <SelectTrigger><SelectValue placeholder="Select Destination..." /></SelectTrigger>
                                            <SelectContent><ScrollArea className="h-60">{unmappedDbColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleAddManualMapping}>Add Mapping</Button>
                                </div>
                            </Card>
                        )}
                        <Card>
                            <CardHeader><CardTitle className="text-md">Current Mappings</CardTitle></CardHeader>
                            <CardContent>
                                <ScrollArea className="h-40 border rounded-md">
                                    <Table>
                                       <TableHeader>
                                           <TableRow>
                                               <TableHead>Source Column (from your file)</TableHead>
                                               <TableHead>Destination Column (in database)</TableHead>
                                           </TableRow>
                                       </TableHeader>
                                       <TableBody>
                                           {Array.from(columnMapping.entries()).map(([uiCol, dbCol]) => (
                                               <TableRow key={uiCol}>
                                                   <TableCell>{uiCol}</TableCell>
                                                   <TableCell className="font-medium">{dbCol}</TableCell>
                                               </TableRow>
                                           ))}
                                       </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </CardContent>
                </Card>
            )}
            
            <Card>
                <CardHeader><CardTitle>3. Run Selection & Save</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className='flex gap-2'>
                        <Button onClick={startProcessing} disabled={!isMappingComplete || workerStatus === 'processing' || workerStatus === 'saving'}>
                            {workerStatus === 'processing' || workerStatus === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            {workerStatus === 'processing' ? 'Processing...' : workerStatus === 'saving' ? 'Saving...' : 'Process & Save Educators'}
                        </Button>
                         <Button asChild variant="outline">
                            <a href="/api/ed-selection/download">
                                <FileDown className="mr-2 h-4 w-4" />
                                Download educators.db
                            </a>
                        </Button>
                    </div>
                    {workerStatus === 'processing' || workerStatus === 'saving' && <Progress value={progressInfo.progress} />}
                </CardContent>
            </Card>

             {results && (
                <Card>
                    <CardHeader>
                        <CardTitle>Processing Results</CardTitle>
                        <CardDescription>
                            The selection process is complete. Review the summary below and proceed to the next steps.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <SummaryCard icon={<Users />} title="Total Applicants Processed" value={results.totalApplicants} />
                            <SummaryCard icon={<UserCheck className="text-green-500"/>} title="Accepted Applicants" value={results.totalAccepted} />
                            <SummaryCard icon={<UserX className="text-red-500"/>} title="Unaccepted Applicants" value={results.totalUnaccepted} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild>
                                <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection/database">
                                    <Database className="mr-2 h-4 w-4" />
                                    Go to Educator Database
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-statements">
                                    <ClipboardList className="mr-2 h-4 w-4" />
                                    Go to Exporting Interview Statements
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {saveStats.total > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Save Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-4">
                        <SummaryCard icon={<Users />} title="Total Records in File" value={saveStats.total} />
                        <SummaryCard icon={<UserCheck className="text-green-500"/>} title="Records Saved" value={saveStats.saved} />
                        <SummaryCard icon={<UserX className="text-orange-500"/>} title="Records Skipped" value={saveStats.skipped} />
                    </CardContent>
                </Card>
            )}
             <AlertDialog open={duplicateDialog.isOpen} onOpenChange={(isOpen) => setDuplicateDialog(prev => ({...prev, isOpen}))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                        <AlertDialogDescription>
                            Found {duplicateDialog.duplicates.length} applicant(s) in your upload that already exist in the database based on Applicant ID. How would you like to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setWorkerStatus('processed')}>Cancel</AlertDialogCancel>
                        <Button variant="outline" onClick={async () => {
                            setDuplicateDialog(prev => ({...prev, isOpen: false}));
                            const project = projects.find(p => p.projectId === selectedProjectId);
                            if (project) await executeSave(duplicateDialog.nonDuplicates, false, project);
                        }}>
                            Skip Duplicates
                        </Button>
                        <AlertDialogAction onClick={async () => {
                            setDuplicateDialog(prev => ({...prev, isOpen: false}));
                            const project = projects.find(p => p.projectId === selectedProjectId);
                            if (project) await executeSave([...duplicateDialog.nonDuplicates, ...duplicateDialog.duplicates], true, project);
                        }}>
                            Replace Existing
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
