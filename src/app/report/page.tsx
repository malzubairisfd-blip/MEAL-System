// src/app/report/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Users, Group, Unlink, BoxSelect, AlertTriangle, ShieldCheck, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';
import { getDecisionAndNote } from '@/lib/arabicClusterSummary';
import type { RecordRow } from '@/lib/types';
import type { AuditFinding } from '@/app/audit/page';


const KeyFigureCard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
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
        const counts = { high: 0, medium: 0, low: 0 };
        data.auditFindings.forEach((finding: AuditFinding) => {
            if (finding.severity in counts) {
                counts[finding.severity]++;
            }
        });
        return [
            { name: 'High', value: counts.high, color: '#DC2626' },
            { name: 'Medium', value: counts.medium, color: '#F97316' },
            { name: 'Low', value: counts.low, color: '#6B7280' },
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
            const { decision } = getDecisionAndNote(cluster.confidence || 0);
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
            const type = finding.type.replace(/_/g, ' ');
            counts[type] = (counts[type] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
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
            <Card>
                <CardHeader>
                    <CardTitle>Analysis Report</CardTitle>
                    <CardDescription>A complete summary of the clustering and audit results.</CardDescription>
                </CardHeader>
            </Card>

            {/* Key Figures */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KeyFigureCard title="Total Records" value={keyFigures?.totalRecords || 0} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
                <KeyFigureCard title="Clustered Records" value={keyFigures?.clusteredRecords || 0} icon={<Group className="h-4 w-4 text-muted-foreground" />} />
                <KeyFigureCard title="Unclustered Records" value={keyFigures?.unclusteredRecords || 0} icon={<Unlink className="h-4 w-4 text-muted-foreground" />} />
                <KeyFigureCard title="Total Clusters" value={keyFigures?.totalClusters || 0} icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                {/* Audit Findings by Severity */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Audit Findings by Severity</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                         {auditSeverityData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={auditSeverityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={renderCustomizedLabel}>
                                        {auditSeverityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                                <ShieldCheck className="h-12 w-12 text-green-500" />
                                <p className="mt-2">No audit findings from the last run.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Cluster Decision Analysis */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Cluster Decision Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={decisionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Top Audit Issues by Type</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                     {topIssuesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={topIssuesData} margin={{ top: 5, right: 20, left: 20, bottom: 40 }}>
                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                         <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <p className="mt-2">No audit issues found.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
