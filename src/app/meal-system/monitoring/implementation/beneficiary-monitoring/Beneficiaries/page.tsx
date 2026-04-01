// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Wrench, Microscope, ClipboardList, BarChartHorizontal, FileDown, ArrowRight, Database } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function BeneficiariesPage() {
    const { t } = useTranslation();
    const features = [
            { labelKey: "hubs.beneficiaries.upload", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/upload", icon: <Upload className="h-8 w-8 text-blue-500" /> },
            { labelKey: "hubs.beneficiaries.correction", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/correction", icon: <Wrench className="h-8 w-8 text-teal-500" /> },
            { labelKey: "hubs.beneficiaries.review", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review", icon: <Microscope className="h-8 w-8 text-purple-500" /> },
            { labelKey: "hubs.beneficiaries.database", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/database", icon: <Database className="h-8 w-8 text-indigo-500" /> },
            { labelKey: "hubs.beneficiaries.audit", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/audit", icon: <ClipboardList className="h-8 w-8 text-orange-500" /> },
            { labelKey: "hubs.beneficiaries.report", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/report", icon: <BarChartHorizontal className="h-8 w-8 text-green-500" /> },
            { labelKey: "hubs.beneficiaries.export", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/export", icon: <FileDown className="h-8 w-8 text-red-500" /> },
        ];

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">{t('hubs.beneficiaries.title')}</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('hubs.beneficiaries.back')}
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature) => (
                    <Card key={feature.labelKey} className="flex flex-col text-center items-center justify-center p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
                        <div className="p-4 bg-muted rounded-full mb-4">
                            {feature.icon}
                        </div>
                        <CardHeader className="p-0">
                            <CardTitle className="text-base">{t(feature.labelKey)}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 mt-auto">
                            <Button variant="secondary" size="sm" className="group" asChild>
                                <Link href={feature.href}>
                                    {t('hubs.buttons.go')} <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
