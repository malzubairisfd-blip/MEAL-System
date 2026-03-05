// app/meal-system/monitoring/implementation/process/cash-assistance-disbursement/upload/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Database, DollarSign, FilePlus, FileText, Loader2, Plus, Save, Trash2, Upload, Users, Wallet, CreditCard, CheckCircle } from "lucide-react";

const MONTHS = [ "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر" ];
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i);

const CYCLE_FIELDS: { name: string; type: "TEXT" | "INTEGER" | "REAL" }[] = [
  { name: "is_pay_list", type: "INTEGER" }, { name: "pay_cyc_cnt", type: "INTEGER" },
  { name: "pay_cyc_mon_list", type: "TEXT" }, { name: "pay_amt", type: "INTEGER" },
  { name: "is_cashed", type: "INTEGER" }, { name: "cashed_amt", type: "INTEGER" },
  { name: "is_uncashed", type: "INTEGER" }, { name: "uncashed_amt", type: "INTEGER" },
  { name: "uncashed_code", type: "INTEGER" }, { name: "uncashed_reason", type: "TEXT" },
  { name: "recom", type: "TEXT" },
];

const GENERAL_COLUMNS = ["benef_id", "pc_id", "pc_name", "project_id", "project_name"];

const LOCAL_STORAGE_MAPPING_PREFIX = "bnf-cash-disturbance-mapping";
const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  STEP_ONE: "Step 1 · Enrollment Review Database Check",
  STEP_TWO: "Step 2 · Saving Payment Cycle List",
  STEP_THREE: "Step 3 · Saving Payment Cycle Count",
  STEP_FOUR: "Step 4 · Saving Payment Cycle Months",
  STEP_FIVE: "Step 5 · Saving Uncashed List",
  STEP_SIX: "Step 6 · Saving Cashed Data",
  STEP_SEVEN: "Step 7 · Saving Total Values",
  done: "Completed",
  error: "Error",
};

const getCycleColumns = (cycle: number) => CYCLE_FIELDS.map((field) => `${field.name}_s${cycle}`);
const getMappingStorageKey = (projectId: string, fileName: string, cycle: number, type: "payment" | "uncashed") => 
  `${LOCAL_STORAGE_MAPPING_PREFIX}-${projectId}-${fileName}-s${cycle}-${type}`;

const findFileColumn = (mapping: Record<string, string>, target: string) => Object.entries(mapping).find(([, dbCol]) => dbCol === target)?.[0] || "";
const safeNumber = (value: any) => { const num = Number(value); return Number.isFinite(num) ? num : 0; };

