// src/app/project/plan/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, Calendar, Plus, ChevronDown, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GanttChart } from '@/components/gantt/GanttChart';
import { GanttTask, TaskStatus } from '@/types/gantt';

interface Project {
  projectId: string;
  projectName: string;
  startDateMonth: string;
  startDateYear: string;
  endDateMonth: string;
  endDateYear: string;
}

const initialTasks: GanttTask[] = [
    { id: "task-1", title: "Planning design course", start: "2024-03-01", end: "2024-03-10", status: "DONE" },
    { id: "task-1.1", parentId: "task-1", title: "Create a roadmap", start: "2024-03-08", end: "2024-03-15", status: "DONE" },
    { id: "task-1.2", parentId: "task-1", title: "Find an editor", start: "2024-03-12", end: "2024-03-18", status: "DONE" },
    { id: "task-2", title: "Planning design course", start: "2024-03-15", end: "2024-04-12", status: "IN_PROGRESS" },
    { id: "task-2.1", parentId: "task-2", title: "Shoot 1-12 lessons", start: "2024-03-25", end: "2024-05-12", status: "IN_PROGRESS" },
    { id: "task-2.2", parentId: "task-2", title: "Prepare assignments for 1-12 lessons", start: "2024-04-15", end: "2024-04-28", status: "DONE" },
    { id: "task-3", title: "Finding ways to sell my course", start: "2024-05-10", end: "2024-06-20", status: "PLANNED" },
    { id: "task-4", title: "Plan a budget", start: "2024-04-20", end: "2024-04-30", status: "EXPECTS_PLANNING"},
    { id: "task-5", title: "Buy AD on instagram w/Sasha", start: "2024-05-01", end: "2024-05-15", status: "BLOCKED"},
];

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
                    setTasks(initialTasks);
                }
            } else {
                setTasks(initialTasks);
                toast({ title: "New Plan", description: "No existing plan found. Starting with a template."});
            }
        } catch (error) {
            console.error("Failed to fetch project plan", error);
            setTasks(initialTasks);
        } finally {
            setLoading(prev => ({...prev, plan: false}));
        }
    };

    const handleSavePlan = async () => {
        if (!selectedProject) {
            toast({ title: "No Project Selected", description: "Please select a project before saving.", variant: "destructive"});
            return;
        }
        if (tasks.some(t => !t.id || !t.title || !t.start || !t.end || !t.status)) {
            toast({ title: "Incomplete Data", description: "One or more tasks are missing required fields.", variant: "destructive"});
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

    const projectDateRange = useMemo(() => {
        if (!selectedProject) return { start: "2024-01-01", end: "2024-12-31" };
        const start = `${selectedProject.startDateYear}-${selectedProject.startDateMonth.padStart(2, '0')}-01`;
        const endDay = new Date(Number(selectedProject.endDateYear), Number(selectedProject.endDateMonth), 0).getDate();
        const end = `${selectedProject.endDateYear}-${selectedProject.endDateMonth.padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
        return { start, end };
    }, [selectedProject]);


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
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Plus className="mr-2 h-4 w-4" />
                                Add a new task
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
                        />
                    )}
                </div>
            )}
        </div>
    );
}
