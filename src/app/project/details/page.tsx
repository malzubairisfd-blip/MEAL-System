// src/app/project/details/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building, CheckCircle, Clock, MapPin, Flag, Users, CircleDollarSign, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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

export default function ProjectDetailsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
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

    const selectedProject = useMemo(() => {
        return projects.find(p => p.projectId === selectedProjectId);
    }, [projects, selectedProjectId]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Project Details</h1>
                 <Button variant="outline" asChild>
                    <Link href="/project">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Hub
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select a Project</CardTitle>
                    <CardDescription>Choose a project from the list to view its detailed information.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={loading ? "Loading projects..." : "Select a project..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.projectId} value={p.projectId}>
                                    {p.projectName} ({p.projectId})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedProject && (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl">{selectedProject.projectName}</CardTitle>
                                <CardDescription>Project ID: {selectedProject.projectId}</CardDescription>
                            </div>
                            <Badge variant={selectedProject.status === 'Completed' ? 'default' : 'secondary'} className={selectedProject.status === 'Completed' ? 'bg-green-500' : 'bg-orange-500'}>
                                {selectedProject.status === 'Completed' ? <CheckCircle className="mr-2 h-4 w-4"/> : <Clock className="mr-2 h-4 w-4"/>}
                                {selectedProject.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="font-semibold mb-2">Project Summary</h3>
                            <p className="text-muted-foreground bg-slate-50 p-4 rounded-md border">{selectedProject.summary}</p>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <InfoItem icon={<Calendar className="text-blue-500"/>} label="Project Duration" value={`${selectedProject.startDateMonth}/${selectedProject.startDateYear} - ${selectedProject.endDateMonth}/${selectedProject.endDateYear}`} />
                            <InfoItem icon={<CircleDollarSign className="text-green-500"/>} label="Total Budget" value={`$${selectedProject.budget.toLocaleString()}`} />
                            <InfoItem icon={<Users className="text-teal-500"/>} label="Beneficiaries Reached" value={selectedProject.beneficiaries.toLocaleString()} />
                            
                            <InfoItem icon={<MapPin className="text-purple-500"/>} label="Governorates" value={selectedProject.governorates.join(', ')} />
                            <InfoItem icon={<MapPin className="text-purple-500"/>} label="Districts" value={selectedProject.districts.join(', ')} />
                            <InfoItem icon={<MapPin className="text-purple-500"/>} label="Sub-Districts" value={selectedProject.subDistricts.join(', ')} />
                            
                            <InfoItem icon={<Flag className="text-red-500"/>} label="Villages Targeted" value={selectedProject.villages.toLocaleString()} />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="flex items-start space-x-4">
        <div className="bg-muted p-3 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
        </div>
    </div>
);
