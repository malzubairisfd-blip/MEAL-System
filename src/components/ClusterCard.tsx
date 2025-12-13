
"use client";

import React, { useState, useEffect, useRef } from "react";
import type { RecordRow } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Microscope, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { calculateClusterConfidence } from "@/lib/clusterConfidence";
import { useToast } from "@/hooks/use-toast";

type Cluster = RecordRow[];

interface ClusterCardProps {
  cluster: Cluster;
  clusterId: string;
  clusterNumber: number;
  onInspect: () => void;
}

export function ClusterCard({ cluster, clusterId, clusterNumber, onInspect }: ClusterCardProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const confidence = calculateClusterConfidence(cluster);
  const { toast } = useToast();
  
  const cleanupReader = () => {
    if (readerRef.current) {
        readerRef.current.cancel().catch(() => {}); // Suppress cancel errors
        readerRef.current = null;
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      cleanupReader();
    };
  }, []);

  const handleGenerateSummary = async () => {
    if (isSummaryLoading) return;
    
    cleanupReader();
    setIsSummaryLoading(true);
    setSummaryError(null);
    setAiSummary("");
    
    try {
      const res = await fetch('/api/ai/describe-cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clusters: [cluster] }),
      });

      if (!res.ok || !res.body) {
        const errorData = await res.json().catch(() => ({ error: "An unknown error occurred on the server."}));
        throw new Error(errorData.error || 'Failed to connect to the summary service.');
      }

      readerRef.current = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await readerRef.current.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.startsWith('data:')) continue;

          try {
            const payload = JSON.parse(event.replace(/^data: /, '').trim());

            if (payload.status === 'connected') {
              console.log('AI summary stream connected');
              continue;
            }

            if (payload.done) {
              setIsSummaryLoading(false);
              cleanupReader();
              return;
            }

            if (payload.error) {
              setSummaryError(payload.error);
              toast({ title: "AI Summary Error", description: payload.error, variant: "destructive" });
              setIsSummaryLoading(false);
              cleanupReader();
              return;
            }

            if (payload.clusterKey === clusterId && payload.description) {
              setAiSummary(prev => (prev ? prev + "\n\n" : "") + payload.description);
            }
          } catch (e) {
             console.error("Failed to parse SSE event:", event);
          }
        }
      }

    } catch (error: any) {
        setSummaryError(error.message);
        setIsSummaryLoading(false);
        cleanupReader();
    }
  };
  
  const handlePanelClose = () => {
    setIsPanelOpen(false);
    cleanupReader();
  }

  const handleOpenPanel = () => {
      setIsPanelOpen(true);
      if (!aiSummary && !isSummaryLoading && !summaryError) {
          handleGenerateSummary();
      }
  }

  return (
    <>
      <Card className="flex flex-col hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Cluster {clusterNumber}</CardTitle>
              <CardDescription>{cluster.length} records</CardDescription>
            </div>
            <div className="text-right">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <strong className="text-lg">{confidence}%</strong>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          <div className="space-y-2 text-sm">
            {cluster.map((r, i) => (
              <p key={i} className="truncate" title={r.womanName}>
                {r.womanName}
              </p>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full" onClick={onInspect}>
            <Microscope className="mr-2 h-4 w-4" />
            Inspect
          </Button>
          <Button variant="default" className="w-full" onClick={handleOpenPanel}>
             {isSummaryLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
             ) : (
                <Sparkles className="mr-2 h-4 w-4 text-purple-300" />
             )}
            AI Summary
          </Button>
        </CardFooter>
      </Card>
      
      <Sheet open={isPanelOpen} onOpenChange={ (open) => { if (!open) handlePanelClose() }}>
          <SheetContent className="sm:max-w-lg">
              <SheetHeader>
                  <SheetTitle>AI-Powered Summary for Cluster {clusterNumber}</SheetTitle>
                  <SheetDescription>
                      This summary is generated by AI to highlight key similarities and potential reasons for grouping these records.
                  </SheetDescription>
              </SheetHeader>
              <div className="py-4">
                  {isSummaryLoading && !aiSummary && !summaryError && (
                      <div className="flex items-center justify-center h-40">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="ml-2">Generating summary...</p>
                      </div>
                  )}
                  {summaryError && (
                      <div className="text-destructive p-4 bg-destructive/10 rounded-md">
                          <h4 className="font-semibold">Error</h4>
                          <p>{summaryError}</p>
                      </div>
                  )}
                  {aiSummary && (
                      <div className="p-4 bg-muted/50 rounded-md text-sm whitespace-pre-wrap" dir="rtl">
                          {aiSummary}
                      </div>
                  )}
              </div>
               <SheetFooter>
                 <Button variant="secondary" onClick={handleGenerateSummary} disabled={isSummaryLoading}>
                     {isSummaryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                     Regenerate
                 </Button>
                 <Button variant="outline" onClick={handlePanelClose}>Close</Button>
              </SheetFooter>
          </SheetContent>
      </Sheet>
    </>
  );
}
