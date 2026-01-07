// src/app/project/plan/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import minMax from "dayjs/plugin/minMax";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { ArrowLeft, Loader2, Save, Calendar, Plus, ChevronDown, Filter, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GanttChart } from '@/components/gantt/GanttChart';
import { GanttTask, TaskStatus, GanttTaskSchema } from '@/types/gantt';

dayjs.extend(minMax);


interface Project {
  projectId: string;
  projectName: string;
  startDateMonth: string;
  startDateYear: string;
  endDateMonth: string;
  endDateYear: string;
}

const AddTasksFormSchema = z.object({
  tasks: z.array(GanttTaskSchema)
});

const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const years = Array.from({ length: 21 }, (_, i) => String(new Date().getFullYear() - 10 + i));
const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

export default function ProjectPlanPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<GanttTask[]>([]);
    const [loading, setLoading] = useState({ projects: true, plan: false });
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const form = useForm<z.infer<typeof AddTasksFormSchema>>({
        resolver: zodResolver(AddTasksFormSchema),
        defaultValues: { tasks: [] },
    });

    const { fields, append, remove, control } = useFieldArray({
      control: form.control,
      name: "tasks",
    });

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({...prev, projects: true}));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to fetch projects");
                const data = await res.json();
                setProjects(data);
            } catch (error) {
                console.error(error);
                toast({ title: "Error", description: "Could not load projects.", variant: "destructive" });
            } finally {
                 setLoading(prev => ({...prev, projects: false}));
            }
        };
        fetchProjects();
    }, [toast]);
    
    const handleProjectSelect = async (projectId: string) => {
        const project = projects.find(p => p.projectId === projectId);
        if (!project) return;
        
        setSelectedProject(project);
        setLoading(prev => ({...prev, plan: true}));
        try {
            const res = await fetch(`/api/project-plan?projectId=${projectId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.tasks && data.tasks.length > 0) {
                    setTasks(data.tasks);
                } else {
                    setTasks([]);
                }
            } else {
                setTasks([]);
                toast({ title: "New Plan", description: "No existing plan found. Add tasks to create one."});
            }
        } catch (error) {
            console.error("Failed to fetch project plan", error);
            setTasks([]);
        } finally {
            setLoading(prev => ({...prev, plan: false}));
        }
    };

    const handleSavePlan = async () => {
        if (!selectedProject) {
            toast({ title: "No Project Selected", description: "Please select a project before saving.", variant: "destructive"});
            return;
        }

        setIsSaving(true);
        try {
            const payload = { projectId: selectedProject.projectId, tasks };
            const res = await fetch('/api/project-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to save the plan.");
            }
            toast({ title: "Plan Saved!", description: `The project plan for "${selectedProject.projectName}" has been updated.`});
        } catch (error: any) {
             toast({ title: "Save Failed", description: error.message, variant: "destructive"});
        } finally {
            setIsSaving(false);
        }
    };
    
    const onAddTaskSubmit = (data: z.infer<typeof AddTasksFormSchema>) => {
        setTasks(prev => [...prev, ...data.tasks]);
        setIsModalOpen(false);
        form.reset({ tasks: [] });
    }
    
    const handleDeleteTask = useCallback((taskId: string) => {
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.filter(t => t.id !== taskId);
        if (updatedTasks.length < prevTasks.length) {
          return updatedTasks;
        }
        return prevTasks.map(mainTask => {
          if (mainTask.subTasks) {
            return {
              ...mainTask,
              subTasks: mainTask.subTasks.filter(st => st.id !== taskId),
            };
          }
          return mainTask;
        });
      });
    }, []);
    
    const handleUpdateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
        setTasks(prevTasks => 
            prevTasks.map(task => {
                if (task.id === taskId) {
                    return { ...task, status };
                }
                if (task.subTasks) {
                    return {
                        ...task,
                        subTasks: task.subTasks.map(subTask => 
                            subTask.id === taskId ? { ...subTask, status } : subTask
                        )
                    };
                }
                return task;
            })
        );
    }, []);
    
    const handleUpdateTaskProgress = useCallback((taskId: string, progress: number) => {
        const newProgress = Math.max(0, Math.min(100, progress));
        setTasks(prevTasks => 
            prevTasks.map(task => {
                 if (task.subTasks) {
                    const subTaskIndex = task.subTasks.findIndex(st => st.id === taskId);
                    if (subTaskIndex !== -1) {
                        const updatedSubTasks = [...task.subTasks];
                        updatedSubTasks[subTaskIndex] = { ...updatedSubTasks[subTaskIndex], progress: newProgress };
                        
                        const avgProgress = updatedSubTasks.reduce((acc, st) => acc + st.progress, 0) / updatedSubTasks.length;

                        return {
                            ...task,
                            progress: avgProgress,
                            subTasks: updatedSubTasks
                        };
                    }
                }
                if (task.id === taskId) {
                   return { ...task, progress: newProgress };
                }
                return task;
            })
        );
    }, []);

    const projectDateRange = useMemo(() => {
        if (!selectedProject) return { start: dayjs().startOf('year').format('YYYY-MM-DD'), end: dayjs().endOf('year').format('YYYY-MM-DD') };

        if (tasks.length === 0) {
            const start = `${selectedProject.startDateYear}-${selectedProject.startDateMonth.padStart(2, '0')}-01`;
            const endDay = new Date(Number(selectedProject.endDateYear), Number(selectedProject.endDateMonth), 0).getDate();
            const end = `${selectedProject.endDateYear}-${selectedProject.endDateMonth.padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
            return { start, end };
        }

        const allDates = tasks.flatMap(task => {
            const dates = [dayjs(task.start), dayjs(task.end)];
            if (task.subTasks) {
                task.subTasks.forEach(st => {
                    dates.push(dayjs(st.start));
                    dates.push(dayjs(st.end));
                });
            }
            return dates;
        });

        const minDate = dayjs.min(allDates) || dayjs(selectedProject.startDateYear);
        const maxDate = dayjs.max(allDates) || dayjs(selectedProject.endDateYear);

        return { start: minDate.startOf('month').format('YYYY-MM-DD'), end: maxDate.endOf('month').format('YYYY-MM-DD') };
        
    }, [selectedProject, tasks]);


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Project Plan</h1>
                <div className="flex gap-2">
                    <Select onValueChange={handleProjectSelect} value={selectedProject?.projectId || ''} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-72">
                            <SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.projectId} value={p.projectId}>
                                    {p.projectName} ({p.projectId})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Button onClick={handleSavePlan} disabled={isSaving || !selectedProject}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Save Plan
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/project">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Hub
                        </Link>
                    </Button>
                </div>
            </div>

            {selectedProject && (
                <div className='bg-slate-900 rounded-lg p-2'>
                    <div className='flex justify-between items-center mb-2 px-3 py-2'>
                        {/* Top Left Controls */}
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white">
                                <Calendar className="mr-2 h-4 w-4"/>
                                <span>March - May 2021</span>
                            </Button>
                            <Button variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white">
                                Today
                            </Button>
                            
                             <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                                <DialogTrigger asChild>
                                   <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add a new task
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                        <DialogTitle>Add New Tasks</DialogTitle>
                                    </DialogHeader>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onAddTaskSubmit)} className="space-y-6">
                                            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-4">
                                            {fields.map((field, index) => {
                                                return (
                                                  <MainTaskItem key={field.id} control={control} index={index} remove={remove} />
                                                )})}
                                            </div>
                                            <Button type="button" variant="outline" onClick={() => append({ id: `task-${Date.now()}`, title: "", hasSubTasks: 'no', status: 'PLANNED', progress: 0, subTasks: [] })}>
                                                <Plus className="mr-2 h-4 w-4"/> Add Another Task
                                            </Button>
                                            <DialogFooter>
                                                <Button type="submit">Save Tasks</Button>
                                            </DialogFooter>
                                        </form>
                                    </Form>
                                </DialogContent>
                            </Dialog>

                             <Button variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white">
                                <span>Export</span>
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                        {/* Top Right Controls */}
                         <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon"><Filter className="h-4 w-4"/></Button>
                            <Button variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white">3 months</Button>
                            <Button variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white">Year</Button>
                            <Button variant="outline" className="bg-blue-600 border-blue-500 text-white">Full project period</Button>
                        </div>
                    </div>
                    {loading.plan ? (
                        <div className="flex justify-center items-center h-96">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <GanttChart 
                            tasks={tasks}
                            projectStart={projectDateRange.start}
                            projectEnd={projectDateRange.end}
                            onDeleteTask={handleDeleteTask}
                            onUpdateTaskStatus={handleUpdateTaskStatus}
                            onUpdateTaskProgress={handleUpdateTaskProgress}
                        />
                    )}
                </div>
            )}
        </div>
    );
}


