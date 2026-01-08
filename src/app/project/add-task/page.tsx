// src/app/project/add-task/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
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
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [existingTasksCount, setExistingTasksCount] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    
    const form = useForm<z.infer<typeof AddTasksFormSchema>>({
        resolver: zodResolver(AddTasksFormSchema),
        defaultValues: { tasks: [] },
    });
    
    useEffect(() => {
        if(form.getValues('tasks').length === 0 && existingTasksCount >= 0) {
             form.reset({ tasks: [{ id: `task-${Date.now()}`, title: "", hasSubTasks: 'no', status: 'PLANNED', progress: 0 }] });
        }
    }, [existingTasksCount, form]);

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

    useEffect(() => {
        if (!selectedProjectId) {
            setLogframe(null);
            setExistingTasksCount(0);
            return;
        }
        const fetchProjectData = async () => {
            try {
                const [logframeRes, planRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/project-plan?projectId=${selectedProjectId}`)
                ]);

                if (logframeRes.ok) {
                    setLogframe(await logframeRes.json());
                } else {
                    setLogframe(null);
                    toast({ title: "Logframe not found", description: "No logical framework found for this project.", variant: "default" });
                }
                
                if (planRes.ok) {
                    const plan = await planRes.json();
                    setExistingTasksCount(plan.tasks?.length || 0);
                } else {
                    setExistingTasksCount(0);
                }
            } catch (error) {
                setLogframe(null);
                setExistingTasksCount(0);
                console.error("Failed to fetch project data", error);
            }
        };
        fetchProjectData();
    }, [selectedProjectId, toast]);

    const onAddTaskSubmit = async (data: z.infer<typeof AddTasksFormSchema>) => {
        if (!selectedProjectId) {
            toast({ title: "Project Not Selected", description: "Please select a project first.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const existingPlanRes = await fetch(`/api/project-plan?projectId=${selectedProjectId}`);
            let existingTasks: GanttTask[] = [];
            if (existingPlanRes.ok) {
                const existingPlan = await existingPlanRes.json();
                existingTasks = existingPlan.tasks || [];
            }
            
            const validatedNewTasks = data.tasks.map(task => GanttTaskSchema.parse(task));
            const updatedTasks = [...existingTasks, ...validatedNewTasks];

            const payload = { projectId: selectedProjectId, tasks: updatedTasks };
            const saveRes = await fetch('/api/project-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!saveRes.ok) throw new Error("Failed to save the new activities.");

            toast({ title: "Activities Added!", description: "The new activities have been added to the project plan." });
            router.push(`/project/plan?projectId=${selectedProjectId}`);

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
                    <Link href={`/project/plan?projectId=${selectedProjectId}`}>
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
                                <SelectTrigger>
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
                            <RecursiveTaskItem 
                                key={field.id} 
                                control={control} 
                                index={index} 
                                remove={remove}
                                parentPath=""
                                logframe={logframe}
                                baseActivityNumber={existingTasksCount + index + 1}
                            />
                        ))}
                    </div>

                    <div className="flex justify-between">
                         <Button type="button" variant="outline" onClick={() => append({ id: `task-${Date.now()}`, title: "", hasSubTasks: 'no', status: 'PLANNED', progress: 0 })}>
                            <Plus className="mr-2 h-4 w-4"/> {`Add Activity ${existingTasksCount + fields.length + 1}`}
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

function RecursiveTaskItem({ control, index, remove, parentPath, logframe, baseActivityNumber }: { control: any; index: number; remove: (index: number) => void; parentPath: string; logframe: Logframe | null; baseActivityNumber?: number; }) {
    const currentPath = parentPath ? `${parentPath}.subTasks.${index}` : `tasks.${index}`;
    
    const activityNumbering = useMemo(() => {
        if(parentPath){
            const parentParts = parentPath.split('.').filter(p => p !== 'tasks' && p !== 'subTasks');
            // This logic is getting complex, needs to be robust
            const parentIndex = parentParts[0];
            const parentNumber = baseActivityNumber ? `${baseActivityNumber-1}.${parseInt(parentIndex, 10)+1}` : `${parseInt(parentIndex, 10)+1}`;
            let currentNumbering = parentNumber;
            for(let i=1; i<parentParts.length; i++) {
                currentNumbering += `.${parseInt(parentParts[i], 10)+1}`;
            }
            return `${currentNumbering}.${index + 1}`;
        }
        return `${baseActivityNumber || index + 1}`;
    }, [parentPath, index, baseActivityNumber]);
    
    const hasSubTasks = useWatch({ control, name: `${currentPath}.hasSubTasks` });
    
    const isTopLevel = !parentPath;
    const selectedOutcome = useWatch({ control, name: `${currentPath}.outcome`, disabled: !isTopLevel });
    const selectedOutput = useWatch({ control, name: `${currentPath}.output`, disabled: !isTopLevel });

    const filteredActivities = useMemo(() => {
        if (!logframe || !selectedOutput) return [];
        const output = logframe.outputs.find(o => o.description === selectedOutput);
        return output ? output.activities : [];
    }, [logframe, selectedOutput]);


    return (
        <Card className="p-4 relative bg-slate-50 border-slate-200" style={{ marginLeft: `${(parentPath.split('subTasks').length -1) * 20}px` }}>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">{`Activity ${activityNumbering}`}</h3>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive"/>
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {isTopLevel && logframe && (
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                       <FormField control={control} name={`${currentPath}.outcome`} render={({ field }) => (
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
                        <FormField control={control} name={`${currentPath}.output`} render={({ field }) => (
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
                <FormField control={control} name={`${currentPath}.title`} render={({ field }) => (
                   <FormItem className="col-span-2">
                       <FormLabel>{`Activity ${activityNumbering} Title`}</FormLabel>
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
                                <FormField control={control} name={`${currentPath}.startDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`${currentPath}.startMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`${currentPath}.startYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={control} name={`${currentPath}.endDay`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`${currentPath}.endMonth`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`${currentPath}.endYear`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                         <FormField control={control} name={`${currentPath}.progress`} render={({ field }) => (<FormItem><FormLabel>Progress (%)</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} className="w-24" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                 )}
                 <FormField
                    control={control}
                    name={`${currentPath}.hasSubTasks`}
                    render={({ field }) => (
                        <FormItem className="col-span-2 space-y-3">
                            <FormLabel>{`Include Activity ${activityNumbering}.1?`}</FormLabel>
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
                <RecursiveTaskArray control={control} parentPath={currentPath} logframe={logframe} parentActivityNumber={activityNumbering} />
            )}
        </Card>
    )
}

function RecursiveTaskArray({ control, parentPath, logframe, parentActivityNumber }: { control: any; parentPath: string; logframe: Logframe | null; parentActivityNumber: string; }) {
    const name = parentPath ? `${parentPath}.subTasks` : 'tasks';
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
                    parentPath={name}
                    logframe={logframe}
                />
            ))}
             <Button type="button" variant="secondary" size="sm" onClick={() => append({ id: `task-${Date.now()}`, title: '', hasSubTasks: 'no', status: 'PLANNED', progress: 0 })}>
                <Plus className="mr-2 h-4 w-4" /> Add Activity {`${parentActivityNumber}.${fields.length + 1}`}
            </Button>
        </div>
    );
}
