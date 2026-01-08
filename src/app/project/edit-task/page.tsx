// src/app/project/edit-task/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';

import { ArrowLeft, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GanttTask, GanttTaskSchema } from '@/types/gantt';
import { Logframe } from '@/lib/logframe';

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
    const [logframe, setLogframe] = useState<Logframe | null>(null);
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
                const [projRes, planRes, logframeRes] = await Promise.all([
                    fetch('/api/projects'),
                    fetch(`/api/project-plan?projectId=${projectId}`),
                    fetch(`/api/logframe?projectId=${projectId}`)
                ]);

                if (projRes.ok) {
                    const projects = await projRes.json();
                    setProject(projects.find((p: Project) => p.projectId === projectId) || null);
                }

                if (logframeRes.ok) {
                    setLogframe(await logframeRes.json());
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
    
    const { control } = form;

    const onSubmit = async (data: GanttTask) => {
        if (!projectId || !taskId) return;

        setIsSaving(true);
        try {
             const updateTaskRecursively = (tasks: GanttTask[], id: string, updatedData: GanttTask): GanttTask[] => {
                return tasks.map(task => {
                    if (task.id === id) {
                        // Use zod to parse and transform the data, ensuring start/end dates are calculated
                        return GanttTaskSchema.parse(updatedData);
                    }
                    if (task.subTasks) {
                        return { ...task, subTasks: updateTaskRecursively(task.subTasks, id, updatedData) };
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

            toast({ title: "Activity Updated!", description: "The activity has been successfully updated." });
            router.push(`/project/plan`);

        } catch (error: any) {
            console.error("Save error details:", error)
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
                    <h1 className="text-3xl font-bold">Edit Activity</h1>
                    <p className="text-muted-foreground">Editing activity for project: {project?.projectName}</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/project/plan">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Plan
                    </Link>
                </Button>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <RecursiveTaskItem control={control} index={-1} remove={() => {}} isEditMode={true} pathPrefix="" logframe={logframe}/>

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

function RecursiveTaskItem({ control, index, remove, isEditMode, pathPrefix, logframe }: { control: any; index: number; remove: (index: number) => void; isEditMode?: boolean, pathPrefix: string, logframe: Logframe | null }) {
    const currentPath = index === -1 ? '' : (pathPrefix ? `${pathPrefix}.${index}` : `${index}`);

    const hasSubTasks = useWatch({ control, name: currentPath ? `${currentPath}.hasSubTasks` : 'hasSubTasks' });
    const selectedOutcome = useWatch({ control, name: currentPath ? `${currentPath}.outcome` : 'outcome' });
    const selectedOutput = useWatch({ control, name: currentPath ? `${currentPath}.output` : 'output' });

    const activityNumber = (pathPrefix.split('.').filter(p => p !== 'tasks' && p !== 'subTasks').map(p => parseInt(p) + 1).join('.') + (index !== -1 ? `.${index + 1}` : '')).replace(/^\./, '');


    const filteredActivities = React.useMemo(() => {
        if (!logframe || !selectedOutput) return [];
        const output = logframe.outputs.find(o => o.description === selectedOutput);
        return output ? output.activities : [];
    }, [logframe, selectedOutput]);


    return (
        <Card className="p-4 relative bg-slate-50 border-slate-200" style={{ marginLeft: `${(pathPrefix.split('.').filter(p => p === 'subTasks').length) * 20}px` }}>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">Activity {activityNumber || 'Details'}</h3>
                {!isEditMode && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-destructive"/>
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {logframe && index === -1 && (
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField control={control} name="goal" render={({ field }) => (
                           <FormItem>
                               <FormLabel>Project Goal</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                   <FormControl><SelectTrigger><SelectValue placeholder="Select Goal" /></SelectTrigger></FormControl>
                                   <SelectContent>
                                       <SelectItem value={logframe.goal.description}>{logframe.goal.description}</SelectItem>
                                   </SelectContent>
                               </Select>
                           </FormItem>
                       )} />
                    </div>
                )}
                 {logframe && (
                     <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                       <FormField control={control} name={currentPath ? `${currentPath}.outcome` : 'outcome'} render={({ field }) => (
                           <FormItem>
                               <FormLabel>Outcome</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                   <FormControl><SelectTrigger><SelectValue placeholder="Select Outcome" /></SelectTrigger></FormControl>
                                   <SelectContent>
                                       <SelectItem value={logframe.outcome.description}>{logframe.outcome.description}</SelectItem>
                                   </SelectContent>
                               </Select>
                           </FormItem>
                       )} />
                        <FormField control={control} name={currentPath ? `${currentPath}.output` : 'output'} render={({ field }) => (
                           <FormItem>
                               <FormLabel>Output</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                   <FormControl><SelectTrigger><SelectValue placeholder="Select Output" /></SelectTrigger></FormControl>
                                   <SelectContent>
                                       {logframe.outputs.map((o, i) => <SelectItem key={i} value={o.description}>{o.description}</SelectItem>)}
                                   </SelectContent>
                               </Select>
                           </FormItem>
                       )} />
                        <FormField control={control} name={currentPath ? `${currentPath}.title` : 'title'} render={({ field }) => (
                           <FormItem>
                               <FormLabel>Activity</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value} disabled={!selectedOutput}>
                                   <FormControl><SelectTrigger><SelectValue placeholder="Select Activity" /></SelectTrigger></FormControl>
                                   <SelectContent>
                                       {filteredActivities.map((a, i) => <SelectItem key={i} value={a.description}>{a.description}</SelectItem>)}
                                   </SelectContent>
                               </Select>
                               <FormMessage/>
                           </FormItem>
                       )} />
                    </div>
                 )}
                 {hasSubTasks === 'no' && (
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={currentPath ? `${currentPath}.startDay` : 'startDay'} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={currentPath ? `${currentPath}.startMonth` : 'startMonth'} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={currentPath ? `${currentPath}.startYear` : 'startYear'} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={currentPath ? `${currentPath}.endDay` : 'endDay'} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={currentPath ? `${currentPath}.endMonth` : 'endMonth'} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={currentPath ? `${currentPath}.endYear` : 'endYear'} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                         <FormField control={control} name={currentPath ? `${currentPath}.progress` : 'progress'} render={({ field }) => (<FormItem><FormLabel>Progress (%)</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} className="w-24" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                 )}
                 <FormField
                    control={control}
                    name={currentPath ? `${currentPath}.hasSubTasks` : 'hasSubTasks'}
                    render={({ field }) => (
                        <FormItem className="col-span-2 space-y-3">
                            <FormLabel>Include Activity {activityNumber ? `${activityNumber}.1` : '1.1'}?</FormLabel>
                            <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    value={field.value}
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
                <RecursiveTaskArray control={control} pathPrefix={currentPath} logframe={logframe} />
            )}
        </Card>
    )
}

function RecursiveTaskArray({ control, pathPrefix, logframe }: { control: any; pathPrefix: string, logframe: Logframe | null }) {
    const name = pathPrefix ? `${pathPrefix}.subTasks` : 'subTasks';
    const { fields, append, remove } = useFieldArray({
        control,
        name
    });

    const parentActivityNumber = (pathPrefix.split('.').filter(p => p !== 'tasks' && p !== 'subTasks' && !isNaN(parseInt(p))).map(p => parseInt(p) + 1).join('.') + (pathPrefix.endsWith('subTasks') ? '' : `.${(parseInt(pathPrefix.split('.').pop() || '-1') + 1)}`)).replace(/^\./, '');


    return (
        <div className="col-span-2 mt-4 space-y-4">
            {fields.map((subField, subIndex) => (
                <RecursiveTaskItem 
                    key={subField.id} 
                    control={control} 
                    index={subIndex} 
                    remove={remove}
                    pathPrefix={name}
                    logframe={logframe}
                />
            ))}
             <Button type="button" variant="secondary" size="sm" onClick={() => append({ id: `task-${Date.now()}`, title: '', hasSubTasks: 'no', status: 'PLANNED', progress: 0 })}>
                <Plus className="mr-2 h-4 w-4" /> Add Activity {parentActivityNumber}.{fields.length + 1}
            </Button>
        </div>
    );
}
