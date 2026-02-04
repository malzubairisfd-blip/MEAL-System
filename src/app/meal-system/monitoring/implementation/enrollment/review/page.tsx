// src/app/meal-system/monitoring/implementation/enrollment/review/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';

interface Project {
  projectId: string;
  projectName: string;
}

export default function EnrollmentReviewPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        const fetchProjects = async () => {
            setLoadingProjects(true);
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                const data = await res.json();
                setProjects(Array.isArray(data) ? data : []);
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoadingProjects(false);
            }
        };
        fetchProjects();
    }, [toast]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Enrollment Management Review</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/enrollment">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Enrollment Management
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>1. Select Project</CardTitle>
                    <CardDescription>Choose the project you want to work with.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loadingProjects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loadingProjects ? "Loading projects..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>2. Upload Document</CardTitle>
                    <CardDescription>Upload the relevant document for enrollment review (e.g., xls, xlsx, xlsm, xlsb, csv, txt).</CardDescription>
                </CardHeader>
                <CardContent>
                    <label htmlFor="file-upload" className="flex-1">
                        <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                                <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                                {file ? (
                                    <p className="font-semibold text-primary">{file.name}</p>
                                ) : (
                                    <>
                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                        <p className="text-xs text-muted-foreground">XLS, XLSX, XLSM, XLSB, CSV, TXT</p>
                                    </>
                                )}
                            </div>
                            <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />
                        </div>
                    </label>
                </CardContent>
            </Card>

        </div>
    );
}
