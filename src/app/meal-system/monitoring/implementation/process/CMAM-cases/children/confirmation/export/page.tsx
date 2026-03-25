// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/export/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Loader2, File as FileIcon, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';
import { saveAs } from "file-saver";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


// --- Types ---
interface Project {
    projectId: string;
    projectName: string;
}

interface HealthCenterGroup {
    hc_id: string;
    hc_name: string;
    count: number;
    records: any[];
}


// --- Page Component ---

export default function ExportCmamStatementsPage() {
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [allData, setAllData] = useState<any[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        fetch('/api/projects').then(res => res.json())
        .then(data => setProjects(data || []))
        .catch(err => {
            toast({ title: "Error loading initial assets", description: err.message, variant: "destructive" });
        }).finally(() => setLoading(false));
    }, [toast]);
    
    useEffect(() => {
        if (!selectedProjectId) {
            setAllData([]);
            return;
        }
        setLoading(true);
        fetch(`/api/child-cmam?projectId=${selectedProjectId}`)
            .then(res => res.json())
            .then(data => setAllData(Array.isArray(data) ? data : []))
            .catch(err => toast({ title: "Error loading data", description: err.message, variant: "destructive" }))
            .finally(() => setLoading(false));
    }, [selectedProjectId, toast]);

    const healthCenterGroups = useMemo((): HealthCenterGroup[] => {
        if (!allData.length) return [];
        const qualified = allData.filter(r => r.child_has_cmam === 'نعم');
        const groups: Record<string, { hc_name: string, records: any[] }> = {};
        
        for (const record of qualified) {
            const hc_id = record.hc_id || 'UNKNOWN';
            if (!groups[hc_id]) {
                groups[hc_id] = { hc_name: record.hc_name || 'Unknown Center', records: [] };
            }
            groups[hc_id].records.push(record);
        }
        
        return Object.entries(groups).map(([hc_id, data]) => ({
            hc_id,
            hc_name: data.hc_name,
            count: data.records.length,
            records: data.records
        })).sort((a,b) => a.hc_name.localeCompare(b.hc_name));

    }, [allData]);

    const handleDownload = async (records: any[], asZip: boolean, fileName: string) => {
        setActionLoading(fileName);
        toast({title: "Generating...", description: `Your download for ${fileName} will begin shortly.`});

        try {
            const res = await fetch('/api/child-cmam-confirmation-export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records, asZip })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'PDF Generation failed on server');
            }

            const blob = await res.blob();
            saveAs(blob, fileName);
            toast({ title: "Success", description: "Download complete." });

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setActionLoading(null);
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

            <Card className="w-full max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-xl">Generate PDF Statements</CardTitle>
                    <CardDescription>
                        Generate PDF statements for all confirmed CMAM cases, grouped by health center.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">1. Select Project</label>
                         <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading}>
                            <SelectTrigger>
                                <SelectValue placeholder={loading ? "Loading..." : "Select a project..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map(p => (
                                    <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedProjectId && (loading ? <div className="text-center p-8"><Loader2 className="animate-spin"/></div> :
                    <>
                        <div className="flex gap-2">
                             <Button
                                size="lg"
                                onClick={() => handleDownload(allData.filter(r => r.child_has_cmam === 'نعم'), true, `CMAM_Confirmations_${selectedProjectId}.zip`)}
                                disabled={actionLoading !== null || healthCenterGroups.length === 0}
                                className="w-full"
                            >
                                {actionLoading === `CMAM_Confirmations_${selectedProjectId}.zip` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Download All as ZIP ({healthCenterGroups.length} Centers)
                            </Button>
                             <Button
                                size="lg"
                                variant="outline"
                                onClick={() => handleDownload([allData.filter(r => r.child_has_cmam === 'نعم')[0]], false, `CMAM_Sample_${selectedProjectId}.pdf`)}
                                disabled={actionLoading !== null || healthCenterGroups.length === 0}
                            >
                                <FileIcon className="mr-2 h-4 w-4" />
                                Download Sample PDF
                            </Button>
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="font-semibold">Download by Health Center</h3>
                             <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Health Center</TableHead>
                                            <TableHead># of Children</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {healthCenterGroups.map(group => (
                                            <TableRow key={group.hc_id}>
                                                <TableCell>{group.hc_name} ({group.hc_id})</TableCell>
                                                <TableCell>{group.count}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={actionLoading !== null}
                                                        onClick={() => handleDownload(group.records, true, `CMAM_${group.hc_id}.zip`)}
                                                    >
                                                        {actionLoading === `CMAM_${group.hc_id}.zip` ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </div>
                        </div>
                    </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
