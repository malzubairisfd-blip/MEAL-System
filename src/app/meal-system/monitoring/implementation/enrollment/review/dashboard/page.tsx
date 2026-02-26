// src/app/meal-system/monitoring/implementation/enrollment/review/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import ReactECharts from 'echarts-for-react';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, FileText, CheckSquare, Edit, MessageSquare, ThumbsUp, Database, Download, Camera, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from '@/components/ui/scroll-area';
import { saveEnrollmentDashboardData } from '@/lib/cache';
import { useRouter } from 'next/navigation';


interface Project {
  projectId: string;
  projectName: string;
}

const KPICard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <Card className="transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);


export default function EnrollmentDashboardPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [allData, setAllData] = useState<any[]>([]);
    const [processedData, setProcessedData] = useState<any | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false });
    const [isCapturing, setIsCapturing] = useState(false);

    // Refs for capturing images
    const refs = {
        keyFigures: useRef<HTMLDivElement>(null),
        signingDays: useRef<HTMLDivElement>(null),
        ozlaChart: useRef<HTMLDivElement>(null),
        bubbleChart: useRef<HTMLDivElement>(null),
        namePartsTable: useRef<HTMLDivElement>(null),
        pieCharts: useRef<HTMLDivElement>(null),
        nonSigningChart: useRef<HTMLDivElement>(null),
        recommendationsTable: useRef<HTMLDivElement>(null),
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
            const res = await fetch(`/api/enrollment-review?projectId=${projectId}`);
            if (!res.ok) throw new Error("Failed to load enrollment data.");
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

        const modificationTypes = allData.reduce((acc, row) => {
            const type = row.enrollment_modification_type;
            if (type) acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const signingDays = allData.reduce((acc, row) => {
            const day = row.day_of_signing_the_form;
            if (day) acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const ozlaData = allData.reduce((acc, row) => {
            const ozla = row.bnf_ozla;
            const type = row.enrollment_modification_type;
            if (!ozla) return acc;
            if (!acc[ozla]) acc[ozla] = { total: 0 };
            acc[ozla].total++;
            if (type) acc[ozla][type] = (acc[ozla][type] || 0) + 1;
            return acc;
        }, {} as Record<string, any>);

        const bubbleData = {
            'تصحيح اسم المستفيدة': allData.reduce((sum, r) => sum + Number(r.eligible_woman_name_correction || 0), 0),
            'تصحيح رقم الهاتف': allData.reduce((sum, r) => sum + Number(r.eligible_woman_phone_correction || 0), 0),
            'تصحيح رقم بطاقة المستفيدة': allData.reduce((sum, r) => sum + Number(r.eligible_woman_ID_correction || 0), 0),
            'تصحيح اسم الزوج': allData.reduce((sum, r) => sum + Number(r.eligible_woman_husband_name_correction || 0), 0),
        };
        
        const nameParts = {
            'تصحيح الاسم الأول': { bnf: 0, hus: 0 },
            'تصحيح اسم الأب': { bnf: 0, hus: 0 },
            'تصحيح اسم الجد': { bnf: 0, hus: 0 },
            'تصحيح الاسم الرابع': { bnf: 0, hus: 0 },
            'تصحيح اللقب': { bnf: 0, hus: 0 },
        };

        allData.forEach(r => {
            if(r.corrected_part_of_the_targets_namefirst_name == 1) nameParts['تصحيح الاسم الأول'].bnf++;
            if(r.the_corrected_part_of_the_targets_namefathers_name == 1) nameParts['تصحيح اسم الأب'].bnf++;
            if(r.the_corrected_part_of_the_targets_namegrandfathers_name == 1) nameParts['تصحيح اسم الجد'].bnf++;
            if(r.corrected_part_of_the_targets_namefourth_name == 1) nameParts['تصحيح الاسم الرابع'].bnf++;
            if(r.corrected_part_of_the_targets_nametitle == 1) nameParts['تصحيح اللقب'].bnf++;
            if(r.corrected_part_of_husbands_namefirst_name == 1) nameParts['تصحيح الاسم الأول'].hus++;
            if(r.corrected_part_of_husbands_namefathers_name == 1) nameParts['تصحيح اسم الأب'].hus++;
            if(r.the_corrected_part_of_the_husbands_namegrandfathers_name == 1) nameParts['تصحيح اسم الجد'].hus++;
            if(r.corrected_part_of_husbands_namefourth_name == 1) nameParts['تصحيح الاسم الرابع'].hus++;
            if(r.corrected_part_of_husbands_namesurname == 1) nameParts['تصحيح اللقب'].hus++;
        });

        const nonSigningReasons = allData.reduce((acc, r) => {
            const reason = r.the_reason_for_not_joining_the_project_is_stated;
            if (reason) acc[reason] = (acc[reason] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const recommendations = allData.reduce((acc, r) => {
            const rec = r.branch_recommendation;
            if(rec) acc[rec] = (acc[rec] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        setProcessedData({ total: allData.length, modificationTypes, signingDays, ozlaData, bubbleData, nameParts, nonSigningReasons, recommendations });
    }, [allData]);

    const captureAndCache = useCallback(async () => {
        if (!processedData) {
            toast({ title: "Cannot Capture", description: "Data is not processed yet.", variant: "destructive" });
            return;
        }
        
        setIsCapturing(true);
        toast({ title: "Capturing Dashboard...", description: "Please wait while the dashboard components are being captured." });
        
        try {
            const images: Record<string, string> = {};
            for (const [key, ref] of Object.entries(refs)) {
                if (ref.current) {
                    try {
                        images[key] = await toPng(ref.current, { cacheBust: true, pixelRatio: 2, style: { backgroundColor: 'white' } });
                    } catch (e) {
                        console.error(`Failed to capture ${key}:`, e);
                        toast({ title: `Capture Failed: ${key}`, variant: "destructive" });
                    }
                }
            }

            await saveEnrollmentDashboardData({
                chartImages: images,
                processedDataForReport: processedData
            });

            toast({ title: "Dashboard Cached", description: "Dashboard visuals saved. You can now proceed to download.", duration: 5000 });
            router.push('/meal-system/monitoring/implementation/enrollment/review/download');

        } catch (error: any) {
            console.error("Export preparation failed:", error);
            toast({ title: "Error Caching Data", description: error.message, variant: "destructive" });
        } finally {
            setIsCapturing(false);
        }
      }, [refs, processedData, toast, router]);
    
    if (loading.projects) {
        return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Enrollment Review Dashboard</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Review Hub</Link></Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Select Project</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={handleProjectSelect} value={selectedProjectId}>
                        <SelectTrigger className="w-full md:w-1/2"><SelectValue placeholder="Select a project..." /></SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {loading.data ? <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> :
            processedData && (
                <div className="space-y-6">
                    <Collapsible defaultOpen>
                        <CollapsibleTrigger className="w-full">
                            <CardTitle className="text-xl p-4 border rounded-lg flex justify-between items-center">Key Figures <ChevronDown /></CardTitle>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div ref={refs.keyFigures} className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                <KPICard title="Total Enrollments" value={processedData.total} icon={<FileText />} />
                                {Object.entries(processedData.modificationTypes).map(([type, value]) => (
                                    <KPICard key={type} title={type} value={value as number} icon={<Edit />} />
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                    
                    <div ref={refs.signingDays}>
                        <Card><CardHeader><CardTitle>Enrollments by Day</CardTitle></CardHeader>
                        <CardContent>
                            <Table><TableHeader><TableRow><TableHead>Day</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                            <TableBody>{Object.entries(processedData.signingDays).map(([day, count]) => <TableRow key={day}><TableCell>{day}</TableCell><TableCell className="text-right">{count as number}</TableCell></TableRow>)}</TableBody></Table>
                        </CardContent></Card>
                    </div>

                    <div ref={refs.ozlaChart}>
                        <Card>
                            <CardHeader><CardTitle>Enrollments by Ozla & Type</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ScrollArea className="h-96">
                                <Table>
                                    <TableHeader>
                                        <TableRow><TableHead>Ozla</TableHead><TableHead>Total</TableHead>
                                        {Object.keys(processedData.modificationTypes).map(type => <TableHead key={type}>{type}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>{Object.entries(processedData.ozlaData).map(([ozla, data]: [string, any]) => (
                                        <TableRow key={ozla}><TableCell>{ozla}</TableCell><TableCell>{data.total}</TableCell>
                                        {Object.keys(processedData.modificationTypes).map(type => <TableCell key={type}>{data[type] || 0}</TableCell>)}
                                        </TableRow>
                                    ))}</TableBody>
                                </Table>
                                </ScrollArea>
                                <ReactECharts option={{
                                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }},
                                    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                                    xAxis: { type: 'value' },
                                    yAxis: { type: 'category', data: Object.keys(processedData.ozlaData) },
                                    series: { type: 'bar', data: Object.values(processedData.ozlaData).map((d: any) => d.total) }
                                }} />
                            </CardContent>
                        </Card>
                    </div>

                    <div ref={refs.bubbleChart}>
                        <Card><CardHeader><CardTitle>Correction Types</CardTitle></CardHeader>
                        <CardContent>
                            <ReactECharts style={{ height: '400px' }} option={{
                                tooltip: { trigger: 'item' },
                                xAxis: { show: false, type: 'value' },
                                yAxis: { show: false, type: 'value' },
                                series: [{ 
                                    type: 'scatter', 
                                    symbolSize: (data: any) => Math.sqrt(data.value) * 15 + 10,
                                    data: Object.entries(processedData.bubbleData).map(([name, value]) => ({name, value})),
                                    label: { 
                                        show: true, 
                                        formatter: '{b}\n{c}',
                                        fontSize: 12,
                                        color: '#fff',
                                        textShadowBlur: 2,
                                        textShadowColor: 'rgba(0, 0, 0, 0.5)'
                                    }
                                }]
                            }} />
                        </CardContent></Card>
                    </div>

                    <div ref={refs.namePartsTable}>
                        <Card><CardHeader><CardTitle>Name Part Corrections</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Part</TableHead><TableHead>Beneficiary</TableHead><TableHead>Husband</TableHead></TableRow></TableHeader>
                                <TableBody>{Object.entries(processedData.nameParts).map(([part, values]: [string, any]) => (
                                    <TableRow key={part}><TableCell>{part}</TableCell><TableCell>{values.bnf}</TableCell><TableCell>{values.hus}</TableCell></TableRow>
                                ))}</TableBody>
                            </Table>
                        </CardContent></Card>
                    </div>
                    
                    <div ref={refs.pieCharts} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <Card><CardHeader><CardTitle>Beneficiary Name Parts</CardTitle></CardHeader><CardContent>
                           <ReactECharts style={{ height: '300px' }} option={{
                               tooltip: { trigger: 'item' },
                               series: [{ type: 'pie', data: Object.entries(processedData.nameParts).map(([name, value]: [string, any]) => ({name, value: value.bnf}))}]
                           }}/>
                       </CardContent></Card>
                       <Card><CardHeader><CardTitle>Husband Name Parts</CardTitle></CardHeader><CardContent>
                           <ReactECharts style={{ height: '300px' }} option={{
                               tooltip: { trigger: 'item' },
                               series: [{ type: 'pie', data: Object.entries(processedData.nameParts).map(([name, value]: [string, any]) => ({name, value: value.hus}))}]
                           }}/>
                       </CardContent></Card>
                    </div>

                     <div ref={refs.nonSigningChart}>
                        <Card><CardHeader><CardTitle>Reasons for Not Signing</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Table>
                                <TableHeader><TableRow><TableHead>Reason</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                                <TableBody>{Object.entries(processedData.nonSigningReasons).map(([reason, count]) => (
                                    <TableRow key={reason}><TableCell>{reason}</TableCell><TableCell className="text-right">{count as number}</TableCell></TableRow>
                                ))}</TableBody>
                            </Table>
                            <ReactECharts style={{ height: '300px' }} option={{
                                tooltip: { trigger: 'item' },
                                series: [{ type: 'pie', radius: ['40%', '70%'], data: Object.entries(processedData.nonSigningReasons).map(([name, value]) => ({name, value}))}]
                            }}/>
                        </CardContent></Card>
                    </div>
                    
                    <div ref={refs.recommendationsTable}>
                       <Card><CardHeader><CardTitle>Branch Recommendations</CardTitle></CardHeader>
                       <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Recommendation</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                                <TableBody>{Object.entries(processedData.recommendations).map(([rec, count]) => (
                                    <TableRow key={rec}><TableCell>{rec}</TableCell><TableCell className="text-right">{count as number}</TableCell></TableRow>
                                ))}</TableBody>
                            </Table>
                       </CardContent></Card>
                    </div>

                     <div className="flex justify-end gap-2">
                         <Button onClick={captureAndCache} disabled={isCapturing}>
                            {isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Camera className="mr-2 h-4 w-4" />}
                            Capture Dashboard
                         </Button>
                         <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review/recommendation">Recommendation Page</Link></Button>
                         <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review/database">Database Page</Link></Button>
                         <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review/download">Download Page</Link></Button>
                    </div>

                </div>
            )}
        </div>
    );
}
