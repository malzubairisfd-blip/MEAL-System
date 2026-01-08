// src/app/project/add-task/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';

import { ArrowLeft, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GanttTaskSchema } from '@/types/gantt';

interface Project {
  projectId: string;
  projectName: string;
}

const AddTasksFormSchema = z.object({
  tasks: z.array(GanttTaskSchema)
});

const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const years = Array.from({ length: 21 }, (_, i) => String(new Date().getFullYear() - 10 + i));
const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

export default function AddTaskPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    
    const form = useForm<z.infer<typeof AddTasksFormSchema>>({
        resolver: zodResolver(AddTasksFormSchema),
        defaultValues: { tasks: [{ id: `task-${Date.now()}`, title: "", hasSubTasks: 'no', status: 'PLANNED', progress: 0, subTasks: [] }] },
    });

    const { fields, append, remove, control } = useFieldArray({
      control: form.control,
      name: "tasks",
    });

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects');
                const data = await res.json();
                setProjects(data);
                const projectIdFromUrl = searchParams.get('projectId');
                if (projectIdFromUrl && data.some((p: Project) => p.projectId === projectIdFromUrl)) {
                    setSelectedProjectId(projectIdFromUrl);
                }
            } catch (error) {
                toast({ title: "Error", description: "Could not load projects.", variant: "destructive" });
            }
        };
        fetchProjects();
    }, [searchParams, toast]);

    const onAddTaskSubmit = async (data: z.infer<typeof AddTasksFormSchema>) => {
        if (!selectedProjectId) {
            toast({ title: "Project Not Selected", description: "Please select a project first.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const existingPlanRes = await fetch(`/api/project-plan?projectId=${selectedProjectId}`);
            let existingTasks: any[] = [];
            if (existingPlanRes.ok) {
                const existingPlan = await existingPlanRes.json();
                existingTasks = existingPlan.tasks || [];
            }
            
            const updatedTasks = [...existingTasks, ...data.tasks];

            const payload = { projectId: selectedProjectId, tasks: updatedTasks };
            const saveRes = await fetch('/api/project-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!saveRes.ok) throw new Error("Failed to save the new tasks.");

            toast({ title: "Activities Added!", description: "The new activities have been added to the project plan." });
            router.push(`/project/plan`);

        } catch (error: any) {
            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Add New Activities</h1>
                <Button variant="outline" asChild>
                    <Link href="/project/plan">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Plan
                    </Link>
                </Button>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddTaskSubmit)} className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Select Project</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                                <SelectTrigger className="w-full md:w-1/2">
                                    <SelectValue placeholder="Select a project..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => (
                                        <SelectItem key={p.projectId} value={p.projectId}>
                                            {p.projectName} ({p.projectId})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <MainTaskItem key={field.id} control={control} index={index} remove={remove} />
                        ))}
                    </div>

                    <div className="flex justify-between">
                        <Button type="button" variant="outline" onClick={() => append({ id: `task-${Date.now()}`, title: "", hasSubTasks: 'no', status: 'PLANNED', progress: 0, subTasks: [] })}>
                            <Plus className="mr-2 h-4 w-4"/> Add Another Activity
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Save All Activities
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}

function MainTaskItem({ control, index, remove }: { control: any; index: number; remove: (index: number) => void }) {
    const hasSubTasks = useWatch({ control, name: `tasks.${index}.hasSubTasks` });
    const title = useWatch({ control, name: `tasks.${index}.title` });

    return (
        <Card className="p-4 relative bg-slate-50 border-slate-200">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">Activity {index + 1}: <span className="font-normal text-muted-foreground">{title}</span></h3>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive"/>
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name={`tasks.${index}.title`}
                    render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel>Activity Title</FormLabel>
                            <FormControl><Input {...field} maxLength={1000} /></FormControl>
                            <FormMessage />
                            <div className="text-xs text-right text-muted-foreground">{field.value?.length || 0}/1000</div>
                        </FormItem>
                    )}
                />
                 {hasSubTasks === 'no' && (
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={`tasks.${index}.startDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`tasks.${index}.startMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`tasks.${index}.startYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={`tasks.${index}.endDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`tasks.${index}.endMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`tasks.${index}.endYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                    </div>
                 )}
                 <FormField
                    control={control}
                    name={`tasks.${index}.hasSubTasks`}
                    render={({ field }) => (
                        <FormItem className="col-span-2 space-y-3">
                            <FormLabel>Include Sub-Activities?</FormLabel>
                            <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex space-x-4"
                                >
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><RadioGroupItem value="yes" /></FormControl>
                                        <FormLabel className="font-normal">Yes</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><RadioGroupItem value="no" /></FormControl>
                                        <FormLabel className="font-normal">No</FormLabel>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            
            {hasSubTasks === 'yes' && (
                <SubTaskArray control={control} taskIndex={index} />
            )}
        </Card>
    )
}

function SubTaskArray({ control, taskIndex }: { control: any; taskIndex: number }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `tasks.${taskIndex}.subTasks`
    });

    return (
        <div className="col-span-2 mt-4 pl-4 border-l-2 space-y-4">
            {fields.map((subField, subIndex) => (
                <SubTaskItem key={subField.id} control={control} taskIndex={taskIndex} subIndex={subIndex} remove={remove} />
            ))}
             <Button type="button" variant="secondary" size="sm" onClick={() => append({ id: `sub-task-${Date.now()}`, title: '', status: 'PLANNED', progress: 0, hasSubOfSubTasks: 'no' })}>
                <Plus className="mr-2 h-4 w-4" /> Add Sub-Activity
            </Button>
        </div>
    );
}

