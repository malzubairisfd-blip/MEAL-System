"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Search, ChevronLeft, AlertTriangle, ChevronRight, Sparkles, Microscope, Calculator, PieChart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { PairwiseModal } from "@/components/PairwiseModal";
import { generateArabicClusterSummary, getDecisionAndNote } from "@/lib/arabicClusterSummary";
import { calculateClusterConfidence } from "@/lib/clusterConfidence";
import { useTranslation } from "@/hooks/use-translation";
import { DecisionPieChart } from "@/components/DecisionPieChart";
import { loadCachedResult } from "@/lib/cache";


type Cluster = {
  records: RecordRow[];
  reasons: string[];
  avgWomanNameScore?: number;
  avgHusbandNameScore?: number;
  avgFinalScore?: number;
  confidence?: number;
};

export default function ReviewPage() {
  const { t } = useTranslation();
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<RecordRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

  const handleCalculateScores = useCallback(async (clustersToScore: Cluster[]) => {
    if (calculating || clustersToScore.length === 0 || clustersToScore.every(c => c.confidence !== undefined)) {
        return;
    }
    setCalculating(true);
    toast({ title: t('review.toasts.calculatingScores.title'), description: t('review.toasts.calculatingScores.description', {'clustersToScore.length': clustersToScore.length}) });

    try {
        const updatedClusters = await Promise.all(clustersToScore.map(async (cluster) => {
            if (cluster.confidence !== undefined) return cluster;
            try {
                const res = await fetch("/api/pairwise", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cluster: cluster.records }),
                });
                if (!res.ok) return cluster;
                const data = await res.json();
                const pairs = data.pairs || [];

                if (pairs.length === 0) {
                    const confidence = calculateClusterConfidence(0, 0);
                    return { ...cluster, avgWomanNameScore: 0, avgHusbandNameScore: 0, avgFinalScore: 0, confidence };
                }

                const womanNameScores = pairs.map((p: any) => p.breakdown.nameScore || 0);
                const husbandNameScores = pairs.map((p: any) => p.breakdown.husbandScore || 0);

                const avgWomanNameScore = womanNameScores.reduce((a: number, b: number) => a + b, 0) / womanNameScores.length;
                const avgHusbandNameScore = husbandNameScores.reduce((a: number, b: number) => a + b, 0) / husbandNameScores.length;
                const avgFinalScore = (avgWomanNameScore + avgHusbandNameScore) / 2;

                return {
                    ...cluster,
                    avgWomanNameScore,
                    avgHusbandNameScore,
                    avgFinalScore,
                    confidence: calculateClusterConfidence(avgWomanNameScore, avgHusbandNameScore),
                };
            } catch (error) {
                return cluster; // Return original cluster on error
            }
        }));

        setAllClusters(prev => {
            const newClusters = [...prev];
            updatedClusters.forEach(uc => {
                const index = newClusters.findIndex(c => c.records.map(r => r._internalId).sort().join('-') === uc.records.map(r => r._internalId).sort().join('-'));
                if (index !== -1) {
                    newClusters[index] = uc;
                }
            });
            return newClusters;
        });

        toast({ title: t('review.toasts.calculationComplete.title'), description: t('review.toasts.calculationComplete.description') });
    } finally {
        setCalculating(false);
    }
  }, [toast, t, calculating]);


  useEffect(() => {
    async function getData() {
      setLoading(true);
      const result = await loadCachedResult();

      if (result.status === "READY") {
        const clusters = result.data.clusters || [];
        setAllClusters(clusters);
        if (clusters.length > 0) {
          toast({ title: t('review.toasts.clustersLoaded.title'), description: t('review.toasts.clustersLoaded.description', {'clusters.length': clusters.length}), variant: "default" });
          handleCalculateScores(clusters);
        } else {
          toast({ title: t('review.toasts.noClustersFound.title'), description: t('review.toasts.noClustersFound.description'), variant: "default" });
        }
      } else if (result.status === "NO_DATA") {
        toast({ title: t('review.toasts.noData.title'), description: t('review.toasts.noData.description'), variant: "destructive" });
      } else if (result.status === "ERROR") {
        toast({ title: "Error", description: "Could not load data from cache.", variant: "destructive" });
      }
      setLoading(false);
    }
    getData();
  }, [toast, t, handleCalculateScores]);


  useEffect(() => {
    const applyFilter = () => {
      if (!search.trim()) {
        setFilteredClusters(allClusters);
        return;
      }
      const s = search.toLowerCase();
      const filtered = allClusters.filter((cluster) =>
        cluster.records.some(
          (r) =>
            r.womanName?.toLowerCase().includes(s) ||
            r.husbandName?.toLowerCase().includes(s) ||
            String(r.phone ?? '').toLowerCase().includes(s)
        )
      );
      setFilteredClusters(filtered);
      setCurrentPage(1); // Reset to first page on new search
    };
    applyFilter();
  }, [search, allClusters]);
  
  const decisionChartData = useMemo(() => {
    if (allClusters.length === 0 || allClusters.some(c => c.confidence === undefined)) {
      return [];
    }

    const decisionCounts = {
        'تكرار مؤكد': 0,
        'اشتباه تكرار مؤكد': 0,
        'اشتباه تكرار': 0,
        'إحتمالية تكرار': 0
    };

    allClusters.forEach(cluster => {
        const { decision } = getDecisionAndNote(cluster.confidence || 0);
        if (decision in decisionCounts) {
            decisionCounts[decision as keyof typeof decisionCounts]++;
        }
    });

    return Object.entries(decisionCounts).map(([decision, count]) => ({
      name: decision,
      value: count,
    }));
  }, [allClusters]);


  const handleInspect = (clusterRecords: RecordRow[]) => {
    setSelectedCluster(clusterRecords);
  }

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentClusters = filteredClusters.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredClusters.length / itemsPerPage);

  const paginate = (pageNumber: number) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{t('review.title')}</CardTitle>
              <CardDescription>
                {t('review.description', {filteredClusters: filteredClusters.length, allClusters: allClusters.length})}
              </CardDescription>
            </div>
             <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" asChild>
                    <Link href="/upload">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        {t('review.buttons.backToUpload')}
                    </Link>
                </Button>
                 <Button onClick={() => handleCalculateScores(allClusters)} disabled={calculating}>
                    {calculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                    {t('review.buttons.recalculate')}
                 </Button>
                <Button asChild>
                    <Link href="/audit">
                        {t('review.buttons.goToAudit')}
                        <AlertTriangle className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={t('review.searchPlaceholder')}
                      className="pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
              </div>
              <Card className="lg:col-span-1">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Final Decision Distribution</CardTitle>
                      <PieChart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-0 h-48">
                      {loading || calculating ? (
                           <div className="flex items-center justify-center h-full text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin" />
                           </div>
                      ) : (
                          <DecisionPieChart data={decisionChartData} />
                      )}
                  </CardContent>
              </Card>
          </div>
                    
          {loading ? (
            <div className="text-center text-muted-foreground py-10">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2">{t('review.loading')}</p>
            </div>
          ) : currentClusters.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentClusters.map((c, idx) => {
                  const clusterId = c.records.map(r => r._internalId).sort().join('-');
                  return (
                    <ClusterCard 
                      key={clusterId}
                      cluster={c} 
                      clusterNumber={(currentPage - 1) * itemsPerPage + idx + 1}
                      onInspect={() => handleInspect(c.records)}
                    />
                  )
                })}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <Button variant="outline" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    {t('review.previous')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {t('review.pagination', {currentPage: currentPage, totalPages: totalPages})}
                  </span>
                  <Button variant="outline" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                    {t('review.next')}
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          ) : (
             <div className="text-center text-muted-foreground py-10">
                <p>{t('review.noClusters')}{search ? t('review.noClustersForQuery') : ''}.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCluster && (
        <PairwiseModal
          cluster={selectedCluster}
          isOpen={!!selectedCluster}
          onClose={() => setSelectedCluster(null)}
        />
      )}
    </div>
  );
}


