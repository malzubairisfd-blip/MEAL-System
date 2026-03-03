"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
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


const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i);

const CYCLE_FIELDS: { name: string; type: 'TEXT' | 'INTEGER' | 'REAL' }[] = [
  { name: "is_pay_list", type: "INTEGER" },
  { name: "pay_cyc_cnt", type: "INTEGER" },
  { name: "pay_cyc_mon_list", type: "TEXT" },
  { name: "pay_amt", type: "REAL" },
  { name: "is_cashed", type: "INTEGER" },
  { name: "cashed_amt", type: "REAL" },
  { name: "is_uncashed", type: "INTEGER" },
  { name: "uncashed_amt", type: "REAL" },
  { name: "uncashed_code", type: "INTEGER" },
  { name: "uncashed_reason", type: "TEXT" },
  { name: "recom", type: "TEXT" },
];

const LOCAL_STORAGE_MAPPING_PREFIX = "bnf-cash-disturbance-mapping-";
const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  initializing: "Initializing...",
  FIRST_STEP_SAVING_FROM_ENROLLMENT_REVIEW_DATABASE: "Seeding from Enrollment DB",
  SECOND_STEP_SAVING_PAYMENT_CYCLE_LIST: "Saving Payment List Data",
  THIRD_STEP_SAVING_GENERAL_PAYMENT_CYCLE_COUNT: "Saving Cycle Count",
  FOURTH_SAVING_PAYMENT_CYCLE_MONTHS: "Saving Cycle Months",
  FIFTH_STEP_SAVING_UNCASHED_LIST: "Saving Uncashed List Data",
  SIXTH_STEP_SAVING_CASHED_DATA: "Calculating Cashed Data",
  SEVENTH_STEP_SAVING_TOTAL_VALUES: "Aggregating Totals",
  done: "Completed Successfully",
  error: "Error Occurred",
};

const getCycleColumns = (cycle: number) => CYCLE_FIELDS.map((field) => `${field.name}_s${cycle}`);
const safeNumber = (value: any) => { const num = Number(value); return Number.isFinite(num) ? num : 0; };

