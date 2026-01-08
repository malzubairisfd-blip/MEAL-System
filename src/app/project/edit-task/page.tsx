// src/app/project/edit-task/page.tsx
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
import { GanttTask, GanttTaskSchema } from '@/types/gantt';

interface Project {
  projectId: string;
  projectName: string;
}

const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const years = Array.from({ length: 21 }, (_, i) => String(new Date().getFullYear() - 10 + i));
const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));


export default function EditTaskPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const projectId = searchParams.get('projectId');
    const taskId = searchParams.get('taskId');

    const [project, setProject] = useState<Project | null>(null);
    const [allTasks, setAllTasks] = useState<GanttTask[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const form = useForm<GanttTask>({
        resolver: zodResolver(GanttTaskSchema),
    });

    useEffect(() => {
        if (!projectId) {
            toast({ title: "Error", description: "Project ID is missing.", variant: "destructive" });
            router.push('/project/plan');
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const [projRes, planRes] = await Promise.all([
                    fetch('/api/projects'),
                    fetch(`/api/project-plan?projectId=${projectId}`)
                ]);

                if (projRes.ok) {
                    const projects = await projRes.json();
                    setProject(projects.find((p: Project) => p.projectId === projectId) || null);
                }

                if (planRes.ok) {
                    const plan = await planRes.json();
                    const tasks = plan.tasks || [];
                    setAllTasks(tasks);

                    const findTaskRecursively = (tasksToSearch: any[], id: string): any | null => {
                        for (const task of tasksToSearch) {
                            if (task.id === id) return task;
                            if (task.subTasks) {
                                const found = findTaskRecursively(task.subTasks, id);
                                if (found) return found;
                            }
                             if (task.subOfSubTasks) {
                                const found = findTaskRecursively(task.subOfSubTasks, id);
                                if (found) return found;
                            }
                        }
                        return null;
                    };

                    const taskToEdit = taskId ? findTaskRecursively(tasks, taskId) : null;

                    if (taskToEdit) {
                        form.reset(taskToEdit);
                    } else if (taskId) {
                        toast({ title: "Error", description: `Task with ID "${taskId}" not found in this project.`, variant: "destructive"});
                    }
                }
            } catch (error: any) {
                 toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive"});
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectId, taskId, toast, router, form]);
    
    const { fields, append, remove, control } = useFieldArray({
      control: form.control,
      name: "subTasks" as never, // Using 'never' for nested compatibility
    });

    const onSubmit = async (data: GanttTask) => {
        if (!projectId || !taskId) return;

        setIsSaving(true);
        try {
             const updateTaskRecursively = (tasks: any[], id: string, updatedData: any): any[] => {
                return tasks.map(task => {
                    if (task.id === id) return updatedData;
                    if (task.subTasks) {
                        return { ...task, subTasks: updateTaskRecursively(task.subTasks, id, updatedData) };
                    }
                     if (task.subOfSubTasks) {
                        return { ...task, subOfSubTasks: updateTaskRecursively(task.subOfSubTasks, id, updatedData) };
                    }
                    return task;
                });
            };

            const updatedTasks = updateTaskRecursively(allTasks, taskId, data);

            const payload = { projectId, tasks: updatedTasks };
            const saveRes = await fetch('/api/project-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!saveRes.ok) throw new Error("Failed to save the updated task.");

            toast({ title: "Task Updated!", description: "The task has been successfully updated." });
            router.push(`/project/plan`);

        } catch (error: any) {
            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (loading) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Edit Task</h1>
                    <p className="text-muted-foreground">Editing task for project: {project?.projectName}</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/project/plan">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Plan
                    </Link>
                </Button>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <MainTaskItem control={control} index={0} remove={() => {}} isEditMode={true} />

                    <div className="flex justify-end">
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}

// Re-using components from add-task page for consistency
function MainTaskItem({ control, index, remove, isEditMode }: { control: any; index: number; remove: (index: number) => void, isEditMode?: boolean }) {
    const hasSubTasks = useWatch({ control, name: `hasSubTasks` });
    const title = useWatch({ control, name: `title` });

    return (
        <Card className="p-4 relative bg-slate-50 border-slate-200">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">Task Details: <span className="font-normal text-muted-foreground">{title}</span></h3>
                {!isEditMode && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-destructive"/>
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name={`title`}
                    render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel>Task Title</FormLabel>
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
                                <FormField control={control} name={`startDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`startMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`startYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={`endDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`endMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`endYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                    </div>
                 )}
                 <FormField
                    control={control}
                    name={`hasSubTasks`}
                    render={({ field }) => (
                        <FormItem className="col-span-2 space-y-3">
                            <FormLabel>Include Sub-Tasks?</FormLabel>
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
        name: `subTasks`
    });

    return (
        <div className="col-span-2 mt-4 pl-4 border-l-2 space-y-4">
            {fields.map((subField, subIndex) => (
                <SubTaskItem key={subField.id} control={control} taskIndex={taskIndex} subIndex={subIndex} remove={remove} />
            ))}
             <Button type="button" variant="secondary" size="sm" onClick={() => append({ id: `sub-task-${Date.now()}`, title: '', status: 'PLANNED', progress: 0, hasSubOfSubTasks: 'no' })}>
                <Plus className="mr-2 h-4 w-4" /> Add Sub-Task
            </Button>
        </div>
    );
}

function SubTaskItem({ control, taskIndex, subIndex, remove }: { control: any; taskIndex: number; subIndex: number; remove: (index: number) => void; }) {
    const hasSubOfSubTasks = useWatch({ control, name: `subTasks.${subIndex}.hasSubOfSubTasks` });
    const title = useWatch({ control, name: `subTasks.${subIndex}.title` });

    return (
        <Card className="p-4 bg-white relative">
             <div className="flex justify-between items-start mb-4">
                <h4 className="text-md font-semibold">Sub-Task {subIndex + 1}: <span className="font-normal text-muted-foreground">{title}</span></h4>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(subIndex)}>
                    <Trash2 className="h-4 w-4 text-destructive"/>
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name={`subTasks.${subIndex}.title`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Sub-Task Title</FormLabel><FormControl><Input {...field} maxLength={1000} /></FormControl><FormMessage /><div className="text-xs text-right text-muted-foreground">{field.value?.length || 0}/1000</div></FormItem>)} />
                
                 {hasSubOfSubTasks === 'no' && (
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={`subTasks.${subIndex}.startDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`subTasks.${subIndex}.startMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`subTasks.${subIndex}.startYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>End Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={`subTasks.${subIndex}.endDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`subTasks.${subIndex}.endMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`subTasks.${subIndex}.endYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                        <FormField control={control} name={`subTasks.${subIndex}.progress`} render={({ field }) => (<FormItem><FormLabel>Progress (%)</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} className="w-24" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                )}

                 <FormField
                    control={control}
                    name={`subTasks.${subIndex}.hasSubOfSubTasks`}
                    render={({ field }) => (
                        <FormItem className="col-span-2 space-y-3">
                            <FormLabel>Include Sub-of-Sub-Tasks?</FormLabel>
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
    name: `subTasks.${subIndex}.subOfSubTasks`
  });

  return (
    <div className="col-span-2 mt-4 pl-4 border-l-2 space-y-4">
      {fields.map((item, sssIndex) => (
        <Card key={item.id} className="p-4 bg-slate-50 relative">
          <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(sssIndex)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={control} name={`subTasks.${subIndex}.subOfSubTasks.${sssIndex}.title`} render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Sub-of-Sub-Task {sssIndex + 1}</FormLabel>
                <FormControl><Input {...field} maxLength={1000} /></FormControl>
                <FormMessage />
                <div className="text-xs text-right text-muted-foreground">{field.value?.length || 0}/1000</div>
              </FormItem>
            )} />
            <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField control={control} name={`subTasks.${subIndex}.subOfSubTasks.${sssIndex}.startDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={control} name={`subTasks.${subIndex}.subOfSubTasks.${sssIndex}.startMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={control} name={`subTasks.${subIndex}.subOfSubTasks.${sssIndex}.startYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField control={control} name={`subTasks.${subIndex}.subOfSubTasks.${sssIndex}.endDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={control} name={`subTasks.${subIndex}.subOfSubTasks.${sssIndex}.endMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={control} name={`subTasks.${subIndex}.subOfSubTasks.${sssIndex}.endYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                </div>
            </div>
            <FormField control={control} name={`subTasks.${subIndex}.subOfSubTasks.${sssIndex}.progress`} render={({ field }) => (
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
        <Plus className="mr-2 h-4 w-4" /> Add Sub-of-Sub-Task
      </Button>
    </div>
  );
}
