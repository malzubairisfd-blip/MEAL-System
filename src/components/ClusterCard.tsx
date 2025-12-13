
"use client";

import type { RecordRow } from "@/lib/fuzzyCluster";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Microscope } from "lucide-react";

type Cluster = RecordRow[];

interface ClusterCardProps {
  cluster: Cluster;
  clusterNumber: number;
  onInspect: () => void;
}

export function ClusterCard({ cluster, clusterNumber, onInspect }: ClusterCardProps) {

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
