
"use client";

import { useState } from "react";
import type { RecordRow } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Microscope, Sparkles, Loader2 } from "lucide-react";

type Cluster = RecordRow[];

interface ClusterCardProps {
  cluster: Cluster;
  clusterNumber: number;
  onInspect: () => void;
}

export function ClusterCard({ cluster, clusterNumber, onInspect }: ClusterCardProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/describe-cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cluster }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch summary from server.");
      }
      const data = await res.json();
      setAiSummary(data.summary);
    } catch (e: any) {
      setError(e.message || "An unknown error occurred.");
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
        
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="ai-summary">
                 <AccordionTrigger disabled={!!aiSummary || loadingSummary} onClick={!aiSummary ? generateSummary : undefined} className="p-0">
                    <Button variant="ghost" size="sm" className="w-full justify-start" disabled={loadingSummary}>
                        {loadingSummary ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                        )}
                        {aiSummary ? "AI Summary Generated" : "Generate AI Summary"}
                    </Button>
                </AccordionTrigger>
                <AccordionContent className="pt-2 text-sm text-muted-foreground border-t mt-2">
                    {aiSummary && <p className="whitespace-pre-wrap">{aiSummary}</p>}
                    {error && <p className="text-destructive">{error}</p>}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
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
