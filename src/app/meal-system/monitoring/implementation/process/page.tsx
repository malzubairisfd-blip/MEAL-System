// src/app/monitoring/implementation/process/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, UserCheck, HeartPulse, CircleDollarSign, Filter } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function ProcessMonitoringPage() {
  const { t } = useTranslation();
  const activities = [
    {
      labelKey: "hubs.process.enrollment",
      descriptionKey: "hubs.process.enrollmentDesc",
      href: "/meal-system/monitoring/implementation/enrollment",
      icon: <UserCheck className="h-8 w-8 text-blue-500" />,
    },
    {
      labelKey: "hubs.process.healthSessions",
      descriptionKey: "hubs.process.healthSessionsDesc",
      href: "/meal-system/monitoring/implementation/process/monthly-health-sessions",
      icon: <HeartPulse className="h-8 w-8 text-green-500" />,
    },
    {
      labelKey: "hubs.process.disbursement",
      descriptionKey: "hubs.process.disbursementDesc",
      href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement",
      icon: <CircleDollarSign className="h-8 w-8 text-purple-500" />,
    },
    {
      labelKey: "hubs.process.cmam",
      descriptionKey: "hubs.process.cmamDesc",
      href: "/meal-system/monitoring/implementation/process/CMAM-cases",
      icon: <Filter className="h-8 w-8 text-orange-500" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('hubs.process.title')}</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('hubs.process.back')}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {activities.map((activity) => (
          <Card key={activity.labelKey} className="flex flex-col text-center items-center justify-center p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
            <div className="p-4 bg-muted rounded-full mb-4">
              {activity.icon}
            </div>
            <CardHeader className="p-0">
              <CardTitle className="text-lg">{t(activity.labelKey)}</CardTitle>
              <CardDescription className="pt-2">{t(activity.descriptionKey)}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 mt-auto">
              <Button variant="secondary" size="sm" className="group" asChild>
                <Link href={activity.href}>
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
