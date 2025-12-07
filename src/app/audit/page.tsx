
"use client";

import { useState, useEffect } from "react";
import type { RecordRow, AuditFinding } from "@/lib/auditEngine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Loader2, ChevronLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuditPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState({ data: true, audit: false });
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      setLoading(prev => ({...prev, data: true}));
      try {
          const cacheId = sessionStorage.getItem('cacheId');
          if (!cacheId) {
            toast({ title: "No Data", description: "No clustered records found to audit. Please run clustering first.", variant: "destructive" });
            return;
          }
          
          const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
          if (!res.ok) throw new Error("Failed to load data from server cache");

          const data = await res.json();
          const clusters = data.clusters;
          const auditFindings = data.auditFindings;
          
          if (clusters) {
              const clusteredRecords = clusters.flat();
              setRows(clusteredRecords);
              if (auditFindings) {
                setFindings(auditFindings);
              }

              if (clusteredRecords.length > 0) {
                toast({ title: "Data Loaded", description: `${clusteredRecords.length} records from clusters are ready for audit.` });
              } else {
                toast({ title: "No Clustered Data", description: "No clustered records found to audit. Please run clustering first." });
              }
          } else {
              toast({ title: "Error", description: "Failed to load cluster data from server cache.", variant: "destructive" });
          }
      } catch (error: any) {
          toast({ title: "Error", description: error.message || "Could not fetch or parse cluster data.", variant: "destructive" });
      } finally {
          setLoading(prev => ({...prev, data: false}));
      }
    }
    loadData();
  }, [toast]);

  async function runAuditNow() {
    if (rows.length === 0) {
        toast({ title: "No Data", description: "Please load data before running an audit.", variant: "destructive" });
        return;
    }
    setLoading(prev => ({...prev, audit: true}));
    try {
        const res = await fetch("/api/audit", {
        method: "POST",
        body: JSON.stringify({ rows }),
        headers: { "Content-Type": "application/json" }
        });

        if (!res.ok) {
           const errorData = await res.json();
           throw new Error(errorData.error || "An error occurred during the audit.");
        }

        const data = await res.json();
        setFindings(data.findings);
        
        const cacheId = sessionStorage.getItem('cacheId');
        if (cacheId) {
            await fetch('/api/cluster-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cacheId, data: { auditFindings: data.findings } })
            });
        }

        toast({ title: "Audit Complete", description: `${data.findings.length} potential issues found.` });

    } catch (error: any) {
        toast({ title: "Audit Error", description: error.message || "Could not connect to the audit service.", variant: "destructive" });
    } finally {
        setLoading(prev => ({...prev, audit: false}));
    }
  }
  
  const getSeverityBadge = (severity: "high" | "medium" | "low") => {
    switch (severity) {
      case "high": return <Badge variant="destructive">High</Badge>;
      case "medium": return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Medium</Badge>;
      case "low": return <Badge variant="secondary">Low</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const goToExport = () => {
    if (findings.length === 0) {
        toast({
            title: "No Audit Findings",
            description: "Please run the audit to generate findings before proceeding to export.",
            variant: "destructive"
        });
        return;
    }
    router.push('/export');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Data Integrity Audit</CardTitle>
                  <CardDescription>
                    Run a set of rules against your clustered records to identify potential issues like duplicates and invalid relationships.
                    {rows.length > 0 && ` Currently loaded ${rows.length} clustered records.`}
                  </CardDescription>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/review">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Review
                    </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={runAuditNow} disabled={loading.audit || loading.data || rows.length === 0}>
              {loading.audit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              Run Audit
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {loading.data ? (
        <div className="text-center text-muted-foreground py-10">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2">Loading latest data...</p>
        </div>
      ) : loading.audit ? (
        <div className="text-center text-muted-foreground py-10">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2">Running audit...</p>
        </div>
      ) : findings.length > 0 ? (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Audit Findings</CardTitle>
                        <CardDescription>{findings.length} issues identified.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={goToExport}>
                           Go to Export Page
                           <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full">
                    {findings.map((f, i) => (
                    <AccordionItem value={`item-${i}`} key={i}>
                        <AccordionTrigger>
                            <div className="flex items-center gap-4">
                                {getSeverityBadge(f.severity)}
                                <span className="font-semibold text-left">{f.type}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2">
                            <p className="text-muted-foreground">{f.description}</p>
                            <div className="p-3 bg-muted/50 rounded-md">
                                <h4 className="font-semibold mb-2">Affected Records:</h4>
                                <ul className="space-y-1 text-sm">
                                {f.records.map((r, idx: number) => (
                                    <li key={idx} className="flex justify-between">
                                    <span>{r.womanName} (Husband: {r.husbandName})</span>
                                    <span className="font-mono text-muted-foreground">ID: {r.nationalId}</span>
                                    </li>
                                ))}
                                </ul>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
      ) : (
        !loading.audit && rows.length > 0 && (
            <Card className="text-center py-10">
                <CardContent className="flex flex-col items-center gap-4">
                    <ShieldCheck className="h-12 w-12 text-green-500" />
                    <h3 className="text-xl font-semibold">No Issues Found</h3>
                    <p className="text-muted-foreground">The audit completed without finding any issues based on the current rules.</p>
                </CardContent>
            </Card>
        )
      )}
    </div>
  );
}
