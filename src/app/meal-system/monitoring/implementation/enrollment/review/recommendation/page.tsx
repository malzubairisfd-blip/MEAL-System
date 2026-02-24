// src/app/meal-system/monitoring/implementation/enrollment/review/recommendation/page.tsx
"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, ThumbsUp, ThumbsDown, Hand, Check, X, Eye } from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// --- Helper Functions & Components ---

const CharacterDiff = ({ oldStr, newStr }: { oldStr: string; newStr: string }) => {
  if (!oldStr && !newStr) return null;
  oldStr = oldStr || '';
  newStr = newStr || '';

  const oldChars = oldStr.split('');
  const newChars = newStr.split('');
  let i = 0, j = 0;
  const result: React.ReactNode[] = [];
  
  // This is a simplified diff, a more advanced one would be too slow for UI
  while (i < oldChars.length || j < newChars.length) {
    if (i < oldChars.length && j < newChars.length && oldChars[i] === newChars[j]) {
      result.push(<span key={`same-${i}`}>{oldChars[i]}</span>);
      i++; j++;
    } else {
      if (j < newChars.length) {
        result.push(<span key={`add-${j}`} className="text-red-500 bg-red-100 dark:bg-red-900/50">{newChars[j]}</span>);
        j++;
      } else if (i < oldChars.length) {
         // To show removed characters, you would add a similar span here.
         // For this use case, we only highlight additions/changes in the new name.
         i++;
      }
    }
  }
  return <>{result}</>;
};

const DecisionButton = ({ icon: Icon, label, onClick, isActive, disabled }: { icon: React.ElementType, label: string, onClick: () => void, isActive?: boolean, disabled?: boolean }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isActive ? "default" : "outline"}
            size="icon"
            onClick={onClick}
            disabled={disabled}
            className={cn("flex-1", isActive && "bg-primary text-primary-foreground")}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>{label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
);

