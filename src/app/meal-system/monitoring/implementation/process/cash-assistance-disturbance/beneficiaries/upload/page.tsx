
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, Trash2, ArrowLeft, Database, Upload, Users, DollarSign, Wallet, CreditCard, FilePlus, FileText, CheckCircle } from "lucide-react";
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

const LOCAL_STORAGE_MAPPING_PREFIX = "bnf-cash-disturbance-mapping-";
const STATUS_LABELS: Record<string, string> = {
  FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE: "Step 1 · Enrollment Review Data",
  SECOND_STEP_SAVING_PAYMENT_CYCLE_LIST: "Step 2 · Payment Cycle List",
  THIRD_STEP_SAVING_PAYMENT_CYCLE_COUNT: "Step 3 · Payment Cycle Count",
  FOURTH_STEP_SAVING_PAYMENT_CYCLE_MONTHS: "Step 4 · Payment Cycle Months",
  FIFTH_STEP_SAVING_UNCASHED_LIST: "Step 5 · Uncashed List",
  SIXTH_STEP_SAVING_CASHED_DATA: "Step 6 · Cashed Data",
  SEVENTH_STEP_SAVING_TOTAL_VALUES: "Step 7 · Total Values",
  done: "Completed",
  idle: "Idle",
  error: "Error",
};

const monthOptions = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const yearOptions = Array.from({ length: 6 }, (_, idx) => new Date().getFullYear() - 3 + idx);

