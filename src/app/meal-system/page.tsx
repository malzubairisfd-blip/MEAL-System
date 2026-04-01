// src/app/meal-system/page.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Monitor,
  ClipboardCheck,
  Database,
  PieChart,
  FileText,
  ShieldAlert,
  MessageSquareWarning,
  ListChecks,
  Target,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/hooks/use-translation";

export default function MealSystemPage() {
  const { t } = useTranslation();

  const mealFeatures = [
    { href: "/meal-system/project", icon: <Briefcase className="h-8 w-8 text-indigo-500" />, labelKey: "sidebar.projectManagement" },
    { href: "/meal-system/monitoring", icon: <Monitor className="h-8 w-8 text-blue-500" />, labelKey: "sidebar.monitoring" },
    { href: "/meal-system/evaluation", icon: <ClipboardCheck className="h-8 w-8 text-green-500" />, labelKey: "sidebar.evaluation" },
    { href: "/meal-system/monitoring/initiation-and-planning/data-collection", icon: <Database className="h-8 w-8 text-sky-500" />, labelKey: "sidebar.dataCollection" },
    { href: "/meal-system/analysis", icon: <PieChart className="h-8 w-8 text-purple-500" />, labelKey: "sidebar.analysis" },
    { href: "/meal-system/reporting", icon: <FileText className="h-8 w-8 text-slate-500" />, labelKey: "sidebar.reporting" },
    { href: "/meal-system/risk", icon: <ShieldAlert className="h-8 w-8 text-red-500" />, labelKey: "sidebar.risk" },
    { href: "/meal-system/compliant", icon: <MessageSquareWarning className="h-8 w-8 text-yellow-500" />, labelKey: "sidebar.compliant" },
    { href: "/meal-system/project/logframe", icon: <ListChecks className="h-8 w-8 text-cyan-500" />, labelKey: "sidebar.logframe" },
    { href: "/meal-system/indicator", icon: <Target className="h-8 w-8 text-orange-500" />, labelKey: "sidebar.indicator" },
    { href: "/meal-system/settings", icon: <Settings className="h-8 w-8 text-gray-500" />, labelKey: "sidebar.settings" },
  ];

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('hubs.mealSystem.title')}</h1>
        <Button variant="outline" asChild>
            <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('hubs.mealSystem.back')}
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {mealFeatures.map((feature, index) => (
          <Card key={index} className="flex flex-col items-center justify-center p-4 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="rounded-lg bg-muted p-4 mb-4">
              {feature.icon}
            </div>
            <h3 className="font-semibold text-sm mb-2">{t(feature.labelKey)}</h3>
            <Button variant="secondary" size="sm" className="w-full mt-auto group" asChild>
                <Link href={feature.href}>
                    {t('hubs.buttons.go')} <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
