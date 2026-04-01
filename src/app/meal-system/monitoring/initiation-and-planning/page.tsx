// src/app/monitoring/initiation-and-planning/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Target, Database, BarChart3, FileText, Users, CircleDollarSign } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function InitiationAndPlanningPage() {
  const { t } = useTranslation();

  const planningSteps = [
    { href: "/meal-system/monitoring/initiation-and-planning/purpose-and-scope", icon: <Target className="h-8 w-8 text-indigo-500" />, labelKey: "hubs.initiation.purpose" },
    { href: "/meal-system/monitoring/initiation-and-planning/data-collection", icon: <Database className="h-8 w-8 text-blue-500" />, labelKey: "hubs.initiation.dataCollection" },
    { href: "/meal-system/monitoring/initiation-and-planning/data-analysis", icon: <BarChart3 className="h-8 w-8 text-green-500" />, labelKey: "hubs.initiation.dataAnalysis" },
    { href: "/meal-system/monitoring/initiation-and-planning/reporting", icon: <FileText className="h-8 w-8 text-sky-500" />, labelKey: "hubs.initiation.reporting" },
    { href: "/meal-system/monitoring/initiation-and-planning/hr", icon: <Users className="h-8 w-8 text-purple-500" />, labelKey: "hubs.initiation.hr" },
    { href: "/meal-system/monitoring/initiation-and-planning/budget", icon: <CircleDollarSign className="h-8 w-8 text-slate-500" />, labelKey: "hubs.initiation.budget" },
  ];

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('hubs.initiation.title')}</h1>
        <Button variant="outline" asChild>
            <Link href="/meal-system/monitoring">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('hubs.initiation.back')}
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {planningSteps.map((step, index) => (
          <Card key={index} className="flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="rounded-lg bg-muted p-4">
                    {step.icon}
                </div>
                <CardTitle className="text-base font-semibold">{t(step.labelKey)}</CardTitle>
            </CardHeader>
            <CardContent className="mt-auto flex justify-end">
                <Button variant="secondary" size="sm" className="group" asChild>
                    <Link href={step.href}>
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