const KeyFigureCard = ({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
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
  const [workerMessage, setWorkerMessage] = useState("");
  const [duplicateState, setDuplicateState] = useState({ open: false, count: 0, totalInDb: 0, ids: [] as string[] });

  useEffect(() => {
    fetch("/api/projects").then((res) => res.json()).then((data) => setProjects(data || []));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const workbook = XLSX.read(event.target?.result, { type: "binary" });
        setSheets(workbook.SheetNames);
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  useEffect(() => {
    if (!selectedProjectId || !file) return;
    const pKey = getMappingStorageKey(selectedProjectId, file.name, paymentCycle, "payment");
    const uKey = getMappingStorageKey(selectedProjectId, file.name, paymentCycle, "uncashed");
    
    if (localStorage.getItem(pKey)) setPaymentMapping(JSON.parse(localStorage.getItem(pKey)!));
    if (localStorage.getItem(uKey)) setUncashedMapping(JSON.parse(localStorage.getItem(uKey)!));
  }, [selectedProjectId, file?.name, paymentCycle]);

  useEffect(() => {
    if (!selectedProjectId || !file) return;
    localStorage.setItem(getMappingStorageKey(selectedProjectId, file.name, paymentCycle, "payment"), JSON.stringify(paymentMapping));
  }, [paymentMapping, selectedProjectId, file?.name, paymentCycle]);

  useEffect(() => {
    if (!selectedProjectId || !file) return;
    localStorage.setItem(getMappingStorageKey(selectedProjectId, file.name, paymentCycle, "uncashed"), JSON.stringify(uncashedMapping));
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
        setPaymentData(data); setPaymentColumns(headers); setPaymentSheet(sheetName);
      } else {
        setUncashedData(data); setUncashedColumns(headers); setUncashedSheet(sheetName);
      }
    };
    reader.readAsBinaryString(file);
  };

  const cycleMappedColumns = useMemo(() => Array.from(new Set([...GENERAL_COLUMNS, ...getCycleColumns(paymentCycle)])), [paymentCycle]);
  const combinedFileColumns = useMemo(() => Array.from(new Set([...paymentColumns, ...uncashedColumns])), [paymentColumns, uncashedColumns]);

  const unmappedPaymentFileColumns = paymentColumns.filter((col) => !paymentMapping[col]);
  const unmappedPaymentDbColumns = cycleMappedColumns.filter((col) => !Object.values(paymentMapping).includes(col));
  const unmappedUncashedFileColumns = uncashedColumns.filter((col) => !uncashedMapping[col]);
  const unmappedUncashedDbColumns = cycleMappedColumns.filter((col) => !Object.values(uncashedMapping).includes(col));

  const addMapping = (type: "payment" | "uncashed") => {
    if (type === "payment" && manualPayment.fileCol && manualPayment.dbCol) {
      setPaymentMapping(p => ({ ...p, [manualPayment.fileCol]: manualPayment.dbCol }));
      setManualPayment({ fileCol: "", dbCol: "" });
    } else if (type === "uncashed" && manualUncashed.fileCol && manualUncashed.dbCol) {
      setUncashedMapping(p => ({ ...p, [manualUncashed.fileCol]: manualUncashed.dbCol }));
      setManualUncashed({ fileCol: "", dbCol: "" });
    }
  };

  const removeMapping = (col: string, type: "payment" | "uncashed") => {
    if (type === "payment") setPaymentMapping(p => { const n = { ...p }; delete n[col]; return n; });
    else setUncashedMapping(p => { const n = { ...p }; delete n[col]; return n; });
  };

  const addPaymentMonth = () => {
    if (selectedMonth && selectedYear) {
      const entry = `${selectedMonth} ${selectedYear}`;
      if (!paymentMonths.includes(entry)) setPaymentMonths(p => [...p, entry]);
    }
  };

  const aggregatedStats = useMemo(() => {
    const s = `s${paymentCycle}`;
    let payCount = 0, payAmount = 0, cashedCount = 0, cashedAmount = 0, uncashedCount = 0, uncashedAmount = 0;

    const getCol = (target: string) => findFileColumn(paymentMapping, target) || findFileColumn(uncashedMapping, target);
    
    [...paymentData, ...uncashedData].forEach((row) => {
      if (safeNumber(row[getCol(`is_pay_list_${s}`)]) === 1) payCount++;
      payAmount += safeNumber(row[getCol(`pay_amt_${s}`)]);
      if (safeNumber(row[getCol(`is_cashed_${s}`)]) >= 1) cashedCount++;
      cashedAmount += safeNumber(row[getCol(`cashed_amt_${s}`)]);
      
      const recom = (row[getCol(`recom_${s}`)] || "").toString().trim();
      const isUncashed = safeNumber(row[getCol(`is_uncashed_${s}`)]) === 1;
      
      if ((!recom || recom === "يعاد الصرف للحالة") && recom !== "تورد الى حساب الممول") {
        if (isUncashed) uncashedCount++;
        uncashedAmount += safeNumber(row[getCol(`uncashed_amt_${s}`)]);
      }
    });

    return { payCount, payAmount, cashedCount, cashedAmount, uncashedCount, uncashedAmount };
  }, [paymentCycle, paymentData, uncashedData, paymentMapping, uncashedMapping]);

  const executeSave = useCallback(async (mode: "skip" | "replace") => {
    setSaving(true);
    setStatus("STEP_ONE"); setProgress(15);
    try {
      const response = await fetch("/api/bnf-cash-disbursement", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save", mode,
          projectId: selectedProjectId,
          projectName: projects.find(p => p.projectId === selectedProjectId)?.projectName || "",
          paymentCycle, paymentCycleCount, paymentMonths,
          paymentData, uncashedData,
          paymentMapping, uncashedMapping,
          uniqueFileColumn: fileUniqueIdCol, uniqueDbColumn: dbUniqueIdCol,
          duplicateIds: duplicateState.ids,
        }),
      });

      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";
          for (const chunk of chunks) {
            if (!chunk.startsWith("data: ")) continue;
            const payload = JSON.parse(chunk.substring(6));
            if (payload.type === "progress") {
              setStatus(payload.status); setProgress(payload.progress);
              setWorkerMessage(payload.message); if (payload.stats) setStats(payload.stats);
            } else if (payload.type === "done") {
              setProgress(100); setStatus("done"); setStats(payload.stats);
              toast({ title: "Saved", description: "Database updated successfully." });
            } else if (payload.type === "error") throw new Error(payload.error);
          }
        }
      }
    } catch (error: any) {
      setStatus("error"); toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false); setDuplicateState(p => ({ ...p, open: false }));
    }
  }, [selectedProjectId, projects, paymentCycle, paymentCycleCount, paymentMonths, paymentData, uncashedData, paymentMapping, uncashedMapping, fileUniqueIdCol, dbUniqueIdCol, duplicateState.ids, toast]);

  const handleSave = async () => {
    if (!selectedProjectId || !file || !fileUniqueIdCol || !dbUniqueIdCol) return toast({ title: "Error", description: "Missing identifiers or config.", variant: "destructive" });
    
    setSaving(true);
    try {
      const ids = Array.from(new Set([...paymentData, ...uncashedData].map(r => (r[fileUniqueIdCol] || "").toString().trim()).filter(Boolean)));
      
      const res = await fetch("/api/bnf-cash-disbursement", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_duplicates", projectId: selectedProjectId, uniqueIds: ids, uniqueIdCol: dbUniqueIdCol }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      if (result.count > 0) {
        setDuplicateState({ open: true, count: result.count, totalInDb: result.totalInDb, ids: result.duplicateIds });
      } else await executeSave("replace");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const paymentReady = !!selectedProjectId && !!file && !!fileUniqueIdCol && (Object.values(paymentMapping).includes("benef_id") || Object.values(uncashedMapping).includes("benef_id"));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Beneficiaries Disbursement Upload</h1>
          <p className="text-sm text-muted-foreground">Map data lists to database fields via a strict 7-step saving process.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/dashboard"><Upload className="mr-2 h-4 w-4" />Dashboard</Link></Button>
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/database"><Database className="mr-2 h-4 w-4" />Database</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/"><ArrowLeft className="mr-2 h-4 w-4" />Back to Hub</Link></Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Select Project & Upload</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
            <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName} ({p.projectId})</SelectItem>)}</SelectContent>
          </Select>
          <Input type="file" onChange={handleFileChange} accept=".xls,.xlsx,.xlsm,.xlsb,.csv,.txt" />
        </CardContent>
      </Card>

      {file && (
        <Card>
          <CardHeader><CardTitle>2. Global Setup & Cycles</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Payment List Sheet</Label>
                <Select value={paymentSheet} onValueChange={v => loadSheet(v, "payment")}>
                  <SelectTrigger><SelectValue placeholder="Sheet..." /></SelectTrigger>
                  <SelectContent>{sheets.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Uncashed List Sheet</Label>
                <Select value={uncashedSheet} onValueChange={v => loadSheet(v, "uncashed")}>
                  <SelectTrigger><SelectValue placeholder="Sheet..." /></SelectTrigger>
                  <SelectContent>{sheets.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Cycle</Label>
                <Input type="number" min={1} max={76} value={paymentCycle} onChange={e => setPaymentCycle(Math.max(1, Math.min(76, Number(e.target.value) || 1)))} />
              </div>
              <div>
                <Label>Payment Cycle Count</Label>
                <Input type="number" min={1} value={paymentCycleCount} onChange={e => setPaymentCycleCount(Math.max(1, Number(e.target.value) || 1))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Cycle Months</Label>
              <div className="flex gap-3 max-w-md">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="secondary" onClick={addPaymentMonth} disabled={!selectedMonth || !selectedYear}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {paymentMonths.map(m => <Button key={m} variant="ghost" size="sm" onClick={() => setPaymentMonths(p => p.filter(x => x !== m))}>{m} <Trash2 className="ml-2 h-3 w-3" /></Button>)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {paymentSheet && (
        <Card>
          <CardHeader><CardTitle>3. Manual Mapping: Payment List</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Select value={manualPayment.fileCol} onValueChange={v => setManualPayment(p => ({...p, fileCol: v}))}>
                  <SelectTrigger><SelectValue placeholder="File Column..." /></SelectTrigger>
                  <SelectContent>{unmappedPaymentFileColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={manualPayment.dbCol} onValueChange={v => setManualPayment(p => ({...p, dbCol: v}))}>
                  <SelectTrigger><SelectValue placeholder="DB Column..." /></SelectTrigger>
                  <SelectContent>{unmappedPaymentDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => addMapping("payment")}><Plus className="mr-2 h-4 w-4" /> Map</Button>
            </div>
            <Table className="border rounded-md">
              <TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>DB Column</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(paymentMapping).map(([f, d]) => (
                  <TableRow key={f}><TableCell>{f}</TableCell><TableCell>{d}</TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => removeMapping(f, "payment")}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {uncashedSheet && (
        <Card>
          <CardHeader><CardTitle>4. Manual Mapping: Uncashed List</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Select value={manualUncashed.fileCol} onValueChange={v => setManualUncashed(p => ({...p, fileCol: v}))}>
                  <SelectTrigger><SelectValue placeholder="File Column..." /></SelectTrigger>
                  <SelectContent>{unmappedUncashedFileColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={manualUncashed.dbCol} onValueChange={v => setManualUncashed(p => ({...p, dbCol: v}))}>
                  <SelectTrigger><SelectValue placeholder="DB Column..." /></SelectTrigger>
                  <SelectContent>{unmappedUncashedDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => addMapping("uncashed")}><Plus className="mr-2 h-4 w-4" /> Map</Button>
            </div>
            <Table className="border rounded-md">
              <TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>DB Column</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(uncashedMapping).map(([f, d]) => (
                  <TableRow key={f}><TableCell>{f}</TableCell><TableCell>{d}</TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => removeMapping(f, "uncashed")}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>5. Execution & Snapshot</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Unique ID from File</Label>
              <Select value={fileUniqueIdCol} onValueChange={setFileUniqueIdCol}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{combinedFileColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unique ID in DB</Label>
              <Select value={dbUniqueIdCol} onValueChange={setDbUniqueIdCol}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{GENERAL_COLUMNS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          
          <Button onClick={handleSave} disabled={!paymentReady || saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save to Database
          </Button>
          
          {duplicateState.open && (
            <Card className="border border-destructive bg-destructive/10 p-4 space-y-3">
              <h3 className="font-bold text-destructive">Duplicate Beneficiaries Found</h3>
              <p className="text-sm">{duplicateState.count} duplicates detected. Total in DB: {duplicateState.totalInDb}.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => executeSave("skip")}>Skip duplicates & save new</Button>
                <Button variant="secondary" onClick={() => executeSave("replace")}>Update existing & save new</Button>
                <Button variant="ghost" onClick={() => setDuplicateState(p => ({...p, open: false}))}>Cancel</Button>
              </div>
            </Card>
          )}

          <div className="text-sm text-muted-foreground pt-4">
            <p className="font-medium text-foreground">Status: {STATUS_LABELS[status] || status}</p>
            <p>Progress: {progress}% {workerMessage && `(${workerMessage})`}</p>
            <p>Saved {stats.saved}, Updated {stats.updated}, Skipped {stats.skipped} / Total Processed: {stats.total}</p>
            <Progress value={progress} className="mt-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 pt-6">
            <KeyFigureCard title="Payment Cycle" value={paymentCycle} icon={<FilePlus className="h-4 w-4" />} />
            <KeyFigureCard title="Beneficiaries in List" value={aggregatedStats.payCount} icon={<Users className="h-4 w-4" />} />
            <KeyFigureCard title="Beneficiaries Cashed" value={aggregatedStats.cashedCount} icon={<DollarSign className="h-4 w-4" />} />
            <KeyFigureCard title="Beneficiaries Uncashed" value={aggregatedStats.uncashedCount} icon={<Wallet className="h-4 w-4" />} />
            <KeyFigureCard title="Total Amount" value={aggregatedStats.payAmount} icon={<CreditCard className="h-4 w-4" />} />
            <KeyFigureCard title="Money Cashed" value={aggregatedStats.cashedAmount} icon={<CheckCircle className="h-4 w-4" />} />
            <KeyFigureCard title="Money Uncashed" value={aggregatedStats.uncashedAmount} icon={<CheckCircle className="h-4 w-4" />} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}