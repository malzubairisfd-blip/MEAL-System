
"use client";

import { useState, useEffect } from "react";
import type { RecordRow } from "@/lib/fuzzyCluster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, ChevronLeft, AlertTriangle, ChevronRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ClusterCard } from "@/components/ClusterCard";
import { PairwiseModal } from "@/components/PairwiseModal";
import { Progress } from "@/components/ui/progress";

type Cluster = RecordRow[];

export default function ReviewPage() {
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [loading, setLoading] = useState({ data: true, summaries: false });
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [aiSummaries, setAiSummaries] = useState<{ [key: string]: string }>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  
  // AI Summary Progress State
  const [summaryProgress, setSummaryProgress] = useState(0);
  const [summaryStatus, setSummaryStatus] = useState({
    completed: 0,
    total: 0,
    elapsed: '0s',
    remaining: '0s'
  });

  const generateAndStoreAllSummaries = async () => {
      const cacheId = sessionStorage.getItem('cacheId');
      if (!cacheId || allClusters.length === 0) {
          toast({ title: "No clusters to summarize", description: "Please run clustering first.", variant: "destructive"});
          return;
      }
      
      const clustersToSummarize = allClusters.filter(c => {
          const clusterKey = c.map(r => r._internalId).sort().join('-');
          return !aiSummaries[clusterKey];
      });

      if (clustersToSummarize.length === 0) {
          toast({ title: "Summaries Already Generated", description: "AI summaries for all clusters are already available."});
          return;
      }

      setLoading(prev => ({ ...prev, summaries: true }));
      setSummaryProgress(0);
      setSummaryStatus({ completed: 0, total: clustersToSummarize.length, elapsed: '0s', remaining: '0s' });
      const startTime = Date.now();
      const totalToProcess = clustersToSummarize.length;
      let completedCount = 0;
      const newSummaries: { [key: string]: string } = {};

      for (const cluster of clustersToSummarize) {
          try {
              const res = await fetch('/api/ai/describe-cluster', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ cluster: cluster }),
              });
              const data = await res.json();
              if (res.ok && data.description) {
                  const clusterKey = cluster.map(r => r._internalId).sort().join('-');
                  newSummaries[clusterKey] = data.description;
              }
          } catch (e) {
              console.error("Failed to generate a summary for a cluster:", e);
          } finally {
              completedCount++;
              const progress = (completedCount / totalToProcess) * 100;
              setSummaryProgress(progress);

              const elapsedMs = Date.now() - startTime;
              const avgTimePerCluster = elapsedMs / completedCount;
              const remainingMs = (totalToProcess - completedCount) * avgTimePerCluster;

              setSummaryStatus({
                  completed: completedCount,
                  total: totalToProcess,
                  elapsed: `${Math.round(elapsedMs / 1000)}s`,
                  remaining: `${Math.round(remainingMs / 1000)}s`
              });
          }
      }
      
      setAiSummaries(prev => ({ ...prev, ...newSummaries }));
      
      try {
        await fetch('/api/cluster-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cacheId: cacheId, data: { aiSummaries: { ...aiSummaries, ...newSummaries } } })
        });
      } catch (e) {
        console.error("Failed to save AI summaries to cache:", e);
        toast({ title: "Cache Save Failed", description: "Could not save new AI summaries to the server.", variant: "destructive" });
      }

      setLoading(prev => ({ ...prev, summaries: false }));
      toast({ title: "AI Summaries Ready", description: `Generated ${completedCount} new AI-powered summaries.` });
  };

  useEffect(() => {
    async function loadClusters() {
      setLoading(prev => ({ ...prev, data: true }));
      try {
          const cacheId = sessionStorage.getItem('cacheId');
          if (!cacheId) {
            toast({ title: "No Data", description: "No clusters found from the last run. Please upload data first.", variant: "destructive" });
            setLoading(prev => ({ ...prev, data: false }));
            return;
          }

          const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
          if (!res.ok) throw new Error("Failed to load clusters from server cache.");
          
          const data = await res.json();
          const clusters = data.clusters;
          const cachedSummaries = data.aiSummaries || {};
          
          if (clusters) {
              setAllClusters(clusters);
              setFilteredClusters(clusters);
              setAiSummaries(cachedSummaries);

              if (clusters.length === 0) {
                  toast({ title: "No Clusters Found", description: "The last run did not produce any clusters. Try adjusting settings.", variant: "default" });
              }
          } else {
               toast({ title: "Error", description: "Failed to load cluster data from server cache.", variant: "destructive" });
          }
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(prev => ({ ...prev, data: false }));
      }
    }
    loadClusters();
  }, [toast]);

  useEffect(() => {
    const applyFilter = () => {
      if (!search.trim()) {
        setFilteredClusters(allClusters);
        return;
      }
      const s = search.toLowerCase();
      const filtered = allClusters.filter((cluster) =>
        cluster.some(
          (r) =>
            r.womanName?.toLowerCase().includes(s) ||
            r.husbandName?.toLowerCase().includes(s) ||
            r.phone?.toLowerCase().includes(s)
        )
      );
      setFilteredClusters(filtered);
      setCurrentPage(1); // Reset to first page on new search
    };
    applyFilter();
  }, [search, allClusters]);


  const handleInspect = (cluster: Cluster) => {
    setSelectedCluster(cluster);
  }


  // Pagination logic
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
                <Button onClick={generateAndStoreAllSummaries} disabled={loading.summaries || allClusters.length === 0}>
                    {loading.summaries ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate All AI Summaries
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
          
           {loading.summaries && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/50">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Generating AI Summaries...</h4>
                <div className="text-sm text-muted-foreground font-mono">
                  {summaryStatus.completed}/{summaryStatus.total}
                </div>
              </div>
              <Progress value={summaryProgress} className="w-full mb-2" />
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>Elapsed: {summaryStatus.elapsed}</span>
                <span>Remaining: {summaryStatus.remaining}</span>
              </div>
            </div>
          )}
          
          {loading.data ? (
            <div className="text-center text-muted-foreground py-10">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2">Loading clusters...</p>
            </div>
          ) : currentClusters.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentClusters.map((c, idx) => {
                  const clusterKey = c.map(r => r._internalId).sort().join('-');
                  return (
                    <ClusterCard 
                      key={clusterKey} 
                      cluster={c} 
                      clusterNumber={(currentPage - 1) * itemsPerPage + idx + 1}
                      onInspect={() => handleInspect(c)}
                      precomputedDescription={aiSummaries[clusterKey]}
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
