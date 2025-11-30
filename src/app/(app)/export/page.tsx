
"use client";

import { useState, useEffect } from "react";
import type { RecordRow } from "@/lib/fuzzyCluster";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FileDown, Loader2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

    // Data state
    const [enrichedData, setEnrichedData] = useState<EnrichedRecord[]>([]);

    useEffect(() => {
        // Clear old data on page load
        if (typeof window !== 'undefined') {
            const enriched = sessionStorage.getItem('enrichedData');
            if (enriched) setStatus(s => ({...s, enriched: true}));

            const sorted = sessionStorage.getItem('sortedData');
            if (sorted) setStatus(s => ({...s, sorted: true, ready: true}));
        }
    }, []);


    const handleEnrichData = async () => {
        setLoading(true);
        try {
            const processedRecordsString = sessionStorage.getItem('processedRecords');
            if (!processedRecordsString) {
                throw new Error("Processed records not found in session storage. Please re-run clustering.");
            }
            const processedRecords: RecordWithScores[] = JSON.parse(processedRecordsString);

            const idColumnName = sessionStorage.getItem('idColumnName');
             if (!idColumnName) {
                throw new Error("ID column name not found in session storage.");
            }

            // --- MAX & SIZE Logic ---
            const clusterMaxIdMap = new Map<number, number>();
            const clusterSizeMap = new Map<number, number>();
            for (const row of processedRecords) {
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

            // --- Enriched rows ---
            const dataToEnrich: EnrichedRecord[] = processedRecords.map((row) => {
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
            sessionStorage.setItem('enrichedData', JSON.stringify(dataToEnrich));
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
                 const storedEnriched = sessionStorage.getItem('enrichedData');
                 if(!storedEnriched) throw new Error("Enriched data not found. Please complete Step 1.");
                 setEnrichedData(JSON.parse(storedEnriched));
            }
            
            const dataToSort = [...enrichedData];
            dataToSort.sort((a, b) => {
                const clusterA = a.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
                const clusterB = b.Cluster_ID ?? Number.MAX_SAFE_INTEGER;
                if (clusterA !== clusterB) {
                    return clusterA - clusterB;
                }
                const scoreA = a.pairScore ?? -1;
                const scoreB = b.pairScore ?? -1;
                return scoreB - scoreA;
            });
            
            sessionStorage.setItem('sortedData', JSON.stringify(dataToSort));
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
            const sortedData = sessionStorage.getItem('sortedData');
            const clusters = sessionStorage.getItem('clusters');
            const allRecords = sessionStorage.getItem('processedRows');
            const auditFindings = sessionStorage.getItem('auditFindings');
            const aiSummaries = sessionStorage.getItem('aiSummaries');
            const originalHeaders = sessionStorage.getItem('originalHeaders');

            if (!sortedData || !clusters || !allRecords || !auditFindings || !originalHeaders) {
                throw new Error("Missing necessary data in session storage. Please complete all previous steps.");
            }
            
            const body = {
                enrichedData: JSON.parse(sortedData),
                clusters: JSON.parse(clusters),
                allRecords: JSON.parse(allRecords),
                auditFindings: JSON.parse(auditFindings),
                aiSummaries: aiSummaries ? JSON.parse(aiSummaries) : {},
                originalHeaders: JSON.parse(originalHeaders),
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
                        <Button onClick={handleEnrichData} disabled={loading || status.enriched}>
                            {loading && !status.enriched ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Enrich Data
                        </Button>
                    </div>

                    {/* Step 2: Sort */}
                     <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">Step 2: Sort Data</h4>
                            <p className="text-sm text-muted-foreground">Sort the enriched data by Cluster ID (ascending) and then by Pair Score (descending).</p>
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
