"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  CheckCircle,
  Database,
  FileDown,
  UploadCloud,
  Layers,
  Activity
} from "lucide-react";
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

const LOCAL_STORAGE_PREFIX = "child-cmam-mapping-";

const STATUS_LABELS: Record<string, string> = {
  idle: "Awaiting execution",
  STEP_ONE: "Step 1/5 · Checking and preparing database connection",
  STEP_TWO: "Step 2/5 · Mapping and standardizing records",
  STEP_THREE: "Step 3/5 · Binding core column configurations",
  STEP_FOUR: "Step 4/5 · Enriching data and processing rules",
  STEP_FIVE: "Step 5/5 · Finalizing persistence",
  done: "Transaction Completed Successfully",
  error: "Process Terminated with Error",
  saving: "Initializing save routine...",
  checking_duplicates: "Validating for structural duplicates...",
};

const KeyFigureCard = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) => (
  <Card className="border-border/50 bg-card hover:bg-accent/5 transition-colors duration-300">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <div className="text-primary/70">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold tracking-tight text-primary">{value}</div>
    </CardContent>
  </Card>
);

export default function PreparingChildCMAMListPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Map<string, string>>(new Map());
  const [manualMapping, setManualMapping] = useState({ ui: "", db: "" });
  const [benefNoCol, setBenefNoCol] = useState("");
  const [childIdxCol, setChildIdxCol] = useState("");
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [saveStats, setSaveStats] = useState({
    saved: 0,
    updated: 0,
    skipped: 0,
    total: 0,
  });
  const [results, setResults] = useState<any | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState({
    isOpen: false,
    count: 0,
    totalInDb: 0,
    duplicateIds: [] as string[],
  });
  const [loading, setLoading] = useState({
    projects: true,
    schema: true,
    saving: false,
  });
  const [progressLabel, setProgressLabel] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((res) => res.json()),
      fetch("/api/child-cmam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_schema" }),
      }).then((res) => res.json()),
    ])
      .then(([projData, schemaData]) => {
        setProjects(projData || []);
        setDbColumns(schemaData.schema || schemaData.columns || []);
      })
      .catch((err) =>
        toast({
          title: "Architecture sync failed",
          description: err.message,
          variant: "destructive",
        })
      )
      .finally(() =>
        setLoading({ projects: false, schema: false, saving: false })
      );
  }, [toast]);

  useEffect(() => {
    if (!selectedProjectId || !file) return;
    const key = `${LOCAL_STORAGE_PREFIX}${selectedProjectId}-${file.name}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      setMapping(new Map(Object.entries(parsed.mapping || {})));
      setBenefNoCol(parsed.benefNoCol || "");
      setChildIdxCol(parsed.childIdxCol || "");
    }
  }, [selectedProjectId, file?.name]);

  useEffect(() => {
    if (!selectedProjectId || !file) return;
    const key = `${LOCAL_STORAGE_PREFIX}${selectedProjectId}-${file.name}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        mapping: Object.fromEntries(mapping),
        benefNoCol,
        childIdxCol,
      })
    );
  }, [mapping, benefNoCol, childIdxCol, selectedProjectId, file?.name]);

