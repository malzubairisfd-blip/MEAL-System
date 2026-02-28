//src/app/meal-system/monitoring/implementation/process/monthly-health-sessions/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Collapsible, CollapsibleContent, CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  ChevronDown, ChevronUp, Download, Upload, Database, 
  ArrowLeft, LayoutDashboard, Users, UserCheck, UserMinus, 
  Calendar, MapPin, Activity, Image as ImageIcon 
} from "lucide-react";
import ReactECharts from "echarts-for-react";
import * as htmlToImage from "html-to-image";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

interface Project {
  projectId: string;
  projectName: string;
}

interface ProcessedSession {
  cycle: number;
  date: string;
  appearance: number;
  attendance: number;
  absence: number;
  alternative: number;
  ozlaData: Record<string, number>;
}

export default function MonthlySessionsDashboard() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isKeyFiguresOpen, setIsKeyFiguresOpen] = useState(true);

  // Refs for capturing
  const dashboardRef = useRef<HTMLDivElement>(null);
  const chartRefs = {
    appearance: useRef<HTMLDivElement>(null),
    attendance: useRef<HTMLDivElement>(null),
    absence: useRef<HTMLDivElement>(null),
    alternative: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    fetch(`/api/monthly-health-sessions?projectId=${selectedProjectId}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  const processedSessions = useMemo((): ProcessedSession[] => {
    if (!data.length) return [];
    const results: ProcessedSession[] = [];

    for (let s = 1; s <= 76; s++) {
      const appearCol = `bnf_appear_s${s}`;
      const dateCol = `date_of_general_s${s}`;
      const attendCol = `attending_s${s}`;
      const absentCol = `absent_s${s}`;
      const altCol = `has_alternative_s${s}`;

      // Check if session has any data
      const sessionRecords = data.filter(r => r[appearCol] === 1 || r[dateCol] || r[absentCol] === 1);
      if (sessionRecords.length === 0) continue;

      const uniqueDates = Array.from(new Set(sessionRecords.map(r => r[dateCol]).filter(Boolean)));
      const ozlaMap: Record<string, number> = {};
      
      let sumAppear = 0;
      let sumAttend = 0;
      let sumAbsent = 0;
      let countAlt = 0;

      sessionRecords.forEach(r => {
        if (r[appearCol] === 1) {
          sumAppear++;
          const ozla = r.bnf_ozla || "Unknown";
          ozlaMap[ozla] = (ozlaMap[ozla] || 0) + 1;
        }
        sumAttend += (r[attendCol] || 0);
        sumAbsent += (r[absentCol] || 0);
        if (r[altCol] !== null && r[altCol] !== "" && r[altCol] !== undefined) {
          countAlt++;
        }
      });

      results.push({
        cycle: s,
        date: uniqueDates.join(", ") || "N/A",
        appearance: sumAppear,
        attendance: sumAttend,
        absence: sumAbsent,
        alternative: countAlt,
        ozlaData: ozlaMap
      });
    }
    return results;
  }, [data]);

  const totalCycles = processedSessions.length;
  const grandTotalAppear = processedSessions.reduce((acc, s) => acc + s.appearance, 0);
  const grandTotalAttend = processedSessions.reduce((acc, s) => acc + s.attendance, 0);
  const grandTotalAbsent = processedSessions.reduce((acc, s) => acc + s.absence, 0);
  const grandTotalAlt = processedSessions.reduce((acc, s) => acc + s.alternative, 0);

  // Chart Options
  const appearanceChartOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {},
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: processedSessions.map(s => `Cycle ${s.cycle}`) },
    series: [
      {
        name: 'Beneficiary Appearances',
        type: 'bar',
        data: processedSessions.map(s => s.appearance),
        itemStyle: { color: '#3b82f6' }
      }
    ]
  };

  const attendancePieOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '0' },
    series: [
      {
        name: 'Attendance',
        type: 'pie',
        radius: '50%',
        data: processedSessions.map(s => ({ value: s.attendance, name: `Cycle ${s.cycle}` })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
      }
    ]
  };

  const absenceDonutOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '0' },
    series: [
      {
        name: 'Absence',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: processedSessions.map(s => ({ value: s.absence, name: `Cycle ${s.cycle}` }))
      }
    ]
  };

  const alternativeBubbleOption = {
    xAxis: { type: 'category', data: processedSessions.map(s => `Cycle ${s.cycle}`) },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'item' },
    series: [{
      data: processedSessions.map((s, idx) => [idx, s.alternative, s.alternative * 5]),
      type: 'scatter',
      symbolSize: (data: any) => data[2],
      itemStyle: { color: '#f59e0b' }
    }]
  };

  const captureAndCache = async () => {
    if (!dashboardRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(dashboardRef.current);
      // IndexedDB Cache logic
      const request = indexedDB.open("DashboardCache", 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images", { keyPath: "id" });
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction("images", "readwrite");
        tx.objectStore("images").put({ id: `capture-${selectedProjectId}`, image: dataUrl, timestamp: Date.now() });
      };
      
      toast({ title: "Dashboard Captured", description: "Current view saved to local cache." });
      return dataUrl;
    } catch (err) {
      toast({ title: "Capture Failed", variant: "destructive" });
    }
  };

  const downloadAsExcel = async () => {
    const workbook = XLSX.utils.book_new();
    
    // Summary Data
    const summaryData = [
      ["Project ID", selectedProjectId],
      ["Total Cycles", totalCycles],
      ["Total Appearances", grandTotalAppear],
      ["Total Attendance", grandTotalAttend],
      ["Total Absence", grandTotalAbsent],
      ["Total Alternative Sessions", grandTotalAlt]
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

    // Cycles Detail
    const cycleData = processedSessions.map(s => ({
      "Cycle Number": s.cycle,
      "Date": s.date,
      "Appearances": s.appearance,
      "Attendance": s.attendance,
      "Absence": s.absence,
      "Alternatives": s.alternative
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cycleData), "Cycles Detail");

    XLSX.writeFile(workbook, `Health_Dashboard_${selectedProjectId}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Health Sessions Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive monitoring of monthly cycles and beneficiary participation.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions/upload"><Upload className="mr-2 h-4 w-4"/> Upload</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions/database"><Database className="mr-2 h-4 w-4"/> Database</Link></Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Project</label>
              <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                <SelectTrigger><SelectValue placeholder="Select a project to load data..." /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName} ({p.projectId})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={captureAndCache} variant="secondary" disabled={!selectedProjectId}><ImageIcon className="mr-2 h-4 w-4"/> Capture View</Button>
              <Button onClick={downloadAsExcel} disabled={!selectedProjectId}><Download className="mr-2 h-4 w-4"/> Download Excel</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedProjectId && (
        <div ref={dashboardRef} className="space-y-6">
          <Collapsible open={isKeyFiguresOpen} onOpenChange={setIsKeyFiguresOpen} className="space-y-2">
            <div className="flex items-center justify-between px-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Key Performance Indicators</h4>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">{isKeyFiguresOpen ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}</Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Total Cycles</CardTitle><LayoutDashboard className="h-4 w-4 text-blue-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{totalCycles}</div></CardContent></Card>
              <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Total Appearance</CardTitle><Users className="h-4 w-4 text-green-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{grandTotalAppear}</div></CardContent></Card>
              <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Total Attend</CardTitle><UserCheck className="h-4 w-4 text-emerald-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{grandTotalAttend}</div></CardContent></Card>
              <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Total Absence</CardTitle><UserMinus className="h-4 w-4 text-red-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{grandTotalAbsent}</div></CardContent></Card>
              <Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Alternative Sessions</CardTitle><Activity className="h-4 w-4 text-amber-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{grandTotalAlt}</div></CardContent></Card>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Session Dates Summary */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5"/> Session Schedule Summary</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  <Table>
                    <TableHeader><TableRow><TableHead>Session Cycle</TableHead><TableHead>General Session Date</TableHead><TableHead className="text-right">Activity Count</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {processedSessions.map(s => (
                        <TableRow key={s.cycle}>
                          <TableCell className="font-bold">Session Cycle {s.cycle}</TableCell>
                          <TableCell>{s.date}</TableCell>
                          <TableCell className="text-right">{s.appearance + s.absence} records</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Appearance by Ozla */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5"/> Appearance by Scale</CardTitle></CardHeader>
              <CardContent ref={chartRefs.appearance}>
                <ReactECharts option={appearanceChartOption} style={{ height: '350px' }} />
                <Table className="mt-4">
                  <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead>Total Appearance</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {processedSessions.map(s => (
                      <TableRow key={s.cycle}><TableCell>Cycle {s.cycle}</TableCell><TableCell className="font-medium text-blue-600">{s.appearance}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Attendance Pie */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5"/> Attendance Distribution</CardTitle></CardHeader>
              <CardContent ref={chartRefs.attendance}>
                <ReactECharts option={attendancePieOption} style={{ height: '350px' }} />
                <Table className="mt-4">
                  <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead>Total Attended</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {processedSessions.map(s => (
                      <TableRow key={s.cycle}><TableCell>Cycle {s.cycle}</TableCell><TableCell className="font-medium text-emerald-600">{s.attendance}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Absence Donut */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><UserMinus className="h-5 w-5"/> Absence Trends</CardTitle></CardHeader>
              <CardContent ref={chartRefs.absence}>
                <ReactECharts option={absenceDonutOption} style={{ height: '350px' }} />
                <Table className="mt-4">
                  <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead>Total Absent</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {processedSessions.map(s => (
                      <TableRow key={s.cycle}><TableCell>Cycle {s.cycle}</TableCell><TableCell className="font-medium text-red-600">{s.absence}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Alternative Sessions Bubble */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5"/> Alternative Sessions</CardTitle></CardHeader>
              <CardContent ref={chartRefs.alternative}>
                <ReactECharts option={alternativeBubbleOption} style={{ height: '350px' }} />
                <Table className="mt-4">
                  <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead>Alternative Count</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {processedSessions.map(s => (
                      <TableRow key={s.cycle}><TableCell>Cycle {s.cycle}</TableCell><TableCell className="font-medium text-amber-600">{s.alternative}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-2">
            <LayoutDashboard className="h-8 w-8 animate-pulse text-primary"/>
            <p className="text-sm font-medium">Crunching session data...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ScrollArea({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`overflow-auto ${className}`}>{children}</div>;
}