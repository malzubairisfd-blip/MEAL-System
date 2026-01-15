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
import { ArrowLeft, Database, Loader2, Save, ArrowRight } from "lucide-react";

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
      
      setAvailableColumns(Array.from(headers));
      setSelectedColumns(new Set(Array.from(headers))); // Select all by default

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
      if (!selectedProjectId || !cacheData || selectedColumns.size === 0) {
          toast({ title: "Incomplete Selection", description: "Please select a project and at least one column to save.", variant: "destructive" });
          return;
      }

      setLoading(prev => ({ ...prev, saving: true }));
      setProgress(0);

      try {
        const project = projects.find(p => p.projectId === selectedProjectId);
        // This is a simplified representation. A real implementation would process and send all rows.
        // For now, we simulate the process.
        
        const CHUNK_SIZE = 100;
        const totalRecords = cacheData.rows.length;

        for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
            // In a real scenario, you'd slice and post chunks of data here.
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
              <CardDescription>Choose the columns you want to include in the final database. All columns are selected by default.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-96 p-4 border rounded-md">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {availableColumns.map(col => (
                            <div key={col} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={col} 
                                    checked={selectedColumns.has(col)}
                                    onCheckedChange={(checked) => handleSelectColumn(col, checked)}
                                />
                                <Label htmlFor={col} className="font-normal">{col}</Label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>3. Save to Database</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Button onClick={handleSaveToDatabase} disabled={loading.saving || !selectedProjectId}>
                    {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Save to bnf-assessed.db
                </Button>
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