// ... around line 147
  const unmappedUiColumns = useMemo(
      () =>
            columns.filter(
                    (col) => !Array.from(mapping.keys()).includes(col) && Boolean(col.trim())
                          ),
                              [columns, mapping]
                                );

                                  // REPLACE THE OLD unmappedDbColumns WITH THIS ONE:
                                    const unmappedDbColumns = useMemo(
                                        () => {
                                              // Create a unique set first to prevent React "duplicate key" errors
                                                    const uniqueDbColumns = Array.from(new Set(dbColumns));
                                                          return uniqueDbColumns.filter(
                                                                  (col) => !Array.from(mapping.values()).includes(col) && Boolean(col.trim())
                                                                        );
                                                                            },
                                                                                [dbColumns, mapping]
                                                                                  );
                                                                                  // ...

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target?.result, { type: "binary" });
      setSheets(workbook.SheetNames);
      if (workbook.SheetNames.length > 0) {
        handleSheetSelect(workbook.SheetNames[0], selectedFile);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleSheetSelect = (sheetName: string, f: File | null = file) => {
    if (!f) return;
    setSelectedSheet(sheetName);
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target?.result, { type: "binary" });
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      const headers = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || []) as string[];
      setRawData(data);
      setColumns(headers.filter(Boolean));
    };
    reader.readAsBinaryString(f);
  };

  const autoMapColumns = () => {
    const autoMap = new Map<string, string>();
    unmappedUiColumns.forEach((uiCol) => {
      const normalizedUi = uiCol
        .toLowerCase()
        .replace(/[\s_]/g, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const dbMatch = unmappedDbColumns.find((dbCol) => {
        const normalizedDb = dbCol
          .toLowerCase()
          .replace(/[_\s-]/g, "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        return normalizedDb === normalizedUi;
      });
      if (dbMatch) autoMap.set(uiCol, dbMatch);
    });
    setMapping((prev) => new Map([...prev, ...autoMap]));
    toast({ title: "Auto-mapping generated & cached successfully" });
  };

  const addManualMapping = () => {
    if (!manualMapping.ui || !manualMapping.db) {
      toast({
        title: "Incomplete configuration",
        description: "Please specify both the source column and the destination schema field.",
        variant: "destructive",
      });
      return;
    }
    setMapping((prev) => new Map(prev).set(manualMapping.ui, manualMapping.db));
    setManualMapping({ ui: "", db: "" });
  };

  const removeMapping = (uiCol: string) => {
    setMapping((prev) => {
      const updated = new Map(prev);
      updated.delete(uiCol);
      return updated;
    });
  };

  const showProgress = (status: string, progressValue: number, message: string) => {
    setStatus(status);
    setProgress(progressValue);
    setProgressLabel(message);
  };

  const executeSave = useCallback(
    async (mode: "skip" | "replace") => {
      if (!selectedProjectId || !rawData.length) return;

      setDuplicateInfo((prev) => ({ ...prev, isOpen: false }));
      setLoading((prev) => ({ ...prev, saving: true }));
      showProgress("STEP_ONE", 5, "Initiating database transaction…");

      try {
        const res = await fetch("/api/child-cmam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save",
            projectId: selectedProjectId,
            records: rawData,
            mapping: Object.fromEntries(mapping),
            benefNoCol,
            childIdxCol,
            mode,
            duplicateIds: duplicateInfo.duplicateIds,
          }),
        });

        if (!res.body) throw new Error("No response stream");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk
            .split("\n\n")
            .filter((line) => line.startsWith("data: "));
            
          for (const line of lines) {
            const payload = JSON.parse(line.replace("data: ", ""));
            
            if (payload.type === "progress") {
              showProgress(payload.status, payload.progress, payload.message || "");
              if (payload.stats) setSaveStats(payload.stats);
            } else if (payload.type === "done") {
              showProgress("done", 100, "Processing completed.");
              setResults(payload.results);
              setSaveStats(payload.stats);
              toast({ title: "Operation Successful", description: "All records processed and secured." });
              break;
            } else if (payload.type === "error") {
              throw new Error(payload.error);
            }
          }
        }
      } catch (err: any) {
        showProgress("error", 0, err.message);
        toast({ title: "Transaction Interrupted", description: err.message, variant: "destructive" });
      } finally {
        setLoading((prev) => ({ ...prev, saving: false }));
      }
    },
    [benefNoCol, childIdxCol, duplicateInfo.duplicateIds, mapping, rawData, selectedProjectId, toast]
  );

  const handleSave = async () => {
    if (!selectedProjectId || !file || !benefNoCol || !childIdxCol) {
      toast({
        title: "Configuration Error",
        description: "Target Project, Source File, and composite Unique Identifiers are mandatory.",
        variant: "destructive",
      });
      return;
    }
    setStatus("checking_duplicates");
    setLoading((prev) => ({ ...prev, saving: true }));
    
    try {
      const res = await fetch("/api/child-cmam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_duplicates",
          projectId: selectedProjectId,
          records: rawData,
          benefNoCol,
          childIdxCol,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      if (result.count > 0) {
        setDuplicateInfo({
          isOpen: true,
          count: result.count,
          totalInDb: result.totalInDb,
          duplicateIds: result.duplicateIds,
        });
      } else {
        await executeSave("replace");
      }
    } catch (err: any) {
      toast({ title: "Validation Failure", description: err.message, variant: "destructive" });
    } finally {
      setLoading((prev) => ({ ...prev, saving: false }));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Child CMAM Pre-Processor</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            ETL Engine: Upload, transform, and synchronize screening matrices into the central repository.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="shadow-sm" asChild>
            <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/preparing">
              <Database className="mr-2 h-4 w-4" />
              Repository
            </Link>
          </Button>
          <Button variant="outline" className="shadow-sm" asChild>
            <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/results">
              <UserCheck className="mr-2 h-4 w-4" />
              Results Entry
            </Link>
          </Button>
          <Button variant="secondary" className="shadow-sm" asChild>
            <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/export">
              <FileDown className="mr-2 h-4 w-4" />
              Export Batch
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Data Intake & Config */}
        <div className="space-y-8 lg:col-span-4">
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center text-lg">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground mr-3">1</span>
                Data Acquisition
              </CardTitle>
              <CardDescription>Select project schema and feed source file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Project</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  disabled={loading.projects}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select active project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.projectId} value={project.projectId}>
                        {project.projectName || project.projectId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source Matrix (.xlsx, .csv)</Label>
                <div className="relative">
                  <Input
                    type="file"
                    className="file:bg-primary/10 file:text-primary file:border-0 hover:file:bg-primary/20 file:px-3 file:py-1 file:rounded-md cursor-pointer"
                    accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.txt"
                    onChange={handleFileChange}
                  />
                  <UploadCloud className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground/50 pointer-events-none" />
                </div>
              </div>

              {sheets.length > 0 && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Sheet</Label>
                  <Select value={selectedSheet} onValueChange={(value) => handleSheetSelect(value)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select matrix sheet..." />
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
            </CardContent>
          </Card>

          {file && (
            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                  <Activity className="mr-2 h-5 w-5 text-primary" />
                  Execution Center
                </CardTitle>
                <CardDescription>Trigger the mapping pipeline & monitor logs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Button
                  onClick={handleSave}
                  disabled={loading.saving || !selectedProjectId || !file || !benefNoCol || !childIdxCol}
                  className="w-full h-12 text-md shadow-md"
                  size="lg"
                >
                  {loading.saving ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-5 w-5" />
                  )}
                  Initialize ETL Pipeline
                </Button>

                {progress > 0 && (
                  <div className="space-y-3 bg-background p-4 rounded-lg border shadow-inner">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-primary">{progress}%</span>
                      <span className="text-muted-foreground truncate ml-4">{STATUS_LABELS[status] || "Processing..."}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
                      <div className="bg-green-500/10 text-green-700 rounded py-1">Saved: {saveStats.saved}</div>
                      <div className="bg-blue-500/10 text-blue-700 rounded py-1">Updated: {saveStats.updated}</div>
                      <div className="bg-amber-500/10 text-amber-700 rounded py-1">Skipped: {saveStats.skipped}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Mapping & Layout */}
        <div className="lg:col-span-8">
          <Card className="shadow-sm h-full flex flex-col">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center text-lg">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground mr-3">2</span>
                    Schema Topology Mapping
                  </CardTitle>
                  <CardDescription className="mt-1">Link unstructured document columns to strict schema definitions.</CardDescription>
                </div>
                {file && (
                  <Button variant="outline" size="sm" onClick={autoMapColumns} className="shadow-sm">
                    <GitCompareArrows className="mr-2 h-4 w-4" />
                    Run Auto-Mapper
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0">
              {file ? (
                <div className="p-6 space-y-8">
                  {/* Composite Keys Definition */}
                  <div className="grid gap-6 md:grid-cols-2 bg-accent/30 p-4 rounded-lg border border-accent">
                    <div className="space-y-2">
                      <Label className="flex items-center font-semibold text-primary">
                        <Layers className="mr-2 h-4 w-4" /> Identifier 1: Beneficiary No.
                      </Label>
                      <Select value={benefNoCol} onValueChange={setBenefNoCol}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select identifier col..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center font-semibold text-primary">
                        <Layers className="mr-2 h-4 w-4" /> Identifier 2: Child Index
                      </Label>
                      <Select value={childIdxCol} onValueChange={setChildIdxCol}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select identifier col..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Manual Assignment */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Manual Assignment</Label>
                    <div className="flex flex-col md:flex-row gap-3">
                      <Select
                        value={manualMapping.ui}
                        onValueChange={(value) => setManualMapping((prev) => ({ ...prev, ui: value }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Source Matrix Column" />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="h-48">
                            {unmappedUiColumns.length > 0 ? (
                               unmappedUiColumns.map((column) => (
                                 <SelectItem key={column} value={column}>{column}</SelectItem>
                               ))
                            ) : (
                               <div className="p-2 text-sm text-muted-foreground text-center">All mapped</div>
                            )}
                          </ScrollArea>
                        </SelectContent>
                      </Select>

                      <Select
                        value={manualMapping.db}
                        onValueChange={(value) => setManualMapping((prev) => ({ ...prev, db: value }))}
                      >
                        <SelectTrigger className="flex-1 border-primary/40 focus:ring-primary/40">
                          <SelectValue placeholder="Target Database Schema" />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="h-48">
                            {unmappedDbColumns.length > 0 ? (
                              unmappedDbColumns.map((column) => (
                                <SelectItem key={column} value={column}>{column}</SelectItem>
                              ))
                            ) : (
                              <div className="p-2 text-sm text-muted-foreground text-center">No columns found</div>
                            )}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                      <Button onClick={addManualMapping} variant="secondary" className="md:w-auto w-full">
                        <Plus className="mr-2 h-4 w-4" /> Bind
                      </Button>
                    </div>
                  </div>

                  {/* Mapping Table */}
                  <div className="rounded-md border shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-1/2">Source Matrix</TableHead>
                          <TableHead className="w-1/2 text-primary">Database Schema</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mapping.size === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                              No bindings configured. Use Auto-Mapper or assign manually above.
                            </TableCell>
                          </TableRow>
                        ) : (
                          Array.from(mapping.entries()).map(([source, target]) => (
                            <TableRow key={`${source}-${target}`} className="group hover:bg-muted/30">
                              <TableCell className="font-medium text-muted-foreground">{source}</TableCell>
                              <TableCell className="font-mono text-xs text-primary">{target}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeMapping(source)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground p-8">
                  <FileSpreadsheet className="h-16 w-16 opacity-20 mb-4" />
                  <p className="text-lg font-medium text-foreground/70">Awaiting Dataset</p>
                  <p className="text-sm text-center max-w-sm mt-1">Upload a compatible matrix file in step 1 to begin mapping configurations.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {results && (
        <div className="pt-6 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold tracking-tight">Post-Execution Telemetry</h2>
            <span className="text-sm text-muted-foreground flex items-center">
              <CheckCircle className="h-4 w-4 mr-1 text-green-500" /> System live status
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <KeyFigureCard title="Gross Population" value={results.totalChildren} icon={<Users className="h-5 w-5" />} />
            <KeyFigureCard title="Active Beneficiaries" value={results.qualifiedBeneficiaries} icon={<UserCheck className="h-5 w-5" />} />
            <KeyFigureCard title="CMAM Flagged" value={results.cmamQualified} icon={<CheckCircle className="h-5 w-5" />} />
            <KeyFigureCard title="Invalid Profiles" value={results.disqualifiedBeneficiaries} icon={<UserX className="h-5 w-5" />} />
            <KeyFigureCard title="CMAM Ineligible" value={results.cmamDisqualified} icon={<UserX className="h-5 w-5" />} />
          </div>
        </div>
      )}

      <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo((prev) => ({ ...prev, isOpen }))}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-amber-600">
              <Activity className="mr-2 h-5 w-5" /> Collision Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-base">
              The engine flagged <strong>{duplicateInfo.count}</strong> duplicate records against the <strong>{duplicateInfo.totalInDb}</strong> entities currently in the database.
              <br /><br />
              How would you like to resolve this conflict?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 sm:space-x-4">
            <AlertDialogCancel>Abort Operation</AlertDialogCancel>
            <Button onClick={() => executeSave("skip")} variant="outline" className="border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-700 text-amber-600">
              Ignore Duplicates
            </Button>
            <AlertDialogAction onClick={() => executeSave("replace")} className="bg-primary hover:bg-primary/90">
              Force Update Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}