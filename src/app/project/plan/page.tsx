// src/app/project/plan/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, Calendar, Plus, ChevronDown, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GanttChart } from '@/components/gantt/GanttChart';
import { GanttTask, TaskStatus } from '@/types/gantt';
import dayjs from "dayjs";
import minMax from "dayjs/plugin/minMax";

dayjs.extend(minMax);


interface Project {
  projectId: string;
  projectName: string;
  startDateMonth: string;
  startDateYear: string;
  endDateMonth: string;
  endDateYear: string;
}

const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

export default function ProjectPlanPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<GanttTask[]>([]);
    const [loading, setLoading] = useState({ projects: true, plan: false });
    const [isSaving, setIsSaving] = useState(false);

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
                            
                             <Button className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                                <Link href={`/project/add-task?projectId=${selectedProject.projectId}`}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add a new task
                                </Link>
                            </Button>

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
