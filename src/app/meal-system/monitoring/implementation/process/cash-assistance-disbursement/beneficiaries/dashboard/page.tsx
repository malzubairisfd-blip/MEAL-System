
// src/app/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/dashboard/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from 'next/link';
import ReactECharts from "echarts-for-react";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image";
import { saveAs } from 'file-saver';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Archive, Database, Download, Upload, Users, Wallet, DollarSign, Activity, BarChart2, Camera, ChevronDown, Loader2, UserCheck, UserMinus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import ExcelJS from 'exceljs';

interface Project {
  projectId: string;
  projectName: string;
}

const KPICard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <Card className="transition-all hover:shadow-md hover:-translate-y-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export default function BeneficiariesCashdisbursementDashboardPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const keyFiguresRef = useRef<HTMLDivElement>(null);
  const monthsTableRef = useRef<HTMLDivElement>(null);
  const cycleBarRef = useRef<HTMLDivElement>(null);
  const cyclePieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects").then((res) => res.json()).then((data) => setProjects(data));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/bnf-cash-disbursement?projectId=${selectedProjectId}`)
      .then((res) => res.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  const {
    totalCycles, totalBeneficiariesInList, totalBeneficiariesCashed,
    totalBeneficiariesUncashed, totalPaymentAmount, totalCashedAmount, totalUncashedAmount
  } = useMemo(() => {
    let cycles = new Set();
    for (let i = 1; i <= 76; i++) {
      if (records.some(r => Number(r[`is_pay_list_s${i}`]) > 0)) {
        cycles.add(i);
      }
    }
    return {
      totalCycles: cycles.size,
      totalBeneficiariesInList: records.filter(r => Number(r.total_pay_list) > 0).length,
      totalBeneficiariesCashed: records.filter(r => Number(r.total_cashed_cnt) > 0).length,
      totalBeneficiariesUncashed: records.filter(r => Number(r.total_uncashed_cnt) > 0).length,
      totalPaymentAmount: records.reduce((sum, r) => sum + Number(r.total_pay_amt || 0), 0),
      totalCashedAmount: records.reduce((sum, r) => sum + Number(r.total_cashed_amt || 0), 0),
      totalUncashedAmount: records.reduce((sum, r) => sum + Number(r.total_uncashed_amt || 0), 0)
    };
  }, [records]);

  const cycleMonthsTable = useMemo(() => {
    const table: { cycle: number, months: string, count: number }[] = [];
    for (let i = 1; i <= 76; i++) {
        const monthCol = `pay_cyc_mon_list_s${i}`;
        const uniqueMonths = new Set(records.map(r => r[monthCol]).filter(Boolean));
        if (uniqueMonths.size > 0) {
            table.push({
                cycle: i,
                months: Array.from(uniqueMonths).join(', '),
                count: records.filter(r => r[monthCol]).length
            });
        }
    }
    return table;
  }, [records]);

  const cycleTotals = useMemo(() => {
    const totals = [];
    for (let i = 1; i <= 76; i++) {
        const payCol = `is_pay_list_s${i}`;
        const cashedCol = `is_cashed_s${i}`;
        const uncashedCol = `is_uncashed_s${i}`;
        const cashedAmtCol = `cashed_amt_s${i}`;
        const uncashedAmtCol = `uncashed_amt_s${i}`;

        const pay = records.reduce((sum, r) => sum + (Number(r[payCol]) || 0), 0);
        if (pay === 0) continue;

        totals.push({
            cycle: i,
            pay,
            cashed: records.reduce((sum, r) => sum + (Number(r[cashedCol]) || 0), 0),
            uncashed: records.reduce((sum, r) => sum + (Number(r[uncashedCol]) || 0), 0),
            cashedAmt: records.reduce((sum, r) => sum + (Number(r[cashedAmtCol]) || 0), 0),
            uncashedAmt: records.reduce((sum, r) => sum + (Number(r[uncashedAmtCol]) || 0), 0)
        });
    }
    return totals;
  }, [records]);
  
  const [activePieCycle, setActivePieCycle] = useState(cycleTotals[0]?.cycle || 1);
  useEffect(() => {
    if (cycleTotals.length > 0 && !cycleTotals.find(c => c.cycle === activePieCycle)) {
      setActivePieCycle(cycleTotals[0].cycle);
    }
  }, [cycleTotals, activePieCycle]);

  const barChartOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {},
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: cycleTotals.map(c => `Cycle ${c.cycle}`) },
    series: [
      { name: 'Payment List', type: 'bar', stack: 'total', data: cycleTotals.map(c => c.pay) },
      { name: 'Cashed', type: 'bar', stack: 'total', data: cycleTotals.map(c => c.cashed) },
      { name: 'Uncashed', type: 'bar', stack: 'total', data: cycleTotals.map(c => c.uncashed) },
    ]
  };
  
  const activeCycleData = cycleTotals.find(c => c.cycle === activePieCycle);
  const pieChartOption = {
    tooltip: { trigger: 'item' },
    legend: { top: '5%', left: 'center' },
    series: [{
      name: `Cycle ${activePieCycle} Amounts`,
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: activeCycleData?.cashedAmt || 0, name: 'Cashed Amount' },
        { value: activeCycleData?.uncashedAmt || 0, name: 'Uncashed Amount' },
      ].filter(d => d.value > 0),
    }]
  };

  const captureAndCacheImages = async () => {
    setIsCapturing(true);
    toast({ title: "Capture Started", description: "Capturing dashboard visuals..." });
    const images: Record<string, string> = {};
    const refsToCapture = { keyFigures: keyFiguresRef, monthsTable: monthsTableRef, cycleBar: cycleBarRef, cyclePie: cyclePieRef };

    for (const [key, ref] of Object.entries(refsToCapture)) {
        if (ref.current) {
            try {
                images[key] = await toPng(ref.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#FFFFFF' });
            } catch (error) {
                console.error(`Failed to capture ${key}:`, error);
                toast({ title: `Capture Failed for ${key}`, variant: "destructive" });
            }
        }
    }
    
    // Store in IndexedDB
    const request = indexedDB.open("DashboardCache", 1);
    request.onupgradeneeded = e => {
      const db = (e.target as any).result;
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images');
      }
    };
    request.onsuccess = e => {
      const db = (e.target as any).result;
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(images, `bnf-cash-disbursement-${selectedProjectId}`);
      tx.oncomplete = () => {
        toast({ title: "Capture Complete", description: "Dashboard images have been cached." });
        setIsCapturing(false);
      };
      tx.onerror = () => {
         toast({ title: "Cache Error", description: "Could not save images to local database.", variant: "destructive" });
         setIsCapturing(false);
      };
    };
    request.onerror = () => {
      toast({ title: "DB Error", description: "Could not open IndexedDB.", variant: "destructive" });
      setIsCapturing(false);
    };
  };

  const downloadExcel = async () => {
     const request = indexedDB.open("DashboardCache", 1);
     request.onsuccess = async (e) => {
        const db = (e.target as any).result;
        const tx = db.transaction('images', 'readonly');
        const getReq = tx.objectStore('images').get(`bnf-cash-disbursement-${selectedProjectId}`);
        
        getReq.onsuccess = async () => {
          const images = getReq.result;
          const workbook = new ExcelJS.Workbook();
          // ... (Excel generation logic will be here)
          const buffer = await workbook.xlsx.writeBuffer();
          saveAs(new Blob([buffer]), `Dashboard_${selectedProjectId}.xlsx`);
        };
     };
  };

  return (
    <div className="space-y-6 pb-10">
      {/* ... header and project selection ... */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Beneficiaries Cash Disbursement Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visualize payment cycle performance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/upload"><Upload className="mr-2 h-4 w-4"/>Upload</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/database"><Database className="mr-2 h-4 w-4"/>Database</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Hub</Link></Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Select Project</CardTitle></CardHeader>
        <CardContent>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
            <SelectContent>{projects.map((project) => <SelectItem key={project.projectId} value={project.projectId}>{project.projectName}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {loading ? <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : selectedProjectId && records.length > 0 && (
          <div className="space-y-6">
              <Collapsible defaultOpen onOpenChange={()=>{}}>
                  <CollapsibleTrigger asChild>
                    <CardTitle className="text-xl p-4 border rounded-lg flex justify-between items-center cursor-pointer">Key Figures<ChevronDown /></CardTitle>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                      <div ref={keyFiguresRef} className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <KPICard title="Total Cycles" value={totalCycles} icon={<Activity />} />
                        <KPICard title="BNF in Pay List" value={totalBeneficiariesInList.toLocaleString()} icon={<Users />} />
                        <KPICard title="BNF Cashed" value={totalBeneficiariesCashed.toLocaleString()} icon={<UserCheck />} />
                        <KPICard title="BNF Uncashed" value={totalBeneficiariesUncashed.toLocaleString()} icon={<UserMinus />} />
                        <KPICard title="Total Pay Amount" value={`$${totalPaymentAmount.toLocaleString()}`} icon={<DollarSign />} />
                        <KPICard title="Total Cashed Amount" value={`$${totalCashedAmount.toLocaleString()}`} icon={<Wallet />} />
                        <KPICard title="Total Uncashed Amount" value={`$${totalUncashedAmount.toLocaleString()}`} icon={<Wallet />} />
                      </div>
                  </CollapsibleContent>
              </Collapsible>
              <Card ref={monthsTableRef}>
                  <CardHeader><CardTitle>Payment Cycle Months</CardTitle></CardHeader>
                  <CardContent><ScrollArea className="h-60"><Table>
                      <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead>Months</TableHead><TableHead>Count</TableHead></TableRow></TableHeader>
                      <TableBody>{cycleMonthsTable.map(c => <TableRow key={c.cycle}><TableCell>{c.cycle}</TableCell><TableCell>{c.months}</TableCell><TableCell>{c.count}</TableCell></TableRow>)}</TableBody>
                  </Table></ScrollArea></CardContent>
              </Card>
               <Card ref={cycleBarRef}>
                  <CardHeader><CardTitle>Cycle Participation</CardTitle></CardHeader>
                  <CardContent><ReactECharts option={barChartOption} style={{ height: '360px' }} /></CardContent>
              </Card>
              <Card ref={cyclePieRef}>
                  <CardHeader>
                    <CardTitle>Amount Distribution by Cycle</CardTitle>
                    <Select value={String(activePieCycle)} onValueChange={v => setActivePieCycle(Number(v))}>
                      <SelectTrigger className="w-48 mt-2"><SelectValue/></SelectTrigger>
                      <SelectContent>{cycleTotals.map(c => <SelectItem key={c.cycle} value={String(c.cycle)}>Cycle {c.cycle}</SelectItem>)}</SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent>
                      <ReactECharts option={pieChartOption} style={{ height: '320px' }} />
                  </CardContent>
              </Card>
              <div className="flex gap-2">
                <Button onClick={captureAndCacheImages} disabled={isCapturing}>{isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Camera className="mr-2 h-4 w-4" />} Capture Dashboard</Button>
                <Button onClick={downloadExcel} variant="outline"><Download className="mr-2 h-4 w-4"/> Download as Excel</Button>
              </div>
          </div>
      )}
    </div>
  );
}

function ScrollArea({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`overflow-auto ${className}`}>{children}</div>;
}
