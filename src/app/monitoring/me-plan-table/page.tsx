// src/app/monitoring/me-plan-table/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Plus, Loader2 } from 'lucide-react';
import { Logframe } from '@/lib/logframe';
import { MEPlan, IndicatorPlan } from '@/types/me-plan';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Project {
  projectId: string;
  projectName: string;
}

const renderTextWithBreaks = (text: string) => {
    return text.split('\n').map((line, index) => (
        <React.Fragment key={index}>
            {line}
            {index < text.split('\n').length - 1 && <br />}
        </React.Fragment>
    ));
}

export default function MEPlanTablePage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [mePlan, setMePlan] = useState<MEPlan | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false });

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({...prev, projects: true}));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, projects: false}));
            }
        }
        fetchProjects();
    }, [toast]);
    
    useEffect(() => {
        if (!selectedProjectId) return;
        const fetchData = async () => {
            setLoading(prev => ({...prev, data: true}));
            try {
                const [logframeRes, mePlanRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/me-plan?projectId=${selectedProjectId}`)
                ]);

                if (logframeRes.ok) {
                    setLogframe(await logframeRes.json());
                } else {
                    setLogframe(null);
                    toast({ title: "Logframe Not Found", description: "This project doesn't have a logical framework yet." });
                }

                if (mePlanRes.ok) {
                    setMePlan(await mePlanRes.json());
                } else {
                    setMePlan(null);
                }

            } catch (error: any) {
                 toast({ title: "Error", description: "Failed to load project data.", variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, data: false}));
            }
        }
        fetchData();
    }, [selectedProjectId, toast]);

    const indicatorsWithPlan = useMemo(() => {
        if (!logframe) return [];
        const planMap = new Map(mePlan?.indicators.map(p => [p.indicatorId, p]));
        
        return logframe.outputs.flatMap(output => 
            output.activities.flatMap(activity => 
                activity.indicators.map(indicator => ({
                    ...indicator,
                    activityDescription: activity.description,
                    outputDescription: output.description,
                    plan: planMap.get(indicator.description) || {}
                }))
            )
        );
    }, [logframe, mePlan]);


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">M&E Plan Table</h1>
                    <p className="text-muted-foreground">View the detailed Monitoring & Evaluation plan for each project.</p>
                </div>
                 <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/monitoring/data-collection">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`/monitoring/me-plan-table/add?projectId=${selectedProjectId}`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit/Create Plan
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select a Project</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {loading.data && <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            
            {logframe && !loading.data && (
                <Card>
                    <CardHeader>
                        <CardTitle>{logframe.goal.description}</CardTitle>
                        <CardDescription>{logframe.outcome.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted">
                                        <TableHead className="w-[15%]">Output/Activity</TableHead>
                                        <TableHead className="w-[15%]">Indicator</TableHead>
                                        <TableHead>Indicator Definition</TableHead>
                                        <TableHead>Data Collection</TableHead>
                                        <TableHead>Frequency</TableHead>
                                        <TableHead>Responsibilities</TableHead>
                                        <TableHead>Information Use</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {indicatorsWithPlan.map((item, index) => (
                                        <React.Fragment key={index}>
                                            <TableRow className="bg-blue-50 hover:bg-blue-100">
                                                <TableCell colSpan={7} className="font-bold p-3">Output: {item.outputDescription}</TableCell>
                                            </TableRow>
                                            <TableRow className="bg-slate-50 hover:bg-slate-100">
                                                <TableCell colSpan={7} className="font-semibold p-3 pl-8">Activity: {item.activityDescription}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="pl-12">{item.description}</TableCell>
                                                <TableCell><b>Target:</b> {item.target} ({item.type})<br/><b>MoV:</b> {item.meansOfVerification.join(', ')}</TableCell>
                                                <TableCell>{renderTextWithBreaks(item.plan.definition || '')}</TableCell>
                                                <TableCell>{renderTextWithBreaks(item.plan.collectionMethods || '')}</TableCell>
                                                <TableCell>{renderTextWithBreaks(item.plan.frequency || '')}</TableCell>
                                                <TableCell>{renderTextWithBreaks(item.plan.responsibilities || '')}</TableCell>
                                                <TableCell>{renderTextWithBreaks(item.plan.informationUse || '')}</TableCell>
                                            </TableRow>
                                        </React.Fragment>
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
