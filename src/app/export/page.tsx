
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2, XCircle, CheckCircle, Database, Users, Upload, Microscope, ClipboardList, BarChartHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { loadCachedResult } from "@/lib/cache";


type DownloadVersion = {
    id: string;
    fileName: string;
    version: number;
    createdAt: string;
    blob: Blob;
};

type GenerationStep = "enriching" | "sorting" | "sheets" | "audit" | "summary" | "done";
const allSteps: GenerationStep[] = ["enriching", "sorting", "sheets", "audit", "summary"];

const stepDescriptions: Record<GenerationStep, string> = {
    enriching: "Enriching data with cluster info...",
    sorting: "Sorting records for the report...",
    sheets: "Creating main data sheet...",
    audit: "Creating audit findings sheet...",
    summary: "Creating summary and cluster sheets...",
    done: "Done"
};


export default function ExportPage() {
    // Component State
    const [initialLoading, setInitialLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<GenerationStep>>(new Set());

    const { toast } = useToast();

    // Data State
    const [downloadHistory, setDownloadHistory] = useState<DownloadVersion[]>([]);
    const [recordCount, setRecordCount] = useState(0);
    const [clusterCount, setClusterCount] = useState(0);
    
    useEffect(() => {
        let alive = true;

        const poll = async () => {
            try {
                const res = await loadCachedResult();
                if (!alive) return;

                if (res.status === "READY") {
                    const data = res.data;
                    const rows = data.rows || [];
                    const clusters = data.clusters || [];
                    
                    setRecordCount(rows.length);
                    setClusterCount(clusters.length);

                    if (rows.length > 0) {
                        setIsReady(true);
                    } else {
                        toast({ title: "No Records Found", description: "The cached data is empty. Please re-upload your file.", variant: "destructive" });
                        setIsReady(false);
                    }
                    setInitialLoading(false);
                } else if (res.status === "LOADING") {
                    setTimeout(poll, 1000); // Wait for cache
                } else {
                    toast({ title: "No Data", description: "Please upload data first.", variant: "destructive" });
                    setInitialLoading(false);
                    setIsReady(false);
                }
            } catch (error: any) {
                if (!alive) return;
                setIsReady(false);
                setInitialLoading(false);
                toast({ title: "Error Loading Data", description: error.message, variant: "destructive" });
            }
        };

        poll();

        return () => { alive = false; };
    }, [toast]);
    
    const runSimulatedProgress = () => {
        setLoading(true);
        setCompletedSteps(new Set());
        setProgress(0);

        let stepIndex = 0;
        const interval = setInterval(() => {
            if (stepIndex < allSteps.length) {
                setCompletedSteps(prev => new Set(prev).add(allSteps[stepIndex]));
                setProgress((prev) => prev + (100 / (allSteps.length + 1)));
                stepIndex++;
            } else {
                clearInterval(interval);
            }
        }, 800); // Simulate each step taking time

        return () => clearInterval(interval);
    }
    
    const handleGenerateAndDownload = async () => {
        const clearSim = runSimulatedProgress();

        try {
            const cacheId = sessionStorage.getItem('cacheId');
            if (!cacheId) throw new Error("Cached data not available.");

            const res = await fetch('/api/export/enrich-and-format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cacheId }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Report generation failed on the server.`);
            }

            const blob = await res.blob();
            const now = new Date();
            const newVersion: DownloadVersion = {
                id: `v-${now.getTime()}`,
                fileName: `beneficiary-report-v${downloadHistory.length + 1}.xlsx`,
                version: downloadHistory.length + 1,
                createdAt: now.toLocaleString(),
                blob,
            };
            setDownloadHistory(prev => [newVersion, ...prev]);
            toast({ title: "Report Ready", description: `${newVersion.fileName} has been added to the download panel.` });
            
            // Automatically trigger download
            handleDirectDownload(blob, newVersion.fileName);
            
            clearSim();
            setCompletedSteps(new Set(allSteps));
            setProgress(100);
            setTimeout(() => {
                setLoading(false);
                setProgress(0);
                setCompletedSteps(new Set());
            }, 2000);

        } catch (error: any) {
            toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
             clearSim();
             setLoading(false);
             setProgress(0);
             setCompletedSteps(new Set());
        }
    };
    
    const handleDirectDownload = (blob: Blob, fileName: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast({ title: "Download Started", description: `Downloading ${fileName}` });
    };

    const handleDeleteVersion = (id: string) => {
        setDownloadHistory(prev => prev.filter(v => v.id !== id));
    };

    const StatusIndicator = ({ done }: { done: boolean }) => {
        return done ? <CheckCircle className="h-6 w-6 text-green-500" /> : <XCircle className="h-6 w-6 text-muted-foreground" />;
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Advanced Export Workflow</CardTitle>
                            <CardDescription>
                                Generate and download your comprehensive beneficiary analysis report in a single step.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild><Link href="/upload"><Upload className="mr-2"/>To Upload</Link></Button>
                            <Button variant="outline" asChild><Link href="/review"><Microscope className="mr-2"/>To Review</Link></Button>
                            <Button variant="outline" asChild><Link href="/audit"><ClipboardList className="mr-2"/>To Audit</Link></Button>
                            <Button variant="outline" asChild><Link href="/report"><BarChartHorizontal className="mr-2"/>To Report</Link></Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                     {initialLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p>Loading data from cache...</p>
                        </div>
                    ) : (
                         <Card className="bg-primary/10 border-primary">
                            <CardHeader>
                                <CardTitle>Generate and Download Report</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap items-center gap-6 mb-4">
                                     <div className="flex items-center gap-3 text-lg font-medium">
                                        <Users className="h-6 w-6 text-primary" />
                                        <span>{recordCount.toLocaleString()} Records Loaded</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-lg font-medium">
                                        <Database className="h-6 w-6 text-primary" />
                                        <span>{clusterCount.toLocaleString()} Clusters Found</span>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    This will generate a single Excel file with multiple sheets: Enriched Data, Review Summary, Cluster Details, and Audit Findings.
                                </p>
                                <Button onClick={handleGenerateAndDownload} disabled={loading || !isReady} size="lg">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                    {loading ? 'Generating...' : 'Generate and Download Report'}
                                </Button>
                                {!isReady && <p className="text-xs text-destructive mt-2">Please complete the upload and clustering steps first to enable report generation.</p>}
                            </CardContent>
                        </Card>
                    )}
                    
                    {/* Status & History Section */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle>Generation Status</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                               {
                                 loading ? (
                                    <div className="space-y-3 pt-2">
                                        <Progress value={progress} />
                                        {allSteps.map(step => (
                                             <div key={step} className="flex items-center justify-between text-sm">
                                                <span>{stepDescriptions[step]}</span>
                                                {completedSteps.has(step) ? (
                                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                                ) : (
                                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                )}
                                             </div>
                                        ))}
                                    </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                      Real-time generation status will appear here once you start the process.
                                  </p>
                                )
                               }
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle>Download Panel</CardTitle></CardHeader>
                            <CardContent>
                                {downloadHistory.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Generated reports will appear here.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>File Name</TableHead>
                                                <TableHead>Version</TableHead>
                                                <TableHead>Created</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {downloadHistory.map(v => (
                                                <TableRow key={v.id}>
                                                    <TableCell className="font-medium">{v.fileName}</TableCell>
                                                    <TableCell>{v.version}</TableCell>
                                                    <TableCell>{v.createdAt}</TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button variant="outline" size="sm" onClick={() => handleDirectDownload(v.blob, v.fileName)}>Download</Button>
                                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteVersion(v.id)}>Delete</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
