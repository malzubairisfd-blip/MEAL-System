
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2, XCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
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
    const [isReady, setIsReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const { toast } = useToast();

    // Data State
    const [downloadHistory, setDownloadHistory] = useState<DownloadVersion[]>([]);
    
    useEffect(() => {
        const checkCache = async () => {
            const cacheId = sessionStorage.getItem('cacheId');
            if (cacheId) {
                // We don't need to fetch the data, just confirm it exists to enable the button.
                setIsReady(true);
            } else {
                setIsReady(false);
                toast({ title: "No Data Found", description: "Please start from the upload page to generate data for export.", variant: "destructive" });
            }
        };
        checkCache();

        // Cleanup interval on component unmount
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        }
    }, [toast]);

    const startProgress = () => {
        setProgress(0);
        progressIntervalRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 95) {
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                    return 95;
                }
                return prev + 5;
            });
        }, 300);
    };

    const finishProgress = () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        setProgress(100);
        setTimeout(() => {
            setProgress(0);
            setLoading(false);
        }, 1500);
    };
    
    const handleGenerateAndDownload = async () => {
        setLoading(true);
        startProgress();

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
            finishProgress();

        } catch (error: any) {
            toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
             if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
             progressIntervalRef.current = null;
             setProgress(0);
             setLoading(false);
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
                        Generate and download your comprehensive beneficiary analysis report in a single step.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Single Step: Generate and Download */}
                    <Card className="bg-primary/10 border-primary">
                        <CardHeader>
                            <CardTitle>Generate and Download Report</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <p className="text-sm text-muted-foreground mb-4">
                                This will generate a single Excel file with multiple sheets: Enriched Data, Review Summary, Cluster Details, and Audit Findings. The process may take a moment.
                            </p>
                            {loading && <Progress value={progress} className="w-full mb-4" />}
                            <Button onClick={handleGenerateAndDownload} disabled={loading || !isReady} size="lg">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                Generate and Download Report
                            </Button>
                             {!isReady && <p className="text-xs text-destructive mt-2">Please complete the upload and clustering steps first to enable report generation.</p>}
                        </CardContent>
                    </Card>
                    
                    {/* Status & History Section */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle>Workflow Status</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                               <div className="flex items-center justify-between font-semibold">
                                    <span>Ready to Generate</span> 
                                    <StatusIndicator done={isReady} />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Ensure you have successfully run the clustering on the 'Upload' page. When ready, click the button above to generate your report.
                                </p>
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

    