// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/database/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { loadCachedResult } from "@/lib/cache";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Database, Loader2, Save, ArrowRight, FileDown } from "lucide-react";

interface Project {
  projectId: string;
  projectName: string;
}

export default function BeneficiaryDatabasePage() {
  const { toast } = useToast();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState({ projects: true, cache: false, saving: false });
  const [cacheData, setCacheData] = useState<any>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(prev => ({ ...prev, projects: true }));
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error("Failed to load projects.");
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(prev => ({ ...prev, projects: false }));
      }
    };
    fetchProjects();
  }, [toast]);

  const handleProjectSelect = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setCacheData(null);
    setAvailableColumns([]);
    setSelectedColumns(new Set());
    if (!projectId) return;

    setLoading(prev => ({ ...prev, cache: true }));
    try {
      const result = await loadCachedResult();
      if (!result) {
        toast({ title: "No Data", description: "No cached data found. Please run the clustering process first.", variant: "destructive" });
        return;
      }
      setCacheData(result);

      const headers = new Set<string>(result.originalHeaders || []);
      
      // Add keys from enriched cluster records
      result.clusters?.[0]?.records?.[0] && Object.keys(result.clusters[0].records[0]).forEach(key => {
        if (!key.startsWith('_')) headers.add(key);
      });
      
      // Add keys from the cluster object itself (group decisions)
      result.clusters?.[0] && Object.keys(result.clusters[0]).forEach(key => {
        if(key !== 'records' && key !== 'pairScores') headers.add(key);
      });
      
      const allHeaders = Array.from(headers);
      setAvailableColumns(allHeaders);
      setSelectedColumns(new Set(allHeaders)); // Select all by default

    } catch (error: any) {
      toast({ title: "Error loading cache", description: error.message, variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, cache: false }));
    }
  };
  
  const handleSelectColumn = (column: string, checked: boolean | 'indeterminate') => {
    if (typeof checked !== 'boolean') return;
    setSelectedColumns(prev => {
        const newSet = new Set(prev);
        if(checked) {
            newSet.add(column);
        } else {
            newSet.delete(column);
        }
        return newSet;
    });
  }

  const handleSaveToDatabase = async () => {
      if (!selectedProjectId || !cacheData) {
          toast({ title: "Incomplete Selection", description: "Please select a project.", variant: "destructive" });
          return;
      }

      setLoading(prev => ({ ...prev, saving: true }));
      setProgress(0);

      try {
        const project = projects.find(p => p.projectId === selectedProjectId);
        if (!project) throw new Error("Selected project not found.");
        
        const dataToSave = cacheData.rows.map((row: any) => {
            const enriched: any = { ...row };
            
            const cluster = cacheData.clusters.find((c:any) => c.records.some((r:any) => r._internalId === row._internalId));
            if(cluster) {
                enriched['Generated_Cluster_ID'] = cluster.Generated_Cluster_ID;
                enriched['Cluster_Size'] = cluster.records.length;
                enriched['Max_PairScore'] = cluster.Max_PairScore;
                enriched['groupDecision'] = cluster.groupDecision;
                
                const recordDecision = cluster.recordDecisions?.[row._internalId];
                if (recordDecision) {
                    enriched['recordDecision'] = recordDecision;
                    enriched['decisionReason'] = cluster.decisionReasons?.[row._internalId] || '';
                }
            }
            
            const finalRecord: any = { _id: row._internalId };
            selectedColumns.forEach(col => {
                finalRecord[col] = enriched[col];
            });

            return finalRecord;
        });
        
        const payload = {
            projectName: project.projectName,
            processedAt: new Date().toISOString(),
            results: dataToSave,
        }

        const CHUNK_SIZE = 100;
        const totalRecords = dataToSave.length;

        for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
            const chunk = payload.results.slice(i, i + CHUNK_SIZE);
            const chunkPayload = { ...payload, results: chunk };

            const isFirstChunk = i === 0;
            const url = isFirstChunk ? '/api/bnf-assessed?init=true' : '/api/bnf-assessed';

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunkPayload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.details || "A server error occurred while saving.");
            }

            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network latency
            const currentProgress = Math.round(((i + CHUNK_SIZE) / totalRecords) * 100);
            setProgress(Math.min(100, currentProgress));
        }

        toast({ title: "Save Successful", description: `All data for ${project?.projectName} has been saved to bnf-assessed.db.` });
        setProgress(100);
        
      } catch (error: any) {
          toast({ title: "Save Failed", description: error.message, variant: "destructive" });
      } finally {
          setLoading(prev => ({ ...prev, saving: false }));
      }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Beneficiaries Database</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Review
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Select Project</CardTitle>
          <CardDescription>Choose the project whose processed data you want to save to the database.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select onValueChange={handleProjectSelect} value={selectedProjectId} disabled={loading.projects}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {loading.cache && <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>}

      {cacheData && (
        <>
          <Card>
            <CardHeader>
                <CardTitle>2. Select Columns to Save</CardTitle>
                <CardDescription>Uncheck any columns you do not wish to save to the database.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-64 border rounded-md p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {availableColumns.map(col => (
                            <div key={col} className="flex items-center space-x-2">
                                <Checkbox
                                    id={col}
                                    checked={selectedColumns.has(col)}
                                    onCheckedChange={(checked) => handleSelectColumn(col, checked)}
                                />
                                <Label htmlFor={col} className="truncate" title={col}>{col}</Label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
                <CardTitle>3. Save to Database</CardTitle>
                <CardDescription>This will save the selected columns to the `bnf-assessed.db` database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex gap-2">
                    <Button onClick={handleSaveToDatabase} disabled={loading.saving || !selectedProjectId}>
                        {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Save to bnf-assessed.db
                    </Button>
                    <Button asChild variant="outline">
                        <a href="/api/bnf-assessed/download">
                            <FileDown className="mr-2 h-4 w-4" />
                            Download bnf-assessed.db
                        </a>
                    </Button>
                </div>
                {loading.saving && (
                    <div className="space-y-2">
                        <Progress value={progress} />
                        <p className="text-sm text-muted-foreground text-center">{progress}% Complete</p>
                    </div>
                )}
                 {progress === 100 && (
                     <Button onClick={() => router.push('/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/audit')}>
                        Go to Audit Page <ArrowRight className="ml-2 h-4 w-4"/>
                    </Button>
                 )}
            </CardContent>
          </Card>
        </>
      )}

    </div>
  );
}
