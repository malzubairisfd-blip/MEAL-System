
"use client";
import React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Loader2, ChevronLeft, ArrowRight, UserX, Users, Ban, Fingerprint, Copy, Sigma, BarChartHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadCachedResult } from "@/lib/cache";
import { openDB } from 'idb';
import { useTranslation } from "@/hooks/use-translation";
import { runClientSideAudit } from "@/lib/auditEngine";


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

type Cluster = {
  records: RecordRow[];
  reasons: string[];
};

async function saveAuditFindings(auditFindings: AuditFinding[]) {
  const db = await openDB('beneficiary-insights-cache', 1);
  const tx = db.transaction('results', 'readwrite');
  const store = tx.objectStore('results');
  const currentData = await store.get('FULL_RESULT');
  if (currentData) {
    currentData.auditFindings = auditFindings;
    await store.put(currentData, 'FULL_RESULT');
  }
  await tx.done;
}

export default function AuditPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState({ data: true, audit: false });
  const { toast } = useToast();
  const router = useRouter();

  const runAuditNow = useCallback(async (clustersToAudit: Cluster[]) => {
    if (clustersToAudit.length === 0) {
        toast({ title: "No Data", description: "No cluster data available to audit.", variant: "destructive" });
        return;
    }
    
    setLoading(prev => ({...prev, audit: true}));
    try {
        // This now runs on the client-side
        const newFindings = await runClientSideAudit(clustersToAudit);
        
        setFindings(newFindings);
        await saveAuditFindings(newFindings); // Cache the findings

        toast({ title: t('audit.toasts.auditComplete'), description: t('audit.toasts.issuesFound', { newFindings: newFindings.length }) });

    } catch (error: any) {
        toast({ title: t('audit.toasts.auditError'), description: error.message || "Could not connect to the audit service.", variant: "destructive" });
    } finally {
        setLoading(prev => ({...prev, audit: false}));
    }
  }, [toast, t]);


  useEffect(() => {
    async function getData() {
      setLoading(prev => ({...prev, data: true}));
      const cachedResult = await loadCachedResult();

      if (cachedResult && cachedResult.clusters) {
        const loadedClusters = cachedResult.clusters || [];
        const auditFindings = cachedResult.auditFindings; 

        setClusters(loadedClusters);

        const clusteredRecords = loadedClusters.map((c: any) => c.records).flat();
        setRows(clusteredRecords);

        if (clusteredRecords.length > 0) {
           if (auditFindings) {
              setFindings(auditFindings);
              toast({ title: t('audit.toasts.loadedFromCache.title'), description: t('audit.toasts.loadedFromCache.description', { auditFindings: auditFindings.length }) });
          } else {
              toast({ title: t('review.toasts.noData.title'), description: `${clusteredRecords.length} ${t('audit.readyMessage', { rows: clusteredRecords.length })}` });
              runAuditNow(loadedClusters);
          }
        } else {
          toast({ title: t('audit.toasts.noClusteredData') });
        }
      } else {
        toast({ title: t('review.toasts.noData.title'), description: t('review.toasts.noData.description'), variant: "destructive" });
      }
      setLoading(prev => ({...prev, data: false}));
    }

    getData();
  }, [toast, runAuditNow, t]);



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
                    {rows.length > 0 && ` ${t('audit.readyMessage', { rows: rows.length })}`}
                  </CardDescription>
                </div>
                 <div className="flex flex-col gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/review">
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            {t('audit.buttons.backToReview')}
                        </Link>
                    </Button>
                     <Button onClick={() => router.push('/report')}>
                        {t('sidebar.report')}
                        <BarChartHorizontal className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={() => runAuditNow(clusters)} disabled={loading.audit || loading.data || rows.length === 0}>
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
                            <CardDescription>{t('audit.findings.description', { findings: findings.length, groupedFindings: groupedFindings.length })}</CardDescription>
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
                                                <strong>{t(`audit.findingTypes.${issue.type}`)}</strong> ({getSeverityBadge(issue.severity)}):
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
                    <p className="text-muted-foreground">{t('audit.readyToAudit.description', { rows: rows.length })}</p>
                </CardContent>
            </Card>
        )
      )}
    </div>
  );
}
