
"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FileDown, Loader2, XCircle, FileUp, Settings, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


type DownloadVersion = {
    id: string;
    fileName: string;
    version: number;
    createdAt: string;
    blob: Blob;
};

export default function ExportPage() {
    // Component State
    const [status, setStatus] = useState({ enriched: false, sorted: false, formatted: false, ready: false });
    const [loading, setLoading] = useState<Record<string, boolean>>({
        enrich: false,
        sort: false,
        format: false,
        download: false,
    });
    const [progress, setProgress] = useState<Record<string, number>>({
        enrich: 0,
        sort: 0,
        format: 0,
        download: 0,
    });
    const progressIntervalRef = useRef<Record<string, NodeJS.Timeout>>({});

    const { toast } = useToast();

    // Data State
    const [serverCache, setServerCache] = useState<any>(null);
    const [enrichedData, setEnrichedData] = useState<any[]>([]);
    const [downloadHistory, setDownloadHistory] = useState<DownloadVersion[]>([]);
    
    useEffect(() => {
        const fetchCache = async () => {
            const cacheId = sessionStorage.getItem('cacheId');
            if (!cacheId) {
                toast({ title: "Cache Error", description: "No data found from previous steps. Please start from the upload page.", variant: "destructive" });
                return;
            }
            try {
                const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
                const data = await res.json();
                setServerCache(data);
                 toast({ title: "Data Loaded", description: "Clustered data from the last run is ready." });
            } catch (e) {
                toast({ title: "Cache Error", description: "Could not load data from server cache.", variant: "destructive" });
            }
        };
        fetchCache();

        // Cleanup interval on component unmount
        return () => {
            Object.values(progressIntervalRef.current).forEach(clearInterval);
        }
    }, [toast]);

    const startProgress = (step: string) => {
        setProgress(prev => ({ ...prev, [step]: 0 }));
        progressIntervalRef.current[step] = setInterval(() => {
            setProgress(prev => ({
                ...prev,
                [step]: prev[step] >= 90 ? 90 : prev[step] + 5,
            }));
        }, 200);
    };

    const finishProgress = (step: string) => {
        clearInterval(progressIntervalRef.current[step]);
        delete progressIntervalRef.current[step];
        setProgress(prev => ({ ...prev, [step]: 100 }));
        setTimeout(() => {
            setProgress(prev => ({ ...prev, [step]: 0 }));
            setLoading(prev => ({...prev, [step]: false}));
        }, 1000);
    };
    
    const handleStep = async (step: 'enrich' | 'sort' | 'format' | 'download') => {
        setLoading(prev => ({...prev, [step]: true}));
        startProgress(step);

        try {
            if (!serverCache) throw new Error("Cached data not available.");

            const body = {
                step,
                cacheId: sessionStorage.getItem('cacheId'),
                // For later steps, we send the already processed data
                enrichedData: step !== 'enrich' ? enrichedData : undefined,
            };
            
            const res = await fetch('/api/export/enrich-and-format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Step '${step}' failed on the server.`);
            }

            if (step === 'download') {
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
                
                // Automatically download the first time
                if (downloadHistory.length === 0) {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = newVersion.fileName;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                }
            } else {
                const data = await res.json();
                setEnrichedData(data.enrichedData);
                setStatus(prev => ({ ...prev, [step === 'enrich' ? 'enriched' : step === 'sort' ? 'sorted' : 'formatted']: true, ready: step === 'format' }));
                toast({ title: `Step Complete`, description: `Data has been ${step}ed.`});
            }
             finishProgress(step);

        } catch (error: any) {
            toast({ title: `${step.charAt(0).toUpperCase() + step.slice(1)} Failed`, description: error.message, variant: "destructive" });
             clearInterval(progressIntervalRef.current[step]);
             delete progressIntervalRef.current[step];
             setProgress(prev => ({ ...prev, [step]: 0 }));
             setLoading(prev => ({...prev, [step]: false}));
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
                    <CardTitle>Advanced Export Workflow</CardTitle>
                    <CardDescription>
                        Follow these steps to enrich, format, and download your comprehensive beneficiary analysis report.
                        {!serverCache && " Waiting for data from previous steps..."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Step 1: Enrich */}
                    <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">Step 1: Enrich Data</h4>
                            <p className="text-sm text-muted-foreground">Calculate Cluster IDs, sizes, flags, and scores for all records.</p>
                            {loading.enrich && <Progress value={progress.enrich} className="w-full mt-2" />}
                        </div>
                        <Button onClick={() => handleStep('enrich')} disabled={loading.enrich || status.enriched || !serverCache}>
                            {loading.enrich ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Enrich Data
                        </Button>
                    </div>

                    {/* Step 2: Sort & Format */}
                     <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">Step 2: Sort & Format Data</h4>
                            <p className="text-sm text-muted-foreground">Apply professional sorting and conditional formatting rules to the dataset.</p>
                             {loading.format && <Progress value={progress.format} className="w-full mt-2" />}
                        </div>
                        <Button onClick={() => handleStep('format')} disabled={loading.format || status.formatted || !status.enriched}>
                             {loading.format ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sort & Format
                        </Button>
                    </div>

                    {/* Step 3: Download */}
                    <Card className="bg-primary/10 border-primary">
                        <CardHeader>
                            <CardTitle>Step 3: Generate and Download Report</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <p className="text-sm text-muted-foreground mb-4">
                                This will generate a single Excel file with multiple sheets: Enriched Data, Review Summary, Cluster Details, All Records, and Audit Findings.
                            </p>
                            {loading.download && <Progress value={progress.download} className="w-full mb-4" />}
                            <Button onClick={() => handleStep('download')} disabled={loading.download || !status.ready}>
                                {loading.download ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                Generate and Add to Downloads
                            </Button>
                             {!status.ready && <p className="text-xs text-destructive mt-2">Please complete all previous steps to enable generation.</p>}
                        </CardContent>
                    </Card>
                    
                    {/* Status & History Section */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle>Workflow Status</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between"><span>Data Enriched</span> <StatusIndicator done={status.enriched} /></div>
                                <div className="flex items-center justify-between"><span>Data Sorted & Formatted</span> <StatusIndicator done={status.formatted} /></div>
                                <div className="flex items-center justify-between font-semibold"><span>Ready to Generate</span> <StatusIndicator done={status.ready} /></div>
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
