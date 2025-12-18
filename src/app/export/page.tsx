"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2, XCircle, CheckCircle, Database, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";


type DownloadVersion = {
    id: string;
    fileName: string;
    version: number;
    createdAt: string;
    blob: Blob;
};

type GenerationStep = "enriching" | "sorting" | "sheets" | "audit" | "summary" | "done";
const allSteps: GenerationStep[] = ["enriching", "sorting", "sheets", "audit", "summary"];


export default function ExportPage() {
    const { t } = useTranslation();
    const stepDescriptions: Record<GenerationStep, string> = {
        enriching: t('export.status.enriching'),
        sorting: t('export.status.sorting'),
        sheets: t('export.status.sheets'),
        audit: t('export.status.audit'),
        summary: t('export.status.summary'),
        done: t('export.status.done')
    };

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
        const checkCache = async () => {
            setInitialLoading(true);
            const cacheId = sessionStorage.getItem('cacheId');
            if (!cacheId) {
                setIsReady(false);
                setInitialLoading(false);
                toast({ title: t('export.toasts.noData'), variant: "destructive" });
                return;
            }
            
            try {
                const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
                if (!res.ok) {
                    throw new Error(t('export.toasts.fetchError'));
                }
                const responseData = await res.json();
                
                const rows = responseData.rows || [];
                const clusters = responseData.clusters || [];
                
                setRecordCount(rows.length);
                setClusterCount(clusters.length);

                if (rows.length > 0) {
                    setIsReady(true);
                } else {
                     toast({ title: t('export.toasts.noRecords'), variant: "destructive" });
                     setIsReady(false);
                }

            } catch (error: any) {
                setIsReady(false);
                toast({ title: t('export.toasts.generationFailed'), description: error.message, variant: "destructive" });
            } finally {
                setInitialLoading(false);
            }
        };
        checkCache();
    }, [toast, t]);
    
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
            toast({ title: t('export.toasts.reportReady', {'newVersion.fileName': newVersion.fileName}) });
            
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
            toast({ title: t('export.toasts.generationFailed'), description: error.message, variant: "destructive" });
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
        toast({ title: t('export.toasts.downloadStarted', {fileName: fileName}) });
    };

    const handleDeleteVersion = (id: string) => {
        setDownloadHistory(prev => prev.filter(v => v.id !== id));
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('export.title')}</CardTitle>
                    <CardDescription>
                        {t('export.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     {initialLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p>{t('export.initialLoading')}</p>
                        </div>
                    ) : (
                         <Card className="bg-primary/10 border-primary">
                            <CardHeader>
                                <CardTitle>{t('export.generateAndDownload.title')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap items-center gap-6 mb-4">
                                     <div className="flex items-center gap-3 text-lg font-medium">
                                        <Users className="h-6 w-6 text-primary" />
                                        <span>{t('export.generateAndDownload.recordsLoaded', {recordCount: recordCount.toLocaleString()})}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-lg font-medium">
                                        <Database className="h-6 w-6 text-primary" />
                                        <span>{t('export.generateAndDownload.clustersFound', {clusterCount: clusterCount.toLocaleString()})}</span>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {t('export.generateAndDownload.description')}
                                </p>
                                <Button onClick={handleGenerateAndDownload} disabled={loading || !isReady} size="lg">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                    {loading ? t('export.generateAndDownload.buttonGenerating') : t('export.generateAndDownload.button')}
                                </Button>
                                {!isReady && <p className="text-xs text-destructive mt-2">{t('export.generateAndDownload.enableMessage')}</p>}
                            </CardContent>
                        </Card>
                    )}
                    
                    {/* Status & History Section */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle>{t('export.status.title')}</CardTitle></CardHeader>
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
                                      {t('export.status.idle')}
                                  </p>
                                )
                               }
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle>{t('export.downloadPanel.title')}</CardTitle></CardHeader>
                            <CardContent>
                                {downloadHistory.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">{t('export.downloadPanel.empty')}</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{t('export.downloadPanel.fileName')}</TableHead>
                                                <TableHead>{t('export.downloadPanel.version')}</TableHead>
                                                <TableHead>{t('export.downloadPanel.created')}</TableHead>
                                                <TableHead className="text-right">{t('export.downloadPanel.actions')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {downloadHistory.map(v => (
                                                <TableRow key={v.id}>
                                                    <TableCell className="font-medium">{v.fileName}</TableCell>
                                                    <TableCell>{v.version}</TableCell>
                                                    <TableCell>{v.createdAt}</TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button variant="outline" size="sm" onClick={() => handleDirectDownload(v.blob, v.fileName)}>{t('export.downloadPanel.download')}</Button>
                                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteVersion(v.id)}>{t('export.downloadPanel.delete')}</Button>
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
