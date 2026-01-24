// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Project {
  projectId: string;
  projectName: string;
  districts: string[];
}

interface Center {
    id: number;
    project_id: string;
    project_name: string;
    proj_no: number;
    mud_no: number;
    mud_name: string;
    ozla_no: number;
    ozla_name: string;
    vill_no: number;
    vill_name: string;
    fac_id: string;
    fac_name: string;
    loc_id: number;
    loc_full_name: string;
    is_ec: number;
    is_pc: number;
    pc_id: string;
    notes: string;
    pc_name2: string;
    is_pc2: number;
    pc_loc2: number;
    same_ozla: number;
    same_ec_pc: number;
    pc_ec_cnt: number;
    pc_ed_cnt: number;
    ec_ed_cnt: number;
    pc_bnf_cnt: number;
    ec_bnf_cnt: number;
}


export default function CenterModificationPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [centers, setCenters] = useState<Center[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('all');
    const [loading, setLoading] = useState({ projects: true, centers: false });
    const [deletingCenterId, setDeletingCenterId] = useState<string | null>(null);

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);
    
    useEffect(() => {
        const fetchCenters = async () => {
            setLoading(prev => ({ ...prev, centers: true }));
            try {
                const url = `/api/education-payment-centers?projectId=${selectedProjectId}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error("Failed to load centers data.");
                setCenters(await res.json());
            } catch (error: any) {
                setCenters([]); // Clear centers on error
                toast({ title: "Error loading centers", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, centers: false }));
            }
        };

        fetchCenters();
    }, [selectedProjectId, toast]);

    const handleDelete = async () => {
        if (!deletingCenterId) return;
        try {
            const response = await fetch('/api/education-payment-centers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ FAC_ID: deletingCenterId }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to delete center');
            toast({ title: "Center Deleted", description: "The center has been removed." });
            setCenters(prev => prev.filter(c => c.fac_id !== deletingCenterId));
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setDeletingCenterId(null);
        }
    };
    
    const tableHeaders = [ "id", "project_id", "project_name", "proj_no", "mud_no", "mud_name", "ozla_no", "ozla_name", "vill_no", "vill_name", "fac_id", "fac_name", "loc_id", "loc_full_name", "is_ec", "is_pc", "pc_id", "notes", "pc_name2", "is_pc2", "pc_loc2", "same_ozla", "same_ec_pc", "pc_ec_cnt", "pc_ed_cnt", "ec_ed_cnt", "pc_bnf_cnt", "ec_bnf_cnt" ];


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Education and Payment Centers</h1>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/add-center">
                            <Plus className="mr-2 h-4 w-4" /> Add New Center
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filter by Project</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Projects</SelectItem>
                            {projects.map(p => (
                                <SelectItem key={p.projectId} value={p.projectId}>{p.projectName} ({p.projectId})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Centers List</CardTitle>
                    <CardDescription>Displaying centers for the selected project.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading.centers ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Actions</TableHead>
                                        {tableHeaders.map(header => <TableHead key={header}>{header.replace(/_/g, ' ').toUpperCase()}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {centers.map((center, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="sticky left-0 bg-card z-10">
                                                <div className="flex gap-1">
                                                    <Button variant="outline" size="icon" asChild>
                                                        <Link href={`/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/edit-center?FAC_ID=${center.fac_id}`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button variant="destructive" size="icon" onClick={() => setDeletingCenterId(center.fac_id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            {tableHeaders.map(header => {
                                                const value = (center as any)[header];
                                                let displayValue;
                                                if (header === 'is_ec' || header === 'is_pc') {
                                                    displayValue = value === 1 ? 'Yes' : (value === 0 ? 'No' : '');
                                                } else {
                                                    displayValue = String(value ?? '');
                                                }
                                                return (
                                                    <TableCell key={header}>
                                                        {displayValue}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                             {centers.length === 0 && <p className="p-4 text-center text-muted-foreground">No centers found for the selected project criteria.</p>}
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <AlertDialog open={!!deletingCenterId} onOpenChange={() => setDeletingCenterId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the center. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
