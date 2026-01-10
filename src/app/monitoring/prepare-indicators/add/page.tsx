// src/app/monitoring/prepare-indicators/add/page.tsx
"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { IndicatorTrackingPlanSchema, type IndicatorTrackingPlan, type IndicatorUnit } from '@/types/indicator-tracking';
import { Logframe } from '@/lib/logframe';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Project {
  projectId: string;
  projectName: string;
}

function AddIndicatorPlanForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const projectIdFromUrl = searchParams.get('projectId');
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false });
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<IndicatorTrackingPlan>({
        resolver: zodResolver(IndicatorTrackingPlanSchema),
        defaultValues: {
            projectId: projectIdFromUrl || '',
            indicators: []
        },
    });

    const { control, setValue, watch } = form;
    
    const { fields: indicatorFields, replace: replaceIndicators } = useFieldArray({
      control,
      name: 'indicators'
    });
    
    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to fetch projects");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);
    
    const selectedProjectId = watch('projectId');

    useEffect(() => {
        if (!selectedProjectId) {
            setLogframe(null);
            replaceIndicators([]);
            return;
        };

        const fetchData = async () => {
            setLoading(prev => ({...prev, data: true}));
            try {
                 const [logframeRes, planRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/indicator-tracking?projectId=${selectedProjectId}`)
                ]);

                let logframeData: Logframe | null = null;
                if (logframeRes.ok) {
                    logframeData = await logframeRes.json();
                    setLogframe(logframeData);
                } else {
                     toast({title: "Logframe not found", description: "Please create a logframe for this project first.", variant: 'destructive'});
                }
                
                let planMap = new Map<string, any>();
                if (planRes.ok) {
                    const planData = await planRes.json();
                    if(planData.indicators) {
                       planMap = new Map(planData.indicators.map((p: any) => [p.indicatorId, p]));
                    }
                }

                if (logframeData) {
                    const flattenedIndicators = logframeData.outputs.flatMap(output => 
                        output.activities.flatMap(activity => 
                            activity.indicators.map(indicator => {
                                const existingPlan = planMap.get(indicator.description);
                                return {
                                    indicatorId: indicator.description,
                                    outcome: logframe.outcome.description,
                                    output: output.description,
                                    activity: activity.description,
                                    units: existingPlan?.units || []
                                };
                            })
                        )
                    );
                    replaceIndicators(flattenedIndicators);
                }

            } catch(e: any) {
                toast({ title: "Error loading data", description: e.message, variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, data: false}));
            }
        };
        fetchData();

    }, [selectedProjectId, replaceIndicators, toast]);

    const onSubmit = async (data: IndicatorTrackingPlan) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/indicator-tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to save Indicator Tracking Plan");
            toast({ title: "Success!", description: "The Indicator Tracking Plan has been saved successfully." });
            router.push('/monitoring/prepare-indicators');
        } catch(e: any) {
            toast({ title: "Save failed", description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Create/Edit Indicator Tracking Plan</h1>
                    <p className="text-muted-foreground">Define units and targets for each indicator.</p>
                </div>
                 <Button variant="outline" asChild>
                    <Link href="/monitoring/prepare-indicators">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to View
                    </Link>
                </Button>
            </div>

             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Project Selection</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <FormField
                                control={control}
                                name="projectId"
                                render={({ field }) => (
                                    <FormItem>
                                        <Select onValueChange={(val) => setValue('projectId', val)} value={field.value} disabled={loading.projects}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {projects.map(p => (
                                                    <SelectItem key={p.projectId} value={p.projectId}>
                                                        {p.projectName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {loading.data ? (
                        <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>
                    ) : indicatorFields.length === 0 && logframe ? (
                         <Card><CardContent className="p-6 text-center text-muted-foreground">No indicators found in the logical framework for this project.</CardContent></Card>
                    ) : (
                        indicatorFields.map((indicatorField, indicatorIndex) => (
                          <IndicatorCard
                              key={indicatorField.id}
                              control={control}
                              indicatorIndex={indicatorIndex}
                          />
                        ))
                    )}

                    {indicatorFields.length > 0 && (
                         <div className="flex justify-end">
                            <Button type="submit" size="lg" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save & Submit Plan
                            </Button>
                        </div>
                    )}
                </form>
            </Form>
        </div>
    );
}

const IndicatorCard = ({ control, indicatorIndex }: { control: any, indicatorIndex: number }) => {
    const indicator = useForm().watch(`indicators.${indicatorIndex}`);
    const { fields: unitFields, append, remove } = useFieldArray({
        control,
        name: `indicators.${indicatorIndex}.units`
    });

    return (
        <Card className="border-blue-200 border-2">
            <CardHeader>
                <CardTitle>Indicator: {indicator.indicatorId}</CardTitle>
                <p className="text-sm text-muted-foreground">
                    {indicator.outcome} &rarr; {indicator.output} &rarr; {indicator.activity}
                </p>
            </CardHeader>
            <CardContent className="space-y-6 pl-10">
                {unitFields.map((unitField, unitIndex) => (
                    <Card key={unitField.id} className="bg-slate-50 relative p-6">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => remove(unitIndex)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={control} name={`indicators.${indicatorIndex}.units.${unitIndex}.unit`} render={({ field }) => (
                                <FormItem><FormLabel>Unit</FormLabel><FormControl><Input placeholder="e.g., Households, Individuals, Sessions" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={control} name={`indicators.${indicatorIndex}.units.${unitIndex}.targeted`} render={({ field }) => (
                                <FormItem><FormLabel>Targeted</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={control} name={`indicators.${indicatorIndex}.units.${unitIndex}.actual`} render={({ field }) => (
                                <FormItem><FormLabel>Actual</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={control} name={`indicators.${indicatorIndex}.units.${unitIndex}.dataSource`} render={({ field }) => (
                                <FormItem><FormLabel>Data Source</FormLabel><FormControl><Textarea placeholder="e.g., Distribution lists, Survey data" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={control} name={`indicators.${indicatorIndex}.units.${unitIndex}.responsibilities`} render={({ field }) => (
                                <FormItem><FormLabel>Responsibilities</FormLabel><FormControl><Textarea placeholder="e.g., M&E Officer, Field Coordinator" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    </Card>
                ))}
                 <Button
                    type="button"
                    variant="secondary"
                    onClick={() => append({ unit: '', targeted: 0, actual: 0, dataSource: '', responsibilities: '' })}
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Unit
                </Button>
            </CardContent>
        </Card>
    );
};

export default function AddIndicatorTrackingPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <AddIndicatorPlanForm />
        </Suspense>
    );
}
