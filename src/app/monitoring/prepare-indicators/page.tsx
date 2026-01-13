
// src/app/monitoring/prepare-indicators/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Plus, Loader2 } from 'lucide-react';
import { Logframe } from '@/lib/logframe';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { IndicatorTrackingPlan } from '@/types/monitoring-indicators';

interface Project {
  projectId: string;
  projectName: string;
}

const renderTextWithBreaks = (text: string | undefined) => {
    if (!text) return null;
    return text.split('\n').map((line, index) => (
        <React.Fragment key={index}>
            {line}
            {index < text.split('\n').length - 1 && <br />}
        </React.Fragment>
    ));
}

interface GroupedData {
    goal: { description: string };
    outcome: { description: string; outputs: OutputGroup[] };
}

interface OutputGroup {
    description: string;
    activities: ActivityGroup[];
}

interface ActivityGroup {
    description: string;
    indicators: IndicatorWithUnits[];
}

interface IndicatorWithUnits {
    indicatorId: string;
    indicatorCode?: string;
    type?: '#' | '%';
    units: {
        unit: string;
        targeted: number;
        actual: number;
        percentage: number;
        dataSource: string;
        responsibilities: string;
    }[];
}

export default function PrepareIndicatorsPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [indicatorPlan, setIndicatorPlan] = useState<IndicatorTrackingPlan | null>(null);
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
                const [logframeRes, indicatorPlanRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/monitoring-indicators?projectId=${selectedProjectId}`)
                ]);

                if (logframeRes.ok) setLogframe(await logframeRes.json());
                else { setLogframe(null); toast({ title: "Logframe Not Found", description: "This project doesn't have a logical framework yet." }); }

                if (indicatorPlanRes.ok) setIndicatorPlan(await indicatorPlanRes.json());
                else setIndicatorPlan(null);

            } catch (error: any) {
                 toast({ title: "Error", description: "Failed to load project data.", variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, data: false}));
            }
        }
        fetchData();
    }, [selectedProjectId, toast]);

    const groupedData = useMemo((): GroupedData | null => {
        if (!logframe || !logframe.goal || !logframe.outcome) {
            return null;
        }

        const planMap = new Map(indicatorPlan?.indicators.map(p => [p.indicatorId, p]));

        return {
            goal: logframe.goal,
            outcome: {
                ...logframe.outcome,
                outputs: (logframe.outputs || []).map((output, oIdx) => ({
                    ...output,
                    activities: (output.activities || []).map((activity, aIdx) => ({
                        ...activity,
                        indicators: (activity.indicators || []).map((indicator, iIdx) => {
                            const planIndicator = planMap.get(indicator.description);
                            const units = planIndicator?.units || [];
                            return {
                                indicatorId: indicator.description,
                                indicatorCode: planIndicator?.indicatorCode || `${oIdx + 1}.${aIdx + 1}.${iIdx + 1}`,
                                type: planIndicator?.type || indicator.type,
                                units: units.map(u => ({...u, percentage: u.targeted > 0 ? (u.actual / u.targeted) * 100 : 0 }))
                            };
                        })
                    }))
                }))
            }
        };
    }, [logframe, indicatorPlan]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Monitoring Indicators</h1>
                    <p className="text-muted-foreground">View the detailed indicator tracking plan for each project.</p>
                </div>
                 <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/monitoring/data-collection">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`/monitoring/prepare-indicators/add?projectId=${selectedProjectId}`}>
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
            
            {groupedData && !loading.data && (
                <Card>
                    <CardHeader>
                        <CardTitle>{groupedData.goal.description}</CardTitle>
                        <CardDescription>{groupedData.outcome.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-primary text-primary-foreground">
                                        <TableHead className="font-bold text-primary-foreground">Indicator</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Code</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Type</TableHead>
                                        <TableHead className="w-[10%] font-bold text-primary-foreground">Unit</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Targeted</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Actual</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Percentage</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Data Sources</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Responsibilities</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedData.outcome.outputs.map((output, oIdx) => (
                                        <React.Fragment key={oIdx}>
                                            <TableRow className="bg-primary/10 hover:bg-primary/20">
                                                <TableCell colSpan={9} className="font-bold p-3">Output {oIdx + 1}: {output.description}</TableCell>
                                            </TableRow>
                                            {output.activities.map((activity, aIdx) => (
                                                <React.Fragment key={aIdx}>
                                                    <TableRow className="bg-muted/50 hover:bg-muted">
                                                        <TableCell colSpan={9} className="font-semibold p-3 pl-8">Activity {oIdx + 1}.{aIdx+1}: {activity.description}</TableCell>
                                                    </TableRow>
                                                    {activity.indicators.map((indicator, iIdx) => (
                                                        <React.Fragment key={iIdx}>
                                                            {indicator.units.map((unit, uIdx) => (
                                                                <TableRow key={uIdx}>
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="pl-12 font-medium align-top">{indicator.indicatorId}</TableCell>}
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="align-top font-mono">{indicator.indicatorCode}</TableCell>}
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="align-top font-mono">{indicator.type}</TableCell>}
                                                                    <TableCell>{unit.unit}</TableCell>
                                                                    <TableCell>{unit.targeted}</TableCell>
                                                                    <TableCell>{unit.actual}</TableCell>
                                                                    <TableCell>{unit.percentage.toFixed(2)}%</TableCell>
                                                                    <TableCell>{renderTextWithBreaks(unit.dataSource)}</TableCell>
                                                                    <TableCell>{renderTextWithBreaks(unit.responsibilities)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                             {indicator.units.length === 0 && (
                                                                <TableRow>
                                                                    <TableCell className="pl-12 font-medium">{indicator.indicatorId}</TableCell>
                                                                    <TableCell className="font-mono">{indicator.indicatorCode}</TableCell>
                                                                    <TableCell className="font-mono">{indicator.type}</TableCell>
                                                                    <TableCell colSpan={6} className="text-center text-muted-foreground">No units defined for this indicator.</TableCell>
                                                                </TableRow>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </React.Fragment>
                                            ))}
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

