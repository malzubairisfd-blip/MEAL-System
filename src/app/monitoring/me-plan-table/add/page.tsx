// src/app/monitoring/me-plan-table/add/page.tsx
"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MEPlanSchema, type MEPlan } from '@/types/me-plan';
import { Logframe } from '@/lib/logframe';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  projectId: string;
  projectName: string;
}

function AddMEPlanForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const projectId = searchParams.get('projectId');
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false });
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<MEPlan>({
        resolver: zodResolver(MEPlanSchema),
        defaultValues: {
            projectId: projectId || '',
            indicators: []
        },
    });

    const { control, setValue } = form;
    const { fields, replace } = useFieldArray({
        control,
        name: "indicators"
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
    
    useEffect(() => {
        const selectedProjectId = form.watch('projectId');
        if (!selectedProjectId) {
            setLogframe(null);
            replace([]);
            return;
        };

        const fetchData = async () => {
            setLoading(prev => ({...prev, data: true}));
            try {
                 const [logframeRes, mePlanRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/me-plan?projectId=${selectedProjectId}`)
                ]);

                let indicatorPlans: any[] = [];

                if (logframeRes.ok) {
                    const logframeData = await logframeRes.json();
                    setLogframe(logframeData);

                    // Pre-populate form fields from logframe
                    indicatorPlans = logframeData.outputs.flatMap((o: any) =>
                        o.activities.flatMap((a: any) =>
                            a.indicators.map((i: any) => ({
                                indicatorId: i.description,
                                indicatorDescription: i.description,
                                definition: '',
                                collectionMethods: '',
                                frequency: '',
                                responsibilities: '',
                                informationUse: ''
                            }))
                        )
                    );
                } else {
                     toast({title: "Logframe not found", description: "Please create a logframe for this project first.", variant: 'destructive'});
                }
                
                if (mePlanRes.ok) {
                    const mePlanData = await mePlanRes.json();
                    const planMap = new Map(mePlanData.indicators.map((p: any) => [p.indicatorId, p]));
                    indicatorPlans.forEach(plan => {
                        const existingPlan = planMap.get(plan.indicatorId);
                        if (existingPlan) {
                            Object.assign(plan, existingPlan);
                        }
                    });
                }
                
                replace(indicatorPlans);

            } catch(e: any) {
                toast({ title: "Error loading data", description: e.message, variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, data: false}));
            }
        };
        fetchData();

    }, [form.watch('projectId'), replace, toast]);


    const onSubmit = async (data: MEPlan) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/me-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to save M&E Plan");
            toast({ title: "Success!", description: "The M&E plan has been saved successfully." });
            router.push('/monitoring/me-plan-table');
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
                    <h1 className="text-3xl font-bold">Create/Edit M&E Plan</h1>
                    <p className="text-muted-foreground">Define the M&E details for each indicator in your project's logical framework.</p>
                </div>
                 <Button variant="outline" asChild>
                    <Link href="/monitoring/me-plan-table">
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
                                control={form.control}
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
                    ) : fields.length === 0 && logframe ? (
                         <Card><CardContent className="p-6 text-center text-muted-foreground">No indicators found in the logical framework for this project.</CardContent></Card>
                    ) : (
                        fields.map((field, index) => (
                             <Card key={field.id} className="border-l-4 border-primary">
                                <CardHeader>
                                    <CardTitle>Indicator {index + 1}</CardTitle>
                                    <CardDescription>{field.indicatorDescription}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                     <FormField control={control} name={`indicators.${index}.definition`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Indicator Definition</FormLabel>
                                            <FormControl><Textarea maxLength={1000} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                     <FormField control={control} name={`indicators.${index}.collectionMethods`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Data Collection Methods</FormLabel>
                                            <FormControl><Textarea {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                     <FormField control={control} name={`indicators.${index}.frequency`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Frequency and Schedule</FormLabel>
                                            <FormControl><Textarea {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                     <FormField control={control} name={`indicators.${index}.responsibilities`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Responsibilities</FormLabel>
                                            <FormControl><Textarea {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                     <FormField control={control} name={`indicators.${index}.informationUse`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Information Use</FormLabel>
                                            <FormControl><Textarea {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </CardContent>
                            </Card>
                        ))
                    )}

                    {fields.length > 0 && (
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

export default function AddMEPlanTablePage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <AddMEPlanForm />
        </Suspense>
    );
}
