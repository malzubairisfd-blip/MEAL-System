// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/export/page.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Loader2, File as FileIcon, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';
import { exportConfirmationPdfs } from '@/lib/confirmationchildcmam-export';

interface Project {
    projectId: string;
    projectName: string;
}

export default function ExportCmamStatementsPage() {
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const { toast } = useToast();

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            }
        };
        fetchProjects();
    }, [toast]);

    const handleDownload = async (isSample = false) => {
        if (!selectedProjectId) {
            toast({ title: "No Project Selected", description: "Please select a project to generate statements for.", variant: "destructive" });
            return;
        }

        setLoading(true);
        toast({title: "Generating...", description: "Your download will begin shortly. This may take a moment."})

        try {
            await exportConfirmationPdfs(selectedProjectId, isSample);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Export CMAM Statements</h1>
                 <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Confirmation Hub
                    </Link>
                </Button>
            </div>

            <Card className="w-full max-w-lg mx-auto">
                <CardHeader>
                    <CardTitle className="text-center text-xl">Generate PDF Statements</CardTitle>
                    <CardDescription className="text-center">
                        Generate PDF statements for all confirmed CMAM cases, grouped by health center, worker, and educator.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select Project</label>
                         <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a project..." />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map(p => (
                                    <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            size="lg"
                            onClick={() => handleDownload(false)}
                            disabled={loading || !selectedProjectId}
                            className="w-full"
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            {loading ? "Generating..." : "Download All Statements (ZIP)"}
                        </Button>
                         <Button
                            size="lg"
                            variant="outline"
                            onClick={() => handleDownload(true)}
                            disabled={loading || !selectedProjectId}
                        >
                            <FileIcon className="mr-2 h-4 w-4" />
                            Download Sample
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
