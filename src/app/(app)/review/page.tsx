"use client";

import { useState, useEffect } from "react";
import type { RecordRow } from "@/lib/fuzzyCluster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Microscope, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Cluster = RecordRow[];
type PairwiseData = { a: RecordRow; b: RecordRow; score: number; breakdown: any };

export default function ReviewPage() {
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadClusters();
  }, []);

  useEffect(() => {
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
  }, [search, allClusters]);

  async function loadClusters() {
    setLoading(true);
    try {
      const res = await fetch("/api/cluster-cache");
      const data = await res.json();
      if (res.ok) {
        setAllClusters(data.clusters || []);
        setFilteredClusters(data.clusters || []);
        if (data.clusters.length === 0) {
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
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cluster Review</CardTitle>
          <CardDescription>
            Inspect and analyze potential duplicate clusters from the last processing run. Found {filteredClusters.length} of {allClusters.length} clusters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
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
            <Button onClick={loadClusters} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh Data
            </Button>
          </div>
          
          {loading && allClusters.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2">Loading clusters...</p>
            </div>
          ) : filteredClusters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClusters.map((c, idx) => (
                <Card key={idx} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>Cluster {idx + 1}</CardTitle>
                    <CardDescription>{c.length} records</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2 text-sm">
                      {c.map((r, i) => (
                        <p key={i} className="truncate" title={r.womanName}>
                          {r.womanName}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                  <div className="p-4 pt-0">
                    <Button variant="outline" className="w-full" onClick={() => setSelectedCluster(c)}>
                      <Microscope className="mr-2 h-4 w-4" />
                      Inspect Cluster
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
             <div className="text-center text-muted-foreground py-10">
                <p>No clusters found{search ? ' for your search query' : ''}.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCluster && (
        <ClusterModal
          cluster={selectedCluster}
          onClose={() => setSelectedCluster(null)}
        />
      )}
    </div>
  );
}

function ClusterModal({ cluster, onClose }: { cluster: Cluster, onClose: () => void }) {
  const [pairs, setPairs] = useState<PairwiseData[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadPairs() {
    setLoading(true);
    try {
      const res = await fetch("/api/pairwise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster }),
      });
      const data = await res.json();
      setPairs(data.pairs || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!cluster} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Cluster Details</DialogTitle>
          <DialogDescription>Review pairwise similarity scores between records in this cluster.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-6 -mr-6">
          <Button onClick={loadPairs} disabled={loading} className="mb-4">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Microscope className="mr-2 h-4 w-4" />}
            Load Pairwise Similarities
          </Button>

          <div className="space-y-4">
            {pairs.map((p, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span>{p.a.womanName} ↔ {p.b.womanName}</span>
                    <Badge variant={p.score > 0.85 ? "destructive" : p.score > 0.7 ? "default" : "secondary"}>
                      Score: {p.score.toFixed(3)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold mb-2">Record A</h4>
                            <p className="text-sm"><strong>Husband:</strong> {p.a.husbandName}</p>
                            <p className="text-sm"><strong>ID:</strong> {p.a.nationalId}</p>
                            <p className="text-sm"><strong>Phone:</strong> {p.a.phone}</p>
                            <p className="text-sm"><strong>Village:</strong> {p.a.village}</p>
                            <p className="text-sm"><strong>Children:</strong> {(p.a.children || []).join(', ')}</p>
                        </div>
                         <div>
                            <h4 className="font-semibold mb-2">Record B</h4>
                            <p className="text-sm"><strong>Husband:</strong> {p.b.husbandName}</p>
                            <p className="text-sm"><strong>ID:</strong> {p.b.nationalId}</p>
                            <p className="text-sm"><strong>Phone:</strong> {p.b.phone}</p>
                            <p className="text-sm"><strong>Village:</strong> {p.b.village}</p>
                            <p className="text-sm"><strong>Children:</strong> {(p.b.children || []).join(', ')}</p>
                        </div>
                    </div>
                  <h4 className="font-semibold mt-4 mb-2">Score Breakdown</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(p.breakdown).map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="capitalize font-medium">{key.replace('Score', ' Score')}</TableCell>
                          <TableCell className="text-right font-mono">{(value as number).toFixed(4)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
         <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
