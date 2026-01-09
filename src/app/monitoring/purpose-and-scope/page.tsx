// src/app/monitoring/purpose-and-scope/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Project {
  projectId: string;
  projectName: string;
}

interface MonitoringPlan {
    projectId: string;
    monitoringActivities: any[];
}

export default function PurposeAndScopePage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [plan, setPlan] = useState<MonitoringPlan | null>(null);
    const [loading, setLoading] = useState({ projects: true, plan: false });

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to fetch projects");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);

    const handleProjectSelect = async (projectId: string) => {
        setSelectedProject(projectId);
        setPlan(null);
        if (!projectId) return;

        setLoading(prev => ({ ...prev, plan: true }));
        try {
            const res = await fetch(`/api/monitoring-plan?projectId=${projectId}`);
            if (res.ok) {
                setPlan(await res.json());
            } else if (res.status === 404) {
                 toast({ title: "No Plan Found", description: "No monitoring plan exists for this project. Create one to get started.", variant: 'default' });
            } else {
                throw new Error('Failed to fetch monitoring plan');
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(prev => ({ ...prev, plan: false }));
        }
    };
    
    const renderList = (text: string | undefined) => {
        if (!text) return null;
        return (
            <ul className="list-disc list-inside space-y-1">
                {text.split('\n').map((item, index) => item.trim() && <li key={index}>{item.replace(/^- /, '')}</li>)}
            </ul>
        )
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Purpose and Scope of M&E System</h1>
                    <p className="text-muted-foreground">View and manage the monitoring plans for your projects.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/monitoring">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to M&E Planning
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`/monitoring/purpose-and-scope/add`}>
                            <Plus className="mr-2 h-4 w-4" /> Add/Edit Plan
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select a Project</CardTitle>
                    <CardDescription>Choose a project to view its M&E purpose and scope plan.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Select onValueChange={handleProjectSelect} value={selectedProject} disabled={loading.projects}>
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
                </CardContent>
            </Card>

            {loading.plan && (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
            
            {plan && plan.monitoringActivities && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Monitoring Plan Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted hover:bg-muted">
                                        <TableHead className="w-1/4 text-primary font-bold">Main Activity</TableHead>
                                        <TableHead className="w-1/4 text-primary font-bold">Monitored Sub-Activities</TableHead>
                                        <TableHead className="text-primary font-bold">Responsible Person</TableHead>
                                        <TableHead className="text-primary font-bold">Monitoring Tools & Frequency</TableHead>
                                        <TableHead className="text-primary font-bold">Purpose and Scope</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {plan.monitoringActivities.map(activity => (
                                        <TableRow key={activity.mainActivityId} className="border-b-2 border-primary/20">
                                            <TableCell className="font-semibold align-top bg-primary/5">{activity.mainActivityTitle}</TableCell>
                                            <TableCell className="align-top">
                                                <ul className="list-disc list-inside">
                                                    {activity.monitoredSubActivities?.map((sub: string) => <li key={sub}>{sub}</li>)}
                                                </ul>
                                            </TableCell>
                                            <TableCell className="align-top text-sm">{renderList(activity.personResponsible)}</TableCell>
                                            <TableCell className="align-top text-sm">
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="font-semibold">Tools:</p>
                                                        <p>{activity.monitoringTools}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">Frequency:</p>
                                                        <p>{activity.monitoringFrequency}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top text-sm">{renderList(activity.purposeAndScope)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}