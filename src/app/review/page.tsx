
"use client";

import { useState, useEffect, useCallback } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Search, ChevronLeft, AlertTriangle, ChevronRight, Sparkles, Microscope, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { PairwiseModal } from "@/components/PairwiseModal";
import { generateArabicClusterSummary } from "@/lib/arabicClusterSummary";
import { calculateClusterConfidence } from "@/lib/clusterConfidence";

type Cluster = {
  records: RecordRow[];
  reasons: string[];
  avgWomanNameScore?: number;
  avgHusbandNameScore?: number;
  avgFinalScore?: number;
  confidence?: number;
};

export default function ReviewPage() {
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
    if (clustersToScore.length === 0 || clustersToScore.every(c => c.confidence !== undefined)) {
        return; // Don't run if no clusters or if already scored
    }
    setCalculating(true);
    toast({ title: "Calculating Scores", description: `Fetching and averaging scores for ${clustersToScore.length} clusters...` });

    const updatedClusters = await Promise.all(clustersToScore.map(async (cluster) => {
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

    setAllClusters(updatedClusters);
    setCalculating(false);
    toast({ title: "Calculations Complete", description: "Average scores and confidence have been updated for all clusters." });
  }, [toast]);


  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
          const cacheId = sessionStorage.getItem('cacheId');
          if (!cacheId) {
            toast({ title: "No Data", description: "No clusters found from the last run. Please upload data first.", variant: "destructive" });
            setLoading(false);
            return;
          }

          const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
          if (!res.ok) throw new Error("Failed to load clusters from server cache.");
          
          const data = await res.json();
          const clusters = data.clusters || [];
          
          if (clusters) {
              setAllClusters(clusters);

              if (clusters.length === 0) {
                  toast({ title: "No Clusters Found", description: "The last run did not produce any clusters. Try adjusting settings.", variant: "default" });
              } else {
                  toast({ title: "Clusters Loaded", description: `Loaded ${clusters.length} clusters for review.`, variant: "default" });
              }
          } else {
               toast({ title: "Error", description: "Failed to load cluster data from server cache.", variant: "destructive" });
          }
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [toast]);
  
    useEffect(() => {
        if (allClusters.length > 0 && !loading) {
            handleCalculateScores(allClusters);
        }
    }, [allClusters, loading, handleCalculateScores]);


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
              <CardTitle>Cluster Review</CardTitle>
              <CardDescription>
                Inspect and analyze potential duplicate clusters from the last processing run. Found {filteredClusters.length} of {allClusters.length} clusters.
              </CardDescription>
            </div>
             <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" asChild>
                    <Link href="/upload">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Upload
                    </Link>
                </Button>
                 <Button onClick={() => handleCalculateScores(allClusters)} disabled={calculating}>
                    {calculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                    Recalculate Scores
                 </Button>
                <Button asChild>
                    <Link href="/audit">
                        Go to Audit
                        <AlertTriangle className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, husband, or phone..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
                    
          {loading ? (
            <div className="text-center text-muted-foreground py-10">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2">Loading clusters...</p>
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
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button variant="outline" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          ) : (
             <div className="text-center text-muted-foreground py-10">
                <p>No clusters found{search ? ' for your search query' : ''}.</p>
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
            <CardDescription>{cluster.records.length} records</CardDescription>
          </div>
           <div className="text-right">
              <p className="text-xs text-muted-foreground">Confidence</p>
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
             <span>ملخص ذكي</span>
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
          Inspect
        </Button>
      </CardFooter>
    </Card>
  );
}
