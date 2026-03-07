// src/app/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, GitCompareArrows, Trash2, Plus, Save, Users, UserCheck, UserX, Database } from "lucide-react";
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const LOCAL_STORAGE_MAPPING_PREFIX = "bnf-cmam-mapping-";

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  checking_duplicates: "Checking for duplicates...",
  saving: "Saving data...",
  enriching_phones: "Enriching educator phones...",
  calculating_dates: "Calculating dates...",
  calculating_ages: "Calculating ages...",
  calculating_qualification: "Calculating qualifications...",
  done: "Completed",
  error: "Error",
};

const KeyFigureCard = ({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) => (
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

export default function PreparingBeneficiariesCMAMListPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    
    const [columns, setColumns] = useState<string[]>([]);
    const [rawFileData, setRawFileData] = useState<any[]>([]);
    
    const [dbColumns, setDbColumns] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
    const [manualMapping, setManualMapping] = useState({ ui: '', db: '' });
    
    const [uniqueIdCol, setUniqueIdCol] = useState('');
    
    const [regDate, setRegDate] = useState({ day: '', month: '', year: ''});
    const [currDate, setCurrDate] = useState({ day: '', month: '', year: ''});

    const [loading, setLoading] = useState({ projects: true, dbSchema: true, saving: false });
    const [status, setStatus] = useState("idle");
    const [progress, setProgress] = useState(0);
    const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
    const [results, setResults] = useState<any | null>(null);
    const [duplicateInfo, setDuplicateInfo] = useState({ isOpen: false, count: 0, totalInDb: 0, duplicateIds: [] as string[] });

    useEffect(() => {
        Promise.all([
            fetch('/api/projects').then(res => res.json()),
            fetch('/api/bnf-cmam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_schema' }) }).then(res => res.json())
        ]).then(([projData, schemaData]) => {
            setProjects(projData);
            setDbColumns(schemaData.columns || []);
        }).catch(err => {
            toast({ title: "Error loading initial data", description: err.message, variant: "destructive" });
        }).finally(() => setLoading({ projects: false, dbSchema: false, saving: false }));
    }, [toast]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const f = e.target.files[0];
            setFile(f);
            const reader = new FileReader();
            reader.onload = (event) => {
                const wb = XLSX.read(event.target?.result, { type: 'binary' });
                setSheets(wb.SheetNames);
                if (wb.SheetNames.length > 0) handleSheetSelect(wb.SheetNames[0], f);
            };
            reader.readAsBinaryString(f);
        }
    };

    const handleSheetSelect = (sheetName: string, selectedFile: File | null = file) => {
        if (!selectedFile) return;
        setSelectedSheet(sheetName);
        const reader = new FileReader();
        reader.onload = (e) => {
            const wb = XLSX.read(e.target?.result, { type: 'binary' });
            const ws = wb.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(ws);
            setRawFileData(data);
            const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];
            setColumns(headers.filter(h => h && h.trim()));
            const storageKey = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-${selectedFile.name}`;
            const savedMapping = localStorage.getItem(storageKey);
            if (savedMapping) {
                setColumnMapping(new Map(Object.entries(JSON.parse(savedMapping))));
                toast({ title: "Mapping Restored" });
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleAutoMatch = () => {
        const newMapping = new Map<string, string>();
        columns.forEach(uiCol => {
            const match = dbColumns.find(dbCol => dbCol.toLowerCase().replace(/_/g, '') === uiCol.toLowerCase().replace(/_/g, '').replace(/\s/g, ''));
            if (match) newMapping.set(uiCol, match);
        });
        setColumnMapping(newMapping);
    };

    const handleAddManualMapping = () => {
        if (manualMapping.ui && manualMapping.db) {
            setColumnMapping(prev => new Map(prev).set(manualMapping.ui, manualMapping.db));
            setManualMapping({ ui: '', db: '' });
        }
    };
    
    const unmappedUiColumns = useMemo(() => columns.filter(c => !Array.from(columnMapping.keys()).includes(c)), [columns, columnMapping]);
    const unmappedDbColumns = useMemo(() => dbColumns.filter(c => !Array.from(columnMapping.values()).includes(c)), [dbColumns, columnMapping]);

    const executeSave = async (mode: 'skip' | 'replace') => {
        setDuplicateInfo(prev => ({...prev, isOpen: false}));
        setLoading(p => ({...p, saving: true}));

        const payload = {
            action: 'save',
            projectId: selectedProjectId,
            projectName: projects.find(p => p.projectId === selectedProjectId)?.projectName,
            records: rawFileData,
            mapping: Object.fromEntries(columnMapping),
            uniqueIdCol: uniqueIdCol,
            regDate: `${regDate.year}-${regDate.month}-${regDate.day}`,
            currDate: `${currDate.year}-${currDate.month}-${currDate.day}`,
            mode
        };
        
        try {
            const response = await fetch('/api/bnf-cmam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.body) throw new Error("No response stream.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n').filter(line => line.startsWith("data: "));
                for (const line of lines) {
                    const data = JSON.parse(line.replace("data: ", ""));
                    if (data.type === 'progress') {
                        setStatus(data.status);
                        setProgress(data.progress);
                        if (data.stats) setSaveStats(data.stats);
                    } else if (data.type === 'done') {
                        setStatus('done'); setProgress(100);
                        setResults(data.results);
                        toast({ title: 'Success', description: data.message });
                        break;
                    } else if (data.type === 'error') {
                        throw new Error(data.error);
                    }
                }
            }
        } catch (error: any) {
            toast({ title: "Save Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({...p, saving: false}));
        }
    };

    const handleSave = async () => {
        if (!selectedProjectId || !file) return;
        setLoading(p => ({...p, saving: true}));
        try {
            const uniqueIds = rawFileData.map(r => r[uniqueIdCol]).filter(Boolean);
            const res = await fetch('/api/bnf-cmam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check_duplicates', projectId: selectedProjectId, uniqueIdCol, uniqueIds })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            if (result.count > 0) {
                setDuplicateInfo({ isOpen: true, count: result.count, totalInDb: result.totalInDb, duplicateIds: result.duplicateIds });
            } else {
                await executeSave('replace');
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive'});
        } finally {
            setLoading(p => ({...p, saving: false}));
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Prepare Beneficiaries CMAM List</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries"><ArrowLeft className="mr-2 h-4 w-4" /> Back to hub</Link></Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>1. Select Project & Upload</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                        <SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="file" onChange={handleFileChange} />
                    {sheets.length > 0 && <Select value={selectedSheet} onValueChange={sheet => handleSheetSelect(sheet)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label>Registration Date</Label>
                           <div className="grid grid-cols-3 gap-2">
                                <Select value={regDate.day} onValueChange={v => setRegDate(d => ({ ...d, day: v }))}><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger><SelectContent>{Array.from({length: 31}, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d).padStart(2,'0')}>{d}</SelectItem>)}</SelectContent></Select>
                                <Select value={regDate.month} onValueChange={v => setRegDate(d => ({ ...d, month: v }))}><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{Array.from({length: 12}, (_, i) => i + 1).map(m => <SelectItem key={m} value={String(m).padStart(2,'0')}>{m}</SelectItem>)}</SelectContent></Select>
                                <Select value={regDate.year} onValueChange={v => setRegDate(d => ({ ...d, year: v }))}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{Array.from({length: 10}, (_, i) => new Date().getFullYear() - 5 + i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                           </div>
                        </div>
                         <div className="space-y-2">
                           <Label>Current Date</Label>
                           <div className="grid grid-cols-3 gap-2">
                                <Select value={currDate.day} onValueChange={v => setCurrDate(d => ({ ...d, day: v }))}><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger><SelectContent>{Array.from({length: 31}, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d).padStart(2,'0')}>{d}</SelectItem>)}</SelectContent></Select>
                                <Select value={currDate.month} onValueChange={v => setCurrDate(d => ({ ...d, month: v }))}><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{Array.from({length: 12}, (_, i) => i + 1).map(m => <SelectItem key={m} value={String(m).padStart(2,'0')}>{m}</SelectItem>)}</SelectContent></Select>
                                <Select value={currDate.year} onValueChange={v => setCurrDate(d => ({ ...d, year: v }))}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{Array.from({length: 10}, (_, i) => new Date().getFullYear() - 5 + i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                           </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {columns.length > 0 && <Card>
                <CardHeader>
                    <CardTitle>2. Map Columns</CardTitle>
                    <CardDescription>Match columns from your file to the database fields.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4" />Auto-match</Button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                           <Label>Unmapped File Column</Label>
                           <Select value={manualMapping.ui} onValueChange={v => setManualMapping(m=>({...m, ui: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedUiColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select>
                        </div>
                        <div className="space-y-2">
                           <Label>Unmapped DB Column</Label>
                           <Select value={manualMapping.db} onValueChange={v => setManualMapping(m=>({...m, db: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedDbColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select>
                        </div>
                        <Button onClick={handleAddManualMapping}><Plus className="mr-2 h-4 w-4"/>Add Mapping</Button>
                    </div>
                    <ScrollArea className="h-48 border rounded-md">
                        <Table><TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>Database Column</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                        <TableBody>{Array.from(columnMapping.entries()).map(([ui, db]) => <TableRow key={ui}><TableCell>{ui}</TableCell><TableCell>{db}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={()=>setColumnMapping(p=>{const n=new Map(p);n.delete(ui);return n;})}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>}

            <Card>
                <CardHeader>
                    <CardTitle>3. Process & Save</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 max-w-sm">
                        <Label>Unique ID Column from File</Label>
                        <Select value={uniqueIdCol} onValueChange={setUniqueIdCol}>
                            <SelectTrigger><SelectValue placeholder="Select unique ID..." /></SelectTrigger>
                            <SelectContent>{columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleSave} disabled={loading.saving} className="mt-4">
                        {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        {loading.saving ? `Saving... (${status})` : 'Save to Database'}
                    </Button>
                    {loading.saving && (
                        <div className="mt-4 space-y-2">
                            <Progress value={progress} />
                            <p className="text-sm text-center text-muted-foreground">{STATUS_LABELS[status] || status} ({saveStats.saved+saveStats.updated+saveStats.skipped}/{saveStats.total})</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {results && <Card>
                <CardHeader>
                    <CardTitle>Results Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <KeyFigureCard title="Total Beneficiaries" value={results.totalBeneficiaries} icon={<Users />} />
                    <KeyFigureCard title="Qualified Beneficiaries" value={results.qualifiedBeneficiaries} icon={<UserCheck />} />
                    <KeyFigureCard title="CMAM Qualified" value={results.cmamQualified} icon={<UserCheck />} />
                    <KeyFigureCard title="Disqualified Beneficiaries" value={results.disqualifiedBeneficiaries} icon={<UserX />} />
                    <KeyFigureCard title="CMAM Disqualified" value={results.cmamDisqualified} icon={<UserX />} />
                </CardContent>
                <CardContent className="flex gap-2">
                    <Button asChild><Link href="#">Go to Beneficiaries CMAM Database</Link></Button>
                    <Button asChild><Link href="#">Exporting Beneficiaries CMAM Statements</Link></Button>
                    <Button asChild><Link href="#">Beneficiaries CMAM Screening Results Data Entry</Link></Button>
                </CardContent>
            </Card>}

            <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo((prev) => ({ ...prev, isOpen }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                        <AlertDialogDescription>Found {duplicateInfo.count} record(s) that already exist in the database. How would you like to proceed?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="outline" onClick={() => executeSave('skip')}>Skip duplicates and save new records</Button>
                        <AlertDialogAction onClick={() => executeSave('replace')}>Update existing and add new records</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
