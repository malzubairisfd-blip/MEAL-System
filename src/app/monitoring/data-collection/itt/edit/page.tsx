
"use client";
import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { IndicatorTrackingPlanSchema, type IndicatorTrackingPlan, type Indicator } from '@/types/monitoring-indicators';
import { Logframe } from '@/lib/logframe';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Project {
  projectId: string;
  projectName: string;
}

function EditITTForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const projectIdFromUrl = searchParams.get('projectId');

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState({ projects: true, data: false });
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<IndicatorTrackingPlan>({
        resolver: zodResolver(IndicatorTrackingPlanSchema),
        defaultValues: {
            projectId: projectIdFromUrl || '',
            indicators: [],
        },
    });

    const { control, setValue, watch, trigger } = form;
    const selectedProjectId = watch('projectId');

    const { fields: indicatorFields, replace: replaceIndicators } = useFieldArray({
        control,
        name: 'indicators',
    });

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to fetch projects");
                const projectData = await res.json();
                setProjects(projectData);
                if (projectIdFromUrl && projectData.some((p: Project) => p.projectId === projectIdFromUrl)) {
                    setValue('projectId', projectIdFromUrl);
                }
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();
    }, [toast, projectIdFromUrl, setValue]);

    useEffect(() => {
        if (!selectedProjectId) {
            replaceIndicators([]);
            return;
        }

        const fetchData = async () => {
            setLoading(prev => ({ ...prev, data: true }));
            try {
                const [logframeRes, trackingRes, indicatorPlanRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/indicator-tracking?projectId=${selectedProjectId}`),
                    fetch(`/api/monitoring-indicators?projectId=${selectedProjectId}`)
                ]);

                if (!logframeRes.ok || !indicatorPlanRes.ok) {
                    toast({ title: "Prerequisites Missing", description: "Logframe or Indicator Plan not found. Please create them first.", variant: 'destructive' });
                    replaceIndicators([]);
                    return;
                }
                const logframe: Logframe = await logframeRes.json();
                const indicatorPlan: IndicatorTrackingPlan = await indicatorPlanRes.json();

                const trackingDataMap = new Map<string, any>();
                if (trackingRes.ok) {
                    const trackingData: IndicatorTrackingPlan = await trackingRes.json();
                    trackingData.indicators.forEach(ind => trackingDataMap.set(ind.indicatorId, ind));
                }

                const indicatorsForForm = indicatorPlan.indicators.map(ind => {
                    const savedTrackingData = trackingDataMap.get(ind.indicatorId);
                    return {
                        ...ind,
                        lopTarget: savedTrackingData?.lopTarget ?? ind.units?.reduce((sum, u) => sum + u.targeted, 0) ?? 0,
                        annualTarget: savedTrackingData?.annualTarget ?? ind.units?.reduce((sum, u) => sum + u.targeted, 0) ?? 0,
                        q1Target: savedTrackingData?.q1Target ?? 0,
                        q1Actual: savedTrackingData?.q1Actual ?? 0,
                        q2Target: savedTrackingData?.q2Target ?? 0,
                        q2Actual: savedTrackingData?.q2Actual ?? 0,
                        q3Target: savedTrackingData?.q3Target ?? 0,
                        q3Actual: savedTrackingData?.q3Actual ?? 0,
                        q4Target: savedTrackingData?.q4Target ?? 0,
                        q4Actual: savedTrackingData?.q4Actual ?? 0,
                    };
                });

                replaceIndicators(indicatorsForForm);

            } catch (e: any) {
                toast({ title: "Error loading data", description: e.message, variant: 'destructive' });
            } finally {
                setLoading(prev => ({ ...prev, data: false }));
            }
        };
        fetchData();
    }, [selectedProjectId, replaceIndicators, toast]);
    
    const onSubmit = async (data: IndicatorTrackingPlan) => {
        const isValid = await trigger();
        if (!isValid) {
            toast({
                title: "Validation Error",
                description: "Please fill out all required fields before saving.",
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch('/api/indicator-tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to save data");
            toast({ title: "Success!", description: "The indicator tracking data has been saved." });
            router.push(`/monitoring/data-collection/itt?projectId=${selectedProjectId}`);
        } catch (e: any) {
            toast({ title: "Save failed", description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Edit Indicator Tracking Data</h1>
                <Button variant="outline" asChild>
                    <Link href={`/monitoring/data-collection/itt?projectId=${selectedProjectId || ''}`}>
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
                            <FormField control={control} name="projectId" render={({ field }) => (
                                <FormItem>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={loading.projects}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    {loading.data && <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>}

                    {indicatorFields.map((indicatorField, index) => (
                        <IndicatorCard key={indicatorField.id} control={control} index={index} />
                    ))}

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

const IndicatorCard = ({ control, index }: { control: any, index: number }) => {
    const indicator = useWatch({ control, name: `indicators.${index}` });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Indicator: {indicator.indicatorId}</CardTitle>
                <CardDescription>Code: {indicator.indicatorCode} | Type: {indicator.type}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={control} name={`indicators.${index}.lopTarget`} render={({ field }) => (
                        <FormItem><FormLabel>LoP Target</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name={`indicators.${index}.annualTarget`} render={({ field }) => (
                        <FormItem><FormLabel>Annual Target</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="space-y-2 p-4 border rounded-md">
                    <h4 className="font-semibold">Q1 Reporting Period</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <FormField control={control} name={`indicators.${index}.q1Target`} render={({ field }) => (
                            <FormItem><FormLabel>Q1 Target</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={control} name={`indicators.${index}.q1Actual`} render={({ field }) => (
                            <FormItem><FormLabel>Q1 Actual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>
                 <div className="space-y-2 p-4 border rounded-md">
                    <h4 className="font-semibold">Q2 Reporting Period</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <FormField control={control} name={`indicators.${index}.q2Target`} render={({ field }) => (
                            <FormItem><FormLabel>Q2 Target</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={control} name={`indicators.${index}.q2Actual`} render={({ field }) => (
                            <FormItem><FormLabel>Q2 Actual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>
                 <div className="space-y-2 p-4 border rounded-md">
                    <h4 className="font-semibold">Q3 Reporting Period</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <FormField control={control} name={`indicators.${index}.q3Target`} render={({ field }) => (
                            <FormItem><FormLabel>Q3 Target</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={control} name={`indicators.${index}.q3Actual`} render={({ field }) => (
                            <FormItem><FormLabel>Q3 Actual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>
                 <div className="space-y-2 p-4 border rounded-md">
                    <h4 className="font-semibold">Q4 Reporting Period</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <FormField control={control} name={`indicators.${index}.q4Target`} render={({ field }) => (
                            <FormItem><FormLabel>Q4 Target</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={control} name={`indicators.${index}.q4Actual`} render={({ field }) => (
                            <FormItem><FormLabel>Q4 Actual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function EditITTPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <EditITTForm />
        </Suspense>
    );
}

