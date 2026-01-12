// src/app/monitoring/data-collection/itt/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { useIttData } from '@/hooks/use-itt-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ProjectInfo } from '@/components/itt/ProjectInfo';
import { ImpactCards } from '@/components/itt/ImpactCards';
import { IndicatorTable } from '@/components/itt/IndicatorTable';

export default function ITTPage() {
    const { projects, selectedProject, logframe, indicatorPlan, loading, selectProject } = useIttData();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Indicator Tracking Table</h1>
                 <Button variant="outline" asChild>
                    <Link href="/monitoring/data-collection">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Data Collection
                    </Link>
                </Button>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>Select Project</CardTitle>
                    <CardDescription>Choose a project to view its Indicator Tracking Table.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Select onValueChange={selectProject} disabled={loading.projects}>
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
                    <IndicatorTable logframe={logframe} indicatorPlan={indicatorPlan} />
                </div>
            ) : (
                <Card className="flex items-center justify-center h-40">
                    <p className="text-muted-foreground">Please select a project to view its ITT.</p>
                </Card>
            )}
        </div>
    );
}
