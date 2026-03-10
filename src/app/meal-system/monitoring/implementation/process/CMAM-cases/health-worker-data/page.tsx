// src/app/meal-system/monitoring/implementation/process/CMAM-cases/health-worker-data/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, GitCompareArrows, Trash2, Plus, Save, Upload, Loader2, FileDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { exportHealthCentersToExcel } from "@/lib/exportHealthCentersToExcel";

interface Project {
  projectId: string;
  projectName: string;
}

const LOCAL_STORAGE_MAPPING_PREFIX = "health-center-mapping-";

export default function HealthWorkerDataPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState("");
    const [columns, setColumns] = useState<string[]>([]);
    const [rawData, setRawData] = useState<any[]>([]);
    const [dbColumns, setDbColumns] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
    const [manualMapping, setManualMapping] = useState({ ui: "", db: "" });
    const [uniqueIds, setUniqueIds] = useState({ fileCol: "", dbCol: "" });
    const [loading, setLoading] = useState({ projects: true, schema: true, saving: false });
    const [saveProgress, setSaveProgress] = useState(0);
    const [saveStatus, setSaveStatus] = useState("idle");
    const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
    const [duplicateInfo, setDuplicateInfo] = useState({ isOpen: false, count: 0, totalInFile: 0, totalInDb: 0 });

    useEffect(() => {
        Promise.all([
            fetch('/api/projects').then(res => res.json()),
            fetch('/api/health-centers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_schema' }) }).then(res => res.json())
        ]).then(([projData, schemaData]) => {
            setProjects(projData || []);
            setDbColumns(schemaData.columns || []);
        }).catch(err => toast({ title: "Failed to load initial data", variant: "destructive" }))
          .finally(() => setLoading({ projects: false, schema: false, saving: false }));
    }, [toast]);
    
    useEffect(() => {
        if (!selectedProjectId || !file) return;
        const key = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-${file.name}`;
        const stored = localStorage.getItem(key);
        if (stored) setColumnMapping(new Map(Object.entries(JSON.parse(stored))));
    }, [selectedProjectId, file]);

    useEffect(() => {
        if (columnMapping.size > 0 && selectedProjectId && file) {
            const key = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-${file.name}`;
            localStorage.setItem(key, JSON.stringify(Object.fromEntries(columnMapping)));
        }
    }, [columnMapping, selectedProjectId, file]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            const reader = new FileReader();
            reader.onload = (event) => {
                const workbook = XLSX.read(event.target?.result, { type: 'binary' });
                setSheets(workbook.SheetNames);
                if (workbook.SheetNames.length > 0) handleSheetSelect(workbook.SheetNames[0], selected);
            };
            reader.readAsBinaryString(selected);
        }
    };
    
    const handleSheetSelect = (sheetName: string, selectedFile: File | null = file) => {
        if (!selectedFile) return;
        setSelectedSheet(sheetName);
        const reader = new FileReader();
        reader.onload = (e) => {
            const workbook = XLSX.read(e.target?.result, { type: 'binary' });
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);
            const headers = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]) || [];
            setRawData(data);
            setColumns(headers.filter(Boolean));
        };
        reader.readAsBinaryString(selectedFile);
    };

    const unmappedUiColumns = useMemo(() => columns.filter(col => !Array.from(columnMapping.keys()).includes(col)), [columns, columnMapping]);
    const unmappedDbColumns = useMemo(() => dbColumns.filter(col => !Array.from(columnMapping.values()).includes(col)), [dbColumns, columnMapping]);

    const handleAutoMatch = () => {
        const newMap = new Map(columnMapping);
        unmappedUiColumns.forEach(uiCol => {
            const match = unmappedDbColumns.find(dbCol => dbCol.toLowerCase().replace(/_/g, '') === uiCol.toLowerCase().replace(/[\s_]/g, ''));
            if(match) newMap.set(uiCol, match);
        });
        setColumnMapping(newMap);
        toast({ title: "Auto-match complete" });
    };

    const handleAddManualMapping = () => {
        if (!manualMapping.ui || !manualMapping.db) return;
        setColumnMapping(prev => new Map(prev).set(manualMapping.ui, manualMapping.db));
        setManualMapping({ ui: "", db: "" });
    };

    const removeMapping = (uiCol: string) => {
        setColumnMapping(prev => { const next = new Map(prev); next.delete(uiCol); return next; });
    };
    
    const executeSave = async (mode: 'skip' | 'replace') => {
        setDuplicateInfo(prev => ({...prev, isOpen: false}));
        setLoading(p => ({...p, saving: true}));
        setSaveStatus("Saving...");
        let saved = 0, updated = 0, skipped = 0;
        try {
            for (let i = 0; i < rawData.length; i += 500) {
                const chunk = rawData.slice(i, i + 500);
                const res = await fetch("/api/health-centers", {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ action: 'save', projectId: selectedProjectId, records: chunk, mapping: Object.fromEntries(columnMapping), mode })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.details || 'Save chunk failed');
                saved += result.saved;
                updated += result.updated;
                skipped += result.skipped;
                setSaveStats({ saved, updated, skipped, total: rawData.length });
                setSaveProgress(Math.round(((i + chunk.length) / rawData.length) * 100));
            }
            toast({ title: 'Success', description: 'Data saved successfully.' });
            setSaveStatus("Completed");
        } catch (err: any) {
            toast({ title: 'Save failed', description: err.message, variant: 'destructive'});
            setSaveStatus("Error");
        } finally {
            setLoading(p => ({...p, saving: false}));
        }
    };
    
    const handleSave = async () => {
        if (!selectedProjectId || !file) return;
        setLoading(p => ({...p, saving: true}));
        setSaveStatus("Checking for duplicates...");
        try {
             const res = await fetch("/api/health-centers", {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'check_duplicates', projectId: selectedProjectId, records: rawData, mapping: Object.fromEntries(columnMapping) })
            });
            const result = await res.json();
            if(!res.ok) throw new Error(result.error);
            if(result.count > 0) {
                setDuplicateInfo({ isOpen: true, count: result.count, totalInFile: rawData.length, totalInDb: result.totalInDb });
            } else {
                await executeSave('replace');
            }
        } catch (err: any) {
             toast({ title: 'Error', description: err.message, variant: 'destructive'});
        } finally {
            setLoading(p => ({...p, saving: false}));
        }
    };

    const handleDownload = async () => {
        const res = await fetch('/api/health-centers/download');
        if (!res.ok) return toast({ title: 'Error', description: 'Could not download database.', variant: 'destructive' });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'health-center.db';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Health Worker Data</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/process/CMAM-cases"><ArrowLeft className="mr-2 h-4 w-4" />Back to Hub</Link>
                </Button>
            </div>
            <Card>
                <CardHeader><CardTitle>1. Select Project & Upload File</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={loading.projects}>
                        <SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt"/>
                </CardContent>
            </Card>

            {file && <Card>
                <CardHeader><CardTitle>2. Configure & Map</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Select value={selectedSheet} onValueChange={s => handleSheetSelect(s)}>
                        <SelectTrigger><SelectValue placeholder="Select Sheet..." /></SelectTrigger>
                        <SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                     <Button onClick={handleAutoMatch} variant="outline"><GitCompareArrows className="mr-2 h-4 w-4"/>Auto-match</Button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Unmapped File Column</Label>
                            <Select value={manualMapping.ui} onValueChange={v => setManualMapping(p => ({...p, ui: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedUiColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Unmapped DB Column</Label>
                            <Select value={manualMapping.db} onValueChange={v => setManualMapping(p => ({...p, db: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedDbColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select>
                        </div>
                        <Button onClick={handleAddManualMapping}><Plus className="mr-2 h-4 w-4"/>Add</Button>
                    </div>
                    <ScrollArea className="h-48 border rounded-md">
                        <Table><TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>DB Column</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                        <TableBody>{Array.from(columnMapping.entries()).map(([ui, db]) => <TableRow key={ui}><TableCell>{ui}</TableCell><TableCell>{db}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={()=>removeMapping(ui)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody></Table>
                    </ScrollArea>
                </CardContent>
            </Card>}

            <Card>
                <CardHeader><CardTitle>3. Save to Database</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleSave} disabled={loading.saving || !selectedProjectId || !file}><Save className="mr-2 h-4 w-4"/>Save to Database</Button>
                    {loading.saving && (
                        <div className="space-y-2">
                            <Progress value={saveProgress} />
                            <p className="text-sm text-muted-foreground">{saveStatus} ({saveStats.saved + saveStats.updated + saveStats.skipped} / {saveStats.total})</p>
                        </div>
                    )}
                    <Button onClick={handleDownload} variant="secondary"><FileDown className="mr-2 h-4 w-4"/>Download Database</Button>
                </CardContent>
            </Card>

            <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo(p => ({ ...p, isOpen }))}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Duplicates Found</AlertDialogTitle><AlertDialogDescription>
                        {duplicateInfo.count} records already exist in the database for this project (Total in DB: {duplicateInfo.totalInDb}). How to proceed?
                    </AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="outline" onClick={() => executeSave('skip')}>Skip Duplicates</Button>
                        <AlertDialogAction onClick={() => executeSave('replace')}>Update Existing & Add New</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
