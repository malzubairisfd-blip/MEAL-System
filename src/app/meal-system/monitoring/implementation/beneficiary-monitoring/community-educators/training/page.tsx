// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/training/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, UserCheck, User, Users, Briefcase, Filter, ArrowUpAZ, ArrowDownAZ, Save, Trash2, Plus, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

// --- Types ---
type Project = { projectId: string; projectName: string };

type VillageRequirement = {
  villageName: string;
  bnfCount: number;
  edCount: number;
  bnfPerEd: number;
  edReq: number;
};

type EducatorCandidate = {
  applicant_id: number;
  applicant_name: string;
  loc_name: string;
  applicant_qualification: string;
  age_per_village_ranking: number;
  sfd_marks: number;
  health_marks: number;
  local_community_marks: number;
  interview_total_marks: number;
  grand_total_score: number;
  grand_score_rank: number;
};

type SelectionState = {
  isSelected: boolean;
  contractType: 'مثقفة مجتمعية' | 'رقابة' | 'احتياط';
  workingVillage: string;
};

type Hall = { hallName: string; hallNumber: number };

const ColumnFilter = ({ column, onSort }: { column: string; onSort: (column: string, direction: 'asc' | 'desc') => void; }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-2">
          <Filter className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" onClick={() => onSort(column, 'asc')}><ArrowUpAZ className="mr-2 h-4 w-4"/> Sort Ascending</Button>
            <Button variant="outline" onClick={() => onSort(column, 'desc')}><ArrowDownAZ className="mr-2 h-4 w-4"/> Sort Descending</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const SummaryCard = ({ icon, title, value }: { icon: React.ReactNode, title: string, value: string | number }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
);

function TrainingStatementsPageContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get('projectId');
  const [projectId, setProjectId] = useState(projectIdFromUrl || "");
  const { toast } = useToast();

  const [allProjectEducators, setAllProjectEducators] = useState<any[]>([]);
  const [villageStats, setVillageStats] = useState<Omit<VillageRequirement, 'bnfPerEd' | 'edReq'>[]>([]);
  const [bnfPerEd, setBnfPerEd] = useState<Record<string, number>>({});
  const [manualMonitorsReq, setManualMonitorsReq] = useState<number>(0);
  const [loading, setLoading] = useState({ projects: true, stats: false, candidates: false, saving: false });
  const [validationMessage, setValidationMessage] = useState('');

  const [sortedVillages, setSortedVillages] = useState<VillageRequirement[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<string>("");
  
  const [candidates, setCandidates] = useState<EducatorCandidate[]>([]);
  const [selections, setSelections] = useState<Record<number, SelectionState>>({});
  const [activeCandidateIndex, setActiveCandidateIndex] = useState<number | null>(null);

  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedHall, setSelectedHall] = useState<number | null>(null);
  const [selectedApplicantsForHall, setSelectedApplicantsForHall] = useState<Set<number>>(new Set());
  
  const [trainingAbsentees, setTrainingAbsentees] = useState<any[]>([]);
  const [selectedAbsentees, setSelectedAbsentees] = useState<Set<number>>(new Set());
  const [absenteeSearch, setAbsenteeSearch] = useState('');
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [qualifiedCandidatesSearch, setQualifiedCandidatesSearch] = useState('');
  const [hallAssignmentSearch, setHallAssignmentSearch] = useState('');

  const [selectedContractTypes, setSelectedContractTypes] = useState({
    'مثقفة مجتمعية': 0,
    'رقابة': 0,
    'احتياط': 0
  });


  // --- Initial Project Load ---
  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(data => setProjects(Array.isArray(data) ? data : []));
  }, []);

  const getLocalStorageKey = (type: string) => `training-selections-${type}-${projectId}`;

  // --- Project Data Loading (Stats & Educators) ---
  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;

    setLoading(prev => ({ ...prev, stats: true, candidates: true }));
    try {
      const [reqRes, edRes] = await Promise.all([
        fetch(`/api/training/requirements?projectId=${projectId}`),
        fetch('/api/ed-selection')
      ]);
      if (reqRes.ok) {
        const data = await reqRes.json();
        setVillageStats(Array.isArray(data) ? data : []);
      } else {
        toast({ title: "Failed to load requirements", variant: "destructive" });
      }
      if (edRes.ok) {
        const allEducators = await edRes.json();
        setAllProjectEducators(allEducators.filter((e: any) => e.project_id === projectId));
      } else {
        toast({ title: "Failed to load educators", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error loading project data", description: err.message, variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, stats: false, candidates: false }));
    }
    
    // Load selections from local storage
    const savedSelections = localStorage.getItem(getLocalStorageKey('contract'));
    const savedHallSelections = localStorage.getItem(getLocalStorageKey('hall'));
    const savedAbsenteeSelections = localStorage.getItem(getLocalStorageKey('absentee'));
    const savedBnfPerEd = localStorage.getItem(`training-bnf-per-ed-${projectId}`);

    if (savedSelections) setSelections(JSON.parse(savedSelections));
    if (savedHallSelections) setSelectedApplicantsForHall(new Set(JSON.parse(savedHallSelections)));
    if (savedAbsenteeSelections) setSelectedAbsentees(new Set(JSON.parse(savedAbsenteeSelections)));
    if (savedBnfPerEd) setBnfPerEd(JSON.parse(savedBnfPerEd));

  }, [projectId, toast]);
  
  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);
  
  // --- Save selections to local storage ---
  useEffect(() => {
    if (projectId) localStorage.setItem(getLocalStorageKey('contract'), JSON.stringify(selections));
  }, [selections, projectId]);

  useEffect(() => {
    if (projectId) localStorage.setItem(getLocalStorageKey('hall'), JSON.stringify(Array.from(selectedApplicantsForHall)));
  }, [selectedApplicantsForHall, projectId]);

  useEffect(() => {
    if (projectId) localStorage.setItem(getLocalStorageKey('absentee'), JSON.stringify(Array.from(selectedAbsentees)));
  }, [selectedAbsentees, projectId]);
  
  useEffect(() => {
    if (projectId && Object.keys(bnfPerEd).length > 0) {
        localStorage.setItem(`training-bnf-per-ed-${projectId}`, JSON.stringify(bnfPerEd));
    }
  }, [bnfPerEd, projectId]);

  // --- Derived State & Calculations ---
  const villageStatsWithEdReq = useMemo(() => {
    return villageStats.map(v => {
      const bnfPerEdValue = bnfPerEd[v.villageName] || 0;
      return {
        ...v,
        bnfPerEd: bnfPerEdValue,
        edReq: bnfPerEdValue > 0 ? Math.ceil(v.bnfCount / bnfPerEdValue) : 0,
      };
    });
  }, [villageStats, bnfPerEd]);
  
  const totalAvailableApplicants = useMemo(() => {
    return allProjectEducators.filter(e => e.interview_attendance === 'حضرت المقابلة' && (e.training_qualification === 'مؤهلة للتدريب' || e.training_qualification === null)).length;
  }, [allProjectEducators]);

  const { totalEdReq, finalSpareReq, finalTotalQualified } = useMemo(() => {
    const totalEd = villageStatsWithEdReq.reduce((sum, v) => sum + v.edReq, 0);
    const initialSpare = Math.round(totalEd * 0.40);
    const totalRequired = totalEd + manualMonitorsReq;

    let spare = initialSpare;
    let totalQualified = totalRequired + spare;
    
    if (totalQualified > totalAvailableApplicants) {
        spare = Math.max(0, totalAvailableApplicants - totalRequired);
        totalQualified = totalRequired + spare;
    }

    return { totalEdReq: totalEd, finalSpareReq: spare, finalTotalQualified: totalQualified };
  }, [villageStatsWithEdReq, manualMonitorsReq, totalAvailableApplicants]);

  useEffect(() => {
    const sorted = [...villageStatsWithEdReq].sort((a, b) => {
        const aHasEnough = a.edCount >= a.edReq;
        const bHasEnough = b.edCount >= b.edReq;
        if (aHasEnough && !bHasEnough) return -1;
        if (!aHasEnough && bHasEnough) return 1;
        if (a.edCount < a.edReq && b.edCount < b.edReq) return b.edCount - a.edCount;
        if (a.edCount === 0 && b.edCount > 0) return 1;
        if (b.edCount === 0 && a.edCount > 0) return -1;
        if (a.edCount === 0 && b.edCount === 0) {
            if (a.bnfCount >= 15 && b.bnfCount < 15) return -1;
            if (a.bnfCount < 15 && b.bnfCount >= 15) return 1;
        }
        return b.edCount - a.edCount;
    });
    setSortedVillages(sorted);
    if (!selectedVillage && sorted.length > 0) {
        setSelectedVillage(sorted[0].villageName);
    }
  }, [villageStatsWithEdReq, selectedVillage]);


  // --- Candidate Loading & Sorting ---
  useEffect(() => {
    if (!selectedVillage) return;

    const assignedCandidateIds = new Set(Object.keys(selections).map(Number));

    const qualifiedApplicants = allProjectEducators.filter(
      edu => edu.training_attendance === 'حضرت التدريب'
    );
    
    let villageCandidates = qualifiedApplicants.filter(edu => edu.loc_name === selectedVillage && !assignedCandidateIds.has(edu.applicant_id));
    
    const villageStat = villageStatsWithEdReq.find(v => v.villageName === selectedVillage);

    const hasZeroCandidates = villageCandidates.length === 0;
    const hasInsufficientCandidates = villageCandidates.length < (villageStat?.edReq || 0);

    if (hasZeroCandidates && villageStat && villageStat.bnfCount >= 15) {
        const otherCandidates = qualifiedApplicants.filter(edu => edu.loc_name !== selectedVillage && !assignedCandidateIds.has(edu.applicant_id));
        villageCandidates = [...otherCandidates];
    } else if (hasInsufficientCandidates) {
        const otherCandidates = qualifiedApplicants.filter(edu => edu.loc_name !== selectedVillage && !assignedCandidateIds.has(edu.applicant_id));
        villageCandidates = [...villageCandidates, ...otherCandidates];
    } else if (hasZeroCandidates && villageStat && villageStat.bnfCount < 15) {
        villageCandidates = []; // Do not load others
    }
    
    let sorted = [...villageCandidates];
    if (sortConfig) {
        sorted.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    setCandidates(sorted);
    setActiveCandidateIndex(0);

  }, [selectedVillage, allProjectEducators, villageStatsWithEdReq, selections, sortConfig]);

  // --- Auto-advance Logic ---
  useEffect(() => {
      const currentVillageNeeds = villageStatsWithEdReq.find(v => v.villageName === selectedVillage);
      if (!currentVillageNeeds || !candidates.length) return;

      const currentSelectionsForVillage = Object.values(selections).filter(s => s.workingVillage === selectedVillage && s.contractType === 'مثقفة مجتمعية');

      if (currentSelectionsForVillage.length >= currentVillageNeeds.edReq) {
          const currentIndex = sortedVillages.findIndex(v => v.villageName === selectedVillage);
          if (currentIndex < sortedVillages.length - 1) {
              setSelectedVillage(sortedVillages[currentIndex + 1].villageName);
          } else {
              toast({ title: "All village requirements met." });
          }
      } else {
          if(activeCandidateIndex !== null && activeCandidateIndex >= candidates.length - 1) {
              // Reached end of list, do nothing or show message
          }
      }
  }, [selections, activeCandidateIndex, candidates, selectedVillage, sortedVillages, villageStatsWithEdReq, toast]);

  useEffect(() => {
    const counts = { 'مثقفة مجتمعية': 0, 'رقابة': 0, 'احتياط': 0 };
    Object.values(selections).forEach(sel => {
      if (sel.isSelected && sel.contractType) {
        counts[sel.contractType]++;
      }
    });
    setSelectedContractTypes(counts);
  }, [selections]);


  const handleContractTypeSelect = (type: SelectionState['contractType']) => {
      if (activeCandidateIndex === null || !candidates[activeCandidateIndex]) return;
      
      const applicantId = candidates[activeCandidateIndex].applicant_id;
      setSelections(prev => ({
          ...prev,
          [applicantId]: { isSelected: true, contractType: type, workingVillage: selectedVillage }
      }));
      
      // Auto-advance
      setActiveCandidateIndex(prev => (prev === null || prev >= candidates.length - 1) ? prev : prev + 1);
  };
  
  const handleSaveSelections = async () => {
    const payload = Object.entries(selections)
      .filter(([_, sel]) => sel.isSelected)
      .map(([id, sel]) => ({ 
        applicant_id: Number(id), 
        contract_type: sel.contractType, 
        working_village: sel.workingVillage,
      }));

    if (payload.length === 0) {
      toast({ title: "No selections to save." });
      return;
    }
    setLoading(prev => ({...prev, saving: true}));
    try {
        const res = await fetch("/api/ed-selection", { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(!res.ok) throw new Error('Failed to save selections.');
        toast({ title: "Success", description: "Educator contract types and working villages have been saved." });
        fetchProjectData();
    } catch(err: any) {
        toast({ title: "Save Error", description: err.message, variant: "destructive" });
    } finally {
        setLoading(prev => ({...prev, saving: false}));
    }
  };

  const handleLinkToHall = async () => {
      if (!selectedHall || selectedApplicantsForHall.size === 0) return toast({ title: "Incomplete", description: "Select a hall and applicants."});
      
      const hall = halls.find(h => h.hallNumber === selectedHall);
      if(!hall) return;

      setLoading(p => ({...p, saving: true}));
      try {
          await fetch("/api/trainings/link", {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ projectId, hallNumber: hall.hallNumber, hallName: hall.hallName, applicantIds: Array.from(selectedApplicantsForHall)})
          });

          toast({ title: "Success!", description: "Applicants linked to training hall."});
          setSelectedApplicantsForHall(new Set());
          fetchProjectData();

      } catch (err: any) {
          toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
          setLoading(p => ({...p, saving: false}));
      }
  };
  
  const applicantsForHallAssignment = useMemo(() => {
    return allProjectEducators.filter(e => e.interview_attendance === 'حضرت المقابلة' && e.training_qualification === null);
  }, [allProjectEducators]);

  useEffect(() => {
    const qualifiedForTraining = allProjectEducators.filter(e => e.training_qualification === 'مؤهلة للتدريب' && !e.training_attendance);
    setTrainingAbsentees(qualifiedForTraining);
  }, [allProjectEducators]);

  const filteredAbsentees = useMemo(() => {
    if (!absenteeSearch.trim()) return trainingAbsentees;
    const searchTerms = absenteeSearch.split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
    if (searchTerms.length === 0) return trainingAbsentees;
    
    return trainingAbsentees.filter(app => 
        searchTerms.some(term => 
            String(app.applicant_id).includes(term) || 
            app.applicant_name?.toLowerCase().includes(term)
        )
    );
  }, [absenteeSearch, trainingAbsentees]);

  const handleAbsenteeToggle = (applicantId: number, checked: boolean | "indeterminate") => {
    if (typeof checked !== 'boolean') return;
    setSelectedAbsentees(prev => {
        const newSet = new Set(prev);
        if (checked) {
            newSet.add(applicantId);
        } else {
            newSet.delete(applicantId);
        }
        return newSet;
    });
};

  const handleSubmitAttendance = async (present: boolean) => {
    setLoading(p => ({...p, saving: true}));
    try {
        const payload = {
            attended: present ? trainingAbsentees.filter(a => !selectedAbsentees.has(a.applicant_id)).map(a => a.applicant_id) : [],
            absent: present ? [] : Array.from(selectedAbsentees)
        };
        const res = await fetch("/api/training/attendance", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)});
        if(!res.ok) throw new Error("Failed to submit attendance.");
        toast({ title: "Attendance Submitted" });
        fetchProjectData();
        setSelectedAbsentees(new Set()); // Clear selection
    } catch (err:any) {
         toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
        setLoading(p => ({...p, saving: false}));
    }
  };

  const filteredCandidates = useMemo(() => {
      if (!qualifiedCandidatesSearch.trim()) return candidates;
      const searchTerms = qualifiedCandidatesSearch.split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
      if (searchTerms.length === 0) return candidates;
      return candidates.filter(app => 
          searchTerms.some(term => 
              String(app.applicant_id).toLowerCase().includes(term) || 
              app.applicant_name?.toLowerCase().includes(term)
          )
      );
  }, [qualifiedCandidatesSearch, candidates]);

  const filteredApplicantsForHallAssignment = useMemo(() => {
      if (!hallAssignmentSearch.trim()) return applicantsForHallAssignment;
      const searchTerms = hallAssignmentSearch.split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
      if (searchTerms.length === 0) return applicantsForHallAssignment;
      return applicantsForHallAssignment.filter(app => 
          searchTerms.some(term => 
              String(app.applicant_id).toLowerCase().includes(term) || 
              app.applicant_name?.toLowerCase().includes(term)
          )
      );
  }, [hallAssignmentSearch, applicantsForHallAssignment]);

  const handleSelectAllCandidates = (checked: boolean | 'indeterminate') => {
      if (typeof checked !== 'boolean') return;
      const newSelections = {...selections};
      if (checked) {
          filteredCandidates.forEach(c => {
              newSelections[c.applicant_id] = {
                  ...newSelections[c.applicant_id],
                  isSelected: true,
                  contractType: newSelections[c.applicant_id]?.contractType || 'مثقفة مجتمعية',
                  workingVillage: selectedVillage
              };
          });
      } else {
          filteredCandidates.forEach(c => {
              if(newSelections[c.applicant_id]) {
                  newSelections[c.applicant_id].isSelected = false;
              }
          });
      }
      setSelections(newSelections);
  };
  
  const handleSelectAllForHallAssignment = (checked: boolean | 'indeterminate') => {
      if (typeof checked !== 'boolean') return;
      const idsToChange = new Set(filteredApplicantsForHallAssignment.map(app => app.applicant_id));
      if (checked) {
          setSelectedApplicantsForHall(prev => new Set([...prev, ...idsToChange]));
      } else {
          setSelectedApplicantsForHall(prev => new Set([...prev].filter(id => !idsToChange.has(id))));
      }
  }

  const handleSelectAllAbsentees = (checked: boolean | 'indeterminate') => {
      if (typeof checked !== 'boolean') return;
      const idsToChange = new Set(filteredAbsentees.map(a => a.applicant_id));
      if (checked) {
          setSelectedAbsentees(prev => new Set([...prev, ...idsToChange]));
      } else {
          setSelectedAbsentees(prev => new Set([...prev].filter(id => !idsToChange.has(id))));
      }
  };


  return (
    <div className="space-y-8 pb-12">
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">1. Training Requirements Calculation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <Select onValueChange={setProjectId} value={projectId}><SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger><SelectContent>{projects.map(p => (<SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>))}</SelectContent></Select>
            {projectId && (
                <>
                <div className="rounded-md border">
                    <Table><TableHeader><TableRow><TableHead>Village Name</TableHead><TableHead>BNF_CNT</TableHead><TableHead>BNF Per ED</TableHead><TableHead>ED_REQ</TableHead><TableHead>ED_CNT</TableHead></TableRow></TableHeader></Table>
                    <ScrollArea className="h-[250px]"><Table><TableBody>
                        {loading.stats ? <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> : villageStatsWithEdReq.map((row, i) => (
                            <TableRow key={i}><TableCell>{row.villageName}</TableCell><TableCell>{row.bnfCount}</TableCell>
                            <TableCell><Input type="number" value={bnfPerEd[row.villageName] || ''} placeholder="0" onChange={e => setBnfPerEd(prev => ({ ...prev, [row.villageName]: +e.target.value }))} className="w-20 bg-background"/></TableCell>
                            <TableCell>{row.edReq}</TableCell><TableCell>{row.edCount}</TableCell></TableRow>
                        ))}
                    </TableBody></Table></ScrollArea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Required Educators</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalEdReq}</div></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Required Spare</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{finalSpareReq}</div></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Required Field Monitors</CardTitle></CardHeader><CardContent><Input type="number" className="h-8 w-24 bg-card text-white" value={manualMonitorsReq} onChange={(e) => setManualMonitorsReq(+e.target.value)} /></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Qualified</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{finalTotalQualified}</div></CardContent></Card>
                </div>
                </>
            )}
        </CardContent>
      </Card>
      
      {projectId && (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">2. Assign to Training Halls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2">
                        {halls.map((h, i) => (
                           <div key={i} className="flex items-center gap-2">
                                <Input placeholder="Hall Name" value={h.hallName} onChange={e => {const copy = [...halls]; copy[i].hallName = e.target.value; setHalls(copy);}} />
                                <Input type="number" placeholder="No." value={h.hallNumber} onChange={e => { const copy = [...halls]; copy[i].hallNumber = +e.target.value; setHalls(copy); }} className="w-20" />
                                <Button variant="destructive" size="icon" onClick={() => setHalls(halls.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" onClick={() => setHalls(prev => [...prev, { hallName: `Hall ${prev.length + 1}`, hallNumber: prev.length + 1 }])}><Plus className="mr-2 h-4 w-4" /> Add Hall</Button>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search applicants..."
                            value={hallAssignmentSearch}
                            onChange={e => setHallAssignmentSearch(e.target.value)}
                            className="pl-10 mb-2"
                        />
                    </div>
                    <ScrollArea className="h-72 border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Checkbox
                                            className='bg-primary'
                                            checked={filteredApplicantsForHallAssignment.length > 0 && filteredApplicantsForHallAssignment.every(app => selectedApplicantsForHall.has(app.applicant_id))}
                                            onCheckedChange={handleSelectAllForHallAssignment}
                                        />
                                    </TableHead>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead>Rank</TableHead>
                                </TableRow>
                            </TableHeader>
                        <TableBody>
                            {filteredApplicantsForHallAssignment.map(app => (
                                <TableRow key={app.applicant_id}><TableCell>
                                    <Checkbox checked={selectedApplicantsForHall.has(app.applicant_id)} onCheckedChange={c => setSelectedApplicantsForHall(p => { const s=new Set(p); if(c) s.add(app.applicant_id); else s.delete(app.applicant_id); return s;})}/>
                                </TableCell><TableCell>{app.applicant_id}</TableCell><TableCell>{app.applicant_name}</TableCell><TableCell>{app.loc_name}</TableCell><TableCell>{app.grand_total_score}</TableCell><TableCell>{app.grand_score_rank}</TableCell></TableRow>
                            ))}
                        </TableBody></Table>
                    </ScrollArea>
                    <div className="flex items-center gap-4">
                        <Select onValueChange={v => setSelectedHall(v ? +v : null)}><SelectTrigger className="flex-1"><SelectValue placeholder="Select hall..." /></SelectTrigger><SelectContent>{halls.map(h=>(<SelectItem key={h.hallNumber} value={String(h.hallNumber)}>{h.hallName}</SelectItem>))}</SelectContent></Select>
                        <Button onClick={handleLinkToHall} disabled={loading.saving}>Link {selectedApplicantsForHall.size} to Hall</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">3. Mark Training Attendance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by ID or name (comma-separated)..." value={absenteeSearch} onChange={e=>setAbsenteeSearch(e.target.value)} className="pl-10 mb-2" />
                    </div>
                    <ScrollArea className="h-72 border rounded-md">
                        <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    <Checkbox 
                                        className='bg-primary'
                                        checked={filteredAbsentees.length > 0 && filteredAbsentees.every(app => selectedAbsentees.has(app.applicant_id))}
                                        onCheckedChange={handleSelectAllAbsentees}
                                    />
                                </TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Hall</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAbsentees.map(app => (
                                <TableRow key={app.applicant_id}>
                                    <TableCell>
                                        <Checkbox 
                                            checked={selectedAbsentees.has(app.applicant_id)} 
                                            onCheckedChange={(checked) => handleAbsenteeToggle(app.applicant_id, checked)}
                                        />
                                    </TableCell>
                                    <TableCell>{app.applicant_id}</TableCell>
                                    <TableCell>{app.applicant_name}</TableCell>
                                    <TableCell>{app.training_hall_name}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </ScrollArea>
                    <div className='flex gap-2'>
                        <Button onClick={() => handleSubmitAttendance(false)} disabled={loading.saving || selectedAbsentees.size === 0}>Mark Selected as Absent</Button>
                        <Button onClick={() => handleSubmitAttendance(true)} disabled={loading.saving}>Mark Unselected as Attended</Button>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">4. Select Qualified Educators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SummaryCard icon={<Users />} title="Community Educators" value={`${selectedContractTypes['مثقفة مجتمعية']} / ${totalEdReq}`} />
                        <SummaryCard icon={<Briefcase />} title="Field Monitors" value={`${selectedContractTypes['رقابة']} / ${manualMonitorsReq}`} />
                        <SummaryCard icon={<User />} title="Spare" value={`${selectedContractTypes['احتياط']} / ${finalSpareReq}`} />
                    </div>

                    <div className="bg-muted p-4 rounded-lg border">
                        <Select onValueChange={setSelectedVillage} value={selectedVillage}><SelectTrigger className="w-full md:w-1/3"><SelectValue placeholder="Choose Village..." /></SelectTrigger>
                        <SelectContent>{sortedVillages.map((v) => (<SelectItem key={v.villageName} value={v.villageName}>{v.villageName} (Avail: {v.edCount})</SelectItem>))}</SelectContent></Select>
                    </div>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search candidates..."
                            value={qualifiedCandidatesSearch}
                            onChange={e => setQualifiedCandidatesSearch(e.target.value)}
                            className="pl-10 mb-2"
                        />
                    </div>
                    <div className="border rounded-md"><Table><TableHeader><TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox
                                className='bg-primary'
                                checked={filteredCandidates.length > 0 && filteredCandidates.every(c => selections[c.applicant_id]?.isSelected)}
                                onCheckedChange={handleSelectAllCandidates}
                            />
                        </TableHead>
                        <TableHead>ID <ColumnFilter column="applicant_id" onSort={setSortConfig} /></TableHead>
                        <TableHead>Applicant Name <ColumnFilter column="applicant_name" onSort={setSortConfig} /></TableHead>
                        <TableHead>Qualification <ColumnFilter column="applicant_qualification" onSort={setSortConfig} /></TableHead>
                        <TableHead>Age Rank <ColumnFilter column="age_per_village_ranking" onSort={setSortConfig} /></TableHead>
                        <TableHead>Location <ColumnFilter column="loc_name" onSort={setSortConfig} /></TableHead>
                        <TableHead>Total Score <ColumnFilter column="grand_total_score" onSort={setSortConfig} /></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {loading.candidates ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> : filteredCandidates.map((c, idx) => (
                            <TableRow key={c.applicant_id} onClick={() => setActiveCandidateIndex(idx)} className={activeCandidateIndex === idx ? "bg-muted" : ""}>
                                <TableCell>
                                    <Checkbox 
                                        checked={selections[c.applicant_id]?.isSelected || false} 
                                        onCheckedChange={(checked) => {
                                            setSelections(prev => ({
                                                ...prev,
                                                [c.applicant_id]: {
                                                    ...prev[c.applicant_id],
                                                    isSelected: !!checked,
                                                    contractType: prev[c.applicant_id]?.contractType || 'مثقفة مجتمعية',
                                                    workingVillage: selectedVillage,
                                                }
                                            }));
                                        }}
                                    />
                                </TableCell>
                                <TableCell>{c.applicant_id}</TableCell><TableCell>{c.applicant_name}</TableCell><TableCell>{c.applicant_qualification}</TableCell><TableCell>{c.age_per_village_ranking}</TableCell><TableCell>{c.loc_name}</TableCell><TableCell>{c.grand_total_score}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody></Table></div>

                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => handleContractTypeSelect('مثقفة مجتمعية')}><Users className="mr-2 h-4 w-4"/>Community Educator</Button>
                            <Button variant="outline" onClick={() => handleContractTypeSelect('احتياط')}><User className="mr-2 h-4 w-4"/>Spare</Button>
                            <Button variant="outline" onClick={() => handleContractTypeSelect('رقابة')}><Briefcase className="mr-2 h-4 w-4"/>Field Monitor</Button>
                        </div>
                        <Button onClick={handleSaveSelections} disabled={loading.saving}><Save className="mr-2 h-4 w-4"/>Save Selections</Button>
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
    )
}
