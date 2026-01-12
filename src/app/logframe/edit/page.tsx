
"use client";

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Logframe, LogframeSchema } from '@/lib/logframe';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

interface Project {
  projectId: string;
  projectName: string;
}

const RichTextEditor = ({ value, onChange, maxLength, placeholder }: { value: string; onChange: (value: string) => void; maxLength: number, placeholder:string }) => {
    const charCount = value?.length || 0;
    return (
        <div>
            <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="min-h-[120px]"
                maxLength={maxLength}
                placeholder={placeholder}
            />
             <div className="text-xs text-right text-muted-foreground mt-1">
                <span className={cn(charCount > maxLength || charCount < 100 ? 'text-destructive' : '')}>
                    {charCount} / {maxLength}
                </span>
            </div>
        </div>
    );
};

function EditLogframeForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const projectId = searchParams.get('projectId');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    const form = useForm<Logframe>({
        resolver: zodResolver(LogframeSchema),
        defaultValues: {
            outputs: [] // Initialize with empty array
        },
    });

    useEffect(() => {
        if (!projectId) {
            toast({ title: "Error", description: "No project ID provided.", variant: 'destructive' });
            router.push('/logframe');
            return;
        }

        const fetchLogframe = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/logframe?projectId=${projectId}`);
                if (res.ok) {
                    const data = await res.json();
                    form.reset(data); // Set form values
                    
                    // Fetch project details as well for display
                    const projRes = await fetch(`/api/projects`);
                    if (projRes.ok) {
                        const allProjects = await projRes.json();
                        const currentProject = allProjects.find((p: Project) => p.projectId === projectId);
                        setProject(currentProject);
                    }

                } else {
                    throw new Error("Failed to load logframe data.");
                }
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: 'destructive' });
                router.push('/logframe');
            } finally {
                setLoading(false);
            }
        };
        
        fetchLogframe();
    }, [projectId, router, toast, form]);

    const { fields: outputFields, append: appendOutput, remove: removeOutput } = useFieldArray({
        control: form.control,
        name: "outputs",
    });

    const onSubmit = async (data: Logframe) => {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/logframe', {
                method: 'POST', // The API route handles both create and update on POST
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "An unknown error occurred.");
            }
            toast({
                title: "Logical Framework Updated!",
                description: `Logframe for project "${project?.projectName}" has been successfully updated.`,
            });
            router.push('/logframe');
        } catch (error: any) {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Edit Logical Framework</h1>
                    <p className="text-muted-foreground">Modify the strategic elements for {project?.projectName}.</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/logframe">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Logframe Dashboard
                    </Link>
                </Button>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Project: {project?.projectName}</CardTitle>
                            <CardDescription>Project ID: {project?.projectId} (Read-only)</CardDescription>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>1. Project Goal</CardTitle></CardHeader>
                        <CardContent>
                             <FormField control={form.control} name="goal.description" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                      <RichTextEditor
                                        {...field}
                                        maxLength={1000}
                                        placeholder="Define the overall goal of the project..."
                                      />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader><CardTitle>2. Outcome</CardTitle></CardHeader>
                        <CardContent>
                            <FormField control={form.control} name="outcome.description" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <RichTextEditor
                                            {...field}
                                            maxLength={1000}
                                            placeholder="Define the project's outcome..."
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                    
                    {outputFields.map((output, outputIndex) => (
                        <Card key={output.id} className="border-blue-200 border-2">
                             <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>Output {outputIndex + 1}</CardTitle>
                                    <Button type="button" variant="destructive" size="sm" onClick={() => removeOutput(outputIndex)}><Trash2 className="h-4 w-4 mr-1"/> Remove Output</Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <FormField control={form.control} name={`outputs.${outputIndex}.description`} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Output Description</FormLabel>
                                        <FormControl>
                                            <RichTextEditor
                                                {...field}
                                                maxLength={1000}
                                                placeholder={`Describe output ${outputIndex + 1}...`}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <ActivitiesArray control={form.control} outputIndex={outputIndex} />
                            </CardContent>
                        </Card>
                    ))}

                    <Button type="button" variant="outline" onClick={() => appendOutput({ description: '', activities: [{ description: '', indicators: [{ description: '', type: '#', target: 0, meansOfVerification: [''] }], risksAndAssumptions: [{ risk: '', assumption: '' }] }] })}>
                        <Plus className="mr-2 h-4 w-4" /> Add Output
                    </Button>

                    <div className="flex justify-end">
                         <Button type="submit" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Update Logframe
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}


export default function EditLogframePage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <EditLogframeForm />
        </Suspense>
    );
}

const ActivitiesArray = ({ control, outputIndex }: { control: any, outputIndex: number }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `outputs.${outputIndex}.activities`,
    });
    return <div className="space-y-4 pl-4 border-l-2">
        {fields.map((activity, activityIndex) => (
            <Card key={activity.id} className='bg-background'>
                 <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Activity {outputIndex + 1}.{activityIndex + 1}</CardTitle>
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(activityIndex)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.description`} render={({ field }) => (
                         <FormItem>
                             <FormLabel>Activity Description</FormLabel>
                             <FormControl>
                                <RichTextEditor {...field} maxLength={1000} placeholder={`Describe activity ${outputIndex + 1}.${activityIndex + 1}...`} />
                             </FormControl>
                             <FormMessage />
                         </FormItem>
                    )} />
                    
                    <IndicatorsArray control={control} outputIndex={outputIndex} activityIndex={activityIndex} />
                    <RisksAndAssumptionsArray control={control} outputIndex={outputIndex} activityIndex={activityIndex} />
                </CardContent>
            </Card>
        ))}
         <Button type="button" variant="secondary" size="sm" onClick={() => append({ description: '', indicators: [{ description: '', type: '#', target: 0, meansOfVerification: [''] }], risksAndAssumptions: [{ risk: '', assumption: '' }] })}>
            <Plus className="mr-2 h-4 w-4" /> Add Activity
        </Button>
    </div>
}

