// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/preparing/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, GitCompareArrows, Plus, Trash2, Save, Loader2, Users, UserCheck, UserX, CheckCircle, Database, FileDown, FileEdit } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Project {
  projectId: string;
  projectName: string;
}

const KeyFigureCard = ({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
);

const DB_COLUMNS = [
  'id', 'project_id', 'project_name', 'child_idx', 'child_id', 'child_first_name', 'child_name', 
  'benef_no', 'benef_id', 'bnf_name', 'hsbnd_name', 'ed_id', 'ed_name', 'ed_phone', 
  'gov_name', 'mud_name', 'ozla_name', 'vill_name', 'child_age_mon', 'child_age_years', 
  'child_gender', 'BENEF_CLASS_DESC', 'old_new_child', 'reg_date', 'curr_date', 
  'reg_curr_days', 'reg_curr_mon', 'new_child_age_mon', 'new_child_age_years', 
  'cmam_qualify', 'child_has_cmam', 'child_cmam_type', 'muac', 'disc_date', 
  'near_health_center', 'comments', 'hw_id', 'hw_name', 'hc_id', 'hc_name', 'attend_hc', 
  'conf_date', 'child_has_cmam_hc', 'hc_card_no', 'meas_type', 'z-score_h', 'z-score_w', 'z-score'
  // Cycle columns are dynamic and not listed here
];


export default function PreparingChildCMAMListPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [columns, setColumns] = useState<string[]>([]);
    const [rawData, setRawData] = useState<any[]>([]);
    const [bnfCmamData, setBnfCmamData] = useState<any[]>([]);
    const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
    const [manualMapping, setManualMapping] = useState({ ui: '', db: '' });
    const [uniqueIdCols, setUniqueIdCols] = useState({ file: '', db: 'child_id' });
    const [regDate, setRegDate] = useState('');
    const [currDate, setCurrDate] = useState('');
    const [status, setStatus] = useState({ state: 'idle', message: 'Ready' });
    const [progress, setProgress] = useState(0);
    const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
    const [results, setResults] = useState<any | null>(null);
    const [duplicateInfo, setDuplicateInfo] = useState({ isOpen: false, count: 0, totalInFile: 0, totalInDb: 0, duplicateIds: [] as string[] });
    const [loading, setLoading] = useState({ projects: true, bnfCmam: false, saving: false, processing: false });

    // Fetch initial data
    useEffect(() => {
        fetch("/api/projects").then(res => res.json()).then(setProjects).finally(() => setLoading(p => ({ ...p, projects: false })));
    }, []);

    useEffect(() => {
        if (!selectedProjectId) return;
        setLoading(p => ({ ...p, bnfCmam: true }));
        fetch(`/api/bnf-cmam?projectId=${selectedProjectId}`)
            .then(res => res.json())
            .then(data => setBnfCmamData(Array.isArray(data) ? data : []))
            .finally(() => setLoading(p => ({ ...p, bnfCmam: false })));
    }, [selectedProjectId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
                const workbook = XLSX.read(event.target?.result, { type: 'binary' });
                setSheets(workbook.SheetNames);
                if (workbook.SheetNames.length > 0) handleSheetSelect(workbook.SheetNames[0], selectedFile);
            };
            reader.readAsBinaryString(selectedFile);
        }
    };
    
    const handleSheetSelect = (sheetName: string, selectedFile: File | null = file) => {
      if (!selectedFile) return;
      setSelectedSheet(sheetName);
       const reader = new FileReader();
        reader.onload = (e) => {
            const wb = XLSX.read(e.target?.result, {type: 'binary'});
            const ws = wb.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(ws);
            const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];
            setRawData(jsonData);
            setColumns(headers.filter(Boolean));
        };
        reader.readAsBinaryString(selectedFile);
    };

    const unmappedUiColumns = useMemo(() => columns.filter(col => !Array.from(columnMapping.keys()).includes(col)), [columns, columnMapping]);
    const unmappedDbColumns = useMemo(() => {
        const mappedDbCols = new Set(columnMapping.values());
        return DB_COLUMNS.filter(col => !mappedDbCols.has(col));
    }, [columnMapping]);

    const handleAutoMatch = () => {
        const newMap = new Map<string, string>();
        const usedDbCols = new Set<string>();
  
        columns.forEach(uiCol => {
            const matchedDbCol = DB_COLUMNS.find(dbCol => dbCol.toLowerCase().replace(/_/g, '') === uiCol.toLowerCase().replace(/[\s_]/g, '') && !usedDbCols.has(dbCol));
            if(matchedDbCol) {
                newMap.set(uiCol, matchedDbCol);
                usedDbCols.add(matchedDbCol);
            }
        });
        setColumnMapping(newMap);
        toast({ title: "Auto-match Complete", description: `${newMap.size} columns were matched automatically.`});
    };
    
    const handleAddManualMapping = () => {
      if (!manualMapping.ui || !manualMapping.db) return;
      setColumnMapping(prev => new Map(prev).set(manualMapping.ui, manualMapping.db));
      setManualMapping({ ui: "", db: "" });
    };

    const removeMapping = (uiCol: string) => {
        setColumnMapping(prev => { const next = new Map(prev); next.delete(uiCol); return next; });
    };

    const processAndSave = useCallback(async (mode: 'skip' | 'replace') => {
        if (!selectedProjectId || !uniqueIdCols.file || !uniqueIdCols.db) {
            toast({ title: "Incomplete Setup", variant: "destructive" });
            return;
        }

        setLoading(p => ({ ...p, saving: true }));
        setStatus({ state: 'processing', message: 'Step 1/6: Processing data...' });
        setProgress(10);
        
        try {
            // STEPS 1-6 are performed here on the client-side
            const bnfMap = new Map(bnfCmamData.map(b => [String(b.benef_no), b]));
            const processedRecords = rawData.map((row, index) => {
                const mappedRow: any = { project_id: selectedProjectId, project_name: projects.find(p => p.projectId === selectedProjectId)?.projectName };
                columnMapping.forEach((dbCol, fileCol) => {
                    if (row[fileCol] !== undefined) mappedRow[dbCol] = row[fileCol];
                });

                const bnfRecord = bnfMap.get(String(mappedRow.benef_no));
                if (bnfRecord) {
                    Object.assign(mappedRow, {
                        benef_id: bnfRecord.BENEF_ID, bnf_name: bnfRecord.BNF_NAME, hsbnd_name: bnfRecord.HUSBAND_NAME,
                        ed_id: bnfRecord.ED_ID, ed_name: bnfRecord.ED_NAME, ed_phone: bnfRecord.ed_phone,
                        gov_name: bnfRecord.GOV_NAME, mud_name: bnfRecord.MUD_NAME, ozla_name: bnfRecord.OZLA_NAME,
                        vill_name: bnfRecord.VILL_NAME, BENEF_CLASS_DESC: bnfRecord.BENEF_CLASS_DESC,
                        reg_date: bnfRecord.reg_date || regDate,
                        curr_date: bnfRecord.curr_date || currDate,
                    });
                }
                
                mappedRow.child_id = `${mappedRow.benef_no || ''}${mappedRow.child_idx || ''}`;
                mappedRow.old_new_child = 'old';

                if (mappedRow.reg_date && mappedRow.curr_date && mappedRow.BENEF_CLASS_DESC === 'مستفيدة') {
                    const start = dayjs(mappedRow.reg_date);
                    const end = dayjs(mappedRow.curr_date);
                    mappedRow.reg_curr_days = end.diff(start, 'day');
                    mappedRow.reg_curr_mon = mappedRow.reg_curr_days / 30;
                    mappedRow.new_child_age_mon = (Number(mappedRow.child_age_mon) || 0) + mappedRow.reg_curr_mon;
                    mappedRow.new_child_age_years = mappedRow.new_child_age_mon / 12;
                    mappedRow.cmam_qualify = mappedRow.new_child_age_years < 5 ? 'Qualified' : 'Disqualified';
                }
                return mappedRow;
            });
            setProgress(50);
            setStatus({state: 'saving', message: 'Saving to database...'});
            
            // Now send to API
            const res = await fetch('/api/child-cmam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    projectId: selectedProjectId,
                    records: processedRecords,
                    uniqueIdCol: uniqueIdCols.db,
                    mode
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to save data.');
            
            setSaveStats(result);
            setStatus({ state: 'done', message: 'Save complete!' });
            setProgress(100);

            // Calculate results for display
            const finalResults = {
                totalChildren: processedRecords.length,
                qualifiedBeneficiaries: processedRecords.filter(r => r.BENEF_CLASS_DESC === 'مستفيدة').length,
                cmamQualified: processedRecords.filter(r => r.cmam_qualify === 'Qualified').length,
                disqualifiedBeneficiaries: processedRecords.filter(r => r.BENEF_CLASS_DESC !== 'مستفيدة').length,
                cmamDisqualified: processedRecords.filter(r => r.cmam_qualify === 'Disqualified').length,
            };
            setResults(finalResults);
            
            toast({ title: "Success", description: "Data has been successfully saved to child-CMAM.db." });

        } catch (error: any) {
            setStatus({ state: 'error', message: error.message });
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({ ...p, saving: false }));
            setDuplicateInfo(p => ({ ...p, isOpen: false }));
        }
    }, [rawData, bnfCmamData, columnMapping, regDate, currDate, selectedProjectId, projects, uniqueIdCols, toast]);

    const handleSave = async () => {
        if (!selectedProjectId || !file) return toast({title: "Setup Incomplete", variant: "destructive"});
        
        setStatus({ state: 'checking_duplicates', message: 'Checking duplicates...' });
        setLoading(p => ({...p, saving: true}));

        try {
            const uniqueIdsInFile = rawData.map(row => row[uniqueIdCols.file]).filter(Boolean);
            const res = await fetch('/api/child-cmam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check_duplicates', projectId: selectedProjectId, uniqueIds: uniqueIdsInFile, uniqueIdCol: uniqueIdCols.db })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            
            if (result.count > 0) {
                setDuplicateInfo({ isOpen: true, count: result.count, totalInFile: rawData.length, totalInDb: result.totalInDb, duplicateIds: result.duplicateIds });
            } else {
                await processAndSave('replace');
            }
        } catch (err: any) {
            toast({ title: "Error checking duplicates", description: err.message, variant: "destructive" });
        } finally {
            setLoading(p => ({ ...p, saving: false }));
        }
    };
    
    return (
        <div className="space-y-6 pb-10">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Prepare Child CMAM List</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Hub</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>1. Select Project, Dates & Upload File</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={loading.projects}>
                            <SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger>
                            <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input type="date" value={regDate} onChange={e => setRegDate(e.target.value)} />
                        <Input type="date" value={currDate} onChange={e => setCurrDate(e.target.value)} />
                    </div>
                    {sheets.length > 0 && <Select value={selectedSheet} onValueChange={handleSheetSelect}><SelectTrigger><SelectValue placeholder="Select Sheet..." /></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}
                </CardContent>
            </Card>

            {columns.length > 0 && (
                <Card>
                    <CardHeader><CardTitle>2. Map Columns</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                         <Button onClick={handleAutoMatch} variant="outline"><GitCompareArrows className="mr-2 h-4 w-4"/>Auto-match</Button>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <Select value={manualMapping.ui} onValueChange={v => setManualMapping(p => ({...p, ui: v}))}><SelectTrigger><SelectValue placeholder="File Column..."/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedUiColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select>
                            <Select value={manualMapping.db} onValueChange={v => setManualMapping(p => ({...p, db: v}))}><SelectTrigger><SelectValue placeholder="DB Column..."/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select>
                            <Button onClick={handleAddManualMapping}><Plus className="mr-2 h-4 w-4"/>Add</Button>
                        </div>
                        <ScrollArea className="h-48 border rounded-md"><Table>
                            <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Destination</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                            <TableBody>{Array.from(columnMapping.entries()).map(([ui, db]) => <TableRow key={ui}><TableCell>{ui}</TableCell><TableCell>{db}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={()=>removeMapping(ui)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody>
                        </Table></ScrollArea>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select value={uniqueIdCols.file} onValueChange={v => setUniqueIdCols(p => ({...p, file: v}))}><SelectTrigger><SelectValue placeholder="Unique ID from File..."/></SelectTrigger><SelectContent>{columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                            <Select value={uniqueIdCols.db} onValueChange={v => setUniqueIdCols(p => ({...p, db: v}))}><SelectTrigger><SelectValue placeholder="Unique ID in DB..."/></SelectTrigger><SelectContent>{DB_COLUMNS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            <Card>
                <CardHeader><CardTitle>3. Process & Save</CardTitle></CardHeader>
                <CardContent>
                    <Button onClick={handleSave} disabled={loading.saving || !selectedProjectId || !file}>
                        {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Process & Save to DB
                    </Button>
                    {loading.saving && (
                        <div className="mt-4 space-y-2">
                           <Progress value={progress} />
                           <p className="text-sm text-muted-foreground">{status.message} ({progress}%)</p>
                           <p className="text-xs text-muted-foreground">Saved: {saveStats.saved}, Updated: {saveStats.updated}, Skipped: {saveStats.skipped}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {results && (
                 <Card>
                    <CardHeader><CardTitle>Results</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <KeyFigureCard title="Total Children" value={results.totalChildren} icon={<Users />} />
                        <KeyFigureCard title="Qualified Bnfs" value={results.qualifiedBeneficiaries} icon={<UserCheck />} />
                        <KeyFigureCard title="CMAM Qualified" value={results.cmamQualified} icon={<CheckCircle />} />
                        <KeyFigureCard title="Disqualified Bnfs" value={results.disqualifiedBeneficiaries} icon={<UserX />} />
                        <KeyFigureCard title="CMAM Disqualified" value={results.cmamDisqualified} icon={<UserX />} />
                    </CardContent>
                </Card>
            )}

            <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo(p => ({ ...p, isOpen }))}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Duplicates Found</AlertDialogTitle><AlertDialogDescription>
                       Found {duplicateInfo.count} duplicates. How to proceed?
                    </AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="outline" onClick={() => processAndSave('skip')}>Skip Duplicates</Button>
                        <AlertDialogAction onClick={() => processAndSave('replace')}>Update Existing</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
