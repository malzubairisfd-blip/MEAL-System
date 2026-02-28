
// src/app/meal-system/monitoring/implementation/process/monthly-health-sessions/dashboard/page.tsx
"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import ReactECharts from 'echarts-for-react';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Download, Camera, ChevronDown, CheckCircle, BarChart2, PieChart, Donut, Star, Users } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";

interface Project { projectId: string; projectName: string; }
interface KPICardProps { title: string; value: React.ReactNode; icon: React.ReactNode; }

const KPICard: React.FC<KPICardProps> = ({ title, value, icon }) => (
    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
);

export default function SessionsDashboardPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [allData, setAllData] = useState<any[]>([]);
    const [processedData, setProcessedData] = useState<any | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false });
    const [isCapturing, setIsCapturing] = useState(false);

    const refs = {
        keyFigures: useRef<HTMLDivElement>(null),
        generalSessions: useRef<HTMLDivElement>(null),
        ozlaAppearance: useRef<HTMLDivElement>(null),
        attendancePie: useRef<HTMLDivElement>(null),
        absenceDonut: useRef<HTMLDivElement>(null),
        alternativeBubble: useRef<HTMLDivElement>(null),
    };

    useEffect(() => {
        setLoading(p => ({ ...p, projects: true }));
        fetch('/api/projects').then(res => res.json()).then(data => setProjects(data)).finally(() => setLoading(p => ({ ...p, projects: false })));
    }, []);

    const handleProjectSelect = useCallback(async (projectId: string) => {
        setSelectedProjectId(projectId);
        if (!projectId) {
            setAllData([]);
            setProcessedData(null);
            return;
        }
        setLoading(p => ({ ...p, data: true }));
        try {
            const res = await fetch(`/api/monthly-health-sessions?projectId=${projectId}`);
            if (!res.ok) throw new Error("Failed to load session data.");
            const data = await res.json();
            setAllData(data);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({ ...p, data: false }));
        }
    }, [toast]);

    useEffect(() => {
        if (allData.length === 0) {
            setProcessedData(null);
            return;
        }

        const sessionCycles = Array.from({ length: 76 }, (_, i) => i + 1);
        let totalSessions = 0;
        let totalAppearance = 0;
        let totalAttendance = 0;
        let totalAbsence = 0;
        let totalAlternative = 0;
        
        const generalSessions: Record<string, any> = {};
        const ozlaAppearance: Record<string, any> = {};
        const attendanceBySession: Record<string, number> = {};
        const absenceBySession: Record<string, number> = {};
        const alternativeBySession: Record<string, number> = {};

        allData.forEach(row => {
            sessionCycles.forEach(s => {
                const appearCol = `bnf_appear_s${s}`;
                const dateCol = `date_of_general_s${s}`;
                const attendCol = `attending_s${s}`;
                const absentCol = `absent_s${s}`;
                const altCol = `has_alternative_s${s}`;

                if (row[appearCol] === 1) {
                    totalAppearance++;
                    if (!ozlaAppearance[`Session ${s}`]) ozlaAppearance[`Session ${s}`] = {};
                    ozlaAppearance[`Session ${s}`][row.bnf_ozla] = (ozlaAppearance[`Session ${s}`][row.bnf_ozla] || 0) + 1;
                }
                if (row[dateCol]) {
                     if (!generalSessions[`Session ${s}`]) generalSessions[`Session ${s}`] = new Map();
                     generalSessions[`Session ${s}`].set(row[dateCol], (generalSessions[`Session ${s}`].get(row[dateCol]) || 0) + 1);
                     totalSessions++;
                }
                if (row[attendCol] === 1) {
                    totalAttendance++;
                    attendanceBySession[`Session ${s}`] = (attendanceBySession[`Session ${s}`] || 0) + 1;
                }
                if (row[absentCol] === 1) {
                    totalAbsence++;
                    absenceBySession[`Session ${s}`] = (absenceBySession[`Session ${s}`] || 0) + 1;
                }
                if (row[altCol]) {
                    totalAlternative++;
                    alternativeBySession[`Session ${s}`] = (alternativeBySession[`Session ${s}`] || 0) + 1;
                }
            });
        });

        setProcessedData({
            totalSessions, totalAppearance, totalAttendance, totalAbsence, totalAlternative,
            generalSessions, ozlaAppearance, attendanceBySession, absenceBySession, alternativeBySession
        });
        
    }, [allData]);

    const handleDownload = async () => {
        // Implementation for capturing and downloading as excel
    };

    if (loading.projects) {
        return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Monthly Health Sessions Dashboard</h1>
                 <div className="flex gap-2">
                    <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Hub</Link></Button>
                    <Button onClick={handleDownload} disabled={!processedData || isCapturing}>{isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>} Export</Button>
                </div>
            </div>
            
            <Card>
                <CardHeader><CardTitle>Select Project</CardTitle></CardHeader>
                <CardContent>
                    <Select onValueChange={handleProjectSelect} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-1/2"><SelectValue placeholder="Select a project..." /></SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {loading.data ? <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> :
            processedData && (
                <div className="space-y-6">
                    <div ref={refs.keyFigures}>
                        <Collapsible defaultOpen>
                            <CollapsibleTrigger className="w-full"><CardTitle className="text-xl p-4 border rounded-lg flex justify-between items-center">Key Figures <ChevronDown /></CardTitle></CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                                    <KPICard title="Total Session Cycles" value={processedData.totalSessions} icon={<CheckCircle/>}/>
                                    <KPICard title="Total Appearance" value={processedData.totalAppearance} icon={<Users/>}/>
                                    <KPICard title="Total Attendance" value={processedData.totalAttendance} icon={<CheckCircle/>}/>
                                    <KPICard title="Total Absence" value={processedData.totalAbsence} icon={<Users color='red'/>}/>
                                    <KPICard title="Total Alternative" value={processedData.totalAlternative} icon={<Star/>}/>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </div>
                    {/* Other charts will be rendered here */}
                </div>
            )}
        </div>
    );
}

    