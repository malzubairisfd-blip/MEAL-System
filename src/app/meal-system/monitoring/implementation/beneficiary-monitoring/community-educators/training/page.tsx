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
import { Loader2, FileText, UserCheck, User, Users, Briefcase, Filter, ArrowUpAZ, ArrowDownAZ, Save, Trash2, Plus, ArrowLeft, Search, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  applcants_relationship?: string;
  [key: string]: any;
};

type SelectionState = {
  isSelected: boolean;
  contractType: 'مثقفة مجتمعية' | 'رقابة' | 'احتياط';
  workingVillage: string;
  bnfConn?: number;
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

const SummaryCard = ({ title, value, total }: { title: string, value: string | number, total?: string | number }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}{total !== undefined && <span className="text-lg text-muted-foreground">/{total}</span>}</div>
      </CardContent>
    </Card>
);

const KPICard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
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
  
  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedHall, setSelectedHall] = useState<number | null>(null);
  const [selectedApplicantsForHall, setSelectedApplicantsForHall] = useState<Set<number>>(new Set());
  
  const [trainingAbsentees, setTrainingAbsentees] = useState<any[]>([]);
  const [selectedAbsentees, setSelectedAbsentees] = useState<Set<number>>(new Set());
  const [absenteeSearch, setAbsenteeSearch] = useState('');
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'grand_score_rank', direction: 'asc' });
  const [qualifiedCandidatesSearch, setQualifiedCandidatesSearch] = useState('');
  const [hallAssignmentSearch, setHallAssignmentSearch] = useState('');
  const [currentlySelectedApplicantId, setCurrentlySelectedApplicantId] = useState<number | null>(null);
  const [relatedCounts, setRelatedCounts] = useState<{ same: number, different: number }>({ same: 0, different: 0 });


  // --- Initial Project Load ---
  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(data => setProjects(Array.isArray(data) ? data : []));
  }, []);

  const getLocalStorageKey = useCallback((type: string) => `training-selections-${type}-${projectId}`, [projectId]);

  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;

    setLoading(prev => ({ ...prev, stats: true, candidates: true }));
    setSelections({}); // Reset selections when project changes
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
  }, [projectId, toast]);
  
  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);
  
  useEffect(() => {
    if (!projectId) return;
    
    const savedHallSelections = localStorage.getItem(getLocalStorageKey('hall'));
    setSelectedApplicantsForHall(savedHallSelections ? new Set(JSON.parse(savedHallSelections)) : new Set());

    const savedAbsenteeSelections = localStorage.getItem(getLocalStorageKey('absentee'));
    setSelectedAbsentees(savedAbsenteeSelections ? new Set(JSON.parse(savedAbsenteeSelections)) : new Set());
    
    const savedBnfPerEd = localStorage.getItem(`training-bnf-per-ed-${projectId}`);
    if (savedBnfPerEd) {
        setBnfPerEd(JSON.parse(savedBnfPerEd));
    } else {
        setBnfPerEd({});
    }
  }, [projectId, getLocalStorageKey]);

  useEffect(() => {
    if (projectId) localStorage.setItem(getLocalStorageKey('hall'), JSON.stringify(Array.from(selectedApplicantsForHall)));
  }, [selectedApplicantsForHall, projectId, getLocalStorageKey]);

  useEffect(() => {
    if (projectId) localStorage.setItem(getLocalStorageKey('absentee'), JSON.stringify(Array.from(selectedAbsentees)));
  }, [selectedAbsentees, projectId, getLocalStorageKey]);
  
  useEffect(() => {
    if (projectId && Object.keys(bnfPerEd).length > 0) {
        localStorage.setItem(`training-bnf-per-ed-${projectId}`, JSON.stringify(bnfPerEd));
    }
  }, [bnfPerEd, projectId]);

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

    const totalProjectBnf = useMemo(() => {
        return villageStatsWithEdReq.reduce((sum, v) => sum + v.bnfCount, 0);
    }, [villageStatsWithEdReq]);

    const totalBnfConnected = useMemo(() => {
        return Object.values(selections).reduce((sum, s) => sum + (s.bnfConn || 0), 0);
    }, [selections]);
  
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


  useEffect(() => {
    if (!selectedVillage) {
        setCandidates([]);
        return;
    }

    const qualifiedAndAttended = allProjectEducators.filter(e => 
      e.interview_attendance === 'حضرت المقابلة' && 
      (e.training_qualification === 'مؤهلة للتدريب' || e.training_qualification === null)
    );

    const villageStat = villageStatsWithEdReq.find(v => v.villageName === selectedVillage);
    const requiredForVillage = villageStat?.edReq || 0;
    const assignedToVillage = Object.values(selections).filter(
        s => s.isSelected && s.workingVillage === selectedVillage && s.contractType === 'مثقفة مجتمعية'
    ).length;

    const needsMoreForVillage = assignedToVillage < requiredForVillage;

    const unassignedLocalCandidates = qualifiedAndAttended.filter(
        edu => edu.loc_name === selectedVillage && !selections[edu.applicant_id]?.isSelected
    );

    let finalCandidates: EducatorCandidate[];

    if (needsMoreForVillage && unassignedLocalCandidates.length === 0) {
        finalCandidates = qualifiedAndAttended.filter(edu => !selections[edu.applicant_id]?.isSelected);
        setValidationMessage("No more local candidates. Showing all available educators from other villages to fill the gap.");
    } else {
        finalCandidates = qualifiedAndAttended.filter(edu => edu.loc_name === selectedVillage);
        setValidationMessage('');
    }

    let sorted = [...finalCandidates];
    if (sortConfig) {
        sorted.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            const strA = String(aVal).toLowerCase();
            const strB = String(bVal).toLowerCase();

            if (strA < strB) {
              return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (strA > strB) {
              return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    setCandidates(sorted);
  }, [selectedVillage, allProjectEducators, villageStatsWithEdReq, selections, sortConfig]);

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

  useEffect(() => {
    if (loading.candidates || filteredCandidates.length === 0) {
        setCurrentlySelectedApplicantId(null);
        return;
    }
    const firstUnassigned = filteredCandidates.find(c => !selections[c.applicant_id]?.isSelected);
    setCurrentlySelectedApplicantId(firstUnassigned ? firstUnassigned.applicant_id : null);
}, [filteredCandidates, selections, loading.candidates]);

  const handleLinkToHall = async () => {
      if (!selectedHall || selectedApplicantsForHall.size === 0) return toast({ title: "Incomplete", description: "Select a hall and applicants."});
      
      const hall = halls.find(h => h.hallNumber === selectedHall);
      if(!hall) return;

      setLoading(p => ({...p, saving: true}));
      try {
          const res = await fetch("/api/trainings/link", {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ projectId, hallNumber: hall.hallNumber, hallName: hall.hallName, applicantIds: Array.from(selectedApplicantsForHall) })
          });
          if(!res.ok) throw new Error("Failed to link applicants.");

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
    return allProjectEducators.filter(e => e.interview_attendance === 'حضرت المقابلة' && e.training_qualification === null && e.training_hall_name === null);
  }, [allProjectEducators]);

  useEffect(() => {
    const qualifiedForTraining = allProjectEducators.filter(e => e.training_qualification === 'مؤهلة للتدريب' && e.training_attendance === null);
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

    const selectedApplicantForDisplay = useMemo(() => {
        if (!currentlySelectedApplicantId) return null;
        return allProjectEducators.find(c => c.applicant_id === currentlySelectedApplicantId);
    }, [currentlySelectedApplicantId, allProjectEducators]);

    useEffect(() => {
        if (selectedApplicantForDisplay?.applcants_relationship) {
            const msg = selectedApplicantForDisplay.applcants_relationship;
            const loc = selectedApplicantForDisplay.loc_name;
            const chosenIds = Object.keys(selections).filter(id => selections[Number(id)].isSelected);

            const relatedChosen = allProjectEducators.filter(edu =>
                chosenIds.includes(String(edu.applicant_id)) && edu.applcants_relationship === msg
            );

            const same = relatedChosen.filter(edu => edu.loc_name === loc).length;
            const different = relatedChosen.filter(edu => edu.loc_name !== loc).length;

            setRelatedCounts({ same, different });
        } else {
            setRelatedCounts({ same: 0, different: 0 });
        }
    }, [selectedApplicantForDisplay, selections, allProjectEducators]);

    const chosenEducators = useMemo(() => Object.values(selections).filter(s => s.isSelected && s.contractType === 'مثقفة مجتمعية').length, [selections]);
    const chosenMonitors = useMemo(() => Object.values(selections).filter(s => s.isSelected && s.contractType === 'رقابة').length, [selections]);
    const chosenSpares = useMemo(() => Object.values(selections).filter(s => s.isSelected && s.contractType === 'احتياط').length, [selections]);

    const assignedInVillage = useMemo(() => Object.values(selections).filter(s => s.isSelected && s.workingVillage === selectedVillage && s.contractType === 'مثقفة مجتمعية'), [selections, selectedVillage]);
    const totalBnfConnectedInVillage = useMemo(() => assignedInVillage.reduce((sum, s) => sum + (s.bnfConn || 0), 0), [assignedInVillage]);
    const totalBnfForVillage = useMemo(() => villageStatsWithEdReq.find(v => v.villageName === selectedVillage)?.bnfCount || 0, [villageStatsWithEdReq, selectedVillage]);
    
    const currentApplicantBnfConn = useMemo(() => {
        if (!selectedVillage) return 0;
        const villageStat = villageStatsWithEdReq.find(v => v.villageName === selectedVillage);
        if (!villageStat) return 0;

        const bnfPerEdValue = bnfPerEd[selectedVillage] || 0;
        if (bnfPerEdValue === 0) return 0;
        
        const remainingBnf = villageStat.bnfCount - totalBnfConnectedInVillage;
        return Math.max(0, Math.min(remainingBnf, bnfPerEdValue));

    }, [selectedVillage, villageStatsWithEdReq, bnfPerEd, totalBnfConnectedInVillage]);

  const handleAssignContractType = useCallback(async (type: SelectionState['contractType']) => {
    if (!currentlySelectedApplicantId || !selectedVillage) {
      toast({ title: "No applicant selected", variant: "destructive" });
      return;
    }
    setLoading(p => ({ ...p, saving: true }));

    const bnfToAssign = currentApplicantBnfConn;

    const applicantToUpdate = {
      applicant_id: currentlySelectedApplicantId,
      contract_type: type,
      working_village: selectedVillage,
      ed_bnf_cnt: type === 'مثقفة مجتمعية' ? bnfToAssign : 0
    };
    
    try {
      const res = await fetch("/api/ed-selection", { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([applicantToUpdate]) });
      if (!res.ok) {
        throw new Error('Failed to save selection.');
      }
      setSelections(prev => ({ ...prev, [currentlySelectedApplicantId]: { isSelected: true, contractType: type, workingVillage: selectedVillage, bnfConn: type === 'مثقفة مجتمعية' ? bnfToAssign : 0 } }));
      toast({ title: "Saved", description: `Assigned ${type} to applicant ${currentlySelectedApplicantId}.` });
      
      const villageStat = villageStatsWithEdReq.find(v => v.villageName === selectedVillage);
      const chosenCount = assignedInVillage.length + 1;
      
      if (villageStat && chosenCount >= villageStat.edReq) {
        const currentVillageIndex = sortedVillages.findIndex(v => v.villageName === selectedVillage);
        if (currentVillageIndex < sortedVillages.length - 1) {
          const nextVillage = sortedVillages[currentVillageIndex + 1];
          setSelectedVillage(nextVillage.villageName);
        } else {
          toast({ title: "All villages complete!" });
          setCurrentlySelectedApplicantId(null);
        }
      } else {
        const currentIndex = filteredCandidates.findIndex(c => c.applicant_id === currentlySelectedApplicantId);
        let nextUnassigned = null;
        for (let i = currentIndex + 1; i < filteredCandidates.length; i++) {
          if (!selections[filteredCandidates[i].applicant_id]?.isSelected) {
            nextUnassigned = filteredCandidates[i];
            break;
          }
        }
        setCurrentlySelectedApplicantId(nextUnassigned ? nextUnassigned.applicant_id : null);
      }
    } catch (err: any) {
      toast({ title: "Save Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(p => ({ ...p, saving: false }));
    }
  }, [currentlySelectedApplicantId, selectedVillage, toast, filteredCandidates, selections, villageStatsWithEdReq, sortedVillages, assignedInVillage.length, currentApplicantBnfConn]);

  const handleSkip = useCallback(() => {
    if (!currentlySelectedApplicantId) return;

    const currentIndex = filteredCandidates.findIndex(c => c.applicant_id === currentlySelectedApplicantId);
    
    let nextUnassignedIndex = -1;
    for (let i = currentIndex + 1; i < filteredCandidates.length; i++) {
        if (!selections[filteredCandidates[i].applicant_id]?.isSelected) {
            nextUnassignedIndex = i;
            break;
        }
    }

    if (nextUnassignedIndex !== -1) {
        setCurrentlySelectedApplicantId(filteredCandidates[nextUnassignedIndex].applicant_id);
    } else {
        toast({ title: "End of Village List", description: "No more unassigned candidates in this village." });
        setCurrentlySelectedApplicantId(null);
    }
  }, [currentlySelectedApplicantId, filteredCandidates, selections, toast]);

  const selectedVillageStats = useMemo(() => {
    if (!selectedVillage || !villageStatsWithEdReq) return { required: 0, available: 0 };
    const village = villageStatsWithEdReq.find(v => v.villageName === selectedVillage);
    return {
      required: village?.edReq || 0,
      available: allProjectEducators.filter(e => e.loc_name === selectedVillage && e.training_attendance === 'حضرت التدريب').length || 0,
    };
  }, [selectedVillage, villageStatsWithEdReq, allProjectEducators]);

    const chosenInVillage = useMemo(() => {
        return Object.values(selections).filter(
            (s) =>
                s.isSelected &&
                s.workingVillage === selectedVillage &&
                s.contractType === 'مثقفة مجتمعية'
        ).length;
    }, [selections, selectedVillage]);


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
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4">
                    <SummaryCard title="Required Educators" value={totalEdReq} />
                    <SummaryCard title="Required Spare" value={finalSpareReq} />
                    <SummaryCard title="Required Field Monitors" value={<Input type="number" className="h-8 w-24 bg-card text-white" value={manualMonitorsReq} onChange={(e) => setManualMonitorsReq(+e.target.value)} />} />
                    <SummaryCard title="Total Qualified" value={finalTotalQualified} />
                    <SummaryCard title="Available Applicants" value={totalAvailableApplicants} />
                    <SummaryCard title="Beneficiaries Connected" value={totalBnfConnected.toLocaleString()} total={totalProjectBnf.toLocaleString()} />
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
                    <div className="bg-muted p-4 rounded-lg border">
                        <Select onValueChange={setSelectedVillage} value={selectedVillage}><SelectTrigger className="w-full md:w-1/3"><SelectValue placeholder="Choose Village..." /></SelectTrigger>
                        <SelectContent>{sortedVillages.map((v) => (<SelectItem key={v.villageName} value={v.villageName}>{v.villageName} (Avail: {v.edCount} / Req: {v.edReq})</SelectItem>))}</SelectContent></Select>
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
                        <TableHead>ID <ColumnFilter column="applicant_id" onSort={setSortConfig} /></TableHead>
                        <TableHead>Applicant Name <ColumnFilter column="applicant_name" onSort={setSortConfig} /></TableHead>
                        <TableHead>Qualification <ColumnFilter column="applicant_qualification" onSort={setSortConfig} /></TableHead>
                        <TableHead>Age Rank <ColumnFilter column="age_per_village_ranking" onSort={setSortConfig} /></TableHead>
                        <TableHead>Location <ColumnFilter column="loc_name" onSort={setSortConfig} /></TableHead>
                        <TableHead>Total Score <ColumnFilter column="grand_total_score" onSort={setSortConfig} /></TableHead>
                        <TableHead>Rank <ColumnFilter column="grand_score_rank" onSort={setSortConfig} /></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {loading.candidates ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> : filteredCandidates.map((c) => (
                            <TableRow key={c.applicant_id} className={cn(currentlySelectedApplicantId === c.applicant_id && "bg-blue-100 dark:bg-blue-900/30", selections[c.applicant_id]?.isSelected && "bg-green-100 dark:bg-green-900/30")}>
                                <TableCell>{c.applicant_id}</TableCell><TableCell>{c.applicant_name}</TableCell><TableCell>{c.applicant_qualification}</TableCell><TableCell>{c.age_per_village_ranking}</TableCell><TableCell>{c.loc_name}</TableCell><TableCell>{c.grand_total_score}</TableCell><TableCell>{c.grand_score_rank}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody></Table></div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <SummaryCard title="Available in Village" value={selectedVillageStats.available} />
                <SummaryCard title="Required Educators" value={selectedVillageStats.required} />
                <SummaryCard title="Chosen Educators" value={chosenInVillage} total={selectedVillageStats.required} />
                <SummaryCard title="Field Monitors" value={chosenMonitors} total={manualMonitorsReq} />
                <SummaryCard title="Chosen Spares" value={chosenSpares} total={finalSpareReq} />
                <SummaryCard title="Beneficiaries Connected" value={totalBnfConnectedInVillage.toLocaleString()} total={totalBnfForVillage.toLocaleString()} />
            </div>

            {selectedVillage && (
                <Card>
                    <CardHeader>
                        <CardTitle>Selection Summary & Actions for: {selectedVillage}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <h4 className="font-semibold text-lg mb-2">Applicant Details</h4>
                        <div className="border rounded-md">
                            <Table>
                               <TableHeader><TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Original Village</TableHead>
                                <TableHead>Qualification</TableHead>
                                <TableHead>Working Village</TableHead>
                                <TableHead>BNF_CONN</TableHead>
                               </TableRow></TableHeader>
                                <TableBody>
                                    {selectedApplicantForDisplay ? (
                                        <TableRow>
                                            <TableCell>{selectedApplicantForDisplay.applicant_id}</TableCell>
                                            <TableCell>{selectedApplicantForDisplay.applicant_name}</TableCell>
                                            <TableCell>{selectedApplicantForDisplay.loc_name}</TableCell>
                                            <TableCell>{selectedApplicantForDisplay.applicant_qualification}</TableCell>
                                            <TableCell>{selectedVillage}</TableCell>
                                            <TableCell>{currentApplicantBnfConn}</TableCell>
                                        </TableRow>
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center">No applicant selected for assignment.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {selectedApplicantForDisplay?.applcants_relationship && (
                            <Card className="mt-4 bg-yellow-50 border-yellow-200">
                                <CardHeader className="py-2">
                                    <CardTitle className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Applicant Relationship Note
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                                     <p className="text-yellow-900 md:col-span-1">{selectedApplicantForDisplay.applcants_relationship}</p>
                                     {(relatedCounts.same > 0 || relatedCounts.different > 0) && (
                                        <>
                                            <KPICard title="Related Chosen (Same Village)" value={relatedCounts.same} icon={<Users className="text-yellow-800"/>} />
                                            <KPICard title="Related Chosen (Different Village)" value={relatedCounts.different} icon={<Users className="text-yellow-800"/>} />
                                        </>
                                     )}
                                </CardContent>
                            </Card>
                        )}
                        <div className="flex justify-start items-center mt-4 gap-2">
                            <Button variant="outline" onClick={() => handleAssignContractType('مثقفة مجتمعية')} disabled={loading.saving || !currentlySelectedApplicantId || currentApplicantBnfConn <= 0}><Users className="mr-2 h-4 w-4"/>Assign as Community Educator</Button>
                            <Button variant="outline" onClick={() => handleAssignContractType('احتياط')} disabled={loading.saving || !currentlySelectedApplicantId || chosenSpares >= finalSpareReq}><User className="mr-2 h-4 w-4"/>Assign as Spare</Button>
                            <Button variant="outline" onClick={() => handleAssignContractType('رقابة')} disabled={loading.saving || !currentlySelectedApplicantId || chosenMonitors >= manualMonitorsReq}><Briefcase className="mr-2 h-4 w-4"/>Assign as Field Monitor</Button>
                            <Button variant="secondary" onClick={handleSkip}><ChevronRight className="mr-2 h-4 w-4" />Skip</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
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
