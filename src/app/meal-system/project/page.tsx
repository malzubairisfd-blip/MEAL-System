// src/app/project/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutDashboard, Plus, Eye, CalendarCheck } from 'lucide-react';

const FeatureCard = ({ title, href, icon }: { title: string, href: string, icon: React.ReactNode }) => (
    <Link href={href} className="block transition-all hover:shadow-lg hover:-translate-y-1 rounded-lg">
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-bold">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <Button variant="link" className="p-0">
                    Go to {title} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    </Link>
);


export default function ProjectHubPage() {
    const features = [
        { title: "Project Dashboard", href: "/meal-system/project/dashboard", icon: <LayoutDashboard className="h-8 w-8 text-blue-500" /> },
        { title: "Project Details", href: "/meal-system/project/details", icon: <Eye className="h-8 w-8 text-green-500" /> },
        { title: "Add Project", href: "/meal-system/project/add", icon: <Plus className="h-8 w-8 text-purple-500" /> },
        { title: "Project Plan", href: "/meal-system/project/plan", icon: <CalendarCheck className="h-8 w-8 text-orange-500" /> },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Project Management</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map(feature => (
                    <FeatureCard key={feature.title} {...feature} />
                ))}
            </div>
        </div>
    );
}