function ClusterCard({ cluster, clusterNumber, onInspect }: { cluster: Cluster, clusterNumber: number, onInspect: () => void }) {
  const { t } = useTranslation();
  const summaryHtml = generateArabicClusterSummary(cluster, cluster.records);
  const confidenceScore = cluster.confidence !== undefined ? cluster.confidence : calculateClusterConfidence(cluster.avgWomanNameScore, cluster.avgHusbandNameScore);

  const getScoreColor = (score?: number) => {
    if (score === undefined) return "text-gray-500";
    if (score >= 90) return "text-red-600 font-bold";
    if (score >= 75) return "text-orange-500 font-semibold";
    if (score >= 60) return "text-blue-600";
    return "text-gray-600";
  };
  
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Cluster {clusterNumber}</CardTitle>
            <CardDescription>{cluster.records.length} {t('review.clusterCard.records')}</CardDescription>
          </div>
           <div className="text-right">
              <p className="text-xs text-muted-foreground">{t('review.clusterCard.confidence')}</p>
              <strong className={`text-lg ${getScoreColor(confidenceScore)}`}>{cluster.confidence === undefined ? <Loader2 className="h-4 w-4 animate-spin" /> : `${confidenceScore}%`}</strong>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2 text-sm">
          {cluster.records.slice(0, 3).map((r, i) => (
            <p key={i} className="truncate" title={r.womanName}>
              {r.womanName}
            </p>
          ))}
        </div>
         <Card className="bg-slate-50 border">
          <CardHeader className="p-4">
            <CardTitle className="text-right text-base flex justify-between items-center">
             <span>{t('review.clusterCard.aiSummary')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-right p-4 pt-0">
             <div
              className="text-sm text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" className="w-full" onClick={onInspect}>
          <Microscope className="mr-2 h-4 w-4" />
          {t('review.clusterCard.inspect')}
        </Button>
      </CardFooter>
    </Card>
  );
}