const KeyFiguresCard = ({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const cycleFields = [
  "is_pay_list",
  "pay_cyc_cnt",
  "pay_cyc_mon_list",
  "pay_amt",
  "is_cashed",
  "cashed_amt",
  "is_uncashed",
  "uncashed_amt",
  "uncashed_code",
  "uncashed_reason",
  "recom",
];

const generalDbColumns = ["benef_id", "pc_id", "pc_name", "project_id", "project_name"];

const fetchDbColumns = async () => {
  const res = await fetch("/api/bnf-cash-distrubance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "schema" }) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.columns || [];
};

const getCycleColumns = (cycle: number) => {
  const suffix = `s${cycle}`;
  return cycleFields.map((field) => `${field}_${suffix}`);
};

const getMappingStorageKey = (projectId: string, fileName: string, cycle: number, type: "payment" | "uncashed") =>
  `${LOCAL_STORAGE_MAPPING_PREFIX}${projectId}-${fileName}-s${cycle}-${type}`;

const getMappedFileColumn = (mapping: Map<string, string>, target: string) => {
  for (const [fileCol, dbCol] of mapping.entries()) {
    if (dbCol === target) return fileCol;
  }
  return "";
};

export default function BeneficiariesCashDistrubanceUploadPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [paymentSheet, setPaymentSheet] = useState("");
  const [uncashedSheet, setUncashedSheet] = useState("");
  const [paymentColumns, setPaymentColumns] = useState<string[]>([]);
  const [uncashedColumns, setUncashedColumns] = useState<string[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [uncashedData, setUncashedData] = useState<any[]>([]);
  const [paymentCycle, setPaymentCycle] = useState(1);
  const [paymentCycleCount, setPaymentCycleCount] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [paymentMonths, setPaymentMonths] = useState<string[]>([]);
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [paymentMapping, setPaymentMapping] = useState<Map<string, string>>(new Map());
  const [uncashedMapping, setUncashedMapping] = useState<Map<string, string>>(new Map());
  const [manualPaymentMapping, setManualPaymentMapping] = useState({ ui: "", db: "" });
  const [manualUncashedMapping, setManualUncashedMapping] = useState({ ui: "", db: "" });
  const [fileUniqueIdColumn, setFileUniqueIdColumn] = useState("");
  const [dbUniqueIdColumn, setDbUniqueIdColumn] = useState("benef_id");
  const [loading, setLoading] = useState({ projects: true, schema: true, saving: false });
  const [workerStatus, setWorkerStatus] = useState("idle");
  const [workerProgress, setWorkerProgress] = useState(0);
  const [workerMessage, setWorkerMessage] = useState("");
  const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
  const [duplicateInfo, setDuplicateInfo] = useState({ isOpen: false, count: 0, totalInDb: 0, duplicateIds: [] as string[] });
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    setLoading((prev) => ({ ...prev, projects: true }));
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .finally(() => setLoading((prev) => ({ ...prev, projects: false })));
    setLoading((prev) => ({ ...prev, schema: true }));
    fetchDbColumns()
      .then((cols) => setDbColumns(cols))
      .finally(() => setLoading((prev) => ({ ...prev, schema: false })));
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
      setPaymentSheet("");
      setUncashedSheet("");
      setPaymentColumns([]);
      setUncashedColumns([]);
      setPaymentData([]);
      setUncashedData([]);
      setPaymentMapping(new Map());
      setUncashedMapping(new Map());
      setResults(null);
      setPaymentMonths([]);
      setFileUniqueIdColumn("");
    }
  };

  const loadSheet = (sheetName: string, type: "payment" | "uncashed") => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: "binary" });
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws);
      const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];
      if (type === "payment") {
        setPaymentData(data);
        setPaymentColumns(headers);
      } else {
        setUncashedData(data);
        setUncashedColumns(headers);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSheetSelect = (type: "payment" | "uncashed", sheetName: string) => {
    if (type === "payment") {
      setPaymentSheet(sheetName);
    } else {
      setUncashedSheet(sheetName);
    }
    loadSheet(sheetName, type);
  };

  const cycleColumns = useMemo(() => {
    return getCycleColumns(paymentCycle);
  }, [paymentCycle]);

  const targetDbColumns = useMemo(() => {
    return Array.from(new Set([...generalDbColumns, ...cycleColumns, "benef_id", "pc_id", "pc_name"])).filter(
      (col) => dbColumns.includes(col)
    );
  }, [dbColumns, cycleColumns]);

  const availableFileColumns = useMemo(() => Array.from(new Set([...paymentColumns, ...uncashedColumns])), [
    paymentColumns,
    uncashedColumns,
  ]);

  const unmappedPaymentFileCols = useMemo(
    () => paymentColumns.filter((col) => !Array.from(paymentMapping.keys()).includes(col)),
    [paymentColumns, paymentMapping]
  );

  const unmappedPaymentDbCols = useMemo(
    () => targetDbColumns.filter((col) => !Array.from(paymentMapping.values()).includes(col)),
    [targetDbColumns, paymentMapping]
  );

  const unmappedUncashedFileCols = useMemo(
    () => uncashedColumns.filter((col) => !Array.from(uncashedMapping.keys()).includes(col)),
    [uncashedColumns, uncashedMapping]
  );

  const unmappedUncashedDbCols = useMemo(
    () => targetDbColumns.filter((col) => !Array.from(uncashedMapping.values()).includes(col)),
    [targetDbColumns, uncashedMapping]
  );

  const storeMapping = (type: "payment" | "uncashed", mapping: Map<string, string>) => {
    if (!selectedProjectId || !file) return;
    const key = getMappingStorageKey(selectedProjectId, file.name, paymentCycle, type);
    localStorage.setItem(key, JSON.stringify(Array.from(mapping.entries())));
  };

  useEffect(() => {
    const key = getMappingStorageKey(selectedProjectId, file?.name || "", paymentCycle, "payment");
    if (!key) return;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setPaymentMapping(new Map(JSON.parse(stored)));
      } catch {
        setPaymentMapping(new Map());
      }
    }
  }, [selectedProjectId, file?.name, paymentCycle]);

  useEffect(() => {
    const key = getMappingStorageKey(selectedProjectId, file?.name || "", paymentCycle, "uncashed");
    if (!key) return;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setUncashedMapping(new Map(JSON.parse(stored)));
      } catch {
        setUncashedMapping(new Map());
      }
    }
  }, [selectedProjectId, file?.name, paymentCycle]);

  useEffect(() => {
    storeMapping("payment", paymentMapping);
  }, [paymentMapping, selectedProjectId, file?.name, paymentCycle]);

  useEffect(() => {
    storeMapping("uncashed", uncashedMapping);
  }, [uncashedMapping, selectedProjectId, file?.name, paymentCycle]);

  const handleAddPaymentMapping = () => {
    if (manualPaymentMapping.ui && manualPaymentMapping.db) {
      const next = new Map(paymentMapping);
      next.set(manualPaymentMapping.ui, manualPaymentMapping.db);
      setPaymentMapping(next);
      setManualPaymentMapping({ ui: "", db: "" });
    }
  };

  const handleAddUncashedMapping = () => {
    if (manualUncashedMapping.ui && manualUncashedMapping.db) {
      const next = new Map(uncashedMapping);
      next.set(manualUncashedMapping.ui, manualUncashedMapping.db);
      setUncashedMapping(next);
      setManualUncashedMapping({ ui: "", db: "" });
    }
  };

  const handleDeletePaymentMapping = (key: string) => {
    const next = new Map(paymentMapping);
    next.delete(key);
    setPaymentMapping(next);
  };

  const handleDeleteUncashedMapping = (key: string) => {
    const next = new Map(uncashedMapping);
    next.delete(key);
    setUncashedMapping(next);
  };

  const addPaymentMonth = () => {
    if (!selectedMonth || !selectedYear) return;
    const entry = `${selectedMonth}-${selectedYear}`;
    if (!paymentMonths.includes(entry)) {
      setPaymentMonths((prev) => [...prev, entry]);
    }
  };

  const removePaymentMonth = (value: string) => {
    setPaymentMonths((prev) => prev.filter((item) => item !== value));
  };

  const computeAggregatedStats = useMemo(() => {
    const cycleSuffix = `s${paymentCycle}`;
    const safeNumber = (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };
    const isPayListCol = getMappedFileColumn(paymentMapping, `is_pay_list_${cycleSuffix}`);
    const payAmtCol = getMappedFileColumn(paymentMapping, `pay_amt_${cycleSuffix}`);
    const isCashedCol = getMappedFileColumn(paymentMapping, `is_cashed_${cycleSuffix}`) || getMappedFileColumn(uncashedMapping, `is_cashed_${cycleSuffix}`);
    const cashedAmtCol = getMappedFileColumn(paymentMapping, `cashed_amt_${cycleSuffix}`) || getMappedFileColumn(uncashedMapping, `cashed_amt_${cycleSuffix}`);
    const isUncashedCol = getMappedFileColumn(paymentMapping, `is_uncashed_${cycleSuffix}`) || getMappedFileColumn(uncashedMapping, `is_uncashed_${cycleSuffix}`);
    const uncashedAmtCol = getMappedFileColumn(paymentMapping, `uncashed_amt_${cycleSuffix}`) || getMappedFileColumn(uncashedMapping, `uncashed_amt_${cycleSuffix}`);
    const recomCol = getMappedFileColumn(paymentMapping, `recom_${cycleSuffix}`) || getMappedFileColumn(uncashedMapping, `recom_${cycleSuffix}`);
    const rows = [...paymentData, ...uncashedData];
    let payListCount = 0;
    let payAmtTotal = 0;
    let cashedCount = 0;
    let cashedTotal = 0;
    let uncashedCount = 0;
    let uncashedTotal = 0;
    rows.forEach((row) => {
      if (isPayListCol && safeNumber(row[isPayListCol]) === 1) {
        payListCount += 1;
      }
      if (payAmtCol) {
        payAmtTotal += safeNumber(row[payAmtCol]);
      }
      if (isCashedCol && safeNumber(row[isCashedCol]) >= 1) {
        cashedCount += 1;
      }
      if (cashedAmtCol) {
        cashedTotal += safeNumber(row[cashedAmtCol]);
      }
      const recomValue = recomCol ? `${row[recomCol] || ""}`.trim() : "";
      const recomAllowed = !recomValue || recomValue === "يعاد الصرف للحالة";
      const recomBlocked = recomValue === "تورد الى حساب الممول";
      if (isUncashedCol && safeNumber(row[isUncashedCol]) === 1 && recomAllowed && !recomBlocked) {
        uncashedCount += 1;
      }
      if (uncashedAmtCol && recomAllowed && !recomBlocked) {
        uncashedTotal += safeNumber(row[uncashedAmtCol]);
      }
    });
    return {
      payListCount,
      payAmtTotal,
      cashedCount,
      cashedTotal,
      uncashedCount,
      uncashedTotal,
    };
  }, [paymentCycle, paymentMapping, uncashedMapping, paymentData, uncashedData]);

  const availableDbUniqueColumns = useMemo(() => dbColumns.filter((col) => generalDbColumns.includes(col)), [dbColumns]);

  const isMappingReady = useMemo(() => {
    const hasBenefId =
      Array.from(paymentMapping.values()).includes("benef_id") || Array.from(uncashedMapping.values()).includes("benef_id");
    return !!selectedProjectId && !!file && hasBenefId;
  }, [paymentMapping, uncashedMapping, selectedProjectId, file]);

  const hasUniqueIdSelection = fileUniqueIdColumn && dbUniqueIdColumn;

  const aggregateMappingObject = (mapping: Map<string, string>) => {
    return Object.fromEntries(mapping);
  };

  const executeSave = async (mode: "skip" | "replace") => {
    setDuplicateInfo((prev) => ({ ...prev, isOpen: false }));
    setLoading((prev) => ({ ...prev, saving: true }));
    setWorkerStatus("FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE");
    setWorkerProgress(10);
    setWorkerMessage("Initializing...");
    setResults(null);
    try {
      const response = await fetch("/api/bnf-cash-distrubance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          projectId: selectedProjectId,
          projectName: projects.find((p) => p.projectId === selectedProjectId)?.projectName,
          paymentCycle,
          paymentCycleCount,
          paymentMonths,
          paymentData,
          uncashedData,
          paymentMapping: aggregateMappingObject(paymentMapping),
          uncashedMapping: aggregateMappingObject(uncashedMapping),
          uniqueFileColumn: fileUniqueIdColumn,
          uniqueDbColumn: dbUniqueIdColumn,
          mode,
          duplicateIds: duplicateInfo.duplicateIds,
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
          const payload = JSON.parse(line.replace("data: ", ""));
          if (payload.type === "progress") {
            setWorkerStatus(payload.status);
            setWorkerProgress(payload.progress);
            setWorkerMessage(payload.message);
            if (payload.stats) setSaveStats(payload.stats);
          } else if (payload.type === "done") {
            setWorkerStatus("done");
            setWorkerProgress(100);
            if (payload.stats) setSaveStats(payload.stats);
            if (payload.metrics) {
              setResults(payload.metrics);
            }
            toast({ title: "Upload Complete", description: payload.message });
            break;
          } else if (payload.type === "error") {
            throw new Error(payload.error);
          }
        }
      }
    } catch (error: any) {
      setWorkerStatus("error");
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleSave = async () => {
    if (!isMappingReady) {
      toast({ title: "Incomplete Setup", description: "Select project, file, and map benef_id before saving.", variant: "destructive" });
      return;
    }
    if (!hasUniqueIdSelection) {
      toast({ title: "Unique ID Required", description: "Select a unique id column from upload and database.", variant: "destructive" });
      return;
    }
    if (!paymentMonths.length) {
      toast({ title: "Payment Months Missing", description: "Add at least one payment month.", variant: "destructive" });
      return;
    }
    setLoading((prev) => ({ ...prev, saving: true }));
    try {
      const uniqueIds = Array.from(
        new Set(
          [...paymentData, ...uncashedData]
            .map((row) => row[fileUniqueIdColumn])
            .filter(Boolean)
            .map((value) => String(value).trim())
        )
      );
      const res = await fetch("/api/bnf-cash-distrubance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_duplicates", projectId: selectedProjectId, uniqueIds, uniqueIdCol: dbUniqueIdColumn }),
      });
      if (!res.ok) throw new Error("Duplicate validation failed.");
      const { count, totalInDb, duplicateIds } = await res.json();
      setDuplicateInfo({ isOpen: count > 0, count, totalInDb, duplicateIds });
      if (count === 0) {
        await executeSave("replace");
      }
    } catch (error: any) {
      toast({ title: "Validation Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading((prev) => ({ ...prev, saving: false }));
    }
  };

  const statusLabel = STATUS_LABELS[workerStatus] || workerStatus;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Beneficiaries Cash Distrubance Upload</h1>
          <p className="text-sm text-muted-foreground">Map your upload data to the payments distortion database.</p>
        </div>
        <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Hub</Link></Button>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Select Project & Upload File</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
            <SelectTrigger>
              <SelectValue placeholder="Select Project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.projectId} value={project.projectId}>
                  {project.projectName} ({project.projectId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />
        </CardContent>
      </Card>

      {file && (
        <Card>
          <CardHeader><CardTitle>2. Configure Sheets & Cycles</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Payment List Sheet</Label>
                <Select value={paymentSheet} onValueChange={(value) => handleSheetSelect("payment", value)}>
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
              <div className="space-y-2">
                <Label>Uncashed List Sheet</Label>
                <Select value={uncashedSheet} onValueChange={(value) => handleSheetSelect("uncashed", value)}>
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
              <div className="space-y-2">
                <Label>Payment Cycle</Label>
                <Input
                  type="number"
                  min="1"
                  max="76"
                  value={paymentCycle}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setPaymentCycle(Number.isNaN(value) ? 1 : Math.min(76, Math.max(1, value)));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Cycle Count</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={paymentCycleCount}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setPaymentCycleCount(Number.isNaN(value) ? 1 : Math.max(1, value));
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Months (multiple)</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addPaymentMonth} variant="secondary">
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {paymentMonths.map((month) => (
                  <Button key={month} variant="ghost" size="sm" onClick={() => removePaymentMonth(month)}>
                    {month}
                    <Trash2 className="ml-2 h-3 w-3" />
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {paymentSheet && (
        <Card>
          <CardHeader><CardTitle>Payment List Column Mapping</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>File Column</Label>
                <Select value={manualPaymentMapping.ui} onValueChange={(value) => setManualPaymentMapping((prev) => ({ ...prev, ui: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select file column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-48">
                      {unmappedPaymentFileCols.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DB Column</Label>
                <Select value={manualPaymentMapping.db} onValueChange={(value) => setManualPaymentMapping((prev) => ({ ...prev, db: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select db column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-48">
                      {unmappedPaymentDbCols.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddPaymentMapping} variant="secondary" disabled={!manualPaymentMapping.ui || !manualPaymentMapping.db}>
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
                  {Array.from(paymentMapping.entries()).map(([ui, db]) => (
                    <TableRow key={ui}>
                      <TableCell>{ui}</TableCell>
                      <TableCell>{db}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeletePaymentMapping(ui)}>
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

      {uncashedSheet && (
        <Card>
          <CardHeader><CardTitle>Uncashed List Column Mapping</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>File Column</Label>
                <Select value={manualUncashedMapping.ui} onValueChange={(value) => setManualUncashedMapping((prev) => ({ ...prev, ui: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select file column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-48">
                      {unmappedUncashedFileCols.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DB Column</Label>
                <Select value={manualUncashedMapping.db} onValueChange={(value) => setManualUncashedMapping((prev) => ({ ...prev, db: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select db column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-48">
                      {unmappedUncashedDbCols.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddUncashedMapping} variant="secondary" disabled={!manualUncashedMapping.ui || !manualUncashedMapping.db}>
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
                  {Array.from(uncashedMapping.entries()).map(([ui, db]) => (
                    <TableRow key={ui}>
                      <TableCell>{ui}</TableCell>
                      <TableCell>{db}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUncashedMapping(ui)}>
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
        <CardHeader><CardTitle>3. Unique Identifiers & Save</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unique ID from Upload File</Label>
              <Select value={fileUniqueIdColumn} onValueChange={setFileUniqueIdColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-48">
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
              <Label>Unique ID in Database</Label>
              <Select value={dbUniqueIdColumn} onValueChange={setDbUniqueIdColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select db column..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDbUniqueColumns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading.saving} className="w-full">
            {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save to Database
          </Button>
          {loading.saving && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{statusLabel}</span>
                <span>{workerProgress}%</span>
              </div>
              <Progress value={workerProgress} />
              <p className="text-xs text-center text-muted-foreground">
                {workerMessage} (Saved: {saveStats.saved}, Updated: {saveStats.updated}, Skipped: {saveStats.skipped} / {saveStats.total || 0})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(open) => setDuplicateInfo((prev) => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Beneficiaries Found</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateInfo.count} duplicated record(s) detected out of {duplicateInfo.totalInDb}. Choose how to proceed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => executeSave("skip")}>
              Skip Existing and Save New
            </Button>
            <Button onClick={() => executeSave("replace")}>
              Update Existing and Save New
            </Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader><CardTitle>Result Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
          <KeyFiguresCard title="Payment Cycle" value={paymentCycle} icon={<FilePlus className="h-4 w-4" />} />
          <KeyFiguresCard title="Payment Cycle Count" value={paymentCycleCount} icon={<FileText className="h-4 w-4" />} />
          <KeyFiguresCard title="Total Beneficiaries in List" value={computeAggregatedStats.payListCount} icon={<Users className="h-4 w-4" />} />
          <KeyFiguresCard title="Beneficiaries Cashed" value={computeAggregatedStats.cashedCount} icon={<DollarSign className="h-4 w-4" />} />
          <KeyFiguresCard title="Beneficiaries Uncashed" value={computeAggregatedStats.uncashedCount} icon={<Wallet className="h-4 w-4" />} />
          <KeyFiguresCard title="Total Amount" value={computeAggregatedStats.payAmtTotal} icon={<CreditCard className="h-4 w-4" />} />
          <KeyFiguresCard title="Money Uncashed" value={computeAggregatedStats.uncashedTotal} icon={<CheckCircle className="h-4 w-4" />} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance/dashboard"><Upload className="mr-2 h-4 w-4"/>Go to Dashboard</Link></Button>
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance/database"><Database className="mr-2 h-4 w-4"/>Go to Database</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Hub</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}