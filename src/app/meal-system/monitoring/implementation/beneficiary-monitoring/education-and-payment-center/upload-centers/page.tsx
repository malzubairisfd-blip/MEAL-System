// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/upload-centers/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, ArrowLeft, Save, Loader2, GitCompareArrows, Trash2, Plus, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
    "id", "project_id", "project_name", "proj_no", "mud_no", "mud_name",
    "ozla_no", "ozla_name", "vill_no", "vill_name", "fac_id", "fac_name",
    "loc_id", "loc_full_name", "is_ec", "is_pc", "pc_id", "notes",
    "pc_name2", "is_pc2", "pc_loc2", "same_ozla", "same_ec_pc",
    "pc_ec_cnt", "pc_ed_cnt", "ec_ed_cnt", "pc_bnf_cnt", "ec_bnf_cnt"
];


export default function UploadCentersPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [loadingProjects, setLoadingProjects] = useState(true);

    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    
    const [columns, setColumns] = useState<string[]>([]);
    const [rawFileData, setRawFileData] = useState<any[]>([]);

    const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
    const [manualMapping, setManualMapping] = useState({ ui: '', db: '' });

    const [duplicateDialog, setDuplicateDialog] = useState({ isOpen: false, duplicates: [], nonDuplicates: [] });

    useEffect(() => {
        const fetchProjects = async () => {
            setLoadingProjects(true);
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                const data = await res.json();
                setProjects(Array.isArray(data) ? data : []);
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoadingProjects(false);
            }
        };
        fetchProjects();
    }, [toast]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const f = e.target.files[0];
            setFile(f);
            const reader = new FileReader();
            reader.onload = (event) => {
                const workbook = XLSX.read(event.target?.result, { type: 'binary' });
                setSheets(workbook.SheetNames);
                if (workbook.SheetNames.length > 0) {
                    handleSheetSelect(workbook.SheetNames[0], f);
                }
            };
            reader.readAsBinaryString(f);
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
            setRawFileData(jsonData);
            const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];
            const filteredHeaders = headers.filter(h => h && h.trim() !== '');
            setColumns(filteredHeaders);
        };
        reader.readAsBinaryString(selectedFile);
    }
    
    const handleAutoMatch = () => {
      const newMapping = new Map<string, string>();
      const usedDbCols = new Set<string>();

      columns.forEach(uiCol => {
          const matchedDbCol = DB_COLUMNS.find(dbCol => 
              dbCol.toLowerCase().replace(/_/g, '') === uiCol.toLowerCase().replace(/_/g, '').replace(/\s/g, '') && !usedDbCols.has(dbCol)
          );
          if(matchedDbCol) {
              newMapping.set(uiCol, matchedDbCol);
              usedDbCols.add(matchedDbCol);
          }
      });
      setColumnMapping(newMapping);
      toast({ title: "Auto-match Complete", description: `${newMapping.size} columns were matched automatically.`});
    };

    const unmappedUiColumns = useMemo(() => columns.filter(col => !Array.from(columnMapping.keys()).includes(col)), [columns, columnMapping]);
    const unmappedDbColumns = useMemo(() => {
        const mappedDbCols = new Set(columnMapping.values());
        return DB_COLUMNS.filter(col => !mappedDbCols.has(col) && col !== 'project_id' && col !== 'project_name');
    }, [columnMapping]);

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

    const removeMapping = (sourceKey: string) => {
        const newMap = new Map(columnMapping);
        newMap.delete(sourceKey);
        setColumnMapping(newMap);
    };

    const executeSave = async (recordsToSave: any[], isOverwrite: boolean) => {
        if (!selectedProjectId) {
            toast({ title: "Save Aborted", description: "Project ID was lost. Please re-select the project.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        const selectedProjectData = projects.find(p => p.projectId === selectedProjectId);
        if (!selectedProjectData) {
            toast({ title: "Project not found", variant: "destructive" });
            setIsSaving(false);
            return;
        }

        const payload = recordsToSave.map(row => {
            const newRecord: {[key: string]: any} = {};
            
            // First, copy all mapped values directly.
            for (const [uiCol, dbCol] of columnMapping.entries()) {
                const value = row[uiCol];
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        newRecord[dbCol] = value.join(', ');
                    } else {
                        newRecord[dbCol] = value;
                    }
                }
            }

            // Then, specifically process `is_ec` and `is_pc` for boolean conversion,
            // ensuring a default of 0.
            ['is_ec', 'is_pc'].forEach(key => {
                const mappedUiCol = [...columnMapping.entries()].find(([k,v]) => v === key)?.[0];
                const rawValue = mappedUiCol ? row[mappedUiCol] : undefined;
                const valStr = String(rawValue ?? '').trim().toLowerCase();

                if (valStr === '1' || valStr === 'yes' || valStr === 'true') {
                    newRecord[key] = 1;
                } else {
                    newRecord[key] = 0;
                }
            });

            newRecord.project_id = selectedProjectId;
            newRecord.project_name = selectedProjectData.projectName;
            return newRecord;
        });

        try {
            const response = await fetch('/api/education-payment-centers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to save centers file.');
            }

            toast({ title: "Success!", description: `Education and Payment Center data has been saved. ${result.count} records processed.` });
            if (isOverwrite) {
                setFile(null); setColumns([]); setColumnMapping(new Map()); setSheets([]); setSelectedSheet('');
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
            setDuplicateDialog({ isOpen: false, duplicates: [], nonDuplicates: [] });
        }
    };


    const handleSave = async () => {
        if (!file || !selectedProjectId || columnMapping.size === 0) {
            toast({ title: "Incomplete Configuration", description: "Please select a project, upload a file, and map at least one column.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const existingRes = await fetch('/api/education-payment-centers');
            if (!existingRes.ok) throw new Error("Could not check existing centers.");
            const existingCenters: any[] = await existingRes.json();
            const existingNames = new Set(existingCenters.map(c => c.fac_name));

            const facNameMappedColumn = Array.from(columnMapping.entries()).find(([uiCol, dbCol]) => dbCol === 'fac_name')?.[0];
            if (!facNameMappedColumn) throw new Error("Please map a source column to 'fac_name' to check for duplicates.");
            
            const duplicates = rawFileData.filter(row => existingNames.has(row[facNameMappedColumn]));
            const nonDuplicates = rawFileData.filter(row => !existingNames.has(row[facNameMappedColumn]));

            if (duplicates.length > 0) {
                setDuplicateDialog({ isOpen: true, duplicates, nonDuplicates });
            } else {
                await executeSave(rawFileData, true);
            }
        } catch (error: any) {
             toast({ title: "Error during pre-save check", description: error.message, variant: "destructive" });
             setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Upload Education & Payment Centers</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader><CardTitle>1. Select Project</CardTitle></CardHeader>
                <CardContent>
                     <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loadingProjects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loadingProjects ? "Loading..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>2. Upload and Select Sheet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <label htmlFor="file-upload" className="flex-1">
                        <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                                <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                                {file ? (
                                  <p className="font-semibold text-primary">{file.name}</p>
                                ) : (
                                  <>
                                   <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                   <p className="text-xs text-muted-foreground">XLS, XLSX, XLSM, XLSB, CSV, TXT</p>
                                  </>
                                )}
                            </div>
                            <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />
                        </div>
                    </label>
                    {sheets.length > 0 && (
                        <div className="w-full md:w-1/2">
                            <Label>Select Sheet</Label>
                            <Select value={selectedSheet} onValueChange={handleSheetSelect}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {columns.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>3. Map Columns</CardTitle>
                        <CardDescription>Match columns from your sheet to the database columns.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4"/>Auto-match Columns</Button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader><CardTitle className="text-base">Current Mappings</CardTitle></CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-48 border rounded-md">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Source Column</TableHead><TableHead>Destination Column</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {Array.from(columnMapping.entries()).map(([uiCol, dbCol]) => (
                                                    <TableRow key={uiCol}>
                                                        <TableCell>{uiCol}</TableCell>
                                                        <TableCell>{dbCol}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => removeMapping(uiCol)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                             <Card>
                                <CardHeader><CardTitle className="text-base">Manual Mapping</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="space-y-2">
                                        <Label>Unmapped Source Column</Label>
                                        <Select value={manualMapping.ui} onValueChange={v => setManualMapping(m => ({ ...m, ui: v}))}>
                                            <SelectTrigger><SelectValue placeholder="Select Source..." /></SelectTrigger>
                                            <SelectContent><ScrollArea className="h-40">{unmappedUiColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                                        </Select>
                                    </div>
                                     <div className="space-y-2">
                                        <Label>Unmapped Destination Column</Label>
                                        <Select value={manualMapping.db} onValueChange={v => setManualMapping(m => ({ ...m, db: v}))}>
                                            <SelectTrigger><SelectValue placeholder="Select Destination..." /></SelectTrigger>
                                            <SelectContent><ScrollArea className="h-40">{unmappedDbColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleAddManualMapping} className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Manual Mapping</Button>
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>4. Save Data</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleSave} disabled={!file || isSaving || !selectedProjectId}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save to Database
                    </Button>
                </CardContent>
            </Card>

            <AlertDialog open={duplicateDialog.isOpen} onOpenChange={(isOpen) => setDuplicateDialog(prev => ({...prev, isOpen}))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                        <AlertDialogDescription>
                            Found {duplicateDialog.duplicates.length} center(s) in your upload that already exist in the database based on Facility Name. How would you like to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsSaving(false)}>Cancel</AlertDialogCancel>
                        <Button variant="outline" onClick={() => executeSave(duplicateDialog.nonDuplicates, false)}>
                            Skip Duplicates
                        </Button>
                        <AlertDialogAction onClick={() => executeSave([...duplicateDialog.nonDuplicates, ...duplicateDialog.duplicates], true)}>
                            Replace Existing
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
