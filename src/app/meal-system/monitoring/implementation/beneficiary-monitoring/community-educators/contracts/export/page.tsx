"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, Save, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';

interface Project {
  projectId: string;
  projectName: string;
}

interface Educator {
  applicant_id: number;
  applicant_name: string;
  contract_type: string;
  working_village: string;
  ed_bnf_cnt: number;
  project_id: string;
}

const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const years = Array.from({ length: 10 }, (_, i) => ({ value: String(new Date().getFullYear() - 5 + i), label: String(new Date().getFullYear() - 5 + i) }));

export default function ExportContractsPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [loading, setLoading] = useState({ projects: true, educators: false, saving: false });
    
    const [allEducators, setAllEducators] = useState<Educator[]>([]);
    
    const [startDate, setStartDate] = useState({ day: '', month: '', year: '' });
    const [endDate, setEndDate] = useState({ day: '', month: '', year: '' });

    const fetchAllData = useCallback(async () => {
        setLoading(prev => ({ ...prev, projects: true, educators: true }));
        try {
            const [projRes, edRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/ed-selection')
            ]);
            
            if (!projRes.ok) throw new Error('Could not fetch projects.');
            const projData = await projRes.json();
            setProjects(Array.isArray(projData) ? projData : []);

            if (!edRes.ok) throw new Error('Could not fetch educators.');
            const edData = await edRes.json();
            setAllEducators(Array.isArray(edData) ? edData : []);

        } catch (error: any) {
            toast({ title: "Error loading data", description: error.message, variant: "destructive" });
        } finally {
            setLoading(prev => ({ ...prev, projects: false, educators: false }));
        }
    }, [toast]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const filteredEducators = useMemo(() => {
        if (!selectedProjectId) return [];
        return allEducators.filter(e => e.project_id === selectedProjectId && e.contract_type === 'مثقفة مجتمعية');
    }, [selectedProjectId, allEducators]);
    
    const contractDuration = useMemo(() => {
        if (startDate.year && startDate.month && startDate.day && endDate.year && endDate.month && endDate.day) {
            const start = dayjs(`${startDate.year}-${startDate.month}-${startDate.day}`);
            const end = dayjs(`${endDate.year}-${endDate.month}-${endDate.day}`);
            if (end.isBefore(start)) return "تاريخ نهاية غير صالح";
            const duration = end.diff(start, 'month');
            return `${duration} أشهر`;
        }
        return "-";
    }, [startDate, endDate]);
    
    const handleUpdateContracts = async () => {
        if (!selectedProjectId || filteredEducators.length === 0 || contractDuration === "-" || contractDuration.includes("صالح")) {
            toast({ title: "Incomplete Information", description: "Please select a project and valid start/end dates.", variant: "destructive" });
            return;
        }

        setLoading(prev => ({ ...prev, saving: true }));

        const updates = filteredEducators.map(edu => ({
            applicant_id: edu.applicant_id,
            contract_starting_date: `${startDate.year}-${startDate.month}-${startDate.day}`,
            contract_end_date: `${endDate.year}-${endDate.month}-${endDate.day}`,
            contract_duration_months: parseInt(contractDuration, 10),
        }));

        try {
            const res = await fetch('/api/ed-selection', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error('Failed to update contracts.');
            toast({ title: "Success", description: `${updates.length} contracts have been updated.` });
            fetchAllData(); // Refresh data after update
        } catch (error: any) {
            toast({ title: "Update Failed", description: error.message, variant: 'destructive' });
        } finally {
             setLoading(prev => ({ ...prev, saving: false }));
        }
    };

    const daysInMonth = useMemo(() => {
        const year = startDate.year || endDate.year;
        const month = startDate.month || endDate.month;
        if(year && month) {
            return Array.from({ length: dayjs(`${year}-${month}-01`).daysInMonth() }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
        }
        return Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
    }, [startDate.year, startDate.month, endDate.year, endDate.month]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Set Contract Dates for Community Educators</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Contracts Hub
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>1. Select Project and Dates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Contract Start Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                               <Select value={startDate.day} onValueChange={v => setStartDate(p => ({...p, day: v}))}><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger><SelectContent>{daysInMonth.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select>
                               <Select value={startDate.month} onValueChange={v => setStartDate(p => ({...p, month: v}))}><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
                               <Select value={startDate.year} onValueChange={v => setStartDate(p => ({...p, year: v}))}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}</SelectContent></Select>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Contract End Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                               <Select value={endDate.day} onValueChange={v => setEndDate(p => ({...p, day: v}))}><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger><SelectContent>{daysInMonth.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select>
                               <Select value={endDate.month} onValueChange={v => setEndDate(p => ({...p, month: v}))}><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
                               <Select value={endDate.year} onValueChange={v => setEndDate(p => ({...p, year: v}))}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}</SelectContent></Select>
                            </div>
                        </div>
                        <div className="p-4 bg-muted rounded-md text-center">
                            <p className="text-sm font-medium text-muted-foreground">Contract Duration</p>
                            <p className="text-2xl font-bold">{contractDuration}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>2. Community Educators to be Updated</CardTitle>
                    <CardDescription>
                        The start and end dates will be applied to all Community Educators (`مثقفة مجتمعية`) listed below for the selected project.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading.educators ? <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : (
                        <ScrollArea className="h-72 border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Applicant ID</TableHead>
                                        <TableHead>Applicant Name</TableHead>
                                        <TableHead>Contract Type</TableHead>
                                        <TableHead>Working Village</TableHead>
                                        <TableHead>BNF Count</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEducators.map(edu => (
                                        <TableRow key={edu.applicant_id}>
                                            <TableCell>{edu.applicant_id}</TableCell>
                                            <TableCell>{edu.applicant_name}</TableCell>
                                            <TableCell>{edu.contract_type}</TableCell>
                                            <TableCell>{edu.working_village}</TableCell>
                                            <TableCell>{edu.ed_bnf_cnt}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {filteredEducators.length === 0 && <p className="text-center text-muted-foreground p-4">No community educators found for this project.</p>}
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
            
            <div className="flex justify-end">
                <Button onClick={handleUpdateContracts} disabled={loading.saving}>
                    {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Update ({filteredEducators.length}) Contracts
                </Button>
            </div>
        </div>
    );
}
