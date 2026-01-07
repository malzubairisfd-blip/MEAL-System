// src/app/project/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building, CheckCircle, Clock, MapPin, Flag, Users, CircleDollarSign, ArrowLeft } from 'lucide-react';

interface Project {
  projectId: string;
  projectName: string;
  governorates: string[];
  districts: string[];
  subDistricts: string[];
  villages: number;
  startDateMonth: string;
  startDateYear: string;
  endDateMonth: string;
  endDateYear: string;
  beneficiaries: number;
  budget: number;
  status: 'Completed' | 'Ongoing';
  summary: string;
}

const KPICard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <Card className="transition-all hover:shadow-md hover:-translate-y-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export default function ProjectDashboardPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to fetch projects");
                const data = await res.json();
                setProjects(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const kpis = useMemo(() => {
        if (loading || projects.length === 0) {
            return [
                { title: "Total Projects", value: "...", icon: <Building /> },
                { title: "Projects Completed", value: "...", icon: <CheckCircle /> },
                { title: "Projects Ongoing", value: "...", icon: <Clock /> },
                { title: "Governorates Targeted", value: "...", icon: <MapPin /> },
                { title: "Districts Targeted", value: "...", icon: <MapPin /> },
                { title: "Villages Targeted", value: "...", icon: <Flag /> },
                { title: "Beneficiaries Reached", value: "...", icon: <Users /> },
                { title: "Total Budget", value: "$...", icon: <CircleDollarSign /> },
            ];
        }

        const totalProjects = projects.length;
        const completedProjects = projects.filter(p => p.status === 'Completed').length;
        const ongoingProjects = projects.filter(p => p.status === 'Ongoing').length;
        const totalGovernorates = new Set(projects.flatMap(p => p.governorates)).size;
        const totalDistricts = new Set(projects.flatMap(p => p.districts)).size;
        const totalVillages = projects.reduce((sum, p) => sum + Number(p.villages || 0), 0);
        const totalBeneficiaries = projects.reduce((sum, p) => sum + Number(p.beneficiaries || 0), 0);
        const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);

        return [
            { title: "Total Projects", value: totalProjects, icon: <Building className="text-blue-500" /> },
            { title: "Projects Completed", value: completedProjects, icon: <CheckCircle className="text-green-500" /> },
            { title: "Projects Ongoing", value: ongoingProjects, icon: <Clock className="text-orange-500" /> },
            { title: "Governorates Targeted", value: totalGovernorates, icon: <MapPin className="text-purple-500" /> },
            { title: "Districts Targeted", value: totalDistricts, icon: <MapPin className="text-purple-500" /> },
            { title: "Villages Targeted", value: totalVillages.toLocaleString(), icon: <Flag className="text-red-500" /> },
            { title: "Beneficiaries Reached", value: totalBeneficiaries.toLocaleString(), icon: <Users className="text-teal-500" /> },
            { title: "Total Budget", value: `$${totalBudget.toLocaleString()}`, icon: <CircleDollarSign className="text-yellow-500" /> },
        ];
    }, [projects, loading]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Projects Dashboard</h1>
                <Button variant="outline" asChild>
                    <Link href="/project">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Hub
                    </Link>
                </Button>
            </div>

            {loading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i}><CardHeader><CardTitle className="h-5 bg-muted rounded w-3/4"></CardTitle></CardHeader><CardContent><div className="h-8 bg-muted rounded w-1/2"></div></CardContent></Card>
                    ))}
                 </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpis.map(kpi => (
                        <KPICard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} />
                    ))}
                </div>
            )}
        </div>
    );
}
