
// src/app/monitoring/data-collection/itt/page.tsx
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useIttData } from '@/hooks/use-itt-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Edit } from 'lucide-react';
import { ProjectInfo } from '@/components/itt/ProjectInfo';
import { ImpactCards } from '@/components/itt/ImpactCards';
import { IndicatorTable } from '@/components/itt/IndicatorTable';
import { Logframe } from '@/lib/logframe';

export default function ITTPage() {
    const { projects, selectedProject, logframe, indicatorPlan, trackingData, loading, selectProject } = useIttData();

    const enrichedIndicatorPlan = useMemo(() => {
        if (!indicatorPlan) return null;

        const trackingMap = new Map(trackingData?.indicators.map((i: any) => [i.indicatorId, i]));

        return {
            ...indicatorPlan,
            indicators: indicatorPlan.indicators.map(indicator => {
                const savedTrackingData = trackingMap.get(indicator.indicatorId);
                return savedTrackingData ? { ...indicator, ...savedTrackingData } : indicator;
            }),
        };

    }, [indicatorPlan, trackingData]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Indicator Tracking Table</h1>
                 <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/monitoring/data-collection">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Data Collection
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`/monitoring/data-collection/itt/edit?projectId=${selectedProject?.projectId || ''}`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Plan
                        </Link>
                    </Button>
                </div>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>Select Project</CardTitle>
                    <CardDescription>Choose a project to view its Indicator Tracking Table.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Select onValueChange={selectProject} value={selectedProject?.projectId || ''} disabled={loading.projects}>
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

            {loading.data ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>
            ) : selectedProject ? (
                 <div className="space-y-6">
                    <ProjectInfo project={selectedProject} />
                    <ImpactCards />
                    <IndicatorTable logframe={logframe} indicatorPlan={enrichedIndicatorPlan} />
                </div>
            ) : (
                <Card className="flex items-center justify-center h-40">
                    <p className="text-muted-foreground">Please select a project to view its ITT.</p>
                </Card>
            )}
        </div>
    );
}
