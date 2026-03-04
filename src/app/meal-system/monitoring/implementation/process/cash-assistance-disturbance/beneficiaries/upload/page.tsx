"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const CYCLE_FIELDS = [
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
    CYCLE_FIELDS.map((field) => `${field}_s${idx + 1}`)
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
const LOCAL_STORAGE_PREFIX = "bnf-cash-disturbance-mapping";
const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  STEP_ONE: "Step 1 · Enrollment Review",
  STEP_TWO: "Step 2 · Payment Cycle List",
  STEP_THREE: "Step 3 · Payment Cycle Count",
  STEP_FOUR: "Step 4 · Payment Cycle Months",
  STEP_FIVE: "Step 5 · Uncashed List",
  STEP_SIX: "Step 6 · Cashed Data",
  STEP_SEVEN: "Step 7 · Totals",
  done: "Completed",
  error: "Error",
};

const getCycleColumns = (cycle: number) => CYCLE_FIELDS.map((field) => `${field}_s${cycle}`);
const getMappingStorageKey = (
  projectId: string,
  fileName: string,
  cycle: number,
  type: "payment" | "uncashed"
) => `${LOCAL_STORAGE_PREFIX}-${projectId}-${fileName}-s${cycle}-${type}`;

const findFileColumn = (mapping: Record<string, string>, target: string) => {
  return Object.entries(mapping).find(([, dbCol]) => dbCol === target)?.[0] || "";
};
const safeNumber = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const KeyFigureCard = ({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
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
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
  const [duplicateState, setDuplicateState] = useState({
    open: false,
    count: 0,
    totalInDb: 0,
    ids: [] as string[],
  });
  const [resultMetrics, setResultMetrics] = useState<any>(null);
  const [workerMessage, setWorkerMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
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

  const loadSheet = (sheetName: string, type: "payment" | "uncashed") => {
    if (!file) return;
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
  };

  const cycleMappedColumns = useMemo(() => {
    const cycleColumns = getCycleColumns(paymentCycle);
    return Array.from(new Set([...GENERAL_COLUMNS, ...cycleColumns, "pc_id", "pc_name"]));
  }, [paymentCycle]);

  const combinedFileColumns = useMemo(() => Array.from(new Set([...paymentColumns, ...uncashedColumns])), [
    paymentColumns,
    uncashedColumns,
  ]);

  const unmappedPaymentFileColumns = paymentColumns.filter((col) => !paymentMapping[col]);
  const unmappedPaymentDbColumns = cycleMappedColumns.filter(
    (col) => col !== "Id" && !Object.values(paymentMapping).includes(col)
  );

  const unmappedUncashedFileColumns = uncashedColumns.filter((col) => !uncashedMapping[col]);
  const unmappedUncashedDbColumns = cycleMappedColumns.filter(
    (col) => col !== "Id" && !Object.values(uncashedMapping).includes(col)
  );

  const handleAddPaymentMapping = () => {
    if (!manualPayment.fileCol || !manualPayment.dbCol) return;
    setPaymentMapping((prev) => ({ ...prev, [manualPayment.fileCol]: manualPayment.dbCol }));
    setManualPayment({ fileCol: "", dbCol: "" });
  };

  const handleAddUncashedMapping = () => {
    if (!manualUncashed.fileCol || !manualUncashed.dbCol) return;
    setUncashedMapping((prev) => ({ ...prev, [manualUncashed.fileCol]: manualUncashed.dbCol }));
    setManualUncashed({ fileCol: "", dbCol: "" });
  };

  const handleRemovePaymentMapping = (fileCol: string) => {
    setPaymentMapping((prev) => {
      const next = { ...prev };
      delete next[fileCol];
      return next;
    });
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

  const handleCheckDuplicates = async () => {
    if (!paymentReady) {
      toast({
        title: "Missing mapping",
        description: "Map benef_id and select unique identifier before checking duplicates.",
        variant: "destructive",
      });
      return;
    }
    const ids = computeUniqueIds();
    if (!ids.length) {
      toast({ title: "No identifiers", description: "Upload data with unique IDs first.", variant: "destructive" });
      return;
    }
    setStatus("STEP_ONE");
    setProgress(10);
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
      toast({ title: "Duplicate check failed", description: data.error || "Unable to check duplicates.", variant: "destructive" });
      setStatus("error");
      return;
    }
    setStats((prev) => ({ ...prev, total: ids.length }));
    if (data.count > 0) {
      setDuplicateState({
        open: true,
        count: data.count,
        totalInDb: data.totalInDb,
        ids: data.duplicateIds || [],
      });
    } else {
      await executeSave("replace");
    }
  };

  const processEventStream = async (response: Response) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("No readable stream");
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;
        const dataLine = trimmed.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const payload = JSON.parse(dataLine.replace("data: ", ""));
          if (payload.type === "progress") {
            setStatus(payload.status || status);
            setProgress(payload.progress ?? progress);
            setWorkerMessage(payload.message || "");
            if (payload.stats) setStats(payload.stats);
          } else if (payload.type === "done") {
            setWorkerProgress(100);
            setStatus("done");
            if (payload.stats) setStats(payload.stats);
            if (payload.metrics) setResultMetrics(payload.metrics);
            toast({ title: "Saved", description: payload.message || "Data persisted to database." });
          } else if (payload.type === "error") {
            throw new Error(payload.error || "Unable to save data.");
          }
        } catch (err) {
          console.error("Failed to parse SSE payload", err);
        }
      }
    }
  };

  const executeSave = async (mode: "skip" | "replace") => {
    if (!paymentReady) {
      toast({ title: "Incomplete", description: "Finish mapping and identifiers before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    setStatus("STEP_ONE");
    setProgress(15);
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
          paymentMapping,
          uncashedMapping,
          uniqueFileColumn: fileUniqueIdCol,
          uniqueDbColumn: dbUniqueIdCol,
          mode,
          duplicateIds: duplicateState.ids,
        }),
      });

      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        await processEventStream(response);
      } else {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to save data.");
        setWorkerProgress(100);
        setStatus("done");
        setStats(data.stats || stats);
        setResultMetrics(data.metrics || null);
        toast({ title: "Saved", description: data.message || "Data persisted to database." });
      }
    } catch (error: any) {
      setStatus("error");
      toast({ title: "Save failed", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = STATUS_LABELS[status] || status;
  const duplicatePanel = duplicateState.open && (
    <Card className="border border-destructive bg-destructive/10">
      <CardHeader>
        <CardTitle className="text-base text-destructive">Duplicate Beneficiaries Found</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {duplicateState.count} duplicate record(s) detected. Total in database: {duplicateState.totalInDb}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setDuplicateState((prev) => ({ ...prev, open: false }));
              await executeSave("skip");
            }}
          >
            Skip duplicates & save new
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setDuplicateState((prev) => ({ ...prev, open: false }));
              await executeSave("replace");
            }}
          >
            Update duplicates & save new
          </Button>
          <Button variant="ghost" onClick={() => setDuplicateState((prev) => ({ ...prev, open: false }))}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const keyFigures = [
    {
      title: "Payment Cycle",
      value: paymentCycle,
      icon: <FilePlus className="h-4 w-4" />,
    },
    {
      title: "Payment Cycle Count",
      value: paymentCycleCount,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      title: "Beneficiaries in List",
      value: aggregatedStats.payCount,
      icon: <Users className="h-4 w-4" />,
    },
    {
      title: "Beneficiaries Cashed",
      value: aggregatedStats.cashedCount,
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      title: "Beneficiaries Uncashed",
      value: aggregatedStats.uncashedCount,
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      title: "Total Amount",
      value: aggregatedStats.payAmount,
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      title: "Money Cashed",
      value: aggregatedStats.cashedAmount,
      icon: <CheckCircle className="h-4 w-4" />,
    },
    {
      title: "Money Uncashed",
      value: aggregatedStats.uncashedAmount,
      icon: <CheckCircle className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Beneficiaries Disturbance Upload</h1>
          <p className="text-sm text-muted-foreground">
            Map your upload file to the disturbance database and follow the seven-step saving process.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance/dashboard">
              <Upload className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild>
            <Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance/database">
              <Database className="mr-2 h-4 w-4" />
              Database
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Hub
            </Link>
          </Button>
        </div>
      </div>
      
            <Card>
        <CardHeader>
          <CardTitle>Select Project & Upload File</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <Input type="file" onChange={handleFileChange} accept=".xls,.xlsx,.xlsm,.xlsb,.csv,.txt" />
        </CardContent>
      </Card>

      {file && (
        <Card>
          <CardHeader>
            <CardTitle>Sheets & Cycle Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Payment List Sheet</Label>
                <Select value={paymentSheet} onValueChange={(value) => loadSheet(value, "payment")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sheet..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Uncashed List Sheet</Label>
                <Select value={uncashedSheet} onValueChange={(value) => loadSheet(value, "uncashed")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sheet..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Cycle</Label>
                <Input
                  type="number"
                  min={1}
                  max={76}
                  value={paymentCycle}
                  onChange={(event) => setPaymentCycle(Math.max(1, Math.min(76, Number(event.target.value) || 1)))}
                />
              </div>
              <div>
                <Label>Payment Cycle Count</Label>
                <Input
                  type="number"
                  min={1}
                  value={paymentCycleCount}
                  onChange={(event) => setPaymentCycleCount(Math.max(1, Number(event.target.value) || 1))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Months</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
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
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" onClick={addPaymentMonth} disabled={!selectedMonth || !selectedYear}>
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
          <CardHeader>
            <CardTitle>Payment List Manual Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label>File Column</Label>
                <Select value={manualPayment.fileCol} onValueChange={(value) => setManualPayment((prev) => ({ ...prev, fileCol: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="File Column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Database Column</Label>
                <Select value={manualPayment.dbCol} onValueChange={(value) => setManualPayment((prev) => ({ ...prev, dbCol: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="DB Column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cycleMappedColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddPaymentMapping}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            <ScrollArea className="h-40 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Column</TableHead>
                    <TableHead>DB Column</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(paymentMapping).map(([fileCol, dbCol]) => (
                    <TableRow key={fileCol}>
                      <TableCell>{fileCol}</TableCell>
                      <TableCell>{dbCol}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => handleRemovePaymentMapping(fileCol)}>
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
          <CardHeader>
            <CardTitle>Uncashed List Manual Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label>File Column</Label>
                <Select
                  value={manualUncashed.fileCol}
                  onValueChange={(value) => setManualUncashed((prev) => ({ ...prev, fileCol: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select file column" />
                  </SelectTrigger>
                  <SelectContent>
                    {unmappedUncashedFileColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Database Column</Label>
                <Select
                  value={manualUncashed.dbCol}
                  onValueChange={(value) => setManualUncashed((prev) => ({ ...prev, dbCol: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select db column" />
                  </SelectTrigger>
                  <SelectContent>
                    {unmappedUncashedDbColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="secondary" onClick={handleAddUncashedMapping} disabled={!manualUncashed.fileCol || !manualUncashed.dbCol}>
                <Plus className="mr-2 h-4 w-4" />
                Map
              </Button>
            </div>
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
                  {Object.entries(uncashedMapping).map(([fileCol, dbCol]) => (
                    <TableRow key={fileCol}>
                      <TableCell>{fileCol}</TableCell>
                      <TableCell>{dbCol}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => handleRemoveUncashedMapping(fileCol)}>
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
        <CardTitle>Unique Identifiers & Saving</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Unique ID from File</Label>
              <Select value={fileUniqueIdCol} onValueChange={setFileUniqueIdCol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select file column" />
                </SelectTrigger>
                <SelectContent>
                  {combinedFileColumns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unique ID in DB</Label>
              <Select value={dbUniqueIdCol} onValueChange={setDbUniqueIdCol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select db column" />
                </SelectTrigger>
                <SelectContent>
                  {GENERAL_COLUMNS.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleCheckDuplicates}
              disabled={!paymentReady || saving}
              className="w-full"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save to Database
            </Button>
            {duplicatePanel}
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Status: {statusLabel}</p>
              <p>
                Progress: {progress}% ({workerMessage}) (Saved {stats.saved}, Updated {stats.updated}, Skipped {stats.skipped} /{" "}
                {stats.total})
              </p>
            </div>
            <Progress value={progress} />
          </div>
        </CardContent>
      </Card>
            <Card>
        <CardHeader>
          <CardTitle>Result Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {keyFigures.map((figure) => (
            <KeyFigureCard key={figure.title} title={figure.title} value={figure.value} icon={figure.icon} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance/dashboard">
              <Upload className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button asChild>
            <Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance/database">
              <Database className="mr-2 h-4 w-4" />
              Go to Database
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/meal-system/monitoring/implementation/process/bnf-cash-distrubance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Hub
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
