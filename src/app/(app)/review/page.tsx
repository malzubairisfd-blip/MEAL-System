
"use client";

import { useState, useEffect } from "react";
import type { RecordRow } from "@/lib/fuzzyCluster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, ChevronLeft, AlertTriangle, ChevronRight, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ClusterCard } from "@/components/ClusterCard";
import { PairwiseModal } from "@/components/PairwiseModal";

type Cluster = RecordRow[];

export default function ReviewPage() {
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [allRows, setAllRows] = useState<RecordRow[]>([]);
  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

  useEffect(() => {
    loadClusters();
  }, []);

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

  async function loadClusters() {
    setLoading(true);
    try {
      const res = await fetch("/api/cluster-cache");
      const data = await res.json();
      if (res.ok) {
        const clusters = data.clusters || [];
        const rows = data.rows || [];
        setAllClusters(clusters);
        setFilteredClusters(clusters);
        setAllRows(rows);
        if (clusters.length === 0) {
          toast({ title: "No Data", description: "No clusters found in cache. Please upload data first." });
        }
      } else {
        toast({ title: "Error", description: "Failed to load clusters.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Could not connect to the server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const exportToExcel = async () => {
     if (filteredClusters.length === 0) {
      toast({ title: "No Data", description: "No clusters to export.", variant: "destructive" });
      return;
    }
    setExporting(true);
    setExportMessage('Generating AI summaries...');

    try {
      // Step 1: Generate AI summaries for all filtered clusters in parallel
      const summaryPromises = filteredClusters.map(cluster => 
        fetch('/api/ai/describe-cluster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cluster }),
        }).then(res => res.json())
      );

      const summaryResults = await Promise.all(summaryPromises);
      
      const aiSummaries: { [key: number]: string } = {};
      summaryResults.forEach((result, index) => {
        if (result.description) {
            // Find the original index of the cluster to use as a key
            const cluster = filteredClusters[index];
            const originalIndex = allClusters.findIndex(c => c[0]._internalId === cluster[0]._internalId);
            aiSummaries[originalIndex + 1] = result.description;
        }
      });
      
      setExportMessage('Generating Excel report...');
      
      // Step 2: Call the new export API endpoint
      const response = await fetch('/api/review/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            clusters: allClusters, // Send all clusters to get correct IDs
            allRecords: allRows,
            aiSummaries: aiSummaries,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate Excel file.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cluster-review-report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Your Excel file has been downloaded." });
    } catch (error) {
      console.error(error);
      toast({ title: "Export Error", description: "Could not export data to Excel.", variant: "destructive" });
    } finally {
      setExporting(false);
      setExportMessage('');
    }
  };

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
                 <Button onClick={exportToExcel} variant="outline" disabled={exporting}>
                    {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    {exporting ? exportMessage : 'Export to Excel'}
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
            <Button onClick={loadClusters} disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh Data
            </Button>
          </div>
          
          {loading && allClusters.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2">Loading clusters...</p>
            </div>
          ) : currentClusters.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentClusters.map((c, idx) => (
                  <ClusterCard 
                    key={idx} 
                    cluster={c} 
                    clusterNumber={(currentPage - 1) * itemsPerPage + idx + 1}
                    onInspect={() => setSelectedCluster(c)}
                  />
                ))}
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
