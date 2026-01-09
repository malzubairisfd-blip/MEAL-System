
// src/app/project/edit-task/page.tsx
"use client";

import React, { useEffect, useState, Suspense, useMemo } from 'react';
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


function EditTaskPageContent() {
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
    const [activityNumber, setActivityNumber] = useState('');
    
    const form = useForm<GanttTask>({
        resolver: zodResolver(GanttTaskSchema),
        defaultValues: {
          hasSubTasks: 'no',
          subTasks: []
        }
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

                    const findTaskAndPath = (searchTasks: GanttTask[], id: string, parentPath = ''): { task: GanttTask, number: string } | null => {
                        for (let i = 0; i < searchTasks.length; i++) {
                            const task = searchTasks[i];
                            const currentNumber = parentPath ? `${parentPath}.${i + 1}` : `${i + 1}`;
                            if (task.id === id) {
                                return { task, number: currentNumber };
                            }
                            if (task.hasSubTasks === 'yes' && task.subTasks) {
                                const found = findTaskAndPath(task.subTasks, id, currentNumber);
                                if (found) return found;
                            }
                        }
                        return null;
                    };

                    const found = findTaskAndPath(tasks, taskId || '');
                    
                    if (found) {
                        const taskToEdit = found.task;
                        // Ensure subTasks is an array for the form
                        if (taskToEdit.hasSubTasks === 'yes' && !taskToEdit.subTasks) {
                            taskToEdit.subTasks = [];
                        }
                        form.reset(GanttTaskSchema.parse(taskToEdit));
                        setActivityNumber(found.number);
                    } else if(taskId) {
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
            const updatedTaskData = GanttTaskSchema.parse(data);

             const updateTaskRecursively = (tasks: GanttTask[], id: string, updatedData: GanttTask): GanttTask[] => {
                return tasks.map(task => {
                    if (task.id === id) {
                        return updatedData;
                    }
                    if (task.subTasks && task.hasSubTasks === 'yes') {
                        return { ...task, subTasks: updateTaskRecursively(task.subTasks, id, updatedData) };
                    }
                    return task;
                });
            };

            const updatedTasks = updateTaskRecursively(allTasks, taskId, updatedTaskData);

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

    if (!form.getValues().id) {
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
                     <RecursiveTaskItem control={control} index={-1} remove={() => {}} isEditMode={true} parentPath="" logframe={logframe} activityNumbering={activityNumber}/>

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

export default function EditTaskPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <EditTaskPageContent />
        </Suspense>
    )
}

function RecursiveTaskItem({ control, index, remove, isEditMode, parentPath, logframe, activityNumbering }: { control: any; index: number; remove: (index: number) => void; isEditMode?: boolean, parentPath: string, logframe: Logframe | null; activityNumbering: string; }) {
    const currentPath = index === -1 ? '' : (parentPath ? `${parentPath}.subTasks.${index}` : `tasks.${index}`);

    const hasSubTasks = useWatch({ control, name: currentPath ? `${currentPath}.hasSubTasks` : 'hasSubTasks' });
    
    const isTopLevel = !parentPath && index === -1;
    
    const selectedOutput = useWatch({ control, name: currentPath ? `${currentPath}.output` : 'output' });
    
    const filteredActivities = React.useMemo(() => {
        if (!logframe || !selectedOutput) return [];
        const output = logframe.outputs.find(o => o.description === selectedOutput);
        return output ? output.activities : [];
    }, [logframe, selectedOutput]);


    return (
        <Card className="p-4 relative bg-slate-50 border-slate-200" style={{ marginLeft: `${(parentPath.split('.subTasks').length -1) * 20}px` }}>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">{`Activity ${activityNumbering}`}</h3>
                {!isEditMode && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-destructive"/>
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {isTopLevel && logframe && (
                     <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>
                 )}
                 
                <FormField control={control} name={currentPath ? `${currentPath}.title` : 'title'} render={({ field }) => (
                    <FormItem className="col-span-2">
                        <FormLabel>{`Activity ${activityNumbering || ''} Title`}</FormLabel>
                        {isTopLevel && filteredActivities.length > 0 ? (
                             <Select onValueChange={field.onChange} value={field.value} disabled={!selectedOutput}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select Activity" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {filteredActivities.map((a, i) => <SelectItem key={i} value={a.description}>{a.description}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : (
                            <FormControl><Input placeholder={`Enter title for activity ${activityNumbering}...`} {...field} /></FormControl>
                        )}
                        <FormMessage/>
                    </FormItem>
                )} />

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
                            <FormLabel>{`Include Activity ${activityNumbering}.1?`}</FormLabel>
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
                <RecursiveTaskArray control={control} parentPath={currentPath} logframe={logframe} parentActivityNumber={activityNumbering} />
            )}
        </Card>
    )
}

function RecursiveTaskArray({ control, parentPath, logframe, parentActivityNumber }: { control: any; parentPath: string; logframe: Logframe | null; parentActivityNumber: string; }) {
    const name = parentPath ? `${parentPath}.subTasks` : 'subTasks';
    const { fields, append, remove } = useFieldArray({
        control,
        name
    });

    return (
        <div className="col-span-2 mt-4 space-y-4">
            {fields.map((subField, subIndex) => (
                <RecursiveTaskItem 
                    key={subField.id} 
                    control={control} 
                    index={subIndex} 
                    remove={remove}
                    isEditMode={false}
                    parentPath={name}
                    logframe={logframe}
                    activityNumbering={`${parentActivityNumber}.${subIndex + 1}`}
                />
            ))}
             <Button type="button" variant="secondary" size="sm" onClick={() => append({ id: `task-${Date.now()}`, title: '', hasSubTasks: 'no', status: 'PLANNED', progress: 0 })}>
                <Plus className="mr-2 h-4 w-4" /> Add Activity {`${parentActivityNumber}.${fields.length + 1}`}
            </Button>
        </div>
    );
}
