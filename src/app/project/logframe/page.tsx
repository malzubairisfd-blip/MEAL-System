
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logframe } from '@/lib/logframe';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';


interface Project {
  projectId: string;
  projectName: string;
}

export default function LogicalFrameworkDashboardPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [logframes, setLogframes] = useState<Logframe[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [projRes, logRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/logframe')
            ]);
            if (projRes.ok) {
                const data = await projRes.json();
                setProjects(Array.isArray(data) ? data : []);
            }
            if (logRes.ok) {
                const data = await logRes.json();
                setLogframes(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async () => {
        if (!selectedProject) return;
        try {
            const response = await fetch(`/api/logframe`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: selectedProject })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete logframe');
            }

            toast({
                title: "Logframe Deleted",
                description: "The logical framework has been successfully deleted.",
            });
            
            setSelectedProject(''); // Reset selection
            fetchData(); // Refetch data
        } catch (error: any) {
            toast({
                title: "Deletion Failed",
                description: error.message,
                variant: 'destructive',
            });
        }
    };


    const selectedLogframe = useMemo(() => {
        if (!selectedProject) return null;
        return logframes.find(lf => lf.projectId === selectedProject);
    }, [selectedProject, logframes]);

    const renderTextWithLineBreaks = (text: string) => {
        return text.split('\n').map((line, index) => (
            <React.Fragment key={index}>
                {line}
                <br />
            </React.Fragment>
        ));
    };

    const hasProjects = projects.length > 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <div>
                    <h1 className="text-3xl font-bold">Logical Framework</h1>
                    <p className="text-muted-foreground">View existing frameworks or create a new one.</p>
                </div>
                 <div className='flex gap-2'>
                    <Button variant="outline" asChild>
                        <Link href="/meal-system">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to MEAL System
                        </Link>
                    </Button>
                    <Button asChild disabled={!hasProjects} title={!hasProjects ? "Please create a project first" : ""}>
                        <Link href="/project/logframe/add">
                            <Plus className="mr-2 h-4 w-4" /> Add New Logical Framework
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select a Project to View its Logframe</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className='flex items-center gap-2 text-muted-foreground'>
                            <Loader2 className="h-4 w-4 animate-spin"/> Loading projects...
                        </div>
                    ) : hasProjects ? (
                        <div className="flex items-center gap-4">
                            <Select onValueChange={setSelectedProject} value={selectedProject}>
                                <SelectTrigger className="w-full md:w-1/2">
                                    <SelectValue placeholder="Select a project..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => (
                                        <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedLogframe && (
                                <div className="flex gap-2">
                                    <Button asChild variant="outline">
                                        <Link href={`/project/logframe/edit?projectId=${selectedProject}`}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                        </Link>
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive">
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the logical framework for this project.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No projects found. Please add a project from the Project Dashboard to begin.</p>
                    )}
                </CardContent>
            </Card>

            {selectedProject && (
                <Card>
                    <CardHeader>
                        <CardTitle>Logical Framework Details</CardTitle>
                        <CardDescription>Displaying the logical framework for the selected project.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className='flex items-center justify-center h-40'><Loader2 className="h-8 w-8 animate-spin"/></div>
                        ) : selectedLogframe ? (
                             <div className="border rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-primary text-primary-foreground">
                                        <tr>
                                            <th className="p-3 text-left w-1/4 font-bold text-primary-foreground">Title</th>
                                            <th className="p-3 text-left font-bold text-primary-foreground">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b">
                                            <td className="p-3 font-semibold bg-primary/10 align-top">PROJECT GOAL</td>
                                            <td className="p-3">{renderTextWithLineBreaks(selectedLogframe.goal.description)}</td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="p-3 font-semibold bg-primary/10 align-top">OUTCOME</td>
                                            <td className="p-3">{renderTextWithLineBreaks(selectedLogframe.outcome.description)}</td>
                                        </tr>
                                        {selectedLogframe.outputs.map((output, oIdx) => (
                                            <React.Fragment key={oIdx}>
                                                <tr className="border-b">
                                                    <td className="p-3 font-semibold bg-primary/10 align-top">OUTPUT {oIdx + 1}</td>
                                                    <td className="p-3">{renderTextWithLineBreaks(output.description)}</td>
                                                </tr>
                                                {output.activities.map((activity, aIdx) => (
                                                     <React.Fragment key={aIdx}>
                                                        <tr className="border-b bg-muted/50">
                                                            <td className="p-3 pl-8 font-semibold align-top">ACTIVITY {oIdx + 1}.{aIdx + 1}</td>
                                                            <td className="p-3">{renderTextWithLineBreaks(activity.description)}</td>
                                                        </tr>
                                                         {activity.indicators.map((indicator, iIdx) => (
                                                            <tr key={iIdx} className="border-b text-xs">
                                                                <td className="p-2 pl-12 align-top text-muted-foreground">INDICATOR</td>
                                                                <td className="p-2">
                                                                    <div><strong>Description:</strong> {indicator.description}</div>
                                                                    <div><strong>Target:</strong> {indicator.target} ({indicator.type})</div>
                                                                    <div><strong>MoV:</strong> {indicator.meansOfVerification.join(', ')}</div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {activity.risksAndAssumptions.map((risk, rIdx) => (
                                                            <React.Fragment key={rIdx}>
                                                                <tr className="border-b text-xs">
                                                                    <td className="p-2 pl-12 align-top text-muted-foreground">RISK</td>
                                                                    <td className="p-2">{risk.risk}</td>
                                                                </tr>
                                                                <tr className="border-b text-xs">
                                                                    <td className="p-2 pl-12 align-top text-muted-foreground">ASSUMPTION</td>
                                                                    <td className="p-2">{risk.assumption}</td>
                                                                </tr>
                                                             </React.Fragment>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-10">
                                <p>No logical framework found for this project.</p>
                                <Button variant="link" asChild><Link href="/project/logframe/add">Create one now</Link></Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

    