
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
import { Loader2, Upload, Users, UserCheck, UserX, Save, FileDown, GitCompareArrows, Search, Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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

    const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
    
    const [loading, setLoading] = useState({ projects: true, educators: false });
    const [isProcessing, setIsProcessing] = useState(false);
    
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

            // Restore mapping from local storage
            const storageKey = `${LOCAL_STORAGE_MAPPING_PREFIX}${fileColumns.join(',')}`;
            const savedMapping = localStorage.getItem(storageKey);
            if (savedMapping) {
                try {
                    setColumnMapping(new Map(Object.entries(JSON.parse(savedMapping))));
                    toast({ title: "Mapping Restored", description: "Loaded saved column mapping." });
                } catch { /* ignore parsing errors */ }
            } else {
                 setColumnMapping(new Map());
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file, selectedSheet, toast]);
    
    // Save mapping to localStorage
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

    const isMappingComplete = useMemo(() => {
        const mappedDbCols = new Set(columnMapping.values());
        return mappedDbCols.has("applicant_id");
    }, [columnMapping]);

    const handleProcess = () => {
        if (!selectedProjectId || !file || rawFileData.length === 0 || !isMappingComplete) {
            toast({ title: "Incomplete Setup", description: "Please select a project, upload a file, and ensure applicant_id is mapped.", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        // This is where you would call the worker
        toast({ title: "Processing Started", description: "This feature is being implemented." });
        
        // Placeholder to end processing
        setTimeout(() => setIsProcessing(false), 2000);
    };

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
                        <CardHeader>
                            <CardTitle>1. Project & Interview Data</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                                <SelectTrigger><SelectValue placeholder={loading.projects ? "Loading projects..." : "Select Project"} /></SelectTrigger>
                                <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                            </Select>

                             <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />

                             {sheets.length > 0 && (
                                <Select value={selectedSheet} onValueChange={setSelectedSheet}><SelectTrigger><SelectValue placeholder="Select Sheet" /></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                            )}
                        </CardContent>
                    </Card>

                    {eligibleApplicants.length > 0 && (
                         <Card>
                            <CardHeader>
                                <CardTitle>2. Mark Interview Absentees</CardTitle>
                                <CardDescription>Select all applicants who were absent from the interview.</CardDescription>
                            </CardHeader>
                            <CardContent>
                               <ScrollArea className="h-64 border rounded-md">
                                    <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2">
                                        {eligibleApplicants.map(app => (
                                            <div key={app.applicant_id} className="flex items-center space-x-2">
                                                <Checkbox id={`absentee-${app.applicant_id}`} onCheckedChange={() => handleAbsenteeToggle(app.applicant_id)} checked={selectedAbsentees.has(app.applicant_id)} />
                                                <Label htmlFor={`absentee-${app.applicant_id}`} className="truncate">{app.applicant_name} ({app.applicant_id})</Label>
                                            </div>
                                        ))}
                                    </div>
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
            
            <div className="flex justify-end">
                <Button onClick={handleProcess} disabled={!isMappingComplete || isProcessing}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Process and Save Results
                </Button>
            </div>
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

    