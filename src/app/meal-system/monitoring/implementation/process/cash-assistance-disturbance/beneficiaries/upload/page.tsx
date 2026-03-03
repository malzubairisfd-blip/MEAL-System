"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Database,
  DollarSign,
  FilePlus,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  Wallet,
  CreditCard,
  CheckCircle,
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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i);

const CYCLE_FIELDS: { name: string; type: 'TEXT' | 'INTEGER' | 'REAL' }[] = [
  { name: "is_pay_list", type: "INTEGER" },
  { name: "pay_cyc_cnt", type: "INTEGER" },
  { name: "pay_cyc_mon_list", type: "INTEGER" },
  { name: "pay_amt", type: "INTEGER" },
  { name: "is_cashed", type: "INTEGER" },
  { name: "cashed_amt", type: "INTEGER" },
  { name: "is_uncashed", type: "INTEGER" },
  { name: "uncashed_amt", type: "INTEGER" },
  { name: "uncashed_code", type: "INTEGER" },
  { name: "uncashed_reason", type: "TEXT" },
  { name: "recom", type: "TEXT" },
];

const GENERAL_COLUMNS = ["benef_id", "pc_id", "pc_name", "project_id", "project_name"];
const DEFAULT_DB_COLUMNS = [
  "Id",
  "project_id",
  "project_name",
  "benef_id",
  "bnf_name",
  "bnf_vill",
  "bnf_ozla",
  "bnf_mud",
  "ed_id",
  "ed_name",
  "pc_id",
  "pc_name",
  ...Array.from({ length: 76 }, (_, idx) =>
    CYCLE_FIELDS.map((field) => `${field.name}_s${idx + 1}`)
  ).flat(),
  "total_pay_list",
  "total_pay_cyc_cnt",
  "total_pay_amt",
  "total_cashed_cnt",
  "total_cashed_amt",
  "total_uncashed_cnt",
  "total_uncashed_amt",
  "final_comments",
  "data",
];
const LOCAL_STORAGE_MAPPING_PREFIX = "bnf-cash-disturbance-mapping";
const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE: "Step 1 · Enrollment Review",
  SECOND_STEP_SAVING_PAYMENT_CYCLE_LIST: "Step 2 · Payment Cycle List",
  THIRD_STEP_SAVING_PAYMENT_CYCLE_COUNT: "Step 3 · Payment Cycle Count",
  FOURTH_STEP_SAVING_PAYMENT_CYCLE_MONTHS: "Step 4 · Payment Cycle Months",
  FIFTH_STEP_SAVING_UNCASHED_LIST: "Step 5 · Uncashed List",
  SIXTH_STEP_SAVING_CASHED_DATA: "Step 6 · Cashed Data",
  SEVENTH_STEP_SAVING_TOTAL_VALUES: "Step 7 · Totals",
  done: "Completed",
  error: "Error",
};

const getCycleColumns = (cycle: number) => CYCLE_FIELDS.map((field) => `${field.name}_s${cycle}`);
const getMappingStorageKey = (
  projectId: string,
  fileName: string,
  cycle: number,
  type: "payment" | "uncashed"
) => `${LOCAL_STORAGE_MAPPING_PREFIX}-${projectId}-${fileName}-s${cycle}-${type}`;

const aggregateMapping = (mapping: Record<string, string>) => Object.entries(mapping);

const findFileColumn = (mapping: Record<string, string>, target: string) => {
  return Object.entries(mapping).find(([, dbCol]) => dbCol === target)?.[0] || "";
};

const safeNumber = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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

export default function BeneficiariesCashDisturbanceUploadPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<{ projectId: string; projectName: string }[]>([]);
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
  const [paymentMonths, setPaymentMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [dbColumns, setDbColumns] = useState<string[]>(DEFAULT_DB_COLUMNS);
  const [paymentMapping, setPaymentMapping] = useState<Record<string, string>>({});
  const [uncashedMapping, setUncashedMapping] = useState<Record<string, string>>({});
  const [manualPayment, setManualPayment] = useState({ fileCol: "", dbCol: "" });
  const [manualUncashed, setManualUncashed] = useState({ fileCol: "", dbCol: "" });
  const [fileUniqueIdCol, setFileUniqueIdCol] = useState("");
  const [dbUniqueIdCol, setDbUniqueIdCol] = useState("benef_id");
  const [loading, setLoading] = useState({ projects: true, saving: false, dbSchema: true });
  const [workerStatus, setWorkerStatus] = useState("idle");
  const [workerProgress, setWorkerProgress] = useState(0);
  const [workerMessage, setWorkerMessage] = useState("");
  const [results, setResults] = useState<any | null>(null);
  const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
  const [duplicateInfo, setDuplicateInfo] = useState({
    isOpen: false,
    count: 0,
    totalInDb: 0,
    duplicateIds: [] as string[],
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const f = e.target.files[0];
      setFile(f);
      setSheets([]);
      setPaymentSheet("");
      setUncashedSheet("");
      setPaymentData([]);
      setUncashedData([]);
      setPaymentColumns([]);
      setUncashedColumns([]);
      setFileUniqueIdColumn("");
      setResults(null);
    }
  };

  const fetchDbColumns = async () => {
    try {
      const res = await fetch("/api/bnf-cash-disbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schema" }),
      });
      if (!res.ok) return DEFAULT_DB_COLUMNS;
      const data = await res.json();
      return Array.isArray(data.columns) && data.columns.length ? data.columns : DEFAULT_DB_COLUMNS;
    } catch {
      return DEFAULT_DB_COLUMNS;
    }
  };

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data || []));
    fetchDbColumns().then(setDbColumns);
  }, []);

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target?.result, { type: "binary" });
      setSheets(workbook.SheetNames);
    };
    reader.readAsBinaryString(file);
  }, [file]);

  useEffect(() => {
    if (!selectedProjectId || !file) return;
    const keyPayment = getMappingStorageKey(selectedProjectId, file.name, paymentCycle, "payment");
    const storedPayment = localStorage.getItem(keyPayment);
    if (storedPayment) setPaymentMapping(JSON.parse(storedPayment));

    const keyUncashed = getMappingStorageKey(selectedProjectId, file.name, paymentCycle, "uncashed");
    const storedUncashed = localStorage.getItem(keyUncashed);
    if (storedUncashed) setUncashedMapping(JSON.parse(storedUncashed));
  }, [selectedProjectId, file?.name, paymentCycle]);

  useEffect(() => {
    if (!selectedProjectId || !file) return;
    const key = getMappingStorageKey(selectedProjectId, file.name, paymentCycle, "payment");
    localStorage.setItem(key, JSON.stringify(paymentMapping));
  }, [paymentMapping, selectedProjectId, file?.name, paymentCycle]);

  useEffect(() => {
    if (!selectedProjectId || !file) return;
    const key = getMappingStorageKey(selectedProjectId, file.name, paymentCycle, "uncashed");
    localStorage.setItem(key, JSON.stringify(uncashedMapping));
  }, [uncashedMapping, selectedProjectId, file?.name, paymentCycle]);

  const loadSheet = (type: "payment" | "uncashed", sheetName: string) => {
    if (!file) return;
    if (type === "payment") setPaymentSheet(sheetName);
    else setUncashedSheet(sheetName);

    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target?.result, { type: "binary" });
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      const headers = (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || []) as string[];
      if (type === "payment") {
        setPaymentData(data);
        setPaymentColumns(headers);
        setPaymentSheet(sheetName);
      } else {
        setUncashedData(data);
        setUncashedColumns(headers);
        setUncashedSheet(sheetName);
      }
    };
    reader.readAsBinaryString(file);
    setResults(null);
  };

  const cycleDbColumns = useMemo(() => {
    if (!dbColumns.length) return [];
    const cycleColumns = getCycleColumns(paymentCycle);
    return Array.from(new Set([...GENERAL_COLUMNS, ...cycleColumns]));
  }, [dbColumns, paymentCycle]);

  const combinedFileColumns = useMemo(() => {
    return Array.from(new Set([...paymentColumns, ...uncashedColumns]));
  }, [paymentColumns, uncashedColumns]);

  const unmappedPaymentFileColumns = paymentColumns.filter((col) => !paymentMapping[col]);
  const unmappedPaymentDbColumns = cycleDbColumns.filter(
    (col) => col !== "Id" && !Object.values(paymentMapping).includes(col)
  );

  const unmappedUncashedFileColumns = uncashedColumns.filter((col) => !uncashedMapping[col]);
  const unmappedUncashedDbColumns = cycleDbColumns.filter(
    (col) => col !== "Id" && !Object.values(uncashedMapping).includes(col)
  );

  const handleAddPaymentMapping = () => {
    if (!manualPayment.fileCol || !manualPayment.dbCol) return;
    setPaymentMapping((prev) => ({ ...prev, [manualPayment.fileCol]: manualPayment.dbCol }));
    setManualPayment({ fileCol: "", dbCol: "" });
  };

  const handleRemovePaymentMapping = (fileCol: string) => {
    setPaymentMapping((prev) => {
      const next = { ...prev };
      delete next[fileCol];
      return next;
    });
  };

  const handleAddUncashedMapping = () => {
    if (!manualUncashed.fileCol || !manualUncashed.dbCol) return;
    setUncashedMapping((prev) => ({ ...prev, [manualUncashed.fileCol]: manualUncashed.dbCol }));
    setManualUncashed({ fileCol: "", dbCol: "" });
  };

  const handleRemoveUncashedMapping = (fileCol: string) => {
    setUncashedMapping((prev) => {
      const next = { ...prev };
      delete next[fileCol];
      return next;
    });
  };

  const addPaymentMonth = () => {
    if (!selectedMonth || !selectedYear) return;
    const entry = `${selectedMonth} ${selectedYear}`;
    if (!paymentMonths.includes(entry)) setPaymentMonths((prev) => [...prev, entry]);
  };

  const removePaymentMonth = (value: string) => {
    setPaymentMonths((prev) => prev.filter((month) => month !== value));
  };

  const getMappedFileColumn = (target: string) => {
    return findFileColumn(paymentMapping, target) || findFileColumn(uncashedMapping, target);
  };

  const aggregatedStats = useMemo(() => {
    const cycleSuffix = `s${paymentCycle}`;
    const rows = [...paymentData, ...uncashedData];
    let payCount = 0;
    let payAmount = 0;
    let cashedCount = 0;
    let cashedAmount = 0;
    let uncashedCount = 0;
    let uncashedAmount = 0;

    const payCol = getMappedFileColumn(`is_pay_list_${cycleSuffix}`);
    const payAmtCol = getMappedFileColumn(`pay_amt_${cycleSuffix}`);
    const cashedCol = getMappedFileColumn(`is_cashed_${cycleSuffix}`);
    const cashedAmtCol = getMappedFileColumn(`cashed_amt_${cycleSuffix}`);
    const uncashedCol = getMappedFileColumn(`is_uncashed_${cycleSuffix}`);
    const uncashedAmtCol = getMappedFileColumn(`uncashed_amt_${cycleSuffix}`);
    const recomCol = getMappedFileColumn(`recom_${cycleSuffix}`);

    rows.forEach((row) => {
      const payValue = safeNumber(row[payCol]);
      if (payValue === 1) payCount++;
      payAmount += safeNumber(row[payAmtCol]);
      const cashedValue = safeNumber(row[cashedCol]);
      if (cashedValue >= 1) cashedCount++;
      cashedAmount += safeNumber(row[cashedAmtCol]);
      const recomValue = (row[recomCol] || "").toString().trim();
      const recomAllowed =
        !recomValue || recomValue === "يعاد الصرف للحالة";
      const recomBlocked = recomValue === "تورد الى حساب الممول";
      const uncashedValue = safeNumber(row[uncashedCol]);
      if (uncashedValue === 1 && recomAllowed && !recomBlocked) uncashedCount++;
      if (recomAllowed && !recomBlocked) {
        uncashedAmount += safeNumber(row[uncashedAmtCol]);
      }
    });

    return {
      payCount,
      payAmount,
      cashedCount,
      cashedAmount,
      uncashedCount,
      uncashedAmount,
    };
  }, [paymentCycle, paymentData, uncashedData, paymentMapping, uncashedMapping]);

  const paymentReady = useMemo(() => {
    const hasBenef =
      Object.values(paymentMapping).includes("benef_id") ||
      Object.values(uncashedMapping).includes("benef_id");
    return !!selectedProjectId && !!file && hasBenef && !!fileUniqueIdCol;
  }, [paymentMapping, uncashedMapping, selectedProjectId, file, fileUniqueIdCol]);

  const combinedRows = useMemo(() => [...paymentData, ...uncashedData], [paymentData, uncashedData]);

  const computeUniqueIds = () => {
    if (!fileUniqueIdCol) return [];
    const ids = combinedRows
      .map((row) => (row[fileUniqueIdCol] || "").toString().trim())
      .filter(Boolean);
    return Array.from(new Set(ids));
  };

  const executeSave = useCallback(async (mode: "skip" | "replace") => {
    setDuplicateInfo((prev) => ({ ...prev, isOpen: false }));
    setLoading(prev => ({ ...prev, saving: true }));
    setWorkerStatus("initializing");
    setWorkerProgress(0);
    setWorkerMessage("");
    setResults(null);
    setSaveStats({ saved: 0, updated: 0, skipped: 0, total: 0 });

    try {
      const projectName = projects.find((project) => project.projectId === selectedProjectId)?.projectName || "";
      const response = await fetch("/api/bnf-cash-disbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          projectId: selectedProjectId,
          projectName,
          paymentCycle,
          paymentCycleCount,
          paymentMonths,
          paymentData,
          uncashedData,
          paymentMapping: Object.fromEntries(paymentMapping),
          uncashedMapping: Object.fromEntries(uncashedMapping),
          uniqueFileColumn: fileUniqueIdCol,
          uniqueDbColumn: dbUniqueIdCol,
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
          const jsonStr = line.replace("data: ", "");
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === "progress") {
              setWorkerStatus(data.status);
              setWorkerProgress(data.progress);
              setWorkerMessage(data.message);
              if (data.stats) setSaveStats(data.stats);
            } else if (data.type === "done") {
              setWorkerStatus("done");
              setWorkerProgress(100);
              if (data.stats) setSaveStats(data.stats);
              if (data.metrics) setResults(data.metrics);
              toast({ title: "Success", description: data.message });
              setLoading(prev => ({...prev, saving: false}));
              return; // Exit loop on done
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", jsonStr, e);
          }
        }
      }
    } catch (error: any) {
      setWorkerStatus("error");
      toast({ title: "Error during processing", description: error.message, variant: "destructive" });
      setLoading(prev => ({ ...prev, saving: false }));
    }
  }, [projects, selectedProjectId, paymentCycle, paymentCycleCount, paymentMonths, paymentData, uncashedData, paymentMapping, uncashedMapping, fileUniqueIdCol, dbUniqueIdCol, duplicateInfo.duplicateIds, toast]);

  const handleSave = useCallback(async () => {
    if (!paymentReady) {
      toast({ title: "Incomplete", description: "Finish mapping and identifiers before saving.", variant: "destructive" });
      return;
    }
    setLoading(p => ({ ...p, saving: true }));
    setWorkerStatus("checking_duplicates");
    try {
      const ids = computeUniqueIds();
      if (!ids.length) {
        toast({ title: "No identifiers", description: "Upload data with unique IDs first.", variant: "destructive" });
        return;
      }
      
      const response = await fetch("/api/bnf-cash-disbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_duplicates",
          projectId: selectedProjectId,
          uniqueIds: ids,
          uniqueIdCol: dbUniqueIdCol,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to check duplicates.");
      }
      
      setSaveStats(prev => ({ ...prev, total: ids.length }));

      if (data.count > 0) {
        setDuplicateInfo({
          isOpen: true,
          count: data.count,
          totalInDb: data.totalInDb,
          duplicateIds: data.duplicateIds || [],
        });
        setLoading(p => ({ ...p, saving: false }));
      } else {
        await executeSave("replace");
      }
    } catch (error: any) {
      toast({ title: "Validation Error", description: error.message, variant: "destructive" });
      setLoading(p => ({ ...p, saving: false }));
    }
  }, [executeSave, paymentReady, selectedProjectId, dbUniqueIdCol, toast, computeUniqueIds]);

  const isProcessing = loading.saving;
  const statusLabel = STATUS_LABELS[workerStatus] || workerStatus;

  const keyFigures = useMemo(() => [
    { title: "Payment Cycle", value: paymentCycle, icon: <FilePlus className="h-4 w-4" /> },
    { title: "Cycle Count", value: paymentCycleCount, icon: <FileText className="h-4 w-4" /> },
    { title: "Beneficiaries in List", value: aggregatedStats.payCount, icon: <Users className="h-4 w-4" /> },
    { title: "Cashed", value: aggregatedStats.cashedCount, icon: <CheckCircle className="h-4 w-4" /> },
    { title: "Uncashed", value: aggregatedStats.uncashedCount, icon: <Wallet className="h-4 w-4" /> },
    { title: "Total Amount", value: aggregatedStats.payAmount, icon: <CreditCard className="h-4 w-4" /> },
    { title: "Cashed Amount", value: aggregatedStats.cashedAmount, icon: <DollarSign className="h-4 w-4" /> },
    { title: "Uncashed Amount", value: aggregatedStats.uncashedAmount, icon: <DollarSign className="h-4 w-4" /> },
  ], [paymentCycle, paymentCycleCount, aggregatedStats]);
  
  const resultKeyFigures = useMemo(() => results ? [
    { title: "Payment Cycle", value: paymentCycle, icon: <FilePlus className="h-4 w-4" /> },
    { title: "Total Appearance", value: results.totalAppearance, icon: <Users className="h-4 w-4" /> },
    { title: "Total Attendance", value: results.totalAttend, icon: <UserCheck className="h-4 w-4" /> },
    { title: "Total Absence", value: results.totalAbsence, icon: <UserMinus className="h-4 w-4" /> },
    { title: "Alternative Sessions", value: results.totalAlternative, icon: <Activity className="h-4 w-4" /> },
  ] : [], [results, paymentCycle]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Beneficiaries Cash Disturbance Upload</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/process/cash-assistance-disturbance/beneficiaries">
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
            <CardTitle>2. Configure Sheets & Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Payment List Sheet</Label>
                <Select value={paymentSheet} onValueChange={(value) => loadSheet("payment", value)}>
                  <SelectTrigger><SelectValue placeholder="Select sheet..." /></SelectTrigger>
                  <SelectContent>{sheets.map((name) => (<SelectItem key={name} value={name}>{name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Uncashed List Sheet</Label>
                <Select value={uncashedSheet} onValueChange={(value) => loadSheet("absence", value)}>
                  <SelectTrigger><SelectValue placeholder="Select sheet..." /></SelectTrigger>
                  <SelectContent>{sheets.map((name) => (<SelectItem key={name} value={name}>{name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Cycle</Label>
                <Input type="number" min={1} max={76} value={paymentCycle} onChange={(event) => setPaymentCycle(Math.max(1, Math.min(76, Number(event.target.value) || 1)))}/>
              </div>
              <div className="space-y-2">
                <Label>Payment Cycle Count</Label>
                <Input type="number" min={1} value={paymentCycleCount} onChange={(event) => setPaymentCycleCount(Math.max(1, Number(event.target.value) || 1))}/>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {paymentSheet && (
        <Card>
          <CardHeader><CardTitle>3. Map Payment List Columns</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>File Column</Label>
                <Select value={manualPayment.fileCol} onValueChange={(value) => setManualPayment((prev) => ({ ...prev, fileCol: value }))}>
                  <SelectTrigger><SelectValue placeholder="File Column..."/></SelectTrigger><SelectContent>{unmappedPaymentFileColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DB Column</Label>
                <Select value={manualPayment.dbCol} onValueChange={(value) => setManualPayment((prev) => ({ ...prev, dbCol: value }))}>
                  <SelectTrigger><SelectValue placeholder="DB Column..."/></SelectTrigger><SelectContent>{unmappedPaymentDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddPaymentMapping}><Plus className="mr-2 h-4 w-4"/>Add</Button>
            </div>
            <ScrollArea className="h-40 border rounded-md">
              <Table>
                <TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>DB Column</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {aggregateMapping(paymentMapping).map(([fileCol, dbCol]) => (
                    <TableRow key={fileCol}>
                      <TableCell>{fileCol}</TableCell><TableCell>{dbCol}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemovePaymentMapping(fileCol)}><Trash2 className="h-4 w-4"/></Button></TableCell>
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
          <CardHeader><CardTitle>4. Map Uncashed List Columns</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>File Column</Label>
                <Select value={manualUncashed.fileCol} onValueChange={(value) => setManualUncashed((prev) => ({ ...prev, fileCol: value }))}>
                  <SelectTrigger><SelectValue placeholder="File Column..."/></SelectTrigger><SelectContent>{unmappedUncashedFileColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DB Column</Label>
                <Select value={manualUncashed.dbCol} onValueChange={(value) => setManualUncashed((prev) => ({ ...prev, dbCol: value }))}>
                  <SelectTrigger><SelectValue placeholder="DB Column..."/></SelectTrigger><SelectContent>{unmappedUncashedDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddUncashedMapping}><Plus className="mr-2 h-4 w-4"/>Add</Button>
            </div>
            <ScrollArea className="h-40 border rounded-md">
              <Table>
                <TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>DB Column</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {aggregateMapping(uncashedMapping).map(([fileCol, dbCol]) => (
                    <TableRow key={fileCol}>
                      <TableCell>{fileCol}</TableCell><TableCell>{dbCol}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveUncashedMapping(fileCol)}><Trash2 className="h-4 w-4"/></Button></TableCell>
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
          <CardTitle>5. Save to Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unique ID from File</Label>
              <Select value={fileUniqueIdCol} onValueChange={setFileUniqueIdCol}>
                <SelectTrigger><SelectValue placeholder="Select file column"/></SelectTrigger>
                <SelectContent>{combinedFileColumns.map((col) => <SelectItem key={col} value={col}>{col}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unique ID in DB</Label>
              <Select value={dbUniqueIdColumn} onValueChange={setDbUniqueIdCol}>
                <SelectTrigger><SelectValue placeholder="Select db column"/></SelectTrigger>
                <SelectContent>{dbColumns.map((col) => <SelectItem key={col} value={col}>{col}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={handleSave} disabled={!paymentReady || isProcessing} className="w-full">
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
              Save to Database
            </Button>
            {isProcessing && (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Status: {statusLabel}</p>
                <p>Progress: {workerProgress}% (Saved: {saveStats.saved}, Updated: {saveStats.updated}, Skipped: {saveStats.skipped} / {saveStats.total})</p>
                <Progress value={workerProgress}/>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo(prev => ({...prev, isOpen}))}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                  <AlertDialogDescription>
                      Found {duplicateInfo.count} record(s) that already exist in the database out of {duplicateInfo.totalInDb}. How would you like to proceed?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex flex-col gap-2">
                  <Button variant="outline" onClick={() => { executeSave("skip"); setDuplicateInfo(prev => ({...prev, isOpen: false})); }}>
                      Skip Existing & Save New Records
                  </Button>
                  <AlertDialogAction asChild>
                      <Button onClick={() => { executeSave("replace"); setDuplicateInfo(prev => ({...prev, isOpen: false})); }}>
                          Update All Matching Records
                      </Button>
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
            <CardHeader><CardTitle>Results Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {resultKeyFigures.map(fig => <KeyFiguresCard key={fig.title} {...fig} />)}
            </CardContent>
             <CardContent className="flex gap-2">
                <Button asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disturbance/beneficiaries/dashboard">Dashboard</Link></Button>
                <Button asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disturbance/beneficiaries/database">Database</Link></Button>
             </CardContent>
        </Card>
      )}
    </div>
  );
}
