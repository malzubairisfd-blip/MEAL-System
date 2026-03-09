"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  FileSpreadsheet,
  GitCompareArrows,
  Loader2,
  Plus,
  Save,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

const LOCAL_STORAGE_MAPPING_PREFIX = "bnf-cmam-mapping-";

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  STEP_ONE: "Step One · Preparing database",
  STEP_TWO: "Step Two · Saving mappings",
  STEP_THREE: "Step Three · Enriching educator phones",
  STEP_FOUR: "Step Four · Saving dates",
  STEP_FIVE: "Step Five · Calculating ages",
  STEP_SIX: "Step Six · CMAM qualification",
  done: "Completed",
  error: "Error",
  saving: "Saving to database",
  initializing: "Preparing worker",
  checking_duplicates: "Validating duplicates",
};

const actionCards = [
  {
    title: "Preparing Beneficiaries CMAM List",
    description: "Upload, map, and validate CMAM beneficiaries.",
    icon: FileSpreadsheet,
    href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/preparing",
  },
  {
    title: "Beneficiaries CMAM Database",
    description: "View existing CMAM beneficiaries data.",
    icon: Users,
    href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/database",
  },
  {
    title: "Exporting Beneficiaries CMAM Statements",
    description: "Download CMAM beneficiary statements.",
    icon: Save,
    href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/export",
  },
  {
    title: "Beneficiaries CMAM Screening Results Data Entry",
    description: "Add manual screening results entries.",
    icon: GitCompareArrows,
    href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening-entry",
  },
];

