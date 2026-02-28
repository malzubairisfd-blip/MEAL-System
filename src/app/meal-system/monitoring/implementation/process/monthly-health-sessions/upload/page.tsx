
// src/app/meal-system/monitoring/implementation/process/monthly-health-sessions/upload/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Save, GitCompareArrows, Plus, Trash2, ArrowLeft, CheckCircle, BarChart2, Database, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Project {
  projectId: string;
  projectName: string;
}

const LOCAL_STORAGE_MAPPING_PREFIX = "monthly-session-mapping-";

const STATUS_LABELS: Record<string, string> = {
  FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE: "Saving from Enrollment Review DB",
  SECOND_STEP_SAVING_BENEFICIARY_APPEARANCE: "Saving Beneficiary Appearance",
  THIRD_STEP_SAVING_GENERAL_SESSIONS_DATE: "Saving General Sessions Date",
  FOURTH_STEP_SAVING_BENEFICIARY_ABSENCE: "Saving Beneficiary Absence",
  FIFTH_STEP_SAVING_ABSENTEES: "Saving Absentees",
  SIXTH_STEP_SAVING_ATTENDANCE: "Saving Attendance",
  done: "Completed",
  idle: "Idle",
  error: "Error",
};

const KeyFiguresCard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
);

export default function MonthlySessionsUploadPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [appearanceSheet, setAppearanceSheet] = useState('');
    const [absenceSheet, setAbsenceSheet] = useState('');
    const [appearanceColumns, setAppearanceColumns] = useState<string[]>([]);
    const [absenceColumns, setAbsenceColumns] = useState<string[]>([]);
    const [appearanceData, setAppearanceData] = useState<any[]>([]);
    const [absenceData, setAbsenceData] = useState<any[]>([]);
    const [sessionNumber, setSessionNumber] = useState(1);
    const [sessionDate, setSessionDate] = useState({ day: '', month: '', year: '' });
    
    const [dbColumns, setDbColumns] = useState<string[]>([]);
    const [appearanceMapping, setAppearanceMapping] = useState<Map<string, string>>(new Map());
    const [absenceMapping, setAbsenceMapping] = useState<Map<string, string>>(new Map());
    const [manualAppearanceMapping, setManualAppearanceMapping] = useState({ ui: '', db: '' });
    const [manualAbsenceMapping, setManualAbsenceMapping] = useState({ ui: '', db: '' });
    
    const [loading, setLoading] = useState({ projects: true, saving: false, dbSchema: true });
    const [workerStatus, setWorkerStatus] = useState('idle');
    const [workerProgress, setWorkerProgress] = useState(0);
    const [workerMessage, setWorkerMessage] = useState('');
    const [results, setResults] = useState<any>(null);
    const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });

    useEffect(() => {
        setLoading(p => ({...p, projects: true}));
        fetch('/api/projects').then(res => res.json()).then(data => setProjects(data)).finally(() => setLoading(p => ({...p, projects: false})));
        
        setLoading(p => ({...p, dbSchema: true}));
        fetch('/api/monthly-health-sessions', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action: 'get_schema' })})
            .then(res => res.json())
            .then(data => setDbColumns(data.columns || []))
            .finally(() => setLoading(p => ({...p, dbSchema: false})));

    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            setSheets([]);
            setAppearanceSheet('');
            setAbsenceSheet('');
        }
    };

    useEffect(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const wb = XLSX.read(e.target?.result, { type: 'binary' });
            setSheets(wb.SheetNames);
        };
        reader.readAsBinaryString(file);
    }, [file]);

    const handleSheetSelect = (type: 'appearance' | 'absence', sheetName: string) => {
        if (!file) return;
        if (type === 'appearance') setAppearanceSheet(sheetName);
        if (type === 'absence') setAbsenceSheet(sheetName);

        const reader = new FileReader();
        reader.onload = (e) => {
            const wb = XLSX.read(e.target?.result, { type: 'binary' });
            const ws = wb.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(ws);
            const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];

            if (type === 'appearance') {
                setAppearanceData(data);
                setAppearanceColumns(headers);
            } else {
                setAbsenceData(data);
                setAbsenceColumns(headers);
            }
        };
        reader.readAsBinaryString(file);
    };

    const targetDbColumns = useMemo(() => {
        if (!dbColumns.length) return [];
        const suffix = `_s${sessionNumber}`;
        return dbColumns.filter(c => c === 'benef_id' || c.endsWith(suffix));
    }, [dbColumns, sessionNumber]);

    const unmappedAppearanceFileCols = useMemo(() => appearanceColumns.filter(c => !Array.from(appearanceMapping.keys()).includes(c)), [appearanceColumns, appearanceMapping]);
    const unmappedAppearanceDbCols = useMemo(() => targetDbColumns.filter(c => !Array.from(appearanceMapping.values()).includes(c)), [targetDbColumns, appearanceMapping]);
    const unmappedAbsenceFileCols = useMemo(() => absenceColumns.filter(c => !Array.from(absenceMapping.keys()).includes(c)), [absenceColumns, absenceMapping]);
    const unmappedAbsenceDbCols = useMemo(() => targetDbColumns.filter(c => !Array.from(absenceMapping.values()).includes(c)), [targetDbColumns, absenceMapping]);

    const handleAddAppearanceMapping = () => {
        if (manualAppearanceMapping.ui && manualAppearanceMapping.db) {
            const newMap = new Map(appearanceMapping);
            newMap.set(manualAppearanceMapping.ui, manualAppearanceMapping.db);
            setAppearanceMapping(newMap);
            setManualAppearanceMapping({ ui: '', db: '' });
        }
    };
    const handleDeleteAppearanceMapping = (key: string) => {
        const newMap = new Map(appearanceMapping);
        newMap.delete(key);
        setAppearanceMapping(newMap);
    };
    const handleAddAbsenceMapping = () => {
        if (manualAbsenceMapping.ui && manualAbsenceMapping.db) {
            const newMap = new Map(absenceMapping);
            newMap.set(manualAbsenceMapping.ui, manualAbsenceMapping.db);
            setAbsenceMapping(newMap);
            setManualAbsenceMapping({ ui: '', db: '' });
        }
    };
    const handleDeleteAbsenceMapping = (key: string) => {
        const newMap = new Map(absenceMapping);
        newMap.delete(key);
        setAbsenceMapping(newMap);
    };

    useEffect(() => {
        if (!selectedProjectId) return;
        const key = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-appearance`;
        localStorage.setItem(key, JSON.stringify(Array.from(appearanceMapping.entries())));
    }, [appearanceMapping, selectedProjectId]);
    
    useEffect(() => {
        if (!selectedProjectId) return;
        const key = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-absence`;
        localStorage.setItem(key, JSON.stringify(Array.from(absenceMapping.entries())));
    }, [absenceMapping, selectedProjectId]);
    
    useEffect(() => {
        if (!selectedProjectId || !file) return;
        const keyAppearance = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-appearance`;
        const storedAppearance = localStorage.getItem(keyAppearance);
        if (storedAppearance) {
            try { setAppearanceMapping(new Map(JSON.parse(storedAppearance))); } catch {}
        }
        
        const keyAbsence = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-absence`;
        const storedAbsence = localStorage.getItem(keyAbsence);
        if (storedAbsence) {
            try { setAbsenceMapping(new Map(JSON.parse(storedAbsence))); } catch {}
        }
    }, [selectedProjectId, file]);


    const handleSave = async () => {
        if(!Array.from(appearanceMapping.values()).includes('benef_id') && !Array.from(absenceMapping.values()).includes('benef_id')) {
            toast({ title: "Mapping Incomplete", description: "You must map a column to 'benef_id' in either the appearance or absence sheet.", variant: 'destructive'});
            return;
        }

        setLoading(prev => ({...prev, saving: true}));
        setWorkerStatus('initializing');
        setWorkerProgress(0);

        try {
            const response = await fetch('/api/monthly-health-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    projectId: selectedProjectId,
                    sessionNumber,
                    sessionDate: `${sessionDate.year}-${sessionDate.month}-${sessionDate.day}`,
                    appearanceData,
                    appearanceMapping: Object.fromEntries(appearanceMapping),
                    absenceData,
                    absenceMapping: Object.fromEntries(absenceMapping)
                }),
            });

            if (!response.body) throw new Error("No response stream from server.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n').filter(line => line.startsWith('data: '));
                
                for (const line of lines) {
                    const jsonStr = line.replace('data: ', '');
                    const data = JSON.parse(jsonStr);

                    if (data.type === 'progress') {
                        setWorkerStatus(data.status);
                        setWorkerProgress(data.progress);
                        setWorkerMessage(data.message);
                        if (data.stats) {
                            setSaveStats(data.stats);
                        }
                    } else if (data.type === 'done') {
                        setWorkerStatus('done');
                        setWorkerProgress(100);
                        if(data.stats) setSaveStats(data.stats);
                        toast({ title: "Success", description: data.message });
                        setResults({
                            totalAppearance: appearanceData.length,
                            totalAbsence: absenceData.length,
                        });
                        break;
                    } else if (data.type === 'error') {
                        throw new Error(data.error);
                    }
                }
            }
        } catch (error: any) {
            setWorkerStatus('error');
            toast({ title: "Error during processing", description: error.message, variant: "destructive" });
        } finally {
            setLoading(prev => ({...prev, saving: false}));
        }
    };
    
    const isProcessing = loading.saving;
    const statusLabel = STATUS_LABELS[workerStatus] || workerStatus;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Upload Monthly Health Sessions Data</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Hub</Link></Button>
            </div>

            <Card>
                <CardHeader><CardTitle>1. Select Project & Upload File</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger><SelectValue placeholder="Select Project..."/></SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />
                </CardContent>
            </Card>

            {file && (
            <Card>
                <CardHeader><CardTitle>2. Configure Session & Sheets</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Session Number</Label>
                            <Input type="number" min="1" max="76" value={sessionNumber} onChange={e => setSessionNumber(Math.max(1, Math.min(76, Number(e.target.value))))} />
                        </div>
                        <div className="col-span-3 space-y-2">
                             <Label>Session General Date</Label>
                             <div className="grid grid-cols-3 gap-2">
                                <Input type="number" placeholder="DD" value={sessionDate.day} onChange={e=>setSessionDate(d=>({...d, day: e.target.value}))}/>
                                <Input type="number" placeholder="MM" value={sessionDate.month} onChange={e=>setSessionDate(d=>({...d, month: e.target.value}))}/>
                                <Input type="number" placeholder="YYYY" value={sessionDate.year} onChange={e=>setSessionDate(d=>({...d, year: e.target.value}))}/>
                             </div>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Beneficiary Appearance Sheet</Label>
                            <Select onValueChange={(v) => handleSheetSelect('appearance', v)}><SelectTrigger><SelectValue placeholder="Select sheet..."/></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Beneficiary Absence Sheet</Label>
                            <Select onValueChange={(v) => handleSheetSelect('absence', v)}><SelectTrigger><SelectValue placeholder="Select sheet..."/></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                        </div>
                    </div>
                </CardContent>
            </Card>
            )}
            
            {appearanceSheet && (
                 <Card>
                    <CardHeader><CardTitle>Appearance Data Mapping</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-2"><Label>Unmapped File Column</Label><Select value={manualAppearanceMapping.ui} onValueChange={v => setManualAppearanceMapping(m=>({...m, ui: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedAppearanceFileCols.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Target DB Column</Label><Select value={manualAppearanceMapping.db} onValueChange={v => setManualAppearanceMapping(m=>({...m, db: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedAppearanceDbCols.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
                            <Button onClick={handleAddAppearanceMapping}><Plus className="mr-2 h-4 w-4"/>Add Mapping</Button>
                        </div>
                        <ScrollArea className="h-48 border rounded-md">
                            <Table><TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>Database Column</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                            <TableBody>{Array.from(appearanceMapping.entries()).map(([ui, db]) => <TableRow key={ui}><TableCell>{ui}</TableCell><TableCell>{db}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={()=>handleDeleteAppearanceMapping(ui)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody></Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            {absenceSheet && (
                 <Card>
                    <CardHeader><CardTitle>Absence Data Mapping</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-2"><Label>Unmapped File Column</Label><Select value={manualAbsenceMapping.ui} onValueChange={v => setManualAbsenceMapping(m=>({...m, ui: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedAbsenceFileCols.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Target DB Column</Label><Select value={manualAbsenceMapping.db} onValueChange={v => setManualAbsenceMapping(m=>({...m, db: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedAbsenceDbCols.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
                            <Button onClick={handleAddAbsenceMapping}><Plus className="mr-2 h-4 w-4"/>Add Mapping</Button>
                        </div>
                        <ScrollArea className="h-48 border rounded-md">
                            <Table><TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>Database Column</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                            <TableBody>{Array.from(absenceMapping.entries()).map(([ui, db]) => <TableRow key={ui}><TableCell>{ui}</TableCell><TableCell>{db}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={()=>handleDeleteAbsenceMapping(ui)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody></Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
            
            <Card>
                <CardHeader><CardTitle>3. Save Data</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleSave} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Save to Database
                    </Button>
                    {isProcessing && (
                         <div className="space-y-2">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{statusLabel}</span>
                                <span>{workerProgress}%</span>
                            </div>
                            <Progress value={workerProgress} />
                            <p className="text-xs text-center mt-1 text-muted-foreground">
                                {workerMessage} (Saved: {saveStats.saved}, Updated: {saveStats.updated}, Skipped: {saveStats.skipped} / {saveStats.total})
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {results && (
                <Card>
                <CardHeader><CardTitle>Results Summary</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <KeyFiguresCard title="Session Number" value={sessionNumber} icon={<CheckCircle/>}/>
                    <KeyFiguresCard title="Total Appearance" value={results.totalAppearance} icon={<Users/>}/>
                </CardContent>
                 <CardContent className="flex gap-2">
                    <Button asChild><Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions/dashboard"><BarChart2 className="mr-2 h-4 w-4"/>Go to Dashboard</Link></Button>
                    <Button asChild><Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions/database"><Database className="mr-2 h-4 w-4"/>Go to Database</Link></Button>
                </CardContent>
            </Card>
            )}

        </div>
    );
}
