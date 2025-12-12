
"use client";

import { useState, useEffect } from "react";
import type { RecordRow } from "@/lib/fuzzyCluster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, ChevronLeft, AlertTriangle, ChevronRight, Wand2 } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [generatingAllSummaries, setGeneratingAllSummaries] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

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
          const summaries = data.aiSummaries || {};
          
          if (clusters) {
              setAllClusters(clusters);
              setFilteredClusters(clusters);
              setAiSummaries(summaries);

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
            String(r.phone ?? '').toLowerCase().includes(s)
        )
      );
      setFilteredClusters(filtered);
      setCurrentPage(1); // Reset to first page on new search
    };
    applyFilter();
  }, [search, allClusters]);
  
  const generateAllSummaries = async () => {
      setGeneratingAllSummaries(true);
      setSummaryProgress(0);
      const cacheId = sessionStorage.getItem('cacheId');

      try {
          const response = await fetch('/api/ai/describe-clusters-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clusters: allClusters }),
          });

          if (!response.body) throw new Error("No response body");
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let newSummaries = { ...aiSummaries };
          let done = false;
          let processedCount = 0;

          while (!done) {
              const { value, done: readerDone } = await reader.read();
              done = readerDone;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n\n').filter(line => line.trim());

              for (const line of lines) {
                  if (line.startsWith('data: ')) {
                      try {
                          const data = JSON.parse(line.substring(6));
                          if (data.clusterKey && data.description) {
                              newSummaries[data.clusterKey] = data.description;
                              processedCount++;
                              setSummaryProgress((processedCount / allClusters.length) * 100);
                          }
                      } catch (e) {
                          console.error("Failed to parse stream data:", line, e);
                      }
                  }
              }
              setAiSummaries(newSummaries);
          }
          
          if(cacheId) {
            await fetch('/api/cluster-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cacheId, aiSummaries: newSummaries })
            });
          }

          toast({ title: 'AI Summaries Generated', description: `Successfully generated ${processedCount} summaries.` });

      } catch (error: any) {
          toast({ title: 'AI Generation Failed', description: error.message, variant: 'destructive' });
      } finally {
          setGeneratingAllSummaries(false);
          setSummaryProgress(100);
      }
  };

  const handleInspect = (cluster: Cluster) => {
    setSelectedCluster(cluster);
  }

  const handleSummaryUpdate = async (clusterKey: string, summary: string) => {
      setAiSummaries(prev => ({...prev, [clusterKey]: summary}));
      const cacheId = sessionStorage.getItem('cacheId');
      if (cacheId) {
          await fetch('/api/cluster-cache', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cacheId, aiSummaries: { ...aiSummaries, [clusterKey]: summary } })
          });
      }
  };

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
            <Button onClick={generateAllSummaries} disabled={generatingAllSummaries || allClusters.length === 0}>
                {generatingAllSummaries ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Generate All AI Summaries
            </Button>
          </div>
          
          {generatingAllSummaries && (
              <div className="mb-4">
                  <Progress value={summaryProgress} className="w-full" />
                  <p className="text-sm text-center text-muted-foreground mt-2">Generating summaries... {Math.round(summaryProgress)}% complete</p>
              </div>
          )}
                    
          {loading ? (
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
                      clusterKey={clusterKey}
                      cluster={c} 
                      clusterNumber={(currentPage - 1) * itemsPerPage + idx + 1}
                      onInspect={() => handleInspect(c)}
                      aiSummary={aiSummaries[clusterKey]}
                      onSummaryUpdate={handleSummaryUpdate}
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
