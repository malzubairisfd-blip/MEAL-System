// src/app/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/export/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, FileDown, Plus, Minus } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';

interface Project {
  projectId: string;
  projectName: string;
}

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function ExportReferralStatementsPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [config, setConfig] = useState({ projectId: '', followUpCycle: 1, followUpMonth: '' });
    const [loading, setLoading] = useState({ projects: true, config: true, action: false });
    const workerRef = React.useRef<Worker | null>(null);

    useEffect(() => {
        fetch('/api/projects').then(res => res.json()).then(setProjects).finally(() => setLoading(p => ({ ...p, projects: false })));
        fetch('/api/bnf-referral-cycle').then(res => res.json()).then(setConfig).finally(() => setLoading(p => ({ ...p, config: false })));

        const worker = new Worker(new URL('@/workers/bnfreferralcmam-export.worker.ts', import.meta.url));
        workerRef.current = worker;
        return () => worker.terminate();
    }, []);

    const handleConfigChange = (field: keyof typeof config, value: any) => {
        setConfig(prev => {
            const newConfig = { ...prev, [field]: value };
            fetch('/api/bnf-referral-cycle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newConfig) });
            return newConfig;
        });
    };

    const handleUpdateAndExport = async () => {
        if (!config.projectId || !config.followUpCycle || !config.followUpMonth) {
            toast({ title: "Incomplete Selection", description: "Please select a project, cycle, and month.", variant: "destructive" });
            return;
        }

        setLoading(prev => ({...prev, action: true}));
        toast({ title: "Starting Process", description: `Updating database for Cycle ${config.followUpCycle}...` });

        try {
            // Step 1: Update DB
            const updateRes = await fetch('/api/bnf-cmam/referral-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: config.projectId, cycle: config.followUpCycle })
            });
            if (!updateRes.ok) throw new Error(await updateRes.text());
            toast({ title: "Update Complete", description: "Fetching updated data for export." });

            // Step 2: Fetch Data for Worker
            const dataRes = await fetch(`/api/bnf-cmam?projectId=${config.projectId}`);
            if (!dataRes.ok) throw new Error('Failed to fetch updated data.');
            const beneficiaries = await dataRes.json();
            
            // Step 3: Run Worker for PDF/ZIP
            if (workerRef.current) {
                const [fontRegularRes, fontBoldRes] = await Promise.all([
                  fetch('/fonts/NotoNaskhArabic-Regular.ttf'),
                  fetch('/fonts/NotoNaskhArabic-Bold.ttf')
                ]);
                const fontRegularBuffer = await fontRegularRes.arrayBuffer();
                const fontBoldBuffer = await fontBoldRes.arrayBuffer();
                const fontBase64 = {
                  regular: btoa(new Uint8Array(fontRegularBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')),
                  bold: btoa(new Uint8Array(fontBoldBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')),
                };

                workerRef.current.postMessage({
                    beneficiaries,
                    fontBase64,
                    selectedCycle: config.followUpCycle,
                    selectedMonth: config.followUpMonth
                });
                
                workerRef.current.onmessage = (event) => {
                    const { type, data, error } = event.data;
                    if(type === 'done-all') {
                        const blob = new Blob([data], { type: 'application/zip' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `Referral_Statements_Cycle_${config.followUpCycle}.zip`;
                        link.click();
                        URL.revokeObjectURL(link.href);
                        toast({ title: "Export Complete", description: "Your ZIP file has been downloaded." });
                    } else if (type === 'error') {
                        throw new Error(error);
                    }
                     setLoading(prev => ({...prev, action: false}));
                };
            }

        } catch (error: any) {
            toast({ title: "Process Failed", description: error.message, variant: "destructive" });
            setLoading(prev => ({...prev, action: false}));
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Export Referral Malnourished Statements</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/cycles"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Cycles</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>Select the project and follow-up period to generate reports for.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                        <Label>Project</Label>
                        <Select onValueChange={(v) => handleConfigChange('projectId', v)} value={config.projectId} disabled={loading.projects}>
                            <SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger>
                            <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>دورة المتابعة</Label>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleConfigChange('followUpCycle', Math.max(1, config.followUpCycle - 1))}><Minus/></Button>
                            <Input type="number" value={config.followUpCycle} readOnly className="text-center w-16" />
                            <Button variant="outline" size="icon" onClick={() => handleConfigChange('followUpCycle', Math.min(3, config.followUpCycle + 1))}><Plus/></Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>شهر المتابعة</Label>
                        <Select onValueChange={(v) => handleConfigChange('followUpMonth', v)} value={config.followUpMonth}>
                            <SelectTrigger><SelectValue placeholder="Select Month..." /></SelectTrigger>
                            <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
            
            <div className="flex justify-end">
                <Button size="lg" onClick={handleUpdateAndExport} disabled={loading.action}>
                    {loading.action ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Update & Export Statements
                </Button>
            </div>
        </div>
    );
}