const KeyFigureCard = ({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export default function BeneficiariesCashDistrubanceUploadPage() {
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
  
  const [fileUniqueIdColumn, setFileUniqueIdColumn] = useState("");
  const [dbUniqueIdColumn, setDbUniqueIdColumn] = useState("benef_id");
  
  const [loading, setLoading] = useState({ projects: true, saving: false, dbSchema: true });
  const [workerStatus, setWorkerStatus] = useState("idle");
  const [workerProgress, setWorkerProgress] = useState(0);
  const [workerMessage, setWorkerMessage] = useState("");
  const [results, setResults] = useState<null | { totalAppearance: number; totalAttend: number; totalAbsence: number; totalAlternative: number }>(null);
  const [saveStats, setSaveStats] = useState({ saved: 0, updated: 0, skipped: 0, total: 0 });
  
  const [duplicateInfo, setDuplicateInfo] = useState({
    isOpen: false, count: 0, totalInDb: 0, duplicateIds: [] as string[],
  });

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data || []));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = (event) => {
            const workbook = XLSX.read(event.target?.result, { type: "binary" });
            setSheets(workbook.SheetNames);
        };
        reader.readAsBinaryString(selectedFile);
    }
  };

  const loadSheet = (sheetName: string, type: "payment" | "uncashed") => {
    if (!file) return;
    if (type === "payment") setPaymentSheet(sheetName);
    else setUncashedSheet(sheetName);
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const workbook = XLSX.read(event.target?.result, { type: "binary" });
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        const headers = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || []) as string[];
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

  const cycleDbColumns = useMemo(() => getCycleColumns(paymentCycle), [paymentCycle]);

  const addPaymentMonth = () => {
    if (!selectedMonth || !selectedYear) return;
    const entry = `${selectedMonth} ${selectedYear}`;
    if (!paymentMonths.includes(entry)) setPaymentMonths((prev) => [...prev, entry]);
  };
  
  const removePaymentMonth = (value: string) => {
    setPaymentMonths((prev) => prev.filter((month) => month !== value));
  };
  
  const aggregatedStats = useMemo(() => {
    const payAmtCol = Object.entries(paymentMapping).find(([,db]) => db === `pay_amt_s${paymentCycle}`)?.[0] || '';
    const cashedAmtCol = Object.entries(paymentMapping).find(([,db]) => db === `cashed_amt_s${paymentCycle}`)?.[0] || '';
    const uncashedAmtCol = Object.entries(uncashedMapping).find(([,db]) => db === `uncashed_amt_s${paymentCycle}`)?.[0] || '';
    
    return {
      payCount: paymentData.length,
      payAmount: paymentData.reduce((acc, row) => acc + safeNumber(row[payAmtCol]), 0),
      cashedCount: paymentData.length - uncashedData.length, // Approximation
      cashedAmount: paymentData.reduce((acc, row) => acc + safeNumber(row[cashedAmtCol]), 0),
      uncashedCount: uncashedData.length,
      uncashedAmount: uncashedData.reduce((acc, row) => acc + safeNumber(row[uncashedAmtCol]), 0),
    }
  }, [paymentCycle, paymentData, uncashedData, paymentMapping, uncashedMapping]);

  const isProcessing = loading.saving;
  const statusLabel = STATUS_LABELS[workerStatus] || workerStatus;

  const handleAddPaymentMapping = () => {
    if (manualPayment.fileCol && manualPayment.dbCol) {
      setPaymentMapping(prev => ({...prev, [manualPayment.fileCol]: manualPayment.dbCol}));
      setManualPayment({ fileCol: "", dbCol: "" });
    }
  };

  const handleRemovePaymentMapping = (fileCol: string) => {
    setPaymentMapping(prev => {
      const newMap = {...prev};
      delete newMap[fileCol];
      return newMap;
    });
  };

  const handleAddUncashedMapping = () => {
    if (manualUncashed.fileCol && manualUncashed.dbCol) {
      setUncashedMapping(prev => ({...prev, [manualUncashed.fileCol]: manualUncashed.dbCol}));
      setManualUncashed({ fileCol: "", dbCol: "" });
    }
  };

  const handleRemoveUncashedMapping = (fileCol: string) => {
    setUncashedMapping(prev => {
      const newMap = {...prev};
      delete newMap[fileCol];
      return newMap;
    });
  };

  const executeSave = useCallback(async (mode: 'skip' | 'replace') => {
        setDuplicateInfo(prev => ({...prev, isOpen: false}));
        setLoading(prev => ({...prev, saving: true}));
        
        try {
             const response = await fetch('/api/bnf-cash-distrubance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    projectId: selectedProjectId,
                    projectName: projects.find(p => p.projectId === selectedProjectId)?.projectName || '',
                    paymentCycle,
                    paymentCycleCount,
                    paymentMonths,
                    paymentData,
                    uncashedData,
                    paymentMapping: Object.fromEntries(Object.entries(paymentMapping)),
                    uncashedMapping: Object.fromEntries(Object.entries(uncashedMapping)),
                    uniqueFileIdColumn: fileUniqueIdColumn,
                    uniqueDbColumn: dbUniqueIdColumn,
                    mode,
                    duplicateIds: duplicateInfo.duplicateIds,
                })
            });

            if (!response.body) throw new Error("No response stream from server.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n\n").filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    const jsonStr = line.replace('data: ', '');
                    const data = JSON.parse(jsonStr);

                    if (data.type === 'progress') {
                        setWorkerStatus(data.status);
                        setWorkerProgress(data.progress);
                        setWorkerMessage(data.message);
                        if (data.stats) setSaveStats(data.stats);
                    } else if (data.type === 'done') {
                        setWorkerStatus('done');
                        setWorkerProgress(100);
                        setResults(data.metrics);
                        setSaveStats(data.stats);
                        toast({ title: "Success", description: data.message });
                        return; // Exit loop
                    } else if (data.type === 'error') {
                        throw new Error(data.error);
                    }
                }
            }

        } catch (error: any) {
            setWorkerStatus('error');
            toast({ title: 'Error during processing', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(prev => ({...prev, saving: false}));
        }
    },
    [
        selectedProjectId, projects, paymentCycle, paymentCycleCount, paymentMonths,
        paymentData, uncashedData, paymentMapping, uncashedMapping,
        fileUniqueIdColumn, dbUniqueIdColumn, duplicateInfo.duplicateIds, toast
    ]
);