// --- Main Page Component ---
export default function RecommendationPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [allRecords, setAllRecords] = useState<any[]>([]);
    const [groupedRecords, setGroupedRecords] = useState<any[][]>([]);
    const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [decisionState, setDecisionState] = useState<{ bnf?: string; hsbnd?: string }>({});
    const [currentStep, setCurrentStep] = useState<'bnf' | 'hsbnd' | 'done'>('bnf');
    const [loading, setLoading] = useState({ projects: true, data: false });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetch('/api/projects').then(res => res.json()).then(data => setProjects(data)).finally(() => setLoading(p => ({ ...p, projects: false })));
    }, []);

    const fetchAndGroupData = useCallback(async (projectId: string) => {
        setLoading(p => ({...p, data: true}));
        try {
            const res = await fetch(`/api/enrollment-review?projectId=${projectId}`);
            if (!res.ok) throw new Error("Failed to load enrollment data.");
            const data = await res.json();
            setAllRecords(data);

            // Optimized single-pass grouping
            const groups: { group1: any[]; group2: any[]; group3: any[]; similarityGroup: any[]; } = {
                group1: [], group2: [], group3: [], similarityGroup: []
            };

            data.forEach((r: any) => {
                const hasNewBnf = r.new_bnf_name;
                const hasNewHsbnd = r.new_hsbnd_name;
                const hasClusterId = r.enroll_cluster_id;

                if (hasNewBnf && hasNewHsbnd) {
                    groups.group1.push(r);
                } else if (hasNewBnf && !hasNewHsbnd) {
                    groups.group2.push(r);
                } else if (!hasNewBnf && hasNewHsbnd) {
                    groups.group3.push(r);
                } else if (hasClusterId) {
                    groups.similarityGroup.push(r);
                }
            });

            const finalGroups = [groups.group1, groups.group2, groups.group3, groups.similarityGroup].filter(g => g.length > 0);
            setGroupedRecords(finalGroups);

            // Reset state for the new data
            setCurrentGroupIndex(0);
            setCurrentItemIndex(0);
            setDecisionState({});
            setCurrentStep('bnf');
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(p => ({ ...p, data: false }));
        }
    }, [toast]);
    
    useEffect(() => {
        if(selectedProjectId) {
            fetchAndGroupData(selectedProjectId);
        }
    }, [selectedProjectId, fetchAndGroupData]);

    const currentRecord = useMemo(() => {
        return groupedRecords[currentGroupIndex]?.[currentItemIndex];
    }, [groupedRecords, currentGroupIndex, currentItemIndex]);
    
    const moveToNext = useCallback(() => {
        setDecisionState({});
        setCurrentStep('bnf');
        
        const currentGroup = groupedRecords[currentGroupIndex];
        if (!currentGroup) {
            toast({ title: "Review Complete", description: "All records have been reviewed." });
            return;
        }

        if (currentItemIndex < currentGroup.length - 1) {
            setCurrentItemIndex(i => i + 1);
        } else if (currentGroupIndex < groupedRecords.length - 1) {
            setCurrentGroupIndex(i => i + 1);
            setCurrentItemIndex(0);
        } else {
            toast({ title: "Review Complete", description: "All records have been reviewed." });
        }
    }, [currentItemIndex, currentGroupIndex, groupedRecords, toast]);

    const handleDecision = useCallback((part: 'bnf' | 'hsbnd', decision: string) => {
        const newDecisionState = { ...decisionState, [part]: decision };
        setDecisionState(newDecisionState);
        
        const hasBnfChange = !!currentRecord.new_bnf_name;
        const hasHsbndChange = !!currentRecord.new_hsbnd_name;

        // If it's a combined change and we just decided on bnf, move to husband
        if (part === 'bnf' && hasBnfChange && hasHsbndChange) {
            setCurrentStep('hsbnd');
            return; // Wait for the second decision
        }

        // --- All decisions are made, finalize the recommendation text ---
        let recommendation = '';
        if (hasBnfChange && hasHsbndChange) {
            const bnfD = newDecisionState.bnf;
            const hsbndD = newDecisionState.hsbnd;
            if (bnfD === 'approve' && hsbndD === 'approve') recommendation = 'يعتمد تصحيح اسم المستفيدة والزوج.';
            else if (bnfD === 'reject' && hsbndD === 'approve') recommendation = 'يبقى اسم المستفيدة كما هو في بيانات المسح ويعتمد التصحيح في اسم الزوج.';
            else if (bnfD === 'suspend' && hsbndD === 'approve') recommendation = 'تعلق الحاله للتحقق تعيير اسم المستفيدة ويعتمد التصحيح في اسم الزوج.';
            else if (bnfD === 'approve' && hsbndD === 'reject') recommendation = 'يعتمد التصحيح في اسم المستفيدة ويبقى اسم الزوج كما هو في بيانات المسح.';
            else if (bnfD === 'approve' && hsbndD === 'suspend') recommendation = 'يعتمد تصحيح اسم المستفيدة وتعلق الحاله للتحقق بسبب تغير ايم الزوج.';
            else if (bnfD === 'reject' && hsbndD === 'reject') recommendation = 'يبقى اسم المستفيدة والزوج كما هو في بيانات المسح.';
            else if (bnfD === 'suspend' && hsbndD === 'suspend') recommendation = 'تعلق الحاله للتحقق بسبب تغير اسم المستفيدة والزوج.';
            else if (bnfD === 'reject' && hsbndD === 'suspend') recommendation = 'يبقى اسم المستفيدة كما هو وتعلق الحالة للتحقق بسبب تغير اسم الزوج';
            else if (bnfD === 'suspend' && hsbndD === 'reject') recommendation = 'تعلق الحالة للتحقق بسبب تغير اسم المستفيدة ويبقى اسم الزوج كما هو';
        } else if (hasBnfChange) {
            if (newDecisionState.bnf === 'approve') recommendation = 'يعتمد تصحيح اسم المستفيدة.';
            else if (newDecisionState.bnf === 'reject') recommendation = 'يبقى الاسم كما هو في بيانات المسح.';
            else if (newDecisionState.bnf === 'suspend') recommendation = 'تعلق الحاله للتحقق من تغير اسم المستفيدة.';
        } else if (hasHsbndChange) {
            if (newDecisionState.hsbnd === 'approve') recommendation = 'يعتمد تصحيح اسم الزوج.';
            else if (newDecisionState.hsbnd === 'reject') recommendation = 'يبقى الاسم كما هو في بيانات المسح.';
            else if (newDecisionState.hsbnd === 'suspend') recommendation = 'تعلق الحاله للتحقق من تغير اسم الزوج.';
        }

        if (currentRecord.enroll_cluster_id && newDecisionState[part] === 'suspend') {
            recommendation = 'تعلق الحاله للتحقق كون تغيير متشابه مع مستفيدة أخرى';
        }

        // Save and move to next
        setIsSaving(true);
        fetch('/api/enrollment-review', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordId: currentRecord.id, updates: { branch_recommendation: recommendation }})
        }).then(res => {
            if(!res.ok) throw new Error("Failed to save recommendation.");
            toast({ title: "Saved", description: `Recommendation for ${currentRecord.bnf_name} saved.` });
            
            // Optimistically update local state before moving to next
            setAllRecords(prev => prev.map(r => r.id === currentRecord.id ? {...r, branch_recommendation: recommendation } : r));

            moveToNext();
        }).catch(err => {
            toast({ title: "Save Error", description: err.message, variant: 'destructive' });
        }).finally(() => setIsSaving(false));

    }, [decisionState, currentRecord, moveToNext, toast]);

    const isSimilarityCase = !!currentRecord?.enroll_cluster_id;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Recommendation Page</h1>
                <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/enrollment/review"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Review Hub</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select Project</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {loading.data ? <div className="text-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : 
            currentRecord ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="border border-gray-800 bg-gray-800 rounded-[1rem] p-1">
                            <div className="bg-background rounded-[1rem] overflow-hidden">
                                <div className="p-3 border-b text-center"><h3 className="font-bold">Review Name Correction</h3></div>
                                <div className="p-4 space-y-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[40%]">Name (Old/New)</TableHead>
                                                <TableHead>Difference Score</TableHead>
                                                <TableHead>Difference Level</TableHead>
                                                <TableHead>Similarity Score</TableHead>
                                                <TableHead>Cluster ID</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentRecord.new_bnf_name && (
                                                <TableRow className={currentStep === 'bnf' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}>
                                                    <TableCell>
                                                        <div className="font-mono text-xs text-muted-foreground">{currentRecord.bnf_name}</div>
                                                        <div className="font-semibold"><CharacterDiff oldStr={currentRecord.bnf_name || ''} newStr={currentRecord.new_bnf_name || ''} /></div>
                                                    </TableCell>
                                                    <TableCell>{currentRecord.diff_per_bnf?.toFixed(2)}</TableCell>
                                                    <TableCell>{currentRecord.diff_level_bnf}</TableCell>
                                                    <TableCell>{currentRecord.enroll_bnf_sim_score?.toFixed(2)}</TableCell>
                                                    <TableCell>{currentRecord.enroll_cluster_id}</TableCell>
                                                </TableRow>
                                            )}
                                             {currentRecord.new_hsbnd_name && (
                                                <TableRow className={currentStep === 'hsbnd' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}>
                                                    <TableCell>
                                                        <div className="font-mono text-xs text-muted-foreground">{currentRecord.hsbnd_name}</div>
                                                        <div className="font-semibold"><CharacterDiff oldStr={currentRecord.hsbnd_name || ''} newStr={currentRecord.new_hsbnd_name || ''} /></div>
                                                    </TableCell>
                                                    <TableCell>{currentRecord.diff_per_hus?.toFixed(2)}</TableCell>
                                                    <TableCell>{currentRecord.diff_level_hus}</TableCell>
                                                     <TableCell>{currentRecord.enroll_hsbnd_sim_score?.toFixed(2)}</TableCell>
                                                    <TableCell>{currentRecord.enroll_cluster_id}</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                    <div className="p-4 border-t">
                                        <h4 className="font-semibold mb-2">Recommendation:</h4>
                                        <div className="flex gap-2">
                                            <DecisionButton label="إعتماد تصحيح الاسم" icon={Check} onClick={() => handleDecision(currentStep === 'done' ? 'bnf' : currentStep, 'approve')} disabled={isSaving || isSimilarityCase} />
                                            <DecisionButton label="عدم اعتماد التصحيح" icon={X} onClick={() => handleDecision(currentStep === 'done' ? 'bnf' : currentStep, 'reject')} disabled={isSaving || isSimilarityCase} />
                                            <DecisionButton label="تعليق الاسم للتحقق" icon={Hand} onClick={() => handleDecision(currentStep === 'done' ? 'bnf' : currentStep, 'suspend')} disabled={isSaving} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                     <Card>
                        <CardHeader><CardTitle>Review Progress & Info</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                           <p>Record {currentItemIndex + 1} of {groupedRecords[currentGroupIndex]?.length || 0} in Group {currentGroupIndex + 1}</p>
                           <p>Beneficiary Decision: {decisionState.bnf || 'Pending'}</p>
                           <p>Husband Decision: {decisionState.hsbnd || 'Pending'}</p>
                           <p className="text-sm text-muted-foreground pt-4">Current Record ID: {currentRecord?.id}</p>
                        </CardContent>
                    </Card>
                </div>
            ) : <p className="text-center text-muted-foreground py-8">Select a project to begin the review process.</p>}
        </div>
    );
}
