"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveEnrollmentDataToCache, loadEnrollmentDataFromCache } from "@/lib/cache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  GitCompareArrows,
  Trash2,
  Plus,
  Save,
  Check,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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

const LOCAL_STORAGE_MAPPING_PREFIX = "enrollment-review-mapping-v2-";

const STATUS_LABELS: Record<string, string> = {
  generating_unique_id: "Generating unique identifier",
  normalizing_names: "Normalizing names",
  calculating_differences: "Calculating difference scores",
  similarity_and_clustering: "Computing similarities and clusters",
  caching_results: "Saving enriched data to cache",
  done: "DONE",
  idle: "Idle",
  error: "Error",
  saving: "Saving to database",
  initializing: "Preparing worker",
  checking_duplicates: "Validating duplicates",
};

const WORKER_COLUMN_KEYS = [
  "diff_per_bnf1",
  "diff_level_bnf1",
  "diff_per_bnf2",
  "diff_level_bnf2",
  "diff_per_bnf3",
  "diff_level_bnf3",
  "diff_per_bnf4",
  "diff_level_bnf4",
  "diff_per_bnf5",
  "diff_level_bnf5",
  "diff_per_bnf",
  "diff_level_bnf",
  "diff_per_hus1",
  "diff_level_hus1",
  "diff_per_hus2",
  "diff_level_hus2",
  "diff_per_hus3",
  "diff_level_hus3",
  "diff_per_hus4",
  "diff_level_hus4",
  "diff_per_hus5",
  "diff_level_hus5",
  "diff_per_hus",
  "diff_level_hus",
];

export default function EnrollmentReviewUploadPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rawFileData, setRawFileData] = useState<any[]>([]);
  const [uniqueIdFileCol, setUniqueIdFileCol] = useState("");
  const [enrichedColumns, setEnrichedColumns] = useState<string[]>([]);
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [dbColumnMapping, setDbColumnMapping] = useState<Map<string, string>>(new Map());
  const [uniqueIdDbCol, setUniqueIdDbCol] = useState("");
  const [manualDbMapping, setManualDbMapping] = useState({ ui: "", db: "" });
  const [loading, setLoading] = useState({ projects: true, caching: false, worker: false, saving: false, dbSchema: true });
  const [workerStatus, setWorkerStatus] = useState("idle");
  const [workerProgress, setWorkerProgress] = useState(0);
  const [saveStats, setSaveStats] = useState({ saved: 0, skipped: 0, updated: 0, total: 0 });
  const [duplicateInfo, setDuplicateInfo] = useState({ isOpen: false, count: 0, totalInFile: 0, totalInDb: 0 });
  const [mapSavedKey, setMapSavedKey] = useState("");
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [projRes, dbSchemaRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/enrollment-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_schema" }) }),
        ]);
        if (projRes.ok) setProjects(await projRes.json());
        if (dbSchemaRes.ok) {
          const schema = await dbSchemaRes.json();
          setDbColumns(schema.columns || []);
        }
      } catch (err: any) {
        toast({ title: "Error loading data", description: err.message, variant: "destructive" });
      } finally {
        setLoading((p) => ({ ...p, projects: false, dbSchema: false }));
      }
    };
    fetchInitialData();
    const worker = new Worker(new URL("@/workers/enrollment-review.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = async (event) => {
      const { type, status, progress, error, data } = event.data;
      if (type === "progress") {
        setWorkerStatus(status);
        setWorkerProgress(Math.round(progress));
      } else if (type === "done") {
        setWorkerStatus("done");
        setWorkerProgress(100);
        toast({ title: "Analysis Complete", description: `Processed ${data.processedCount} records.` });
        setLoading((p) => ({ ...p, worker: false }));
        const finalData = await loadEnrollmentDataFromCache();
        if (finalData && finalData.length > 0) {
          const unionKeys = new Set<string>();
          finalData.forEach((row) => Object.keys(row).forEach((key) => unionKeys.add(key)));
          WORKER_COLUMN_KEYS.forEach((key) => unionKeys.add(key));
          setEnrichedColumns(Array.from(unionKeys));
        }
      } else if (type === "error") {
        setWorkerStatus("error");
        setLoading((p) => ({ ...p, worker: false }));
        toast({ title: "Worker Error", description: error, variant: "destructive" });
      }
    };
    return () => worker.terminate();
  }, [toast]);

  useEffect(() => {
    const autoSaveToCache = async () => {
      if (rawFileData.length > 0 && selectedProjectId && uniqueIdFileCol) {
        setLoading((p) => ({ ...p, caching: true }));
        try {
          const project = projects.find((p) => p.projectId === selectedProjectId);
          if (!project) throw new Error("Selected project not found.");
          const dataToCache = rawFileData.map((row) => ({
            ...row,
            project_id: project.projectId,
            project_name: project.projectName,
          }));
          await saveEnrollmentDataToCache(dataToCache);
          toast({ title: "Data Ready", description: "Cached data is ready for analysis." });
        } catch (err: any) {
          toast({ title: "Caching Error", description: err.message, variant: "destructive" });
        } finally {
          setLoading((p) => ({ ...p, caching: false }));
        }
      }
    };
    autoSaveToCache();
  }, [rawFileData, selectedProjectId, uniqueIdFileCol, projects, toast]);

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      setSheets(workbook.SheetNames);
      setSelectedSheet(workbook.SheetNames[0] || "");
    };
    reader.readAsArrayBuffer(file);
  }, [file]);

  useEffect(() => {
    if (!file || !selectedSheet) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[selectedSheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        const headerRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headerColumns =
          Array.isArray(headerRows[0]) && headerRows[0].length > 0
            ? headerRows[0]
                .map((value) => (value ?? "").toString().trim())
                .filter((value) => value.length > 0)
            : [];
        const dataColumns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
        const combinedColumns = Array.from(new Set([...headerColumns, ...dataColumns]));
        setColumns(combinedColumns);
        setRawFileData(jsonData);
      } catch (err: any) {
        toast({ title: "Sheet Error", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [file, selectedSheet, toast]);

  useEffect(() => {
    const mappingKey = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-${file?.name || "default"}`;
    setMapSavedKey(mappingKey);
    if (!selectedProjectId || !file || typeof window === "undefined") return;
    const stored = localStorage.getItem(mappingKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUniqueIdFileCol(parsed.uniqueIdFileCol || "");
        setUniqueIdDbCol(parsed.uniqueIdDbCol || "");
        const newMap = new Map<string, string>(parsed.mappings || []);
        setDbColumnMapping(newMap);
      } catch {
        localStorage.removeItem(mappingKey);
      }
    } else {
      setDbColumnMapping(new Map());
      setUniqueIdDbCol("");
    }
  }, [selectedProjectId, file]);

  useEffect(() => {
    if (typeof window === "undefined" || !mapSavedKey) return;
    const payload = {
      uniqueIdFileCol,
      uniqueIdDbCol,
      mappings: Array.from(dbColumnMapping.entries()),
    };
    window.localStorage.setItem(mapSavedKey, JSON.stringify(payload));
  }, [dbColumnMapping, uniqueIdDbCol, uniqueIdFileCol, mapSavedKey]);

  const combinedEnrichedColumns = useMemo(() => {
    const set = new Set<string>(enrichedColumns);
    WORKER_COLUMN_KEYS.forEach((key) => set.add(key));
    return Array.from(set);
  }, [enrichedColumns]);

  const sourceColumns = combinedEnrichedColumns.length > 0 ? combinedEnrichedColumns : columns;
  const mappedUiColumns = useMemo(() => Array.from(dbColumnMapping.keys()), [dbColumnMapping]);
  const usedDbColumns = useMemo(() => new Set([...dbColumnMapping.values(), uniqueIdDbCol]), [dbColumnMapping, uniqueIdDbCol]);
  const unmappedUiColumns = sourceColumns.filter((col) => !mappedUiColumns.includes(col) && col !== uniqueIdFileCol);
  const unmappedDbColumns = dbColumns.filter((col) => !usedDbColumns.has(col));

  const handleRunAnalysis = useCallback(() => {
    if (!workerRef.current) return;
    if (!uniqueIdFileCol) {
      toast({ title: "Unique ID Required", description: "Select the unique ID column before running analysis.", variant: "destructive" });
      return;
    }
    setLoading((p) => ({ ...p, worker: true }));
    setWorkerStatus("initializing");
    setWorkerProgress(0);
    workerRef.current.postMessage({ uniqueIdCol: uniqueIdFileCol });
  }, [toast, uniqueIdFileCol]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setSheets([]);
      setSelectedSheet("");
      setColumns([]);
      setRawFileData([]);
      setUniqueIdFileCol("");
      setEnrichedColumns([]);
      setDbColumnMapping(new Map());
      setUniqueIdDbCol("");
    }
  };

  const handleAutoMatch = useCallback(() => {
    const newMapping = new Map<string, string>();
    const usedDb = new Set<string>();
    sourceColumns.forEach((uiCol) => {
      const normalizedUi = uiCol.toLowerCase().replace(/_/g, "");
      const match = dbColumns.find((dbCol) => !usedDb.has(dbCol) && dbCol.toLowerCase().replace(/_/g, "") === normalizedUi);
      if (match) {
        newMapping.set(uiCol, match);
        usedDb.add(match);
      }
    });
    setDbColumnMapping(newMapping);
    toast({ title: "Auto-mapping saved", description: `${newMapping.size} columns matched.` });
  }, [dbColumns, sourceColumns, toast]);

  const handleAddDbMapping = () => {
    if (manualDbMapping.ui && manualDbMapping.db) {
      setDbColumnMapping((prev) => {
        const updated = new Map(prev);
        updated.set(manualDbMapping.ui, manualDbMapping.db);
        return updated;
      });
      setManualDbMapping({ ui: "", db: "" });
    }
  };

  const handleDeleteDbMapping = (key: string) => {
    setDbColumnMapping((prev) => {
      const updated = new Map(prev);
      updated.delete(key);
      return updated;
    });
  };

  const persistMappingNow = () => {
    if (typeof window === "undefined" || !mapSavedKey) return;
    const payload = {
      uniqueIdFileCol,
      uniqueIdDbCol,
      mappings: Array.from(dbColumnMapping.entries()),
    };
    window.localStorage.setItem(mapSavedKey, JSON.stringify(payload));
    toast({ title: "Mapping saved", description: "Column mapping stored for this project and file." });
  };

  const executeSave = useCallback(
    async (mode: "skip" | "replace", duplicateContext?: { duplicates: number; totalInDb: number }) => {
      setDuplicateInfo((prev) => ({ ...prev, isOpen: false }));
      setLoading((p) => ({ ...p, saving: true }));
      setWorkerStatus("saving");
      let totalSaved = 0;
      let totalSkipped = 0;
      let totalUpdated = 0;
      try {
        const cachedRecords = await loadEnrollmentDataFromCache();
        if (!cachedRecords) throw new Error("No cached data to save.");
        if (mode === "skip" && duplicateContext?.duplicates === duplicateContext?.totalInDb && duplicateContext?.totalInDb) {
          toast({ title: "All records already exist", description: "No new records to save.", variant: "destructive" });
          setLoading((p) => ({ ...p, saving: false }));
          setWorkerStatus("idle");
          return;
        }
        const totalToProcess = cachedRecords.length;
        const CHUNK_SIZE = 500;
        for (let i = 0; i < totalToProcess; i += CHUNK_SIZE) {
          const chunk = cachedRecords.slice(i, i + CHUNK_SIZE);
          const payloadRecords = chunk.map((record) => {
            const payload: Record<string, any> = { project_id: selectedProjectId };
            dbColumnMapping.forEach((dbCol, uiCol) => {
              if (record.hasOwnProperty(uiCol)) {
                payload[dbCol] = record[uiCol];
              }
            });
            if (uniqueIdDbCol && record.hasOwnProperty(uniqueIdFileCol)) {
              payload[uniqueIdDbCol] = record[uniqueIdFileCol];
            }
            return payload;
          });
          const response = await fetch("/api/enrollment-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save", projectId: selectedProjectId, records: payloadRecords, mode, uniqueIdCol: uniqueIdDbCol }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.details || "Failed to save records.");
          totalSaved += result.saved || 0;
          totalSkipped += result.skipped || 0;
          totalUpdated += result.updated || 0;
          setSaveStats({ saved: totalSaved, skipped: totalSkipped, updated: totalUpdated, total: totalToProcess });
          setWorkerProgress(Math.round(((i + chunk.length) / totalToProcess) * 100));
        }
        toast({
          title: "Save Completed",
          description: `Saved: ${totalSaved}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}`,
        });
        setWorkerStatus("done");
      } catch (err: any) {
        toast({ title: "Save Error", description: err.message, variant: "destructive" });
        setWorkerStatus("error");
      } finally {
        setLoading((p) => ({ ...p, saving: false }));
      }
    },
    [dbColumnMapping, selectedProjectId, uniqueIdDbCol, uniqueIdFileCol, toast]
  );

  const handleSaveToDatabase = useCallback(async () => {
    if (!uniqueIdDbCol) {
      toast({ title: "Unique ID Missing", description: "Map the unique ID column for the database first.", variant: "destructive" });
      return;
    }
    setLoading((p) => ({ ...p, saving: true }));
    setWorkerStatus("checking_duplicates");
    try {
      const cachedRecords = await loadEnrollmentDataFromCache();
      if (!cachedRecords) throw new Error("No cached data to check.");
      const uniqueIds = cachedRecords.map((r) => r[uniqueIdFileCol]).filter(Boolean);
      const response = await fetch("/api/enrollment-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_duplicates", projectId: selectedProjectId, uniqueIdCol: uniqueIdDbCol, uniqueIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || "Failed to check duplicates.");
      if (result.count > 0) {
        setDuplicateInfo((prev) => ({
          ...prev,
          isOpen: true,
          count: result.count,
          totalInFile: cachedRecords.length,
          totalInDb: result.totalInDb || 0,
        }));
      } else {
        await executeSave("skip", { duplicates: 0, totalInDb: result.totalInDb || 0 });
      }
    } catch (err: any) {
      toast({ title: "Duplicate Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading((p) => ({ ...p, saving: false }));
      setWorkerStatus("idle");
    }
  }, [executeSave, selectedProjectId, uniqueIdDbCol, uniqueIdFileCol, toast]);

  const statusLabel = STATUS_LABELS[workerStatus] || workerStatus;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Enrollment Review: Upload & Process</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/enrollment/review">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Review Hub
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Upload & Configure Data</CardTitle>
          <CardDescription>Select the project, upload the file, choose the sheet and unique identifier.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Project</Label>
              <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects || loading.caching}>
                <SelectTrigger>
                  <SelectValue placeholder={loading.projects ? "Loading..." : "Select project..."} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.projectId} value={project.projectId}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Upload File</Label>
              <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" disabled={loading.caching} />
            </div>
            {sheets.length > 0 && (
              <div className="space-y-2">
                <Label>Select Sheet</Label>
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sheet..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((sheet) => (
                      <SelectItem key={sheet} value={sheet}>
                        {sheet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {file && selectedSheet && (
              <div className="space-y-2">
                <Label>Select Unique ID Column</Label>
                <Select value={uniqueIdFileCol} onValueChange={setUniqueIdFileCol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unique ID..." />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Run Analysis</CardTitle>
          <CardDescription>Detect name modifications, similarity, and clustering through the worker.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <Button onClick={handleRunAnalysis} disabled={loading.worker || loading.caching || rawFileData.length === 0}>
              {loading.worker ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {workerStatus === "done" ? "Analysis Complete" : loading.worker ? "Analyzing..." : "Run Analysis"}
            </Button>
            <div className="text-sm text-muted-foreground">Current task: {statusLabel}</div>
            {(loading.worker || workerStatus === "done") && (
              <div className="space-y-1">
                <Progress value={workerProgress} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress: {workerProgress}%</span>
                  <span>{workerStatus === "done" ? "DONE" : "Working"}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Auto + Manual Column Mapping</CardTitle>
          <CardDescription>Map enriched columns from the cache to `enrollment-review.db`, then persist the mapping per file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <Button onClick={handleAutoMatch} disabled={sourceColumns.length === 0 || dbColumns.length === 0}>
              <GitCompareArrows className="mr-2 h-4 w-4" />
              Auto-match
            </Button>
            <Button variant="outline" onClick={persistMappingNow}>
              <Save className="mr-2 h-4 w-4" />
              Save Mapping
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border bg-muted/50">
            <div className="space-y-2">
              <Label>Unique ID (Cache / Worker)</Label>
              <Select value={uniqueIdFileCol} onValueChange={setUniqueIdFileCol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source column..." />
                </SelectTrigger>
                <SelectContent>
                  {sourceColumns.map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unique ID (Database)</Label>
              <Select value={uniqueIdDbCol} onValueChange={setUniqueIdDbCol} disabled={loading.dbSchema}>
                <SelectTrigger>
                  <SelectValue placeholder={loading.dbSchema ? "Loading..." : "Select DB column..."} />
                </SelectTrigger>
                <SelectContent>
                  {dbColumns.map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Source Column (Cache/File)</Label>
              <Select value={manualDbMapping.ui} onValueChange={(value) => setManualDbMapping((prev) => ({ ...prev, ui: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select remaining column..." />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-60">
                    {unmappedUiColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Destination Column (DB)</Label>
              <Select value={manualDbMapping.db} onValueChange={(value) => setManualDbMapping((prev) => ({ ...prev, db: value }))} disabled={loading.dbSchema}>
                <SelectTrigger>
                  <SelectValue placeholder={loading.dbSchema ? "Loading..." : "Select database field..."} />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-60">
                    {unmappedDbColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddDbMapping} disabled={!manualDbMapping.ui || !manualDbMapping.db}>
              <Plus className="mr-2 h-4 w-4" />
              Add Mapping
            </Button>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Mapped Columns</h4>
            <ScrollArea className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Column</TableHead>
                    <TableHead>DB Field</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-accent/10">
                    <TableCell>{uniqueIdFileCol || "—"}</TableCell>
                    <TableCell>{uniqueIdDbCol || "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setUniqueIdFileCol("");
                          setUniqueIdDbCol("");
                        }}
                        disabled={!uniqueIdFileCol && !uniqueIdDbCol}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {Array.from(dbColumnMapping.entries()).map(([uiCol, dbCol]) => (
                    <TableRow key={uiCol}>
                      <TableCell>{uiCol}</TableCell>
                      <TableCell>{dbCol}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteDbMapping(uiCol)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Save to `enrollment-review.db`</CardTitle>
          <CardDescription>Validate duplicates by unique ID, then save or update depending on your choice.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              onClick={handleSaveToDatabase}
              disabled={loading.saving || !uniqueIdFileCol || !uniqueIdDbCol || !selectedProjectId}
            >
              {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save to Database
            </Button>
            <div className="space-y-1">
              <Progress
                value={
                  saveStats.total > 0
                    ? Math.min(100, Math.round(((saveStats.saved + saveStats.updated + saveStats.skipped) / saveStats.total) * 100))
                    : 0
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Records processed: {saveStats.saved + saveStats.updated + saveStats.skipped}/{saveStats.total || rawFileData.length || 0}
                </span>
                <span>
                  Saved {saveStats.saved} / Updated {saveStats.updated} / Skipped {saveStats.skipped}
                </span>
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {workerStatus === "saving" ? "Validating and sending records..." : "Ready to commit mapped data."}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo((prev) => ({ ...prev, isOpen }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateInfo.count} records already exist for this project (total in DB: {duplicateInfo.totalInDb}). Choose how to proceed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => executeSave("skip", { duplicates: duplicateInfo.count, totalInDb: duplicateInfo.totalInDb })}
            >
              Skip duplicates and save new records
            </Button>
            <Button
              onClick={() => executeSave("replace", { duplicates: duplicateInfo.count, totalInDb: duplicateInfo.totalInDb })}
            >
              Update existing and add new records
            </Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" asChild>
          <Link href="/meal-system/monitoring/implementation/enrollment/review/recommendation">Go to Recommendation</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/meal-system/monitoring/implementation/enrollment/review/dashboard">Go to Dashboard</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/meal-system/monitoring/implementation/enrollment/review/download">Go to Download</Link>
        </Button>
      </div>
    </div>
  );
}