// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/training/page.tsx
"use client";

import { useEffect, useState, Suspense, useMemo, useCallback } from "react";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Calculator, UserCheck, RefreshCw } from 'lucide-react';

interface Project {
    projectId: string;
    projectName: string;
}

interface Requirement {
    villageName: string;
    bnfCount: number;
    edCount: number;
    edReq: number;
}

interface Applicant {
    applicant_id: number;
    applicant_name: string;
    loc_name: string;
    age_per_village_ranking: number;
    sfd_marks: number;
    health_marks: number;
    local_community_marks: number;
    interview_total_marks: number;
    grand_total_score: number;
    grand_score_rank: number;
}

const SummaryCard = ({ title, value }: { title: string, value: string | number }) => (
    <div className="text-center p-4 border rounded-lg">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
    </div>
);


function TrainingStatementsPageContent() {
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') || '');
    
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [eligibleApplicants, setEligibleApplicants] = useState<Applicant[]>([]);

    const [selectedVillage, setSelectedVillage] = useState<string>('');
    const [selectedApplicantIds, setSelectedApplicantIds] = useState<Set<number>>(new Set());
    const [contractTypes, setContractTypes] = useState<Record<number, string>>({});
    
    const [fieldMonitors, setFieldMonitors] = useState(0);
    const [loading, setLoading] = useState({ projects: true, data: false, submitting: false });

    // Fetch projects on initial load
    useEffect(() => {
        setLoading(p => ({ ...p, projects: true }));
        fetch("/api/projects")
            .then(r => r.json())
            .then(data => setProjects(Array.isArray(data) ? data : []))
            .catch(err => toast({ title: "Failed to load projects", variant: 'destructive' }))
            .finally(() => setLoading(p => ({ ...p, projects: false })));
    }, [toast]);
    
    // Fetch requirements and eligible applicants when project changes
    useEffect(() => {
        if (!selectedProjectId) {
            setRequirements([]);
            setEligibleApplicants([]);
            return;
        }

        const fetchData = async () => {
            setLoading(p => ({ ...p, data: true }));
            try {
                const [reqRes, edRes] = await Promise.all([
                    fetch(`/api/training/requirements?projectId=${selectedProjectId}`),
                    fetch(`/api/training/candidates?projectId=${selectedProjectId}&filter=eligible`)
                ]);
                
                if (reqRes.ok) {
                    setRequirements(await reqRes.json());
                } else {
                    toast({ title: "Failed to load requirements", variant: 'destructive' });
                }

                if (edRes.ok) {
                    setEligibleApplicants(await edRes.json());
                } else {
                    toast({ title: "Failed to load eligible applicants", variant: 'destructive' });
                }
            } catch (error) {
                toast({ title: "Error fetching project data", variant: 'destructive' });
            } finally {
                setLoading(p => ({ ...p, data: false }));
            }
        };

        fetchData();
    }, [selectedProjectId, toast]);

    const summary = useMemo(() => {
        const requiredEducators = requirements.reduce((sum, r) => sum + r.edReq, 0);
        const requiredSpare = Math.round(requiredEducators * 0.40);
        const qualifiedForTraining = requiredEducators + requiredSpare + fieldMonitors;
        return { requiredEducators, requiredSpare, qualifiedForTraining };
    }, [requirements, fieldMonitors]);
    
    const villageSelectionOptions = useMemo(() => {
        const villagesWithApplicants = new Set(eligibleApplicants.map(app => app.loc_name));
        return requirements
            .filter(r => villagesWithApplicants.has(r.villageName))
            .map(r => r.villageName)
            .concat("All Remaining Applicants");
    }, [eligibleApplicants, requirements]);


    const filteredApplicants = useMemo(() => {
        if (selectedVillage === "All Remaining Applicants") {
            return eligibleApplicants.sort((a,b) => b.grand_score_rank - a.grand_score_rank);
        }
        if (selectedVillage) {
            return eligibleApplicants.filter(app => app.loc_name === selectedVillage);
        }
        return [];
    }, [selectedVillage, eligibleApplicants]);

    const currentVillageRequirements = useMemo(() => {
        const req = requirements.find(r => r.villageName === selectedVillage);
        if (!req) return { edReq: 0, spareReq: 0 };
        return {
            edReq: req.edReq,
            spareReq: Math.round(req.edReq * 0.4)
        };
    }, [selectedVillage, requirements]);

    const selectionCounts = useMemo(() => {
        let ed = 0, spare = 0, monitor = 0;
        selectedApplicantIds.forEach(id => {
            const type = contractTypes[id];
            if (type === 'مثقفة مجتمعية') ed++;
            else if (type === 'احتياط') spare++;
            else if (type === 'رقابة') monitor++;
        });
        return { ed, spare, monitor };
    }, [selectedApplicantIds, contractTypes]);

    const handleQualifyApplicants = useCallback(async () => {
        if (selectedApplicantIds.size === 0) {
            toast({ title: "No applicants selected", variant: "destructive" });
            return;
        }

        const missingContract = Array.from(selectedApplicantIds).some(id => !contractTypes[id]);
        if(missingContract) {
            toast({ title: "Missing contract type", description: "Please assign a contract type to all selected applicants.", variant: "destructive"});
            return;
        }

        setLoading(p => ({ ...p, submitting: true }));
        try {
            const payload = {
                projectId: selectedProjectId,
                applicants: Array.from(selectedApplicantIds).map(id => ({
                    applicant_id: id,
                    contract_type: contractTypes[id],
                })),
            };

            const res = await fetch("/api/training/qualify", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to qualify applicants.");
            
            toast({ title: "Success", description: `${payload.applicants.length} applicants have been qualified for training.`});

            // Refresh state
            setEligibleApplicants(prev => prev.filter(app => !selectedApplicantIds.has(app.applicant_id)));
            setSelectedApplicantIds(new Set());
            setContractTypes({});
            
        } catch (error: any) {
            toast({ title: "Submission Failed", description: error.message, variant: "destructive"});
        } finally {
             setLoading(p => ({ ...p, submitting: false }));
        }

    }, [selectedProjectId, selectedApplicantIds, contractTypes, toast]);


    return (
        <div className="space-y-8 pb-10">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Community Educators Training</h1>
                 {selectedProjectId && (
                     <Button asChild variant="outline">
                        <Link href={`/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-exact-pdf?projectId=${selectedProjectId}&type=training`}>
                            <FileText className="mr-2 h-4 w-4"/>
                            PDF Designer
                        </Link>
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader><CardTitle>1. Select Project</CardTitle></CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading.projects ? "Loading..." : "Select Project"} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedProjectId && (
                <>
                    <Card className="border-blue-200 bg-blue-50/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calculator className="h-5 w-5 text-blue-600"/>
                                2. Training Requirements Calculation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <ScrollArea className="h-72 border rounded-md bg-white">
                                <Table>
                                    <TableHeader className="bg-gray-100 sticky top-0">
                                        <TableRow>
                                            <TableHead>Village</TableHead>
                                            <TableHead className="text-center">Beneficiaries (BNF_CNT)</TableHead>
                                            <TableHead className="text-center">Available Educators (ED_CNT)</TableHead>
                                            <TableHead className="text-center font-bold text-blue-700">Required (ED_REQ)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading.data ? (
                                            <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                                        ) : requirements.map((v, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{v.villageName}</TableCell>
                                                <TableCell className="text-center">{v.bnfCount}</TableCell>
                                                <TableCell className="text-center">{v.edCount}</TableCell>
                                                <TableCell className="text-center font-bold bg-blue-50">{v.edReq}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <SummaryCard title="Required Educators" value={summary.requiredEducators} />
                                <SummaryCard title="Required Spare" value={summary.requiredSpare} />
                                <div className="text-center p-4 border rounded-lg">
                                    <Label>Required Field Monitors</Label>
                                    <Input type="number" value={fieldMonitors} onChange={e => setFieldMonitors(Number(e.target.value))} className="text-center text-3xl font-bold border-0 shadow-none h-auto p-0" />
                                </div>
                                <SummaryCard title="Total Qualified for Training" value={summary.qualifiedForTraining} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-green-200 bg-green-50/20">
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserCheck className="h-5 w-5 text-green-600"/>
                                3. Select Qualified Educators
                            </CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-4">
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="w-full md:w-1/3 space-y-2">
                                    <Label>Select Village to Qualify</Label>
                                     <Select onValueChange={setSelectedVillage} value={selectedVillage}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a village..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {villageSelectionOptions.map((v, i) => <SelectItem key={i} value={v}>{v}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center w-full">
                                    <div className="border rounded p-2 bg-blue-50">
                                        <div className="text-xs text-gray-500">Educators</div>
                                        <div className="font-bold text-lg">
                                            <span className={selectionCounts.ed >= currentVillageRequirements.edReq ? "text-green-600" : "text-red-500"}>{selectionCounts.ed}</span> / {currentVillageRequirements.edReq}
                                        </div>
                                    </div>
                                    <div className="border rounded p-2 bg-orange-50">
                                         <div className="text-xs text-gray-500">Spare</div>
                                         <div className="font-bold text-lg">
                                            <span className={selectionCounts.spare >= currentVillageRequirements.spareReq ? "text-green-600" : "text-red-500"}>{selectionCounts.spare}</span> / {currentVillageRequirements.spareReq}
                                        </div>
                                    </div>
                                     <div className="border rounded p-2 bg-green-50">
                                         <div className="text-xs text-gray-500">Monitors</div>
                                         <div className="font-bold text-lg">
                                            <span>{selectionCounts.monitor}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6">
                                 <ScrollArea className="h-96 border rounded-md">
                                     <Table>
                                         <TableHeader><TableRow><TableHead>Select</TableHead><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead>Rank</TableHead><TableHead>Total Score</TableHead><TableHead className="w-[200px]">Contract Type</TableHead></TableRow></TableHeader>
                                         <TableBody>
                                             {loading.applicants ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                                             filteredApplicants.map(app => (
                                                 <TableRow key={app.applicant_id} className={selectedApplicantIds.has(app.applicant_id) ? "bg-blue-50" : ""}>
                                                     <TableCell><Checkbox checked={selectedApplicantIds.has(app.applicant_id)} onCheckedChange={c => setSelectedApplicantIds(p => { const s = new Set(p); c ? s.add(app.applicant_id) : s.delete(app.applicant_id); return s; })} /></TableCell>
                                                     <TableCell>{app.applicant_id}</TableCell>
                                                     <TableCell>{app.applicant_name}</TableCell>
                                                     <TableCell>{app.loc_name}</TableCell>
                                                     <TableCell>{app.grand_score_rank}</TableCell>
                                                     <TableCell>{app.grand_total_score}</TableCell>
                                                     <TableCell>
                                                         <Select value={contractTypes[app.applicant_id] || ""} onValueChange={v => setContractTypes(p => ({...p, [app.applicant_id]: v}))}>
                                                             <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                                                             <SelectContent>
                                                                 <SelectItem value="مثقفة مجتمعية">مثقفة مجتمعية</SelectItem>
                                                                 <SelectItem value="احتياط">احتياط</SelectItem>
                                                                 <SelectItem value="رقابة">رقابة</SelectItem>
                                                             </SelectContent>
                                                         </Select>
                                                     </TableCell>
                                                 </TableRow>
                                             ))}
                                         </TableBody>
                                     </Table>
                                 </ScrollArea>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button onClick={handleQualifyApplicants} disabled={loading.submitting || selectedApplicantIds.size === 0}>
                                    {loading.submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                                    Confirm & Qualify Selected ({selectedApplicantIds.size})
                                </Button>
                            </div>
                         </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

export default function TrainingPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <TrainingStatementsPageContent />
        </Suspense>
    );
}
