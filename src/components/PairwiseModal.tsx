
"use client";

import { useState, useEffect } from "react";
import type { RecordRow } from "@/lib/fuzzyCluster";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Microscope } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Cluster = RecordRow[];
type PairwiseData = { a: RecordRow; b: RecordRow; score: number; breakdown: any };

interface PairwiseModalProps {
  cluster: Cluster;
  isOpen: boolean;
  onClose: () => void;
}

export function PairwiseModal({ cluster, isOpen, onClose }: PairwiseModalProps) {
  const [pairs, setPairs] = useState<PairwiseData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Reset state when a new cluster is opened
    if (isOpen) {
      setPairs([]);
    }
  }, [isOpen]);

  async function loadPairs() {
    setLoading(true);
    try {
      const res = await fetch("/api/pairwise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster }),
      });
      if (!res.ok) throw new Error("Failed to fetch pairwise data");
      const data = await res.json();
      setPairs(data.pairs || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not load pairwise similarity scores.",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }
  
  const getChildrenText = (record: RecordRow) => {
    if (Array.isArray(record.children)) {
      return record.children.join(', ');
    }
    return record.children || '';
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Cluster Details</DialogTitle>
          <DialogDescription>Review pairwise similarity scores between records in this cluster.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-6 -mr-6">
          <Button onClick={loadPairs} disabled={loading || pairs.length > 0} className="mb-4">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Microscope className="mr-2 h-4 w-4" />}
            {pairs.length > 0 ? "Scores Loaded" : "Load Pairwise Similarities"}
          </Button>

          {loading && pairs.length === 0 ? (
             <div className="text-center text-muted-foreground py-10">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2">Calculating scores...</p>
            </div>
          ) : (
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
                              <p className="text-sm"><strong>Children:</strong> {getChildrenText(p.a)}</p>
                          </div>
                          <div>
                              <h4 className="font-semibold mb-2">Record B</h4>
                              <p className="text-sm"><strong>Husband:</strong> {p.b.husbandName}</p>
                              <p className="text-sm"><strong>ID:</strong> {p.b.nationalId}</p>
                              <p className="text-sm"><strong>Phone:</strong> {p.b.phone}</p>
                              <p className="text-sm"><strong>Village:</strong> {p.b.village}</p>
                              <p className="text-sm"><strong>Children:</strong> {getChildrenText(p.b)}</p>
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
          )}
        </div>
         <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