function MainTaskItem({ control, index, remove }: { control: any; index: number; remove: (index: number) => void }) {
    const hasSubTasks = useWatch({ control, name: `tasks.${index}.hasSubTasks` });

    return (
        <Card className="p-4 relative">
            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4"/>
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name={`tasks.${index}.title`}
                    render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel>Main Task {index + 1}</FormLabel>
                            <FormControl><Input {...field} maxLength={100} /></FormControl>
                            <FormMessage />
                            <div className="text-xs text-right text-muted-foreground">{field.value?.length || 0}/100</div>
                        </FormItem>
                    )}
                />
                 {hasSubTasks === 'no' && (
                    <>
                         <div className="grid grid-cols-3 gap-2">
                            <FormField control={control} name={`tasks.${index}.startDay`} render={({ field }) => (<FormItem><FormLabel>Start</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={control} name={`tasks.${index}.startMonth`} render={({ field }) => (<FormItem><FormLabel>&nbsp;</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={control} name={`tasks.${index}.startYear`} render={({ field }) => (<FormItem><FormLabel>&nbsp;</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <FormField control={control} name={`tasks.${index}.endDay`} render={({ field }) => (<FormItem><FormLabel>End</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={control} name={`tasks.${index}.endMonth`} render={({ field }) => (<FormItem><FormLabel>&nbsp;</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={control} name={`tasks.${index}.endYear`} render={({ field }) => (<FormItem><FormLabel>&nbsp;</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                    </>
                 )}
                 <FormField
                    control={control}
                    name={`tasks.${index}.hasSubTasks`}
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
        name: `tasks.${taskIndex}.subTasks`
    });

    return (
        <div className="col-span-2 mt-4 pl-4 border-l-2 space-y-4">
            {fields.map((subField, subIndex) => (
                <Card key={subField.id} className="p-4 bg-slate-50 relative">
                     <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(subIndex)}>
                        <Trash2 className="h-4 w-4 text-destructive"/>
                    </Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.title`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Sub-Task {subIndex + 1}</FormLabel><FormControl><Input {...field} maxLength={100} /></FormControl><FormMessage /><div className="text-xs text-right text-muted-foreground">{field.value?.length || 0}/100</div></FormItem>)} />
                        <div className="grid grid-cols-3 gap-2">
                             <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.startDay`} render={({ field }) => (<FormItem><FormLabel>Start</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                             <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.startMonth`} render={({ field }) => (<FormItem><FormLabel>&nbsp;</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                             <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.startYear`} render={({ field }) => (<FormItem><FormLabel>&nbsp;</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                             <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.endDay`} render={({ field }) => (<FormItem><FormLabel>End</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl><SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                             <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.endMonth`} render={({ field }) => (<FormItem><FormLabel>&nbsp;</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                             <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.endYear`} render={({ field }) => (<FormItem><FormLabel>&nbsp;</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={control} name={`tasks.${taskIndex}.subTasks.${subIndex}.progress`} render={({ field }) => (<FormItem><FormLabel>Progress (%)</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                </Card>
            ))}
             <Button type="button" variant="secondary" size="sm" onClick={() => append({ id: `sub-task-${Date.now()}`, title: '', status: 'PLANNED', progress: 0 })}>
                <Plus className="mr-2 h-4 w-4" /> Add Sub-Task
            </Button>
        </div>
    );
}