const KeyFigureCard = ({
  title,
  value,
  icon,
  bgColor,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  bgColor: string;
}) => (
  <Card className={`${bgColor} text-white shadow-md`}>
    <CardHeader className="flex items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export default function PreparingBeneficiariesCMAMListPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<{ projectId: string; projectName: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
  const [manualMapping, setManualMapping] = useState({ ui: "", db: "" });
  const [uniqueIdCol, setUniqueIdCol] = useState("BENEF_ID");
  const [regDate, setRegDate] = useState({ day: "", month: "", year: "" });
  const [currDate, setCurrDate] = useState({ day: "", month: "", year: "" });
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
  const [results, setResults] = useState<any | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState({
    isOpen: false,
    count: 0,
    totalInDb: 0,
    duplicateIds: [] as string[],
  });
  const [loading, setLoading] = useState({ projects: true, schema: true, saving: false });
  const bufferRef = useRef("");

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((res) => res.json()),
      fetch("/api/bnf-cmam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_schema" }),
      }).then((res) => res.json()),
    ])
      .then(([projData, schemaData]) => {
        setProjects(projData || []);
        setDbColumns(schemaData.columns || []);
      })
      .catch((err) => {
        toast({ title: "Failed to load initial data", description: err.message, variant: "destructive" });
      })
      .finally(() => setLoading({ projects: false, schema: false, saving: false }));
  }, [toast]);

  useEffect(() => {
    if (!selectedProjectId || !file) return;
    const key = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-${file.name}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setColumnMapping(new Map(Object.entries(JSON.parse(stored))));
    }
  }, [selectedProjectId, file?.name]);

  useEffect(() => {
    if (!selectedProjectId || !file || !columnMapping.size) return;
    const key = `${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}-${file.name}`;
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(columnMapping)));
  }, [columnMapping, selectedProjectId, file?.name]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setSelectedSheet("");
    setSheets([]);
    setColumns([]);
    setRawData([]);
    setColumnMapping(new Map());
    setResults(null);
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target?.result, { type: "binary" });
      setSheets(workbook.SheetNames);
      if (workbook.SheetNames.length > 0) {
        handleSheetSelect(workbook.SheetNames[0], selected);
      }
    };
    reader.readAsBinaryString(selected);
  };

  const handleSheetSelect = (sheetName: string, selectedFile: File | null = file) => {
    if (!selectedFile) return;
    setSelectedSheet(sheetName);
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target?.result, { type: "binary" });
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      const headers = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]) || [];
      setRawData(data);
      setColumns(headers.filter((header) => !!header && header.toString().trim().length));
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleAutoMatch = () => {
    if (!columns.length || !dbColumns.length) return;
    const newMap = new Map(columnMapping);
    columns.forEach((uiCol) => {
      if (newMap.has(uiCol)) return;
      const normalizedUi = uiCol.toLowerCase().replace(/[\s_]/g, "");
      const match = dbColumns.find((dbCol) => dbCol.toLowerCase().replace(/[\s_]/g, "") === normalizedUi);
      if (match) {
        newMap.set(uiCol, match);
      }
    });
    setColumnMapping(newMap);
  };

  const handleAddManualMapping = () => {
    if (!manualMapping.ui || !manualMapping.db) return;
    setColumnMapping((prev) => new Map(prev).set(manualMapping.ui, manualMapping.db));
    setManualMapping({ ui: "", db: "" });
  };

  const handleDeleteMapping = (uiColumn: string) => {
    setColumnMapping((prev) => {
      const next = new Map(prev);
      next.delete(uiColumn);
      return next;
    });
  };

  const unmappedUiColumns = useMemo(
    () => columns.filter((column) => !columnMapping.has(column)),
    [columns, columnMapping]
  );
  const unmappedDbColumns = useMemo(
    () => dbColumns.filter((column) => !Array.from(columnMapping.values()).includes(column)),
    [dbColumns, columnMapping]
  );
  const mappedDbValues = useMemo(() => Array.from(new Set(Array.from(columnMapping.values()))), [columnMapping]);
  const hasUniqueIdMapped = mappedDbValues.includes(uniqueIdCol);
  const formattedRegDate = `${regDate.year}-${regDate.month}-${regDate.day}`;
  const formattedCurrDate = `${currDate.year}-${currDate.month}-${currDate.day}`;

  const buildPayload = (mode: "skip" | "replace", duplicateIds: string[] = []) => ({
    action: "save",
    projectId: selectedProjectId,
    projectName: projects.find((project) => project.projectId === selectedProjectId)?.projectName,
    records: rawData,
    mapping: Object.fromEntries(columnMapping),
    uniqueIdCol,
    regDate: formattedRegDate,
    currDate: formattedCurrDate,
    mode,
    duplicateIds,
  });

  const readStream = async (response: Response) => {
    if (!response.body) throw new Error("No response stream.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    bufferRef.current = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bufferRef.current += decoder.decode(value, { stream: true });
      const events = bufferRef.current.split("\n\n");
      bufferRef.current = events.pop() || "";
      for (const event of events) {
        if (!event.trim()) continue;
        const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        const payload = JSON.parse(dataLine.replace("data: ", ""));
        if (payload.type === "progress") {
          setStatus(payload.status || "STEP_ONE");
          setProgress(payload.progress ?? 0);
          if (payload.stats) setSaveStats(payload.stats);
          if (payload.results) setResults(payload.results);
        } else if (payload.type === "done") {
          setStatus("done");
          setProgress(100);
          setResults(payload.results);
          setSaveStats(payload.stats || saveStats);
          setLoading((prev) => ({ ...prev, saving: false }));
          toast({ title: "Success", description: payload.message || "Data saved." });
        } else if (payload.type === "error") {
          throw new Error(payload.error || "Unknown error during save.");
        }
      }
    }
  };

  const executeSave = async (mode: "skip" | "replace", duplicateIds: string[] = []) => {
    if (!selectedProjectId || !file) return;
    if (!hasUniqueIdMapped) {
      toast({
        title: "Mapping error",
        description: "BENEF_ID must be mapped before saving.",
        variant: "destructive",
      });
      return;
    }
    if (!formattedRegDate || !formattedCurrDate) {
      toast({
        title: "Dates missing",
        description: "Please select both registration and current dates.",
        variant: "destructive",
      });
      return;
    }
    setLoading((prev) => ({ ...prev, saving: true }));
    setStatus("STEP_ONE");
    setProgress(5);
    try {
      const payload = buildPayload(mode, duplicateIds);
      const response = await fetch("/api/bnf-cmam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Save request failed.");
      }
      await readStream(response);
    } catch (error: any) {
      setLoading((prev) => ({ ...prev, saving: false }));
      setStatus("error");
      toast({ title: "Save Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!selectedProjectId || !file || !rawData.length) {
      toast({
        title: "Missing data",
        description: "Select project, upload file, and map columns before saving.",
        variant: "destructive",
      });
      return;
    }
    if (!hasUniqueIdMapped) {
      toast({
        title: "Unique ID missing",
        description: "Map a column to BENEF_ID before checking duplicates.",
        variant: "destructive",
      });
      return;
    }
    setLoading((prev) => ({ ...prev, saving: true }));
    setStatus("checking_duplicates");
    const uiColForUniqueId = Array.from(columnMapping.entries()).find(([, dbCol]) => dbCol === uniqueIdCol)?.[0];
    if (!uiColForUniqueId) {
      toast({
        title: "Mapping Error",
        description: `The mapped unique ID column "${uniqueIdCol}" could not be found in the file mappings.`,
        variant: "destructive",
      });
      setLoading((prev) => ({ ...prev, saving: false }));
      return;
    }
    try {
      const uniqueIds = rawData.map((row) => row[uiColForUniqueId]).filter(Boolean);
      const response = await fetch("/api/bnf-cmam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_duplicates",
          projectId: selectedProjectId,
          uniqueIdCol,
          uniqueIds,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Duplicate check failed.");
      setSaveStats((prev) => ({ ...prev, total: uniqueIds.length }));
      if (result.count > 0) {
        setDuplicateInfo({
          isOpen: true,
          count: result.count,
          totalInDb: result.totalInDb,
          duplicateIds: result.duplicateIds || [],
        });
        setLoading((prev) => ({ ...prev, saving: false }));
      } else {
        await executeSave("replace");
      }
    } catch (error: any) {
      toast({ title: "Duplicate check error", description: error.message, variant: "destructive" });
      setLoading((prev) => ({ ...prev, saving: false }));
      setStatus("error");
    }
  };

  const handleSkipDuplicates = async () => {
    setDuplicateInfo((prev) => ({ ...prev, isOpen: false }));
    await executeSave("skip", duplicateInfo.duplicateIds);
  };

  const handleUpdateDuplicates = async () => {
    setDuplicateInfo((prev) => ({ ...prev, isOpen: false }));
    await executeSave("replace", duplicateInfo.duplicateIds);
  };

  const statusLabel = STATUS_LABELS[status] || "Idle";
  const keyFigures = [
    {
      title: "Total Beneficiaries",
      value: results?.totalBeneficiaries ?? 0,
      icon: <Users className="h-5 w-5 opacity-75" />,
      bgColor: "bg-blue-600",
    },
    {
      title: "Qualified Beneficiaries",
      value: results?.qualifiedBeneficiaries ?? 0,
      icon: <UserCheck className="h-5 w-5 opacity-75" />,
      bgColor: "bg-emerald-600",
    },
    {
      title: "CMAM Qualified",
      value: results?.cmamQualified ?? 0,
      icon: <UserCheck className="h-5 w-5 opacity-75" />,
      bgColor: "bg-teal-600",
    },
    {
      title: "Disqualified Beneficiaries",
      value: results?.disqualifiedBeneficiaries ?? 0,
      icon: <UserX className="h-5 w-5 opacity-75" />,
      bgColor: "bg-red-500",
    },
    {
      title: "CMAM Disqualified",
      value: results?.cmamDisqualified ?? 0,
      icon: <UserX className="h-5 w-5 opacity-75" />,
      bgColor: "bg-orange-500",
    },
  ];

  const duplicateFullCoverage =
    duplicateInfo.count > 0 && duplicateInfo.totalInDb > 0 && duplicateInfo.count >= duplicateInfo.totalInDb;

  return (
    <div className="space-y-6 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actionCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Card key={card.title}>
              <CardContent className="flex flex-col space-y-3">
                <IconComponent className="h-8 w-8 text-slate-600" />
                <div className="text-lg font-semibold">{card.title}</div>
                <p className="text-sm text-muted-foreground">{card.description}</p>
                <Button variant="outline" asChild>
                  <Link href={card.href}>Go</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Prepare Beneficiaries CMAM List</h1>
          <p className="text-sm text-muted-foreground">Map, validate, and save CMAM beneficiaries through the six-step pipeline.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2" asChild>
            <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening">
              <ArrowLeft className="h-4 w-4" />
              Back to hub
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600" />
            Project & File
          </CardTitle>
          <CardDescription>Select your project, upload the CMAM workbook, and pick the sheet you want to map.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.projectId} value={project.projectId}>
                  {project.projectName} ({project.projectId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="border-2 border-dashed rounded-xl p-6 bg-slate-50 text-center space-y-2">
            <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-400" />
            <p className="text-sm text-slate-600">Upload CMAM sheet (.xls, .xlsx, .xlsm, .xlsb, .csv, .txt)</p>
            <Input
              type="file"
              accept=".xls,.xlsx,.xlsm,.xlsb,.csv,.txt"
              onChange={handleFileChange}
              className="mx-auto w-full max-w-md"
            />
          </div>
          {sheets.length > 0 && (
            <Select value={selectedSheet} onValueChange={handleSheetSelect}>
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
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
            <div>
              <Label className="text-sm font-semibold">Registration Date</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Select value={regDate.day} onValueChange={(value) => setRegDate((prev) => ({ ...prev, day: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1).padStart(2, "0")}>
                        {idx + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={regDate.month} onValueChange={(value) => setRegDate((prev) => ({ ...prev, month: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1).padStart(2, "0")}>
                        {idx + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={regDate.year} onValueChange={(value) => setRegDate((prev) => ({ ...prev, year: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, idx) => new Date().getFullYear() - 5 + idx).map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Current Date</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Select value={currDate.day} onValueChange={(value) => setCurrDate((prev) => ({ ...prev, day: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1).padStart(2, "0")}>
                        {idx + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={currDate.month} onValueChange={(value) => setCurrDate((prev) => ({ ...prev, month: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1).padStart(2, "0")}>
                        {idx + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={currDate.year} onValueChange={(value) => setCurrDate((prev) => ({ ...prev, year: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, idx) => new Date().getFullYear() - 5 + idx).map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {columns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompareArrows />
              Auto & Manual Mapping
            </CardTitle>
            <CardDescription>Match your file with the bnf-CMAM schema and persist the setup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="secondary" onClick={handleAutoMatch}>
              <GitCompareArrows className="mr-2 h-4 w-4" />
              Auto-map columns
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label>File column</Label>
                <Select value={manualMapping.ui} onValueChange={(value) => setManualMapping((prev) => ({ ...prev, ui: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select file column" />
                  </SelectTrigger>
                  <SelectContent>
                    {unmappedUiColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Database column</Label>
                <Select value={manualMapping.db} onValueChange={(value) => setManualMapping((prev) => ({ ...prev, db: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select database field" />
                  </SelectTrigger>
                  <SelectContent>
                    {unmappedDbColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" variant="outline" onClick={handleAddManualMapping}>
                <Plus className="mr-2 h-4 w-4" />
                Add mapping
              </Button>
            </div>
            <div className="space-y-3">
              <Label>Mapped columns</Label>
              <ScrollArea className="max-h-64 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Column</TableHead>
                      <TableHead>Database Column</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from(columnMapping.entries()).map(([uiColumn, dbColumn]) => (
                      <TableRow key={uiColumn} className={dbColumn === uniqueIdCol ? "bg-amber-50" : ""}>
                        <TableCell className="font-medium">{uiColumn}</TableCell>
                        <TableCell>
                          {dbColumn}
                          {dbColumn === uniqueIdCol && (
                            <span className="ml-2 rounded-full bg-amber-200 px-2 py-1 text-xs font-semibold text-amber-800">
                              Unique ID
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteMapping(uiColumn)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select unique identifier</Label>
              <Select value={uniqueIdCol} onValueChange={setUniqueIdCol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mapped column" />
                </SelectTrigger>
                <SelectContent>
                  {mappedDbValues.map((dbCol) => (
                    <SelectItem key={dbCol} value={dbCol}>
                      {dbCol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hasUniqueIdMapped && (
                <p className="text-xs text-destructive">BENEF_ID must be mapped before saving.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Validate & Save</CardTitle>
          <CardDescription>Check for duplicates and run the five-step processing sequence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            size="lg"
            onClick={handleSave}
            disabled={loading.saving || !selectedProjectId || !file || !hasUniqueIdMapped}
          >
            {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {loading.saving ? `${statusLabel}` : "Save to bnf-CMAM.db"}
          </Button>
          {duplicateInfo.isOpen && (
            <Card className="border border-amber-200 bg-amber-50 space-y-3">
              <CardHeader>
                <CardTitle className="text-amber-700 font-semibold">
                  Duplicate records detected ({duplicateInfo.count})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-800">
                <p>
                  {duplicateInfo.count} duplicate records already exist in the database ({duplicateInfo.totalInDb} total).
                  {duplicateFullCoverage && (
                    <strong className="block text-xs text-destructive mt-1">
                      All available records are duplicates; skipping will not save new rows.
                    </strong>
                  )}
                  Choose whether to skip duplicates or update existing entries before saving new ones.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleSkipDuplicates}>
                    Skip duplicates & save new
                  </Button>
                  <Button variant="secondary" onClick={handleUpdateDuplicates}>
                    Update duplicates & save new
                  </Button>
                  <Button variant="ghost" onClick={() => setDuplicateInfo((prev) => ({ ...prev, isOpen: false }))}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Status: {statusLabel}</p>
            <p>
              Progress: {progress}% · Processed {saveStats.saved + saveStats.updated + saveStats.skipped}/{saveStats.total} (Saved:
              {saveStats.saved} | Updated: {saveStats.updated} | Skipped: {saveStats.skipped})
            </p>
          </div>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      {results && (
        <Card className="space-y-4">
          <CardHeader>
            <CardTitle>Results Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {keyFigures.map((figure) => (
              <KeyFigureCard key={figure.title} {...figure} />
            ))}
          </CardContent>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/database">
                Go to Beneficiaries CMAM Database
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/export">
                Exporting Beneficiaries CMAM Statements
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening-entry">
                Beneficiaries CMAM Screening Results Data Entry
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}