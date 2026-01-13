// src/app/monitoring/purpose-and-scope/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, Edit, FileDown, Layers, Users, SlidersHorizontal, CheckSquare, Sigma } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateWordDocument } from '@/lib/exportToWord';


interface Project {
  projectId: string;
  projectName: string;
}

interface MonitoringActivity {
  mainActivityId: string;
  mainActivityTitle: string;
  monitoredSubActivities: string[];
  personResponsible: string;
  monitoringTools: string;
  monitoringFrequency: string;
  purposeAndScope: string;
  estimatedBudget: number;
}

interface MonitoringPlan {
    projectId: string;
    monitoringActivities: MonitoringActivity[];
}

const KPICard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <Card className="transition-all hover:shadow-md hover:-translate-y-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);


export default function PurposeAndScopePage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [plan, setPlan] = useState<MonitoringPlan | null>(null);
    const [loading, setLoading] = useState({ projects: true, plan: false });
    const [isExporting, setIsExporting] = useState(false);

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
            const res = await fetch(`/api/purpose-and-scope?projectId=${projectId}`);
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
    
    const handleExport = async () => {
        if (!plan) return;
        setIsExporting(true);
        try {
            await generateWordDocument(plan);
            toast({ title: "Export Successful", description: "The Word document has been generated and downloaded." });
        } catch (error: any) {
            toast({ title: "Export Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsExporting(false);
        }
    };

    const renderListFromString = (text: string | undefined) => {
      if (!text) return null;
      return (
        <ul className="list-disc list-inside space-y-1 pl-4">
          {text.split('\n').map((item, index) => item.trim() && <li key={index}>{item.replace(/^- /, '')}</li>)}
        </ul>
      );
    };

    const totalMonitoredSubActivities = plan?.monitoringActivities.reduce((acc, act) => acc + (act.monitoredSubActivities?.length || 0), 0) || 0;
    const totalBudget = plan?.monitoringActivities.reduce((acc, act) => acc + (Number(act.estimatedBudget) || 0), 0) || 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Purpose and Scope of M&E System</h1>
                    <p className="text-muted-foreground">View and manage the monitoring plans for your projects.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/meal-system/monitoring/initiation-and-planning">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to M&E Planning
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`/meal-system/monitoring/initiation-and-planning/purpose-and-scope/add`}>
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
                <CardContent className="flex items-center gap-4">
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
                     {plan && (
                         <Button onClick={handleExport} disabled={isExporting}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4" />}
                            Export to Word
                        </Button>
                     )}
                </CardContent>
            </Card>

            {loading.plan && (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
            
            {plan && plan.monitoringActivities && (
                 <div className="document-view bg-white text-black p-8 rounded-lg shadow-lg border">
                    <h2 className="text-2xl font-bold text-center mb-6">Monitoring & Evaluation Plan</h2>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                       <KPICard title="Main Activities" value={plan.monitoringActivities.length} icon={<Layers className="text-blue-500" />}/>
                       <KPICard title="Monitored Sub-Activities" value={totalMonitoredSubActivities} icon={<CheckSquare className="text-green-500" />}/>
                       <KPICard title="Total M&E Budget" value={`$${totalBudget.toLocaleString()}`} icon={<Sigma className="text-purple-500" />}/>
                    </div>

                    {plan.monitoringActivities.map((activity, index) => (
                        <div key={activity.mainActivityId} className="activity-section mb-8">
                            <h3 className="text-xl font-bold border-b-2 border-primary pb-2 mb-4">
                                Main Activity {index + 1}: {activity.mainActivityTitle}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2"><CheckSquare className="text-green-600"/> Activities to be Monitored ({activity.monitoredSubActivities?.length || 0})</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {activity.monitoredSubActivities && activity.monitoredSubActivities.length > 0 ? (
                                            <ul className="list-decimal list-inside space-y-1">
                                                {activity.monitoredSubActivities.map(sub => <li key={sub}>{sub}</li>)}
                                            </ul>
                                        ) : <p className="text-muted-foreground">No sub-activities selected.</p>}
                                    </CardContent>
                                </Card>
                                 <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2"><Users className="text-blue-600"/> Person Responsible for Monitoring</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                       {renderListFromString(activity.personResponsible)}
                                    </CardContent>
                                </Card>
                                 <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2"><SlidersHorizontal className="text-orange-600"/> Monitoring Tools & Frequency</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <h4 className="font-semibold">Tools Used:</h4>
                                        <p className="mb-2 text-muted-foreground">{activity.monitoringTools}</p>
                                        <h4 className="font-semibold">Frequency:</h4>
                                        <p className="text-muted-foreground">{activity.monitoringFrequency}</p>
                                    </CardContent>
                                </Card>
                                 <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2"><Layers className="text-purple-600"/> Purpose and Scope</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {renderListFromString(activity.purposeAndScope)}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    ))}
                 </div>
            )}
        </div>
    );
}
