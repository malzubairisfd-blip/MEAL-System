
"use client";

import React, { useState } from "react";
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

  const generateSummary = async (event: React.MouseEvent) => {
    // Stop propagation to prevent the accordion from toggling when we are just fetching data.
    if (!aiSummary) {
      event.preventDefault();
    }
    
    if (loadingSummary || aiSummary) return;

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
                 <AccordionTrigger
                    onClick={generateSummary}
                    disabled={loadingSummary}
                    className="p-0 hover:no-underline -mb-1"
                 >
                    <div className="inline-flex items-center justify-start gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full text-left">
                        {loadingSummary ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                        )}
                        {aiSummary ? "AI Summary Generated" : (loadingSummary ? "Generating..." : "Generate AI Summary")}
                    </div>
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
