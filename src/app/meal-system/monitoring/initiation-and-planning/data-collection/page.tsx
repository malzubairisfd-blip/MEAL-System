// src/app/monitoring/data-collection/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Table, DatabaseZap, Binary, Percent, FileQuestion, Users, UserCheck, Sheet, Target } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function DataCollectionPlanPage() {
  const { t } = useTranslation();
  const dataCollectionSteps = [
    { labelKey: "hubs.dataCollection.mePlanTable", icon: <Table className="h-8 w-8 text-blue-500" />, href: "/meal-system/monitoring/initiation-and-planning/me-plan-table" },
    { labelKey: "hubs.dataCollection.prepareIndicators", icon: <Target className="h-8 w-8 text-orange-500" />, href: "/meal-system/monitoring/initiation-and-planning/prepare-indicators" },
    { labelKey: "hubs.dataCollection.secondaryData", icon: <DatabaseZap className="h-8 w-8 text-indigo-500" />, href: "/meal-system/monitoring/initiation-and-planning/data-collection/secondary-data" },
    { labelKey: "hubs.dataCollection.dataTypes", icon: <Binary className="h-8 w-8 text-purple-500" />, href: "/meal-system/monitoring/initiation-and-planning/data-collection/data-types" },
    { labelKey: "hubs.dataCollection.sampling", icon: <Percent className="h-8 w-8 text-sky-500" />, href: "/meal-system/monitoring/initiation-and-planning/sampling-calculator" },
    { labelKey: "hubs.dataCollection.surveys", icon: <FileQuestion className="h-8 w-8 text-green-500" />, href: "/meal-system/monitoring/initiation-and-planning/data-collection/surveys" },
    { labelKey: "hubs.dataCollection.staffCriteria", icon: <UserCheck className="h-8 w-8 text-red-500" />, href: "/meal-system/monitoring/initiation-and-planning/data-collection/staff-criteria" },
    { labelKey: "hubs.dataCollection.itt", icon: <Sheet className="h-8 w-8 text-yellow-500" />, href: "/meal-system/monitoring/initiation-and-planning/data-collection/itt" },
  ];

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold">{t('hubs.dataCollection.title')}</h1>
            <CardDescription>{t('hubs.dataCollection.description')}</CardDescription>
        </div>
        <Button variant="outline" asChild>
            <Link href="/meal-system/monitoring/initiation-and-planning">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('hubs.dataCollection.back')}
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dataCollectionSteps.map((step) => (
          <Card key={step.labelKey} className="flex flex-col text-center items-center justify-center p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
            <div className="p-4 bg-muted rounded-full mb-4">
                {step.icon}
            </div>
            <CardHeader className="p-0">
                <CardTitle className="text-base">{t(step.labelKey)}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <Button variant="secondary" size="sm" className="mt-4 group" asChild>
                    <Link href={step.href}>
                        {t('hubs.buttons.viewDetails')} <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
