// src/app/project/plan/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GanttChart } from '@/components/gantt/GanttChart';
import { GanttTask } from '@/types/gantt';

interface Project {
  projectId: string;
  projectName: string;
  startDateMonth: string;
  startDateYear: string;
  endDateMonth: string;
  endDateYear: string;
}

const initialTasks: GanttTask[] = [
    { id: "task-1", title: "Project Kick-off & Planning", start: "2024-01-01", end: "2024-01-15", status: "DONE" },
    { id: "task-2", title: "Requirement Gathering", start: "2024-01-10", end: "2024-02-10", status: "IN_PROGRESS" },
    { id: "task-3", title: "Design & Prototyping", start: "2024-02-11", end: "2024-03-20", status: "IN_PROGRESS" },
    { id: "task-4", title: "Development Sprint 1", start: "2024-03-21", end: "2024-04-10", status: "PLANNED" },
    { id: "task-5", title: "User Acceptance Testing", start: "2024-04-11", end: "2024-04-30", status: "PLANNED" },
    { id: "task-6", title: "Deployment", start: "2024-05-01", end: "2024-05-05", status: "BLOCKED" }
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
                setTasks(data.tasks); // Assuming API returns { tasks: [...] }
            } else {
                // If no plan exists, start with initial tasks
                setTasks(initialTasks);
                toast({ title: "New Plan", description: "No existing plan found. Starting with a template."});
            }
        } catch (error) {
            console.error("Failed to fetch project plan", error);
            setTasks(initialTasks); // Fallback to initial tasks on error
        } finally {
            setLoading(prev => ({...prev, plan: false}));
        }
    };

    const handleSavePlan = async () => {
        if (!selectedProject) {
            toast({ title: "No Project Selected", description: "Please select a project before saving.", variant: "destructive"});
            return;
        }

        // Basic Validation
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
                <Button variant="outline" asChild>
                    <Link href="/project">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Hub
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select a Project</CardTitle>
                    <CardDescription>Choose a project to view or edit its Gantt chart plan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-center">
                        <Select onValueChange={handleProjectSelect} value={selectedProject?.projectId || ''} disabled={loading.projects}>
                            <SelectTrigger className="w-full md:w-1/2">
                                <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
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
                            Save & Submit
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {selectedProject && (
                <Card>
                    <CardHeader>
                        <CardTitle>Gantt Chart: {selectedProject.projectName}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading.plan ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <GanttChart 
                                tasks={tasks}
                                projectStart={projectDateRange.start}
                                projectEnd={projectDateRange.end}
                            />
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
