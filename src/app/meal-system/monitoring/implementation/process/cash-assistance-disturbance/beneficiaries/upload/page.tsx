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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  { name: "pay_cyc_mon_list", type: "TEXT" },
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

const LOCAL_STORAGE_PREFIX = "bnf-cash-disturbance-mapping";

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE: "Seeding from Enrollment DB...",
  SECOND_STEP_SAVING_PAYMENT_CYCLE_LIST: "Processing Payment List...",
  THIRD_STEP_SAVING_PAYMENT_CYCLE_COUNT: "Updating Cycle Count...",
  FOURTH_STEP_SAVING_PAYMENT_CYCLE_MONTHS: "Saving Cycle Months...",
  FIFTH_STEP_SAVING_UNCASHED_LIST: "Processing Uncashed List...",
  SIXTH_STEP_SAVING_CASHED_DATA: "Calculating Cashed Data...",
  SEVENTH_STEP_SAVING_TOTAL_VALUES: "Aggregating Final Totals...",
  done: "Completed",
  error: "Error",
};


const getCycleColumns = (cycle: number) => CYCLE_FIELDS.map((field) => `${field.name}_s${cycle}`);

const getMappingStorageKey = (
  projectId: string,
  fileName: string,
  cycle: number,
  type: "payment" | "uncashed"
) => `${LOCAL_STORAGE_PREFIX}-${projectId}-${fileName}-s${cycle}-${type}`;


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

