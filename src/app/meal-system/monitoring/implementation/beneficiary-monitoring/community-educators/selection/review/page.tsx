// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection/review/page.tsx
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
import { Loader2, Upload, Users, UserCheck, UserX, Save, FileDown, GitCompareArrows, Search, Plus, Trash2, CheckCircle, XCircle, ClipboardList, Database } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from '@/components/ui/progress';
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

const LOCAL_STORAGE_MAPPING_PREFIX = "interview-mapping-";

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

export default function InterviewAnalysisPage() {
    const { toast } = useToast();
    const router = useRouter();

    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [columns, setColumns] = useState<string[]>([]);
    const [rawFileData, setRawFileData] = useState<any[]>([]);

    const [educators, setEducators] = useState<any[]>([]);
    const [eligibleApplicants, setEligibleApplicants] = useState<any[]>([]);
    const [selectedAbsentees, setSelectedAbsentees] = useState<Set<number>>(new Set());
    const [absenteeSearch, setAbsenteeSearch] = useState('');

    const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
    
    const [loading, setLoading] = useState({ projects: true, educators: false, processing: false, saving: false });
    const [workerStatus, setWorkerStatus] = useState('idle');
    
    const [results, setResults] = useState<any | null>(null);
    const [duplicateDialog, setDuplicateDialog] = useState({ isOpen: false, duplicates: [], nonDuplicates: [] });

    const workerRef = useRef<Worker | null>(null);

    // Fetch Projects
    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(p => ({ ...p, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(p => ({ ...p, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);
    
    // Fetch educators when project is selected
    useEffect(() => {
        if (!selectedProjectId) return;
        
        const fetchEducators = async () => {
            setLoading(p => ({ ...p, educators: true }));
            try {
                const res = await fetch('/api/ed-selection');
                if (!res.ok) throw new Error("Failed to fetch educators.");
                const allEducators = await res.json();
                const projectEducators = allEducators.filter((e: any) => e.project_id === selectedProjectId);
                setEducators(projectEducators);
                setEligibleApplicants(projectEducators.filter((e: any) => e.interview_qualification === 'مؤهلة للمقابلة'));
            } catch (error: any) {
                toast({ title: "Error", description: `Could not load educators: ${error.message}`, variant: "destructive" });
            } finally {
                setLoading(p => ({ ...p, educators: false }));
            }
        };

        fetchEducators();
    }, [selectedProjectId, toast]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setSheets([]);
            setSelectedSheet('');
            setColumns([]);
            setRawFileData([]);
            setResults(null);
            setWorkerStatus('idle');
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
        reader.onload = (e) => {
            const data = new Uint8Array(e.target!.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[selectedSheet];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            setRawFileData(jsonData);
            const fileColumns = Object.keys(jsonData[0] || {});
            setColumns(fileColumns);

            const storageKey = `${LOCAL_STORAGE_MAPPING_PREFIX}${fileColumns.join(',')}`;
            const savedMapping = localStorage.getItem(storageKey);
            if (savedMapping) {
                try {
                    setColumnMapping(new Map(Object.entries(JSON.parse(savedMapping))));
                    toast({ title: "Mapping Restored", description: "Loaded saved column mapping." });
                } catch { setColumnMapping(new Map()); }
            } else {
                 setColumnMapping(new Map());
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file, selectedSheet, toast]);
    
    useEffect(() => {
        if (columns.length > 0 && columnMapping.size > 0) {
            const storageKey = `${LOCAL_STORAGE_MAPPING_PREFIX}${columns.join(',')}`;
            localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(columnMapping)));
        }
    }, [columnMapping, columns]);

    const handleAbsenteeToggle = (applicantId: number) => {
        setSelectedAbsentees(prev => {
            const newSet = new Set(prev);
            if (newSet.has(applicantId)) {
                newSet.delete(applicantId);
            } else {
                newSet.add(applicantId);
            }
            return newSet;
        });
    };

    const filteredAbsentees = useMemo(() => {
        if (!absenteeSearch) return eligibleApplicants;
        const lowerCaseSearch = absenteeSearch.toLowerCase();
        return eligibleApplicants.filter(app => 
            String(app.applicant_id).includes(lowerCaseSearch) || 
            app.applicant_name?.toLowerCase().includes(lowerCaseSearch)
        );
    }, [absenteeSearch, eligibleApplicants]);

    const isMappingComplete = useMemo(() => {
        const mappedDbCols = new Set(columnMapping.values());
        return mappedDbCols.has("applicant_id");
    }, [columnMapping]);

    const executeSave = useCallback(async (recordsToSave: any[]) => {
        if (!selectedProjectId) {
            toast({ title: "Save Aborted", description: "Project ID was lost. Please re-select the project.", variant: "destructive" });
            return;
        }
        setLoading(p => ({ ...p, saving: true }));
        try {
            const res = await fetch('/api/ed-selection', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recordsToSave)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "A server error occurred while saving.");
            }
            toast({ title: "Save Successful", description: `${recordsToSave.length} educator records updated.` });
            setWorkerStatus('done');
        } catch (error: any) {
             toast({ title: "Save Failed", description: error.message, variant: "destructive" });
             setWorkerStatus('error');
        } finally {
            setLoading(p => ({ ...p, saving: false }));
        }
    }, [selectedProjectId, toast]);

    const handleSaveValidation = useCallback(async (processedResults: any) => {
        if (!processedResults || !processedResults.results) {
            toast({ title: "Processing Error", description: "Worker did not return valid results.", variant: "destructive" });
            setWorkerStatus('error');
            return;
        }

        const existingApplicantIds = new Set(educators.map(e => String(e.applicant_id)));
        const duplicates = processedResults.results.filter((res: any) => existingApplicantIds.has(String(res.applicant_id)));
        const nonDuplicates = processedResults.results.filter((res: any) => !existingApplicantIds.has(String(res.applicant_id)));

        if (duplicates.length > 0) {
            setDuplicateDialog({ isOpen: true, duplicates, nonDuplicates });
        } else {
            await executeSave(processedResults.results);
        }
    }, [educators, executeSave]);

    useEffect(() => {
        const worker = new Worker(new URL('@/workers/interview-analysis.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        
        const handleMessage = (event: MessageEvent) => {
            const { type, data, error } = event.data;
            setLoading(p => ({ ...p, processing: false }));

            if (type === 'done') {
                setResults(data);
                toast({ title: "Processing Complete!", description: `Analysis complete. Now validating and saving results...` });
                handleSaveValidation(data);
            } else if (type === 'error') {
                 toast({ title: "Processing Error", description: error, variant: "destructive" });
                 setWorkerStatus('error');
            }
        };

        worker.onmessage = handleMessage;

        return () => {
          if (workerRef.current) {
            workerRef.current.terminate();
          }
        };
    }, [handleSaveValidation, toast]);
    
    const handleProcess = useCallback(() => {
        if (!selectedProjectId || !file || rawFileData.length === 0 || !isMappingComplete) {
            toast({ title: "Incomplete Setup", description: "Please select a project, upload a file, and ensure applicant_id is mapped.", variant: "destructive" });
            return;
        }

        if (!workerRef.current) return;
        
        setLoading(p => ({...p, processing: true}));
        setWorkerStatus('processing');
        workerRef.current.postMessage({
            educators,
            uploadedData: rawFileData,
            mapping: Object.fromEntries(columnMapping),
            absentees: Array.from(selectedAbsentees),
        });
    }, [selectedProjectId, file, rawFileData, isMappingComplete, educators, columnMapping, selectedAbsentees, toast]);


    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Analyze Interview Results</CardTitle>
                    <CardDescription>Upload interview scores to calculate final rankings and identify relationships.</CardDescription>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>1. Project & Interview Data</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                                <SelectTrigger><SelectValue placeholder={loading.projects ? "Loading projects..." : "Select Project"} /></SelectTrigger>
                                <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                            </Select>
                             <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />
                             {sheets.length > 0 && (<Select value={selectedSheet} onValueChange={setSelectedSheet}><SelectTrigger><SelectValue placeholder="Select Sheet" /></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>)}
                        </CardContent>
                    </Card>

                    {eligibleApplicants.length > 0 && (
                         <Card>
                            <CardHeader>
                                <CardTitle>2. Mark Interview Absentees</CardTitle>
                                <CardDescription>Select all applicants who were absent from the interview.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input placeholder="Search absentees by ID or name..." value={absenteeSearch} onChange={e => setAbsenteeSearch(e.target.value)} className="mb-2" />
                               <ScrollArea className="h-64 border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow><TableHead className="w-[50px]"></TableHead><TableHead>Applicant ID</TableHead><TableHead>Applicant Name</TableHead></TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredAbsentees.map(app => (
                                                <TableRow key={app.applicant_id}>
                                                    <TableCell>
                                                        <Checkbox id={`absentee-${app.applicant_id}`} onCheckedChange={(checked) => handleAbsenteeToggle(app.applicant_id, checked)} checked={selectedAbsentees.has(app.applicant_id)} />
                                                    </TableCell>
                                                    <TableCell>{app.applicant_id}</TableCell>
                                                    <TableCell>{app.applicant_name}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                </div>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>3. Map Columns</CardTitle>
                            <CardDescription>Match columns from your file to the database. <span className="font-bold text-primary">Applicant ID is mandatory.</span></CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ColumnMappingUI columns={columns} setMapping={setColumnMapping} mapping={columnMapping} />
                        </CardContent>
                    </Card>
                </div>
            </div>

             <Card>
                <CardHeader><CardTitle>4. Process & Save</CardTitle></CardHeader>
                <CardContent className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Process the data to see results, then save to the database.</p>
                     <div className='flex gap-2'>
                        <Button onClick={handleProcess} disabled={!isMappingComplete || loading.processing || workerStatus === 'saving'}>
                            {(loading.processing || workerStatus === 'saving') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {workerStatus === 'processing' ? 'Processing...' : workerStatus === 'saving' ? 'Saving...' : 'Process & Save Results'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {results && (
                 <Card>
                    <CardHeader><CardTitle>Results Summary</CardTitle></CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <SummaryCard icon={<Users />} title="Total Attended" value={results.totalAttended} />
                            <SummaryCard icon={<UserX className="text-red-500" />} title="Total Absent" value={results.totalAbsent} />
                            <SummaryCard icon={<CheckCircle className="text-green-500" />} title="Passed Interview" value={results.totalPassed} />
                            <SummaryCard icon={<XCircle className="text-red-500" />} title="Failed Interview" value={results.totalFailed} />
                        </div>
                        <div className="flex gap-2 mt-4">
                           <Button asChild><Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection/database"><Database className="mr-2 h-4 w-4"/>Go to Database</Link></Button>
                           <Button asChild variant="outline"><Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/training"><ClipboardList className="mr-2 h-4 w-4"/>Go to Training Page</Link></Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <AlertDialog open={duplicateDialog.isOpen} onOpenChange={(isOpen) => setDuplicateDialog(prev => ({...prev, isOpen}))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Applicants Found</AlertDialogTitle>
                        <AlertDialogDescription>
                            Found {duplicateDialog.duplicates.length} applicant(s) in your uploaded file that already exist in the database. How would you like to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setLoading(p => ({...p, saving: false}))}>Cancel</AlertDialogCancel>
                        <Button variant="outline" onClick={async () => {
                            setDuplicateDialog({ isOpen: false, duplicates: [], nonDuplicates: [] });
                            await executeSave(duplicateDialog.nonDuplicates);
                        }}>
                            Skip Duplicates
                        </Button>
                        <AlertDialogAction onClick={async () => {
                            setDuplicateDialog({ isOpen: false, duplicates: [], nonDuplicates: [] });
                            await executeSave([...duplicateDialog.nonDuplicates, ...duplicateDialog.duplicates]);
                        }}>
                            Replace Existing
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
        </div>
    );
}

const ColumnMappingUI = ({ columns, mapping, setMapping }: { columns: string[], mapping: Map<string, string>, setMapping: (m: Map<string, string>) => void }) => {
    const [source, setSource] = useState('');
    const [dest, setDest] = useState('');

    const unmappedSource = useMemo(() => columns.filter(c => !Array.from(mapping.keys()).includes(c)), [columns, mapping]);
    const unmappedDest = useMemo(() => ['applicant_id', 'sfd_marks', 'health_marks', 'local_community_marks'].filter(c => !Array.from(mapping.values()).includes(c)), [mapping]);
    
    const addMapping = () => {
        if(source && dest) {
            const newMap = new Map(mapping);
            newMap.set(source, dest);
            setMapping(newMap);
            setSource('');
            setDest('');
        }
    };
    
    const removeMapping = (sourceKey: string) => {
        const newMap = new Map(mapping);
        newMap.delete(sourceKey);
        setMapping(newMap);
    };

    return (
        <div className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                    <Label>Source Column (from file)</Label>
                    <Select value={source} onValueChange={setSource}>
                        <SelectTrigger><SelectValue placeholder="Select Source..." /></SelectTrigger>
                        <SelectContent><ScrollArea className="h-60">{unmappedSource.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Destination Field</Label>
                    <Select value={dest} onValueChange={setDest}>
                        <SelectTrigger><SelectValue placeholder="Select Destination..." /></SelectTrigger>
                        <SelectContent><ScrollArea className="h-60">{unmappedDest.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                    </Select>
                </div>
                <Button onClick={addMapping} type="button">Add Mapping</Button>
            </div>
            
            <Card>
                <CardHeader><CardTitle className="text-md">Current Mappings</CardTitle></CardHeader>
                <CardContent>
                    <ScrollArea className="h-40 border rounded-md">
                         <Table>
                           <TableHeader>
                               <TableRow>
                                   <TableHead>Source Column</TableHead>
                                   <TableHead>Destination Field</TableHead>
                                   <TableHead className="text-right">Actions</TableHead>
                               </TableRow>
                           </TableHeader>
                           <TableBody>
                               {Array.from(mapping.entries()).map(([uiCol, dbCol]) => (
                                   <TableRow key={uiCol}>
                                       <TableCell>{uiCol}</TableCell>
                                       <TableCell className="font-medium">{dbCol}</TableCell>
                                       <TableCell className="text-right">
                                           <Button variant="ghost" size="icon" onClick={() => removeMapping(uiCol)}>
                                               <Trash2 className="h-4 w-4 text-destructive" />
                                           </Button>
                                       </TableCell>
                                   </TableRow>
                               ))}
                               {!mapping.size && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No mappings yet.</TableCell></TableRow>}
                           </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}
