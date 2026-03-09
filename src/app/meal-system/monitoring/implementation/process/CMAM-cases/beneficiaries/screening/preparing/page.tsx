
// src/app/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/preparing/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, Upload, Database, UserCheck, UserX, GitCompareArrows, Plus, Trash2, CheckCircle, FileQuestion, BarChart } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


interface Project {
  projectId: string;
  projectName: string;
}

const STATUS_LABELS: Record<string, string> = {
    idle: "Idle",
    initializing: "Initializing...",
    enriching: "Enriching Data...",
    processing_records: "Processing Records...",
    saving: "Saving to Database...",
    done: "Completed",
    error: "Error",
    checking_duplicates: "Checking for Duplicates..."
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

export default function PreparingCmamPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState("");
    const [columns, setColumns] = useState<string[]>([]);
    const [rawFileData, setRawFileData] = useState<any[]>([]);

    const [registrationDate, setRegistrationDate] = useState({ day: '', month: '', year: ''});
    const [currentDate, setCurrentDate] = useState({ day: '', month: '', year: ''});

    const [dbColumns, setDbColumns] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
    const [manualMapping, setManualMapping] = useState({ ui: "", db: "" });

    const [uniqueIdFileCol, setUniqueIdFileCol] = useState('');
    const [uniqueIdDbCol, setUniqueIdDbCol] = useState('BENEF_ID');

    const [loading, setLoading] = useState({ projects: true, dbSchema: true });
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState({ step: 'idle', progress: 0 });
    const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
    const [duplicateInfo, setDuplicateInfo] = useState({ isOpen: false, count: 0, totalInDb: 0, duplicateIds: [] as string[] });
    
    // --- Data Fetching ---
    useEffect(() => {
        Promise.all([
            fetch('/api/projects').then(res => res.json()),
            fetch('/api/bnf-cmam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_schema' }) }).then(res => res.json())
        ]).then(([projData, schemaData]) => {
            setProjects(projData);
            setDbColumns(schemaData.columns || []);
        }).catch(err => {
            toast({ title: "Error loading initial data", description: err.message, variant: "destructive" });
        }).finally(() => {
            setLoading({ projects: false, dbSchema: false });
        });
    }, [toast]);
    
    // --- File Handling ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            const reader = new FileReader();
            reader.onload = (event) => {
                const workbook = XLSX.read(event.target?.result, { type: 'binary' });
                setSheets(workbook.SheetNames);
                if (workbook.SheetNames.length > 0) handleSheetSelect(workbook.SheetNames[0], f);
            };
            reader.readAsBinaryString(f);
        }
    };

    const handleSheetSelect = (sheetName: string, f: File) => {
        setSelectedSheet(sheetName);
        const reader = new FileReader();
        reader.onload = (e) => {
            const wb = XLSX.read(e.target?.result, { type: 'binary' });
            const ws = wb.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(ws);
            const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];
            setRawFileData(data);
            setColumns(headers.filter(h => h && h.trim() !== ''));
        };
        reader.readAsBinaryString(f);
    };
    
    // --- Mapping ---
    const unmappedUiColumns = useMemo(() => columns.filter(col => !Array.from(columnMapping.keys()).includes(col)), [columns, columnMapping]);
    const unmappedDbColumns = useMemo(() => dbColumns.filter(col => !Array.from(columnMapping.values()).includes(col)), [dbColumns, columnMapping]);

    const handleAddMapping = () => {
        if (manualMapping.ui && manualMapping.db) {
            setColumnMapping(prev => new Map(prev).set(manualMapping.ui, manualMapping.db));
            setManualMapping({ ui: "", db: "" });
        }
    };

    const handleRemoveMapping = (key: string) => setColumnMapping(prev => { const m = new Map(prev); m.delete(key); return m; });

    const handleAutoMatch = () => {
        const newMapping = new Map<string, string>();
        columns.forEach(uiCol => {
            const matchedDbCol = dbColumns.find(dbCol => dbCol.toLowerCase() === uiCol.toLowerCase());
            if (matchedDbCol) newMapping.set(uiCol, matchedDbCol);
        });
        setColumnMapping(newMapping);
        toast({ title: "Auto-match complete" });
    };

    // --- Save Process ---
    const executeSave = async (mode: 'skip' | 'replace') => {
        setDuplicateInfo(prev => ({ ...prev, isOpen: false }));
        setIsSaving(true);
        try {
            const response = await fetch("/api/bnf-cmam", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "save", mode, projectId: selectedProjectId,
                    records: rawFileData, mapping: Object.fromEntries(columnMapping),
                    regDate: `${registrationDate.year}-${registrationDate.month}-${registrationDate.day}`,
                    currDate: `${currentDate.year}-${currentDate.month}-${currentDate.day}`,
                    uniqueIdCol: uniqueIdDbCol,
                }),
            });

            if (response.headers.get("content-type")?.includes("text/event-stream")) {
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                while (reader) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n\n").filter(line => line.startsWith("data: "));
                    for (const line of lines) {
                        const jsonStr = line.replace("data: ", "");
                        const data = JSON.parse(jsonStr);
                        if (data.type === 'progress') {
                            setSaveStatus({ step: data.status, progress: data.progress });
                        } else if (data.type === 'done') {
                            setSaveStatus({ step: 'done', progress: 100 });
                            setSaveStats(data.stats);
                            toast({ title: "Success", description: data.message });
                        } else if (data.type === 'error') throw new Error(data.error);
                    }
                }
            } else {
                 const result = await response.json();
                 if(!response.ok) throw new Error(result.details || result.error);
            }
        } catch (error: any) {
            setSaveStatus({ step: 'error', progress: 0 });
            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSave = async () => {
        if (!selectedProjectId || rawFileData.length === 0 || !uniqueIdFileCol || !uniqueIdDbCol) {
            return toast({ title: "Incomplete", description: "Project, file, and unique ID mapping are required.", variant: "destructive" });
        }
        setIsSaving(true);
        try {
            const uniqueIds = rawFileData.map(r => r[uniqueIdFileCol]).filter(Boolean);
            const res = await fetch('/api/bnf-cmam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check_duplicates', projectId: selectedProjectId, uniqueIds, uniqueIdCol: uniqueIdDbCol })
            });
            const result = await res.json();
            if(!res.ok) throw new Error(result.error);
            if(result.count > 0) {
                setDuplicateInfo({ isOpen: true, count: result.count, totalInDb: result.totalInDb, duplicateIds: result.duplicateIds });
            } else {
                await executeSave('replace');
            }
        } catch (error: any) {
            toast({ title: "Error checking duplicates", description: error.message, variant: 'destructive'});
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 pb-12">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Preparing Beneficiaries CMAM List</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Hub</Link></Button>
            </div>
            
            <Card>
                <CardHeader><CardTitle>1. Project, File, & Dates</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId}><SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent></Select>
                    <Input type="file" onChange={handleFileChange} />
                    {sheets.length > 0 && <Select onValueChange={v => handleSheetSelect(v, file)} value={selectedSheet}><SelectTrigger><SelectValue placeholder="Select Sheet..." /></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}
                    <div className="space-y-2"><Label>Registration Date</Label><div className="flex gap-1"><Input type="number" placeholder="DD" value={registrationDate.day} onChange={e => setRegistrationDate(d => ({ ...d, day: e.target.value }))} /><Input type="number" placeholder="MM" value={registrationDate.month} onChange={e => setRegistrationDate(d => ({ ...d, month: e.target.value }))} /><Input type="number" placeholder="YYYY" value={registrationDate.year} onChange={e => setRegistrationDate(d => ({ ...d, year: e.target.value }))} /></div></div>
                    <div className="space-y-2"><Label>Current Date</Label><div className="flex gap-1"><Input type="number" placeholder="DD" value={currentDate.day} onChange={e => setCurrentDate(d => ({ ...d, day: e.target.value }))} /><Input type="number" placeholder="MM" value={currentDate.month} onChange={e => setCurrentDate(d => ({ ...d, month: e.target.value }))} /><Input type="number" placeholder="YYYY" value={currentDate.year} onChange={e => setCurrentDate(d => ({ ...d, year: e.target.value }))} /></div></div>
                </CardContent>
            </Card>

            {columns.length > 0 && (
                <Card>
                    <CardHeader><CardTitle>2. Column Mapping</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2"><Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4"/>Auto-match</Button><Button onClick={() => localStorage.setItem(`cmam-mapping-${file?.name}`, JSON.stringify(Object.fromEntries(columnMapping)))}><Save className="mr-2 h-4 w-4" />Save Mapping</Button></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-2"><Label>Unique ID (from File)</Label><Select value={uniqueIdFileCol} onValueChange={setUniqueIdFileCol}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{columns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Unique ID (in DB)</Label><Select value={uniqueIdDbCol} onValueChange={setUniqueIdDbCol}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{dbColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"><div className="space-y-2"><Label>Unmapped File Column</Label><Select value={manualMapping.ui} onValueChange={v => setManualMapping(p => ({...p, ui: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedUiColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select></div><div className="space-y-2"><Label>Unmapped DB Column</Label><Select value={manualMapping.db} onValueChange={v => setManualMapping(p => ({...p, db: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select></div><Button onClick={handleAddMapping}><Plus className="mr-2 h-4 w-4"/>Add Mapping</Button></div>
                        <ScrollArea className="h-48 border rounded-md"><Table><TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>DB Column</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{Array.from(columnMapping.entries()).map(([ui, db]) => <TableRow key={ui}><TableCell>{ui}</TableCell><TableCell>{db}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveMapping(ui)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody></Table></ScrollArea>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>3. Save to Database</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                     <Button onClick={handleSave} disabled={isSaving || !selectedProjectId || rawFileData.length === 0 || !uniqueIdFileCol}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Save to bnf-cmam.db
                     </Button>
                     {isSaving && (
                        <div className="space-y-2">
                             <Progress value={saveStatus.progress} />
                            <p className="text-sm text-center text-muted-foreground">
                                {STATUS_LABELS[saveStatus.step] || saveStatus.step}... ({saveStatus.progress}%)
                            </p>
                        </div>
                     )}
                </CardContent>
            </Card>

            {saveStatus.step === 'done' && (
                <Card>
                    <CardHeader><CardTitle>Results</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KeyFigureCard title="Beneficiaries Processed" value={saveStats.total} icon={<Users />} />
                        <KeyFigureCard title="Newly Saved" value={saveStats.saved} icon={<CheckCircle className="text-green-500" />} />
                        <KeyFigureCard title="Records Updated" value={saveStats.updated} icon={<FileEdit className="text-blue-500" />} />
                        <KeyFigureCard title="Duplicates Skipped" value={saveStats.skipped} icon={<FileQuestion className="text-orange-500" />} />
                    </CardContent>
                </Card>
            )}
            
            <div className="flex justify-end gap-2">
                 <Button variant="secondary" asChild><Link href="#">Beneficiaries CMAM Database</Link></Button>
                 <Button variant="secondary" asChild><Link href="#">Exporting CMAM Statements</Link></Button>
                 <Button variant="secondary" asChild><Link href="#">CMAM Screening Results</Link></Button>
            </div>
            
            <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo(p => ({...p, isOpen}))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                        <AlertDialogDescription>Found {duplicateInfo.count} records that already exist in the database (out of {duplicateInfo.totalInDb} total records). How would you like to proceed?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="outline" onClick={() => executeSave("skip")}>Skip Duplicates</Button>
                        <AlertDialogAction onClick={() => executeSave("replace")}>Replace Existing</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

