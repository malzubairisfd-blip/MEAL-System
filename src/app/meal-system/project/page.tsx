// src/app/project/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutDashboard, Plus, Eye, CalendarCheck } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

const FeatureCard = ({ title, href, icon }: { title: string, href: string, icon: React.ReactNode }) => {
    const { t } = useTranslation();
    const { direction } = useLanguage();
    return (
        <Link href={href} className="block transition-all hover:shadow-lg hover:-translate-y-1 rounded-lg">
            <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-bold">{title}</CardTitle>
                    {icon}
                </CardHeader>
                <CardContent>
                    <Button variant="link" className="p-0">
                        <div className={cn("flex items-center gap-1", direction === 'rtl' && 'flex-row-reverse')}>
                            <span>{t('hubs.buttons.go')} {title}</span>
                            <ArrowRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-1", direction === 'rtl' && 'rotate-180 group-hover:-translate-x-1')} />
                        </div>
                    </Button>
                </CardContent>
            </Card>
        </Link>
    );
};


export default function ProjectHubPage() {
    const { t } = useTranslation();
    const features = [
        { labelKey: "hubs.project.dashboard", href: "/meal-system/project/dashboard", icon: <LayoutDashboard className="h-8 w-8 text-blue-500" /> },
        { labelKey: "hubs.project.details", href: "/meal-system/project/details", icon: <Eye className="h-8 w-8 text-green-500" /> },
        { labelKey: "hubs.project.add", href: "/meal-system/project/add", icon: <Plus className="h-8 w-8 text-purple-500" /> },
        { labelKey: "hubs.project.plan", href: "/meal-system/project/plan", icon: <CalendarCheck className="h-8 w-8 text-orange-500" /> },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">{t('hubs.project.title')}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map(feature => (
                    <FeatureCard key={feature.labelKey} title={t(feature.labelKey)} href={feature.href} icon={feature.icon} />
                ))}
            </div>
        </div>
    );
}
