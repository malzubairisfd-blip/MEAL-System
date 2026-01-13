
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
import { MEPlan, IndicatorPlan } from '@/types/monitoring-plan';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { IndicatorTrackingPlan, IndicatorUnit } from '@/types/monitoring-indicators';

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
    indicators: IndicatorWithPlan[];
}

interface IndicatorWithPlan {
    description: string;
    type: '#' | '%';
    meansOfVerification: string[];
    plan?: Partial<IndicatorPlan>;
    units: IndicatorUnit[];
}

export default function MEPlanTablePage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [mePlan, setMePlan] = useState<MEPlan | null>(null);
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
                const [logframeRes, mePlanRes, indicatorPlanRes] = await Promise.all([
                    fetch(`/api/logframe?projectId=${selectedProjectId}`),
                    fetch(`/api/monitoring-plan?projectId=${selectedProjectId}`),
                    fetch(`/api/monitoring-indicators?projectId=${selectedProjectId}`)
                ]);

                if (logframeRes.ok) setLogframe(await logframeRes.json());
                else setLogframe(null);

                if (mePlanRes.ok) setMePlan(await mePlanRes.json());
                else setMePlan(null);

                if(indicatorPlanRes.ok) setIndicatorPlan(await indicatorPlanRes.json());
                else setIndicatorPlan(null);


            } catch (error: any) {
                 toast({ title: "Error", description: "Failed to load project data.", variant: 'destructive' });
            } finally {
                setLoading(prev => ({...prev, data: false}));
            }
        }
        fetchData();
    }, [selectedProjectId, toast]);

    const groupedData = useMemo(() => {
        if (!indicatorPlan || !indicatorPlan.indicators) return null;

        const mePlanMap = new Map(mePlan?.indicators.map(p => [p.indicatorId, p]));
        
        const hierarchy: { [outcome: string]: { [output: string]: { [activity: string]: any[] } } } = {};

        indicatorPlan.indicators.forEach(indicator => {
            const outcomeKey = indicator.outcome || 'Uncategorized';
            const outputKey = indicator.output || 'Uncategorized';
            const activityKey = indicator.activity || 'Uncategorized';

            if (!hierarchy[outcomeKey]) hierarchy[outcomeKey] = {};
            if (!hierarchy[outcomeKey][outputKey]) hierarchy[outcomeKey][outputKey] = {};
            if (!hierarchy[outcomeKey][outputKey][activityKey]) hierarchy[outcomeKey][outputKey][activityKey] = [];

            hierarchy[outcomeKey][outputKey][activityKey].push({
                description: indicator.indicatorId,
                type: indicator.type,
                meansOfVerification: [], // This info is not in monitoring-indicators.json, but the schema requires it.
                plan: mePlanMap.get(indicator.indicatorId),
                units: indicator.units || [],
            });
        });
        
        const finalOutputs: OutputGroup[] = Object.entries(hierarchy[logframe?.outcome.description || "Uncategorized"] || {}).map(([outputKey, activities]) => ({
            description: outputKey,
            activities: Object.entries(activities).map(([activityKey, indicators]) => ({
                description: activityKey,
                indicators: indicators as IndicatorWithPlan[]
            }))
        }));

        return {
            goal: logframe?.goal || { description: "Project Goal" },
            outcome: {
                description: logframe?.outcome.description || "Project Outcome",
                outputs: finalOutputs
            }
        };

    }, [indicatorPlan, mePlan, logframe]);


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
                                        <TableHead className="w-[15%] font-bold text-primary-foreground">Output/Activity/Indicator</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Unit</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Target</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">MoV</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Indicator Definition</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Data Collection</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Frequency</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Responsibilities</TableHead>
                                        <TableHead className="font-bold text-primary-foreground">Information Use</TableHead>
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
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="pl-12 font-medium align-top">{indicator.description}</TableCell>}
                                                                    <TableCell>{unit.unit}</TableCell>
                                                                    <TableCell>{indicator.type === '%' ? `${unit.targeted}%` : unit.targeted}</TableCell>
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.meansOfVerification.join(', ')}</TableCell>}
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{renderTextWithBreaks(indicator.plan?.definition)}</TableCell>}
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{renderTextWithBreaks(indicator.plan?.collectionMethods)}</TableCell>}
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{renderTextWithBreaks(indicator.plan?.frequency)}</TableCell>}
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{renderTextWithBreaks(indicator.plan?.responsibilities)}</TableCell>}
                                                                    {uIdx === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{renderTextWithBreaks(indicator.plan?.informationUse)}</TableCell>}
                                                                </TableRow>
                                                            ))}
                                                             {indicator.units.length === 0 && (
                                                                <TableRow>
                                                                    <TableCell className="pl-12 font-medium">{indicator.description}</TableCell>
                                                                    <TableCell colSpan={8} className="text-center text-muted-foreground">No units defined for this indicator.</TableCell>
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