const handleSave = useCallback(async () => {
    if (!selectedProjectId || !file || !fileUniqueIdColumn || !dbUniqueIdColumn) {
      toast({ title: "Incomplete Setup", description: "Project, file, and unique IDs must be selected.", variant: "destructive" });
      return;
    }
    
    setLoading(prev => ({ ...prev, saving: true }));
    try {
      const uniqueIds = Array.from(new Set([...paymentData, ...uncashedData].map(r => r[fileUniqueIdColumn]).filter(Boolean)));
      const res = await fetch('/api/bnf-cash-distrubance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_duplicates',
          projectId: selectedProjectId,
          uniqueIds: uniqueIds,
          uniqueIdCol: dbUniqueIdColumn,
        })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      if (result.count > 0) {
        setDuplicateInfo({ isOpen: true, count: result.count, totalInDb: result.totalInDb, duplicateIds: result.duplicateIds });
      } else {
        await executeSave('replace');
      }

    } catch (err: any) {
      toast({ title: "Validation Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
}, [selectedProjectId, file, fileUniqueIdColumn, dbUniqueIdColumn, paymentData, uncashedData, toast, executeSave]);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Beneficiaries Disturbance Upload</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/process/cash-assistance-disturbance/beneficiaries">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Hub
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Select Project & File</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={loading.projects}>
            <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="file" accept=".xls,.xlsx,.xlsm,.xlsb,.csv,.txt" onChange={handleFileChange} />
        </CardContent>
      </Card>

      {file && (
        <Card>
          <CardHeader><CardTitle>2. Configure Sheets & Session</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={paymentSheet} onValueChange={(val) => loadSheet(val, "payment")}><SelectTrigger><SelectValue placeholder="Select Payment List Sheet" /></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              <Select value={uncashedSheet} onValueChange={(val) => loadSheet(val, "uncashed")}><SelectTrigger><SelectValue placeholder="Select Uncashed List Sheet" /></SelectTrigger><SelectContent>{sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><Label>Payment Cycle</Label><Input type="number" min={1} max={76} value={paymentCycle} onChange={e => setPaymentCycle(Number(e.target.value))}/></div>
              <div><Label>Cycle Count</Label><Input type="number" min={1} value={paymentCycleCount} onChange={e => setPaymentCycleCount(Number(e.target.value))}/></div>
              <div className="col-span-2 space-y-2">
                <Label>Payment Months</Label>
                <div className="flex gap-2">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger><SelectValue placeholder="Month"/></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                  <Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                  <Button variant="secondary" onClick={addPaymentMonth}><Plus/></Button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">{paymentMonths.map(m => <Button key={m} variant="ghost" size="sm" onClick={() => removePaymentMonth(m)}>{m}<Trash2 className="ml-2 h-3 w-3"/></Button>)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {paymentSheet && uncashedSheet && (
          <Card>
              <CardHeader><CardTitle>3. Map Data Columns</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Payment Mapping */}
                  <div className="space-y-4">
                      <h4 className="font-semibold">Payment List Mapping (Cycle {paymentCycle})</h4>
                      <div className="grid grid-cols-3 gap-2 items-end">
                          <Select value={manualPayment.fileCol} onValueChange={v => setManualPayment(p => ({...p, fileCol: v}))}><SelectTrigger><SelectValue placeholder="File Column..."/></SelectTrigger><SelectContent>{paymentColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                          <Select value={manualPayment.dbCol} onValueChange={v => setManualPayment(p => ({...p, dbCol: v}))}><SelectTrigger><SelectValue placeholder="DB Column..."/></SelectTrigger><SelectContent>{cycleDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                          <Button onClick={handleAddPaymentMapping}><Plus className="mr-2 h-4 w-4"/>Add</Button>
                      </div>
                      <ScrollArea className="h-40 border rounded-md"><Table>
                          <TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>DB Column</TableHead><TableHead></TableHead></TableRow></TableHeader>
                          <TableBody>{Object.entries(paymentMapping).map(([f, d]) => <TableRow key={f}><TableCell>{f}</TableCell><TableCell>{d}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => handleRemovePaymentMapping(f)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody>
                      </Table></ScrollArea>
                  </div>
                  {/* Uncashed Mapping */}
                  <div className="space-y-4">
                      <h4 className="font-semibold">Uncashed List Mapping (Cycle {paymentCycle})</h4>
                       <div className="grid grid-cols-3 gap-2 items-end">
                          <Select value={manualUncashed.fileCol} onValueChange={v => setManualUncashed(p => ({...p, fileCol: v}))}><SelectTrigger><SelectValue placeholder="File Column..."/></SelectTrigger><SelectContent>{uncashedColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                          <Select value={manualUncashed.dbCol} onValueChange={v => setManualUncashed(p => ({...p, dbCol: v}))}><SelectTrigger><SelectValue placeholder="DB Column..."/></SelectTrigger><SelectContent>{cycleDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                          <Button onClick={handleAddUncashedMapping}><Plus className="mr-2 h-4 w-4"/>Add</Button>
                      </div>
                      <ScrollArea className="h-40 border rounded-md"><Table>
                           <TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>DB Column</TableHead><TableHead></TableHead></TableRow></TableHeader>
                          <TableBody>{Object.entries(uncashedMapping).map(([f, d]) => <TableRow key={f}><TableCell>{f}</TableCell><TableCell>{d}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveUncashedMapping(f)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody>
                      </Table></ScrollArea>
                  </div>
              </CardContent>
          </Card>
      )}

      <Card>
        <CardHeader><CardTitle>4. Save & Execute</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Unique ID from Uploaded Files</Label><Select value={fileUniqueIdColumn} onValueChange={setFileUniqueIdColumn}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{Array.from(new Set([...paymentColumns, ...uncashedColumns])).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Unique ID in Database</Label><Input value={dbUniqueIdColumn} onChange={e => setDbUniqueIdColumn(e.target.value)} /></div>
          </div>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
            {isProcessing ? 'Saving...' : 'Execute Save & Distribute Data'}
          </Button>
          {isProcessing && (
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{statusLabel}</span>
                    <span>{workerProgress}%</span>
                </div>
                <Progress value={workerProgress}/>
                <p className="text-xs text-center mt-1 text-muted-foreground">{workerMessage} (Saved: {saveStats.saved} / {saveStats.total} · Updated: {saveStats.updated} · Skipped: {saveStats.skipped})</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo((prev) => ({ ...prev, isOpen }))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                <AlertDialogDescription>
                    Found {duplicateInfo.count} record(s) that already exist in the database for this project (total in DB: {duplicateInfo.totalInDb}). How would you like to proceed?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => executeSave('skip')}>Skip Duplicates</Button>
                <AlertDialogAction onClick={() => executeSave('replace')}>Update Existing</AlertDialogAction>
                <AlertDialogCancel asChild><Button variant="ghost" onClick={() => setDuplicateInfo((prev) => ({ ...prev, isOpen: false }))}>Cancel Import</Button></AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {results && (
        <Card>
            <CardHeader><CardTitle>Results Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KeyFigureCard title="Payment Cycle" value={paymentCycle} icon={<FileText />} />
              <KeyFigureCard title="Beneficiaries in List" value={aggregatedStats.payCount} icon={<Users />} />
              <KeyFigureCard title="Beneficiaries Cashed" value={results.totalAttend} icon={<UserCheck />} />
              <KeyFigureCard title="Beneficiaries Uncashed" value={results.totalAbsence} icon={<UserMinus />} />
              <KeyFigureCard title="Payment Amount" value={`$${aggregatedStats.payAmount.toLocaleString()}`} icon={<Wallet />} />
              <KeyFigureCard title="Cashed Amount" value={`$${results.totalAlternative.toLocaleString()}`} icon={<DollarSign />} />
              <KeyFigureCard title="Uncashed Amount" value={`$${aggregatedStats.uncashedAmount.toLocaleString()}`} icon={<CreditCard />} />
            </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disturbance/beneficiaries/dashboard">Go to Dashboard</Link></Button>
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disturbance/beneficiaries/database">Go to Database</Link></Button>
      </div>
    </div>
  );
}
