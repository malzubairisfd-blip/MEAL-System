
"use client";

import { useState } from "react";
import type { RecordRow } from "@/lib/fuzzyCluster";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Microscope, Wand2, Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

type Cluster = RecordRow[];

interface ClusterCardProps {
  cluster: Cluster;
  clusterKey: string;
  clusterNumber: number;
  onInspect: () => void;
  aiSummary?: string;
  onSummaryUpdate: (clusterKey: string, summary: string) => void;
}

export function ClusterCard({ cluster, clusterKey, clusterNumber, onInspect, aiSummary, onSummaryUpdate }: ClusterCardProps) {
  const [loadingSummary, setLoadingSummary] = useState(false);
  const { toast } = useToast();

  const generateSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch("/api/ai/describe-cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster }),
      });
      if (!res.ok) throw new Error("Failed to generate summary");
      const data = await res.json();
      onSummaryUpdate(clusterKey, data.description);
      toast({ title: "AI Summary Generated", description: `Summary created for Cluster ${clusterNumber}.` });
    } catch (error) {
      toast({ title: "Error", description: "Could not generate AI summary.", variant: "destructive" });
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle>Cluster {clusterNumber}</CardTitle>
        <CardDescription>{cluster.length} records</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2 text-sm">
          {cluster.map((r, i) => (
            <p key={i} className="truncate" title={r.womanName}>
              {r.womanName}
            </p>
          ))}
        </div>
        
        {aiSummary && (
          <Accordion type="single" collapsible>
            <AccordionItem value="summary">
              <AccordionTrigger className="text-sm">View AI Summary</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground rtl text-right" style={{ direction: 'rtl' }}>
                {aiSummary}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" className="w-full" onClick={onInspect}>
          <Microscope className="mr-2 h-4 w-4" />
          Inspect
        </Button>
        <Button variant="secondary" className="w-full" onClick={generateSummary} disabled={loadingSummary}>
          {loadingSummary ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          {aiSummary ? "Regenerate" : "AI Summary"}
        </Button>
      </CardFooter>
    </Card>
  );
}
