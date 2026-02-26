// src/app/meal-system/monitoring/implementation/enrollment/review/download/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface Project {
  projectId: string;
  projectName: string;
}

export default function DownloadEnrollmentPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState({ projects: true, generating: false });
    const [status, setStatus] = useState("Idle");
    const [progress, setProgress] = useState(0);

    const workerRef = React.useRef<Worker | null>(null);

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();

        // Initialize worker
        const worker = new Worker(new URL('@/workers/enrollment-export.worker.ts', import.meta.url));
        workerRef.current = worker;

        worker.onmessage = (event) => {
            const { type, status: workerStatus, progress: workerProgress, data, error } = event.data;
            if (type === 'progress') {
                setStatus(workerStatus);
                setProgress(workerProgress);
            } else if (type === 'done') {
                const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Enrollment_Review_Report_${selectedProjectId}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                toast({ title: "Success", description: "File downloaded successfully." });
                setLoading(prev => ({ ...prev, generating: false }));
            } else if (type === 'error') {
                toast({ title: "Worker Error", description: error, variant: "destructive" });
                setLoading(prev => ({ ...prev, generating: false }));
            }
        };

        worker.onerror = (err) => {
            toast({ title: "Worker Initialization Error", description: err.message, variant: "destructive" });
            setLoading(prev => ({ ...prev, generating: false }));
        };

        return () => worker.current?.terminate();

    }, [toast, selectedProjectId]);


    const handleProjectSelect = (projectId: string) => {
        setSelectedProjectId(projectId);
        const project = projects.find(p => p.projectId === projectId);
        setSelectedProject(project || null);
    };

    const handleGenerate = () => {
        if (!selectedProject) {
            toast({ title: "No Project Selected", description: "Please select a project.", variant: "destructive" });
            return;
        }

        if (!workerRef.current) {
            toast({ title: "Error", description: "Export worker is not available.", variant: "destructive" });
            return;
        }

        setLoading(prev => ({ ...prev, generating: true }));
        setStatus("Initializing...");
        setProgress(0);
        
        workerRef.current.postMessage({ projectId: selectedProject.projectId, projectName: selectedProject.projectName });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Download Enrollment Reports</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/enrollment/review">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Review Hub
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>1. Select Project</CardTitle>
                    <CardDescription>Select the project for which you want to generate the Excel report.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Select onValueChange={handleProjectSelect} value={selectedProjectId} disabled={loading.projects || loading.generating}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading.projects ? "Loading projects..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     {selectedProject && (
                        <div className="mt-4 p-4 border rounded-lg bg-muted/50 text-sm">
                            <p><strong>Project ID:</strong> {selectedProject.projectId}</p>
                            <p><strong>Project Name:</strong> {selectedProject.projectName}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>2. Generate & Download</CardTitle>
                    <CardDescription>Click the button below to start generating your multi-sheet Excel file.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleGenerate} disabled={!selectedProjectId || loading.generating}>
                        {loading.generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        {loading.generating ? `Generating... (${status})` : "Generate & Download Report"}
                    </Button>
                    {loading.generating && (
                        <div className="space-y-1">
                            <Progress value={progress} />
                            <p className="text-sm text-center mt-1 text-muted-foreground">
                                {status}...
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
