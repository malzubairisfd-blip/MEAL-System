
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, Download, Files } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getContractHtml } from '@/lib/contract-template';

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
  uzla?: string;
}

const funderOptions = [
    "منحة البنك الدولي الاضافية لتعزيز الحماية الاجتماعية والاستجابة لجائحة كورونا عبر برنامج الأمم المتحدة الانمائي",
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
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [progressText, setProgressText] = useState('');

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
                toast({ title: "Error", description: error.message, variant: "destructive" });
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

            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            const content = getContractHtml(educator, project, selectedFunder);

            const opt = {
                margin: 0,
                filename: `contract_${educator.applicant_id}_${educator.applicant_name}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().from(content).set(opt).save();
            toast({ title: "Download started", description: `Contract for ${educator.applicant_name} generated successfully.` });

        } catch (error: any) {
            console.error("PDF Generation Failed:", error);
            toast({ title: "PDF Generation Failed", description: error.message, variant: "destructive" });
        } finally {
            setGeneratingId(null);
        }
    }, [selectedFunder, projects, selectedProjectId, toast]);

    const handleDownloadAll = useCallback(async () => {
        if (!selectedFunder || !selectedProjectId) {
            toast({ title: "Missing Information", description: "Please select a project and a funder first.", variant: "destructive" });
            return;
        }

        if (filteredEducators.length === 0) {
            toast({ title: "No Data", description: "No contracted educators found for this project.", variant: "destructive" });
            return;
        }

        setIsGeneratingAll(true);
        setProgressText('Starting bulk generation...');

        try {
            const project = projects.find(p => p.projectId === selectedProjectId);
            if(!project) throw new Error("Project details not found");

            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            const zip = new JSZip();

            for (let i = 0; i < filteredEducators.length; i++) {
                const educator = filteredEducators[i];
                setProgressText(`Processing ${i + 1}/${filteredEducators.length}: ${educator.applicant_name}`);
                
                const content = getContractHtml(educator, project, selectedFunder);
                const opt = {
                    margin: 0,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                const pdfBlob = await html2pdf().from(content).set(opt).output('blob');
                zip.file(`contract_${educator.applicant_id}_${educator.applicant_name}.pdf`, pdfBlob);
            }

            setProgressText('Zipping files...');
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `contracts_${project.projectName}.zip`);
            
            toast({ title: "Success", description: `All ${filteredEducators.length} contracts have been bundled into a ZIP file.` });

        } catch (error: any) {
            console.error("Bulk Generation Failed:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsGeneratingAll(false);
            setProgressText('');
        }
    }, [selectedFunder, projects, selectedProjectId, filteredEducators, toast]);


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">View Educator Contracts</h1>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Hub
                        </Link>
                    </Button>
                    <Button 
                        onClick={handleDownloadAll} 
                        disabled={isGeneratingAll || filteredEducators.length === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isGeneratingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Files className="mr-2 h-4 w-4"/>}
                        Generate All Contracts (ZIP)
                    </Button>
                </div>
            </div>

            {isGeneratingAll && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="py-4 flex items-center gap-4">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">{progressText}</span>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Select Project and Funder</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects || isGeneratingAll}>
                        <SelectTrigger>
                            <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select onValueChange={setSelectedFunder} value={selectedFunder} disabled={isGeneratingAll}>
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
                     {loading.educators ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : (
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
                                                    disabled={generatingId === edu.applicant_id || isGeneratingAll}
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
