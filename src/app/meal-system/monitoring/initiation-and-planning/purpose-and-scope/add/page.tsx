// src/app/monitoring/purpose-and-scope/add/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GanttTask } from '@/types/gantt';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Project {
  projectId: string;
  projectName: string;
}

const monitoringActivitySchema = z.object({
  mainActivityId: z.string(),
  mainActivityTitle: z.string(),
  monitoredSubActivities: z.array(z.string()).min(1, "At least one sub-activity must be selected for monitoring."),
  personResponsible: z.string().min(1, "Person responsible is required."),
  monitoringTools: z.string().min(1, "Monitoring tools are required."),
  monitoringFrequency: z.string().min(1, "Monitoring frequency is required."),
  purposeAndScope: z.string().min(1, "Purpose and scope is required."),
  estimatedBudget: z.coerce.number().min(0, "Budget must be a positive number.").optional(),
});

const formSchema = z.object({
  projectId: z.string().min(1, "A project must be selected."),
  monitoringActivities: z.array(monitoringActivitySchema),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddMonitoringPlanPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectPlan, setProjectPlan] = useState<{ tasks: GanttTask[] } | null>(null);
    const [loading, setLoading] = useState({ projects: true, plan: false });
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            projectId: '',
            monitoringActivities: [],
        },
    });

    const { fields, replace } = useFieldArray({
        control: form.control,
        name: "monitoringActivities",
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

    const handleProjectSelect = async (projectId: string) => {
        form.setValue('projectId', projectId);
        setProjectPlan(null);
        replace([]);
        if (!projectId) return;

        setLoading(prev => ({ ...prev, plan: true }));
        try {
            const planRes = await fetch(`/api/project-plan?projectId=${projectId}`);
            if (planRes.ok) {
                const plan = await planRes.json();
                setProjectPlan(plan);
                
                const existingMonitoringRes = await fetch(`/api/purpose-and-scope?projectId=${projectId}`);
                if (existingMonitoringRes.ok) {
                    const existingPlan = await existingMonitoringRes.json();
                    replace(existingPlan.monitoringActivities);
                     toast({title: "Existing Plan Loaded", description: "Loaded the existing monitoring plan for this project."});
                } else {
                    const monitoringActivities = plan.tasks.map((task: GanttTask) => ({
                        mainActivityId: task.id,
                        mainActivityTitle: task.title,
                        monitoredSubActivities: [],
                        personResponsible: '',
                        monitoringTools: '',
                        monitoringFrequency: '',
                        purposeAndScope: '',
                        estimatedBudget: 0,
                    }));
                    replace(monitoringActivities);
                }
            } else {
                toast({ title: "No Project Plan", description: "No activities found for this project. Please create a project plan first.", variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(prev => ({ ...prev, plan: false }));
        }
    };
    
    const onSubmit = async (data: FormValues) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/purpose-and-scope', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "An unknown error occurred.");
            }
            toast({ title: "Monitoring Plan Saved!", description: `The plan has been successfully saved.` });
            router.push('/meal-system/monitoring/initiation-and-planning/purpose-and-scope');
        } catch (error: any) {
             toast({ title: "Save Failed", description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Add/Edit Monitoring Plan</h1>
                    <p className="text-muted-foreground">Define the monitoring details for each main project activity.</p>
                </div>
                 <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/initiation-and-planning/purpose-and-scope">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to View
                    </Link>
                </Button>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Project Selection</CardTitle>
                            <CardDescription>Select the project to create or edit its monitoring plan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <FormField
                                control={form.control}
                                name="projectId"
                                render={({ field }) => (
                                    <FormItem>
                                        <Select onValueChange={handleProjectSelect} value={field.value} disabled={loading.projects}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {projects.map(p => (
                                                    <SelectItem key={p.projectId} value={p.projectId}>
                                                        {p.projectName} ({p.projectId})
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

                    {loading.plan && <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}

                    {projectPlan && fields.map((field, index) => {
                        const mainActivity = projectPlan.tasks.find(t => t.id === field.mainActivityId);
                        if (!mainActivity) return null;

                        return (
                            <Card key={field.id} className="border-l-4 border-primary">
                                <CardHeader>
                                    <CardTitle>Main Activity {index + 1}: {mainActivity.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name={`monitoringActivities.${index}.monitoredSubActivities`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <div className="mb-4">
                                                    <FormLabel className="text-base">Activities Needed to be Monitored</FormLabel>
                                                    <FormDescription>Select the sub-activities that require monitoring.</FormDescription>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-md">
                                                    {mainActivity.subTasks?.map(subTask => (
                                                        <FormField
                                                            key={subTask.id}
                                                            control={form.control}
                                                            name={`monitoringActivities.${index}.monitoredSubActivities`}
                                                            render={({ field }) => {
                                                                return (
                                                                <FormItem key={subTask.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                                    <FormControl>
                                                                        <Checkbox
                                                                            checked={field.value?.includes(subTask.title)}
                                                                            onCheckedChange={(checked) => {
                                                                                return checked
                                                                                ? field.onChange([...field.value, subTask.title])
                                                                                : field.onChange(field.value?.filter((value) => value !== subTask.title))
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                    <FormLabel className="font-normal">{subTask.title}</FormLabel>
                                                                </FormItem>
                                                                )
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                 <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField control={form.control} name={`monitoringActivities.${index}.personResponsible`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Person Responsible for Monitoring</FormLabel>
                                            <FormControl><Textarea placeholder="e.g.,&#10;- John Doe, M&amp;E Officer&#10;- Jane Smith, Field Coordinator" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                     <div>
                                        <FormLabel>Monitoring Tools Used</FormLabel>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                             <FormField control={form.control} name={`monitoringActivities.${index}.monitoringTools`} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-sm font-normal">Tools Used</FormLabel>
                                                    <FormControl><Textarea placeholder="e.g., Field visit reports, beneficiary surveys..." {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                             <FormField control={form.control} name={`monitoringActivities.${index}.monitoringFrequency`} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-sm font-normal">Frequency</FormLabel>
                                                    <FormControl><Textarea placeholder="e.g., Weekly, monthly, quarterly..." {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                    <FormField control={form.control} name={`monitoringActivities.${index}.purposeAndScope`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Purpose and Scope</FormLabel>
                                            <FormControl><Textarea placeholder="Describe the purpose and scope of monitoring for this activity..." {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name={`monitoringActivities.${index}.estimatedBudget`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Estimated Budget</FormLabel>
                                            <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </CardContent>
                            </Card>
                        )
                    })}

                    {form.getValues('projectId') && (
                        <div className="flex justify-end">
                            <Button type="submit" size="lg" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save &amp; Submit Plan
                            </Button>
                        </div>
                    )}
                </form>
            </Form>
        </div>
    );
}
