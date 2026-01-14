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
  S: number;
  PROJ_NO: number;
  MUD_NO: number;
  MUD_NAME: string;
  OZLA_NO: number;
  OZLA_NAME: string;
  VILL_NAME: string;
  FAC_ID: string;
  FAC_NAME: string;
  LOC_ID: string;
  LOC_FULL_NAME: string;
  IS_EC: string;
  IS_PC: number;
  PC_ID: string;
  NOTES: string;
  PC_NAME2: string;
  IS_PC2: number;
  PC_LOC2: string;
  SAME_OZLA: boolean;
  same_ec_pc: boolean;
  pc_ec_cnt: number;
  pc_ed_cnt: number;
  ec_ed_cnt: number;
  pc_bnf_cnt: number;
  ec_bnf_cnt: number;
  Notes2: string;
}

export default function CenterModificationPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [centers, setCenters] = useState<Center[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('all');
    const [loading, setLoading] = useState({ projects: true, centers: true });
    const [deletingCenterId, setDeletingCenterId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading({ projects: true, centers: true });
        try {
            const [projRes, centerRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/education-payment-centers')
            ]);

            if (projRes.ok) setProjects(await projRes.json());
            else throw new Error("Failed to load projects");
            
            if (centerRes.ok) setCenters(await centerRes.json());
            else setCenters([]);
            
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading({ projects: false, centers: false });
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
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
            setCenters(prev => prev.filter(c => c.FAC_ID !== deletingCenterId));
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setDeletingCenterId(null);
        }
    };

    const filteredCenters = useMemo(() => {
        if (selectedProjectId === 'all') {
            return centers;
        }
        const selectedProject = projects.find(p => p.projectId === selectedProjectId);
        if (!selectedProject) return [];
        
        return centers.filter(center => 
            selectedProject.districts.includes(center.MUD_NAME)
        );
    }, [selectedProjectId, projects, centers]);

    const tableHeaders = [ "S", "PROJ_NO", "MUD_NO", "MUD_NAME", "OZLA_NO", "OZLA_NAME", "VILL_NAME", "FAC_ID", "FAC_NAME", "LOC_ID", "LOC_FULL_NAME", "IS_EC", "IS_PC", "PC_ID", "NOTES", "PC_NAME2", "IS_PC2", "PC_LOC2", "SAME_OZLA", "same_ec_pc", "pc_ec_cnt", "pc_ed_cnt", "ec_ed_cnt", "pc_bnf_cnt", "ec_bnf_cnt", "Notes2" ];


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
                    <CardDescription>Displaying centers based on the selected project's districts.</CardDescription>
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
                                        {tableHeaders.map(header => <TableHead key={header}>{header}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCenters.map((center, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="sticky left-0 bg-card z-10">
                                                <div className="flex gap-1">
                                                    <Button variant="outline" size="icon" asChild>
                                                        <Link href={`/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/edit-center?FAC_ID=${center.FAC_ID}`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button variant="destructive" size="icon" onClick={() => setDeletingCenterId(center.FAC_ID)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            {tableHeaders.map(header => (
                                                <TableCell key={header}>
                                                    {String((center as any)[header] ?? '')}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                             {filteredCenters.length === 0 && <p className="p-4 text-center text-muted-foreground">No centers found for the selected project criteria.</p>}
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

