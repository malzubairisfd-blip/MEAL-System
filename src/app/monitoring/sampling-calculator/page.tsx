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
import { ArrowLeft, Loader2, Calculator, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logframe } from '@/lib/logframe';

interface Project {
  projectId: string;
  projectName: string;
}

const Z_SCORES: { [key: number]: number } = { 90: 1.645, 95: 1.96, 99: 2.576 };

export default function SamplingCalculatorPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false, saving: false });
    
    // Calculator State
    const [marginOfError, setMarginOfError] = useState(5);
    const [confidenceLevel, setConfidenceLevel] = useState(95);
    const [populationSize, setPopulationSize] = useState(20000);
    const [responseDistribution, setResponseDistribution] = useState(50);
    const [recommendedSampleSize, setRecommendedSampleSize] = useState(0);

    const calculateSampleSize = useCallback(() => {
        const N = populationSize;
        const e = marginOfError / 100;
        const z = Z_SCORES[confidenceLevel] || 1.96;
        const p = responseDistribution / 100;
        
        if (N <= 0 || e <= 0) {
            setRecommendedSampleSize(0);
            return;
        }

        const x = Math.pow(z, 2) * p * (1-p);
        const n = (N * x) / (((N - 1) * Math.pow(e, 2)) + x);

        setRecommendedSampleSize(Math.ceil(n));

    }, [populationSize, marginOfError, confidenceLevel, responseDistribution]);

    useEffect(() => {
        calculateSampleSize();
    }, [calculateSampleSize]);


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
    
    useEffect(() => {
        if (!selectedProjectId) return;
        const fetchData = async () => {
            setLoading(prev => ({...prev, data: true}));
            try {
                const [logframeRes, samplingPlanRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/sampling-plan?projectId=${selectedProjectId}`)
                ]);

                if (logframeRes.ok) setLogframe(await logframeRes.json());
                else { setLogframe(null); toast({ title: "Logframe Not Found", description: "This project doesn't have a logical framework yet." }); }
                
                if (samplingPlanRes.ok) {
                    const plan = await samplingPlanRes.json();
                    setMarginOfError(plan.marginOfError);
                    setConfidenceLevel(plan.confidenceLevel);
                    setPopulationSize(plan.populationSize);
                    setResponseDistribution(plan.responseDistribution);
                    toast({ title: "Loaded Saved Plan", description: "Loaded the previously saved sampling plan for this project."});
                }

            } catch (error: any) {
                 toast({ title: "Error", description: "Failed to load project data.", variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, data: false}));
            }
        }
        fetchData();
    }, [selectedProjectId, toast]);

    const handleSavePlan = async () => {
        if (!selectedProjectId) {
            toast({ title: "Validation Error", description: "Please select a project before saving the plan.", variant: "destructive" });
            return;
        }

        setLoading(prev => ({ ...prev, saving: true }));
        try {
            const payload = {
                projectId: selectedProjectId,
                marginOfError,
                confidenceLevel,
                populationSize,
                responseDistribution,
                recommendedSampleSize,
            };

            const response = await fetch('/api/sampling-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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
    
    const renderLogframe = () => {
        if (loading.data) return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
        if (!logframe) return <p className="text-muted-foreground">Select a project to view its logical framework.</p>;

        return (
            <Accordion type="multiple" defaultValue={['goal', 'outcome']} className="w-full">
                <AccordionItem value="goal">
                    <AccordionTrigger className="bg-blue-100 px-4 rounded">Goal</AccordionTrigger>
                    <AccordionContent className="p-4">{logframe.goal.description}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="outcome">
                    <AccordionTrigger className="bg-green-100 px-4 rounded">Outcome</AccordionTrigger>
                    <AccordionContent className="p-4">{logframe.outcome.description}</AccordionContent>
                </AccordionItem>
                 {logframe.outputs.map((output, oIdx) => (
                    <AccordionItem key={`output-${oIdx}`} value={`output-${oIdx}`}>
                         <AccordionTrigger className="bg-purple-100 px-4 rounded">Output {oIdx + 1}</AccordionTrigger>
                         <AccordionContent className="p-4 space-y-2">
                             <p className="font-semibold">{output.description}</p>
                             {output.activities.map((activity, aIdx) => (
                                 <Card key={`activity-${oIdx}-${aIdx}`} className="ml-4">
                                     <CardHeader className="p-2">
                                         <CardTitle className="text-sm">Activity {oIdx+1}.{aIdx+1}</CardTitle>
                                     </CardHeader>
                                     <CardContent className="p-2 text-sm text-muted-foreground">
                                         {activity.description}
                                     </CardContent>
                                 </Card>
                             ))}
                         </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Sample Size Calculator</h1>
                    <p className="text-muted-foreground">Determine sampling requirements for your project activities.</p>
                </div>
                 <Button variant="outline" asChild>
                    <Link href="/monitoring/data-collection">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Data Collection
                    </Link>
                </Button>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Project Framework</CardTitle>
                        <CardDescription>Goal, Outcome, Outputs, and Activities for the selected project.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {renderLogframe()}
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Calculator /> Sample Size Calculator</CardTitle>
                        <CardDescription>Based on Raosoft, Inc. sample size calculator.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <Label htmlFor="marginOfError">What margin of error can you accept?</Label>
                                <Input id="marginOfError" type="number" value={marginOfError} onChange={e => setMarginOfError(Number(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">5% is a common choice.</p>
                            </div>
                            <div>
                                <Label htmlFor="confidenceLevel">What confidence level do you need?</Label>
                                <Select value={String(confidenceLevel)} onValueChange={val => setConfidenceLevel(Number(val))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="90">90%</SelectItem>
                                        <SelectItem value="95">95%</SelectItem>
                                        <SelectItem value="99">99%</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">Typical choices are 90%, 95%, or 99%.</p>
                            </div>
                            <div>
                                <Label htmlFor="populationSize">What is the population size?</Label>
                                <Input id="populationSize" type="number" value={populationSize} onChange={e => setPopulationSize(Number(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">If you don't know, use 20000.</p>
                            </div>
                             <div>
                                <Label htmlFor="responseDistribution">What is the response distribution?</Label>
                                <Input id="responseDistribution" type="number" value={responseDistribution} onChange={e => setResponseDistribution(Number(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">Leave this at 50% for the largest required sample size.</p>
                            </div>
                        </div>

                        <div className="p-4 bg-primary/10 rounded-lg text-center">
                            <p className="text-sm font-medium text-primary">Your recommended sample size is</p>
                            <p className="text-4xl font-bold text-primary">{recommendedSampleSize}</p>
                        </div>
                        
                         <div className="flex justify-end">
                            <Button onClick={handleSavePlan} disabled={loading.saving || !selectedProjectId}>
                                {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Plan
                            </Button>
                        </div>
                        
                        <Accordion type="single" collapsible>
                            <AccordionItem value="more-info">
                                <AccordionTrigger>More Information</AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground space-y-4">
                                     <p>The margin of error is the amount of error that you can tolerate. Lower margin of error requires a larger sample size.</p>
                                     <p>The confidence level is the amount of uncertainty you can tolerate. Higher confidence level requires a larger sample size.</p>
                                     <p>Response distribution: If you don't know the population's distribution, use 50% (the most conservative assumption).</p>
                                     <h4 className="font-semibold text-foreground">Formulas:</h4>
                                     <p className="font-mono text-xs p-2 bg-muted rounded">x = Z(c/100)² * r(100-r)</p>
                                     <p className="font-mono text-xs p-2 bg-muted rounded">n = N * x / ((N-1)E² + x)</p>
                                     <p>Where N is population size, r is the response fraction, E is the margin of error, and Z is the critical value for the confidence level.</p>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
