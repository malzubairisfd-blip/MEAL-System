
"use client";

import { useState, useEffect } from "react";
import type { RecordRow } from "@/lib/fuzzyCluster";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FileDown, Loader2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fullPairwiseBreakdown } from "@/lib/fuzzyCluster";

type RecordWithScores = RecordRow & {
    clusterId?: number;
    pairScore?: number;
    nameScore?: number;
    husbandScore?: number;
    idScore?: number;
    phoneScore?: number;
    locationScore?: number;
    childrenScore?: number;
};

type EnrichedRecord = RecordWithScores & {
    Cluster_ID?: number | null;
    ClusterSize?: number | null;
    Flag?: string | null;
};

export default function ExportPage() {
    const [status, setStatus] = useState({
        enriched: false,
        sorted: false,
        ready: false,
    });
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const [enrichedData, setEnrichedData] = useState<EnrichedRecord[]>([]);
    const [serverCache, setServerCache] = useState<any>(null);


    useEffect(() => {
        const fetchCache = async () => {
            const cacheId = sessionStorage.getItem('cacheId');
            if (!cacheId) {
                toast({ title: "Cache Error", description: "No data found from previous steps.", variant: "destructive" });
                return;
            }

            try {
                const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
                const data = await res.json();
                setServerCache(data);
            } catch (e) {
                toast({ title: "Cache Error", description: "Could not load data from server cache.", variant: "destructive" });
            }
        };
        fetchCache();
    }, [toast]);


    const handleEnrichData = async () => {
        setLoading(true);
        try {
            if (!serverCache?.rows || !serverCache?.clusters) {
                throw new Error("Clustered data not found in server cache. Please re-run clustering.");
            }
            
            const processedRows: RecordRow[] = serverCache.rows;
            const clusters: RecordRow[][] = serverCache.clusters;
            
            const clusterMap = new Map<string, any>();
            clusters.forEach((cluster: RecordRow[], index: number) => {
                const pairs = fullPairwiseBreakdown(cluster);
                const recordScores = new Map<string, any>();
    
                for (const record of cluster) {
                    let topScoreData: any = { pairScore: 0 };
                    for (const pair of pairs) {
                        if ((pair.a._internalId === record._internalId || pair.b._internalId === record._internalId) && pair.score > topScoreData.pairScore) {
                            topScoreData = {
                                pairScore: pair.score,
                                nameScore: pair.breakdown.nameScore,
                                husbandScore: pair.breakdown.husbandScore,
                                idScore: pair.breakdown.idScore,
                                phoneScore: pair.breakdown.phoneScore,
                                locationScore: pair.breakdown.locationScore,
                                childrenScore: pair.breakdown.childrenScore,
                            };
                        }
                    }
                    recordScores.set(record._internalId!, topScoreData);
                }
                
                cluster.forEach(record => {
                    const scores = recordScores.get(record._internalId!);
                    clusterMap.set(record._internalId!, { clusterId: index + 1, ...scores });
                });
            });
            
            const allProcessed: RecordWithScores[] = processedRows.map((row) => {
              const clusterData = clusterMap.get(row._internalId!);
              return { ...row, ...clusterData };
            });

            const idColumnName = serverCache.idColumnName;

            const clusterMaxIdMap = new Map<number, number>();
            const clusterSizeMap = new Map<number, number>();
            for (const row of allProcessed) {
                if (row.clusterId) {
                    clusterSizeMap.set(row.clusterId, (clusterSizeMap.get(row.clusterId) || 0) + 1);
                    const beneficiaryId = Number(row.beneficiaryId);
                    if (!isNaN(beneficiaryId)) {
                        const currentMax = clusterMaxIdMap.get(row.clusterId) || 0;
                        if (beneficiaryId > currentMax) {
                            clusterMaxIdMap.set(row.clusterId, beneficiaryId);
                        }
                    }
                }
            }

            const dataToEnrich: EnrichedRecord[] = allProcessed.map((row) => {
                const clusterId = row.clusterId;
                const clusterSize = clusterId ? clusterSizeMap.get(clusterId) || null : null;
                const finalClusterId = clusterId ? clusterMaxIdMap.get(clusterId) || null : null;
                const getFlagForScore = (scoreValue: any): string | null => {
                    if (scoreValue === undefined || scoreValue === null) return null;
                    const score = Number(scoreValue);
                    if (isNaN(score) || score <= 0) return null;
                    if (score >= 0.9) return "m?";
                    if (score >= 0.8) return "m";
                    if (score >= 0.7) return "??";
                    if (score > 0) return "?";
                    return null;
                };

                return {
                    ...row,
                    Cluster_ID: finalClusterId,
                    ClusterSize: clusterSize,
                    Flag: getFlagForScore(row.pairScore),
                };
            });

            setEnrichedData(dataToEnrich);
            setStatus({ ...status, enriched: true });
            toast({ title: "Step 1 Complete", description: "Data has been enriched." });
        } catch (e: any) {
            toast({ title: "Enrichment Failed", description: e.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSortData = () => {
        setLoading(true);
        try {
            if (enrichedData.length === 0) {
                 throw new Error("Enriched data not found. Please complete Step 1.");
            }
            const dataToSort = [...enrichedData];
            
            dataToSort.sort((a, b) => {
                const scoreA = a.pairScore ?? -1;
                const scoreB = b.pairScore ?? -1;
                if (scoreA !== scoreB) {
                    return scoreB - scoreA;
                }

                const clusterA = a.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
                const clusterB = b.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
                return clusterA - clusterB;
            });
            
            setEnrichedData(dataToSort); // Update state with sorted data
            setStatus({ ...status, sorted: true, ready: true });
            toast({ title: "Step 2 Complete", description: "Data has been sorted." });
        } catch (e: any) {
             toast({ title: "Sort Failed", description: e.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        setLoading(true);
        try {
            if (!serverCache || enrichedData.length === 0) {
                throw new Error("Missing necessary data. Please complete all previous steps.");
            }
            
            const body = {
                enrichedData: enrichedData,
                clusters: serverCache.clusters,
                allRecords: serverCache.rows,
                auditFindings: serverCache.auditFindings || [],
                aiSummaries: serverCache.aiSummaries || {},
                originalHeaders: serverCache.originalHeaders,
            };

            const response = await fetch('/api/export/combined', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate Excel file.');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'combined-beneficiary-report.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast({ title: "Download Started", description: "Your combined report is being downloaded." });

        } catch (error: any) {
            toast({ title: "Export Failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const StatusIndicator = ({ done }: { done: boolean }) => {
        return done ? <CheckCircle className="h-6 w-6 text-green-500" /> : <XCircle className="h-6 w-6 text-muted-foreground" />;
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Combined Export Center</CardTitle>
                    <CardDescription>Generate a single, comprehensive Excel report containing all analysis from the previous steps.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Step 1: Enrich */}
                    <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">Step 1: Enrich Data</h4>
                            <p className="text-sm text-muted-foreground">Calculate Cluster IDs, sizes, and flags for all records.</p>
                        </div>
                        <Button onClick={handleEnrichData} disabled={loading || status.enriched || !serverCache}>
                            {loading && !status.enriched ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Enrich Data
                        </Button>
                    </div>

                    {/* Step 2: Sort */}
                     <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">Step 2: Sort Data</h4>
                            <p className="text-sm text-muted-foreground">Sort the enriched data by Pair Score (descending) and then by Cluster ID (ascending).</p>
                        </div>
                        <Button onClick={handleSortData} disabled={loading || status.sorted || !status.enriched}>
                             {loading && !status.sorted ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sort Data
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
                            <Button onClick={handleDownload} disabled={loading || !status.ready}>
                                {loading && status.ready ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                Generate and Download Report
                            </Button>
                             {!status.ready && <p className="text-xs text-destructive mt-2">Please complete all previous steps to enable download.</p>}
                        </CardContent>
                    </Card>

                    {/* Status Section */}
                    <Card>
                        <CardHeader><CardTitle>Export Status</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between"><span>Data Enriched</span> <StatusIndicator done={status.enriched} /></div>
                            <div className="flex items-center justify-between"><span>Data Sorted</span> <StatusIndicator done={status.sorted} /></div>
                             <div className="flex items-center justify-between font-semibold"><span>Ready to Download</span> <StatusIndicator done={status.ready} /></div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </div>
    );
}
