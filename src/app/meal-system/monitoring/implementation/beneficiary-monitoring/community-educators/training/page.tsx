// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/training/page.tsx
"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Calculator, UserCheck, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// --- Types ---
type Project = { projectId: string; projectName: string };

type VillageRequirement = {
  villageName: string;
  bnfCount: number;
  edCount: number; // Applicants available
  edReq: number;   // Calculated (BNF / 22)
};

type EducatorCandidate = {
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
};

// Tracks selection state for a single row
type SelectionState = {
  isSelected: boolean;
  contractType: string; // 'مثقفة مجتمعية' | 'رقابة' | 'احتياط'
};

function TrainingStatementsPageContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get('projectId');
  const [projectId, setProjectId] = useState(projectIdFromUrl || "");
  const { toast } = useToast();

  // --- 1. Requirements Section States ---
  const [villageStats, setVillageStats] = useState<VillageRequirement[]>([]);
  const [manualMonitorsReq, setManualMonitorsReq] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(false);

  // --- 2. Qualification Section States ---
  const [selectedVillage, setSelectedVillage] = useState<string>("");
  const [candidates, setCandidates] = useState<EducatorCandidate[]>([]);
  const [selections, setSelections] = useState<Record<number, SelectionState>>({});
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Initial Load ---
  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(() => toast({ title: "Failed to load projects", variant: 'destructive' }));
  }, [toast]);

  // --- Load Requirements when Project Selected ---
  useEffect(() => {
    if (!projectId) return;
    
    setLoadingStats(true);
    fetch(`/api/training/requirements?projectId=${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setVillageStats(data);
        } else {
            // If API not ready, mock empty or show error
            console.error("Invalid data format", data);
            toast({ title: "Failed to load requirements", description: "Check API response", variant: 'destructive'});
        }
      })
      .catch(err => toast({ title: "Failed to load requirements", description: err.message, variant: 'destructive'}))
      .finally(() => setLoadingStats(false));
  }, [projectId, toast]);

  // --- Load Candidates when Village Selected ---
  useEffect(() => {
    if (!selectedVillage) {
      setCandidates([]);
      setSelections({});
      return;
    }

    setLoadingCandidates(true);
    // This API endpoint doesn't exist yet, so we'll just mock an empty array
    // In a real scenario, this would fetch candidates for the selected village.
    // fetch(`/api/training/candidates?village=${encodeURIComponent(selectedVillage)}`)
    new Promise<any[]>(resolve => setTimeout(() => resolve([]), 500))
      .then(data => {
        setCandidates(Array.isArray(data) ? data : []);
        setSelections({}); // Reset selections on village change
      })
      .catch(err => toast({ title: "Failed to load candidates", variant: 'destructive'}))
      .finally(() => setLoadingCandidates(false));
  }, [selectedVillage, toast]);

  // --- Calculated Totals for "Required Educators" Box ---
  const totalEdReq = villageStats.reduce((sum, v) => sum + v.edReq, 0);
  const totalSpareReq = Math.round(totalEdReq * 0.40);
  const totalReqFieldMonitors = manualMonitorsReq; // User input
  const totalQualified = totalEdReq + totalSpareReq + totalReqFieldMonitors;

  // --- Statistics for Currently Selected Village ---
  const currentVillageStat = villageStats.find(v => v.villageName === selectedVillage);
  const villageEdReq = currentVillageStat?.edReq || 0;
  const villageSpareReq = Math.round(villageEdReq * 0.40);
  
  // Count current selections by type
  const currentCounts = useMemo(() => {
    let edu = 0, spare = 0, monitor = 0;
    Object.values(selections).forEach(s => {
      if (!s.isSelected) return;
      if (s.contractType === 'مثقفة مجتمعية') edu++;
      if (s.contractType === 'احتياط') spare++;
      if (s.contractType === 'رقابة') monitor++;
    });
    return { edu, spare, monitor };
  }, [selections]);

  // --- Handlers ---

  const handleCheckboxChange = (id: number, checked: boolean) => {
    setSelections(prev => ({
      ...prev,
      [id]: {
        isSelected: checked,
        contractType: prev[id]?.contractType || 'مثقفة مجتمعية' // Default to Educator if not set
      }
    }));
  };

  const handleContractTypeChange = (id: number, type: string) => {
    setSelections(prev => ({
      ...prev,
      [id]: {
        isSelected: true, // Auto-select row when type is changed
        contractType: type
      }
    }));
  };

  const handleSubmitQualification = async () => {
    const selectedIds = Object.keys(selections).filter(id => selections[+id].isSelected);
    
    if (selectedIds.length === 0) {
      toast({ title: "No selection", description: "Please select at least one candidate.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        applicants: selectedIds.map(id => ({
          applicant_id: +id,
          contract_type: selections[+id].contractType
        }))
      };

      const res = await fetch("/api/training/qualify", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to update");

      toast({ title: "Success", description: "Educators qualified successfully." });

      // Refresh data
      // 1. Remove processed candidates from list
      setCandidates(prev => prev.filter(c => !selectedIds.includes(String(c.applicant_id))));
      setSelections({});
      
      // 2. Refresh stats (counts might change)
      // trigger stats refresh if needed

    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Training & Qualification Management</h1>
      </div>

      {/* --- SECTION 1: Project & Requirement Calculation --- */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600"/>
                Training Requirements Calculation
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="max-w-md">
                <label className="text-sm font-medium mb-1 block">Select Project</label>
                <Select onValueChange={setProjectId} value={projectId}>
                    <SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger>
                    <SelectContent>
                    {projects.map(p => (
                        <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Requirements Table */}
            {projectId && (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Village Name</TableHead>
                                <TableHead className="text-center">Beneficiaries (BNF_CNT)</TableHead>
                                <TableHead className="text-center">Available Applicants (ED_CNT)</TableHead>
                                <TableHead className="text-center font-bold text-blue-700">Req. Educators (ED_REQ)</TableHead>
                            </TableRow>
                        </TableHeader>
                    </Table>
                    <ScrollArea className="h-[250px]">
                        <Table>
                            <TableBody>
                                {loadingStats ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                                ) : villageStats.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{row.villageName}</TableCell>
                                        <TableCell className="text-center">{row.bnfCount}</TableCell>
                                        <TableCell className="text-center">{row.edCount}</TableCell>
                                        <TableCell className="text-center font-bold bg-blue-50/50">{row.edReq}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            )}

            {/* Summary Boxes */}
            {projectId && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                    <Card className="bg-blue-50 border-blue-200">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-700">Required Educators</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-blue-900">{totalEdReq}</div></CardContent>
                    </Card>
                    <Card className="bg-amber-50 border-amber-200">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-amber-700">Required Spare (40%)</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-amber-900">{totalSpareReq}</div></CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-700">Required Field Monitors</CardTitle></CardHeader>
                        <CardContent>
                            <Input 
                                type="number" 
                                className="h-8 w-24 bg-white text-black" 
                                value={manualMonitorsReq}
                                onChange={(e) => setManualMonitorsReq(+e.target.value)}
                            />
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-100 border-slate-300">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-700">Total Qualified</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-slate-900">{totalQualified}</div></CardContent>
                    </Card>
                </div>
            )}
        </CardContent>
      </Card>

      {/* --- SECTION 2: Select Qualified Educators --- */}
      {projectId && (
      <Card className="border-t-4 border-t-indigo-500">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600"/>
                Select Qualified Educators
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            
            {/* Village Selector & Dynamic Progress Boxes */}
            <div className="flex flex-col md:flex-row gap-6 bg-muted p-4 rounded-lg border">
                <div className="w-full md:w-1/3">
                    <label className="text-sm font-medium mb-1 block">Select Village</label>
                    <Select onValueChange={setSelectedVillage} value={selectedVillage}>
                        <SelectTrigger className="bg-white text-black">
                            <SelectValue placeholder="Choose Village..." />
                        </SelectTrigger>
                        <SelectContent>
                            {villageStats.map((v) => (
                                <SelectItem key={v.villageName} value={v.villageName}>
                                    {v.villageName} (Avail: {v.edCount})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {/* "Allow selecting from another village" is implicit as the user can just select a different village in the dropdown */}
                </div>

                <div className="flex-1 grid grid-cols-3 gap-4">
                     {/* Dynamic Box: Educators */}
                    <div className="bg-white p-3 rounded border text-center shadow-sm">
                        <div className="text-xs text-gray-500 font-semibold uppercase">Educators</div>
                        <div className="text-xl font-bold mt-1">
                            <span className={currentCounts.edu >= villageEdReq ? "text-green-600" : "text-indigo-600"}>
                                {currentCounts.edu}
                            </span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="text-gray-600">{villageEdReq}</span>
                        </div>
                    </div>
                     {/* Dynamic Box: Spare */}
                     <div className="bg-white p-3 rounded border text-center shadow-sm">
                        <div className="text-xs text-gray-500 font-semibold uppercase">Spare</div>
                        <div className="text-xl font-bold mt-1">
                            <span className={currentCounts.spare >= villageSpareReq ? "text-green-600" : "text-amber-600"}>
                                {currentCounts.spare}
                            </span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="text-gray-600">{villageSpareReq}</span>
                        </div>
                    </div>
                     {/* Dynamic Box: Monitors */}
                     <div className="bg-white p-3 rounded border text-center shadow-sm">
                        <div className="text-xs text-gray-500 font-semibold uppercase">Field Monitors</div>
                        <div className="text-xl font-bold mt-1 text-green-600">
                            {currentCounts.monitor}
                        </div>
                    </div>
                </div>
            </div>

            {/* Candidates Table */}
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">Select</TableHead>
                            <TableHead>ID</TableHead>
                            <TableHead>Applicant Name</TableHead>
                            <TableHead>Total Score</TableHead>
                            <TableHead>Rank</TableHead>
                            <TableHead className="w-[200px]">Contract Type</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loadingCandidates ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                        ) : candidates.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center text-gray-500">No qualified candidates found for this village.</TableCell></TableRow>
                        ) : (
                            candidates.map((c) => (
                                <TableRow key={c.applicant_id} className={selections[c.applicant_id]?.isSelected ? "bg-indigo-50" : ""}>
                                    <TableCell>
                                        <Checkbox 
                                            checked={selections[c.applicant_id]?.isSelected || false}
                                            onCheckedChange={(chk) => handleCheckboxChange(c.applicant_id, chk as boolean)}
                                        />
                                    </TableCell>
                                    <TableCell>{c.applicant_id}</TableCell>
                                    <TableCell className="font-medium">{c.applicant_name}</TableCell>
                                    <TableCell>{c.grand_total_score}</TableCell>
                                    <TableCell>{c.grand_score_rank}</TableCell>
                                    <TableCell>
                                        <Select 
                                            value={selections[c.applicant_id]?.contractType || ""}
                                            onValueChange={(val) => handleContractTypeChange(c.applicant_id, val)}
                                        >
                                            <SelectTrigger className="h-8">
                                                <SelectValue placeholder="Select Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="مثقفة مجتمعية">مثقفة مجتمعية</SelectItem>
                                                <SelectItem value="احتياط">احتياط</SelectItem>
                                                <SelectItem value="رقابة">رقابة</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Action Button */}
            <div className="flex justify-end">
                <Button 
                    size="lg" 
                    onClick={handleSubmitQualification} 
                    disabled={isSubmitting || Object.keys(selections).filter(k => selections[+k].isSelected).length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700"
                >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {!isSubmitting && <CheckCircle2 className="mr-2 h-4 w-4"/>}
                    Confirm Qualification
                </Button>
            </div>

        </CardContent>
      </Card>
      )}

      {/* --- SECTION 3: Export Link (Kept from original) --- */}
      {projectId && (
        <div className="flex justify-end">
            <Button variant="outline" asChild>
                <Link href={`/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-exact-pdf?projectId=${projectId}&type=training`}>
                    <FileText className="mr-2 h-4 w-4"/>
                    Go to PDF Designer
                </Link>
            </Button>
        </div>
      )}
    </div>
  );
}

export default function TrainingPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <TrainingStatementsPageContent />
        </Suspense>
    )
}
    

    