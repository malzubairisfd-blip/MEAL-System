"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactECharts from "echarts-for-react";
import * as XLSX from "xlsx";
import * as htmlToImage from "html-to-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Archive, Database, Download, Upload, Users, Wallet, DollarSign, Activity, BarChart2 } from "lucide-react";

interface Project {
  projectId: string;
  projectName: string;
}

const cycleFields = (prefix: string) => Array.from({ length: 76 }, (_, idx) => `${prefix}_s${idx + 1}`);

const captureKeys = ["keyFigures", "monthsTable", "cycleBar", "cashedPie", "uncashedPie"];

export default function BeneficiariesCashdisbursementDashboardPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const monthsTableRef = useRef<HTMLDivElement>(null);
  const cycleBarRef = useRef<HTMLDivElement>(null);
  const pieRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [cachedImages, setCachedImages] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/projects").then((res) => res.json()).then((data) => setProjects(data));
  }, []);
  useEffect(() => {
    if (!selectedProjectId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    fetch(`/api/bnf-cash-disbursement?projectId=${selectedProjectId}`)
      .then((res) => res.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  const totalCycles = useMemo(() => {
    const sColumns = cycleFields("is_pay_list");
    return sColumns.filter((col) => records.some((row) => Number(row[col] ?? 0) > 0)).length;
  }, [records]);
  const totalBeneficiariesInList = useMemo(() => records.filter((row) => Number(row.total_pay_list ?? 0) > 0).length, [records]);
  const totalBeneficiariesCashed = useMemo(() => records.filter((row) => Number(row.total_cashed_cnt ?? 0) > 0).length, [records]);
  const totalBeneficiariesUncashed = useMemo(() => records.filter((row) => Number(row.total_uncashed_cnt ?? 0) > 0).length, [records]);
  const totalPaymentAmount = useMemo(() => records.reduce((acc, row) => acc + Number(row.total_pay_amt ?? 0), 0), [records]);
  const totalCashedAmount = useMemo(() => records.reduce((acc, row) => acc + Number(row.total_cashed_amt ?? 0), 0), [records]);
  const totalUncashedAmount = useMemo(() => records.reduce((acc, row) => acc + Number(row.total_uncashed_amt ?? 0), 0), [records]);

  const cycleMonthsTable = useMemo(() => {
    return Array.from({ length: 76 }, (_, idx) => {
      const cycle = idx + 1;
      const column = `pay_cyc_mon_list_s${cycle}`;
      const values = records
        .map((row) => row[column])
        .filter(Boolean)
        .map((val) => String(val).trim());
      const uniqueMonths = Array.from(new Set(values));
      return {
        cycle,
        months: uniqueMonths,
        count: values.length,
      };
    }).filter((entry) => entry.count > 0);
  }, [records]);

  const cycleTotals = useMemo(() => {
    return Array.from({ length: 76 }, (_, idx) => {
      const cycle = idx + 1;
      const pay = `is_pay_list_s${cycle}`;
      const cashed = `is_cashed_s${cycle}`;
      const uncashed = `is_uncashed_s${cycle}`;
      const cashedAmt = `cashed_amt_s${cycle}`;
      const uncashedAmt = `uncashed_amt_s${cycle}`;
      return {
        cycle,
        pay: records.reduce((sum, row) => sum + Number(row[pay] ?? 0), 0),
        cashed: records.reduce((sum, row) => sum + Number(row[cashed] ?? 0), 0),
        uncashed: records.reduce((sum, row) => sum + Number(row[uncashed] ?? 0), 0),
        cashedAmt: records.reduce((sum, row) => sum + Number(row[cashedAmt] ?? 0), 0),
        uncashedAmt: records.reduce((sum, row) => sum + Number(row[uncashedAmt] ?? 0), 0),
      };
    }).filter((entry) => entry.pay > 0 || entry.cashed > 0 || entry.uncashed > 0);
  }, [records]);

  const appearanceBarOption = useMemo(() => {
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: {},
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: cycleTotals.map((entry) => `Cycle ${entry.cycle}`) },
      series: [
        { name: "Payment List", type: "bar", data: cycleTotals.map((entry) => entry.pay) },
        { name: "Cashed", type: "bar", data: cycleTotals.map((entry) => entry.cashed) },
        { name: "Uncashed", type: "bar", data: cycleTotals.map((entry) => entry.uncashed) },
      ],
    };
  }, [cycleTotals]);

  const defaultPieCycle = cycleTotals[0]?.cycle || 1;
  const [activePieCycle, setActivePieCycle] = useState(defaultPieCycle);
  useEffect(() => {
    if (cycleTotals.length) {
      setActivePieCycle(cycleTotals[0].cycle);
    }
  }, [cycleTotals]);

  const activePieData = useMemo(() => {
    const cycleEntry = cycleTotals.find((entry) => entry.cycle === activePieCycle);
    if (!cycleEntry) return [];
    return [
      { value: cycleEntry.cashedAmt, name: "Cashed Amount" },
      { value: cycleEntry.uncashedAmt, name: "Uncashed Amount" },
    ];
  }, [activePieCycle, cycleTotals]);

  const pieOption = useMemo(() => {
    return {
      tooltip: { trigger: "item" },
      legend: { bottom: "0" },
      series: [
        {
          name: `Cycle ${activePieCycle}`,
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          data: activePieData,
        },
      ],
    };
  }, [activePieCycle, activePieData]);

  const captureImage = async () => {
    const entries: [string, HTMLElement | null][] = [
      ["keyFigures", dashboardRef.current],
      ["monthsTable", monthsTableRef.current],
      ["cycleBar", cycleBarRef.current],
      ["cashedPie", pieRefs.current[`cashed-${activePieCycle}`]],
      ["uncashedPie", pieRefs.current[`uncashed-${activePieCycle}`]],
    ];
    const results: Record<string, string> = {};
    for (const [key, element] of entries) {
      if (!element) continue;
      try {
        const dataUrl = await htmlToImage.toPng(element);
        results[key] = dataUrl;
        const request = indexedDB.open("bnf-dashboard-cache", 1);
        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains("images")) {
            db.createObjectStore("images", { keyPath: "id" });
          }
        };
        request.onsuccess = (event: any) => {
          const db = event.target.result;
          const tx = db.transaction("images", "readwrite");
          tx.objectStore("images").put({ id: `${selectedProjectId}-${key}`, image: dataUrl, timestamp: Date.now() });
        };
      } catch (error) {
        toast({ title: "Capture failed", description: "Unable to capture one of the sections.", variant: "destructive" });
      }
    }
    setCachedImages((prev) => ({ ...prev, ...results }));
    toast({ title: "Captured", description: "Images stored in cache." });
  };

  const downloadExcel = async () => {
    const workbook = XLSX.utils.book_new();
    const summarySheet = [
      ["Metric", "Value"],
      ["Project", selectedProjectId],
      ["Total Cycles", totalCycles],
      ["Total Beneficiaries in List", totalBeneficiariesInList],
      ["Beneficiaries Cashed", totalBeneficiariesCashed],
      ["Beneficiaries Uncashed", totalBeneficiariesUncashed],
      ["Total Payment Amount", totalPaymentAmount],
      ["Total Cashed Amount", totalCashedAmount],
      ["Total Uncashed Amount", totalUncashedAmount],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summarySheet), "Summary");
    const cycleSheet = cycleTotals.map((entry) => ({
      Cycle: entry.cycle,
      "Payment List": entry.pay,
      "Cashed": entry.cashed,
      "Uncashed": entry.uncashed,
      "Cashed Amount": entry.cashedAmt,
      "Uncashed Amount": entry.uncashedAmt,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cycleSheet), "Cycles");
    if (Object.keys(cachedImages).length) {
      const imageSheet = Object.entries(cachedImages).map(([key, dataUrl]) => ({ Key: key, ImageBase64: dataUrl }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(imageSheet), "Images");
    }
    XLSX.writeFile(workbook, `bnf-cash-disbursement-dashboard-${selectedProjectId || "all"}.xlsx`);
  };

  const cyclePieOptions = cycleTotals.map((entry) => ({
    cycle: entry.cycle,
    option: {
      tooltip: { trigger: "item" },
      legend: { bottom: "0" },
      series: [
        {
          name: `Cycle ${entry.cycle}`,
          type: "pie",
          radius: ["40%", "70%"],
          data: [
            { value: entry.cashedAmt, name: "Cashed" },
            { value: entry.uncashedAmt, name: "Uncashed" },
          ],
        },
      ],
    },
  }));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Beneficiaries Cash disbursement Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visualize payment cycle performance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-disbursement/upload"><Upload className="mr-2 h-4 w-4"/>Upload</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-disbursement/database"><Database className="mr-2 h-4 w-4"/>Database</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-disbursement"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Hub</Link></Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Select Project</CardTitle></CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <div ref={dashboardRef} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Key Figures</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4" ref={(el) => (pieRefs.current.keyFigures = el)}>
            <Card>
              <CardHeader className="flex items-center justify-between"><CardTitle className="text-xs text-muted-foreground">Total Cycles</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalCycles}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between"><CardTitle className="text-xs text-muted-foreground">Beneficiaries List</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalBeneficiariesInList}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between"><CardTitle className="text-xs text-muted-foreground">Beneficiaries Cashed</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalBeneficiariesCashed}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between"><CardTitle className="text-xs text-muted-foreground">Beneficiaries Uncashed</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalBeneficiariesUncashed}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between"><CardTitle className="text-xs text-muted-foreground">Payment Amount</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalPaymentAmount}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between"><CardTitle className="text-xs text-muted-foreground">Cashed Amount</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalCashedAmount}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between"><CardTitle className="text-xs text-muted-foreground">Uncashed Amount</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalUncashedAmount}</div></CardContent>
            </Card>
          </CardContent>
        </Card>

        <Card ref={monthsTableRef}>
          <CardHeader><CardTitle>Payment Cycle Months</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cycleMonthsTable.map((entry) => (
              <div key={entry.cycle} className="flex items-center gap-3">
                <div className="w-36 font-semibold">Cycle {entry.cycle}</div>
                <div className="flex-1">
                  {entry.months.map((month) => (
                    <span key={month} className="mr-2 px-2 py-1 rounded-full bg-muted text-xs">
                      {month}
                    </span>
                  ))}
                </div>
                <div className="w-32 text-right text-sm text-muted-foreground">{entry.count} entries</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card ref={cycleBarRef}>
          <CardHeader><CardTitle>Cycle Participation Overview</CardTitle></CardHeader>
          <CardContent>
            <ReactECharts option={appearanceBarOption} style={{ height: "360px" }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cycle Amount Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {cycleTotals.slice(0, 6).map((entry) => (
                <Button key={entry.cycle} variant={entry.cycle === activePieCycle ? "secondary" : "outline"} onClick={() => setActivePieCycle(entry.cycle)}>
                  Cycle {entry.cycle}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" ref={(el) => (pieRefs.current[`cashed-${activePieCycle}`] = el!)}>
              <ReactECharts option={pieOption} style={{ height: "320px" }} />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-2">
        <Button onClick={captureImage}>
          <Download className="mr-2 h-4 w-4" />
          Capture & Cache Images
        </Button>
        <Button onClick={downloadExcel} variant="outline">
          <BarChart2 className="mr-2 h-4 w-4" />
          Download Excel
        </Button>
      </div>
    </div>
  );
}
