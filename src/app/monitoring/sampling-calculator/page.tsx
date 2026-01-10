
// src/app/monitoring/sampling-calculator/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Loader2, Calculator, Save, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logframe, ActivitySchema } from '@/lib/logframe';
import { exportSamplingPlanToExcel } from '@/lib/exportSamplingPlanToExcel';

interface Project {
  projectId: string;
  projectName: string;
  beneficiaries: number;
}

const Z_SCORES: { [key: number]: number } = { 90: 1.645, 95: 1.96, 99: 2.576 };

type ActivityCalculation = {
    activityId: string;
    populationSize: number;
    confidenceLevel: number;
    marginOfError: number;
    responseDistribution: number;
    recommendedSampleSize: number;
};

type SamplingPlan = {
    projectId: string;
    calculations: ActivityCalculation[];
};

export default function SamplingCalculatorPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [samplingPlan, setSamplingPlan] = useState<SamplingPlan | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false, saving: false });
    
    // Fetch all projects on initial load
    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({...prev, projects: true}));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, projects: false}));
            }
        }
        fetchProjects();
    }, [toast]);
    
    // Fetch logframe and existing sampling plan when a project is selected
    useEffect(() => {
        if (!selectedProjectId) {
            setLogframe(null);
            setSamplingPlan(null);
            return;
        };

        const fetchData = async () => {
            setLoading(prev => ({...prev, data: true}));
            try {
                const [logframeRes, samplingPlanRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/sampling-plan?projectId=${selectedProjectId}`)
                ]);

                if (logframeRes.ok) {
                    const lfData = await logframeRes.json();
                    setLogframe(lfData);

                    if (samplingPlanRes.ok) {
                        setSamplingPlan(await samplingPlanRes.json());
                        toast({ title: "Loaded Saved Plan", description: "Loaded the previously saved sampling plan for this project."});
                    } else {
                        // If no saved plan, create a default one from the logframe
                        const defaultCalculations = lfData.outputs.flatMap((output: any) => 
                            output.activities.map((activity: any) => ({
                                activityId: activity.description,
                                populationSize: 20000,
                                confidenceLevel: 95,
                                marginOfError: 5,
                                responseDistribution: 50,
                                recommendedSampleSize: 0,
                            }))
                        );
                        setSamplingPlan({ projectId: selectedProjectId, calculations: defaultCalculations });
                    }
                } else {
                    setLogframe(null);
                    setSamplingPlan(null);
                    toast({ title: "Logframe Not Found", description: "This project doesn't have a logical framework yet." });
                }

            } catch (error: any) {
                 toast({ title: "Error", description: "Failed to load project data.", variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, data: false}));
            }
        }
        fetchData();
    }, [selectedProjectId, toast]);

    const handleCalculationChange = (activityId: string, field: keyof ActivityCalculation, value: number) => {
        setSamplingPlan(prev => {
            if (!prev) return null;
            const newCalculations = prev.calculations.map(calc => {
                if (calc.activityId === activityId) {
                    const updatedCalc = { ...calc, [field]: value };
                    
                    const N = updatedCalc.populationSize;
                    const e = updatedCalc.marginOfError / 100;
                    const z = Z_SCORES[updatedCalc.confidenceLevel] || 1.96;
                    const p = updatedCalc.responseDistribution / 100;

                    if (N <= 0 || e <= 0) {
                        updatedCalc.recommendedSampleSize = 0;
                    } else {
                        const x = Math.pow(z, 2) * p * (1 - p);
                        const n = (N * x) / (((N - 1) * Math.pow(e, 2)) + x);
                        updatedCalc.recommendedSampleSize = Math.ceil(n);
                    }
                    return updatedCalc;
                }
                return calc;
            });
            return { ...prev, calculations: newCalculations };
        });
    };

    const handleSavePlan = async () => {
        if (!samplingPlan) {
            toast({ title: "Validation Error", description: "No plan data to save.", variant: "destructive" });
            return;
        }

        setLoading(prev => ({ ...prev, saving: true }));
        try {
            const response = await fetch('/api/sampling-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(samplingPlan)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save the sampling plan.');
            }
            
            toast({ title: "Plan Saved!", description: "Your sampling plan has been saved successfully." });

        } catch (error: any) {
            toast({ title: "Save Failed", description: error.message, variant: 'destructive' });
        } finally {
            setLoading(prev => ({ ...prev, saving: false }));
        }
    };

    const handleExport = () => {
        if (!logframe || !samplingPlan) {
            toast({ title: "Export Failed", description: "Data is not ready for export.", variant: "destructive" });
            return;
        }
        exportSamplingPlanToExcel(logframe, samplingPlan);
    }
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Sample Size Calculator</h1>
                    <p className="text-muted-foreground">Determine sampling requirements for each project activity.</p>
                </div>
                 <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/monitoring/data-collection">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Data Collection
                        </Link>
                    </Button>
                    <Button onClick={handleSavePlan} disabled={loading.saving || !selectedProjectId}>
                        {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Plan
                    </Button>
                     <Button onClick={handleExport} disabled={!logframe || !samplingPlan}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export to Excel
                    </Button>
                </div>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>Select a Project</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
            
            {loading.data && (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            )}

            {!loading.data && logframe && (
                 <Card>
                    <CardHeader>
                        <CardTitle>{logframe.goal.description}</CardTitle>
                        <CardDescription>{logframe.outcome.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="multiple" className="w-full space-y-4">
                            {logframe.outputs.map((output, oIdx) => (
                                <Card key={oIdx} className="border-l-4 border-primary">
                                    <AccordionItem value={`output-${oIdx}`} className="border-b-0">
                                        <AccordionTrigger className="p-4 bg-primary/5 hover:no-underline">
                                            <h3 className="text-lg font-semibold">Output {oIdx + 1}: {output.description}</h3>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-4 space-y-4">
                                            {output.activities.map((activity, aIdx) => {
                                                const calcData = samplingPlan?.calculations.find(c => c.activityId === activity.description);
                                                if (!calcData) return null;
                                                return (
                                                    <Card key={aIdx} className="bg-card">
                                                        <CardHeader>
                                                            <CardTitle className="text-base">Activity {oIdx+1}.{aIdx+1}: {activity.description}</CardTitle>
                                                        </CardHeader>
                                                        <CardContent className="space-y-6">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                <div>
                                                                    <Label>Population Size</Label>
                                                                    <Input type="number" value={calcData.populationSize} onChange={e => handleCalculationChange(activity.description, 'populationSize', Number(e.target.value))} />
                                                                    <p className="text-xs text-muted-foreground mt-1">Total population for this specific activity.</p>
                                                                </div>
                                                                 <div>
                                                                    <Label>Confidence Level</Label>
                                                                    <Select value={String(calcData.confidenceLevel)} onValueChange={val => handleCalculationChange(activity.description, 'confidenceLevel', Number(val))}>
                                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="90">90%</SelectItem>
                                                                            <SelectItem value="95">95%</SelectItem>
                                                                            <SelectItem value="99">99%</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div>
                                                                    <Label>Margin of Error (%)</Label>
                                                                    <Input type="number" value={calcData.marginOfError} onChange={e => handleCalculationChange(activity.description, 'marginOfError', Number(e.target.value))} />
                                                                </div>
                                                                 <div>
                                                                    <Label>Response Distribution (%)</Label>
                                                                    <Input type="number" value={calcData.responseDistribution} onChange={e => handleCalculationChange(activity.description, 'responseDistribution', Number(e.target.value))} />
                                                                </div>
                                                            </div>
                                                            <div className="p-4 bg-primary/10 rounded-lg text-center">
                                                                <p className="text-sm font-medium text-primary">Recommended Sample Size</p>
                                                                <p className="text-4xl font-bold text-primary">{calcData.recommendedSampleSize}</p>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )
                                            })}
                                        </AccordionContent>
                                    </AccordionItem>
                                </Card>
                            ))}
                        </Accordion>
                    </CardContent>
                 </Card>
            )}
        </div>
    );
}

    