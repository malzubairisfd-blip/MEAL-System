// src/app/monitoring/me-plan-table/add/page.tsx
"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MEPlanSchema, type MEPlan, type IndicatorPlan } from '@/types/monitoring-plan';
import { Logframe } from '@/lib/logframe';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

function AddMEPlanForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const projectIdFromUrl = searchParams.get('projectId');
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false });
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<MEPlan>({
        resolver: zodResolver(MEPlanSchema),
        defaultValues: {
            projectId: projectIdFromUrl || '',
            outputs: []
        },
    });

    const { control, setValue, getValues, watch } = form;
    
    const { fields: outputFields, replace: replaceOutputs } = useFieldArray({
      control,
      name: 'outputs'
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
            replaceOutputs([]);
            return;
        };

        const fetchData = async () => {
            setLoading(prev => ({...prev, data: true}));
            try {
                 const [logframeRes, mePlanRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/monitoring-plan?projectId=${selectedProjectId}`)
                ]);

                let logframeData: Logframe | null = null;
                if (logframeRes.ok) {
                    logframeData = await logframeRes.json();
                    setLogframe(logframeData);
                } else {
                     toast({title: "Logframe not found", description: "Please create a logframe for this project first.", variant: 'destructive'});
                }
                
                let planMap = new Map<string, any>();
                if (mePlanRes.ok) {
                    const mePlanData = await mePlanRes.json();
                    if(mePlanData.indicators) {
                       planMap = new Map(mePlanData.indicators.map((p: any) => [p.indicatorId, p]));
                    }
                }

                if (logframeData) {
                    const groupedOutputs = logframeData.outputs.map(output => ({
                        ...output,
                        activities: output.activities.map(activity => ({
                            ...activity,
                            indicators: activity.indicators.map(indicator => {
                                const existingPlan = planMap.get(indicator.description);
                                return {
                                    ...indicator,
                                    isNew: false,
                                    definition: existingPlan?.definition || '',
                                    collectionMethods: existingPlan?.collectionMethods || '',
                                    frequency: existingPlan?.frequency || '',
                                    responsibilities: existingPlan?.responsibilities || '',
                                    informationUse: existingPlan?.informationUse || '',
                                }
                            })
                        }))
                    }));
                    replaceOutputs(groupedOutputs);
                }

            } catch(e: any) {
                toast({ title: "Error loading data", description: e.message, variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, data: false}));
            }
        };
        fetchData();

    }, [selectedProjectId, replaceOutputs, toast]);

    const onSubmit = async (data: MEPlan) => {
        setIsSaving(true);
        const flattenedIndicators = data.outputs?.flatMap(o => 
            o.activities.flatMap(a => 
                a.indicators.map(i => ({
                    indicatorId: i.description,
                    indicatorDescription: i.description,
                    definition: i.definition || '',
                    collectionMethods: i.collectionMethods || '',
                    frequency: i.frequency || '',
                    responsibilities: i.responsibilities || '',
                    informationUse: i.informationUse || '',
                }))
            )
        ) || [];

        const payload = {
            projectId: data.projectId,
            indicators: flattenedIndicators,
        };

        try {
            const response = await fetch('/api/monitoring-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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
                    <h1 className="text-3xl font-bold text-black">Create/Edit M&E Plan</h1>
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
                            <CardTitle className="text-black">Project Selection</CardTitle>
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
                    ) : outputFields.length === 0 && logframe ? (
                         <Card><CardContent className="p-6 text-center text-muted-foreground">No outputs found in the logical framework for this project.</CardContent></Card>
                    ) : (
                        outputFields.map((outputField, outputIndex) => (
                          <Card key={outputField.id} className="border-blue-200 border-2">
                            <CardHeader>
                              <CardTitle className="text-black">Output {outputIndex + 1}: {outputField.description}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6 pl-10">
                              <ActivitiesArray control={control} outputIndex={outputIndex} />
                            </CardContent>
                          </Card>
                        ))
                    )}

                    {outputFields.length > 0 && (
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

const ActivitiesArray = ({ control, outputIndex }: { control: any, outputIndex: number }) => {
  const { fields: activityFields } = useFieldArray({
    control,
    name: `outputs.${outputIndex}.activities`,
  });

  return activityFields.map((activityField, activityIndex) => (
    <Card key={activityField.id} className="bg-slate-50">
      <CardHeader>
        <CardTitle className="text-lg text-black">Activity {outputIndex + 1}.{activityIndex + 1}: {activityField.description}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <IndicatorsArray control={control} outputIndex={outputIndex} activityIndex={activityIndex} />
      </CardContent>
    </Card>
  ));
}

const IndicatorsArray = ({ control, outputIndex, activityIndex }: { control: any, outputIndex: number, activityIndex: number }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `outputs.${outputIndex}.activities.${activityIndex}.indicators`
  });

  return (
    <div className="space-y-4">
      {fields.map((indicatorField, indicatorIndex) => (
        <Card key={indicatorField.id} className="border-l-4 border-primary bg-white p-6 relative">
          {(indicatorField as any).isNew && (
            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(indicatorIndex)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
          <CardHeader className='p-0 pb-4'>
            <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.description`} render={({ field }) => (
              <FormItem>
                <FormLabel className="text-black">Indicator {outputIndex + 1}.{activityIndex+1}.{indicatorIndex+1} Title</FormLabel>
                <FormControl>
                  <Input {...field} readOnly={!(indicatorField as any).isNew} placeholder={(indicatorField as any).isNew ? "Enter new indicator title..." : ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.definition`} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-black">Indicator Definition</FormLabel>
                    <FormControl><Textarea maxLength={1000} {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.collectionMethods`} render={({ field }) => (
              <FormItem>
                  <FormLabel className="text-black">Data Collection Methods</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
              </FormItem>
            )} />
            <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.frequency`} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-black">Frequency and Schedule</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.responsibilities`} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-black">Responsibilities</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.informationUse`} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-black">Information Use</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => append({ 
          description: '', 
          isNew: true, 
          type: '#', 
          target: 0, 
          meansOfVerification: [],
          definition: '', 
          collectionMethods: '',
          frequency: '',
          responsibilities: '',
          informationUse: ''
        })}
      >
        <Plus className="mr-2 h-4 w-4" /> Add Indicator
      </Button>
    </div>
  )
}

export default function AddMEPlanTablePage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <AddMEPlanForm />
        </Suspense>
    );
}