function SubTaskItem({ control, taskIndex, subIndex, remove }: { control: any; taskIndex: number; subIndex: number; remove: (index: number) => void; }) {
    const hasSubOfSubTasks = useWatch({ control, name: `tasks.${taskIndex}.subTasks.${subIndex}.hasSubOfSubTasks` });
    const title = useWatch({ control, name: `tasks.${taskIndex}.subTasks.${subIndex}.title` });

    return (
        <Card className="p-4 bg-white relative">
             <div className="flex justify-between items-start mb-4">
                <h4 className="text-md font-semibold">Activity {taskIndex + 1}.{subIndex + 1}: <span className="font-normal text-muted-foreground">{title}</span></h4>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(subIndex)}>
                    <Trash2 className="h-4 w-4 text-destructive"/>
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.title`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Sub-Activity Title</FormLabel><FormControl><Input {...field} maxLength={1000} /></FormControl><FormMessage /><div className="text-xs text-right text-muted-foreground">{field.value?.length || 0}/1000</div></FormItem>)} />
                
                 {hasSubOfSubTasks === 'no' && (
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.startDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.startMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.startYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>End Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.endDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.endMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.endYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                        <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.progress`} render={({ field }) => (<FormItem><FormLabel>Progress (%)</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} className="w-24" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                )}

                 <FormField
                    control={control}
                    name={`tasks.${taskIndex}.subTasks.${subIndex}.hasSubOfSubTasks`}
                    render={({ field }) => (
                        <FormItem className="col-span-2 space-y-3">
                            <FormLabel>Include Sub-of-Sub-Activities?</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="no" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
             {hasSubOfSubTasks === 'yes' && (
                <SubOfSubTaskArray control={control} taskIndex={taskIndex} subIndex={subIndex} />
            )}
        </Card>
    );
}

function SubOfSubTaskArray({ control, taskIndex, subIndex }: { control: any, taskIndex: number, subIndex: number }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `tasks.${taskIndex}.subTasks.${subIndex}.subOfSubTasks`
  });

  return (
    <div className="col-span-2 mt-4 pl-4 border-l-2 space-y-4">
      {fields.map((item, sssIndex) => (
        <Card key={item.id} className="p-4 bg-slate-50 relative">
          <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(sssIndex)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.subOfSubTasks.${sssIndex}.title`} render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Activity {taskIndex + 1}.{subIndex + 1}.{sssIndex + 1}</FormLabel>
                <FormControl><Input {...field} maxLength={1000} /></FormControl>
                <FormMessage />
                <div className="text-xs text-right text-muted-foreground">{field.value?.length || 0}/1000</div>
              </FormItem>
            )} />
            <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.subOfSubTasks.${sssIndex}.startDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.subOfSubTasks.${sssIndex}.startMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.subOfSubTasks.${sssIndex}.startYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.subOfSubTasks.${sssIndex}.endDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.subOfSubTasks.${sssIndex}.endMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.subOfSubTasks.${sssIndex}.endYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                </div>
            </div>
            <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.subOfSubTasks.${sssIndex}.progress`} render={({ field }) => (
              <FormItem>
                <FormLabel>Progress (%)</FormLabel>
                <FormControl><Input type="number" min="0" max="100" {...field} className="w-24" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </Card>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => append({ id: `sss-task-${Date.now()}`, title: '', status: 'PLANNED', progress: 0 })}>
        <Plus className="mr-2 h-4 w-4" /> Add Sub-of-Sub-Activity
      </Button>
    </div>
  );
}