export default function BeneficiariesCashDisbursementUploadPage() {
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
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [paymentMapping, setPaymentMapping] = useState<Record<string, string>>({});
  const [uncashedMapping, setUncashedMapping] = useState<Record<string, string>>({});
  const [manualPayment, setManualPayment] = useState({ fileCol: "", dbCol: "" });
  const [manualUncashed, setManualUncashed] = useState({ fileCol: "", dbCol: "" });
  const [fileUniqueIdColumn, setFileUniqueIdColumn] = useState("");
  const [dbUniqueIdColumn, setDbUniqueIdColumn] = useState("benef_id");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
  const [duplicateState, setDuplicateState] = useState({
    open: false,
    count: 0,
    totalInDb: 0,
    ids: [] as string[],
  });
  const [resultMetrics, setResultMetrics] = useState<any>(null);

  const fetchDbColumns = async () => {
    try {
      const res = await fetch("/api/bnf-cash-disbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schema" }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.columns) && data.columns.length ? data.columns : [];
    } catch {
      return [];
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
    setResultMetrics(null);
  };

  const cycleDbColumns = useMemo(() => {
    const cycleColumns = getCycleColumns(paymentCycle);
    return Array.from(new Set([...GENERAL_COLUMNS, ...cycleColumns, "pc_id", "pc_name"]));
  }, [paymentCycle]);

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
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        setFile(f);
        setSheets([]);
        setPaymentSheet("");
        setUncashedSheet("");
        setPaymentData([]);
        setUncashedData([]);
        setPaymentColumns([]);
        setUncashedColumns([]);
        setResultMetrics(null);
        setStatus('idle');
      }
  };

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
  
  const paymentReady = useMemo(() => {
    const hasBenef =
      Object.values(paymentMapping).includes("benef_id") ||
      Object.values(uncashedMapping).includes("benef_id");
    return !!selectedProjectId && !!file && hasBenef && !!fileUniqueIdColumn;
  }, [paymentMapping, uncashedMapping, selectedProjectId, file, fileUniqueIdColumn]);

  const combinedRows = useMemo(() => [...paymentData, ...uncashedData], [paymentData, uncashedData]);

  const computeUniqueIds = () => {
    if (!fileUniqueIdColumn) return [];
    const ids = combinedRows
      .map((row) => (row[fileUniqueIdColumn] || "").toString().trim())
      .filter(Boolean);
    return Array.from(new Set(ids));
  };

  const handleCheckDuplicates = async () => {
    if (!paymentReady) {
      toast({ title: "Missing mapping", description: "Map benef_id and select a unique identifier.", variant: "destructive" });
      return;
    }
    const ids = computeUniqueIds();
    if (!ids.length) {
      toast({ title: "No identifiers", description: "No data with unique IDs found in file.", variant: "destructive" });
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
        uniqueIdCol: dbUniqueIdColumn,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast({ title: "Duplicate check failed", description: data.error, variant: "destructive" });
      setStatus("error");
      return;
    }
    setStats((prev) => ({ ...prev, total: ids.length }));
    if (data.count > 0) {
      setDuplicateState({ open: true, count: data.count, totalInDb: data.totalInDb, ids: data.duplicateIds || [] });
    } else {
      await executeSave("replace");
    }
  };

  const executeSave = async (mode: "skip" | "replace") => {
    setDuplicateState(p => ({...p, open: false}));
    setSaving(true);
    setStatus("STEP_ONE");
    setProgress(15);
    setMessage("");
    setResultMetrics(null);

    try {
      const projectName = projects.find(p => p.projectId === selectedProjectId)?.projectName || "";
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
          uniqueFileColumn: fileUniqueIdColumn,
          uniqueDbColumn: dbUniqueIdColumn,
          mode,
          duplicateIds: duplicateState.ids,
        }),
      });

      if (!response.body) throw new Error("No response stream from server.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: !done });
        const lines = chunk.split("\n\n").filter(line => line.startsWith("data: "));
        for (const line of lines) {
          try {
            const jsonStr = line.replace("data: ", "");
            const data = JSON.parse(jsonStr);
            if (data.type === "progress") {
              setStatus(data.status);
              setProgress(data.progress);
              setMessage(data.message);
              if (data.stats) setStats(data.stats);
            } else if (data.type === "done") {
              setStatus("done");
              setProgress(100);
              if (data.stats) setStats(data.stats);
              if (data.metrics) setResultMetrics(data.metrics);
              toast({ title: "Success", description: data.message || "Data saved." });
              done = true;
              break;
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (e) {
            console.warn("Could not parse JSON chunk from stream:", e);
          }
        }
      }
    } catch (error: any) {
      setStatus("error");
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  
  const statusLabel = STATUS_LABELS[status] || status;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Beneficiaries Disturbance Upload</h1>
          <p className="text-sm text-muted-foreground">Map your upload file to the disturbance database.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disturbance"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Hub</Link></Button>
        </div>
      </div>

       <Card>
          <CardHeader><CardTitle>1. Select Project & Upload File</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger><SelectValue placeholder="Select project..."/></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent></Select>
            <Input type="file" onChange={handleFileChange} accept=".xls,.xlsx,.xlsm,.xlsb,.csv,.txt" />
          </CardContent>
        </Card>

      {file && (
        <Card>
            <CardHeader><CardTitle>2. Configure Sheets & Session</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <div className="space-y-2"><Label>Payment List Sheet</Label><Select value={paymentSheet} onValueChange={(v) => loadSheet(v, 'payment')}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                     <div className="space-y-2"><Label>Uncashed List Sheet</Label><Select value={uncashedSheet} onValueChange={(v) => loadSheet(v, 'uncashed')}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                     <div className="space-y-2"><Label>Payment Cycle</Label><Input type="number" min={1} max={76} value={paymentCycle} onChange={e=>setPaymentCycle(Math.max(1, Math.min(76, Number(e.target.value)||1)))} /></div>
                     <div className="space-y-2"><Label>Payment Cycle Count</Label><Input type="number" min={1} value={paymentCycleCount} onChange={e=>setPaymentCycleCount(Math.max(1, Number(e.target.value)||1))} /></div>
                </div>
                <div className="space-y-2">
                    <Label>Payment Cycle Months</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                         <Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger><SelectValue placeholder="Month"/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                         <Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={String(y)} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                        <Button onClick={addPaymentMonth} disabled={!selectedMonth || !selectedYear}><Plus className="mr-2 h-4 w-4"/>Add Month</Button>
                    </div>
                     <div className="flex flex-wrap gap-2 pt-2">{paymentMonths.map(m => <Button key={m} variant="ghost" size="sm" onClick={() => removePaymentMonth(m)}>{m} <Trash2 className="ml-2 h-3 w-3"/></Button>)}</div>
                </div>
            </CardContent>
        </Card>
      )}

      {(paymentSheet || uncashedSheet) && (
        <Card>
            <CardHeader><CardTitle>3. Map Data Columns</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Unique ID from File</Label><Select value={fileUniqueIdColumn} onValueChange={setFileUniqueIdColumn}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{combinedFileColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Unique ID in DB</Label><Select value={dbUniqueIdColumn} onValueChange={setDbUniqueIdColumn} disabled={!dbColumns.length}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{GENERAL_COLUMNS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                </div>
                {paymentSheet && <MappingTable title="Payment List Mapping" fileColumns={unmappedPaymentFileColumns} dbColumns={unmappedPaymentDbColumns} manualState={manualPayment} onManualStateChange={setManualPayment} onAdd={handleAddPaymentMapping} onRemove={handleRemovePaymentMapping} mapping={paymentMapping} />}
                {uncashedSheet && <MappingTable title="Uncashed List Mapping" fileColumns={unmappedUncashedFileColumns} dbColumns={unmappedUncashedDbColumns} manualState={manualUncashed} onManualStateChange={setManualUncashed} onAdd={handleAddUncashedMapping} onRemove={handleRemoveUncashedMapping} mapping={uncashedMapping} />}
            </CardContent>
        </Card>
      )}

      {file && (
        <Card>
            <CardHeader><CardTitle>4. Save to Database</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleCheckDuplicates} disabled={!paymentReady || saving}><Save className="mr-2 h-4 w-4"/>Save Data</Button>
                {duplicateState.open && <AlertDialog open onOpenChange={open => setDuplicateState(p => ({...p, open}))}>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Duplicates Found</AlertDialogTitle><AlertDialogDescription>{duplicateState.count} duplicates detected. Total in DB: {duplicateState.totalInDb}.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <Button variant="outline" onClick={() => executeSave('skip')}>Skip Duplicates</Button>
                            <AlertDialogAction asChild><Button onClick={() => executeSave('replace')}>Update Existing</Button></AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>}
                {saving && <div className="space-y-1"><p className="text-sm text-muted-foreground">{statusLabel}: {message}</p><Progress value={progress}/></div>}
            </CardContent>
        </Card>
      )}
      
      {resultMetrics && (
        <Card>
            <CardHeader><CardTitle>Results</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                 <KeyFigureCard title="Beneficiaries In List" value={resultMetrics.totalAppearance} icon={<Users/>}/>
                 <KeyFigureCard title="Beneficiaries Cashed" value={resultMetrics.totalAttend} icon={<UserCheck/>}/>
                 <KeyFigureCard title="Beneficiaries Uncashed" value={resultMetrics.totalAbsence} icon={<UserMinus/>}/>
                 <KeyFigureCard title="Alternative Sessions" value={resultMetrics.totalAlternative} icon={<Activity/>}/>
                 <KeyFigureCard title="Payment Amount" value={resultMetrics.totalPaymentAmount} icon={<DollarSign/>}/>
                 <KeyFigureCard title="Cashed Amount" value={resultMetrics.totalCashedAmount} icon={<Wallet/>}/>
                 <KeyFigureCard title="Uncashed Amount" value={resultMetrics.totalUncashedAmount} icon={<CreditCard/>}/>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

const MappingTable = ({title, fileColumns, dbColumns, manualState, onManualStateChange, onAdd, onRemove, mapping}: any) => (
     <Card>
        <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div><Label>File Column</Label><Select value={manualState.fileCol} onValueChange={v => onManualStateChange((p: any) => ({...p, fileCol: v}))}><SelectTrigger><SelectValue placeholder="File Column..."/></SelectTrigger><SelectContent>{fileColumns.map((c:string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>DB Column</Label><Select value={manualState.dbCol} onValueChange={v => onManualStateChange((p: any) => ({...p, dbCol: v}))}><SelectTrigger><SelectValue placeholder="DB Column..."/></SelectTrigger><SelectContent>{dbColumns.map((c:string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4"/>Add</Button>
            </div>
            <ScrollArea className="h-40 border rounded-md"><Table>
                <TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>DB Column</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>{Object.entries(mapping).map(([file, db]: [string, any]) => <TableRow key={file}><TableCell>{file}</TableCell><TableCell>{db}</TableCell><TableCell><Button size="icon" variant="ghost" onClick={() => onRemove(file)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody>
            </Table></ScrollArea>
        </CardContent>
    </Card>
);