const IndicatorsArray = ({ control, outputIndex, activityIndex }: { control: any, outputIndex: number, activityIndex: number }) => {
    const { fields, append, remove } = useFieldArray({ control, name: `outputs.${outputIndex}.activities.${activityIndex}.indicators` });
    return <div className="space-y-4 pl-4">
        <FormLabel>Indicators</FormLabel>
        {fields.map((indicator, indicatorIndex) => (
            <div key={indicator.id} className="p-4 border rounded-md relative bg-card">
                {fields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(indicatorIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.description`} render={({ field }) => (
                         <FormItem>
                             <FormLabel>Description</FormLabel>
                             <FormControl><Input placeholder="Indicator description" {...field} /></FormControl>
                             <FormMessage />
                         </FormItem>
                    )} />
                     <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.type`} render={({ field }) => (
                         <FormItem>
                             <FormLabel>Type</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value}>
                                 <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                 <SelectContent><SelectItem value="#">#</SelectItem><SelectItem value="%">%</SelectItem></SelectContent>
                             </Select>
                             <FormMessage />
                         </FormItem>
                    )} />
                     <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.target`} render={({ field }) => (
                         <FormItem>
                             <FormLabel>Targeted Value</FormLabel>
                             <FormControl><Input type="number" {...field} /></FormControl>
                             <FormMessage />
                         </FormItem>
                    )} />
                     <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.indicators.${indicatorIndex}.meansOfVerification`} render={({ field }) => (
                         <FormItem>
                             <FormLabel>Means of Verification</FormLabel>
                             <FormControl><Input placeholder="e.g., Survey Report, Attendance Sheet" {...field} onChange={e => field.onChange(e.target.value.split(','))}/></FormControl>
                             <FormDescription>Comma-separated values.</FormDescription>
                             <FormMessage />
                         </FormItem>
                    )} />
                </div>
            </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', type: '#', target: 0, meansOfVerification: [''] })}><Plus className="mr-2 h-4 w-4" /> Add Indicator</Button>
    </div>
}

const RisksAndAssumptionsArray = ({ control, outputIndex, activityIndex }: { control: any, outputIndex: number, activityIndex: number }) => {
    const { fields, append, remove } = useFieldArray({ control, name: `outputs.${outputIndex}.activities.${activityIndex}.risksAndAssumptions` });
    return <div className="space-y-4 pl-4">
        <FormLabel>Risks and Assumptions</FormLabel>
        {fields.map((item, index) => (
            <div key={item.id} className="p-4 border rounded-md relative bg-card">
                 {fields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.risksAndAssumptions.${index}.risk`} render={({ field }) => (
                         <FormItem>
                             <FormLabel>Risk</FormLabel>
                             <FormControl><Input placeholder="Potential risk" {...field} /></FormControl>
                             <FormMessage />
                         </FormItem>
                    )} />
                     <FormField control={control} name={`outputs.${outputIndex}.activities.${activityIndex}.risksAndAssumptions.${index}.assumption`} render={({ field }) => (
                         <FormItem>
                             <FormLabel>Assumption</FormLabel>
                             <FormControl><Input placeholder="Associated assumption" {...field} /></FormControl>
                             <FormMessage />
                         </FormItem>
                    )} />
                </div>
            </div>
        ))}
         <Button type="button" variant="outline" size="sm" onClick={() => append({ risk: '', assumption: '' })}><Plus className="mr-2 h-4 w-4" /> Add Risk/Assumption</Button>
    </div>
}
