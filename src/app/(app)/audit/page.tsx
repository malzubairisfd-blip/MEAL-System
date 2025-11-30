
"use client";

import { useState, useEffect } from "react";
import type { RecordRow, AuditFinding } from "@/lib/auditEngine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Loader2, ChevronLeft, FileDown, FileText, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useRouter } from "next/navigation";

// Extend jsPDF with the autoTable method
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type Cluster = RecordRow[];


export default function AuditPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState({ data: false, audit: false });
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(prev => ({...prev, data: true}));
    try {
        const storedClusters = sessionStorage.getItem('clusters');
        if (storedClusters) {
            const clusters: Cluster[] = JSON.parse(storedClusters);
            const clusteredRecords = clusters.flat();
            setRows(clusteredRecords);
            if (clusteredRecords.length > 0) {
              toast({ title: "Data Loaded", description: `${clusteredRecords.length} records from clusters are ready for audit.` });
            } else {
              toast({ title: "No Clustered Data", description: "No clustered records found to audit. Please run clustering first." });
            }
        } else {
            toast({ title: "Error", description: "Failed to load cluster data from session storage.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error", description: "Could not parse cluster data from session storage.", variant: "destructive" });
    } finally {
        setLoading(prev => ({...prev, data: false}));
    }
  }

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

        const data = await res.json();
        if (res.ok) {
            setFindings(data.findings);
            sessionStorage.setItem('auditFindings', JSON.stringify(data.findings));
            toast({ title: "Audit Complete", description: `${data.findings.length} potential issues found.` });
        } else {
            toast({ title: "Audit Error", description: "An error occurred during the audit.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Network Error", description: "Could not connect to the audit service.", variant: "destructive" });
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
      
      {loading.audit ? (
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
