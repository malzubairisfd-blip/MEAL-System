//src/app/meal-system/monitoring/implementation/process/monthly-health-sessions/upload/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, Trash2, ArrowLeft, CheckCircle, BarChart2, Database, Users, Activity, UserCheck, UserMinus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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

const KeyFiguresCard = ({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) => (
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

export default function MonthlySessionsUploadPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [appearanceSheet, setAppearanceSheet] = useState("");
  const [absenceSheet, setAbsenceSheet] = useState("");
  const [appearanceColumns, setAppearanceColumns] = useState<string[]>([]);
  const [absenceColumns, setAbsenceColumns] = useState<string[]>([]);
  const [appearanceData, setAppearanceData] = useState<any[]>([]);
  const [absenceData, setAbsenceData] = useState<any[]>([]);
  const [sessionNumber, setSessionNumber] = useState(1);
  const [sessionDate, setSessionDate] = useState({ day: "", month: "", year: "" });
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [appearanceMapping, setAppearanceMapping] = useState<Map<string, string>>(new Map());
  const [absenceMapping, setAbsenceMapping] = useState<Map<string, string>>(new Map());
  const [manualAppearanceMapping, setManualAppearanceMapping] = useState({ ui: "", db: "" });
  const [manualAbsenceMapping, setManualAbsenceMapping] = useState({ ui: "", db: "" });
  const [loading, setLoading] = useState({ projects: true, saving: false, dbSchema: true });
  const [workerStatus, setWorkerStatus] = useState("idle");
  const [workerProgress, setWorkerProgress] = useState(0);
  const [workerMessage, setWorkerMessage] = useState("");
  const [results, setResults] = useState<null | { totalAppearance: number; totalAttend: number; totalAbsence: number; totalAlternative: number }>(null);
  const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
  const [duplicateInfo, setDuplicateInfo] = useState({ isOpen: false, count: 0, totalInDb: 0, duplicateIds: [] as string[] });
  const [fileUniqueIdColumn, setFileUniqueIdColumn] = useState("");
  const [dbUniqueIdColumn, setDbUniqueIdColumn] = useState("benef_id");

  useEffect(() => {
    setLoading((p) => ({ ...p, projects: true }));
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .finally(() => setLoading((p) => ({ ...p, projects: false })));
    setLoading((p) => ({ ...p, dbSchema: true }));
    fetch("/api/monthly-health-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_schema" }) })
      .then((res) => res.json())
      .then((data) => setDbColumns(data.columns || []))
      .finally(() => setLoading((p) => ({ ...p, dbSchema: false })));
  }, []);

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: "binary" });
      setSheets(wb.SheetNames);
    };
    reader.readAsBinaryString(file);
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setSheets([]);
      setAppearanceSheet("");
      setAbsenceSheet("");
      setAppearanceData([]);
      setAbsenceData([]);
      setAppearanceColumns([]);
      setAbsenceColumns([]);
      setFileUniqueIdColumn("");
      setResults(null);
    }
  };

  const handleSheetSelect = (type: "appearance" | "absence", sheetName: string) => {
    if (!file) return;
    if (type === "appearance") setAppearanceSheet(sheetName);
    if (type === "absence") setAbsenceSheet(sheetName);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: "binary" });
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws);
      const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];
      if (type === "appearance") {
        setAppearanceData(data);
        setAppearanceColumns(headers);
      } else {
        setAbsenceData(data);
        setAbsenceColumns(headers);
      }
    };
    reader.readAsBinaryString(file);
    setResults(null);
  };

  const targetDbColumns = useMemo(() => {
    if (!dbColumns.length) return [];
    const suffix = `_s${sessionNumber}`;
    return dbColumns.filter((c) => c === "benef_id" || c.endsWith(suffix));
  }, [dbColumns, sessionNumber]);

  useEffect(() => {
    setAppearanceMapping((prev) => {
      const entries = Array.from(prev.entries()).filter(([, db]) => targetDbColumns.includes(db));
      if (entries.length === prev.size) return prev;
      return new Map(entries);
    });
  }, [targetDbColumns]);

  useEffect(() => {
    setAbsenceMapping((prev) => {
      const entries = Array.from(prev.entries()).filter(([, db]) => targetDbColumns.includes(db));
      if (entries.length === prev.size) return prev;
      return new Map(entries);
    });
  }, [targetDbColumns]);

  const getMappingStorageKey = (type: "appearance" | "absence") => {
    if (!selectedProjectId || !file?.name) return null;
    return `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-${file.name}-s${sessionNumber}-${type}`;
  };

  useEffect(() => {
    const key = getMappingStorageKey("appearance");
    if (!key) {
      setAppearanceMapping(new Map());
      return;
    }
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setAppearanceMapping(new Map(JSON.parse(stored)));
      } catch {
        setAppearanceMapping(new Map());
      }
    } else {
      setAppearanceMapping(new Map());
    }
  }, [selectedProjectId, file?.name, sessionNumber]);

  useEffect(() => {
    const key = getMappingStorageKey("absence");
    if (!key) {
      setAbsenceMapping(new Map());
      return;
    }
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setAbsenceMapping(new Map(JSON.parse(stored)));
      } catch {
        setAbsenceMapping(new Map());
      }
    } else {
      setAbsenceMapping(new Map());
    }
  }, [selectedProjectId, file?.name, sessionNumber]);

  useEffect(() => {
    const key = getMappingStorageKey("appearance");
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(Array.from(appearanceMapping.entries())));
  }, [appearanceMapping, selectedProjectId, file?.name, sessionNumber]);

  useEffect(() => {
    const key = getMappingStorageKey("absence");
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(Array.from(absenceMapping.entries())));
  }, [absenceMapping, selectedProjectId, file?.name, sessionNumber]);

  const availableFileColumns = useMemo(() => Array.from(new Set([...appearanceColumns, ...absenceColumns])), [appearanceColumns, absenceColumns]);

  useEffect(() => {
    if (!fileUniqueIdColumn && availableFileColumns.length) {
      setFileUniqueIdColumn(availableFileColumns[0]);
    }
  }, [availableFileColumns, fileUniqueIdColumn]);

  useEffect(() => {
    if (dbColumns.includes("benef_id")) {
      setDbUniqueIdColumn("benef_id");
    } else if (!dbUniqueIdColumn && dbColumns.length) {
      setDbUniqueIdColumn(dbColumns[0]);
    }
  }, [dbColumns, dbUniqueIdColumn]);

  useEffect(() => {
    setManualAppearanceMapping({ ui: "", db: "" });
    setManualAbsenceMapping({ ui: "", db: "" });
  }, [sessionNumber, availableFileColumns.length, targetDbColumns.length]);

  useEffect(() => {
    setResults(null);
  }, [file, sessionNumber, appearanceSheet, absenceSheet, fileUniqueIdColumn, dbUniqueIdColumn]);

  const unmappedAppearanceFileCols = useMemo(
    () => appearanceColumns.filter((c) => !Array.from(appearanceMapping.keys()).includes(c)),
    [appearanceColumns, appearanceMapping]
  );

  const unmappedAppearanceDbCols = useMemo(
    () => targetDbColumns.filter((c) => !Array.from(appearanceMapping.values()).includes(c)),
    [targetDbColumns, appearanceMapping]
  );

  const unmappedAbsenceFileCols = useMemo(
    () => absenceColumns.filter((c) => !Array.from(absenceMapping.keys()).includes(c)),
    [absenceColumns, absenceMapping]
  );

  const unmappedAbsenceDbCols = useMemo(
    () => targetDbColumns.filter((c) => !Array.from(absenceMapping.values()).includes(c)),
    [targetDbColumns, absenceMapping]
  );

  const handleAddAppearanceMapping = () => {
    if (manualAppearanceMapping.ui && manualAppearanceMapping.db) {
      const newMap = new Map(appearanceMapping);
      newMap.set(manualAppearanceMapping.ui, manualAppearanceMapping.db);
      setAppearanceMapping(newMap);
      setManualAppearanceMapping({ ui: "", db: "" });
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
      setManualAbsenceMapping({ ui: "", db: "" });
    }
  };

  const handleDeleteAbsenceMapping = (key: string) => {
    const newMap = new Map(absenceMapping);
    newMap.delete(key);
    setAbsenceMapping(newMap);
  };

  const formatSessionDate = () => {
    const { day, month, year } = sessionDate;
    if (!day || !month || !year) return "";
    const paddedDay = day.padStart(2, "0");
    const paddedMonth = month.padStart(2, "0");
    return `${year}-${paddedMonth}-${paddedDay}`;
  };

  const isProcessing = loading.saving;
  const statusLabel = STATUS_LABELS[workerStatus] || workerStatus;

  const executeSave = async (mode: "skip" | "replace") => {
    setDuplicateInfo((prev) => ({ ...prev, isOpen: false }));
    setLoading((prev) => ({ ...prev, saving: true }));
    setWorkerStatus("initializing");
    setWorkerProgress(0);
    setWorkerMessage("");
    setResults(null);

    try {
      const response = await fetch("/api/monthly-health-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          projectId: selectedProjectId,
          sessionNumber,
          sessionDate: formatSessionDate(),
          appearanceData,
          appearanceMapping: Object.fromEntries(appearanceMapping),
          absenceData,
          absenceMapping: Object.fromEntries(absenceMapping),
          mode,
          duplicateIds: duplicateInfo.duplicateIds,
          fileLookupColumn: fileUniqueIdColumn,
          dbLookupColumn: dbUniqueIdColumn,
        }),
      });

      if (!response.body) throw new Error("No response stream from server.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n").filter((line) => line.startsWith("data: "));
        for (const line of lines) {
          const jsonStr = line.replace("data: ", "");
          const data = JSON.parse(jsonStr);
          if (data.type === "progress") {
            setWorkerStatus(data.status);
            setWorkerProgress(data.progress);
            setWorkerMessage(data.message);
            if (data.stats) {
              setSaveStats(data.stats);
            }
          } else if (data.type === "done") {
            setWorkerStatus("done");
            setWorkerProgress(100);
            if (data.stats) setSaveStats(data.stats);
            if (data.metrics) {
              setResults({
                totalAppearance: data.metrics.totalAppearance || 0,
                totalAttend: data.metrics.totalAttend || 0,
                totalAbsence: data.metrics.totalAbsence || 0,
                totalAlternative: data.metrics.totalAlternative || 0,
              });
            }
            toast({ title: "Success", description: data.message });
            await new Promise((resolve) => setTimeout(resolve, 0));
            break;
          } else if (data.type === "error") {
            throw new Error(data.error);
          }
        }
      }
    } catch (error: any) {
      setWorkerStatus("error");
      toast({ title: "Error during processing", description: error.message, variant: "destructive" });
    } finally {
      setLoading((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleSave = async () => {
    if (!selectedProjectId) {
      toast({ title: "Missing Project", description: "Select a project before saving.", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "File Required", description: "Upload a file before saving.", variant: "destructive" });
      return;
    }
    if (!fileUniqueIdColumn) {
      toast({ title: "Unique ID Missing", description: "Select a column from the upload file to use as unique_id.", variant: "destructive" });
      return;
    }
    if (!dbUniqueIdColumn) {
      toast({ title: "Database Unique ID Missing", description: "Select a column from the database to use as unique_id.", variant: "destructive" });
      return;
    }
    if (!availableFileColumns.includes(fileUniqueIdColumn)) {
      toast({ title: "Unique ID Column Invalid", description: "The selected unique_id column is not present in the uploaded sheets.", variant: "destructive" });
      return;
    }
    const formatDate = formatSessionDate();
    if (!formatDate) {
      toast({ title: "Session Date Missing", description: "Provide day, month, and year for the session general date.", variant: "destructive" });
      return;
    }
    setLoading((prev) => ({ ...prev, saving: true }));
    try {
      const uniqueIds = Array.from(
        new Set(
          [
            ...appearanceData.map((row) => row[fileUniqueIdColumn]),
            ...absenceData.map((row) => row[fileUniqueIdColumn]),
          ]
            .filter(Boolean)
            .map((value) => String(value).trim())
        )
      );
      const res = await fetch("/api/monthly-health-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_duplicates", projectId: selectedProjectId, uniqueIds, uniqueIdCol: dbUniqueIdColumn }),
      });
      if (!res.ok) throw new Error("Failed to check for duplicates.");
      const { count, totalInDb, duplicateIds } = await res.json();
      setDuplicateInfo((prev) => ({ ...prev, count, totalInDb, duplicateIds }));
      if (count > 0) {
        setDuplicateInfo((prev) => ({ ...prev, isOpen: true }));
        return;
      }
      await executeSave("replace");
    } catch (error: any) {
      toast({ title: "Validation Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading((prev) => ({ ...prev, saving: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Upload Monthly Health Sessions Data</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Hub
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Select Project & Upload File</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
            <SelectTrigger>
              <SelectValue placeholder="Select Project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />
        </CardContent>
      </Card>

      {file && (
        <Card>
          <CardHeader>
            <CardTitle>2. Configure Session & Sheets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Session Number</Label>
                <Input
                  type="number"
                  min="1"
                  max="76"
                  value={sessionNumber}
                  onChange={(e) => setSessionNumber(Math.max(1, Math.min(76, Number(e.target.value))))}
                />
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Session General Date</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" placeholder="DD" value={sessionDate.day} onChange={(e) => setSessionDate((d) => ({ ...d, day: e.target.value }))} />
                  <Input type="number" placeholder="MM" value={sessionDate.month} onChange={(e) => setSessionDate((d) => ({ ...d, month: e.target.value }))} />
                  <Input type="number" placeholder="YYYY" value={sessionDate.year} onChange={(e) => setSessionDate((d) => ({ ...d, year: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Beneficiary Appearance Sheet</Label>
                <Select onValueChange={(v) => handleSheetSelect("appearance", v)} value={appearanceSheet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sheet..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Beneficiary Absence Sheet</Label>
                <Select onValueChange={(v) => handleSheetSelect("absence", v)} value={absenceSheet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sheet..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unique ID from Upload File</Label>
                <Select value={fileUniqueIdColumn} onValueChange={setFileUniqueIdColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-60">
                      {availableFileColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unique ID from Database</Label>
                <Select value={dbUniqueIdColumn} onValueChange={setDbUniqueIdColumn} disabled={!dbColumns.length}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-60">
                      {dbColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {appearanceSheet && (
        <Card>
          <CardHeader>
            <CardTitle>Appearance Data Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Unmapped File Column</Label>
                <Select value={manualAppearanceMapping.ui} onValueChange={(v) => setManualAppearanceMapping((m) => ({ ...m, ui: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select file column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-60">
                      {unmappedAppearanceFileCols.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target DB Column</Label>
                <Select value={manualAppearanceMapping.db} onValueChange={(v) => setManualAppearanceMapping((m) => ({ ...m, db: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select db column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-60">
                      {unmappedAppearanceDbCols.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddAppearanceMapping} disabled={!manualAppearanceMapping.ui || !manualAppearanceMapping.db}>
                <Plus className="mr-2 h-4 w-4" />
                Add Mapping
              </Button>
            </div>
            <ScrollArea className="h-48 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Column</TableHead>
                    <TableHead>Database Column</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(appearanceMapping.entries()).map(([ui, db]) => (
                    <TableRow key={ui}>
                      <TableCell>{ui}</TableCell>
                      <TableCell>{db}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAppearanceMapping(ui)}>
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
      )}

      {absenceSheet && (
        <Card>
          <CardHeader>
            <CardTitle>Absence Data Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Unmapped File Column</Label>
                <Select value={manualAbsenceMapping.ui} onValueChange={(v) => setManualAbsenceMapping((m) => ({ ...m, ui: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select file column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-60">
                      {unmappedAbsenceFileCols.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target DB Column</Label>
                <Select value={manualAbsenceMapping.db} onValueChange={(v) => setManualAbsenceMapping((m) => ({ ...m, db: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select db column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-60">
                      {unmappedAbsenceDbCols.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddAbsenceMapping} disabled={!manualAbsenceMapping.ui || !manualAbsenceMapping.db}>
                <Plus className="mr-2 h-4 w-4" />
                Add Mapping
              </Button>
            </div>
            <ScrollArea className="h-48 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Column</TableHead>
                    <TableHead>Database Column</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(absenceMapping.entries()).map(([ui, db]) => (
                    <TableRow key={ui}>
                      <TableCell>{ui}</TableCell>
                      <TableCell>{db}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAbsenceMapping(ui)}>
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>3. Save Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
                {workerMessage} (Saved: {saveStats.saved} / {saveStats.total} · Updated: {saveStats.updated} · Skipped: {saveStats.skipped})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo((prev) => ({ ...prev, isOpen }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
            <AlertDialogDescription>
              Found {duplicateInfo.count} record(s) that already exist in the database out of {duplicateInfo.totalInDb}. How would you like to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => executeSave("skip")}>
              Skip Existing & Save New Records
            </Button>
            <AlertDialogAction asChild>
              <Button onClick={() => executeSave("replace")}>Update All Matching Records</Button>
            </AlertDialogAction>
            <AlertDialogCancel asChild>
              <Button variant="ghost" onClick={() => setDuplicateInfo((prev) => ({ ...prev, isOpen: false }))}>
                Cancel Import
              </Button>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Results Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KeyFiguresCard title="Session Number" value={sessionNumber} icon={<CheckCircle />} />
            <KeyFiguresCard title="Total Appearance" value={results.totalAppearance} icon={<Users />} />
            <KeyFiguresCard title="Total Attendance" value={results.totalAttend} icon={<UserCheck />} />
            <KeyFiguresCard title="Total Absence" value={results.totalAbsence} icon={<UserMinus />} />
            <KeyFiguresCard title="Alternative Sessions" value={results.totalAlternative} icon={<Activity />} />
          </CardContent>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions/dashboard">
                <BarChart2 className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
            <Button asChild>
              <Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions/database">
                <Database className="mr-2 h-4 w-4" />
                Go to Database
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}