"use client";
import React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Loader2, ChevronLeft, ArrowRight, UserX, Users, Ban, Fingerprint, Copy, Sigma } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";

// Redefine AuditFinding here as it's used in this component's state
export interface AuditFinding {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  records: RecordRow[];
}

type GroupedFinding = {
  record: RecordRow;
  issues: { type: string; description: string; severity: "high" | "medium" | "low" }[];
};

export default function AuditPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState({ data: true, audit: false });
  const { toast } = useToast();
  const router = useRouter();

    const runAuditNow = useCallback(async () => {
    const cacheId = sessionStorage.getItem('cacheId');
    if (!cacheId) {
        toast({ title: t('audit.toasts.noData'), variant: "destructive" });
        return;
    }
    
    setLoading(prev => ({...prev, audit: true}));
    try {
        const res = await fetch("/api/audit", {
            method: "POST",
            body: JSON.stringify({ cacheId }),
            headers: { "Content-Type": "application/json" }
        });

        if (!res.ok) {
           const errorData = await res.json();
           throw new Error(errorData.error || "An error occurred during the audit.");
        }

        const data = await res.json();
        const newFindings = data.issues || [];
        setFindings(newFindings);
        
        await fetch('/api/cluster-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cacheId, auditFindings: newFindings })
        });

        toast({ title: t('audit.toasts.auditComplete'), description: t('audit.toasts.issuesFound', {'newFindings.length': newFindings.length}) });

    } catch (error: any) {
        toast({ title: t('audit.toasts.auditError'), description: error.message || "Could not connect to the audit service.", variant: "destructive" });
    } finally {
        setLoading(prev => ({...prev, audit: false}));
    }
  }, [toast, t]);


  useEffect(() => {
    async function loadData() {
      setLoading(prev => ({...prev, data: true}));
      try {
          const cacheId = sessionStorage.getItem('cacheId');
          if (!cacheId) {
            toast({ title: "No Data", description: "No clustered records found to audit. Please run clustering first.", variant: "destructive" });
            setLoading(prev => ({...prev, data: false}));
            return;
          }
          
          const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
          if (!res.ok) throw new Error("Failed to load data from server cache");

          const responseData = await res.json();
          const clusters = responseData.clusters;
          const auditFindings = responseData.auditFindings;
          
          if (clusters) {
              const clusteredRecords = clusters.map((c: any) => c.records).flat();
              setRows(clusteredRecords);
              if (clusteredRecords.length > 0) {
                 if (auditFindings) {
                    setFindings(auditFindings);
                    toast({ title: t('audit.toasts.loadedFromCache.title'), description: t('audit.toasts.loadedFromCache.description', {'auditFindings.length': auditFindings.length}) });
                } else {
                    toast({ title: "Data Ready", description: `${clusteredRecords.length} records are ready for audit. Starting audit...` });
                    runAuditNow();
                }
              } else {
                toast({ title: t('audit.toasts.noClusteredData'), description: "No records were found in clusters to audit." });
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
  }, [toast, t, runAuditNow]);



  const groupedFindings = useMemo(() => {
    const groups: { [key: string]: GroupedFinding } = {};
    findings.forEach(finding => {
      finding.records.forEach(record => {
        const key = record._internalId || record.nationalId as string;
        if (!groups[key]) {
          groups[key] = { record, issues: [] };
        }
        groups[key].issues.push({ type: finding.type, description: finding.description, severity: finding.severity });
      });
    });
    return Object.values(groups).sort((a,b) => {
        const aHigh = a.issues.some(i => i.severity === 'high');
        const bHigh = b.issues.some(i => i.severity === 'high');
        if (aHigh && !bHigh) return -1;
        if (!aHigh && bHigh) return 1;
        return b.issues.length - a.issues.length;
    });
  }, [findings]);
  
  const findingCounts = useMemo(() => {
      const counts: Record<string, number> = {
          WOMAN_MULTIPLE_HUSBANDS: 0,
          MULTIPLE_NATIONAL_IDS: 0,
          DUPLICATE_ID: 0,
          DUPLICATE_COUPLE: 0,
          HIGH_SIMILARITY: 0
      };
      findings.forEach(f => {
          if (f.type in counts) {
              counts[f.type] += 1;
          }
      });
      return counts;
  }, [findings]);

  const summaryCards = [
      { title: t('audit.findingTypes.WOMAN_MULTIPLE_HUSBANDS'), key: 'WOMAN_MULTIPLE_HUSBANDS', icon: <UserX className="h-6 w-6 text-red-500" /> },
      { title: t('audit.findingTypes.MULTIPLE_NATIONAL_IDS'), key: 'MULTIPLE_NATIONAL_IDS', icon: <Fingerprint className="h-6 w-6 text-orange-500" /> },
      { title: t('audit.findingTypes.DUPLICATE_ID'), key: 'DUPLICATE_ID', icon: <Copy className="h-6 w-6 text-yellow-500" /> },
      { title: t('audit.findingTypes.DUPLICATE_COUPLE'), key: 'DUPLICATE_COUPLE', icon: <Users className="h-6 w-6 text-blue-500" /> },
      { title: t('audit.findingTypes.HIGH_SIMILARITY'), key: 'HIGH_SIMILARITY', icon: <Sigma className="h-6 w-6 text-purple-500" /> }
  ];

  const getSeverityBadge = (severity: "high" | "medium" | "low") => {
    switch (severity) {
      case "high": return <Badge variant="destructive">{t('audit.severity.high')}</Badge>;
      case "medium": return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">{t('audit.severity.medium')}</Badge>;
      case "low": return <Badge variant="secondary">{t('audit.severity.low')}</Badge>;
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
                  <CardTitle>{t('audit.title')}</CardTitle>
                  <CardDescription>
                    {t('audit.description')}
                    {rows.length > 0 && ` ${t('audit.readyMessage', {'rows.length': rows.length})}`}
                  </CardDescription>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/review">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        {t('audit.buttons.backToReview')}
                    </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={runAuditNow} disabled={loading.audit || loading.data || rows.length === 0}>
              {loading.audit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              {findings.length > 0 ? t('audit.buttons.rerunAudit') : t('audit.buttons.runAudit')}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {loading.data ? (
        <div className="text-center text-muted-foreground py-10">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2">{t('audit.loading')}</p>
        </div>
      ) : loading.audit ? (
        <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : findings.length > 0 ? (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{t('audit.summary.title')}</CardTitle>
                    <CardDescription>{t('audit.summary.description')}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {summaryCards.map(card => (
                        <Card key={card.key}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                                {card.icon}
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{findingCounts[card.key]}</div>
                            </CardContent>
                        </Card>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>{t('audit.findings.title')}</CardTitle>
                            <CardDescription>{t('audit.findings.description', {'findings.length': findings.length, 'groupedFindings.length': groupedFindings.length})}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={goToExport}>
                               {t('audit.buttons.goToExport')}
                               <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full">
                        {groupedFindings.map((g, i) => (
                        <AccordionItem value={`item-${i}`} key={i}>
                            <AccordionTrigger>
                                <div className="flex items-center gap-4 text-left">
                                    <span className="font-semibold">{g.record.womanName}</span>
                                    <div className="flex gap-1">
                                        {g.issues.map((issue, issueIdx) => (
                                            <React.Fragment key={issueIdx}>
                                                {getSeverityBadge(issue.severity)}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                <div className="p-3 bg-muted/50 rounded-md">
                                    <h4 className="font-semibold mb-2">{t('audit.recordDetails')}</h4>
                                    <ul className="space-y-1 text-sm">
                                        <li><strong>{t('upload.mappingFields.husbandName')}:</strong> {g.record.husbandName}</li>
                                        <li><strong>{t('upload.mappingFields.nationalId')}:</strong> {String(g.record.nationalId)}</li>
                                        <li><strong>{t('upload.mappingFields.phone')}:</strong> {String(g.record.phone)}</li>
                                        <li><strong>{t('upload.mappingFields.village')}:</strong> {g.record.village}</li>
                                    </ul>
                                </div>
                                <div className="p-3">
                                    <h4 className="font-semibold mb-2">{t('audit.identifiedIssues')}</h4>
                                    <ul className="space-y-2 text-sm list-disc pl-5">
                                        {g.issues.map((issue, idx) => (
                                            <li key={idx}>
                                                <strong>{issue.type.replace(/_/g, ' ')}</strong> ({getSeverityBadge(issue.severity)}):
                                                <span className="text-muted-foreground ml-2">{issue.description}</span>
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
        </>
      ) : (
        !loading.audit && rows.length > 0 && (
            <Card className="text-center py-10">
                <CardContent className="flex flex-col items-center gap-4">
                    <ShieldCheck className="h-12 w-12 text-green-500" />
                    <h3 className="text-xl font-semibold">{t('audit.readyToAudit.title')}</h3>
                    <p className="text-muted-foreground">{t('audit.readyToAudit.description', {'rows.length': rows.length})}</p>
                </CardContent>
            </Card>
        )
      )}
    </div>
  );
}
