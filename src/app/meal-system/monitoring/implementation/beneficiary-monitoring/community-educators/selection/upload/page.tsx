
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, CheckCircle, XCircle, ChevronsUpDown, Users, UserCheck, UserX, ArrowRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from '@/components/ui/progress';

interface Project {
  projectId: string;
  projectName: string;
}

const MAPPING_FIELDS = [
  "applicantName", "husbandName", "phoneNumber", "governorate", "district", "subdistrict", "village",
  "idType", "idNumber", "idIssueDate", "birthDate", "idIssueLocation",
  "qualification", "graduationYear", "diplomaStartDate", "diplomaEndDate", "previousExperience", "applicantId"
] as const;
type MappingField = typeof MAPPING_FIELDS[number];

const REQUIRED_MAPPING_FIELDS: MappingField[] = ["applicantName", "birthDate", "qualification", "village", "applicantId"];

const LOCAL_STORAGE_KEY_PREFIX = "educator-selection-mapping-";

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
    const [mapping, setMapping] = useState<Record<MappingField, string>>(() => {
        const initial: any = {};
        MAPPING_FIELDS.forEach(f => initial[f] = '');
        return initial;
    });

    const [recipientsDate, setRecipientsDate] = useState({ day: '', month: '', year: '' });
    
    const [workerStatus, setWorkerStatus] = useState('idle');
    const [progressInfo, setProgressInfo] = useState({ status: "idle", progress: 0 });
    const [results, setResults] = useState<any | null>(null);

    const rawRowsRef = useRef<any[]>([]);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects');
                if (res.ok) setProjects(await res.json());
            } catch (error) {
                toast({ title: "Error", description: "Could not load projects.", variant: "destructive" });
            }
        };
        fetchProjects();

        const worker = new Worker(new URL('@/workers/ed-selection.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        worker.onmessage = (event) => {
            const { type, status, progress, data, error } = event.data;
            if (type === 'progress') {
                setWorkerStatus(status);
                setProgressInfo({ status, progress });
            } else if (type === 'done') {
                setResults(data);
                setWorkerStatus('done');
                setProgressInfo({ status: 'done', progress: 100 });
                toast({ title: "Selection Complete!", description: `Processed ${data.totalApplicants} applicants.` });
            } else if (type === 'error') {
                setWorkerStatus('error');
                toast({ title: "Processing Error", description: error, variant: "destructive" });
            }
        };

        return () => worker.terminate();

    }, [toast]);

    const isMappingComplete = useMemo(() => REQUIRED_MAPPING_FIELDS.every(f => !!mapping[f]), [mapping]);

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

        const reader = new FileReader();
        reader.onload = (e) => {
            const buffer = e.target?.result;
            const wb = XLSX.read(buffer, { type: 'array' });
            setSheets(wb.SheetNames);
            setSelectedSheet(wb.SheetNames[0]);
        };
        reader.readAsArrayBuffer(selectedFile);
    };

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
            
            // Restore mapping
            const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}${detectedColumns.join(',')}`;
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try { setMapping(JSON.parse(saved)); } catch {}
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file, selectedSheet]);

     useEffect(()=>{
        if(columns.length > 0){
            const key = LOCAL_STORAGE_KEY_PREFIX + columns.join(',');
            localStorage.setItem(key, JSON.stringify(mapping));
        }
    }, [mapping, columns]);

    const startSelectionProcess = () => {
        if (!workerRef.current || !isMappingComplete || !recipientsDate.year || !recipientsDate.month || !recipientsDate.day || !selectedProjectId) {
            toast({ title: "Incomplete Information", description: "Please select a project, provide a full recipients date, and complete all required mappings.", variant: "destructive" });
            return;
        }

        setWorkerStatus('processing');
        setProgressInfo({ status: 'processing', progress: 1 });
        setResults(null);

        workerRef.current.postMessage({
            rows: rawRowsRef.current,
            mapping,
            recipientsDate: `${recipientsDate.year}-${recipientsDate.month}-${recipientsDate.day}`,
            projectName: projects.find(p => p.projectId === selectedProjectId)?.projectName || 'Unknown Project'
        });
    };
    
    const isProcessing = workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error';

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
                <Collapsible defaultOpen>
                    <Card>
                         <CollapsibleTrigger asChild>
                            <CardHeader className="flex-row items-center justify-between cursor-pointer">
                                <CardTitle>2. Map Columns</CardTitle>
                                <Button variant="ghost" size="sm"><ChevronsUpDown className="h-4 w-4" /></Button>
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {MAPPING_FIELDS.map(field => (
                                    <Card key={field}>
                                        <CardHeader className="p-4">
                                            <div className="flex items-center gap-2">
                                                {mapping[field] ? <CheckCircle className="h-5 w-5 text-green-500" /> : (REQUIRED_MAPPING_FIELDS.includes(field) && <XCircle className="h-5 w-5 text-red-500" />)}
                                                <Label htmlFor={field} className="capitalize font-semibold">{field.replace(/([A-Z])/g, ' $1')}{REQUIRED_MAPPING_FIELDS.includes(field) && <span className="text-destructive">*</span>}</Label>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <ScrollArea className="h-40 border-t">
                                                <RadioGroup value={mapping[field]} onValueChange={(v) => setMapping(m => ({ ...m, [field]: v }))} className="p-4 grid grid-cols-1 gap-2">
                                                    {columns.map(col => (
                                                        <div key={col} className="flex items-center space-x-2">
                                                            <RadioGroupItem value={col} id={`${field}-${col}`} />
                                                            <Label htmlFor={`${field}-${col}`} className="truncate font-normal">{col}</Label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                ))}
                            </CardContent>
                        </CollapsibleContent>
                    </Card>
                </Collapsible>
            )}
            
            <Card>
                <CardHeader><CardTitle>3. Run Selection Process</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={startSelectionProcess} disabled={!isMappingComplete || isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        {isProcessing ? 'Processing Applicants...' : 'Select Educators'}
                    </Button>
                    {isProcessing && <Progress value={progressInfo.progress} />}
                </CardContent>
            </Card>

            {results && (
                <Card>
                    <CardHeader>
                        <CardTitle>4. Selection Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <SummaryCard icon={<Users />} title="Total Applicants" value={results.totalApplicants} />
                            <SummaryCard icon={<UserCheck className="text-green-500"/>} title="Accepted" value={results.totalAccepted} />
                            <SummaryCard icon={<UserX className="text-red-500"/>} title="Unaccepted" value={results.totalUnaccepted} />
                        </div>
                        <Button onClick={() => router.push('/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview')}>
                            Proceed to Interview Page <ArrowRight className="ml-2 h-4 w-4"/>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
