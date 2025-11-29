
"use client";

import { useState } from "react";
import type { RecordRow } from "@/lib/fuzzyCluster";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Microscope, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Cluster = RecordRow[];

interface ClusterCardProps {
  cluster: Cluster;
  clusterNumber: number;
  onInspect: () => void;
}

export function ClusterCard({ cluster, clusterNumber, onInspect }: ClusterCardProps) {
  const [loadingDescription, setLoadingDescription] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateDescription = async () => {
    setLoadingDescription(true);
    setDescription(null);
    try {
      const res = await fetch('/api/ai/describe-cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cluster }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate description.');
      }
      setDescription(data.description);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingDescription(false);
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
        
        {loadingDescription && (
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating AI summary...
          </div>
        )}

        {description && (
            <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription dir="rtl" className="text-right">
                    {description}
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
      <div className="p-4 pt-0 grid grid-cols-2 gap-2">
        <Button variant="outline" className="w-full" onClick={onInspect}>
          <Microscope className="mr-2 h-4 w-4" />
          Inspect
        </Button>
        <Button variant="secondary" className="w-full" onClick={handleGenerateDescription} disabled={loadingDescription}>
            {loadingDescription ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Sparkles className="mr-2 h-4 w-4" />
            )}
          AI Summary
        </Button>
      </div>
    </Card>
  );
}
