// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts/view/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { saveAs } from 'file-saver';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Download } from "lucide-react";
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
  id_type: string;
  id_no: string;
  id_issue_location: string;
  id_issue_date: string;
  working_village: string;
  mud_name: string;
}

const funderOptions = [
    "منحةالبنك الدولي الاضافية لتعزيز الحماية الاجتماعية والاستجابة لجائحة كورونا عبر برنامج الأمم المتحدة الانمائي",
    "منحة الحكومة البريطانية (شبكة الامان والامن الغذائي)"
];

export default function ViewContractsPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedFunder, setSelectedFunder] = useState('');
    const [allEducators, setAllEducators] = useState<Educator[]>([]);
    const [loading, setLoading] = useState({ projects: true, educators: false });
    const [generatingId, setGeneratingId] = useState<number | null>(null);

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
    
    useEffect(() => {
        if (!selectedProjectId) {
            setAllEducators([]);
            return;
        }
        const fetchAllEducators = async () => {
            setLoading(prev => ({ ...prev, educators: true }));
            try {
                const res = await fetch('/api/ed-selection');
                if (!res.ok) throw new Error('Could not fetch educators data.');
                const allData = await res.json();
                setAllEducators(allData.filter((e: any) => e.project_id === selectedProjectId));
            } catch (error: any) {
                toast({ title: "Error loading educator data", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, educators: false }));
            }
        };
        fetchAllEducators();
    }, [selectedProjectId, toast]);

    const filteredEducators = useMemo(() => {
        return allEducators.filter(e => 
            e.contract_type === 'مثقفة مجتمعية' && 
            e.contract_starting_date && e.contract_starting_date.trim() !== ''
        );
    }, [allEducators]);
    
    const handleDownloadContract = useCallback(async (educator: Educator) => {
        if (!selectedFunder || !selectedProjectId) {
            toast({ title: "Missing Information", description: "Please select a project and a funder first.", variant: "destructive" });
            return;
        }
        
        setGeneratingId(educator.applicant_id);

        try {
            const project = projects.find(p => p.projectId === selectedProjectId);
            if(!project) throw new Error("Project details not found");

            const res = await fetch('/api/contracts/export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ educator, project, funder: selectedFunder })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to generate PDF');
            }

            const blob = await res.blob();
            saveAs(blob, `Contract_${educator.applicant_name}.pdf`);
            toast({ title: "Download started", description: `Contract for ${educator.applicant_name} is downloading.` });

        } catch (error: any) {
            toast({ title: "PDF Generation Failed", description: error.message, variant: "destructive" });
        } finally {
            setGeneratingId(null);
        }
    }, [selectedFunder, projects, selectedProjectId, toast]);


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
                    <CardTitle>Select Project and Funder</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger>
                            <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                     <Select onValueChange={setSelectedFunder} value={selectedFunder}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Funder..." />
                        </SelectTrigger>
                        <SelectContent>
                           {funderOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Contracted Educators</CardTitle>
                    <CardDescription>
                        Showing {filteredEducators.length} educators with contracts. Click download to generate the PDF contract.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     {loading.educators ? <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : (
                         <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Applicant Name</TableHead>
                                        <TableHead>Start Date</TableHead>
                                        <TableHead>End Date</TableHead>
                                        <TableHead>Duration (Months)</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEducators.length > 0 ? filteredEducators.map(edu => (
                                        <TableRow key={edu.applicant_id}>
                                            <TableCell>{edu.applicant_name}</TableCell>
                                            <TableCell>{dayjs(edu.contract_starting_date).format('YYYY-MM-DD')}</TableCell>
                                            <TableCell>{dayjs(edu.contract_end_date).format('YYYY-MM-DD')}</TableCell>
                                            <TableCell>{edu.contract_duration_months}</TableCell>
                                            <TableCell>
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    onClick={() => handleDownloadContract(edu)}
                                                    disabled={generatingId === edu.applicant_id}
                                                >
                                                    {generatingId === edu.applicant_id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                No contracted educators found for this project.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                     )}
                </CardContent>
            </Card>
        </div>
    );
}
