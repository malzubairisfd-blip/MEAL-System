
// src/app/report/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Users, Group, Unlink, BoxSelect, AlertTriangle, ShieldCheck, CheckCircle, Sigma, Fingerprint, UserX, Copy, Microscope, ClipboardList, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid } from 'recharts';
import { calculateClusterConfidence } from '@/lib/clusterConfidence';
import { getDecisionAndNote } from '@/lib/arabicClusterSummary';
import type { RecordRow } from '@/lib/types';
import type { AuditFinding } from '@/app/audit/page';
import { Button } from '@/components/ui/button';
import Link from 'next/link';


const KeyFigureCard = ({ title, value, icon, description }: { title: string, value: string | number, icon: React.ReactNode, description?: string }) => (
    <Card className="shadow-sm hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent * 100 < 5) return null;

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const topIssueIcons: Record<string, React.ReactNode> = {
    'WOMAN_MULTIPLE_HUSBANDS': <UserX className="h-4 w-4 text-red-500" />,
    'MULTIPLE_NATIONAL_IDS': <Fingerprint className="h-4 w-4 text-orange-500" />,
    'DUPLICATE_ID': <Copy className="h-4 w-4 text-yellow-500" />,
    'DUPLICATE_COUPLE': <Users className="h-4 w-4 text-blue-500" />,
    'HIGH_SIMILARITY': <Sigma className="h-4 w-4 text-purple-500" />
};


export default function ReportPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const cacheId = sessionStorage.getItem('cacheId');
            if (!cacheId) {
                toast({ title: "No Data Found", description: "Please process a file on the Upload page first.", variant: "destructive" });
                setLoading(false);
                return;
            }

            try {
                const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
                if (!res.ok) throw new Error("Failed to load cached data.");
                const cachedData = await res.json();
                
                // Pre-calculate scores if missing
                if (cachedData.clusters && cachedData.clusters.some((c: any) => c.confidence === undefined)) {
                    toast({ title: "Calculating Scores", description: "Some clusters need scores calculated before viewing the report."});
                    const clustersWithScores = await Promise.all(cachedData.clusters.map(async (cluster: any) => {
                        const pairwiseRes = await fetch("/api/pairwise", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ cluster: cluster.records }),
                        });
                        if (!pairwiseRes.ok) return cluster;
                        const pairwiseData = await pairwiseRes.json();
                        const pairs = pairwiseData.pairs || [];
                        if (pairs.length === 0) return { ...cluster, confidence: 0 };
                        
                        const womanNameScores = pairs.map((p: any) => p.breakdown.nameScore || 0);
                        const husbandNameScores = pairs.map((p: any) => p.breakdown.husbandScore || 0);
                        const avgWomanNameScore = womanNameScores.reduce((a: number, b: number) => a + b, 0) / womanNameScores.length;
                        const avgHusbandNameScore = husbandNameScores.reduce((a: number, b: number) => a + b, 0) / husbandNameScores.length;

                        return { ...cluster, confidence: calculateClusterConfidence(avgWomanNameScore, avgHusbandNameScore) };
                    }));
                    cachedData.clusters = clustersWithScores;
                }
                
                setData(cachedData);
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [toast]);

    const keyFigures = useMemo(() => {
        if (!data) return null;
        const totalRecords = data.rows?.length || 0;
        const clusteredRecords = data.clusters?.flatMap((c: any) => c.records).length || 0;
        return {
            totalRecords,
            clusteredRecords,
            unclusteredRecords: totalRecords - clusteredRecords,
            totalClusters: data.clusters?.length || 0
        };
    }, [data]);

    const auditSeverityData = useMemo(() => {
        if (!data?.auditFindings) return [];
        const counts: { [key: string]: number } = { High: 0, Medium: 0, Low: 0 };
        data.auditFindings.forEach((finding: AuditFinding) => {
            const severity = finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1);
            if (severity in counts) {
                counts[severity]++;
            }
        });
        return [
            { name: 'High', value: counts.High, color: 'hsl(var(--destructive))' },
            { name: 'Medium', value: counts.Medium, color: 'hsl(var(--chart-2))' },
            { name: 'Low', value: counts.Low, color: 'hsl(var(--chart-4))' },
        ].filter(d => d.value > 0);
    }, [data]);

    const decisionData = useMemo(() => {
        if (!data?.clusters) return [];
        const counts = {
            'تكرار مؤكد': 0,
            'اشتباه تكرار مؤكد': 0,
            'اشتباه تكرار': 0,
            'إحتمالية تكرار': 0
        };
        data.clusters.forEach((cluster: any) => {
             if (cluster.confidence === undefined) return;
            const { decision } = getDecisionAndNote(cluster.confidence);
            if (decision in counts) {
                counts[decision as keyof typeof counts]++;
            }
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).reverse();
    }, [data]);

     const topIssuesData = useMemo(() => {
        if (!data?.auditFindings) return [];
        const counts: { [key: string]: number } = {};
        data.auditFindings.forEach((finding: AuditFinding) => {
            counts[finding.type] = (counts[finding.type] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, icon: topIssueIcons[name] || <AlertTriangle/> }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [data]);


    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading report data...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-full items-center justify-center text-center">
                <div>
                    <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                    <h2 className="mt-4 text-xl font-semibold">No Data Available</h2>
                    <p className="mt-2 text-muted-foreground">Please upload and process a file to view the report.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="text-3xl font-bold">Analysis Report</CardTitle>
                            <CardDescription>A complete summary of the clustering and audit results.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild><Link href="/review"><Microscope className="mr-2"/>To Review</Link></Button>
                            <Button variant="outline" asChild><Link href="/audit"><ClipboardList className="mr-2"/>To Audit</Link></Button>
                            <Button variant="outline" asChild><Link href="/export"><FileDown className="mr-2"/>To Export</Link></Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KeyFigureCard title="Total Records" value={keyFigures?.totalRecords.toLocaleString() || 0} icon={<Users className="h-4 w-4 text-muted-foreground" />} description="Total records processed from the uploaded file." />
                <KeyFigureCard title="Clustered Records" value={keyFigures?.clusteredRecords.toLocaleString() || 0} icon={<Group className="h-4 w-4 text-muted-foreground" />} description="Records identified as potential duplicates."/>
                <KeyFigureCard title="Unclustered Records" value={keyFigures?.unclusteredRecords.toLocaleString() || 0} icon={<Unlink className="h-4 w-4 text-muted-foreground" />} description="Unique records with no duplicates found." />
                <KeyFigureCard title="Total Clusters" value={keyFigures?.totalClusters.toLocaleString() || 0} icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} description="Total number of duplicate groups found."/>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Audit Findings by Severity</CardTitle>
                        <CardDescription>Breakdown of identified issues by their severity level.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                         {auditSeverityData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={auditSeverityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} labelLine={false} label={renderCustomizedLabel} paddingAngle={5}>
                                        {auditSeverityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                                <ShieldCheck className="h-12 w-12 text-green-500" />
                                <p className="mt-2 font-medium">No Audit Findings</p>
                                <p className="text-xs">The last run did not produce any audit issues.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Cluster Decision Analysis</CardTitle>
                         <CardDescription>Distribution of clusters based on the final decision category.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={decisionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Top 5 Audit Issues by Type</CardTitle>
                    <CardDescription>The most frequent types of data integrity issues found in the records.</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                     {topIssuesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={topIssuesData} layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                                <Bar dataKey="value" fill="hsl(var(--primary) / 0.8)" radius={[0, 4, 4, 0]} barSize={25}>
                                     {topIssuesData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${index + 1}))`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                         <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <p className="mt-2 font-medium">No Audit Issues Found</p>
                             <p className="text-xs">The data appears to be clean based on the audit rules.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}

