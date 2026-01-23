// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/double-benefits/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, GitCompareArrows, UserCheck, UserX, Check, X } from "lucide-react";
import { Progress } from '@/components/ui/progress';

interface Project {
  projectId: string;
  projectName: string;
}

interface Mapping {
    educatorName: string;
    beneficiaryName: string;
    educatorId: string;
    beneficiaryId: string;
    educatorPhone: string;
    beneficiaryPhone: string;
}

type Cluster = {
    score: number;
    educator: any;
    beneficiary: any;
};

const LOCAL_STORAGE_MAPPING_PREFIX = "double-benefit-mapping-";

export default function DoubleBenefitsAnalysisPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [loading, setLoading] = useState({ projects: true, data: false, worker: false });
    
    const [educators, setEducators] = useState<any[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    
    const [educatorColumns, setEducatorColumns] = useState<string[]>([]);
    const [beneficiaryColumns, setBeneficiaryColumns] = useState<string[]>([]);
    
    const [mapping, setMapping] = useState<Mapping>({
        educatorName: 'applicant_name',
        beneficiaryName: 'l_benef_name',
        educatorId: 'id_no',
        beneficiaryId: 'l_id_card_no',
        educatorPhone: 'phone_no',
        beneficiaryPhone: 'l_phone_no',
    });
    
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [currentClusterIndex, setCurrentClusterIndex] = useState(0);

    const workerRef = useRef<Worker | null>(null);

    // Initialize worker
    useEffect(() => {
        const worker = new Worker(new URL('@/workers/double-benefit.worker.ts', import.meta.url));
        workerRef.current = worker;
        worker.onmessage = (event) => {
            const { type, data, error } = event.data;
            setLoading(prev => ({ ...prev, worker: false }));
            if (type === 'done') {
                setClusters(data.sort((a: Cluster, b: Cluster) => b.score - a.score));
                setCurrentClusterIndex(0);
                toast({ title: 'Analysis Complete', description: `Found ${data.length} potential duplicates.` });
            } else if (type === 'error') {
                toast({ title: 'Analysis Error', description: error, variant: 'destructive' });
            }
        };
        return () => worker.terminate();
    }, [toast]);
    
    // Fetch initial projects
    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(p => ({ ...p, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                const data = await res.json();
                setProjects(Array.isArray(data) ? data : []);
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(p => ({ ...p, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);

    // Fetch data on project selection
    const handleProjectSelect = useCallback(async (projectId: string) => {
        setSelectedProjectId(projectId);
        setClusters([]);
        setCurrentClusterIndex(0);
        if (!projectId) return;

        setLoading(p => ({ ...p, data: true }));
        try {
            const [edRes, bnfRes] = await Promise.all([
                fetch('/api/ed-selection'),
                fetch('/api/bnf-assessed')
            ]);
            
            if (!edRes.ok) throw new Error('Could not fetch educators data.');
            const allEducators = await edRes.json();
            const projectEducators = allEducators.filter((e: any) => e.project_id === projectId);
            setEducators(projectEducators);
            if(projectEducators.length > 0) setEducatorColumns(Object.keys(projectEducators[0]));
            
            if (!bnfRes.ok) throw new Error('Could not fetch beneficiaries data.');
            const allBeneficiaries = await bnfRes.json();
            setBeneficiaries(allBeneficiaries);
            if(allBeneficiaries.length > 0) setBeneficiaryColumns(Object.keys(allBeneficiaries[0]));
            
            const savedMapping = localStorage.getItem(`${LOCAL_STORAGE_MAPPING_PREFIX}${projectId}`);
            if (savedMapping) {
                setMapping(JSON.parse(savedMapping));
                toast({ title: "Mapping Loaded", description: "Loaded saved mapping for this project."});
            }

        } catch (error: any) {
            toast({ title: "Error loading data", description: error.message, variant: "destructive" });
        } finally {
             setLoading(p => ({ ...p, data: false }));
        }
    }, [toast]);

    const handleMappingChange = (field: keyof Mapping, value: string) => {
        const newMapping = { ...mapping, [field]: value };
        setMapping(newMapping);
        localStorage.setItem(`${LOCAL_STORAGE_MAPPING_PREFIX}${selectedProjectId}`, JSON.stringify(newMapping));
    };

    const handleFindDuplicates = () => {
        if (!workerRef.current) return;
        setLoading(prev => ({ ...prev, worker: true }));
        setClusters([]);
        setCurrentClusterIndex(0);
        workerRef.current.postMessage({ educators, beneficiaries, mapping });
    };

    const handleDecision = async (isDuplicate: boolean) => {
        if (isDuplicate) {
             const current = clusters[currentClusterIndex];
             try {
                const res = await fetch('/api/educators/update-beneficiary-info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        applicant_id: current.educator.applicant_id,
                        beneficiaryData: current.beneficiary,
                    })
                });
                if (!res.ok) throw new Error('Failed to update educator record.');
                toast({ title: 'Update Successful', description: `Educator ${current.educator.applicant_id} updated with beneficiary info.`});
             } catch(err: any) {
                toast({ title: 'Update Error', description: err.message, variant: 'destructive'});
             }
        }

        if (currentClusterIndex < clusters.length - 1) {
            setCurrentClusterIndex(prev => prev + 1);
        } else {
            toast({ title: 'Review Complete', description: 'You have reviewed all potential duplicates.'});
        }
    };
    
    const currentCluster = clusters[currentClusterIndex];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Double Benefits Analysis</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>1. Select Project</CardTitle>
                    <CardDescription>Select the project to analyze for double benefits.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={handleProjectSelect} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedProjectId && (loading.data ? <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> :
            <>
                <Card>
                    <CardHeader>
                        <CardTitle>2. Map Columns</CardTitle>
                        <CardDescription>Confirm the columns to match between Educators and Beneficiaries.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.keys(mapping).map(key => {
                            const isEducator = key.startsWith('educator');
                            const label = key.replace(/educator|beneficiary/, '').replace(/([A-Z])/g, ' $1').trim();
                            const options = isEducator ? educatorColumns : beneficiaryColumns;
                            
                            return (
                                <div key={key} className="space-y-2">
                                    <Label>{`Match ${label} in ${isEducator ? 'Educators' : 'Beneficiaries'}`}</Label>
                                    <Select value={mapping[key as keyof Mapping]} onValueChange={value => handleMappingChange(key as keyof Mapping, value)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>3. Find Duplicates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleFindDuplicates} disabled={loading.worker}>
                            {loading.worker ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <GitCompareArrows className="mr-2 h-4 w-4" />}
                            Find Potential Duplicates
                        </Button>
                    </CardContent>
                </Card>

                {clusters.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>4. Review Duplicates</CardTitle>
                            <CardDescription>
                                Reviewing {currentClusterIndex + 1} of {clusters.length}. 
                                Score: <span className="font-bold">{currentCluster.score.toFixed(3)}</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Field</TableHead>
                                        <TableHead>Educator Record ({currentCluster.educator.applicant_id})</TableHead>
                                        <TableHead>Beneficiary Record ({currentCluster.beneficiary.l_id})</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-medium">BNF_ED_ID</TableCell>
                                        <TableCell>{currentCluster.educator.applicant_id}</TableCell>
                                        <TableCell>{currentCluster.beneficiary.l_id}</TableCell>
                                    </TableRow>
                                     <TableRow>
                                        <TableCell className="font-medium">Name</TableCell>
                                        <TableCell>{currentCluster.educator[mapping.educatorName]}</TableCell>
                                        <TableCell>{currentCluster.beneficiary[mapping.beneficiaryName]}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">ID Card No.</TableCell>
                                        <TableCell>{currentCluster.educator[mapping.educatorId]}</TableCell>
                                        <TableCell>{currentCluster.beneficiary[mapping.beneficiaryId]}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">Phone Number</TableCell>
                                        <TableCell>{currentCluster.educator[mapping.educatorPhone]}</TableCell>
                                        <TableCell>{currentCluster.beneficiary[mapping.beneficiaryPhone]}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                            <div className="flex justify-end gap-4 mt-4">
                                <Button variant="destructive" onClick={() => handleDecision(true)}>
                                    <Check className="mr-2 h-4 w-4" /> ازدواج
                                </Button>
                                <Button variant="secondary" onClick={() => handleDecision(false)}>
                                    <X className="mr-2 h-4 w-4" /> ليست ازدواج
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </>
            )}
        </div>
    );
}
