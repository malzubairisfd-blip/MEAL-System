"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Project {
  projectId: string;
  projectName: string;
}

interface Educator {
  applicant_id: number;
  ed_id: string;
  applicant_name: string;
  contract_type: string;
  contract_starting_date: string;
  contract_end_date: string;
  contract_duration_months: number;
  project_id: string;
}

export default function ViewContractsPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [allEducators, setAllEducators] = useState<Educator[]>([]);
    const [loading, setLoading] = useState({ projects: true, educators: false });

    // Fetch projects on initial load
    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);
    
    // Fetch educators data once
    useEffect(() => {
        const fetchAllEducators = async () => {
            setLoading(prev => ({ ...prev, educators: true }));
            try {
                const res = await fetch('/api/ed-selection');
                if (!res.ok) throw new Error('Could not fetch educators data.');
                setAllEducators(await res.json());
            } catch (error: any) {
                toast({ title: "Error loading educator data", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, educators: false }));
            }
        };
        fetchAllEducators();
    }, [toast]);

    const filteredEducators = useMemo(() => {
        if (!selectedProjectId) return [];
        return allEducators.filter(e => 
            e.project_id === selectedProjectId && 
            e.contract_type === 'مثقفة مجتمعية' &&
            e.contract_starting_date // Only show those with contracts
        );
    }, [selectedProjectId, allEducators]);

    const getArabicDay = (dateString: string) => {
        if (!dateString) return '';
        const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayIndex = dayjs(dateString).day();
        return arabicDays[dayIndex];
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">View Educator Contracts</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Contracts Hub
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select Project</CardTitle>
                </CardHeader>
                <CardContent>
                     <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project to view contracts..."} />
                        </SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {loading.educators ? (
                <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div>
            ) : selectedProjectId && (
                <Card>
                    <CardHeader>
                        <CardTitle>Contracted Educators</CardTitle>
                        <CardDescription>
                            Showing {filteredEducators.length} community educators with contracts for the selected project.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ED_ID</TableHead>
                                        <TableHead>Applicant Name</TableHead>
                                        <TableHead>Contract Day (Arabic)</TableHead>
                                        <TableHead>Start Date</TableHead>
                                        <TableHead>End Date</TableHead>
                                        <TableHead>Duration (Months)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEducators.length > 0 ? filteredEducators.map(edu => (
                                        <TableRow key={edu.applicant_id}>
                                            <TableCell>{edu.ed_id}</TableCell>
                                            <TableCell>{edu.applicant_name}</TableCell>
                                            <TableCell>{getArabicDay(edu.contract_starting_date)}</TableCell>
                                            <TableCell>{edu.contract_starting_date ? dayjs(edu.contract_starting_date).format('YYYY-MM-DD') : ''}</TableCell>
                                            <TableCell>{edu.contract_end_date ? dayjs(edu.contract_end_date).format('YYYY-MM-DD') : ''}</TableCell>
                                            <TableCell>{edu.contract_duration_months}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                No contracted community educators found for this project.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
