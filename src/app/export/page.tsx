
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2, XCircle, CheckCircle, Database, Users, Upload, Microscope, ClipboardList, BarChartHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { loadCachedResult } from "@/lib/cache";
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
    const { t, language } = useTranslation();
    const [initialLoading, setInitialLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState<string>('');

    const [downloadHistory, setDownloadHistory] = useState<DownloadVersion[]>([]);
    const [recordCount, setRecordCount] = useState(0);
    const [clusterCount, setClusterCount] = useState(0);
    const { toast } = useToast();

    useEffect(() => {
        const checkCache = async () => {
            setInitialLoading(true);
            const result = await loadCachedResult();
            
            if (result) {
                const rows = result.rows || [];
                const clusters = result.clusters || [];
                
                setRecordCount(rows.length);
                setClusterCount(clusters.length);

                if (rows.length > 0) {
                    setIsReady(true);
                } else {
                     toast({ title: t('export.toasts.noRecords'), description: t('export.toasts.noRecords'), variant: "destructive" });
                     setIsReady(false);
                }
            } else {
                setIsReady(false);
                toast({ title: t('export.toasts.noData'), description: t('export.toasts.noData'), variant: "destructive" });
            }
            setInitialLoading(false);
        };
        checkCache();
    }, [toast, t]);
    
    
    const handleGenerateAndDownload = async () => {
        setLoading(true);
        setProgress(0);
        setCurrentStep(t('export.status.starting'));

        try {
            const cachedData = await loadCachedResult();
            if (!cachedData) throw new Error("Cached data not available.");

            const worker = new Worker(new URL('@/workers/export.worker.ts', import.meta.url));

            worker.onmessage = (event) => {
                const { type, data, progress: p, step } = event.data;

                if (type === 'progress') {
                    setProgress(p);
                    setCurrentStep(t(`export.status.${step}`) || step);
                } else if (type === 'done') {
                    const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                    const now = new Date();
                    const newVersion: DownloadVersion = {
                        id: `v-${now.getTime()}`,
                        fileName: `beneficiary-report-v${downloadHistory.length + 1}.xlsx`,
                        version: downloadHistory.length + 1,
                        createdAt: now.toLocaleString(),
                        blob,
                    };
                    setDownloadHistory(prev => [newVersion, ...prev]);
                    toast({ title: t('export.toasts.reportReadyTitle'), description: t('export.toasts.reportReadyDescription', { newVersion: newVersion.fileName }) });
                    
                    handleDirectDownload(blob, newVersion.fileName);
                    
                    setLoading(false);
                    worker.terminate();
                } else if (type === 'error') {
                    console.error('Worker error:', data);
                    toast({ title: t('export.toasts.generationFailed'), description: data, variant: "destructive" });
                    setLoading(false);
                    worker.terminate();
                }
            };

            worker.onerror = (e) => {
                 toast({ title: t('export.toasts.generationFailed'), description: e.message, variant: "destructive" });
                 setLoading(false);
                 worker.terminate();
            };

            worker.postMessage({ cachedData });

        } catch (error: any) {
            toast({ title: t('export.toasts.generationFailed'), description: error.message, variant: "destructive" });
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
        toast({ title: t('export.toasts.downloadStartedTitle'), description: t('export.toasts.downloadStartedDescription', { fileName: fileName }) });
    };

    const handleDeleteVersion = (id: string) => {
        setDownloadHistory(prev => prev.filter(v => v.id !== id));
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>{t('export.title')}</CardTitle>
                            <CardDescription>{t('export.description')}</CardDescription>
                        </div>
                         <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild><Link href="/upload"><Upload className={language === 'ar' ? 'ml-2' : 'mr-2'}/>{t('sidebar.upload')}</Link></Button>
                            <Button variant="outline" asChild><Link href="/review"><Microscope className={language === 'ar' ? 'ml-2' : 'mr-2'}/>{t('sidebar.review')}</Link></Button>
                            <Button variant="outline" asChild><Link href="/audit"><ClipboardList className={language === 'ar' ? 'ml-2' : 'mr-2'}/>{t('sidebar.audit')}</Link></Button>
                            <Button variant="outline" asChild><Link href="/report"><BarChartHorizontal className={language === 'ar' ? 'ml-2' : 'mr-2'}/>{t('sidebar.report')}</Link></Button>
                        </div>
                    </div>
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
                                        <span>{t('export.generateAndDownload.recordsLoaded', { recordCount: recordCount.toLocaleString() })}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-lg font-medium">
                                        <Database className="h-6 w-6 text-primary" />
                                        <span>{t('export.generateAndDownload.clustersFound', { clusterCount: clusterCount.toLocaleString() })}</span>
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
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle>{t('export.status.title')}</CardTitle></CardHeader>
                             <CardContent className="space-y-4">
                               { loading ? (
                                    <div className="space-y-3 pt-2">
                                        <Progress value={progress} />
                                        <p className="text-sm text-muted-foreground text-center">{currentStep}</p>
                                    </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground text-center">
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
